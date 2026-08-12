"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoOperativo } from "@/lib/auth";
import type { ModoPrograma } from "@/lib/wallet/tarjeta";

/**
 * La configuración del programa de lealtad y su tarjeta de Wallet
 * (migraciones 0060, 0121, 0122).
 *
 * Casi todo lo que se ve en la tarjeta se DERIVA: cuántos sellos y qué
 * regalía salen de la recompensa activa más barata; el saldo, del
 * ledger. Acá solo se edita lo que no se puede deducir de ningún lado:
 * las reglas de cómo se ganan puntos y cómo se ve la tarjeta.
 */

export type ProgramaFila = {
  id: string;
  rancho_id: string;
  nombre: string;
  puntos_por_visita: number;
  puntos_por_colon: number;
  activo: boolean;
  modo: ModoPrograma | null;
  pase_color_fondo: string | null;
  pase_color_sello: string | null;
  pase_logo_url: string | null;
};

export type RecompensaFila = {
  id: string;
  programa_id: string;
  nombre: string;
  descripcion: string | null;
  costo_puntos: number;
  orden: number;
  activo: boolean;
};

export type ProgramaInput = {
  nombre: string;
  modo: ModoPrograma;
  /** Cuántos puntos da una visita. En modo sellos, esto ES el sello. */
  puntosPorVisita: number;
  /** Puntos por cada colón gastado. 0.05 = 5% de vuelta. */
  puntosPorColon: number;
  colorFondo: string;
  colorSello: string;
  logoUrl: string;
  activo: boolean;
};

const MODOS: readonly ModoPrograma[] = ["sellos", "cashback", "puntos"];
const HEX = /^#[0-9A-Fa-f]{6}$/;

async function guard(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoOperativo(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  return { supabase, ok };
}

function faltaLaTabla(mensaje: string) {
  if (!/programa_lealtad|recompensas/.test(mensaje)) return false;
  return (
    mensaje.includes("does not exist") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("Could not find")
  );
}

function traducir(mensaje: string, accion: string) {
  if (faltaLaTabla(mensaje)) return "Faltan migraciones de lealtad en Supabase (0060/0121/0122).";
  return `No se pudo ${accion}: ${mensaje}`;
}

function validarPrograma(datos: ProgramaInput) {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 80) return "El nombre es obligatorio (máximo 80 caracteres).";
  if (!MODOS.includes(datos.modo)) return "Ese modo no existe.";

  if (!Number.isInteger(datos.puntosPorVisita) || datos.puntosPorVisita < 0) {
    return "Los puntos por visita no pueden ser negativos.";
  }
  if (!Number.isFinite(datos.puntosPorColon) || datos.puntosPorColon < 0) {
    return "Los puntos por colón no pueden ser negativos.";
  }
  // Un programa que no otorga nada es una tarjeta que nunca avanza: se
  // ve bien, no funciona, y nadie entiende por qué.
  if (datos.puntosPorVisita === 0 && datos.puntosPorColon === 0) {
    return "El programa tiene que dar algo: puntos por visita, por colón, o los dos.";
  }
  // Mismo check que la 0122: un color mal escrito no falla al dibujar,
  // sale un cuadro negro y nadie sabe por qué.
  if (!HEX.test(datos.colorFondo)) return "El color de fondo tiene que ser #RRGGBB.";
  if (!HEX.test(datos.colorSello)) return "El color del sello tiene que ser #RRGGBB.";

  const logo = datos.logoUrl.trim();
  if (logo && !logo.startsWith("https://")) return "El logo tiene que ser una URL https.";
  return null;
}

/**
 * Crea o actualiza el programa. `programa_lealtad` tiene
 * `unique(rancho_id)`, así que hay uno solo por negocio: se busca y se
 * decide, en vez de asumir.
 */
export async function guardarPrograma(
  ranchoId: string,
  datos: ProgramaInput,
): Promise<{ error?: string; programa?: ProgramaFila }> {
  const invalido = validarPrograma(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  const fila = {
    nombre: datos.nombre.trim(),
    modo: datos.modo,
    puntos_por_visita: datos.puntosPorVisita,
    puntos_por_colon: datos.puntosPorColon,
    pase_color_fondo: datos.colorFondo,
    pase_color_sello: datos.colorSello,
    pase_logo_url: datos.logoUrl.trim() || null,
    activo: datos.activo,
  };

  const { data: existente } = await supabase
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  const { data, error } = existente
    ? await supabase
        .from("programa_lealtad")
        .update(fila)
        .eq("id", existente.id)
        .select("*")
        .single()
    : await supabase
        .from("programa_lealtad")
        .insert({ rancho_id: ranchoId, ...fila })
        .select("*")
        .single();

  if (error) return { error: traducir(error.message, "guardar el programa") };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { programa: data as ProgramaFila };
}

export type RecompensaInput = {
  nombre: string;
  descripcion: string;
  /** En modo sellos, esto ES la meta: "10 sellos". */
  costoPuntos: number;
  activo: boolean;
};

function validarRecompensa(datos: RecompensaInput) {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 120) return "El nombre es obligatorio (máximo 120 caracteres).";
  if (datos.descripcion.trim().length > 300) return "La descripción es muy larga.";
  if (!Number.isInteger(datos.costoPuntos) || datos.costoPuntos < 1) {
    return "La recompensa tiene que costar al menos 1.";
  }
  return null;
}

/**
 * Las recompensas del programa. La MÁS BARATA activa es la que marca
 * la meta de la tarjeta de sellos ("5 de 10") y la que se muestra como
 * próxima regalía — por eso no hay una columna aparte con ese número.
 */
export async function guardarRecompensa(
  ranchoId: string,
  programaId: string,
  datos: RecompensaInput,
  recompensaId?: string,
): Promise<{ error?: string; recompensa?: RecompensaFila }> {
  const invalido = validarRecompensa(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  // El programa tiene que ser DE ESTE negocio: `recompensas` cuelga del
  // programa y no lleva rancho_id propio, así que sin esta comprobación
  // el id del programa vendría del navegador sin control.
  const { data: programa } = await supabase
    .from("programa_lealtad")
    .select("id")
    .eq("id", programaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!programa) return { error: "Ese programa no es de este negocio." };

  const fila = {
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion.trim() || null,
    costo_puntos: datos.costoPuntos,
    activo: datos.activo,
  };

  const { data, error } = recompensaId
    ? await supabase
        .from("recompensas")
        .update(fila)
        .eq("id", recompensaId)
        .eq("programa_id", programaId)
        .select("*")
        .single()
    : await supabase
        .from("recompensas")
        .insert({ programa_id: programaId, ...fila })
        .select("*")
        .single();

  if (error) return { error: traducir(error.message, "guardar la recompensa") };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { recompensa: data as RecompensaFila };
}

export async function eliminarRecompensa(
  ranchoId: string,
  programaId: string,
  recompensaId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "No tenés acceso a este negocio." };

  const { data: programa } = await supabase
    .from("programa_lealtad")
    .select("id")
    .eq("id", programaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!programa) return { error: "Ese programa no es de este negocio." };

  const { error } = await supabase
    .from("recompensas")
    .delete()
    .eq("id", recompensaId)
    .eq("programa_id", programaId);

  if (error) return { error: traducir(error.message, "eliminar la recompensa") };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return {};
}
