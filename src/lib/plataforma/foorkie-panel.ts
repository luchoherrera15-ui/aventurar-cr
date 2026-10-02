import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ausente,
  cortarPagina,
  enmascararCorreo,
  ISO,
  leerVinculo,
  nombreDePila,
  uuidDe,
  type Lectura,
  type Vinculo,
} from "@/lib/plataforma/foorkie-caja";
import { normalizarCorreo } from "@/lib/lealtad/personas";
import { identidadesDeMiembros } from "@/lib/lealtad/identidades-db";
import type { IdentidadCliente } from "@/lib/lealtad/identidad-miembro";
import {
  borrarRecompensaDe,
  escribirRecompensa,
  TIPOS_RECOMPENSA,
  validarRecompensa,
  type RecompensaInput,
  type TipoRecompensa,
} from "@/lib/lealtad/recompensas";
import { pideRecompensa } from "@/lib/lealtad/editable";
import { estadoDelPrograma, type EstadoPrograma } from "@/lib/lealtad/reglas";
import { tipoDe, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { traducirError } from "@/lib/lealtad/errores-base";
import { planDelNegocio } from "@/lib/lealtad/plan-del-negocio";
import {
  inicioProximoMesEnCR,
  liberarCupoNotificacion,
  reservarCupoNotificacion,
} from "@/lib/lealtad/cupo-notificaciones";
import { enviarMensajePromocional } from "@/lib/wallet/mensaje-promocional";
import { plataformasConfiguradas } from "@/lib/wallet/aviso-de-pausa";
import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";
import { refrescarClaseGoogle } from "@/lib/wallet/google";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PANEL DE LEALTAD DE FOORKIE — clientes, regalías y avisos al Wallet
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 oct 2026): Foorkie vende la lealtad con su marca
 * («Foorkie Lealtad») y Bookea queda como motor INVISIBLE. El restaurante
 * nunca entra a Bookea: desde el panel de Foorkie ve a sus clientes,
 * arma las regalías de su tarjeta y les manda un aviso al Wallet.
 *
 * Las rutas son las de la caja (`/api/plataforma/foorkie/*`) y pasan por
 * la MISMA puerta (`abrirLaCaja`: firma, forma del pedido, conexión y
 * vínculo con un local de Foorkie). Quien opera es el dueño del negocio.
 *
 *   clientes            la lista de la tarjeta, enmascarada y paginada
 *   recompensas         las regalías, de la más barata a la más cara
 *   recompensas/guardar crear o editar una (reglas de `guardarRecompensa`)
 *   recompensas/borrar  borrar una (reglas de `eliminarRecompensa`)
 *   mensaje             el aviso a todos los pases (`enviarMensajePromocional`)
 *
 * ── ACÁ NO SE INVENTA NINGUNA REGLA ─────────────────────────────────
 * Validar y escribir una regalía es `@/lib/lealtad/recompensas`, el
 * mismo código que usa el panel de Bookea. El aviso al Wallet es el
 * núcleo del botón «Enviar a todos» de Bookea (marketing-actions.ts) y de
 * las campañas automáticas (`barrido-campanas.ts`): la misma reserva
 * atómica del cupo del paquete y el mismo envío a Apple y Google. Las dos
 * cosas que se suman están escritas abajo, con su motivo: no dejar una
 * tarjeta activa sin regalía que canjear, y que un aviso reintentado no
 * salga dos veces.
 *
 * ── LO QUE SALE DE ACÁ SOBRE UNA PERSONA ────────────────────────────
 * Lo mismo que en la caja: el nombre de pila (o «Cliente») y el correo
 * enmascarado («l***@gmail.com»), y acá también el teléfono enmascarado
 * («****-7777»). Nunca un contacto completo.
 */

type Db = SupabaseClient;

/** La puerta común de las rutas del panel: la de la caja (ver `abrirLaCaja`). */
export { abrirLaCaja as abrirElPanel } from "@/lib/plataforma/foorkie-caja";

/** Un rechazo con su código, el motivo listo para mostrar y el status HTTP. */
export type FalloDelPanel = { ok: false; codigo: string; motivo: string; status: number };

// ════════════════════════════════════════════════════════════════════
//  1. Lo que manda Foorkie
// ════════════════════════════════════════════════════════════════════

export const CLIENTES_POR_DEFECTO = 50;
export const CLIENTES_MAXIMO = 100;
export const MAX_BUSCAR = 80;

/** Por nombre (sin tildes, en cualquier parte) o por correo (desde el principio, con «@»). */
export type Busqueda = { por: "nombre"; texto: string } | { por: "correo"; texto: string };

export type PedidoClientes = Vinculo & { buscar: Busqueda | null; limite: number; antes: string | null };

/** Una línea, sin caracteres de control y sin espacios de más. */
function unaLinea(texto: string): string {
  return texto.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
}

/** Sin tildes y en minúscula: en un mostrador nadie escribe «Hernández» (mismo criterio que `buscarClientesCore`). */
export function sinTildes(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Qué se busca. Con «@» es un correo y se busca DESDE EL PRINCIPIO
 * («ana@», «ana@gmail.com»); sin «@», un nombre, en cualquier parte y
 * sin tildes.
 *
 * El correo no se busca por pedazos sueltos a propósito: la respuesta
 * lo devuelve enmascarado, y una búsqueda de «a», «an», «ana»… serviría
 * para reconstruirlo letra por letra. Desde el principio y con el «@»,
 * lo único que se puede confirmar es un correo que ya se sabe.
 */
export function leerBusqueda(crudo: string): Lectura<Busqueda> {
  const texto = unaLinea(crudo);
  if (texto.includes("@")) {
    const correo = texto.toLowerCase();
    if (/\s/.test(correo) || correo.indexOf("@") < 1) {
      return { ok: false, motivo: "Para buscar por correo escribilo desde el principio (por ejemplo «ana@»)." };
    }
    return { ok: true, valor: { por: "correo", texto: correo } };
  }
  const nombre = sinTildes(texto);
  if (nombre.length < 2) return { ok: false, motivo: "Escribí al menos dos letras del nombre." };
  return { ok: true, valor: { por: "nombre", texto: nombre } };
}

/** «antes»: ISO con hora y zona, como lo devuelve `siguiente` (mismo criterio que el historial de la caja). */
function leerAntes(v: unknown): Lectura<string | null> {
  if (ausente(v)) return { ok: true, valor: null };
  const t = typeof v === "string" ? v.trim() : "";
  if (!ISO.test(t) || !Number.isFinite(Date.parse(t))) {
    return { ok: false, motivo: "«antes» tiene que ser una fecha ISO (la de «siguiente»)." };
  }
  return { ok: true, valor: t };
}

export function leerPedidoClientes(d: Record<string, unknown>): Lectura<PedidoClientes> {
  const v = leerVinculo(d);
  if (!v.ok) return v;

  let buscar: Busqueda | null = null;
  if (!ausente(d.buscar)) {
    if (typeof d.buscar !== "string") return { ok: false, motivo: "La búsqueda tiene que ser texto." };
    if (unaLinea(d.buscar).length > MAX_BUSCAR) {
      return { ok: false, motivo: `La búsqueda puede tener hasta ${MAX_BUSCAR} caracteres.` };
    }
    const b = leerBusqueda(d.buscar);
    if (!b.ok) return b;
    buscar = b.valor;
  }

  let limite = CLIENTES_POR_DEFECTO;
  if (!ausente(d.limite)) {
    if (typeof d.limite !== "number" || !Number.isFinite(d.limite)) {
      return { ok: false, motivo: "El límite tiene que ser un número de 1 a 100." };
    }
    limite = Math.min(CLIENTES_MAXIMO, Math.max(1, Math.trunc(d.limite)));
  }

  const antes = leerAntes(d.antes);
  if (!antes.ok) return antes;
  return { ok: true, valor: { ...v.valor, buscar, limite, antes: antes.valor } };
}

export type PedidoRecompensa = Vinculo & { recompensaId: string };

/**
 * Crear (sin `recompensaId`) o editar. Lo que no vino (`undefined`) se
 * conserva al editar —como `conservando` del editor de Bookea— y queda
 * vacío al crear. `null` borra el dato.
 */
export type PedidoGuardarRecompensa = Vinculo & {
  recompensaId: string | null;
  nombre: string;
  descripcion: string | null | undefined;
  costo: number;
  activo: boolean;
  tipo: TipoRecompensa | null | undefined;
  valor: number | null | undefined;
};

export function leerPedidoGuardarRecompensa(d: Record<string, unknown>): Lectura<PedidoGuardarRecompensa> {
  const v = leerVinculo(d);
  if (!v.ok) return v;

  let recompensaId: string | null = null;
  if (!ausente(d.recompensa_id)) {
    recompensaId = uuidDe(d.recompensa_id);
    if (!recompensaId) return { ok: false, motivo: "El id de la recompensa (recompensa_id) no es válido." };
  }
  if (typeof d.nombre !== "string") return { ok: false, motivo: "Falta el nombre de la recompensa." };
  if (d.descripcion !== undefined && d.descripcion !== null && typeof d.descripcion !== "string") {
    return { ok: false, motivo: "La descripción tiene que ser texto." };
  }
  if (typeof d.costo !== "number" || !Number.isFinite(d.costo)) {
    return { ok: false, motivo: "El costo tiene que ser un número entero, de 1 en adelante." };
  }
  if (typeof d.activo !== "boolean") {
    return { ok: false, motivo: "Falta decir si la recompensa queda activa (activo: true o false)." };
  }

  let tipo: TipoRecompensa | null | undefined = undefined;
  if (d.tipo === null) tipo = null;
  else if (d.tipo !== undefined) {
    if (typeof d.tipo !== "string" || !(TIPOS_RECOMPENSA as readonly string[]).includes(d.tipo)) {
      return { ok: false, motivo: "Ese tipo de recompensa no existe." };
    }
    tipo = d.tipo as TipoRecompensa;
  }

  let valor: number | null | undefined = undefined;
  if (d.valor === null) valor = null;
  else if (d.valor !== undefined) {
    if (typeof d.valor !== "number" || !Number.isFinite(d.valor)) {
      return { ok: false, motivo: "El valor del descuento tiene que ser un número." };
    }
    valor = d.valor;
  }

  return {
    ok: true,
    valor: {
      ...v.valor,
      recompensaId,
      nombre: d.nombre,
      descripcion: d.descripcion as string | null | undefined,
      costo: d.costo,
      activo: d.activo,
      tipo,
      valor,
    },
  };
}

export function leerPedidoBorrarRecompensa(d: Record<string, unknown>): Lectura<PedidoRecompensa> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  const recompensaId = uuidDe(d.recompensa_id);
  if (!recompensaId) return { ok: false, motivo: "Falta la recompensa (recompensa_id)." };
  return { ok: true, valor: { ...v.valor, recompensaId } };
}

/**
 * El largo del aviso: el mismo que el botón «Enviar a todos» de Bookea
 * (`TOPE_MENSAJE` en marketing-actions.ts y `TOPE` en
 * marketing-mensaje.tsx): el reverso del pase de Apple tiene un ancho
 * fijo. Allá el texto se recorta en silencio; por la API se rechaza con
 * el motivo, para que el restaurante no mande un aviso cortado sin
 * saberlo.
 */
export const MENSAJE_MINIMO = 3;
export const MENSAJE_MAXIMO = 120;

export type PedidoMensaje = Vinculo & { texto: string; intentoId: string };

export function leerPedidoMensaje(d: Record<string, unknown>): Lectura<PedidoMensaje> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  const intentoId = uuidDe(d.intento_id);
  if (!intentoId) return { ok: false, motivo: "Falta el identificador del intento (intento_id, un uuid por aviso)." };
  if (typeof d.texto !== "string") return { ok: false, motivo: "Escribí el mensaje que querés mandar." };
  const texto = unaLinea(d.texto);
  if (texto.length < MENSAJE_MINIMO) return { ok: false, motivo: "Escribí el mensaje que querés mandar." };
  if (texto.length > MENSAJE_MAXIMO) {
    return { ok: false, motivo: `El mensaje puede tener hasta ${MENSAJE_MAXIMO} caracteres: en la tarjeta no entra más.` };
  }
  return { ok: true, valor: { ...v.valor, texto, intentoId } };
}

// ════════════════════════════════════════════════════════════════════
//  2. Los clientes de la tarjeta
// ════════════════════════════════════════════════════════════════════

/** «88887777» o «+506 8888-7777» → «****-7777». null si no parece un teléfono. */
export function enmascararTelefono(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 7) return null;
  return `****-${digitos.slice(-4)}`;
}

/**
 * El nombre por el que se puede buscar: sin las palabras que parecen un
 * correo o un teléfono (importaciones viejas que los dejaron en el campo
 * del nombre). Mismo criterio que `nombreDePila`: «nombre» no puede ser
 * la puerta por la que se adivina un contacto.
 */
export function nombreBuscable(nombre: string | null | undefined): string {
  return sinTildes(
    (nombre ?? "")
      .split(/\s+/)
      .filter((p) => p && !p.includes("@") && !/\d{3,}/.test(p))
      .join(" "),
  );
}

export function coincideConLaBusqueda(
  b: Busqueda,
  identidad: Pick<IdentidadCliente, "nombre" | "correo"> | undefined,
): boolean {
  if (!identidad) return false;
  if (b.por === "correo") {
    const correo = normalizarCorreo(identidad.correo);
    return correo !== null && correo.startsWith(b.texto);
  }
  return nombreBuscable(identidad.nombre).includes(b.texto);
}

/**
 * Microsegundos desde 1970. La base guarda microsegundos y el cursor
 * («siguiente») los trae: comparar con `Date.parse`, que se queda en
 * milisegundos, partiría mal dos altas del mismo milisegundo.
 */
export function microsDe(iso: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(iso.trim());
  if (!m) return null;
  // «+00» a secas no lo entiende `Date.parse`: se completa a «+00:00».
  const zona = m[3] === undefined ? "Z" : /^[+-]\d{2}$/.test(m[3]) ? `${m[3]}:00` : m[3];
  const base = Date.parse(`${m[1]}${zona}`);
  if (!Number.isFinite(base)) return null;
  return base * 1000 + Number((m[2] ?? "").padEnd(6, "0").slice(0, 6));
}

/** ¿`a` es estrictamente anterior a `b`? */
export function esAnterior(a: string, b: string): boolean {
  const x = microsDe(a);
  const y = microsDe(b);
  if (x !== null && y !== null) return x < y;
  return Date.parse(a) < Date.parse(b);
}

function isoDe(fecha: string): string {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? fecha : d.toISOString();
}

export type MiembroDelPanel = {
  id: string;
  cliente_id: string | null;
  persona_id: string | null;
  estado: "activa" | "pausada";
  created_at: string;
};

/** Una fila de `miembros`. Las dadas de baja (`cancelada`) no son clientes de la tarjeta: no salen. */
export function filaDeMiembroDelPanel(v: unknown): MiembroDelPanel | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  if (typeof m.id !== "string" || typeof m.created_at !== "string") return null;
  if (m.estado !== "activa" && m.estado !== "pausada") return null;
  return {
    id: m.id,
    cliente_id: typeof m.cliente_id === "string" ? m.cliente_id : null,
    persona_id: typeof m.persona_id === "string" ? m.persona_id : null,
    estado: m.estado,
    created_at: m.created_at,
  };
}

export type ActividadDelMiembro = { saldo: number; ultima: string | null };

/**
 * El saldo (la suma del ledger, como en todo el módulo) y la última vez
 * que el cliente HIZO algo: sumar una compra o canjear. Un ajuste del
 * negocio, una reversión o el vencimiento de los sellos no son una
 * visita del cliente y no cuentan como actividad.
 */
export function actividadPorMiembro(
  filas: readonly { miembro_id: string; puntos: number; tipo: string; created_at: string }[],
): Map<string, ActividadDelMiembro> {
  const mapa = new Map<string, ActividadDelMiembro>();
  for (const f of filas) {
    const a = mapa.get(f.miembro_id) ?? { saldo: 0, ultima: null };
    a.saldo += Number(f.puntos) || 0;
    if ((f.tipo === "ganado" || f.tipo === "canjeado") && (a.ultima === null || esAnterior(a.ultima, f.created_at))) {
      a.ultima = f.created_at;
    }
    mapa.set(f.miembro_id, a);
  }
  return mapa;
}

export type ClienteDelPanel = {
  miembro_id: string;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  saldo: number;
  desde: string;
  ultima_actividad: string | null;
  estado: "activa" | "pausada";
};

export function armarClienteDelPanel(
  m: MiembroDelPanel,
  identidad: IdentidadCliente | undefined,
  actividad: ActividadDelMiembro | undefined,
): ClienteDelPanel {
  return {
    miembro_id: m.id,
    nombre: nombreDePila(identidad?.nombre),
    correo: enmascararCorreo(identidad?.correo),
    telefono: enmascararTelefono(identidad?.telefono),
    saldo: actividad?.saldo ?? 0,
    desde: isoDe(m.created_at),
    ultima_actividad: actividad?.ultima ? isoDe(actividad.ultima) : null,
    estado: m.estado,
  };
}

// ════════════════════════════════════════════════════════════════════
//  3. Las regalías de la tarjeta
// ════════════════════════════════════════════════════════════════════

export type RecompensaDelPanel = {
  id: string;
  nombre: string;
  descripcion: string | null;
  costo: number;
  activo: boolean;
  tipo: TipoRecompensa | null;
  valor: number | null;
};

function textoONull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function numeroONull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function tipoDeRecompensa(v: unknown): TipoRecompensa | null {
  return typeof v === "string" && (TIPOS_RECOMPENSA as readonly string[]).includes(v) ? (v as TipoRecompensa) : null;
}

/** Una fila de `recompensas`, como la ve el panel de Foorkie. */
export function recompensaDelPanel(fila: Record<string, unknown>): RecompensaDelPanel | null {
  if (typeof fila.id !== "string") return null;
  const costo = Number(fila.costo_puntos);
  if (!Number.isFinite(costo)) return null;
  return {
    id: fila.id,
    nombre: typeof fila.nombre === "string" ? fila.nombre.trim() : "",
    descripcion: textoONull(fila.descripcion),
    costo,
    activo: fila.activo === true,
    tipo: tipoDeRecompensa(fila.tipo),
    valor: numeroONull(fila.valor),
  };
}

/** De la más barata a la más cara (la más barata activa es la meta de la tarjeta). */
export function ordenarRecompensas(lista: RecompensaDelPanel[]): RecompensaDelPanel[] {
  return [...lista].sort(
    (a, b) => a.costo - b.costo || a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id),
  );
}

/**
 * La recompensa COMPLETA que se guarda: lo que mandó Foorkie más lo que
 * ya tenía la fila. El stock, el tope por cliente, el SKU y las
 * instrucciones no se editan desde Foorkie y se conservan, como hace
 * `conservando` en el editor de Bookea: `escribirRecompensa` reemplaza la
 * fila entera, y omitirlos sería borrarlos sin decirlo.
 *
 * El valor del descuento se conserva solo si el TIPO no cambió: un 10 que
 * era «10 %» no puede pasar a ser «₡10» porque alguien cambió el tipo y
 * no mandó el valor nuevo (así lo rechaza `validarRecompensa`).
 */
export function entradaDeRecompensa(
  p: PedidoGuardarRecompensa,
  previa: Record<string, unknown> | null,
): RecompensaInput {
  const tipoPrevio = previa ? tipoDeRecompensa(previa.tipo) : null;
  const tipo = p.tipo !== undefined ? p.tipo : tipoPrevio;
  const valor =
    p.valor !== undefined ? p.valor : previa && tipo === tipoPrevio ? numeroONull(previa.valor) : null;
  const descripcion =
    p.descripcion !== undefined ? (p.descripcion ?? "") : typeof previa?.descripcion === "string" ? previa.descripcion : "";
  return {
    nombre: p.nombre,
    descripcion,
    costoPuntos: p.costo,
    activo: p.activo,
    tipo,
    valor,
    stockTotal: previa ? numeroONull(previa.stock_total) : null,
    limitePorCliente: previa ? numeroONull(previa.limite_por_cliente) : null,
    sku: typeof previa?.sku === "string" ? previa.sku : "",
    instrucciones: typeof previa?.instrucciones === "string" ? previa.instrucciones : "",
  };
}

type FilaDeMeta = { activo?: unknown; nombre?: unknown; costo_puntos?: unknown };

/**
 * Lo que el pase dibuja de las regalías: la activa más barata (su costo
 * y su nombre — `metaDelPrograma`). Si dos empatan en el costo, cuentan
 * las dos: la base puede devolver cualquiera. null = sin regalía activa.
 */
export function firmaDeLaMeta(filas: readonly FilaDeMeta[]): string | null {
  const activas = filas
    .filter((f) => f.activo === true)
    .map((f) => ({ nombre: String(f.nombre ?? "").trim(), costo: Number(f.costo_puntos) }))
    .filter((f) => Number.isFinite(f.costo));
  if (activas.length === 0) return null;
  const minimo = Math.min(...activas.map((a) => a.costo));
  const nombres = activas
    .filter((a) => a.costo === minimo)
    .map((a) => a.nombre)
    .sort();
  return JSON.stringify([minimo, nombres]);
}

/**
 * Los tipos cuyo pase NO dibuja la meta: su beneficio va adentro de la
 * tarjeta (`camposDelTipo` en wallet/tarjeta.ts). Sellos, puntos y
 * cashback sí la dibujan («7/10», «Te faltan 3», «Canjeá por…»).
 */
const SIN_META_EN_EL_PASE: readonly TipoTarjeta[] = ["cupon", "descuento", "membresia", "giftcard", "evento"];

export function dibujaLaMeta(tipo: TipoTarjeta): boolean {
  return !SIN_META_EN_EL_PASE.includes(tipo);
}

export function contarActivas(filas: readonly { activo?: unknown }[]): number {
  return filas.filter((f) => f.activo === true).length;
}

/**
 * ¿El cambio deja a una tarjeta ACTIVA de sellos o de puntos sin
 * ninguna regalía activa?
 *
 * El borrado de Bookea (`eliminarRecompensa`) no lo frena, pero Bookea
 * tampoco deja ACTIVAR una tarjeta así: `puedeActivarse` le exige al
 * menos una recompensa activa a quien la usa (`pideRecompensa`: sellos y
 * puntos), porque sin ella el cliente junta «10 de 10» y no hay nada que
 * canjear. Desde Foorkie se aplica esa misma regla al borrar o apagar la
 * última: el restaurante no tiene un panel de Bookea donde arreglarlo
 * después.
 */
export function quitaLaUltimaActiva(d: {
  tipo: TipoTarjeta;
  estado: EstadoPrograma;
  activasAntes: number;
  activasDespues: number;
}): boolean {
  return pideRecompensa(d.tipo) && d.estado === "activo" && d.activasAntes > 0 && d.activasDespues === 0;
}

export function motivoUltimaActiva(accion: "borrar" | "apagar"): string {
  return (
    "Es la única recompensa activa de la tarjeta: sin ella la tarjeta no promete nada y nadie puede canjear. " +
    (accion === "borrar"
      ? "Agregá otra antes de borrar esta, o cambiale el nombre y el costo."
      : "Agregá otra antes de apagar esta.")
  );
}

/** Lo que dice el rechazo de borrar una recompensa que ya se canjeó (los canjes la referencian, 0060). */
export const MOTIVO_CON_CANJES =
  "Esa recompensa ya se canjeó alguna vez y su historial depende de ella: no se puede borrar. Apagala: así deja de ofrecerse.";

// ════════════════════════════════════════════════════════════════════
//  4. El aviso al Wallet
// ════════════════════════════════════════════════════════════════════

/**
 * La misma frase que el botón de Bookea (`enviarNotificacionPromocional`)
 * cuando el paquete ya no tiene avisos este mes.
 */
export function motivoSinCupo(limite: number, ahora: Date = new Date()): string {
  const proxima = inicioProximoMesEnCR(ahora).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Costa_Rica",
  });
  const notif = limite === 1 ? "tu 1 notificación" : `tus ${limite} notificaciones`;
  const verbo = limite === 1 ? "vuelve" : "vuelven";
  return `Ya usaste ${notif} de este mes — ${verbo} a abrirse el ${proxima}.`;
}

// ════════════════════════════════════════════════════════════════════
//  5. La base
// ════════════════════════════════════════════════════════════════════

const ESTADOS_VISIBLES = ["activa", "pausada"];
const COLUMNAS_MIEMBRO = "id, cliente_id, persona_id, estado, created_at";
/** El `max_rows` de PostgREST: más filas que esto hay que pedirlas por páginas. */
const PAGINA_BASE = 1000;
/** Una búsqueda no lee más miembros que esto (ninguna tarjeta real se le acerca). */
const TOPE_MIEMBROS = 20_000;
/** Cuántas filas del ledger se leen como mucho para una página de clientes. */
const TOPE_LEDGER = 100_000;
const IDENTIDADES_POR_TANDA = 100;
const TANDAS_EN_PARALELO = 4;

function enGrupos<T>(lista: readonly T[], tamano: number): T[][] {
  const grupos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) grupos.push(lista.slice(i, i + tamano));
  return grupos;
}

/**
 * Quién es cada miembro, con la MISMA resolución que el panel de Bookea
 * (`identidadesDeMiembros`), de a cien: con miles de miembros, un solo
 * `in (…)` sería una URL kilométrica.
 */
async function identidadesEnTandas(
  db: Db,
  miembros: MiembroDelPanel[],
  ranchoId: string,
): Promise<Map<string, IdentidadCliente>> {
  const mapa = new Map<string, IdentidadCliente>();
  const tandas = enGrupos(miembros, IDENTIDADES_POR_TANDA);
  for (let i = 0; i < tandas.length; i += TANDAS_EN_PARALELO) {
    const resueltas = await Promise.all(
      tandas.slice(i, i + TANDAS_EN_PARALELO).map((t) => identidadesDeMiembros(db, t, ranchoId)),
    );
    for (const r of resueltas) for (const [id, identidad] of r) mapa.set(id, identidad);
  }
  return mapa;
}

/** Todos los clientes de la tarjeta (activos y pausados), del alta más nueva a la más vieja. null = la base no contestó. */
async function todosLosMiembros(db: Db, programaId: string): Promise<MiembroDelPanel[] | null> {
  const todos: MiembroDelPanel[] = [];
  for (let desde = 0; desde < TOPE_MIEMBROS; desde += PAGINA_BASE) {
    const { data, error } = await db
      .from("miembros")
      .select(COLUMNAS_MIEMBRO)
      .eq("programa_id", programaId)
      .in("estado", ESTADOS_VISIBLES)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(desde, desde + PAGINA_BASE - 1);
    if (error) return null;
    const filas = (data ?? []) as unknown[];
    for (const f of filas) {
      const m = filaDeMiembroDelPanel(f);
      if (m) todos.push(m);
    }
    if (filas.length < PAGINA_BASE) break;
  }
  return todos;
}

type FilaDeSaldo = { miembro_id: string; puntos: number; tipo: string; created_at: string };

/** El ledger completo de estos miembros, por páginas. null = no se pudo leer entero (nunca se inventa un saldo). */
async function ledgerDe(db: Db, ids: string[]): Promise<FilaDeSaldo[] | null> {
  const filas: FilaDeSaldo[] = [];
  for (let desde = 0; ; desde += PAGINA_BASE) {
    if (desde >= TOPE_LEDGER) return null;
    const { data, error } = await db
      .from("transacciones_puntos")
      .select("id, miembro_id, puntos, tipo, created_at")
      .in("miembro_id", ids)
      .order("id", { ascending: true })
      .range(desde, desde + PAGINA_BASE - 1);
    if (error) return null;
    const lote = (data ?? []) as Record<string, unknown>[];
    for (const f of lote) {
      if (typeof f.miembro_id !== "string" || typeof f.created_at !== "string") continue;
      filas.push({
        miembro_id: f.miembro_id,
        puntos: Number(f.puntos) || 0,
        tipo: typeof f.tipo === "string" ? f.tipo : "",
        created_at: f.created_at,
      });
    }
    if (lote.length < PAGINA_BASE) return filas;
  }
}

export type PaginaDeClientes = { clientes: ClienteDelPanel[]; total: number; siguiente: string | null };

/**
 * Los clientes de ESTA tarjeta (la vinculada a Foorkie, no otra del
 * mismo negocio), del alta más nueva a la más vieja, con su saldo y su
 * última actividad. `total` cuenta todos los que coinciden, no solo los
 * de la página. null = la base no contestó.
 *
 * Sin búsqueda, la página la arma la base (`lt` + `limit`). Con búsqueda
 * hay que resolver quién es cada uno antes de filtrar —el nombre puede
 * vivir en `personas`, en la ficha del negocio o en `perfiles`, y sin
 * tildes `ilike` no sirve—, igual que el buscador del mostrador de
 * Bookea (`buscarClientesCore`).
 */
export async function clientesDeLaTarjeta(db: Db, p: PedidoClientes): Promise<PaginaDeClientes | null> {
  let pagina: MiembroDelPanel[];
  let siguiente: string | null;
  let total: number;
  let identidades: Map<string, IdentidadCliente>;

  if (p.buscar) {
    const busqueda = p.buscar;
    const todos = await todosLosMiembros(db, p.programaId);
    if (!todos) return null;
    identidades = await identidadesEnTandas(db, todos, p.ranchoId);
    const coinciden = todos.filter((m) => coincideConLaBusqueda(busqueda, identidades.get(m.id)));
    total = coinciden.length;
    const antes = p.antes;
    const candidatos = antes ? coinciden.filter((m) => esAnterior(m.created_at, antes)) : coinciden;
    ({ pagina, siguiente } = cortarPagina(candidatos.slice(0, p.limite + 1), p.limite));
  } else {
    let consulta = db
      .from("miembros")
      .select(COLUMNAS_MIEMBRO)
      .eq("programa_id", p.programaId)
      .in("estado", ESTADOS_VISIBLES);
    if (p.antes) consulta = consulta.lt("created_at", p.antes);
    const [conteo, leidos] = await Promise.all([
      db
        .from("miembros")
        .select("id", { count: "exact", head: true })
        .eq("programa_id", p.programaId)
        .in("estado", ESTADOS_VISIBLES),
      consulta
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(p.limite + 1),
    ]);
    if (conteo.error || leidos.error) return null;
    const miembros = ((leidos.data ?? []) as unknown[])
      .map(filaDeMiembroDelPanel)
      .filter((m): m is MiembroDelPanel => m !== null);
    ({ pagina, siguiente } = cortarPagina(miembros, p.limite));
    total = conteo.count ?? miembros.length;
    identidades = await identidadesEnTandas(db, pagina, p.ranchoId);
  }

  if (pagina.length === 0) return { clientes: [], total, siguiente: null };
  const ledger = await ledgerDe(
    db,
    pagina.map((m) => m.id),
  );
  if (!ledger) return null;
  const actividad = actividadPorMiembro(ledger);
  return {
    clientes: pagina.map((m) => armarClienteDelPanel(m, identidades.get(m.id), actividad.get(m.id))),
    total,
    siguiente,
  };
}

/** Las regalías de la tarjeta, activas y apagadas, de la más barata a la más cara. null = la base no contestó. */
export async function recompensasDeLaTarjeta(db: Db, programaId: string): Promise<RecompensaDelPanel[] | null> {
  const { data, error } = await db
    .from("recompensas")
    .select("*")
    .eq("programa_id", programaId)
    .order("costo_puntos", { ascending: true });
  if (error) return null;
  return ordenarRecompensas(
    ((data ?? []) as Record<string, unknown>[])
      .map(recompensaDelPanel)
      .filter((r): r is RecompensaDelPanel => r !== null),
  );
}

type TarjetaConRegalias =
  | { ok: true; tipo: TipoTarjeta; estado: EstadoPrograma; filas: Record<string, unknown>[] }
  | FalloDelPanel;

/** La tarjeta (tipo y estado) y TODAS sus regalías, para decidir antes de escribir. */
async function tarjetaYRegalias(db: Db, p: Vinculo): Promise<TarjetaConRegalias> {
  const [programa, regalias] = await Promise.all([
    // `select *`: hay columnas que una base sin migrar no tiene.
    db.from("programa_lealtad").select("*").eq("id", p.programaId).eq("rancho_id", p.ranchoId).maybeSingle(),
    db.from("recompensas").select("*").eq("programa_id", p.programaId),
  ]);
  if (programa.error || regalias.error) {
    return { ok: false, codigo: "error_base", motivo: "No pudimos leer la tarjeta. Probá de nuevo.", status: 500 };
  }
  if (!programa.data) return { ok: false, codigo: "sin_programa", motivo: "Esa tarjeta no existe.", status: 404 };
  const fila = programa.data as Record<string, unknown>;
  return {
    ok: true,
    tipo: tipoDe(typeof fila.modo === "string" ? fila.modo : null),
    estado: estadoDelPrograma({ estado: typeof fila.estado === "string" ? fila.estado : null, activo: fila.activo === true }),
    filas: (regalias.data ?? []) as Record<string, unknown>[],
  };
}

export type RecompensaGuardada = { ok: true; recompensa: RecompensaDelPanel; metaCambio: boolean };

/**
 * Crea o edita una regalía de ESTA tarjeta con las reglas y la escritura
 * de `guardarRecompensa` (`validarRecompensa` + `escribirRecompensa`).
 * `metaCambio` dice si cambió lo que el pase dibuja: entonces hay que
 * avisarle a los pases instalados (`avisarCambioDeMeta`).
 */
export async function guardarRecompensaDeFoorkie(
  db: Db,
  p: PedidoGuardarRecompensa,
): Promise<RecompensaGuardada | FalloDelPanel> {
  const t = await tarjetaYRegalias(db, p);
  if (!t.ok) return t;

  const previa = p.recompensaId ? (t.filas.find((f) => f.id === p.recompensaId) ?? null) : null;
  if (p.recompensaId && !previa) {
    return { ok: false, codigo: "recompensa_ajena", motivo: "Esa recompensa no es de esta tarjeta.", status: 404 };
  }

  const entrada = entradaDeRecompensa(p, previa);
  const invalido = validarRecompensa(entrada);
  if (invalido) return { ok: false, codigo: "datos", motivo: invalido, status: 400 };

  const simuladas = previa
    ? t.filas.map((f) => (f === previa ? { ...f, activo: entrada.activo } : f))
    : [...t.filas, { activo: entrada.activo }];
  if (
    quitaLaUltimaActiva({
      tipo: t.tipo,
      estado: t.estado,
      activasAntes: contarActivas(t.filas),
      activasDespues: contarActivas(simuladas),
    })
  ) {
    return { ok: false, codigo: "ultima_recompensa", motivo: motivoUltimaActiva("apagar"), status: 409 };
  }

  const { data, error } = await escribirRecompensa(db, p.programaId, entrada, p.recompensaId ?? undefined);
  if (error) return { ok: false, codigo: "rechazado", motivo: traducirError(error, "guardar la recompensa"), status: 400 };
  const recompensa = data ? recompensaDelPanel(data) : null;
  if (!data || !recompensa) {
    return { ok: false, codigo: "error_base", motivo: "No pudimos leer la recompensa guardada. Probá de nuevo.", status: 500 };
  }

  const despues = previa ? t.filas.map((f) => (f === previa ? data : f)) : [...t.filas, data];
  return { ok: true, recompensa, metaCambio: dibujaLaMeta(t.tipo) && firmaDeLaMeta(t.filas) !== firmaDeLaMeta(despues) };
}

export type RecompensaBorrada = { ok: true; borrada: boolean; metaCambio: boolean };

/**
 * Borra una regalía de ESTA tarjeta, como `eliminarRecompensa`. Un id
 * que no está en la tarjeta (ya borrada, o de otra) no borra nada y
 * contesta `borrada: false`: igual que allá, borrar es idempotente y un
 * reintento no es un error.
 */
export async function borrarRecompensaDeFoorkie(db: Db, p: PedidoRecompensa): Promise<RecompensaBorrada | FalloDelPanel> {
  const t = await tarjetaYRegalias(db, p);
  if (!t.ok) return t;

  const previa = t.filas.find((f) => f.id === p.recompensaId);
  if (!previa) return { ok: true, borrada: false, metaCambio: false };
  const sinElla = t.filas.filter((f) => f !== previa);
  if (
    quitaLaUltimaActiva({
      tipo: t.tipo,
      estado: t.estado,
      activasAntes: contarActivas(t.filas),
      activasDespues: contarActivas(sinElla),
    })
  ) {
    return { ok: false, codigo: "ultima_recompensa", motivo: motivoUltimaActiva("borrar"), status: 409 };
  }

  const { error } = await borrarRecompensaDe(db, p.programaId, p.recompensaId);
  if (error) {
    // 23503: los canjes la referencian (`on delete restrict`, 0060).
    return (error.code ?? "") === "23503"
      ? { ok: false, codigo: "con_canjes", motivo: MOTIVO_CON_CANJES, status: 409 }
      : { ok: false, codigo: "rechazado", motivo: traducirError(error, "eliminar la recompensa"), status: 400 };
  }
  return { ok: true, borrada: true, metaCambio: dibujaLaMeta(t.tipo) && firmaDeLaMeta(t.filas) !== firmaDeLaMeta(sinElla) };
}

/**
 * La meta cambió: los pases ya instalados se enteran DESPUÉS de responder.
 * Es lo que hace `avisarEdicionDeTarjeta` en pases-actions.ts (privada de
 * un archivo "use server") y lo mismo que `programa/guardar`: el pase de
 * Apple de cada cliente (`avisarCambioDeDiseno`) y la clase de Google.
 */
export function avisarCambioDeMeta(ranchoId: string, programaId: string): void {
  after(() => avisarCambioDeDiseno(programaId));
  after(async () => {
    const r = await refrescarClaseGoogle(ranchoId, programaId);
    if (!r.ok) console.warn(`[google-wallet] no se refrescó la clase de ${ranchoId}/${programaId}: ${r.motivo}`);
  });
}

// ── El aviso, una sola vez por intento ──────────────────────────────

type Intento = { ranchoId: string } | null | "error";

async function intentoRegistrado(db: Db, intentoId: string): Promise<Intento> {
  const { data, error } = await db
    .from("notificaciones_promocionales")
    .select("id, rancho_id")
    .eq("id", intentoId)
    .maybeSingle();
  if (error) return "error";
  if (!data) return null;
  return { ranchoId: String((data as { rancho_id?: unknown }).rancho_id ?? "") };
}

/**
 * EL CANDADO CONTRA EL AVISO DOBLE.
 *
 * Cada aviso deja una fila en `notificaciones_promocionales` (0183): es
 * la que cuenta el cupo del mes. La fila de un aviso de Foorkie lleva
 * como id el `intento_id`, y la llave primaria es el candado: un segundo
 * envío con el mismo intento choca contra ella y no manda nada. Es la
 * misma idea que `campanas_lealtad_envios` (0226): se anota ANTES de
 * mandar y solo manda quien anotó.
 *
 * Con cupo, la fila la crea `reservarCupoNotificacion` (atómica, por
 * negocio) y acá se le pone el intento como id. Sin cupo que contar
 * (paquete sin tope) la reserva no escribe nada, así que la fila se
 * inserta acá: no cambia ningún tope y deja el rastro igual.
 */
async function tomarCandado(
  db: Db,
  p: PedidoMensaje,
  reservaId: string | null,
): Promise<"tomado" | "ya_estaba" | "ajeno" | "error"> {
  const { error } = reservaId
    ? await db.from("notificaciones_promocionales").update({ id: p.intentoId }).eq("id", reservaId)
    : await db.from("notificaciones_promocionales").insert({ id: p.intentoId, rancho_id: p.ranchoId, programa_id: p.programaId });
  if (!error) return "tomado";
  // La reserva que no se pudo marcar se devuelve: no se le cobra cupo a un aviso que no va a salir.
  if (reservaId) await liberarCupoNotificacion(db, reservaId);
  if ((error.code ?? "") !== "23505") return "error";
  const quien = await intentoRegistrado(db, p.intentoId);
  if (quien === "error" || quien === null) return "error";
  return quien.ranchoId === p.ranchoId ? "ya_estaba" : "ajeno";
}

/**
 * Cuántos pases de Apple de ESTA tarjeta reciben el aviso: los que
 * `avisarCambioDeDiseno` marca (todos los vigentes de sus miembros). La
 * corrida inmediata atiende unos cuantos y el cron de los pases el resto.
 * null = no se pudo contar.
 */
async function pasesDeAppleDeLaTarjeta(db: Db, programaId: string): Promise<number | null> {
  if (!plataformasConfiguradas().includes("apple")) return 0;
  const { count, error } = await db
    .from("pases_wallet")
    .select("id, miembros!inner(programa_id)", { count: "exact" })
    .eq("miembros.programa_id", programaId)
    .eq("plataforma", "apple")
    .eq("activo", true)
    .limit(1);
  if (error || count === null) return null;
  return count;
}

export type AvisoMandado = { ok: true; enviados: number; yaEstaba: boolean };

const ERROR_AL_PREPARAR: FalloDelPanel = {
  ok: false,
  codigo: "error_base",
  motivo: "No pudimos preparar el aviso. Probá de nuevo.",
  status: 500,
};
const INTENTO_AJENO: FalloDelPanel = {
  ok: false,
  codigo: "datos",
  motivo: "Ese intento_id ya se usó para otro negocio: generá uno nuevo por aviso.",
  status: 400,
};

/**
 * El aviso a todos los que tienen la tarjeta en el Wallet: el núcleo del
 * botón «Enviar a todos» de Bookea, sin la sesión —
 *
 *   1. el cupo del paquete, con la MISMA reserva atómica por negocio
 *      (`planDelNegocio` + `reservarCupoNotificacion`, 0183);
 *   2. el envío, con el MISMO `enviarMensajePromocional` (Apple por el
 *      cambio de la tarjeta, Google con su mensaje nativo);
 *   3. si el envío falla, la reserva se libera (`liberarCupoNotificacion`)
 *      y el mismo intento se puede volver a mandar.
 *
 * — más el candado del intento (`tomarCandado`): un reintento con el
 * mismo `intento_id` contesta `yaEstaba` sin mandar nada de nuevo.
 *
 * `enviados` = pases que reciben el aviso: los de Apple de la tarjeta y
 * los de Google que aceptaron el mensaje. Nada de personas.
 */
export async function mandarMensajeDeFoorkie(
  db: Db,
  p: PedidoMensaje,
  ahora: Date = new Date(),
): Promise<AvisoMandado | FalloDelPanel> {
  const ya: AvisoMandado = { ok: true, enviados: 0, yaEstaba: true };

  const previo = await intentoRegistrado(db, p.intentoId);
  if (previo === "error") return ERROR_AL_PREPARAR;
  if (previo) return previo.ranchoId === p.ranchoId ? ya : INTENTO_AJENO;

  const plan = await planDelNegocio(db, p.ranchoId);
  const reserva = await reservarCupoNotificacion(db, p.ranchoId, p.programaId, plan);
  if (!reserva.reservado) {
    // ¿Un reintento simultáneo de ESTE intento se llevó el último lugar del mes?
    const otro = await intentoRegistrado(db, p.intentoId);
    if (otro && otro !== "error" && otro.ranchoId === p.ranchoId) return ya;
    return { ok: false, codigo: "sin_cupo", motivo: motivoSinCupo(reserva.limite ?? 0, ahora), status: 409 };
  }

  const candado = await tomarCandado(db, p, reserva.id);
  if (candado === "ya_estaba") return ya;
  if (candado === "ajeno") return INTENTO_AJENO;
  if (candado === "error") return ERROR_AL_PREPARAR;

  const apple = await pasesDeAppleDeLaTarjeta(db, p.programaId);
  const envio = await enviarMensajePromocional(p.programaId, p.texto);
  if (!envio.ok) {
    await liberarCupoNotificacion(db, p.intentoId);
    console.warn(`[foorkie] El aviso de la tarjeta ${p.programaId} no salió: ${envio.motivo}`);
    return { ok: false, codigo: "no_enviado", motivo: "No pudimos mandar el aviso. Probá de nuevo en un rato.", status: 500 };
  }

  // `apple: null` = no había pases de Apple que marcar (o no se pudo): ahí no salió nada por Apple.
  const deApple = envio.apple === null ? 0 : (apple ?? envio.apple.avisados);
  return { ok: true, enviados: deApple + envio.googleEnviados, yaEstaba: false };
}
