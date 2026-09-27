// Los datos de la invitación de Antonella en UN SOLO LUGAR: de acá
// comen tanto la vista previa local como la siembra en Supabase, para
// que nunca se despeguen la una de la otra.
//
// ⚠️ PENDIENTE: la FECHA es provisional — todavía no nos la dieron.
//    Cambiá FECHA y FECHA_ISO acá y todo lo demás se acomoda solo
//    (incluida la cuenta regresiva, que lee FECHA_ISO).
// ⚠️ PENDIENTE: el texto y el link de la sección de regalos.

const LUGAR = "Rancho Las Torres";
const DIRECCION = "Calle Monge, Alajuela";
const BUSQUEDA = `${LUGAR}, ${DIRECCION}, Costa Rica`;

export const SLUG = "baby-shower-antonella";
export const TEMA = "conejitos";
export const PLANTILLA = "docs/plantillas-invitaciones/conejitos.html";

/** La foto recortada y comprimida de Antonella (fondo transparente). */
export const FOTO_LOCAL = "docs/plantillas-invitaciones/fotos/antonella-680.webp";
export const FOTO_REMOTA = "invitaciones/antonella/antonella.webp";

/** Lo que va en las columnas de la tabla `invitaciones`. */
export const FILA = {
  titulo: "Baby Shower de Antonella",
  anfitriones: "Sus papás",
  mensaje: "Vení a llenar de abrazos el nidito de Antonella.",
  fecha_evento: "2026-11-07", // ⚠️ provisional
  hora: "5:30 p. m.",
  lugar_nombre: LUGAR,
  direccion: DIRECCION,
  maps_url: maps(BUSQUEDA),
  estado: "activa",
};

/** Lo que reemplaza a los {{PLACEHOLDERS}} de la plantilla. */
export const DATOS = {
  NOMBRE: "Antonella",
  ANFITRIONES: "sus papás",
  FECHA: "sábado 7 de noviembre, 2026", // ⚠️ provisional
  FECHA_ISO: "2026-11-07T17:30:00-06:00", // ⚠️ provisional
  HORA: "5:30 p. m.",
  LUGAR,
  DIRECCION,
  LINK_MAPS: maps(BUSQUEDA),
  LINK_WAZE: waze(BUSQUEDA),
  // ⚠️ PENDIENTE: lo definitivo lo mandan los anfitriones.
  MENSAJE_REGALOS:
    "Tu presencia ya es el mejor regalo. Si además querés consentir a " +
    "Antonella, acá te dejamos algunas ideas.",
  LINK_REGALO_1: "https://bookea.lat",
  SINPE: "8888-8888",
};

function maps(q) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function waze(q) {
  return `https://waze.com/ul?q=${encodeURIComponent(q)}`;
}

/** Sustituye {{CLAVE}} por su valor en toda la plantilla. */
export function rellenar(plantilla, datos) {
  return Object.entries(datos).reduce(
    (html, [clave, valor]) => html.replaceAll(`{{${clave}}}`, valor),
    plantilla,
  );
}
