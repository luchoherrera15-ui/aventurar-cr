import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import InvitacionesPanel, { type InvitacionAdmin } from "./invitaciones-panel";

type FilaInvitacion = Omit<
  InvitacionAdmin,
  "clienteCorreo" | "confirmadosSi" | "confirmadosNo" | "totalPersonas"
> & { cliente_id: string | null };

type FilaRsvp = { invitacion_id: string; asistira: boolean; acompanantes: number };

/**
 * Invitaciones digitales: las vende Bookea, así que acá se crean, se
 * asignan al cliente por correo y se sigue el pulso de confirmaciones.
 * Se lee con la llave de servicio para ver también borradores y
 * archivadas (la política pública solo muestra las activas).
 */
export default async function AdminInvitacionesPage() {
  const admin = createAdminClient();

  if (!admin) {
    return (
      <div>
        <Encabezado total={0} activas={0} />
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{FALTA_SERVICE_KEY}</p>
      </div>
    );
  }

  const [invRes, rsvpRes, perfilesRes] = await Promise.all([
    admin
      .from("invitaciones")
      .select(
        "id, slug, titulo, anfitriones, mensaje, fecha_evento, hora, lugar_nombre, direccion, maps_url, portada_url, html_personalizado, tema, estado, cliente_id",
      )
      .order("created_at", { ascending: false }),
    admin.from("invitacion_rsvp").select("invitacion_id, asistira, acompanantes"),
    admin.from("perfiles").select("id, email"),
  ]);

  const emailPorId = new Map(
    (perfilesRes.data ?? []).map((p) => [p.id as string, p.email as string | null]),
  );

  // El resumen por invitación: cuántos dijeron sí / no, y cuántas
  // personas llegan en total (cada "sí" cuenta con sus acompañantes).
  const resumen = new Map<string, { si: number; no: number; personas: number }>();
  for (const r of (rsvpRes.data ?? []) as FilaRsvp[]) {
    const acc = resumen.get(r.invitacion_id) ?? { si: 0, no: 0, personas: 0 };
    if (r.asistira) {
      acc.si += 1;
      acc.personas += 1 + (r.acompanantes ?? 0);
    } else {
      acc.no += 1;
    }
    resumen.set(r.invitacion_id, acc);
  }

  const invitaciones: InvitacionAdmin[] = ((invRes.data ?? []) as FilaInvitacion[]).map(
    (i) => {
      const conteo = resumen.get(i.id) ?? { si: 0, no: 0, personas: 0 };
      return {
        ...i,
        clienteCorreo: i.cliente_id ? (emailPorId.get(i.cliente_id) ?? null) : null,
        confirmadosSi: conteo.si,
        confirmadosNo: conteo.no,
        totalPersonas: conteo.personas,
      };
    },
  );

  const activas = invitaciones.filter((i) => i.estado === "activa").length;

  return (
    <div>
      <Encabezado total={invitaciones.length} activas={activas} />
      {invRes.error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las invitaciones: {invRes.error.message}
        </p>
      )}
      <InvitacionesPanel invitaciones={invitaciones} />
    </div>
  );
}

function Encabezado({ total, activas }: { total: number; activas: number }) {
  return (
    <div className="mb-6">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Producto propio
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Invitaciones digitales</h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        {total} en total · {activas} activa{activas === 1 ? "" : "s"}. Se crean acá, se
        asignan al cliente y él comparte su link /i/….
      </p>
    </div>
  );
}
