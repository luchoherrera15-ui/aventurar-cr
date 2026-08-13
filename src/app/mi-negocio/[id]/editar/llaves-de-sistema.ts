/**
 * LO QUE VIVE EN `ranchos.detalles` Y NINGÚN FORMULARIO DIBUJA.
 *
 * ------------------------------------------------------------------
 * EL BUG QUE ESTE ARCHIVO EXISTE PARA QUE NO VUELVA
 * ------------------------------------------------------------------
 * El formulario de «Mi perfil» arma `detalles` DESDE CERO con los
 * campos declarados de la categoría (`sanitizarDetalles`) y después lo
 * guarda con `update.detalles = …`. Eso es un REEMPLAZO, y es a
 * propósito: es lo único que permite DESmarcar una casilla, porque un
 * booleano en false se omite en vez de guardarse.
 *
 * El problema es que en esa misma columna jsonb hay llaves que no son
 * campos de un formulario sino ESTADO DEL NEGOCIO, escritas por otras
 * pantallas y nunca declaradas en `campos-servicio.ts`. El reemplazo se
 * las llevaba puestas.
 *
 * El caso concreto, que ya estaba pasando: un negocio de citas
 * configuraba su horario semanal en Mi negocio → Horario, después
 * tocaba «Guardar» en Mi perfil por cualquier otra cosa —una foto, el
 * teléfono— y su horario DESAPARECÍA. La agenda quedaba vacía o caía al
 * horario por defecto. Sin un solo error a la vista, y sin forma de
 * relacionar una cosa con la otra.
 *
 * ------------------------------------------------------------------
 * POR QUÉ UNA LISTA Y NO UNA FUSIÓN
 * ------------------------------------------------------------------
 * Fusionar todo (`{...actual, ...nuevo}`) arregla el horario y rompe el
 * desmarcado: la casilla vieja en true sobrevive para siempre porque la
 * nueva en false ni siquiera viaja. Preservar EXACTAMENTE estas llaves
 * conserva las dos cosas.
 *
 * Si mañana otra pantalla guarda estado en `detalles`, su lugar es esta
 * lista. Es el precio de compartir una columna jsonb entre un
 * formulario y el estado del negocio.
 */

/**
 * · `horario_citas`       — el horario semanal (mi-negocio/[id]/citas)
 * · `en_configuracion`    — el negocio en pausa, sin publicar
 * · `horario_restaurante` — el horario de un restaurante
 *
 * El de restaurantes no corre peligro HOY, porque ese vertical no pasa
 * por este formulario. Está en la lista para que no dependa de eso.
 */
export const LLAVES_DE_SISTEMA = [
  "horario_citas",
  "en_configuracion",
  "horario_restaurante",
] as const;

/**
 * Las llaves de sistema que ya tenía guardadas, y nada más.
 *
 * Tolera cualquier cosa en `actual` —null, un array, un número— porque
 * viene de una columna jsonb y nadie garantiza su forma.
 */
export function llavesDeSistemaDe(actual: unknown): Record<string, unknown> {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return {};
  const fuente = actual as Record<string, unknown>;
  const guardadas: Record<string, unknown> = {};
  for (const llave of LLAVES_DE_SISTEMA) {
    if (fuente[llave] !== undefined) guardadas[llave] = fuente[llave];
  }
  return guardadas;
}
