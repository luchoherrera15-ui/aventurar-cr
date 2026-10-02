import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avisarPorVencerEnElPase, tarjetasDeFoorkie, type AccionesAvisoEnElPase } from "./foorkie-vencimiento";

/**
 * El vencimiento en las tarjetas de Foorkie (0253): cuáles son de Foorkie
 * (una consulta, y ante la duda ninguna) y el aviso que va a su pase en
 * vez del correo de Bookea.
 */

type Fila = Record<string, unknown>;

function base(tablas: Record<string, Fila[]>, { falla = false }: { falla?: boolean } = {}) {
  return {
    from(tabla: string) {
      const eqs: [string, unknown][] = [];
      const ins: [string, unknown[]][] = [];
      let unico = false;
      const b = {
        select: () => b,
        eq: (c: string, v: unknown) => {
          eqs.push([c, v]);
          return b;
        },
        in: (c: string, vs: unknown[]) => {
          ins.push([c, vs]);
          return b;
        },
        limit: () => b,
        maybeSingle: () => {
          unico = true;
          return b;
        },
        then: (ok: (r: unknown) => unknown) => {
          if (falla) return Promise.resolve({ data: null, error: { message: "la base no contesta" } }).then(ok);
          const filas = (tablas[tabla] ?? []).filter((f) => eqs.every(([c, v]) => f[c] === v) && ins.every(([c, vs]) => vs.includes(f[c])));
          return Promise.resolve({ data: unico ? (filas[0] ?? null) : filas, error: null }).then(ok);
        },
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

const local = (extra: Fila = {}): Fila => ({
  bookea_programa_id: "p-dg",
  bookea_rancho_id: "r-dg",
  lealtad_por_foorkie: true,
  slug: "donde-george",
  activo: true,
  estado_publicacion: "aprobado",
  created_at: "2026-01-01",
  ...extra,
});

describe("tarjetasDeFoorkie — cuáles son de Foorkie", () => {
  it("solo las vinculadas CON la marca y con el mismo negocio", async () => {
    const db = base({
      foorkie_restaurantes: [
        local(),
        local({ bookea_programa_id: "p-pm", bookea_rancho_id: "r-pm", lealtad_por_foorkie: false, slug: "pura-matcha" }),
        local({ bookea_programa_id: "p-mal", bookea_rancho_id: "otro-negocio", slug: "mal-vinculado" }),
      ],
    });
    const r = await tarjetasDeFoorkie(db, [
      { id: "p-dg", rancho_id: "r-dg" },
      { id: "p-pm", rancho_id: "r-pm" },
      { id: "p-mal", rancho_id: "r-mal" },
      { id: "p-bookea", rancho_id: "r-b" },
    ]);
    expect([...r]).toEqual(["p-dg"]);
  });

  it("si la base no contesta, ninguna (nadie pierde saldo por una consulta caída)", async () => {
    expect([...(await tarjetasDeFoorkie(base({}, { falla: true }), [{ id: "p-dg", rancho_id: "r-dg" }]))]).toEqual([]);
  });
});

function espia(): { acciones: AccionesAvisoEnElPase; pasos: string[] } {
  const pasos: string[] = [];
  return {
    pasos,
    acciones: {
      escribir: async (_db, miembro, texto) => {
        pasos.push(`apple:${miembro}:${texto}`);
        return true;
      },
      avisarPase: async (miembro) => {
        pasos.push(`push:${miembro}`);
      },
      avisarGoogle: async (miembro, aviso) => {
        pasos.push(`google:${miembro}:${aviso.evento}:${aviso.encabezado}`);
        return { ok: true };
      },
    },
  };
}

describe("avisarPorVencerEnElPase — el aviso 14 días antes, en el teléfono", () => {
  const tablas = (pases: Fila[]): Record<string, Fila[]> => ({
    miembros: [{ id: "m-1", programa_id: "p-dg" }],
    programa_lealtad: [{ id: "p-dg", rancho_id: "r-dg", modo: "cashback" }],
    foorkie_restaurantes: [local()],
    pases_wallet: pases,
  });

  it("Apple: el renglón ANTES del push; Google: el mensaje DESPUÉS, con la marca de Foorkie", async () => {
    const { acciones, pasos } = espia();
    const db = base(tablas([
      { miembro_id: "m-1", plataforma: "apple", activo: true },
      { miembro_id: "m-1", plataforma: "google", activo: true },
    ]));
    const ok = await avisarPorVencerEnElPase(db, { miembroId: "m-1", venceEl: "2026-12-17", saldo: 2350 }, acciones);
    expect(ok).toBe(true);
    expect(pasos).toEqual([
      `apple:m-1:Tus ₡${(2350).toLocaleString("es-CR")} de cashback vencen el 17 de diciembre de 2026. Usalos o volvé antes y no los perdés.`,
      "push:m-1",
      "google:m-1:vence:Foorkie",
    ]);
  });

  it("sin pases, no hay a quién avisar", async () => {
    const { acciones, pasos } = espia();
    expect(await avisarPorVencerEnElPase(base(tablas([])), { miembroId: "m-1", venceEl: "2026-12-17", saldo: 2350 }, acciones)).toBe(false);
    expect(pasos).toEqual([]);
  });

  it("una tarjeta sin la marca de Foorkie no recibe nada de acá", async () => {
    const { acciones, pasos } = espia();
    const t = tablas([{ miembro_id: "m-1", plataforma: "apple", activo: true }]);
    t.foorkie_restaurantes = [local({ lealtad_por_foorkie: false })];
    expect(await avisarPorVencerEnElPase(base(t), { miembroId: "m-1", venceEl: "2026-12-17", saldo: 2350 }, acciones)).toBe(false);
    expect(pasos).toEqual([]);
  });
});
