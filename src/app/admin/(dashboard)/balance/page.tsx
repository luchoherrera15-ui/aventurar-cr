import { createClient } from "@/lib/supabase/server";
import BalancePanel from "./balance-panel";
import type { Gasto, RanchoBalance, ReservaBalance } from "./types";
import { perteneceASeccion, SECCION_LABEL } from "../vertical";
import { seccionActiva } from "../vertical-server";

export default async function AdminBalancePage() {
  const supabase = await createClient();
  const seccion = await seccionActiva();

  const [reservasRes, ranchosRes, gastosRes, configRes] = await Promise.all([
    supabase
      .from("reservas")
      .select("id, fecha, invitados, rancho_id")
      .eq("estado", "confirmada"),
    supabase.from("ranchos").select("id, nombre, vertical").order("nombre"),
    supabase.from("gastos").select("*").order("fecha", { ascending: false }),
    supabase
      .from("configuracion_plataforma")
      .select("comision_por_persona")
      .single(),
  ]);

  // Los ingresos de la sección: solo reservas de negocios de esa vertical.
  const todosLosRanchos = (ranchosRes.data ?? []) as (RanchoBalance & {
    vertical?: string | null;
  })[];
  const verticalPorRancho = new Map(
    todosLosRanchos.map((r) => [r.id, r.vertical ?? null]),
  );
  const ranchos = todosLosRanchos.filter((r) =>
    perteneceASeccion(r.vertical, seccion),
  );
  const reservas = ((reservasRes.data ?? []) as ReservaBalance[]).filter((r) =>
    perteneceASeccion(r.rancho_id ? verticalPorRancho.get(r.rancho_id) : null, seccion),
  );

  const errores = [reservasRes.error, ranchosRes.error, gastosRes.error]
    .filter(Boolean)
    .map((e) => e!.message);

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        {SECCION_LABEL[seccion]}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        Balance y finanzas
      </h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Ingresos por comisión de cada negocio, gastos y balance neto del
        periodo que elijas
        {seccion !== "todas" ? ` — solo la sección de ${SECCION_LABEL[seccion].toLowerCase()}` : ""}.
      </p>

      {errores.length > 0 && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar todo: {errores.join(" · ")}
        </p>
      )}

      <BalancePanel
        reservas={reservas}
        ranchos={ranchos}
        gastosIniciales={(gastosRes.data ?? []) as Gasto[]}
        comisionInicial={Number(configRes.data?.comision_por_persona ?? 0)}
        seccion={seccion}
      />
    </div>
  );
}
