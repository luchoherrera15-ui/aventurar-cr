import { createAdminClient } from "@/lib/supabase/admin";
import { credencialesDelEntorno } from "../firma";
import { entregarApple, type PaseParaAvisar } from "../aviso-de-pausa";
import type { ResultadoSync, TrabajoSync } from "./tipos";

/**
 * EL ADAPTADOR DE APPLE, para el worker de sincronización (Wallet V2).
 *
 * ------------------------------------------------------------------
 * QUÉ HACE, EN UNA LÍNEA
 * ------------------------------------------------------------------
 * Le manda al iPhone un push VACÍO. Apple no manda el pase nuevo por
 * push — el teléfono responde pidiéndolo a nuestro Web Service
 * (`/api/wallet/v1/passes/…`), que lo regenera con el contenido de
 * hoy (`generarPaseDeLealtad`, en `generar.ts`). Por eso el mismo
 * envío sirve para las cuatro `OperacionSync`: saldo, diseño, pausa o
 * mensaje promocional — ninguna de las cuatro necesita un payload
 * distinto, todas necesitan exactamente lo mismo, que el teléfono
 * vuelva a preguntar.
 *
 * Por esto ESTE archivo nunca importa `generar.ts` ni firma nada: la
 * firma del .pkpass y el cálculo del `authToken` ya viven ahí, y se
 * disparan solos cuando el teléfono llama al Web Service. Reimplementar
 * esa parte acá sería una segunda copia de lo que `generar.ts` ya hace
 * bien.
 *
 * ------------------------------------------------------------------
 * REUTILIZA, NO REESCRIBE
 * ------------------------------------------------------------------
 * El envío en sí —leer los `push_token` del pase, llamar a APNs vía
 * `avisarPaseActualizado` (mTLS + HTTP/2, en `apns.ts`), y borrar los
 * tokens caducados (410) de `registros_dispositivo`— es EXACTAMENTE lo
 * que `entregarApple()` (`aviso-de-pausa.ts`, 0147) ya hace para el
 * barrido de pausa y de diseño. Este adaptador no vuelve a escribir esa
 * consulta: la llama.
 *
 * NUNCA toca `pases_wallet` ni el ledger (`transacciones_puntos`,
 * `miembros.saldo_cache`): la única escritura que ocurre en este
 * archivo es la que ya hacía `entregarApple` — borrar `push_token`
 * caducados de `registros_dispositivo`, que es una tabla de
 * dispositivos, no de identidad del pase ni de saldo.
 *
 * ------------------------------------------------------------------
 * RETRYABLE vs. DEAD — LA DECISIÓN, Y POR QUÉ
 * ------------------------------------------------------------------
 * `avisarPaseActualizado` (apns.ts) solo distingue, en su tipo de
 * retorno, dos cosas: "se pudo hablar con APNs" (ok:true, con
 * `caducados` aparte) o "no se pudo ni conectar" (ok:false + motivo).
 * Los rechazos POR TOKEN (400 BadDeviceToken, 403 BadCertificate) hoy
 * quedan adentro de esa función, en un `console.warn` — no cambian el
 * resultado. Ese es un límite real de la función tal como existe hoy,
 * y este adaptador no lo fuerza a exponer más de lo que expone: lo
 * consume tal cual, sin tocarlo.
 *
 * Con eso, "dead" (no reintentable) para Apple se decide en el ÚNICO
 * punto donde SÍ hay una señal determinista de que reintentar no va a
 * cambiar nada:
 *
 *   1. Sin credenciales configuradas (`credencialesDelEntorno()` da
 *      null) — el mismo caso que `generar.ts` reporta como
 *      `codigo: "sin_credenciales"`, un fallo de config del servidor,
 *      no del pase. Reintentar en 30 segundos, 2 minutos o una hora no
 *      hace aparecer un certificado que no está.
 *   2. El trabajo llegó mal enrutado (`job.plataforma !== "apple"`) o
 *      el `pase_id` ya no corresponde a un pase de Apple — un bug de
 *      enrutado o una fila que cambió de identidad no se arregla
 *      reintentando el mismo trabajo.
 *
 * Todo lo demás que puede fallar —no se pudo leer `pases_wallet` o
 * `registros_dispositivo`, `avisarPaseActualizado` no pudo conectar a
 * APNs— es justo el "estado 0 / error de red" transitorio del plan:
 * se marca `reintentable: true` y el backoff del worker se encarga.
 *
 * Un pase sin ningún teléfono registrado, o con TODOS sus tokens
 * caducados, no es un fallo: no queda a quién avisarle. `ok: true`,
 * como ya decide `entregarApple`.
 */

/** El `error`/log nunca lleva un token, una llave o un certificado. */
const LARGO_MAXIMO_MOTIVO = 300;

/**
 * Corta el texto y tapa cualquier corrida larga de caracteres que
 * podría ser un secreto (un token, un hash, un fragmento de llave).
 * Los mensajes que hoy llegan hasta acá —de Supabase o del `connect()`
 * de Node— no traen nada así, pero esto es la red de seguridad para
 * que un error nuevo el día de mañana tampoco pueda colarlo en una
 * columna (`wallet_sincronizaciones.error`) que cualquier admin puede
 * leer.
 */
export function motivoSeguro(texto: string): string {
  return texto
    .slice(0, LARGO_MAXIMO_MOTIVO)
    .replace(/[A-Za-z0-9+/_-]{24,}={0,2}/g, "[omitido]");
}

/** Lo único que se imprime de un trabajo que falló: su id y su correlación — nunca tokens. */
function registrarFallo(job: TrabajoSync, motivo: string): void {
  console.warn(
    `[wallet-sync][apple] trabajo=${job.id} correlacion=${job.correlationId ?? "-"}: ${motivo}`,
  );
}

function dead(job: TrabajoSync, motivo: string): ResultadoSync {
  const seguro = motivoSeguro(motivo);
  registrarFallo(job, seguro);
  return { ok: false, reintentable: false, motivo: seguro };
}

function retryable(job: TrabajoSync, motivo: string): ResultadoSync {
  const seguro = motivoSeguro(motivo);
  registrarFallo(job, seguro);
  return { ok: false, reintentable: true, motivo: seguro };
}

/**
 * Sincroniza UN trabajo de Apple: le avisa al iPhone que su pase
 * cambió. Nunca lanza — todo camino de error vuelve como
 * `ResultadoSync`, que es lo que `marcarResultado()` (worker.ts)
 * necesita para decidir entre reintentar y dar por muerto el trabajo.
 */
export async function sincronizarPaseApple(job: TrabajoSync): Promise<ResultadoSync> {
  // Un trabajo de Google que por un bug de enrutado llegara acá nunca
  // se va a arreglar solo reintentándolo en este adaptador.
  if (job.plataforma !== "apple") {
    return dead(job, `Trabajo de plataforma "${job.plataforma}" enviado al adaptador de Apple.`);
  }

  // Sin certificado no hay con qué hablarle a APNs, y ningún backoff
  // hace aparecer uno: es la misma condición que `generar.ts` reporta
  // como "sin_credenciales" — un fallo de configuración del servidor.
  if (!credencialesDelEntorno()) {
    return dead(job, "Apple Wallet no está configurado en este servidor (faltan APPLE_PASS_*).");
  }

  const db = createAdminClient();
  if (!db) {
    // Puede ser una caída momentánea del propio servicio: el backoff
    // le da tiempo a volver.
    return retryable(job, "No hay conexión de servicio (falta la llave de servicio).");
  }

  // La identidad del pase se LEE, nunca se escribe. serial_number es
  // lo único que hace falta para encontrar sus dispositivos; el resto
  // del pase (authToken, campos del .pkpass) no lo toca este archivo.
  const { data: pase, error: errorPase } = await db
    .from("pases_wallet")
    .select("id, serial_number, plataforma")
    .eq("id", job.paseId)
    .maybeSingle();

  if (errorPase) {
    return retryable(job, `No se pudo leer el pase: ${errorPase.message}`);
  }
  if (!pase || pase.plataforma !== "apple" || typeof pase.serial_number !== "string") {
    // El pase que este trabajo nombra ya no existe como pase de Apple
    // (se borró, cambió de plataforma). No hay nada que reintentar.
    return dead(job, "El pase de Apple que este trabajo nombra ya no existe.");
  }

  const paseParaAvisar: PaseParaAvisar = {
    id: pase.id as string,
    serialNumber: pase.serial_number,
    plataforma: "apple",
    miembroId: job.miembroId,
  };

  // Acá vive TODO el resto: leer registros_dispositivo, llamar a
  // avisarPaseActualizado (mTLS/HTTP2 real, mockeado en las pruebas),
  // y borrar los push_token caducados. Nada de eso se repite acá.
  const resultado = await entregarApple(db, [paseParaAvisar]);
  if (!resultado.ok) {
    // Con credenciales presentes, lo único que puede tirar acá es una
    // conexión que no se pudo hacer o una lectura de Supabase que
    // falló — transitorio por definición.
    return retryable(job, resultado.motivo);
  }

  return { ok: true };
}
