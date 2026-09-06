import { ImageResponse } from "next/og";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA IMAGEN DE UN NEGOCIO AL COMPARTIR SU LINK — WhatsApp, IG, X
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026): que el link de cada negocio salga
 * «más profesional, personalizado hacia cada negocio», no con la
 * imagen genérica de Bookea.
 *
 * Un solo dibujo para las tres páginas que un negocio reparte —su
 * tarjeta de lealtad (/tarjeta), su página (/r) y su link hub de
 * Solutions (/s)— con SU marca: el color de fondo, el color del sello
 * o acento, el logo y el nombre. Lo que cambia entre una y otra es el
 * texto de arriba, la frase de abajo y, en la tarjeta, la fila de
 * sellos que promete.
 *
 * ── LAS REGLAS DE SATORI ───────────────────────────────────────────
 * `next/og` dibuja con Satori, que NO es un navegador: cada <div> con
 * más de un hijo lleva `display: flex`, no hay CSS custom properties
 * (los colores van en hex), las imágenes remotas van por <img src> con
 * URL absoluta, y la fuente es la que trae por defecto (una sans
 * genérica) — cargar la del sitio pesaría más de lo que aporta en una
 * previa de 1200×630.
 *
 * ── LA TINTA SE DECIDE POR LUMINANCIA, COMO EN EL PÓSTER ───────────
 * El negocio elige su fondo; el sistema decide si la letra va blanca u
 * oscura (YIQ, mismo umbral que `paletaSobre` en plantillas-poster.ts).
 * Un fondo claro con letra blanca no es una preferencia: es ilegible.
 */

export const TAMANO_OG = { width: 1200, height: 630 };

export type PreviaNegocio = {
  /** El rótulo chico de arriba: «TARJETA DE LEALTAD», «MENÚ · TARJETA · CONTACTO»… */
  eyebrow: string;
  nombre: string;
  /** La frase grande bajo el nombre (la promesa o la bajada). */
  frase: string | null;
  /** Lo que se lee abajo a la izquierda: el link corto. */
  link: string;
  colorFondo: string;
  colorAcento: string;
  logoUrl: string | null;
  /** Foto de fondo (la portada de Solutions). Va con un velo encima. */
  fotoUrl?: string | null;
  /** Cuántos círculos dibujar (la meta de sellos). 0 = ninguno. */
  sellos?: number;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function esClaro(hex: string): boolean {
  if (!HEX.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  const brillo = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return brillo > 140;
}

/** Recorta con puntos suspensivos: Satori no hace `line-clamp`. */
function recortar(texto: string, max: number): string {
  const t = texto.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function imagenPreviaNegocio(p: PreviaNegocio): ImageResponse {
  const fondo = HEX.test(p.colorFondo) ? p.colorFondo : "#0a1226";
  const acento = HEX.test(p.colorAcento) ? p.colorAcento : "#9db4ff";
  // Con foto detrás, la tinta es siempre clara: el velo oscuro garantiza el contraste.
  const claro = p.fotoUrl ? false : esClaro(fondo);
  const tinta = claro ? "#101828" : "#ffffff";
  const suave = claro ? "rgba(16,24,40,0.66)" : "rgba(255,255,255,0.74)";
  const superficie = claro ? "rgba(16,24,40,0.08)" : "rgba(255,255,255,0.12)";
  const tintaSobreAcento = esClaro(acento) ? "#101828" : "#ffffff";
  const inicial = (p.nombre.trim().charAt(0) || "•").toUpperCase();
  const sellos = Math.max(0, Math.min(12, Math.trunc(p.sellos ?? 0)));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: fondo,
          color: tinta,
          fontFamily: "sans-serif",
        }}
      >
        {/* La foto de portada, si hay, con un velo que la deja leer. */}
        {p.fotoUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.fotoUrl}
              alt=""
              style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 1200,
                height: 630,
                background: "linear-gradient(90deg, rgba(6,10,22,0.86) 0%, rgba(6,10,22,0.62) 60%, rgba(6,10,22,0.35) 100%)",
              }}
            />
          </>
        )}

        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "60px 72px",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 48,
          }}
        >
          {/* ── El texto ─────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", maxWidth: 760 }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 4, color: suave, textTransform: "uppercase" }}>
              {p.eyebrow}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "flex", fontSize: p.nombre.length > 22 ? 62 : 78, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
                {recortar(p.nombre, 44)}
              </div>
              {p.frase && (
                <div style={{ display: "flex", fontSize: 32, fontWeight: 500, lineHeight: 1.25, color: tinta, maxWidth: 720 }}>
                  {recortar(p.frase, 120)}
                </div>
              )}
              {sellos > 0 && (
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  {Array.from({ length: sellos }).map((_, i) => (
                    /* Llenos hasta el penúltimo y el último vacío: «te falta
                       uno» se entiende sin texto. Sin glifo adentro: la fuente
                       por defecto de Satori no trae el ✓ y dibujaba un cuadro. */
                    <div
                      key={i}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        background: i < sellos - 1 ? acento : superficie,
                        border: `3px solid ${acento}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {i < sellos - 1 && (
                        <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: tintaSobreAcento, opacity: 0.85 }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, fontWeight: 600, color: suave }}>
              <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: acento }} />
              {p.link}
            </div>
          </div>

          {/* ── El logo, grande, en una tarjeta ──────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 300,
              height: 300,
              borderRadius: 56,
              background: p.logoUrl ? "#ffffff" : acento,
              border: `6px solid ${p.logoUrl ? "rgba(255,255,255,0.6)" : acento}`,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logoUrl} alt="" style={{ width: 240, height: 240, objectFit: "contain" }} />
            ) : (
              <div style={{ display: "flex", fontSize: 150, fontWeight: 800, color: tintaSobreAcento }}>{inicial}</div>
            )}
          </div>
        </div>
      </div>
    ),
    TAMANO_OG,
  );
}
