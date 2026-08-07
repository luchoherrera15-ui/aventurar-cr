import { createClient } from "@/lib/supabase/server";
import { parsearPrecioPorPersona } from "@/lib/precio-lugar";
import PreciosForm from "@/components/precios-form";
import DescuentosForm from "@/components/descuentos-form";
import {
  guardarConfiguracion,
  guardarCodigosBookear,
  guardarPromocionesBookear,
} from "./actions";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/eventos/constants";
import type {
  CodigoDescuento,
  PrecioTier,
  PromocionDia,
  ServicioAdicional,
} from "@/app/mi-negocio/types";

/**
 * Precios a nivel ADMINISTRATIVO: el selector de arriba deja editar
 * los precios de CUALQUIER negocio (pedido del dueño — ej. cargarle a
 * Rancho Las Torres la modalidad por persona sin entrar con su
 * cuenta). Sin selección se edita el rancho de la casa, como siempre.
 * La política de update de `ranchos` (0008) ya permite is_admin().
 */
export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ rancho?: string }>;
}) {
  const { rancho: ranchoParam } = await searchParams;
  const supabase = await createClient();

  // Los negocios del selector, por nombre.
  const { data: negocios } = await supabase
    .from("ranchos")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  // A propósito `*` y no la lista de columnas: los precios de diciembre
  // (0099) o el por-persona (0103) pueden no existir todavía en la
  // base, y pedirlos por nombre haría fallar la consulta entera.
  const consulta = supabase.from("ranchos").select("*");
  const { data: rancho } = await (ranchoParam
    ? consulta.eq("id", ranchoParam).maybeSingle()
    : consulta.eq("nombre", NOMBRE_RANCHO_BOOKEAR).maybeSingle());

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
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
        Rancho de Eventos
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        Precios y servicios
      </h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Lo que guardes acá se refleja al instante en el cotizador del sitio
        público.
      </p>

      {/* El selector: GET simple, sin JavaScript — elegir y "Cambiar"
          recarga la página con ese negocio ya cargado en el form. */}
      <form className="mt-5 flex flex-wrap items-end gap-2.5">
        <div>
          <label
            htmlFor="admin-rancho"
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft"
          >
            Negocio que estás editando
          </label>
          <select
            id="admin-rancho"
            name="rancho"
            defaultValue={(rancho?.id as string | undefined) ?? ""}
            className="min-w-[280px] rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-aventurea-ink"
          >
            {(negocios ?? []).map((n) => (
              <option key={n.id as string} value={n.id as string}>
                {n.nombre as string}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl border border-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
        >
          Cambiar
        </button>
      </form>

      <div className="mt-6">
        <PreciosForm
          initialTiers={(tiersRes.data ?? []) as PrecioTier[]}
          initialServicios={(serviciosRes.data ?? []) as ServicioAdicional[]}
          initialTarifaDiciembre={rancho?.tarifa_diciembre_por_persona ?? 3750}
          initialDepositoReserva={rancho?.deposito_reserva ?? 25000}
          initialModalidadPrecio={rancho?.modalidad_precio_lugar ?? "rango_personas"}
          initialPrecioHora={rancho?.precio_hora_lugar ?? null}
          initialPrecioFijo={rancho?.precio_fijo_lugar ?? null}
          initialPrecioHoraDiciembre={rancho?.precio_hora_diciembre ?? null}
          initialPrecioFijoDiciembre={rancho?.precio_fijo_diciembre ?? null}
          initialPrecioPorPersona={parsearPrecioPorPersona(
            rancho?.precio_por_persona,
          )}
          onGuardar={guardarConfiguracion.bind(
            null,
            (rancho?.id as string | undefined) ?? null,
          )}
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
        onGuardarCodigos={guardarCodigosBookear.bind(
          null,
          (rancho?.id as string | undefined) ?? null,
        )}
        onGuardarPromociones={guardarPromocionesBookear.bind(
          null,
          (rancho?.id as string | undefined) ?? null,
        )}
      />
    </div>
  );
}
