// La hoja de la bienvenida — solo la descarga esta ruta.
import "./intro.css";
import EventosPage from "./eventos/page";
import PortadaIntro from "./portada-intro";
import { GUION_INTRO } from "./intro-visita";

/**
 * LA RAÍZ DEL SITIO: `bookea.lat` ES el directorio de Eventos, con la
 * bienvenida de Bookea encima la primera vez.
 *
 * QUÉ HABÍA ACÁ ANTES Y POR QUÉ CAMBIÓ
 *
 * Esta página era una portada de marca (mapa de Latinoamérica, "así
 * funciona", dos tarjetas) que a los 1.4 segundos se mandaba sola a
 * `/eventos` con `router.replace`. O sea: el HTML que le llegaba a
 * Google —y al visitante— era una portada que nadie llegaba a leer, y
 * después un salto de página para ver lo que se venía a ver.
 *
 * Peor: esa portada NO DEBERÍA HABER ESTADO CORRIENDO. En `next.config`
 * hay un rewrite de `/` a `/eventos`, pero los rewrites en forma de
 * arreglo son `afterFiles` y se revisan DESPUÉS del sistema de
 * archivos (`node_modules/next/dist/docs/.../rewrites.md`): como este
 * `page.tsx` existe, gana él y el rewrite nunca dispara. Cuando la
 * raíz pasó de redirect a rewrite, la portada con su intro volvió a la
 * vida sin que nadie la pidiera — eso es lo que el dueño vio
 * reaparecer en producción.
 *
 * AHORA
 *
 * `/` renderiza el MISMO directorio de Eventos, en su propia respuesta:
 * el HTML del servidor trae las cards, el `<h1>`, el pie y los datos
 * completos. La bienvenida es una capa `fixed` encima que se levanta
 * sola. Para un buscador —y para quien tenga el JavaScript apagado— la
 * raíz es, simplemente, el directorio.
 *
 * El rewrite de `next.config` se deja donde está: no estorba, y si algún
 * día este archivo se borra, la raíz sigue sirviendo Eventos.
 *
 * EL ORDEN DE ESTOS TRES ELEMENTOS ES LA MITAD DEL TRUCO
 *
 * 1. El guion inline va de PRIMERO en el body. Se ejecuta durante el
 *    parseo, antes de que exista una sola card, y decide si hay
 *    bienvenida (ver intro-visita.ts). Así no hay parpadeo de
 *    contenido → velo → contenido.
 * 2. El velo, ya con la respuesta puesta en el <html>.
 * 3. El directorio, que es lo que de verdad importa.
 *
 * Y los 2 segundos no retrasan nada: el directorio se pinta y pide sus
 * datos detrás del velo, así que cuando la capa se levanta la página ya
 * está lista.
 */
export default function Home() {
  return (
    <>
      {/* Inline y sin `src` a propósito: tiene que correr ya, no en la
          siguiente vuelta de red. Son ~180 bytes. */}
      <script dangerouslySetInnerHTML={{ __html: GUION_INTRO }} />
      <PortadaIntro />
      <EventosPage />
    </>
  );
}
