import { connect, constants } from "node:http2";
import { credencialesDelEntorno } from "./firma";

/**
 * Avisarle al iPhone que un pase cambió.
 *
 * Apple no manda el pase nuevo por push: manda un aviso VACÍO, y el
 * teléfono responde pidiendo el pase actualizado a nuestro Web Service.
 * Por eso el payload es `{}` — cualquier contenido se ignora.
 *
 * Tres detalles que no son opcionales:
 *
 *  · Va por HTTP/2. APNs cerró HTTP/1 hace años, así que se usa el
 *    módulo `node:http2` y no `fetch`.
 *
 *  · La autenticación es por CERTIFICADO DE CLIENTE (mTLS), no por
 *    token: el mismo certificado del Pass Type ID que firma el pase.
 *    No hace falta una llave APNs aparte.
 *
 *  · El `apns-topic` es el passTypeIdentifier, no un bundle id de app.
 */

const HOST = "https://api.push.apple.com";

export type ResultadoPush =
  | { ok: true; enviados: number; caducados: string[] }
  | { ok: false; motivo: string };

/**
 * Avisa a todos los dispositivos registrados para un pase.
 *
 * Devuelve los push tokens CADUCADOS (410) para que quien llama los
 * borre: un teléfono que borró el pase sigue en la tabla hasta que
 * alguien lo saque, y reintentarle en cada cambio es trabajo perdido.
 */
export async function avisarPaseActualizado(
  pushTokens: string[],
): Promise<ResultadoPush> {
  if (pushTokens.length === 0) return { ok: true, enviados: 0, caducados: [] };

  const cred = credencialesDelEntorno();
  if (!cred) return { ok: false, motivo: "El pase de Wallet no está configurado." };

  let cliente: ReturnType<typeof connect>;
  try {
    cliente = connect(HOST, {
      cert: cred.certificado,
      key: cred.llave,
    });
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "No se pudo conectar a APNs." };
  }

  const caducados: string[] = [];
  let enviados = 0;

  try {
    await new Promise<void>((listo, falla) => {
      cliente.once("error", falla);
      cliente.once("connect", () => listo());
    });

    // En serie y no en paralelo: son pocos dispositivos por pase (los
    // teléfonos de UN cliente) y la conexión HTTP/2 se reusa igual.
    for (const token of pushTokens) {
      const { estado, cuerpo } = await enviarUno(cliente, token, cred.passTypeIdentifier);
      if (estado === 410) caducados.push(token);
      else if (estado >= 200 && estado < 300) enviados++;
      else {
        // Un 400 BadDeviceToken o 403 BadCertificate tragado en
        // silencio es un pase mudo PARA SIEMPRE sin pista alguna: al
        // log, que es lo único que se mira cuando "no llegó nada".
        console.warn(`[apns] Push rechazado (HTTP ${estado}): ${cuerpo || "sin detalle"}`);
      }
    }
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "Falló el aviso a APNs." };
  } finally {
    cliente.close();
  }

  return { ok: true, enviados, caducados };
}

/**
 * Cuánto tiempo REINTENTA Apple si el teléfono no está disponible en el
 * instante del envío. Seis horas: de sobra para que el aparato vuelva a
 * tener señal o salga del modo de bajo consumo sin acumular una cola
 * eterna de avisos viejos.
 */
const VENTANA_DE_REINTENTO_SEGUNDOS = 6 * 60 * 60;

function enviarUno(
  cliente: ReturnType<typeof connect>,
  token: string,
  topic: string,
): Promise<{ estado: number; cuerpo: string }> {
  return new Promise((listo) => {
    const peticion = cliente.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
      "apns-topic": topic,
      // El pase no es urgente ni hace ruido: que el sistema lo agrupe
      // cuando le convenga en vez de despertar la pantalla.
      "apns-push-type": "background",
      "apns-priority": "5",
      // SIN esto, Apple entrega UNA vez y si el teléfono no está
      // disponible en ese instante preciso (sin señal, bloqueado, en
      // bajo consumo) lo descarta para siempre — nunca reintenta, y
      // acá no queda ningún rastro de que pasó: el aviso sale con 200
      // ("lo acepté") y el teléfono simplemente nunca se entera. Con
      // un vencimiento en el futuro, Apple lo GUARDA y reintenta la
      // entrega dentro de esa ventana en vez de tirarlo al primer
      // intento fallido.
      "apns-expiration": String(Math.floor(Date.now() / 1000) + VENTANA_DE_REINTENTO_SEGUNDOS),
      "content-type": "application/json",
    });

    let estado = 0;
    let cuerpo = "";
    peticion.on("response", (cabeceras) => {
      estado = Number(cabeceras[constants.HTTP2_HEADER_STATUS]) || 0;
    });
    // El cuerpo trae la razón del rechazo ({"reason":"BadDeviceToken"}).
    peticion.on("data", (pedazo) => {
      if (cuerpo.length < 500) cuerpo += String(pedazo);
    });
    peticion.on("end", () => listo({ estado, cuerpo }));
    peticion.on("error", () => listo({ estado: 0, cuerpo: "error de conexión" }));

    // Vacío A PROPÓSITO: Apple ignora el contenido y el teléfono
    // responde pidiendo el pase actualizado.
    peticion.end("{}");
  });
}
