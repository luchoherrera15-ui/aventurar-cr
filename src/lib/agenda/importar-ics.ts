import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";

/**
 * Importación de agendas externas (Google/Apple Calendar → Bookea).
 *
 * El proveedor pega la dirección .ics privada de su calendario;
 * `sincronizarAgendaExterna` la descarga, la parsea y materializa cada
 * compromiso como una reserva `bloqueada` (origen 'sync') del negocio:
 * desde la 0072 esas filas tapan el día en eventos/hospedajes y la
 * franja horaria en citas. Cada sincronización reconcilia contra el
 * feed: lo nuevo se inserta, lo cambiado se actualiza y lo que ya no
 * está (evento borrado o movido) se elimina — el uid externo
 * (`sync_uid`) es la llave.
 *
 * Alcance del parser (v1, sin dependencias): eventos sueltos, series
 * RRULE diarias/semanales/mensuales/anuales básicas (INTERVAL, BYDAY,
 * UNTIL, COUNT), EXDATE por fecha y overrides RECURRENCE-ID. Zonas
 * horarias: UTC ("Z"), hora local (flotante o TZID de Costa Rica) y
 * cualquier TZID IANA vía Intl. Costa Rica no tiene horario de
 * verano.
 */

/** Ventana de importación: una semana atrás, seis meses adelante. */
const DIAS_ATRAS = 7;
const DIAS_ADELANTE = 180;
/** Tope duro de filas por agenda — nadie necesita más para bloquear. */
const MAX_EVENTOS = 500;
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 15_000;
/** No re-sincronizar más seguido que esto (martilleo del botón). */
const MIN_SEGUNDOS_ENTRE_SYNC = 45;

export type EventoImportado = {
  uid: string;
  titulo: string;
  fecha: string; // YYYY-MM-DD (hora de CR)
  fechaFin: string | null;
  horaInicio: string | null; // HH:MM
  duracionMinutos: number | null;
};

// ------------------------------------------------------------------
// Parser ICS
// ------------------------------------------------------------------

type PropIcs = { nombre: string; params: Record<string, string>; valor: string };

function desplegarLineas(ics: string): string[] {
  // Las líneas largas vienen "dobladas" con CRLF + espacio/tab.
  return ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function parsearProp(linea: string): PropIcs | null {
  const idx = linea.indexOf(":");
  if (idx < 0) return null;
  const cabeza = linea.slice(0, idx);
  const valor = linea.slice(idx + 1);
  const [nombre, ...crudos] = cabeza.split(";");
  const params: Record<string, string> = {};
  for (const p of crudos) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { nombre: nombre.toUpperCase(), params, valor };
}

function desescapar(texto: string): string {
  return texto
    .replace(/\\n/gi, " · ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

type MomentoCR = { fecha: string; hora: string | null; epoch: number };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Epoch de una hora "de pared" interpretada en una zona IANA, sin
 * dependencias: se aproxima y se corrige con Intl (dos pasadas cubren
 * los saltos de horario de verano).
 */
function epochDesdeZona(
  y: number, mo: number, d: number, h: number, mi: number, s: number, zona: string,
): number {
  let epoch = Date.UTC(y, mo - 1, d, h, mi, s);
  for (let i = 0; i < 2; i++) {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(epoch));
    const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
    const visto = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
    const objetivo = Date.UTC(y, mo - 1, d, h, mi, s);
    if (visto === objetivo) break;
    epoch += objetivo - visto;
  }
  return epoch;
}

/** Un epoch visto desde Costa Rica (UTC-6 fijo, sin DST). */
function epochACR(epoch: number): MomentoCR {
  const d = new Date(epoch - 6 * 3600_000);
  return {
    fecha: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hora: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    epoch,
  };
}

/** DTSTART/DTEND/EXDATE → momento en hora de Costa Rica. */
function parsearMomento(prop: PropIcs): MomentoCR | null {
  const v = prop.valor.trim();
  if (prop.params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4)), mo = Number(v.slice(4, 6)), d = Number(v.slice(6, 8));
    if (!y || !mo || !d) return null;
    return { fecha: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, hora: null, epoch: Date.UTC(y, mo - 1, d) };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [1, 2, 3, 4, 5, 6].map((i) => Number(m[i]));
  if (m[7] === "Z") return epochACR(Date.UTC(y, mo - 1, d, h, mi, s));
  const zona = prop.params.TZID;
  if (!zona || zona === "America/Costa_Rica") {
    // Flotante o ya en hora local: se toma tal cual como hora de CR.
    return epochACR(Date.UTC(y, mo - 1, d, h + 6, mi, s));
  }
  try {
    return epochACR(epochDesdeZona(y, mo, d, h, mi, s, zona));
  } catch {
    return epochACR(Date.UTC(y, mo - 1, d, h + 6, mi, s));
  }
}

/** "PT1H30M" → minutos. */
function parsearDuracion(v: string): number | null {
  const m = v.match(/^-?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [d, h, mi] = [Number(m[1] ?? 0), Number(m[2] ?? 0), Number(m[3] ?? 0)];
  const total = d * 1440 + h * 60 + mi;
  return total > 0 ? total : null;
}

type VeventCrudo = {
  uid: string;
  titulo: string;
  inicio: MomentoCR;
  /** Fin exclusivo para all-day; para timed, epoch real de fin. */
  fin: MomentoCR | null;
  duracionExplicita: number | null;
  rrule: string | null;
  exdates: Set<string>;
  recurrenceId: string | null;
  cancelado: boolean;
};

const DIAS_BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function dowDeFecha(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Parsea el archivo completo y devuelve las ocurrencias dentro de la
 * ventana, listas para materializar.
 */
export function parsearIcs(ics: string, desde: string, hasta: string): EventoImportado[] {
  const lineas = desplegarLineas(ics);
  const crudos: VeventCrudo[] = [];
  let actual: Partial<VeventCrudo> & { exdates: Set<string> } | null = null;

  for (const linea of lineas) {
    if (linea === "BEGIN:VEVENT") {
      actual = { exdates: new Set() };
      continue;
    }
    if (linea === "END:VEVENT") {
      if (actual?.uid && actual.inicio) {
        crudos.push({
          uid: actual.uid,
          titulo: actual.titulo ?? "",
          inicio: actual.inicio,
          fin: actual.fin ?? null,
          duracionExplicita: actual.duracionExplicita ?? null,
          rrule: actual.rrule ?? null,
          exdates: actual.exdates,
          recurrenceId: actual.recurrenceId ?? null,
          cancelado: actual.cancelado ?? false,
        });
      }
      actual = null;
      continue;
    }
    if (!actual) continue;
    const prop = parsearProp(linea);
    if (!prop) continue;
    switch (prop.nombre) {
      case "UID":
        actual.uid = prop.valor.trim();
        break;
      case "SUMMARY":
        actual.titulo = desescapar(prop.valor).trim();
        break;
      case "DTSTART":
        actual.inicio = parsearMomento(prop) ?? undefined;
        break;
      case "DTEND":
        actual.fin = parsearMomento(prop) ?? undefined;
        break;
      case "DURATION":
        actual.duracionExplicita = parsearDuracion(prop.valor) ?? undefined;
        break;
      case "RRULE":
        actual.rrule = prop.valor.trim();
        break;
      case "EXDATE":
        for (const parte of prop.valor.split(",")) {
          const m = parsearMomento({ ...prop, valor: parte.trim() });
          if (m) actual.exdates.add(m.fecha);
        }
        break;
      case "RECURRENCE-ID":
        actual.recurrenceId = parsearMomento(prop)?.fecha ?? prop.valor.trim();
        break;
      case "STATUS":
        if (prop.valor.trim().toUpperCase() === "CANCELLED") actual.cancelado = true;
        break;
    }
  }

  // Los overrides (RECURRENCE-ID) reemplazan a la ocurrencia de su
  // serie en esa fecha: se importan aparte y la serie se salta ahí.
  const saltosPorSerie = new Map<string, Set<string>>();
  for (const e of crudos) {
    if (e.recurrenceId) {
      const set = saltosPorSerie.get(e.uid) ?? new Set();
      set.add(e.recurrenceId);
      saltosPorSerie.set(e.uid, set);
    }
  }

  const salida: EventoImportado[] = [];

  const duracionDe = (e: VeventCrudo): { horaInicio: string | null; duracionMinutos: number | null; fechaFin: string | null } => {
    if (e.inicio.hora === null) {
      // All-day: DTEND es exclusivo — el último día real es fin-1.
      let fechaFin: string | null = null;
      if (e.fin && e.fin.fecha > e.inicio.fecha) {
        fechaFin = sumarDiasISO(e.fin.fecha, -1);
        if (fechaFin <= e.inicio.fecha) fechaFin = null;
      }
      return { horaInicio: null, duracionMinutos: null, fechaFin };
    }
    let minutos = e.duracionExplicita;
    if (minutos === null && e.fin) {
      const diff = Math.round((e.fin.epoch - e.inicio.epoch) / 60_000);
      if (diff > 0) minutos = Math.min(diff, 1440);
    }
    return { horaInicio: e.inicio.hora, duracionMinutos: minutos ?? 60, fechaFin: null };
  };

  const empujar = (e: VeventCrudo, fecha: string, uid: string) => {
    if (fecha < desde || fecha > hasta) return;
    const base = duracionDe(e);
    salida.push({
      uid,
      titulo: e.titulo,
      fecha,
      fechaFin: base.fechaFin,
      horaInicio: base.horaInicio,
      duracionMinutos: base.duracionMinutos,
    });
  };

  for (const e of crudos) {
    if (e.cancelado) continue;
    if (e.recurrenceId) {
      empujar(e, e.inicio.fecha, `${e.uid}#R${e.recurrenceId}`);
      continue;
    }
    if (!e.rrule) {
      empujar(e, e.inicio.fecha, e.uid);
      continue;
    }

    // Serie RRULE: expansión básica dentro de la ventana.
    const regla: Record<string, string> = {};
    for (const parte of e.rrule.split(";")) {
      const eq = parte.indexOf("=");
      if (eq > 0) regla[parte.slice(0, eq).toUpperCase()] = parte.slice(eq + 1);
    }
    const freq = regla.FREQ?.toUpperCase();
    const intervalo = Math.max(1, Number(regla.INTERVAL ?? 1) || 1);
    const tope = regla.COUNT ? Number(regla.COUNT) : Infinity;
    const until = regla.UNTIL
      ? (parsearMomento({ nombre: "UNTIL", params: {}, valor: regla.UNTIL })?.fecha ?? null)
      : null;
    const saltos = saltosPorSerie.get(e.uid);

    const diasBase =
      freq === "WEEKLY" && regla.BYDAY
        ? regla.BYDAY.split(",").map((d) => DIAS_BYDAY[d.trim().toUpperCase()]).filter((n) => n !== undefined)
        : [dowDeFecha(e.inicio.fecha)];

    let generadas = 0;
    let fecha = e.inicio.fecha;
    for (let paso = 0; paso < 800 && generadas < tope && salida.length < MAX_EVENTOS; paso++) {
      let candidatas: string[] = [];
      if (freq === "DAILY") {
        candidatas = [sumarDiasISO(e.inicio.fecha, paso * intervalo)];
      } else if (freq === "WEEKLY") {
        const lunes = sumarDiasISO(e.inicio.fecha, paso * 7 * intervalo - dowDeFecha(e.inicio.fecha));
        candidatas = diasBase.map((dow) => sumarDiasISO(lunes, dow)).sort();
      } else if (freq === "MONTHLY" || freq === "YEARLY") {
        const [y, m, d] = e.inicio.fecha.split("-").map(Number);
        const meses = freq === "MONTHLY" ? paso * intervalo : paso * 12 * intervalo;
        const f = new Date(Date.UTC(y, m - 1 + meses, d));
        // Si el mes no tiene ese día (31 en febrero), se salta.
        if (f.getUTCDate() !== d) {
          candidatas = [];
        } else {
          candidatas = [`${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`];
        }
      } else {
        // FREQ desconocido: solo la primera ocurrencia.
        empujar(e, e.inicio.fecha, e.uid);
        break;
      }

      for (const c of candidatas) {
        if (c < e.inicio.fecha) continue;
        if (until && c > until) { generadas = Infinity; break; }
        generadas++;
        if (generadas > tope) break;
        fecha = c;
        if (e.exdates.has(c) || saltos?.has(c)) continue;
        empujar(e, c, `${e.uid}#${c.replace(/-/g, "")}`);
      }
      if (generadas === Infinity || fecha > hasta) break;
    }
  }

  return salida.slice(0, MAX_EVENTOS);
}

// ------------------------------------------------------------------
// Reconciliación contra la base
// ------------------------------------------------------------------

export type ResultadoSync =
  | { ok: true; importados: number; throttled?: boolean }
  | { ok: false; error: string };

export async function sincronizarAgendaExterna(agendaId: string): Promise<ResultadoSync> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Sin llave de servicio." };

  const { data: agenda } = await admin
    .from("agendas_externas")
    .select("id, rancho_id, url, ultima_sync, eventos_importados, ranchos(vertical)")
    .eq("id", agendaId)
    .maybeSingle();
  if (!agenda) return { ok: false, error: "Agenda no encontrada." };

  const fila = agenda as unknown as {
    id: string;
    rancho_id: string;
    url: string;
    ultima_sync: string | null;
    eventos_importados: number;
    ranchos: { vertical: string | null } | null;
  };

  if (
    fila.ultima_sync &&
    Date.now() - new Date(fila.ultima_sync).getTime() < MIN_SEGUNDOS_ENTRE_SYNC * 1000
  ) {
    return { ok: true, importados: fila.eventos_importados, throttled: true };
  }

  const anotarError = async (mensaje: string): Promise<ResultadoSync> => {
    await admin
      .from("agendas_externas")
      .update({ ultima_sync: new Date().toISOString(), ultimo_error: mensaje })
      .eq("id", agendaId);
    return { ok: false, error: mensaje };
  };

  // 1. Descargar el .ics.
  let texto: string;
  try {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
    const res = await fetch(fila.url, {
      signal: control.signal,
      headers: { "User-Agent": "Bookea-Agenda-Sync/1.0" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return anotarError(`El calendario respondió ${res.status}.`);
    texto = await res.text();
  } catch {
    return anotarError("No se pudo descargar el calendario (¿la dirección sigue vigente?).");
  }
  if (texto.length > MAX_BYTES) return anotarError("El calendario es demasiado grande.");
  if (!texto.includes("BEGIN:VCALENDAR")) {
    return anotarError("Esa dirección no devuelve un calendario .ics.");
  }

  // 2. Parsear dentro de la ventana.
  const hoy = hoyISOCR();
  const eventos = parsearIcs(texto, sumarDiasISO(hoy, -DIAS_ATRAS), sumarDiasISO(hoy, DIAS_ADELANTE));

  // En citas, un compromiso de día completo debe tapar TODOS los
  // espacios: se materializa como 00:00 + 1440 (y por día si abarca
  // varios), porque disponibilidad_citas choca por franja, no por día.
  const esCitas = fila.ranchos?.vertical === "citas";
  const filasDeseadas = new Map<string, EventoImportado>();
  for (const e of eventos) {
    if (esCitas && e.horaInicio === null) {
      const fin = e.fechaFin ?? e.fecha;
      for (let f = e.fecha; f <= fin && filasDeseadas.size < MAX_EVENTOS; f = sumarDiasISO(f, 1)) {
        filasDeseadas.set(`${e.uid}#d${f.replace(/-/g, "")}`, {
          ...e,
          uid: `${e.uid}#d${f.replace(/-/g, "")}`,
          fecha: f,
          fechaFin: null,
          horaInicio: "00:00",
          duracionMinutos: 1440,
        });
      }
    } else if (filasDeseadas.size < MAX_EVENTOS) {
      filasDeseadas.set(e.uid, e);
    }
  }

  // 3. Reconciliar contra lo ya importado de ESTA agenda.
  const { data: actualesData, error: errorActuales } = await admin
    .from("reservas")
    .select("id, sync_uid, fecha, fecha_fin, hora_inicio, duracion_minutos, nombre")
    .eq("agenda_externa_id", agendaId);
  if (errorActuales) return anotarError("No se pudo leer lo importado: " + errorActuales.message);

  const actuales = (actualesData ?? []) as {
    id: string;
    sync_uid: string;
    fecha: string;
    fecha_fin: string | null;
    hora_inicio: string | null;
    duracion_minutos: number | null;
    nombre: string;
  }[];
  const actualPorUid = new Map(actuales.map((a) => [a.sync_uid, a]));

  const nombreDe = (e: EventoImportado) => (e.titulo || "Agenda externa").slice(0, 120);
  const inserciones: Record<string, unknown>[] = [];
  const actualizaciones: { id: string; cambios: Record<string, unknown> }[] = [];

  for (const [uid, e] of filasDeseadas) {
    const existente = actualPorUid.get(uid);
    if (!existente) {
      inserciones.push({
        rancho_id: fila.rancho_id,
        agenda_externa_id: agendaId,
        sync_uid: uid,
        origen: "sync",
        estado: "bloqueada",
        nombre: nombreDe(e),
        contacto: "agenda externa",
        tipo_evento: "Agenda externa",
        fecha: e.fecha,
        fecha_fin: e.fechaFin,
        hora_inicio: e.horaInicio,
        duracion_minutos: e.duracionMinutos,
      });
      continue;
    }
    const cambio =
      existente.fecha !== e.fecha ||
      (existente.fecha_fin ?? null) !== e.fechaFin ||
      (existente.hora_inicio?.slice(0, 5) ?? null) !== e.horaInicio ||
      (existente.duracion_minutos ?? null) !== e.duracionMinutos ||
      existente.nombre !== nombreDe(e);
    if (cambio) {
      actualizaciones.push({
        id: existente.id,
        cambios: {
          fecha: e.fecha,
          fecha_fin: e.fechaFin,
          hora_inicio: e.horaInicio,
          duracion_minutos: e.duracionMinutos,
          nombre: nombreDe(e),
        },
      });
    }
  }
  const sobrantes = actuales.filter((a) => !filasDeseadas.has(a.sync_uid)).map((a) => a.id);

  if (inserciones.length > 0) {
    const { error } = await admin.from("reservas").insert(inserciones);
    if (error) return anotarError("No se pudieron guardar los bloqueos: " + error.message);
  }
  for (const a of actualizaciones) {
    await admin.from("reservas").update(a.cambios).eq("id", a.id);
  }
  for (let i = 0; i < sobrantes.length; i += 100) {
    await admin.from("reservas").delete().in("id", sobrantes.slice(i, i + 100));
  }

  await admin
    .from("agendas_externas")
    .update({
      ultima_sync: new Date().toISOString(),
      ultimo_error: null,
      eventos_importados: filasDeseadas.size,
    })
    .eq("id", agendaId);

  return { ok: true, importados: filasDeseadas.size };
}
