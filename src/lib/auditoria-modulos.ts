import { definicionDe } from "@/lib/lealtad/planes";

/**
 * AUDITORÍA DE LOS MÓDULOS — cuánto se cobra por los paquetes de
 * Lealtad y los complementos, y por dónde entró.
 *
 * No confundir con las otras dos pantallas de plata:
 *   · `libro-cobros.ts` / `auditoria-dinero.ts` — la COMISIÓN de las
 *     reservas (depósito → adelanto → cobro del día del evento).
 *   · `finanzas.ts` — la caja del negocio.
 * Esto de acá es lo que los negocios le pagan A BOOKEA por el
 * software: suscripciones y complementos. Un total que mezclara las
 * dos cosas no sería de nadie.
 *
 * Módulo NEUTRO (sin "use client"): lo importan el server component de
 * /admin/modulos y su panel del navegador. Todo puro y probado en
 * auditoria-modulos.test.ts.
 *
 * ── LAS DOS REGLAS QUE ORDENAN TODO ──────────────────────────────────
 *
 * 1. NO SE INVENTA UN NÚMERO. Si un cobro no tiene monto guardado, no
 *    se estima desde el precio de lista: el depósito pudo ser otro, en
 *    colones a otro tipo de cambio, anual en vez de mensual. Se cuenta
 *    aparte y se dice en pantalla (`cobrosConocidosSinMonto`).
 *
 * 2. LAS MONEDAS NO SE SUMAN. Los paquetes están tarifados en dólares
 *    y el SINPE entra en colones al tipo de cambio del día, que el
 *    sistema no guarda. Por eso `Totales` tiene DOS campos separados y
 *    ninguna función devuelve jamás un "total general".
 */

/* ────────────────────────────────────────────────────────────────
   1. LA FILA DEL LIBRO (tabla `cobros_modulo`, migración 0172)
   ──────────────────────────────────────────────────────────────── */

export const METODOS_COBRO = ["sinpe", "transferencia", "stripe", "otro"] as const;
export type MetodoCobro = (typeof METODOS_COBRO)[number];

export const METODO_LABEL: Record<MetodoCobro, string> = {
  sinpe: "SINPE Móvil",
  transferencia: "Transferencia",
  stripe: "Stripe (tarjeta)",
  otro: "Otro medio",
};

export const MONEDAS_COBRO = ["CRC", "USD"] as const;
export type MonedaCobro = (typeof MONEDAS_COBRO)[number];

export const PRODUCTOS_COBRO = ["plan_lealtad", "complemento"] as const;
export type ProductoCobro = (typeof PRODUCTOS_COBRO)[number];

export const PRODUCTO_LABEL: Record<ProductoCobro, string> = {
  plan_lealtad: "Paquete de Lealtad",
  complemento: "Complemento suelto",
};

export const PERIODOS_COBRO = ["mensual", "anual", "unico"] as const;
export type PeriodoCobro = (typeof PERIODOS_COBRO)[number];

export const PERIODO_LABEL: Record<PeriodoCobro, string> = {
  mensual: "Mes",
  anual: "Año",
  unico: "Pago único",
};

/** Una fila de `cobros_modulo`, tal como sale de la base. */
export type CobroModulo = {
  id: string;
  rancho_id: string | null;
  negocio_nombre: string | null;
  producto: ProductoCobro;
  plan: string | null;
  addon: string | null;
  periodo: PeriodoCobro;
  metodo: MetodoCobro;
  /** Lo que entró, en la moneda de `moneda`. Nunca convertido. */
  monto: number;
  moneda: MonedaCobro;
  tipo_cambio: number | null;
  es_cortesia: boolean;
  valor_lista_usd: number | null;
  cobrado_en: string;
  solicitud_id: string | null;
  stripe_invoice_id: string | null;
  notas: string | null;
  anulado_en: string | null;
  anulado_motivo: string | null;
};

/**
 * ¿Esta fila es INGRESO?
 *
 * Las anuladas no (dejaron de ser plata) y las cortesías tampoco
 * (nunca lo fueron). La base ya obliga `monto = 0` en las cortesías,
 * así que este filtro no cambia el total — cambia el CONTEO, que es
 * justo donde una cortesía contada como venta miente.
 */
export function esIngreso(c: CobroModulo): boolean {
  return !c.anulado_en && !c.es_cortesia;
}

/* ────────────────────────────────────────────────────────────────
   2. EL TIEMPO, EN HORA DE COSTA RICA
   ──────────────────────────────────────────────────────────────── */

const FMT_CR = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Costa_Rica",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Año/mes/día en hora tica. El servidor corre en UTC: después de las
 * 6 p.m. de acá ya sería el día siguiente, y un cobro del 31 se
 * contaría en el mes que viene.
 */
function partesCR(fecha: Date): { anio: string; mes: string; dia: string } {
  const partes = FMT_CR.formatToParts(fecha);
  const buscar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return { anio: buscar("year"), mes: buscar("month"), dia: buscar("day") };
}

/** "2026-08" — el mes al que pertenece una fecha, en hora tica. */
export function mesCR(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "";
  const { anio, mes } = partesCR(d);
  return `${anio}-${mes}`;
}

/** "2026" */
export function anioCR(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "";
  return partesCR(d).anio;
}

/** "2026-08-13" */
export function diaCR(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "";
  const { anio, mes, dia } = partesCR(d);
  return `${anio}-${mes}-${dia}`;
}

/** El mes anterior a una clave "YYYY-MM", sin depender de Date. */
export function mesAnterior(clave: string): string {
  const [anio, mes] = clave.split("-").map((n) => Number(n));
  if (!anio || !mes) return "";
  return mes === 1
    ? `${anio - 1}-12`
    : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}

export const PERIODOS_VISTA = [
  { id: "mes", label: "Mes en curso" },
  { id: "mes_pasado", label: "Mes pasado" },
  { id: "anio", label: "Año" },
  { id: "todo", label: "Todo" },
] as const;
export type PeriodoVista = (typeof PERIODOS_VISTA)[number]["id"];

export function esPeriodoVista(valor: string | undefined): valor is PeriodoVista {
  return PERIODOS_VISTA.some((p) => p.id === valor);
}

/** ¿Este cobro cae dentro del período elegido? */
export function enPeriodo(
  cobradoEn: string,
  periodo: PeriodoVista,
  hoy: Date = new Date(),
): boolean {
  if (periodo === "todo") return true;
  const mes = mesCR(cobradoEn);
  if (!mes) return false;
  if (periodo === "anio") return anioCR(cobradoEn) === anioCR(hoy);
  const mesHoy = mesCR(hoy);
  return periodo === "mes" ? mes === mesHoy : mes === mesAnterior(mesHoy);
}

/**
 * Días enteros entre dos momentos. Devuelve 0 si alguna fecha no se
 * puede leer — nunca un número inventado que dispare una alerta.
 */
export function diasEntre(desdeIso: string, hastaIso: string): number {
  const a = new Date(desdeIso).getTime();
  const b = new Date(hastaIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

/* ────────────────────────────────────────────────────────────────
   3. TOTALES — dos monedas, nunca una
   ──────────────────────────────────────────────────────────────── */

export type Totales = {
  /** Colones que entraron. */
  crc: number;
  /** Dólares que entraron. */
  usd: number;
  /** Cuántos cobros los produjeron. */
  cobros: number;
};

export const TOTALES_CERO: Totales = { crc: 0, usd: 0, cobros: 0 };

/**
 * Suma una lista de cobros. NO recibe un período ni un filtro: recibe
 * exactamente las filas que la pantalla está mostrando, para que el
 * total sea siempre la suma de lo que se ve. Un total que sale de otra
 * consulta y no coincide con la lista es la forma clásica de que un
 * panel de plata mienta sin que nadie lo note.
 */
export function totalesDe(cobros: readonly CobroModulo[]): Totales {
  const t: Totales = { crc: 0, usd: 0, cobros: 0 };
  for (const c of cobros) {
    if (!esIngreso(c)) continue;
    const monto = Number(c.monto) || 0;
    if (c.moneda === "CRC") t.crc += monto;
    else t.usd += monto;
    t.cobros += 1;
  }
  return t;
}

/** Los mismos totales, partidos por la clave que se pida. */
export function totalesPor<K extends string>(
  cobros: readonly CobroModulo[],
  clave: (c: CobroModulo) => K,
): Map<K, Totales> {
  const mapa = new Map<K, Totales>();
  for (const c of cobros) {
    if (!esIngreso(c)) continue;
    const k = clave(c);
    const actual = mapa.get(k) ?? { crc: 0, usd: 0, cobros: 0 };
    const monto = Number(c.monto) || 0;
    if (c.moneda === "CRC") actual.crc += monto;
    else actual.usd += monto;
    actual.cobros += 1;
    mapa.set(k, actual);
  }
  return mapa;
}

export type ResumenCortesias = {
  cantidad: number;
  /** Lo que habría costado en el catálogo. NO es ingreso. */
  valorListaUsd: number;
  /** Cuántas se dieron sin anotar cuánto valían. */
  sinValor: number;
};

/**
 * Las cortesías, aparte y sin sumar a ingresos.
 *
 * Se muestran porque cuánto se está REGALANDO es una pregunta de
 * auditoría tan válida como cuánto se está cobrando — pero en su
 * propio renglón, en su propia unidad (valor de catálogo), y nunca
 * mezcladas con la caja.
 *
 * OJO, SON DOS FUENTES Y NO UNA. Acá se cuentan las filas del libro de
 * cobros marcadas como cortesía. Los paquetes REGALADOS desde
 * /admin/complementos quedan en `historial_plan_lealtad` con concepto
 * 'cortesia' y no dejan fila en el libro: para esas está
 * `cortesiasDePlan`. La pantalla muestra las dos, cada una diciendo de
 * dónde salió — juntarlas en un solo número duplicaría las que algún
 * día se registren en los dos lados.
 */
export function resumenCortesias(cobros: readonly CobroModulo[]): ResumenCortesias {
  let cantidad = 0;
  let valorListaUsd = 0;
  let sinValor = 0;
  for (const c of cobros) {
    if (c.anulado_en || !c.es_cortesia) continue;
    cantidad += 1;
    if (c.valor_lista_usd === null) sinValor += 1;
    else valorListaUsd += Number(c.valor_lista_usd) || 0;
  }
  return { cantidad, valorListaUsd, sinValor };
}

export type CortesiaDePlan = {
  id: string;
  negocio: string;
  plan: string | null;
  cortesiaHasta: string | null;
  creadoEn: string;
};

/**
 * Los paquetes que se REGALARON desde el panel, sacados de la bitácora
 * de planes. No son filas del libro de cobros y por eso van por su
 * cuenta: si algún día la acción de regalar también anota un renglón de
 * ₡0 en el libro, hay que elegir UNA de las dos fuentes y no sumar las
 * dos — contar dos veces la misma cortesía infla lo regalado.
 */
export function cortesiasDePlan(e: EntradaAuditoria): CortesiaDePlan[] {
  const nombreDe = new Map(e.negocios.map((n) => [n.id, n.nombre]));
  return e.movimientos
    .filter((m) => m.concepto === "cortesia")
    .map((m) => ({
      id: `${m.ranchoId}:${m.creadoEn}`,
      negocio: nombreDe.get(m.ranchoId) ?? "(negocio dado de baja)",
      plan: m.planDespues,
      cortesiaHasta: m.cortesiaHasta,
      creadoEn: m.creadoEn,
    }))
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/* ────────────────────────────────────────────────────────────────
   4. LO QUE SE AUDITA CONTRA LO QUE YA EXISTE EN LA BASE
   ──────────────────────────────────────────────────────────────── */

export type NegocioAuditoria = {
  id: string;
  nombre: string;
  vertical: string | null;
  /** `ranchos.plan_lealtad` — lo que muestra y escribe /admin/complementos. */
  planRancho: string | null;
  addons: { addon: string; activo: boolean; venceEn: string | null }[];
};

/** Una fila de `cuentas` (0134): ahí vive el plan que MANDA. */
export type CuentaAuditoria = {
  id: string;
  ranchoId: string | null;
  plan: string | null;
};

export type SolicitudAuditoria = {
  id: string;
  ranchoId: string | null;
  negocioNombre: string | null;
  plan: string;
  estado: string;
  metodoPago: string | null;
  comprobanteUrl: string | null;
  createdAt: string;
  atendidaEn: string | null;
};

export type SuscripcionAuditoria = {
  id: string;
  ranchoId: string | null;
  cuentaId: string | null;
  plan: string | null;
  estado: string;
  periodo: string;
  periodoFin: string | null;
};

/**
 * Un movimiento de `historial_plan_lealtad`: la bitácora de quién le
 * cambió el paquete a quién y con qué concepto.
 *
 * Es de OTRA pieza (la que da las regalías desde /admin/complementos) y
 * acá se lee, nunca se escribe. Las dos se necesitan y no se pisan: esa
 * tabla registra el HECHO (se vendió, se regaló, se dio de baja) y
 * `cobros_modulo` registra la PLATA. Cruzarlas es lo que permite la
 * pregunta que ninguna de las dos contesta sola: «acá dice que se
 * vendió, ¿dónde está el cobro?».
 */
export type MovimientoPlanAuditoria = {
  ranchoId: string;
  concepto: "venta" | "cortesia" | "correccion" | "baja";
  planDespues: string | null;
  cortesiaHasta: string | null;
  creadoEn: string;
};

export type EntradaAuditoria = {
  negocios: readonly NegocioAuditoria[];
  cuentas: readonly CuentaAuditoria[];
  /** false = no se pudo leer `cuentas`: no se afirma que nada discrepa. */
  cuentasLegibles: boolean;
  solicitudes: readonly SolicitudAuditoria[];
  suscripciones: readonly SuscripcionAuditoria[];
  cobros: readonly CobroModulo[];
  /** Vacío si la bitácora de planes todavía no existe en la base. */
  movimientos: readonly MovimientoPlanAuditoria[];
  ahora: Date;
};

/**
 * ¿Este paquete se cobra?
 *
 * `precioMensual === 0` son los gratuitos (hoy solo 'prueba'). Los que
 * tienen precio `null` NO son gratis: son «a convenir», así que sí
 * cuentan como plan de pago — tratarlos como gratuitos escondería
 * justo los contratos más grandes.
 *
 * Ningún paquete del catálogo de hoy se cotiza caso por caso (los que
 * lo hacían eran retirados y se borraron en la 0179), pero la
 * distinción se queda: es `!== 0` y no `> 0` a propósito, y hay una
 * prueba que la sostiene con un paquete inyectado.
 */
export function planEsDePago(plan: string | null): boolean {
  const def = definicionDe(plan);
  if (!def) return false;
  return def.precioMensual !== 0;
}

/** El nombre lindo del paquete; si no está en el catálogo, su id. */
export function nombrePlan(plan: string | null): string {
  if (!plan) return "sin paquete";
  return definicionDe(plan)?.nombre ?? plan;
}

const ESTADOS_VIVOS = ["activa", "en_prueba"];
const ESTADOS_MUERTOS = ["cancelada", "morosa"];

/** Días que puede esperar un comprobante subido antes de ser hallazgo. */
export const UMBRAL_COMPROBANTE_DIAS = 3;

/** Margen entre que se anota la venta y que se anota el cobro. */
export const MARGEN_VENTA_DIAS = 7;

export const HALLAZGOS = [
  "plan_sin_pago",
  "venta_sin_cobro",
  "plan_discrepante",
  "suscripcion_duplicada",
  "suscripcion_sin_negocio",
  "comprobante_sin_atender",
  "suscripcion_muerta_plan_vivo",
  "cobro_sin_negocio",
] as const;
export type ClaveHallazgo = (typeof HALLAZGOS)[number];

export type GravedadHallazgo = "alta" | "media" | "baja";

export const HALLAZGO_INFO: Record<
  ClaveHallazgo,
  { titulo: string; gravedad: GravedadHallazgo; porQue: string; queHacer: string }
> = {
  plan_sin_pago: {
    titulo: "Paquete de pago sin ningún rastro de cobro",
    gravedad: "alta",
    porQue:
      "El negocio tiene un paquete que se cobra, pero no hay solicitud atendida, ni suscripción de Stripe, ni cobro anotado en el libro. O pagó por fuera y nadie lo registró, o lo está usando gratis.",
    queHacer:
      "Si pagó, anotá el cobro acá abajo. Si es una cortesía, registrala como cortesía para que deje de aparecer.",
  },
  venta_sin_cobro: {
    titulo: "Venta anotada en la bitácora y sin cobro en el libro",
    gravedad: "alta",
    porQue:
      "Alguien movió el paquete con el concepto «venta», así que hubo plata de por medio, pero no hay ningún cobro anotado para ese negocio en esas fechas. O el cobro no se registró, o la venta era en realidad una cortesía.",
    queHacer:
      "Anotar el cobro con su monto, o corregir el concepto del movimiento si fue una cortesía.",
  },
  plan_discrepante: {
    titulo: "El paquete que ve el admin no es el que usa el negocio",
    gravedad: "alta",
    porQue:
      "Desde la 0134 el paquete que manda es `cuentas.plan`, y el desplegable de /admin/complementos escribe solo `ranchos.plan_lealtad`. Cuando los dos no coinciden, el admin cree haber cambiado el plan y el panel del negocio sigue con el anterior.",
    queHacer:
      "Igualar los dos valores. Mientras se arregla el desplegable, el único que escribe los dos es el webhook de Stripe.",
  },
  suscripcion_duplicada: {
    titulo: "Dos suscripciones vivas en el mismo negocio",
    gravedad: "alta",
    porQue:
      "Se le está cobrando dos veces por el mismo módulo, o quedó una vieja sin cancelar cuando cambió de paquete.",
    queHacer: "Revisar en Stripe cuál queda y cancelar la otra.",
  },
  suscripcion_sin_negocio: {
    titulo: "Suscripción de Stripe que no se puede atribuir",
    gravedad: "alta",
    porQue:
      "Entra plata todos los meses y no se sabe de quién: la suscripción no apunta a ningún negocio conocido de esta lista.",
    queHacer: "Atarla al negocio a mano, o dar de baja el cobro en Stripe.",
  },
  comprobante_sin_atender: {
    titulo: "Comprobante subido y sin aprobar",
    gravedad: "alta",
    porQue:
      "El negocio ya depositó y subió la captura, pero nadie aprobó la solicitud: está pagando y no tiene el módulo encendido.",
    queHacer: "Aprobar (o rechazar) desde /admin/complementos, y anotar el monto acá.",
  },
  suscripcion_muerta_plan_vivo: {
    titulo: "Suscripción caída y el paquete sigue encendido",
    gravedad: "media",
    porQue:
      "La 0143 decide a propósito no bajarle el plan a nadie de forma automática: la baja la decide una persona. Esta es esa lista — si nadie la mira, el módulo queda regalado sin que sea una cortesía.",
    queHacer: "Cobrar de nuevo, bajar el paquete, o convertirlo en cortesía registrada.",
  },
  cobro_sin_negocio: {
    titulo: "Cobro de un negocio dado de baja",
    gravedad: "baja",
    porQue:
      "La plata entró y el negocio ya no está. La fila se conserva a propósito (el libro no pierde ingresos por una baja), pero conviene saber que estos montos no se pueden atribuir a nadie vivo.",
    queHacer: "Nada urgente: es informativo para que el total del período se entienda.",
  },
};

export type Hallazgo = {
  /** Estable, sirve de key de React. */
  id: string;
  clave: ClaveHallazgo;
  gravedad: GravedadHallazgo;
  negocioId: string | null;
  negocio: string;
  /** Qué pasa en ESTE caso, con sus datos. */
  detalle: string;
};

const ORDEN_GRAVEDAD: Record<GravedadHallazgo, number> = { alta: 0, media: 1, baja: 2 };

/**
 * Los problemas, no los totales.
 *
 * Una tabla de sumas no es una auditoría: sirve para leer, no para
 * encontrar. Esto recorre lo que YA existe en la base (planes,
 * solicitudes, suscripciones) y devuelve las contradicciones — plata
 * que debería haber entrado y no aparece, cobros que no se pueden
 * atribuir, y el desfase entre las dos columnas donde vive el plan.
 */
export function detectarHallazgos(e: EntradaAuditoria): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const ahoraIso = e.ahora.toISOString();

  const negocioPorId = new Map(e.negocios.map((n) => [n.id, n]));
  const planCuentaDe = new Map<string, string | null>();
  const ranchoDeCuenta = new Map<string, string | null>();
  for (const c of e.cuentas) {
    ranchoDeCuenta.set(c.id, c.ranchoId);
    if (c.ranchoId) planCuentaDe.set(c.ranchoId, c.plan);
  }

  /** El negocio al que pertenece una suscripción, por rancho o por cuenta. */
  const ranchoDeSuscripcion = (s: SuscripcionAuditoria): string | null =>
    s.ranchoId ?? (s.cuentaId ? (ranchoDeCuenta.get(s.cuentaId) ?? null) : null);

  // Rastros de pago por negocio, de las tres fuentes que existen.
  const conSolicitudAtendida = new Set<string>();
  for (const s of e.solicitudes) {
    if (s.estado === "atendida" && s.ranchoId) conSolicitudAtendida.add(s.ranchoId);
  }
  const conSuscripcion = new Set<string>();
  for (const s of e.suscripciones) {
    const r = ranchoDeSuscripcion(s);
    if (r) conSuscripcion.add(r);
  }
  const conCobro = new Set<string>();
  for (const c of e.cobros) {
    if (!c.anulado_en && c.rancho_id) conCobro.add(c.rancho_id);
  }

  // Los negocios cuyo paquete se REGALÓ con una cortesía anotada en la
  // bitácora: están explicados, no son plata que falta.
  const conCortesiaDePlan = new Set(
    e.movimientos.filter((m) => m.concepto === "cortesia").map((m) => m.ranchoId),
  );

  // 1. Paquete de pago sin rastro de cobro.
  for (const n of e.negocios) {
    const planEfectivo = planCuentaDe.get(n.id) ?? n.planRancho;
    if (!planEsDePago(planEfectivo)) continue;
    if (
      conSolicitudAtendida.has(n.id) ||
      conSuscripcion.has(n.id) ||
      conCobro.has(n.id) ||
      conCortesiaDePlan.has(n.id)
    ) {
      continue;
    }
    hallazgos.push({
      id: `plan_sin_pago:${n.id}`,
      clave: "plan_sin_pago",
      gravedad: "alta",
      negocioId: n.id,
      negocio: n.nombre,
      detalle: `Tiene el paquete ${nombrePlan(planEfectivo)} y no hay solicitud, suscripción ni cobro registrado.`,
    });
  }

  // 1b. Venta anotada en la bitácora sin cobro que la respalde. Se
  //     mira una ventana alrededor de la venta y no «¿tiene algún
  //     cobro alguna vez?»: un negocio que paga hace un año tendría
  //     cobros viejos y taparía la venta nueva sin registrar.
  for (const m of e.movimientos) {
    if (m.concepto !== "venta") continue;
    const desde = new Date(m.creadoEn).getTime() - MARGEN_VENTA_DIAS * 86_400_000;
    if (Number.isNaN(desde)) continue;
    const respaldada = e.cobros.some(
      (c) =>
        !c.anulado_en &&
        c.rancho_id === m.ranchoId &&
        new Date(c.cobrado_en).getTime() >= desde,
    );
    if (respaldada) continue;
    hallazgos.push({
      id: `venta_sin_cobro:${m.ranchoId}:${m.creadoEn}`,
      clave: "venta_sin_cobro",
      gravedad: "alta",
      negocioId: m.ranchoId,
      negocio: negocioPorId.get(m.ranchoId)?.nombre ?? "(negocio dado de baja)",
      detalle: `Se anotó una venta de ${nombrePlan(m.planDespues)} el ${diaCR(m.creadoEn)} y no hay ningún cobro registrado para ese negocio desde entonces.`,
    });
  }

  // 2. `cuentas.plan` ≠ `ranchos.plan_lealtad`. Solo cuando la cuenta
  //    trae un valor: con la cuenta en null manda el rancho y no hay
  //    contradicción (ver `planEfectivo` en lib/lealtad/cuenta.ts).
  if (e.cuentasLegibles) {
    for (const n of e.negocios) {
      const planCuenta = planCuentaDe.get(n.id) ?? null;
      if (planCuenta === null || planCuenta === n.planRancho) continue;
      hallazgos.push({
        id: `plan_discrepante:${n.id}`,
        clave: "plan_discrepante",
        gravedad: "alta",
        negocioId: n.id,
        negocio: n.nombre,
        detalle: `El negocio usa ${nombrePlan(planCuenta)} (cuentas.plan) y el admin muestra ${nombrePlan(n.planRancho)} (ranchos.plan_lealtad).`,
      });
    }
  }

  // 3. Dos suscripciones vivas en el mismo negocio.
  const vivasPorRancho = new Map<string, SuscripcionAuditoria[]>();
  for (const s of e.suscripciones) {
    if (!ESTADOS_VIVOS.includes(s.estado)) continue;
    const r = ranchoDeSuscripcion(s);
    if (!r) continue;
    vivasPorRancho.set(r, [...(vivasPorRancho.get(r) ?? []), s]);
  }
  for (const [ranchoId, lista] of vivasPorRancho) {
    if (lista.length < 2) continue;
    hallazgos.push({
      id: `suscripcion_duplicada:${ranchoId}`,
      clave: "suscripcion_duplicada",
      gravedad: "alta",
      negocioId: ranchoId,
      negocio: negocioPorId.get(ranchoId)?.nombre ?? "(negocio dado de baja)",
      detalle: `${lista.length} suscripciones vivas: ${lista
        .map((s) => `${nombrePlan(s.plan)} (${s.estado})`)
        .join(" · ")}.`,
    });
  }

  // 4. Suscripción viva que no cae en ningún negocio conocido.
  for (const s of e.suscripciones) {
    if (!ESTADOS_VIVOS.includes(s.estado)) continue;
    const r = ranchoDeSuscripcion(s);
    if (r && negocioPorId.has(r)) continue;
    hallazgos.push({
      id: `suscripcion_sin_negocio:${s.id}`,
      clave: "suscripcion_sin_negocio",
      gravedad: "alta",
      negocioId: null,
      negocio: "(sin negocio)",
      detalle: `Suscripción ${nombrePlan(s.plan)} en estado ${s.estado}${
        s.cuentaId ? ", atada a una cuenta sin negocio" : ", sin negocio ni cuenta que resuelva"
      }.`,
    });
  }

  // 5. Comprobante subido y sin atender.
  for (const s of e.solicitudes) {
    if (s.estado !== "pendiente" || !s.comprobanteUrl) continue;
    const dias = diasEntre(s.createdAt, ahoraIso);
    if (dias < UMBRAL_COMPROBANTE_DIAS) continue;
    hallazgos.push({
      id: `comprobante_sin_atender:${s.id}`,
      clave: "comprobante_sin_atender",
      gravedad: "alta",
      negocioId: s.ranchoId,
      negocio:
        (s.ranchoId ? negocioPorId.get(s.ranchoId)?.nombre : null) ??
        s.negocioNombre ??
        "(negocio nuevo)",
      detalle: `Pidió ${nombrePlan(s.plan)} y subió el comprobante hace ${dias} día${dias === 1 ? "" : "s"}. Sigue esperando.`,
    });
  }

  // 6. Suscripción caída con el paquete todavía encendido. Si el
  //    negocio tiene ADEMÁS una viva, se saltea: es un cambio de
  //    paquete, no un impago.
  const yaAvisado = new Set<string>();
  for (const s of e.suscripciones) {
    if (!ESTADOS_MUERTOS.includes(s.estado)) continue;
    const r = ranchoDeSuscripcion(s);
    if (!r || vivasPorRancho.has(r) || yaAvisado.has(r)) continue;
    const n = negocioPorId.get(r);
    if (!n) continue;
    const planEfectivo = planCuentaDe.get(r) ?? n.planRancho;
    if (!planEsDePago(planEfectivo)) continue;
    yaAvisado.add(r);
    hallazgos.push({
      id: `suscripcion_muerta_plan_vivo:${r}`,
      clave: "suscripcion_muerta_plan_vivo",
      gravedad: "media",
      negocioId: r,
      negocio: n.nombre,
      detalle: `La suscripción está ${s.estado} y el negocio sigue con ${nombrePlan(planEfectivo)} encendido.`,
    });
  }

  // 7. Cobros que ya no se pueden atribuir.
  const huerfanos = e.cobros.filter((c) => !c.anulado_en && !c.rancho_id);
  if (huerfanos.length > 0) {
    hallazgos.push({
      id: "cobro_sin_negocio:total",
      clave: "cobro_sin_negocio",
      gravedad: "baja",
      negocioId: null,
      negocio: "(negocios dados de baja)",
      detalle: `${huerfanos.length} cobro${huerfanos.length === 1 ? "" : "s"} en el libro sin negocio vivo detrás. Siguen sumando al total del período.`,
    });
  }

  return hallazgos.sort(
    (a, b) =>
      ORDEN_GRAVEDAD[a.gravedad] - ORDEN_GRAVEDAD[b.gravedad] ||
      a.clave.localeCompare(b.clave) ||
      a.negocio.localeCompare(b.negocio),
  );
}

/* ────────────────────────────────────────────────────────────────
   5. EL AGUJERO, DICHO EN VOZ ALTA
   ──────────────────────────────────────────────────────────────── */

export type CobroSinMonto = {
  solicitudId: string;
  ranchoId: string | null;
  negocio: string;
  plan: string;
  metodo: string;
  comprobanteUrl: string | null;
  /** Cuándo se aprobó (o se pidió, si no hay fecha de atención). */
  fecha: string;
};

/**
 * Cobros que SABEMOS que ocurrieron y de los que no se guardó el monto.
 *
 * Son las solicitudes aprobadas con depósito: el negocio pagó, un
 * admin lo aprobó, y del importe solo queda la imagen del comprobante.
 * No se estima desde el precio de lista — el depósito pudo ser anual,
 * o en colones a otro tipo de cambio. Se listan para que alguien los
 * anote leyendo la captura, y mientras tanto la pantalla dice cuántos
 * le faltan a cada total.
 */
export function cobrosConocidosSinMonto(e: EntradaAuditoria): CobroSinMonto[] {
  const registradas = new Set(
    e.cobros.filter((c) => !c.anulado_en && c.solicitud_id).map((c) => c.solicitud_id),
  );
  const negocioPorId = new Map(e.negocios.map((n) => [n.id, n.nombre]));

  return e.solicitudes
    .filter(
      (s) =>
        s.estado === "atendida" &&
        (s.metodoPago === "sinpe" || s.metodoPago === "transferencia") &&
        !registradas.has(s.id) &&
        // Un paquete gratis aprobado no dejó plata: no es un agujero.
        planEsDePago(s.plan),
    )
    .map((s) => ({
      solicitudId: s.id,
      ranchoId: s.ranchoId,
      negocio:
        (s.ranchoId ? negocioPorId.get(s.ranchoId) : null) ??
        s.negocioNombre ??
        "(negocio)",
      plan: s.plan,
      metodo: s.metodoPago ?? "sinpe",
      comprobanteUrl: s.comprobanteUrl ?? null,
      fecha: s.atendidaEn ?? s.createdAt,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Suscripciones de Stripe vivas de las que no hay NI UN cobro anotado.
 *
 * Distinto del anterior: acá el importe existe en Stripe, no en esta
 * base. El webhook no atiende `invoice.paid` (decisión de la 0143 para
 * no duplicar correos), así que ninguna renovación deja monto en
 * ninguna tabla. Es el segundo agujero, y hay que decirlo igual.
 */
export function suscripcionesSinCobro(e: EntradaAuditoria): SuscripcionAuditoria[] {
  const ranchoDeCuenta = new Map(e.cuentas.map((c) => [c.id, c.ranchoId]));
  const conCobroStripe = new Set(
    e.cobros
      .filter((c) => !c.anulado_en && c.metodo === "stripe" && c.rancho_id)
      .map((c) => c.rancho_id),
  );
  return e.suscripciones.filter((s) => {
    if (!ESTADOS_VIVOS.includes(s.estado)) return false;
    const r = s.ranchoId ?? (s.cuentaId ? (ranchoDeCuenta.get(s.cuentaId) ?? null) : null);
    return !r || !conCobroStripe.has(r);
  });
}

/**
 * Lo que esta pantalla NO puede responder, para que quede escrito en
 * ella misma. Un auditor necesita saber qué no es auditable tanto como
 * lo que sí.
 */
export const LO_QUE_LA_BASE_NO_GUARDA = [
  "El monto de los depósitos por SINPE anteriores a esta pantalla: solo está en la imagen del comprobante.",
  "El importe de cada renovación de Stripe: el webhook no atiende `invoice.paid`, así que ni `suscripciones` ni `eventos_stripe` lo registran.",
  "El tipo de cambio con que se cobró cada SINPE, salvo el que se anote a mano al registrar el cobro.",
  "Si un depósito viejo fue mensual o anual: `solicitudes_lealtad` no tiene columna de período.",
  "El historial de paquetes: `ranchos.plan_lealtad` es una sola columna sin versionado, así que no se sabe qué paquete tenía un negocio el mes pasado.",
] as const;

/* ────────────────────────────────────────────────────────────────
   6. LA TABLA PUEDE NO EXISTIR TODAVÍA
   ──────────────────────────────────────────────────────────────── */

/** El archivo que hay que pegar en el SQL Editor si falta la tabla. */
export const MIGRACION_COBROS = "supabase/migrations/0172_cobros_de_modulos.sql";

/**
 * ¿El error es "esa tabla no existe"? Mientras la 0172 no se haya
 * pegado, el código ya consulta `cobros_modulo` pero la tabla no está.
 * Los dos caminos, igual que `esTablaCobrosInexistente` en
 * lib/libro-cobros.ts: el 42P01 de Postgres y el PGRST205 de PostgREST.
 */
export function faltaTablaCobros(error: { code?: string; message?: string }): boolean {
  const mensaje = (error.message ?? "").toLowerCase();
  if (
    mensaje.includes("cobros_modulo") &&
    (mensaje.includes("does not exist") || mensaje.includes("could not find"))
  ) {
    return true;
  }
  return error.code === "42P01" || error.code === "PGRST205";
}
