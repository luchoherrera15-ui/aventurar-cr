import {
  abrirPuertaApp,
  errorApp,
  jsonApp,
  responderPreflight,
} from "@/lib/lealtad/app-movil/puerta";
import {
  acreditarPorMiembroCore,
  acreditarPorSerialCore,
} from "@/lib/lealtad/operar-core";
import { INTENTO_VALIDO } from "@/lib/lealtad/mostrador";

/**
 * DAR UN SELLO DESDE LA APP — escaneando el QR o buscando por nombre.
 *
 * ── ESTE ARCHIVO NO CALCULA NADA ────────────────────────────────────
 *
 * Toda la lógica —la regla de acumulación, la cadena de tenencia, el
 * RPC, el registro comercial, el aviso al Wallet, el correo de hito—
 * vive en `@/lib/lealtad/operar-core`, que es exactamente el mismo
 * código que corre el mostrador web.
 *
 * REGLA DE REVISIÓN: si en este archivo aparece `rpc("acreditar_lealtad"`
 * o `sellosPorCompra(`, el núcleo no se extrajo bien y hay dos copias de
 * las reglas que mueven saldo.
 *
 * ── EL `intentoId` ES OBLIGATORIO ACÁ, Y EN LA WEB NO ───────────────
 *
 * El panel web todavía tiene caminos que caen a una llave con el MINUTO
 * DE CALENDARIO adentro, y esa llave está rota en las dos direcciones:
 * dos ventas reales a las 14:28:01 y 14:28:59 se colapsan en una, y dos
 * toques a las 14:28:59 y 14:29:01 pasan los dos. Verificado en
 * producción.
 *
 * La app nace sin esa deuda: sin `intentoId` válido se responde 400 y no
 * se toca la base. Es lo que hace que el reintento por señal mala sea
 * seguro — y lo que sostiene que el rate limit pueda fallar cerrado.
 *
 * ── LA REFERENCIA LA ARMA EL SERVIDOR ───────────────────────────────
 *
 * El cuerpo NO acepta `referencia`. Aceptarla cruda dejaría mandar
 * `api:tiquete-2026-0001` y quemar de antemano la llave del integrador
 * de punto de venta, haciendo rebotar su sello legítimo. Si viene, se
 * ignora en silencio.
 */

export const OPTIONS = responderPreflight;

type Cuerpo = {
  ranchoId?: unknown;
  serial?: unknown;
  miembroId?: unknown;
  monto?: unknown;
  intentoId?: unknown;
  producto?: unknown;
  productoId?: unknown;
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
  const serial = texto(cuerpo.serial);
  const miembroId = texto(cuerpo.miembroId);
  const intentoId = texto(cuerpo.intentoId);

  // EXACTAMENTE UNO de los dos. Los dos juntos obligarían a elegir, y
  // elegir en silencio es cómo se acredita a quien no era: el empleado
  // buscó a María, escaneó por error la tarjeta de Juan, y el servidor
  // decide por su cuenta cuál gana.
  if ((serial && miembroId) || (!serial && !miembroId)) {
    return jsonApp({ ok: false, motivo: "Mandá el escaneo o el cliente, no los dos." }, 400);
  }

  if (!intentoId || !INTENTO_VALIDO.test(intentoId)) {
    return jsonApp({ ok: false, motivo: "Falta el identificador del intento." }, 400);
  }

  // El monto: entero o nada. `null` = visita sin monto.
  const monto =
    cuerpo.monto === null || cuerpo.monto === undefined ? null : Number(cuerpo.monto);
  if (monto !== null && !Number.isFinite(monto)) {
    return jsonApp({ ok: false, motivo: "El monto no es un número." }, 400);
  }

  const puerta = await abrirPuertaApp(req, { ranchoId, permiso: "acreditar", escribe: true });
  if (!puerta.ok) return puerta.respuesta;

  const comun = {
    db: puerta.db,
    ranchoId,
    quien: { usuarioId: puerta.usuarioId, permisos: puerta.permisos },
    monto,
    producto: texto(cuerpo.producto),
    productoId: texto(cuerpo.productoId),
  };

  const resultado = serial
    ? await acreditarPorSerialCore({ ...comun, serial, intentoId })
    : await acreditarPorMiembroCore({
        ...comun,
        miembroId: miembroId as string,
        // El prefijo `mostrador:` es uno de los que `canal-del-sello`
        // YA conoce, así que la pantalla de Actividad lo etiqueta bien
        // sin tocar una línea. Un prefijo nuevo tipo `app:` caería al
        // descarte y el movimiento aparecería mal atribuido.
        referencia: `mostrador:${miembroId}:${intentoId}`,
        via: "mostrador",
      });

  if (!resultado.ok) return errorApp(resultado);

  return jsonApp(resultado);
}
