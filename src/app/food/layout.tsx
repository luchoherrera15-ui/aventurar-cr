import { notFound } from "next/navigation";
import { FOOD_APAGADO } from "@/lib/food-apagado";

/**
 * ════════════════════════════════════════════════════════════════════
 *  BOOKEA FOOD, APAGADO
 * ════════════════════════════════════════════════════════════════════
 *
 * Decisión del dueño (27 ago 2026): FOOD se rehace desde cero en otro
 * proyecto, así que deja de servirse desde acá.
 *
 * Este layout envuelve TODAS las páginas de `/food/*`, así que un solo
 * `notFound()` las apaga a las 26 de una vez — sin borrar un archivo y
 * sin tener que acordarse de tocar cada ruta.
 *
 * ── POR QUÉ 404 Y NO UN CARTEL DE «PRÓXIMAMENTE» ────────────────────
 *
 * Un cartel es una promesa con fecha implícita, y no hay fecha. Un 404
 * dice la verdad: acá no hay nada. Cuando FOOD exista en su propio
 * dominio, lo que corresponde es un redirect hacia allá — no un aviso
 * puesto hoy que nadie va a recordar cambiar.
 *
 * Para volver a prenderlo: `FOOD_APAGADO = false` en
 * `src/lib/food-apagado.ts`. Ahí está también la lista de las tres
 * cosas que se tocaron fuera de esa constante y que habría que
 * revertir con ella.
 */
export default function FoodLayout({ children }: { children: React.ReactNode }) {
  if (FOOD_APAGADO) notFound();
  return <>{children}</>;
}
