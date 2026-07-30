import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import ReservasTabs, { type ReservaCliente, type ResenaPropia } from "../reservas-tabs";
import { hoyISOCR } from "@/lib/fechas";

export const metadata: Metadata = {
  title: "Tus reservas",
  robots: { index: false },
};

/**
 * Las reservas del cliente en su propia página (antes vivían dentro de
 * /cuenta): las tabs Activas/Historial con la reseña habilitada cuando
 * el evento ya pasó. El perfil quedó como tablero de cards y esta es
 * la card "Tus reservas" abierta.
 */
export default async function CuentaReservasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const [{ data: reservasData }, { data: resenasData }] = await Promise.all([
    supabase
      .from("reservas")
      .select(
        "id, fecha, estado, monto_total, horario_bloque, rancho_id, ranchos(nombre, foto_url, categoria, slug)",
      )
      .eq("cliente_id", user.id)
      // Incluye los estados de citas (0061): una cita cumplida sigue
      // siendo historial del cliente, no puede desaparecer.
      .in("estado", [
        "pendiente",
        "confirmada",
        "rechazada",
        "cumplida",
        "no_asistio",
        "cancelada",
      ])
      .order("fecha", { ascending: false }),
    supabase
      .from("resenas")
      .select("reserva_id, calificacion, comentario")
      .eq("cliente_id", user.id),
  ]);

  const reservas = (reservasData ?? []) as unknown as ReservaCliente[];
  const resenasPorReserva: Record<string, ResenaPropia> = Object.fromEntries(
    ((resenasData ?? []) as ResenaPropia[]).map((r) => [r.reserva_id, r]),
  );

  const hoy = hoyISOCR();
  // Activas = por venir y aún en juego; todo estado final (rechazada,
  // cumplida, no asistió, cancelada) vive en el historial aunque la
  // fecha sea hoy.
  const FINALES = new Set(["rechazada", "cumplida", "no_asistio", "cancelada"]);
  const activas = reservas.filter((r) => !FINALES.has(r.estado) && r.fecha >= hoy);
  const historial = reservas.filter((r) => FINALES.has(r.estado) || r.fecha < hoy);

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Tus reservas" ancho="max-w-[720px]" />
      <main className="mx-auto max-w-[720px] px-6 py-8">
        <Link
          href="/cuenta"
          className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Volver a tu cuenta
        </Link>

        <ReservasTabs activas={activas} historial={historial} resenas={resenasPorReserva} hoy={hoy} />
      </main>
    </div>
  );
}
