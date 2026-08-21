/**
 * ═══════════════════════════════════════════════════════════════════
 *  RESERVAS DEL PANEL DE FOOD — tipos y helpers compartidos
 * ═══════════════════════════════════════════════════════════════════
 *
 * Módulo NEUTRO a propósito (sin "use client" y sin imports de React):
 * lo consumen la página de servidor (que arma y filtra las filas), los
 * componentes cliente (que las pintan) y las server actions (que
 * escriben las notas de una reserva manual). Exportar helpers desde un
 * módulo cliente da el 500 invisible que ya rompió Finanzas e IA — por
 * eso todo lo que cruza la frontera vive acá.
 *
 * LA FILA UNIFICADA: la pantalla mezcla reservas REALES de
 * `food_reservations` con la utilería de `panel-demo.ts` para que se
 * vea llena mientras el negocio junta volumen. `ReservaPanelFila` es
 * la forma común de ambas; `origen` dice de cuál lado vino cada una y
 * la UI marca las de utilería. Cuando el negocio tenga historia real,
 * la página deja de concatenar `RESERVAS_DEMO` y nada más cambia.
 */

/**
 * Los estados del CICLO COMPLETO que pinta la pantalla. Une los de la
 * tabla real (confirmada/check_in/no_show/cancelada) con los del demo
 * ("completada" = check_in que ya pasó, "pendiente" = futura sin
 * confirmar). Es a propósito el mismo universo que `EstadoInsignia`
 * de la píldora compartida, menos los estados de promos.
 */
export type EstadoReservaPanel =
  | "confirmada"
  | "pendiente"
  | "completada"
  | "cancelada"
  | "no_show"
  | "check_in";

export type ReservaPanelFila = {
  id: string;
  /** real = vive en food_reservations · demo = utilería de panel-demo. */
  origen: "real" | "demo";
  /** Nombre a mostrar. Las reales solo lo tienen si fueron manuales
   *  (va en `notas`, ver armarNotasManual); si no, "Cliente de Bookea". */
  cliente: string;
  /** Código de confirmación — solo las reales lo tienen. */
  codigo: string | null;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:MM" en 24h (la hora de food_franjas viene "HH:MM:SS" y se recorta). */
  hora: string;
  personas: number;
  estado: EstadoReservaPanel;
  /** Ocasión o nota libre ("cumpleaños", "mesa junto a la ventana"…). */
  nota: string | null;
  /** Teléfono de contacto — solo reservas manuales lo guardan. */
  telefono: string | null;
  /** Consumo estimado en ₡ — SOLO utilería del demo. Las reales van en
   *  null: Bookea no conoce la facturación y no la inventa. */
  totalEstimado: number | null;
};

/** Una franja futura del negocio, lista para el formulario y el calendario. */
export type FranjaDisponible = {
  id: string;
  fecha: string;
  /** "HH:MM" */
  hora: string;
  capacidad: number;
  reservado: number;
  descuento: number;
  sede: string;
};

// ───────────────────────────────────────────────────────────────────
//  Filtros (viven en el querystring: ?fecha=&estado=&personas=&franja=)
// ───────────────────────────────────────────────────────────────────

/** "completada" filtra también los check_in reales: para el dueño son
 *  la misma cosa (la mesa se concretó). */
export type FiltroEstado =
  | "todos"
  | "confirmada"
  | "pendiente"
  | "completada"
  | "cancelada"
  | "no_show";

export type FiltroPersonas = "todas" | "1-2" | "3-4" | "5-8" | "9+";

export type FranjaHoraria = "todas" | "almuerzo" | "tarde" | "cena";

export type FiltrosReservas = {
  /** "YYYY-MM-DD" o null = todas las fechas. */
  fecha: string | null;
  estado: FiltroEstado;
  personas: FiltroPersonas;
  franja: FranjaHoraria;
};

export const OPCIONES_ESTADO: { valor: FiltroEstado; label: string }[] = [
  { valor: "todos", label: "Todos los estados" },
  { valor: "confirmada", label: "Confirmadas" },
  { valor: "pendiente", label: "Pendientes" },
  { valor: "completada", label: "Completadas" },
  { valor: "cancelada", label: "Canceladas" },
  { valor: "no_show", label: "No se presentó" },
];

export const OPCIONES_PERSONAS: { valor: FiltroPersonas; label: string }[] = [
  { valor: "todas", label: "Cualquier tamaño" },
  { valor: "1-2", label: "1–2 personas" },
  { valor: "3-4", label: "3–4 personas" },
  { valor: "5-8", label: "5–8 personas" },
  { valor: "9+", label: "9 o más" },
];

export const OPCIONES_FRANJA: { valor: FranjaHoraria; label: string }[] = [
  { valor: "todas", label: "Todo el día" },
  { valor: "almuerzo", label: "Almuerzo (hasta 3 p.m.)" },
  { valor: "tarde", label: "Tarde (3–6 p.m.)" },
  { valor: "cena", label: "Cena (6 p.m. en adelante)" },
];

/** El primer valor de un search param, venga solo o repetido. */
export function primerParam(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `?fecha=&estado=&personas=&franja=` → filtros validados. Cualquier
 * basura cae en el default: el querystring lo escribe el navegador,
 * pero también se comparte y se edita a mano.
 */
export function leerFiltros(sp: { [key: string]: string | string[] | undefined }): FiltrosReservas {
  const fecha = primerParam(sp.fecha);
  const estado = primerParam(sp.estado);
  const personas = primerParam(sp.personas);
  const franja = primerParam(sp.franja);

  const esEstado = (v: string): v is FiltroEstado => OPCIONES_ESTADO.some((o) => o.valor === v);
  const esPersonas = (v: string): v is FiltroPersonas =>
    OPCIONES_PERSONAS.some((o) => o.valor === v);
  const esFranja = (v: string): v is FranjaHoraria => OPCIONES_FRANJA.some((o) => o.valor === v);

  return {
    fecha: fecha && FECHA_ISO_RE.test(fecha) ? fecha : null,
    estado: estado && esEstado(estado) ? estado : "todos",
    personas: personas && esPersonas(personas) ? personas : "todas",
    franja: franja && esFranja(franja) ? franja : "todas",
  };
}

/** ¿Hay algún filtro que no sea el default? (para el botón "Limpiar"). */
export function hayFiltrosActivos(f: FiltrosReservas): boolean {
  return f.fecha !== null || f.estado !== "todos" || f.personas !== "todas" || f.franja !== "todas";
}

/** El tramo del día de una hora "HH:MM". Los cortes son los mismos que
 *  anuncia OPCIONES_FRANJA: almuerzo hasta 14:59, tarde 15–17:59, cena 18+. */
export function franjaHorariaDe(hora: string): Exclude<FranjaHoraria, "todas"> {
  if (hora < "15:00") return "almuerzo";
  if (hora < "18:00") return "tarde";
  return "cena";
}

/** ¿La fila pasa TODOS los filtros? Pura a propósito: la corren igual
 *  el servidor y el cliente y no puede dar resultados distintos. */
export function cumpleFiltros(fila: ReservaPanelFila, f: FiltrosReservas): boolean {
  if (f.fecha && fila.fecha !== f.fecha) return false;

  if (f.estado !== "todos") {
    // "completada" agrupa el check_in real con la completada del demo.
    const coincide =
      f.estado === "completada"
        ? fila.estado === "completada" || fila.estado === "check_in"
        : fila.estado === f.estado;
    if (!coincide) return false;
  }

  if (f.personas !== "todas") {
    const p = fila.personas;
    const coincide =
      f.personas === "1-2" ? p <= 2
      : f.personas === "3-4" ? p >= 3 && p <= 4
      : f.personas === "5-8" ? p >= 5 && p <= 8
      : p >= 9;
    if (!coincide) return false;
  }

  if (f.franja !== "todas" && franjaHorariaDe(fila.hora) !== f.franja) return false;

  return true;
}

// ───────────────────────────────────────────────────────────────────
//  Reservas manuales: el contrato de `notas`
// ───────────────────────────────────────────────────────────────────
//
// `food_reservations` no tiene columnas de nombre ni teléfono (la
// reserva normal la hace un usuario logueado y su identidad es
// customer_id). Para la reserva MANUAL —la que el restaurante anota
// por teléfono— esos datos van serializados en `notas` con un formato
// fijo, en vez de tocar el esquema: cambiar tablas exige migración y
// coordinar con la app móvil, y para el V1 la nota alcanza. Si el día
// de mañana se promueve a columnas, este par de funciones es el único
// lugar que hay que tocar.

const PREFIJO_MANUAL = "Manual";
const SEPARADOR = " · ";

/** Serializa los datos de una reserva anotada a mano por el negocio. */
export function armarNotasManual(nombre: string, telefono: string, nota: string): string {
  // El separador no puede aparecer dentro de los campos o el parseo se
  // corre de lugar — se colapsa a coma, que se lee igual de bien.
  const limpiar = (v: string) => v.replaceAll(SEPARADOR, ", ").trim();
  const partes = [PREFIJO_MANUAL, limpiar(nombre), limpiar(telefono) || "—"];
  if (nota.trim()) partes.push(limpiar(nota));
  return partes.join(SEPARADOR);
}

/**
 * Lee `notas` de una reserva real. Si la escribió armarNotasManual
 * devuelve nombre/teléfono/nota por separado; si es una nota libre de
 * una reserva online, todo va en `nota` y el cliente queda null.
 */
export function interpretarNotas(notas: string | null): {
  cliente: string | null;
  telefono: string | null;
  nota: string | null;
} {
  if (!notas) return { cliente: null, telefono: null, nota: null };
  const partes = notas.split(SEPARADOR);
  if (partes[0] !== PREFIJO_MANUAL || partes.length < 3) {
    return { cliente: null, telefono: null, nota: notas };
  }
  return {
    cliente: partes[1] || null,
    telefono: partes[2] === "—" ? null : partes[2] || null,
    nota: partes.slice(3).join(SEPARADOR) || null,
  };
}
