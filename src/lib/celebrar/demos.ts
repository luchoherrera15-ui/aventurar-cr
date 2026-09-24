import type { CelebracionParaRender } from "@/components/celebrar/invitacion/render-invitacion";
import { normalizarDocumento, type Documento } from "./invitacion/esquema";
import { PALETAS } from "./plantillas/paletas";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LAS INVITACIONES DE MUESTRA — «Ver demos»
 * ══════════════════════════════════════════════════════════════════
 *
 * Celebraciones completas que no existen en la base: se ven scrolleando
 * en el teléfono del héroe de /celebrar, a pantalla completa en
 * /celebrar/demos/<id> y en las tarjetas de la sección «Ver demos».
 * Cada una es una dirección de arte distinta (paleta, letras, portada,
 * motivo, fondo vivo, partículas, entrada) con fotos profesionales,
 * programa, vestimenta, galería, regalos, preguntas y el formulario de
 * confirmación configurado al final. Las destacadas llevan música.
 *
 * Fotos: Unsplash, licencia gratuita, ids verificados a ojo (hoja de
 * contacto) y contra el CDN el 21 sep 2026. Personas ficticias; ningún
 * dato real. Música: las pistas con licencia que Bookea ya tiene en
 * Storage para sus demos (/i/*).
 */

const foto = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Los medios con licencia de las demos de Bookea (ya en Storage). */
const LEGADO = "https://bjhprmtobmualefvcmau.supabase.co/storage/v1/object/public/ranchos-fotos/invitaciones-demo";
const MUSICA = {
  sax: `${LEGADO}/boda-premium/cancion-sax.mp3`,
  princesas: `${LEGADO}/princesas/cancion.mp3`,
  dinosaurios: `${LEGADO}/dinosaurios/cancion.mp3`,
  magia: `${LEGADO}/magia/cancion.mp3`,
} as const;

export type DemoInvitacion = {
  id: string;
  tipo: string;
  /** El nombre de la muestra («Carta de Amor · boda»). */
  etiqueta: string;
  /** Una línea para la tarjeta de «Ver demos». */
  descripcion: string;
  /** La foto de la tarjeta. */
  portada: string;
  /** Las destacadas van primero y en el teléfono del héroe. */
  destacada: boolean;
  celebracion: CelebracionParaRender;
  documento: Documento;
  /** El color de los glifos de la barra de estado del teléfono. */
  tintaBarra: string;
};

const PREGUNTAS_FIESTA = [
  { id: "alergias", etiqueta: "¿Alguna alergia o restricción alimentaria?", tipo: "texto", opciones: [], requerida: false },
  { id: "menu", etiqueta: "¿Qué preferís?", tipo: "opcion", opciones: ["Carne", "Pollo", "Vegetariano"], requerida: false },
];

export const DEMOS: DemoInvitacion[] = [
  // ── 1. Carta de Amor · boda (la referencia de calidad del dueño) ──
  {
    id: "carta",
    tipo: "boda",
    etiqueta: "Carta de Amor · boda",
    descripcion: "Marfil y vino, oro, capítulos que se abren al scrollear y una canción de saxo.",
    portada: `${LEGADO}/boda-premium/santorini.jpg`,
    destacada: true,
    tintaBarra: "#6b2233",
    celebracion: { nombre: "Isabella & Mateo", fecha: "2027-01-03", hora: "16:00", lugarNombre: "Jardines del Valle Escondido", direccion: "San Rafael de Escazú, San José", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-carta-de-amor",
      estilo: {
        paleta: { fondo: "#f7f2ea", tinta: "#5a1d2c", acento: "#c9a227", suave: "#6b6259", superficie: "#fffaf3", escena: "#6b2233", tintaEscena: "#fbf5ee" },
        fuenteTitulo: "playfair",
        fuenteTexto: "montserrat",
        heroe: "clasico",
        decoracion: "peonias",
        decoracionEscala: "media",
        decoracionIntensidad: "sutil",
        decoracionDisposicion: "bordes",
        esquinas: "floral",
        bordes: "suaves",
        animaciones: true,
        entrada: "sumergir",
        ornamento: "diamante",
        textura: "seda",
        ritmo: "alternar",
        transicion: "ondas",
        particulas: "petalos",
        marco: false,
        fondoVivo: "ondas",
        fondoIntensidad: "media",
        fondoVelocidad: "lenta",
      },
      musica: { url: MUSICA.sax, titulo: "Nuestra canción", autoplay: false },
      secciones: [
        { id: "hero", tipo: "hero", datos: { saludo: "¡Nos casamos!", titulo: "Isabella & Mateo", subtitulo: "Y esta es la carta con la que queríamos contártelo.", fotoUrl: "", mostrarFecha: true }, diseno: { fondoUrl: `${LEGADO}/boda-premium/santorini.jpg` } },
        { id: "detalles", tipo: "detalles", datos: { titulo: "Agendá la fecha", texto: "Una tarde para decir que sí — y toda una noche para celebrarlo con vos." } },
        { id: "countdown", tipo: "countdown", datos: { titulo: "Faltan", texto: "para el gran día" } },
        {
          id: "historia",
          tipo: "historia",
          datos: {
            titulo: "Capítulo uno",
            texto: "Nos conocimos en un concierto, entre canciones y casualidades. Una mirada, una charla que no queríamos que terminara, y desde esa noche supimos que algo especial estaba naciendo.\n\nHoy, después de tantos conciertos y aventuras juntos, queremos bailar una canción más: la de nuestra boda.",
            fotoUrl: `${LEGADO}/boda-premium/paris.jpg`,
          },
        },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "El programa",
            items: [
              { hora: "4:00 p. m.", titulo: "Ceremonia", detalle: "En el jardín, frente al lago." },
              { hora: "5:00 p. m.", titulo: "Cóctel al atardecer", detalle: "Terraza principal." },
              { hora: "7:00 p. m.", titulo: "Cena", detalle: "" },
              { hora: "9:00 p. m.", titulo: "Primer baile y fiesta", detalle: "Hasta que el cuerpo aguante." },
            ],
          },
        },
        {
          id: "dress_code",
          tipo: "dress_code",
          datos: {
            titulo: "Código de vestimenta",
            texto: "Elegante de jardín. Reservamos el vino y el marfil para nosotros.",
            grupos: [{ titulo: "Caballeros", texto: "Traje claro o lino, sin corbata." }, { titulo: "Damas", texto: "Vestido largo o midi, tacón cómodo para el césped." }],
            colores: ["#6b2233", "#c9a227", "#f7f2ea", "#3f5a4a"],
          },
        },
        { id: "ubicacion", tipo: "ubicacion", datos: { titulo: "Dónde será", lugares: [{ titulo: "Ceremonia y recepción", lugar: "Jardines del Valle Escondido", direccion: "San Rafael de Escazú, San José", hora: "4:00 p. m.", mapsUrl: "" }] } },
        { id: "galeria", tipo: "galeria", datos: { titulo: "Nuestra historia", fotos: [`${LEGADO}/boda-premium/paris.jpg`, `${LEGADO}/boda-premium/kioto.jpg`, foto("1529636798458-92182e662485", 900), foto("1465495976277-4387d4b0b4c6", 900)] } },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: { titulo: "¿Nos acompañás?", texto: "Tu presencia es nuestro mayor regalo. Confirmá antes del 3 de diciembre para reservar tu lugar.", fechaLimite: "2026-12-03", boton: "Confirmar asistencia", whatsapp: "", modo: "panel", pedirPersonas: true, pedirContacto: false, preguntas: PREGUNTAS_FIESTA },
        },
        {
          id: "regalos",
          tipo: "regalos",
          datos: { titulo: "Muestras de cariño", texto: "Lo más importante es que estés. Si además querés regalarnos algo, acá hay dos formas.", items: [{ titulo: "Luna de miel en Kioto", detalle: "Un aporte para el viaje.", url: "" }], sinpe: "8888-8888" },
        },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Con amor", texto: "Gracias por ser parte de este día. Los esperamos con todo el cariño.", firma: "Isabella & Mateo" } },
      ],
    }),
  },

  // ── 2. Quince años · Rubí ──
  {
    id: "xv",
    tipo: "xv",
    etiqueta: "Noche de Rubí · XV años",
    descripcion: "Vestido rojo, oro y destellos: portada a pantalla completa, vals, programa y galería.",
    portada: foto("1595777457583-95e059d581b8", 1000),
    destacada: true,
    tintaBarra: "#ffffff",
    celebracion: { nombre: "Camila Fernanda", fecha: "2027-05-08", hora: "19:00", lugarNombre: "Salón Real", direccion: "Cartago centro", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-noche-de-rubi",
      estilo: {
        paleta: PALETAS.xv[6], // Rubí
        fuenteTitulo: "cormorant",
        fuenteTexto: "raleway",
        heroe: "foto",
        decoracion: "damasco",
        decoracionEscala: "fina",
        decoracionIntensidad: "sutil",
        decoracionDisposicion: "bordes",
        esquinas: "filigrana",
        bordes: "suaves",
        animaciones: true,
        entrada: "zoom",
        ornamento: "diamante",
        textura: "vineta",
        ritmo: "alternar",
        transicion: "curva",
        particulas: "destellos",
        marco: false,
        fondoVivo: "destello",
        fondoIntensidad: "media",
        fondoVelocidad: "lenta",
      },
      musica: { url: MUSICA.princesas, titulo: "El vals", autoplay: false },
      secciones: [
        { id: "hero", tipo: "hero", datos: { saludo: "Mis quince años", titulo: "Camila Fernanda", subtitulo: "Una noche que soñé toda la vida — y quiero que estés ahí.", fotoUrl: foto("1595777457583-95e059d581b8", 1400), mostrarFecha: true } },
        { id: "detalles", tipo: "detalles", datos: { titulo: "Agendá la fecha", texto: "Misa de acción de gracias y después, la fiesta." } },
        { id: "countdown", tipo: "countdown", datos: { titulo: "Faltan", texto: "para la noche de gala" } },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "El programa",
            items: [
              { hora: "5:00 p. m.", titulo: "Misa de acción de gracias", detalle: "Basílica de Cartago." },
              { hora: "7:00 p. m.", titulo: "Recepción", detalle: "Salón Real." },
              { hora: "8:00 p. m.", titulo: "Vals y brindis", detalle: "Con mis papás y mis chambelanes." },
              { hora: "9:00 p. m.", titulo: "¡A bailar!", detalle: "DJ hasta la medianoche." },
            ],
          },
        },
        { id: "ubicacion", tipo: "ubicacion", datos: { titulo: "Dónde", lugares: [{ titulo: "La fiesta", lugar: "Salón Real", direccion: "Cartago centro, frente al parque", hora: "7:00 p. m.", mapsUrl: "" }] } },
        {
          id: "dress_code",
          tipo: "dress_code",
          datos: { titulo: "Etiqueta", texto: "El rojo es de la quinceañera.", grupos: [{ titulo: "Caballeros", texto: "Traje oscuro." }, { titulo: "Damas", texto: "Vestido largo, cualquier color menos rojo." }], colores: ["#5a0e26", "#f5b7c8", "#c8a15c", "#1a1a1a"] },
        },
        { id: "galeria", tipo: "galeria", datos: { titulo: "Momentos", fotos: [foto("1496337589254-7e19d01cec44", 900), foto("1522413452208-996ff3f3e740", 900), foto("1519741497674-611481863552", 900), foto("1492684223066-81342ee5ff30", 900)] } },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: { titulo: "Confirmá tu asistencia", texto: "Reservá tu lugar antes del 24 de abril.", fechaLimite: "2027-04-24", boton: "Confirmar asistencia", whatsapp: "", modo: "panel", pedirPersonas: true, pedirContacto: false, preguntas: PREGUNTAS_FIESTA },
        },
        { id: "regalos", tipo: "regalos", datos: { titulo: "Regalos", texto: "Tu presencia es el mejor regalo. Si querés, un aporte para mi viaje de quince.", items: [], sinpe: "8888-8888" } },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Con cariño", texto: "Gracias por acompañarme en esta noche tan especial.", firma: "Camila" } },
      ],
    }),
  },

  // ── 3. Infantil · Parque de dinosaurios (estilo película, sin marcas) ──
  {
    id: "dinos",
    tipo: "cumpleanos",
    etiqueta: "Parque de dinosaurios · 7 años",
    descripcion: "Selva oscura, ámbar y letras de película: huellas, helechos y una expedición con su ruta.",
    portada: foto("1448375240586-882707db888b", 1000),
    destacada: true,
    tintaBarra: "#ffffff",
    celebracion: { nombre: "Los 7 de Mateo", fecha: "2027-03-14", hora: "14:00", lugarNombre: "Rancho La Ceiba", direccion: "San Joaquín de Flores, Heredia", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-parque-de-dinosaurios",
      estilo: {
        // Selva profunda, hueso y ámbar: la paleta de la película, sin la marca.
        paleta: { fondo: "#0d2418", tinta: "#f3ead6", acento: "#f0a84a", suave: "#a9c0b0", superficie: "#173626", escena: "#e9dcbb", tintaEscena: "#1c2a20" },
        fuenteTitulo: "bebas",
        fuenteTexto: "nunito",
        heroe: "foto",
        decoracion: "dinosaurios",
        decoracionEscala: "media",
        decoracionIntensidad: "media",
        decoracionDisposicion: "todo",
        esquinas: "selva",
        bordes: "suaves",
        animaciones: true,
        entrada: "zoom",
        ornamento: "huella",
        textura: "grano",
        ritmo: "alternar",
        transicion: "curva",
        particulas: "hojas",
        marco: false,
        fondoVivo: "ondas",
        fondoIntensidad: "sutil",
        fondoVelocidad: "lenta",
      },
      musica: { url: MUSICA.dinosaurios, titulo: "Rugido de expedición", autoplay: false },
      secciones: [
        {
          id: "hero",
          tipo: "hero",
          datos: { saludo: "Parque Mateo · Expedición n.º 7", titulo: "Los 7 de Mateo", subtitulo: "La selva se abre camino… y la fiesta también. Tenés un pase para entrar al parque.", fotoUrl: foto("1448375240586-882707db888b", 1400), mostrarFecha: true },
        },
        {
          id: "detalles",
          tipo: "detalles",
          datos: { titulo: "Guardá la fecha", texto: "Domingo en la tarde. Botas o tenis: hay que correr detrás de un tiranosaurio." },
          diseno: { fondoUrl: foto("1470071459604-3b5ec3a7fe05", 1400) },
        },
        { id: "countdown", tipo: "countdown", datos: { titulo: "Faltan", texto: "para que abran las puertas del parque" } },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "Ruta de la expedición",
            items: [
              { hora: "2:00 p. m.", titulo: "Puertas del parque", detalle: "Credencial de explorador, pintacaritas y mapa del recorrido." },
              { hora: "2:45 p. m.", titulo: "Excavación de fósiles", detalle: "Arena, brochas y un esqueleto escondido." },
              { hora: "3:30 p. m.", titulo: "Búsqueda de huevos", detalle: "Tres nidos perdidos en la selva." },
              { hora: "4:00 p. m.", titulo: "Piñata volcán", detalle: "" },
              { hora: "4:30 p. m.", titulo: "Queque y cantada", detalle: "De chocolate, con un T-Rex encima." },
            ],
          },
        },
        {
          id: "ubicacion",
          tipo: "ubicacion",
          datos: { titulo: "Base del parque", lugares: [{ titulo: "Centro de visitantes", lugar: "Rancho La Ceiba", direccion: "San Joaquín de Flores, Heredia", hora: "2:00 p. m.", mapsUrl: "" }] },
          diseno: { fondoUrl: foto("1441974231531-c6227db76b6e", 1400) },
        },
        {
          id: "dress_code",
          tipo: "dress_code",
          datos: {
            titulo: "Uniforme de guardaparques",
            texto: "Verde, café o kaki, y zapatos para correr. Sombrero de explorador: puntos extra.",
            grupos: [{ titulo: "Exploradores", texto: "Camiseta y pantalón corto; los llenamos de barro." }, { titulo: "Acompañantes", texto: "Ropa cómoda. Hay sombra, café y sillas." }],
            colores: ["#0d2418", "#f0a84a", "#e9dcbb", "#6b4f2a"],
          },
        },
        {
          id: "galeria",
          tipo: "galeria",
          datos: { titulo: "Expediciones anteriores", fotos: [foto("1602631985686-1bb0e6a8696e", 900), foto("1502082553048-f009c37129b9", 900), foto("1513151233558-d860c5398176", 900), foto("1425913397330-cf8af2ff40a1", 900)] },
        },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: {
            titulo: "Confirmá tu pase de entrada",
            texto: "Los pases son limitados: contanos cuántos exploradores llegan para tener queque, credenciales y huevos para todos.",
            fechaLimite: "2027-03-07",
            boton: "¡Reservar mi pase!",
            whatsapp: "",
            modo: "panel",
            pedirPersonas: true,
            pedirContacto: false,
            preguntas: [
              { id: "nino", etiqueta: "Nombre y edad del explorador (o exploradora)", tipo: "texto", opciones: [], requerida: false },
              { id: "alergias", etiqueta: "¿Alguna alergia?", tipo: "texto", opciones: [], requerida: false },
            ],
          },
        },
        {
          id: "faq",
          tipo: "faq",
          datos: {
            titulo: "Protocolo del parque",
            items: [
              { pregunta: "¿Se quedan los papás?", respuesta: "Sí. Hay café, bocas y sombra en el centro de visitantes." },
              { pregunta: "¿Hay parqueo?", respuesta: "Dentro del rancho, junto a la entrada." },
              { pregunta: "¿Qué le gusta a Mateo?", respuesta: "Dinosaurios (todos), libros de animales y cualquier cosa que se pueda excavar. Pero lo mejor es que vengan." },
              { pregunta: "¿Y si llueve?", respuesta: "El parque tiene techo. La expedición sigue." },
            ],
          },
        },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Que la selva los acompañe", texto: "Gracias por venir a rugir con nosotros. Nos vemos en el parque.", firma: "Mateo, Ana y Carlos" } },
      ],
    }),
  },

  // ── 4. Infantil · Colegio de magia (full temática, sin marcas de ninguna saga) ──
  // El castillo con las ventanas encendidas y la lechuza en la portada, la
  // carta con lacre de intro, almenas entre escenas, velas flotantes, y
  // una lechuza con la carta que cruza cada sección al llegar.
  {
    id: "magia",
    tipo: "cumpleanos",
    etiqueta: "Colegio de Magia · 8 años",
    descripcion: "La carta llega con una lechuza y un lacre; castillo encendido, velas flotantes y un año escolar de hechizos.",
    portada: foto("1556621595-6dd9502e265e", 1000),
    destacada: true,
    tintaBarra: "#ffffff",
    celebracion: { nombre: "Tomás cumple 8", fecha: "2027-04-24", hora: "15:00", lugarNombre: "Casa de la familia Solano", direccion: "Santa Ana, San José", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-colegio-de-magia",
      estilo: {
        // Noche de castillo, oro de vela y pergamino: las escenas alternan
        // entre el cielo y la carta.
        paleta: { fondo: "#0e1330", tinta: "#f7ecd0", acento: "#e9b949", suave: "#aeb3d6", superficie: "#19204a", escena: "#f3e6c4", tintaEscena: "#3a2410" },
        fuenteTitulo: "cinzel",
        fuenteTexto: "lora",
        heroe: "clasico",
        tema: "magia",
        decoracion: "magia",
        decoracionEscala: "media",
        decoracionIntensidad: "sutil",
        decoracionDisposicion: "todo",
        esquinas: "magia",
        bordes: "suaves",
        animaciones: true,
        entrada: "sumergir",
        ornamento: "varita",
        textura: "ninguna",
        ritmo: "alternar",
        transicion: "almenas",
        particulas: "velas",
        marco: false,
        fondoVivo: "aurora",
        fondoIntensidad: "sutil",
        fondoVelocidad: "lenta",
        apertura: "carta_magica",
      },
      musica: { url: MUSICA.magia, titulo: "Abracadabra", autoplay: false },
      secciones: [
        { id: "hero", tipo: "hero", datos: { saludo: "Colegio de Magia y Hechicería · Carta de admisión", titulo: "Tomás cumple 8", subtitulo: "Nos complace informarte que has sido aceptado en una tarde de hechizos, pociones y un pastel que desaparece.", fotoUrl: "", mostrarFecha: true } },
        { id: "detalles", tipo: "detalles", datos: { titulo: "El primer día de clases", texto: "El tren sale puntual. Traé tu capa: la varita te la entregamos en la puerta." } },
        { id: "countdown", tipo: "countdown", datos: { titulo: "Faltan", texto: "para que el castillo abra sus puertas" } },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "El horario de clases",
            items: [
              { hora: "3:00 p. m.", titulo: "Llegada al castillo", detalle: "El sombrero elige tu casa y te entregamos túnica y varita." },
              { hora: "3:30 p. m.", titulo: "Clase de pociones", detalle: "Calderos que burbujean y cambian de color (y se toman)." },
              { hora: "4:15 p. m.", titulo: "Duelo de hechizos", detalle: "Con el profesor Andrés, mago de verdad." },
              { hora: "4:45 p. m.", titulo: "Partido de escobas", detalle: "En el jardín: aros, pelotas y un trofeo." },
              { hora: "5:15 p. m.", titulo: "Banquete y pastel", detalle: "Con velas que flotan." },
            ],
          },
        },
        { id: "ubicacion", tipo: "ubicacion", datos: { titulo: "Cómo llegar al castillo", lugares: [{ titulo: "Andén de salida", lugar: "Casa de la familia Solano", direccion: "Santa Ana, San José", hora: "3:00 p. m.", mapsUrl: "" }] } },
        {
          id: "dress_code",
          tipo: "dress_code",
          datos: {
            titulo: "Lista de útiles",
            texto: "Los colores del colegio son el azul noche y el oro. Anteojos redondos y bufanda: puntos extra para tu casa.",
            grupos: [
              { titulo: "Aprendices", texto: "Capa o túnica, sombrero puntiagudo si tenés, y zapatos para correr detrás de la pelota dorada." },
              { titulo: "Profesores (papás)", texto: "Ropa cómoda. Hay café en el gran comedor." },
            ],
            colores: ["#0e1330", "#e9b949", "#f3e6c4", "#7a1f2b"],
          },
        },
        { id: "galeria", tipo: "galeria", datos: { titulo: "El año pasado en el colegio", fotos: [foto("1608790672275-309c02d888ff", 900), foto("1516668557604-c8e814fdb184", 900), foto("1631397831385-b6023fd545ac", 900), foto("1530103862676-de8c9debad1d", 900)] } },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: {
            titulo: "Enviá tu respuesta por lechuza",
            texto: "Las varitas son limitadas: confirmá antes del 17 de abril para tener la tuya.",
            fechaLimite: "2027-04-17",
            boton: "Enviar mi lechuza",
            whatsapp: "",
            modo: "panel",
            pedirPersonas: true,
            pedirContacto: false,
            preguntas: [
              { id: "nino", etiqueta: "Nombre del aprendiz o aprendiza", tipo: "texto", opciones: [], requerida: false },
              { id: "casa", etiqueta: "¿A qué casa querés ir?", tipo: "opcion", opciones: ["León (valentía)", "Águila (ingenio)", "Tejón (lealtad)", "Serpiente (ambición)"], requerida: false },
              { id: "alergias", etiqueta: "¿Alguna alergia para las pociones?", tipo: "texto", opciones: [], requerida: false },
            ],
          },
        },
        {
          id: "faq",
          tipo: "faq",
          datos: {
            titulo: "Reglamento del colegio",
            items: [
              { pregunta: "¿Se quedan los papás?", respuesta: "Sí: hay café y sillas cómodas en el gran comedor para los no-magos." },
              { pregunta: "¿Hay que llevar varita?", respuesta: "No, cada aprendiz recibe la suya al llegar. Si traés la tuya, mejor." },
              { pregunta: "¿A qué hora termina el hechizo?", respuesta: "A las 6:00 p. m. Si se alarga, avisamos por WhatsApp." },
            ],
          },
        },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Hechizo cumplido", texto: "Gracias por venir a hacer magia con nosotros. Te esperamos en el andén.", firma: "Tomás y familia Solano" } },
      ],
    }),
  },

  // ── 5. Infantil · Gran premio (full temática de carreras, sin personajes de película) ──
  {
    id: "carreras",
    tipo: "cumpleanos",
    etiqueta: "Gran Premio · 6 años",
    descripcion: "Semáforo de largada, pista con meta a cuadros, un auto que cruza cada sección y banderines por todos lados.",
    portada: foto("1632214790681-7087f4c8d139", 1000),
    destacada: true,
    tintaBarra: "#ffffff",
    celebracion: { nombre: "Gran Premio Sebastián", fecha: "2027-06-12", hora: "14:00", lugarNombre: "Kartódromo del Oeste", direccion: "Santa Ana, San José", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-gran-premio",
      estilo: {
        // Asfalto, rojo de escudería y blanco de pits.
        paleta: { fondo: "#101216", tinta: "#ffffff", acento: "#e10600", suave: "#b5bac4", superficie: "#1b1e24", escena: "#f4f4f2", tintaEscena: "#111317" },
        fuenteTitulo: "bebas",
        fuenteTexto: "poppins",
        heroe: "clasico",
        tema: "carreras",
        decoracion: "carreras",
        decoracionEscala: "media",
        decoracionIntensidad: "sutil",
        decoracionDisposicion: "todo",
        esquinas: "carreras",
        bordes: "suaves",
        animaciones: true,
        entrada: "deslizar",
        ornamento: "banderas",
        textura: "grano",
        ritmo: "alternar",
        transicion: "bandera",
        particulas: "banderines",
        marco: false,
        fondoVivo: "lineas",
        fondoIntensidad: "sutil",
        fondoVelocidad: "rapida",
        apertura: "largada",
      },
      secciones: [
        { id: "hero", tipo: "hero", datos: { saludo: "Temporada 6 · Carrera de cumpleaños", titulo: "Gran Premio Sebastián", subtitulo: "Encendé motores: Sebas cumple 6 y la pista es toda tuya.", fotoUrl: "", mostrarFecha: true } },
        { id: "detalles", tipo: "detalles", datos: { titulo: "Día de carrera", texto: "Pits abiertos desde las 2:00. La bandera verde baja puntual." } },
        { id: "countdown", tipo: "countdown", datos: { titulo: "Cuenta regresiva", texto: "para la bandera verde" } },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "Programa de la carrera",
            items: [
              { hora: "2:00 p. m.", titulo: "Pits abiertos", detalle: "Casco, número de piloto y foto en el podio de práctica." },
              { hora: "2:30 p. m.", titulo: "Vueltas de clasificación", detalle: "Karts para los pilotos de 4 a 8 años." },
              { hora: "3:30 p. m.", titulo: "Gran final", detalle: "Tres vueltas, una bandera a cuadros." },
              { hora: "4:00 p. m.", titulo: "Podio y trofeos", detalle: "Medallas para todos, champaña de frutas para brindar." },
              { hora: "4:30 p. m.", titulo: "Queque en boxes", detalle: "Con forma de auto, obvio." },
            ],
          },
        },
        { id: "ubicacion", tipo: "ubicacion", datos: { titulo: "El circuito", lugares: [{ titulo: "Parrilla de salida", lugar: "Kartódromo del Oeste", direccion: "Santa Ana, San José", hora: "2:00 p. m.", mapsUrl: "" }] } },
        {
          id: "dress_code",
          tipo: "dress_code",
          datos: {
            titulo: "Uniforme de escudería",
            texto: "Rojo, negro o blanco. Si tenés gorra de carreras, traela.",
            grupos: [
              { titulo: "Pilotos", texto: "Pantalón largo y zapatos cerrados (es regla del kartódromo). El casco lo ponemos nosotros." },
              { titulo: "Equipo de pits", texto: "Ropa cómoda y ganas de gritar desde la tribuna." },
            ],
            colores: ["#e10600", "#101216", "#f4f4f2", "#ffd400"],
          },
        },
        { id: "galeria", tipo: "galeria", datos: { titulo: "Temporadas anteriores", fotos: [foto("1617137555671-e5edec6e666b", 900), foto("1560692830-04adc2f31119", 900), foto("1608790672275-309c02d888ff", 900), foto("1531956531700-dc0ee0f1f9a5", 900)] } },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: {
            titulo: "Inscribí a tu piloto",
            texto: "Los karts son limitados: confirmá antes del 5 de junio para reservar el tuyo en la parrilla.",
            fechaLimite: "2027-06-05",
            boton: "¡Inscribirme en la carrera!",
            whatsapp: "",
            modo: "panel",
            pedirPersonas: true,
            pedirContacto: false,
            preguntas: [
              { id: "piloto", etiqueta: "Nombre y edad del piloto", tipo: "texto", opciones: [], requerida: false },
              { id: "numero", etiqueta: "Número favorito para el auto", tipo: "numero", opciones: [], requerida: false },
              { id: "alergias", etiqueta: "¿Alguna alergia?", tipo: "texto", opciones: [], requerida: false },
            ],
          },
        },
        {
          id: "faq",
          tipo: "faq",
          datos: {
            titulo: "Reglamento de pista",
            items: [
              { pregunta: "¿Es seguro para los chiquitos?", respuesta: "Sí: karts infantiles con velocidad limitada, casco y un comisario de pista por cada tanda." },
              { pregunta: "¿Se quedan los papás?", respuesta: "Sí. La tribuna tiene sombra, café y la mejor vista de la meta." },
              { pregunta: "¿Y si llueve?", respuesta: "La pista es techada. Se corre igual." },
            ],
          },
        },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Bandera a cuadros", texto: "Gracias por venir a correr conmigo. ¡Nos vemos en la meta!", firma: "Sebas y su escudería" } },
      ],
    }),
  },

  // ── 6. Infantil · Cuento de hadas (princesas, full temática) ──
  {
    id: "cuento",
    tipo: "cumpleanos",
    etiqueta: "Cuento de Hadas · 5 años",
    descripcion: "Se abre como un libro de cuentos: castillo rosa con banderines, arcoíris, nubes y polvo de hada en cada página.",
    portada: foto("1557067175-db3159d938ac", 1000),
    destacada: true,
    tintaBarra: "#5b2a4a",
    celebracion: { nombre: "El cuento de Valentina", fecha: "2027-08-21", hora: "15:00", lugarNombre: "Jardín Las Hortensias", direccion: "Heredia centro", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-cuento-de-hadas",
      estilo: {
        // Rosa de castillo, lavanda de cielo y ciruela para las letras.
        paleta: { fondo: "#fdf0f4", tinta: "#5b2a4a", acento: "#d4608a", suave: "#8c6a80", superficie: "#ffffff", escena: "#ece3f8", tintaEscena: "#3f2a5c" },
        fuenteTitulo: "dancing",
        fuenteTexto: "quicksand",
        heroe: "clasico",
        tema: "cuento",
        decoracion: "castillos",
        decoracionEscala: "media",
        decoracionIntensidad: "sutil",
        decoracionDisposicion: "bordes",
        esquinas: "cuento",
        bordes: "redondos",
        animaciones: true,
        entrada: "brinco",
        ornamento: "corona",
        textura: "seda",
        ritmo: "alternar",
        transicion: "nubes",
        particulas: "polvo_hada",
        marco: false,
        fondoVivo: "aurora",
        fondoIntensidad: "sutil",
        fondoVelocidad: "lenta",
        apertura: "cuento",
      },
      musica: { url: MUSICA.princesas, titulo: "El vals del castillo", autoplay: false },
      secciones: [
        { id: "hero", tipo: "hero", datos: { saludo: "Érase una vez una princesa que cumplía 5…", titulo: "El cuento de Valentina", subtitulo: "Y todo el reino está invitado a su fiesta en el castillo.", fotoUrl: "", mostrarFecha: true } },
        { id: "detalles", tipo: "detalles", datos: { titulo: "El gran día del reino", texto: "Una tarde de coronas, varitas y un pastel de tres pisos." } },
        { id: "countdown", tipo: "countdown", datos: { titulo: "Faltan", texto: "para que se abra el puente del castillo" } },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "Los capítulos del cuento",
            items: [
              { hora: "3:00 p. m.", titulo: "Llegada al castillo", detalle: "Corona, capa y varita para cada invitado." },
              { hora: "3:30 p. m.", titulo: "El taller del hada", detalle: "Decoramos coronas con brillos y gemas." },
              { hora: "4:15 p. m.", titulo: "El baile real", detalle: "Música, burbujas y el vals de la cumpleañera." },
              { hora: "4:45 p. m.", titulo: "El banquete", detalle: "" },
              { hora: "5:15 p. m.", titulo: "…y fueron felices", detalle: "Pastel, velas y deseos." },
            ],
          },
        },
        { id: "ubicacion", tipo: "ubicacion", datos: { titulo: "El castillo", lugares: [{ titulo: "El reino", lugar: "Jardín Las Hortensias", direccion: "Heredia centro, 200 m norte del parque", hora: "3:00 p. m.", mapsUrl: "" }] } },
        {
          id: "dress_code",
          tipo: "dress_code",
          datos: {
            titulo: "Vestuario real",
            texto: "Rosa, lila o cualquier color de cuento. Brillos: todos los que quieras.",
            grupos: [
              { titulo: "Princesas y príncipes", texto: "Vestido, capa o traje de tu personaje favorito de cuento." },
              { titulo: "Reyes y reinas (papás)", texto: "Ropa cómoda; la corona es opcional (pero la regalamos)." },
            ],
            colores: ["#d4608a", "#ece3f8", "#fdf0f4", "#f4c95d"],
          },
        },
        { id: "galeria", tipo: "galeria", datos: { titulo: "Páginas de años anteriores", fotos: [foto("1509666537727-9154b6962292", 900), foto("1578922864601-79dcc7cbcea9", 900), foto("1530103862676-de8c9debad1d", 900), foto("1631397831385-b6023fd545ac", 900)] } },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: {
            titulo: "Confirmá tu lugar en el reino",
            texto: "Las coronas se hacen a mano: contanos antes del 14 de agosto cuántos vienen.",
            fechaLimite: "2027-08-14",
            boton: "Acepto la invitación real",
            whatsapp: "",
            modo: "panel",
            pedirPersonas: true,
            pedirContacto: false,
            preguntas: [
              { id: "nino", etiqueta: "Nombre de la princesa o el príncipe", tipo: "texto", opciones: [], requerida: false },
              { id: "alergias", etiqueta: "¿Alguna alergia?", tipo: "texto", opciones: [], requerida: false },
            ],
          },
        },
        {
          id: "regalos",
          tipo: "regalos",
          datos: { titulo: "Un deseo para Valentina", texto: "Lo más bonito del cuento es que vengás. Si querés traer algo, le encantan los libros y los rompecabezas.", items: [], sinpe: "" },
        },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Y colorín colorado…", texto: "…este cuento todavía no se ha acabado: falta que vengás vos.", firma: "Valentina y su familia" } },
      ],
    }),
  },

  // ── 7. Corporativa · Gala anual ──
  {
    id: "gala",
    tipo: "corporativo",
    etiqueta: "Gala Anual 2027 · corporativa",
    descripcion: "Marino y oro, portada editorial, agenda por horas, etiqueta y confirmación con menú.",
    portada: foto("1470337458703-46ad1756a187", 1000),
    destacada: true,
    tintaBarra: "#ffffff",
    celebracion: { nombre: "Gala Anual Grupo Aurora", fecha: "2027-02-19", hora: "18:30", lugarNombre: "Hotel Real Intercontinental", direccion: "Escazú, San José", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-gala-anual",
      estilo: {
        paleta: { fondo: "#0b1e45", tinta: "#ffffff", acento: "#d9a960", suave: "#a9b6d3", superficie: "#142b5c", escena: "#f4f1ea", tintaEscena: "#0b1e45" },
        fuenteTitulo: "montserrat",
        fuenteTexto: "raleway",
        heroe: "editorial",
        decoracion: "lineas",
        decoracionEscala: "fina",
        decoracionIntensidad: "sutil",
        decoracionDisposicion: "portada",
        esquinas: "deco",
        bordes: "rectos",
        animaciones: true,
        entrada: "deslizar",
        ornamento: "linea",
        textura: "ninguna",
        ritmo: "alternar",
        transicion: "diagonal",
        particulas: "destellos",
        marco: true,
        fondoVivo: "destello",
        fondoIntensidad: "sutil",
        fondoVelocidad: "lenta",
      },
      musica: { url: MUSICA.sax, titulo: "Lounge", autoplay: false },
      secciones: [
        { id: "hero", tipo: "hero", datos: { saludo: "Grupo Aurora · 25 años", titulo: "Gala Anual 2027", subtitulo: "Una noche para celebrar lo que construimos juntos y brindar por lo que viene.", fotoUrl: foto("1470337458703-46ad1756a187", 1000), mostrarFecha: true }, diseno: { fondoUrl: foto("1531058020387-3be344556be6", 1400) } },
        { id: "detalles", tipo: "detalles", datos: { titulo: "Reservá la fecha", texto: "Cóctel, cena de gala, reconocimientos y fiesta. Invitación personal para colaboradores y aliados." } },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "Agenda de la noche",
            items: [
              { hora: "6:30 p. m.", titulo: "Registro y cóctel de bienvenida", detalle: "Terraza Aurora." },
              { hora: "7:30 p. m.", titulo: "Palabras de apertura", detalle: "Dirección general." },
              { hora: "8:00 p. m.", titulo: "Cena de gala", detalle: "Menú de tres tiempos." },
              { hora: "9:15 p. m.", titulo: "Reconocimientos 2026", detalle: "Equipos y trayectorias." },
              { hora: "10:00 p. m.", titulo: "Fiesta", detalle: "Banda en vivo." },
            ],
          },
        },
        { id: "ubicacion", tipo: "ubicacion", datos: { titulo: "Sede", lugares: [{ titulo: "Salón Real", lugar: "Hotel Real Intercontinental", direccion: "Escazú, San José", hora: "6:30 p. m.", mapsUrl: "" }] } },
        {
          id: "dress_code",
          tipo: "dress_code",
          datos: { titulo: "Etiqueta", texto: "Black tie opcional.", grupos: [{ titulo: "Caballeros", texto: "Traje oscuro o esmoquin." }, { titulo: "Damas", texto: "Vestido largo o de cóctel." }], colores: ["#0b1e45", "#d9a960", "#f4f1ea", "#1a1a1a"] },
        },
        { id: "galeria", tipo: "galeria", datos: { titulo: "Gala 2026", fotos: [foto("1511578314322-379afb476865", 900), foto("1540575467063-178a50c2df87", 900), foto("1475721027785-f74eccf877e2", 900), foto("1478147427282-58a87a120781", 900)] } },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: {
            titulo: "Confirmá tu asistencia",
            texto: "Para organizar la cena necesitamos tu confirmación antes del 5 de febrero.",
            fechaLimite: "2027-02-05",
            boton: "Confirmar asistencia",
            whatsapp: "",
            modo: "panel",
            pedirPersonas: true,
            pedirContacto: true,
            preguntas: [
              { id: "empresa", etiqueta: "Empresa o área", tipo: "texto", opciones: [], requerida: true },
              { id: "menu", etiqueta: "Menú", tipo: "opcion", opciones: ["Res", "Pescado", "Vegetariano"], requerida: true },
              { id: "alergias", etiqueta: "Alergias o restricciones", tipo: "texto", opciones: [], requerida: false },
            ],
          },
        },
        {
          id: "faq",
          tipo: "faq",
          datos: {
            titulo: "Preguntas frecuentes",
            items: [
              { pregunta: "¿Puedo llevar acompañante?", respuesta: "Sí, una persona. Indicalo al confirmar." },
              { pregunta: "¿Hay parqueo?", respuesta: "Parqueo del hotel sin costo, con validación en el registro." },
              { pregunta: "¿Habrá transporte?", respuesta: "Sí, buses desde la oficina central a las 5:45 p. m." },
            ],
          },
        },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Gracias", texto: "Veinticinco años se celebran con quienes los hicieron posibles. Los esperamos.", firma: "Grupo Aurora" } },
      ],
    }),
  },

  // ── 8. Boda · Sofía & Andrés (portada con foto) ──
  {
    id: "boda",
    tipo: "boda",
    etiqueta: "Jardín · boda",
    descripcion: "Portada a pantalla completa, verde botella y arena, historia y programa del día.",
    portada: foto("1511285560929-80b456fea0bc", 1000),
    destacada: false,
    tintaBarra: "#ffffff",
    celebracion: { nombre: "Sofía & Andrés", fecha: "2026-12-12", hora: "16:00", lugarNombre: "Hacienda Los Sueños", direccion: "San Rafael de Escazú, San José", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-jardin",
      estilo: {
        paleta: PALETAS.boda[0],
        fuenteTitulo: "playfair",
        fuenteTexto: "montserrat",
        heroe: "foto",
        decoracion: "eucalipto",
        decoracionEscala: "media",
        decoracionIntensidad: "sutil",
        decoracionDisposicion: "bordes",
        esquinas: "hojas",
        bordes: "suaves",
        animaciones: true,
        entrada: "suave",
        ornamento: "hoja",
        textura: "papel",
        ritmo: "alternar",
        transicion: "ondas",
        particulas: "hojas",
        marco: false,
        fondoVivo: "ondas",
        fondoIntensidad: "media",
        fondoVelocidad: "media",
      },
      secciones: [
        { id: "hero", tipo: "hero", datos: { saludo: "¡Nos casamos!", titulo: "Sofía & Andrés", subtitulo: "Y esta es la carta con la que queríamos contártelo.", fotoUrl: foto("1511285560929-80b456fea0bc", 1400), mostrarFecha: true } },
        { id: "detalles", tipo: "detalles", datos: { titulo: "Agendá la fecha", texto: "Una tarde para decir que sí — y toda una noche para celebrarlo con vos." } },
        { id: "countdown", tipo: "countdown", datos: { titulo: "Faltan", texto: "para el gran día" } },
        {
          id: "historia",
          tipo: "historia",
          datos: { titulo: "Cómo empezó todo", texto: "Nos conocimos en un concierto, entre canciones y casualidades. Hoy, después de tantos conciertos y aventuras juntos, queremos bailar una canción más: la de nuestra boda.", fotoUrl: foto("1529636798458-92182e662485", 900) },
        },
        { id: "ubicacion", tipo: "ubicacion", datos: { titulo: "Dónde será", lugares: [{ titulo: "Ceremonia y recepción", lugar: "Hacienda Los Sueños", direccion: "San Rafael de Escazú", hora: "4:00 p. m.", mapsUrl: "" }] } },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "El programa",
            items: [
              { hora: "4:00 p. m.", titulo: "Ceremonia", detalle: "En el jardín." },
              { hora: "5:00 p. m.", titulo: "Cóctel", detalle: "" },
              { hora: "7:00 p. m.", titulo: "Cena y baile", detalle: "" },
            ],
          },
        },
        {
          id: "dress_code",
          tipo: "dress_code",
          datos: { titulo: "Código de vestimenta", texto: "Elegante tropical: fresco, relajado y con estilo.", grupos: [{ titulo: "Caballeros", texto: "Camisa de lino o guayabera, pantalón liviano." }, { titulo: "Damas", texto: "Vestido largo o midi, tela fresca." }], colores: ["#2f4a3a", "#b0846d", "#f7f2ea", "#7fa38c"] },
        },
        { id: "galeria", tipo: "galeria", datos: { titulo: "Momentos", fotos: [foto("1465495976277-4387d4b0b4c6", 900), foto("1522673607200-164d1b6ce486", 900), foto("1511795409834-ef04bbd61622", 900), foto("1519225421980-715cb0215aed", 900)] } },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: { titulo: "Confirmá tu asistencia", texto: "Nos encantaría contar con vos esa noche.", fechaLimite: "2026-11-20", boton: "Confirmar asistencia", whatsapp: "", modo: "panel", pedirPersonas: true, pedirContacto: false, preguntas: PREGUNTAS_FIESTA },
        },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Con amor", texto: "Gracias por ser parte de este día.", firma: "Sofía & Andrés" } },
      ],
    }),
  },

  // ── 9. Graduación ──
  {
    id: "grad",
    tipo: "graduacion",
    etiqueta: "Birrete · graduación",
    descripcion: "Marino académico, laurel, portada editorial y el programa del acto y la cena.",
    portada: foto("1541339907198-e08756dedf3f", 1000),
    destacada: false,
    tintaBarra: "#ffffff",
    celebracion: { nombre: "Graduación de Daniela", fecha: "2026-11-27", hora: "18:00", lugarNombre: "Auditorio UCR", direccion: "San Pedro de Montes de Oca", mapsUrl: "" },
    documento: normalizarDocumento({
      plantilla: "demo-birrete",
      estilo: {
        paleta: PALETAS.graduacion[0],
        fuenteTitulo: "playfair",
        fuenteTexto: "raleway",
        heroe: "editorial",
        decoracion: "laurel",
        decoracionDisposicion: "portada",
        decoracionIntensidad: "sutil",
        esquinas: "deco",
        bordes: "rectos",
        animaciones: true,
        entrada: "cortina",
        ornamento: "linea",
        textura: "grano",
        ritmo: "alternar",
        transicion: "diagonal",
        particulas: "destellos",
        marco: true,
        fondoVivo: "destello",
        fondoIntensidad: "sutil",
        fondoVelocidad: "lenta",
      },
      secciones: [
        { id: "hero", tipo: "hero", datos: { saludo: "Se gradúa de Medicina", titulo: "Daniela Rojas", subtitulo: "Siete años después, el birrete. Quiero celebrarlo con vos.", fotoUrl: foto("1541339907198-e08756dedf3f", 1400), mostrarFecha: true } },
        { id: "detalles", tipo: "detalles", datos: { titulo: "Agendá la fecha", texto: "Acto de graduación y, después, cena de celebración." } },
        {
          id: "itinerario",
          tipo: "itinerario",
          datos: {
            titulo: "El programa",
            items: [
              { hora: "6:00 p. m.", titulo: "Acto de graduación", detalle: "Auditorio de la Facultad." },
              { hora: "8:00 p. m.", titulo: "Cena de celebración", detalle: "Restaurante Il Giardino, San Pedro." },
            ],
          },
        },
        { id: "ubicacion", tipo: "ubicacion", datos: { titulo: "Dónde", lugares: [{ titulo: "Acto", lugar: "Auditorio UCR", direccion: "San Pedro de Montes de Oca", hora: "6:00 p. m.", mapsUrl: "" }] } },
        { id: "dress_code", tipo: "dress_code", datos: { titulo: "Vestimenta", texto: "Formal.", grupos: [], colores: [] } },
        { id: "galeria", tipo: "galeria", datos: { titulo: "El camino", fotos: [foto("1627556704302-624286467c65", 900), foto("1523580494863-6f3031224c94", 900), foto("1524995997946-a1c2e315a42f", 900)] } },
        {
          id: "rsvp",
          tipo: "rsvp",
          datos: { titulo: "Confirmá tu asistencia", texto: "Los lugares del auditorio son limitados: confirmá antes del 13 de noviembre.", fechaLimite: "2026-11-13", boton: "Confirmar asistencia", whatsapp: "", modo: "panel", pedirPersonas: true, pedirContacto: false, preguntas: [] },
        },
        { id: "mensaje", tipo: "mensaje", datos: { titulo: "Gracias", texto: "A quienes estuvieron en cada examen, en cada guardia y en cada café: este logro también es suyo.", firma: "Daniela" } },
      ],
    }),
  },
];

export const DEMOS_DESTACADAS = DEMOS.filter((d) => d.destacada);

export function demoPorId(id: string): DemoInvitacion | null {
  return DEMOS.find((d) => d.id === id) ?? null;
}
