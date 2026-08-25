import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SUBCATEGORIAS_CITAS,
  SUBCATEGORIAS_CITAS_TODAS,
  categoriaDeSubcategoriaCita,
  esSubcategoriaCita,
} from "./subcategorias";
import { CATEGORIAS_CITAS } from "./tipos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA LISTA DE ARRIBA CONTRA EL SQL DE VERDAD
 * ════════════════════════════════════════════════════════════════════
 *
 * `SUBCATEGORIAS_CITAS` es una copia en TypeScript de valores que la
 * BASE valida con un CHECK (migración 0188). Dos listas que dicen lo
 * mismo se despegan sin falta, y cuando se despegan el síntoma es
 * silencioso: un filtro que nunca encuentra nada, o un alta que la base
 * rechaza con un error de restricción que nadie entiende.
 *
 * Así que la prueba no compara contra una copia: LEE EL .sql y lo
 * compara letra por letra. Si alguien agrega un valor al CHECK y se
 * olvida del TypeScript —o al revés— esto se pone en rojo.
 *
 * Es el mismo patrón que `checks-de-planes.test.ts` ya usa para los
 * paquetes de Lealtad.
 */

const SQL = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "0188_intereses_y_citas_desglosadas.sql",
  ),
  "utf8",
);

describe("los ids salen del CHECK de la 0188", () => {
  it("todos los ids declarados existen en el SQL", () => {
    const faltantes = SUBCATEGORIAS_CITAS_TODAS.filter(
      (id) => !SQL.includes(`'${id}'`),
    );
    expect(faltantes).toEqual([]);
  });

  it("los del bloque de Citas del SQL están todos declarados, salvo los anotados", () => {
    // El bloque de Citas del .sql arranca en su comentario propio. Se
    // lee SOLO ese tramo: los valores de Eventos viven arriba y no son
    // de este mapa.
    const desde = SQL.indexOf("CITAS / SERVICIOS");
    expect(desde).toBeGreaterThan(-1);
    const bloque = SQL.slice(desde, SQL.indexOf("));", desde));
    const enSql = [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(enSql.length).toBeGreaterThan(20);

    /**
     * Los ocho que la 0188 autoriza y este mapa NO declara, con su
     * motivo. Están escritos uno por uno —y no filtrados con un regex—
     * para que agregar un valor nuevo al SQL rompa la prueba en vez de
     * colarse en una excepción genérica.
     *
     * Sus CATEGORÍAS padre (tatuajes, automotriz, mascotas) todavía no
     * existen en `CATEGORIAS_CITAS`. Colgarlos de «otros» los
     * escondería; crear las categorías toca cinco mapas
     * `Record<CategoriaCita,…>` más dos archivos de la app móvil.
     */
    const ANOTADOS_SIN_CATEGORIA_PADRE = [
      "tatuajes",
      "perforaciones",
      "lavacar",
      "polarizado",
      "detallado_auto",
      "mecanica",
      "grooming",
      "veterinaria",
    ];

    const sinDeclarar = enSql.filter(
      (id) =>
        !SUBCATEGORIAS_CITAS_TODAS.includes(id) &&
        !ANOTADOS_SIN_CATEGORIA_PADRE.includes(id),
    );
    expect(sinDeclarar).toEqual([]);
  });
});

describe("la forma del mapa", () => {
  it("hay una entrada por cada categoría de Citas", () => {
    // Si alguien agrega una categoría y se olvida de este mapa,
    // `SUBCATEGORIAS_CITAS[nueva]` sería undefined y el `.map` de la
    // pantalla reventaría — el mismo bug que ya existía en el editor de
    // negocio con `SUBCATEGORIAS[categoria].map`.
    for (const c of CATEGORIAS_CITAS) {
      expect(Array.isArray(SUBCATEGORIAS_CITAS[c])).toBe(true);
    }
  });

  it("no hay ids repetidos entre categorías", () => {
    // Un id en dos rubros haría que `categoriaDeSubcategoriaCita`
    // devolviera el primero que encuentra, en silencio.
    expect(new Set(SUBCATEGORIAS_CITAS_TODAS).size).toBe(
      SUBCATEGORIAS_CITAS_TODAS.length,
    );
  });

  it("«otros» va vacío a propósito", () => {
    expect(SUBCATEGORIAS_CITAS.otros).toEqual([]);
  });
});

describe("las dos puertas", () => {
  it("un valor inventado no pasa", () => {
    expect(esSubcategoriaCita("peluqueria_de_perros")).toBe(false);
    expect(esSubcategoriaCita("")).toBe(false);
    expect(esSubcategoriaCita(null)).toBe(false);
    expect(esSubcategoriaCita(undefined)).toBe(false);
  });

  it("una subcategoría de EVENTOS tampoco pasa por acá", () => {
    // `rancho_fiestas` es válida en la base, pero es de otra vertical:
    // aceptarla haría que `/citas?subcategoria=rancho_fiestas` filtrara
    // por algo que ningún negocio de Citas puede tener.
    expect(esSubcategoriaCita("rancho_fiestas")).toBe(false);
  });

  it("resuelve el rubro padre", () => {
    expect(categoriaDeSubcategoriaCita("manicure")).toBe("unas");
    expect(categoriaDeSubcategoriaCita("fisioterapia")).toBe("consultorio");
    expect(categoriaDeSubcategoriaCita("no_existe")).toBe(null);
  });
});
