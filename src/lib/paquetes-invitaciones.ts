/**
 * Los paquetes de Invitaciones Digitales de Bookea — la fuente única
 * que comparten las price cards (src/components/paquetes-invitaciones)
 * y la server action que abre el pedido por chat
 * (src/app/invitaciones/actions). El negocio destino es el rancho con
 * slug `bookea-invitaciones` (lo siembra scripts/seed-negocio-invitaciones.mjs).
 */

export const SLUG_NEGOCIO_INVITACIONES = "bookea-invitaciones";

export type PaqueteInvitacion = {
  /** Identificador estable que viaja a la server action. */
  id: "destello" | "celebracion" | "legado";
  nombre: string;
  /** Precio total en colones. */
  precio: number;
  /** La etiquetita de la esquina de la card. */
  badge: string;
  /** La card navy protagonista del medio. */
  destacado?: boolean;
  /** Frase corta que remata debajo del precio. */
  lema: string;
  /** Qué incluye, ya en palabras de Bookea. */
  incluye: string[];
};

export const PAQUETES_INVITACIONES: PaqueteInvitacion[] = [
  {
    id: "destello",
    nombre: "Destello",
    precio: 44900,
    badge: "Álbum de regalo",
    lema: "Todo lo esencial para que tu evento se anuncie con estilo.",
    incluye: [
      "Invitación diseñada a tu medida, empezando de una hoja en blanco",
      "Tus invitados confirman en el link y vos ves la lista en vivo",
      "Ubicación con GPS (Maps y Waze) y cuenta regresiva al gran día",
      "Álbum digital de 50 fotos de regalo para revivir la fiesta",
      "Resguardo en la nube por 10 años: tu recuerdo no se pierde",
    ],
  },
  {
    id: "celebracion",
    nombre: "Celebración",
    precio: 53900,
    badge: "El favorito",
    destacado: true,
    lema: "El punto justo: más fotos, más detalle, cero complicaciones.",
    incluye: [
      "Todo lo del paquete Destello",
      "Álbum de 150 fotos con código QR: tus invitados suben las suyas",
      "Preguntas personalizadas al confirmar (menú, alergias, lo que ocupés)",
    ],
  },
  {
    id: "legado",
    nombre: "Legado",
    precio: 62900,
    badge: "Edición exclusiva",
    lema: "Para eventos que se cuentan una sola vez en la vida.",
    incluye: [
      "Todo lo del paquete Celebración",
      "Álbum ampliado a 250 fotos del evento",
      "Diseño 100% exclusivo, con animaciones creadas solo para vos",
    ],
  },
];

/** ₡44 900 con el formato local del sitio. */
export function precioPaquete(precio: number): string {
  return "₡" + Math.round(precio).toLocaleString("es-CR");
}
