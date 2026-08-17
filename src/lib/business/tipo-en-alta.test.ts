import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { seLePreguntaElTipo, tipoNegocioDeAlta } from "./tipo-en-alta";
import { TIPOS_NEGOCIO, tiposDeVertical } from "./modulos";

// ------------------------------------------------------------
// La paridad con el CHECK de la base — la prueba que faltaba
// ------------------------------------------------------------

/**
 * `tipoNegocioDeAlta` promete que lo que devuelve se puede escribir en
 * `ranchos.tipo_negocio`. Esa promesa NO la garantiza TypeScript: la
 * cumple un CHECK en Postgres (0108) que vive en un .sql y del que el
 * compilador no sabe nada.
 *
 * Sin esta prueba, agregar un tipo a `TIPOS_NEGOCIO` compila, pasa todo
 * lo demás y revienta el INSERT del registro en producción — el alta
 * entera, no el campo. Y revienta solo para quien eligió el tipo nuevo,
 * que es el caso que nadie prueba a mano.
 */
const SQL_0108 = fileURLToPath(
  new URL("../../../supabase/migrations/0108_bookea_business_tipo_y_modulos.sql", import.meta.url),
);

function idsDelCheck(): string[] {
  // Los comentarios se borran ANTES de buscar el bloque, no después: los
  // rótulos de adentro traen paréntesis ("-- Servicios con cita (belleza
  // y bienestar)") y el primero de ellos cerraría la lista antes de
  // tiempo, dejando la comparación contra una lista vacía.
  const sql = readFileSync(SQL_0108, "utf8").replace(/--[^\n]*/g, "");
  const bloque = sql.match(/tipo_negocio in \(([^)]*)\)/);
  if (!bloque) throw new Error("No se encontró la lista del CHECK en la 0108.");
  return [...bloque[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("el catálogo de TypeScript y el CHECK de la 0108", () => {
  it("tienen exactamente los mismos ids", () => {
    const enCodigo = TIPOS_NEGOCIO.map((t) => t.id).sort();
    const enBase = idsDelCheck().sort();
    expect(enBase).toEqual(enCodigo);
  });
});

// ------------------------------------------------------------
// Qué se puede escribir de verdad
// ------------------------------------------------------------

describe("tipoNegocioDeAlta", () => {
  it("acepta un tipo que corresponde a la vertical", () => {
    expect(tipoNegocioDeAlta("citas", "gimnasio")).toBe("gimnasio");
    expect(tipoNegocioDeAlta("eventos", "eventos_lugar")).toBe("eventos_lugar");
  });

  it("saltarse el paso es válido: vacío es null, no un error", () => {
    expect(tipoNegocioDeAlta("citas", "")).toBeNull();
    expect(tipoNegocioDeAlta("citas", null)).toBeNull();
    expect(tipoNegocioDeAlta("citas", undefined)).toBeNull();
    expect(tipoNegocioDeAlta("citas", "   ")).toBeNull();
  });

  it("descarta un tipo inventado en vez de dejar que tumbe el INSERT", () => {
    expect(tipoNegocioDeAlta("citas", "peluqueria_canina")).toBeNull();
    expect(tipoNegocioDeAlta("citas", "'; drop table ranchos; --")).toBeNull();
  });

  it("descarta un tipo real que no aplica a esta vertical", () => {
    // El caso que importa: nadie convierte en restaurante a un negocio
    // de citas mandando otro valor en el formulario.
    expect(tipoNegocioDeAlta("citas", "restaurante")).toBeNull();
    expect(tipoNegocioDeAlta("hospedajes", "barberia")).toBeNull();
  });

  it("con una vertical desconocida no escribe nada", () => {
    expect(tipoNegocioDeAlta("", "barberia")).toBeNull();
    expect(tipoNegocioDeAlta("marketplace", "barberia")).toBeNull();
  });

  it("todo lo que devuelve está entre los tipos de esa vertical", () => {
    for (const vertical of ["citas", "eventos", "hospedajes", "restaurantes"]) {
      for (const tipo of TIPOS_NEGOCIO) {
        const guardado = tipoNegocioDeAlta(vertical, tipo.id);
        if (guardado === null) continue;
        expect(tiposDeVertical(vertical).some((t) => t.id === guardado)).toBe(true);
      }
    }
  });
});

// ------------------------------------------------------------
// Dónde vale la pena preguntar
// ------------------------------------------------------------

describe("seLePreguntaElTipo", () => {
  it("pregunta donde hay rubros de verdad entre los que elegir", () => {
    expect(seLePreguntaElTipo("citas")).toBe(true);
    expect(seLePreguntaElTipo("eventos")).toBe(true);
  });

  it("no pregunta cuando la única alternativa es «Otro»", () => {
    // Elegir entre "Hospedaje" y "Otro" no es una pregunta, y el panel
    // ya deriva esas dos verticales sin equivocarse.
    expect(seLePreguntaElTipo("hospedajes")).toBe(false);
    expect(seLePreguntaElTipo("restaurantes")).toBe(false);
  });

  it("no pregunta en una vertical que no existe", () => {
    expect(seLePreguntaElTipo("")).toBe(false);
  });

  it("donde se pregunta hay al menos dos tarjetas para mostrar", () => {
    for (const vertical of ["citas", "eventos", "hospedajes", "restaurantes"]) {
      if (!seLePreguntaElTipo(vertical)) continue;
      expect(tiposDeVertical(vertical).length).toBeGreaterThanOrEqual(2);
    }
  });
});
