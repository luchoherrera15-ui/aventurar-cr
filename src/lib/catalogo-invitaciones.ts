/**
 * El catálogo de invitaciones de muestra: cada fila es una demo viva
 * en /i/{slug}. Para sumar un diseño nuevo al catálogo basta con
 * sembrar su invitación demo y agregar acá su entrada.
 */
export type DemoInvitacion = {
  slug: string;
  nombre: string;
  ocasion: string;
  descripcion: string;
  /** Clases del lienzo de la mini-card (gradiente representativo). */
  lienzo: string;
  /** Emoji distintivo de la card. */
  emoji: string;
};

export const CATALOGO_INVITACIONES: DemoInvitacion[] = [
  {
    slug: "demo-invitacion",
    nombre: "Marfil & Champán",
    ocasion: "Bodas",
    descripcion:
      "Elegancia clásica en cremas y dorado: sobre lacrado, cuenta regresiva y el carrito de recién casados.",
    lienzo: "bg-[linear-gradient(150deg,#faf7f2_0%,#f0e7d8_60%,#e3d3b5_100%)]",
    emoji: "💍",
  },
  {
    slug: "demo-formal",
    nombre: "Gala de Etiqueta",
    ocasion: "Aniversarios y galas",
    descripcion:
      "Negro humo, marfil y dorado con líneas que se dibujan al scrollear — código de vestimenta incluido.",
    lienzo: "bg-[linear-gradient(150deg,#14120f_0%,#2a2418_60%,#4a3b22_100%)]",
    emoji: "🥂",
  },
  {
    slug: "demo-aracnida",
    nombre: "Héroe Arácnido",
    ocasion: "Cumples infantiles",
    descripcion:
      "Estilo cómic rojo y azul: la araña baja por su hilo, telarañas y onomatopeyas por toda la pantalla.",
    lienzo: "bg-[linear-gradient(150deg,#e62429_0%,#a51c22_45%,#2b3a8f_100%)]",
    emoji: "🕷️",
  },
  {
    slug: "demo-zoologico",
    nombre: "Safari de Colores",
    ocasion: "Cumples infantiles",
    descripcion:
      "Un zoológico que se anima al scrollear: la jirafa crece, el mono se columpia y el elefante saluda.",
    lienzo: "bg-[linear-gradient(150deg,#f7c948_0%,#8bc34a_55%,#2e7d32_100%)]",
    emoji: "🦒",
  },
];
