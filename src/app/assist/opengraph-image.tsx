import { ImageResponse } from "next/og";

/**
 * LA IMAGEN DE OG DE /assist.
 *
 * Next la detecta por convención de nombre de archivo y la enchufa
 * sola en `openGraph.images` de esta ruta — no hace falta declararla a
 * mano en `metadata`. Importa de verdad: esta página se piensa para
 * compartirse por WhatsApp, así que la vista previa del link es parte
 * del producto, no un detalle.
 *
 * Colores literales de la landing (--void, --orange, --ember, --rail):
 * no se puede leer el CSS Module desde acá (esto corre en runtime edge,
 * sin DOM), así que se repiten a mano — son solo cuatro valores.
 */

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ImagenOg() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #050b18 0%, #0b2447 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 54,
              height: 54,
              borderRadius: 16,
              background: "#ee7420",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            B
          </div>
          <span
            style={{
              fontSize: 26,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#ffa055",
              fontWeight: 600,
            }}
          >
            Bookea Assist
          </span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            maxWidth: 920,
          }}
        >
          El WhatsApp de tu negocio, atendido solo.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 28,
            color: "#9fb0cf",
            maxWidth: 820,
          }}
        >
          Contesta, revisa tu agenda real y agenda la cita — sin que vos escribas una palabra.
        </div>
      </div>
    ),
    { ...size },
  );
}
