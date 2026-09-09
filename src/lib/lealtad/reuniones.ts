import { sumarDiasISO } from "@/lib/fechas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA AGENDA CHICA — cuándo puede Bookea reunirse con un negocio
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (8 sep 2026): «si necesita ayuda, que se abra una
 * agenda pequeña donde elija el día y la hora para programar una
 * reunión». Esto es la regla pura de esa agenda —qué días, qué horas—
 * sin base ni correo: se prueba sola y la usan el formulario (para
 * dibujar) y la server action (para no aceptar lo que el formulario no
 * ofreció).
 *
 * ── LAS REGLAS ─────────────────────────────────────────────────────
 *   · Lunes a sábado, de 9:00 a 17:00, cada media hora (la última 16:30).
 *   · Se puede pedir desde mañana y hasta 14 días adelante: hoy no,
 *     para que Bookea tenga margen de confirmar.
 *   · Hora de Costa Rica siempre (las fechas ISO de `@/lib/fechas`).
 */

export const HORAS_REUNION: readonly string[] = (() => {
  const salida: string[] = [];
  for (let h = 9; h < 17; h++) for (const m of ["00", "30"]) salida.push(`${String(h).padStart(2, "0")}:${m}`);
  return salida;
})();

export const DIAS_ADELANTE = 14;
export const DURACION_MIN = 30;

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Día de la semana de un YYYY-MM-DD sin pasar por la zona del servidor. */
export function diaDeSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export type DiaReunion = { iso: string; diaCorto: string; numero: number; mesCorto: string; largo: string };

/** Los días que se ofrecen desde `hoyISO`: mañana en adelante, sin domingos. */
export function diasDisponibles(hoyISO: string, cantidad = DIAS_ADELANTE): DiaReunion[] {
  const salida: DiaReunion[] = [];
  for (let i = 1; i <= cantidad; i++) {
    const iso = sumarDiasISO(hoyISO, i);
    const dow = diaDeSemana(iso);
    if (dow === 0) continue;
    const [, m, d] = iso.split("-").map(Number);
    salida.push({ iso, diaCorto: DIAS_CORTOS[dow], numero: d, mesCorto: MESES_CORTOS[m - 1], largo: fechaLargaReunion(iso) });
  }
  return salida;
}

/** «jueves 10 de septiembre». */
export function fechaLargaReunion(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${DIAS_LARGOS[diaDeSemana(iso)]} ${d} de ${MESES_LARGOS[m - 1]}`;
}

/** Lo que la server action acepta: exactamente lo que el formulario ofrece. */
export function horarioValido(hoyISO: string, fechaISO: string, hora: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return false;
  if (!HORAS_REUNION.includes(hora)) return false;
  return diasDisponibles(hoyISO).some((d) => d.iso === fechaISO);
}

/** «10:00» a partir de un `time` de Postgres («10:00:00»). */
export function horaCorta(hora: string): string {
  return hora.slice(0, 5);
}

// ── La reunión ya agendada, para el admin ───────────────────────────
//
// Viven acá y no en `admin/(dashboard)/reuniones/actions.ts` porque ese
// archivo es "use server" y de ahí SOLO pueden salir funciones async:
// una constante exportada rompe el build entero, y lo hizo
// («Failed to collect page data for /admin/reuniones»). Es el mismo
// filo que documenta `tarjeta/[slug]/actions.ts`.

export const ESTADOS_REUNION = ["pendiente", "confirmada", "hecha", "cancelada"] as const;
export type EstadoReunion = (typeof ESTADOS_REUNION)[number];

export type ReunionFila = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  negocio: string | null;
  fecha: string;
  hora: string;
  notas: string | null;
  estado: EstadoReunion;
  creado_en: string;
};

/** ¿Ese texto es uno de los cuatro estados? */
export function esEstadoReunion(valor: string): valor is EstadoReunion {
  return (ESTADOS_REUNION as readonly string[]).includes(valor);
}
