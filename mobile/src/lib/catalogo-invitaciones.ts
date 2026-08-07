import type { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";

/**
 * El catálogo de invitaciones de muestra — espejo de
 * src/lib/catalogo-invitaciones.ts de /web. Si se agrega un diseño
 * allá, agregarlo acá (dos proyectos npm independientes, en paridad a
 * mano).
 *
 * Los lienzos son azules SÓLIDOS de la paleta, no degradados: la misma
 * escala navy → blue que usa la vitrina de la web.
 */

/** Las pestañas de la vitrina — espejo de la web, mismo orden. */
export const CATEGORIAS_INVITACIONES = [
  { id: "infantiles", label: "Fiestas Infantiles" },
  { id: "bodas", label: "Bodas" },
  { id: "quince", label: "Quince Años" },
  { id: "general", label: "Fiestas en General" },
  { id: "corporativas", label: "Invitaciones Corporativas" },
] as const;

export type CategoriaInvitacion = (typeof CATEGORIAS_INVITACIONES)[number]["id"];

export type DemoInvitacion = {
  slug: string;
  nombre: string;
  /** La pestaña donde vive. */
  categoria: CategoriaInvitacion;
  ocasion: string;
  descripcion: string;
  /** Color de fondo del lienzo de la mini-card. */
  lienzo: string;
  /** Ionicons: nada de emojis, el catálogo se vende formal. */
  icono: keyof typeof Ionicons.glyphMap;
  /** Color del ícono sobre el lienzo. */
  tintaIcono: string;
};

export const CATALOGO_INVITACIONES: DemoInvitacion[] = [
  {
    slug: "demo-boda-estandar",
    categoria: "bodas",
    nombre: "Seda & Marfil",
    ocasion: "Bodas",
    descripcion:
      "Una sola pantalla en blanco y seda: nombres en serif, cuenta regresiva viva y confirmación por WhatsApp.",
    lienzo: Colors.navy,
    icono: "heart-outline",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "demo-boda-premium",
    categoria: "bodas",
    nombre: "Carta de Amor",
    ocasion: "Bodas",
    descripcion:
      "Un sobre lacrado que se abre con música: capítulos, código de vestimenta y confirmación de asistencia.",
    lienzo: Colors.navy2,
    icono: "mail-open-outline",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "demo-invitacion",
    categoria: "bodas",
    nombre: "Marfil & Champán",
    ocasion: "Bodas",
    descripcion:
      "Elegancia clásica: sobre lacrado, cuenta regresiva y el carrito de recién casados.",
    lienzo: Colors.navy,
    icono: "heart",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "demo-formal",
    categoria: "general",
    nombre: "Gala de Etiqueta",
    ocasion: "Aniversarios y galas",
    descripcion:
      "Líneas que se dibujan al scrollear — código de vestimenta incluido.",
    lienzo: Colors.navy2,
    icono: "sparkles",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "demo-aracnida",
    categoria: "infantiles",
    nombre: "Héroe Arácnido",
    ocasion: "Cumples infantiles",
    descripcion:
      "Estilo cómic: la araña baja por su hilo, telarañas y onomatopeyas por toda la pantalla.",
    lienzo: Colors.navy3,
    icono: "star",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "demo-zoologico",
    categoria: "infantiles",
    nombre: "Safari de Colores",
    ocasion: "Cumples infantiles",
    descripcion:
      "Un zoológico que se anima al scrollear: la jirafa crece y el mono se columpia.",
    lienzo: Colors.blue,
    icono: "balloon",
    tintaIcono: "rgba(255,255,255,0.95)",
  },
  {
    slug: "demo-magia",
    categoria: "infantiles",
    nombre: "Academia Candelaria",
    ocasion: "Cumples infantiles",
    descripcion:
      "La carta de admisión se abre con su lacre, suena el vals y el búho cruza la noche.",
    lienzo: Colors.navy,
    icono: "sparkles",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "demo-dinosaurios",
    categoria: "infantiles",
    nombre: "Selva Jurásica",
    ocasion: "Cumples infantiles",
    descripcion:
      "El dinosaurio camina mientras bajás, las huellas marcan el camino y el huevo se abre.",
    lienzo: Colors.navy3,
    icono: "footsteps",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "demo-princesas",
    categoria: "infantiles",
    nombre: "Castillo Encantado",
    ocasion: "Cumples infantiles",
    descripcion:
      "El telón se abre y el castillo se levanta: torres que se encienden y polvo de hadas.",
    lienzo: Colors.blueLight,
    icono: "sparkles-outline",
    tintaIcono: Colors.navy,
  },
  {
    slug: "demo-quince-anos",
    categoria: "quince",
    nombre: "Corona de Raso",
    ocasion: "Quince años",
    descripcion:
      "Borgoña de noche y oro rosa: el XV se arma con destellos y una cinta de raso se desenrolla al bajar.",
    lienzo: Colors.navy2,
    icono: "sparkles",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "demo-corporativa",
    categoria: "corporativas",
    nombre: "Protocolo",
    ocasion: "Eventos de empresa",
    descripcion:
      "Navy y dorado tenue: agenda de la noche que se traza sola y confirmación en línea.",
    lienzo: Colors.navy,
    icono: "business-outline",
    tintaIcono: "rgba(255,255,255,0.9)",
  },
  {
    slug: "revelacion-maria-jesus-y-luis",
    categoria: "general",
    nombre: "¿Niño o Niña?",
    ocasion: "Revelación de género",
    descripcion:
      "La gran pregunta: fotos a marco completo y la confirmación en un toque.",
    lienzo: Colors.blueLight,
    icono: "balloon-outline",
    tintaIcono: Colors.navy,
  },
];
