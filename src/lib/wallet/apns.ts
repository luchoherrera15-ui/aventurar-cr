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
      const estado = await enviarUno(cliente, token, cred.passTypeIdentifier);
      if (estado === 410) caducados.push(token);
      else if (estado >= 200 && estado < 300) enviados++;
    }
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "Falló el aviso a APNs." };
  } finally {
    cliente.close();
  }

  return { ok: true, enviados, caducados };
}

function enviarUno(
  cliente: ReturnType<typeof connect>,
  token: string,
  topic: string,
): Promise<number> {
  return new Promise((listo) => {
    const peticion = cliente.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
      "apns-topic": topic,
      // El pase no es urgente ni hace ruido: que el sistema lo agrupe
      // cuando le convenga en vez de despertar la pantalla.
      "apns-push-type": "background",
      "apns-priority": "5",
      "content-type": "application/json",
    });

    let estado = 0;
    peticion.on("response", (cabeceras) => {
      estado = Number(cabeceras[constants.HTTP2_HEADER_STATUS]) || 0;
    });
    // El cuerpo se descarta salvo para no dejar el flujo abierto.
    peticion.on("data", () => {});
    peticion.on("end", () => listo(estado));
    peticion.on("error", () => listo(0));

    // Vacío A PROPÓSITO: Apple ignora el contenido y el teléfono
    // responde pidiendo el pase actualizado.
    peticion.end("{}");
  });
}
