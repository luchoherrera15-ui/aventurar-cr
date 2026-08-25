import { ImageResponse } from "next/og";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA IMAGEN QUE SE VE AL COMPARTIR bookea.lat
 * ════════════════════════════════════════════════════════════════════
 *
 * Next la detecta por convención de nombre y la enchufa sola en
 * `openGraph.images` de TODA ruta que no traiga la suya. No hay que
 * declararla a mano en `metadata`.
 *
 * ── POR QUÉ HACÍA FALTA ─────────────────────────────────────────────
 *
 * No existía ninguna en la raíz —solo `/assist` tenía la suya—, y sin
 * imagen declarada Facebook y WhatsApp NO se quedan sin nada: agarran
 * la primera foto grande que encuentran en la página. En la portada eso
 * era la foto de un negocio del catálogo, así que compartir el link de
 * Invitaciones mostraba la barbería de otro cliente. Y a medida que
 * entren negocios, iba a cambiar sola.
 *
 * ── SE DIBUJA, NO SE SUBE ───────────────────────────────────────────
 *
 * Es un componente, no un PNG en /public. Así el eslogan se edita como
 * texto y no hay que abrir un editor de imágenes ni mantener un archivo
 * binario en el repo. Se genera en el borde y se cachea.
 *
 * Los colores van literales y no como `var(--navy)`: esto corre en el
 * runtime edge, sin DOM y sin la hoja de estilos. Son tres valores.
 */

/**
 * ⚠️ ACÁ DECÍA `runtime = "edge"` Y ESO ERA LO CARO.
 *
 * Una ruta de metadata en runtime EDGE no se prerenderiza: Next la
 * compila como función y la ejecuta EN CADA PETICIÓN. Y `ImageResponse`
 * no es barato — monta un motor de layout (Satori), arma un SVG y lo
 * rasteriza a PNG.
 *
 * Medido en el panel de Vercel: 135 invocaciones en 12 horas, ~444 ms
 * de CPU activa cada una. Un minuto entero de CPU para dibujar una
 * imagen que NUNCA CAMBIA — colores fijos, texto fijo, sin parámetros
 * ni datos.
 *
 * Sin esa línea la ruta corre en Node y Next la PRERENDERIZA en el
 * build: se dibuja una vez al desplegar y después sale del CDN. Cero
 * invocaciones, cero CPU.
 *
 * El comentario de arriba sigue valiendo igual: los colores van
 * literales porque esto no tiene DOM ni hoja de estilos.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Bookea — Convertí cada interacción en una experiencia";

const NAVY = "#16295e";
const NAVY_PROFUNDO = "#0a1226";
const NARANJA = "#ee7420";

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
          padding: 88,
          background: `linear-gradient(135deg, ${NAVY_PROFUNDO} 0%, ${NAVY} 100%)`,
          color: "#ffffff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* El halo naranja: el mismo gesto de la portada, en versión
            quieta. Da profundidad sin competir con el texto. */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 620,
            height: 620,
            borderRadius: 620,
            background: NARANJA,
            opacity: 0.18,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 34 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: NARANJA,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            b
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>
            Bookea
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -1.5,
            maxWidth: 900,
          }}
        >
          Convertí cada interacción en una experiencia
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 30,
            lineHeight: 1.35,
            color: "rgba(255,255,255,.68)",
            maxWidth: 820,
          }}
        >
          Citas, eventos, hospedaje y experiencias — reservá directo, sin cadenas de
          WhatsApp.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 26,
            fontWeight: 700,
            color: NARANJA,
          }}
        >
          bookea.lat
        </div>
      </div>
    ),
    size,
  );
}
