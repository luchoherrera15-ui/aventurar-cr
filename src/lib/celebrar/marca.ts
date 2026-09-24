/**
 * La marca CELEBRAR en un solo lugar: nombre, lema, descripción y el
 * catálogo de tipos de celebración. Todo texto de marca que se repita
 * (metadata, Open Graph, correos, pie) sale de acá.
 */

export const MARCA = {
  nombre: "CELEBRAR",
  /** Cómo se escribe en el logotipo y en el pie: minúsculas, con el dominio. */
  logotipo: "celebrar",
  dominio: "celebrar.lat",
  lema: "Crea. Invita. Celebra. Recuerda.",
  claim: "Más que una invitación, una experiencia.",
  descripcion:
    "Invitaciones digitales, videos, confirmación de asistencia, álbum compartido y una página de recuerdos para bodas, cumpleaños, quince años, graduaciones y todo lo que valga la pena celebrar.",
  /** Título de la pestaña en la portada y plantilla para las demás. */
  tituloPortada: "CELEBRAR — Más que una invitación, una experiencia",
  plantillaTitulo: "%s · CELEBRAR",
  /** Quién opera el producto. Va chiquito en el pie, nada más. */
  operador: "Bookea",
} as const;

/** Los cuatro verbos del lema, en orden. Son una secuencia de verdad. */
export const PASOS = [
  {
    numero: "01",
    verbo: "Crea",
    titulo: "Elegí un diseño y hacelo tuyo",
    detalle:
      "Empezás con una plantilla y la personalizás en vivo: nombres, fecha, lugar, fotos, música y la historia que quieran contar. Lo que ves es exactamente lo que van a recibir tus invitados.",
  },
  {
    numero: "02",
    verbo: "Invita",
    titulo: "Compartí un link y un QR",
    detalle:
      "Tu celebración tiene su propia dirección. La mandás por WhatsApp con una previa bonita, la imprimís como QR en la tarjeta física, y cada persona confirma su asistencia desde el teléfono.",
  },
  {
    numero: "03",
    verbo: "Celebra",
    titulo: "El día del evento, todos suman",
    detalle:
      "Los invitados escanean el QR de la mesa y suben sus fotos y videos al álbum en el momento. Vos ves llegar las confirmaciones, el libro de firmas y los regalos desde un solo panel.",
  },
  {
    numero: "04",
    verbo: "Recuerda",
    titulo: "La página se queda con ustedes",
    detalle:
      "Después de la fiesta, la misma dirección se convierte en la página de recuerdos: las fotos de todos, los mensajes, el video y la historia. Para volver cuando quieran.",
  },
] as const;

export type TipoCelebracionId =
  | "boda"
  | "cumpleanos"
  | "xv"
  | "baby_shower"
  | "bautizo"
  | "graduacion"
  | "aniversario"
  | "despedida"
  | "fiesta"
  | "corporativo"
  | "otro";

export type TipoCelebracion = {
  id: TipoCelebracionId;
  nombre: string;
  /** Cómo se lee en una lista («para bodas», «para XV años»). */
  plural: string;
};

/**
 * Los tipos de celebración del producto, en el orden en que se muestran.
 * Es el catálogo del brief; la columna `tipo` de `celebrar_celebraciones`
 * (Fase 2) lleva estos mismos ids.
 */
export const TIPOS_CELEBRACION: readonly TipoCelebracion[] = [
  { id: "boda", nombre: "Boda", plural: "Bodas" },
  { id: "cumpleanos", nombre: "Cumpleaños", plural: "Cumpleaños" },
  { id: "xv", nombre: "XV años", plural: "XV años" },
  { id: "baby_shower", nombre: "Baby shower", plural: "Baby showers" },
  { id: "bautizo", nombre: "Bautizo", plural: "Bautizos" },
  { id: "graduacion", nombre: "Graduación", plural: "Graduaciones" },
  { id: "aniversario", nombre: "Aniversario", plural: "Aniversarios" },
  { id: "despedida", nombre: "Despedida", plural: "Despedidas" },
  { id: "fiesta", nombre: "Fiesta", plural: "Fiestas" },
  { id: "corporativo", nombre: "Evento corporativo", plural: "Corporativos" },
  { id: "otro", nombre: "Otro", plural: "Otras celebraciones" },
] as const;

/** Lo que se muestra en la portada (sin «Otro»). */
export const TIPOS_EN_PORTADA = TIPOS_CELEBRACION.filter((t) => t.id !== "otro");

export function tipoCelebracion(id: string): TipoCelebracion | null {
  return TIPOS_CELEBRACION.find((t) => t.id === id) ?? null;
}

/** Las siete funciones del producto, como las anuncia la portada. */
export const FUNCIONES = [
  {
    id: "invitaciones",
    nombre: "Invitaciones",
    detalle:
      "Una página propia para tu celebración, con cuenta regresiva, mapa, código de vestimenta y la historia detrás. Se ve perfecta en el teléfono, que es donde la van a abrir.",
  },
  {
    id: "video",
    nombre: "Videos con IA",
    detalle:
      "Convertí sus fotos en un video corto para anunciar la fecha o abrir la invitación. Primero con plantillas; después, con movimiento generado por inteligencia artificial.",
  },
  {
    id: "rsvp",
    nombre: "Confirmación de asistencia",
    detalle:
      "Cada invitado confirma desde su teléfono cuántos vienen y si alguien tiene una restricción alimentaria. Vos ves el conteo al día, sin perseguir a nadie por WhatsApp.",
  },
  {
    id: "album",
    nombre: "Álbum compartido",
    detalle:
      "Un QR en cada mesa. Los invitados suben sus fotos y videos en el momento; vos aprobás lo que se publica y al final te llevás todo en alta calidad.",
  },
  {
    id: "firmas",
    nombre: "Libro de firmas",
    detalle:
      "Mensajes con nombre y foto, escritos desde el teléfono de cada persona. Quedan guardados en la página de recuerdos.",
  },
  {
    id: "regalos",
    nombre: "Mesa de regalos",
    detalle:
      "Enlaces a tiendas, cuentas bancarias y SINPE Móvil, o una lista propia. Todo en el mismo lugar donde la gente ya confirmó que va.",
  },
  {
    id: "qr",
    nombre: "Códigos QR",
    detalle:
      "Uno para la invitación, uno para el álbum, uno para el libro de firmas. Listos para imprimir en la tarjeta, el cartel de bienvenida o cada mesa.",
  },
] as const;

export type CategoriaPlantillaId =
  | "elegante"
  | "minimalista"
  | "luxury"
  | "romantica"
  | "floral"
  | "moderna"
  | "editorial"
  | "tropical"
  | "infantil"
  | "fiesta"
  | "corporativa";

export type CategoriaPlantilla = {
  id: CategoriaPlantillaId;
  nombre: string;
  detalle: string;
  /** Para qué celebraciones suele pedirse. */
  para: string;
};

/**
 * Las categorías del catálogo de plantillas, en el orden del brief.
 * Son la semilla de `celebrar_plantilla_categorias` (Fase 3); las
 * plantillas mismas viven en la base, no acá.
 */
export const CATEGORIAS_PLANTILLA: readonly CategoriaPlantilla[] = [
  { id: "elegante", nombre: "Elegante", detalle: "Serif, mucho aire y un solo acento. La opción segura cuando la ocasión es formal.", para: "Bodas, aniversarios, cenas" },
  { id: "minimalista", nombre: "Minimalista", detalle: "Solo lo necesario: los nombres, la fecha, el lugar. El diseño se lee en un segundo.", para: "Cualquier celebración" },
  { id: "luxury", nombre: "Luxury", detalle: "Fondos oscuros, dorado fino y tipografía grande. Para cuando la invitación tiene que impresionar.", para: "Bodas, galas, XV años" },
  { id: "romantica", nombre: "Romántica", detalle: "Tonos blush, itálicas y una historia contada en primera persona.", para: "Bodas, aniversarios, compromisos" },
  { id: "floral", nombre: "Floral", detalle: "Ilustraciones botánicas que enmarcan el texto, sin taparlo.", para: "Bodas, baby showers, bautizos" },
  { id: "moderna", nombre: "Moderna", detalle: "Geometría, contraste alto y colores planos. Directa y actual.", para: "Cumpleaños, despedidas, fiestas" },
  { id: "editorial", nombre: "Editorial", detalle: "Como una revista: columnas, titulares grandes y fotos a sangre.", para: "Bodas, graduaciones, corporativos" },
  { id: "tropical", nombre: "Tropical", detalle: "Verdes, hojas y luz: pensado para el aire libre, el jardín y la playa.", para: "Bodas de playa, cumpleaños, fiestas" },
  { id: "infantil", nombre: "Infantil", detalle: "Colores vivos, personajes propios y animaciones que se tocan. Sin marcas registradas.", para: "Cumpleaños, bautizos, baby showers" },
  { id: "fiesta", nombre: "Fiesta", detalle: "Energía: confeti, neón, música desde el primer scroll.", para: "Cumpleaños de adultos, despedidas, fin de año" },
  { id: "corporativa", nombre: "Corporativa", detalle: "Sobria y clara, con espacio para la marca de la empresa y la agenda del evento.", para: "Lanzamientos, cenas anuales, congresos" },
] as const;
