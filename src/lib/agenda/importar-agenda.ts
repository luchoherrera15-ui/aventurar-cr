/**
 * "Traé tu agenda" — el núcleo del importador.
 *
 * 100% PURO: no toca Supabase, ni el reloj, ni la red. Recibe filas
 * crudas (vengan del texto que pegó el dueño, de la foto que leyó
 * Claude, o de un bloqueo importado de Google) y las normaliza,
 * valida y convierte en filas de `reservas`.
 *
 * Cada vertical tiene su forma de ocupar la agenda, y por eso la
 * misma fila se materializa distinto:
 *
 *   eventos      → el día completo. `horario_bloque` (texto libre) +
 *                  `duracion_horas`. Cupo: `eventos_por_dia`.
 *   hospedajes   → un rango de días: `fecha` → `fecha_fin`.
 *   citas        → una franja: `hora_inicio` + `duracion_minutos`
 *                  (+ `miembro_id` si hay equipo).
 *   restaurantes → como citas; la "mesa" es un `equipo_rancho`
 *                  de tipo espacio, con su capacidad (0076).
 *
 * Nada de esto se guarda sin que el dueño lo revise: el importador
 * propone, la pantalla deja corregir, y recién ahí se inserta.
 */

export type VerticalAgenda = "eventos" | "citas" | "hospedajes" | "restaurantes";

/** Una línea de la agenda, tal como queda en la tabla de revisión. */
export type FilaAgenda = {
  /** Identificador local de la fila mientras se revisa (no va a la base). */
  id: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** Último día, para hospedajes (noche de salida). */
  fechaFin: string | null;
  nombre: string;
  /** Personas / invitados / huéspedes / comensales. */
  personas: number | null;
  /** Hora de inicio "HH:MM" — citas, restaurantes, y eventos con hora. */
  horaInicio: string | null;
  /** Hora de cierre "HH:MM". En eventos puede cruzar medianoche. */
  horaFin: string | null;
  /** Lo que vale. null = todavía no se sabe. */
  montoTotal: number | null;
  /** Adelanto ya recibido. */
  adelanto: number | null;
  /** Qué tipo de evento / servicio / plan. */
  tipoEvento: string | null;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  /** Lo que el importador no pudo resolver y el dueño debe cerrar. */
  avisos: string[];
};

export type ConfigNegocio = {
  id: string;
  vertical: VerticalAgenda;
  categoria: string | null;
  capacidadMin: number | null;
  capacidadMax: number | null;
  eventosPorDia: number | null;
};

/** Lo mínimo que una fila necesita para poder guardarse. */
export type ResultadoValidacion = {
  ok: boolean;
  /** Impiden guardar la fila. */
  errores: string[];
  /** No impiden guardar, pero el dueño debería revisarlos. */
  avisos: string[];
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const money = (n: number) => "₡" + n.toLocaleString("es-CR");

// ------------------------------------------------------------------
// Normalización
// ------------------------------------------------------------------

/** "19:30" → "7:30 p.m." — mismo criterio que mi-rancho/types. */
export function formatearHora(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const sufijo = h < 12 ? "a.m." : "p.m.";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** Cuántas horas hay entre dos "HH:MM"; cruza medianoche si hace falta. */
export function duracionHoras(desde: string, hasta: string): number | null {
  if (!HORA_RE.test(desde) || !HORA_RE.test(hasta)) return null;
  const [hd, md] = desde.split(":").map(Number);
  const [hh, mh] = hasta.split(":").map(Number);
  let minutos = hh * 60 + mh - (hd * 60 + md);
  if (minutos <= 0) minutos += 24 * 60;
  return Math.round((minutos / 60) * 10) / 10;
}

/** El texto del bloque que se guarda en `reservas.horario_bloque`. */
export function etiquetaHorario(desde: string, hasta: string): string {
  return `${formatearHora(desde)} – ${formatearHora(hasta)}`;
}

/** El día de la semana (0=domingo) de una fecha "YYYY-MM-DD". */
export function diaDeSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function nombreDia(fecha: string): string {
  return DIAS[diaDeSemana(fecha)] ?? "";
}

// ------------------------------------------------------------------
// Validación
// ------------------------------------------------------------------

/**
 * Valida una fila contra la configuración del negocio.
 *
 * Los errores son los que la base rechazaría igual (o que dejarían la
 * reserva inservible); los avisos son cosas que el dueño debería mirar
 * pero que no impiden apartar la fecha — que es lo que casi siempre
 * urge cuando se está pasando una agenda de papel.
 */
export function validarFila(fila: FilaAgenda, negocio: ConfigNegocio): ResultadoValidacion {
  const errores: string[] = [];
  const avisos: string[] = [];

  if (!FECHA_RE.test(fila.fecha)) {
    errores.push("La fecha no es válida (debe ser AAAA-MM-DD).");
  }
  if (!fila.nombre.trim()) {
    errores.push("Falta el nombre de quien reserva.");
  }

  // --- Horas ---
  if (fila.horaInicio && !HORA_RE.test(fila.horaInicio)) {
    errores.push("La hora de inicio no es válida (HH:MM).");
  }
  if (fila.horaFin && !HORA_RE.test(fila.horaFin)) {
    errores.push("La hora de cierre no es válida (HH:MM).");
  }

  // --- Lo que cada vertical necesita sí o sí ---
  if (negocio.vertical === "citas" || negocio.vertical === "restaurantes") {
    if (!fila.horaInicio) {
      errores.push(
        negocio.vertical === "citas"
          ? "Una cita necesita hora de inicio."
          : "Una reserva de mesa necesita hora.",
      );
    }
  }

  if (negocio.vertical === "hospedajes") {
    if (!fila.fechaFin) {
      errores.push("Un hospedaje necesita fecha de salida.");
    } else if (!FECHA_RE.test(fila.fechaFin)) {
      errores.push("La fecha de salida no es válida (debe ser AAAA-MM-DD).");
    } else if (fila.fechaFin <= fila.fecha) {
      errores.push("La salida tiene que ser después de la entrada.");
    }
  } else if (fila.fechaFin) {
    avisos.push("Esta vertical no usa fecha de salida — se va a ignorar.");
  }

  // --- Capacidad ---
  if (fila.personas != null) {
    if (!Number.isInteger(fila.personas) || fila.personas < 1) {
      errores.push("La cantidad de personas tiene que ser un número entero mayor que cero.");
    } else if (negocio.capacidadMax && fila.personas > negocio.capacidadMax) {
      errores.push(`Este lugar recibe hasta ${negocio.capacidadMax} personas.`);
    } else if (negocio.capacidadMin && fila.personas < negocio.capacidadMin) {
      avisos.push(`El mínimo publicado es ${negocio.capacidadMin} personas.`);
    }
  }

  // --- Plata ---
  if (fila.montoTotal != null) {
    if (!Number.isFinite(fila.montoTotal) || fila.montoTotal < 0) {
      errores.push("El monto no puede ser negativo.");
    }
  } else {
    avisos.push("Sin monto: la reserva no va a aparecer en Finanzas hasta que lo pongás.");
  }

  if (fila.adelanto != null) {
    if (!Number.isFinite(fila.adelanto) || fila.adelanto < 0) {
      errores.push("El adelanto no puede ser negativo.");
    } else if (fila.montoTotal != null && fila.adelanto > fila.montoTotal) {
      errores.push(
        `El adelanto (${money(fila.adelanto)}) no puede ser mayor que el total (${money(fila.montoTotal)}).`,
      );
    }
  }

  return { ok: errores.length === 0, errores, avisos: [...avisos, ...fila.avisos] };
}

/**
 * Choques de fecha DENTRO del lote que se está importando.
 *
 * El cupo real lo vuelve a comprobar el disparador de la base al
 * confirmar (0049/0055), pero avisar acá evita que el dueño guarde 30
 * filas y descubra el problema en la fila 28.
 */
export function detectarChoques(
  filas: FilaAgenda[],
  negocio: ConfigNegocio,
): Map<string, string> {
  const problemas = new Map<string, string>();

  if (negocio.vertical === "citas" || negocio.vertical === "restaurantes") {
    // Choque por franja horaria dentro del mismo día.
    const porDia = new Map<string, FilaAgenda[]>();
    for (const f of filas) {
      if (!f.horaInicio) continue;
      const l = porDia.get(f.fecha) ?? [];
      l.push(f);
      porDia.set(f.fecha, l);
    }
    for (const [, delDia] of porDia) {
      const ordenadas = [...delDia].sort((a, b) =>
        (a.horaInicio ?? "").localeCompare(b.horaInicio ?? ""),
      );
      for (let i = 1; i < ordenadas.length; i++) {
        const previa = ordenadas[i - 1];
        const actual = ordenadas[i];
        const finPrevia = previa.horaFin ?? previa.horaInicio;
        if (finPrevia && actual.horaInicio && actual.horaInicio < finPrevia) {
          problemas.set(
            actual.id,
            `Se traslapa con ${previa.nombre} (${formatearHora(previa.horaInicio!)}).`,
          );
        }
      }
    }
    return problemas;
  }

  if (negocio.vertical === "hospedajes") {
    // Choque por rango de noches.
    const ordenadas = [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (let i = 1; i < ordenadas.length; i++) {
      const previa = ordenadas[i - 1];
      const actual = ordenadas[i];
      const finPrevia = previa.fechaFin ?? previa.fecha;
      if (actual.fecha < finPrevia) {
        problemas.set(actual.id, `Se traslapa con la estadía de ${previa.nombre}.`);
      }
    }
    return problemas;
  }

  // Eventos: el cupo es por día y lo fija el negocio (1 para lugares).
  const cupo = negocio.eventosPorDia ?? (negocio.categoria === "lugares" ? 1 : null);
  if (cupo === null) return problemas;

  const porDia = new Map<string, FilaAgenda[]>();
  for (const f of filas) {
    const l = porDia.get(f.fecha) ?? [];
    l.push(f);
    porDia.set(f.fecha, l);
  }
  for (const [, delDia] of porDia) {
    if (delDia.length <= cupo) continue;
    for (const sobrante of delDia.slice(cupo)) {
      problemas.set(
        sobrante.id,
        cupo === 1
          ? "Ese día ya tiene otra reserva en este lote — el cupo es 1 por día."
          : `Ese día pasa tu cupo de ${cupo} eventos.`,
      );
    }
  }
  return problemas;
}

// ------------------------------------------------------------------
// A fila de `reservas`
// ------------------------------------------------------------------

export type FilaReserva = Record<string, unknown>;

/**
 * Convierte una fila revisada en el objeto que se inserta en
 * `reservas`. No decide el estado: eso lo pone la acción del servidor
 * (se crea 'pendiente' y se confirma después, igual que
 * crearReservaManual, porque la política de insert no deja crear en
 * 'confirmada').
 */
export function aFilaReserva(
  fila: FilaAgenda,
  negocio: ConfigNegocio,
  extra: { importacionId: string; ahoraIso: string },
): FilaReserva {
  const base: FilaReserva = {
    rancho_id: negocio.id,
    fecha: fila.fecha,
    nombre: fila.nombre.trim().slice(0, 120),
    origen: "importada",
    importacion_id: extra.importacionId,
    importada_en: extra.ahoraIso,
    invitados: fila.personas,
    monto_total: fila.montoTotal,
    deposito_monto: fila.adelanto,
    deposito_validado: fila.adelanto != null && fila.adelanto > 0,
    deposito_pagado_en: fila.adelanto != null && fila.adelanto > 0 ? extra.ahoraIso : null,
    evento_pagado: false,
    tipo_evento: fila.tipoEvento?.trim().slice(0, 60) || null,
    whatsapp: fila.telefono?.trim().slice(0, 40) || null,
    correo: fila.correo?.trim().slice(0, 200) || null,
    notas: fila.notas?.trim().slice(0, 500) || null,
    // La agenda de papel es un acuerdo ya cerrado: no hay términos que
    // aceptar en pantalla, pero la reserva no puede quedar como si el
    // cliente los hubiera rechazado.
    terminos_aceptados: true,
    aviso_prohibiciones_aceptado: true,
  };

  if (negocio.vertical === "hospedajes") {
    base.fecha_fin = fila.fechaFin;
    return base;
  }

  if (negocio.vertical === "citas" || negocio.vertical === "restaurantes") {
    base.hora_inicio = fila.horaInicio;
    const horas =
      fila.horaInicio && fila.horaFin ? duracionHoras(fila.horaInicio, fila.horaFin) : null;
    // Sin hora de cierre anotada, una cita dura lo de siempre: 60 min.
    base.duracion_minutos = horas != null ? Math.round(horas * 60) : 60;
    return base;
  }

  // Eventos: el día es del cliente; la franja se guarda como texto.
  if (fila.horaInicio && fila.horaFin) {
    base.horario_bloque = etiquetaHorario(fila.horaInicio, fila.horaFin);
    base.duracion_horas = duracionHoras(fila.horaInicio, fila.horaFin);
  }
  return base;
}

// ------------------------------------------------------------------
// Utilidades para la pantalla
// ------------------------------------------------------------------

let contador = 0;

/** Fila vacía lista para editar. `hoy` viene de afuera (esto es puro). */
export function filaVacia(hoy: string): FilaAgenda {
  contador += 1;
  return {
    id: `f${contador}`,
    fecha: hoy,
    fechaFin: null,
    nombre: "",
    personas: null,
    horaInicio: null,
    horaFin: null,
    montoTotal: null,
    adelanto: null,
    tipoEvento: null,
    telefono: null,
    correo: null,
    notas: null,
    avisos: [],
  };
}

/**
 * Lo que entra al normalizador: campos sin tipar, porque vienen de la
 * IA, de una celda de Excel o de un input del navegador. Solo la fecha
 * se exige como texto — sin ella la fila no ubica en ninguna agenda.
 */
export type FilaCruda = {
  fecha: string;
  fechaFin?: unknown;
  nombre?: unknown;
  personas?: unknown;
  horaInicio?: unknown;
  horaFin?: unknown;
  montoTotal?: unknown;
  adelanto?: unknown;
  tipoEvento?: unknown;
  telefono?: unknown;
  correo?: unknown;
  notas?: unknown;
  avisos?: unknown;
};

/** Normaliza lo que devuelve la IA (o el parser manual) a FilaAgenda. */
export function normalizarFila(cruda: FilaCruda): FilaAgenda {
  contador += 1;
  const limpiarHora = (h: unknown): string | null => {
    if (typeof h !== "string") return null;
    const t = h.trim();
    if (!t) return null;
    // "9:00" → "09:00"; "9" → "09:00"
    const m = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (m) return `${String(Number(m[1])).padStart(2, "0")}:${m[2] ?? "00"}`;
    return HORA_RE.test(t) ? t : null;
  };
  const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const txt = (v: unknown): string | null => {
    if (v == null) return null;
    const t = String(v).trim();
    return t || null;
  };

  return {
    id: `f${contador}`,
    fecha: cruda.fecha,
    fechaFin:
      typeof cruda.fechaFin === "string" && FECHA_RE.test(cruda.fechaFin) ? cruda.fechaFin : null,
    nombre: txt(cruda.nombre) ?? "",
    personas: num(cruda.personas),
    horaInicio: limpiarHora(cruda.horaInicio),
    horaFin: limpiarHora(cruda.horaFin),
    montoTotal: num(cruda.montoTotal),
    adelanto: num(cruda.adelanto),
    tipoEvento: txt(cruda.tipoEvento),
    telefono: txt(cruda.telefono),
    correo: txt(cruda.correo),
    notas: txt(cruda.notas),
    avisos: Array.isArray(cruda.avisos)
      ? (cruda.avisos.filter((a): a is string => typeof a === "string") as string[])
      : [],
  };
}
