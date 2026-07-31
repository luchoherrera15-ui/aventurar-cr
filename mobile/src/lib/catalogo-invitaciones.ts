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

export type DemoInvitacion = {
  slug: string;
  nombre: string;
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
    slug: "demo-invitacion",
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
    nombre: "Safari de Colores",
    ocasion: "Cumples infantiles",
    descripcion:
      "Un zoológico que se anima al scrollear: la jirafa crece y el mono se columpia.",
    lienzo: Colors.blue,
    icono: "balloon",
    tintaIcono: "rgba(255,255,255,0.95)",
  },
  {
    slug: "revelacion-maria-jesus-y-luis",
    nombre: "¿Niño o Niña?",
    ocasion: "Revelación de género",
    descripcion:
      "La gran pregunta: fotos a marco completo y la confirmación en un toque.",
    lienzo: Colors.blueLight,
    icono: "balloon-outline",
    tintaIcono: Colors.navy,
  },
];
