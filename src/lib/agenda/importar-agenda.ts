/**
 * "Traé tu agenda" — el núcleo del importador.
 *
 * 100% PURO: no toca Supabase, ni el reloj, ni la red. Recibe filas
 * crudas (vengan del texto que pegó el dueño, de la foto que leyó
 * Claude, o de un bloqueo importado de Google) y las normaliza,
 * valida y convierte en filas de `reservas`.
 *
 * Cada negocio tiene su forma de ocupar la agenda, y por eso la
 * misma fila se materializa distinto:
 *
 *   eventos/lugares → el día completo. `horario_bloque` (texto libre)
 *                  + `duracion_horas`. Cupo: `eventos_por_dia`.
 *   eventos/proveedor → una franja, igual que una cita (ver
 *                  `ocupaFranjaHoraria` acá abajo).
 *   hospedajes   → un rango de días: `fecha` → `fecha_fin`.
 *   citas        → una franja: `hora_inicio` + `duracion_minutos`
 *                  (+ `miembro_id` si hay equipo).
 *   restaurantes → como citas; la "mesa" es un `equipo_rancho`
 *                  de tipo espacio, con su capacidad (0076).
 *
 * Nada de esto se guarda sin que el dueño lo revise: el importador
 * propone, la pantalla deja corregir, y recién ahí se inserta.
 */

import { usaAgendaPorHoras } from "@/lib/business/modulos";
import { DURACION_SUPUESTA_MINUTOS } from "@/app/eventos/agenda-consulta";

export type VerticalAgenda = "eventos" | "citas" | "hospedajes" | "restaurantes";

/**
 * ¿Una fila de este negocio ocupa una FRANJA (hora de inicio +
 * duración) o el DÍA entero?
 *
 * Es LA pregunta del importador, y hasta hoy se contestaba en cuatro
 * lugares con `vertical === "citas" || vertical === "restaurantes"`.
 * Eso dejaba afuera a los proveedores de eventos —el DJ, el animador,
 * el pintacaritas— que desde la agenda por horas (ver
 * `usaAgendaPorHoras` y src/app/eventos/agenda-consulta.ts) trabajan
 * exactamente como una barbería.
 *
 * Y no era un detalle cosmético: una reserva sin `hora_inicio` NO
 * aparece en la vista `disponibilidad_citas` (la 0055 y todas sus
 * sucesoras hasta la 0109 filtran con `hora_inicio is not null`), que
 * es de donde la agenda pública del proveedor saca las franjas
 * tomadas. O sea que el bloqueo importado se veía en el panel del
 * dueño y NO le tapaba una sola hora al cliente: doble reserva en
 * silencio.
 *
 * `usaAgendaPorHoras` es el discriminador oficial y de ahí sale la
 * respuesta; lo único que se le suma es Restaurantes, que ese helper
 * deja afuera a propósito (su panel todavía no se diseñó, ver el
 * comentario en modulos.ts) pero que en el importador SIEMPRE fue por
 * hora — una mesa se reserva a las 8, no "el jueves".
 */
export function ocupaFranjaHoraria(
  vertical: string | null | undefined,
  categoria: string | null | undefined,
): boolean {
  if (vertical === "restaurantes") return true;
  return usaAgendaPorHoras(vertical, categoria);
}

/**
 * Cuánto dura una fila sin hora de cierre anotada.
 *
 * Una cita dura lo de siempre (60 min). Un servicio de eventos usa el
 * mismo bloque que asume su propia agenda pública cuando nada dice
 * cuánto dura — si acá se pusiera una hora, el bloque importado taparía
 * la mitad de lo que de verdad ocupa.
 *
 * Exportada porque la reserva que el dueño carga A MANO desde el
 * calendario del panel tiene exactamente el mismo problema y tiene que
 * asumir exactamente lo mismo (ver `resolverHorarioReserva` en
 * ./reserva-manual). Dos puertas a la misma tabla no pueden suponer
 * bloques distintos. Acepta `string` a secas para que quien la llame no
 * tenga que castear la columna `ranchos.vertical`, que es anulable.
 */
export function duracionPorDefecto(vertical: string | null | undefined): number {
  return (vertical ?? "eventos") === "eventos" ? DURACION_SUPUESTA_MINUTOS : 60;
}

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

/** "19:30" → "7:30 p.m." — mismo criterio que mi-negocio/types. */
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

  // --- Lo que cada negocio necesita sí o sí ---
  //
  // La hora es OBLIGATORIA en todo negocio que agende por franjas, y en
  // un proveedor de eventos también: sin ella la fila se guarda igual
  // pero no entra en `disponibilidad_citas`, así que su agenda pública
  // le sigue ofreciendo esa hora al siguiente cliente. Es mejor
  // rechazar la fila acá —la pantalla de revisión la deja corregir en
  // el acto— que guardar un bloqueo que no bloquea.
  if (ocupaFranjaHoraria(negocio.vertical, negocio.categoria)) {
    if (!fila.horaInicio) {
      errores.push(
        negocio.vertical === "citas"
          ? "Una cita necesita hora de inicio."
          : negocio.vertical === "restaurantes"
            ? "Una reserva de mesa necesita hora."
            : "Poné la hora de inicio: tu agenda se reserva por horas y sin ella esta fecha no le tapa ninguna hora a los clientes.",
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

  if (ocupaFranjaHoraria(negocio.vertical, negocio.categoria)) {
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
    // Citas y restaurantes no tienen cupo por día: ahí termina. Un
    // proveedor de eventos sí puede haber declarado uno
    // (`eventos_por_dia`) y sigue valiendo, así que cae al bloque de
    // abajo además del choque por franja.
    if (negocio.vertical !== "eventos") return problemas;
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
      // Sin pisar el mensaje del choque por franja: al proveedor de
      // eventos le sirve más saber CON QUIÉN se traslapa que enterarse
      // de que llegó al tope del día.
      if (problemas.has(sobrante.id)) continue;
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

  const horas =
    fila.horaInicio && fila.horaFin ? duracionHoras(fila.horaInicio, fila.horaFin) : null;

  if (ocupaFranjaHoraria(negocio.vertical, negocio.categoria)) {
    // `hora_inicio` es lo único que hace que esta fila EXISTA para
    // `disponibilidad_citas` — sin ella el bloqueo no tapa nada (ver
    // `ocupaFranjaHoraria`). `validarFila` ya garantiza que venga.
    base.hora_inicio = fila.horaInicio;
    base.duracion_minutos =
      horas != null ? Math.round(horas * 60) : duracionPorDefecto(negocio.vertical);
    // Un proveedor de eventos ADEMÁS conserva el texto del bloque: el
    // panel, los correos y el feed .ics vienen leyendo `horario_bloque`
    // desde siempre, y quitárselo cambiaría cómo se ve su agenda.
    if (negocio.vertical === "eventos" && fila.horaInicio && fila.horaFin) {
      base.horario_bloque = etiquetaHorario(fila.horaInicio, fila.horaFin);
      base.duracion_horas = horas;
    }
    return base;
  }

  // Lugares para eventos: el día entero es del cliente y la franja se
  // guarda como texto — se alquila por fecha, no por hora.
  if (fila.horaInicio && fila.horaFin) {
    base.horario_bloque = etiquetaHorario(fila.horaInicio, fila.horaFin);
    base.duracion_horas = horas;
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
