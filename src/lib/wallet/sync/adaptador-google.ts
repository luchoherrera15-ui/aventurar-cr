import { createAdminClient } from "@/lib/supabase/admin";
import {
  enviarMensajeGoogle,
  refrescarPaseGoogleDeMiembro,
  type ResultadoRefresco,
} from "../google";
import type { ResultadoSync, TrabajoSync } from "./tipos";

/**
 * EL ADAPTADOR DE GOOGLE del worker de sincronización (Wallet V2).
 *
 * Traduce UN `TrabajoSync` (una fila de `wallet_sincronizaciones`, 0161)
 * en una llamada real a Google Wallet, y traduce lo que Google contesta
 * de vuelta al contrato `ResultadoSync` que `worker.ts` necesita para
 * decidir `succeeded` / `retryable` / `dead` (`marcarResultado`).
 *
 * ------------------------------------------------------------------
 * ENVUELVE `google.ts`, NO REIMPLEMENTA SU AUTENTICACIÓN
 * ------------------------------------------------------------------
 * Este archivo NO firma JWT, NO pide tokens OAuth y NO arma el cuerpo
 * del `LoyaltyObject` a mano: todo eso ya existe en `../google.ts`
 * (`credencialesGoogleDelEntorno`, `firmarJwt`, `contenidoDelObjeto`,
 * `llamarApi`) y NO se toca — el plan de arquitectura de este worker
 * es explícito en que ningún archivo existente se modifica. Los dos
 * únicos puntos de entrada de red que usa este adaptador son
 * `refrescarPaseGoogleDeMiembro` y `enviarMensajeGoogle`, los mismos
 * que ya usan `aviso-de-pausa.ts` y `aviso-de-diseno.ts` en producción.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO NO PUEDE "PISAR" `textModulesData`/`imageModulesData`/
 * `linksModuleData`/`barcode`
 * ------------------------------------------------------------------
 * La API de Google Wallet trata el PATCH de un `LoyaltyObject` como un
 * merge: los campos que NO viajan en el cuerpo del PATCH quedan
 * intactos en el objeto remoto (documentado por Google; no es una
 * suposición de este archivo). `contenidoDelObjeto` (google.ts) arma
 * ese cuerpo con una lista MUY corta y explícita —
 * `loyaltyPoints` siempre, `textModulesData`/`heroImage` solo cuando
 * hay algo que decir— y nunca incluye `barcode`, `classId`,
 * `accountId`, `imageModulesData` ni `linksModuleData`: como esos
 * campos jamás viajan en el PATCH, Google nunca los toca. Es la
 * propiedad que prueba `adaptador-google.test.ts` (describe
 * "el PATCH nunca pisa lo que no manda") construyendo un objeto remoto
 * de mentira con esos cuatro campos puestos y comprobando que
 * sobreviven a la fusión.
 *
 * ------------------------------------------------------------------
 * EL "FENCING" DE VERSIÓN (`versionLocalEsperada`)
 * ------------------------------------------------------------------
 * `wallet_encolar_sincronizacion` (0161/0164) sube
 * `pases_wallet.update_tag` en cada cambio real y guarda ESE número en
 * `version_local_esperada` de la fila que encola. Si para cuando este
 * trabajo se procesa el pase YA subió de versión de nuevo —otro cambio
 * lo superó mientras esperaba en cola—, mandar el contenido de ESTE
 * intento sería mandar algo VIEJO encima de algo más nuevo. Por eso,
 * antes de tocar la red, se relee `update_tag` y si no coincide el
 * trabajo se da por `ok:true` sin llamar a Google: no hizo falta nada,
 * porque el trabajo que sí importa (el de la versión actual) ya corrió
 * o va a correr por su cuenta.
 *
 * ------------------------------------------------------------------
 * NUNCA TOCA EL LEDGER
 * ------------------------------------------------------------------
 * Las únicas escrituras de este archivo son las que YA hacían
 * `refrescarPaseGoogleDeMiembro`/`enviarMensajeGoogle` (el espejo
 * `pases_wallet.saldo_cache`) y, acá mismo, ninguna — la única consulta
 * propia (`pases_wallet.update_tag`, `programa_lealtad.mensaje_promocional`)
 * es de LECTURA. `transacciones_puntos` no aparece en este archivo.
 * `wallet_sincronizaciones` tampoco: reclamar el trabajo, moverlo a
 * `processing` y decidir su estado final es responsabilidad de
 * `worker.ts` — este adaptador no lee ni escribe esa tabla.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export async function sincronizarPaseGoogle(job: TrabajoSync): Promise<ResultadoSync> {
  try {
    if (job.plataforma !== "google") {
      // Defensivo: `worker.ts` es quien decide a qué adaptador manda
      // cada trabajo según `job.plataforma` — si esto se llama con un
      // trabajo de Apple es un error de cableado, no algo que
      // reintentar solo. Nunca debería pasar en producción.
      return {
        ok: false,
        reintentable: false,
        motivo: `sincronizarPaseGoogle recibió un trabajo de plataforma "${job.plataforma}".`,
      };
    }

    const db = createAdminClient();
    if (!db) {
      // Sin llave de servicio no es un trabajo malo, es un servidor sin
      // configurar — se reintenta porque puede arreglarse solo el día
      // que la variable se agregue, sin tener que revivir el trabajo a
      // mano.
      return {
        ok: false,
        reintentable: true,
        motivo: "No hay conexión de servicio (falta la llave de servicio).",
      };
    }

    if (!(await intentoSigueVigente(db, job))) {
      return { ok: true }; // superado por un cambio más nuevo del mismo pase
    }

    switch (job.operacion) {
      case "saldo":
      case "diseno":
      case "pausa":
        // Las tres reusan el MISMO refresco: `contenidoDelObjeto`
        // (google.ts) ya sabe, a partir de la config y el estado
        // actuales, qué saldo/módulo/pausa corresponde — pedirle un
        // camino distinto por operación duplicaría esa lectura acá,
        // con el riesgo real de que un pase diga una cosa distinta
        // según qué operación lo tocó por última vez.
        return clasificarRefresco(await refrescarPaseGoogleDeMiembro(job.miembroId));
      case "mensaje_promocional":
        return await sincronizarMensajePromocional(db, job);
      default: {
        // Exhaustividad: si `OperacionSync` gana un valor nuevo, esto
        // deja de compilar acá en vez de caer en un `default` mudo.
        const nuncaLlega: never = job.operacion;
        return {
          ok: false,
          reintentable: false,
          motivo: `Operación de sync desconocida: ${String(nuncaLlega)}.`,
        };
      }
    }
  } catch (e) {
    // Ni `refrescarPaseGoogleDeMiembro` ni `enviarMensajeGoogle` lanzan
    // (los dos se tragan sus propios errores), pero las dos consultas
    // propias de este archivo sí podrían — un trabajo de sync nunca
    // puede tumbar el ciclo entero del worker por una excepción sin
    // atrapar.
    return { ok: false, reintentable: true, motivo: sanitizarMotivo(mensajeDeError(e)) };
  }
}

/**
 * ¿Este intento sigue reflejando la versión más reciente del pase?
 *
 * `null` en `versionLocalEsperada` significa que el trabajo no pidió
 * fencing (compatibilidad con filas viejas o con quien encola sin
 * conocer el `update_tag`) — se procesa igual. Si la consulta falla
 * (columna faltante en un entorno sin la 0161/0164 corrida, error de
 * red puntual) NO se descarta el trabajo por las dudas: es preferible
 * un PATCH de más que perder un cambio real de silencio.
 */
async function intentoSigueVigente(db: Admin, job: TrabajoSync): Promise<boolean> {
  if (job.versionLocalEsperada === null) return true;

  const { data, error } = await db
    .from("pases_wallet")
    .select("update_tag")
    .eq("id", job.paseId)
    .maybeSingle();
  if (error || !data) return true;

  return (data.update_tag as number) === job.versionLocalEsperada;
}

/**
 * EL AVISO DE MARKETING (0152) por este camino.
 *
 * El texto del mensaje NO viaja en la fila de `wallet_sincronizaciones`
 * —no tiene columna para eso, y no debería: el mensaje es del
 * PROGRAMA, no de un intento puntual, y un mismo mensaje puede generar
 * un trabajo por cada pase Google del programa— así que se lee de
 * `programa_lealtad.mensaje_promocional`, la misma columna que ya
 * llena `enviarMensajePromocional` (mensaje-promocional.ts) cuando el
 * dueño lo escribe.
 */
async function sincronizarMensajePromocional(db: Admin, job: TrabajoSync): Promise<ResultadoSync> {
  const { data, error } = await db
    .from("programa_lealtad")
    .select("mensaje_promocional")
    .eq("id", job.programaId)
    .maybeSingle();
  if (error) {
    return { ok: false, reintentable: true, motivo: sanitizarMotivo(error.message) };
  }

  const mensaje = ((data?.mensaje_promocional as string | null) ?? "").trim();
  if (!mensaje) return { ok: true }; // se limpió el mensaje, o nunca hubo uno: nada que mandar

  return clasificarRefresco(await enviarMensajeGoogle(job.miembroId, mensaje));
}

// ── Clasificación: succeeded / retryable / dead ────────────────────────

function clasificarRefresco(r: ResultadoRefresco): ResultadoSync {
  return r.ok ? { ok: true } : clasificarMotivoGoogle(r.motivo);
}

/**
 * `refrescarPaseGoogleDeMiembro`/`enviarMensajeGoogle` (google.ts) no
 * exponen el código HTTP como un campo aparte — lo dejan escrito
 * adentro del `motivo` ("Google respondió 409 al parchar el objeto.").
 * Leerlo de ahí, en vez de reimplementar la llamada a la API para
 * obtener el `status` como un valor propio, es el precio de envolver
 * `google.ts` en vez de duplicar su capa de red (ver el comentario del
 * archivo). Sigue siendo información real y suficiente para las cuatro
 * distinciones que este worker necesita.
 *
 * Exportada para poder probar las cuatro clasificaciones (401/404/
 * 409/429) sin mockear la red: son puras, `motivo adentro → decisión
 * afuera`.
 */
export function clasificarMotivoGoogle(motivoCrudo: string): ResultadoSync {
  const motivo = sanitizarMotivo(motivoCrudo);
  const status = extraerStatusHttp(motivo);

  if (status === 401) {
    // Credenciales o permisos del Issuer — no se arregla solo
    // reintentando el mismo trabajo.
    return {
      ok: false,
      reintentable: false,
      motivo: `Google rechazó la credencial (401): ${motivo}`,
    };
  }

  if (status === 404) {
    // El objeto remoto no existe. Este worker SOLO sincroniza —crear
    // el objeto es `generarPaseGoogle`, un camino distinto, disparado
    // por el cliente que pide su pase— así que no hay nada que este
    // trabajo pueda hacer reintentando: se da por muerto para no
    // quedarse insistiendo para siempre sobre un objeto que nadie va a
    // crear desde acá.
    //
    // (En la práctica, `refrescarPaseGoogleDeMiembro`/
    // `enviarMensajeGoogle` ya tratan un 404 remoto como `ok:true`
    // —"pase huérfano, nada que sincronizar"— así que esta rama no se
    // alcanza HOY a través de esos dos caminos; se deja escrita porque
    // es el comportamiento correcto si algún día se envuelve una
    // llamada que sí distinga el 404 como fallo.)
    return {
      ok: false,
      reintentable: false,
      motivo: `El objeto de Google no existe (404): ${motivo}`,
    };
  }

  if (status === 409 || status === 429) {
    // 409 = choque de versión/concurrencia; 429 = cuota. Los dos se
    // arreglan solos con el backoff de `worker.ts` — no hay cuota
    // documentada por Google en la capa de arriba (google.ts), así que
    // acá es donde ese caso se atiende.
    return { ok: false, reintentable: true, motivo };
  }

  if (status !== null && status >= 500) {
    return { ok: false, reintentable: true, motivo };
  }

  if (status !== null && status >= 400) {
    // Otro 4xx (400, 403...): Google rechazó el DATO que se mandó.
    // Reintentar con el mismo payload no lo arregla.
    return { ok: false, reintentable: false, motivo };
  }

  // Sin código HTTP reconocible: red caída, DNS, timeout, OAuth sin
  // configurar. Todo transitorio o corregible sin tocar este trabajo
  // puntual — se reintenta.
  return { ok: false, reintentable: true, motivo };
}

const PATRON_STATUS_HTTP = /respondió (\d{3})/;

function extraerStatusHttp(motivo: string): number | null {
  const m = motivo.match(PATRON_STATUS_HTTP);
  return m ? Number(m[1]) : null;
}

/**
 * Nunca debería hacer falta —ni `google.ts` ni este archivo imprimen
 * la llave privada de la cuenta de servicio en un mensaje de error—
 * pero es la última barrera antes de que un `motivo` termine en
 * `wallet_sincronizaciones.error` (una columna que sí se puede leer
 * desde un panel de diagnóstico): si alguna vez un error de red trae
 * pegado un bloque PEM o un bearer token, no sale de acá.
 */
function sanitizarMotivo(motivo: string): string {
  return motivo
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[clave omitida]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [token omitido]")
    .slice(0, 500);
}

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : "Google Wallet no respondió.";
}
