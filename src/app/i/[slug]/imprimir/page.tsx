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

// Componer la hoja es una llamada larga al modelo (minutos, no
// segundos). Las server actions corren con el límite de la ruta que las
// invoca, así que sin esto la función se corta a la mitad y el error
// que ve el cliente no dice nada útil. Es el mismo tope que ya usa la
// generación de la invitación digital.
export const maxDuration = 300;

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
    .select("id, titulo, html_personalizado, html_impresion, cliente_id, es_ejemplo")
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

  // Las muestras del catálogo (slug "ejemplo-…") son copias de vitrina:
  // no tienen dueño ni pedido, así que no se imprimen. Se explica en
  // vez de tirar un 404 seco — a esta pantalla se llega escribiendo la
  // URL o desde el catálogo, y ahí un 404 parece que algo se rompió.
  if (invitacion.es_ejemplo && !esAdmin) {
    return (
      <Aviso
        titulo="Esta es una muestra del catálogo"
        cuerpo="Sirve para enseñar el diseño, así que no tiene dueño ni versión para imprimir. La invitación que se imprime es la tuya — la encontrás en Mis invitaciones, con el botón Imprimir al lado."
        accion={{ href: "/invitaciones#paquetes", texto: "Ver los paquetes" }}
      />
    );
  }
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
  //
  // Se busca por CLIENTE y no por `pedidos_invitacion.invitacion_id`:
  // esa columna existe desde la 0075 pero hoy no la escribe nadie — el
  // admin cambia el estado del pedido y nunca lo ata a la invitación
  // que produjo. Buscando por ahí, ningún cliente pasaría jamás y esto
  // solo funcionaría para el admin.
  //
  // La contra de buscar por cliente: quien compró un Plus alguna vez
  // puede imprimir también las invitaciones que pidió con otro paquete.
  // Es a favor del cliente y no cuesta nada, así que se prefiere eso
  // antes que dejar el beneficio inalcanzable. Cuando el admin empiece
  // a atar el pedido con su invitación, este filtro se puede apretar.
  let habilitada = esAdmin;
  if (!habilitada) {
    const { data: pedido } = await supabase
      .from("pedidos_invitacion")
      .select("id")
      .eq("cliente_id", user.id)
      .eq("paquete", "plus")
      .in("estado", PEDIDO_VIGENTE)
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
        invitacionId={invitacion.id as string}
        html={(invitacion.html_impresion as string | null) ?? null}
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
