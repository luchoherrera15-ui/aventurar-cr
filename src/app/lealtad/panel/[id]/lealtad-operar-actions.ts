"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCambioDePase } from "@/lib/wallet/servicio";
import { llaveDeCanje } from "@/lib/lealtad/canje";
import { minutoISOCR } from "@/lib/fechas";
import type { PermisoLealtad } from "@/lib/lealtad/permisos";

/**
 * Las operaciones del día a día del programa de lealtad: acreditar,
 * canjear, revertir, suspender. Todas contra los RPC de la 0125, que
 * son quienes garantizan la atomicidad — acá solo se comprueba QUIÉN
 * puede y sobre QUÉ negocio.
 *
 * El patrón de seguridad es el mismo del escáner: primero
 * `verificarAccesoLealtad` (dueño, colaborador o admin, con el
 * checklist de la 0127 ya resuelto — cada acción declara QUÉ permiso
 * exige), después la comprobación de que el miembro pertenece a ESTE
 * negocio — porque el id del miembro llega del navegador, o sea de
 * fuera — y solo entonces el RPC con la llave de servicio. Los RPC no
 * aceptan llamadas de `authenticated` (0125): sin este camino no hay
 * forma de moverle el saldo a nadie.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; motivo: string };

const SIN_PERMISO: Record<PermisoLealtad, string> = {
  acreditar: "No tenés permiso para dar sellos — pedíselo al dueño.",
  canjear: "No tenés permiso para canjear premios — pedíselo al dueño.",
  revertir: "No tenés permiso para revertir movimientos — pedíselo al dueño.",
  auditoria: "No tenés permiso para ver la auditoría — pedíselo al dueño.",
};

async function guardYMiembro(
  ranchoId: string,
  miembroId: string,
  permiso: PermisoLealtad,
): Promise<
  | { ok: true; db: NonNullable<ReturnType<typeof createAdminClient>>; usuarioId: string }
  | { ok: false; motivo: string }
> {
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };
  if (!permisos[permiso]) return { ok: false, motivo: SIN_PERMISO[permiso] };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // LA comprobación que importa: que el miembro sea de ESTE negocio.
  const { data: miembro } = await db
    .from("miembros")
    .select("id, programa_id")
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return { ok: false, motivo: "Esa membresía no existe." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa membresía es de otro negocio." };
  }

  return { ok: true, db, usuarioId: user.id };
}

/**
 * Acredita una operación (visita o compra) a un miembro.
 *
 * `monto` en colones enteros; null = visita sin monto. El navegador
 * NUNCA manda puntos: manda el hecho (vino, gastó tanto) y el RPC
 * recalcula con las reglas vigentes del programa.
 *
 * `referencia` viene del llamador para que un doble clic o un reintento
 * de red no acredite dos veces: misma referencia = un solo movimiento.
 */
export async function acreditarOperacion(
  ranchoId: string,
  miembroId: string,
  monto: number | null,
  referencia?: string,
): Promise<Resultado<{ puntos: number; saldo: number; yaEstaba: boolean }>> {
  if (monto !== null && (!Number.isInteger(monto) || monto < 0 || monto > 10_000_000)) {
    return { ok: false, motivo: "El monto debe ser una cantidad entera de colones." };
  }

  const g = await guardYMiembro(ranchoId, miembroId, "acreditar");
  if (!g.ok) return g;

  const { data, error } = await g.db.rpc("acreditar_lealtad", {
    p_miembro_id: miembroId,
    p_monto: monto,
    // Mismo problema y mismo arreglo que en el canje: con `randomUUID()`
    // el unique del ledger (`transacciones_puntos_referencia_unica`,
    // 0060:187) no rebotaba el doble toque y el cliente se llevaba dos
    // sellos por una visita. Se sigue el patrón que el escáner ya usa
    // bien (`referenciaDelMinuto`, escaner-actions.ts:44): el minuto
    // adentro de la llave.
    //
    // Consecuencia aceptada, la misma del escáner: no se acredita dos
    // veces al mismo miembro por el mismo monto dentro del mismo minuto.
    // Para la venta seguida de verdad está el número de factura, que
    // entra por `referencia` y gana.
    p_referencia:
      referencia?.trim() || `panel:${miembroId}:${monto ?? "visita"}:${minutoISOCR()}`,
    p_usuario_id: g.usuarioId,
    p_motivo: monto === null ? "Sello por visita" : "Compra",
  });

  if (error) return { ok: false, motivo: traducirRpc(error.message) };

  const r = data as { otorgado: boolean; puntos?: number; saldo?: number; motivo?: string };
  if (!r.otorgado && r.motivo !== "ya-otorgado") {
    return { ok: false, motivo: r.motivo ?? "No se pudo acreditar." };
  }

  // El aviso al teléfono nunca frena la operación (los puntos ya
  // están), pero un `void` suelto muere cuando Vercel congela la
  // función al responder: `after` lo mantiene vivo.
  after(() => avisarCambioDePase(miembroId));
  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    puntos: r.puntos ?? 0,
    saldo: r.saldo ?? 0,
    yaEstaba: r.motivo === "ya-otorgado",
  };
}

/**
 * Confirma el canje de una recompensa. El RPC revalida TODO bajo lock
 * (saldo, stock, vigencia, límites): lo que el panel mostró hace un
 * minuto no cuenta — dos canjes simultáneos no pueden gastar el mismo
 * saldo.
 */
export async function canjearRecompensa(
  ranchoId: string,
  miembroId: string,
  recompensaId: string,
  referencia?: string,
): Promise<
  Resultado<{ saldo: number; recompensa: string; sku: string | null; instrucciones: string | null }>
> {
  const g = await guardYMiembro(ranchoId, miembroId, "canjear");
  if (!g.ok) return g;

  // ── Las reglas de la tarjeta (0136), ANTES del RPC ──────────────
  // El RPC de la 0125 revalida saldo, stock y límites bajo lock, pero
  // no sabe nada de vigencia, días ni horarios: son de la 0136 y son
  // posteriores. Se comprueban acá, con el estado real de la base — no
  // mirando el pase, que es un dibujo del que se puede sacar captura.
  //
  // Un rechazo queda registrado con su motivo: el canje que NO procede
  // es justo el que hay que poder explicar después.
  const veredicto = await revisarReglas(g.db, {
    miembroId,
    recompensaId,
    usuarioId: g.usuarioId,
  });
  if (!veredicto.ok) {
    anotarIntento(g.db, {
      programaId: veredicto.programaId,
      miembroId,
      recompensaId,
      usuarioId: g.usuarioId,
      aprobado: false,
      motivo: veredicto.codigo ?? "reglas",
    });
    return { ok: false, motivo: veredicto.motivo };
  }

  const { data, error } = await g.db.rpc("canjear_recompensa", {
    p_miembro_id: miembroId,
    p_recompensa_id: recompensaId,
    p_usuario_id: g.usuarioId,
    // ── LA LLAVE DE IDEMPOTENCIA, POR FIN CONECTADA ──────────────
    // Acá decía `canje:${randomUUID()}`. Como el azar es distinto en
    // cada request, el índice único `canjes_referencia_unica` (0125:207)
    // —que SÍ está pegado en producción— nunca rebotaba nada, y el
    // `exception when unique_violation` del RPC (0125:517) era código
    // muerto. Dos toques del botón: dos débitos del ledger, dos filas
    // en `canjes`, UN premio entregado.
    //
    // `llaveDeCanje` existía desde la 0137 con sus 23 pruebas y CERO
    // llamadores. Ahora dos toques del mismo botón dentro del mismo
    // minuto producen la MISMA referencia, y el segundo choca contra el
    // índice y no escribe. Sin migración: la protección ya estaba
    // pagada, solo no se estaba usando.
    //
    // El `referencia` que llega de afuera sigue ganando: es el número
    // de factura del POS, que identifica el intento mejor que nosotros.
    p_referencia:
      referencia?.trim() ||
      `canje:${llaveDeCanje({ miembroId, recompensaId, ahoraCR: minutoISOCR() })}`,
  });

  if (error) {
    anotarIntento(g.db, {
      programaId: veredicto.programaId,
      miembroId,
      recompensaId,
      usuarioId: g.usuarioId,
      aprobado: false,
      motivo: "error_rpc",
    });
    return { ok: false, motivo: traducirRpc(error.message) };
  }

  const r = data as {
    ok: boolean;
    motivo?: string;
    canje_id?: string;
    saldo?: number;
    recompensa?: string;
    sku?: string | null;
    instrucciones?: string | null;
  };

  // ── ACÁ SE ANOTA LO QUE DE VERDAD PASÓ ──────────────────────────
  // El RPC revalida bajo lock saldo, stock, límite por cliente y estado
  // de la membresía. Todos esos rechazos quedaban antes anotados como
  // «aprobado», porque la constancia se escribía antes de llegar hasta
  // acá. Ahora el veredicto que se guarda es el final.
  anotarIntento(g.db, {
    programaId: veredicto.programaId,
    miembroId,
    recompensaId,
    usuarioId: g.usuarioId,
    aprobado: r.ok,
    motivo: r.ok ? null : (r.motivo ?? "rechazado"),
  });

  if (!r.ok) return { ok: false, motivo: r.motivo ?? "No se pudo canjear." };

  // Tras el canje sale el evento para el POS. En modo manual queda
  // 'pendiente' hasta que el personal lo marque; si algún día hay un
  // proveedor con API, el worker lo levanta de acá. Un fallo escribiendo
  // el evento NO tumba el canje: el débito ya está en el ledger.
  //
  // La idempotencia es el id del canje: un reintento de red del mismo
  // canje no duplica el evento (el unique de la tabla lo rebota).
  if (r.canje_id) {
    try {
      await g.db.from("eventos_integracion").insert({
        rancho_id: ranchoId,
        tipo: "canje",
        payload: {
          canje_id: r.canje_id,
          miembro_id: miembroId,
          recompensa: r.recompensa,
          sku: r.sku,
          saldo_resultante: r.saldo,
        },
        idempotencia: `canje:${r.canje_id}`,
      });
    } catch {
      // Ver arriba: el canje vale igual.
    }
  }

  after(() => avisarCambioDePase(miembroId));
  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    saldo: r.saldo ?? 0,
    recompensa: r.recompensa ?? "",
    sku: r.sku ?? null,
    instrucciones: r.instrucciones ?? null,
  };
}

/**
 * Revierte un movimiento con una compensación. El original NUNCA se
 * edita ni se borra: los errores se corrigen con el movimiento
 * contrario, y el ledger cuenta la historia completa.
 */
export async function revertirMovimiento(
  ranchoId: string,
  miembroId: string,
  transaccionId: string,
  motivo: string,
): Promise<Resultado<{ saldo: number }>> {
  const limpio = motivo.trim();
  if (!limpio) return { ok: false, motivo: "Decí por qué se revierte: queda en el historial." };
  if (limpio.length > 200) return { ok: false, motivo: "El motivo es muy largo (máximo 200)." };

  const g = await guardYMiembro(ranchoId, miembroId, "revertir");
  if (!g.ok) return g;

  // El movimiento tiene que ser DE ESTE miembro: el id llega de fuera.
  const { data: tx } = await g.db
    .from("transacciones_puntos")
    .select("id, miembro_id")
    .eq("id", transaccionId)
    .maybeSingle();
  if (!tx || tx.miembro_id !== miembroId) {
    return { ok: false, motivo: "Ese movimiento no es de esta membresía." };
  }

  const { data, error } = await g.db.rpc("revertir_movimiento", {
    p_transaccion_id: transaccionId,
    p_usuario_id: g.usuarioId,
    p_motivo: limpio,
  });

  if (error) return { ok: false, motivo: traducirRpc(error.message) };
  const r = data as { ok: boolean; motivo?: string; saldo?: number };
  if (!r.ok) return { ok: false, motivo: r.motivo ?? "No se pudo revertir." };

  after(() => avisarCambioDePase(miembroId));
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true, saldo: r.saldo ?? 0 };
}

/**
 * Suspende o reactiva la membresía. Suspender NO borra nada: el saldo
 * y el historial quedan; solo dejan de entrar movimientos.
 */
export async function cambiarEstadoMiembro(
  ranchoId: string,
  miembroId: string,
  estado: "activa" | "pausada" | "cancelada",
): Promise<Resultado> {
  if (!["activa", "pausada", "cancelada"].includes(estado)) {
    return { ok: false, motivo: "Ese estado no existe." };
  }

  // Suspender una membresía pesa lo mismo que revertir: le corta el
  // programa a un cliente. Mismo permiso, no uno nuevo.
  const g = await guardYMiembro(ranchoId, miembroId, "revertir");
  if (!g.ok) return g;

  const { error } = await g.db.from("miembros").update({ estado }).eq("id", miembroId);
  if (error) return { ok: false, motivo: "No se pudo cambiar: " + error.message };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true };
}

/**
 * Marca un canje como registrado en el POS (modo manual). Conserva
 * quién y cuándo: es lo que separa "alguien dijo que lo hizo" de un
 * registro.
 */
export async function marcarCanjeEnPos(
  ranchoId: string,
  miembroId: string,
  canjeId: string,
  facturaRef: string,
): Promise<Resultado> {
  const g = await guardYMiembro(ranchoId, miembroId, "canjear");
  if (!g.ok) return g;

  const { data, error } = await g.db
    .from("canjes")
    .update({
      factura_ref: facturaRef.trim().slice(0, 60) || null,
      pos_registrado_en: new Date().toISOString(),
      pos_registrado_por: g.usuarioId,
    })
    .eq("id", canjeId)
    .eq("miembro_id", miembroId)
    .is("pos_registrado_en", null) // idempotente: el segundo clic no pisa al primero
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, motivo: "No se pudo marcar: " + error.message };
  if (!data) return { ok: false, motivo: "Ese canje ya estaba marcado (o no existe)." };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true };
}

/** Los errores de RPC que merecen mensaje propio. */
function traducirRpc(mensaje: string) {
  if (/acreditar_lealtad|canjear_recompensa|revertir_movimiento/.test(mensaje)) {
    return "Falta correr la migración 0125 en Supabase.";
  }
  return "No se pudo completar: " + mensaje;
}

/**
 * Comprueba las reglas de la tarjeta (0136) y DEJA CONSTANCIA.
 *
 * Se llama antes del RPC de canje. El RPC resuelve la carrera por el
 * saldo bajo lock; esto resuelve si la tarjeta puede canjearse hoy, a
 * esta hora, y si a este cliente le queda alguno.
 *
 * Tolerante a la base sin migrar: si `programa_lealtad` todavía no
 * tiene las columnas de reglas, no hay reglas que romper y el canje
 * sigue su curso como antes de la 0136.
 */
async function revisarReglas(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  datos: { miembroId: string; recompensaId: string; usuarioId: string | null },
): Promise<
  | { ok: true; programaId: string | null }
  | { ok: false; motivo: string; codigo?: string; programaId: string | null }
> {
  const { autorizarCanje } = await import("@/lib/lealtad/canje");
  const { hoyISOCR } = await import("@/lib/fechas");

  // El miembro, su programa y el costo de lo que quiere canjear.
  const { data: miembro } = await db
    .from("miembros")
    .select("programa_id")
    .eq("id", datos.miembroId)
    .maybeSingle();
  // El RPC lo rebota con su propio motivo; acá no hay programa que mirar.
  if (!miembro) return { ok: true, programaId: null };

  const programaId = miembro.programa_id as string;

  // `select *`: las columnas de la 0136 pueden no existir todavía, y
  // una lista explícita fallaría entera.
  const [{ data: programa }, { data: recompensa }] = await Promise.all([
    db.from("programa_lealtad").select("*").eq("id", programaId).maybeSingle(),
    db.from("recompensas").select("costo_puntos").eq("id", datos.recompensaId).maybeSingle(),
  ]);
  if (!programa) return { ok: true, programaId };

  // Cuántos canjes lleva este cliente, y cuántos el programa entero.
  const { data: miembrosDelPrograma } = await db
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId);
  const idsMiembros = ((miembrosDelPrograma ?? []) as { id: string }[]).map((m) => m.id);

  const [{ count: delCliente }, { count: totales }] = await Promise.all([
    db
      .from("canjes")
      .select("*", { count: "exact", head: true })
      .eq("miembro_id", datos.miembroId)
      .neq("estado", "anulado"),
    idsMiembros.length
      ? db
          .from("canjes")
          .select("*", { count: "exact", head: true })
          .in("miembro_id", idsMiembros)
          .neq("estado", "anulado")
      : Promise.resolve({ count: 0 }),
  ]);

  const ahoraCR = `${hoyISOCR()}T${new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())}`;

  const fila = programa as Record<string, unknown>;
  const veredicto = autorizarCanje({
    programa: {
      estado: (fila.estado as string | null) ?? null,
      activo: !!fila.activo,
      vigente_desde: (fila.vigente_desde as string | null) ?? null,
      vigente_hasta: (fila.vigente_hasta as string | null) ?? null,
      uso_unico: !!fila.uso_unico,
      max_por_cliente: (fila.max_por_cliente as number | null) ?? null,
      max_global: (fila.max_global as number | null) ?? null,
      dias_permitidos: (fila.dias_permitidos as number[] | null) ?? null,
      hora_desde: (fila.hora_desde as string | null) ?? null,
      hora_hasta: (fila.hora_hasta as string | null) ?? null,
    },
    // El saldo lo revalida el RPC bajo lock: acá se le pasa el costo
    // como saldo para que ESA comprobación no rechace nada de más. La
    // autoridad sobre el saldo es una sola, y es el RPC.
    saldo: (recompensa?.costo_puntos as number) ?? 0,
    costo: (recompensa?.costo_puntos as number) ?? 0,
    canjesDelCliente: delCliente ?? 0,
    canjesTotales: totales ?? 0,
    ahoraCR,
  });

  // ── LA CONSTANCIA YA NO SE ESCRIBE ACÁ ──────────────────────────
  // Antes se anotaba en este punto con `aprobado: veredicto.ok`, o sea
  // con el resultado de las reglas de la 0136 y NADA MÁS. El problema:
  // después de esto todavía corre el RPC, que revalida bajo lock el
  // saldo, el stock, el límite por cliente y el estado de la membresía
  // (0125:446-501). Un canje rechazado ahí quedaba anotado como
  // `aprobado: true`.
  //
  // O sea: la tabla que existe justamente para poder explicarle al
  // cliente «no me lo aceptaron» estaba mintiendo, y en la dirección
  // más cara — decía que sí cuando fue que no.
  //
  // Ahora se devuelve el veredicto y lo anota `canjearRecompensa`
  // DESPUÉS del RPC, con lo que de verdad pasó.
  return veredicto.ok
    ? { ok: true, programaId }
    : { ok: false, motivo: veredicto.motivo, codigo: veredicto.codigo, programaId };
}

/**
 * Deja la constancia del intento — el que entró y el que no.
 *
 * Nunca tumba el canje: si la 0137 no está pegada la tabla no existe y
 * esto falla en silencio. Perder el canje por no poder anotarlo sería
 * peor que perder la anotación.
 */
function anotarIntento(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  datos: {
    programaId: string | null;
    miembroId: string;
    recompensaId: string;
    usuarioId: string | null;
    aprobado: boolean;
    motivo: string | null;
  },
) {
  after(async () => {
    try {
      await db.from("intentos_canje").insert({
        programa_id: datos.programaId,
        miembro_id: datos.miembroId,
        recompensa_id: datos.recompensaId,
        usuario_id: datos.usuarioId,
        aprobado: datos.aprobado,
        motivo: datos.motivo,
      });
    } catch {
      // Sin la 0137 no hay dónde anotar. El canje ya se decidió.
    }
  });
}
