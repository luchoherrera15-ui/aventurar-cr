import { createClient } from "@/lib/supabase/server";
import PreciosForm from "@/components/precios-form";
import DescuentosForm from "@/components/descuentos-form";
import {
  guardarConfiguracion,
  guardarCodigosBookear,
  guardarPromocionesBookear,
} from "./actions";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/ranchos-eventos/constants";
import type {
  CodigoDescuento,
  PrecioTier,
  PromocionDia,
  ServicioAdicional,
} from "@/app/mi-rancho/types";

export default async function PreciosPage() {
  const supabase = await createClient();

  const { data: rancho } = await supabase
    .from("ranchos")
    .select(
      "id, deposito_reserva, tarifa_diciembre_por_persona, modalidad_precio_lugar, precio_hora_lugar, precio_fijo_lugar",
    )
    .eq("nombre", NOMBRE_RANCHO_BOOKEAR)
    .maybeSingle();

  const [tiersRes, serviciosRes, codigosRes, promocionesRes] = await Promise.all([
    supabase
      .from("precio_tiers")
      .select("*")
      .eq("rancho_id", rancho?.id ?? "")
      .order("min_invitados", { ascending: true }),
    supabase
      .from("servicios_adicionales")
      .select("*")
      .eq("rancho_id", rancho?.id ?? ""),
    supabase
      .from("codigos_descuento")
      .select("*")
      .eq("rancho_id", rancho?.id ?? "")
      .order("created_at", { ascending: true }),
    supabase
      .from("promociones_dia")
      .select("*")
      .eq("rancho_id", rancho?.id ?? "")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Rancho de Eventos
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
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
          initialModalidadPrecio={rancho?.modalidad_precio_lugar ?? "rango_personas"}
          initialPrecioHora={rancho?.precio_hora_lugar ?? null}
          initialPrecioFijo={rancho?.precio_fijo_lugar ?? null}
          onGuardar={guardarConfiguracion}
        />
      </div>

      <h2 className="mb-1 mt-9 text-lg font-bold text-aventurea-ink">
        Descuentos y promociones
      </h2>
      <p className="mb-4 text-[13px] text-aventurea-ink-soft">
        Atraé más reservas con cupones y descuentos automáticos por día.
      </p>
      <DescuentosForm
        initialCodigos={(codigosRes.data ?? []) as CodigoDescuento[]}
        initialPromociones={(promocionesRes.data ?? []) as PromocionDia[]}
        onGuardarCodigos={guardarCodigosBookear}
        onGuardarPromociones={guardarPromocionesBookear}
      />
    </div>
  );
}
