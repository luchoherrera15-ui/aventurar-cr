import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tarjetasExtraDeFoorkie, VISTA_VINCULOS_FOORKIE } from "./foorkie-tarjetas-extra";
import {
  destinoDeFoorkieDeLaTarjeta,
  localDeFoorkieDeLaTarjeta,
  losCorreosLosMandaFoorkie,
  marcaDelPase,
  urlUnirseFoorkie,
} from "./foorkie-marca";
import { vinculoConFoorkie } from "./foorkie";
import { tarjetasDeFoorkie } from "./foorkie-vencimiento";

/**
 * VARIAS TARJETAS EN UN LOCAL DE FOORKIE (11 nov 2026, «Tostado Café
 * Bistró»: puntos + dos tarjetas de socio de equipos deportivos).
 *
 * Lo que se fija:
 *   · una tarjeta EXTRA (de la vista de Foorkie) es de Foorkie para el
 *     motor —marca del pase, correos, vínculo de la caja, vencimientos—
 *     con el mismo par negocio + tarjeta y la misma marca que la principal;
 *   · la principal se resuelve EXACTAMENTE como antes: una consulta y la
 *     vista ni se pregunta;
 *   · su página es `/lealtad/<local>/<tarjeta>`, y una con código no
 *     ofrece «Invitá a alguien» en el pase;
 *   · sin la migración de Foorkie (la vista no existe) todo es como hoy,
 *     y sin llenar los registros.
 */

const RANCHO = "11111111-1111-4111-8111-111111111111";
const OTRO_RANCHO = "22222222-2222-4222-8222-222222222222";
const PRINCIPAL = "33333333-3333-4333-8333-333333333333";
const PUNTOS = PRINCIPAL;
const EQUIPO_1 = "44444444-4444-4444-8444-444444444444";
const EQUIPO_2 = "55555555-5555-4555-8555-555555555555";
const AJENA = "66666666-6666-4666-8666-666666666666";

type Fila = Record<string, unknown>;
type Consulta = { tabla: string; filtros: [string, string, unknown][] };

/** Una base de mentira que APLICA eq / in / limit y anota cada consulta. */
function base(tablas: Record<string, Fila[]>, errores: Record<string, { code?: string; message: string }> = {}) {
  const consultas: Consulta[] = [];
  const db = {
    from(tabla: string) {
      const c: Consulta = { tabla, filtros: [] };
      consultas.push(c);
      let unico = false;
      let limite: number | null = null;
      const b: Record<string, unknown> = {
        select: () => b,
        order: () => b,
        eq: (col: string, v: unknown) => {
          c.filtros.push(["eq", col, v]);
          return b;
        },
        in: (col: string, v: unknown[]) => {
          c.filtros.push(["in", col, v]);
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
              if (errores[tabla]) return { data: null, error: errores[tabla] };
              const filas = (tablas[tabla] ?? []).filter((f) =>
                c.filtros.every(([op, col, v]) => (op === "eq" ? f[col] === v : (v as unknown[]).includes(f[col]))),
              );
              const cortadas = limite === null ? filas : filas.slice(0, limite);
              return { data: unico ? (cortadas[0] ?? null) : cortadas, error: null };
            })
            .then(ok, mal),
      };
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, consultas };
}

/** Tostado: su principal (puntos) en la columna de siempre y dos extras en la vista. */
function tostado(opciones: { marca?: boolean; codigoEquipo1?: boolean } = {}) {
  const marca = opciones.marca ?? true;
  const local = {
    id: "local-tostado",
    slug: "tostado",
    activo: true,
    estado_publicacion: "aprobado",
    created_at: "2026-11-11T00:00:00Z",
    lealtad_por_foorkie: marca,
  };
  return {
    foorkie_restaurantes: [{ ...local, bookea_rancho_id: RANCHO, bookea_programa_id: PUNTOS }],
    [VISTA_VINCULOS_FOORKIE]: [
      { ...local, bookea_rancho_id: RANCHO, bookea_programa_id: PUNTOS, principal: true, tarjeta_slug: null, tarjeta_nombre: null, requiere_codigo: false },
      { ...local, bookea_rancho_id: RANCHO, bookea_programa_id: EQUIPO_1, principal: false, tarjeta_slug: "equipo-1", tarjeta_nombre: "Equipo 1", requiere_codigo: opciones.codigoEquipo1 ?? true },
      { ...local, bookea_rancho_id: RANCHO, bookea_programa_id: EQUIPO_2, principal: false, tarjeta_slug: "equipo-2", tarjeta_nombre: "Equipo 2", requiere_codigo: false },
    ],
    ranchos: [{ id: RANCHO, owner_id: "dueno-tostado" }],
    programa_lealtad: [
      { id: PUNTOS, rancho_id: RANCHO },
      { id: EQUIPO_1, rancho_id: RANCHO },
      { id: EQUIPO_2, rancho_id: RANCHO },
      { id: AJENA, rancho_id: OTRO_RANCHO },
    ],
  };
}

const SIN_VISTA = { [VISTA_VINCULOS_FOORKIE]: { code: "PGRST205", message: "Could not find the table 'public.foorkie_lealtad_vinculos' in the schema cache" } };

afterEach(() => vi.restoreAllMocks());

describe("tarjetasExtraDeFoorkie", () => {
  it("sin ids no pregunta nada", async () => {
    const { db, consultas } = base(tostado());
    expect(await tarjetasExtraDeFoorkie(db, {})).toEqual([]);
    expect(consultas).toEqual([]);
  });

  it("solo las extras (`principal = false`), con los filtros pedidos", async () => {
    const { db, consultas } = base(tostado());
    const filas = await tarjetasExtraDeFoorkie(db, { programaIds: [PUNTOS, EQUIPO_1], ranchoId: RANCHO, soloMarcadas: true });
    expect(filas.map((f) => f.bookea_programa_id)).toEqual([EQUIPO_1]);
    expect(consultas[0].filtros).toEqual(
      expect.arrayContaining([
        ["eq", "principal", false],
        ["in", "bookea_programa_id", [PUNTOS, EQUIPO_1]],
        ["eq", "bookea_rancho_id", RANCHO],
        ["eq", "lealtad_por_foorkie", true],
      ]),
    );
  });

  it("sin la vista (Foorkie sin migrar): ninguna, y sin avisar en los registros", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db } = base(tostado(), SIN_VISTA);
    expect(await tarjetasExtraDeFoorkie(db, { programaIds: [EQUIPO_1] })).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("otro error sí queda escrito, y también devuelve ninguna", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db } = base(tostado(), { [VISTA_VINCULOS_FOORKIE]: { code: "57014", message: "canceling statement due to statement timeout" } });
    expect(await tarjetasExtraDeFoorkie(db, { programaIds: [EQUIPO_1] })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("el local de una tarjeta (`localDeFoorkieDeLaTarjeta`)", () => {
  it("la principal: igual que antes, una consulta y sin preguntar por las extras", async () => {
    const { db, consultas } = base(tostado());
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: PUNTOS, ranchoId: RANCHO })).toEqual({ slug: "tostado" });
    expect(consultas.map((c) => c.tabla)).toEqual(["foorkie_restaurantes"]);
  });

  it("una extra: el local, el slug de la tarjeta y si pide código", async () => {
    const { db, consultas } = base(tostado());
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: EQUIPO_1, ranchoId: RANCHO })).toEqual({
      slug: "tostado",
      tarjetaSlug: "equipo-1",
      requiereCodigo: true,
    });
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: EQUIPO_2, ranchoId: RANCHO })).toEqual({
      slug: "tostado",
      tarjetaSlug: "equipo-2",
      requiereCodigo: false,
    });
    expect(consultas.map((c) => c.tabla)).toEqual(["foorkie_restaurantes", VISTA_VINCULOS_FOORKIE, "foorkie_restaurantes", VISTA_VINCULOS_FOORKIE]);
  });

  it("una extra nombrada con OTRO negocio no vale (el mismo par que exige la caja)", async () => {
    const { db } = base(tostado());
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: EQUIPO_1, ranchoId: OTRO_RANCHO })).toBeNull();
  });

  it("sin la marca del local, ni la principal ni las extras son de Foorkie (como Pura Matcha)", async () => {
    const { db } = base(tostado({ marca: false }));
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: PUNTOS, ranchoId: RANCHO })).toBeNull();
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: EQUIPO_1, ranchoId: RANCHO })).toBeNull();
    expect(await losCorreosLosMandaFoorkie(db, { programaId: EQUIPO_2, ranchoId: RANCHO })).toBe(false);
  });

  it("los correos de una extra los manda Foorkie, como los de la principal", async () => {
    const { db } = base(tostado());
    expect(await losCorreosLosMandaFoorkie(db, { programaId: EQUIPO_2, ranchoId: RANCHO })).toBe(true);
  });

  it("sin la vista, una extra es de Bookea (lo de siempre) y nadie se entera en los registros", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db } = base(tostado(), SIN_VISTA);
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: EQUIPO_2, ranchoId: RANCHO })).toBeNull();
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: PUNTOS, ranchoId: RANCHO })).toEqual({ slug: "tostado" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("si la consulta de las principales FALLA no se pregunta la vista: ante la duda, Bookea", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db, consultas } = base(tostado(), { foorkie_restaurantes: { message: "se cayó la base" } });
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: EQUIPO_1, ranchoId: RANCHO })).toBeNull();
    expect(consultas.map((c) => c.tabla)).toEqual(["foorkie_restaurantes"]);
  });
});

describe("la página para unirse y el pase de una extra", () => {
  it("la dirección de una extra es /lealtad/<local>/<tarjeta>; la principal, la de siempre", () => {
    expect(urlUnirseFoorkie("tostado")).toBe("https://www.foorkie.app/lealtad/tostado");
    expect(urlUnirseFoorkie("tostado", "equipo-1")).toBe("https://www.foorkie.app/lealtad/tostado/equipo-1");
    // Un slug de tarjeta que no tiene la forma no se pega a la dirección.
    expect(urlUnirseFoorkie("tostado", "../op")).toBe("https://www.foorkie.app/lealtad/tostado");
  });

  it("la página vieja de Bookea de una extra manda a SU página de Foorkie (la que pide el código)", () => {
    expect(destinoDeFoorkieDeLaTarjeta({ slug: "tostado", tarjetaSlug: "equipo-1", requiereCodigo: true })).toBe(
      "https://www.foorkie.app/lealtad/tostado/equipo-1",
    );
    expect(destinoDeFoorkieDeLaTarjeta({ slug: "tostado" })).toBe("https://www.foorkie.app/lealtad/tostado");
  });

  it("el pase de una extra sin código invita a SU página; con código no ofrece invitar", () => {
    const sinCodigo = marcaDelPase({ slug: "tostado", tarjetaSlug: "equipo-2", requiereCodigo: false });
    expect(sinCodigo.marca).toBe("foorkie");
    expect(sinCodigo.links.find((l) => l.id === "unirse")?.url).toBe("https://www.foorkie.app/lealtad/tostado/equipo-2");

    const conCodigo = marcaDelPase({ slug: "tostado", tarjetaSlug: "equipo-1", requiereCodigo: true });
    expect(conCodigo.marca).toBe("foorkie");
    expect(conCodigo.links.map((l) => l.id)).toEqual(["cuenta", "soporte", "terminos", "privacidad"]);
  });

  it("el pase de la principal no cambia en nada", () => {
    expect(marcaDelPase({ slug: "tostado" }).links.map((l) => [l.id, l.url])).toEqual([
      ["unirse", "https://www.foorkie.app/lealtad/tostado"],
      ["cuenta", "https://www.foorkie.tech/cuenta"],
      ["soporte", "https://www.foorkie.tech/soporte"],
      ["terminos", "https://www.foorkie.tech/terminos"],
      ["privacidad", "https://www.foorkie.tech/privacidad"],
    ]);
  });
});

describe("el vínculo de las rutas firmadas (`vinculoConFoorkie`)", () => {
  it("una extra del mismo negocio abre la puerta, a nombre del dueño", async () => {
    const { db } = base(tostado());
    expect(await vinculoConFoorkie(db, RANCHO, EQUIPO_1)).toEqual({ ownerId: "dueno-tostado" });
  });

  it("la principal, sin preguntar por las extras", async () => {
    const { db, consultas } = base(tostado());
    expect(await vinculoConFoorkie(db, RANCHO, PUNTOS)).toEqual({ ownerId: "dueno-tostado" });
    expect(consultas.map((c) => c.tabla)).not.toContain(VISTA_VINCULOS_FOORKIE);
  });

  it("una tarjeta que no está en Foorkie, o un par negocio + tarjeta que no coincide: no", async () => {
    const { db } = base(tostado());
    expect(await vinculoConFoorkie(db, OTRO_RANCHO, AJENA)).toBeNull();
    expect(await vinculoConFoorkie(db, OTRO_RANCHO, EQUIPO_1)).toBeNull();
  });

  it("sin la vista, una extra no abre la puerta (como hoy)", async () => {
    const { db } = base(tostado(), SIN_VISTA);
    expect(await vinculoConFoorkie(db, RANCHO, EQUIPO_1)).toBeNull();
    expect(await vinculoConFoorkie(db, RANCHO, PUNTOS)).toEqual({ ownerId: "dueno-tostado" });
  });
});

describe("el barrido de vencimientos (`tarjetasDeFoorkie`)", () => {
  it("cuenta las extras marcadas, con su negocio", async () => {
    const { db } = base(tostado());
    const r = await tarjetasDeFoorkie(db, [
      { id: PUNTOS, rancho_id: RANCHO },
      { id: EQUIPO_1, rancho_id: RANCHO },
      { id: EQUIPO_2, rancho_id: OTRO_RANCHO },
      { id: AJENA, rancho_id: OTRO_RANCHO },
    ]);
    expect(r).toEqual(new Set([PUNTOS, EQUIPO_1]));
  });

  it("sin la vista, solo las principales", async () => {
    const { db } = base(tostado(), SIN_VISTA);
    expect(await tarjetasDeFoorkie(db, [{ id: PUNTOS, rancho_id: RANCHO }, { id: EQUIPO_1, rancho_id: RANCHO }])).toEqual(new Set([PUNTOS]));
  });
});
