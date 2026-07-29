import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISOCR } from "@/lib/fechas";
import { horarioDeDetalles } from "@/app/citas/tipos";
import EquipoPanel from "./equipo-panel";
import HorarioForm from "./horario-form";
import AgendaCitas, { type CitaDia } from "./agenda-citas";
import type { MiembroEquipo } from "./actions";

/**
 * La configuración de Citas del panel del proveedor: el equipo que
 * atiende, el horario semanal y la agenda del día. Solo existe para
 * los negocios con vertical 'citas'; el resto del panel (publicación,
 * servicios, cobros) sigue viviendo en /mi-rancho/[id].
 */
export default async function CitasConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, owner_id, nombre, detalles, vertical")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  // Mismo control de acceso que el panel: el dueño siempre, y un admin
  // que entra a ayudar en nombre del proveedor.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  if (rancho.owner_id !== user.id && perfil?.rol !== "admin") notFound();

  // Esta pantalla es solo de la vertical de citas.
  if (rancho.vertical !== "citas") redirect(`/mi-rancho/${id}`);

  const hoy = hoyISOCR();
  const [equipoRes, citasRes] = await Promise.all([
    supabase
      .from("equipo_rancho")
      .select("*")
      .eq("rancho_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    // La agenda de hoy: la primera carga sale del servidor y el cambio
    // de fecha se consulta desde el navegador (RLS limita al dueño).
    supabase
      .from("reservas")
      .select("id, hora_inicio, duracion_minutos, miembro_id, nombre, tipo_evento, estado")
      .eq("rancho_id", id)
      .eq("fecha", hoy)
      .not("hora_inicio", "is", null)
      .neq("estado", "temporal")
      .order("hora_inicio", { ascending: true }),
  ]);

  const equipo = (equipoRes.data ?? []) as MiembroEquipo[];
  const citasHoy = (citasRes.data ?? []) as CitaDia[];
  const horario = horarioDeDetalles(rancho.detalles);
  const errorCarga = equipoRes.error ?? citasRes.error;

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-12">
      <Link
        href={`/mi-rancho/${rancho.id}`}
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver al panel de {rancho.nombre}
      </Link>

      <h1 className="mt-4 text-[22px] font-bold text-aventurea-ink">Citas</h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Tu equipo, tu horario semanal y la agenda del día. Con esto
        configurado, el cliente reserva su cita en línea y queda
        confirmada al instante.
      </p>

      {errorCarga && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
          <strong>Faltan las migraciones.</strong> No se pudo leer la
          configuración de citas: {errorCarga.message}. Corré{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
            supabase/aplicar-migraciones-pendientes.sql
          </code>{" "}
          en el SQL Editor de Supabase y volvé a entrar.
        </div>
      )}

      <div className="mt-8 flex flex-col gap-10">
        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">El equipo</h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Las personas que atienden. El cliente elige con quién quiere su
            cita — o &quot;cualquiera&quot; y se le asigna la primera persona
            libre. Se muestran con foto en tu página pública.
          </p>
          <EquipoPanel ranchoId={rancho.id} initialEquipo={equipo} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
            Horario semanal
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Qué días abrís y de qué hora a qué hora. Las citas solo se pueden
            reservar dentro de este horario.
          </p>
          <HorarioForm ranchoId={rancho.id} initialHorario={horario} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
            Agenda del día
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Las citas de la fecha que elijás, en orden de hora.
          </p>
          <AgendaCitas
            ranchoId={rancho.id}
            equipo={equipo.map((m) => ({ id: m.id, nombre: m.nombre }))}
            initialFecha={hoy}
            initialCitas={citasHoy}
          />
        </section>
      </div>
    </main>
  );
}
