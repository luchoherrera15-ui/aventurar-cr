/**
 * ════════════════════════════════════════════════════════════════════
 *  EL CÓDIGO QR DE LAS MAQUETAS — de verdad, no un dibujo
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (30 ago 2026): «arreglá esos mockups, colocales un
 * verdadero código QR». Los mockups pintaban una grilla con dos
 * gradientes cruzados que no era un QR ni lo parecía: se leía como una
 * imagen que no cargó.
 *
 * Este SÍ ESCANEA. El path salió de la librería `qrcode` —la misma que
 * usan el póster y la pantalla de compartir— codificando la URL de
 * abajo, y quedó GUARDADO como constante en vez de generarse en cada
 * render:
 *
 *   · el contenido es fijo (siempre la misma URL), así que generarlo
 *     una y otra vez sería calcular siempre lo mismo;
 *   · los mockups son componentes de CLIENTE, y meter `qrcode` en el
 *     bundle del navegador por una maqueta decorativa son ~50 KB que
 *     paga cada visitante de la portada.
 *
 * ⚠️ SI SE CAMBIA LA URL HAY QUE REGENERAR EL PATH — no se puede editar
 * a mano. Con la librería ya instalada:
 *
 *   node -e "import('qrcode').then(q=>q.toString(URL,{type:'svg',
 *     errorCorrectionLevel:'M',margin:0}).then(console.log))"
 *
 * Corrección de errores en nivel M (15 %): suficiente para que siga
 * leyéndose impreso chico, sin engordar la trama como haría H.
 */

/** A dónde lleva el código. Si cambia, hay que regenerar VIÑETA_QR. */
export const URL_DEL_QR = "https://bookea.lat/lealtad";

const VINETA_QR = {
  viewBox: "0 0 25 25",
  d: "M0 0.5h7m2 0h1m1 0h1m2 0h1m1 0h1m1 0h7M0 1.5h1m5 0h1m3 0h2m2 0h3m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h5m2 0h1m2 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h2m1 0h1m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h2m3 0h1m2 0h1m1 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h1m1 0h1m1 0h4m2 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h1m1 0h3m1 0h3M0 8.5h1m1 0h5m4 0h1m1 0h2m3 0h5M0 9.5h1m2 0h1m6 0h4m2 0h1m2 0h1m3 0h1M0 10.5h4m2 0h1m1 0h4m2 0h2m1 0h1m2 0h2m1 0h2M1 11.5h2m1 0h2m2 0h1m1 0h1m1 0h1m3 0h2m6 0h1M0 12.5h1m1 0h1m1 0h3m1 0h7m2 0h2m1 0h1m1 0h3M0 13.5h3m2 0h1m1 0h1m1 0h2m1 0h1m6 0h1m1 0h1m1 0h1M0 14.5h1m1 0h2m2 0h1m1 0h1m3 0h1m1 0h4m1 0h3m1 0h2M0 15.5h1m4 0h1m1 0h1m2 0h1m3 0h2m1 0h1m1 0h2m3 0h1M0 16.5h1m2 0h4m2 0h2m1 0h9m1 0h1M8 17.5h1m2 0h1m3 0h2m3 0h2M0 18.5h7m9 0h1m1 0h1m1 0h1m1 0h3M0 19.5h1m5 0h1m1 0h2m2 0h1m1 0h1m1 0h1m3 0h2M0 20.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h9m1 0h1M0 21.5h1m1 0h3m1 0h1m1 0h4m1 0h1m3 0h2m1 0h5M0 22.5h1m1 0h3m1 0h1m1 0h1m3 0h1m1 0h1m6 0h2m1 0h1M0 23.5h1m5 0h1m8 0h2m2 0h3m2 0h1M0 24.5h7m1 0h1m4 0h2m2 0h1m1 0h6",
};

/**
 * El QR, cuadrado y escalable. `lado` va en píxeles.
 *
 * `shapeRendering="crispEdges"` NO es opcional: sin eso el navegador
 * suaviza los bordes de cada módulo y a tamaño chico la trama se
 * emborrona lo suficiente como para que un lector falle.
 *
 * ⚠️ VA CON `stroke`, NO CON `fill`. El path que genera `qrcode` es una
 * sucesión de LÍNEAS horizontales de alto cero (`M0 0.5h7m2 0h1…`), no
 * de rectángulos: rellenarlo no pinta nada y el recuadro queda en
 * blanco. Se vio así la primera vez.
 */
export function CodigoQR({ lado, className }: { lado: number; className?: string }) {
  return (
    <svg
      viewBox={VINETA_QR.viewBox}
      width={lado}
      height={lado}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Código QR de ejemplo"
    >
      <path d={VINETA_QR.d} stroke="currentColor" strokeWidth={1} fill="none" />
    </svg>
  );
}
