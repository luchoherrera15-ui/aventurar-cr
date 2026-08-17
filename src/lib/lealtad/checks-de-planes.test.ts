import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLANES_ID } from "./planes";

/**
 * EL CATÁLOGO DE TYPESCRIPT Y LOS CHECK DE LA BASE TIENEN QUE DECIR LO
 * MISMO.
 *
 * ------------------------------------------------------------------
 * LA FAMILIA DE FALLOS QUE ESTO CIERRA
 * ------------------------------------------------------------------
 * El id de un paquete vive en CUATRO columnas, y las cuatro tienen un
 * CHECK con la lista escrita a mano:
 *
 *     ranchos.plan_lealtad        (0124 → 0131 → 0133 → 0141 → 0179)
 *     solicitudes_lealtad.plan    (0126 → 0131 → 0133 → 0141 → 0179)
 *     cuentas.plan                (0134 → 0141 → 0179)
 *     suscripciones.plan          (0143 → 0179)
 *
 * La 0179 es la primera que ACHICA la lista en vez de ampliarla: dejó
 * las cuatro en los cuatro paquetes de hoy, después de comprobar en
 * producción que ninguna fila tenía uno de los ocho retirados. Achicar
 * es la dirección peligrosa —es la que puede dejar una fila huérfana—
 * y por eso esa migración empieza comprobando y abortando si encuentra
 * algo.
 *
 * Agregar un paquete a `PLANES_ID` y olvidar cualquiera de esos cuatro
 * CHECK NO rompe el build, NO rompe el lint y NO rompe ninguna prueba:
 * rompe un UPDATE, en producción, en el momento exacto en que alguien
 * paga. Y rompe distinto en cada columna —el peor caso es
 * `suscripciones` + `ranchos`, que dejan el cobro entrado y el paquete
 * sin activar—.
 *
 * El camino inverso también importa y por eso se compara en las dos
 * direcciones: un id que la base ACEPTA pero el catálogo no conoce hace
 * que `definicionDe()` devuelva null, y con plan desconocido TODOS los
 * topes quedan en null — o sea ilimitado y gratis. Retirar mal un plan
 * no lo apaga: lo vuelve infinito.
 *
 * Se leen los `.sql` DE VERDAD, no una copia de la lista: una copia se
 * desincroniza igual que el original y encima con más ceremonia.
 *
 * ------------------------------------------------------------------
 * POR QUÉ SE LEE LA ÚLTIMA MIGRACIÓN QUE TOCÓ CADA CHECK
 * ------------------------------------------------------------------
 * Los CHECK se redeclaran enteros (`drop constraint` + `add
 * constraint`), así que la única lista que importa es la de la última
 * migración que lo hizo. Si mañana una 0180 amplía la lista, este
 * archivo tiene que apuntar a la 0180 — y la prueba falla hasta que
 * alguien lo mueva, que es exactamente el recordatorio que se busca.
 */

/** Dónde está declarado hoy cada CHECK. */
const CHECKS: readonly { columna: string; migracion: string; constraint: string }[] = [
  {
    columna: "ranchos.plan_lealtad",
    migracion: "0179_catalogo_de_lealtad_sin_retirados.sql",
    constraint: "ranchos_plan_lealtad_check",
  },
  {
    columna: "solicitudes_lealtad.plan",
    migracion: "0179_catalogo_de_lealtad_sin_retirados.sql",
    constraint: "solicitudes_lealtad_plan_check",
  },
  {
    columna: "cuentas.plan",
    migracion: "0179_catalogo_de_lealtad_sin_retirados.sql",
    constraint: "cuentas_plan_check",
  },
  {
    columna: "suscripciones.plan",
    migracion: "0179_catalogo_de_lealtad_sin_retirados.sql",
    constraint: "suscripciones_plan_check",
  },
];

describe("los CHECK de la base aceptan exactamente el catálogo", () => {
  const esperado = [...PLANES_ID].sort();

  for (const { columna, migracion, constraint } of CHECKS) {
    it(`${columna} (${migracion})`, () => {
      const ids = idsDelCheck(leerMigracion(migracion), constraint);

      // Lo que el catálogo tiene y la base no: el update revienta.
      for (const plan of PLANES_ID) {
        expect(ids, `la base rechazaría el paquete «${plan}» en ${columna}`).toContain(plan);
      }

      // Lo que la base tiene y el catálogo no: `definicionDe` da null y
      // el negocio se queda sin topes, o sea ilimitado.
      for (const id of ids) {
        expect(
          PLANES_ID as readonly string[],
          `${columna} acepta «${id}», que el catálogo no conoce — un negocio con ese valor queda SIN TOPES`,
        ).toContain(id);
      }

      expect([...ids].sort()).toEqual(esperado);
    });
  }

  it("las cuatro columnas aceptan la MISMA lista", () => {
    const listas = CHECKS.map(({ migracion, constraint }) =>
      idsDelCheck(leerMigracion(migracion), constraint).sort(),
    );
    for (const lista of listas) expect(lista).toEqual(listas[0]);
  });
});

// ── Utilidades del test ───────────────────────────────────────────────

function leerMigracion(nombre: string): string {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  return readFileSync(path.join(raiz, "supabase", "migrations", nombre), "utf8");
}

/**
 * Los valores entre comillas de un `add constraint <nombre> check (…)`.
 * Se corta en el `;` que cierra la sentencia.
 *
 * Misma lectura que la de src/lib/pagos/precios.test.ts, y a propósito
 * no se comparte: son dos pruebas que vigilan cosas distintas y una
 * utilidad compartida las ataría — el día que una necesite leer otro
 * formato, la otra se rompe sin tener nada que ver.
 */
function idsDelCheck(sql: string, constraint: string): string[] {
  const desde = sql.indexOf(`add constraint ${constraint}`);
  if (desde < 0) {
    throw new Error(
      `No se encontró el CHECK ${constraint} en la migración. ` +
        `Si se movió a una migración nueva, actualizá la lista CHECKS de este archivo.`,
    );
  }
  const hasta = sql.indexOf(";", desde);
  return [...sql.slice(desde, hasta).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}
