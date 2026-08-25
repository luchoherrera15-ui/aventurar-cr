import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PUERTAS,
  claveDeDestino,
  destinosConDatos,
  hrefDeDestino,
  type Destino,
  type EntradaNav,
} from "./taxonomia-navegacion";
import { esCategoriaValida } from "@/lib/categorias-vertical";
import {
  CATEGORIA_DE_SUBCATEGORIA,
  SUBCATEGORIAS_TODAS,
} from "@/app/mi-negocio/types";

/**
 * ============================================================
 * EL GUARDARRAÍL DE LA TAXONOMÍA
 * ============================================================
 *
 * La taxonomía de navegación hace UNA promesa: **ninguna entrada del
 * menú puede existir sin un destino que filtre de verdad.** Estas
 * pruebas son lo que hace imposible mergear lo contrario.
 *
 * No se prueba «que la lista tenga N elementos» —eso cambia cada vez que
 * entra un rubro y solo obliga a actualizar un número—. Se prueban
 * PROPIEDADES, que son las que no pueden dejar de valer nunca:
 *
 *   1. Todo destino «real» apunta a una categoría que la vertical acepta.
 *   2. Solo /eventos lleva subcategoría, porque es el único que la lee.
 *   3. Ningún destino apunta a un valor que la base rechazaría (se
 *      contrasta contra el CHECK vigente, leyendo la migración).
 *   4. Dos entradas nunca comparten href.
 *   5. Lo que no filtra no tiene href, así que no se puede dibujar.
 */

/** Todas las entradas de todas las puertas, aplanadas. */
const ENTRADAS: { puerta: string; columna: string; entrada: EntradaNav }[] =
  PUERTAS.flatMap((p) =>
    p.columnas.flatMap((c) =>
      c.entradas.map((entrada) => ({ puerta: p.id, columna: c.id, entrada })),
    ),
  );

/** Todos los destinos, incluidos los «Ver todo» de cada columna. */
const DESTINOS: Destino[] = PUERTAS.flatMap((p) => [
  ...p.columnas.flatMap((c) => [...c.entradas.map((e) => e.destino), ...(c.verTodo ? [c.verTodo] : [])]),
]);

/**
 * Los valores que la base acepta HOY, leídos de la migración vigente en
 * vez de copiados a mano. Copiarlos sería crear una quinta verdad: el
 * día que un CHECK cambie, esta prueba tiene que enterarse sola.
 */
function valoresDelCheck(constraint: string): Set<string> {
  const sql = readFileSync(
    fileURLToPath(
      new URL(
        "../../../supabase/migrations/0188_intereses_y_citas_desglosadas.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const desde = sql.indexOf(`add constraint ${constraint}`);
  expect(desde, `no se encontró ${constraint} en la 0188`).toBeGreaterThan(-1);
  const hasta = sql.indexOf("));", desde);
  const bloque = sql.slice(desde, hasta);
  return new Set([...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
}

const CATEGORIAS_EN_BASE = valoresDelCheck("ranchos_categoria_check");
const SUBCATEGORIAS_EN_BASE = valoresDelCheck("ranchos_subcategoria_check");

describe("las cinco puertas", () => {
  it("son exactamente cinco y con los ids esperados", () => {
    expect(PUERTAS.map((p) => p.id)).toEqual([
      "citas",
      "eventos",
      "hospedaje",
      "experiencias",
      "servicios",
    ]);
  });

  it("todas tienen ruta propia y CTA de captación — ninguna es un callejón sin salida", () => {
    for (const p of PUERTAS) {
      expect(p.ruta, p.id).toMatch(/^\//);
      expect(p.ctaOferta.href, p.id).toMatch(/^\//);
      expect(p.ctaOferta.texto.length, p.id).toBeGreaterThan(0);
    }
  });

  it("no repite ids de entrada ni de columna", () => {
    const idsEntrada = ENTRADAS.map((e) => e.entrada.id);
    expect(new Set(idsEntrada).size).toBe(idsEntrada.length);
    const idsColumna = PUERTAS.flatMap((p) => p.columnas.map((c) => c.id));
    expect(new Set(idsColumna).size).toBe(idsColumna.length);
  });
});

describe("todo destino «real» filtra de verdad", () => {
  it("su categoría es válida para su vertical", () => {
    for (const d of DESTINOS) {
      if (d.respaldo !== "real" || !d.categoria) continue;
      expect(
        esCategoriaValida(d.vertical, d.categoria),
        `${d.vertical}/${d.categoria} no está en la lista fuente de su vertical`,
      ).toBe(true);
    }
  });

  it("solo /eventos lleva subcategoría, que es el único directorio que la lee", () => {
    for (const d of DESTINOS) {
      if (d.respaldo !== "real" || !d.subcategoria) continue;
      expect(d.vertical, `${d.subcategoria} cuelga de una vertical que no lee ?subcategoria=`).toBe(
        "eventos",
      );
      expect(SUBCATEGORIAS_TODAS).toContain(d.subcategoria);
      // Y cuelga de SU categoría: /eventos aplica los dos filtros a la
      // vez, así que un par incoherente devuelve cero resultados.
      expect(CATEGORIA_DE_SUBCATEGORIA[d.subcategoria]).toBe(d.categoria);
    }
  });

  it("tiene href, y ese href es el único que lo produce", () => {
    const vistos = new Map<string, string>();
    for (const { entrada, puerta } of ENTRADAS) {
      if (entrada.destino.respaldo !== "real") continue;
      const href = hrefDeDestino(entrada.destino);
      expect(href, `${entrada.id} es «real» pero no produce href`).not.toBeNull();
      const anterior = vistos.get(href!);
      expect(
        anterior,
        `${entrada.id} (${puerta}) repite el href de ${anterior}: ${href}`,
      ).toBeUndefined();
      vistos.set(href!, entrada.id);
    }
  });

  it("el «Ver todo» de una columna no repite el href de una de sus entradas", () => {
    for (const p of PUERTAS) {
      for (const c of p.columnas) {
        if (!c.verTodo) continue;
        const hrefVerTodo = hrefDeDestino(c.verTodo);
        if (!hrefVerTodo) continue;
        const hrefsEntradas = c.entradas.map((e) => hrefDeDestino(e.destino));
        expect(
          hrefsEntradas,
          `«Ver todo» de ${c.id} es el mismo enlace que una de sus entradas`,
        ).not.toContain(hrefVerTodo);
      }
    }
  });
});

describe("lo que no filtra no se puede dibujar", () => {
  it("ninguna entrada sin respaldo real produce href", () => {
    for (const { entrada } of ENTRADAS) {
      if (entrada.destino.respaldo === "real") continue;
      expect(hrefDeDestino(entrada.destino), entrada.id).toBeNull();
    }
  });

  it("toda entrada sin respaldo real explica por qué", () => {
    for (const { entrada } of ENTRADAS) {
      if (entrada.destino.respaldo === "real") continue;
      expect(entrada.destino.motivo.length, entrada.id).toBeGreaterThan(10);
    }
  });
});

describe("nada apunta a un valor que la base rechazaría", () => {
  it("las categorías declaradas están en el CHECK vigente", () => {
    for (const d of DESTINOS) {
      if (d.respaldo === "sin-base" || !d.categoria) continue;
      expect(
        CATEGORIAS_EN_BASE.has(d.categoria),
        `«${d.categoria}» no está en ranchos_categoria_check`,
      ).toBe(true);
    }
  });

  it("las subcategorías declaradas están en el CHECK vigente", () => {
    for (const d of DESTINOS) {
      if (d.respaldo === "sin-base" || !d.subcategoria) continue;
      expect(
        SUBCATEGORIAS_EN_BASE.has(d.subcategoria),
        `«${d.subcategoria}» no está en ranchos_subcategoria_check`,
      ).toBe(true);
    }
  });

  it("los destinos «sin base» no declaran vertical ni valor: no hay nada que declarar", () => {
    for (const { entrada } of ENTRADAS) {
      if (entrada.destino.respaldo !== "sin-base") continue;
      expect(claveDeDestino(entrada.destino)).toBeNull();
    }
  });
});

describe("las lentes saben qué consultar", () => {
  it("/experiencias y /servicios tienen al menos un destino con datos en la base", () => {
    for (const id of ["experiencias", "servicios"] as const) {
      const puerta = PUERTAS.find((p) => p.id === id)!;
      const destinos = destinosConDatos(puerta);
      expect(destinos.length, id).toBeGreaterThan(0);
      // Sin vertical no hay consulta posible: una lente que no sabe en
      // qué tabla mirar es una pantalla vacía por construcción.
      for (const d of destinos) expect(d.vertical, id).toBeTruthy();
    }
  });
});
