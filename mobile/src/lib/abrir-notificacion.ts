import type { Href } from "expo-router";
import { IDS_PESTANAS } from "@/lib/pestanas";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  ADÓNDE LLEVA UNA NOTIFICACIÓN
 * ═══════════════════════════════════════════════════════════════════
 *
 * El servidor manda la ruta en `data.url` (ver `src/lib/push.ts`).
 * Esto la limpia antes de navegar, por dos motivos que ya causaron
 * problemas de verdad:
 *
 * ── 1. HAY NOTIFICACIONES VIEJAS DANDO VUELTAS ─────────────────────
 * Una notificación que salió antes de un cambio de rutas se queda en
 * la bandeja del teléfono días. Cuando alguien la toca, llega una URL
 * que ya no existe. El caso concreto: la pestaña «mensajes» se
 * eliminó, y `/?tab=mensajes` cae en `TABS.findIndex(...) === -1`, que
 * la app resuelve como la pestaña 0 — o sea que un aviso de un mensaje
 * nuevo abría la pantalla de Inicio. No daba error: llevaba mal.
 *
 * Arreglar el servidor no alcanza, porque las que ya salieron siguen
 * en el teléfono. Por eso la traducción vive también acá.
 *
 * ── 2. LA URL VIENE DE AFUERA ──────────────────────────────────────
 * Es un texto que llega por la red. No se navega a algo que no empiece
 * con "/" — un `http://` ahí adentro sería un desvío fuera de la app.
 */

/**
 * Las pestañas que existen hoy en "/".
 *
 * `Set<string>` explícito: `IDS_PESTANAS` infiere la unión de los
 * cuatro literales, y contra ese tipo no se puede preguntar por un
 * texto cualquiera — que es justo lo que llega por la red.
 */
const PESTANAS: Set<string> = new Set(IDS_PESTANAS);

/**
 * Pestañas que ya no existen, y a dónde va lo que iba para ellas.
 *
 * `mensajes` era una pestaña y dejó de serlo cuando el chat pasó a
 * abrirse solo desde un negocio. Su bandeja sigue viva como pantalla
 * propia (`/mensajes`), así que ahí es donde tiene que caer.
 */
const PESTANAS_MUDADAS: Record<string, string> = {
  mensajes: "/mensajes",
  consultas: "/consultas",
  // Favoritos dejó de ser pestaña: la segunda pasó a ser solo Promos.
  // Los enlaces viejos siguen queriendo decir "los favoritos", así que
  // van a su pantalla y no a la de promos, que muestra otra cosa.
  favoritos: "/favoritos",
};

export function rutaDeNotificacion(crudo: unknown): Href | null {
  if (typeof crudo !== "string") return null;
  const url = crudo.trim();

  // Solo rutas internas. Nada de http://, //otro-sitio, ni esquemas.
  if (!url.startsWith("/") || url.startsWith("//")) return null;

  // ¿Es una pestaña de la raíz?
  const conTab = url.match(/^\/\?tab=([a-z-]+)$/);
  if (conTab) {
    const tab = conTab[1];
    if (PESTANAS.has(tab)) return url as Href;
    const mudada = PESTANAS_MUDADAS[tab];
    // Una pestaña que no existe y que tampoco se mudó: mejor la raíz
    // que una URL que la app resuelve en silencio como "Inicio".
    return (mudada ?? "/") as Href;
  }

  return url as Href;
}
