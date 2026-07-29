import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import ListaConversaciones, {
  type FilaConversacion,
  type TagChat,
} from "./lista-conversaciones";

/**
 * Bandeja de entrada tipo Airbnb: todas las conversaciones de la
 * persona (como cliente y como proveedor, mezcladas), ordenadas por
 * actividad, con el último mensaje y cuántos hay sin leer. Cada hilo
 * sigue viviendo en /mensajes/[reservaId].
 */

type ConversacionRow = {
  id: string;
  reserva_id: string | null;
  cliente_id: string;
  proveedor_id: string;
  created_at: string;
  resuelta: boolean;
  ranchos: { nombre: string; foto_url: string | null } | null;
  reservas: { fecha: string; nombre: string | null; estado: string } | null;
};

type MensajeMin = {
  conversacion_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

/** Qué es este chat, de un vistazo: una reserva real (y en qué estado
 * va) o una consulta que todavía puede convertirse en una. Mismo
 * criterio que la app (mobile/src/pantallas/mensajes.tsx). */
function tagDeChat(c: ConversacionRow): TagChat {
  if (!c.reserva_id) return { texto: "Posible reserva", clase: "bg-aventurea-navy/10 text-aventurea-navy" };
  if (c.reservas?.estado === "confirmada") {
    return { texto: "Reserva confirmada", clase: "bg-aventurea-green/10 text-aventurea-green" };
  }
  if (c.reservas?.estado === "rechazada") {
    return { texto: "Reserva rechazada", clase: "bg-red-100 text-red-700" };
  }
  return { texto: "Nueva reserva", clase: "bg-aventurea-orange/10 text-aventurea-orange" };
}

export default async function BandejaMensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  // RLS ya limita esto a las conversaciones donde participo.
  const { data: convData } = await supabase
    .from("conversaciones")
    .select(
      "id, reserva_id, cliente_id, proveedor_id, created_at, resuelta, ranchos(nombre, foto_url), reservas(fecha, nombre, estado)",
    );

  const conversaciones = (convData ?? []) as unknown as ConversacionRow[];
  const ids = conversaciones.map((c) => c.id);

  const [{ data: mensajesData }, { data: lecturasData }, { data: contactosData }] = ids.length
    ? await Promise.all([
        supabase
          .from("mensajes")
          .select("conversacion_id, autor_id, texto, created_at")
          .in("conversacion_id", ids)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("conversacion_lecturas")
          .select("conversacion_id, leido_hasta")
          .eq("usuario_id", user.id),
        // El nombre (o correo) de la otra persona, para las consultas
        // directas que todavía no tienen una reserva de dónde sacarlo.
        supabase.from("conversaciones_contacto").select("conversacion_id, nombre_contacto"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const contactoPorConversacion = new Map<string, string>(
    ((contactosData ?? []) as { conversacion_id: string; nombre_contacto: string | null }[])
      .filter((c) => !!c.nombre_contacto)
      .map((c) => [c.conversacion_id, c.nombre_contacto as string]),
  );

  const leidoHasta = new Map<string, string>(
    ((lecturasData ?? []) as { conversacion_id: string; leido_hasta: string }[]).map(
      (l) => [l.conversacion_id, l.leido_hasta],
    ),
  );

  // Los mensajes vienen del más nuevo al más viejo: el primero que se ve
  // de cada conversación es su último mensaje.
  const ultimo = new Map<string, MensajeMin>();
  const sinLeer = new Map<string, number>();
  for (const m of (mensajesData ?? []) as MensajeMin[]) {
    if (!ultimo.has(m.conversacion_id)) ultimo.set(m.conversacion_id, m);
    const marca = leidoHasta.get(m.conversacion_id);
    if (m.autor_id !== user.id && (!marca || m.created_at > marca)) {
      sinLeer.set(m.conversacion_id, (sinLeer.get(m.conversacion_id) ?? 0) + 1);
    }
  }

  const filas: FilaConversacion[] = conversaciones
    .map((c) => {
      const soyCliente = c.cliente_id === user.id;
      const ult = ultimo.get(c.id) ?? null;
      return {
        id: c.id,
        href: c.reserva_id ? `/mensajes/${c.reserva_id}` : `/mensajes/hilo/${c.id}`,
        // Como cliente hablás "con el negocio"; como proveedor, con la
        // persona que reservó (su nombre viene de la propia reserva) o,
        // si es una consulta sin reserva todavía, con lo que devuelva
        // conversaciones_contacto — nunca un genérico si hay con qué.
        titulo: soyCliente
          ? (c.ranchos?.nombre ?? "Conversación")
          : c.reservas?.nombre || contactoPorConversacion.get(c.id) || "Cliente interesado",
        subtitulo: [
          !soyCliente ? c.ranchos?.nombre : null,
          c.reserva_id
            ? c.reservas?.fecha
              ? `Evento: ${c.reservas.fecha}`
              : null
            : "Consulta directa",
        ]
          .filter(Boolean)
          .join(" · "),
        foto: c.ranchos?.foto_url ?? null,
        ultimoTexto: ult
          ? `${ult.autor_id === user.id ? "Vos: " : ""}${ult.texto}`
          : "Sin mensajes todavía — escribí el primero.",
        actividad: ult?.created_at ?? c.created_at,
        pendientes: sinLeer.get(c.id) ?? 0,
        resuelta: c.resuelta,
        tag: tagDeChat(c),
      };
    })
    .sort((a, b) => (a.actividad < b.actividad ? 1 : -1));

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Mensajes" />

      <section className="mx-auto max-w-[720px] px-6 py-10">
        <h1 className="text-2xl font-bold text-aventurea-ink">Mensajes</h1>
        <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
          Todas tus conversaciones de reservas y cotizaciones, en un solo lugar.
        </p>

        <ListaConversaciones filas={filas} />
      </section>
    </div>
  );
}
