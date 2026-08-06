"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import { guardarPreciosRancho } from "@/lib/precios";
import {
  guardarCodigosRancho,
  guardarPromocionesRancho,
  type PromocionInput,
} from "@/lib/descuentos";
import { HORARIOS_MAX, TERMINOS_MAX } from "../../types";
import type { GuardarPreciosInput, HorarioBloqueConfig } from "../../types";
import type { CuentasPago } from "@/components/cuentas-pago-form";

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Todas las acciones de esta pantalla llegan con el id del rancho ya
 * atado desde el server component (`.bind(null, rancho.id)`), porque
 * una misma cuenta puede tener varias publicaciones: filtrar solo por
 * owner_id tocaría todas a la vez. Este helper confirma que quien la
 * toca es el dueño de la sesión o un admin, antes de tocar nada.
 */
async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  return { supabase, ok };
}

/**
 * Guarda los bloques de alquiler del negocio.
 *
 * Lista vacía es una respuesta válida y quiere decir "no manejo
 * horarios": en ese caso al cliente no se le pregunta la hora y solo
 * elige la fecha.
 */
export async function guardarHorariosPropio(
  ranchoId: string,
  horarios: HorarioBloqueConfig[],
) {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  if (horarios.length > HORARIOS_MAX) {
    return { error: `Podés tener hasta ${HORARIOS_MAX} horarios.` };
  }

  const diaValido = (n: unknown): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6;

  const limpios: HorarioBloqueConfig[] = [];
  for (const h of horarios) {
    const desde = (h.desde ?? "").trim();
    const hasta = (h.hasta ?? "").trim();
    if (!HORA_REGEX.test(desde) || !HORA_REGEX.test(hasta)) {
      return { error: "Revisá las horas: alguna quedó incompleta." };
    }
    if (desde === hasta) {
      return { error: "La entrada y la salida de un horario no pueden ser la misma hora." };
    }
    limpios.push({
      id: h.id,
      etiqueta: (h.etiqueta ?? "").trim().slice(0, 40),
      desde,
      hasta,
      dias_semana: Array.isArray(h.dias_semana)
        ? [...new Set(h.dias_semana.filter(diaValido))].sort((a, b) => a - b)
        : [],
    });
  }

  const { error } = await supabase
    .from("ranchos")
    .update({ horarios_bloques: limpios })
    .eq("id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-negocio", "layout");
  revalidatePath("/eventos");
  return { error: null };
}

export async function guardarPreciosPropio(
  ranchoId: string,
  precios: GuardarPreciosInput,
) {
  const { ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  return guardarPreciosRancho(ranchoId, precios);
}

/**
 * Guarda los términos propios del negocio y su monto mínimo.
 *
 * Una lista vacía significa "usar los que trae la plataforma", así que
 * un proveedor que borra todo vuelve a los de Bookea en vez de
 * quedarse publicado sin condiciones.
 */
export async function guardarTerminosPropio(
  ranchoId: string,
  terminos: string[],
  montoMinimo: number | null,
) {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const limpios = terminos
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, TERMINOS_MAX);

  if (montoMinimo !== null && (!Number.isFinite(montoMinimo) || montoMinimo < 0)) {
    return { error: "El monto mínimo no puede ser negativo." };
  }

  const { error } = await supabase
    .from("ranchos")
    .update({
      terminos: limpios,
      monto_minimo: montoMinimo && montoMinimo > 0 ? montoMinimo : null,
    })
    .eq("id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-negocio", "layout");
  revalidatePath("/eventos");
  return { error: null };
}

export async function guardarCodigosPropio(
  ranchoId: string,
  codigos: {
    codigo: string;
    tipo: "porcentaje" | "monto_fijo";
    valor: number;
    activo: boolean;
    usos_maximos: number | null;
    valido_hasta: string | null;
  }[],
) {
  const { ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };
  return guardarCodigosRancho(ranchoId, codigos);
}

export async function guardarPromocionesPropio(
  ranchoId: string,
  promociones: PromocionInput[],
) {
  const { ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };
  return guardarPromocionesRancho(ranchoId, promociones);
}

export async function guardarCuentasPagoPropio(
  ranchoId: string,
  cuentas: CuentasPago,
) {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const limpiar = (v: string) => v.trim().slice(0, 120) || null;

  const { error } = await supabase
    .from("ranchos")
    .update({
      sinpe_numero: limpiar(cuentas.sinpeNumero),
      sinpe_titular: limpiar(cuentas.sinpeTitular),
      cuenta_banco: limpiar(cuentas.cuentaBanco),
      cuenta_numero: limpiar(cuentas.cuentaNumero),
      cuenta_titular: limpiar(cuentas.cuentaTitular),
      cuenta_tipo: limpiar(cuentas.cuentaTipo),
    })
    .eq("id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-negocio", "layout");
  return { error: null };
}

/**
 * Depósito de reserva para las categorías de servicio: los Lugares lo
 * guardan junto con sus tarifas (guardarPreciosPropio), pero un
 * catering o un DJ no tienen tiers — solo necesitan fijar cuánto se
 * paga por adelantado para agendar la fecha.
 */
export async function guardarDepositoPropio(ranchoId: string, deposito: number) {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const limpio = Math.round(Number(deposito));
  if (!Number.isFinite(limpio) || limpio < 0) {
    return { error: "El depósito no puede ser negativo." };
  }

  const { error } = await supabase
    .from("ranchos")
    .update({ deposito_reserva: limpio })
    .eq("id", ranchoId);

  if (error) return { error: error.message };
  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { error: null };
}
