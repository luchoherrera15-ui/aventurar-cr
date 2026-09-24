import type { FuenteId } from "../invitacion/fuentes";
import {
  DISENO_SECCION_POR_DEFECTO,
  MUSICA_VACIA,
  PREGUNTAS_RSVP_POR_DEFECTO,
  type Decoracion,
  type DisposicionDecoracion,
  type Documento,
  type Apertura,
  type Entrada,
  type Esquinas,
  type Estilo,
  type FondoVivo,
  type Heroe,
  type Ornamento,
  type Particulas,
  type Ritmo,
  type Seccion,
  type Textura,
  type TipoSeccion,
  type Transicion,
} from "../invitacion/esquema";
import { TIPOS_CELEBRACION, type TipoCelebracionId } from "../marca";
import { PALETAS } from "./paletas";

/**
 * ══════════════════════════════════════════════════════════════════
 *  EL GENERADOR DEL CATÁLOGO — 40 plantillas por tipo de celebración
 * ══════════════════════════════════════════════════════════════════
 *
 * Una plantilla es un documento de invitación sin los datos de la
 * celebración: un estilo completo y las secciones con su copy por
 * defecto para ese tipo. Las 40 de cada tipo salen de OCHO FAMILIAS
 * dirigidas a mano —cada una con su paleta, sus letras, su ornamento,
 * su textura, su ritmo de escenas, su borde entre escenas, sus
 * partículas y su motivo— por CINCO portadas distintas. Así una familia
 * se siente hecha para su ocasión (la «Carta» en marfil y vino con
 * pétalos; la «Gala» en negro con filete dorado y destellos) y no una
 * recoloreada de la de al lado.
 *
 * Es determinista a propósito: el sembrado en la base (`upsert` por
 * slug) se puede repetir cuando se ajuste algo y no duplica nada. Las
 * plantillas dibujadas una a una (`nivel = 'exclusiva'`) se agregan a
 * la tabla aparte — este generador es el piso, no el techo.
 */

export type PlantillaGenerada = {
  slug: string;
  nombre: string;
  categoria_id: string;
  nivel: "gratis" | "premium";
  costo_creditos: number;
  tipos_evento: TipoCelebracionId[];
  descripcion: string;
  esquema: Documento;
  estilos: Estilo;
  orden: number;
};

type Caracter = "elegante" | "moderno" | "alegre" | "formal";

/** Una familia: la dirección de arte completa menos la paleta (que aporta el tipo). */
type Familia = {
  nombre: string;
  titulo: FuenteId;
  texto: FuenteId;
  ornamento: Ornamento;
  textura: Textura;
  ritmo: Ritmo;
  transicion: Transicion;
  particulas: Particulas;
  decoracion: Decoracion;
  marco: boolean;
  bordes: Estilo["bordes"];
  /** Las cinco portadas de sus cinco variantes, en orden. */
  heroes: readonly [Heroe, Heroe, Heroe, Heroe, Heroe];
  /** El fondo vivo de la familia (la variante 5 siempre lo apaga: una versión quieta de cada familia). */
  fondoVivo: FondoVivo;
  /** Dónde va el motivo y qué adorno llevan las esquinas de la portada. */
  disposicion: DisposicionDecoracion;
  esquinas: Esquinas;
  entrada: Entrada;
  /** Cómo se abre: la carta, el destello o el telón. */
  apertura: Estilo["apertura"];
  /**
   * La foto de AMBIENTE de la familia (texturas, flores, luces, salones —
   * nunca caras reconocibles): va de fondo en la portada bajo un velo de
   * la paleta, para que el catálogo se vea como una invitación de verdad.
   * Unsplash, ids verificados contra el CDN y a ojo en una hoja de contacto.
   */
  foto: string;
};

/** Los motivos tan finos que pueden ir detrás del texto sin estorbar. */
const MOTIVOS_LIVIANOS: ReadonlySet<Decoracion> = new Set<Decoracion>(["ninguna", "puntos", "lineas", "cuadricula", "ondas"]);

const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

/**
 * ══════════════════════════════════════════════════════════════════
 *  CUATRO FAMILIAS POR ESTILO — el catálogo, por dentro
 * ══════════════════════════════════════════════════════════════════
 *
 * Antes las familias se agrupaban por «carácter» (elegante, moderno,
 * alegre, formal) y cada tipo de celebración usaba ocho: por eso el
 * filtro dejaba huecos (no había ninguna boda «moderna», ni ningún
 * corporativo «elegante»). Ahora la familia pertenece a un ESTILO del
 * catálogo y cada tipo recorre los estilos que le corresponden, así que
 * cualquier combinación que el filtro ofrezca tiene sus veinte diseños
 * (4 familias × 5 portadas).
 *
 * Cada familia es una dirección de arte cerrada: letras, ornamento,
 * textura, ritmo de escenas, borde entre escenas, partículas, motivo,
 * esquinas, fondo vivo, cómo entra cada escena y cómo se abre la
 * invitación. La paleta la pone el tipo (ocho por tipo, en paletas.ts).
 */
const FAMILIAS: Record<string, readonly [Familia, Familia, Familia, Familia]> = {
  // ── Elegante: serif, mucho aire, un solo acento ──────────────────
  elegante: [
    { nombre: "Carta", titulo: "playfair", texto: "montserrat", ornamento: "diamante", textura: "seda", ritmo: "alternar", transicion: "ondas", particulas: "petalos", decoracion: "peonias", marco: false, bordes: "suaves", heroes: ["clasico", "marco", "tarjeta", "dividido", "foto"], fondoVivo: "ondas", disposicion: "bordes", esquinas: "floral", entrada: "sumergir", apertura: "sobre", foto: u("1487530811176-3780de880c2d") },
    { nombre: "Cinzel", titulo: "cinzel", texto: "raleway", ornamento: "linea", textura: "papel", ritmo: "escena", transicion: "recta", particulas: "ninguna", decoracion: "laurel", marco: true, bordes: "rectos", heroes: ["marco", "clasico", "editorial", "tarjeta", "foto"], fondoVivo: "destello", disposicion: "portada", esquinas: "deco", entrada: "cortina", apertura: "sobre", foto: u("1519225421980-715cb0215aed") },
    { nombre: "Nácar", titulo: "cormorant", texto: "montserrat", ornamento: "floral", textura: "seda", ritmo: "alternar", transicion: "curva", particulas: "destellos", decoracion: "damasco", marco: false, bordes: "suaves", heroes: ["clasico", "tarjeta", "foto", "marco", "dividido"], fondoVivo: "aurora", disposicion: "bordes", esquinas: "filigrana", entrada: "suave", apertura: "sobre", foto: u("1465495976277-4387d4b0b4c6") },
    { nombre: "Brindis", titulo: "libre", texto: "lora", ornamento: "anillos", textura: "grano", ritmo: "alternar", transicion: "diagonal", particulas: "ninguna", decoracion: "anillos", marco: true, bordes: "suaves", heroes: ["dividido", "clasico", "marco", "foto", "editorial"], fondoVivo: "lineas", disposicion: "bordes", esquinas: "deco", entrada: "deslizar", apertura: "sobre", foto: u("1522673607200-164d1b6ce486") },
  ],
  // ── Minimalista: solo lo necesario, se lee en un segundo ─────────
  minimalista: [
    { nombre: "Aire", titulo: "dmserif", texto: "montserrat", ornamento: "linea", textura: "ninguna", ritmo: "uniforme", transicion: "recta", particulas: "ninguna", decoracion: "ninguna", marco: false, bordes: "rectos", heroes: ["editorial", "clasico", "dividido", "marco", "foto"], fondoVivo: "ninguno", disposicion: "todo", esquinas: "ninguna", entrada: "suave", apertura: "sobre", foto: u("1508615039623-a25605d2b022") },
    { nombre: "Lino", titulo: "raleway", texto: "raleway", ornamento: "ninguno", textura: "papel", ritmo: "uniforme", transicion: "recta", particulas: "ninguna", decoracion: "lineas", marco: false, bordes: "rectos", heroes: ["clasico", "editorial", "tarjeta", "foto", "dividido"], fondoVivo: "ninguno", disposicion: "todo", esquinas: "ninguna", entrada: "deslizar", apertura: "sobre", foto: u("1497366216548-37526070297c") },
    { nombre: "Trazo", titulo: "josefin", texto: "josefin", ornamento: "linea", textura: "ninguna", ritmo: "alternar", transicion: "recta", particulas: "ninguna", decoracion: "cuadricula", marco: true, bordes: "rectos", heroes: ["marco", "editorial", "clasico", "dividido", "tarjeta"], fondoVivo: "malla", disposicion: "todo", esquinas: "ninguna", entrada: "cortina", apertura: "destello", foto: u("1486406146926-c627a92ad1ab") },
    { nombre: "Calma", titulo: "cormorant", texto: "nunito", ornamento: "ninguno", textura: "ninguna", ritmo: "uniforme", transicion: "curva", particulas: "ninguna", decoracion: "puntos", marco: false, bordes: "redondos", heroes: ["tarjeta", "clasico", "foto", "editorial", "marco"], fondoVivo: "ondas", disposicion: "todo", esquinas: "ninguna", entrada: "suave", apertura: "sobre", foto: u("1500375592092-40eb2168fd21") },
  ],
  // ── Luxury: fondos oscuros, dorado fino, letra grande ────────────
  luxury: [
    { nombre: "Gala", titulo: "cinzel", texto: "raleway", ornamento: "linea", textura: "vineta", ritmo: "escena", transicion: "recta", particulas: "destellos", decoracion: "deco", marco: true, bordes: "rectos", heroes: ["marco", "clasico", "editorial", "tarjeta", "foto"], fondoVivo: "destello", disposicion: "portada", esquinas: "deco", entrada: "cortina", apertura: "telon", foto: u("1478760329108-5c3ed9d495a0") },
    { nombre: "Ámbar", titulo: "playfair", texto: "montserrat", ornamento: "diamante", textura: "seda", ritmo: "escena", transicion: "curva", particulas: "destellos", decoracion: "damasco", marco: false, bordes: "suaves", heroes: ["clasico", "tarjeta", "marco", "foto", "dividido"], fondoVivo: "aurora", disposicion: "bordes", esquinas: "filigrana", entrada: "sumergir", apertura: "telon", foto: u("1470337458703-46ad1756a187") },
    { nombre: "Ópera", titulo: "abril", texto: "raleway", ornamento: "linea", textura: "vineta", ritmo: "escena", transicion: "diagonal", particulas: "destellos", decoracion: "celosia", marco: true, bordes: "rectos", heroes: ["editorial", "marco", "foto", "clasico", "tarjeta"], fondoVivo: "destello", disposicion: "portada", esquinas: "deco", entrada: "zoom", apertura: "telon", foto: u("1531058020387-3be344556be6") },
    { nombre: "Terciopelo", titulo: "dmserif", texto: "montserrat", ornamento: "floral", textura: "seda", ritmo: "escena", transicion: "ondas", particulas: "destellos", decoracion: "geometria", marco: false, bordes: "suaves", heroes: ["foto", "clasico", "marco", "editorial", "tarjeta"], fondoVivo: "degradado", disposicion: "bordes", esquinas: "filigrana", entrada: "sumergir", apertura: "sobre", foto: u("1505373877841-8d25f7d46678") },
  ],
  // ── Romántica: blush, itálicas, la historia en primera persona ───
  romantica: [
    { nombre: "Romance", titulo: "greatvibes", texto: "lora", ornamento: "corazon", textura: "seda", ritmo: "alternar", transicion: "feston", particulas: "petalos", decoracion: "flores", marco: false, bordes: "redondos", heroes: ["clasico", "foto", "dividido", "tarjeta", "marco"], fondoVivo: "ondas", disposicion: "bordes", esquinas: "floral", entrada: "sumergir", apertura: "sobre", foto: u("1462275646964-a0e3386b89fa") },
    { nombre: "Blush", titulo: "parisienne", texto: "montserrat", ornamento: "floral", textura: "seda", ritmo: "alternar", transicion: "curva", particulas: "petalos", decoracion: "corazones", marco: false, bordes: "redondos", heroes: ["dividido", "clasico", "tarjeta", "foto", "editorial"], fondoVivo: "aurora", disposicion: "bordes", esquinas: "floral", entrada: "suave", apertura: "sobre", foto: u("1529636798458-92182e662485") },
    { nombre: "Cartas", titulo: "sacramento", texto: "lora", ornamento: "diamante", textura: "papel", ritmo: "alternar", transicion: "ondas", particulas: "petalos", decoracion: "mariposas", marco: true, bordes: "suaves", heroes: ["tarjeta", "marco", "clasico", "dividido", "foto"], fondoVivo: "ondas", disposicion: "bordes", esquinas: "filigrana", entrada: "cortina", apertura: "sobre", foto: u("1518199266791-5375a83190b7") },
    { nombre: "Atardecer", titulo: "dancing", texto: "nunito", ornamento: "corazon", textura: "grano", ritmo: "escena", transicion: "curva", particulas: "burbujas", decoracion: "ondas", marco: false, bordes: "redondos", heroes: ["foto", "tarjeta", "clasico", "dividido", "marco"], fondoVivo: "degradado", disposicion: "todo", esquinas: "ninguna", entrada: "zoom", apertura: "destello", foto: u("1470229722913-7c0e2dbbafd3") },
  ],
  // ── Floral: botánica que enmarca el texto, sin taparlo ───────────
  floral: [
    { nombre: "Jardín", titulo: "cormorant", texto: "raleway", ornamento: "hoja", textura: "papel", ritmo: "alternar", transicion: "curva", particulas: "hojas", decoracion: "eucalipto", marco: false, bordes: "redondos", heroes: ["dividido", "clasico", "foto", "marco", "editorial"], fondoVivo: "aurora", disposicion: "bordes", esquinas: "hojas", entrada: "suave", apertura: "sobre", foto: u("1518173946687-a4c8892bbd9f") },
    { nombre: "Peonía", titulo: "playfair", texto: "montserrat", ornamento: "floral", textura: "seda", ritmo: "alternar", transicion: "ondas", particulas: "petalos", decoracion: "peonias", marco: false, bordes: "suaves", heroes: ["clasico", "tarjeta", "dividido", "foto", "marco"], fondoVivo: "ondas", disposicion: "bordes", esquinas: "floral", entrada: "sumergir", apertura: "sobre", foto: u("1511795409834-ef04bbd61622") },
    { nombre: "Olivo", titulo: "libre", texto: "lora", ornamento: "hoja", textura: "papel", ritmo: "alternar", transicion: "feston", particulas: "hojas", decoracion: "olivo", marco: true, bordes: "suaves", heroes: ["marco", "clasico", "editorial", "tarjeta", "foto"], fondoVivo: "lineas", disposicion: "bordes", esquinas: "hojas", entrada: "cortina", apertura: "sobre", foto: u("1523438885200-e635ba2c371e") },
    { nombre: "Silvestre", titulo: "sacramento", texto: "quicksand", ornamento: "floral", textura: "grano", ritmo: "alternar", transicion: "curva", particulas: "petalos", decoracion: "flores", marco: false, bordes: "redondos", heroes: ["foto", "dividido", "tarjeta", "clasico", "editorial"], fondoVivo: "circulos", disposicion: "bordes", esquinas: "floral", entrada: "brinco", apertura: "destello", foto: u("1519741497674-611481863552") },
  ],
  // ── Moderna: geometría, contraste alto, color plano ──────────────
  moderna: [
    { nombre: "Neón", titulo: "bebas", texto: "montserrat", ornamento: "linea", textura: "grano", ritmo: "escena", transicion: "diagonal", particulas: "destellos", decoracion: "lineas", marco: false, bordes: "rectos", heroes: ["editorial", "foto", "clasico", "tarjeta", "dividido"], fondoVivo: "degradado", disposicion: "todo", esquinas: "ninguna", entrada: "zoom", apertura: "destello", foto: u("1502691876148-a84978e59af8") },
    { nombre: "Bloque", titulo: "oswald", texto: "raleway", ornamento: "linea", textura: "ninguna", ritmo: "alternar", transicion: "recta", particulas: "ninguna", decoracion: "geometria", marco: true, bordes: "rectos", heroes: ["marco", "editorial", "clasico", "dividido", "foto"], fondoVivo: "malla", disposicion: "todo", esquinas: "deco", entrada: "deslizar", apertura: "destello", foto: u("1486406146926-c627a92ad1ab") },
    { nombre: "Degradado", titulo: "poppins", texto: "poppins", ornamento: "ninguno", textura: "ninguna", ritmo: "escena", transicion: "curva", particulas: "burbujas", decoracion: "puntos", marco: false, bordes: "redondos", heroes: ["foto", "tarjeta", "editorial", "clasico", "dividido"], fondoVivo: "degradado", disposicion: "todo", esquinas: "ninguna", entrada: "sumergir", apertura: "destello", foto: u("1579546929518-9e396f3cc809") },
    { nombre: "Contraste", titulo: "josefin", texto: "josefin", ornamento: "diamante", textura: "grano", ritmo: "alternar", transicion: "diagonal", particulas: "ninguna", decoracion: "celosia", marco: false, bordes: "rectos", heroes: ["dividido", "editorial", "foto", "marco", "clasico"], fondoVivo: "lineas", disposicion: "portada", esquinas: "deco", entrada: "cortina", apertura: "telon", foto: u("1496307042754-b4aa456c4a2d") },
  ],
  // ── Editorial: como una revista ──────────────────────────────────
  editorial: [
    { nombre: "Revista", titulo: "montserrat", texto: "montserrat", ornamento: "linea", textura: "ninguna", ritmo: "uniforme", transicion: "recta", particulas: "ninguna", decoracion: "cuadricula", marco: false, bordes: "rectos", heroes: ["editorial", "dividido", "clasico", "marco", "foto"], fondoVivo: "ninguno", disposicion: "portada", esquinas: "ninguna", entrada: "deslizar", apertura: "sobre", foto: u("1497436072909-60f360e1d4b1") },
    { nombre: "Titular", titulo: "abril", texto: "raleway", ornamento: "linea", textura: "papel", ritmo: "alternar", transicion: "recta", particulas: "ninguna", decoracion: "lineas", marco: true, bordes: "rectos", heroes: ["editorial", "marco", "foto", "clasico", "tarjeta"], fondoVivo: "lineas", disposicion: "portada", esquinas: "deco", entrada: "cortina", apertura: "sobre", foto: u("1470813740244-df37b8c1edcb") },
    { nombre: "Columna", titulo: "libre", texto: "lora", ornamento: "diamante", textura: "grano", ritmo: "alternar", transicion: "diagonal", particulas: "ninguna", decoracion: "geometria", marco: false, bordes: "rectos", heroes: ["dividido", "editorial", "clasico", "foto", "marco"], fondoVivo: "malla", disposicion: "portada", esquinas: "ninguna", entrada: "suave", apertura: "sobre", foto: u("1441974231531-c6227db76b6e") },
    { nombre: "Portada", titulo: "bebas", texto: "nunito", ornamento: "linea", textura: "vineta", ritmo: "escena", transicion: "recta", particulas: "destellos", decoracion: "ninguna", marco: false, bordes: "rectos", heroes: ["foto", "editorial", "dividido", "clasico", "marco"], fondoVivo: "destello", disposicion: "todo", esquinas: "ninguna", entrada: "zoom", apertura: "telon", foto: u("1444703686981-a3abbc4d4fe3") },
  ],
  // ── Tropical: verdes, hojas y luz ────────────────────────────────
  tropical: [
    { nombre: "Monstera", titulo: "abril", texto: "raleway", ornamento: "hoja", textura: "papel", ritmo: "alternar", transicion: "ondas", particulas: "hojas", decoracion: "monstera", marco: false, bordes: "redondos", heroes: ["foto", "dividido", "clasico", "editorial", "tarjeta"], fondoVivo: "ondas", disposicion: "bordes", esquinas: "hojas", entrada: "suave", apertura: "destello", foto: u("1518895949257-7621c3c786d7") },
    { nombre: "Palmeras", titulo: "quicksand", texto: "quicksand", ornamento: "hoja", textura: "grano", ritmo: "alternar", transicion: "curva", particulas: "hojas", decoracion: "helecho", marco: false, bordes: "redondos", heroes: ["dividido", "foto", "tarjeta", "clasico", "editorial"], fondoVivo: "aurora", disposicion: "bordes", esquinas: "selva", entrada: "deslizar", apertura: "destello", foto: u("1502082553048-f009c37129b9") },
    { nombre: "Guanacaste", titulo: "playfair", texto: "montserrat", ornamento: "hoja", textura: "seda", ritmo: "alternar", transicion: "feston", particulas: "hojas", decoracion: "eucalipto", marco: false, bordes: "suaves", heroes: ["clasico", "foto", "marco", "dividido", "tarjeta"], fondoVivo: "ondas", disposicion: "bordes", esquinas: "hojas", entrada: "sumergir", apertura: "sobre", foto: u("1425913397330-cf8af2ff40a1") },
    { nombre: "Aventura", titulo: "bebas", texto: "nunito", ornamento: "hoja", textura: "grano", ritmo: "alternar", transicion: "diagonal", particulas: "hojas", decoracion: "helecho", marco: false, bordes: "rectos", heroes: ["foto", "editorial", "clasico", "dividido", "tarjeta"], fondoVivo: "degradado", disposicion: "bordes", esquinas: "selva", entrada: "zoom", apertura: "destello", foto: u("1506905925346-21bda4d32df4") },
  ],
  // ── Infantil: color vivo, formas redondas, sin marcas ────────────
  infantil: [
    { nombre: "Confeti", titulo: "fredoka", texto: "nunito", ornamento: "estrella", textura: "ninguna", ritmo: "alternar", transicion: "feston", particulas: "confeti", decoracion: "confeti", marco: false, bordes: "redondos", heroes: ["clasico", "tarjeta", "foto", "dividido", "editorial"], fondoVivo: "circulos", disposicion: "todo", esquinas: "ninguna", entrada: "brinco", apertura: "destello", foto: u("1530103862676-de8c9debad1d") },
    { nombre: "Globos", titulo: "baloo", texto: "quicksand", ornamento: "corazon", textura: "ninguna", ritmo: "alternar", transicion: "curva", particulas: "burbujas", decoracion: "globos", marco: false, bordes: "redondos", heroes: ["tarjeta", "clasico", "dividido", "foto", "marco"], fondoVivo: "ondas", disposicion: "bordes", esquinas: "ninguna", entrada: "brinco", apertura: "destello", foto: u("1513151233558-d860c5398176") },
    { nombre: "Expedición", titulo: "bebas", texto: "nunito", ornamento: "huella", textura: "grano", ritmo: "alternar", transicion: "curva", particulas: "hojas", decoracion: "dinosaurios", marco: false, bordes: "suaves", heroes: ["foto", "tarjeta", "clasico", "editorial", "dividido"], fondoVivo: "ondas", disposicion: "todo", esquinas: "selva", entrada: "zoom", apertura: "destello", foto: u("1472162072942-cd5147eb3902") },
    { nombre: "Estrellitas", titulo: "pacifico", texto: "quicksand", ornamento: "estrella", textura: "ninguna", ritmo: "escena", transicion: "curva", particulas: "estrellas", decoracion: "estrellas", marco: false, bordes: "redondos", heroes: ["clasico", "foto", "tarjeta", "marco", "dividido"], fondoVivo: "aurora", disposicion: "todo", esquinas: "estrellas", entrada: "zoom", apertura: "destello", foto: u("1602631985686-1bb0e6a8696e") },
  ],
  // ── Fiesta: confeti, neón, energía ───────────────────────────────
  fiesta: [
    { nombre: "Disco", titulo: "bebas", texto: "poppins", ornamento: "estrella", textura: "vineta", ritmo: "escena", transicion: "curva", particulas: "destellos", decoracion: "puntos", marco: false, bordes: "redondos", heroes: ["foto", "editorial", "clasico", "marco", "tarjeta"], fondoVivo: "aurora", disposicion: "todo", esquinas: "estrellas", entrada: "zoom", apertura: "destello", foto: u("1492684223066-81342ee5ff30") },
    { nombre: "Confeti Dorado", titulo: "poppins", texto: "poppins", ornamento: "estrella", textura: "ninguna", ritmo: "alternar", transicion: "feston", particulas: "confeti", decoracion: "confeti", marco: false, bordes: "redondos", heroes: ["clasico", "tarjeta", "foto", "dividido", "editorial"], fondoVivo: "circulos", disposicion: "todo", esquinas: "ninguna", entrada: "brinco", apertura: "destello", foto: u("1496337589254-7e19d01cec44") },
    { nombre: "Medianoche", titulo: "oswald", texto: "montserrat", ornamento: "linea", textura: "grano", ritmo: "escena", transicion: "diagonal", particulas: "destellos", decoracion: "terrazzo", marco: true, bordes: "rectos", heroes: ["editorial", "foto", "marco", "clasico", "dividido"], fondoVivo: "destello", disposicion: "portada", esquinas: "deco", entrada: "cortina", apertura: "telon", foto: u("1478147427282-58a87a120781") },
    { nombre: "Prisma", titulo: "josefin", texto: "quicksand", ornamento: "diamante", textura: "ninguna", ritmo: "alternar", transicion: "ondas", particulas: "burbujas", decoracion: "ondas", marco: false, bordes: "redondos", heroes: ["tarjeta", "foto", "dividido", "clasico", "editorial"], fondoVivo: "degradado", disposicion: "todo", esquinas: "ninguna", entrada: "sumergir", apertura: "destello", foto: u("1533158326339-7f3cf2404354") },
  ],
  // ── Corporativa: sobria, clara, con lugar para la marca ──────────
  corporativa: [
    { nombre: "Cumbre", titulo: "montserrat", texto: "montserrat", ornamento: "linea", textura: "ninguna", ritmo: "uniforme", transicion: "recta", particulas: "ninguna", decoracion: "lineas", marco: true, bordes: "rectos", heroes: ["marco", "editorial", "clasico", "tarjeta", "dividido"], fondoVivo: "ninguno", disposicion: "portada", esquinas: "deco", entrada: "suave", apertura: "sobre", foto: u("1511578314322-379afb476865") },
    { nombre: "Ejecutiva", titulo: "oswald", texto: "raleway", ornamento: "linea", textura: "grano", ritmo: "escena", transicion: "diagonal", particulas: "ninguna", decoracion: "geometria", marco: false, bordes: "rectos", heroes: ["editorial", "foto", "clasico", "dividido", "tarjeta"], fondoVivo: "degradado", disposicion: "portada", esquinas: "ninguna", entrada: "deslizar", apertura: "sobre", foto: u("1540317580384-e5d43616b9aa") },
    { nombre: "Institucional", titulo: "playfair", texto: "raleway", ornamento: "diamante", textura: "papel", ritmo: "alternar", transicion: "recta", particulas: "ninguna", decoracion: "laurel", marco: true, bordes: "rectos", heroes: ["marco", "clasico", "editorial", "tarjeta", "foto"], fondoVivo: "lineas", disposicion: "bordes", esquinas: "filigrana", entrada: "cortina", apertura: "sobre", foto: u("1517048676732-d65bc937f952") },
    { nombre: "Innovación", titulo: "poppins", texto: "poppins", ornamento: "linea", textura: "ninguna", ritmo: "alternar", transicion: "curva", particulas: "ninguna", decoracion: "celosia", marco: false, bordes: "redondos", heroes: ["editorial", "dividido", "clasico", "tarjeta", "foto"], fondoVivo: "malla", disposicion: "portada", esquinas: "ninguna", entrada: "zoom", apertura: "destello", foto: u("1556761175-5973dc0f32e7") },
  ],
};

/**
 * LAS APERTURAS POR ESTILO. El dueño (22 sep 2026): «no todas las
 * invitaciones pueden tener la misma entrada». Hay 45 (ver el esquema) y
 * acá se reparten: cada estilo usa las que le pegan —papel y luz suave
 * en lo elegante, confeti y glitch en lo moderno— y dentro del estilo
 * cada familia y cada portada toma una distinta, así dos diseños vecinos
 * del catálogo nunca se abren igual.
 */
const APERTURAS_POR_ESTILO: Record<string, readonly Apertura[]> = {
  elegante: ["sobre", "sobre_cera", "carta_doblada", "libro", "telon", "iris", "halo", "postal", "sobre_desliza", "puertas"],
  minimalista: ["funda", "persiana_v", "corte", "ripple", "zoom", "telon_alto", "pixeles", "franjas", "damero", "arena"],
  luxury: ["telon", "sobre_cera", "purpurina", "destello", "abanico", "iris", "halo", "espiral", "fuegos", "libro"],
  romantica: ["petalos", "sobre", "carta_doblada", "burbujas", "amanecer", "halo", "nieve", "ondas", "pergamino", "diptico"],
  floral: ["petalos", "hojas", "pergamino", "sobre", "ondas", "abanico", "iris", "libro", "amanecer", "funda"],
  moderna: ["glitch", "pixeles", "corte", "zoom", "franjas", "persiana", "cremallera", "ripple", "damero", "giro"],
  editorial: ["persiana", "franjas", "corte", "telon_alto", "mosaico", "cremallera", "giro", "postal", "pixeles", "zoom"],
  tropical: ["hojas", "ondas", "burbujas", "amanecer", "iris", "abanico", "humo", "rebote", "pergamino", "ripple"],
  infantil: ["confeti", "rebote", "burbujas", "estrellas", "mosaico", "damero", "chispas", "fuegos", "giro", "espiral"],
  fiesta: ["confeti", "fuegos", "chispas", "purpurina", "flash", "glitch", "destello", "rayo", "espiral", "telon"],
  corporativa: ["persiana_v", "telon_alto", "corte", "cremallera", "zoom", "franjas", "mosaico", "iris", "pixeles", "puertas"],
};

/**
 * La foto de AMBIENTE de cada tipo: cuatro por tipo, una por familia del
 * estilo. Antes la elegía la familia y en un evento corporativo «carta»
 * salían rosas: la foto tiene que hablar de la OCASIÓN, y el estilo se
 * nota en la paleta, las letras y los adornos. Unsplash, ids verificados
 * contra el CDN el 22 sep 2026.
 */
const FOTOS_TIPO: Record<TipoCelebracionId, readonly [string, string, string, string]> = {
  boda: ["1465495976277-4387d4b0b4c6", "1519225421980-715cb0215aed", "1522673607200-164d1b6ce486", "1487530811176-3780de880c2d"],
  cumpleanos: ["1513151233558-d860c5398176", "1464349153735-7db50ed83c84", "1530103862676-de8c9debad1d", "1492684223066-81342ee5ff30"],
  xv: ["1595777457583-95e059d581b8", "1519741497674-611481863552", "1496337589254-7e19d01cec44", "1522413452208-996ff3f3e740"],
  baby_shower: ["1555252333-9f8e92e65df9", "1516627145497-ae6968895b74", "1560184897-ae75f418493e", "1511795409834-ef04bbd61622"],
  bautizo: ["1438032005730-c779502df39b", "1523438885200-e635ba2c371e", "1508615039623-a25605d2b022", "1518173946687-a4c8892bbd9f"],
  graduacion: ["1541339907198-e08756dedf3f", "1524995997946-a1c2e315a42f", "1523580494863-6f3031224c94", "1627556704302-624286467c65"],
  aniversario: ["1516589178581-6cd7833ae3b2", "1470229722913-7c0e2dbbafd3", "1518199266791-5375a83190b7", "1522673607200-164d1b6ce486"],
  despedida: ["1519671482749-fd09be7ccebf", "1478147427282-58a87a120781", "1470337458703-46ad1756a187", "1529333166437-7750a6dd5a70"],
  fiesta: ["1492684223066-81342ee5ff30", "1496337589254-7e19d01cec44", "1502691876148-a84978e59af8", "1533158326339-7f3cf2404354"],
  corporativo: ["1511578314322-379afb476865", "1540317580384-e5d43616b9aa", "1517048676732-d65bc937f952", "1556761175-5973dc0f32e7"],
  otro: ["1522673607200-164d1b6ce486", "1500375592092-40eb2168fd21", "1441974231531-c6227db76b6e", "1486406146926-c627a92ad1ab"],
};

/**
 * Qué ESTILOS del catálogo tiene cada tipo de celebración. Es una
 * decisión de producto: un bautizo no lleva «fiesta» ni «corporativa»,
 * y un evento de empresa no lleva «infantil» ni «romántica». Lo que sí
 * aparece en el filtro tiene siempre sus veinte diseños; lo que no
 * aplica, no se ofrece (la galería oculta los estilos sin resultados).
 */
const CATEGORIAS_POR_TIPO: Record<TipoCelebracionId, readonly string[]> = {
  boda: ["elegante", "minimalista", "luxury", "romantica", "floral", "moderna", "editorial", "tropical", "fiesta"],
  cumpleanos: ["elegante", "minimalista", "luxury", "romantica", "floral", "moderna", "editorial", "tropical", "infantil", "fiesta"],
  xv: ["elegante", "minimalista", "luxury", "romantica", "floral", "moderna", "editorial", "tropical", "fiesta"],
  baby_shower: ["elegante", "minimalista", "luxury", "romantica", "floral", "moderna", "editorial", "tropical", "infantil"],
  bautizo: ["elegante", "minimalista", "luxury", "romantica", "floral", "moderna", "editorial", "tropical", "infantil"],
  graduacion: ["elegante", "minimalista", "luxury", "floral", "moderna", "editorial", "tropical", "fiesta", "corporativa"],
  aniversario: ["elegante", "minimalista", "luxury", "romantica", "floral", "moderna", "editorial", "tropical"],
  despedida: ["elegante", "minimalista", "luxury", "romantica", "floral", "moderna", "editorial", "tropical", "fiesta"],
  fiesta: ["elegante", "minimalista", "luxury", "floral", "moderna", "editorial", "tropical", "fiesta"],
  corporativo: ["elegante", "minimalista", "luxury", "moderna", "editorial", "tropical", "corporativa"],
  otro: ["elegante", "minimalista", "luxury", "romantica", "floral", "moderna", "editorial", "tropical", "infantil", "fiesta", "corporativa"],
};

type PerfilTipo = {
  caracter: Caracter;
  saludo: string;
  subtitulo: string;
  secciones: readonly TipoSeccion[];
  lugares: readonly string[];
  nombres: readonly string[];
};

const PERFIL: Record<TipoCelebracionId, PerfilTipo> = {
  boda: {
    caracter: "elegante",
    saludo: "Nos casamos",
    subtitulo: "Y queremos celebrarlo con vos",
    secciones: ["hero", "detalles", "countdown", "historia", "ubicacion", "itinerario", "dress_code", "galeria", "rsvp", "regalos", "mensaje"],
    lugares: ["Ceremonia", "Recepción"],
    nombres: ["Marfil", "Jardín Secreto", "Luz de Luna", "Eterno", "Seda", "Alba", "Champán", "Velo", "Olivo", "Brisa", "Perla", "Aurora", "Encaje", "Bosque", "Rosé", "Cielo Abierto", "Terciopelo", "Amanecer", "Lino", "Nácar", "Promesa", "Dorado", "Luna de Miel", "Cristal", "Pétalos", "Mar Serena", "Toscana", "Sal y Sol", "Vals", "Constelación", "Orquídea", "Carta de Amor", "Arena", "Bruma", "Peonía", "Medianoche", "Trébol", "Cedro", "Faro", "Siempre"],
  },
  cumpleanos: {
    caracter: "alegre",
    saludo: "¡Estás invitado!",
    subtitulo: "Vení a celebrar conmigo",
    secciones: ["hero", "countdown", "detalles", "ubicacion", "galeria", "rsvp", "regalos"],
    lugares: ["La fiesta"],
    nombres: ["Confeti", "Piñata", "Globos", "Fiesta de Colores", "Pastel", "Cohete", "Dinosaurios", "Safari", "Arcoíris", "Estrellas Fugaces", "Héroes", "Sirenas", "Jungla", "Espacio Exterior", "Circo", "Unicornio", "Piratas", "Chocolate", "Neón", "Retro", "Tropical", "Arcade", "Karaoke", "Picnic", "Fogata", "Vinilo", "Cine", "Jardín", "Deportes", "Helado", "Treinta", "Cuarenta", "Cincuenta", "Dorado", "Aventura", "Camping", "Fútbol", "Mariposas", "Princesas", "Carreras"],
  },
  xv: {
    caracter: "elegante",
    saludo: "Mis quince años",
    subtitulo: "Te espero para celebrar una noche inolvidable",
    secciones: ["hero", "detalles", "countdown", "ubicacion", "itinerario", "dress_code", "galeria", "rsvp", "regalos", "mensaje"],
    lugares: ["Ceremonia", "Fiesta"],
    nombres: ["Quinceañera", "Corona", "Vals", "Rosa Dorada", "Cenicienta", "Mariposa", "Jardín Encantado", "Estrella", "Diamante", "Lila", "Champagne", "Oro Rosa", "Perla Negra", "Tulipán", "Cristal", "Luna", "Glitter", "Terciopelo", "Coral", "Jazmín", "Sueño", "Noche de Gala", "Encanto", "Orquídea", "Rubí", "Cielo Rosa", "Aurora Boreal", "Baile", "Lazo", "Zafiro", "Nube", "Girasol", "Pastel", "Neón Rosa", "Arena", "Bohemia", "París", "Turquesa", "Brillos", "Menta"],
  },
  baby_shower: {
    caracter: "alegre",
    saludo: "Baby shower",
    subtitulo: "Vení a esperarlo con nosotros",
    secciones: ["hero", "countdown", "detalles", "ubicacion", "rsvp", "regalos", "mensaje"],
    lugares: ["El encuentro"],
    nombres: ["Nube", "Osito", "Lunita", "Cigüeña", "Sonajero", "Patitos", "Algodón", "Arcoíris Pastel", "Elefante", "Conejito", "Estrellita", "Globo Aerostático", "Jirafa", "Cuna", "Corazón", "Mariposa", "Bosque Encantado", "Safari Bebé", "Ovejita", "Menta", "Durazno", "Celeste", "Rosa Bebé", "Lavanda", "Nubes de Algodón", "Pequeño Príncipe", "Pequeña Princesa", "Es Niño", "Es Niña", "Sorpresa", "León", "Koala", "Zorrito", "Pajaritos", "Luna y Estrellas", "Panda", "Flores Bebé", "Bienvenida", "Ternura", "Primer Latido"],
  },
  bautizo: {
    caracter: "elegante",
    saludo: "Mi bautizo",
    subtitulo: "Acompañanos en este día tan especial",
    secciones: ["hero", "detalles", "ubicacion", "itinerario", "rsvp", "regalos", "mensaje"],
    lugares: ["Ceremonia", "Celebración"],
    nombres: ["Paloma", "Agua", "Cruz", "Luz", "Ángel", "Fe", "Concha", "Lirio", "Bendición", "Cielo", "Olivo", "Vela", "Pergamino", "Blanco Puro", "Dorado Suave", "Nube", "Lino", "Marfil Bebé", "Alba", "Manantial", "Perla", "Gracia", "Esperanza", "Paz", "Rosario", "Trigo", "Corderito", "Estrella", "Halo", "Río", "Jazmín", "Pluma", "Celeste Claro", "Serenidad", "Amanecer", "Gota", "Camino", "Promesa", "Sencillo", "Sagrado"],
  },
  graduacion: {
    caracter: "formal",
    saludo: "Graduación",
    subtitulo: "Un logro que quiero compartir con vos",
    secciones: ["hero", "detalles", "countdown", "ubicacion", "itinerario", "dress_code", "rsvp", "mensaje"],
    lugares: ["Acto de graduación", "Celebración"],
    nombres: ["Birrete", "Diploma", "Toga", "Laurel", "Éxito", "Meta", "Camino", "Horizonte", "Cima", "Promoción", "Generación", "Orgullo", "Futuro", "Página Nueva", "Vuelo", "Constelación", "Esfuerzo", "Medalla", "Campus", "Aula", "Tinta", "Brújula", "Escalera", "Podio", "Cohete", "Logro", "Nuevo Capítulo", "Alas", "Sello", "Trayecto", "Académico", "Moderno", "Noche de Grado", "Estrella", "Título", "Mérito", "Bravo", "Puente", "Sol", "Cumbre"],
  },
  aniversario: {
    caracter: "elegante",
    saludo: "Nuestro aniversario",
    subtitulo: "Celebrá con nosotros",
    secciones: ["hero", "historia", "detalles", "ubicacion", "galeria", "rsvp", "mensaje"],
    lugares: ["La celebración"],
    nombres: ["Plata", "Oro", "Rubí", "Zafiro", "Esmeralda", "Diamante", "Perla", "Coral", "Bronce", "Cristal", "Amor Eterno", "Veinticinco", "Cincuenta", "Juntos", "Historia", "Raíces", "Camino Andado", "Dos Copas", "Vals de Siempre", "Baúl", "Cartas", "Retrato", "Jardín", "Vino", "Atardecer", "Luna Llena", "Roble", "Hogar", "Manos", "Recuerdos", "Sepia", "Rosas", "Faro", "Marea", "Compañía", "Promesa Renovada", "Fuego", "Nido", "Todavía", "Siempre"],
  },
  despedida: {
    caracter: "moderno",
    saludo: "Despedida",
    subtitulo: "Una última fiesta antes de lo que viene",
    secciones: ["hero", "countdown", "detalles", "ubicacion", "dress_code", "rsvp", "faq"],
    lugares: ["Punto de encuentro"],
    nombres: ["Hasta Pronto", "Nuevo Rumbo", "Maleta", "Pasaporte", "Brindis", "Última Noche", "Adiós Soltera", "Adiós Soltero", "Playa", "Cóctel", "Viaje", "Mapa", "Avión", "Brújula", "Camino", "Recuerdos", "Buen Viento", "Ancla", "Oficina", "Colegas", "Farewell", "Copas", "Luces", "Karaoke", "Fogata", "Terraza", "Neón", "Retro", "Tropical", "Bon Voyage", "Puerto", "Horizonte", "Estación", "Vuelo", "Sueños", "Mochila", "Fiesta Blanca", "Sombrero", "Champán", "Cierre"],
  },
  fiesta: {
    caracter: "moderno",
    saludo: "¡Fiesta!",
    subtitulo: "Reservá la fecha",
    secciones: ["hero", "countdown", "detalles", "ubicacion", "dress_code", "rsvp", "faq"],
    lugares: ["La fiesta"],
    nombres: ["Neón", "Disco", "Confeti Dorado", "Noche Blanca", "Glitter", "Retro", "Tropical", "Noche de Brujas", "Año Nuevo", "Navidad", "Carnaval", "Fogata", "Terraza", "Piscina", "Luces", "Vinilo", "Karaoke", "Temática", "Máscaras", "Gala", "Bohemia", "Flúor", "Rooftop", "Jardín de Noche", "Verano", "Invierno", "Luna Park", "Circo", "Casino", "Hawaiana", "Mexicana", "Años Ochenta", "Años Noventa", "Techno", "Jazz", "Salsa", "Fuegos Artificiales", "Picnic", "After Office", "Sorpresa"],
  },
  corporativo: {
    caracter: "formal",
    saludo: "Invitación",
    subtitulo: "Nos complace invitarle",
    secciones: ["hero", "detalles", "ubicacion", "itinerario", "faq", "rsvp", "mensaje"],
    lugares: ["Sede del evento"],
    nombres: ["Anual", "Lanzamiento", "Cumbre", "Conferencia", "Networking", "Premiación", "Gala Corporativa", "Inauguración", "Aniversario Empresa", "Fin de Año", "Capacitación", "Taller", "Congreso", "Feria", "Presentación", "Junta", "Convención", "Reconocimiento", "Cena de Negocios", "Team Building", "Firma", "Apertura", "Ronda", "Panel", "Cóctel Empresarial", "Foro", "Innovación", "Marca", "Azul Corporativo", "Grafito", "Pizarra", "Cristal", "Acero", "Nogal", "Minimal", "Ejecutivo", "Tecnológico", "Startup", "Clásico", "Moderno"],
  },
  otro: {
    caracter: "moderno",
    saludo: "Te invitamos",
    subtitulo: "Vení a celebrar con nosotros",
    secciones: ["hero", "countdown", "detalles", "ubicacion", "rsvp", "mensaje"],
    lugares: ["Lugar"],
    nombres: ["Reunión", "Celebración", "Brindis", "Encuentro", "Fiesta Sorpresa", "Cena", "Almuerzo", "Café", "Picnic", "Tarde", "Noche", "Jardín", "Casa", "Terraza", "Playa", "Montaña", "Río", "Bosque", "Ciudad", "Pueblo", "Primavera", "Verano", "Otoño", "Invierno", "Luz", "Color", "Blanco", "Negro", "Azul", "Verde", "Rojo", "Amarillo", "Rosa", "Lila", "Dorado", "Plata", "Simple", "Alegre", "Elegante", "Libre"],
  },
};



function slugDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const COPY = {
  countdown: { titulo: "Faltan", texto: "para el gran día" },
  detalles: { titulo: "Agendá la fecha", texto: "Una tarde para celebrar — y toda una noche para acompañarnos." },
  ubicacion: { titulo: "Dónde" },
  historia: { titulo: "Nuestra historia", texto: "Acá va la historia que quieran contar: cómo empezó todo, qué los trajo hasta este día." },
  galeria: { titulo: "Momentos" },
  dress_code: { titulo: "Código de vestimenta", texto: "Ayudanos a que la noche se vea tan linda como la imaginamos." },
  itinerario: { titulo: "El programa" },
  rsvp: { titulo: "¿Nos acompañás?", texto: "Tu presencia es nuestro mayor regalo. Confirmá antes de la fecha límite para reservar tu lugar.", boton: "Confirmar asistencia" },
  regalos: { titulo: "Muestras de cariño", texto: "Tu compañía es lo más importante. Si además querés tener un gesto con nosotros, acá te dejamos opciones." },
  mensaje: { titulo: "Con amor", texto: "Gracias por ser parte de este día. Te esperamos con todo el cariño.", firma: "" },
  faq: { titulo: "Preguntas frecuentes" },
} as const;

/** Los grupos del código de vestimenta que traen las plantillas formales. */
const GRUPOS_FORMALES = [
  { titulo: "Caballeros", texto: "Traje oscuro, con corbata o corbatín." },
  { titulo: "Damas", texto: "Vestido largo o midi, en tonos joya." },
];

/** El programa de ejemplo por tipo (la persona lo cambia en el editor). */
const PROGRAMA: Partial<Record<TipoCelebracionId, readonly { hora: string; titulo: string; detalle: string }[]>> = {
  boda: [
    { hora: "4:00 p. m.", titulo: "Ceremonia", detalle: "Bajo los árboles del jardín." },
    { hora: "5:30 p. m.", titulo: "Brindis y cóctel", detalle: "" },
    { hora: "7:00 p. m.", titulo: "Cena", detalle: "" },
    { hora: "9:00 p. m.", titulo: "Fiesta", detalle: "Hasta que el cuerpo aguante." },
  ],
  xv: [
    { hora: "5:00 p. m.", titulo: "Misa de acción de gracias", detalle: "" },
    { hora: "7:00 p. m.", titulo: "Recepción", detalle: "" },
    { hora: "8:00 p. m.", titulo: "Vals y brindis", detalle: "" },
    { hora: "9:00 p. m.", titulo: "Fiesta", detalle: "" },
  ],
  graduacion: [
    { hora: "6:00 p. m.", titulo: "Acto de graduación", detalle: "" },
    { hora: "8:00 p. m.", titulo: "Cena de celebración", detalle: "" },
  ],
  corporativo: [
    { hora: "8:30 a. m.", titulo: "Registro y café", detalle: "" },
    { hora: "9:00 a. m.", titulo: "Apertura", detalle: "" },
    { hora: "12:30 p. m.", titulo: "Almuerzo", detalle: "" },
    { hora: "5:00 p. m.", titulo: "Cierre y networking", detalle: "" },
  ],
  bautizo: [
    { hora: "10:00 a. m.", titulo: "Ceremonia", detalle: "" },
    { hora: "12:00 p. m.", titulo: "Almuerzo familiar", detalle: "" },
  ],
};

function seccion(tipo: TipoSeccion, perfil: PerfilTipo, tipoCelebracion: TipoCelebracionId, id: string, portada?: { heroe: Heroe; foto: string }): Seccion {
  const base = { id, visible: true, diseno: DISENO_SECCION_POR_DEFECTO } as const;
  const formal = perfil.caracter === "elegante" || perfil.caracter === "formal";
  switch (tipo) {
    case "hero": {
      // Cada portada usa la foto donde le luce: a pantalla completa, dentro
      // del arco o de la tarjeta, o de ambiente detrás del texto. Antes las
      // que tienen hueco de foto (arco, tarjeta) salían con un degradado gris.
      const enSuHueco = portada?.heroe === "foto" || portada?.heroe === "dividido" || portada?.heroe === "tarjeta" || portada?.heroe === "editorial";
      return {
        ...base,
        tipo,
        diseno: { ...DISENO_SECCION_POR_DEFECTO, fondoUrl: portada && !enSuHueco ? portada.foto : "" },
        datos: { saludo: perfil.saludo, titulo: "", subtitulo: perfil.subtitulo, fotoUrl: portada && enSuHueco ? portada.foto : "", mostrarFecha: true },
      };
    }
    case "countdown":
      return { ...base, tipo, datos: { ...COPY.countdown } };
    case "detalles":
      return { ...base, tipo, datos: { ...COPY.detalles } };
    case "ubicacion":
      return {
        ...base,
        tipo,
        datos: { titulo: COPY.ubicacion.titulo, lugares: perfil.lugares.map((t) => ({ titulo: t, lugar: "", direccion: "", hora: "", mapsUrl: "" })) },
      };
    case "historia":
      return { ...base, tipo, datos: { ...COPY.historia, fotoUrl: "" } };
    case "galeria":
      return { ...base, tipo, datos: { titulo: COPY.galeria.titulo, fotos: [] } };
    case "dress_code":
      return {
        ...base,
        tipo,
        datos: { ...COPY.dress_code, grupos: formal ? GRUPOS_FORMALES.map((g) => ({ ...g })) : [], colores: [] },
      };
    case "itinerario":
      return { ...base, tipo, datos: { titulo: COPY.itinerario.titulo, items: (PROGRAMA[tipoCelebracion] ?? []).map((m) => ({ ...m })) } };
    case "rsvp":
      return {
        ...base,
        tipo,
        datos: { ...COPY.rsvp, fechaLimite: "", whatsapp: "", modo: "panel", pedirPersonas: true, pedirContacto: false, preguntas: PREGUNTAS_RSVP_POR_DEFECTO.map((q) => ({ ...q, opciones: [...q.opciones] })) },
      };
    case "regalos":
      return { ...base, tipo, datos: { ...COPY.regalos, items: [], sinpe: "" } };
    case "mensaje":
      return { ...base, tipo, datos: { ...COPY.mensaje } };
    case "faq":
      return {
        ...base,
        tipo,
        datos: {
          titulo: COPY.faq.titulo,
          items: [
            { pregunta: "¿Puedo llevar acompañante?", respuesta: "Indicalo al confirmar tu asistencia." },
            { pregunta: "¿Hay parqueo?", respuesta: "Sí, en el mismo lugar." },
          ],
        },
      };
  }
}

/** Los ids de sección de una plantilla son fijos (p. ej. `hero`, `rsvp`): así el editor los reconoce entre versiones. */
function documentoDe(perfil: PerfilTipo, tipo: TipoCelebracionId, estilo: Estilo, slug: string, foto: string): Documento {
  return {
    version: 1,
    plantilla: slug,
    estilo,
    secciones: perfil.secciones.map((t) => seccion(t, perfil, tipo, t, { heroe: estilo.heroe, foto })),
    musica: MUSICA_VACIA,
  };
}

const HEROE_TEXTO: Record<Heroe, string> = {
  clasico: "portada clásica a pantalla completa",
  foto: "foto a pantalla completa",
  tarjeta: "tarjeta sobre la escena",
  marco: "marco doble con esquinas",
  dividido: "nombres arriba y foto en arco",
  editorial: "portada editorial",
};

/** Cuántos diseños hay por (tipo, estilo): 4 familias × 5 portadas. */
export const POR_ESTILO = 20;
const VARIANTES = 5;

/**
 * El mismo estilo, dicho en el idioma de la ocasión: una «carta» elegante
 * lleva ramos y pétalos en una boda, pero en un evento de empresa eso se
 * ve fuera de lugar. Acá se cambian solo los adornos que chocan; la
 * paleta, las letras y la estructura de la familia se respetan.
 */
function ajustarAlTipo(fam: Familia, tipo: TipoCelebracionId): Familia {
  const sobrio = tipo === "corporativo" || tipo === "graduacion";
  const solemne = tipo === "bautizo" || tipo === "baby_shower";
  const f = { ...fam };
  if (sobrio) {
    if (f.esquinas === "floral" || f.esquinas === "hojas" || f.esquinas === "selva") f.esquinas = "deco";
    if (["peonias", "flores", "mariposas", "corazones", "damasco"].includes(f.decoracion)) f.decoracion = "laurel";
    if (["globos", "confeti", "dinosaurios", "terrazzo"].includes(f.decoracion)) f.decoracion = "geometria";
    if (f.particulas === "petalos" || f.particulas === "confeti" || f.particulas === "burbujas") f.particulas = "destellos";
    if (f.ornamento === "corazon" || f.ornamento === "huella" || f.ornamento === "anillos") f.ornamento = "linea";
  }
  if (solemne) {
    // Un bautizo «infantil» es dulce, no una fiesta de dinosaurios.
    if (["dinosaurios", "globos", "terrazzo"].includes(f.decoracion)) f.decoracion = "estrellas";
    if (f.esquinas === "selva") f.esquinas = "hojas";
    if (f.ornamento === "huella") f.ornamento = "estrella";
  }
  if (tipo !== "boda" && tipo !== "aniversario" && f.decoracion === "anillos") f.decoracion = "ondas";
  return f;
}

export function plantillasDeTipo(tipo: TipoCelebracionId): PlantillaGenerada[] {
  const perfil = PERFIL[tipo];
  const paletas = PALETAS[tipo];
  const salida: PlantillaGenerada[] = [];
  let i = 0;
  for (const categoria of CATEGORIAS_POR_TIPO[tipo]) {
    const familias = FAMILIAS[categoria];
    for (let k = 0; k < familias.length; k++) {
      const fam = ajustarAlTipo(familias[k], tipo);
      for (let variante = 0; variante < VARIANTES; variante++) {
        // La paleta se desplaza con la familia y la variante para que dos
        // tarjetas vecinas del catálogo nunca compartan color.
        const paleta = paletas[(k * 3 + variante) % paletas.length];
        const heroe = fam.heroes[variante];
        const tema = perfil.nombres[i % perfil.nombres.length];
        const nombre = `${fam.nombre} ${paleta.nombre}`;
        const slug = `${tipo.replace(/_/g, "-")}-${categoria}-${slugDe(fam.nombre)}-${variante + 1}`;
        const estilo: Estilo = {
          paleta: {
            fondo: paleta.fondo,
            tinta: paleta.tinta,
            acento: paleta.acento,
            suave: paleta.suave,
            superficie: paleta.superficie,
            escena: paleta.escena,
            tintaEscena: paleta.tintaEscena,
          },
          fuenteTitulo: fam.titulo,
          fuenteTexto: fam.texto,
          heroe,
          decoracion: fam.decoracion,
          bordes: fam.bordes,
          animaciones: true,
          ornamento: fam.ornamento,
          textura: fam.textura,
          ritmo: fam.ritmo,
          transicion: fam.transicion,
          particulas: fam.particulas,
          marco: fam.marco,
          // La quinta variante de cada familia es su versión quieta.
          fondoVivo: variante === VARIANTES - 1 ? "ninguno" : fam.fondoVivo,
          fondoIntensidad: "media",
          fondoVelocidad: "media",
          // Fino en las variantes pares, medio en las impares: dos densidades por familia.
          decoracionEscala: variante % 2 === 0 ? "media" : "fina",
          // Arranca sutil y, si el motivo es denso, solo como guirnalda arriba y
          // abajo: el patrón detrás del texto hacía los diseños difíciles de leer
          // (el dueño, 21 sep 2026). La persona lo sube desde Estilo si quiere.
          decoracionIntensidad: "sutil",
          decoracionDisposicion: fam.disposicion === "todo" && !MOTIVOS_LIVIANOS.has(fam.decoracion) ? "bordes" : fam.disposicion,
          esquinas: fam.esquinas,
          entrada: fam.entrada,
          // Todas llegan cerradas, y cada una con una entrada distinta
          // (45 en total): la familia y la portada eligen cuál.
          apertura: (APERTURAS_POR_ESTILO[categoria] ?? APERTURAS_POR_ESTILO.elegante)[(k * VARIANTES + variante) % (APERTURAS_POR_ESTILO[categoria] ?? APERTURAS_POR_ESTILO.elegante).length],
          // El catálogo generado no lleva tema: los temas se arman a mano (demos, editor).
          tema: "ninguno",
        };
        // Todo el catálogo es gratis: lo que se cobra es PUBLICAR (decisión del
        // dueño, 21 sep 2026). «premium» queda como rótulo de las más
        // elaboradas, sin costo.
        const premium = variante === 3;
        salida.push({
          slug,
          nombre,
          categoria_id: categoria,
          nivel: premium ? "premium" : "gratis",
          costo_creditos: 0,
          tipos_evento: [tipo],
          descripcion: `${tema} · ${paleta.nombre} · ${HEROE_TEXTO[heroe]}${fam.particulas !== "ninguna" ? ` · ${fam.particulas}` : ""}.`,
          esquema: documentoDe(perfil, tipo, estilo, slug, u(FOTOS_TIPO[tipo][k])),
          estilos: estilo,
          orden: i + 1,
        });
        i++;
      }
    }
  }
  return salida;
}

export function generarPlantillas(): PlantillaGenerada[] {
  return TIPOS_CELEBRACION.flatMap((t) => plantillasDeTipo(t.id));
}
