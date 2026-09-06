import { ImageResponse } from "next/og";

/**
 * LA PREVIA DE linksy.lat AL COMPARTIR — WhatsApp, Instagram, X.
 *
 * Pedido del dueño (6 sep 2026): anunciar Linksy. Lo primero que ve
 * quien recibe el link es esta imagen, y sin ella la previa sale con
 * la de Bookea (la del layout raíz), que dice otro nombre.
 *
 * Es el héroe de la landing reducido a su tesis: el bloque lima, el
 * nombre y la frase. Los dos colores son los mismos de `.linksy` en
 * globals.css (lima #c9f24c / tinta #16301a, 12,9:1) — acá van como
 * hex porque Satori no lee CSS custom properties; si la paleta cambia,
 * cambia en los dos lugares.
 *
 * Mismo criterio que la OG de la raíz: una sola frase, centrada, con
 * `maxWidth` para que la previa recortada de WhatsApp no pierda los
 * extremos. `sans-serif` y no Montserrat: Satori necesita una fuente
 * estática y la del repo es variable.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Linksy — Todo tu negocio. Un solo link.";

const LIMA = "#c9f24c";
const TINTA = "#16301a";

export default function ImagenOgLinksy() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background: LIMA,
          color: TINTA,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>Linksy</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
              maxWidth: 1000,
            }}
          >
            Todo tu negocio. Un solo link.
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, maxWidth: 900, lineHeight: 1.25 }}>
            Tus redes, tu menú, tus productos y tu tarjeta de lealtad. Gratis.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>linksy.lat</div>
      </div>
    ),
    size,
  );
}
