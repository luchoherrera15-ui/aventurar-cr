import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import OfertaInvitacionCard from "@/components/oferta-invitacion-card";
import HiloChat from "./hilo-chat";
import BotonResuelto from "../boton-resuelto";
import type { Mensaje } from "@/app/mi-negocio/types";

type ReservaConRancho = {
  id: string;
  fecha: string;
  nombre: string | null;
  cliente_id: string | null;
  ranchos: { nombre: string; foto_url: string | null; owner_id: string } | null;
};

export default async function MensajesPage({
  params,
  searchParams,
}: {
  params: Promise<{ reservaId: string }>;
  searchParams: Promise<{ nueva?: string | string[] }>;
}) {
  const { reservaId } = await params;
  const { nueva } = await searchParams;
  const recienReservada = (Array.isArray(nueva) ? nueva[0] : nueva) === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const { data } = await supabase
    .from("reservas")
    .select("id, fecha, nombre, cliente_id, ranchos(nombre, foto_url, owner_id)")
    .eq("id", reservaId)
    .maybeSingle();

  const reserva = data as unknown as ReservaConRancho | null;
  if (!reserva || !reserva.ranchos) notFound();

  const esCliente = reserva.cliente_id === user.id;
  const esProveedor = reserva.ranchos.owner_id === user.id;
  if (!esCliente && !esProveedor) notFound();

  // Trae la conversación de esta reserva, o la abre si es la primera vez
  // que cualquiera de los dos le escribe al otro.
  let conversacionId: string;
  let resuelta = false;
  const { data: existente } = await supabase
    .from("conversaciones")
    .select("id, resuelta")
    .eq("reserva_id", reservaId)
    .maybeSingle();

  if (existente) {
    conversacionId = existente.id;
    resuelta = existente.resuelta;
  } else {
    const { data: creada, error } = await supabase
      .from("conversaciones")
      .insert({ reserva_id: reservaId })
      .select("id")
      .single();
    if (error) {
      // Carrera con la otra parte abriendo el hilo al mismo tiempo.
      const { data: reintento } = await supabase
        .from("conversaciones")
        .select("id, resuelta")
        .eq("reserva_id", reservaId)
        .maybeSingle();
      if (!reintento) notFound();
      conversacionId = reintento.id;
      resuelta = reintento.resuelta;
    } else {
      conversacionId = creada.id;
    }
  }

  const { data: mensajesData } = await supabase
    .from("mensajes")
    .select("id, conversacion_id, autor_id, texto, created_at")
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: true });

  // El nombre de perfiles está protegido por RLS (solo se ve el propio):
  // esta vista lo destraba SOLO para con quién ya estás chateando.
  const { data: contacto } = await supabase
    .from("conversaciones_contacto")
    .select("nombre_contacto")
    .eq("conversacion_id", conversacionId)
    .maybeSingle();

  // Marca todo como leído hasta ahora — la próxima vez que entre acá,
  // solo cuentan como no leídos los mensajes posteriores a esto.
  await supabase.from("conversacion_lecturas").upsert(
    { conversacion_id: conversacionId, usuario_id: user.id, leido_hasta: new Date().toISOString() },
    { onConflict: "conversacion_id,usuario_id" },
  );

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
            className="h-11 w-11 shrink-0 rounded-full bg-cover bg-center bg-aventurea-cream-2"
            style={
              reserva.ranchos.foto_url
                ? { backgroundImage: `url(${reserva.ranchos.foto_url})` }
                : undefined
            }
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-aventurea-ink">
              {esCliente
                ? reserva.ranchos.nombre
                : reserva.nombre || contacto?.nombre_contacto || "Cliente"}
            </p>
            <p className="truncate text-[12px] text-aventurea-ink-soft">
              {reserva.ranchos.nombre} · {reserva.fecha}
            </p>
          </div>
          <BotonResuelto conversacionId={conversacionId} resuelta={resuelta} variante="cabecera" />
        </div>

        {/* Recién reservado (viene con ?nueva=1): la oferta de la
            invitación digital, solo para el cliente. */}
        {recienReservada && esCliente && <OfertaInvitacionCard className="mb-3" />}

        <HiloChat
          conversacionId={conversacionId}
          miId={user.id}
          mensajesIniciales={(mensajesData ?? []) as Mensaje[]}
        />
      </section>
    </div>
  );
}
