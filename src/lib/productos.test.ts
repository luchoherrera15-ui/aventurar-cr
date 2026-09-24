import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCTOS, PRODUCTOS_ID, hayProductosPagos, producto } from "./productos";

/**
 * La red del catálogo de productos.
 *
 * El test que de verdad importa es el tercero: **cada ruta que el
 * catálogo promete tiene que existir en disco**. Ya pasó una vez que
 * dos «Ver más» del home apuntaran a páginas que no existían, y eso no
 * lo atrapa ni el compilador ni el linter —un `href` es un string—:
 * se descubre cuando alguien hace clic y cae en un 404.
 *
 * Funciona porque ninguna ruta del catálogo tiene segmentos dinámicos.
 * Si algún día una los tiene, este test hay que enseñarle a resolverlos
 * en vez de borrarlo.
 */

const APP = join(process.cwd(), "src", "app");

/** `/solutions/crear` → `src/app/solutions/crear/page.tsx` */
function hayPagina(ruta: string): boolean {
  return existsSync(join(APP, ...ruta.split("/").filter(Boolean), "page.tsx"));
}

describe("catálogo de productos", () => {
  it("tiene los cuatro productos que se ofrecen", () => {
    expect(PRODUCTOS).toHaveLength(4);
    expect(PRODUCTOS.map((p) => p.id)).toEqual([...PRODUCTOS_ID]);
  });

  it("no repite ids", () => {
    expect(new Set(PRODUCTOS.map((p) => p.id)).size).toBe(PRODUCTOS.length);
  });

  it("cada ruta que promete existe en disco", () => {
    for (const p of PRODUCTOS) {
      expect(hayPagina(p.activar), `${p.id}: activar ${p.activar}`).toBe(true);
      expect(hayPagina(p.verMas), `${p.id}: verMas ${p.verMas}`).toBe(true);
    }
  });

  it("cada producto dice tres cosas concretas", () => {
    for (const p of PRODUCTOS) {
      expect(p.incluye, p.id).toHaveLength(3);
      for (const linea of p.incluye) expect(linea.length).toBeGreaterThan(0);
    }
  });

  it("la promesa entra en una línea", () => {
    // 62 caracteres es lo que cabe en la tarjeta sin cortar a tres
    // renglones. Es la regla de texto de la página, medida.
    for (const p of PRODUCTOS) {
      expect(p.promesa.length, `${p.id}: «${p.promesa}»`).toBeLessThanOrEqual(62);
    }
  });

  it("hoy todo es gratis", () => {
    expect(hayProductosPagos()).toBe(false);
    for (const p of PRODUCTOS) expect(p.precioMes).toBe(0);
  });

  it("producto() encuentra por id y explota con uno inventado", () => {
    expect(producto("lealtad").nombre).toBe("Pases de lealtad");
    // @ts-expect-error — el id inventado es justo lo que se prueba
    expect(() => producto("no-existe")).toThrow();
  });
});
