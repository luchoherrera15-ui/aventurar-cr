"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCambioDePase } from "@/lib/wallet/servicio";
import { llaveDeCanje } from "@/lib/lealtad/canje";
import { traducirErrorDeBase, traducirMotivo } from "@/lib/lealtad/mostrador";
// Los nueve imports que faltan acá —la regla de sellos, el registro
// comercial, el catálogo de productos, los tipos de tarjeta— se fueron
// con `acreditarOperacion` a `@/lib/lealtad/operar-core`. Que este
// archivo ya no los necesite es la señal de que la extracción quedó
// completa: si vuelven, alguien está recalculando sellos acá.
import { acreditarPorMiembroCore } from "@/lib/lealtad/operar-core";
import { minutoISOCR } from "@/lib/fechas";
import type { PermisoLealtad } from "@/lib/lealtad/permisos";
import { identidadesDeMiembros, miembrosConIdentidad } from "@/lib/lealtad/identidades-db";
import { fichaVisible, SIN_DATOS } from "@/lib/lealtad/identidad-miembro";
import {
  CANALES_CONSENTIMIENTO,
  duenosDelContacto,
  revisarAlta,
  textoConsentimientoMostrador,
  VERSION_CONSENTIMIENTO_MOSTRADOR,
} from "@/lib/lealtad/personas";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { personasActivasDe } from "@/lib/lealtad/cupo";
import { definicionDe } from "@/lib/lealtad/planes";

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
  | {
      ok: true;
      db: NonNullable<ReturnType<typeof createAdminClient>>;
      usuarioId: string;
      programaId: string;
      /** El tipo y el beneficio crudos, para la regla de sellos (0197). */
      modo: string | null;
      beneficio: unknown;
    }
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
    .select("rancho_id, modo, beneficio")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa membresía es de otro negocio." };
  }

  // El programa sale de acá y no se vuelve a consultar: quien recibe
  // esto ya sabe a qué tarjeta pertenece el miembro, que es lo que hace
  // falta para comprobar que la recompensa también sea de ella.
  return {
    ok: true,
    db,
    usuarioId: user.id,
    programaId: miembro.programa_id as string,
    modo: (programa.modo as string | null) ?? null,
    beneficio: programa.beneficio,
  };
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
  /** Producto o concepto de la compra; solo viaja al registro (0197). */
  producto?: string | null,
  /**
   * El producto del CATÁLOGO elegido en la caja (0198). Llega del
   * navegador y se comprueba contra ESTE negocio antes de usarlo; de
   * ahí sale el nombre que se guarda. No decide el monto: el monto es
   * el que llegó, porque en la caja es editable a propósito.
   */
  productoId?: string | null,
): Promise<Resultado<{ puntos: number; saldo: number; yaEstaba: boolean }>> {
  // ── LA LÓGICA SE MUDÓ A `@/lib/lealtad/operar-core` ────────────────
  // La app móvil necesita exactamente esto, y un server action no se
  // puede llamar desde React Native. Acá queda lo que solo tiene sentido
  // en el navegador: la identidad por cookie, el redirect al login y la
  // revalidación. Ver la cabecera de ese archivo.
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // LA REFERENCIA LA ARMA ESTE CAMINO, y se preserva tal cual estaba.
  //
  // Con `randomUUID()` el unique del ledger
  // (`transacciones_puntos_referencia_unica`, 0060:187) no rebotaba el
  // doble toque y el cliente se llevaba dos sellos por una visita. Por
  // eso lleva el MINUTO adentro.
  //
  // Consecuencia aceptada: no se acredita dos veces al mismo miembro por
  // el mismo monto dentro del mismo minuto. Para la venta seguida de
  // verdad está el número de factura, que entra por `referencia` y gana.
  //
  // El endpoint del app NO usa esta forma: allá el `intentoId` es
  // obligatorio y la llave es `mostrador:<miembro>:<intento>`, que no
  // tiene el problema del minuto de calendario.
  const referenciaFinal =
    referencia?.trim() || `panel:${miembroId}:${monto ?? "visita"}:${minutoISOCR()}`;

  const r = await acreditarPorMiembroCore({
    db,
    ranchoId,
    quien: { usuarioId: user.id, permisos },
    miembroId,
    monto,
    referencia: referenciaFinal,
    // `panel` conserva el texto que este camino ya escribía en el
    // ledger («Sello por visita» / «Compra», sin sufijo).
    via: "panel",
    producto,
    productoId,
  });

  revalidatePath(`/lealtad/panel/${ranchoId}`);

  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true, puntos: r.puntos, saldo: r.saldo, yaEstaba: r.yaEstaba };
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

  // ── LA RECOMPENSA TAMBIÉN TIENE QUE SER DE ESTA TARJETA ─────────
  // `recompensaId` llega del navegador, o sea de fuera, y de acá para
  // abajo todo corre con la LLAVE DE SERVICIO: sin este filtro se
  // leían y se anotaban filas de la recompensa de otro negocio.
  //
  // El débito real ya lo frenaba la base —el RPC compara
  // `v_rec.programa_id <> v_miembro.programa_id` (0125:461)— así que
  // esto no era plata que se fuera. Lo que faltaba era la capa de
  // afuera: `revisarReglas` leía el costo de una recompensa ajena y
  // `anotarIntento` escribía su id en la auditoría de este negocio.
  //
  // MISMO MENSAJE para «no existe» y «es de otro negocio», igual que el
  // RPC: no se delata qué recompensas existen fuera de acá.
  const { data: duena } = await g.db
    .from("recompensas")
    .select("programa_id")
    .eq("id", recompensaId)
    .maybeSingle();
  if (!duena || duena.programa_id !== g.programaId) {
    return { ok: false, motivo: "Ese premio no es de esta tarjeta." };
  }

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
    return { ok: false, motivo: traducirErrorDeBase(error, "entregar el premio") };
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

  // ── «ya-canjeado» NO SE LEE EN VOZ ALTA ─────────────────────────
  // Acá salía `r.motivo` tal cual, y el segundo toque del botón hacía
  // que el empleado leyera «ya-canjeado» delante del cliente. El RPC
  // devuelve frases en español para casi todo, pero ese motivo (y
  // `ya-otorgado` del otro RPC) son códigos de máquina.
  if (!r.ok) return { ok: false, motivo: traducirMotivo(r.motivo, "No se pudo entregar el premio.") };

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

  if (error) return { ok: false, motivo: traducirErrorDeBase(error, "revertir el movimiento") };
  const r = data as { ok: boolean; motivo?: string; saldo?: number };
  if (!r.ok) return { ok: false, motivo: traducirMotivo(r.motivo, "No se pudo revertir.") };

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
  if (error) {
    return { ok: false, motivo: traducirErrorDeBase(error, "cambiar el estado del cliente") };
  }

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

  if (error) return { ok: false, motivo: traducirErrorDeBase(error, "marcarlo en la caja") };
  if (!data) return { ok: false, motivo: "Ese canje ya estaba marcado (o no existe)." };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true };
}

// ── ATENDER A MANO: el cliente sin teléfono ───────────────────────

export type MiembroAtendible = {
  miembroId: string;
  nombre: string;
  sinNombre: boolean;
  contacto: string[];
  saldo: number;
  estado: string;
  conPase: boolean;
};

/**
 * Buscar a un cliente por nombre para atenderlo SIN escanear.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE
 * ------------------------------------------------------------------
 * El modo mostrador era el escáner y nada más, y la lista de Clientes
 * era de solo lectura. O sea: el cliente que llega sin smartphone, o
 * con el teléfono descargado, o con la tarjeta todavía sin agregar al
 * Wallet, hoy NO SE PODÍA ATENDER — se le decía «volvé con la tarjeta».
 *
 * `acreditarOperacion` ya estaba escrita, con su llave de idempotencia
 * y sus permisos, y no la llamaba nadie. Esto es su puerta.
 *
 * ------------------------------------------------------------------
 * ESTE BUSCADOR NO ENCONTRABA A NADIE DEL PÓSTER
 * ------------------------------------------------------------------
 * Bug real, y del mismo origen que el «Cliente» de la lista: buscaba
 * los nombres en `perfiles` por `miembros.cliente_id` y, si no había ni
 * un `cliente_id`, cortaba con `return { clientes: [] }`. Desde la 0138
 * quien se afilia escaneando el póster NO tiene cuenta —`cliente_id` en
 * null— así que la pantalla que existe para atender «al cliente sin la
 * tarjeta a mano» le contestaba «nadie con ese nombre está afiliado
 * todavía» a los clientes que sí lo estaban. Justo la gente que este
 * buscador vino a rescatar.
 *
 * Ahora la identidad sale de `personas` (con la ficha del negocio y
 * `perfiles` de respaldo), igual que el resto del panel.
 *
 * ------------------------------------------------------------------
 * QUÉ SE DEVUELVE Y QUÉ NO
 * ------------------------------------------------------------------
 * El nombre, el contacto y el saldo, y solo de ESTE negocio. `cliente_id`
 * no: para dar un sello no hace falta, y lo que no se manda al navegador
 * no se puede filtrar. El correo y el teléfono SÍ van —el dueño los pidió
 * para reconocer a quién está atendiendo— y son suyos: se los dio su
 * propio cliente al afiliarse.
 *
 * Exige el permiso `acreditar`: quien no puede dar sellos tampoco
 * necesita la lista de clientes del negocio en su teléfono.
 */
export async function buscarClientesDelPrograma(
  ranchoId: string,
  texto: string,
): Promise<Resultado<{ clientes: MiembroAtendible[] }>> {
  const busqueda = texto.trim();
  if (busqueda.length < 2) {
    return { ok: false, motivo: "Escribí al menos dos letras del nombre." };
  }

  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };
  if (!permisos.acreditar) return { ok: false, motivo: SIN_PERMISO.acreditar };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // Los programas del negocio primero: el filtro por tenencia va en la
  // consulta, no después. Así ningún nombre de otro negocio llega a
  // materializarse en memoria.
  const { data: programas } = await db
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", ranchoId);
  const idsProgramas = ((programas ?? []) as { id: string }[]).map((p) => p.id);
  if (!idsProgramas.length) return { ok: true, clientes: [] };

  const filas = await miembrosConIdentidad(db, { programaIds: idsProgramas });
  if (!filas.length) return { ok: true, clientes: [] };

  const identidades = await identidadesDeMiembros(db, filas, ranchoId);

  // El filtro por texto se hace ACÁ y no con `ilike` en la consulta por
  // dos razones: `ilike` metería los `%` y `_` que el empleado teclee
  // dentro del patrón, y sobre todo `ilike` NO ignora las tildes — en un
  // mostrador nadie escribe «Hernández» con tilde, y «hernandez` no
  // encontraría a nadie. Es la misma cantidad de filas que ya trae el
  // tablero del panel (datos-lealtad.ts) para el mismo negocio.
  //
  // Y se busca por nombre, correo Y teléfono: en la caja lo que el
  // cliente dice es «soy Melissa» o «mi número es el 7011…», y las dos
  // cosas tienen que servir.
  const aguja = normalizar(busqueda);
  const vistas = new Map(
    filas.map((m) => [
      m.id,
      fichaVisible(identidades.get(m.id) ?? { nombre: null, correo: null, telefono: null }, {
        alta: m.created_at,
        miembroId: m.id,
      }),
    ]),
  );

  const candidatos = filas
    .filter((m) => {
      const v = vistas.get(m.id);
      if (!v) return false;
      // La ficha vacía NO entra por su texto: buscar «cliente» no puede
      // devolver a todos los anónimos del negocio.
      const buscables = v.titulo === SIN_DATOS ? v.contacto : [v.titulo, ...v.contacto];
      return buscables.some((t) => normalizar(t).includes(aguja));
    })
    .slice(0, 20);
  if (!candidatos.length) return { ok: true, clientes: [] };

  const idsMiembros = candidatos.map((m) => m.id);

  const [{ data: tx }, { data: pases }] = await Promise.all([
    db.from("transacciones_puntos").select("miembro_id, puntos").in("miembro_id", idsMiembros),
    db.from("pases_wallet").select("miembro_id").in("miembro_id", idsMiembros),
  ]);

  // El saldo SIEMPRE se suma del ledger, nunca se lee de un contador:
  // es el mismo criterio que el resto del módulo (tablero.ts, motor.ts).
  const saldos = new Map<string, number>();
  for (const t of (tx ?? []) as { miembro_id: string; puntos: number }[]) {
    saldos.set(t.miembro_id, (saldos.get(t.miembro_id) ?? 0) + t.puntos);
  }
  const conPase = new Set(((pases ?? []) as { miembro_id: string }[]).map((p) => p.miembro_id));

  return {
    ok: true,
    clientes: candidatos
      .map((m) => {
        const v = vistas.get(m.id);
        return {
          miembroId: m.id,
          nombre: v?.titulo ?? SIN_DATOS,
          sinNombre: v?.sinNombre ?? true,
          contacto: v?.contacto ?? [],
          saldo: saldos.get(m.id) ?? 0,
          estado: m.estado,
          conPase: conPase.has(m.id),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}

// ── COMPLETAR LA FICHA A MANO ──────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════
 *  «CLIENTE SIN DATOS» → UN NOMBRE, DESDE LA CAJA
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── PARA QUIÉN ES ───────────────────────────────────────────────────
 * Para las fichas que quedaron vacías por el camino roto que
 * `personas.ts` documenta: gente con tarjeta y con sellos de la que no
 * se sabe ni el nombre. En producción eran 3 de 5.
 *
 * A esa gente no se le puede apagar la tarjeta —serían sellos que ya
 * ganó— así que el camino es el único que funciona de verdad en un
 * negocio: la próxima vez que la señora venga, el cajero le pregunta
 * cómo se llama y lo teclea acá.
 *
 * ── LO QUE ESCRIBE, Y POR QUÉ SON CUATRO COSAS Y NO UNA ─────────────
 *   1. `personas` — solo las columnas que estén EN NULL. Nunca pisa un
 *      dato que la persona dio ella misma: el criterio de
 *      `resolver_persona`, «enriquece pero no pisa» (0138:905).
 *   2. `clientes_negocio` — la ficha de CRM de ESTE negocio (0109), que
 *      es donde vive lo que el dueño anota y de donde el panel ya lee
 *      (`identidad-miembro.ts`, fuente 2).
 *   3. `personas_negocio` — el VÍNCULO, si faltaba. Es EL permiso del
 *      negocio para ver a esa persona (0138:327). Completar los datos
 *      de alguien a quien formalmente no se tiene derecho a ver, sin
 *      crear el vínculo, sería empeorar el problema con mejor letra.
 *   4. `consentimientos_persona` — el respaldo. Un alta completada a
 *      mano no puede quedar PEOR documentada que una normal.
 *
 * ── EL CONTACTO AJENO SE RECHAZA ────────────────────────────────────
 * Si el correo o el WhatsApp que se teclea ya es de OTRA persona, no se
 * escribe nada. No es prolijidad: `personas.correo` y
 * `personas.telefono` son únicos (0138), así que el update reventaría —
 * pero sobre todo, un cajero apurado escribiendo el número de otro
 * cliente fusionaría dos identidades con sellos, y eso no se deshace.
 *
 * ── EXIGE `acreditar` Y NO UN PERMISO NUEVO ─────────────────────────
 * Es el permiso de quien atiende la caja, que es exactamente quien
 * tiene a la persona enfrente para preguntarle. Inventar un permiso
 * aparte dejaría el arreglo en manos del dueño, que no está en la caja.
 */
export async function completarDatosDelCliente(
  ranchoId: string,
  miembroId: string,
  datos: { nombre: string; whatsapp: string; correo: string; aceptaPromos: boolean },
): Promise<Resultado<{ nombre: string; contacto: string[] }>> {
  const revision = revisarAlta({
    nombre: datos.nombre,
    correo: datos.correo,
    telefono: datos.whatsapp,
  });
  if (!revision.ok) return { ok: false, motivo: revision.error };

  const g = await guardYMiembro(ranchoId, miembroId, "acreditar");
  if (!g.ok) return g;

  const { data: miembro } = await g.db
    .from("miembros")
    .select("persona_id")
    .eq("id", miembroId)
    .maybeSingle();
  const personaId = (miembro as { persona_id?: string | null } | null)?.persona_id ?? null;
  if (!personaId) {
    // Base sin la 0138, o una membresía anterior al backfill. No hay
    // identidad raíz que completar y escribir solo la ficha del negocio
    // dejaría el vínculo y el consentimiento sin poder crearse igual.
    return {
      ok: false,
      motivo: "Esta ficha es de antes del cambio de identidad. Avisale a Bookea para arreglarla.",
    };
  }

  const { correo, telefono } = revision.contacto;

  // ¿Alguno de los dos datos ya es de otra persona? Ver la cabecera.
  const duenos = await duenosDelContacto(g.db, { correo, telefono });
  if (!duenos.confiable) {
    return { ok: false, motivo: "No pudimos comprobar esos datos ahora mismo. Probá de nuevo." };
  }
  if (duenos.porCorreo !== null && duenos.porCorreo !== personaId) {
    return { ok: false, motivo: "Ese correo ya es de otro cliente. Revisalo con la persona." };
  }
  if (duenos.porTelefono !== null && duenos.porTelefono !== personaId) {
    return { ok: false, motivo: "Ese WhatsApp ya es de otro cliente. Revisalo con la persona." };
  }

  const { data: programa } = await g.db
    .from("programa_lealtad")
    .select("cuenta_id")
    .eq("id", g.programaId)
    .maybeSingle();
  const cuentaId = (programa as { cuenta_id?: string | null } | null)?.cuenta_id ?? null;

  const { data: negocio } = await g.db
    .from("ranchos")
    .select("nombre")
    .eq("id", ranchoId)
    .maybeSingle();
  const nombreNegocio = ((negocio as { nombre?: string | null } | null)?.nombre ?? "").trim();

  // ── 1. `personas`: solo lo que está en null ──────────────────────
  const { data: persona } = await g.db
    .from("personas")
    .select("nombre, correo, telefono")
    .eq("id", personaId)
    .maybeSingle();
  const actual = (persona ?? {}) as { nombre?: string | null; correo?: string | null; telefono?: string | null };

  const parche: Record<string, string> = {};
  if (!(actual.nombre ?? "").trim()) parche.nombre = revision.nombre;
  if (!actual.correo && correo) parche.correo = correo;
  if (!actual.telefono && telefono) parche.telefono = telefono;
  if (Object.keys(parche).length > 0) {
    const { error } = await g.db.from("personas").update(parche).eq("id", personaId);
    if (error) return { ok: false, motivo: traducirErrorDeBase(error, "guardar los datos") };
  }

  // ── 2. La ficha del negocio ──────────────────────────────────────
  // Acá SÍ se pisa: es la libreta del dueño y él la está escribiendo.
  // `notas` no se toca ni se lee (0138:281 — pueden ser datos de salud).
  const { data: ficha } = await g.db
    .from("clientes_negocio")
    .select("id")
    .eq("rancho_id", ranchoId)
    .eq("persona_id", personaId)
    .maybeSingle();
  const camposFicha = {
    nombre: revision.nombre,
    ...(correo ? { correo } : {}),
    ...(telefono ? { telefono } : {}),
  };
  if (ficha?.id) {
    await g.db.from("clientes_negocio").update(camposFicha).eq("id", ficha.id);
  } else {
    await g.db
      .from("clientes_negocio")
      .insert({ rancho_id: ranchoId, persona_id: personaId, origen: "mostrador", ...camposFicha });
  }

  // ── 3. El vínculo, si faltaba ────────────────────────────────────
  // `on conflict do nothing` no existe en PostgREST: se pregunta antes.
  // Si dos cajeros lo hacen a la vez, el único de la 0138 rebota el
  // segundo insert y se ignora — el vínculo ya está, que es lo que
  // importa.
  const { data: vinculo } = await g.db
    .from("personas_negocio")
    .select("id")
    .eq("persona_id", personaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!vinculo) {
    await g.db
      .from("personas_negocio")
      .insert({ persona_id: personaId, rancho_id: ranchoId, cuenta_id: cuentaId, origen: "mostrador" });
  }

  // ── 4. El respaldo del consentimiento ────────────────────────────
  // Una fila por canal, igual que el alta por QR, y con el "no acepto"
  // guardado también: lo que hay que poder demostrar es que se preguntó.
  const textoPermiso = textoConsentimientoMostrador(nombreNegocio);
  const { error: errorPermiso } = await g.db.from("consentimientos_persona").insert(
    CANALES_CONSENTIMIENTO.map((canal) => ({
      persona_id: personaId,
      ambito: "negocio",
      cuenta_id: cuentaId,
      rancho_id: ranchoId,
      canal,
      estado: datos.aceptaPromos ? "aceptado" : "revocado",
      correo,
      telefono,
      texto_version: VERSION_CONSENTIMIENTO_MOSTRADOR,
      texto_exacto: textoPermiso,
      origen: "mostrador",
    })),
  );
  if (errorPermiso) {
    // Los datos YA quedaron. Decirlo así y no «no se pudo»: el cajero
    // tiene que saber que el nombre se guardó, o lo va a teclear otra
    // vez creyendo que no entró.
    return {
      ok: false,
      motivo: "Los datos quedaron guardados, pero no pudimos anotar el permiso. Avisale a Bookea.",
    };
  }

  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    nombre: revision.nombre,
    contacto: [correo, telefono].filter((v): v is string => v !== null),
  };
}

// ── AGREGAR CLIENTE NUEVO, DESDE CERO ─────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════
 *  ALTA A MANO: LA PUERTA QUE NO ES UN QR
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── PARA QUIÉN ES, Y PARA QUIÉN NO ──────────────────────────────────
 * Hasta hoy la ÚNICA puerta de alta a un programa era que el cliente
 * escaneara el póster y llenara su propio formulario. El dueño pidió
 * poder afiliar a mano, desde la caja, a gente real que va a quedar
 * funcionando PARA SIEMPRE — no un script de una vez.
 *
 * Esta función es para GENTE NUEVA EN BOOKEA ENTERAMENTE. Si el
 * correo o el WhatsApp que se teclea ya es de alguien —de este negocio
 * o de cualquier otro— no se crea una fila nueva: se avisa, y a esa
 * persona se la busca por nombre con `buscarClientesDelPrograma`, que
 * es la puerta correcta para quien ya tiene ficha. Confundir las dos
 * dejaría que un cajero apurado le cuelgue un consentimiento y una
 * membresía de este negocio a la identidad de un tercero que nunca
 * puso un pie acá, solo porque compartió el mismo dato con otra
 * persona en otro lado.
 *
 * ── POR QUÉ NO ES `completarDatosDelCliente` CON OTRO NOMBRE ────────
 * `completarDatosDelCliente` regulariza una ficha que YA EXISTE
 * (exige `persona_id`, corta si es null). Acá no hay membresía previa
 * de la cual partir: se crea la persona, el vínculo, el consentimiento
 * y la membresía LOS CUATRO, en una sola transacción, adentro del RPC
 * `alta_persona_por_mostrador` (0184) — hermana de `alta_persona_por_qr`
 * con el mismo orden interno que exige el trigger `miembros_zexigir_
 * respaldo` (0181): vínculo y consentimiento tienen que existir ANTES
 * del insert en `miembros`, o la base rechaza la transacción entera.
 *
 * ── EL TOPE DEL PAQUETE, ANTES DEL RPC ───────────────────────────────
 * `cupo.ts:45-56` dejó la advertencia textual: el día que se conecte
 * el alta sin escanear, ese llamador tiene que pasar por
 * `personasActivasDe()` ANTES de llamar al RPC, o el tope del paquete
 * se salta entero por la puerta del mostrador. Mismo criterio que
 * `altaPorQr` (personas.ts:863-880): se frena la afiliación NUEVA
 * cuando el paquete ya está lleno.
 *
 * ── EXIGE `acreditar` Y NO UN PERMISO NUEVO ─────────────────────────
 * Es el permiso de quien atiende la caja, que es quien tiene a la
 * persona enfrente para preguntarle — mismo criterio que
 * `completarDatosDelCliente`.
 */
export async function afiliarClienteAMano(
  ranchoId: string,
  programaId: string,
  datos: { nombre: string; whatsapp: string; correo: string; aceptaPromos: boolean },
): Promise<Resultado<{ miembroId: string; nombre: string; contacto: string[] }>> {
  const revision = revisarAlta({
    nombre: datos.nombre,
    correo: datos.correo,
    telefono: datos.whatsapp,
  });
  if (!revision.ok) return { ok: false, motivo: revision.error };

  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };
  // Mismo permiso que completarDatosDelCliente: es quien atiende la
  // caja, que es quien tiene a la persona enfrente para preguntarle.
  if (!permisos.acreditar) return { ok: false, motivo: SIN_PERMISO.acreditar };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // El programa tiene que ser DE ESTE negocio: llega del navegador, y
  // sin este chequeo cualquiera podría afiliar gente al programa de
  // otro rancho con sus propios permisos de mostrador.
  const { data: programa } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || (programa as { rancho_id?: string | null }).rancho_id !== ranchoId) {
    return { ok: false, motivo: "Ese programa no es de este negocio." };
  }

  const { correo, telefono } = revision.contacto;

  // Mismo chequeo que completarDatosDelCliente (677-686). Acá no hay
  // persona_id propio: CUALQUIER persona existente con ese contacto
  // cuenta como ajena — este formulario es solo para gente nueva.
  const duenos = await duenosDelContacto(db, { correo, telefono });
  if (!duenos.confiable) {
    return { ok: false, motivo: "No pudimos comprobar esos datos ahora mismo. Probá de nuevo." };
  }
  if (duenos.porCorreo !== null) {
    return { ok: false, motivo: "Ese correo ya es de otro cliente. Buscalo arriba con el nombre." };
  }
  if (duenos.porTelefono !== null) {
    return { ok: false, motivo: "Ese WhatsApp ya es de otro cliente. Buscalo arriba con el nombre." };
  }

  const { data: negocio } = await db
    .from("ranchos")
    .select("nombre, plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  const nombreNegocio = ((negocio as { nombre?: string | null } | null)?.nombre ?? "").trim();

  // ── EL TOPE DEL PAQUETE, ANTES DEL RPC ──────────────────────────
  // Mismo criterio que altaPorQr (personas.ts:863-880): el mostrador
  // no puede ser la puerta por la que un paquete de $12 afilia sin
  // techo (advertencia textual de cupo.ts:45-56).
  const { plan, cuentaId } = await contextoDeCuenta(db, programa as Record<string, unknown>, {
    planRancho: (negocio as { plan_lealtad?: string | null } | null)?.plan_lealtad ?? null,
  });
  const limite = definicionDe(plan)?.limites.clientesActivos;
  if (limite !== null && limite !== undefined) {
    const usadas = await personasActivasDe(db, { cuentaId, ranchoId });
    if (usadas >= limite) {
      return {
        ok: false,
        motivo: "Tu paquete ya usó todo su cupo de clientes. Escribile a Bookea para subir de plan.",
      };
    }
  }

  const { data, error } = await db.rpc("alta_persona_por_mostrador", {
    p_programa: programaId,
    p_correo: correo,
    p_telefono: telefono,
    p_nombre: revision.nombre,
    p_acepta: datos.aceptaPromos,
    p_texto_consentimiento: textoConsentimientoMostrador(nombreNegocio),
  });
  if (error) return { ok: false, motivo: traducirErrorDeBase(error, "afiliar al cliente") };

  const r = data as {
    estado?: string;
    campo?: "correo" | "whatsapp";
    miembro_id?: string;
  };

  if (r.estado === "duplicado") {
    return {
      ok: false,
      motivo:
        r.campo === "correo"
          ? "Ese correo ya es de otro cliente. Buscalo arriba con el nombre."
          : "Ese WhatsApp ya es de otro cliente. Buscalo arriba con el nombre.",
    };
  }
  if (r.estado !== "listo" || typeof r.miembro_id !== "string") {
    return { ok: false, motivo: "No se pudo afiliar. Probá de nuevo." };
  }

  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    miembroId: r.miembro_id,
    nombre: revision.nombre,
    contacto: [correo, telefono].filter((v): v is string => v !== null),
  };
}

/** Sin tildes y en minúscula: en un mostrador nadie escribe «Hernández». */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
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
