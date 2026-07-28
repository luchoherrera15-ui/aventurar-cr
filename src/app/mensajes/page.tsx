import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import ListaConversaciones, {
  type FilaConversacion,
} from "./lista-conversaciones";

/**
 * Bandeja de entrada tipo Airbnb: todas las conversaciones de la
 * persona (como cliente y como proveedor, mezcladas), ordenadas por
 * actividad, con el último mensaje y cuántos hay sin leer. Cada hilo
 * sigue viviendo en /mensajes/[reservaId].
 */

type ConversacionRow = {
  id: string;
  reserva_id: string;
  cliente_id: string;
  proveedor_id: string;
  created_at: string;
  ranchos: { nombre: string; foto_url: string | null } | null;
  reservas: { fecha: string; nombre: string | null } | null;
};

type MensajeMin = {
  conversacion_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

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
      "id, reserva_id, cliente_id, proveedor_id, created_at, ranchos(nombre, foto_url), reservas(fecha, nombre)",
    );

  const conversaciones = (convData ?? []) as unknown as ConversacionRow[];
  const ids = conversaciones.map((c) => c.id);

  const [{ data: mensajesData }, { data: lecturasData }] = ids.length
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
      ])
    : [{ data: [] }, { data: [] }];

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
        reservaId: c.reserva_id,
        // Como cliente hablás "con el negocio"; como proveedor, con la
        // persona que reservó (su nombre viene de la propia reserva).
        titulo: soyCliente
          ? (c.ranchos?.nombre ?? "Conversación")
          : c.reservas?.nombre || "Cliente",
        subtitulo: [
          !soyCliente ? c.ranchos?.nombre : null,
          c.reservas?.fecha ? `Evento: ${c.reservas.fecha}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        foto: c.ranchos?.foto_url ?? null,
        ultimoTexto: ult
          ? `${ult.autor_id === user.id ? "Vos: " : ""}${ult.texto}`
          : "Sin mensajes todavía — escribí el primero.",
        actividad: ult?.created_at ?? c.created_at,
        pendientes: sinLeer.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => (a.actividad < b.actividad ? 1 : -1));

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Mensajes" />

      <section className="mx-auto max-w-[720px] px-6 py-10">
        <h1 className="text-2xl font-bold text-aventurea-orange-dark">Mensajes</h1>
        <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
          Todas tus conversaciones de reservas y cotizaciones, en un solo lugar.
        </p>

        <ListaConversaciones filas={filas} />
      </section>
    </div>
  );
}
