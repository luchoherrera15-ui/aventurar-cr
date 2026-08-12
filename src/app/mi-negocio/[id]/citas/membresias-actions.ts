"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoOperativo } from "@/lib/auth";
import {
  finDeVigencia,
  puedeConsumir,
  type ConsumoMembresia,
  type EstadoMembresia,
  type Membresia,
  type PeriodoPlan,
  type PlanMembresia,
} from "@/lib/membresias";

/**
 * Planes, membresías y el libro del saldo (migración 0120).
 *
 * Todo pasa por `verificarAccesoOperativo` — el mismo guard del resto
 * del panel de citas, que resuelve dueño, colaborador y admin. La RLS
 * de la 0120 vuelve a comprobarlo con `gestiona_rancho()`: son dos
 * barreras a propósito, no una redundancia.
 *
 * El precio y las sesiones NUNCA llegan del navegador al vender: se
 * copian del plan leído en el servidor. Mismo criterio que el resto
 * del proyecto — el precio del pedido lo pone la base, no TypeScript.
 */

const PERIODOS: readonly PeriodoPlan[] = [
  "unico",
  "mensual",
  "trimestral",
  "semestral",
  "anual",
];

export type PlanFila = PlanMembresia & {
  rancho_id: string;
  descripcion: string | null;
  orden: number;
  created_at: string;
};

export type MembresiaFila = Membresia & {
  rancho_id: string;
  plan_id: string | null;
  cliente_id: string | null;
  correo: string | null;
  telefono: string | null;
  nombre: string | null;
  precio_pagado: number;
  notas: string | null;
  created_at: string;
};

export type PlanInput = {
  nombre: string;
  descripcion: string;
  precio: number;
  periodo: PeriodoPlan;
  /** null = ilimitado. */
  sesionesIncluidas: number | null;
  /** null = lo decide el período. */
  vigenciaDias: number | null;
  activo: boolean;
};

async function guard(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoOperativo(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  return { supabase, ok };
}

function faltaLaTabla(mensaje: string) {
  const nombra = /planes_membresia|membresias|consumos_membresia|plan_servicios/.test(mensaje);
  if (!nombra) return false;
  // Que el mensaje nombre la tabla no alcanza: una negativa de RLS
  // también la nombra, y mandar al dueño a correr una migración que ya
  // corrió lo hace buscar donde no es.
  return (
    mensaje.includes("does not exist") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("Could not find")
  );
}

function traducir(mensaje: string, accion: string) {
  if (faltaLaTabla(mensaje)) return "Falta correr la migración 0120 en Supabase.";
  return `No se pudo ${accion}: ${mensaje}`;
}

function validarPlan(datos: PlanInput) {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 80) {
    return "El nombre es obligatorio (máximo 80 caracteres).";
  }
  if (datos.descripcion.trim().length > 500) {
    return "La descripción es muy larga (máximo 500 caracteres).";
  }
  // Mismos rangos que los checks de la 0120, para no mandar un insert
  // que va a rebotar con un error de constraint en inglés.
  if (!Number.isFinite(datos.precio) || datos.precio < 0 || datos.precio > 10000000) {
    return "El precio debe estar entre ₡0 y ₡10.000.000.";
  }
  if (!PERIODOS.includes(datos.periodo)) return "Ese período no existe.";
  if (
    datos.sesionesIncluidas !== null &&
    (!Number.isInteger(datos.sesionesIncluidas) ||
      datos.sesionesIncluidas < 1 ||
      datos.sesionesIncluidas > 9999)
  ) {
    return "Las sesiones incluidas deben estar entre 1 y 9999 (vacío = ilimitadas).";
  }
  if (
    datos.vigenciaDias !== null &&
    (!Number.isInteger(datos.vigenciaDias) ||
      datos.vigenciaDias < 1 ||
      datos.vigenciaDias > 3650)
  ) {
    return "La vigencia debe estar entre 1 y 3650 días.";
  }
  return null;
}

function filaPlan(datos: PlanInput) {
  return {
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion.trim() || null,
    precio: datos.precio,
    periodo: datos.periodo,
    sesiones_incluidas: datos.sesionesIncluidas,
    vigencia_dias: datos.vigenciaDias,
    activo: datos.activo,
  };
}

// ── Planes ──────────────────────────────────────────────────────────

export async function crearPlan(
  ranchoId: string,
  datos: PlanInput,
): Promise<{ error?: string; plan?: PlanFila }> {
  const invalido = validarPlan(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  const { data: ultimo } = await supabase
    .from("planes_membresia")
    .select("orden")
    .eq("rancho_id", ranchoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("planes_membresia")
    .insert({ rancho_id: ranchoId, orden: (ultimo?.orden ?? 0) + 1, ...filaPlan(datos) })
    .select("*")
    .single();

  if (error) return { error: traducir(error.message, "guardar el plan") };

  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  return { plan: data as PlanFila };
}

export async function actualizarPlan(
  ranchoId: string,
  planId: string,
  datos: PlanInput,
): Promise<{ error?: string; plan?: PlanFila }> {
  const invalido = validarPlan(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  const { data, error } = await supabase
    .from("planes_membresia")
    .update(filaPlan(datos))
    .eq("id", planId)
    .eq("rancho_id", ranchoId)
    .select("*")
    .single();

  if (error) return { error: traducir(error.message, "guardar el plan") };

  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  return { plan: data as PlanFila };
}

/**
 * Dar de baja un plan NO borra las membresías ya vendidas: la fila de
 * `membresias` guarda su propio snapshot de sesiones y precio, y su
 * `plan_id` queda en null por el `on delete set null`. Quien compró
 * conserva lo que compró.
 */
export async function eliminarPlan(
  ranchoId: string,
  planId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  const { error } = await supabase
    .from("planes_membresia")
    .delete()
    .eq("id", planId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: traducir(error.message, "eliminar el plan") };

  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  return {};
}

// ── Venta ───────────────────────────────────────────────────────────

export type VentaInput = {
  planId: string;
  nombre: string;
  correo: string;
  telefono: string;
  /** YYYY-MM-DD. Vacío = hoy. */
  inicio: string;
  notas: string;
};

/** Los últimos 8 dígitos, igual que `clientes_negocio` (0109). */
function normalizarTelefono(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length >= 8 ? digitos.slice(-8) : null;
}

function normalizarCorreo(valor: string) {
  const limpio = valor.trim().toLowerCase();
  return limpio.includes("@") && !/\s/.test(limpio) ? limpio : null;
}

/**
 * Vende un plan a un cliente. El precio y las sesiones se copian del
 * plan LEÍDO EN EL SERVIDOR, nunca de lo que mande el navegador: si
 * llegaran del cliente, cualquiera se vendería una ilimitada a ₡0.
 */
export async function venderMembresia(
  ranchoId: string,
  datos: VentaInput,
  hoy: string,
): Promise<{ error?: string; membresia?: MembresiaFila }> {
  const correo = normalizarCorreo(datos.correo);
  const telefono = normalizarTelefono(datos.telefono);
  const nombre = datos.nombre.trim();

  if (!correo && !telefono) {
    return { error: "Poné al menos el correo o el teléfono del cliente." };
  }
  if (nombre.length > 120) return { error: "El nombre es muy largo." };
  if (datos.notas.trim().length > 1000) return { error: "Las notas son muy largas." };

  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(datos.inicio) ? datos.inicio : hoy;

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  const { data: plan, error: errorPlan } = await supabase
    .from("planes_membresia")
    .select("*")
    .eq("id", datos.planId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  if (errorPlan) return { error: traducir(errorPlan.message, "leer el plan") };
  if (!plan) return { error: "Ese plan ya no existe." };

  const p = plan as PlanFila;
  if (!p.activo) return { error: "Ese plan está desactivado." };

  const { data, error } = await supabase
    .from("membresias")
    .insert({
      rancho_id: ranchoId,
      plan_id: p.id,
      correo,
      telefono,
      nombre: nombre || null,
      estado: "activa",
      inicio,
      fin: finDeVigencia(p, inicio),
      // Snapshot: cambiar el plan después no toca lo ya vendido.
      sesiones_totales: p.sesiones_incluidas,
      precio_pagado: p.precio,
      notas: datos.notas.trim() || null,
    })
    .select("*")
    .single();

  if (error) return { error: traducir(error.message, "vender la membresía") };

  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  return { membresia: data as MembresiaFila };
}

export async function cambiarEstadoMembresia(
  ranchoId: string,
  membresiaId: string,
  estado: EstadoMembresia,
): Promise<{ error?: string; membresia?: MembresiaFila }> {
  if (!["activa", "pausada", "vencida", "cancelada"].includes(estado)) {
    return { error: "Ese estado no existe." };
  }

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  const { data, error } = await supabase
    .from("membresias")
    .update({ estado })
    .eq("id", membresiaId)
    .eq("rancho_id", ranchoId)
    .select("*")
    .single();

  if (error) return { error: traducir(error.message, "cambiar el estado") };

  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  return { membresia: data as MembresiaFila };
}

// ── El libro del saldo ──────────────────────────────────────────────

/**
 * Gasta una sesión. La comprobación de si se puede corre EN EL
 * SERVIDOR con la misma función pura que usa el panel para pintar el
 * botón: si el panel se quedó con datos viejos —dos personas en
 * recepción marcando a la vez—, acá se corta igual.
 */
export async function registrarConsumo(
  ranchoId: string,
  membresiaId: string,
  hoy: string,
  motivo = "",
): Promise<{ error?: string }> {
  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  const { data: fila, error: errorLectura } = await supabase
    .from("membresias")
    .select("*")
    .eq("id", membresiaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  if (errorLectura) return { error: traducir(errorLectura.message, "leer la membresía") };
  if (!fila) return { error: "Esa membresía ya no existe." };

  const { data: consumos } = await supabase
    .from("consumos_membresia")
    .select("membresia_id, cantidad")
    .eq("membresia_id", membresiaId);

  const veredicto = puedeConsumir(
    fila as MembresiaFila,
    (consumos ?? []) as ConsumoMembresia[],
    hoy,
  );
  if (!veredicto.puede) return { error: veredicto.motivo };

  const { error } = await supabase.from("consumos_membresia").insert({
    membresia_id: membresiaId,
    cantidad: 1,
    motivo: motivo.trim().slice(0, 200) || null,
  });

  if (error) return { error: traducir(error.message, "marcar la sesión") };

  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  return {};
}

/**
 * Devuelve una sesión. NO borra el consumo original: agrega su
 * contrario, para que el historial quede completo y el dueño pueda
 * explicarle al cliente qué pasó con cada sesión.
 */
export async function devolverSesion(
  ranchoId: string,
  membresiaId: string,
  motivo = "",
): Promise<{ error?: string }> {
  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  // Se comprueba que la membresía sea de ESTE negocio antes de tocar su
  // libro: `consumos_membresia` no tiene rancho_id propio.
  const { data: fila } = await supabase
    .from("membresias")
    .select("id")
    .eq("id", membresiaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!fila) return { error: "Esa membresía ya no existe." };

  const { error } = await supabase.from("consumos_membresia").insert({
    membresia_id: membresiaId,
    cantidad: -1,
    motivo: motivo.trim().slice(0, 200) || "Sesión devuelta",
  });

  if (error) return { error: traducir(error.message, "devolver la sesión") };

  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  return {};
}
