import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MARCA_DE_CAMBIO,
  escribirMensajeDelMiembro,
  leerMensajeDelMiembro,
  textoVisible,
  valorQueCambia,
} from "./mensaje-del-miembro";

/**
 * EL MENSAJE DE UN CLIENTE EN SU PASE DE APPLE.
 *
 * Apple avisa en la pantalla bloqueada solo cuando el VALOR de un campo
 * con `changeMessage` cambia. Lo que se fija acá es que dos «¡Gracias
 * por preferirnos!» seguidos sean dos valores distintos que se leen igual,
 * y que escribirlo nunca tumbe nada.
 */

const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const GRACIAS = "¡Gracias por preferirnos!";

describe("valorQueCambia — el mismo texto, un valor distinto", () => {
  it("un texto nuevo va tal cual", () => {
    expect(valorQueCambia(null, GRACIAS)).toBe(GRACIAS);
    expect(valorQueCambia("Tu tarjeta se modificó.", GRACIAS)).toBe(GRACIAS);
    expect(valorQueCambia(`Otra cosa${MARCA_DE_CAMBIO}`, GRACIAS)).toBe(GRACIAS);
  });

  it("el mismo texto alterna el marcador: cada movimiento cambia el valor", () => {
    const primero = valorQueCambia(null, GRACIAS);
    const segundo = valorQueCambia(primero, GRACIAS);
    const tercero = valorQueCambia(segundo, GRACIAS);
    expect(segundo).not.toBe(primero);
    expect(tercero).not.toBe(segundo);
    expect(tercero).toBe(primero);
    // Y los tres se leen exactamente igual.
    expect(new Set([primero, segundo, tercero].map(textoVisible))).toEqual(new Set([GRACIAS]));
  });

  it("un marcador que vino en el texto no confunde la cuenta", () => {
    expect(valorQueCambia(GRACIAS, `${GRACIAS}${MARCA_DE_CAMBIO}`)).toBe(`${GRACIAS}${MARCA_DE_CAMBIO}`);
    expect(valorQueCambia(`${MARCA_DE_CAMBIO}${GRACIAS}`, GRACIAS)).toBe(GRACIAS);
  });

  it("el marcador no se ve: no es un espacio que `trim()` saque ni que se lea", () => {
    expect(textoVisible(`${GRACIAS}${MARCA_DE_CAMBIO}`)).toBe(GRACIAS);
    expect(`${GRACIAS}${MARCA_DE_CAMBIO}`.trim()).not.toBe(GRACIAS);
  });
});

type Consulta = { tabla: string; op: string; valores: unknown; filtros: unknown[][] };

/** Una base de mentira que anota lo que se le pide; `responder` decide qué contesta. */
function baseFalsa(responder: (c: Consulta) => { data?: unknown; error?: unknown }) {
  const consultas: Consulta[] = [];
  const db = {
    from(tabla: string) {
      const c: Consulta = { tabla, op: "select", valores: null, filtros: [] };
      consultas.push(c);
      const b: Record<string, unknown> = {};
      b.update = (valores: unknown) => {
        c.op = "update";
        c.valores = valores;
        return b;
      };
      for (const m of ["select", "eq", "maybeSingle"]) {
        b[m] = (...args: unknown[]) => {
          c.filtros.push([m, ...args]);
          return b;
        };
      }
      b.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            const r = responder(c);
            return { data: r.data ?? null, error: r.error ?? null };
          })
          .then(ok, mal);
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, consultas };
}

describe("escribirMensajeDelMiembro — el renglón del pase de UN cliente", () => {
  afterEach(() => vi.restoreAllMocks());

  it("guarda el valor que cambia y marca su pase de Apple como cambiado", async () => {
    const { db, consultas } = baseFalsa((c) =>
      c.tabla === "miembros" && c.op === "select" ? { data: { ultimo_hito_mensaje: GRACIAS } } : {},
    );
    expect(await escribirMensajeDelMiembro(db, MIEMBRO, GRACIAS)).toBe(true);

    const guardado = consultas.find((c) => c.tabla === "miembros" && c.op === "update");
    // El mismo texto que ya tenía: el valor nuevo trae el marcador.
    expect(guardado?.valores).toEqual({ ultimo_hito_mensaje: `${GRACIAS}${MARCA_DE_CAMBIO}` });
    expect(guardado?.filtros).toContainEqual(["eq", "id", MIEMBRO]);

    const marcado = consultas.find((c) => c.tabla === "pases_wallet" && c.op === "update");
    expect(Object.keys(marcado?.valores as object)).toEqual(["actualizado_en"]);
    expect(marcado?.filtros).toEqual(
      expect.arrayContaining([
        ["eq", "miembro_id", MIEMBRO],
        ["eq", "plataforma", "apple"],
        ["eq", "activo", true],
      ]),
    );
  });

  it("sin la 0205 (o con la base caída) no guarda nada, no marca nada y no lanza", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, consultas } = baseFalsa(() => ({ error: { message: "column miembros.ultimo_hito_mensaje does not exist" } }));
    expect(await escribirMensajeDelMiembro(db, MIEMBRO, GRACIAS)).toBe(false);
    expect(consultas.filter((c) => c.op === "update")).toHaveLength(0);
  });

  it("si la base revienta a mitad de camino, tampoco lanza", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = {
      from() {
        throw new Error("se cortó la red");
      },
    } as unknown as SupabaseClient;
    await expect(escribirMensajeDelMiembro(db, MIEMBRO, GRACIAS)).resolves.toBe(false);
    await expect(leerMensajeDelMiembro(db, MIEMBRO)).resolves.toBeNull();
  });

  it("leerMensajeDelMiembro: el valor guardado tal cual, o null si no hay nada que mostrar", async () => {
    const con = baseFalsa(() => ({ data: { ultimo_hito_mensaje: `${GRACIAS}${MARCA_DE_CAMBIO}` } }));
    expect(await leerMensajeDelMiembro(con.db, MIEMBRO)).toBe(`${GRACIAS}${MARCA_DE_CAMBIO}`);
    for (const vacio of [null, "", "  ", MARCA_DE_CAMBIO]) {
      const sin = baseFalsa(() => ({ data: { ultimo_hito_mensaje: vacio } }));
      expect(await leerMensajeDelMiembro(sin.db, MIEMBRO)).toBeNull();
    }
    const rota = baseFalsa(() => ({ error: { message: "caída" } }));
    expect(await leerMensajeDelMiembro(rota.db, MIEMBRO)).toBeNull();
  });
});
