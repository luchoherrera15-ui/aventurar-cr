import type { Metadata } from "next";
import { SITIO } from "@/lib/sitio";
import { fraseDePrevia, previaDeTarjeta } from "@/lib/lealtad/previa-tarjeta";

/**
 * LOS METADATOS DE `/tarjeta/<negocio>` Y `/tarjeta/<negocio>/<llave>`.
 *
 * Es lo que WhatsApp, Instagram y Telegram muestran cuando un negocio
 * reenvía el link de su tarjeta. Antes no había nada acá y salían los
 * del sitio («Mirá todos los locales en Bookea»): ver
 * `src/lib/lealtad/previa-tarjeta.ts`.
 *
 * ── `title.absolute` Y `openGraph` PROPIOS, LAS DOS COSAS ──────────
 * El layout raíz tiene un `template` («%s | Bookea») y un bloque
 * `openGraph` que le gana al `title` de cada página (la trampa está
 * documentada en src/app/layout.tsx). Acá el título es absoluto —el
 * nombre del negocio, sin sufijo— y el `openGraph` se declara entero.
 * La imagen la pone `opengraph-image.tsx` de cada carpeta, por
 * convención de nombre.
 */
export async function metadataDeTarjeta(slug: string, llave: string | null): Promise<Metadata> {
  const url = `${SITIO}/tarjeta/${slug}${llave ? `/${llave}` : ""}`;
  const p = await previaDeTarjeta(slug, llave);
  if (!p) {
    const titulo = "Tarjeta de lealtad";
    return {
      title: { absolute: titulo },
      description: "Agregá tu tarjeta de lealtad al teléfono y sumá con cada visita.",
      openGraph: { title: titulo, description: "Agregá tu tarjeta de lealtad al teléfono y sumá con cada visita.", url, type: "website", locale: "es_CR" },
    };
  }

  const titulo = `${p.negocio.nombre} · Tarjeta de lealtad`;
  const descripcion = fraseDePrevia(p);
  return {
    title: { absolute: titulo },
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: descripcion,
      url,
      // El nombre del negocio y no «Bookea»: es SU link, no el nuestro.
      siteName: p.negocio.nombre,
      type: "website",
      locale: "es_CR",
    },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}
