import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import ChatFlotante from "@/components/chat-flotante";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  // El título por defecto lleva la propuesta completa con las palabras
  // que la gente realmente busca; las páginas internas anteponen lo
  // suyo con el template ("Rancho X | Bookea").
  title: {
    default: "Bookea — Reservá espacios y servicios para tu evento en Costa Rica",
    template: "%s | Bookea",
  },
  description:
    "Encontrá y reservá lugares para fiestas, catering, DJs, decoración y todo para tu evento en Costa Rica. Compará opciones reales y reservá directo, sin cadenas de WhatsApp.",
  keywords: [
    "reservar salón de eventos Costa Rica",
    "lugares para fiestas",
    "catering Costa Rica",
    "ranchos para eventos",
    "Bookea",
  ],
  openGraph: {
    title: "Bookea — Reservá espacios y servicios para tu evento",
    description:
      "Lugares, comida, música y decoración para tu evento en Costa Rica. Compará y reservá directo.",
    locale: "es_CR",
    siteName: "Bookea",
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
