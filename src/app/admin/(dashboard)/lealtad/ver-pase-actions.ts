"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { datosVistaDeFila } from "@/lib/lealtad/datos-vista-pase";
import { elegirDeFilasCrudas } from "@/lib/wallet/programa-principal";
import { minutoISOCR } from "@/lib/fechas";
import type { DatosVista } from "@/components/lealtad/vista-pase"; // type-only: cruza la
// frontera use client → server sin traer runtime de cliente (el bug que ya rompió Finanzas e IA)

/**
 * VER PASE, desde admin: la vista previa de la tarjeta de un negocio,
 * sin tocar ningún dato de personas.
 *
 * ------------------------------------------------------------------
 * POR QUÉ SOLO `requireAdmin()` Y NO `verificarAccesoLealtad`
 * ------------------------------------------------------------------
 * Esto es una previsualización de DISEÑO (colores, logo, sellos): no
 * hay ni un nombre ni un correo de cliente en el camino. El segundo
 * candado que sí lleva "Ver clientes" (`verificarAccesoLealtad`) está
 * ahí para leer personas, no para leer un diseño de tarjeta — pedirlo
 * acá también sería un segundo mecanismo de permiso sin ningún dato
 * nuevo que proteger.
 *
 * ------------------------------------------------------------------
 * QUÉ TARJETA SE MUESTRA CUANDO HAY VARIAS (0134)
 * ------------------------------------------------------------------
 * `elegirDeFilasCrudas` y no `emisoraDeFilasCrudas`: un admin quiere
 * ver la tarjeta representativa del negocio aunque hoy no esté
 * emitiendo pases (por ejemplo, fuera de sus horas de vigencia) — es
 * la MISMA elección que hace el panel del negocio para mostrarse a sí
 * mismo, no la más estricta que usa el generador de Wallet.
 */

export type ResultadoVerPase =
  | { ok: true; datos: DatosVista; totalProgramas: number }
  | { ok: false; motivo: string };

export async function verPaseDeNegocio(ranchoId: string): Promise<ResultadoVerPase> {
  const { ok } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const { data: rancho } = await admin
    .from("ranchos")
    .select("nombre")
    .eq("id", ranchoId)
    .maybeSingle();
  if (!rancho) return { ok: false, motivo: "Ese negocio no existe." };

  const { data: filas } = await admin
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", ranchoId);

  const lista = (filas ?? []) as Record<string, unknown>[];
  if (lista.length === 0) {
    return {
      ok: false,
      motivo: "Este negocio no tiene ningún programa de lealtad creado todavía.",
    };
  }

  const elegido = elegirDeFilasCrudas(lista, minutoISOCR());
  // `elegirDeFilasCrudas` nunca devuelve null cuando `lista` tiene
  // filas (ver `elegirPrograma`), pero TypeScript no lo sabe: se
  // guarda igual, con el mismo mensaje que el caso de arriba.
  if (!elegido) {
    return {
      ok: false,
      motivo: "Este negocio no tiene ningún programa de lealtad creado todavía.",
    };
  }

  // La traducción de fila a previa vive en `datos-vista-pase.ts`,
  // una sola para las cinco pantallas. Acá estaba escrita a mano y
  // se olvidaba de `pase_diseno` (0212): un negocio que movió sus
  // sellos los veía en su lugar en el teléfono y en la grilla
  // clásica en este modal.
  const datos: DatosVista = datosVistaDeFila(
    typeof rancho.nombre === "string" ? rancho.nombre : "",
    elegido,
  );

  return { ok: true, datos, totalProgramas: lista.length };
}
