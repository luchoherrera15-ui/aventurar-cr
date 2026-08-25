import {
  abrirPuertaApp,
  errorApp,
  jsonApp,
  responderPreflight,
} from "@/lib/lealtad/app-movil/puerta";
import { canjearCore } from "@/lib/lealtad/operar-core";
import { INTENTO_VALIDO } from "@/lib/lealtad/mostrador";

/**
 * ENTREGAR UN PREMIO DESDE LA APP.
 *
 * ── ESTE ARCHIVO NO DECIDE NADA ─────────────────────────────────────
 *
 * La tenencia del miembro y de la recompensa, las reglas de la tarjeta
 * (0136), la constancia del intento (0137), el RPC, el evento para el
 * POS y el aviso al Wallet viven en `@/lib/lealtad/operar-core`, que es
 * exactamente el mismo código que corre el panel web.
 *
 * REGLA DE REVISIÓN: si en este archivo aparece `rpc("canjear_recompensa"`,
 * el núcleo no se extrajo bien y hay dos copias de las reglas que
 * deciden si el premio sale.
 *
 * ── EL PERMISO ES `canjear`, NO `acreditar` ─────────────────────────
 *
 * Son dos permisos distintos del checklist de la 0127 y se reparten a
 * propósito: hay locales donde el que sella es cualquiera del turno y
 * el que entrega el premio es solo el encargado. Pedir `acreditar` acá
 * habría fusionado los dos roles en uno, en silencio.
 *
 * ── EL `intentoId` ES OBLIGATORIO, Y ESO ES LO QUE SALVA EL PREMIO ──
 *
 * Sin él la llave del canje cae a `llaveDeCanje`, que lleva el MINUTO DE
 * CALENDARIO adentro — y ese minuto falla en las dos direcciones: dos
 * toques a las 14:28:59 y a las 14:29:01 caen en minutos distintos, pasan
 * los dos y el cliente se lleva DOS premios por un solo saldo. El único
 * que rebota el segundo es el índice `canjes_referencia_unica` (0125:207),
 * y solo rebota si las dos referencias son idénticas.
 *
 * Por eso acá se responde 400 sin tocar la base cuando falta o viene
 * con forma rara. El teléfono genera el intento UNA vez por operación y
 * lo reusa en los reintentos por señal mala: eso es lo que hace que el
 * reintento sea seguro, y lo que sostiene que el rate limit de la puerta
 * pueda fallar cerrado.
 *
 * ── LA REFERENCIA LA ARMA EL SERVIDOR ───────────────────────────────
 *
 * El cuerpo NO acepta `referencia`. Aceptarla cruda dejaría mandar
 * `api:tiquete-2026-0001` y quemar de antemano la llave del integrador
 * de punto de venta, haciendo rebotar su canje legítimo. Si viene, se
 * ignora en silencio.
 *
 * El prefijo `canje:` es el que el resto del módulo ya escribe, así que
 * la auditoría no ve una forma nueva que no sepa leer.
 */

export const OPTIONS = responderPreflight;

type Cuerpo = {
  ranchoId?: unknown;
  miembroId?: unknown;
  recompensaId?: unknown;
  intentoId?: unknown;
};

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export async function POST(req: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await req.json()) as Cuerpo;
  } catch {
    return jsonApp({ ok: false, motivo: "Cuerpo inválido." }, 400);
  }

  const ranchoId = texto(cuerpo.ranchoId) ?? "";
  const miembroId = texto(cuerpo.miembroId);
  const recompensaId = texto(cuerpo.recompensaId);
  const intentoId = texto(cuerpo.intentoId);

  if (!miembroId || !recompensaId) {
    return jsonApp({ ok: false, motivo: "Falta el cliente o el premio." }, 400);
  }

  if (!intentoId || !INTENTO_VALIDO.test(intentoId)) {
    return jsonApp({ ok: false, motivo: "Falta el identificador del intento." }, 400);
  }

  const puerta = await abrirPuertaApp(req, { ranchoId, permiso: "canjear", escribe: true });
  if (!puerta.ok) return puerta.respuesta;

  const resultado = await canjearCore({
    db: puerta.db,
    ranchoId,
    quien: { usuarioId: puerta.usuarioId, permisos: puerta.permisos },
    miembroId,
    recompensaId,
    // Los tres datos que identifican ESTE intento y ningún otro. Dos
    // toques del mismo botón mandan el mismo `intentoId` y producen la
    // misma referencia: el segundo choca contra el índice único y no
    // escribe. Un intento nuevo es una operación nueva, aunque caiga en
    // el mismo segundo.
    referencia: `canje:${miembroId}:${recompensaId}:${intentoId}`,
  });

  if (!resultado.ok) return errorApp(resultado);

  return jsonApp(resultado);
}
