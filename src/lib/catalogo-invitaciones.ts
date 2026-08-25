/**
 * El catálogo de invitaciones de muestra: cada fila es una demo viva
 * en /i/{slug}. Para sumar un diseño nuevo al catálogo basta con
 * sembrar su invitación demo y agregar acá su entrada.
 */

/**
 * Las pestañas de la vitrina: quien entra buscando la invitación de un
 * quinceaños no debería tener que pasar por seis bodas para llegar.
 * El orden es el que se muestra en pantalla.
 */
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
   * cómo se ve sin abrirla. Los usa la landing de /invitaciones: una
   * fila de cards de texto todas iguales no
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

/**
 * ⚠️ EL ORDEN DE ESTE ARREGLO ES EL ORDEN EN PANTALLA — no es alfabético
 * ni cronológico, y no se reordena "para acomodar". La vitrina de
 * /invitaciones y su slider recorren el catálogo tal cual, así que la
 * primera entrada de cada categoría es la que ve quien llega.
 *
 * «Carta de Amor» va primera por pedido del dueño (ago 2026): es la
 * demo que mejor muestra el producto —sobre lacrado, música, historia
 * por capítulos— y estaba segunda, detrás de una más sobria. Al ser
 * también la primera del arreglo entero queda de primera en las dos
 * lecturas posibles: la pestaña de Bodas y el orden general.
 */
export const CATALOGO_INVITACIONES: DemoInvitacion[] = [
  {
    slug: "demo-boda-premium",
    categoria: "bodas",
    nombre: "Carta de Amor",
    ocasion: "Bodas",
    descripcion:
      "Un sobre lacrado que se abre con música: la historia por capítulos, fotos, cuenta regresiva y confirmación en línea.",
    lienzo: "bg-aventurea-navy",
    icono: "corazon",
    iconoClase: "text-white/90",
    muestra: { fondo: "#f7f2ea", tinta: "#6b2233", acento: "#c9a227" },
  },
  {
    slug: "demo-boda-estandar",
    categoria: "bodas",
    nombre: "Seda & Marfil",
    ocasion: "Bodas",
    descripcion:
      "Una sola pantalla en blanco y seda: nombres en serif, cuenta regresiva viva y confirmación por WhatsApp.",
    lienzo: "bg-aventurea-navy",
    icono: "corazon",
    iconoClase: "text-white/90",
    muestra: { fondo: "#ffffff", tinta: "#6b2233", acento: "#c9a227" },
  },
  {
    slug: "demo-invitacion",
    categoria: "bodas",
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
    categoria: "general",
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
    categoria: "infantiles",
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
    categoria: "infantiles",
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
    slug: "demo-magia",
    categoria: "infantiles",
    nombre: "Academia Candelaria",
    ocasion: "Cumples infantiles",
    descripcion:
      "La carta de admisión llega con su lacre: se abre, suena el vals y el búho cruza la noche mientras el mapa se dibuja solo.",
    lienzo: "bg-aventurea-navy",
    icono: "destellos",
    iconoClase: "text-white/90",
    muestra: { fondo: "#141334", tinta: "#f4ead2", acento: "#d8b45f" },
  },
  {
    slug: "demo-dinosaurios",
    categoria: "infantiles",
    nombre: "Selva Jurásica",
    ocasion: "Cumples infantiles",
    descripcion:
      "Verde selva y naranja lava: el dinosaurio camina mientras bajás, las huellas marcan el camino y el huevo se abre.",
    lienzo: "bg-aventurea-navy-3",
    icono: "estrella",
    iconoClase: "text-white/90",
    muestra: { fondo: "#14301f", tinta: "#f2e9d8", acento: "#e08a2c" },
  },
  {
    slug: "demo-princesas",
    categoria: "infantiles",
    nombre: "Castillo Encantado",
    ocasion: "Cumples infantiles",
    descripcion:
      "El telón se abre y el castillo se levanta: torres que se encienden, carruaje con estela y polvo de hadas.",
    lienzo: "bg-aventurea-blue-light",
    icono: "globo",
    iconoClase: "text-aventurea-navy",
    muestra: { fondo: "#1b1440", tinta: "#f7ecf3", acento: "#e6b4d0" },
  },
  {
    slug: "demo-quince-anos",
    categoria: "quince",
    nombre: "Corona de Raso",
    ocasion: "Quince años",
    descripcion:
      "Borgoña de noche y oro rosa: el XV se arma con destellos y una cinta de raso se desenrolla mientras bajás.",
    lienzo: "bg-aventurea-navy-2",
    icono: "destellos",
    iconoClase: "text-white/90",
    muestra: { fondo: "#451227", tinta: "#f7ecef", acento: "#d9a077" },
  },
  {
    slug: "demo-corporativa",
    categoria: "corporativas",
    nombre: "Protocolo",
    ocasion: "Eventos de empresa",
    descripcion:
      "Navy y dorado tenue, sin adornos de fiesta: agenda de la noche que se traza sola y confirmación en línea.",
    lienzo: "bg-aventurea-navy",
    icono: "estrella",
    iconoClase: "text-white/90",
    muestra: { fondo: "#0f1a33", tinta: "#eef1f6", acento: "#c9a227" },
  },
  {
    slug: "revelacion-maria-jesus-y-luis",
    categoria: "general",
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
