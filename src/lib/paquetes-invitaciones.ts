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

/**
 * Los tres paquetes PRINCIPALES de venta directa: Básico, Intermedio y
 * Plus. Son los que se ven de una vez en /invitaciones; los de arriba
 * (con álbumes digitales) quedan plegados tras un "Ver packs con
 * álbumes digitales".
 */
export type PaquetePrincipal = {
  id: "basico" | "intermedio" | "plus";
  nombre: string;
  /** Etiqueta de precio lista para mostrar ("$20" o "Consultanos"). */
  precioEtiqueta: string;
  badge: string;
  destacado?: boolean;
  lema: string;
  /** Lo que se ve de una vez (la card compacta). */
  incluye: string[];
  /** Lo que aparece al tocar "Ver más". */
  detalle: string[];
};

export const PAQUETES_PRINCIPALES: PaquetePrincipal[] = [
  {
    id: "basico",
    nombre: "Básico",
    precioEtiqueta: "$20",
    badge: "Para arrancar",
    lema: "Tu invitación virtual personalizada, lista para compartir.",
    incluye: [
      "Invitación virtual personalizada",
      "Confirmación vía WhatsApp (la llevás vos, sin sistema)",
      "Cuenta regresiva al gran día",
    ],
    detalle: ["Personalización de diseño básica"],
  },
  {
    id: "intermedio",
    nombre: "Intermedio",
    precioEtiqueta: "$40",
    badge: "El favorito",
    destacado: true,
    lema: "Control automático y completo de tu lista de invitados.",
    incluye: [
      "Todo lo del paquete Básico",
      "Confirmación en el website: tus invitados confirman en el link",
      "Panel en bookea.lat para administrar la lista de invitados",
    ],
    detalle: [
      "Vé en tiempo real quién confirma y quién no puede asistir",
      "PDFs imprimibles de tu invitación",
      "Personalización de diseño intermedia",
    ],
  },
  {
    id: "plus",
    nombre: "Plus",
    precioEtiqueta: "$60",
    badge: "Diseño premium",
    lema: "Todo lo del Intermedio, con nuestro diseño más alto.",
    incluye: [
      "Todo lo del paquete Intermedio",
      "Diseño Plus: animaciones y acabado premium",
    ],
    detalle: [
      "Personalización al máximo nivel — un diseño creado solo para vos",
    ],
  },
];

/**
 * El paquete Base (₡12 500): la invitación generada con IA, exclusiva
 * para quienes reservan su espacio en Bookea. No viaja por el chat de
 * pedidos: se ofrece en la card post-reserva y acá se explica.
 */
export const PAQUETE_BASE = {
  nombre: "Base",
  precio: 12500,
  badge: "Solo con tu reserva",
  lema: "La invitación generada con IA — el precio especial de quienes ya reservaron su espacio en Bookea.",
  incluye: [
    "Invitación digital generada con IA en minutos",
    "Tus invitados confirman en el link y vos ves la lista en vivo",
    "Dirección personalizada: bookea.lat/invitacion/tu-nombre",
  ],
} as const;

/** ₡44 900 con el formato local del sitio. */
export function precioPaquete(precio: number): string {
  return "₡" + Math.round(precio).toLocaleString("es-CR");
}
