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

/* ==================================================================
   EL CATÁLOGO 2026 — productos individuales y packs
   ==================================================================
   Precios fijados contra la competencia directa: los individuales van
   $10 abajo de su equivalente y los packs $12 abajo.

   OJO — el precio que se COBRA no sale de acá: sale de la tabla
   `paquetes_invitacion` (migración 0087, "el precio lo pone la base").
   Este archivo manda en lo que se MUESTRA. Cambiar un precio son
   SIEMPRE dos lugares: acá y una migración. El servidor compara los
   dos y deja un aviso en el log si no coinciden.
   ================================================================== */

/** Un producto que se vende suelto (álbum, invitación, save the date). */
export type ProductoIndividual = {
  /** Id estable: viaja al pedido y es la PK en `paquetes_invitacion`. */
  id: string;
  nombre: string;
  precioUSD: number;
  /** Para agrupar en columnas en la landing. */
  familia: "album" | "invitacion" | "save_the_date";
  /** La Estándar se maneja por WhatsApp: sin panel de confirmaciones. */
  tienePanel?: boolean;
  /** Detalle corto que acompaña al nombre donde haya espacio. */
  detalle?: string;
  /**
   * El precio de lista, para mostrarlo tachado al lado del de promo.
   * Solo se pone mientras la promoción esté viva: `precioUSD` sigue
   * siendo SIEMPRE lo que se cobra (y lo que dice la base, que es la
   * que manda). Al vencer la promo se borra este campo y se devuelve
   * `precioUSD` a su valor de lista, en el código Y en la base.
   */
  precioAntesUSD?: number;
};

/**
 * La promoción de lanzamiento de las invitaciones (agosto 2026): un mes
 * de precio rebajado. La fecha vive acá para que el cartel no mienta
 * cuando pase — y para poder buscarla el día que haya que levantarla.
 */
export const PROMO_INVITACIONES = {
  hasta: "2026-09-06",
  hastaTexto: "6 de setiembre",
  etiqueta: "Precio de lanzamiento",
} as const;

/** ¿Sigue viva la promo? Se evalúa contra el día de hoy. */
export function promoVigente(hoy: Date = new Date()): boolean {
  return hoy <= new Date(`${PROMO_INVITACIONES.hasta}T23:59:59-06:00`);
}

/** El % de descuento redondeado, para el sellito. Sirve para productos
 *  sueltos y para packs: los dos llevan precio y precio de lista. */
export function descuentoPct(p: {
  precioUSD: number;
  precioAntesUSD?: number;
}): number | null {
  if (!p.precioAntesUSD || p.precioAntesUSD <= p.precioUSD) return null;
  return Math.round((1 - p.precioUSD / p.precioAntesUSD) * 100);
}

export const PRODUCTOS_INDIVIDUALES: ProductoIndividual[] = [
  // --- Álbumes digitales (se venden por cantidad de fotos) ---
  { id: "album_50", nombre: "50 fotos", precioUSD: 39, familia: "album" },
  { id: "album_150", nombre: "150 fotos", precioUSD: 69, familia: "album" },
  { id: "album_250", nombre: "250 fotos", precioUSD: 99, familia: "album" },
  { id: "album_400", nombre: "400 fotos", precioUSD: 139, familia: "album" },
  { id: "album_600", nombre: "600 fotos", precioUSD: 189, familia: "album" },

  // --- Invitaciones ---
  {
    // El id se queda en `inv_esencial` aunque el nombre cambió a
    // "Estándar": los pedidos ya hechos y la fila de la base lo
    // referencian, y el id nunca se muestra en pantalla.
    id: "inv_esencial",
    nombre: "Invitación Estándar",
    precioUSD: 14.99,
    precioAntesUSD: 25,
    familia: "invitacion",
    tienePanel: false,
    detalle: "Diseño a tu medida y confirmación por WhatsApp.",
  },
  {
    id: "inv_premium",
    nombre: "Invitación Premium",
    precioUSD: 19.99,
    precioAntesUSD: 85,
    familia: "invitacion",
    detalle: "Con panel de confirmaciones, GPS y cuenta regresiva.",
  },

  // --- Save the date ---
  {
    id: "save_the_date",
    nombre: "Diseño Save the Date",
    precioUSD: 29,
    familia: "save_the_date",
    tienePanel: false,
    detalle: "El anuncio previo, con la fecha y el enlace a tu invitación.",
  },
];

export const FAMILIA_LABEL: Record<ProductoIndividual["familia"], string> = {
  album: "Álbumes digitales",
  invitacion: "Invitaciones",
  save_the_date: "Save the date",
};

/**
 * Los packs: invitación Premium + álbum, más baratos que por separado.
 *
 * Los ids conservan las piedras del catálogo original (perla/zafiro/
 * diamante) porque los pedidos hechos y la base los referencian; los
 * NOMBRES que se muestran son propios de la casa: El Brindis, El Gran
 * Día y Para Siempre — la historia del evento, no una joyería.
 */
export type PackInvitacion = {
  id: "perla" | "zafiro" | "diamante";
  nombre: string;
  precioUSD: number;
  badge: string;
  destacado?: boolean;
  /** El precio de lista, tachado mientras dure la promo. */
  precioAntesUSD?: number;
  lema: string;
  incluye: string[];
  /**
   * El álbum que trae. Lo que costaría suelto NO se escribe a mano: se
   * calcula con los precios de HOY (ver `sueltoPack`). Cuando la
   * Premium está en promo, comprar por separado puede salir más barato
   * que el pack — y entonces el cartel de "ahorrás" no debe aparecer,
   * en vez de anunciar un ahorro que no existe.
   */
  albumId: string;
};

export const PACKS_INVITACIONES: PackInvitacion[] = [
  {
    id: "perla",
    nombre: "El Brindis",
    precioUSD: 35,
    precioAntesUSD: 75,
    albumId: "album_50",
    badge: "Álbum de regalo",
    lema: "La invitación completa, con el álbum de la fiesta incluido.",
    incluye: [
      "Invitación Premium diseñada desde cero",
      "Confirmación de asistencia, GPS y cuenta regresiva",
      "Álbum digital de 50 fotos con código QR",
      "Respaldo garantizado por 10 años en la nube",
    ],
  },
  {
    // EL COMBO PROMOCIONADO (pedido del dueño, ago 2026): Premium +
    // álbum de 150 fotos por $45 — el precio con el que se promociona
    // el catálogo. Ver el resto de la nota en PROMO_INVITACIONES.
    id: "zafiro",
    nombre: "El Gran Día",
    precioUSD: 45,
    precioAntesUSD: 99,
    albumId: "album_150",
    badge: "El favorito",
    destacado: true,
    lema: "El punto justo: más fotos para que no se pierda ningún momento.",
    incluye: [
      "Invitación Premium diseñada desde cero",
      "Confirmación de asistencia, GPS y cuenta regresiva",
      "Álbum digital de 150 fotos con código QR",
      "Respaldo garantizado por 10 años en la nube",
    ],
  },
  {
    id: "diamante",
    nombre: "Para Siempre",
    precioUSD: 125,
    precioAntesUSD: 163,
    albumId: "album_250",
    badge: "Exclusivo",
    lema: "Para el evento que se cuenta una sola vez en la vida.",
    incluye: [
      "Invitación Premium diseñada desde cero",
      "Confirmación de asistencia, GPS y cuenta regresiva",
      "Álbum digital de 250 fotos con código QR",
      "Respaldo garantizado por 10 años en la nube",
    ],
  },
];

/** Lo que costaría comprar las piezas por separado, a precios de HOY. */
export function sueltoPack(p: PackInvitacion): number {
  const precio = (id: string) =>
    PRODUCTOS_INDIVIDUALES.find((x) => x.id === id)?.precioUSD ?? 0;
  return precio("inv_premium") + precio(p.albumId);
}

/**
 * Lo que se ahorra comprando el pack. Puede dar CERO O NEGATIVO durante
 * una promo de las piezas sueltas: en ese caso la pantalla no muestra
 * ningún ahorro, en vez de inventarlo.
 */
export function ahorroPack(p: PackInvitacion): number {
  return sueltoPack(p) - p.precioUSD;
}

/**
 * Los tres paquetes PRINCIPALES de venta directa: Básico, Intermedio y
 * Plus.
 *
 * CATÁLOGO ANTERIOR (2025): ya no se ofrecen en la landing — los
 * reemplazan PRODUCTOS_INDIVIDUALES y PACKS_INVITACIONES. Se conservan
 * acá (y activos en la base) porque hay pedidos hechos que los
 * referencian por id: borrarlos dejaría esos pedidos sin nombre ni
 * precio en el panel y en los correos ya mandados.
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
 * El álbum digital como COMPLEMENTO de los tres paquetes principales.
 *
 * Es el mismo álbum que ya traen los paquetes con álbum (Destello,
 * Celebración, Legado), ofrecido acá como extra marcable.
 *
 * Ojo: este precio es para MOSTRAR. El que se cobra sale de la fila
 * `album_180` de `paquetes_invitacion` (0091) — desde el navegador solo
 * viaja un sí/no, nunca un monto. Si los dos se separan, el servidor
 * deja el aviso en el log al crear el pedido.
 */
export const ALBUM_ADICIONAL = {
  // El id se queda en `album_180` aunque el álbum ahora sea de 150
  // fotos: es la PK que ya referencian los pedidos hechos y la que
  // busca el RPC `crear_pedido_invitacion` (0091). Renombrarlo dejaría
  // esos pedidos sin precio. El nombre y el monto sí se alinearon al
  // catálogo 2026 — antes eran 180 fotos por $45, o sea MÁS BARATO que
  // el álbum de 150 que se vende suelto a $69.
  id: "album_180",
  nombre: "Álbum digital de 150 fotos",
  precioUSD: 69,
  fotos: 150,
  detalle:
    "Tus invitados suben sus fotos del evento escaneando un QR, y quedan todas en un álbum que podés descargar completo.",
} as const;

/**
 * ¿Tiene sentido ofrecerle el álbum como extra a quien pidió esto?
 * No, si el producto YA es un álbum o ya lo trae incluido (los packs):
 * ahí el checkbox vendía un segundo álbum.
 */
export function admiteAlbumAdicional(paqueteId: string): boolean {
  if (PACKS_INVITACIONES.some((p) => p.id === paqueteId)) return false;
  const individual = PRODUCTOS_INDIVIDUALES.find((p) => p.id === paqueteId);
  if (individual) return individual.familia !== "album";
  // Catálogo viejo (Destello/Celebración/Legado ya traían álbum).
  return !PAQUETES_INVITACIONES.some((p) => p.id === paqueteId);
}

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
  // Catálogo 2026 primero: packs y productos sueltos.
  const pack = PACKS_INVITACIONES.find((p) => p.id === id);
  if (pack) {
    return {
      id: pack.id,
      nombre: `Pack ${pack.nombre}`,
      precioUSD: pack.precioUSD,
      precioCRC: null,
      etiqueta: `$${pack.precioUSD}`,
      tienePanel: true,
    };
  }
  const individual = PRODUCTOS_INDIVIDUALES.find((p) => p.id === id);
  if (individual) {
    return {
      id: individual.id,
      nombre:
        individual.familia === "album"
          ? `Álbum digital de ${individual.nombre}`
          : individual.nombre,
      precioUSD: individual.precioUSD,
      precioCRC: null,
      etiqueta: `$${individual.precioUSD}`,
      // Un álbum suelto o un save the date no llevan panel de
      // confirmaciones: no hay invitados que confirmar.
      tienePanel: individual.tienePanel ?? individual.familia === "invitacion",
    };
  }

  // Catálogo anterior: sigue resolviendo para los pedidos ya hechos.
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

/** Lo que suma el álbum en colones, para mostrarlo junto al paquete. */
export function albumEnColones(): number {
  return Math.round((ALBUM_ADICIONAL.precioUSD * tipoCambioUSD()) / 100) * 100;
}
