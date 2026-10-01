import { acreditarPorMiembroCore } from "@/lib/lealtad/operar-core";
import { responder } from "@/lib/plataforma/foorkie-api";
import {
  abrirLaCaja,
  codigoDeRechazo,
  leerPedidoAcreditar,
  miembroDeLaTarjeta,
  PERMISOS_CAJA,
  productoDeLaCaja,
  quienesSon,
  type QuienEs,
} from "@/lib/plataforma/foorkie-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/caja/acreditar — la caja de Foorkie le
 * suma al cliente la compra (o la visita) que tiene enfrente. Ver
 * `src/lib/plataforma/foorkie-caja.ts`.
 *
 *   { rancho_id, programa_id, miembro_id, monto: colones enteros | null,
 *     intento_id: uuid, operador?: quién operó en Foorkie (≤ 80) }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, puntos, saldo, ya_estaba, tipo, cliente }
 *       `ya_estaba: true` = ese intento ya había entrado: NO se sumó nada
 *       de nuevo (`puntos: 0`), y así se tiene que pintar.
 *   200 { ok: false, codigo, motivo }   el motor dijo que no (monto mínimo,
 *       tope del día, tarjeta en pausa, `miembro_ajeno`, `monto_invalido`…)
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado
 *
 * ESTE ARCHIVO NO CALCULA NADA: la regla de acumulación, los topes, el
 * registro de la compra, el aviso al Wallet y el correo son de
 * `acreditarPorMiembroCore`, el mismo núcleo de la caja del teléfono. La
 * vía es «mostrador» y la referencia `mostrador:<miembro>:<intento>` la
 * arma Bookea: un reintento con el mismo `intento_id` no suma dos veces.
 */
export async function POST(request: Request) {
  const caja = await abrirLaCaja(request, leerPedidoAcreditar);
  if (!caja.ok) return caja.respuesta;
  const { db, pedido, duenoId } = caja;

  // De ESTA tarjeta, no solo de este negocio (el núcleo mira el negocio).
  const miembro = await miembroDeLaTarjeta(db, pedido.programaId, pedido.miembroId);
  if (!miembro) return responder({ ok: false, codigo: "miembro_ajeno", motivo: "Ese cliente no tiene esta tarjeta." });

  const [r, quien] = await Promise.all([
    acreditarPorMiembroCore({
      db,
      ranchoId: pedido.ranchoId,
      quien: { usuarioId: duenoId, permisos: PERMISOS_CAJA },
      monto: pedido.monto,
      // El único texto libre que el motor guarda: el concepto de la compra.
      producto: productoDeLaCaja(pedido.operador),
      miembroId: miembro.id,
      referencia: `mostrador:${miembro.id}:${pedido.intentoId}`,
      via: "mostrador",
    }),
    // Solo para el saludo: si falla, la compra que ya entró no puede volverse un 500.
    quienesSon(db, pedido.ranchoId, [miembro]).catch(() => new Map<string, QuienEs>()),
  ]);

  if (!r.ok) return responder({ ok: false, codigo: codigoDeRechazo(r.codigo), motivo: r.motivo });
  return responder({
    ok: true,
    puntos: r.puntos,
    saldo: r.saldo,
    ya_estaba: r.yaEstaba,
    tipo: r.tipo,
    // El nombre de pila, nunca el título del panel (que sin nombre es el correo o el teléfono).
    cliente: quien.get(miembro.id)?.nombre ?? "Cliente",
  });
}
