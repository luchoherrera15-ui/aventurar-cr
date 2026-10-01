import { responder } from "@/lib/plataforma/foorkie-api";
import {
  abrirLaCaja,
  clienteDeLaCaja,
  leerPedidoBuscar,
  miembroDelCorreo,
  miembroPorCodigo,
} from "@/lib/plataforma/foorkie-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/caja/buscar — la caja de Foorkie encuentra
 * al cliente: por lo que leyó la cámara del pase del Wallet o por su
 * correo. Ver `src/lib/plataforma/foorkie-caja.ts`.
 *
 *   { rancho_id, programa_id, codigo?: texto crudo del QR (≤ 500), correo? }
 *   — exactamente uno de los dos — firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, cliente: { miembro_id, nombre, correo, tipo, saldo,
 *         pausada, textos, progreso, recompensas: [{ id, nombre, costo, alcanza }] } }
 *   200 { ok: false, codigo: "no_miembro", motivo }      ese correo no tiene esta tarjeta
 *   200 { ok: false, codigo: "no_encontrado", motivo }   el código no es una tarjeta (o está dada de baja)
 *   200 { ok: false, codigo: "tarjeta_ajena", motivo }   es de otro negocio, o de otra tarjeta de este
 *   400 datos · 401 firma · 403 no_vinculado · 500 error_base · 503 no_configurado
 *
 * Solo lee: no afilia a nadie ni toca el saldo.
 */
export async function POST(request: Request) {
  const caja = await abrirLaCaja(request, leerPedidoBuscar);
  if (!caja.ok) return caja.respuesta;
  const { db, pedido } = caja;

  const encontrado =
    pedido.codigo !== null
      ? await miembroPorCodigo(db, pedido.ranchoId, pedido.programaId, pedido.codigo)
      : await miembroDelCorreo(db, pedido.ranchoId, pedido.programaId, pedido.correo);
  if (!encontrado.ok) {
    return responder(
      { ok: false, codigo: encontrado.codigo, motivo: encontrado.motivo },
      encontrado.codigo === "error_base" ? 500 : 200,
    );
  }

  const cliente = await clienteDeLaCaja(db, pedido.ranchoId, pedido.programaId, encontrado.miembro);
  if (!cliente) {
    return responder({ ok: false, codigo: "error_base", motivo: "No pudimos leer la tarjeta del cliente. Probá de nuevo." }, 500);
  }
  return responder({ ok: true, cliente });
}
