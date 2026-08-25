import { describe, expect, it } from "vitest";
import {
  AGENTES,
  LISTA_MODELOS,
  MODELOS,
  NOMBRE_AGENTE,
  calcularCosto,
  esModeloSeleccionable,
  esModeloValido,
  type AgenteIA,
  type ModeloIA,
} from "./modelos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA RED QUE SEPARA "SE PUEDE COSTEAR" DE "SE PUEDE ELEGIR"
 * ════════════════════════════════════════════════════════════════════
 *
 * Desde que el catálogo tiene un modelo que NO es de Anthropic (Gemini,
 * para poder costear el chat de la landing de Lealtad), `MODELOS` dejó
 * de poder usarse como "la lista de opciones del panel". El selector de
 * /admin/ia le ofrece su lista ENTERA a CADA agente, y todos esos
 * agentes hablan con el SDK de Anthropic: un Gemini colado ahí se
 * guardaría sin chistar y rompería esa llamada en la primera visita de
 * un cliente, en silencio.
 *
 * Estos tests son la única cosa que lo impide de verdad. El tipo
 * `ModeloIA` no alcanza: `esModeloValido` y `esModeloSeleccionable`
 * devuelven el MISMO tipo, así que TypeScript no ve diferencia entre
 * los dos y confundirlos compila perfecto.
 */

const PREFIJOS_NO_ANTHROPIC = ["gemini-", "gpt-", "grok-", "llama-", "mistral-"];

describe("el selector de /admin/ia solo puede ofrecer modelos de Anthropic", () => {
  it("ningún modelo de otro proveedor entra en LISTA_MODELOS", () => {
    const intrusos = LISTA_MODELOS.filter((m) =>
      PREFIJOS_NO_ANTHROPIC.some((p) => m.id.startsWith(p)),
    ).map((m) => m.id);

    expect(
      intrusos,
      `Estos modelos NO son de Anthropic y están en LISTA_MODELOS, que es lo que ` +
        `pinta el selector de /admin/ia: ${intrusos.join(", ")}. ` +
        `Un admin podría elegirlos para un agente que habla con el SDK de ` +
        `Anthropic y romper esa llamada. Van en MODELOS (para costearlos), ` +
        `nunca en LISTA_MODELOS.`,
    ).toEqual([]);
  });

  it("esModeloSeleccionable rechaza lo que esModeloValido acepta, cuando no es de Anthropic", () => {
    // Si esto falla, los dos validadores se volvieron el mismo y la
    // separación dejó de existir.
    expect(esModeloValido("gemini-3.5-flash-lite")).toBe(true);
    expect(esModeloSeleccionable("gemini-3.5-flash-lite")).toBe(false);
  });

  it("todo lo seleccionable es válido (la lista no puede tener un id fantasma)", () => {
    for (const m of LISTA_MODELOS) {
      expect(esModeloValido(m.id), `${m.id} está en LISTA_MODELOS pero no en MODELOS`).toBe(
        true,
      );
    }
  });
});

describe("todo agente que gasta tiene nombre en el panel", () => {
  it("NOMBRE_AGENTE cubre a los configurables y a los que no lo son", () => {
    // El chat de Lealtad gasta pero NO se configura: no está en AGENTES
    // y aun así tiene que verse con nombre en el panel de Gasto, no con
    // su id crudo.
    const gastanSinConfigurarse: AgenteIA[] = ["lealtad_chat"];

    for (const id of gastanSinConfigurarse) {
      expect(
        AGENTES.some((a) => a.id === id),
        `${id} no debería estar en AGENTES: no tiene columna de configuración`,
      ).toBe(false);
      expect(NOMBRE_AGENTE[id], `${id} se vería como id crudo en /admin/ia`).toBeTruthy();
    }

    for (const a of AGENTES) {
      expect(NOMBRE_AGENTE[a.id]).toBe(a.nombre);
    }
  });

  it("cada agente configurable tiene su propia columna, sin repetir", () => {
    const columnas = AGENTES.map((a) => a.columna);
    expect(new Set(columnas).size, `Dos agentes escriben en la misma columna: ${columnas}`).toBe(
      columnas.length,
    );
  });
});

describe("costeo", () => {
  it("cobra Gemini a su precio real, no al de un Claude", () => {
    // $0,30 el millón de entrada y $2,50 el de salida (tabla oficial de
    // Google, ago 2026). Un millón de cada uno = $2,80.
    expect(calcularCosto("gemini-3.5-flash-lite", 1_000_000, 1_000_000)).toBeCloseTo(2.8, 6);
  });

  it("un modelo sin precios se cuenta en 0 en vez de tumbar el registro", () => {
    // `calcularCosto` corre FUERA del try/catch que protege el insert de
    // uso_ia (ver registrar-uso.ts), así que si esto lanzara, un id mal
    // escrito dejaría al visitante SIN RESPUESTA — no solo sin costear.
    const inventado = "modelo-que-no-existe" as ModeloIA;
    expect(() => calcularCosto(inventado, 1000, 1000)).not.toThrow();
    expect(calcularCosto(inventado, 1000, 1000)).toBe(0);
  });

  it("todo modelo del catálogo tiene precios de verdad", () => {
    for (const [id, info] of Object.entries(MODELOS)) {
      expect(info.entradaUSD, `${id} sin precio de entrada`).toBeGreaterThan(0);
      expect(info.salidaUSD, `${id} sin precio de salida`).toBeGreaterThan(0);
    }
  });
});
