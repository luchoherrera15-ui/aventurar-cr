/**
 * LOS OCHO TIPOS DE TARJETA de Lealtad.
 *
 * Es la fuente única: la página pública, el creador, el editor del
 * pase y el generador de Wallet leen todos de acá. Si un tipo nuevo se
 * agrega solo en una pantalla, el sistema empieza a mentir en las
 * otras.
 *
 * ------------------------------------------------------------------
 * POR QUÉ SE REUSA LA COLUMNA `modo` Y NO SE CREA UNA `tipo`
 * ------------------------------------------------------------------
 * `programa_lealtad.modo` ya existe (0121) con tres valores. La 0135
 * amplía su dominio a ocho en vez de sumar una columna paralela.
 *
 * Dos columnas para lo mismo se desincronizan: el día que alguien
 * escriba `tipo = 'cupon'` y olvide `modo`, la tarjeta se dibujaría
 * como puntos y se canjearía como cupón. Un solo campo no puede
 * contradecirse consigo mismo.
 *
 * Los tres valores viejos siguen siendo válidos y significan lo mismo:
 * ningún programa existente cambia de comportamiento.
 *
 * ------------------------------------------------------------------
 * LO QUE VA EN `beneficio` (jsonb) Y LO QUE NO
 * ------------------------------------------------------------------
 * En `beneficio` va lo que es PROPIO de cada tipo: los sellos que pide
 * una tarjeta de sellos, el valor de una gift card, la fecha de un
 * evento. Ocho formas distintas no caben en columnas sin dejar
 * cincuenta campos nulos en cada fila.
 *
 * FUERA de `beneficio` queda todo lo que es IGUAL para los ocho y que
 * un motor tiene que hacer cumplir: vencimientos, límites de uso,
 * estado. Eso va en columnas con su CHECK, porque una regla que
 * decide si un canje procede no puede vivir en un campo de texto que
 * nadie valida.
 */

export const TIPOS_TARJETA_ID = [
  "sellos",
  "puntos",
  "cupon",
  "descuento",
  "membresia",
  "giftcard",
  "evento",
  "cashback",
] as const;

export type TipoTarjeta = (typeof TIPOS_TARJETA_ID)[number];

/**
 * Los tres valores que ya existían en la base (0121). Se conservan
 * como parte del dominio: 'sellos', 'puntos' y 'cashback' son también
 * tipos nuevos, así que no hace falta migrar ni una fila.
 */
export const TIPOS_HEREDADOS: readonly TipoTarjeta[] = ["sellos", "puntos", "cashback"];

export type DefinicionTipo = {
  id: TipoTarjeta;
  nombre: string;
  /** Una línea, la que ve el negocio al elegir. */
  descripcion: string;
  /** Nombre del icono en el juego del panel. */
  icono: string;
  /**
   * Si el saldo del miembro AVANZA con el uso (sellos, puntos,
   * cashback) o si la tarjeta vale por sí misma y se consume de una
   * (cupón, descuento, evento).
   *
   * Decide cosas reales: una tarjeta acumulativa muestra progreso y
   * pide una meta; una de un solo uso muestra el beneficio y se
   * marca usada.
   */
  acumula: boolean;
  /** Si el pase lleva fecha de vencimiento por naturaleza. */
  venceNaturalmente: boolean;
};

export const TIPOS_TARJETA: Record<TipoTarjeta, DefinicionTipo> = {
  sellos: {
    id: "sellos",
    nombre: "Sellos",
    descripcion: "«5 de 10» con círculos que se llenan en cada visita.",
    icono: "sellos",
    acumula: true,
    venceNaturalmente: false,
  },
  puntos: {
    id: "puntos",
    nombre: "Puntos",
    descripcion: "Suma puntos por compra y los canjea por lo que elijas.",
    icono: "puntos",
    acumula: true,
    venceNaturalmente: false,
  },
  cupon: {
    id: "cupon",
    nombre: "Cupón",
    descripcion: "Un beneficio puntual que el cliente presenta y se usa.",
    icono: "cupon",
    acumula: false,
    venceNaturalmente: true,
  },
  descuento: {
    id: "descuento",
    nombre: "Descuento",
    descripcion: "Un porcentaje o monto fijo, con sus días y horarios.",
    icono: "descuento",
    acumula: false,
    venceNaturalmente: true,
  },
  membresia: {
    id: "membresia",
    nombre: "Membresía",
    descripcion: "Carnet de socio con nivel, beneficios y vigencia.",
    icono: "membresia",
    acumula: false,
    venceNaturalmente: true,
  },
  giftcard: {
    id: "giftcard",
    nombre: "Gift card",
    descripcion: "Saldo de regalo que se gasta de a poco.",
    icono: "giftcard",
    acumula: true,
    venceNaturalmente: true,
  },
  evento: {
    id: "evento",
    nombre: "Evento",
    descripcion: "Entrada con fecha, lugar y control de acceso.",
    icono: "evento",
    acumula: false,
    venceNaturalmente: true,
  },
  cashback: {
    id: "cashback",
    nombre: "Cashback",
    descripcion: "Devuelve un porcentaje de cada compra como saldo.",
    icono: "cashback",
    acumula: true,
    venceNaturalmente: false,
  },
};

/** En el orden en que se ofrecen. */
export const TIPOS_TARJETA_LISTA: readonly DefinicionTipo[] = TIPOS_TARJETA_ID.map(
  (id) => TIPOS_TARJETA[id],
);

export function esTipoTarjeta(valor: string | null | undefined): valor is TipoTarjeta {
  return !!valor && (TIPOS_TARJETA_ID as readonly string[]).includes(valor);
}

/**
 * El tipo de un programa, tolerando lo que haya en la base.
 *
 * `null` y cualquier valor desconocido caen a 'puntos', que es el
 * comportamiento que la 0121 ya le daba a `modo is null`. Un tipo que
 * el código no conoce NO debe romper la pantalla ni dejar de emitir el
 * pase: se degrada al genérico.
 */
export function tipoDe(modo: string | null | undefined): TipoTarjeta {
  return esTipoTarjeta(modo) ? modo : "puntos";
}

// ── La configuración propia de cada tipo ───────────────────────────

/** Descuento en porcentaje o en monto, o un producto/servicio gratis. */
export type Beneficio =
  | { forma: "porcentaje"; valor: number }
  | { forma: "monto"; valor: number }
  | { forma: "gratis"; que: string };

export type ConfigSellos = {
  /** Cuántos sellos pide la regalía. */
  requeridos: number;
  /** Qué se lleva al completarlos. */
  recompensa: string;
  /** Sellos de regalo al afiliarse. */
  inicial: number;
  /** Al completarla, arranca otra vuelta. */
  repetible: boolean;
};

export type ConfigPuntos = {
  /** Cómo se llaman ("puntos", "estrellas", "granos"). */
  nombre: string;
  /** Puntos por cada unidad de moneda gastada. */
  porMoneda: number;
  /** Puntos por visita, sin importar el monto. */
  porVisita: number;
  inicial: number;
  /** Mínimo para poder canjear. */
  minimoCanje: number;
  /** Tope acumulable. null = sin tope. */
  maximo: number | null;
};

export type ConfigCupon = {
  beneficio: Beneficio;
  /** Compra mínima para que aplique. 0 = sin mínimo. */
  compraMinima: number;
  /** Tope del descuento en monto. null = sin tope. */
  descuentoMaximo: number | null;
  /** Usos permitidos por cliente. */
  usosPorCliente: number;
};

export type ConfigMembresia = {
  nivel: string;
  beneficios: string[];
  /** Meses de vigencia. */
  vigenciaMeses: number;
  renovacionAutomatica: boolean;
};

export type ConfigGiftCard = {
  valor: number;
  moneda: "CRC" | "USD";
  /** Se puede gastar de a poco. */
  canjeParcial: boolean;
  transferible: boolean;
};

export type ConfigEvento = {
  /** ISO local, sin zona: la zona la pone el programa. */
  fecha: string;
  hora: string;
  ubicacion: string;
  /** Entradas disponibles. null = sin tope. */
  capacidad: number | null;
};

export type ConfigCashback = {
  /** Porcentaje que se devuelve (1..100). */
  porcentaje: number;
  compraMinima: number;
  /** Tope de devolución por compra. null = sin tope. */
  topePorCompra: number | null;
};

export type ConfigBeneficio =
  | ({ tipo: "sellos" } & ConfigSellos)
  | ({ tipo: "puntos" } & ConfigPuntos)
  | ({ tipo: "cupon" | "descuento" } & ConfigCupon)
  | ({ tipo: "membresia" } & ConfigMembresia)
  | ({ tipo: "giftcard" } & ConfigGiftCard)
  | ({ tipo: "evento" } & ConfigEvento)
  | ({ tipo: "cashback" } & ConfigCashback);

/**
 * Con qué arranca cada tipo en el creador.
 *
 * Valores que YA funcionan, no ceros: un programa recién creado tiene
 * que poder publicarse sin que el negocio adivine qué número poner.
 * «10 sellos y el 11 gratis» es el caso real más común del país.
 */
export function configPorDefecto(tipo: TipoTarjeta): ConfigBeneficio {
  switch (tipo) {
    case "sellos":
      return { tipo, requeridos: 10, recompensa: "", inicial: 0, repetible: true };
    case "puntos":
      return {
        tipo,
        nombre: "puntos",
        porMoneda: 0,
        porVisita: 1,
        inicial: 0,
        minimoCanje: 1,
        maximo: null,
      };
    case "cupon":
    case "descuento":
      return {
        tipo,
        beneficio: { forma: "porcentaje", valor: 10 },
        compraMinima: 0,
        descuentoMaximo: null,
        usosPorCliente: 1,
      };
    case "membresia":
      return { tipo, nivel: "", beneficios: [], vigenciaMeses: 12, renovacionAutomatica: false };
    case "giftcard":
      return { tipo, valor: 0, moneda: "CRC", canjeParcial: true, transferible: true };
    case "evento":
      return { tipo, fecha: "", hora: "", ubicacion: "", capacidad: null };
    case "cashback":
      return { tipo, porcentaje: 5, compraMinima: 0, topePorCompra: null };
  }
}

/**
 * Valida la configuración de un beneficio.
 *
 * Devuelve el motivo en palabras del negocio, o null si está bien.
 * Corre en el SERVIDOR antes de guardar: el formulario puede ayudar,
 * pero no es la autoridad — una petición armada a mano lo saltaría.
 */
export function validarBeneficio(config: ConfigBeneficio): string | null {
  switch (config.tipo) {
    case "sellos": {
      if (!Number.isInteger(config.requeridos) || config.requeridos < 1 || config.requeridos > 100) {
        return "Los sellos de la meta van de 1 a 100.";
      }
      if (!config.recompensa.trim()) return "Contá qué se gana al completar los sellos.";
      if (!Number.isInteger(config.inicial) || config.inicial < 0) {
        return "Los sellos de regalo no pueden ser negativos.";
      }
      // Regalar la tarjeta completa la vuelve un cupón disfrazado: el
      // cliente la abre ya ganada y el programa no llega a existir.
      if (config.inicial >= config.requeridos) {
        return "Los sellos de regalo tienen que ser menos que la meta.";
      }
      return null;
    }
    case "puntos": {
      if (!config.nombre.trim() || config.nombre.length > 24) {
        return "El nombre de los puntos es obligatorio (máximo 24 caracteres).";
      }
      if (config.porMoneda < 0 || config.porVisita < 0) {
        return "Los puntos que otorgás no pueden ser negativos.";
      }
      // Un programa que no otorga nada es una tarjeta que nunca avanza:
      // se ve bien, no funciona, y nadie entiende por qué.
      if (config.porMoneda === 0 && config.porVisita === 0) {
        return "El programa tiene que dar algo: puntos por visita, por monto, o los dos.";
      }
      if (config.maximo !== null && config.maximo < config.minimoCanje) {
        return "El tope acumulable no puede ser menor que el mínimo para canjear.";
      }
      return null;
    }
    case "cupon":
    case "descuento": {
      const b = config.beneficio;
      if (b.forma === "porcentaje" && !(b.valor > 0 && b.valor <= 100)) {
        return "El descuento porcentual va de 1 a 100.";
      }
      if (b.forma === "monto" && !(b.valor > 0)) return "El monto del descuento tiene que ser mayor a 0.";
      if (b.forma === "gratis" && !b.que.trim()) return "Contá qué producto o servicio va gratis.";
      if (config.compraMinima < 0) return "La compra mínima no puede ser negativa.";
      if (config.descuentoMaximo !== null && config.descuentoMaximo <= 0) {
        return "El tope del descuento tiene que ser mayor a 0.";
      }
      if (!Number.isInteger(config.usosPorCliente) || config.usosPorCliente < 1) {
        return "Cada cliente tiene que poder usarlo al menos una vez.";
      }
      return null;
    }
    case "membresia": {
      if (!config.nivel.trim()) return "Ponele nombre al nivel de la membresía.";
      if (config.beneficios.length === 0) return "Una membresía sin beneficios no se vende sola.";
      if (!Number.isInteger(config.vigenciaMeses) || config.vigenciaMeses < 1) {
        return "La vigencia tiene que ser de al menos un mes.";
      }
      return null;
    }
    case "giftcard": {
      if (!(config.valor > 0)) return "La gift card tiene que tener un valor mayor a 0.";
      return null;
    }
    case "evento": {
      if (!config.fecha) return "Elegí la fecha del evento.";
      if (!config.hora) return "Elegí la hora del evento.";
      if (!config.ubicacion.trim()) return "Contá dónde es el evento.";
      if (config.capacidad !== null && (!Number.isInteger(config.capacidad) || config.capacidad < 1)) {
        return "La capacidad tiene que ser de al menos una persona.";
      }
      return null;
    }
    case "cashback": {
      if (!(config.porcentaje > 0 && config.porcentaje <= 100)) {
        return "El cashback va de 1 a 100 por ciento.";
      }
      if (config.compraMinima < 0) return "La compra mínima no puede ser negativa.";
      if (config.topePorCompra !== null && config.topePorCompra <= 0) {
        return "El tope por compra tiene que ser mayor a 0.";
      }
      return null;
    }
  }
}

/**
 * La META de una tarjeta acumulativa: cuánto hace falta para ganarse
 * algo. null = el tipo no acumula, o no hay meta definida.
 *
 * Sale de la config y no de una columna aparte: dos números para la
 * misma cosa se separan el día que alguien cambia uno, y a partir de
 * ahí la tarjeta promete algo que el canje no cumple.
 */
export function metaDe(config: ConfigBeneficio): number | null {
  switch (config.tipo) {
    case "sellos":
      return config.requeridos > 0 ? config.requeridos : null;
    case "puntos":
      return config.minimoCanje > 0 ? config.minimoCanje : null;
    case "giftcard":
      return config.valor > 0 ? config.valor : null;
    default:
      return null;
  }
}
