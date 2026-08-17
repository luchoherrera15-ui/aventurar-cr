import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { vencerSellosDelDia } from "@/lib/lealtad/vencer-sellos";

/**
 * EL BARRIDO DIARIO DE SELLOS VENCIDOS (0180).
 *
 * Reinicia los sellos de quien dejó de venir más de lo que el negocio
 * configuró, y manda el ÚNICO aviso a quien está por llegar a ese
 * plazo. La decisión de a quién le toca vive en
 * `src/lib/lealtad/vencimiento-sellos.ts` (pura) y el trabajo en
 * `vencer-sellos.ts`; esta ruta es solo la puerta.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ACÁ Y NO EN vercel.json
 * ------------------------------------------------------------------
 * El mismo motivo que los otros cuatro crons de este repo: en el plan
 * Hobby, un cron de más en `vercel.json` puede hacer que Vercel
 * rechace el deploy ENTERO sin dejar rastro en la lista de
 * deployments. El disparador es GitHub Actions —
 * `.github/workflows/vencimiento-de-sellos.yml` — con el mismo
 * `CRON_SECRET` que los demás.
 *
 * ------------------------------------------------------------------
 * QUE NO CORRA UN DÍA NO ROMPE NADA
 * ------------------------------------------------------------------
 * El trabajo no lleva cursor ni estado de corrida: la pregunta es
 * «¿quién está vencido HOY?», y se la vuelve a hacer entera cada vez.
 * Si el job falla el martes, el miércoles vence a los del martes y a
 * los del miércoles, con la misma llave de idempotencia —que sale de
 * la fecha de CORTE de cada cliente, no de la fecha de la corrida— así
 * que nadie pierde sus sellos dos veces por un cron atrasado.
 *
 * Responde 200 aunque no haya podido hacer nada (sin llave de
 * servicio, sin la 0180 pegada): el motivo viaja en `nota`. Un cron
 * que devuelve error todos los días por una migración pendiente se
 * vuelve ruido que nadie mira.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Habla con Apple y con Google de a un miembro por vez, pero solo por
// los que de verdad vencen ese día — que en régimen son puñados, no
// listas: el corte de cada cliente cae en su propio día.
export const maxDuration = 60;

export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const resumen = await vencerSellosDelDia();
  return NextResponse.json(resumen);
}
