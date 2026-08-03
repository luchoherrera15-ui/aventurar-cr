import type { Categoria, Provincia, Rancho } from "@/app/mi-negocio/types";
import type { Calificacion } from "@/components/rancho-card";

/**
 * Tipos del cotizador guiado ("¡Creá tu evento con IA!"): las
 * respuestas del wizard, las etapas de la barra de progreso y el
 * formato de los resultados que arma el motor.
 */

export const TIPOS_EVENTO = [
  { id: "boda", label: "Boda", emoji: "💍" },
  { id: "cumpleanos", label: "Cumpleaños", emoji: "🎂" },
  { id: "baby_shower", label: "Baby shower", emoji: "🍼" },
  { id: "gender_reveal", label: "Gender reveal", emoji: "🎈" },
  { id: "corporativo", label: "Corporativo", emoji: "💼" },
  { id: "graduacion", label: "Graduación", emoji: "🎓" },
  { id: "concierto", label: "Concierto", emoji: "🎤" },
  { id: "fiesta_privada", label: "Fiesta privada", emoji: "🎉" },
  { id: "otro", label: "Otro", emoji: "✨" },
] as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[number]["id"];

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = Object.fromEntries(
  TIPOS_EVENTO.map((t) => [t.id, t.label]),
) as Record<TipoEvento, string>;

export const ESTILOS = [
  { id: "elegante", label: "Elegante", emoji: "🥂" },
  { id: "moderno", label: "Moderno", emoji: "🏙️" },
  { id: "campestre", label: "Campestre", emoji: "🌿" },
  { id: "playa", label: "Playa", emoji: "🏖️" },
  { id: "minimalista", label: "Minimalista", emoji: "◽" },
  { id: "lujoso", label: "Lujoso", emoji: "💎" },
  { id: "familiar", label: "Familiar", emoji: "👨‍👩‍👧‍👦" },
  { id: "otro", label: "Otro", emoji: "🎨" },
] as const;

export type EstiloId = (typeof ESTILOS)[number]["id"];

/**
 * Un servicio que se puede pedir en el wizard, mapeado a la taxonomía
 * REAL del sitio (categorías y subcategorías de `mi-negocio/types`).
 * `subcategorias` vacío = toda la categoría califica (caso del salón:
 * cualquier "lugares" sirve).
 */
export type ServicioDef = {
  id: string;
  label: string;
  emoji: string;
  categoria: Categoria;
  subcategorias: string[];
  /** Solo los lugares reservan fecha en línea (calendario propio). */
  esLugar?: boolean;
};

export const SERVICIOS: ServicioDef[] = [
  { id: "salon", label: "Salón o lugar", emoji: "🏡", categoria: "lugares", subcategorias: [], esLugar: true },
  {
    id: "catering",
    label: "Catering / comida",
    emoji: "🍽️",
    categoria: "alimentacion",
    subcategorias: ["catering", "catering_infantil", "parrillada", "comidas_domicilio", "food_trucks"],
  },
  {
    id: "bebidas",
    label: "Barras y bebidas",
    emoji: "🍹",
    categoria: "alimentacion",
    subcategorias: [
      "bartender", "barra_cocteles", "bebidas_domicilio", "barra_cerveza",
      "barra_cafe", "barra_matcha", "barra_jugos",
    ],
  },
  {
    id: "dulces",
    label: "Queque y mesa dulce",
    emoji: "🎂",
    categoria: "alimentacion",
    subcategorias: ["queques", "mesas_dulces", "barra_helados", "barra_snacks"],
  },
  { id: "dj", label: "DJ y discomóvil", emoji: "🎧", categoria: "animacion", subcategorias: ["dj_discomovil"] },
  {
    id: "musica_vivo",
    label: "Música en vivo",
    emoji: "🎺",
    categoria: "animacion",
    subcategorias: ["grupos_musicales", "mariachis"],
  },
  {
    id: "animacion_infantil",
    label: "Animación infantil",
    emoji: "🤡",
    categoria: "animacion",
    subcategorias: ["animacion_infantil", "payasos_pintacaritas", "magos", "inflables", "animadores"],
  },
  {
    id: "fotografia",
    label: "Fotografía y video",
    emoji: "📸",
    categoria: "organizacion",
    subcategorias: ["fotografos", "produccion_audiovisual", "photo_booth"],
  },
  {
    id: "decoracion",
    label: "Decoración",
    emoji: "🎀",
    categoria: "decoracion",
    subcategorias: ["decoracion_eventos", "decoracion_infantil", "floristerias"],
  },
  {
    id: "mobiliario",
    label: "Sillas, mesas y equipo",
    emoji: "🪑",
    categoria: "decoracion",
    subcategorias: ["sillas_mesas", "manteles", "equipo_eventos", "tarimas", "graderias"],
  },
  { id: "iluminacion", label: "Luces y sonido", emoji: "💡", categoria: "animacion", subcategorias: ["luces_sonido"] },
  { id: "carpas", label: "Toldos y carpas", emoji: "⛺", categoria: "decoracion", subcategorias: ["toldos"] },
  {
    id: "wedding_planner",
    label: "Wedding planner",
    emoji: "📋",
    categoria: "organizacion",
    subcategorias: ["wedding_planner", "organizacion_eventos"],
  },
  { id: "transporte", label: "Transporte", emoji: "🚌", categoria: "otros", subcategorias: ["transporte"] },
  { id: "seguridad", label: "Seguridad", emoji: "🛡️", categoria: "otros", subcategorias: ["seguridad"] },
  { id: "sanitarios", label: "Baños portátiles", emoji: "🚻", categoria: "otros", subcategorias: ["banos_portatiles"] },
];

export const SERVICIO_POR_ID: Record<string, ServicioDef> = Object.fromEntries(
  SERVICIOS.map((s) => [s.id, s]),
);

/** Lo que el usuario va contestando pantalla por pantalla. */
export type RespuestasPlanificador = {
  tipoEvento: TipoEvento | null;
  /** YYYY-MM-DD, o null si todavía no tiene fecha. */
  fecha: string | null;
  provincia: Provincia | null;
  canton: string | null;
  invitados: number | null;
  /** Presupuesto total del evento en colones. */
  presupuesto: number | null;
  estilo: EstiloId | null;
  /** Ids de SERVICIOS pedidos. */
  servicios: string[];
  /** Texto libre opcional ("con piscina", "pet friendly"...). */
  preferencias: string;
};

export const RESPUESTAS_VACIAS: RespuestasPlanificador = {
  tipoEvento: null,
  fecha: null,
  provincia: null,
  canton: null,
  invitados: null,
  presupuesto: null,
  estilo: null,
  servicios: [],
  preferencias: "",
};

/** Las etapas de la barra de progreso, en orden. */
export const ETAPAS = [
  { id: "evento", label: "Evento" },
  { id: "fecha", label: "Fecha" },
  { id: "ubicacion", label: "Ubicación" },
  { id: "invitados", label: "Invitados" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "estilo", label: "Estilo" },
  { id: "servicios", label: "Servicios" },
  { id: "resultados", label: "Resultados" },
] as const;

export type EtapaId = (typeof ETAPAS)[number]["id"];

/** Un negocio real de la plataforma, ya puntuado para un servicio. */
export type CandidatoServicio = {
  rancho: Rancho;
  puntos: number;
  calificacion: Calificacion | null;
  /**
   * Lugares con la fecha elegida libre → "Libre el 15 ago";
   * lugares sin fecha elegida → "Reserva en línea";
   * servicios móviles (sin calendario) → "Consultá su agenda".
   */
  etiquetaDisponibilidad: string;
  /** Cuánto del presupuesto total se estimó para este servicio. */
  presupuestoServicio: number | null;
};

export type GrupoResultados = {
  servicio: ServicioDef;
  candidatos: CandidatoServicio[];
};

export type ResultadosPlanificador = {
  /** "Encontramos estas opciones para tu boda de 120 personas..." */
  resumen: string;
  grupos: GrupoResultados[];
  /** true si ningún servicio encontró candidatos. */
  vacio: boolean;
};
