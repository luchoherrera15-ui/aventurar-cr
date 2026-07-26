import { createClient } from "@/lib/supabase/server";
import BalancePanel from "./balance-panel";
import type { Gasto, RanchoBalance, ReservaBalance } from "./types";

export default async function AdminBalancePage() {
  const supabase = await createClient();

  const [reservasRes, ranchosRes, gastosRes, configRes] = await Promise.all([
    supabase
      .from("reservas")
      .select("id, fecha, invitados, rancho_id")
      .eq("estado", "confirmada"),
    supabase.from("ranchos").select("id, nombre").order("nombre"),
    supabase.from("gastos").select("*").order("fecha", { ascending: false }),
    supabase
      .from("configuracion_plataforma")
      .select("comision_por_persona")
      .single(),
  ]);

  const errores = [reservasRes.error, ranchosRes.error, gastosRes.error]
    .filter(Boolean)
    .map((e) => e!.message);

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-orange-dark">
        Balance y finanzas
      </h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Ingresos por comisión de cada salón, gastos fijos y balance neto del
        periodo que elijas.
      </p>

      {errores.length > 0 && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar todo: {errores.join(" · ")}
        </p>
      )}

      <BalancePanel
        reservas={(reservasRes.data ?? []) as ReservaBalance[]}
        ranchos={(ranchosRes.data ?? []) as RanchoBalance[]}
        gastosIniciales={(gastosRes.data ?? []) as Gasto[]}
        comisionInicial={Number(configRes.data?.comision_por_persona ?? 0)}
      />
    </div>
  );
}
