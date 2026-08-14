/**
 * ¿LE TOCA VER LA BIENVENIDA A ESTA PERSONA?
 *
 * Este archivo NO es de cliente ni de servidor: exporta constantes y el
 * TEXTO de un guion que va inline en el HTML de `/`. Está aparte de
 * `portada-intro.tsx` justamente por eso — un módulo con "use client"
 * del que se exportan helpers rompe el build en silencio (ya pasó en
 * Finanzas y en IA).
 *
 * POR QUÉ UN GUION INLINE Y NO REACT
 *
 * La decisión hay que tomarla ANTES de que el navegador pinte. El
 * servidor no puede leer `localStorage`, así que si esperáramos a que
 * React hidratara, el visitante vería primero el directorio de Eventos
 * y medio segundo después le caería el velo blanco encima: contenido →
 * tapa → contenido. Eso se lee como una falla del sitio.
 *
 * Este guion va de PRIMERO en el `<body>` de `/`. Corre antes de que se
 * parsee una sola card, marca el `<html>` con `data-intro`, y el CSS de
 * `intro.css` —que ya está en el `<head>`, o sea que ya bloqueó el
 * pintado— muestra el velo desde el primer fotograma. Cero parpadeo, y
 * el HTML sigue trayendo Eventos entero para Google (ver page.tsx).
 *
 * POR QUÉ localStorage Y NO sessionStorage
 *
 * `sessionStorage` es por PESTAÑA, no por persona. En Costa Rica una
 * parte enorme del tráfico entra desde el navegador interno de WhatsApp
 * o Instagram, y cada vez que se abre un link ahí nace una pestaña
 * nueva: con `sessionStorage` la bienvenida saldría prácticamente en
 * CADA visita, que es exactamente lo que se quiere evitar.
 * `localStorage` la deja en una sola vez por dispositivo.
 *
 * SE ANOTA AL EMPEZAR, NO AL TERMINAR
 *
 * Si se anotara al final, quien cierra a la mitad la volvería a ver. Y
 * anotar acá no depende de que el bundle de React llegue a cargar.
 *
 * POR QUÉ NO SE USA `use-movimiento-reducido.ts`
 *
 * Ese helper del repo es un hook de React y, como tal, contesta después
 * de hidratar — o sea, tarde: para entonces el velo ya tendría que
 * estar puesto o no puesto. Acá la misma pregunta se hace con
 * `matchMedia` crudo, con LA MISMA consulta
 * (`prefers-reduced-motion: reduce`), antes del primer pintado. El
 * hook sigue siendo el correcto para todo lo que se decida ya dentro
 * de React (lo usa, por ejemplo, el riel de /invitaciones).
 *
 * SI EL ALMACENAMIENTO ESTÁ BLOQUEADO (modo restringido, cookies
 * apagadas, un iframe de terceros) el `try` se traga el error y NO se
 * muestra nada: sin dónde anotar, mostrarla sería mostrarla siempre.
 * Ante la duda gana el contenido.
 */

/** La marca de "esta persona ya vio la bienvenida", en localStorage. */
export const LLAVE_INTRO = "bookea:intro-vista";

/** Lo que el guion le pone al `<html>` para que el CSS muestre el velo. */
export const ATRIBUTO_INTRO = "data-intro";

/** Lo que le pone `portada-intro.tsx` al `<html>` para cortarla antes. */
export const ATRIBUTO_FIN = "data-intro-fin";

/**
 * Lo que dura la bienvenida completa: 2000 ms de barra (lo que pidió el
 * dueño) + 320 ms de desvanecido.
 *
 * ES UN ESPEJO DE `intro.css` — los dos relojes tienen que decir lo
 * mismo. Acá solo se usa para soltar los escuchas de "saltar"; el que
 * de verdad termina la bienvenida es el CSS, a propósito: así se acaba
 * a los 2 segundos aunque el JavaScript nunca llegue a correr, y la
 * barra no se puede desincronizar del velo porque los mueve el mismo
 * reloj.
 */
export const DURACION_INTRO_MS = 2320;

/**
 * El guion, tal cual va dentro del `<script>` del HTML.
 *
 * Va como texto (y no como función importada) porque tiene que
 * ejecutarse durante el parseo del documento, sin esperar ningún
 * módulo. Las llaves salen de las constantes de arriba para que no se
 * puedan desfasar, y `intro-visita.test.ts` corre ESTE MISMO texto —no
 * una copia— contra un navegador de mentira.
 */
export const GUION_INTRO = [
  "try{",
  'if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches',
  `&&!localStorage.getItem("${LLAVE_INTRO}")){`,
  `localStorage.setItem("${LLAVE_INTRO}","1");`,
  `document.documentElement.setAttribute("${ATRIBUTO_INTRO}","1")`,
  "}}catch{}",
].join("");
