import { createClient } from "@/lib/supabase/server";
import PreciosForm from "./precios-form";
import type { PrecioTier, ServicioAdicional } from "./types";

export default async function PreciosPage() {
  const supabase = await createClient();

  const [tiersRes, serviciosRes, configRes] = await Promise.all([
    supabase
      .from("precio_tiers")
      .select("*")
      .order("min_invitados", { ascending: true }),
    supabase.from("servicios_adicionales").select("*"),
    supabase.from("configuracion_rancho").select("*").single(),
  ]);

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Rancho de Eventos
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-orange-dark">
        Precios y servicios
      </h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Lo que guardes acá se refleja al instante en el cotizador del sitio
        público.
      </p>

      <div className="mt-6">
        <PreciosForm
          initialTiers={(tiersRes.data ?? []) as PrecioTier[]}
          initialServicios={(serviciosRes.data ?? []) as ServicioAdicional[]}
          initialTarifaDiciembre={
            (configRes.data?.tarifa_diciembre_por_persona as number) ?? 3750
          }
          initialDepositoReserva={
            (configRes.data?.deposito_reserva as number) ?? 25000
          }
        />
      </div>
    </div>
  );
}
