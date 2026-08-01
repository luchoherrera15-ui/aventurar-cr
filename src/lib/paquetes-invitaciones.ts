/**
 * Los paquetes de Invitaciones Digitales de Bookea — la fuente única
 * que comparten las price cards (src/components/paquetes-invitaciones)
 * y la server action que abre el pedido por chat
 * (src/app/invitaciones/actions). El negocio destino es el rancho con
 * slug `bookea-invitaciones` (lo siembra scripts/seed-negocio-invitaciones.mjs).
 */

export const SLUG_NEGOCIO_INVITACIONES = "bookea-invitaciones";

/** Los tipos de fiesta del formulario de pedido (y su validación). */
export const TIPOS_EVENTO = [
  "Boda",
  "Quince años",
  "Cumpleaños infantil",
  "Cumpleaños adulto",
  "Baby shower",
  "Revelación de género",
  "Graduación",
  "Aniversario",
  "Evento corporativo",
  "Otro",
] as const;

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
  /** Etiqueta de precio lista para mostrar ("$20"). */
  precioEtiqueta: string;
  /** El monto en dólares, para el pedido y el cobro. */
  precioUSD: number;
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
    precioUSD: 20,
    badge: "Para arrancar",
    lema: "Tu invitación virtual personalizada, lista para compartir.",
    incluye: [
      "Invitación virtual personalizada",
      "Confirmación vía WhatsApp (la llevás vos, sin sistema)",
      "Cuenta regresiva al gran día",
      "Derecho a 1 cambio de diseño",
    ],
    detalle: [
      "Personalización de diseño básica",
      "Después de ver tu invitación podés pedir un cambio de diseño; si querés más, se cobran aparte",
    ],
  },
  {
    id: "intermedio",
    nombre: "Intermedio",
    precioEtiqueta: "$40",
    precioUSD: 40,
    badge: "El favorito",
    destacado: true,
    lema: "Control automático y completo de tu lista de invitados.",
    incluye: [
      "Todo lo del paquete Básico",
      "Confirmación en el website: tus invitados confirman en el link",
      "Panel en bookea.lat para administrar la lista de invitados",
      "Derecho a 2 cambios de diseño",
    ],
    detalle: [
      "Vé en tiempo real quién confirma y quién no puede asistir",
      "PDFs imprimibles de tu invitación",
      "Personalización de diseño intermedia",
      "Dos rondas de cambios sobre el diseño que te presentamos",
    ],
  },
  {
    id: "plus",
    nombre: "Plus",
    precioEtiqueta: "$60",
    precioUSD: 60,
    badge: "Diseño premium",
    lema: "Todo lo del Intermedio, con nuestro diseño más alto.",
    incluye: [
      "Todo lo del paquete Intermedio",
      "Diseño Plus: animaciones y acabado premium",
      "Derecho a 3 cambios de diseño",
      "Versión para imprimir en Carta o A4",
    ],
    detalle: [
      "Personalización al máximo nivel — un diseño creado solo para vos",
      "Tres rondas de cambios: la afinamos hasta que quede como la querés",
      "Tu invitación en PDF para llevar a imprimir, con el mismo diseño",
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

/**
 * Un paquete cualquiera (principal o con álbum) resuelto a lo que
 * necesita el pedido: cómo se llama, cuánto cuesta y si trae panel.
 * Devuelve null si el id no existe.
 */
export type PaqueteResuelto = {
  id: string;
  nombre: string;
  /** Uno de los dos viene lleno según la familia del paquete. */
  precioUSD: number | null;
  precioCRC: number | null;
  etiqueta: string;
  /** El Básico se maneja por WhatsApp: sin panel de asistencia. */
  tienePanel: boolean;
};

export function resolverPaquete(id: string): PaqueteResuelto | null {
  const principal = PAQUETES_PRINCIPALES.find((p) => p.id === id);
  if (principal) {
    return {
      id: principal.id,
      nombre: principal.nombre,
      precioUSD: principal.precioUSD,
      precioCRC: null,
      etiqueta: principal.precioEtiqueta,
      tienePanel: principal.id !== "basico",
    };
  }
  const conAlbum = PAQUETES_INVITACIONES.find((p) => p.id === id);
  if (conAlbum) {
    return {
      id: conAlbum.id,
      nombre: conAlbum.nombre,
      precioUSD: null,
      precioCRC: conAlbum.precio,
      etiqueta: precioPaquete(conAlbum.precio),
      tienePanel: true,
    };
  }
  return null;
}

/**
 * Tipo de cambio para mostrar el equivalente en colones de los
 * paquetes en dólares (SINPE y transferencia cobran en ₡).
 * Se ajusta con TIPO_CAMBIO_USD sin tocar código.
 */
export function tipoCambioUSD(): number {
  const v = Number(process.env.TIPO_CAMBIO_USD);
  return Number.isFinite(v) && v > 0 ? v : 520;
}

/** El monto a cobrar en colones, venga el paquete en $ o en ₡. */
export function montoEnColones(p: PaqueteResuelto): number {
  if (p.precioCRC !== null) return p.precioCRC;
  return Math.round(((p.precioUSD ?? 0) * tipoCambioUSD()) / 100) * 100;
}
