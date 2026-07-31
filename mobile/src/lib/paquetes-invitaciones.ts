/**
 * Lo único que el app todavía necesita del mundo de las invitaciones
 * digitales: a qué negocio le escribe quien tiene una duda.
 *
 * Acá vivía el catálogo completo de paquetes con sus precios, espejo de
 * src/lib/paquetes-invitaciones.ts de la web. Se fue junto con las
 * pantallas de pedido y de pago: las invitaciones son contenido digital
 * y cobrarlas dentro del app exige compra in-app (guía 3.1.1 de Apple,
 * política de pagos de Google). Contratar y pagar viven solo en
 * bookea.lat, y el app no muestra precios ni botones de compra.
 *
 * A propósito NO se vuelve a copiar el catálogo acá: mientras los
 * precios no existan en el app, nadie los puede dejar desactualizados
 * ni resucitar la venta por descuido.
 */

export const SLUG_NEGOCIO_INVITACIONES = "bookea-invitaciones";
