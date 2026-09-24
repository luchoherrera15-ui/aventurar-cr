import { ImageResponse } from "next/og";
import { MARCA, tipoCelebracion } from "@/lib/celebrar/marca";
import { fechaLargaCR } from "@/lib/fechas";
import { invitacionPublicaPorSlug } from "./datos-publicos";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 60;

/**
 * La previa de WhatsApp de una invitación: la paleta de su diseño, el
 * saludo, el nombre y la fecha. Sin descargar fuentes (el generador de
 * OG no las tiene): una serif o sans del sistema según la letra elegida.
 */
export default async function ImagenOgInvitacion({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inv = await invitacionPublicaPorSlug(slug);
  const p = inv?.documento.estilo.paleta ?? { fondo: "#0b1e45", tinta: "#ffffff", acento: "#f26b5b", suave: "#a9b6d3", superficie: "#142b5c" };
  const hero = inv?.documento.secciones.find((s) => s.tipo === "hero");
  const saludo = hero?.tipo === "hero" ? hero.datos.saludo : "";
  const nombre = inv?.nombre ?? MARCA.nombre;
  const linea = inv
    ? [tipoCelebracion(inv.tipo)?.nombre, inv.fecha ? fechaLargaCR(inv.fecha) : null, inv.lugar_nombre].filter(Boolean).join("  ·  ")
    : MARCA.claim;
  const serif = inv ? ["playfair", "cormorant", "lora", "libre", "cinzel", "dmserif", "abril"].includes(inv.documento.estilo.fuenteTitulo) : false;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 96px",
          background: p.fondo,
          color: p.tinta,
          textAlign: "center",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", width: 22, height: 22, borderRadius: 9999, border: `3px solid ${p.acento}`, marginBottom: 28 }} />
        {saludo && <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: p.acento }}>{saludo}</div>}
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: nombre.length > 24 ? 64 : 84,
            lineHeight: 1.05,
            fontFamily: serif ? "Georgia, 'Times New Roman', serif" : "Arial, Helvetica, sans-serif",
            fontWeight: serif ? 400 : 800,
            letterSpacing: serif ? 0 : -2,
            maxWidth: 1000,
          }}
        >
          {nombre}
        </div>
        <div style={{ display: "flex", width: 56, height: 2, background: p.acento, margin: "30px 0" }} />
        <div style={{ display: "flex", fontSize: 26, color: p.suave }}>{linea}</div>
        <div style={{ display: "flex", position: "absolute", bottom: 36, fontSize: 20, color: p.suave }}>{MARCA.dominio}</div>
      </div>
    ),
    size,
  );
}
