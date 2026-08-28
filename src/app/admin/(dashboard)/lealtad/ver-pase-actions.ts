"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { leerBeneficio, tipoDe, configPorDefecto } from "@/lib/lealtad/tipos-tarjeta";
import { selloParaGuardar } from "@/lib/lealtad/iconos-sello";
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

  const modo = typeof elegido.modo === "string" ? elegido.modo : null;
  const tipo = tipoDe(modo);
  const beneficio = leerBeneficio(elegido.beneficio, tipo) ?? configPorDefecto(tipo);
  const sello = selloParaGuardar({
    tipo: elegido.modo,
    icono: elegido.pase_sello_icono,
    url: elegido.pase_sello_icono_url,
  });

  const datos: DatosVista = {
    negocioNombre: typeof rancho.nombre === "string" ? rancho.nombre : "",
    modo,
    beneficio,
    colorFondo: typeof elegido.pase_color_fondo === "string" ? elegido.pase_color_fondo : null,
    colorSello: typeof elegido.pase_color_sello === "string" ? elegido.pase_color_sello : null,
    logoUrl: typeof elegido.pase_logo_url === "string" ? elegido.pase_logo_url : null,
    bannerUrl: typeof elegido.pase_banner_url === "string" ? elegido.pase_banner_url : null,
    iconoSello: sello.icono,
    iconoUrl: sello.url,
  };

  return { ok: true, datos, totalProgramas: lista.length };
}
