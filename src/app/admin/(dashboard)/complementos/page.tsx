import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { ADDONS, estadoDeAddon } from "@/lib/addons";
import { perteneceASeccion, SECCION_LABEL, type SeccionAdmin } from "../vertical";
import { seccionActiva } from "../vertical-server";
import ComplementosPanel, {
  type FilaAddon,
  type NegocioConAddons,
} from "./complementos-panel";

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

  const [ranchosRes, addonsRes, programasRes, miembrosRes] = await Promise.all([
    admin
      .from("ranchos")
      .select("id, nombre, slug, vertical, estado, plan_lealtad")
      .order("nombre"),
    admin.from("addons_negocio").select("rancho_id, addon, activo, vence_en, notas, activado_en"),
    // El programa de lealtad de cada negocio, para poder contar sus
    // miembros contra el tope del plan.
    admin.from("programa_lealtad").select("id, rancho_id"),
    admin.from("miembros").select("programa_id"),
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
    .filter((r) => perteneceASeccion(r.vertical, seccion))
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

      <ComplementosPanel negocios={negocios} />
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
