import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import HiloChat from "../../[reservaId]/hilo-chat";
import BotonResuelto from "../../boton-resuelto";
import type { Mensaje } from "@/app/mi-negocio/types";

type ConversacionRow = {
  id: string;
  reserva_id: string | null;
  cliente_id: string;
  proveedor_id: string;
  resuelta: boolean;
  ranchos: { id: string; nombre: string; foto_url: string | null; slug: string | null } | null;
};

/**
 * El hilo por id de conversación — lo usan las consultas (que no
 * tienen reserva) desde cualquiera de los dos lados. Los hilos de
 * reserva siguen viviendo en /mensajes/[reservaId].
 */
export default async function HiloConsultaPage({
  params,
}: {
  params: Promise<{ conversacionId: string }>;
}) {
  const { conversacionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  // RLS ya limita a los participantes; si no es tuya, no existe.
  const { data } = await supabase
    .from("conversaciones")
    .select("id, reserva_id, cliente_id, proveedor_id, resuelta, ranchos(id, nombre, foto_url, slug)")
    .eq("id", conversacionId)
    .maybeSingle();

  const conversacion = data as unknown as ConversacionRow | null;
  if (!conversacion || !conversacion.ranchos) notFound();

  // Un hilo con reserva tiene su propia página, con más contexto.
  if (conversacion.reserva_id) redirect(`/mensajes/${conversacion.reserva_id}`);

  const esCliente = conversacion.cliente_id === user.id;

  const { data: mensajesData } = await supabase
    .from("mensajes")
    .select("id, conversacion_id, autor_id, texto, created_at")
    .eq("conversacion_id", conversacion.id)
    .order("created_at", { ascending: true });

  // El nombre de perfiles está protegido por RLS (solo se ve el propio):
  // esta vista lo destraba SOLO para con quién ya estás chateando — acá
  // es donde antes se veía siempre "Cliente interesado".
  const { data: contacto } = await supabase
    .from("conversaciones_contacto")
    .select("nombre_contacto")
    .eq("conversacion_id", conversacion.id)
    .maybeSingle();

  await supabase.from("conversacion_lecturas").upsert(
    {
      conversacion_id: conversacion.id,
      usuario_id: user.id,
      leido_hasta: new Date().toISOString(),
    },
    { onConflict: "conversacion_id,usuario_id" },
  );

  const rancho = conversacion.ranchos;

  return (
    <div className="flex min-h-screen flex-col bg-aventurea-cream">
      <SiteHeader breadcrumb="Mensajes" />
      <section className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 py-6">
        <Link
          href="/mensajes"
          className="mb-3 text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Todos tus mensajes
        </Link>
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-3">
          <div
            className="h-11 w-11 shrink-0 rounded-full bg-aventurea-cream-2 bg-cover bg-center"
            style={
              rancho.foto_url ? { backgroundImage: `url(${rancho.foto_url})` } : undefined
            }
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-aventurea-ink">
              {esCliente ? rancho.nombre : contacto?.nombre_contacto || "Cliente interesado"}
            </p>
            <p className="truncate text-[12px] text-aventurea-ink-soft">
              Consulta directa · {rancho.nombre}
            </p>
          </div>
          {esCliente && (
            <Link
              href={rancho.slug ? `/${rancho.slug}` : `/eventos/${rancho.id}`}
              className="shrink-0 rounded-lg border border-aventurea-line px-3 py-1.5 text-[12px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              Ver página
            </Link>
          )}
          <BotonResuelto
            conversacionId={conversacion.id}
            resuelta={conversacion.resuelta}
            variante="cabecera"
          />
        </div>

        <HiloChat
          conversacionId={conversacion.id}
          miId={user.id}
          mensajesIniciales={(mensajesData ?? []) as Mensaje[]}
        />
      </section>
    </div>
  );
}
