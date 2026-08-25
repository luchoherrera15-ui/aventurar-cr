/**
 * BANDA 9 — CTA FINAL (oscuro). Mismo lienzo ambiente del hero
 * (blobs a la deriva) y el botón grande a WhatsApp, con la MISMA
 * constante que usa el hero — un solo número, un solo lugar.
 */

import { WHATSAPP_ASSIST } from "./constantes";
import estilos from "./assist.module.css";

export default function CtaFinal() {
  return (
    <section className={estilos.ctaFinal}>
      <div className={estilos.heroFondo} aria-hidden="true">
        <span className={`${estilos.blob} ${estilos.blobA}`} />
        <span className={`${estilos.blob} ${estilos.blobB}`} />
        <span className={`${estilos.blob} ${estilos.blobC}`} />
      </div>
      <div className={estilos.ctaFinalInner}>
        <p className={estilos.kickerOscuro}>Bookea Assist</p>
        <h2 className={`${estilos.d1} ${estilos.tituloOscuro}`}>Dejá de perder reservas por no contestar.</h2>
        <p className={`${estilos.cuerpoOscuro} ${estilos.ctaFinalBajada}`}>
          Escribinos por WhatsApp y te mostramos cómo queda contestando el tuyo.
        </p>
        <a
          className={`${estilos.botonNaranja} ${estilos.botonGrande}`}
          href={WHATSAPP_ASSIST}
          target="_blank"
          rel="noopener noreferrer"
        >
          Hablar con Bookea Assist
        </a>
      </div>
    </section>
  );
}
