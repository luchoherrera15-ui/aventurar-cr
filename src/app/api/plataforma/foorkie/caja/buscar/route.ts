import { responder } from "@/lib/plataforma/foorkie-api";
import {
  abrirLaCaja,
  clienteDeLaCaja,
  leerPedidoBuscar,
  miembroDelCorreo,
  miembroPorCodigo,
  miembroPorId,
} from "@/lib/plataforma/foorkie-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/caja/buscar — la caja de Foorkie encuentra
 * al cliente: por lo que leyó la cámara del pase del Wallet, por su
 * correo, o por su `miembro_id` cuando lo eligió de las sugerencias por
 * nombre (`clientes` con `buscar: "ana"`). Ver
 * `src/lib/plataforma/foorkie-caja.ts`.
 *
 *   { rancho_id, programa_id, codigo?: texto crudo del QR (≤ 500), correo?,
 *     miembro_id?: uuid }
 *   — exactamente uno de los tres — firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, cliente: { miembro_id, nombre, correo, tipo, saldo,
 *         pausada, textos, progreso, recompensas: [{ id, nombre, costo, alcanza }] } }
 *   200 { ok: false, codigo: "no_miembro", motivo }      ese correo no tiene esta tarjeta
 *   200 { ok: false, codigo: "no_encontrado", motivo }   el código no es una tarjeta, el
 *       `miembro_id` no es de ESTA tarjeta (no existe, o es de otra: es la misma
 *       respuesta), o la tarjeta está dada de baja
 *   200 { ok: false, codigo: "tarjeta_ajena", motivo }   el pase escaneado es de otro
 *       negocio, o de otra tarjeta de este
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
      : pedido.correo !== null
        ? await miembroDelCorreo(db, pedido.ranchoId, pedido.programaId, pedido.correo)
        : await miembroPorId(db, pedido.programaId, pedido.miembroId);
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
