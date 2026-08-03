import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
// La burbuja arrastra el cliente de Supabase + Realtime solo para
// mostrarse (o no) según haya sesión y conversaciones — peso que hoy
// paga hasta la página estática que menos lo necesita, porque
// RootLayout la importaba de forma estática y entraba en el mismo
// bundle que cualquier ruta del sitio. chat-flotante-lazy.tsx la carga
// con `dynamic(..., {ssr:false})` para que sea un chunk aparte que se
// pide después de la hidratación — Next no permite `ssr:false` escrito
// directo en un Server Component, por eso el envoltorio.
import ChatFlotante from "@/components/chat-flotante-lazy";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  // El sitio vive en www.bookea.lat. Fijarlo acá hace que TODA URL
  // absoluta de metadata (Open Graph, Twitter, imágenes de preview)
  // salga con ese dominio aunque la página se haya servido desde otro
  // host apuntado al mismo proyecto — si no, lo que se comparte por
  // WhatsApp queda con el dominio por el que entró esa persona.
  metadataBase: new URL("https://www.bookea.lat"),
  // Genérico a propósito: Bookea no es solo eventos — también vienen
  // hospedajes y escapadas. La geografía sí se queda (posiciona), la
  // intención de "evento" no. Las páginas internas anteponen lo suyo
  // con el template ("Rancho X | Bookea").
  title: {
    default: "Bookea — Reservá espacios y servicios en Costa Rica",
    template: "%s | Bookea",
  },
  description:
    "Reservá lugares para eventos, catering, música, decoración y muy pronto citas de servicios y hospedajes en todo Costa Rica. Compará opciones reales y reservá directo, sin cadenas de WhatsApp.",
  keywords: [
    "reservar espacios Costa Rica",
    "lugares para fiestas",
    "salones de eventos",
    "catering Costa Rica",
    "hospedajes Costa Rica",
    "Bookea",
  ],
  openGraph: {
    title: "Bookea — Reservá espacios y servicios en Costa Rica",
    description:
      "Espacios, servicios y experiencias en un solo lugar. Compará opciones reales y reservá directo.",
    locale: "es_CR",
    siteName: "Bookea",
    url: "https://www.bookea.lat",
  },
};

// El navegador in-app de algunas apps (WhatsApp, Instagram...) fuerza
// modo oscuro sin que el sitio lo pida, y como acá todo el texto es
// oscuro sobre fondos claros a propósito, eso lo dejaba ilegible.
// "only light" le dice al navegador que no hay tema oscuro que ofrecer.
export const viewport: Viewport = {
  colorScheme: "only light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* Burbuja de mensajes global: visible en todas las páginas
            cuando hay conversaciones, con contador de no leídos. */}
        <ChatFlotante />
      </body>
    </html>
  );
}
