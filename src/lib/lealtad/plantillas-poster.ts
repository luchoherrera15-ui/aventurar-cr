import type { TipoTarjeta } from "./tipos-tarjeta";

/**
 * LOS CINCO PÓSTERES, y qué dice cada uno según el tipo de tarjeta.
 *
 * ------------------------------------------------------------------
 * POR QUÉ PLANTILLAS Y NO UN EDITOR
 * ------------------------------------------------------------------
 * El póster se imprime en A4 y se pega en la caja. Un editor libre —
 * mové esto, cambiá aquella tipografía— produce, en manos de alguien
 * que no diseña, un papel peor que el que traía de fábrica: títulos
 * ilegibles a dos metros, QR de 2 cm, siete tipografías.
 *
 * Cinco plantillas terminadas resuelven el 95% de los casos y no
 * pueden salir mal. El negocio elige la que va con su local y pone su
 * color y su logo — que es lo que de verdad lo hace suyo.
 *
 * ------------------------------------------------------------------
 * SON CINCO LAYOUTS, NO CINCO PALETAS
 * ------------------------------------------------------------------
 * Si las cinco fueran la misma hoja con otro color, sería un diseño
 * disfrazado de cinco. Cada una cambia la ESTRUCTURA: dónde cae el
 * QR, cuánto pesa el título, si hay foto, si hay borde.
 *
 * ------------------------------------------------------------------
 * EL TEXTO SALE DEL TIPO DE TARJETA
 * ------------------------------------------------------------------
 * El póster decía «Sumá sellos con tu teléfono» SIEMPRE, incluso para
 * una gift card o una entrada de evento. Un cartel que promete algo
 * que la tarjeta no hace es peor que no tener cartel: el cliente lo
 * pide en la caja y el negocio queda mal.
 */

/**
 * ------------------------------------------------------------------
 * Y UN SEXTO: EL QUE SE ESCRIBE
 * ------------------------------------------------------------------
 * Cinco plantillas cerradas resuelven el caso normal, no todos. El
 * negocio que ya sabe qué quiere decir necesitaba una salida, y la
 * alternativa a dársela es que se la fabrique afuera: un Canva, otra
 * tipografía, otro QR mal exportado.
 *
 * «Personalizado» no es un sexto layout: ARRANCA de uno de los cinco y
 * deja cambiar lo que de verdad cambia el sentido de la hoja —el
 * texto, los colores del papel y qué bloques se muestran—. La
 * estructura sigue siendo una de las cinco terminadas, así que ni
 * queriendo se llega a un póster ilegible a dos metros.
 */

/** Los cinco terminados. De acá sale el LAYOUT, siempre. */
export const ESTILOS_PLANTILLA = [
  "minimalista",
  "audaz",
  "clasico",
  "vitrina",
  "ticket",
] as const;

export const ESTILOS_POSTER = [...ESTILOS_PLANTILLA, "personalizado"] as const;

export type EstiloPlantilla = (typeof ESTILOS_PLANTILLA)[number];
export type EstiloPoster = (typeof ESTILOS_POSTER)[number];

export function esEstiloPlantilla(valor: unknown): valor is EstiloPlantilla {
  return typeof valor === "string" && (ESTILOS_PLANTILLA as readonly string[]).includes(valor);
}

export type DefinicionEstilo = {
  id: EstiloPoster;
  nombre: string;
  /** Para qué local es. En concreto, no en adjetivos. */
  paraQuien: string;
  /** Qué lo distingue de los otros cuatro, estructuralmente. */
  seNota: string;
  /** true = el fondo de la hoja es el color del negocio. */
  fondoDeMarca: boolean;
  /** true = usa la imagen del banner si el programa tiene una. */
  usaFoto: boolean;
};

export const ESTILOS: Record<EstiloPoster, DefinicionEstilo> = {
  minimalista: {
    id: "minimalista",
    nombre: "Minimalista",
    paraQuien: "Cafés de especialidad, salones y estudios con estética limpia.",
    seNota: "Papel blanco, mucho aire y el QR enorme al centro. Casi no hay texto.",
    fondoDeMarca: false,
    usaFoto: false,
  },
  audaz: {
    id: "audaz",
    nombre: "Audaz",
    paraQuien: "Barberías, gimnasios y locales con mucho tránsito.",
    seNota: "Tu color inunda la hoja y el título se lee desde la otra punta del local.",
    fondoDeMarca: true,
    usaFoto: false,
  },
  clasico: {
    id: "clasico",
    nombre: "Clásico",
    paraQuien: "Panaderías, sodas y restaurantes de toda la vida.",
    seNota: "Papel crema, tipografía con serifa y un marco fino. Se ve impreso, no digital.",
    fondoDeMarca: false,
    usaFoto: false,
  },
  vitrina: {
    id: "vitrina",
    nombre: "Vitrina",
    paraQuien: "Negocios con una buena foto: spas, restaurantes, hoteles.",
    seNota: "La foto ocupa la mitad de arriba. Si no hay foto, cae en un degradado de tu color.",
    fondoDeMarca: false,
    usaFoto: true,
  },
  ticket: {
    id: "ticket",
    nombre: "Ticket",
    paraQuien: "Cafeterías, food trucks y todo lo que se cobra rápido.",
    seNota: "Parece un recibo: borde troquelado, tipografía de máquina, aire de cupón.",
    fondoDeMarca: false,
    usaFoto: false,
  },
  personalizado: {
    id: "personalizado",
    nombre: "Personalizado",
    paraQuien: "El negocio que ya sabe qué quiere decir y quiere decirlo con sus palabras.",
    seNota: "Arranca de una de las cinco y vos cambiás textos, colores y qué bloques salen.",
    fondoDeMarca: false,
    usaFoto: false,
  },
};

export const ESTILO_POR_DEFECTO: EstiloPoster = "minimalista";

/** Un valor cualquiera → un estilo válido. Lo desconocido cae al default. */
export function estiloDe(valor: string | null | undefined): EstiloPoster {
  return ESTILOS_POSTER.includes(valor as EstiloPoster)
    ? (valor as EstiloPoster)
    : ESTILO_POR_DEFECTO;
}

/** Lo que el póster dice, según lo que la tarjeta de verdad hace. */
export type CopyPoster = {
  /** El título grande. Dos líneas como máximo — se parte en el `\n`. */
  titulo: string;
  /** La línea bajo el QR. */
  invitacion: string;
  /** Los tres pasos, ya adaptados. */
  pasos: [string, string, string];
};

const COPY: Record<TipoTarjeta, CopyPoster> = {
  sellos: {
    titulo: "Sumá sellos\ncon tu teléfono",
    invitacion: "Escaneá y llevate tu tarjeta",
    pasos: [
      "Escaneá y agregá la tarjeta a tu teléfono",
      "Mostrala en cada visita y sumá tu sello",
      "Completala y reclamá tu premio",
    ],
  },
  puntos: {
    titulo: "Sumá puntos\nen cada compra",
    invitacion: "Escaneá y empezá a sumar",
    pasos: [
      "Escaneá y agregá la tarjeta a tu teléfono",
      "Mostrala al pagar y sumá puntos",
      "Canjealos por lo que quieras",
    ],
  },
  cupon: {
    titulo: "Tu cupón,\nen el teléfono",
    invitacion: "Escaneá y guardalo en tu Wallet",
    pasos: [
      "Escaneá y guardá el cupón en tu teléfono",
      "Mostralo al pagar",
      "Se descuenta solo, sin recortar nada",
    ],
  },
  descuento: {
    titulo: "Tu descuento\nsiempre a mano",
    invitacion: "Escaneá y guardalo en tu Wallet",
    pasos: [
      "Escaneá y agregá la tarjeta a tu teléfono",
      "Mostrala al pagar",
      "El descuento se aplica en el momento",
    ],
  },
  membresia: {
    titulo: "Tu carnet de socio,\nen el teléfono",
    invitacion: "Escaneá y activá tu membresía",
    pasos: [
      "Escaneá y agregá tu carnet al teléfono",
      "Mostralo al entrar",
      "Se renueva solo: nunca se vence en tu bolsillo",
    ],
  },
  giftcard: {
    titulo: "Regalá saldo,\nno un papel",
    invitacion: "Escaneá y guardá tu gift card",
    pasos: [
      "Escaneá y guardá la gift card en tu teléfono",
      "Mostrala al pagar",
      "El saldo baja solo, y siempre sabés cuánto queda",
    ],
  },
  evento: {
    titulo: "Tu entrada,\nen el teléfono",
    invitacion: "Escaneá y guardá tu entrada",
    pasos: [
      "Escaneá y guardá la entrada en tu teléfono",
      "Mostrala en la puerta",
      "Se valida al instante, sin listas ni papeles",
    ],
  },
  cashback: {
    titulo: "Te devolvemos\nen cada compra",
    invitacion: "Escaneá y empezá a acumular",
    pasos: [
      "Escaneá y agregá la tarjeta a tu teléfono",
      "Mostrala al pagar y acumulá saldo",
      "Usalo en tu próxima visita",
    ],
  },
};

/**
 * El texto del póster para este tipo.
 *
 * Tolera un tipo desconocido cayendo a «sellos»: un programa guardado
 * antes de la 0135 no tiene tipo, y quedarse sin póster por eso sería
 * castigar al negocio por una migración que no pidió.
 */
export function copyDelPoster(tipo: string | null | undefined): CopyPoster {
  return COPY[tipo as TipoTarjeta] ?? COPY.sellos;
}

/**
 * La línea del premio, según el tipo. `null` = este tipo no promete
 * una meta y el bloque no se dibuja — en un cupón, «A los 10 sellos»
 * no significa nada.
 */
export function etiquetaDeMeta(
  tipo: string | null | undefined,
  meta: number | null,
): string | null {
  if (meta === null || meta <= 0) return null;
  if (tipo === "sellos") return `A los ${meta} sellos`;
  if (tipo === "puntos" || tipo === "cashback") return `A los ${meta} puntos`;
  return null;
}

// ── El póster escrito por el dueño ─────────────────────────────────

/**
 * Lo que el negocio puede cambiar del estilo «personalizado».
 *
 * Se guarda en `programa_lealtad.poster_config` (jsonb, 0132). jsonb y
 * no diez columnas: esto lo lee UNA pantalla para dibujar un papel.
 * Ningún motor decide nada con estos campos, así que no necesitan CHECK
 * en la base — lo que sí necesitan es validarse antes de guardar, que
 * es lo que hace `validarConfigPoster`.
 */
export type ConfigPoster = {
  /** De cuál de las cinco toma el LAYOUT. Nunca 'personalizado'. */
  base: EstiloPlantilla;
  titulo: string;
  invitacion: string;
  pasos: [string, string, string];
  mostrarPasos: boolean;
  mostrarPremio: boolean;
  mostrarPie: boolean;
  /**
   * El papel y el acento DEL PÓSTER, no los del pase.
   *
   * Son campos aparte porque el papel y la pantalla no se leen igual:
   * el navy que se ve bien en el teléfono sale casi negro en una
   * inyección de tinta, y el negocio necesita poder corregirlo sin
   * cambiarle el color a la tarjeta de todos sus clientes.
   */
  colorFondo: string;
  colorAcento: string;
};

/**
 * Los topes de cada texto.
 *
 * No son gusto: la hoja es A4 y todo se mide contra su ancho. Un
 * título de 300 caracteres no "se ve feo", empuja el QR fuera de la
 * hoja y el recorte es MUDO — `overflow: hidden` no avisa. El número
 * sale de que el título más largo de las plantillas ronda los 30.
 */
export const TOPES_POSTER = { titulo: 56, invitacion: 48, paso: 80 } as const;

/** El título entra en dos líneas; la tercera ya no cabe en ningún estilo. */
export const LINEAS_TITULO = 2;

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Con qué arranca el personalizado: la plantilla, ya escrita. */
export function configPosterPorDefecto(
  tipo: string | null | undefined,
  acento: string,
): ConfigPoster {
  const copy = copyDelPoster(tipo);
  return {
    base: "minimalista",
    titulo: copy.titulo,
    invitacion: copy.invitacion,
    pasos: [copy.pasos[0], copy.pasos[1], copy.pasos[2]],
    mostrarPasos: true,
    mostrarPremio: true,
    mostrarPie: true,
    // Papel blanco de arranque, no el color del pase: es el que
    // imprime igual en cualquier impresora y el que menos tinta gasta.
    colorFondo: "#ffffff",
    colorAcento: HEX.test(acento) ? acento : "#f39200",
  };
}

/**
 * El jsonb de la base → una config utilizable.
 *
 * Nada de esto puede tirar la pantalla: el valor llega de una columna
 * jsonb sin forma garantizada (`{}` es su default, y una versión vieja
 * pudo guardar otras claves). Campo por campo, lo que no sirve cae al
 * de la plantilla.
 *
 * Acá se RECORTA en vez de rechazar —al revés que al guardar—: un
 * texto largo que ya está en la base es un póster que hay que dibujar
 * igual, no un error que mostrarle a quien solo quería imprimir.
 */
export function leerConfigPoster(
  crudo: unknown,
  tipo: string | null | undefined,
  acento: string,
): ConfigPoster {
  const base = configPosterPorDefecto(tipo, acento);
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return base;

  const o = crudo as Record<string, unknown>;
  const texto = (v: unknown, porDefecto: string, tope: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, tope) : porDefecto;
  const bandera = (v: unknown) => (typeof v === "boolean" ? v : true);
  const color = (v: unknown, porDefecto: string) =>
    typeof v === "string" && HEX.test(v) ? v : porDefecto;
  const pasos = Array.isArray(o.pasos) ? o.pasos : [];

  return {
    base: esEstiloPlantilla(o.base) ? o.base : base.base,
    titulo: texto(o.titulo, base.titulo, TOPES_POSTER.titulo),
    invitacion: texto(o.invitacion, base.invitacion, TOPES_POSTER.invitacion),
    pasos: [
      texto(pasos[0], base.pasos[0], TOPES_POSTER.paso),
      texto(pasos[1], base.pasos[1], TOPES_POSTER.paso),
      texto(pasos[2], base.pasos[2], TOPES_POSTER.paso),
    ],
    mostrarPasos: bandera(o.mostrarPasos),
    mostrarPremio: bandera(o.mostrarPremio),
    mostrarPie: bandera(o.mostrarPie),
    colorFondo: color(o.colorFondo, base.colorFondo),
    colorAcento: color(o.colorAcento, base.colorAcento),
  };
}

/**
 * ¿Se puede guardar? Devuelve el motivo en palabras del negocio, o
 * null si está bien.
 *
 * Corre en el SERVIDOR antes de escribir: el formulario avisa mientras
 * se escribe, pero no autoriza nada — una petición armada a mano no
 * pasa por él.
 */
export function validarConfigPoster(config: ConfigPoster): string | null {
  if (!esEstiloPlantilla(config.base)) {
    return "Elegí de cuál de los cinco diseños arranca tu póster.";
  }

  const titulo = config.titulo.trim();
  if (!titulo) return "El título no puede quedar vacío: es lo que se lee desde lejos.";
  if (titulo.length > TOPES_POSTER.titulo) {
    return `El título no puede pasar de ${TOPES_POSTER.titulo} caracteres, o se sale de la hoja.`;
  }
  if (titulo.split("\n").length > LINEAS_TITULO) {
    return `El título entra en ${LINEAS_TITULO} líneas como máximo.`;
  }

  const invitacion = config.invitacion.trim();
  if (!invitacion) return "La línea bajo el QR no puede quedar vacía.";
  if (invitacion.length > TOPES_POSTER.invitacion) {
    return `La línea bajo el QR no puede pasar de ${TOPES_POSTER.invitacion} caracteres.`;
  }

  // Se validan los tres SIEMPRE, estén mostrándose o no: apagar los
  // pasos no borra lo escrito, y el día que se vuelvan a prender tiene
  // que entrar en la hoja igual.
  for (let i = 0; i < config.pasos.length; i++) {
    const paso = config.pasos[i].trim();
    if (!paso) return `El paso ${i + 1} no puede quedar vacío.`;
    if (paso.length > TOPES_POSTER.paso) {
      return `El paso ${i + 1} no puede pasar de ${TOPES_POSTER.paso} caracteres.`;
    }
  }

  if (!HEX.test(config.colorFondo)) return "El color del papel tiene que ser un #RRGGBB.";
  if (!HEX.test(config.colorAcento)) return "El color de acento tiene que ser un #RRGGBB.";
  return null;
}

/**
 * La tinta que se lee sobre este papel.
 *
 * Sin esto, el negocio elige un fondo oscuro y el texto —negro por
 * defecto en cuatro de las cinco plantillas— desaparece. La fórmula es
 * el brillo percibido (YIQ): el ojo pesa el verde mucho más que el
 * azul, así que un azul oscuro y un verde oscuro NO piden la misma
 * tinta aunque su promedio RGB sea el mismo.
 */
export function paletaSobre(fondo: string): { tinta: string; suave: string } {
  const oscura = { tinta: "#101828", suave: "rgba(16, 24, 40, 0.62)" };
  const clara = { tinta: "#ffffff", suave: "rgba(255, 255, 255, 0.72)" };
  if (!HEX.test(fondo)) return oscura;

  const n = parseInt(fondo.slice(1), 16);
  const brillo = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  // 140 y no el 128 de manual: en papel la tinta oscura aguanta fondos
  // bastante más claros que en pantalla, y el verde puro (149.7) cae
  // justo en el borde — con 128 quedaba texto blanco sobre verde flúor.
  return brillo > 140 ? oscura : clara;
}

/** Lo que la hoja DICE, venga de la plantilla o de lo que el dueño escribió. */
export type ContenidoPoster = {
  titulo: string;
  invitacion: string;
  pasos: readonly string[];
  mostrarPasos: boolean;
  mostrarPremio: boolean;
  mostrarPie: boolean;
};

/**
 * Resuelve el contenido de la hoja en un solo lugar.
 *
 * Que el componente no elija entre «lo de la plantilla» y «lo del
 * dueño» es a propósito: esa decisión, repartida en seis `if` dentro
 * del JSX, es donde se cuela el póster que muestra el texto viejo.
 */
export function contenidoDelPoster(
  estilo: EstiloPoster,
  tipo: string | null | undefined,
  config: ConfigPoster | null,
): ContenidoPoster {
  if (estilo === "personalizado" && config) {
    return {
      titulo: config.titulo,
      invitacion: config.invitacion,
      pasos: config.pasos,
      mostrarPasos: config.mostrarPasos,
      mostrarPremio: config.mostrarPremio,
      mostrarPie: config.mostrarPie,
    };
  }
  const copy = copyDelPoster(tipo);
  return {
    titulo: copy.titulo,
    invitacion: copy.invitacion,
    pasos: copy.pasos,
    mostrarPasos: true,
    mostrarPremio: true,
    mostrarPie: true,
  };
}

/**
 * Los colores de la hoja, como variables CSS.
 *
 * Van en variables y no en `background` directo porque cada estilo usa
 * los colores del negocio de una forma distinta —el audaz inunda la
 * hoja, el minimalista solo pinta un detalle—, y un `style` inline con
 * el fondo le habría ganado siempre al CSS del estilo.
 */
export function variablesDePoster(
  colores: { fondo: string; acento: string },
  config: ConfigPoster | null,
): Record<string, string> {
  const base: Record<string, string> = {
    "--poster-marca": colores.fondo,
    "--poster-acento": colores.acento,
  };
  if (!config) return base;

  const { tinta, suave } = paletaSobre(config.colorFondo);
  return {
    ...base,
    "--poster-acento": config.colorAcento,
    "--poster-papel": config.colorFondo,
    "--poster-tinta": tinta,
    "--poster-suave": suave,
  };
}
