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
  /** Clases del lienzo de la mini-card: azul sólido de la paleta de la
   *  marca (navy → blue), nada de gradientes. */
  lienzo: string;
  /** Ícono de línea de la card (se resuelve en la landing) — nada de
   *  emojis: el catálogo se vende formal. */
  icono: "corazon" | "destellos" | "estrella" | "globos" | "globo";
  /** Color del ícono sobre el lienzo. */
  iconoClase: string;
  /**
   * Los colores REALES del diseño, para poder mostrar una muestra de
   * cómo se ve sin abrirla. Los usa la landing nueva
   * (/invitaciones2): una fila de cards de texto todas iguales no
   * "muestra ejemplos" — muestra una lista. Con esto cada card se ve
   * como la invitación que representa.
   *
   * Opcional a propósito: una demo nueva funciona sin declararlos y
   * cae al color por defecto, en vez de romper la página.
   */
  muestra?: {
    /** El lienzo de la invitación. */
    fondo: string;
    /** El texto sobre ese lienzo. */
    tinta: string;
    /** El detalle: filetes, ornamentos, la fecha. */
    acento: string;
  };
};

export const CATALOGO_INVITACIONES: DemoInvitacion[] = [
  {
    slug: "demo-invitacion",
    nombre: "Marfil & Champán",
    ocasion: "Bodas",
    descripcion:
      "Elegancia clásica en cremas y dorado: sobre lacrado, cuenta regresiva y el carrito de recién casados.",
    lienzo: "bg-aventurea-navy",
    icono: "corazon",
    iconoClase: "text-white/90",
    muestra: { fondo: "#efe7d8", tinta: "#2a2318", acento: "#c9a227" },
  },
  {
    slug: "demo-formal",
    nombre: "Gala de Etiqueta",
    ocasion: "Aniversarios y galas",
    descripcion:
      "Negro humo, marfil y dorado con líneas que se dibujan al scrollear — código de vestimenta incluido.",
    lienzo: "bg-aventurea-navy-2",
    icono: "destellos",
    iconoClase: "text-white/90",
    muestra: { fondo: "#14141a", tinta: "#efe7d8", acento: "#c9a227" },
  },
  {
    slug: "demo-aracnida",
    nombre: "Héroe Arácnido",
    ocasion: "Cumples infantiles",
    descripcion:
      "Estilo cómic rojo y azul: la araña baja por su hilo, telarañas y onomatopeyas por toda la pantalla.",
    lienzo: "bg-aventurea-navy-3",
    icono: "estrella",
    iconoClase: "text-white/90",
    muestra: { fondo: "#1b2a6b", tinta: "#ffffff", acento: "#e23b34" },
  },
  {
    slug: "demo-zoologico",
    nombre: "Safari de Colores",
    ocasion: "Cumples infantiles",
    descripcion:
      "Un zoológico que se anima al scrollear: la jirafa crece, el mono se columpia y el elefante saluda.",
    lienzo: "bg-aventurea-blue",
    icono: "globos",
    iconoClase: "text-white/95",
    muestra: { fondo: "#f2e2c4", tinta: "#4a3b22", acento: "#e08a2c" },
  },
  {
    slug: "revelacion-maria-jesus-y-luis",
    nombre: "¿Niño o Niña?",
    ocasion: "Revelación de género",
    descripcion:
      "Rosa y celeste para la gran pregunta: fotos a marco completo y la confirmación en un toque.",
    lienzo: "bg-aventurea-blue-light",
    icono: "globo",
    iconoClase: "text-aventurea-navy",
    muestra: { fondo: "#fdf2f6", tinta: "#4a3746", acento: "#7ec4e8" },
  },
];
