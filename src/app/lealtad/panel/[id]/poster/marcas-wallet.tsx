/**
 * ====================================================================
 * ARTE PROVISIONAL — HAY QUE REEMPLAZARLO ANTES DE PRODUCCIÓN
 * ====================================================================
 *
 * Esto NO son las insignias oficiales de Apple Wallet ni de Google
 * Wallet. Son dos marcas dibujadas por nosotros —un glifo genérico de
 * tarjeta y el nombre en texto— para que el afiche ya diga lo que
 * tiene que decir: que la tarjeta funciona en el teléfono que sea.
 *
 * POR QUÉ HAY QUE CAMBIARLAS
 * Apple y Google publican el arte de sus insignias con guías de marca
 * estrictas (área de resguardo, tamaño mínimo, versiones de color
 * permitidas, prohibición de redibujarlas). Una recreación propia de
 * una marca ajena impresa y pegada en cientos de mostradores no es un
 * detalle estético: es material de marca de un tercero usado fuera de
 * su licencia, y es exactamente lo primero que una revisión rechaza.
 *
 * QUÉ HAY QUE HACER
 *   1. Bajar el arte oficial: Apple lo publica en su Marketing
 *      Resources (Add to Apple Wallet), Google en su brand page de
 *      Google Wallet.
 *   2. Dejar los archivos en `public/wallet/` (SVG, versión monocroma).
 *   3. Cambiar SOLO este archivo por los dos `<img>`, respetando el
 *      espacio libre y el tamaño mínimo que pida cada guía.
 *
 * Por eso las insignias viven en UN componente y no sueltas en la
 * hoja: el día del reemplazo se toca un archivo, no seis estilos.
 *
 * EN GRIS O EN NEGRO, NUNCA EN EL COLOR DEL NEGOCIO
 * El dibujo usa `currentColor` y lo hereda del pie de la hoja, que es
 * siempre tinta neutra (gris sobre papel claro, blanco translúcido
 * sobre el estilo audaz). Ningún estilo lo tiñe con el color de la
 * marca del negocio: un logo ajeno pintado del color de otro es lo
 * primero que rechaza una revisión, y esa regla tiene que sobrevivir
 * al reemplazo por el arte oficial.
 */

/** El glifo genérico de tarjeta. No imita el logo de nadie. */
function GlifoTarjeta() {
  return (
    <svg
      className="poster-wallet-glifo"
      viewBox="0 0 24 16"
      aria-hidden
      focusable="false"
    >
      <rect
        x="0.9"
        y="0.9"
        width="22.2"
        height="14.2"
        rx="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M0.9 5.6h22.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14.6" y="8.6" width="5.8" height="3.6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export default function MarcasWallet() {
  return (
    <p className="poster-wallets">
      <span className="poster-wallet">
        <GlifoTarjeta />
        <span className="poster-wallet-nombre">Apple Wallet</span>
      </span>
      <span className="poster-wallet">
        <GlifoTarjeta />
        <span className="poster-wallet-nombre">Google Wallet</span>
      </span>
    </p>
  );
}
