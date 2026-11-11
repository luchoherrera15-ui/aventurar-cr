import { acreditarPorMiembroCore, canjearCore } from "@/lib/lealtad/operar-core";
import { hoyISOCR } from "@/lib/fechas";
import { lecturaDeTarjeta, responder } from "@/lib/plataforma/foorkie-api";
import {
  abrirLaCaja,
  beneficioDeUso,
  codigoDeRechazo,
  leerPedidoUsar,
  miembroDeLaTarjeta,
  PERMISOS_CAJA,
  productoDeLaCaja,
  quienesSon,
  recompensasParaCaja,
  TIPOS_DE_USO,
  type QuienEs,
} from "@/lib/plataforma/foorkie-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/caja/usar — la caja de Foorkie registra UN
 * uso de una tarjeta de SOCIO (o de descuento): el cliente presenta su
 * carnet, el cajero le aplica el descuento y lo deja anotado. Ver
 * `src/lib/plataforma/foorkie-caja.ts`.
 *
 * Pedido de Luis (11 nov 2026): las tarjetas de equipo de «Tostado Café
 * Bistró» dan 10 % de descuento CADA VEZ que el socio compra, y cada uso
 * tiene que quedar anotado con su factura y su monto, igual que una suma
 * de puntos.
 *
 *   { rancho_id, programa_id, miembro_id, intento_id: uuid,
 *     operador?: quién operó en Foorkie, con la factura y el monto (≤ 80) }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, ya_estaba, beneficio: { nombre, porcentaje, texto }, usos_total, cliente }
 *       `ya_estaba: true` = ese intento ya se había registrado: NO se
 *       contó otro uso (un reintento de red).
 *   200 { ok: false, codigo, motivo }   `miembro_ajeno`, los rechazos de
 *       las reglas de la tarjeta (fuera de horario, día no permitido…) y
 *       `error_base` (no se sabe: reintentar con el MISMO intento_id).
 *   400 { codigo: "tipo" }       la tarjeta no es de socio ni de descuento:
 *                                esas suman y canjean (`acreditar`, `canjear`).
 *   409 { codigo: "pausada" }    la tarjeta está en pausa, o el cliente suspendido.
 *   409 { codigo: "vencida" }    el beneficio venció (la vigencia del premio).
 *   409 { codigo: "sin_beneficio" } la tarjeta no tiene un premio activo que usar.
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado
 *
 * ── CÓMO SE REGISTRA: EL DERECHO DE USO Y SU CANJE ──────────────────
 * Es exactamente lo que hace el mostrador de Bookea con estas tarjetas
 * (`acumulacionDe` en mostrador.ts): presentar la tarjeta ACREDITA el
 * derecho de uso (1, «Tarjeta presentada (mostrador)», con el operador en
 * el producto) y el canje del premio («Beneficio de socio …», costo 1) lo
 * consume en el mismo acto. Neto cero; en el historial quedan los dos
 * movimientos, y el del operador lleva la factura y el monto.
 *
 * IDEMPOTENTE por `intento_id`: los dos pasos usan sus llaves de siempre
 * (`mostrador:<miembro>:<intento>` y `canje:<miembro>:<premio>:<intento>`),
 * así que un reintento no acredita ni canjea dos veces. Si el primer paso
 * entró y el segundo no (la red se cortó en el medio), el reintento
 * completa solo el que faltó.
 *
 * Los rechazos de pausa, vencimiento y tipo se deciden ANTES de escribir:
 * una tarjeta vencida no deja un derecho de uso colgando.
 */
export async function POST(request: Request) {
  const caja = await abrirLaCaja(request, leerPedidoUsar);
  if (!caja.ok) return caja.respuesta;
  const { db, pedido, duenoId } = caja;

  const miembro = await miembroDeLaTarjeta(db, pedido.programaId, pedido.miembroId);
  if (!miembro) return responder({ ok: false, codigo: "miembro_ajeno", motivo: "Ese cliente no tiene esta tarjeta." });

  const [{ data: fila }, { data: premios }] = await Promise.all([
    // `select *`: hay columnas de reglas y de diseño que una base sin migrar no tiene.
    db.from("programa_lealtad").select("*").eq("id", pedido.programaId).eq("rancho_id", pedido.ranchoId).maybeSingle(),
    db
      .from("recompensas")
      .select("id, nombre, costo_puntos, vigencia_hasta")
      .eq("programa_id", pedido.programaId)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(50),
  ]);
  if (!fila) return responder({ ok: false, codigo: "no_vinculado", motivo: "Esa tarjeta no está vinculada a un local de Foorkie." }, 403);

  const tarjeta = lecturaDeTarjeta({ fila: fila as Record<string, unknown>, negocio: "", saldo: 0, meta: null });
  if (!TIPOS_DE_USO.includes(tarjeta.modo)) {
    return responder(
      { ok: false, codigo: "tipo", motivo: "Esta tarjeta no es de socio ni de descuento: se suma y se canjea." },
      400,
    );
  }
  if (tarjeta.pausada || miembro.estado === "pausada") {
    return responder({ ok: false, codigo: "pausada", motivo: "Esta tarjeta está en pausa: hoy no se puede usar." }, 409);
  }

  // El premio que se canjea en cada uso: el activo más barato (el que
  // sembró el alta, «Beneficio de socio …»), igual que la meta del pase.
  const filas = (premios ?? []) as { id?: unknown; nombre?: unknown; costo_puntos?: unknown; vigencia_hasta?: unknown }[];
  const premio = recompensasParaCaja(filas, 0)[0];
  if (!premio) {
    return responder({ ok: false, codigo: "sin_beneficio", motivo: "Esta tarjeta no tiene un beneficio activo para usar." }, 409);
  }
  const vigencia = filas.find((r) => r.id === premio.id)?.vigencia_hasta;
  if (typeof vigencia === "string" && vigencia.slice(0, 10) < hoyISOCR()) {
    return responder({ ok: false, codigo: "vencida", motivo: "El beneficio de esta tarjeta ya venció." }, 409);
  }

  const quien = { usuarioId: duenoId, permisos: PERMISOS_CAJA };

  // 1) El derecho de uso: presentar la tarjeta.
  const [a, nombres] = await Promise.all([
    acreditarPorMiembroCore({
      db,
      ranchoId: pedido.ranchoId,
      quien,
      monto: null,
      producto: productoDeLaCaja(pedido.operador),
      miembroId: miembro.id,
      referencia: `mostrador:${miembro.id}:${pedido.intentoId}`,
      via: "mostrador",
    }),
    quienesSon(db, pedido.ranchoId, [miembro]).catch(() => new Map<string, QuienEs>()),
  ]);
  if (!a.ok) return responder({ ok: false, codigo: codigoDeRechazo(a.codigo), motivo: a.motivo });

  // 2) Su canje, en el mismo acto.
  const c = await canjearCore({
    db,
    ranchoId: pedido.ranchoId,
    quien,
    miembroId: miembro.id,
    recompensaId: premio.id,
    referencia: `canje:${miembro.id}:${premio.id}:${pedido.intentoId}`,
  });
  // «ya-canjeado» = ESTE intento ya se había canjeado: es el reintento de
  // un uso que ya quedó, no un rechazo.
  const yaCanjeado = !c.ok && c.codigo === "ya-canjeado";
  if (!c.ok && !yaCanjeado) return responder({ ok: false, codigo: codigoDeRechazo(c.codigo), motivo: c.motivo });

  const { count } = await db
    .from("transacciones_puntos")
    .select("id", { count: "exact", head: true })
    .eq("miembro_id", miembro.id)
    .eq("tipo", "canjeado");

  return responder({
    ok: true,
    ya_estaba: a.yaEstaba && yaCanjeado,
    beneficio: beneficioDeUso(tarjeta.beneficio, premio.nombre),
    usos_total: typeof count === "number" ? count : null,
    cliente: nombres.get(miembro.id)?.nombre ?? "Cliente",
  });
}
