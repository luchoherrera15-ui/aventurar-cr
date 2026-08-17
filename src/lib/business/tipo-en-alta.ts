/**
 * BOOKEA BUSINESS — el tipo de negocio EN EL ALTA.
 *
 * `modulos.ts` tiene el catálogo, `adivinar-tipo.ts` la sugerencia y
 * `identidad.ts` la cara de cada tipo. Lo que faltaba era el momento en
 * que alguien CONTESTA: hasta ahora ningún registro preguntaba, así que
 * los trece negocios de producción nacieron con `tipo_negocio` en null y
 * todo ese andamiaje se resolvía por derivación — que solo alcanza a
 * seis rubros de los dieciocho.
 *
 * Acá viven las dos reglas que el alta necesita y que TIENEN que ser la
 * misma en el navegador y en el servidor:
 *
 *   · `seLePreguntaElTipo` — si la pregunta vale la pena en esta vertical.
 *   · `tipoNegocioDeAlta`  — qué se puede escribir de verdad en la columna.
 *
 * Módulo NEUTRAL a propósito (sin "use client"): lo importan los
 * formularios en el navegador y las server actions que hacen el INSERT.
 * Un helper exportado desde un módulo de cliente y usado en el servidor
 * da un 500 que el build no detecta — ya pasó dos veces en este repo.
 */

import { esTipoNegocio, tiposDeVertical, type TipoNegocioId } from "./modulos";

/**
 * ¿Tiene sentido preguntarle el tipo a quien se registra en esta
 * vertical?
 *
 * La regla sale del catálogo, no de un `vertical === "citas"` escrito a
 * mano: se pregunta cuando hay AL MENOS DOS rubros de verdad entre los
 * que elegir. `otro` no cuenta como opción para este conteo — está en
 * las cuatro verticales y elegir entre "Hospedaje" y "Otro" no es una
 * pregunta, es un trámite.
 *
 * Hoy eso da: citas sí (trece rubros, y es donde viven el gimnasio, el
 * consultorio y el salón que motivaron todo esto), eventos sí (un salón
 * se alquila por fecha y un DJ hace dos fiestas el mismo día: paneles
 * distintos), hospedajes y restaurantes no. El día que hospedajes se
 * abra en cabinas/hotel/villa, la pregunta aparece sola sin tocar el
 * formulario.
 */
export function seLePreguntaElTipo(vertical: string): boolean {
  return tiposDeVertical(vertical).filter((t) => t.id !== "otro").length >= 2;
}

/**
 * El valor que se puede escribir en `ranchos.tipo_negocio`, o null.
 *
 * Las dos comprobaciones son las mismas que hace `guardarTipoNegocio` en
 * el panel, y por la misma razón: `tipo_negocio` lo restringe un CHECK
 * (0108). Un valor que no esté en esa lista no guarda mal el campo —
 * REVIENTA EL INSERT ENTERO y el alta se pierde con un mensaje que habla
 * de una columna que el dueño nunca vio. Por eso nada de lo que manda el
 * navegador entra sin pasar por acá, y la vertical con la que se compara
 * es la que resolvió el servidor, no la que viajó en el formulario.
 *
 * Devuelve null en vez de un error a propósito. Vacío es una respuesta
 * legítima —el paso se puede saltar, la columna es anulable— y un valor
 * inventado solo puede venir de alguien tocando el HTML, que es
 * exactamente quien no merece que le tumbemos el registro a la persona:
 * el negocio se crea igual, el panel lo resuelve por derivación y el
 * aviso azul de Configuración le pide que elija. Ninguna de las dos
 * situaciones justifica perder un alta.
 */
export function tipoNegocioDeAlta(
  vertical: string,
  valor: string | null | undefined,
): TipoNegocioId | null {
  const limpio = (valor ?? "").trim();
  if (!limpio || !esTipoNegocio(limpio)) return null;
  if (!tiposDeVertical(vertical).some((t) => t.id === limpio)) return null;
  return limpio;
}
