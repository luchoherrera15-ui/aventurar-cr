import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { miembroPorCorreo, vinculoConFoorkie } from "@/lib/plataforma/foorkie";
import { lecturaDeTarjeta, leerPedidoFirmado, responder, saldoDelMiembro, UUID } from "@/lib/plataforma/foorkie-api";
import { normalizarCorreo } from "@/lib/lealtad/personas";
import { canalDelMovimiento } from "@/lib/lealtad/canal-del-sello";
import { identidadesDeMiembros, miembrosConIdentidad, type MiembroIdentificable } from "@/lib/lealtad/identidades-db";
import type { PermisosLealtad } from "@/lib/lealtad/permisos";
import type { TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import type { CamposTarjeta } from "@/lib/wallet/tarjeta";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA CAJA DE FOORKIE — acreditar, canjear y el historial, desde allá
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 oct 2026): en el panel de Foorkie, un «modo caja»
 * del restaurante. El empleado toca ACREDITAR o CANJEAR, escanea el QR
 * del pase del cliente (o escribe su correo) y opera; y un historial de
 * lo acreditado y canjeado.
 *
 * ── ACÁ NO SE DECIDE CUÁNTO ENTRA ───────────────────────────────────
 * Las rutas `/api/plataforma/foorkie/caja/*` llaman al MISMO núcleo que
 * la caja del teléfono de Bookea (`operar-core.ts`: regla de
 * acumulación, topes, reglas de canje, aviso al Wallet, correo). Este
 * archivo solo lee lo que manda Foorkie, encuentra al miembro y arma lo
 * que se le devuelve. Si acá apareciera `rpc("acreditar_lealtad"` o
 * `rpc("canjear_recompensa"`, habría dos copias de las reglas.
 *
 * ── QUIÉN OPERA ─────────────────────────────────────────────────────
 * El dueño del negocio (`vinculo.ownerId`), con los permisos de un
 * empleado de caja: sumar y canjear, nunca revertir ni auditar. Quién
 * de su equipo entra a la caja lo decide Foorkie; el nombre de quien
 * operó viaja como texto (`operador`) y queda en el concepto de la
 * compra («Caja Foorkie · Ana»), que es el único texto libre que el
 * motor guarda sin tocar el esquema.
 *
 * ── LAS LLAVES DE IDEMPOTENCIA LAS ARMA BOOKEA ──────────────────────
 * `mostrador:<miembro>:<intento>` y `canje:<miembro>:<recompensa>:<intento>`,
 * con el `intento_id` (uuid) que Foorkie genera UNA vez por operación y
 * repite en los reintentos: el segundo envío choca contra el índice
 * único del ledger y no suma dos veces. Nunca una referencia cruda de
 * afuera (quemaría la llave de otro integrador).
 *
 * ── LO QUE SALE DE ACÁ SOBRE UNA PERSONA ────────────────────────────
 * El nombre de pila (o «Cliente») y el correo enmascarado («l***@…»).
 * Nunca el correo completo ni el teléfono: la caja necesita reconocer a
 * quién atiende, no su libreta de contactos.
 */

type Db = SupabaseClient;

/** Lo que puede hacer la caja de Foorkie: lo de un empleado de caja. */
export const PERMISOS_CAJA: PermisosLealtad = { acreditar: true, canjear: true, revertir: false, auditoria: false };

/** El concepto que queda en la compra (el «producto» del motor). */
export const PRODUCTO_CAJA = "Caja Foorkie";

/** Tope del texto crudo que lee la cámara (contrato con Foorkie). */
export const MAX_CODIGO = 500;

export const HISTORIAL_POR_DEFECTO = 30;
export const HISTORIAL_MAXIMO = 100;

const MAX_OPERADOR = 80;
const MAX_DETALLE = 140;

// ════════════════════════════════════════════════════════════════════
//  1. Lo que manda Foorkie
// ════════════════════════════════════════════════════════════════════

export type Lectura<T> = { ok: true; valor: T } | { ok: false; motivo: string };

type Vinculo = { ranchoId: string; programaId: string };

export type PedidoBuscar = Vinculo & ({ codigo: string; correo: null } | { codigo: null; correo: string });

export type PedidoAcreditar = Vinculo & {
  miembroId: string;
  /** Colones enteros; null = visita sin monto. El núcleo valida que sea entero y razonable. */
  monto: number | null;
  intentoId: string;
  operador: string | null;
};

export type PedidoCanjear = Vinculo & { miembroId: string; recompensaId: string; intentoId: string };

export type PedidoHistorial = Vinculo & { limite: number; antes: string | null };

/** Un uuid en minúscula, o null. En minúscula porque viaja adentro de la llave de idempotencia. */
function uuidDe(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return UUID.test(t) ? t : null;
}

/** Vacío o ausente = no vino. */
function ausente(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

function leerVinculo(d: Record<string, unknown>): Lectura<Vinculo> {
  const ranchoId = uuidDe(d.rancho_id);
  const programaId = uuidDe(d.programa_id);
  if (!ranchoId || !programaId) return { ok: false, motivo: "Faltan el negocio o la tarjeta (rancho_id y programa_id)." };
  return { ok: true, valor: { ranchoId, programaId } };
}

export function leerPedidoBuscar(d: Record<string, unknown>): Lectura<PedidoBuscar> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  if (!ausente(d.codigo) && typeof d.codigo !== "string") return { ok: false, motivo: "El código escaneado tiene que ser texto." };
  if (!ausente(d.correo) && typeof d.correo !== "string") return { ok: false, motivo: "El correo tiene que ser texto." };
  const hayCodigo = !ausente(d.codigo);
  const hayCorreo = !ausente(d.correo);
  if (hayCodigo === hayCorreo) return { ok: false, motivo: "Mandá el código escaneado o el correo: uno de los dos." };

  if (hayCodigo) {
    const codigo = d.codigo as string;
    if (codigo.length > MAX_CODIGO) return { ok: false, motivo: "Ese código es demasiado largo para ser una tarjeta." };
    return { ok: true, valor: { ...v.valor, codigo, correo: null } };
  }
  const crudo = (d.correo as string).trim();
  const correo = crudo.length <= 254 ? normalizarCorreo(crudo) : null;
  if (!correo) return { ok: false, motivo: "Ese correo no está bien escrito." };
  return { ok: true, valor: { ...v.valor, codigo: null, correo } };
}

const FALTA_INTENTO = "Falta el identificador del intento (intento_id, un uuid por operación).";

export function leerPedidoAcreditar(d: Record<string, unknown>): Lectura<PedidoAcreditar> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  const miembroId = uuidDe(d.miembro_id);
  if (!miembroId) return { ok: false, motivo: "Falta el cliente (miembro_id)." };
  const intentoId = uuidDe(d.intento_id);
  if (!intentoId) return { ok: false, motivo: FALTA_INTENTO };
  // Entero, decimales o fuera de rango los rechaza el núcleo con su frase
  // de siempre (`monto_invalido`); acá solo se exige que sea un número.
  if (d.monto !== undefined && d.monto !== null && typeof d.monto !== "number") {
    return { ok: false, motivo: "El monto tiene que ser un número de colones, o null para una visita sin monto." };
  }
  const monto = typeof d.monto === "number" ? d.monto : null;
  return { ok: true, valor: { ...v.valor, miembroId, monto, intentoId, operador: leerOperador(d.operador) } };
}

export function leerPedidoCanjear(d: Record<string, unknown>): Lectura<PedidoCanjear> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  const miembroId = uuidDe(d.miembro_id);
  const recompensaId = uuidDe(d.recompensa_id);
  if (!miembroId || !recompensaId) return { ok: false, motivo: "Faltan el cliente o el premio (miembro_id y recompensa_id)." };
  const intentoId = uuidDe(d.intento_id);
  if (!intentoId) return { ok: false, motivo: FALTA_INTENTO };
  return { ok: true, valor: { ...v.valor, miembroId, recompensaId, intentoId } };
}

/**
 * ISO 8601 con hora y zona, como lo devuelve la base («…T15:04:05.123456+00:00»)
 * o un `toISOString()`. Va tal cual a la consulta: con los microsegundos
 * de la base, la página siguiente empieza exactamente donde terminó esta.
 */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)$/;

export function leerPedidoHistorial(d: Record<string, unknown>): Lectura<PedidoHistorial> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  let limite = HISTORIAL_POR_DEFECTO;
  if (!ausente(d.limite)) {
    if (typeof d.limite !== "number" || !Number.isFinite(d.limite)) return { ok: false, motivo: "El límite tiene que ser un número de 1 a 100." };
    limite = Math.min(HISTORIAL_MAXIMO, Math.max(1, Math.trunc(d.limite)));
  }
  let antes: string | null = null;
  if (!ausente(d.antes)) {
    const t = typeof d.antes === "string" ? d.antes.trim() : "";
    if (!ISO.test(t) || !Number.isFinite(Date.parse(t))) return { ok: false, motivo: "«antes» tiene que ser una fecha ISO (la de «siguiente»)." };
    antes = t;
  }
  return { ok: true, valor: { ...v.valor, limite, antes } };
}

/** Quién operó en Foorkie: texto de una línea, hasta 80 caracteres, o null. */
export function leerOperador(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const limpio = v.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  return limpio.length > MAX_OPERADOR ? limpio.slice(0, MAX_OPERADOR).trimEnd() : limpio;
}

/** El concepto de la compra: «Caja Foorkie · Ana» (o «Caja Foorkie» si no vino quién). */
export function productoDeLaCaja(operador: string | null): string {
  return operador ? `${PRODUCTO_CAJA} · ${operador}` : PRODUCTO_CAJA;
}

/**
 * El `codigo` de un rechazo del núcleo, para que Foorkie pueda decidir
 * por él. El núcleo pone en `codigo` sus identificadores (`monto_invalido`,
 * `saldo_insuficiente`, `ya-canjeado`…) pero, cuando el que dice que no es
 * el RPC, pone la frase entera («Este cliente ya llegó a su tope de
 * hoy.»). Esa frase ya viaja en `motivo`; como código queda `rechazado`.
 * Mismo criterio que `traducirMotivo`: identificador = minúsculas, números,
 * guiones.
 */
export function codigoDeRechazo(codigo: string | undefined): string {
  const c = (codigo ?? "").trim();
  return /^[a-z0-9]+([-_][a-z0-9]+)*$/.test(c) ? c : "rechazado";
}

// ════════════════════════════════════════════════════════════════════
//  2. El código que leyó la cámara
// ════════════════════════════════════════════════════════════════════

/**
 * El QR del pase (Apple y Google) lleva el `serial_number` pelado, que
 * es un uuid. Lo que llega de una cámara o de un lector suele venir
 * igual, pero no siempre: con espacios o un salto de línea al final, en
 * mayúsculas, con el prefijo de simbología de un lector («]Q1»), con
 * otro separador (un lector configurado con otra distribución de
 * teclado escribe ' en vez de -), sin guiones, o adentro de un link.
 * Se buscan los uuid que haya adentro, sin importar lo que los rodee.
 */
const UUID_EN_TEXTO = /([0-9a-f]{8})[^0-9a-z]?([0-9a-f]{4})[^0-9a-z]?([0-9a-f]{4})[^0-9a-z]?([0-9a-f]{4})[^0-9a-z]?([0-9a-f]{12})/gi;

/** Un serial que no es uuid (pases viejos o de prueba): una sola palabra, sin nada que haya que escapar. */
const SERIAL_SUELTO = /^[A-Za-z0-9._:-]{1,100}$/;

/**
 * Del texto crudo a los seriales que vale la pena buscar (0 a 4). Vacío
 * = eso no puede ser una tarjeta. Buscar uno que no existe no hace daño:
 * la consulta es por igualdad y el serial es único.
 */
export function leerCodigoEscaneado(crudo: string): string[] {
  const limpio = (crudo ?? "").replace(/\p{Cc}/gu, "").trim();
  if (!limpio || limpio.length > MAX_CODIGO) return [];
  const candidatos = new Set<string>();
  for (const m of limpio.matchAll(UUID_EN_TEXTO)) {
    candidatos.add(`${m[1]}-${m[2]}-${m[3]}-${m[4]}-${m[5]}`.toLowerCase());
    if (candidatos.size >= 3) break;
  }
  if (SERIAL_SUELTO.test(limpio) && !UUID.test(limpio)) candidatos.add(limpio);
  return [...candidatos];
}

// ════════════════════════════════════════════════════════════════════
//  3. Lo que se devuelve de una persona
// ════════════════════════════════════════════════════════════════════

/** «luis@gmail.com» → «l***@gmail.com». null si no es un correo. */
export function enmascararCorreo(correo: string | null | undefined): string | null {
  const c = normalizarCorreo(correo ?? null);
  if (!c) return null;
  const arroba = c.lastIndexOf("@");
  const usuario = c.slice(0, arroba);
  const dominio = c.slice(arroba + 1);
  if (!usuario || !dominio) return null;
  return `${Array.from(usuario)[0]}***@${dominio}`;
}

/**
 * El nombre de pila, o «Cliente». Si en el campo del nombre quedó un
 * correo o un teléfono (importaciones viejas), tampoco sale: «nombre» no
 * puede ser la puerta por la que se escapa un contacto.
 */
export function nombreDePila(nombre: string | null | undefined): string {
  const primero = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  if (!primero || primero.includes("@") || /\d{3,}/.test(primero)) return "Cliente";
  return primero.length > 40 ? primero.slice(0, 40) : primero;
}

/** Correos completos que alguien haya escrito en un texto libre salen enmascarados. */
function sinCorreos(texto: string): string {
  return texto.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/g, (c) => enmascararCorreo(c) ?? "***");
}

// ════════════════════════════════════════════════════════════════════
//  4. Buscar: la tarjeta del cliente, como la ve la caja
// ════════════════════════════════════════════════════════════════════

export type RecompensaDeLaCaja = { id: string; nombre: string; costo: number; alcanza: boolean };

export type ClienteDeLaCaja = {
  miembro_id: string;
  nombre: string;
  correo: string | null;
  tipo: TipoTarjeta;
  saldo: number;
  /** true = hoy no suma ni canjea: la tarjeta del local está en pausa o el negocio suspendió a este cliente. */
  pausada: boolean;
  textos: CamposTarjeta;
  progreso: { actual: number; total: number } | null;
  recompensas: RecompensaDeLaCaja[];
};

/** Los premios activos, del más barato al más caro, con «¿le alcanza?». */
export function recompensasParaCaja(
  filas: { id?: unknown; nombre?: unknown; costo_puntos?: unknown }[],
  saldo: number,
): RecompensaDeLaCaja[] {
  return filas
    .map((r) => ({
      id: typeof r.id === "string" ? r.id : "",
      nombre: typeof r.nombre === "string" ? r.nombre.trim() : "",
      costo: Number(r.costo_puntos),
    }))
    .filter((r) => r.id && Number.isFinite(r.costo) && r.costo > 0)
    .sort((a, b) => a.costo - b.costo || a.nombre.localeCompare(b.nombre, "es"))
    .map((r) => ({ ...r, alcanza: saldo >= r.costo }));
}

export function armarClienteDeLaCaja(d: {
  miembroId: string;
  estadoMiembro: string;
  quien: QuienEs;
  fila: Record<string, unknown>;
  negocio: string;
  saldo: number;
  recompensas: { id?: unknown; nombre?: unknown; costo_puntos?: unknown }[];
  ahora?: Date;
}): ClienteDeLaCaja {
  const recompensas = recompensasParaCaja(d.recompensas, d.saldo);
  // La meta es la recompensa activa más barata: la misma que dibuja el pase (`metaDelPrograma`).
  const meta = recompensas[0] ? { nombre: recompensas[0].nombre, costo_puntos: recompensas[0].costo } : null;
  const tarjeta = lecturaDeTarjeta({ fila: d.fila, negocio: d.negocio, saldo: d.saldo, meta, ahora: d.ahora });
  return {
    miembro_id: d.miembroId,
    nombre: d.quien.nombre,
    correo: d.quien.correo,
    tipo: tarjeta.modo,
    saldo: d.saldo,
    pausada: tarjeta.pausada || d.estadoMiembro === "pausada",
    textos: tarjeta.textos,
    progreso: tarjeta.progreso,
    recompensas,
  };
}

// ════════════════════════════════════════════════════════════════════
//  5. El historial
// ════════════════════════════════════════════════════════════════════

export type TipoMovimientoCaja = "acredito" | "canjeo" | "ajuste" | "reverso";
export type CanalCaja = "pedido" | "caja" | "escaneo" | "panel" | "otro";

export type MovimientoDeLaCaja = {
  id: string;
  fecha: string;
  tipo: TipoMovimientoCaja;
  /** Con signo: +N al acreditar, −N al canjear. */
  puntos: number;
  cliente: string;
  correo: string | null;
  canal: CanalCaja;
  detalle: string | null;
};

/** Una fila del ledger (`transacciones_puntos`), ya leída. */
export type FilaLedger = {
  id: string;
  miembro_id: string;
  tipo: string;
  puntos: number;
  motivo: string | null;
  referencia: string | null;
  reversion_de: string | null;
  usuario_id: string | null;
  llave_id: string | null;
  created_at: string;
};

export function tipoDelMovimiento(fila: { tipo: string; reversion_de: string | null }): TipoMovimientoCaja {
  if (fila.tipo === "ganado") return "acredito";
  if (fila.tipo === "canjeado") return "canjeo";
  return fila.reversion_de ? "reverso" : "ajuste";
}

/** El canje de una caja con `intento_id` (la de Foorkie o la del teléfono): `canje:<miembro>:<premio>:<uuid>`. */
const CANJE_DE_CAJA = /^canje:[^:]+:[^:]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Por dónde entró, en las palabras de Foorkie. Sale de la MISMA tabla de
 * prefijos que la Actividad del panel de Bookea (`canal-del-sello.ts`),
 * así los dos historiales nunca se contradicen:
 *
 *   foorkie:   → pedido   (un pedido en línea entregado en Foorkie)
 *   mostrador: → caja     (la caja de Foorkie, o atender a mano en Bookea)
 *   escaneo:   → escaneo  (el escáner de Bookea)
 *   panel:     → panel    (y también lo que el panel hace sin prefijo: una
 *                          reversión, una factura del POS)
 *   canje:     → caja si lleva el intento de una caja; si no, panel
 *   el resto   → otro     (API, citas, vencimiento de sellos…)
 */
export function canalParaFoorkie(fila: { referencia: string | null; llave_id: string | null; usuario_id: string | null }): CanalCaja {
  const canal = canalDelMovimiento({ referencia: fila.referencia, llaveId: fila.llave_id, usuarioId: fila.usuario_id });
  switch (canal) {
    case "foorkie":
      return "pedido";
    case "mostrador":
      return "caja";
    case "escaner":
      return "escaneo";
    case "panel":
      return CANJE_DE_CAJA.test((fila.referencia ?? "").trim()) ? "caja" : "panel";
    default:
      return "otro";
  }
}

/**
 * El renglón chico: en una compra, lo que se anotó como concepto
 * («Pedido en línea #A1B2C3», «Caja Foorkie · Ana»), o el motivo del
 * ledger si no hay; en un canje, el premio; en un ajuste, su motivo.
 */
export function detalleDelMovimiento(d: { tipo: TipoMovimientoCaja; motivo: string | null; producto: string | null }): string | null {
  const limpio = (t: string | null) => {
    const v = (t ?? "").replace(/\s+/g, " ").trim();
    return v || null;
  };
  let texto: string | null;
  if (d.tipo === "acredito") texto = limpio(d.producto) ?? limpio(d.motivo);
  else if (d.tipo === "canjeo") texto = limpio((d.motivo ?? "").replace(/^\s*canje:\s*/i, ""));
  else texto = limpio(d.motivo);
  if (!texto) return null;
  texto = sinCorreos(texto);
  return texto.length > MAX_DETALLE ? `${texto.slice(0, MAX_DETALLE - 1).trimEnd()}…` : texto;
}

/**
 * La página y el cursor. Llegan `limite + 1` filas (de la más nueva a la
 * más vieja) y `siguiente` es la fecha de la última que se muestra: la
 * próxima página pide «antes» de esa fecha.
 *
 * Si el corte cae en medio de varias filas con la MISMA fecha exacta (un
 * mismo instante de la base), esas filas pasan enteras a la página
 * siguiente: con «antes» estricto, partirlas dejaría algunas sin mostrar
 * nunca.
 */
export function cortarPagina<T extends { created_at: string }>(filas: T[], limite: number): { pagina: T[]; siguiente: string | null } {
  if (filas.length <= limite) return { pagina: filas, siguiente: null };
  const pagina = filas.slice(0, limite);
  const corte = pagina[pagina.length - 1].created_at;
  if (filas[limite].created_at !== corte) return { pagina, siguiente: corte };
  const sinElInstante = pagina.filter((f) => f.created_at !== corte);
  // Toda la página es un solo instante: no pasa en la práctica (cada movimiento es su propia transacción).
  if (sinElInstante.length === 0) return { pagina, siguiente: corte };
  return { pagina: sinElInstante, siguiente: sinElInstante[sinElInstante.length - 1].created_at };
}

export function armarMovimiento(
  f: FilaLedger,
  quien: QuienEs | undefined,
  producto: string | null,
): MovimientoDeLaCaja {
  const tipo = tipoDelMovimiento(f);
  const fecha = new Date(f.created_at);
  return {
    id: f.id,
    fecha: Number.isNaN(fecha.getTime()) ? f.created_at : fecha.toISOString(),
    tipo,
    puntos: f.puntos,
    cliente: quien?.nombre ?? "Cliente",
    correo: quien?.correo ?? null,
    canal: canalParaFoorkie(f),
    detalle: detalleDelMovimiento({ tipo, motivo: f.motivo, producto }),
  };
}

function filaDelLedger(v: unknown): FilaLedger | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const texto = (x: unknown) => (typeof x === "string" ? x : null);
  if (typeof r.id !== "string" || typeof r.miembro_id !== "string" || typeof r.created_at !== "string") return null;
  return {
    id: r.id,
    miembro_id: r.miembro_id,
    tipo: texto(r.tipo) ?? "",
    puntos: Number(r.puntos) || 0,
    motivo: texto(r.motivo),
    referencia: texto(r.referencia),
    reversion_de: texto(r.reversion_de),
    usuario_id: texto(r.usuario_id),
    llave_id: texto(r.llave_id),
    created_at: r.created_at,
  };
}

// ════════════════════════════════════════════════════════════════════
//  6. La base
// ════════════════════════════════════════════════════════════════════

/**
 * La puerta común de las cuatro rutas: firma, forma del pedido, conexión
 * y vínculo (el negocio y la tarjeta tienen que estar vinculados a un
 * local de Foorkie). Devuelve la base y el dueño, que es quien opera.
 */
export async function abrirLaCaja<T extends Vinculo>(
  request: Request,
  leer: (datos: Record<string, unknown>) => Lectura<T>,
): Promise<{ ok: true; pedido: T; db: Db; duenoId: string } | { ok: false; respuesta: NextResponse }> {
  // 4000 y no 2000: un código crudo de 500 caracteres crece al escaparse en el JSON.
  const firmado = await leerPedidoFirmado(request, 4000);
  if (!firmado.ok) return firmado;
  const leido = leer(firmado.datos);
  if (!leido.ok) return { ok: false, respuesta: responder({ ok: false, codigo: "datos", motivo: leido.motivo }, 400) };
  const db = createAdminClient();
  if (!db) {
    return { ok: false, respuesta: responder({ ok: false, codigo: "no_configurado", motivo: "Bookea no tiene conexión con la base en este momento." }, 503) };
  }
  const vinculo = await vinculoConFoorkie(db, leido.valor.ranchoId, leido.valor.programaId);
  if (!vinculo) {
    return {
      ok: false,
      respuesta: responder({ ok: false, codigo: "no_vinculado", motivo: "Esa tarjeta no está vinculada a un local de Foorkie." }, 403),
    };
  }
  return { ok: true, pedido: leido.valor, db, duenoId: vinculo.ownerId };
}

export type MiembroDeLaCaja = {
  id: string;
  programa_id: string;
  persona_id: string | null;
  cliente_id: string | null;
  estado: string;
};

const COLUMNAS_MIEMBRO = "id, programa_id, persona_id, cliente_id, estado";

function filaDeMiembro(v: unknown): MiembroDeLaCaja | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  if (typeof m.id !== "string" || typeof m.programa_id !== "string") return null;
  return {
    id: m.id,
    programa_id: m.programa_id,
    persona_id: typeof m.persona_id === "string" ? m.persona_id : null,
    cliente_id: typeof m.cliente_id === "string" ? m.cliente_id : null,
    estado: typeof m.estado === "string" ? m.estado : "activa",
  };
}

/**
 * El miembro, solo si es de ESTA tarjeta. El núcleo comprueba que sea del
 * negocio; esto lo ata además a la tarjeta vinculada a Foorkie: un
 * negocio con dos tarjetas no puede sumar en la otra desde esta caja.
 */
export async function miembroDeLaTarjeta(db: Db, programaId: string, miembroId: string): Promise<MiembroDeLaCaja | null> {
  const { data } = await db
    .from("miembros")
    .select(COLUMNAS_MIEMBRO)
    .eq("id", miembroId)
    .eq("programa_id", programaId)
    .maybeSingle();
  return filaDeMiembro(data);
}

export type BusquedaDeMiembro =
  | { ok: true; miembro: MiembroDeLaCaja }
  | { ok: false; codigo: "no_encontrado" | "tarjeta_ajena" | "no_miembro" | "error_base"; motivo: string };

const NO_ES_TARJETA: BusquedaDeMiembro = {
  ok: false,
  codigo: "no_encontrado",
  motivo: "Ese código no es una tarjeta de lealtad. Pedile al cliente que abra su tarjeta en el Wallet.",
};
const ERROR_AL_BUSCAR: BusquedaDeMiembro = { ok: false, codigo: "error_base", motivo: "No pudimos buscar la tarjeta. Probá de nuevo." };
const DADA_DE_BAJA = "Esa tarjeta está dada de baja en este negocio: no suma ni canjea.";

/** Del código escaneado al miembro: pase → miembro → tarjeta (la de Foorkie, no otra). */
export async function miembroPorCodigo(db: Db, ranchoId: string, programaId: string, crudo: string): Promise<BusquedaDeMiembro> {
  const seriales = leerCodigoEscaneado(crudo);
  if (seriales.length === 0) return NO_ES_TARJETA;

  const { data: pases, error } = await db.from("pases_wallet").select("miembro_id").in("serial_number", seriales).limit(5);
  if (error) return ERROR_AL_BUSCAR;
  const ids = [...new Set(((pases ?? []) as { miembro_id: unknown }[]).map((p) => p.miembro_id).filter((x): x is string => typeof x === "string"))];
  // Dos pases distintos para un mismo texto no deberían existir; si pasa, no se adivina.
  if (ids.length !== 1) return NO_ES_TARJETA;

  const { data, error: errorMiembro } = await db.from("miembros").select(COLUMNAS_MIEMBRO).eq("id", ids[0]).maybeSingle();
  if (errorMiembro) return ERROR_AL_BUSCAR;
  const miembro = filaDeMiembro(data);
  if (!miembro) return NO_ES_TARJETA;

  if (miembro.programa_id !== programaId) {
    const { data: suya } = await db.from("programa_lealtad").select("rancho_id").eq("id", miembro.programa_id).maybeSingle();
    return {
      ok: false,
      codigo: "tarjeta_ajena",
      motivo:
        suya?.rancho_id === ranchoId
          ? "Esa es otra tarjeta de lealtad de este negocio, no la que se usa en Foorkie."
          : "Esa tarjeta es de otro negocio.",
    };
  }
  if (miembro.estado === "cancelada") return { ok: false, codigo: "no_encontrado", motivo: DADA_DE_BAJA };
  return { ok: true, miembro };
}

/**
 * Del correo al miembro de esta tarjeta, con la misma búsqueda que los
 * pedidos de Foorkie (`miembroPorCorreo`: la persona global o la
 * identidad local de este negocio). Nunca crea a nadie.
 */
export async function miembroDelCorreo(db: Db, ranchoId: string, programaId: string, correo: string): Promise<BusquedaDeMiembro> {
  const sinTarjeta: BusquedaDeMiembro = { ok: false, codigo: "no_miembro", motivo: "Ese correo no tiene esta tarjeta de lealtad." };
  const miembroId = await miembroPorCorreo(db, ranchoId, programaId, correo);
  if (!miembroId) return sinTarjeta;
  const miembro = await miembroDeLaTarjeta(db, programaId, miembroId);
  if (!miembro) return sinTarjeta;
  if (miembro.estado === "cancelada") return { ok: false, codigo: "no_miembro", motivo: DADA_DE_BAJA };
  return { ok: true, miembro };
}

export type QuienEs = { nombre: string; correo: string | null };

/** Nombre de pila y correo enmascarado, con la MISMA resolución de identidad que el panel de Bookea. */
export async function quienesSon(db: Db, ranchoId: string, miembros: MiembroIdentificable[]): Promise<Map<string, QuienEs>> {
  if (miembros.length === 0) return new Map();
  const identidades = await identidadesDeMiembros(db, miembros, ranchoId);
  return new Map(
    miembros.map((m) => {
      const i = identidades.get(m.id);
      return [m.id, { nombre: nombreDePila(i?.nombre), correo: enmascararCorreo(i?.correo) }];
    }),
  );
}

/** Todo lo que la caja muestra del cliente. null = no se pudo leer (la tarjeta o el saldo). */
export async function clienteDeLaCaja(
  db: Db,
  ranchoId: string,
  programaId: string,
  miembro: MiembroDeLaCaja,
): Promise<ClienteDeLaCaja | null> {
  const [{ data: fila }, { data: rancho }, { data: premios }, saldo, quien] = await Promise.all([
    // `select *`: hay columnas de diseño que una base sin migrar no tiene.
    db.from("programa_lealtad").select("*").eq("id", programaId).eq("rancho_id", ranchoId).maybeSingle(),
    db.from("ranchos").select("nombre").eq("id", ranchoId).maybeSingle(),
    db
      .from("recompensas")
      .select("id, nombre, costo_puntos")
      .eq("programa_id", programaId)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(50),
    saldoDelMiembro(db, miembro.id),
    quienesSon(db, ranchoId, [miembro]),
  ]);
  if (!fila || saldo === null) return null;
  return armarClienteDeLaCaja({
    miembroId: miembro.id,
    estadoMiembro: miembro.estado,
    quien: quien.get(miembro.id) ?? { nombre: "Cliente", correo: null },
    fila: fila as Record<string, unknown>,
    negocio: String(rancho?.nombre ?? ""),
    saldo,
    recompensas: (premios ?? []) as { id?: unknown; nombre?: unknown; costo_puntos?: unknown }[],
  });
}

/** Las referencias que se pueden mandar en un `in.(…)` sin escapar nada (todas las que arma Bookea). */
const REFERENCIA_SEGURA = /^[A-Za-z0-9:_.-]{1,200}$/;

/**
 * Los movimientos del ledger de ESTA tarjeta, del más nuevo al más viejo.
 * null = la base no contestó.
 */
export async function historialDeLaCaja(
  db: Db,
  p: PedidoHistorial,
): Promise<{ movimientos: MovimientoDeLaCaja[]; siguiente: string | null } | null> {
  const consulta = (columnas: string) => {
    let q = db.from("transacciones_puntos").select(columnas).eq("miembros.programa_id", p.programaId);
    if (p.antes) q = q.lt("created_at", p.antes);
    return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(p.limite + 1);
  };
  const columnas =
    "id, miembro_id, tipo, puntos, motivo, referencia, reversion_de, usuario_id, created_at, miembros!inner(programa_id)";
  // `llave_id` es de la 0178 (la API pública): si no está pegada, se vuelve a pedir sin ella.
  const conLlave = await consulta(`${columnas}, llave_id`);
  const leido = conLlave.error ? await consulta(columnas) : conLlave;
  if (leido.error) return null;

  const filas = ((leido.data ?? []) as unknown[]).map(filaDelLedger).filter((f): f is FilaLedger => f !== null);
  const { pagina, siguiente } = cortarPagina(filas, p.limite);
  if (pagina.length === 0) return { movimientos: [], siguiente: null };

  // El concepto de cada compra vive en la venta (0197), atada por la misma referencia.
  const referencias = [
    ...new Set(
      pagina
        .filter((f) => f.tipo === "ganado" && f.referencia && REFERENCIA_SEGURA.test(f.referencia))
        .map((f) => f.referencia as string),
    ),
  ];
  const ids = [...new Set(pagina.map((f) => f.miembro_id))];
  // De a 30: cada referencia ronda los 85 caracteres y van en la URL.
  const tandas: string[][] = [];
  for (let i = 0; i < referencias.length; i += 30) tandas.push(referencias.slice(i, i + 30));
  const [ventas, quien] = await Promise.all([
    Promise.all(
      tandas.map((tanda) =>
        db.from("lealtad_transacciones").select("referencia, producto").eq("rancho_id", p.ranchoId).in("referencia", tanda),
      ),
    ),
    miembrosConIdentidad(db, { ids }).then((miembros) => quienesSon(db, p.ranchoId, miembros)),
  ]);
  // Sin la 0197 la tabla no existe: las compras salen con el motivo del ledger.
  const productoDe = new Map<string, string>();
  for (const tanda of ventas) {
    if (tanda.error) continue;
    for (const v of (tanda.data ?? []) as { referencia: unknown; producto: unknown }[]) {
      if (typeof v.referencia === "string" && typeof v.producto === "string") productoDe.set(v.referencia, v.producto);
    }
  }

  return {
    movimientos: pagina.map((f) =>
      armarMovimiento(f, quien.get(f.miembro_id), f.referencia ? (productoDe.get(f.referencia) ?? null) : null),
    ),
    siguiente,
  };
}
