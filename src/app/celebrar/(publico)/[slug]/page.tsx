import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import RenderInvitacion from "@/components/celebrar/invitacion/render-invitacion";
import { partnerDeCelebracion, urlDePartner } from "@/lib/celebrar/partners";
import { urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { MARCA, tipoCelebracion } from "@/lib/celebrar/marca";
import { PREFIJO_CELEBRAR } from "@/lib/celebrar/rutas";
import { fechaLargaCR } from "@/lib/fechas";
import { invitacionPublicaPorSlug } from "./datos-publicos";

/**
 * bookea.lat/celebrar/<slug> — y mañana celebrar.lat/<slug>: la invitación
 * que la persona comparte por WhatsApp. Estática con revalidación cada
 * minuto (como /i/[slug] del producto viejo): el peor caso es que un
 * cambio tarde 60 s en verse, y a cambio la página sale del borde.
 */
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const inv = await invitacionPublicaPorSlug(slug);
  if (!inv) return { title: "Invitación", robots: { index: false } };
  const tipo = tipoCelebracion(inv.tipo)?.nombre ?? "Celebración";
  const cuando = inv.fecha ? fechaLargaCR(inv.fecha) : null;
  const descripcion = [tipo, cuando, inv.lugar_nombre].filter(Boolean).join(" · ") || MARCA.claim;
  const url = urlPublicaCelebrar(`/${inv.slug}`);
  return {
    title: { absolute: `${inv.nombre} · ${MARCA.nombre}` },
    description: descripcion,
    alternates: { canonical: url },
    openGraph: { title: inv.nombre, description: descripcion, url, type: "website", siteName: MARCA.nombre, locale: "es_CR" },
    twitter: { card: "summary_large_image", title: inv.nombre, description: descripcion },
    robots: { index: true, follow: false },
  };
}

export default async function InvitacionPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inv = await invitacionPublicaPorSlug(slug);
  if (!inv) notFound();
  // Un link viejo (la celebración se renombró): al nuevo, para siempre.
  if (!inv.slug_actual) permanentRedirect(`${PREFIJO_CELEBRAR}/${inv.slug}`);
  // La firma del partner que la diseñó (si está aprobado y quiere firmarla).
  const partner = await partnerDeCelebracion(inv.slug);

  return (
    <RenderInvitacion
      documento={inv.documento}
      celebracion={{
        nombre: inv.nombre,
        fecha: inv.fecha,
        hora: inv.hora,
        lugarNombre: inv.lugar_nombre,
        direccion: inv.direccion,
        mapsUrl: inv.maps_url,
        slug: inv.slug,
        partner: partner ? { nombre: partner.nombre_comercial, url: urlDePartner(partner), logoUrl: partner.logo_url } : null,
      }}
      className="min-h-screen"
      escenario
      apertura
    />
  );
}
