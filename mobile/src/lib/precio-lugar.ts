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

export type ModalidadPrecio = "rango_personas" | "hora" | "fijo";

export type RangoPrecio = {
  min_invitados: number;
  max_invitados: number;
  precio: number;
};

export type DatosPrecioLugar = {
  modalidad: ModalidadPrecio;
  /** ¿La fecha elegida cae en diciembre? */
  esDiciembre: boolean;

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

/** El rango que cubre esa cantidad de invitados, o null. */
function rangoQueAplica(rangos: RangoPrecio[], invitados: number): RangoPrecio | null {
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
