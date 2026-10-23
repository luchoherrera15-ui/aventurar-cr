import type { Horario } from "./tipos";
import { diaDeLaSemana, instanteLocal, partesLocales, sumarDias } from "./zona-horaria";

/**
 * CUÁNDO SALE UN MENSAJE: el retraso, el horario y la vigencia.
 *
 * Módulo PURO. Recibe el instante en que pasó el hecho (nunca lee el reloj)
 * y devuelve el instante en que el mensaje puede salir, o por qué no puede.
 *
 *   salida = hecho + retraso  →  empujada hasta caer dentro del horario  →  dentro de la vigencia
 *
 * ── EL HORARIO SIEMPRE ES EL DEL NEGOCIO ────────────────────────────
 * «A las 9:00» es a las 9:00 de la zona horaria del negocio. El cálculo usa
 * `Intl` con esa zona (ver `zona-horaria.ts`), así que un cambio de horario
 * de verano no corre el mensaje una hora.
 *
 * ── LOS TRES MODOS ──────────────────────────────────────────────────
 *   inmediato    sale apenas pasa el retraso.
 *   hora_exacta  sale a esa hora; si ya pasó hoy, mañana. Respeta los días permitidos.
 *   ventana      sale entre `desde` y `hasta` (ambos incluidos, a nivel de minuto).
 *                Si el momento cae afuera, `siguiente_ventana` decide:
 *                  true  → espera a la próxima ventana;
 *                  false → no se manda (fuera_de_horario).
 */

export type MotivoSinEjecucion =
  | "antes_de_vigencia"
  | "fuera_de_vigencia"
  | "fuera_de_horario"
  | "horario_invalido";

export type ResultadoEjecucion =
  | { ok: true; ejecutarEn: Date }
  | { ok: false; motivo: MotivoSinEjecucion };

/** Hasta cuántos días hacia adelante se busca el próximo día permitido. */
const DIAS_DE_BUSQUEDA = 15;

/** «09:30» → 570. null si no es una hora HH:MM válida. */
export function minutosDeHora(hora: string | undefined | null): number | null {
  if (typeof hora !== "string") return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 570 → «09:30». */
export function horaDeMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function diasPermitidos(horario: Horario): Set<number> {
  const dias = (horario.dias ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return new Set(dias.length > 0 ? dias : [0, 1, 2, 3, 4, 5, 6]);
}

/** ¿Este instante cae dentro de lo que permite el horario? (`inmediato` y `hora_exacta` no restringen el momento.) */
export function dentroDelHorario(instante: Date, horario: Horario, zona: string): boolean {
  if (horario.modo !== "ventana") return true;
  const desde = minutosDeHora(horario.desde);
  const hasta = minutosDeHora(horario.hasta);
  if (desde === null || hasta === null) return false;
  const p = partesLocales(instante, zona);
  return diasPermitidos(horario).has(p.diaSemana) && p.minutos >= desde && p.minutos <= hasta;
}

/**
 * El primer instante igual o posterior a `base` en que el horario deja mandar, o null si no hay
 * ninguno (o si el modo no permite esperar).
 */
export function instanteEnHorario(base: Date, horario: Horario, zona: string): Date | null {
  if (horario.modo === "inmediato") return base;

  const permitidos = diasPermitidos(horario);
  const local = partesLocales(base, zona);

  if (horario.modo === "hora_exacta") {
    const hora = minutosDeHora(horario.hora);
    if (hora === null) return null;
    for (let i = 0; i <= DIAS_DE_BUSQUEDA; i++) {
      const fecha = sumarDias(local.fecha, i);
      if (!permitidos.has(diaDeLaSemana(fecha))) continue;
      const candidato = instanteLocal(fecha, hora, zona);
      if (candidato.getTime() >= base.getTime()) return candidato;
    }
    return null;
  }

  // ventana
  const desde = minutosDeHora(horario.desde);
  const hasta = minutosDeHora(horario.hasta);
  if (desde === null || hasta === null || desde > hasta) return null;

  if (permitidos.has(local.diaSemana) && local.minutos >= desde && local.minutos <= hasta) return base;
  if (horario.siguiente_ventana === false) return null;

  for (let i = 0; i <= DIAS_DE_BUSQUEDA; i++) {
    const fecha = sumarDias(local.fecha, i);
    if (!permitidos.has(diaDeLaSemana(fecha))) continue;
    // Hoy, solo si la ventana todavía no abrió (si ya estaba abierta se devolvió `base` arriba);
    // los demás días, apenas abre.
    if (i === 0 && local.minutos > hasta) continue;
    const candidato = instanteLocal(fecha, desde, zona);
    if (candidato.getTime() >= base.getTime()) return candidato;
  }
  return null;
}

export type EntradaEjecucion = {
  /** Cuándo pasó lo que dispara el impulso. */
  ocurridoEn: Date;
  retrasoMinutos: number;
  horario: Horario;
  zona: string;
  /** AAAA-MM-DD en la zona del negocio. */
  vigenteDesde?: string | null;
  vigenteHasta?: string | null;
};

/** Cuándo sale el mensaje de un hecho, o por qué no sale. */
export function calcularEjecucion(e: EntradaEjecucion): ResultadoEjecucion {
  const fechaDelHecho = partesLocales(e.ocurridoEn, e.zona).fecha;
  // Una campaña que arranca mañana no le escribe retroactivamente a lo de ayer.
  if (e.vigenteDesde && fechaDelHecho < e.vigenteDesde) return { ok: false, motivo: "antes_de_vigencia" };

  const retraso = Number.isFinite(e.retrasoMinutos) ? Math.max(0, Math.floor(e.retrasoMinutos)) : 0;
  const base = new Date(e.ocurridoEn.getTime() + retraso * 60_000);

  const valido = validarHorario(e.horario);
  if (valido) return { ok: false, motivo: "horario_invalido" };

  const salida = instanteEnHorario(base, e.horario, e.zona);
  if (!salida) return { ok: false, motivo: "fuera_de_horario" };

  if (e.vigenteHasta && partesLocales(salida, e.zona).fecha > e.vigenteHasta) {
    return { ok: false, motivo: "fuera_de_vigencia" };
  }
  return { ok: true, ejecutarEn: salida };
}

/** Texto del problema de un horario, o null si está bien formado. */
export function validarHorario(h: Horario | null | undefined): string | null {
  if (!h || typeof h !== "object") return "El horario no es válido.";
  if (h.modo === "inmediato") {
    if (h.dias && h.dias.length > 0 && h.dias.length < 7) {
      return "Para limitar los días elegí «Entre dos horas» o «A una hora exacta».";
    }
    return null;
  }
  if (h.dias) {
    if (!Array.isArray(h.dias) || h.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      return "Los días permitidos no son válidos.";
    }
    if (h.dias.length === 0) return "Elegí al menos un día de la semana.";
  }
  if (h.modo === "hora_exacta") {
    return minutosDeHora(h.hora) === null ? "Escribí la hora exacta, por ejemplo 09:00." : null;
  }
  if (h.modo === "ventana") {
    const desde = minutosDeHora(h.desde);
    const hasta = minutosDeHora(h.hasta);
    if (desde === null || hasta === null) return "Escribí la hora de inicio y la de fin, por ejemplo 09:00 y 18:00.";
    if (desde >= hasta) return "La hora de inicio tiene que ser anterior a la de fin.";
    return null;
  }
  return "Elegí cuándo puede salir el mensaje.";
}

/** Cuánto se espera hasta N intentos fallidos, en minutos. */
export function esperaDeReintento(intentosHechos: number, esperas: readonly number[]): number {
  const i = Math.max(0, Math.min(intentosHechos - 1, esperas.length - 1));
  return esperas[i] ?? esperas[esperas.length - 1] ?? 5;
}
