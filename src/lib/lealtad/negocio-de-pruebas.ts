/**
 * ¿ESTE NEGOCIO ES DE PRUEBAS?
 *
 * Pedido del dueño (1 sep 2026): «todo lo que sea de Bookea, de pruebas
 * o demos, agregalo en un tab que diga Pruebas y que se pueda expandir».
 *
 * La lista de /admin/lealtad tiene hoy 20 negocios y solo 4 son clientes
 * de verdad: los otros 16 son las ocho demos de la landing, los ejemplos
 * sembrados y la basura de probar el alta. Mezclados, cada vez que hay
 * que mirar «cómo va Lealtad» hay que acordarse de memoria cuáles no
 * cuentan — y el conteo de arriba dice 20 cuando la respuesta es 4.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ES UNA REGLA Y NO UNA COLUMNA
 * ------------------------------------------------------------------
 * Lo correcto de libro sería `ranchos.es_de_pruebas` con su migración.
 * No se hizo así hoy por dos razones:
 *
 *   1. Un negocio de pruebas ya se distingue por CÓMO nació —lo creó
 *      una cuenta de demostración de Bookea, o su slug arranca con
 *      `demo-` porque lo sembró un script nuestro—. El dato ya está en
 *      la base; lo que faltaba era leerlo.
 *   2. Una columna nueva hay que ACORDARSE de marcarla. La regla no se
 *      olvida: la próxima demo que siembre un script cae del lado
 *      correcto sola, sin que nadie toque nada.
 *
 * El precio es que un negocio de pruebas con nombre y cuenta normales
 * no lo agarra ninguna regla. Para esos está `SLUGS_DE_PRUEBA`: una
 * línea, y listo. Si esa lista empieza a crecer, ahí sí toca la columna.
 *
 * ------------------------------------------------------------------
 * ⚠️ LO QUE ESTA REGLA NO MIRA, Y NUNCA DEBE MIRAR
 * ------------------------------------------------------------------
 * EL PAQUETE. Que un negocio esté en el plan «prueba» (el gratis) NO lo
 * vuelve ficticio: Pura Matcha y TAPICITO son clientes reales que
 * arrancaron en el plan gratuito. Usar `plan_lealtad === "prueba"` como
 * criterio escondería clientes de verdad detrás de un acordeón, que es
 * el peor error posible en esta pantalla.
 *
 * Tampoco mira el ESTADO: «pendiente» es el estado con el que nace todo
 * negocio de Lealtad (0187), no una señal de que sea falso.
 */

/**
 * Las cuentas de demostración de Bookea.
 *
 * Todas viven en `@bookea.lat` y su parte local TERMINA en `demo`
 * (`lealtad.demo@`, `catalogo.demo@`, `negocio.demo@`). Es la convención
 * que usan los sembradores del repo — ver `scripts/seed-demos-wallet.mjs`
 * y `scripts/banco-pruebas-lealtad.mjs`.
 *
 * El ancla del final importa: sin ella, `demo.persona@bookea.lat`
 * —una persona de verdad del equipo— entraría también.
 */
const CUENTA_DEMO = /(^|[.\-_])demo@bookea\.lat$/i;

/**
 * Negocios de prueba que NINGUNA regla agarra, por slug.
 *
 * Se agregan a mano y con criterio: cada línea esconde un negocio de la
 * vista principal del admin, así que un slug de más acá es un cliente
 * real que deja de verse.
 */
export const SLUGS_DE_PRUEBA: readonly string[] = [
  // Alta de prueba con el teclado, agosto 2026. El nombre es el mismo.
  "asdasdsadasd",
  // Pruebas propias del equipo sobre la cuenta del dueño de Bookea.
  "barberiapro",
];

/** Lo mínimo que hace falta saber de un negocio para clasificarlo. */
export type NegocioClasificable = {
  nombre: string;
  slug: string | null;
  /** El correo de la cuenta dueña. null = no se pudo resolver. */
  correoDueno: string | null;
};

/**
 * Quita tildes y baja a minúsculas, para que «Prueba de Café» y
 * «prueba de cafe» se comparen igual.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** ¿Es un negocio de pruebas, demo o basura de desarrollo? */
export function esNegocioDePruebas(n: NegocioClasificable): boolean {
  const slug = (n.slug ?? "").toLowerCase();

  // 1 · Lo sembró un script nuestro: los sembradores prefijan `demo-`.
  if (slug.startsWith("demo-")) return true;

  // 2 · Lo creó una cuenta de demostración de Bookea.
  if (n.correoDueno && CUENTA_DEMO.test(n.correoDueno.trim())) return true;

  // 3 · Se llama «prueba» sin disimulo. Va por PREFIJO y no por
  //     «contiene»: un negocio real llamado «Sala de Pruebas de Sonido»
  //     no tiene por qué esconderse.
  const nombre = normalizar(n.nombre);
  if (nombre.startsWith("prueba") || slug.startsWith("prueba")) return true;

  // 4 · Los sueltos de la lista de arriba.
  return SLUGS_DE_PRUEBA.includes(slug);
}

/**
 * Parte una lista en dos: los de verdad primero, los de pruebas aparte.
 * Conserva el orden que traía cada uno.
 */
export function separarPruebas<T extends NegocioClasificable>(
  negocios: readonly T[],
): { reales: T[]; pruebas: T[] } {
  const reales: T[] = [];
  const pruebas: T[] = [];
  for (const n of negocios) (esNegocioDePruebas(n) ? pruebas : reales).push(n);
  return { reales, pruebas };
}
