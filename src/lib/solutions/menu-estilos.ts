import type { Fuente } from "./temas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS DISEÑOS DEL MENÚ — el catálogo es una carta, no una lista
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (8 sep 2026): «el link hub es para links; el menú
 * que sea aparte, un cuadro que se pone en el link hub, con catálogos
 * bien profesionales y bien diseñados. El plan básico, uno o dos
 * diseños; el Pro, veinte o veinticinco, elegantes».
 *
 * ── POR QUÉ ES UNA TABLA DE FICHAS Y NO 25 PLANTILLAS ───────────────
 * Veintiséis archivos con su propio HTML serían veintiséis lugares
 * donde arreglar el carrito, los idiomas, la ficha nutricional y los
 * alérgenos. Lo que de verdad distingue a una carta de otra es un
 * puñado de decisiones —cómo se apilan los platos, si hay foto y de
 * qué forma, con qué letra, dónde cae el precio, qué separa un plato
 * del siguiente y sobre qué papel está impresa—, así que cada diseño
 * es una COMBINACIÓN de esas decisiones y el renderizador es uno solo.
 * Agregar el diseño 27 es agregar una fila acá.
 *
 * ── DE DÓNDE SALEN LOS DISEÑOS ──────────────────────────────────────
 * De cómo se imprimen las cartas de verdad: la guía de puntos del
 * bistró, las dos columnas de la trattoria, la pizarra de la cantina,
 * el papel de estraza de la panadería, la cuadrícula de fotos de las
 * apps de delivery, la revista de los hoteles. Cada uno trae el papel
 * y la letra que le corresponden — un menú de sushi con la serif del
 * mantel largo no se ve como un menú de sushi.
 *
 * ── EL PLAN ─────────────────────────────────────────────────────────
 * Dos diseños en Gratis (`ESTILOS_MENU_GRATIS`) y los veinticuatro
 * restantes en Pro. Quien baja de plan no pierde el menú: el servidor
 * lo devuelve a «clasico` al guardar (`sanearParaPlan`, planes.ts).
 *
 * ── DÓNDE SE GUARDA ─────────────────────────────────────────────────
 * En `diseno.menu` (el jsonb de la 0232). No hace falta migración: el
 * jsonb ya está y `disenoDe` tolera lo que no conoce.
 */

export const ESTILOS_MENU = [
  // Gratis
  "clasico",
  "carta",
  // Pro
  "bistro",
  "trattoria",
  "bruma",
  "pizarron",
  "terracota",
  "marmol",
  "editorial",
  "vitrina",
  "reparto",
  "cafeteria",
  "tinta",
  "cantina",
  "jardin",
  "nocturno",
  "panaderia",
  "boutique",
  "barra",
  "cinta",
  "mosaico",
  "galeria",
  "riviera",
  "mercado",
  "kiosco",
  "atelier",
] as const;

export type EstiloMenu = (typeof ESTILOS_MENU)[number];

/** Cómo se apilan los platos. El renderizador tiene una rama por cada una. */
export type Disposicion =
  /** Renglones con foto chica a un lado. La de siempre. */
  | "lista"
  /** Nombre … puntos … precio. Sin foto: la carta impresa. */
  | "guia"
  /** Una tarjeta por plato, con la foto arriba. */
  | "tarjetas"
  /** Cuadrícula de fotos. */
  | "cuadricula"
  /** Foto ancha y el texto debajo, como una revista. */
  | "revista"
  /** Dos columnas de texto, como una carta impresa. */
  | "columnas";

/** Qué se hace con la foto del plato. */
export type FotoMenu = "ninguna" | "chica" | "cuadrada" | "circular" | "grande" | "ancha";

/** Dónde cae el precio. */
export type PrecioMenu = "derecha" | "bajo" | "pildora" | "puntos";

/** Qué separa un plato del siguiente. */
export type SeparadorMenu = "ninguno" | "linea" | "puntos" | "filete" | "tarjeta";

/** Cómo se anuncian las secciones («Entradas», «Postres»). */
export type TituloSeccion = "versalitas" | "serif" | "alta" | "normal" | "centrado";

/** El papel: null = hereda los colores del tema de la página. */
export type PapelMenu = {
  fondo: string;
  tinta: string;
  suave: string;
  superficie: string;
  borde: string;
  acento: string;
  /** El texto que va ENCIMA del acento (píldoras de precio, botones). */
  sobreAcento: string;
};

export type DefEstiloMenu = {
  nombre: string;
  /** Una línea para el editor: qué es y para qué local. */
  pie: string;
  pro: boolean;
  disposicion: Disposicion;
  foto: FotoMenu;
  fuente: Fuente;
  titulo: TituloSeccion;
  separador: SeparadorMenu;
  precio: PrecioMenu;
  /** 1 · 2 · 3 columnas en cuadrícula y mosaico. */
  columnas: 1 | 2 | 3;
  aire: "compacto" | "normal" | "amplio";
  /** Bordes: cuánto se redondea. */
  radio: "recto" | "suave" | "redondo";
  /** null = el papel del tema que ya eligió el negocio. */
  papel: PapelMenu | null;
};

// ── Los papeles, aparte: varios diseños comparten el mismo ─────────

const CREMA: PapelMenu = {
  fondo: "#FBF7F0",
  tinta: "#241F18",
  suave: "#6E6355",
  superficie: "#FFFFFF",
  borde: "#E6DCCB",
  acento: "#8C6A3F",
  sobreAcento: "#FFFFFF",
};

const CARBON: PapelMenu = {
  fondo: "#15171B",
  tinta: "#F3F0EA",
  suave: "#A2A8B2",
  superficie: "#1D2026",
  borde: "#2C3138",
  acento: "#E4B363",
  sobreAcento: "#15171B",
};

const MARMOL: PapelMenu = {
  fondo: "#F7F7F5",
  tinta: "#1A1A1A",
  suave: "#767676",
  superficie: "#FFFFFF",
  borde: "#E4E4E1",
  acento: "#1A1A1A",
  sobreAcento: "#FFFFFF",
};

const NOCTURNO: PapelMenu = {
  fondo: "#0F1020",
  tinta: "#F5F2EB",
  suave: "#9C9AB0",
  superficie: "#181A33",
  borde: "#2A2C4A",
  acento: "#D4AF6A",
  sobreAcento: "#0F1020",
};

const OLIVA: PapelMenu = {
  fondo: "#F3F5EE",
  tinta: "#1F2A1C",
  suave: "#5D6B57",
  superficie: "#FFFFFF",
  borde: "#DCE4D2",
  acento: "#4A7C59",
  sobreAcento: "#FFFFFF",
};

const TERRACOTA: PapelMenu = {
  fondo: "#FCF4EF",
  tinta: "#33211A",
  suave: "#7B6157",
  superficie: "#FFFFFF",
  borde: "#EEDCD1",
  acento: "#C1663F",
  sobreAcento: "#FFFFFF",
};

const ESTRAZA: PapelMenu = {
  fondo: "#E9DDC9",
  tinta: "#3A2E1F",
  suave: "#6E5D46",
  superficie: "#F3EADA",
  borde: "#D3C3A7",
  acento: "#7A5C2E",
  sobreAcento: "#F3EADA",
};

const RIVIERA: PapelMenu = {
  fondo: "#F4F8FB",
  tinta: "#10263A",
  suave: "#5A7186",
  superficie: "#FFFFFF",
  borde: "#D8E3ED",
  acento: "#1B5E8C",
  sobreAcento: "#FFFFFF",
};

const TINTA: PapelMenu = {
  fondo: "#FAF9F7",
  tinta: "#111111",
  suave: "#6B6B6B",
  superficie: "#FFFFFF",
  borde: "#E2E0DC",
  acento: "#B3202C",
  sobreAcento: "#FFFFFF",
};

const NEON: PapelMenu = {
  fondo: "#0B0B0B",
  tinta: "#FFFFFF",
  suave: "#A0A0A0",
  superficie: "#151515",
  borde: "#2A2A2A",
  acento: "#C7F24E",
  sobreAcento: "#0B0B0B",
};

const PASTEL: PapelMenu = {
  fondo: "#FFF8F3",
  tinta: "#3B2F2A",
  suave: "#8A756B",
  superficie: "#FFFFFF",
  borde: "#F1E2D8",
  acento: "#D98E73",
  sobreAcento: "#FFFFFF",
};

/**
 * CÓMO ENTRA LA FOTO DE ARRIBA en el catálogo (9 sep 2026).
 *
 * Pedido del dueño: «la imagen de arriba, si va a ser en un card, si va
 * a ser toda la imagen, si va a ser una portada, si va a ser una parte
 * con un degradado». Son cuatro tratamientos distintos de la MISMA foto
 * de portada del negocio, no cuatro fotos.
 */
export const PORTADAS_MENU = ["tarjeta", "completa", "degradado", "sin"] as const;
export type PortadaMenu = (typeof PORTADAS_MENU)[number];

export const PORTADA_MENU: Record<PortadaMenu, { nombre: string; pie: string }> = {
  tarjeta: { nombre: "Tarjeta", pie: "Recortada, con esquinas redondas" },
  completa: { nombre: "Completa", pie: "De borde a borde, con el título encima" },
  degradado: { nombre: "Degradado", pie: "Se funde con el fondo de la página" },
  sin: { nombre: "Sin foto", pie: "Solo el título; la carta empieza arriba" },
};

/**
 * ════════════════════════════════════════════════════════════════════
 *  CINCO TEMAS, Y TODO LO DEMÁS SUELTO (9 sep 2026)
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño: «que dé cinco temas de colores y lo demás que sea
 * cien por ciento customizable: colores, letras, tipos de fuente,
 * tamaños».
 *
 * Los 26 diseños de arriba NO se van: pasan a ser PLANTILLAS. Tocar una
 * llena los ajustes de una vez —papel, letra, disposición, separador— y
 * desde ahí el negocio cambia lo que quiera. Es la diferencia entre un
 * molde y una camisa de fuerza: la carta buena de un bistró sigue a un
 * toque, pero nadie queda encerrado en ella.
 *
 * El TEMA solo pone colores. Todo lo demás son campos propios.
 */
export const TEMAS_MENU = ["papel", "carbon", "marmol", "terracota", "jardin"] as const;
export type TemaMenu = (typeof TEMAS_MENU)[number];

export const TEMA_MENU: Record<TemaMenu, { nombre: string; pie: string; papel: PapelMenu }> = {
  papel: { nombre: "Papel", pie: "Crema cálido, tinta café", papel: CREMA },
  carbon: { nombre: "Carbón", pie: "Negro con dorado", papel: CARBON },
  marmol: { nombre: "Mármol", pie: "Blanco y negro, sin adorno", papel: MARMOL },
  terracota: { nombre: "Terracota", pie: "Tierra y naranja quemado", papel: TERRACOTA },
  jardin: { nombre: "Jardín", pie: "Verde fresco sobre hueso", papel: OLIVA },
};

export function temaMenuDe(v: unknown): TemaMenu {
  return (TEMAS_MENU as readonly unknown[]).includes(v) ? (v as TemaMenu) : "papel";
}

/** El tamaño de la letra del catálogo, como multiplicador. */
export const TAMANOS_MENU = ["chico", "normal", "grande", "enorme"] as const;
export type TamanoMenu = (typeof TAMANOS_MENU)[number];
export const ESCALA_MENU: Record<TamanoMenu, number> = {
  chico: 0.9,
  normal: 1,
  grande: 1.15,
  enorme: 1.32,
};
export const TAMANO_MENU: Record<TamanoMenu, string> = {
  chico: "Chica",
  normal: "Normal",
  grande: "Grande",
  enorme: "Enorme",
};

export function portadaMenuDe(v: unknown): PortadaMenu {
  return (PORTADAS_MENU as readonly unknown[]).includes(v) ? (v as PortadaMenu) : "tarjeta";
}

/** La letra del catálogo: «auto» = la que trae el diseño elegido. */
export type FuenteMenu = Fuente | "auto";

export function fuenteMenuDe(v: unknown, fuentes: readonly string[]): FuenteMenu {
  return v === "auto" || fuentes.includes(String(v)) ? (v as FuenteMenu) : "auto";
}

export const ESTILO_MENU_BASE: EstiloMenu = "clasico";

/** Los dos que entran en el plan Gratis. */
export const ESTILOS_MENU_GRATIS: readonly EstiloMenu[] = ["clasico", "carta"];

export const ESTILO_MENU: Record<EstiloMenu, DefEstiloMenu> = {
  // ── GRATIS ───────────────────────────────────────────────────────
  clasico: {
    nombre: "Clásico",
    pie: "Renglón con foto chica. El de siempre, con los colores de tu página",
    pro: false,
    disposicion: "lista",
    foto: "chica",
    fuente: "sistema",
    titulo: "versalitas",
    separador: "tarjeta",
    precio: "derecha",
    columnas: 1,
    aire: "normal",
    radio: "suave",
    papel: null,
  },
  carta: {
    nombre: "Carta",
    pie: "Nombre, puntos y precio. Sin fotos, como una carta impresa",
    pro: false,
    disposicion: "guia",
    foto: "ninguna",
    fuente: "sistema",
    titulo: "centrado",
    separador: "puntos",
    precio: "puntos",
    columnas: 1,
    aire: "normal",
    radio: "suave",
    papel: null,
  },

  // ── PRO ──────────────────────────────────────────────────────────
  bistro: {
    nombre: "Bistró",
    pie: "Serif de mantel largo sobre papel crema. Restaurante de autor",
    pro: true,
    disposicion: "guia",
    foto: "ninguna",
    fuente: "elegante",
    titulo: "centrado",
    separador: "puntos",
    precio: "puntos",
    columnas: 1,
    aire: "amplio",
    radio: "recto",
    papel: CREMA,
  },
  trattoria: {
    nombre: "Trattoria",
    pie: "Dos columnas y filete doble. Cartas largas de cocina italiana",
    pro: true,
    disposicion: "columnas",
    foto: "ninguna",
    fuente: "editorial",
    titulo: "serif",
    separador: "filete",
    precio: "derecha",
    columnas: 2,
    aire: "compacto",
    radio: "recto",
    papel: CREMA,
  },
  bruma: {
    nombre: "Bruma",
    pie: "Mucho aire, letra fina, cero adorno. Minimalismo de galería",
    pro: true,
    disposicion: "guia",
    foto: "ninguna",
    fuente: "sistema",
    titulo: "normal",
    separador: "ninguno",
    precio: "derecha",
    columnas: 1,
    aire: "amplio",
    radio: "recto",
    papel: MARMOL,
  },
  pizarron: {
    nombre: "Pizarrón",
    pie: "Condensada en mayúsculas sobre negro. Bares y food trucks",
    pro: true,
    disposicion: "guia",
    foto: "ninguna",
    fuente: "condensada",
    titulo: "alta",
    separador: "linea",
    precio: "derecha",
    columnas: 1,
    aire: "compacto",
    radio: "recto",
    papel: CARBON,
  },
  terracota: {
    nombre: "Terracota",
    pie: "Tarjetas cálidas con foto cuadrada. Cocina de mercado",
    pro: true,
    disposicion: "lista",
    foto: "cuadrada",
    fuente: "editorial",
    titulo: "versalitas",
    separador: "tarjeta",
    precio: "derecha",
    columnas: 1,
    aire: "normal",
    radio: "suave",
    papel: TERRACOTA,
  },
  marmol: {
    nombre: "Mármol",
    pie: "Blanco, foto redonda y línea fina. Pastelería y alta cocina",
    pro: true,
    disposicion: "lista",
    foto: "circular",
    fuente: "elegante",
    titulo: "centrado",
    separador: "linea",
    precio: "derecha",
    columnas: 1,
    aire: "amplio",
    radio: "redondo",
    papel: MARMOL,
  },
  editorial: {
    nombre: "Editorial",
    pie: "Foto ancha y titular grande. Cada plato, una página de revista",
    pro: true,
    disposicion: "revista",
    foto: "ancha",
    fuente: "editorial",
    titulo: "serif",
    separador: "ninguno",
    precio: "bajo",
    columnas: 1,
    aire: "amplio",
    radio: "suave",
    papel: CREMA,
  },
  vitrina: {
    nombre: "Vitrina",
    pie: "Cuadrícula de dos fotos grandes. Todo entra por los ojos",
    pro: true,
    disposicion: "cuadricula",
    foto: "grande",
    fuente: "redonda",
    titulo: "versalitas",
    separador: "tarjeta",
    precio: "bajo",
    columnas: 2,
    aire: "normal",
    radio: "suave",
    papel: null,
  },
  reparto: {
    nombre: "Reparto",
    pie: "Tarjeta ancha con foto grande y precio en píldora. Estilo app",
    pro: true,
    disposicion: "tarjetas",
    foto: "grande",
    fuente: "redonda",
    titulo: "normal",
    separador: "tarjeta",
    precio: "pildora",
    columnas: 1,
    aire: "normal",
    radio: "redondo",
    papel: null,
  },
  cafeteria: {
    nombre: "Cafetería",
    pie: "Compacta y amable, en tonos leche. Cafés de barrio",
    pro: true,
    disposicion: "lista",
    foto: "circular",
    fuente: "redonda",
    titulo: "versalitas",
    separador: "linea",
    precio: "derecha",
    columnas: 1,
    aire: "compacto",
    radio: "redondo",
    papel: PASTEL,
  },
  tinta: {
    nombre: "Tinta",
    pie: "Negro sobre hueso con un acento rojo. Sushi y cocina de barra",
    pro: true,
    disposicion: "guia",
    foto: "ninguna",
    fuente: "sistema",
    titulo: "alta",
    separador: "linea",
    precio: "derecha",
    columnas: 1,
    aire: "normal",
    radio: "recto",
    papel: TINTA,
  },
  cantina: {
    nombre: "Cantina",
    pie: "Mayúsculas condensadas y precio en píldora. Bar de tragos",
    pro: true,
    disposicion: "lista",
    foto: "cuadrada",
    fuente: "condensada",
    titulo: "alta",
    separador: "linea",
    precio: "pildora",
    columnas: 1,
    aire: "compacto",
    radio: "recto",
    papel: CARBON,
  },
  jardin: {
    nombre: "Jardín",
    pie: "Verde, foto redonda y serif suave. Cocina fresca y saludable",
    pro: true,
    disposicion: "lista",
    foto: "circular",
    fuente: "editorial",
    titulo: "versalitas",
    separador: "linea",
    precio: "derecha",
    columnas: 1,
    aire: "normal",
    radio: "redondo",
    papel: OLIVA,
  },
  nocturno: {
    nombre: "Nocturno",
    pie: "Azul de noche con dorado. Cenas, hoteles y celebración",
    pro: true,
    disposicion: "guia",
    foto: "ninguna",
    fuente: "elegante",
    titulo: "centrado",
    separador: "puntos",
    precio: "puntos",
    columnas: 1,
    aire: "amplio",
    radio: "recto",
    papel: NOCTURNO,
  },
  panaderia: {
    nombre: "Panadería",
    pie: "Papel de estraza y tinta marrón. Panaderías y tostadurías",
    pro: true,
    disposicion: "columnas",
    foto: "ninguna",
    fuente: "condensada",
    titulo: "alta",
    separador: "puntos",
    precio: "puntos",
    columnas: 2,
    aire: "compacto",
    radio: "recto",
    papel: ESTRAZA,
  },
  boutique: {
    nombre: "Boutique",
    pie: "Cuadrícula de producto con el precio debajo. Tiendas y retail",
    pro: true,
    disposicion: "cuadricula",
    foto: "grande",
    fuente: "sistema",
    titulo: "normal",
    separador: "ninguno",
    precio: "bajo",
    columnas: 2,
    aire: "normal",
    radio: "recto",
    papel: MARMOL,
  },
  barra: {
    nombre: "Barra",
    pie: "Dos columnas técnicas y apretadas. Cafés de especialidad",
    pro: true,
    disposicion: "columnas",
    foto: "ninguna",
    fuente: "tecnica",
    titulo: "alta",
    separador: "linea",
    precio: "derecha",
    columnas: 2,
    aire: "compacto",
    radio: "recto",
    papel: null,
  },
  cinta: {
    nombre: "Cinta",
    pie: "El precio en una cinta de color a la derecha. Promociones",
    pro: true,
    disposicion: "lista",
    foto: "cuadrada",
    fuente: "redonda",
    titulo: "versalitas",
    separador: "tarjeta",
    precio: "pildora",
    columnas: 1,
    aire: "normal",
    radio: "suave",
    papel: null,
  },
  mosaico: {
    nombre: "Mosaico",
    pie: "Tres fotos por fila, cartas largas de un vistazo",
    pro: true,
    disposicion: "cuadricula",
    foto: "cuadrada",
    fuente: "sistema",
    titulo: "versalitas",
    separador: "ninguno",
    precio: "bajo",
    columnas: 3,
    aire: "compacto",
    radio: "suave",
    papel: null,
  },
  galeria: {
    nombre: "Galería",
    pie: "Foto a sangre con el nombre encima. Para fotos que lucen",
    pro: true,
    disposicion: "revista",
    foto: "ancha",
    fuente: "condensada",
    titulo: "alta",
    separador: "ninguno",
    precio: "pildora",
    columnas: 1,
    aire: "normal",
    radio: "suave",
    papel: CARBON,
  },
  riviera: {
    nombre: "Riviera",
    pie: "Azul y crema con filete. Marisquerías y cocina de costa",
    pro: true,
    disposicion: "guia",
    foto: "ninguna",
    fuente: "editorial",
    titulo: "centrado",
    separador: "filete",
    precio: "puntos",
    columnas: 1,
    aire: "normal",
    radio: "recto",
    papel: RIVIERA,
  },
  mercado: {
    nombre: "Mercado",
    pie: "Precio grande y letra fuerte. Sodas, ferias y comida rápida",
    pro: true,
    disposicion: "lista",
    foto: "cuadrada",
    fuente: "redonda",
    titulo: "alta",
    separador: "linea",
    precio: "derecha",
    columnas: 1,
    aire: "compacto",
    radio: "suave",
    papel: null,
  },
  kiosco: {
    nombre: "Kiosco",
    pie: "Negro con acento lima y esquinas rectas. Alto contraste",
    pro: true,
    disposicion: "tarjetas",
    foto: "grande",
    fuente: "tecnica",
    titulo: "alta",
    separador: "tarjeta",
    precio: "pildora",
    columnas: 1,
    aire: "normal",
    radio: "recto",
    papel: NEON,
  },
  atelier: {
    nombre: "Atelier",
    pie: "Foto redonda, mucho aire y serif fina. Catálogos de autor",
    pro: true,
    disposicion: "revista",
    foto: "circular",
    fuente: "elegante",
    titulo: "centrado",
    separador: "ninguno",
    precio: "bajo",
    columnas: 1,
    aire: "amplio",
    radio: "redondo",
    papel: MARMOL,
  },
};

/** Lo guardado → un estilo que existe. Lo desconocido cae en el base. */
export function estiloMenuDe(v: unknown): EstiloMenu {
  return (ESTILOS_MENU as readonly unknown[]).includes(v) ? (v as EstiloMenu) : ESTILO_MENU_BASE;
}

/** ¿Este estilo lo puede usar quien no paga? */
export function estiloMenuGratis(id: EstiloMenu): boolean {
  return ESTILOS_MENU_GRATIS.includes(id);
}

/** El estilo que le corresponde a un plan: Pro elige, Gratis se ajusta. */
export function estiloMenuParaPlan(id: EstiloMenu, pro: boolean): EstiloMenu {
  return pro || estiloMenuGratis(id) ? id : ESTILO_MENU_BASE;
}

/** Cuántos diseños ofrece cada plan — para los textos del editor. */
export const CUANTOS_ESTILOS_MENU = {
  gratis: ESTILOS_MENU_GRATIS.length,
  pro: ESTILOS_MENU.length,
} as const;

// ════════════════════════════════════════════════════════════════════
//  LOS AJUSTES DEL CATÁLOGO — lo que el negocio de verdad guarda
// ════════════════════════════════════════════════════════════════════
//
// Un objeto plano con TODO lo que se puede tocar. Vive en
// `diseno.menuAjustes` (jsonb de la 0232: sin migración) y el
// renderizador no lo conoce — `estiloDeAjustes` lo traduce a la misma
// `DefEstiloMenu` de siempre. Así el catálogo se pinta con un solo
// camino, venga de una plantilla o de una carta armada a mano.

export type AjustesMenu = {
  /** La plantilla de la que salió, solo para poder decir su nombre. */
  plantilla: EstiloMenu;
  tema: TemaMenu;
  /** Colores propios; vacío = el del tema. Ganan sobre el tema. */
  fondo: string;
  tinta: string;
  acento: string;
  fuente: FuenteMenu;
  tamano: TamanoMenu;
  disposicion: Disposicion;
  foto: FotoMenu;
  separador: SeparadorMenu;
  precio: PrecioMenu;
  titulo: TituloSeccion;
  aire: DefEstiloMenu["aire"];
  radio: DefEstiloMenu["radio"];
  columnas: 1 | 2 | 3;
  portada: PortadaMenu;
};

const DISPOSICIONES: readonly Disposicion[] = ["lista", "guia", "tarjetas", "cuadricula", "revista", "columnas"];
const FOTOS: readonly FotoMenu[] = ["ninguna", "chica", "cuadrada", "circular", "grande", "ancha"];
const SEPARADORES: readonly SeparadorMenu[] = ["ninguno", "linea", "puntos", "filete", "tarjeta"];
const PRECIOS: readonly PrecioMenu[] = ["derecha", "bajo", "pildora", "puntos"];
const TITULOS: readonly TituloSeccion[] = ["versalitas", "serif", "alta", "normal", "centrado"];
const AIRES = ["compacto", "normal", "amplio"] as const;
const RADIOS = ["recto", "suave", "redondo"] as const;

/** Cómo se llama cada opción en el editor. */
export const ROTULO_MENU = {
  disposicion: {
    lista: "Renglones",
    guia: "Carta con puntos",
    tarjetas: "Tarjetas",
    cuadricula: "Cuadrícula",
    revista: "Revista",
    columnas: "Dos columnas",
  } as Record<Disposicion, string>,
  foto: {
    ninguna: "Sin foto",
    chica: "Chica",
    cuadrada: "Cuadrada",
    circular: "Redonda",
    grande: "Grande",
    ancha: "Ancha",
  } as Record<FotoMenu, string>,
  separador: {
    ninguno: "Nada",
    linea: "Línea",
    puntos: "Puntos",
    filete: "Filete",
    tarjeta: "Tarjeta",
  } as Record<SeparadorMenu, string>,
  precio: {
    derecha: "A la derecha",
    bajo: "Debajo",
    pildora: "En píldora",
    puntos: "Al final de los puntos",
  } as Record<PrecioMenu, string>,
  titulo: {
    versalitas: "Versalitas",
    serif: "Serif grande",
    alta: "Mayúsculas",
    normal: "Normal",
    centrado: "Centrado",
  } as Record<TituloSeccion, string>,
  aire: { compacto: "Apretado", normal: "Normal", amplio: "Aireado" } as Record<DefEstiloMenu["aire"], string>,
  radio: { recto: "Rectas", suave: "Suaves", redondo: "Redondas" } as Record<DefEstiloMenu["radio"], string>,
} as const;

export const OPCIONES_MENU = {
  disposicion: DISPOSICIONES,
  foto: FOTOS,
  separador: SEPARADORES,
  precio: PRECIOS,
  titulo: TITULOS,
  aire: AIRES,
  radio: RADIOS,
} as const;

/** Los ajustes que salen de una plantilla: su ficha, tal cual. */
export function ajustesDePlantilla(id: EstiloMenu, previos?: Partial<AjustesMenu>): AjustesMenu {
  const def = ESTILO_MENU[id];
  // El tema que más se parece al papel de la plantilla; sin papel
  // propio, el que ya tenía el negocio.
  const tema =
    (Object.entries(TEMA_MENU).find(([, t]) => def.papel && t.papel.fondo === def.papel.fondo)?.[0] as
      | TemaMenu
      | undefined) ?? previos?.tema ?? "papel";
  return {
    plantilla: id,
    tema,
    // Una plantilla con papel propio manda su color; si no, se respeta
    // el que el negocio haya puesto a mano.
    fondo: def.papel?.fondo ?? previos?.fondo ?? "",
    tinta: def.papel?.tinta ?? previos?.tinta ?? "",
    acento: def.papel?.acento ?? previos?.acento ?? "",
    fuente: def.fuente,
    tamano: previos?.tamano ?? "normal",
    disposicion: def.disposicion,
    foto: def.foto,
    separador: def.separador,
    precio: def.precio,
    titulo: def.titulo,
    aire: def.aire,
    radio: def.radio,
    columnas: def.columnas,
    portada: previos?.portada ?? "tarjeta",
  };
}

export const AJUSTES_MENU_BASE: AjustesMenu = ajustesDePlantilla(ESTILO_MENU_BASE);

const unoDeLista = <T,>(lista: readonly T[], v: unknown, respaldo: T): T =>
  (lista as readonly unknown[]).includes(v) ? (v as T) : respaldo;

/** Un color #rrggbb, o vacío si no lo es. Lo que se pinta viene de acá. */
export function colorDe(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : "";
}

export function ajustesMenuDe(v: unknown, fuentes: readonly string[]): AjustesMenu {
  const d = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const base = AJUSTES_MENU_BASE;
  return {
    plantilla: estiloMenuDe(d.plantilla),
    tema: temaMenuDe(d.tema),
    fondo: colorDe(d.fondo),
    tinta: colorDe(d.tinta),
    acento: colorDe(d.acento),
    fuente: fuenteMenuDe(d.fuente, fuentes),
    tamano: unoDeLista(TAMANOS_MENU, d.tamano, base.tamano),
    disposicion: unoDeLista(DISPOSICIONES, d.disposicion, base.disposicion),
    foto: unoDeLista(FOTOS, d.foto, base.foto),
    separador: unoDeLista(SEPARADORES, d.separador, base.separador),
    precio: unoDeLista(PRECIOS, d.precio, base.precio),
    titulo: unoDeLista(TITULOS, d.titulo, base.titulo),
    aire: unoDeLista(AIRES, d.aire, base.aire),
    radio: unoDeLista(RADIOS, d.radio, base.radio),
    columnas: unoDeLista([1, 2, 3] as const, Number(d.columnas), base.columnas),
    portada: portadaMenuDe(d.portada),
  };
}

/**
 * De los ajustes a lo que el renderizador ya sabe pintar.
 *
 * El papel se arma en tres capas, y ese orden es el contrato: el TEMA
 * pone los cinco colores, los COLORES PROPIOS pisan los tres que el
 * negocio eligió, y las superficies (tarjetas, bordes, tinta suave) se
 * derivan del fondo y la tinta para que nunca queden peleadas con lo
 * que el dueño acaba de tocar.
 */
export function estiloDeAjustes(a: AjustesMenu): DefEstiloMenu {
  const base = TEMA_MENU[a.tema].papel;
  const fondo = a.fondo || base.fondo;
  const tinta = a.tinta || base.tinta;
  const acento = a.acento || base.acento;
  const oscuro = esOscuro(fondo);

  const papel: PapelMenu = {
    fondo,
    tinta,
    acento,
    // Sobre fondo oscuro la superficie ACLARA y sobre claro oscurece:
    // una tarjeta más clara que su papel en modo noche se lee como un
    // agujero de luz.
    superficie: mezclar(fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.08 : 0.04),
    borde: mezclar(fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.16 : 0.12),
    suave: mezclar(tinta, fondo, 0.42),
    sobreAcento: esOscuro(acento) ? "#ffffff" : "#101010",
  };

  return {
    nombre: ESTILO_MENU[a.plantilla].nombre,
    pie: ESTILO_MENU[a.plantilla].pie,
    pro: ESTILO_MENU[a.plantilla].pro,
    disposicion: a.disposicion,
    foto: a.foto,
    fuente: a.fuente === "auto" ? ESTILO_MENU[a.plantilla].fuente : a.fuente,
    titulo: a.titulo,
    separador: a.separador,
    precio: a.precio,
    columnas: a.columnas,
    aire: a.aire,
    radio: a.radio,
    papel,
  };
}

/** ¿Ese color es oscuro? Luminancia percibida, no el promedio. */
export function esOscuro(hex: string): boolean {
  const c = colorDe(hex) || "#ffffff";
  const n = (i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return 0.299 * n(0) + 0.587 * n(1) + 0.114 * n(2) < 140;
}

/** Dos colores mezclados, `p` de 0 a 1 hacia el segundo. */
export function mezclar(a: string, b: string, p: number): string {
  const x = colorDe(a) || "#ffffff";
  const y = colorDe(b) || "#000000";
  const n = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const dos = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${[0, 1, 2].map((i) => dos(n(x, i) * (1 - p) + n(y, i) * p)).join("")}`;
}
