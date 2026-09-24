import { ImageResponse } from "next/og";
import { MARCA } from "@/lib/celebrar/marca";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${MARCA.nombre} — ${MARCA.claim}`;

// Los mismos tokens de celebrar.css, como literales: el generador de OG
// corre fuera del CSS del sitio y no puede leer variables.
const MARINO = "#0b1e45";
const BLANCO = "#ffffff";
const CORAL = "#f26b5b";
const SUAVE = "#a9b6d3";

/**
 * La previa que muestra WhatsApp al compartir celebrar.lat: marino, la
 * loseta, el claim en la sans del sistema (el generador no descarga
 * fuentes; Montserrat se aproxima con una sans pesada) y el lema.
 */
export default function ImagenOgCelebrar() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 84px",
          background: MARINO,
          color: BLANCO,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: BLANCO,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 9999, border: `4px solid ${MARINO}`, display: "flex" }} />
          </div>
          <div style={{ display: "flex", letterSpacing: -1 }}>{MARCA.logotipo}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.04, letterSpacing: -3, maxWidth: 1000 }}>
            {MARCA.claim}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, color: SUAVE }}>
            <div style={{ width: 12, height: 12, borderRadius: 9999, background: CORAL, display: "flex" }} />
            {MARCA.lema}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: SUAVE,
          }}
        >
          <div style={{ display: "flex" }}>Invitaciones, video, RSVP, álbum y recuerdos</div>
          <div style={{ display: "flex" }}>{MARCA.dominio}</div>
        </div>
      </div>
    ),
    size,
  );
}
