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
import { SITIO } from "@/lib/sitio";

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
  //
  // Sale de @/lib/sitio para que el canónico del directorio, el sitemap
  // y el robots.txt no puedan quedar diciendo otro host que este.
  //
  // OJO: `alternates.canonical` NO va acá. La metadata de un layout la
  // heredan todas las rutas de abajo, así que un canónico puesto en
  // este objeto canonizaría /citas, /hospedajes y cada ficha de negocio
  // a la misma dirección. Cada página declara la suya.
  metadataBase: new URL(SITIO),
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
  /**
   * ── LO QUE SE VE AL COMPARTIR UN LINK ───────────────────────────
   *
   * ⚠️ ESTE `title` LE GANA AL `title` DE CADA PÁGINA. Es la trampa que
   * hizo que compartir `/invitaciones` en Facebook mostrara «Bookea —
   * Reservá espacios y servicios en Costa Rica»: esa página declara su
   * `title` y su `description`, pero NO su `openGraph`, así que hereda
   * este bloque entero y el título de acá pisa al suyo.
   *
   * La regla, entonces: toda página que se comparta a propósito
   * —Invitaciones, Lealtad, un negocio— tiene que declarar su PROPIO
   * `openGraph`. Poner solo `title` no alcanza.
   *
   * El eslogan lo eligió el dueño (ago 2026). Va en VOSEO —«Convertí»,
   * no «Convierte»— porque es el trato que usa todo el sitio, y la
   * landing de Lealtad ya abre con la misma construcción («Convertí
   * compradores de un día en clientes de por vida»).
   *
   * La imagen no se declara acá: la pone `opengraph-image.tsx` de esta
   * misma carpeta, que Next enchufa por convención de nombre.
   */
  openGraph: {
    title: "Bookea — Convertí cada interacción en una experiencia",
    description:
      "Citas, eventos, hospedaje y experiencias en un solo lugar. Reservá directo, sin cadenas de WhatsApp.",
    locale: "es_CR",
    siteName: "Bookea",
    url: SITIO,
    type: "website",
  },
  twitter: {
    // `summary_large_image` y no `summary`: sin esto X/Twitter pinta la
    // imagen como una miniatura cuadrada al costado y se pierde el
    // eslogan, que es justamente lo que se quiere mostrar.
    card: "summary_large_image",
    title: "Bookea — Convertí cada interacción en una experiencia",
    description:
      "Citas, eventos, hospedaje y experiencias en un solo lugar. Reservá directo, sin cadenas de WhatsApp.",
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
