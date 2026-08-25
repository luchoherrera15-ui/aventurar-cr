"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCambioDePase } from "@/lib/wallet/servicio";
import { llaveDeCanje } from "@/lib/lealtad/canje";
import { traducirErrorDeBase, traducirMotivo } from "@/lib/lealtad/mostrador";
// Los imports que faltan acá —la regla de sellos, el registro comercial,
// el catálogo de productos, los tipos de tarjeta, el conteo del cupo, la
// definición del paquete, la resolución de identidad— se fueron con los
// cuatro núcleos a `@/lib/lealtad/operar-core`. Que este archivo ya no
// los necesite es la señal de que la extracción quedó completa: si
// vuelven, alguien está recalculando sellos (o saltándose el cupo) acá.
import {
  acreditarPorMiembroCore,
  afiliarCore,
  buscarClientesCore,
  canjearCore,
  type MiembroAtendible,
} from "@/lib/lealtad/operar-core";
import { minutoISOCR } from "@/lib/fechas";
import type { PermisoLealtad } from "@/lib/lealtad/permisos";
import {
  CANALES_CONSENTIMIENTO,
  duenosDelContacto,
  revisarAlta,
  textoConsentimientoMostrador,
  VERSION_CONSENTIMIENTO_MOSTRADOR,
} from "@/lib/lealtad/personas";

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
 *
 * ── CUATRO DE ESTAS ACCIONES SON ENVOLTORIOS ────────────────────────
 *
 * `acreditarOperacion`, `canjearRecompensa`, `buscarClientesDelPrograma`
 * y `afiliarClienteAMano` ya no deciden nada: resuelven la identidad por
 * COOKIE, llaman al núcleo compartido y revalidan la página. Lo que
 * queda acá es exactamente lo que NO sirve en un teléfono — el redirect
 * al login y `revalidatePath` — y por eso su firma pública no cambió:
 * `atencion-manual.tsx` y `modo-mostrador.tsx` no se enteraron.
 */

/**
 * La forma de una fila del buscador de clientes. Vive en el núcleo
 * —`atencion-manual.tsx` la importa DESDE ACÁ desde antes de que el
 * núcleo existiera— y se reexporta para no tocar el componente. Es un
 * tipo: se borra al compilar y no rompe la regla de `"use server"` de
 * que todo lo exportado sea una función async.
 */
export type { MiembroAtendible };

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
  // ── LA LÓGICA SE MUDÓ A `@/lib/lealtad/operar-core` ────────────────
  // Todo lo que decide si el premio sale —la tenencia del miembro y de
  // la recompensa, las reglas de la 0136, la constancia del intento, el
  // RPC, el evento para el POS y el aviso al Wallet— vive allá, porque
  // el teléfono necesita EXACTAMENTE eso y un server action no se puede
  // llamar desde React Native. Acá queda lo del navegador: la identidad
  // por cookie, el redirect al login y la revalidación.
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // LA REFERENCIA LA ARMA ESTE CAMINO, y se preserva tal cual estaba.
  //
  // `llaveDeCanje` existía desde la 0137 con sus 23 pruebas y CERO
  // llamadores. Dos toques del mismo botón dentro del mismo minuto
  // producen la MISMA referencia, y el segundo choca contra
  // `canjes_referencia_unica` (0125:207) y no escribe.
  //
  // El `referencia` que llega de afuera sigue ganando: es el número de
  // factura del POS, que identifica el intento mejor que nosotros.
  //
  // El endpoint del app NO usa esta forma: allá el `intentoId` es
  // obligatorio y la llave es `canje:<miembro>:<recompensa>:<intento>`,
  // que no tiene el problema del minuto de calendario.
  const referenciaFinal =
    referencia?.trim() ||
    `canje:${llaveDeCanje({ miembroId, recompensaId, ahoraCR: minutoISOCR() })}`;

  const r = await canjearCore({
    db,
    ranchoId,
    quien: { usuarioId: user.id, permisos },
    miembroId,
    recompensaId,
    referencia: referenciaFinal,
  });

  if (!r.ok) return { ok: false, motivo: r.motivo };

  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    saldo: r.saldo,
    recompensa: r.recompensa,
    sku: r.sku,
    instrucciones: r.instrucciones,
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

/**
 * Buscar a un cliente por nombre para atenderlo SIN escanear.
 *
 * La búsqueda entera —el filtro por tenencia, la resolución de
 * identidad, la comparación sin tildes y el tope de resultados— vive en
 * `buscarClientesCore`. El teléfono usa el MISMO buscador: dos copias
 * habrían sido dos criterios distintos de «a quién encuentra la caja»,
 * y el bug que este buscador vino a arreglar (los afiliados por póster
 * que no aparecían) ya demostró lo que cuesta arreglar una sola.
 */
export async function buscarClientesDelPrograma(
  ranchoId: string,
  texto: string,
): Promise<Resultado<{ clientes: MiembroAtendible[] }>> {
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const r = await buscarClientesCore({
    db,
    ranchoId,
    quien: { usuarioId: user.id, permisos },
    texto,
  });

  // Sin `revalidatePath`: esto no escribe nada.
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true, clientes: r.clientes };
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
 * Afiliar a mano, desde la caja, a alguien NUEVO en Bookea entero.
 *
 * Todo lo que decide si el alta procede —la validación de los datos, la
 * tenencia del programa, el contacto que ya es de otra persona, EL TOPE
 * DEL PAQUETE y el RPC `alta_persona_por_mostrador` (0184)— vive en
 * `afiliarCore`. El cupo en particular NO podía quedarse acá: el
 * endpoint del teléfono habría sido la puerta de atrás del cobro que
 * esta pantalla sí respeta. Ver la cabecera de `operar-core.ts`.
 */
export async function afiliarClienteAMano(
  ranchoId: string,
  programaId: string,
  datos: { nombre: string; whatsapp: string; correo: string; aceptaPromos: boolean },
): Promise<Resultado<{ miembroId: string; nombre: string; contacto: string[] }>> {
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const r = await afiliarCore({
    db,
    ranchoId,
    quien: { usuarioId: user.id, permisos },
    programaId,
    datos,
  });

  // El motivo de cupo lleno se devuelve TAL CUAL acá, con su mención al
  // plan: esto es la web, donde decirle al dueño que se quedó sin cupo
  // y cómo ampliarlo es exactamente lo que hay que hacer. Quien lo
  // reescribe es la puerta del app (`motivoParaMovil`), y solo ahí.
  if (!r.ok) return { ok: false, motivo: r.motivo };

  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return { ok: true, miembroId: r.miembroId, nombre: r.nombre, contacto: r.contacto };
}
