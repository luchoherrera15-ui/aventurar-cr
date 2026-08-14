import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { sincronizarAvisoDePausa } from "@/lib/wallet/aviso-de-pausa";
import { sincronizarAvisoDeDiseno } from "@/lib/wallet/aviso-de-diseno";

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
 * ------------------------------------------------------------------
 * DESDE LA 0150 TAMBIÉN BARRE EL DISEÑO PENDIENTE
 * ------------------------------------------------------------------
 * Cuando el dueño edita el diseño o las reglas de su tarjeta
 * (`/lealtad/panel/[id]/editar/[programaId]`), el guardado dispara una
 * corrida inmediata por `after()` para que su propio pase de prueba se
 * vea al toque — pero si el programa tiene más pases que una tanda, lo
 * que sobra queda con `pases_wallet.diseno_pendiente = true` esperando.
 * Es EL MISMO problema de volumen que la pausa (una llamada de red por
 * pase) y por eso se resuelve con el mismo cron en vez de uno aparte:
 * misma cadencia, mismo secreto, un archivo menos que revisar.
 *
 * Responde 200 aunque no haya podido hacer nada (sin certificados de
 * Apple, sin llaves de Google, sin la migración 0147/0150): el motivo
 * viaja en `nota` y en los logs. Un cron que devuelve error cada diez
 * minutos por una variable que falta se vuelve ruido que nadie mira.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Habla con Apple y con Google en serie DENTRO de cada corrida, con
// pausas entre tandas — pero las dos corridas (pausa y diseño, desde la
// 0150) van en PARALELO con `Promise.all`: son conexiones y tablas
// independientes, y cada una es como mucho ~200 pases en tandas de 25
// con 1,5s entre tandas (~12s de espera), lejos del techo de 60s.
export const maxDuration = 60;

export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const [pausa, diseno] = await Promise.all([
    sincronizarAvisoDePausa(),
    sincronizarAvisoDeDiseno(),
  ]);
  return NextResponse.json({ pausa, diseno });
}
