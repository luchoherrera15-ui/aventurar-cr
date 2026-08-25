import type { Metadata } from "next";
import { Figtree, IBM_Plex_Mono } from "next/font/google";
import { urlSitio } from "@/lib/sitio";
import AssistExperiencia from "./assist-experiencia";
import estilos from "./assist.module.css";

/**
 * /assist — LA LANDING DE BOOKEA ASSIST.
 *
 * Standalone y pública, fuera de /mi-negocio y /admin: no toca el
 * panel existente. Server Component a propósito, para poder declarar
 * `metadata` (Open Graph incluido — es una página pensada para
 * compartirse por WhatsApp). Todo el motor de animación/scroll vive en
 * `assist-experiencia.tsx` ('use client'), que es lo único que este
 * archivo renderiza.
 *
 * Las dos familias tipográficas se cargan acá (no en el layout raíz,
 * que ya trae Figtree para el resto del sitio) porque esta página usa
 * pesos y una segunda familia (IBM Plex Mono, para kickers/timestamps)
 * que el resto de Bookea no necesita — cargarlas en el layout raíz las
 * pagaría hasta la home.
 */

const figtree = Figtree({
  variable: "--font-assist-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-assist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const TITULO = "Bookea Assist — el WhatsApp de tu negocio, atendido solo";
const DESCRIPCION =
  "Un complemento de WhatsApp que contesta 24/7, revisa la disponibilidad real de tu agenda en Bookea y agenda la cita sola — sin que vos tengas que escribir una palabra.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: urlSitio("/assist") },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: urlSitio("/assist"),
    siteName: "Bookea",
    locale: "es_CR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
  },
};

export default function PaginaAssist() {
  return (
    <div className={`${figtree.variable} ${plexMono.variable} ${estilos.assist}`}>
      <AssistExperiencia />
    </div>
  );
}
