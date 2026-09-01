import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { barrerCampanas } from "@/lib/lealtad/barrido-campanas";

/**
 * LA PUERTA DEL BARRIDO DE CAMPAÑAS AUTOMÁTICAS (0226).
 *
 * La decisión y el candado contra el envío doble viven en
 * `src/lib/lealtad/barrido-campanas.ts`; acá solo se verifica el
 * secreto y se devuelve el resumen.
 *
 * EL DISPARADOR ES GITHUB ACTIONS, no `vercel.json` — el mismo camino
 * que los otros cuatro crons del repo y por el mismo motivo: en el plan
 * Hobby, Vercel solo acepta crons diarios y RECHAZA EL DEPLOY ENTERO si
 * `vercel.json` trae uno más frecuente, sin dejar rastro en la lista de
 * deployments. Este necesita correr cada hora, porque cada campaña
 * elige su hora. Ver `.github/workflows/campanas-lealtad.yml`.
 *
 * Si una corrida se pierde, la promo de ESA hora no sale y no se
 * recupera: mandarla dos horas tarde sería peor que no mandarla —el
 * «happy hour de 5 a 7» avisado a las 9 de la noche es una promesa
 * incumplida—. Por eso el fallo del job tiene que verse en Actions.
 *
 * Responde 200 aunque no haya hecho nada (falta la migración, no hay
 * llave de servicio): el motivo viaja en `nota`. Un cron que devuelve
 * error cada hora por una variable que falta se vuelve ruido.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Habla con Apple y con Google, en serie por campaña. Con pocas
// campañas por hora sobra, pero el techo se deja alto porque cada
// negocio puede tener cientos de pases.
export const maxDuration = 60;

export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const resultado = await barrerCampanas();
  return NextResponse.json(resultado);
}
