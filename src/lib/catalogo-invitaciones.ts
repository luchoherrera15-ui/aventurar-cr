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
  /** Ícono de línea de la card (se resuelve en la landing) — nada de
   *  emojis: el catálogo se vende formal. */
  icono: "corazon" | "destellos" | "estrella" | "globos" | "globo";
  /** Color del ícono sobre el lienzo. */
  iconoClase: string;
};

export const CATALOGO_INVITACIONES: DemoInvitacion[] = [
  {
    slug: "demo-invitacion",
    nombre: "Marfil & Champán",
    ocasion: "Bodas",
    descripcion:
      "Elegancia clásica en cremas y dorado: sobre lacrado, cuenta regresiva y el carrito de recién casados.",
    lienzo: "bg-[linear-gradient(150deg,#faf7f2_0%,#f0e7d8_60%,#e3d3b5_100%)]",
    icono: "corazon",
    iconoClase: "text-[#8a6a3f]",
  },
  {
    slug: "demo-formal",
    nombre: "Gala de Etiqueta",
    ocasion: "Aniversarios y galas",
    descripcion:
      "Negro humo, marfil y dorado con líneas que se dibujan al scrollear — código de vestimenta incluido.",
    lienzo: "bg-[linear-gradient(150deg,#14120f_0%,#2a2418_60%,#4a3b22_100%)]",
    icono: "destellos",
    iconoClase: "text-[#d9b96a]",
  },
  {
    slug: "demo-aracnida",
    nombre: "Héroe Arácnido",
    ocasion: "Cumples infantiles",
    descripcion:
      "Estilo cómic rojo y azul: la araña baja por su hilo, telarañas y onomatopeyas por toda la pantalla.",
    lienzo: "bg-[linear-gradient(150deg,#e62429_0%,#a51c22_45%,#2b3a8f_100%)]",
    icono: "estrella",
    iconoClase: "text-white/90",
  },
  {
    slug: "demo-zoologico",
    nombre: "Safari de Colores",
    ocasion: "Cumples infantiles",
    descripcion:
      "Un zoológico que se anima al scrollear: la jirafa crece, el mono se columpia y el elefante saluda.",
    lienzo: "bg-[linear-gradient(150deg,#f7c948_0%,#8bc34a_55%,#2e7d32_100%)]",
    icono: "globos",
    iconoClase: "text-white/95",
  },
  {
    slug: "revelacion-maria-jesus-y-luis",
    nombre: "¿Niño o Niña?",
    ocasion: "Revelación de género",
    descripcion:
      "Rosa y celeste para la gran pregunta: fotos a marco completo y la confirmación en un toque.",
    lienzo: "bg-[linear-gradient(150deg,#f9c5d1_0%,#f3e8ee_50%,#a8d8ea_100%)]",
    icono: "globo",
    iconoClase: "text-[#9c7186]",
  },
];
