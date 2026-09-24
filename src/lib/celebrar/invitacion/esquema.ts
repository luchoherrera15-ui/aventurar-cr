import type { TipoCelebracionId } from "../marca";
import { esFuenteId, type FuenteId } from "./fuentes";

/**
 * ══════════════════════════════════════════════════════════════════
 *  EL DOCUMENTO DE UNA INVITACIÓN
 * ══════════════════════════════════════════════════════════════════
 *
 * Una invitación de CELEBRAR es un documento JSON: un ESTILO (paleta,
 * letras, disposición del héroe, motivo decorativo) y una lista
 * ordenada de SECCIONES, cada una con su tipo, su visibilidad y sus
 * datos. El editor lo modifica en vivo, la página pública lo renderiza
 * con el mismo componente, y una plantilla es un documento sin los
 * datos de la celebración (nombres, fecha) — se rellena al elegirla.
 *
 * Lo que entra desde la base (jsonb) o desde la IA pasa SIEMPRE por
 * `normalizarDocumento`: nada se confía, todo se acota. Así un JSON
 * viejo, roto o malicioso nunca rompe el render ni inyecta nada (los
 * textos se renderizan como texto, jamás como HTML).
 */

export const TIPOS_SECCION = [
  "hero",
  "countdown",
  "detalles",
  "ubicacion",
  "historia",
  "galeria",
  "dress_code",
  "itinerario",
  "rsvp",
  "regalos",
  "mensaje",
  "faq",
] as const;
export type TipoSeccion = (typeof TIPOS_SECCION)[number];

export const NOMBRE_SECCION: Record<TipoSeccion, string> = {
  hero: "Portada",
  countdown: "Cuenta regresiva",
  detalles: "Fecha y hora",
  ubicacion: "Ubicación",
  historia: "Nuestra historia",
  galeria: "Galería",
  dress_code: "Código de vestimenta",
  itinerario: "Programa del día",
  rsvp: "Confirmación de asistencia",
  regalos: "Regalos",
  mensaje: "Mensaje",
  faq: "Preguntas frecuentes",
};

export const HEROES = ["clasico", "foto", "tarjeta", "marco", "dividido", "editorial"] as const;
export type Heroe = (typeof HEROES)[number];
export const NOMBRE_HEROE: Record<Heroe, string> = {
  clasico: "Clásica, a pantalla completa",
  foto: "Foto a pantalla completa",
  tarjeta: "Tarjeta sobre la escena",
  marco: "Marco doble con esquinas",
  dividido: "Nombres arriba, foto en arco",
  editorial: "Editorial, a la izquierda",
};

/** El adorno bajo los títulos: la firma tipográfica de la invitación. */
export const ORNAMENTOS = ["ninguno", "linea", "diamante", "floral", "estrella", "corazon", "anillos", "hoja", "huella", "varita", "banderas", "corona"] as const;
export type Ornamento = (typeof ORNAMENTOS)[number];
export const NOMBRE_ORNAMENTO: Record<Ornamento, string> = {
  ninguno: "Sin adorno",
  linea: "Línea fina",
  diamante: "Línea con diamante",
  floral: "Floritura",
  estrella: "Estrella",
  corazon: "Corazón",
  anillos: "Anillos",
  hoja: "Ramita",
  huella: "Huella de dinosaurio",
  varita: "Varita mágica",
  banderas: "Banderas de meta",
  corona: "Corona",
};

/** La textura del fondo: lo que hace que un color plano se sienta papel o seda. */
export const TEXTURAS = ["ninguna", "seda", "papel", "vineta", "grano"] as const;
export type Textura = (typeof TEXTURAS)[number];
export const NOMBRE_TEXTURA: Record<Textura, string> = {
  ninguna: "Lisa",
  seda: "Seda (ondas suaves)",
  papel: "Papel",
  vineta: "Viñeta (bordes oscuros)",
  grano: "Grano fino",
};

/**
 * El ritmo de las escenas: qué secciones van sobre el fondo y cuáles
 * sobre el color de escena (el «capítulo» en vino de la carta de amor).
 */
export const RITMOS = ["uniforme", "alternar", "escena"] as const;
export type Ritmo = (typeof RITMOS)[number];
export const NOMBRE_RITMO: Record<Ritmo, string> = {
  uniforme: "Todo sobre el fondo",
  alternar: "Alternar fondo y escena",
  escena: "Portada en fondo, el resto en escena",
};

/** La forma del borde entre una escena y la siguiente. */
export const TRANSICIONES = ["recta", "ondas", "feston", "diagonal", "curva", "almenas", "bandera", "nubes"] as const;
export type Transicion = (typeof TRANSICIONES)[number];
export const NOMBRE_TRANSICION: Record<Transicion, string> = {
  recta: "Recta",
  ondas: "Ondas",
  feston: "Festón (dientes redondos)",
  diagonal: "Diagonal",
  curva: "Curva",
  almenas: "Almenas de castillo",
  bandera: "Bandera a cuadros",
  nubes: "Nubes",
};

/**
 * El FONDO VIVO: formas que se mueven despacio detrás de cada escena
 * (ondas que van y vienen, una aurora de manchas de color, un degradado
 * que se desplaza…). Distinto de la textura (papel, grano: quietas) y de
 * las partículas (piezas que caen). Con intensidad y velocidad propias.
 */
export const FONDOS_VIVOS = ["ninguno", "ondas", "aurora", "degradado", "circulos", "destello", "lineas", "malla"] as const;
export type FondoVivo = (typeof FONDOS_VIVOS)[number];
export const NOMBRE_FONDO_VIVO: Record<FondoVivo, string> = {
  ninguno: "Quieto",
  ondas: "Ondas que se mecen",
  aurora: "Aurora (manchas de color)",
  degradado: "Degradado en movimiento",
  circulos: "Círculos flotando",
  destello: "Destello que barre",
  lineas: "Líneas a la deriva",
  malla: "Malla de color",
};
export const INTENSIDADES = ["sutil", "media", "fuerte"] as const;
export type Intensidad = (typeof INTENSIDADES)[number];
export const NOMBRE_INTENSIDAD: Record<Intensidad, string> = { sutil: "Sutil", media: "Media", fuerte: "Fuerte" };
export const VELOCIDADES = ["lenta", "media", "rapida"] as const;
export type Velocidad = (typeof VELOCIDADES)[number];
export const NOMBRE_VELOCIDAD: Record<Velocidad, string> = { lenta: "Lenta", media: "Media", rapida: "Rápida" };

/**
 * Cómo entra cada escena al scrollear: la ANIMACIÓN DE ENTRADA, elegible.
 * «suave» es la mezcla por defecto (cada pieza con su propia entrada);
 * las demás imponen un mismo carácter a toda la invitación.
 */
/**
 * Cómo se ABRE la invitación al llegar (decisión del dueño, 22 sep 2026:
 * todas se abren con una animación y ahí arranca la música). «directa»
 * la muestra de una, sin capa.
 */
/**
 * ══════════════════════════════════════════════════════════════════
 *  LAS 48 APERTURAS — cómo se abre la invitación
 * ══════════════════════════════════════════════════════════════════
 *
 * La invitación llega CERRADA y se abre con un toque (y ahí arranca la
 * música). El dueño pidió (22 sep 2026) que no todas se abran igual:
 * hay cuarenta y ocho, agrupadas por mecánica —papel, telones, luz,
 * partículas, transformaciones y temáticas— más «directa», que la muestra de una.
 * Cada familia del catálogo usa una distinta (ver el generador).
 */
export const APERTURAS = [
  // Papel: sobres, cartas, pergaminos, libros
  "sobre", "sobre_cera", "carta_doblada", "pergamino", "postal", "libro", "diptico", "abanico", "sobre_desliza", "funda",
  // Telones y piezas que se retiran
  "telon", "telon_alto", "persiana", "persiana_v", "puertas", "iris", "cremallera", "mosaico", "damero", "franjas",
  // Luz
  "destello", "flash", "amanecer", "rayo", "chispas", "fuegos", "purpurina", "halo",
  // Partículas que se disipan
  "petalos", "confeti", "humo", "burbujas", "hojas", "nieve", "arena", "estrellas",
  // Transformaciones
  "zoom", "giro", "ondas", "ripple", "pixeles", "glitch", "espiral", "corte", "rebote",
  // Temáticas: la intro ES el tema (la carta que trae la lechuza, el semáforo de largada, el libro de cuentos)
  "carta_magica", "largada", "cuento",
  "directa",
] as const;
export type Apertura = (typeof APERTURAS)[number];
export const NOMBRE_APERTURA: Record<Apertura, string> = {
  sobre: "Sobre con sello",
  sobre_cera: "Sobre con lacre que se rompe",
  carta_doblada: "Carta que se despliega",
  pergamino: "Pergamino que se desenrolla",
  postal: "Postal que gira",
  libro: "Libro que se abre",
  diptico: "Díptico de dos hojas",
  abanico: "Abanico que se despliega",
  sobre_desliza: "La tarjeta sale del sobre",
  funda: "Funda que se corre",
  telon: "Telón a los lados",
  telon_alto: "Telón que sube",
  persiana: "Persianas horizontales",
  persiana_v: "Persianas verticales",
  puertas: "Puertas dobles",
  iris: "Iris que se abre",
  cremallera: "Cremallera",
  mosaico: "Mosaico de piezas",
  damero: "Damero",
  franjas: "Franjas diagonales",
  destello: "Destello",
  flash: "Flash de cámara",
  amanecer: "Amanecer",
  rayo: "Rayo de luz",
  chispas: "Chispas",
  fuegos: "Fuegos artificiales",
  purpurina: "Lluvia de purpurina",
  halo: "Halo que crece",
  petalos: "Pétalos que caen",
  confeti: "Confeti",
  humo: "Niebla que se disipa",
  burbujas: "Burbujas",
  hojas: "Hojas al viento",
  nieve: "Nieve",
  arena: "Arena que corre",
  estrellas: "Cielo estrellado",
  zoom: "Acercamiento",
  giro: "Giro 3D",
  ondas: "Ondas de agua",
  ripple: "Círculo que se expande",
  pixeles: "Píxeles",
  glitch: "Glitch",
  espiral: "Espiral",
  corte: "Corte diagonal",
  rebote: "Rebote",
  carta_magica: "Carta mágica (la trae una lechuza)",
  largada: "Semáforo de largada",
  cuento: "Libro de cuentos",
  directa: "Sin apertura",
};

/** Las familias de apertura, para el selector del editor. */
export const GRUPOS_APERTURA: readonly { nombre: string; aperturas: readonly Apertura[] }[] = [
  { nombre: "Papel", aperturas: ["sobre", "sobre_cera", "carta_doblada", "pergamino", "postal", "libro", "diptico", "abanico", "sobre_desliza", "funda"] },
  { nombre: "Telones", aperturas: ["telon", "telon_alto", "persiana", "persiana_v", "puertas", "iris", "cremallera", "mosaico", "damero", "franjas"] },
  { nombre: "Luz", aperturas: ["destello", "flash", "amanecer", "rayo", "chispas", "fuegos", "purpurina", "halo"] },
  { nombre: "Partículas", aperturas: ["petalos", "confeti", "humo", "burbujas", "hojas", "nieve", "arena", "estrellas"] },
  { nombre: "Movimiento", aperturas: ["zoom", "giro", "ondas", "ripple", "pixeles", "glitch", "espiral", "corte", "rebote"] },
  { nombre: "Temáticas", aperturas: ["carta_magica", "largada", "cuento"] },
  { nombre: "Sin apertura", aperturas: ["directa"] },
];

export const ENTRADAS = ["suave", "sumergir", "brinco", "cortina", "zoom", "deslizar"] as const;
export type Entrada = (typeof ENTRADAS)[number];
export const NOMBRE_ENTRADA: Record<Entrada, string> = {
  suave: "Suave (aparece y sube)",
  sumergir: "Sumergirse (profundidad y desenfoque)",
  brinco: "Brinco (rebote elástico)",
  cortina: "Cortina (se descubre de abajo)",
  zoom: "Zoom (crece al entrar)",
  deslizar: "Deslizar (entra de lado)",
};

/** El ambiente vivo: partículas en bucle sutil sobre toda la invitación. */
export const PARTICULAS = ["ninguna", "petalos", "destellos", "confeti", "burbujas", "estrellas", "hojas", "velas", "banderines", "polvo_hada"] as const;
export type Particulas = (typeof PARTICULAS)[number];
export const NOMBRE_PARTICULAS: Record<Particulas, string> = {
  ninguna: "Sin partículas",
  petalos: "Pétalos",
  destellos: "Destellos",
  confeti: "Confeti",
  burbujas: "Burbujas",
  estrellas: "Estrellas",
  hojas: "Hojas",
  velas: "Velas flotantes",
  banderines: "Banderines a cuadros",
  polvo_hada: "Polvo de hada",
};

/**
 * El motivo decorativo: un patrón de línea fina que se repite detrás de
 * las escenas (botánicos, florales, geométricos, celestes, de fiesta).
 * Los dibujos viven en components/celebrar/invitacion/decoracion.ts.
 */
export const DECORACIONES = [
  "ninguna",
  "hojas",
  "eucalipto",
  "olivo",
  "helecho",
  "monstera",
  "flores",
  "peonias",
  "laurel",
  "mariposas",
  "deco",
  "damasco",
  "celosia",
  "geometria",
  "lineas",
  "cuadricula",
  "ondas",
  "estrellas",
  "corazones",
  "anillos",
  "confeti",
  "puntos",
  "terrazzo",
  "globos",
  "dinosaurios",
  "magia",
  "carreras",
  "castillos",
] as const;
export type Decoracion = (typeof DECORACIONES)[number];
export const NOMBRE_DECORACION: Record<Decoracion, string> = {
  ninguna: "Sin motivo",
  hojas: "Ramitas",
  eucalipto: "Eucalipto",
  olivo: "Olivo",
  helecho: "Helechos",
  monstera: "Monstera",
  flores: "Florecitas",
  peonias: "Peonías",
  laurel: "Laurel",
  mariposas: "Mariposas",
  deco: "Art déco",
  damasco: "Damasco",
  celosia: "Celosía",
  geometria: "Geometría",
  lineas: "Rayas finas",
  cuadricula: "Cuadrícula",
  ondas: "Olas japonesas",
  estrellas: "Cielo",
  corazones: "Corazones",
  anillos: "Anillos",
  confeti: "Confeti",
  puntos: "Puntos",
  terrazzo: "Terrazo",
  globos: "Globos",
  dinosaurios: "Dinosaurios",
  magia: "Colegio de magia",
  carreras: "Carreras",
  castillos: "Castillos y coronas",
};
/** Familias del selector, para agrupar los motivos. */
export const GRUPOS_DECORACION: readonly { nombre: string; motivos: readonly Decoracion[] }[] = [
  { nombre: "Botánicos", motivos: ["hojas", "eucalipto", "olivo", "helecho", "monstera", "laurel"] },
  { nombre: "Florales", motivos: ["flores", "peonias", "mariposas", "corazones"] },
  { nombre: "Geométricos", motivos: ["deco", "damasco", "celosia", "geometria", "lineas", "cuadricula", "ondas"] },
  { nombre: "Fiesta y cielo", motivos: ["estrellas", "confeti", "puntos", "terrazzo", "globos", "anillos"] },
  { nombre: "Temáticos", motivos: ["dinosaurios", "magia", "carreras", "castillos"] },
];

/** Qué tan grande se repite el motivo. */
export const ESCALAS_DECORACION = ["fina", "media", "grande"] as const;
export type EscalaDecoracion = (typeof ESCALAS_DECORACION)[number];
export const NOMBRE_ESCALA_DECORACION: Record<EscalaDecoracion, string> = { fina: "Fino", media: "Medio", grande: "Grande" };

/** Dónde va: en todas las escenas, solo como guirnalda en los bordes, o solo en la portada. */
export const DISPOSICIONES_DECORACION = ["todo", "bordes", "portada"] as const;
export type DisposicionDecoracion = (typeof DISPOSICIONES_DECORACION)[number];
export const NOMBRE_DISPOSICION_DECORACION: Record<DisposicionDecoracion, string> = {
  todo: "En todas las escenas",
  bordes: "Solo arriba y abajo de cada escena",
  portada: "Solo en la portada",
};

/** Los adornos de esquina de la portada y el cierre: ilustraciones de línea en el acento. */
export const ESQUINAS = ["ninguna", "floral", "hojas", "deco", "filigrana", "estrellas", "selva", "magia", "carreras", "cuento"] as const;
export type Esquinas = (typeof ESQUINAS)[number];
export const NOMBRE_ESQUINAS: Record<Esquinas, string> = {
  ninguna: "Sin esquinas",
  floral: "Ramo floral",
  hojas: "Ramas de eucalipto",
  deco: "Art déco",
  filigrana: "Filigrana",
  estrellas: "Destellos",
  selva: "Selva (helechos)",
  magia: "Estrellas y luna colgando",
  carreras: "Banderas de meta",
  cuento: "Enredadera con corona",
};

/**
 * El TEMA: una invitación temática de verdad, no solo una paleta. Suma
 * lo que ninguna otra opción da: la ESCENOGRAFÍA de la portada (el
 * castillo con ventanas encendidas, la pista con el auto que pasa, el
 * castillo de cuento con sus banderines) y el PERSONAJE que cruza cada
 * escena al llegar a ella (la lechuza con la carta, el auto de carreras,
 * la estrella fugaz del hada). La intro, los bordes, las partículas y el
 * motivo de cada tema son opciones sueltas (carta_magica, almenas,
 * velas, magia…) que el tema no impone: los demos las combinan.
 */
export const TEMAS = ["ninguno", "magia", "carreras", "cuento"] as const;
export type Tema = (typeof TEMAS)[number];
export const NOMBRE_TEMA: Record<Tema, string> = {
  ninguno: "Sin tema",
  magia: "Colegio de magia",
  carreras: "Gran premio (carreras)",
  cuento: "Cuento de hadas",
};

export const BORDES = ["rectos", "suaves", "redondos"] as const;
export type Bordes = (typeof BORDES)[number];

export type Paleta = {
  fondo: string;
  tinta: string;
  acento: string;
  suave: string;
  superficie: string;
  /** El color de la escena alterna (el capítulo en vino, la noche en marino). */
  escena: string;
  /** La tinta sobre la escena. */
  tintaEscena: string;
};

export type Estilo = {
  paleta: Paleta;
  fuenteTitulo: FuenteId;
  fuenteTexto: FuenteId;
  heroe: Heroe;
  decoracion: Decoracion;
  bordes: Bordes;
  animaciones: boolean;
  ornamento: Ornamento;
  textura: Textura;
  ritmo: Ritmo;
  transicion: Transicion;
  particulas: Particulas;
  /** Un filete fino de acento pegado a los bordes de toda la invitación. */
  marco: boolean;
  fondoVivo: FondoVivo;
  fondoIntensidad: Intensidad;
  fondoVelocidad: Velocidad;
  decoracionEscala: EscalaDecoracion;
  decoracionIntensidad: Intensidad;
  decoracionDisposicion: DisposicionDecoracion;
  esquinas: Esquinas;
  entrada: Entrada;
  apertura: Apertura;
  tema: Tema;
};

export type Lugar = {
  titulo: string;
  lugar: string;
  direccion: string;
  hora: string;
  mapsUrl: string;
};

export type Regalo = {
  titulo: string;
  detalle: string;
  url: string;
};

export type Pregunta = { pregunta: string; respuesta: string };

/**
 * Cómo confirman los invitados:
 *  - «whatsapp»: el botón abre un chat con el anfitrión (control manual).
 *  - «panel»: formulario en la página → panel de Invitados en la app.
 */
export const MODOS_RSVP = ["whatsapp", "panel"] as const;
export type ModoRsvp = (typeof MODOS_RSVP)[number];
export const NOMBRE_MODO_RSVP: Record<ModoRsvp, string> = {
  whatsapp: "Por WhatsApp (control manual)",
  panel: "En la página + panel de invitados",
};

/** Una pregunta configurable del formulario de confirmación. */
export const TIPOS_PREGUNTA = ["texto", "numero", "opcion", "si_no"] as const;
export type TipoPregunta = (typeof TIPOS_PREGUNTA)[number];
export const NOMBRE_TIPO_PREGUNTA: Record<TipoPregunta, string> = {
  texto: "Texto libre",
  numero: "Número",
  opcion: "Opciones (elegir una)",
  si_no: "Sí / No",
};
export type PreguntaRsvp = {
  id: string;
  etiqueta: string;
  tipo: TipoPregunta;
  /** Solo para «opcion». */
  opciones: string[];
  requerida: boolean;
};

/** Las preguntas con las que arranca una invitación con confirmación en la página. */
export const PREGUNTAS_RSVP_POR_DEFECTO: PreguntaRsvp[] = [
  { id: "alergias", etiqueta: "¿Alguna alergia o restricción alimentaria?", tipo: "texto", opciones: [], requerida: false },
];
export type Momento = { hora: string; titulo: string; detalle: string };
export type GrupoVestimenta = { titulo: string; texto: string };

/** Los datos de cada tipo de sección. Todo texto plano. */
export type DatosSeccion = {
  hero: { saludo: string; titulo: string; subtitulo: string; fotoUrl: string; mostrarFecha: boolean };
  countdown: { titulo: string; texto: string };
  detalles: { titulo: string; texto: string };
  ubicacion: { titulo: string; lugares: Lugar[] };
  historia: { titulo: string; texto: string; fotoUrl: string };
  galeria: { titulo: string; fotos: string[] };
  dress_code: { titulo: string; texto: string; grupos: GrupoVestimenta[]; colores: string[] };
  itinerario: { titulo: string; items: Momento[] };
  rsvp: {
    titulo: string;
    texto: string;
    fechaLimite: string;
    boton: string;
    whatsapp: string;
    modo: ModoRsvp;
    /** Si se pide cuántas personas van (además del nombre y sí/no, que siempre van). */
    pedirPersonas: boolean;
    /** Si se pide teléfono o correo para poder avisar. */
    pedirContacto: boolean;
    preguntas: PreguntaRsvp[];
  };
  regalos: { titulo: string; texto: string; items: Regalo[]; sinpe: string };
  mensaje: { titulo: string; texto: string; firma: string };
  faq: { titulo: string; items: Pregunta[] };
};

/**
 * El diseño PROPIO de una sección, por encima del estilo general: sobre
 * qué tono va, si lleva una foto de fondo, cómo se alinea, cuánto aire
 * tiene y si muestra el ornamento. «auto» sigue el ritmo del documento.
 */
export const TONOS_SECCION = ["auto", "fondo", "escena"] as const;
export type TonoSeccion = (typeof TONOS_SECCION)[number];
export const NOMBRE_TONO_SECCION: Record<TonoSeccion, string> = { auto: "Según el ritmo", fondo: "Color de fondo", escena: "Color de escena" };
export const ALINEACIONES = ["centro", "izquierda"] as const;
export type Alineacion = (typeof ALINEACIONES)[number];
export const TAMANOS_SECCION = ["compacto", "normal", "amplio"] as const;
export type TamanoSeccion = (typeof TAMANOS_SECCION)[number];
export const NOMBRE_TAMANO_SECCION: Record<TamanoSeccion, string> = { compacto: "Compacta", normal: "Normal", amplio: "A pantalla completa" };

export const FONDOS_VIVOS_SECCION = ["auto", ...FONDOS_VIVOS] as const;
export type FondoVivoSeccion = (typeof FONDOS_VIVOS_SECCION)[number];

export type DisenoSeccion = {
  tono: TonoSeccion;
  /** Foto de fondo con velo oscuro (la tinta pasa a blanco). */
  fondoUrl: string;
  alineacion: Alineacion;
  tamano: TamanoSeccion;
  ornamento: boolean;
  /** El fondo vivo de esta sección; «auto» sigue el de toda la invitación. */
  fondoVivo: FondoVivoSeccion;
};

export const DISENO_SECCION_POR_DEFECTO: DisenoSeccion = { tono: "auto", fondoUrl: "", alineacion: "centro", tamano: "normal", ornamento: true, fondoVivo: "auto" };

export type Seccion = {
  [T in TipoSeccion]: { id: string; tipo: T; visible: boolean; datos: DatosSeccion[T]; diseno: DisenoSeccion };
}[TipoSeccion];

/** La canción de la invitación: un botón flotante «Reproducir nuestra canción». */
export type Musica = {
  url: string;
  titulo: string;
  /** Arranca sola al primer toque en la página (los navegadores no dejan antes). */
  autoplay: boolean;
};

export type Documento = {
  version: 1;
  plantilla: string | null;
  estilo: Estilo;
  secciones: Seccion[];
  musica: Musica;
};

export const MUSICA_VACIA: Musica = { url: "", titulo: "", autoplay: false };

export function normalizarMusica(v: unknown): Musica {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { url: url(o.url), titulo: texto(o.titulo, 120), autoplay: bool(o.autoplay, false) };
}

// ── Límites (defensa, no estética) ────────────────────────────────
const MAX_TEXTO_CORTO = 160;
const MAX_TEXTO_LARGO = 2000;
const MAX_URL = 600;
const MAX_FOTOS = 12;
const MAX_LUGARES = 6;
const MAX_REGALOS = 8;
const MAX_PREGUNTAS = 12;
const MAX_MOMENTOS = 12;
const MAX_PREGUNTAS_RSVP = 8;
const MAX_OPCIONES_PREGUNTA = 8;
const MAX_GRUPOS = 4;
const MAX_COLORES = 8;
const MAX_SECCIONES = 24;
const HEX = /^#[0-9a-f]{6}$/i;

const texto = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max) : "";

const url = (v: unknown): string => {
  if (typeof v !== "string") return "";
  const s = v.trim().slice(0, MAX_URL);
  return /^https:\/\/\S+$/i.test(s) ? s : "";
};

const bool = (v: unknown, porDefecto: boolean): boolean => (typeof v === "boolean" ? v : porDefecto);

function hex(v: unknown, porDefecto: string): string {
  return typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : porDefecto;
}

export const PALETA_POR_DEFECTO: Paleta = {
  fondo: "#f7f2ea",
  tinta: "#2b2620",
  acento: "#b8955a",
  suave: "#6b6259",
  superficie: "#ffffff",
  escena: "#6b2233",
  tintaEscena: "#fbf5ee",
};

export const ESTILO_POR_DEFECTO: Estilo = {
  paleta: PALETA_POR_DEFECTO,
  fuenteTitulo: "playfair",
  fuenteTexto: "montserrat",
  heroe: "clasico",
  decoracion: "ninguna",
  bordes: "suaves",
  animaciones: true,
  ornamento: "diamante",
  textura: "seda",
  ritmo: "alternar",
  transicion: "ondas",
  particulas: "ninguna",
  marco: false,
  fondoVivo: "ninguno",
  fondoIntensidad: "media",
  fondoVelocidad: "media",
  decoracionEscala: "media",
  decoracionIntensidad: "media",
  decoracionDisposicion: "todo",
  esquinas: "ninguna",
  entrada: "suave",
  apertura: "sobre",
  tema: "ninguno",
};

function normalizarPaleta(v: unknown): Paleta {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const superficie = hex(o.superficie, PALETA_POR_DEFECTO.superficie);
  const tinta = hex(o.tinta, PALETA_POR_DEFECTO.tinta);
  return {
    fondo: hex(o.fondo, PALETA_POR_DEFECTO.fondo),
    tinta,
    acento: hex(o.acento, PALETA_POR_DEFECTO.acento),
    suave: hex(o.suave, PALETA_POR_DEFECTO.suave),
    superficie,
    // Documentos anteriores a las escenas: la escena es la superficie
    // con la misma tinta, que es exactamente como se veían.
    escena: hex(o.escena, superficie),
    tintaEscena: hex(o.tintaEscena, tinta),
  };
}

function uno<T extends readonly string[]>(lista: T, v: unknown, porDefecto: T[number]): T[number] {
  return typeof v === "string" && (lista as readonly string[]).includes(v) ? (v as T[number]) : porDefecto;
}

export function normalizarEstilo(v: unknown): Estilo {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    paleta: normalizarPaleta(o.paleta),
    fuenteTitulo: esFuenteId(o.fuenteTitulo) ? o.fuenteTitulo : ESTILO_POR_DEFECTO.fuenteTitulo,
    fuenteTexto: esFuenteId(o.fuenteTexto) ? o.fuenteTexto : ESTILO_POR_DEFECTO.fuenteTexto,
    heroe: uno(HEROES, o.heroe, ESTILO_POR_DEFECTO.heroe),
    decoracion: uno(DECORACIONES, o.decoracion, ESTILO_POR_DEFECTO.decoracion),
    bordes: uno(BORDES, o.bordes, ESTILO_POR_DEFECTO.bordes),
    animaciones: bool(o.animaciones, true),
    // Un documento viejo (sin estas llaves) se ve como antes: línea
    // fina, liso, uniforme, recto y sin partículas — no le aparece nada
    // que la persona no eligió.
    ornamento: uno(ORNAMENTOS, o.ornamento, "linea"),
    textura: uno(TEXTURAS, o.textura, "ninguna"),
    ritmo: uno(RITMOS, o.ritmo, "uniforme"),
    transicion: uno(TRANSICIONES, o.transicion, "recta"),
    particulas: uno(PARTICULAS, o.particulas, "ninguna"),
    marco: bool(o.marco, false),
    fondoVivo: uno(FONDOS_VIVOS, o.fondoVivo, "ninguno"),
    fondoIntensidad: uno(INTENSIDADES, o.fondoIntensidad, "media"),
    fondoVelocidad: uno(VELOCIDADES, o.fondoVelocidad, "media"),
    decoracionEscala: uno(ESCALAS_DECORACION, o.decoracionEscala, "media"),
    decoracionIntensidad: uno(INTENSIDADES, o.decoracionIntensidad, "media"),
    decoracionDisposicion: uno(DISPOSICIONES_DECORACION, o.decoracionDisposicion, "todo"),
    esquinas: uno(ESQUINAS, o.esquinas, "ninguna"),
    entrada: uno(ENTRADAS, o.entrada, "suave"),
    apertura: uno(APERTURAS, o.apertura, "sobre"),
    tema: uno(TEMAS, o.tema, "ninguno"),
  };
}

let contador = 0;
export function idSeccion(): string {
  contador += 1;
  return `s${Date.now().toString(36)}${contador.toString(36)}`;
}

function lista<T>(v: unknown, max: number, item: (x: unknown) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const salida: T[] = [];
  for (const x of v) {
    if (salida.length >= max) break;
    const i = item(x);
    if (i) salida.push(i);
  }
  return salida;
}

function normalizarDatos<T extends TipoSeccion>(tipo: T, v: unknown): DatosSeccion[T] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const d: DatosSeccion = {
    hero: {
      saludo: texto(o.saludo, MAX_TEXTO_CORTO),
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      subtitulo: texto(o.subtitulo, MAX_TEXTO_CORTO),
      fotoUrl: url(o.fotoUrl),
      mostrarFecha: bool(o.mostrarFecha, true),
    },
    countdown: { titulo: texto(o.titulo, MAX_TEXTO_CORTO), texto: texto(o.texto, MAX_TEXTO_CORTO) },
    detalles: { titulo: texto(o.titulo, MAX_TEXTO_CORTO), texto: texto(o.texto, MAX_TEXTO_LARGO) },
    ubicacion: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      lugares: lista(o.lugares, MAX_LUGARES, (x) => {
        const l = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return {
          titulo: texto(l.titulo, MAX_TEXTO_CORTO),
          lugar: texto(l.lugar, MAX_TEXTO_CORTO),
          direccion: texto(l.direccion, 300),
          hora: texto(l.hora, 40),
          mapsUrl: url(l.mapsUrl),
        };
      }),
    },
    historia: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      texto: texto(o.texto, MAX_TEXTO_LARGO),
      fotoUrl: url(o.fotoUrl),
    },
    galeria: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      fotos: lista(o.fotos, MAX_FOTOS, (x) => url(x) || null),
    },
    dress_code: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      texto: texto(o.texto, MAX_TEXTO_LARGO),
      grupos: lista(o.grupos, MAX_GRUPOS, (x) => {
        const g = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return { titulo: texto(g.titulo, MAX_TEXTO_CORTO), texto: texto(g.texto, 300) };
      }),
      colores: lista(o.colores, MAX_COLORES, (x) => (typeof x === "string" && HEX.test(x.trim()) ? x.trim().toLowerCase() : null)),
    },
    itinerario: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      items: lista(o.items, MAX_MOMENTOS, (x) => {
        const m = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return { hora: texto(m.hora, 40), titulo: texto(m.titulo, MAX_TEXTO_CORTO), detalle: texto(m.detalle, 300) };
      }),
    },
    rsvp: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      texto: texto(o.texto, MAX_TEXTO_LARGO),
      fechaLimite: texto(o.fechaLimite, 10),
      boton: texto(o.boton, 40),
      whatsapp: texto(o.whatsapp, 20),
      // Documentos anteriores: por WhatsApp, como se veían.
      modo: uno(MODOS_RSVP, o.modo, "whatsapp"),
      pedirPersonas: bool(o.pedirPersonas, true),
      pedirContacto: bool(o.pedirContacto, false),
      preguntas: lista(o.preguntas, MAX_PREGUNTAS_RSVP, (x) => {
        const q = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        const etiqueta = texto(q.etiqueta, MAX_TEXTO_CORTO);
        if (!etiqueta) return null;
        return {
          id: typeof q.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(q.id) ? q.id : idSeccion(),
          etiqueta,
          tipo: uno(TIPOS_PREGUNTA, q.tipo, "texto"),
          opciones: lista(q.opciones, MAX_OPCIONES_PREGUNTA, (op) => texto(op, 80) || null),
          requerida: bool(q.requerida, false),
        };
      }),
    },
    regalos: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      texto: texto(o.texto, MAX_TEXTO_LARGO),
      items: lista(o.items, MAX_REGALOS, (x) => {
        const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return { titulo: texto(r.titulo, MAX_TEXTO_CORTO), detalle: texto(r.detalle, 300), url: url(r.url) };
      }),
      sinpe: texto(o.sinpe, 20),
    },
    mensaje: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      texto: texto(o.texto, MAX_TEXTO_LARGO),
      firma: texto(o.firma, MAX_TEXTO_CORTO),
    },
    faq: {
      titulo: texto(o.titulo, MAX_TEXTO_CORTO),
      items: lista(o.items, MAX_PREGUNTAS, (x) => {
        const p = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return { pregunta: texto(p.pregunta, MAX_TEXTO_CORTO), respuesta: texto(p.respuesta, MAX_TEXTO_LARGO) };
      }),
    },
  };
  return d[tipo];
}

export function normalizarDisenoSeccion(v: unknown): DisenoSeccion {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const d = DISENO_SECCION_POR_DEFECTO;
  return {
    tono: uno(TONOS_SECCION, o.tono, d.tono),
    fondoUrl: url(o.fondoUrl),
    alineacion: uno(ALINEACIONES, o.alineacion, d.alineacion),
    tamano: uno(TAMANOS_SECCION, o.tamano, d.tamano),
    ornamento: bool(o.ornamento, d.ornamento),
    fondoVivo: uno(FONDOS_VIVOS_SECCION, o.fondoVivo, d.fondoVivo),
  };
}

export function normalizarSeccion(v: unknown): Seccion | null {
  const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!o) return null;
  const tipo = o.tipo;
  if (typeof tipo !== "string" || !(TIPOS_SECCION as readonly string[]).includes(tipo)) return null;
  const t = tipo as TipoSeccion;
  const id = typeof o.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(o.id) ? o.id : idSeccion();
  return { id, tipo: t, visible: bool(o.visible, true), datos: normalizarDatos(t, o.datos), diseno: normalizarDisenoSeccion(o.diseno) } as Seccion;
}

/** Lo que entra desde la base o desde la IA. Nunca lanza: siempre devuelve un documento válido. */
export function normalizarDocumento(v: unknown): Documento {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const secciones = lista(o.secciones, MAX_SECCIONES, normalizarSeccion);
  // Una invitación siempre tiene portada, y solo una, y va primero.
  const heroes = secciones.filter((s) => s.tipo === "hero");
  const resto = secciones.filter((s) => s.tipo !== "hero");
  const hero: Seccion = heroes[0] ?? {
    id: idSeccion(),
    tipo: "hero",
    visible: true,
    datos: normalizarDatos("hero", {}),
    diseno: DISENO_SECCION_POR_DEFECTO,
  };
  return {
    version: 1,
    plantilla: typeof o.plantilla === "string" ? o.plantilla.slice(0, 80) : null,
    estilo: normalizarEstilo(o.estilo),
    secciones: [{ ...hero, visible: true }, ...resto],
    musica: normalizarMusica(o.musica),
  };
}

/** Datos de la celebración que el documento necesita para rellenarse. */
export type DatosCelebracionParaDocumento = {
  tipo: TipoCelebracionId;
  nombre: string;
  fecha: string | null;
  hora: string | null;
  lugarNombre: string | null;
  direccion: string | null;
  mapsUrl: string | null;
};

/**
 * Rellena los huecos de una plantilla con los datos de la celebración:
 * el título del héroe, el lugar de la ubicación. Solo llena lo que está
 * vacío — si la persona ya escribió, se respeta.
 */
export function rellenarConCelebracion(doc: Documento, c: DatosCelebracionParaDocumento): Documento {
  return {
    ...doc,
    secciones: doc.secciones.map((s) => {
      if (s.tipo === "hero") {
        return { ...s, datos: { ...s.datos, titulo: s.datos.titulo || c.nombre } };
      }
      if (s.tipo === "ubicacion" && s.datos.lugares.length > 0 && c.lugarNombre) {
        const [primero, ...otros] = s.datos.lugares;
        if (!primero.lugar) {
          return {
            ...s,
            datos: {
              ...s.datos,
              lugares: [
                {
                  ...primero,
                  lugar: c.lugarNombre,
                  direccion: primero.direccion || c.direccion || "",
                  hora: primero.hora || (c.hora ? c.hora.slice(0, 5) : ""),
                  mapsUrl: primero.mapsUrl || c.mapsUrl || "",
                },
                ...otros,
              ],
            },
          };
        }
      }
      return s;
    }),
  };
}

/** Mueve una sección un lugar arriba o abajo (la portada no se mueve). */
export function moverSeccion(secciones: Seccion[], id: string, direccion: -1 | 1): Seccion[] {
  const i = secciones.findIndex((s) => s.id === id);
  const j = i + direccion;
  if (i <= 0 || j <= 0 || j >= secciones.length) return secciones;
  const copia = [...secciones];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/** Contraste WCAG entre dos hex, para validar paletas (misma fórmula que identidad.ts). */
export function ratioContraste(a: string, b: string): number {
  const lum = (h: string) => {
    const x = h.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255).map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
