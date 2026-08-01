import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VistaImpresion from "./vista-impresion";

/**
 * La invitación para imprimir — un extra del paquete Plus.
 *
 * No es un diseño aparte: es el MISMO HTML de la invitación en línea,
 * servido en una pantalla sin animaciones y con `@page` puesto, para
 * que el navegador lo guarde como PDF en Carta o A4. Así el papel sale
 * idéntico a lo que el cliente aprobó, sin mantener dos diseños.
 *
 * Quién entra: el dueño de la invitación o un admin (que la produce
 * para el cliente). Nunca los invitados — el link público es /i/[slug].
 */

export const metadata: Metadata = {
  title: "Invitación para imprimir",
  robots: { index: false },
};

/** Los estados de pedido en los que el paquete ya está pagado. */
const PEDIDO_VIGENTE = ["pagado", "en_diseno", "entregado"];

export default async function ImprimirInvitacionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/cuenta?redirect=/i/${slug}/imprimir`);

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, titulo, html_personalizado, cliente_id, es_ejemplo")
    .eq("slug", slug)
    .eq("estado", "activa")
    .maybeSingle();
  if (!invitacion) notFound();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  const esAdmin = perfil?.rol === "admin";

  // Las muestras del catálogo no se imprimen: son de nadie.
  if (invitacion.es_ejemplo && !esAdmin) notFound();
  if (invitacion.cliente_id !== user.id && !esAdmin) notFound();

  // Sin diseño propio no hay nada que llevar a papel: la plantilla
  // clásica se arma en pantalla con secciones a altura completa y en
  // hoja quedaría media página en blanco por sección.
  if (!invitacion.html_personalizado) {
    return (
      <Aviso
        titulo="Esta invitación todavía no tiene diseño propio"
        cuerpo="La versión para imprimir sale del diseño a la medida. En cuanto tu invitación tenga el suyo, acá vas a poder descargarla."
      />
    );
  }

  // El paquete vive en el pedido, no en la invitación. El admin no pasa
  // por acá: él la produce para el cliente.
  let habilitada = esAdmin;
  if (!habilitada) {
    const { data: pedido } = await supabase
      .from("pedidos_invitacion")
      .select("paquete, estado")
      .eq("invitacion_id", invitacion.id)
      .in("estado", PEDIDO_VIGENTE)
      .eq("paquete", "plus")
      .limit(1)
      .maybeSingle();
    habilitada = Boolean(pedido);
  }

  if (!habilitada) {
    return (
      <Aviso
        titulo="La invitación impresa viene con el paquete Plus"
        cuerpo="Es la misma invitación que ya tenés, preparada para papel en tamaño Carta o A4 — lista para llevar a imprimir o mandar por WhatsApp como PDF."
        accion={{ href: "/invitaciones#paquetes", texto: "Ver el paquete Plus" }}
      />
    );
  }

  return (
    <main className="min-h-svh bg-white">
      <VistaImpresion
        html={invitacion.html_personalizado}
        titulo={invitacion.titulo ?? "Tu invitación"}
      />
    </main>
  );
}

function Aviso({
  titulo,
  cuerpo,
  accion,
}: {
  titulo: string;
  cuerpo: string;
  accion?: { href: string; texto: string };
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <h1 className="titulo text-[22px] text-aventurea-ink">{titulo}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-aventurea-ink-soft">{cuerpo}</p>
      {accion && (
        <Link
          href={accion.href}
          className="mt-6 rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
        >
          {accion.texto}
        </Link>
      )}
      <Link
        href="/cuenta/invitaciones"
        className="mt-4 text-[13px] font-bold text-aventurea-navy hover:underline"
      >
        Volver a mis invitaciones
      </Link>
    </main>
  );
}
