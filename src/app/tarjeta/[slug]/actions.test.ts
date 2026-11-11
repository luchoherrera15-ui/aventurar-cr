import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * `afiliarPorQr` — el formulario público de Bookea para unirse a una
 * tarjeta (11 nov 2026). Una tarjeta de Foorkie con CÓDIGO (las de equipo
 * de «Tostado Café Bistró») se une solo en Foorkie, que revisa el código.
 * La pantalla ya redirige; esta guardia cierra el formulario mandado a
 * mano. Se fija que la de código rebota sin llegar al alta y que las demás
 * —la principal de Foorkie, una extra sin código y las de Bookea— llegan
 * al alta como siempre.
 */

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};

function consulta(tabla: string) {
  const filtros: [string, string, unknown][] = [];
  let unico = false;
  let limite: number | null = null;
  const b: Record<string, unknown> = {
    select: () => b,
    order: () => b,
    eq: (col: string, v: unknown) => {
      filtros.push(["eq", col, v]);
      return b;
    },
    in: (col: string, v: unknown[]) => {
      filtros.push(["in", col, v]);
      return b;
    },
    limit: (n: number) => {
      limite = n;
      return b;
    },
    maybeSingle: () => {
      unico = true;
      return b;
    },
    then: (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          const filas = (tablas[tabla] ?? []).filter((f) =>
            filtros.every(([op, col, v]) => (op === "eq" ? f[col] === v : (v as unknown[]).includes(f[col]))),
          );
          const cortadas = limite === null ? filas : filas.slice(0, limite);
          return { data: unico ? (cortadas[0] ?? null) : cortadas, error: null };
        })
        .then(ok, mal),
  };
  return b;
}

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => consulta(t) }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/lib/lealtad/personas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lealtad/personas")>()),
  personaDelToken: async () => null,
  // Lo que importa es SI se llega al alta: acá contesta un error para que la acción termine sin redirigir.
  altaPorQr: vi.fn(async () => ({ estado: "error", mensaje: "llegó al alta" })),
}));

import { altaPorQr } from "@/lib/lealtad/personas";
import { afiliarPorQr, type EstadoAlta } from "./actions";

/** El estado con el que arranca el formulario. */
const SIN_ESTADO: EstadoAlta = { error: null };

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PUNTOS = "22222222-2222-4222-8222-222222222222";
const EQUIPO_1 = "33333333-3333-4333-8333-333333333333";
const EQUIPO_2 = "44444444-4444-4444-8444-444444444444";

function formulario(llave: string): FormData {
  const f = new FormData();
  f.set("slug", "tostado-cafe-bistro");
  f.set("tarjeta", llave);
  f.set("nombre", "Ana Pérez");
  f.set("correo", "ana@ejemplo.com");
  return f;
}

const programa = (id: string, nombre: string, creada: string) => ({
  id,
  rancho_id: RANCHO,
  nombre,
  modo: "puntos",
  estado: "activo",
  activo: true,
  created_at: creada,
});

beforeEach(() => {
  vi.mocked(altaPorQr).mockClear();
  const local = { id: "local-tostado", slug: "tostado", activo: true, estado_publicacion: "aprobado", created_at: "2026-11-11T00:00:00Z", lealtad_por_foorkie: true };
  tablas = {
    ranchos: [{ id: RANCHO, slug: "tostado-cafe-bistro", nombre: "Tostado Café Bistró", plan_lealtad: "impulso" }],
    programa_lealtad: [
      programa(PUNTOS, "Puntos", "2026-11-11T00:00:00Z"),
      programa(EQUIPO_1, "Equipo 1", "2026-11-11T00:01:00Z"),
      programa(EQUIPO_2, "Equipo 2", "2026-11-11T00:02:00Z"),
    ],
    foorkie_restaurantes: [{ ...local, bookea_rancho_id: RANCHO, bookea_programa_id: PUNTOS }],
    foorkie_lealtad_vinculos: [
      { ...local, bookea_rancho_id: RANCHO, bookea_programa_id: EQUIPO_1, principal: false, tarjeta_slug: "equipo-1", requiere_codigo: true },
      { ...local, bookea_rancho_id: RANCHO, bookea_programa_id: EQUIPO_2, principal: false, tarjeta_slug: "equipo-2", requiere_codigo: false },
    ],
  };
});

describe("afiliarPorQr: una tarjeta de Foorkie con código no se une por Bookea", () => {
  it("la de código rebota, sin llegar al alta", async () => {
    const r = await afiliarPorQr(SIN_ESTADO, formulario(EQUIPO_1));
    expect(r).toEqual({ error: "Esta tarjeta se activa desde Foorkie, con el código que entrega el local." });
    expect(altaPorQr).not.toHaveBeenCalled();
  });

  it("una extra sin código y la principal llegan al alta como siempre", async () => {
    expect(await afiliarPorQr(SIN_ESTADO, formulario(EQUIPO_2))).toEqual({ error: "llegó al alta" });
    expect(await afiliarPorQr(SIN_ESTADO, formulario(PUNTOS))).toEqual({ error: "llegó al alta" });
    expect(altaPorQr).toHaveBeenCalledTimes(2);
  });

  it("sin la migración de Foorkie (la vista no existe), nada cambia", async () => {
    delete tablas.foorkie_lealtad_vinculos;
    expect(await afiliarPorQr(SIN_ESTADO, formulario(EQUIPO_1))).toEqual({ error: "llegó al alta" });
  });
});
