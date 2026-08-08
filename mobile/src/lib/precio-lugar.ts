/**
 * El precio base de alquilar un LUGAR — la única fuente de verdad.
 *
 * ESPEJO de src/lib/precio-lugar.ts en /web: el original vive allá
 * (con sus casos de prueba) y este archivo es una copia literal, porque
 * los dos proyectos no comparten módulos (Next.js y Expo, cada uno con
 * su bundler y su árbol de node_modules). Los dos tienen que cambiar
 * JUNTOS: si divergen, el mismo evento sale a distinto precio según por
 * dónde se reserve — y el servidor no valida el monto, guarda el que le
 * manda el cliente.
 *
 * DICIEMBRE (0099): cada modalidad puede tener su propio precio de
 * diciembre. Si no lo cargaron, ese mes se cobra igual que el resto del
 * año — nunca ₡0 por olvido.
 */

export type ModalidadPrecio = "rango_personas" | "hora" | "fijo" | "por_persona";

export type RangoPrecio = {
  min_invitados: number;
  max_invitados: number;
  precio: number;
};

/** Un ancla de la tarifa deslizante: "a N invitados, ₡X por persona". */
export type TramoTarifa = { invitados: number; tarifa: number };

/**
 * Un escalón de precio fijo: "hasta N invitados, ₡X" — cerrado por
 * arriba. El primero arranca en 1; cada uno siguiente arranca donde
 * terminó el anterior.
 */
export type EscalonFijo = { hasta: number; precio: number };

/**
 * La modalidad "por persona" (0103, pedida para Rancho Las Torres):
 * unos ESCALONES fijos cubren a los grupos chicos y de ahí en adelante
 * el precio es invitados × tarifa — el cliente ve SOLO el total
 * multiplicado, nunca la tarifa. En diciembre el fijo depende del día
 * y la tarifa es deslizante.
 *
 * Los escalones son una LISTA y no un solo tramo porque el dueño pidió
 * escalonarlos: 1-20 a ₡80.000, 21-30 a ₡100.000 y de 31 en adelante
 * por persona. Todo configurable desde el panel.
 */
export type PrecioPorPersona = {
  /**
   * Los tramos de precio fijo, ordenados de menor a mayor. El primero
   * cubre 1..escalones[0].hasta; el segundo, hasta[0]+1..hasta[1]; y
   * así. Después del último manda la tarifa por persona.
   */
  escalones: EscalonFijo[];
  /** Por persona, pasado el último escalón, el resto del año. */
  tarifa: number;
  /**
   * Tope de personas que este lugar cotiza solo. Más que esto queda a
   * "cotización personalizada" en vez de tirar un número inventado.
   * null = sin tope.
   */
  maxPersonas?: number | null;
  /** Diciembre, grupos chicos: el fijo según el día. */
  dicLunJue: number;
  dicViernes: number;
  dicSabDom: number;
  /**
   * Diciembre, por persona: anclas ordenadas por invitados. Antes de
   * la primera rige su tarifa; entre anclas se interpola lineal; tras
   * la última queda plana. Vacío = se usa la tarifa normal.
   */
  dicTramos: TramoTarifa[];
};

/**
 * La config jsonb de la base, validada: cualquier cosa rara devuelve
 * null y la pantalla muestra "consultar" — nunca un ₡0 ni un NaN.
 */
export function parsearPrecioPorPersona(crudo: unknown): PrecioPorPersona | null {
  if (!crudo || typeof crudo !== "object") return null;
  const v = crudo as Record<string, unknown>;
  const n = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null;

  const tarifa = n(v.tarifa);
  const dicLunJue = n(v.dicLunJue);
  const dicViernes = n(v.dicViernes);
  const dicSabDom = n(v.dicSabDom);
  if (!tarifa || !dicLunJue || !dicViernes || !dicSabDom) return null;

  // Los escalones fijos. Se acepta la forma VIEJA (un solo tramo, con
  // baseMax/basePrecio) y se traduce sola: hay configuraciones ya
  // guardadas así y no se pueden quedar sin precio de un día para otro.
  let escalones: EscalonFijo[] = [];
  if (Array.isArray(v.escalones)) {
    for (const e of v.escalones) {
      if (!e || typeof e !== "object") return null;
      const hasta = n((e as Record<string, unknown>).hasta);
      const precio = n((e as Record<string, unknown>).precio);
      if (!hasta || !precio) return null;
      escalones.push({ hasta, precio });
    }
    escalones.sort((a, b) => a.hasta - b.hasta);
  } else {
    const baseMax = n(v.baseMax);
    const basePrecio = n(v.basePrecio);
    if (baseMax && basePrecio) escalones = [{ hasta: baseMax, precio: basePrecio }];
  }
  if (escalones.length === 0) return null;

  // El tope es opcional: sin él, el lugar cotiza cualquier cantidad.
  const maxCrudo = v.maxPersonas;
  const maxPersonas =
    maxCrudo === null || maxCrudo === undefined ? null : n(maxCrudo);
  if (maxCrudo !== null && maxCrudo !== undefined && !maxPersonas) return null;

  const tramosCrudos = Array.isArray(v.dicTramos) ? v.dicTramos : [];
  const dicTramos: TramoTarifa[] = [];
  for (const t of tramosCrudos) {
    if (!t || typeof t !== "object") return null;
    const invitados = n((t as Record<string, unknown>).invitados);
    const tarifaTramo = n((t as Record<string, unknown>).tarifa);
    if (!invitados || !tarifaTramo) return null;
    dicTramos.push({ invitados, tarifa: tarifaTramo });
  }
  dicTramos.sort((a, b) => a.invitados - b.invitados);

  return {
    escalones,
    tarifa,
    maxPersonas,
    dicLunJue,
    dicViernes,
    dicSabDom,
    dicTramos,
  };
}

/**
 * El escalón fijo que cubre a ese grupo, o null si ya se pasó de todos
 * (ahí manda la tarifa por persona).
 */
export function escalonQueAplica(
  escalones: EscalonFijo[],
  invitados: number,
): EscalonFijo | null {
  for (const e of escalones) {
    if (invitados <= e.hasta) return e;
  }
  return null;
}

/**
 * La tarifa por persona que toca a ese grupo según las anclas: antes
 * de la primera rige la primera, después de la última queda plana, y
 * entre dos anclas baja (o sube) en línea recta, al colón.
 */
export function tarifaPorTramos(tramos: TramoTarifa[], invitados: number): number | null {
  if (tramos.length === 0) return null;
  const primero = tramos[0];
  if (invitados <= primero.invitados) return primero.tarifa;
  for (let i = 1; i < tramos.length; i++) {
    const a = tramos[i - 1];
    const b = tramos[i];
    if (invitados <= b.invitados) {
      const avance = (invitados - a.invitados) / (b.invitados - a.invitados);
      return Math.round(a.tarifa + (b.tarifa - a.tarifa) * avance);
    }
  }
  return tramos[tramos.length - 1].tarifa;
}

export type DatosPrecioLugar = {
  modalidad: ModalidadPrecio;
  /** ¿La fecha elegida cae en diciembre? */
  esDiciembre: boolean;

  // --- por_persona (0103) ---
  porPersona?: PrecioPorPersona | null;
  /** Día de la semana elegido (0=domingo … 6=sábado); solo lo usa la
   *  modalidad por_persona para el fijo de diciembre. */
  diaSemana?: number | null;

  // --- rango_personas ---
  invitados: number | null;
  /** Rangos de todo el año (temporada 'normal'). */
  rangos: RangoPrecio[];
  /** Rangos solo de diciembre (temporada 'diciembre'); vacío = no usa. */
  rangosDiciembre?: RangoPrecio[];
  /** La tarifa por persona vieja (pre-0099). Se respeta como respaldo
   *  para los lugares que la cargaron y nunca pasaron a rangos. */
  tarifaDiciembrePorPersona?: number | null;

  // --- hora ---
  horas: number | null;
  precioHora: number | null;
  precioHoraDiciembre?: number | null;

  // --- fijo ---
  precioFijo: number | null;
  precioFijoDiciembre?: number | null;

  /** Una promoción de "precio fijo" del día pisa todo lo demás. */
  promoPrecioFijo?: number | null;
};

/**
 * El rango que cubre esa cantidad de invitados, o null. Se exporta
 * para que la UI pregunte "¿hay precio de diciembre para este grupo?"
 * con el MISMO criterio que usa el cálculo — si lo reimplementara, el
 * cartel podría anunciar un precio de diciembre que no se está
 * cobrando (o al revés).
 */
export function rangoQueAplica(rangos: RangoPrecio[], invitados: number): RangoPrecio | null {
  return (
    rangos.find((r) => invitados >= r.min_invitados && invitados <= r.max_invitados) ?? null
  );
}

/**
 * El precio base del alquiler, antes de servicios adicionales y
 * descuentos. `null` = todavía no se puede saber (faltan datos o el
 * dueño no cargó ese precio) — la pantalla muestra "consultar", nunca
 * ₡0.
 */
export function calcularBaseLugar(datos: DatosPrecioLugar): number | null {
  const {
    modalidad,
    esDiciembre,
    invitados,
    rangos,
    rangosDiciembre = [],
    tarifaDiciembrePorPersona,
    horas,
    precioHora,
    precioHoraDiciembre,
    precioFijo,
    precioFijoDiciembre,
    promoPrecioFijo,
  } = datos;

  // Una promo de precio fijo del día manda sobre todo, diciembre incluido.
  if (promoPrecioFijo !== null && promoPrecioFijo !== undefined) return promoPrecioFijo;

  if (modalidad === "por_persona") {
    const pp = datos.porPersona;
    if (!pp || !invitados) return null;

    // Pasado el tope, el lugar no cotiza solo: "cotización
    // personalizada" es más honesto que multiplicar hasta el infinito.
    if (pp.maxPersonas && invitados > pp.maxPersonas) return null;

    // Grupos chicos: el escalón fijo que les toque.
    const escalon = escalonQueAplica(pp.escalones, invitados);
    if (escalon) {
      if (!esDiciembre) return escalon.precio;
      // En diciembre los grupos chicos van al fijo DEL DÍA, uno solo
      // para todos los escalones: es temporada alta y el precio lo
      // manda el día, no el tamaño del grupo.
      const dia = datos.diaSemana;
      if (dia === 5) return pp.dicViernes;
      if (dia === 0 || dia === 6) return pp.dicSabDom;
      return pp.dicLunJue;
    }

    // Grupos grandes: invitados × tarifa. El cliente ve SOLO este
    // total — la tarifa nunca se muestra.
    if (esDiciembre) {
      const tarifaDic = tarifaPorTramos(pp.dicTramos, invitados);
      return invitados * (tarifaDic ?? pp.tarifa);
    }
    return invitados * pp.tarifa;
  }

  if (modalidad === "fijo") {
    // Sin precio de diciembre cargado se cobra el de siempre.
    const precio = esDiciembre ? (precioFijoDiciembre ?? precioFijo) : precioFijo;
    return precio ?? null;
  }

  if (modalidad === "hora") {
    const porHora = esDiciembre ? (precioHoraDiciembre ?? precioHora) : precioHora;
    if (!horas || porHora === null || porHora === undefined) return null;
    return horas * porHora;
  }

  // rango_personas
  if (!invitados) return null;

  if (esDiciembre) {
    // 1) Los rangos propios de diciembre, si los cargaron.
    const rangoDic = rangoQueAplica(rangosDiciembre, invitados);
    if (rangoDic) return rangoDic.precio;
    // 2) Respaldo: la tarifa por persona de antes de la 0099.
    if (tarifaDiciembrePorPersona && tarifaDiciembrePorPersona > 0) {
      return invitados * tarifaDiciembrePorPersona;
    }
    // 3) Ni una ni otra: diciembre se cobra como el resto del año.
  }

  const rango = rangoQueAplica(rangos, invitados);
  return rango ? rango.precio : null;
}
