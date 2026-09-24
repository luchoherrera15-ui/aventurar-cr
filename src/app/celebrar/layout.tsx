import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./celebrar.css";
import { sitioCelebrar, urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { MARCA } from "@/lib/celebrar/marca";

/**
 * ══════════════════════════════════════════════════════════════════
 *  CELEBRAR — el layout raíz del producto
 * ══════════════════════════════════════════════════════════════════
 *
 * Todo lo que cuelga de /celebrar (hoy) y de celebrar.lat (mañana) pasa
 * por acá: fuentes propias, tokens propios (celebrar.css) y metadata
 * propia. NO monta el header ni el footer de Bookea — el layout raíz
 * del sitio tampoco los pone, así que acá adentro Bookea no aparece
 * ni por herencia (la burbuja del chat se apaga sola en
 * chat-flotante-lazy.tsx).
 *
 * Este layout NO lee cookies ni headers a propósito: así las páginas
 * públicas que quieran ser estáticas (la invitación, Fase 3) pueden
 * serlo. Lo dinámico (sesión, host) lo leen los layouts de adentro:
 * `(sitio)` para la portada y el acceso, `app` para el panel.
 */

// Montserrat es la voz de la marca (títulos, botones, rótulos); Inter
// lleva el texto corrido. Montserrat ya se carga en Lealtad y Linksy
// con el mismo nombre de variable, así que Next la descarga una vez.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(new URL(sitioCelebrar()).origin),
  title: {
    default: MARCA.tituloPortada,
    template: MARCA.plantillaTitulo,
  },
  description: MARCA.descripcion,
  applicationName: MARCA.nombre,
  keywords: [
    "invitaciones digitales",
    "invitación de boda digital",
    "invitación XV años",
    "confirmación de asistencia",
    "álbum de fotos compartido",
    "Costa Rica",
    "celebrar.lat",
  ],
  openGraph: {
    siteName: MARCA.nombre,
    locale: "es_CR",
    type: "website",
    url: urlPublicaCelebrar("/"),
    title: MARCA.tituloPortada,
    description: MARCA.descripcion,
  },
  twitter: {
    card: "summary_large_image",
    title: MARCA.tituloPortada,
    description: MARCA.descripcion,
  },
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#0b1e45",
};

export default function LayoutCelebrar({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${montserrat.variable} ${inter.variable} celebrar flex min-h-screen flex-1 flex-col`}>
      {children}
    </div>
  );
}
