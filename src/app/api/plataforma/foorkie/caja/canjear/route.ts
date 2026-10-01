import { canjearCore } from "@/lib/lealtad/operar-core";
import { responder } from "@/lib/plataforma/foorkie-api";
import {
  abrirLaCaja,
  codigoDeRechazo,
  leerPedidoCanjear,
  miembroDeLaTarjeta,
  PERMISOS_CAJA,
} from "@/lib/plataforma/foorkie-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/caja/canjear — la caja de Foorkie le
 * entrega un premio al cliente. Ver `src/lib/plataforma/foorkie-caja.ts`.
 *
 *   { rancho_id, programa_id, miembro_id, recompensa_id, intento_id: uuid,
 *     operador? (se acepta, pero un canje no tiene dónde guardarlo) }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, saldo, recompensa, instrucciones }
 *   200 { ok: false, codigo, motivo }   saldo insuficiente, agotado, fuera
 *       de horario, `recompensa_ajena`, `miembro_ajeno`… y `ya-canjeado`:
 *       ese intento YA se entregó (un reintento), no se cobró dos veces.
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado
 *
 * ESTE ARCHIVO NO DECIDE NADA: la tenencia del premio, las reglas de la
 * tarjeta, el débito bajo lock, la constancia del intento y el aviso al
 * Wallet son de `canjearCore`. La referencia
 * `canje:<miembro>:<recompensa>:<intento>` la arma Bookea.
 */
export async function POST(request: Request) {
  const caja = await abrirLaCaja(request, leerPedidoCanjear);
  if (!caja.ok) return caja.respuesta;
  const { db, pedido, duenoId } = caja;

  // De ESTA tarjeta; y como el núcleo exige que el premio sea de la
  // tarjeta del miembro, el premio también queda atado a esta.
  const miembro = await miembroDeLaTarjeta(db, pedido.programaId, pedido.miembroId);
  if (!miembro) return responder({ ok: false, codigo: "miembro_ajeno", motivo: "Ese cliente no tiene esta tarjeta." });

  const r = await canjearCore({
    db,
    ranchoId: pedido.ranchoId,
    quien: { usuarioId: duenoId, permisos: PERMISOS_CAJA },
    miembroId: miembro.id,
    recompensaId: pedido.recompensaId,
    referencia: `canje:${miembro.id}:${pedido.recompensaId}:${pedido.intentoId}`,
  });

  if (!r.ok) return responder({ ok: false, codigo: codigoDeRechazo(r.codigo), motivo: r.motivo });
  return responder({ ok: true, saldo: r.saldo, recompensa: r.recompensa, instrucciones: r.instrucciones });
}
