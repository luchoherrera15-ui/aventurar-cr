"use client";

import { useEffect } from "react";
import { ATRIBUTO_FIN, ATRIBUTO_INTRO, DURACION_INTRO_MS } from "./intro-visita";

/**
 * LA BIENVENIDA: el logo de Bookea, una barra que se llena en 2
 * segundos, y adentro — el directorio de Eventos, que estuvo abajo
 * todo el tiempo.
 *
 * ESTE COMPONENTE CASI NO HACE NADA, Y ES A PROPÓSITO.
 *
 * · Quién la ve lo decide `intro-visita.ts`, en un guion que corre
 *   antes de que el navegador pinte (si no, el visitante vería el
 *   directorio y medio segundo después le caería el velo encima).
 * · Cuándo se va lo decide `intro.css`. Si el JavaScript no llega a
 *   cargar, la bienvenida se termina igual a los 2 segundos: nadie
 *   queda encerrado detrás de un velo blanco por una mala conexión.
 *
 * Lo único que necesita React es SALTARLA. Un toque o una tecla y el
 * velo se va en 200 ms.
 *
 * NO NAVEGA A NINGUNA PARTE. La versión anterior era un `router.replace`
 * de `/` a `/eventos`, o sea que la portada era una sala de espera con
 * un salto de página al final. Ahora `/` YA ES Eventos (ver page.tsx) y
 * esto es una capa que se levanta: sin cambio de URL, sin historial
 * raro, sin volver a pedir nada.
 *
 * El velo va `aria-hidden`: es decoración de marca, y lo que importa
 * —el directorio— está completo debajo. Quien navegue con lector de
 * pantalla lo lee sin enterarse de que hay una animación arriba, y no
 * hay ningún botón de mentira que atrapar con el tabulador.
 */
export default function PortadaIntro() {
  useEffect(() => {
    const raiz = document.documentElement;
    // Sin el atributo no hay nada que saltar: esta persona ya la vio,
    // pidió movimiento reducido, o el almacenamiento está bloqueado.
    if (!raiz.hasAttribute(ATRIBUTO_INTRO)) return;

    const cortar = () => raiz.setAttribute(ATRIBUTO_FIN, "1");
    const unaSolaVez = { once: true } as const;
    // `pointerdown` cubre el clic y el toque con el mismo escucha, y
    // salta en cuanto el dedo baja en vez de esperar a que se levante.
    window.addEventListener("pointerdown", cortar, unaSolaVez);
    window.addEventListener("keydown", cortar, unaSolaVez);

    const soltar = () => {
      window.removeEventListener("pointerdown", cortar);
      window.removeEventListener("keydown", cortar);
    };
    // Cuando el CSS ya terminó, estos escuchas no tienen nada que
    // hacer: un clic en el minuto cinco no debería andar tocando el
    // <html>. Se sueltan solos.
    const reloj = window.setTimeout(soltar, DURACION_INTRO_MS);

    return () => {
      window.clearTimeout(reloj);
      soltar();
    };
  }, []);

  // Se pinta SIEMPRE, también en el HTML del servidor: sin `data-intro`
  // en el <html> el CSS lo deja en `display: none`, y como entonces no
  // genera caja, el navegador ni pide el PNG del logo. Cero costo para
  // quien ya la vio.
  return (
    <div className="intro-velo" aria-hidden="true">
      <span className="intro-marca" />
      <span className="intro-barra">
        <span className="intro-barra-relleno" />
      </span>
    </div>
  );
}
