/**
 * ════════════════════════════════════════════════════════════════════
 *  EL INTERRUPTOR DE BOOKEA FOOD
 * ════════════════════════════════════════════════════════════════════
 *
 * Decisión del dueño (27 ago 2026): «desactivá todo lo que tenga que
 * ver con Bookea Foods, lo haremos en otro desde 0».
 *
 * FOOD deja de servirse desde este proyecto. NO se borró el código: se
 * apagó desde acá, en una sola constante, para que volver a prenderlo
 * sea cambiar `true` por `false` y no rearmar 108 archivos.
 *
 * ── QUÉ APAGA ESTA CONSTANTE ────────────────────────────────────────
 *
 *   · `/food/*`      — todas las páginas (src/app/food/layout.tsx)
 *   · `/api/food/*`  — reservar, cancelar y crear pedido
 *
 * ── LO QUE NO SE PODÍA APAGAR DESDE ACÁ, Y SE HIZO APARTE ───────────
 *
 * Tres cosas viven fuera del alcance de una constante de TypeScript y
 * se tocaron una por una. Si algún día se vuelve a prender FOOD, hay
 * que revertirlas también, o quedará servido a medias:
 *
 *   1. `src/proxy.ts` — el subdominio `food.bookea.lat` reescribía a
 *      `/food`. Se quitó: ese host ahora sirve el marketplace normal.
 *   2. `src/app/sitemap.ts` — publicaba `/food` y una entrada por cada
 *      restaurante, leyendo `food_businesses`.
 *   3. `src/app/robots.ts` — tres reglas de FOOD que ya no aplican.
 *
 * ── LO QUE ESTO SÍ ROMPE, DICHO SIN ADORNOS ─────────────────────────
 *
 * La app publicada (`mobile-food/`) pega contra `/api/food/*` con el
 * host escrito a mano. Con esto apagado, esa app NO PUEDE RESERVAR.
 *
 * Se apaga igual porque el costo real hoy es cero: la base tiene
 * 0 reservas, 0 pedidos y 0 comensales registrados en toda la vida de
 * FOOD. No hay una sola persona a la que se le rompa algo. El día que
 * hubiera habido una, esta decisión habría tenido otro precio.
 *
 * ── LOS DATOS SIGUEN AHÍ ────────────────────────────────────────────
 *
 * Las 11 tablas `food_*` NO se tocaron. Apagar el sitio no borra la
 * base, y el respaldo completo —código, migraciones, imágenes y las
 * 216 filas— está en `../bookea-food-respaldo`.
 */
export const FOOD_APAGADO = true;
