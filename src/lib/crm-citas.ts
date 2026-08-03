/**
 * El CRM de clientes de un negocio de citas — puro y sin Supabase,
 * para poder probarlo con datos de mentira.
 *
 * DERIVADO, NO DUPLICADO (decisión D-3 de AUDITORIA.md): no existe una
 * tabla "clientes". La ficha de cada cliente se calcula al vuelo desde
 * sus reservas, así nunca se desincroniza de la agenda real.
 *
 * IDENTIDAD DEL CLIENTE (cierra el abierto C-3 de AUDITORIA.md): una
 * misma persona puede aparecer como cuenta con sesión (cliente_id),
 * como correo tecleado en una cita manual, o solo como nombre en una
 * agenda importada. La llave de agrupación es, en orden de confianza:
 *
 *   1. `cliente_id`  — reservó con su cuenta: identidad fuerte.
 *   2. `correo`      — normalizado a minúsculas.
 *   3. `whatsapp`    — solo dígitos, últimos 8 (el formato local varía:
 *                      "8888-8888", "+506 8888 8888"...).
 *   4. `nombre`      — normalizado; el último recurso (dos "María"
 *                      distintas se mezclarían, pero una agenda de
 *                      papel importada no trae nada más).
 *
 * La MISMA llave se usa para métricas y para campañas: si mañana se
 * cambia, se cambia solo acá.
 */

export type ReservaCliente = {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string | null;
  estado: string;
  nombre: string | null;
  correo: string | null;
  whatsapp: string | null;
  cliente_id: string | null;
  monto_total: number | null;
};

export type ClienteCRM = {
  /** La llave de agrupación (ver arriba). */
  clave: string;
  /** Las reservas que componen la ficha — para encontrar al cliente de
   *  una cita concreta sin repetir la lógica de identidad. */
  citaIds: string[];
  nombre: string | null;
  correo: string | null;
  whatsapp: string | null;
  clienteId: string | null;
  /** Citas reales del cliente (no cuenta bloqueos ni holds). */
  totalCitas: number;
  cumplidas: number;
  noAsistio: number;
  canceladas: number;
  /** Última cita CUMPLIDA — la última vez que de verdad vino. */
  ultimaVisita: string | null;
  /** Próxima cita confirmada (>= hoy), si tiene. */
  proximaCita: string | null;
  /** Suma de lo gastado en citas cumplidas. */
  gastoTotal: number;
  /**
   * Cuántas de sus ÚLTIMAS citas ya resueltas fueron no-shows, en
   * fila: 2 = "faltó a sus últimas dos citas", el aviso que pide el
   * negocio para mandarle una promo de re-enganche.
   */
  fallosSeguidos: number;
  /** Días desde la última visita (null si nunca vino). */
  diasSinVenir: number | null;
};

/** Los estados que representan una cita de un cliente real. */
const ESTADOS_CLIENTE = new Set([
  "pendiente",
  "confirmada",
  "cumplida",
  "no_asistio",
  "cancelada",
  // Eventos usa 'rechazada' como cancelación; en citas viejas también
  // aparece — cuenta como cancelada para la ficha.
  "rechazada",
]);

function normalizarCorreo(correo: string | null): string | null {
  const limpio = (correo ?? "").trim().toLowerCase();
  return limpio.indexOf("@") > 0 && !/\s/.test(limpio) ? limpio : null;
}

function normalizarTelefono(tel: string | null): string | null {
  const digitos = (tel ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return digitos.slice(-8);
}

function normalizarNombre(nombre: string | null): string | null {
  const limpio = (nombre ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return limpio.length >= 2 ? limpio : null;
}

/** La llave de identidad de una reserva, o null si no hay con qué. */
export function claveCliente(r: {
  cliente_id: string | null;
  correo: string | null;
  whatsapp: string | null;
  nombre: string | null;
}): string | null {
  if (r.cliente_id) return `id:${r.cliente_id}`;
  const correo = normalizarCorreo(r.correo);
  if (correo) return `correo:${correo}`;
  const tel = normalizarTelefono(r.whatsapp);
  if (tel) return `tel:${tel}`;
  const nombre = normalizarNombre(r.nombre);
  if (nombre) return `nombre:${nombre}`;
  return null;
}

function diasEntre(desdeISO: string, hastaISO: string): number {
  const [y1, m1, d1] = desdeISO.split("-").map(Number);
  const [y2, m2, d2] = hastaISO.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86400000);
}

/**
 * Agrupa las reservas de un negocio en fichas de cliente. `hoy` llega
 * de afuera (hoyISOCR o la zona del negocio) para que sea probable.
 */
export function agruparClientes(
  reservas: ReservaCliente[],
  hoy: string,
): ClienteCRM[] {
  // Primera pasada: la misma persona a veces reserva con su cuenta
  // (cliente_id + correo) y otras veces el dueño la anota a mano (solo
  // correo o teléfono). Las citas que traen cuenta Y contacto enseñan
  // el puente: ese correo/teléfono ES esa cuenta.
  const puente = new Map<string, string>();
  for (const r of reservas) {
    if (!r.cliente_id || !ESTADOS_CLIENTE.has(r.estado)) continue;
    const correo = normalizarCorreo(r.correo);
    if (correo) puente.set(`correo:${correo}`, `id:${r.cliente_id}`);
    const tel = normalizarTelefono(r.whatsapp);
    if (tel) puente.set(`tel:${tel}`, `id:${r.cliente_id}`);
  }

  const porClave = new Map<string, ReservaCliente[]>();
  for (const r of reservas) {
    if (!ESTADOS_CLIENTE.has(r.estado)) continue;
    const directa = claveCliente(r);
    if (!directa) continue;
    const clave = puente.get(directa) ?? directa;
    const lista = porClave.get(clave);
    if (lista) lista.push(r);
    else porClave.set(clave, [r]);
  }

  const clientes: ClienteCRM[] = [];
  for (const [clave, citas] of porClave) {
    // Orden cronológico para poder mirar "las últimas".
    citas.sort((a, b) =>
      (a.fecha + (a.hora_inicio ?? "")).localeCompare(b.fecha + (b.hora_inicio ?? "")),
    );

    // Los datos de contacto: el dato más reciente no vacío gana (el
    // cliente pudo corregir su teléfono en la última cita).
    let nombre: string | null = null;
    let correo: string | null = null;
    let whatsapp: string | null = null;
    let clienteId: string | null = null;
    for (const c of citas) {
      if (c.nombre?.trim()) nombre = c.nombre.trim();
      if (normalizarCorreo(c.correo)) correo = normalizarCorreo(c.correo);
      if (c.whatsapp?.trim()) whatsapp = c.whatsapp.trim();
      if (c.cliente_id) clienteId = c.cliente_id;
    }

    let cumplidas = 0;
    let noAsistio = 0;
    let canceladas = 0;
    let gastoTotal = 0;
    let ultimaVisita: string | null = null;
    let proximaCita: string | null = null;
    for (const c of citas) {
      if (c.estado === "cumplida") {
        cumplidas++;
        gastoTotal += Number(c.monto_total ?? 0);
        ultimaVisita = c.fecha;
      } else if (c.estado === "no_asistio") {
        noAsistio++;
      } else if (c.estado === "cancelada" || c.estado === "rechazada") {
        canceladas++;
      } else if (c.estado === "confirmada" && c.fecha >= hoy) {
        if (!proximaCita || c.fecha < proximaCita) proximaCita = c.fecha;
      }
    }

    // Los fallos seguidos se miran sobre las citas YA RESUELTAS
    // (cumplida o no_asistio), de la más reciente hacia atrás. Una
    // cancelación en el medio no corta la racha: cancelar avisando no
    // es lo mismo que dejar plantado, pero tampoco es venir.
    let fallosSeguidos = 0;
    for (let i = citas.length - 1; i >= 0; i--) {
      const estado = citas[i].estado;
      if (estado === "cumplida") break;
      if (estado === "no_asistio") fallosSeguidos++;
    }

    clientes.push({
      clave,
      citaIds: citas.map((c) => c.id),
      nombre,
      correo,
      whatsapp,
      clienteId,
      totalCitas: citas.length,
      cumplidas,
      noAsistio,
      canceladas,
      ultimaVisita,
      proximaCita,
      gastoTotal,
      fallosSeguidos,
      diasSinVenir: ultimaVisita ? diasEntre(ultimaVisita, hoy) : null,
    });
  }

  // Los que necesitan atención primero: reincidentes arriba, después
  // por última actividad (visita o cita más reciente).
  clientes.sort((a, b) => {
    const reincA = a.fallosSeguidos >= 2 ? 1 : 0;
    const reincB = b.fallosSeguidos >= 2 ? 1 : 0;
    if (reincA !== reincB) return reincB - reincA;
    return (b.ultimaVisita ?? "").localeCompare(a.ultimaVisita ?? "");
  });
  return clientes;
}

/** "Faltó a sus últimas 2 citas (o más)" — el aviso de re-enganche. */
export function esReincidente(c: ClienteCRM): boolean {
  return c.fallosSeguidos >= 2;
}

/** A partir de cuántos días sin venir un cliente se considera dormido. */
export const DIAS_INACTIVO = 45;

/**
 * Vino alguna vez, no tiene nada agendado y hace mucho no aparece:
 * el candidato natural del correo "te extrañamos".
 */
export function esInactivo(c: ClienteCRM, diasUmbral: number = DIAS_INACTIVO): boolean {
  return (
    c.cumplidas > 0 &&
    !c.proximaCita &&
    c.diasSinVenir !== null &&
    c.diasSinVenir >= diasUmbral
  );
}

export type SegmentoCampana = "todos" | "inactivos" | "no_show";

/**
 * Los correos de un segmento, para precargar una campaña. Solo entran
 * clientes CON correo — a los demás no hay cómo escribirles (el panel
 * los muestra aparte para contactarlos por WhatsApp).
 */
export function correosSegmento(
  clientes: ClienteCRM[],
  segmento: SegmentoCampana,
): string[] {
  const filtro =
    segmento === "todos"
      ? () => true
      : segmento === "inactivos"
        ? (c: ClienteCRM) => esInactivo(c)
        : (c: ClienteCRM) => esReincidente(c);
  return [
    ...new Set(
      clientes
        .filter((c) => c.correo && filtro(c))
        .map((c) => c.correo as string),
    ),
  ];
}
