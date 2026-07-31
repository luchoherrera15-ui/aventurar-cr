/**
 * Los paquetes de Invitaciones Digitales de Bookea — espejo de
 * src/lib/paquetes-invitaciones.ts en /web (misma base de Supabase).
 * Si cambiás precios o bullets acá, cambialos también allá. El negocio
 * destino del pedido es el rancho con slug `bookea-invitaciones`.
 *
 * OJO con la plata: lo de acá es para MOSTRAR. El monto que se cobra
 * lo resuelve el servidor en /api/invitaciones/pedido a partir del id
 * del paquete — el teléfono nunca manda un precio. Si estas cifras se
 * desincronizan de la web, el cliente vería un número y pagaría otro,
 * pero no podría pagar de menos.
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

/**
 * Los tres paquetes principales — espejo de PAQUETES_PRINCIPALES en
 * la web. Son los que se ven de una vez; los de álbumes quedan abajo.
 */
export type PaquetePrincipal = {
  id: "basico" | "intermedio" | "plus";
  nombre: string;
  /** Etiqueta de precio lista para mostrar ("$20"). */
  precioEtiqueta: string;
  /** El monto en dólares, para mostrar el equivalente en colones. */
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
    ],
    detalle: ["Personalización de diseño básica"],
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
    precioUSD: 60,
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

export type PaqueteInvitacion = {
  /** Identificador estable del paquete. */
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
 * El paquete Base (₡12 500): la invitación generada con IA, exclusiva
 * para quienes reservan su espacio en Bookea. No se pide por esta
 * pantalla — se ofrece al terminar una reserva.
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
 * necesita la pantalla de pedido. Devuelve null si el id no existe.
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
 * Tipo de cambio SOLO para mostrar el equivalente en colones (SINPE y
 * transferencia cobran en ₡). El monto real lo calcula el servidor con
 * su propia TIPO_CAMBIO_USD: si las dos se separan, el app muestra un
 * "≈" y la pantalla de pago — que lee el pedido ya guardado — manda.
 */
export function tipoCambioUSD(): number {
  const v = Number(process.env.EXPO_PUBLIC_TIPO_CAMBIO_USD);
  return Number.isFinite(v) && v > 0 ? v : 520;
}

/** El equivalente aproximado en colones, venga el paquete en $ o en ₡. */
export function montoEnColones(p: PaqueteResuelto): number {
  if (p.precioCRC !== null) return p.precioCRC;
  return Math.round(((p.precioUSD ?? 0) * tipoCambioUSD()) / 100) * 100;
}
