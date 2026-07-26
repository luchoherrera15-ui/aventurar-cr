import { createClient } from "@/lib/supabase/server";
import PreciosForm from "@/components/precios-form";
import { guardarConfiguracion } from "./actions";
import { NOMBRE_RANCHO_AVENTUREA } from "@/app/ranchos-eventos/constants";
import type { PrecioTier, ServicioAdicional } from "@/app/mi-rancho/types";

export default async function PreciosPage() {
  const supabase = await createClient();

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, deposito_reserva, tarifa_diciembre_por_persona")
    .eq("nombre", NOMBRE_RANCHO_AVENTUREA)
    .maybeSingle();

  const [tiersRes, serviciosRes] = await Promise.all([
    supabase
      .from("precio_tiers")
      .select("*")
      .eq("rancho_id", rancho?.id ?? "")
      .order("min_invitados", { ascending: true }),
    supabase
      .from("servicios_adicionales")
      .select("*")
      .eq("rancho_id", rancho?.id ?? ""),
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
          initialTarifaDiciembre={rancho?.tarifa_diciembre_por_persona ?? 3750}
          initialDepositoReserva={rancho?.deposito_reserva ?? 25000}
          onGuardar={guardarConfiguracion}
        />
      </div>
    </div>
  );
}
