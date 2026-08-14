import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { sincronizarAvisoDePausa } from "@/lib/wallet/aviso-de-pausa";

/**
 * EL BARRIDO QUE LE CAMBIA EL TEXTO A LOS PASES YA INSTALADOS.
 *
 * Cuando un negocio deja de pagar, el webhook de Stripe pausa su
 * programa al terminar el mes (0146): el mostrador deja de sellar y de
 * canjear en el mismo segundo, porque el canje se decide contra la
 * BASE. Lo que ese update NO puede hacer es tocar los teléfonos: cada
 * pase cuesta una llamada a Apple o a Google, y un negocio de 1.150
 * miembros son 1.150 llamadas mientras Stripe espera respuesta. El
 * webhook se caería por tiempo y Stripe lo reintentaría en loop.
 *
 * Así que el aviso vive acá, y esta ruta es solo la puerta: la decisión
 * y las tandas están en src/lib/wallet/aviso-de-pausa.ts.
 *
 * EL DISPARADOR ES GITHUB ACTIONS, no un cron de vercel.json — el
 * mismo camino que el recordatorio horario, y por el mismo motivo:
 * Vercel Hobby solo permite crons diarios y rechaza el deploy entero
 * si vercel.json trae uno más frecuente, sin dejar rastro en la lista
 * de deployments. Ver .github/workflows/pases-en-pausa.yml.
 *
 * Corre en las DOS direcciones: le pone el aviso a los pases de un
 * programa pausado y se lo saca a los de un programa que volvió. Si la
 * vuelta no funcionara, el corte sería una trampa.
 *
 * Responde 200 aunque no haya podido hacer nada (sin certificados de
 * Apple, sin llaves de Google, sin la migración 0147): el motivo viaja
 * en `nota` y en los logs. Un cron que devuelve error cada diez minutos
 * por una variable que falta se vuelve ruido que nadie mira.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Habla con Apple y con Google en serie, con pausas entre tandas.
export const maxDuration = 60;

export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const resumen = await sincronizarAvisoDePausa();
  return NextResponse.json(resumen);
}
