import { canjearCore, canjearMontoCore } from "@/lib/lealtad/operar-core";
import { motivoCanjeLibre, referenciaCanjeLibre } from "@/lib/lealtad/canje-libre";
import { responder } from "@/lib/plataforma/foorkie-api";
import { localDeFoorkieDeLaTarjeta } from "@/lib/plataforma/foorkie-marca";
import {
  abrirLaCaja,
  codigoDeRechazo,
  leerPedidoCanjear,
  miembroDeLaTarjeta,
  PERMISOS_CAJA,
  productoDeLaCaja,
} from "@/lib/plataforma/foorkie-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/caja/canjear — la caja de Foorkie le
 * entrega un premio al cliente, o le descuenta el monto de cashback que
 * quiere usar. Ver `src/lib/plataforma/foorkie-caja.ts`.
 *
 * ── UN PREMIO ───────────────────────────────────────────────────────
 *   { rancho_id, programa_id, miembro_id, recompensa_id, intento_id: uuid,
 *     operador? (se acepta, pero un canje de premio no tiene dónde guardarlo) }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, saldo, recompensa, instrucciones }
 *   200 { ok: false, codigo, motivo }   saldo insuficiente, agotado, fuera
 *       de horario, `recompensa_ajena`, `miembro_ajeno`… y `ya-canjeado`:
 *       ese intento YA se entregó (un reintento), no se cobró dos veces.
 *
 * ── UN MONTO DEL CASHBACK (0253, canje libre: solo tarjetas de Foorkie) ──
 *   { rancho_id, programa_id, miembro_id, monto: colones enteros (1..10.000.000),
 *     intento_id: uuid, operador?: quién operó en Foorkie (≤ 80) }
 *   — `monto` o `recompensa_id`, nunca los dos —
 *
 *   200 { ok: true, tipo: "monto", monto, saldo, ya_estaba }
 *       `ya_estaba: true` = ese intento ya se había usado: NO se descontó
 *       de nuevo (`monto` es lo que usó ese intento).
 *   200 { ok: false, codigo, motivo[, saldo | minimo] }
 *       saldo_insuficiente (+ saldo) · debajo_del_minimo (+ minimo) ·
 *       canje_no_libre (la tarjeta no es de cashback libre, o no es de
 *       Foorkie) · programa_no_opera · programa_archivado · fuera_de_vigencia ·
 *       dia_no_permitido · fuera_de_horario · verificacion_pendiente ·
 *       membresia_inactiva · miembro_ajeno · sin_migracion (falta la 0253:
 *       no se hizo nada) · error_base (no se sabe: reintentar con el MISMO
 *       intento_id, que no descuenta dos veces)
 *
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado
 *
 * ESTE ARCHIVO NO DECIDE NADA: la tenencia, las reglas de la tarjeta, el
 * débito bajo lock, la idempotencia y el aviso al Wallet son de
 * `canjearCore` / `canjearMontoCore`. Las referencias las arma Bookea:
 * `canje:<miembro>:<recompensa>:<intento>` y `canje:<miembro>:cashback:<intento>`.
 */
export async function POST(request: Request) {
  const caja = await abrirLaCaja(request, leerPedidoCanjear);
  if (!caja.ok) return caja.respuesta;
  const { db, pedido, duenoId } = caja;

  // De ESTA tarjeta; y como el núcleo exige que el premio sea de la
  // tarjeta del miembro, el premio también queda atado a esta.
  const miembro = await miembroDeLaTarjeta(db, pedido.programaId, pedido.miembroId);
  if (!miembro) return responder({ ok: false, codigo: "miembro_ajeno", motivo: "Ese cliente no tiene esta tarjeta." });

  if (pedido.monto !== undefined) {
    // El dinero no se mueve por un campo de un jsonb: la tarjeta tiene que
    // tener la marca de Foorkie (`lealtad_por_foorkie`), además del canje
    // libre en su beneficio (eso lo mira el núcleo, y el RPC bajo lock).
    const local = await localDeFoorkieDeLaTarjeta(db, { programaId: pedido.programaId, ranchoId: pedido.ranchoId });
    if (!local) {
      return responder({
        ok: false,
        codigo: "canje_no_libre",
        motivo: "Esta tarjeta no usa el cashback en el monto que se quiera: se canjean sus premios.",
      });
    }
    const r = await canjearMontoCore({
      db,
      ranchoId: pedido.ranchoId,
      quien: { usuarioId: duenoId, permisos: PERMISOS_CAJA },
      miembroId: miembro.id,
      monto: pedido.monto,
      referencia: referenciaCanjeLibre(miembro.id, pedido.intentoId),
      motivo: motivoCanjeLibre(productoDeLaCaja(pedido.operador)),
    });
    if (!r.ok) {
      return responder({
        ok: false,
        codigo: codigoDeRechazo(r.codigo),
        motivo: r.motivo,
        ...(r.saldo !== undefined ? { saldo: r.saldo } : {}),
        ...(r.minimo !== undefined ? { minimo: r.minimo } : {}),
      });
    }
    return responder({ ok: true, tipo: "monto", monto: r.monto, saldo: r.saldo, ya_estaba: r.yaEstaba });
  }

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
