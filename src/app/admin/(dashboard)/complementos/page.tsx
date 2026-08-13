import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { ADDONS, estadoDeAddon } from "@/lib/addons";
import { SECCION_LABEL, type SeccionAdmin } from "../vertical";
import { seccionActiva } from "../vertical-server";
import ComplementosPanel, {
  type FilaAddon,
  type NegocioConAddons,
} from "./complementos-panel";
import SolicitudesPanel, { type SolicitudPendiente } from "./solicitudes-panel";
import NegociosRevisionPanel, { type NegocioEnRevision } from "./negocios-revision-panel";

/**
 * Complementos: qué tiene contratado cada negocio, a quién se le venció
 * y el control para activarlo o quitarlo a mano.
 *
 * Mientras no exista la pasarela de pago, esta pantalla ES el cobro —
 * se enciende cuando el negocio paga y la nota deja el registro de por
 * qué. La escritura va por server actions con la llave de servicio:
 * `addons_negocio` no le da política de escritura a nadie más (0077).
 */
export default async function AdminComplementosPage() {
  const admin = createAdminClient();
  const seccion = await seccionActiva();

  if (!admin) {
    return (
      <div>
        <Encabezado seccion={seccion} activos={0} vencidos={0} />
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{FALTA_SERVICE_KEY}</p>
      </div>
    );
  }

  const [ranchosRes, addonsRes, programasRes, miembrosRes, solicitudesRes] = await Promise.all([
    // `select *`: lealtad_aprobado_en es de la 0129 y puede faltar —
    // con un select explícito la página entera se caería.
    admin.from("ranchos").select("*").order("nombre"),
    admin.from("addons_negocio").select("rancho_id, addon, activo, vence_en, notas, activado_en"),
    // El programa de lealtad de cada negocio, para poder contar sus
    // miembros contra el tope del plan.
    admin.from("programa_lealtad").select("id, rancho_id"),
    admin.from("miembros").select("programa_id"),
    // La cola de solicitudes del plan (0126). Si la migración no corrió,
    // viene con error y la bandeja simplemente no se muestra.
    admin
      .from("solicitudes_lealtad")
      .select("*")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: true }),
  ]);

  // Cuántos miembros lleva cada negocio. El tope NO se guarda: sale de
  // la definición del plan (0124) y se compara contra esta cuenta.
  const programaDeRancho = new Map<string, string>();
  for (const p of (programasRes.data ?? []) as { id: string; rancho_id: string }[]) {
    programaDeRancho.set(p.rancho_id, p.id);
  }
  const miembrosPorPrograma = new Map<string, number>();
  for (const m of (miembrosRes.data ?? []) as { programa_id: string }[]) {
    miembrosPorPrograma.set(m.programa_id, (miembrosPorPrograma.get(m.programa_id) ?? 0) + 1);
  }

  const porRancho = new Map<string, FilaAddon[]>();
  for (const a of (addonsRes.data ?? []) as FilaAddon[]) {
    porRancho.set(a.rancho_id, [...(porRancho.get(a.rancho_id) ?? []), a]);
  }

  const negocios: NegocioConAddons[] = (
    (ranchosRes.data ?? []) as {
      id: string;
      nombre: string;
      slug: string | null;
      vertical: string | null;
      estado: string | null;
      plan_lealtad: string | null;
    }[]
  )
    // NO se filtra por sección acá: se le pasan todos al panel, que
    // aplica la sección como filtro VISIBLE y la ignora al buscar.
    // Filtrarlos en el servidor dejaba a un negocio invisible en la
    // única pantalla desde la que se le puede vender el primer plan, y
    // sin ninguna pista de que estaba escondido.
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      slug: r.slug,
      vertical: r.vertical,
      estado: r.estado,
      addons: porRancho.get(r.id) ?? [],
      planLealtad: r.plan_lealtad ?? null,
      miembros: miembrosPorPrograma.get(programaDeRancho.get(r.id) ?? "") ?? 0,
    }));

  // La bandeja de negocios EN REVISIÓN (0129): creados pero sin el
  // visto bueno. Si la columna no existe todavía, no hay bandeja.
  type FilaRanchoAdmin = {
    id: string;
    nombre: string;
    vertical: string | null;
    owner_id: string;
    created_at?: string | null;
    lealtad_aprobado_en?: string | null;
  };
  const filasRancho = (ranchosRes.data ?? []) as FilaRanchoAdmin[];
  const enRevision = filasRancho.filter(
    (r) => "lealtad_aprobado_en" in r && r.lealtad_aprobado_en === null,
  );
  const duenosRevision = [...new Set(enRevision.map((r) => r.owner_id))];
  const { data: perfilesDuenos } = duenosRevision.length
    ? await admin.from("perfiles").select("id, nombre, email").in("id", duenosRevision)
    : { data: [] };
  const duenoDe = new Map(
    ((perfilesDuenos ?? []) as { id: string; nombre: string | null; email: string | null }[]).map(
      (p) => [p.id, p],
    ),
  );
  const FECHA_REV = new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Costa_Rica",
  });
  const negociosEnRevision: NegocioEnRevision[] = enRevision.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    vertical: r.vertical,
    creador: (duenoDe.get(r.owner_id)?.nombre ?? "").trim() || "(sin nombre)",
    correo: duenoDe.get(r.owner_id)?.email ?? "—",
    fecha: r.created_at ? FECHA_REV.format(new Date(r.created_at)) : "—",
  }));

  // La bandeja de solicitudes, con el solicitante ya resuelto a nombre
  // y correo (perfiles guarda los dos).
  const filasSolicitud = (solicitudesRes.data ?? []) as {
    id: string;
    /** null = solicitud de ALTA (0130): el negocio se crea al aprobar. */
    rancho_id: string | null;
    solicitante_id: string;
    plan: string;
    telefono: string | null;
    mensaje: string | null;
    created_at: string;
    /** 0128; ausentes si esa migración no corrió. */
    metodo_pago?: string | null;
    comprobante_url?: string | null;
    /** 0130. */
    negocio_nombre?: string | null;
    negocio_vertical?: string | null;
  }[];
  const idsSolicitantes = [...new Set(filasSolicitud.map((s) => s.solicitante_id))];
  const { data: perfilesSol } = idsSolicitantes.length
    ? await admin.from("perfiles").select("id, nombre, email").in("id", idsSolicitantes)
    : { data: [] };
  const perfilDe = new Map(
    ((perfilesSol ?? []) as { id: string; nombre: string | null; email: string | null }[]).map(
      (p) => [p.id, p],
    ),
  );
  const nombreRancho = new Map(
    ((ranchosRes.data ?? []) as { id: string; nombre: string }[]).map((r) => [r.id, r.nombre]),
  );
  const FECHA_SOL = new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Costa_Rica",
  });
  const solicitudes: SolicitudPendiente[] = filasSolicitud.map((s) => ({
    id: s.id,
    ranchoId: s.rancho_id,
    negocio: s.rancho_id
      ? (nombreRancho.get(s.rancho_id) ?? "(negocio)")
      : (s.negocio_nombre ?? "(negocio nuevo)"),
    esAlta: !s.rancho_id,
    tipoNegocio: s.negocio_vertical ?? null,
    plan: s.plan,
    solicitante: (perfilDe.get(s.solicitante_id)?.nombre ?? "").trim() || "(sin nombre)",
    correo: perfilDe.get(s.solicitante_id)?.email ?? "—",
    telefono: s.telefono,
    mensaje: s.mensaje,
    metodoPago: s.metodo_pago ?? null,
    comprobanteUrl: s.comprobante_url ?? null,
    fecha: FECHA_SOL.format(new Date(s.created_at)),
  }));

  // Los contadores se calculan sobre lo que se ve, no sobre la tabla
  // entera: si el conmutador está en "Citas", los números son de Citas.
  let activos = 0;
  let vencidos = 0;
  for (const n of negocios) {
    for (const a of n.addons) {
      const estado = estadoDeAddon(a);
      if (estado === "activo") activos += 1;
      if (estado === "vencido") vencidos += 1;
    }
  }

  return (
    <div>
      <Encabezado seccion={seccion} activos={activos} vencidos={vencidos} />

      {addonsRes.error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los complementos: {addonsRes.error.message}. Si dice que
          la tabla no existe, falta correr <strong>0077_importar_agenda.sql</strong>.
        </p>
      )}

      <NegociosRevisionPanel negocios={negociosEnRevision} />
      <SolicitudesPanel solicitudes={solicitudes} />
      <ComplementosPanel negocios={negocios} seccion={seccion} />
    </div>
  );
}

function Encabezado({
  seccion,
  activos,
  vencidos,
}: {
  seccion: SeccionAdmin;
  activos: number;
  vencidos: number;
}) {
  return (
    <div className="mb-6">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Monetización{seccion !== "todas" ? ` · ${SECCION_LABEL[seccion]}` : ""}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Complementos</h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        {activos} complemento{activos === 1 ? "" : "s"} activo{activos === 1 ? "" : "s"}
        {vencidos > 0 ? ` · ${vencidos} vencido${vencidos === 1 ? "" : "s"}` : ""}. Lo que
        se cobra por negocio: mientras no haya pasarela, se enciende acá a mano cuando el
        negocio paga.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {ADDONS.map((a) => (
          <div
            key={a.id}
            className="rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-3"
          >
            <p className="text-[13px] font-bold text-aventurea-ink">{a.nombre}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-aventurea-ink-soft">
              {a.resumen}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
