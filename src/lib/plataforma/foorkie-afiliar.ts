import type { createAdminClient } from "@/lib/supabase/admin";
import { minutoISOCR } from "@/lib/fechas";
import {
  altaPorQrSinSesion,
  ipValida,
  revisarAlta,
  type CampoDelAlta,
  type Contacto,
  type ParametrosAlta,
  type ResultadoAltaSinSesion,
} from "@/lib/lealtad/personas";
import { estadoVisible, type EstadoVisible } from "@/lib/lealtad/programas";
import { regalarSellosDeBienvenidaCore } from "@/lib/lealtad/operar-core";
import { leerBeneficio, tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { localDeFoorkieDeLaTarjeta } from "@/lib/plataforma/foorkie-marca";
import { resumenDeFila } from "@/lib/wallet/programa-principal";
import {
  armarTarjeta,
  linksDelMiembro,
  metaDelPrograma,
  saldoDelMiembro,
  UUID,
  type TarjetaParaFoorkie,
} from "@/lib/plataforma/foorkie-api";
import { marcaDeLaTarjeta } from "@/lib/plataforma/foorkie-marca";

/**
 * ════════════════════════════════════════════════════════════════════
 *  AFILIARSE DESDE FOORKIE — la tarjeta del local, sin pasar por Bookea
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 oct 2026): Foorkie vende la lealtad con su marca y
 * el cliente se une a la tarjeta de un local desde Foorkie (su página o
 * su app). Bookea sigue siendo el motor: la persona, el vínculo con el
 * negocio, el consentimiento y la membresía los escribe Bookea, y por el
 * MISMO camino que el póster (`/tarjeta/[slug]` → `altaPorQr`):
 *
 *   · `revisarAlta`: el mínimo (nombre + un contacto) y sus mensajes;
 *   · `altaPorQrSinSesion`: quién puede reclamar un contacto que ya está
 *     en Bookea, el tope del paquete y el RPC `alta_persona_por_qr`, que
 *     resuelve la persona (una que ya existe con ese correo se REUSA, no
 *     se duplica), escribe el vínculo y el consentimiento en una sola
 *     transacción y no duplica la membresía de quien ya la tenía.
 *
 * Acá no hay reglas nuevas. Lo que cambia es solo lo que no aplica:
 *
 *   · el CONSENTIMIENTO que se archiva es el que la persona leyó en
 *     Foorkie (su texto exacto y su versión, `ConsentimientoPropio`), con
 *     la IP y el navegador de la persona que manda Foorkie, y queda
 *     anotado con el origen `foorkie_web` / `foorkie_app`;
 *   · NO se abre la sesión del navegador de Bookea (no hay navegador de
 *     Bookea del otro lado): por eso `altaPorQrSinSesion`;
 *   · el correo NO está probado (lo escribió la persona en un formulario,
 *     como en el póster), así que va sin `personaProbada` ni sesión: si
 *     ese contacto ya tiene sellos EN ESTA TARJETA, el portero de la base
 *     (0227) pide prueba y acá se contesta `requiere_prueba` — su tarjeta
 *     la ve entrando a Foorkie con ese correo (`tarjetas`). Nunca se le
 *     entrega a quien solo tecleó el correo, y nunca se abre una segunda
 *     tarjeta (el desvío «sin cuenta» del póster no se usa acá: con el
 *     contacto en ESTA tarjeta, sería una tarjeta repetida);
 *   · el correo de bienvenida lo decide la MISMA guardia que en el póster
 *     (`losCorreosLosMandaFoorkie`, adentro de `avisarBienvenidaAlPlan`):
 *     una tarjeta marcada `lealtad_por_foorkie` no lo recibe de Bookea
 *     (se lo manda Foorkie); cualquier otra vinculada —Pura Matcha— lo
 *     recibe como siempre. La ruta lo dispara con `miembroParaLaBienvenida`.
 */

/** El cliente con la llave de servicio: el mismo que usa el alta del póster. */
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// ════════════════════════════════════════════════════════════════════
//  1. Lo que manda Foorkie
// ════════════════════════════════════════════════════════════════════

export const ORIGENES_AFILIAR = ["foorkie_web", "foorkie_app"] as const;
export type OrigenAfiliar = (typeof ORIGENES_AFILIAR)[number];

/** Los topes del contrato con Foorkie. */
export const LIMITES_AFILIAR = {
  nombre: { minimo: 2, maximo: 80 },
  correo: 254,
  whatsapp: 30,
  texto: { minimo: 10, maximo: 2000 },
  version: 40,
  userAgent: 400,
} as const;

export type PedidoAfiliar = {
  ranchoId: string;
  programaId: string;
  nombre: string;
  correo: string;
  whatsapp: string | null;
  aceptaPromos: boolean;
  /** El permiso EXACTO que leyó la persona en Foorkie. */
  consentimiento: { texto: string; version: string };
  origen: OrigenAfiliar;
  ip: string | null;
  userAgent: string | null;
};

export type Lectura<T> = { ok: true; valor: T } | { ok: false; motivo: string };

function uuidDe(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return UUID.test(t) ? t : null;
}

function ausente(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/**
 * La FORMA del pedido (lo que no cumple es un error de Foorkie → 400). Lo
 * que la persona puede corregir —un correo mal escrito, un WhatsApp
 * corto— se revisa después, con los mensajes del alta (`revisarDatosAfiliar`).
 */
export function leerPedidoAfiliar(d: Record<string, unknown>): Lectura<PedidoAfiliar> {
  const ranchoId = uuidDe(d.rancho_id);
  const programaId = uuidDe(d.programa_id);
  if (!ranchoId || !programaId) return { ok: false, motivo: "Faltan el negocio o la tarjeta (rancho_id y programa_id)." };

  const nombre = typeof d.nombre === "string" ? d.nombre.replace(/\s+/g, " ").trim() : "";
  if (nombre.length < LIMITES_AFILIAR.nombre.minimo || nombre.length > LIMITES_AFILIAR.nombre.maximo) {
    return { ok: false, motivo: "El nombre va de 2 a 80 caracteres." };
  }

  const correo = typeof d.correo === "string" ? d.correo.trim() : "";
  if (!correo || correo.length > LIMITES_AFILIAR.correo) return { ok: false, motivo: "Falta el correo." };

  let whatsapp: string | null = null;
  if (!ausente(d.whatsapp)) {
    if (typeof d.whatsapp !== "string" || d.whatsapp.length > LIMITES_AFILIAR.whatsapp) {
      return { ok: false, motivo: "El WhatsApp tiene que ser texto: solo dígitos, con o sin 506." };
    }
    whatsapp = d.whatsapp.trim();
  }

  const aceptaPromos = d.acepta_promos;
  if (typeof aceptaPromos !== "boolean") return { ok: false, motivo: "Falta acepta_promos (true o false)." };

  const c =
    d.consentimiento && typeof d.consentimiento === "object" && !Array.isArray(d.consentimiento)
      ? (d.consentimiento as Record<string, unknown>)
      : null;
  // El texto viaja TAL CUAL (es la prueba de lo que la persona leyó); el
  // mínimo se mide sin los espacios de los bordes.
  const texto = typeof c?.texto === "string" ? c.texto : "";
  if (texto.trim().length < LIMITES_AFILIAR.texto.minimo || texto.length > LIMITES_AFILIAR.texto.maximo) {
    return { ok: false, motivo: "Falta el texto del consentimiento que leyó la persona (de 10 a 2000 caracteres)." };
  }
  const version = typeof c?.version === "string" ? c.version.trim() : "";
  if (!version || version.length > LIMITES_AFILIAR.version) {
    return { ok: false, motivo: "Falta la versión del consentimiento (hasta 40 caracteres)." };
  }

  const origen = ORIGENES_AFILIAR.find((o) => o === d.origen);
  if (!origen) return { ok: false, motivo: "El origen es «foorkie_web» o «foorkie_app»." };

  // La IP y el navegador son PRUEBA del consentimiento, no requisito: lo
  // que no tenga forma se descarta en vez de tirar el alta (`ipValida`).
  const ip = typeof d.ip === "string" ? ipValida(d.ip) : null;
  const userAgent =
    typeof d.user_agent === "string" ? d.user_agent.trim().slice(0, LIMITES_AFILIAR.userAgent) || null : null;

  return {
    ok: true,
    valor: {
      ranchoId,
      programaId,
      nombre,
      correo,
      whatsapp,
      aceptaPromos,
      consentimiento: { texto, version },
      origen,
      ip,
      userAgent,
    },
  };
}

const MOTIVO_WHATSAPP = "El WhatsApp lleva 8 números — así: 8888 8888.";

/**
 * Lo que la persona puede corregir, con los MISMOS mensajes del póster
 * (`revisarAlta`). Lo único propio del contrato: el WhatsApp es de Costa
 * Rica —8 dígitos, o 11 con el 506 adelante—, porque la base se queda con
 * los últimos 8 y un número de otro país terminaría siendo el de alguien
 * más.
 */
export function revisarDatosAfiliar(
  p: Pick<PedidoAfiliar, "nombre" | "correo" | "whatsapp">,
): { ok: true; nombre: string; contacto: Contacto } | { ok: false; campo: CampoDelAlta; motivo: string } {
  let telefono: string | null = null;
  if (p.whatsapp) {
    const digitos = p.whatsapp.replace(/\D/g, "");
    if (!(digitos.length === 8 || (digitos.length === 11 && digitos.startsWith("506")))) {
      return { ok: false, campo: "whatsapp", motivo: MOTIVO_WHATSAPP };
    }
    telefono = digitos;
  }
  const r = revisarAlta({ nombre: p.nombre, correo: p.correo, telefono });
  if (!r.ok) return { ok: false, campo: r.campo, motivo: r.error };
  // El correo es obligatorio en el contrato: con él la persona encuentra
  // su tarjeta en Foorkie y le llegan las compras.
  if (!r.contacto.correo) return { ok: false, campo: "correo", motivo: "Revisá el correo: se escribe nombre@algo.com." };
  return { ok: true, nombre: r.nombre, contacto: r.contacto };
}

// ════════════════════════════════════════════════════════════════════
//  2. Lo que se le contesta
// ════════════════════════════════════════════════════════════════════

export type RespuestaAfiliar =
  | { ok: true; ya_era_miembro: boolean; tarjeta: TarjetaParaFoorkie }
  | {
      ok: false;
      codigo: string;
      /** Siempre en español, para mostrarlo tal cual. */
      motivo: string;
      /** Con `datos`: el campo a corregir. */
      campo?: CampoDelAlta;
      /** Con `requiere_prueba`: por dónde se la reconoce. */
      canal?: "correo" | "whatsapp";
    };

function delLocal(negocio: string): string {
  return negocio.trim() || "este local";
}

/** Por qué la tarjeta no está recibiendo a nadie hoy (`programa_no_opera`). */
export function motivoNoOpera(estado: EstadoVisible, negocio: string): string {
  const n = delLocal(negocio);
  switch (estado) {
    case "pausado":
      return `La tarjeta de lealtad de ${n} está en pausa por ahora. Si ya la tenés, lo que juntaste sigue guardado.`;
    case "borrador":
      return `La tarjeta de lealtad de ${n} todavía no está lista.`;
    case "programado":
      return `La tarjeta de lealtad de ${n} todavía no arranca. Consultá en el local desde cuándo.`;
    case "vencido":
      return `La tarjeta de lealtad de ${n} ya terminó.`;
    case "archivado":
      return `La tarjeta de lealtad de ${n} ya no está disponible.`;
    default:
      return `La tarjeta de lealtad de ${n} no está recibiendo clientes ahora mismo.`;
  }
}

/** La membresía existe pero el negocio la dio de baja o la suspendió (`dada_de_baja`). null = está activa. */
export function motivoDeBaja(estadoMiembro: string, negocio: string): string | null {
  const n = delLocal(negocio);
  if (estadoMiembro === "cancelada") {
    return `Tu tarjeta de ${n} está dada de baja. Consultá en el local si te la pueden volver a activar: lo que juntaste no se borró.`;
  }
  if (estadoMiembro === "pausada") {
    return `Tu tarjeta de ${n} está suspendida por ahora. Consultá en el local.`;
  }
  return null;
}

/**
 * Lo que dijo el alta, cuando no quedó lista. Sin hablar de planes ni de
 * paquetes (eso es del negocio), y sin confirmar sellos ni cuántos: la
 * respuesta ya deja ver que ese contacto tiene la tarjeta (es inevitable
 * para protegerla), pero no hace falta agregarle valor al dato.
 */
export function rechazoDelAlta(
  r: Exclude<ResultadoAltaSinSesion, { estado: "listo" }>,
  negocio: string,
): Extract<RespuestaAfiliar, { ok: false }> {
  const n = delLocal(negocio);
  if (r.estado === "requiere_prueba") {
    return {
      ok: false,
      codigo: "requiere_prueba",
      canal: r.canal,
      motivo:
        r.canal === "whatsapp"
          ? `Ya hay una tarjeta de ${n} con ese WhatsApp. Si es tuya, consultá en el local para recuperarla con todo lo que tengas juntado; si no, revisá el número.`
          : `Ya hay una tarjeta de ${n} con ese contacto. Si es tuya, entrá a Foorkie con el correo de esa tarjeta y la vas a encontrar en tu cuenta, con todo lo que tengas juntado.`,
    };
  }
  if (r.estado === "lleno") {
    return {
      ok: false,
      codigo: "cupo_agotado",
      motivo: `La tarjeta de lealtad de ${n} no está recibiendo clientes nuevos por ahora. Consultá en el local.`,
    };
  }
  return { ok: false, codigo: "rechazado", motivo: r.mensaje };
}

const REINTENTAR = "Tu tarjeta quedó lista, pero no la pudimos leer ahora mismo. Probá de nuevo en un momento.";

// ════════════════════════════════════════════════════════════════════
//  3. El alta
// ════════════════════════════════════════════════════════════════════

/** Lo que la base anota cuando el alta viene del póster; acá se corrige al origen real. */
const ORIGEN_DEL_POSTER = "qr_tarjeta";
const DETALLE_DEL_ESPEJO = "Espejo de consentimientos_persona (0138)";
/** Margen por la diferencia de reloj entre este servidor y la base. */
const MARGEN_RELOJ_MS = 2 * 60_000;

/**
 * El origen del permiso: `alta_persona_por_qr` anota `qr_tarjeta` en las
 * filas que acaba de escribir (no tiene parámetro para eso, y el esquema
 * no se toca), así que se corrige a `foorkie_web` / `foorkie_app` en esas
 * filas y solo en esas: las de esta persona, este negocio, la versión del
 * texto de Foorkie y los últimos minutos. Lo mismo en el espejo por
 * correo (0082). Nunca lanza ni tumba el alta: el permiso, su texto y su
 * versión ya quedaron; esto es la etiqueta de por dónde entró.
 */
export async function anotarOrigenDelPermiso(
  db: Admin,
  d: { personaId: string; ranchoId: string; correo: string | null; version: string; origen: OrigenAfiliar; desde: string },
): Promise<void> {
  try {
    const [prueba, espejo] = await Promise.all([
      db
        .from("consentimientos_persona")
        .update({ origen: d.origen })
        .eq("persona_id", d.personaId)
        .eq("ambito", "negocio")
        .eq("rancho_id", d.ranchoId)
        .eq("origen", ORIGEN_DEL_POSTER)
        .eq("texto_version", d.version)
        .gte("created_at", d.desde),
      d.correo
        ? db
            .from("consentimientos")
            .update({ origen: d.origen })
            .eq("correo", d.correo)
            .eq("rancho_id", d.ranchoId)
            .eq("origen", ORIGEN_DEL_POSTER)
            .eq("detalle", DETALLE_DEL_ESPEJO)
            .gte("created_at", d.desde)
        : Promise.resolve({ error: null }),
    ]);
    if (prueba.error || espejo.error) {
      console.warn("[foorkie/afiliar] No se pudo anotar el origen del permiso:", (prueba.error ?? espejo.error)?.message);
    }
  } catch (e) {
    console.warn("[foorkie/afiliar] No se pudo anotar el origen del permiso:", e);
  }
}

export type DependenciasAfiliar = {
  /** El alta del póster sin la cookie. Se inyecta solo en las pruebas. */
  alta: (db: Admin, p: ParametrosAlta) => Promise<ResultadoAltaSinSesion>;
  /**
   * Los sellos de regalo al unirse (0253). Por defecto
   * `regaloDeBienvenidaDeFoorkie`; en las pruebas, un doble.
   */
  regalo?: (db: Admin, d: { ranchoId: string; programaId: string; miembroId: string }) => Promise<number>;
};

/**
 * ¿La tarjeta regala sellos al unirse? Pura: lo dice su `beneficio`
 * (`ConfigSellos.inicial`, menos que la meta). 0 si no.
 */
export function sellosDeRegalo(fila: Record<string, unknown>): number {
  if (tipoDe(typeof fila.modo === "string" ? fila.modo : null) !== "sellos") return 0;
  const b = leerBeneficio(fila.beneficio, "sellos");
  if (b?.tipo !== "sellos" || !Number.isInteger(b.inicial) || b.inicial <= 0 || b.inicial >= b.requeridos) return 0;
  return b.inicial;
}

/**
 * LOS SELLOS DE REGALO AL UNIRSE, en una tarjeta de FOORKIE (0253).
 *
 * El restaurante los configura en las Reglas de su tarjeta y los recibe
 * quien se une desde Foorkie (su página o su app), una sola vez
 * (`referenciaDeBienvenida`). Solo con la marca `lealtad_por_foorkie`: una
 * tarjeta de Bookea vinculada —Pura Matcha— no cambia. Nunca lanza.
 */
export async function regaloDeBienvenidaDeFoorkie(
  db: Admin,
  d: { ranchoId: string; programaId: string; miembroId: string },
): Promise<number> {
  try {
    if (!(await localDeFoorkieDeLaTarjeta(db, { programaId: d.programaId, ranchoId: d.ranchoId }))) return 0;
    return await regalarSellosDeBienvenidaCore({ db, ranchoId: d.ranchoId, miembroId: d.miembroId });
  } catch (e) {
    console.warn("[foorkie/afiliar] No entraron los sellos de regalo:", e);
    return 0;
  }
}

/**
 * De punta a punta: la tarjeta tiene que estar operando, los datos se
 * revisan con las reglas del póster, el alta corre por el núcleo y se
 * devuelve la tarjeta como en `tarjetas` (con los links al Wallet).
 *
 * El vínculo con Foorkie (`vinculoConFoorkie`) lo comprobó la ruta antes.
 */
export async function afiliarDesdeFoorkie(
  db: Admin,
  pedido: PedidoAfiliar,
  { base, secreto, ahora = new Date() }: { base: string; secreto: string; ahora?: Date },
  { alta, regalo = regaloDeBienvenidaDeFoorkie }: DependenciasAfiliar = { alta: altaPorQrSinSesion },
): Promise<RespuestaAfiliar> {
  const { ranchoId, programaId } = pedido;

  const [{ data: negocio }, { data: filaCruda }] = await Promise.all([
    db.from("ranchos").select("id, nombre, plan_lealtad").eq("id", ranchoId).maybeSingle(),
    // `select *`: el alta y la tarjeta leen columnas de varias migraciones.
    db.from("programa_lealtad").select("*").eq("id", programaId).eq("rancho_id", ranchoId).maybeSingle(),
  ]);
  const nombreNegocio = typeof negocio?.nombre === "string" ? negocio.nombre.trim() : "";
  if (!negocio || !filaCruda) {
    return { ok: false, codigo: "programa_no_opera", motivo: `La tarjeta de lealtad de ${delLocal(nombreNegocio)} ya no está disponible.` };
  }
  const fila = filaCruda as Record<string, unknown>;

  // Que esté emitiendo se mira ACÁ, como en el póster: entre que Foorkie
  // dibujó el formulario y la persona tocó el botón, el dueño pudo pausarla.
  const estado = estadoVisible(resumenDeFila(fila), minutoISOCR(ahora));
  if (estado !== "activo") return { ok: false, codigo: "programa_no_opera", motivo: motivoNoOpera(estado, nombreNegocio) };

  const revision = revisarDatosAfiliar(pedido);
  if (!revision.ok) return { ok: false, codigo: "datos", campo: revision.campo, motivo: revision.motivo };

  const desde = new Date(ahora.getTime() - MARGEN_RELOJ_MS).toISOString();
  const r = await alta(db, {
    programa: fila,
    ranchoId,
    planRancho: typeof negocio.plan_lealtad === "string" ? negocio.plan_lealtad : null,
    nombreNegocio,
    contacto: revision.contacto,
    nombre: revision.nombre,
    acepta: pedido.aceptaPromos,
    // El correo lo escribió alguien en un formulario: no prueba nada.
    personaProbada: null,
    sesion: { clienteId: null, correo: null },
    sinReclamo: false,
    ip: pedido.ip,
    userAgent: pedido.userAgent,
    consentimiento: pedido.consentimiento,
  });
  if (r.estado !== "listo") return rechazoDelAlta(r, nombreNegocio);

  await anotarOrigenDelPermiso(db, {
    personaId: r.personaId,
    ranchoId,
    correo: revision.contacto.correo,
    version: pedido.consentimiento.version,
    origen: pedido.origen,
    desde,
  });

  if (!r.miembroId) return { ok: false, codigo: "reintentar", motivo: REINTENTAR };
  const { data: miembro } = await db.from("miembros").select("id, programa_id, estado").eq("id", r.miembroId).maybeSingle();
  if (!miembro || miembro.programa_id !== programaId) return { ok: false, codigo: "reintentar", motivo: REINTENTAR };
  // Los sellos de regalo (0253): a la membresía NUEVA y activa (una dada
  // de baja o suspendida cae justo abajo), antes de leer el saldo, así la
  // tarjeta que se devuelve ya los trae. Solo si la tarjeta regala
  // (`sellosDeRegalo`): las demás ni hacen la consulta de la marca.
  if (r.miembroNuevo && miembro.estado === "activa" && sellosDeRegalo(fila) > 0) {
    await regalo(db, { ranchoId, programaId, miembroId: r.miembroId });
  }
  const baja = motivoDeBaja(String(miembro.estado ?? ""), nombreNegocio);
  if (baja) return { ok: false, codigo: "dada_de_baja", motivo: baja };

  const [saldo, meta, marca] = await Promise.all([
    saldoDelMiembro(db, r.miembroId),
    metaDelPrograma(db, programaId),
    // Lo que su pase dice bajo el QR (`vista.pie`). Nunca rechaza: ante la duda, Bookea.
    marcaDeLaTarjeta(db, { programaId, ranchoId }),
  ]);
  // Sin el ledger no se inventa un 0: el alta ya quedó y reintentar no duplica nada.
  if (saldo === null) return { ok: false, codigo: "reintentar", motivo: REINTENTAR };

  return {
    ok: true,
    ya_era_miembro: !r.miembroNuevo,
    tarjeta: armarTarjeta({
      miembroId: r.miembroId,
      fila,
      negocio: nombreNegocio,
      saldo,
      meta,
      links: linksDelMiembro(base, r.miembroId, secreto, ahora.getTime()),
      ahora,
      marca,
    }),
  };
}

/**
 * A quién darle la bienvenida después de un alta: al miembro NUEVO, igual
 * que el póster (`miembro_nuevo` de la 0138), nunca a quien ya tenía la
 * tarjeta. Si el correo sale o no lo decide `avisarBienvenidaAlPlan` con
 * su guardia: una tarjeta de Foorkie (marcada) no lo recibe de Bookea.
 */
export function miembroParaLaBienvenida(r: RespuestaAfiliar): string | null {
  return r.ok && !r.ya_era_miembro ? r.tarjeta.miembro_id : null;
}
