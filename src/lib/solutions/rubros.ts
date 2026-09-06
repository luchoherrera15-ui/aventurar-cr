import type { Idioma } from "./idiomas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS RUBROS DE SOLUTIONS — el link hub para cualquier negocio
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026): «el link hub no solo para
 * restaurantes: lavacar, detailing, un menú propio de cada página…
 * que la gente cree un sitio web pequeño, lo adapte, y hasta un
 * sistema de ventas en línea tipo catálogo».
 *
 * ── UNA SOLA ESTRUCTURA, TRES VOCABULARIOS ─────────────────────────
 * No hay tablas nuevas. El «menú» de un restaurante, la «lista de
 * servicios» de un lavacar y el «catálogo» de una boutique son la
 * MISMA cosa en la base: secciones con ítems, cada ítem con foto,
 * precio, descripción y disponibilidad (solutions_menu_*). Lo que
 * cambia es cómo se llama cada cosa —plato / servicio / producto— y
 * qué formas de pedir tienen sentido: la mesa con QR es de comida;
 * «recoger en tienda» y «envío» son de una tienda; «en el local» y
 * «a domicilio» son de un servicio.
 *
 * Por eso cada rubro apunta a un `TipoCatalogo`, y TODO el texto que
 * depende del tipo sale de acá (`VOCAB` para el panel en español,
 * `ROTULOS_CATALOGO` para la página pública en los seis idiomas). El
 * JSX pide `vocabDe(rubro).items` y no vuelve a escribir «platos».
 *
 * ── EL CHECK DE LA 0236 ESPEJA `RUBROS` ────────────────────────────
 * Si se agrega un rubro, va acá y en la migración.
 */

export const RUBROS = [
  "restaurante", "cafeteria", "bar", "foodtruck", "panaderia",
  "lavacar", "detailing", "taller",
  "barberia", "salon", "spa", "gimnasio",
  "tienda", "boutique", "floristeria", "farmacia", "veterinaria",
  "hotel", "tours", "profesional", "creador", "otro",
] as const;
export type Rubro = (typeof RUBROS)[number];

/** Cómo se llama lo que el negocio vende. Decide el vocabulario entero. */
export const TIPOS_CATALOGO = ["menu", "servicios", "productos"] as const;
export type TipoCatalogo = (typeof TIPOS_CATALOGO)[number];

export type DefinicionRubro = {
  nombre: string;
  /** Una línea para el selector del alta. */
  pie: string;
  catalogo: TipoCatalogo;
  /** Sirve comida: tiene mesas con QR y su tablero es el Modo restaurante. */
  comida: boolean;
  /** Para agrupar el selector. */
  grupo: "comida" | "auto" | "belleza" | "tienda" | "servicios";
  /** Un ejemplo de bajada, para el placeholder. */
  ejemploBajada: string;
};

export const RUBRO: Record<Rubro, DefinicionRubro> = {
  restaurante: { nombre: "Restaurante", pie: "Menú, mesas con QR, To go y exprés", catalogo: "menu", comida: true, grupo: "comida", ejemploBajada: "Pastas caseras, horno de leña y vinos de la casa." },
  cafeteria: { nombre: "Cafetería", pie: "Menú y pedidos para recoger", catalogo: "menu", comida: true, grupo: "comida", ejemploBajada: "Café de especialidad y repostería del día." },
  bar: { nombre: "Bar", pie: "Carta de tragos y comida", catalogo: "menu", comida: true, grupo: "comida", ejemploBajada: "Cócteles de autor y música en vivo los viernes." },
  foodtruck: { nombre: "Food truck", pie: "Menú corto y pedidos To go", catalogo: "menu", comida: true, grupo: "comida", ejemploBajada: "Hamburguesas a la parrilla, donde estemos hoy." },
  panaderia: { nombre: "Panadería / repostería", pie: "Catálogo de pan, tortas y encargos", catalogo: "menu", comida: true, grupo: "comida", ejemploBajada: "Pan de masa madre y tortas por encargo." },
  lavacar: { nombre: "Lavacar", pie: "Servicios, precios y reservas", catalogo: "servicios", comida: false, grupo: "auto", ejemploBajada: "Lavado a mano, encerado y limpieza de interiores." },
  detailing: { nombre: "Detailing", pie: "Paquetes, fotos y reservas", catalogo: "servicios", comida: false, grupo: "auto", ejemploBajada: "Corrección de pintura, cerámico y detallado completo." },
  taller: { nombre: "Taller mecánico", pie: "Servicios y citas", catalogo: "servicios", comida: false, grupo: "auto", ejemploBajada: "Mecánica general, frenos y diagnóstico computarizado." },
  barberia: { nombre: "Barbería", pie: "Servicios, precios y reservas", catalogo: "servicios", comida: false, grupo: "belleza", ejemploBajada: "Cortes clásicos, barba y toalla caliente." },
  salon: { nombre: "Salón de belleza", pie: "Servicios, precios y reservas", catalogo: "servicios", comida: false, grupo: "belleza", ejemploBajada: "Color, corte, uñas y pestañas con cita." },
  spa: { nombre: "Spa / masajes", pie: "Tratamientos y reservas", catalogo: "servicios", comida: false, grupo: "belleza", ejemploBajada: "Masajes, faciales y rituales de relajación." },
  gimnasio: { nombre: "Gimnasio / estudio", pie: "Planes, clases y horarios", catalogo: "servicios", comida: false, grupo: "belleza", ejemploBajada: "Entrenamiento funcional y clases grupales." },
  tienda: { nombre: "Tienda", pie: "Catálogo con carrito y envíos", catalogo: "productos", comida: false, grupo: "tienda", ejemploBajada: "Productos seleccionados, con envío a todo el país." },
  boutique: { nombre: "Boutique / ropa", pie: "Catálogo con fotos y envíos", catalogo: "productos", comida: false, grupo: "tienda", ejemploBajada: "Ropa y accesorios, nueva colección cada mes." },
  floristeria: { nombre: "Floristería", pie: "Catálogo de arreglos y envíos", catalogo: "productos", comida: false, grupo: "tienda", ejemploBajada: "Arreglos frescos y entregas el mismo día." },
  farmacia: { nombre: "Farmacia", pie: "Catálogo y pedidos a domicilio", catalogo: "productos", comida: false, grupo: "tienda", ejemploBajada: "Medicamentos y cuidado personal, con envío." },
  veterinaria: { nombre: "Veterinaria / mascotas", pie: "Servicios, productos y citas", catalogo: "servicios", comida: false, grupo: "tienda", ejemploBajada: "Consulta, vacunas, baño y tienda para tu mascota." },
  hotel: { nombre: "Hotel / hospedaje", pie: "Habitaciones, tarifas y reservas", catalogo: "servicios", comida: false, grupo: "servicios", ejemploBajada: "Habitaciones frente al mar, desayuno incluido." },
  tours: { nombre: "Tours / actividades", pie: "Paquetes, precios y reservas", catalogo: "servicios", comida: false, grupo: "servicios", ejemploBajada: "Tours guiados y experiencias por la región." },
  profesional: { nombre: "Profesional independiente", pie: "Servicios y contacto", catalogo: "servicios", comida: false, grupo: "servicios", ejemploBajada: "Consultoría, diseño y acompañamiento a medida." },
  creador: { nombre: "Creador / artista", pie: "Tus redes, tu contenido y tu tienda", catalogo: "productos", comida: false, grupo: "servicios", ejemploBajada: "Todo lo que hago, en un solo lugar." },
  otro: { nombre: "Otro negocio", pie: "Enlaces y catálogo, a tu manera", catalogo: "productos", comida: false, grupo: "servicios", ejemploBajada: "Lo que hacemos, en un solo enlace." },
};

export const GRUPO_RUBRO: Record<DefinicionRubro["grupo"], string> = {
  comida: "Comida y bebida",
  auto: "Autos",
  belleza: "Belleza y bienestar",
  tienda: "Tiendas",
  servicios: "Servicios y otros",
};

export function esRubro(v: unknown): v is Rubro {
  return typeof v === "string" && (RUBROS as readonly string[]).includes(v);
}
export function rubroDe(v: unknown): Rubro {
  return esRubro(v) ? v : "restaurante";
}
export function tipoCatalogoDe(rubro: Rubro): TipoCatalogo {
  return RUBRO[rubro]?.catalogo ?? "menu";
}
/** ¿Vende comida? Con QR de mesa y Modo restaurante. */
export function esDeComida(rubro: Rubro): boolean {
  return RUBRO[rubro]?.comida === true;
}

// ── EL VOCABULARIO DEL PANEL (español) ─────────────────────────────

export type Vocabulario = {
  /** «Menú» / «Servicios» / «Catálogo». */
  catalogo: string;
  /** El nombre del add-on y de la pestaña: «Menú digital»… */
  catalogoLargo: string;
  item: string;
  items: string;
  Item: string;
  Items: string;
  seccionesEjemplo: string;
  /** El botón de la página: «Ver el menú». */
  verCatalogo: string;
  verYPedir: string;
  /** El paso del tablero: «Cargá tu menú». */
  cargar: string;
  cargarDetalle: string;
  /** El tablero de operación: «Modo restaurante». */
  tablero: string;
  tableroPie: string;
  /** El add-on de pedidos, con su nombre para este rubro. */
  pedidosNombre: string;
  pedidosPie: string;
  pedidosIncluye: string[];
  catalogoIncluye: string[];
  /** Las modalidades en español, para el panel. */
  modalidades: { llevar: { rotulo: string; pie: string }; express: { rotulo: string; pie: string } };
  /** «Pedir» / «Reservar» / «Comprar». */
  pedir: string;
  /** El paso «Decidí cómo recibís pedidos». */
  decidir: string;
  decidirDetalle: string;
};

export const VOCAB: Record<TipoCatalogo, Vocabulario> = {
  menu: {
    catalogo: "Menú",
    catalogoLargo: "Menú digital",
    item: "plato",
    items: "platos",
    Item: "Plato",
    Items: "Platos",
    seccionesEjemplo: "Entradas, Platos fuertes, Bebidas…",
    verCatalogo: "Ver el menú",
    verYPedir: "Ver el menú y pedir",
    cargar: "Cargá tu menú",
    cargarDetalle: "Secciones, platos, fotos y precios.",
    tablero: "Modo restaurante",
    tableroPie: "Comandas en vivo: mesa, To go y exprés",
    pedidosNombre: "Pedidos",
    pedidosPie: "Desde la mesa, To go y exprés",
    pedidosIncluye: ["QR por mesa y comandas en vivo", "To go y exprés desde tu página", "Sin comisión: cobrás en tu caja"],
    catalogoIncluye: ["Menú con tu marca, en hasta seis idiomas", "«Agotado hoy» con un toque", "Ficha nutricional opcional por plato"],
    modalidades: {
      llevar: { rotulo: "To go", pie: "Pasa a recogerlo." },
      express: { rotulo: "Exprés", pie: "Se lo llevás a su dirección." },
    },
    pedir: "Pedir",
    decidir: "Decidí cómo recibís pedidos",
    decidirDetalle: "Desde la mesa, To go o exprés, y con qué se paga.",
  },
  servicios: {
    catalogo: "Servicios",
    catalogoLargo: "Lista de servicios",
    item: "servicio",
    items: "servicios",
    Item: "Servicio",
    Items: "Servicios",
    seccionesEjemplo: "Lavado, Encerado, Interiores…",
    verCatalogo: "Ver los servicios",
    verYPedir: "Ver servicios y reservar",
    cargar: "Cargá tus servicios",
    cargarDetalle: "Secciones, servicios, fotos y precios.",
    tablero: "Reservas y pedidos",
    tableroPie: "Lo que te piden desde tu página, en vivo",
    pedidosNombre: "Reservas en línea",
    pedidosPie: "Que te reserven un servicio desde tu página",
    pedidosIncluye: ["El cliente elige el servicio y deja sus datos", "En tu local o a domicilio", "Sin comisión: cobrás vos"],
    catalogoIncluye: ["Tus servicios con tu marca, en hasta seis idiomas", "Fotos y precios por servicio", "«No disponible hoy» con un toque"],
    modalidades: {
      llevar: { rotulo: "En el local", pie: "El cliente va a tu local." },
      express: { rotulo: "A domicilio", pie: "Vos vas a donde el cliente." },
    },
    pedir: "Reservar",
    decidir: "Decidí cómo recibís reservas",
    decidirDetalle: "En tu local o a domicilio, y con qué se paga.",
  },
  productos: {
    catalogo: "Catálogo",
    catalogoLargo: "Catálogo de productos",
    item: "producto",
    items: "productos",
    Item: "Producto",
    Items: "Productos",
    seccionesEjemplo: "Novedades, Ofertas, Accesorios…",
    verCatalogo: "Ver el catálogo",
    verYPedir: "Ver el catálogo y comprar",
    cargar: "Cargá tus productos",
    cargarDetalle: "Secciones, productos, fotos y precios.",
    tablero: "Ventas en línea",
    tableroPie: "Los pedidos de tu tienda, en vivo",
    pedidosNombre: "Ventas en línea",
    pedidosPie: "Carrito y pedidos desde tu catálogo",
    pedidosIncluye: ["Carrito con tus productos y precios", "Recoger en tienda o envío a domicilio", "Sin comisión: cobrás vos"],
    catalogoIncluye: ["Tu catálogo con tu marca, en hasta seis idiomas", "Fotos y precios por producto", "«Agotado» con un toque"],
    modalidades: {
      llevar: { rotulo: "Recoger en tienda", pie: "El cliente pasa a recogerlo." },
      express: { rotulo: "Envío a domicilio", pie: "Se lo mandás a su dirección." },
    },
    pedir: "Comprar",
    decidir: "Decidí cómo vendés",
    decidirDetalle: "Recoger en tienda o envío, y con qué se paga.",
  },
};

export function vocabDe(rubro: Rubro): Vocabulario {
  return VOCAB[tipoCatalogoDe(rubro)];
}

// ── LA PÁGINA PÚBLICA, EN LOS SEIS IDIOMAS ─────────────────────────

export type RotulosCatalogo = {
  titulo: string;
  /** La bajada cuando solo se mira: «Precios en …» la completa la página. */
  llevar: string;
  llevarPie: string;
  express: string;
  enviar: string;
  verPedido: string;
  tuPedido: string;
  pasaARecoger: string;
  pieLlevar: string;
  /** «Consultar por WhatsApp» / «Reservar por WhatsApp», cuando no hay pedidos en línea. */
  consultarWhatsapp: string;
};

export const ROTULOS_CATALOGO: Record<TipoCatalogo, Record<Idioma, RotulosCatalogo>> = {
  menu: {
    es: { titulo: "El menú", llevar: "To go", llevarPie: "Pasás a recogerlo", express: "Exprés", enviar: "Enviar pedido", verPedido: "Ver pedido", tuPedido: "Tu pedido", pasaARecoger: "Pasá a recogerlo cuando te avisemos.", pieLlevar: "El negocio recibe tu pedido al instante y te avisa al teléfono cuando esté listo.", consultarWhatsapp: "Pedir por WhatsApp" },
    en: { titulo: "The menu", llevar: "To go", llevarPie: "Pick it up", express: "Delivery", enviar: "Place order", verPedido: "View order", tuPedido: "Your order", pasaARecoger: "Pick it up when we let you know.", pieLlevar: "The restaurant gets your order instantly and lets you know when it's ready.", consultarWhatsapp: "Order on WhatsApp" },
    fr: { titulo: "Le menu", llevar: "À emporter", llevarPie: "Vous venez le chercher", express: "Livraison", enviar: "Commander", verPedido: "Voir la commande", tuPedido: "Votre commande", pasaARecoger: "Venez la chercher quand on vous prévient.", pieLlevar: "Le restaurant reçoit votre commande immédiatement et vous prévient quand elle est prête.", consultarWhatsapp: "Commander sur WhatsApp" },
    it: { titulo: "Il menù", llevar: "Da asporto", llevarPie: "Passi a ritirarlo", express: "Consegna", enviar: "Invia ordine", verPedido: "Vedi ordine", tuPedido: "Il tuo ordine", pasaARecoger: "Passa a ritirarlo quando ti avvisiamo.", pieLlevar: "Il locale riceve subito il tuo ordine e ti avvisa quando è pronto.", consultarWhatsapp: "Ordina su WhatsApp" },
    pt: { titulo: "O menu", llevar: "Para viagem", llevarPie: "Você passa para buscar", express: "Entrega", enviar: "Enviar pedido", verPedido: "Ver pedido", tuPedido: "Seu pedido", pasaARecoger: "Passe para buscar quando avisarmos.", pieLlevar: "O restaurante recebe seu pedido na hora e avisa quando estiver pronto.", consultarWhatsapp: "Pedir pelo WhatsApp" },
    de: { titulo: "Die Speisekarte", llevar: "Zum Mitnehmen", llevarPie: "Du holst es ab", express: "Lieferung", enviar: "Bestellen", verPedido: "Bestellung ansehen", tuPedido: "Deine Bestellung", pasaARecoger: "Hol sie ab, sobald wir uns melden.", pieLlevar: "Das Lokal erhält deine Bestellung sofort und meldet sich, wenn sie fertig ist.", consultarWhatsapp: "Per WhatsApp bestellen" },
  },
  servicios: {
    es: { titulo: "Nuestros servicios", llevar: "En el local", llevarPie: "Venís a nuestro local", express: "A domicilio", enviar: "Reservar", verPedido: "Ver reserva", tuPedido: "Tu reserva", pasaARecoger: "Te confirmamos el horario por teléfono.", pieLlevar: "El negocio recibe tu reserva al instante y te confirma el horario al teléfono.", consultarWhatsapp: "Reservar por WhatsApp" },
    en: { titulo: "Our services", llevar: "At the shop", llevarPie: "You come to us", express: "At your place", enviar: "Book", verPedido: "View booking", tuPedido: "Your booking", pasaARecoger: "We'll confirm the time by phone.", pieLlevar: "The business gets your booking instantly and confirms the time by phone.", consultarWhatsapp: "Book on WhatsApp" },
    fr: { titulo: "Nos services", llevar: "Sur place", llevarPie: "Vous venez chez nous", express: "À domicile", enviar: "Réserver", verPedido: "Voir la réservation", tuPedido: "Votre réservation", pasaARecoger: "Nous confirmons l'horaire par téléphone.", pieLlevar: "Le commerce reçoit votre réservation immédiatement et confirme l'horaire par téléphone.", consultarWhatsapp: "Réserver sur WhatsApp" },
    it: { titulo: "I nostri servizi", llevar: "In sede", llevarPie: "Vieni da noi", express: "A domicilio", enviar: "Prenota", verPedido: "Vedi prenotazione", tuPedido: "La tua prenotazione", pasaARecoger: "Ti confermiamo l'orario per telefono.", pieLlevar: "L'attività riceve subito la tua prenotazione e ti conferma l'orario per telefono.", consultarWhatsapp: "Prenota su WhatsApp" },
    pt: { titulo: "Nossos serviços", llevar: "No local", llevarPie: "Você vem até nós", express: "A domicílio", enviar: "Reservar", verPedido: "Ver reserva", tuPedido: "Sua reserva", pasaARecoger: "Confirmamos o horário por telefone.", pieLlevar: "O negócio recebe sua reserva na hora e confirma o horário por telefone.", consultarWhatsapp: "Reservar pelo WhatsApp" },
    de: { titulo: "Unsere Leistungen", llevar: "Vor Ort", llevarPie: "Du kommst zu uns", express: "Bei dir zu Hause", enviar: "Reservieren", verPedido: "Reservierung ansehen", tuPedido: "Deine Reservierung", pasaARecoger: "Wir bestätigen die Uhrzeit telefonisch.", pieLlevar: "Das Geschäft erhält deine Reservierung sofort und bestätigt die Uhrzeit telefonisch.", consultarWhatsapp: "Per WhatsApp reservieren" },
  },
  productos: {
    es: { titulo: "Catálogo", llevar: "Recoger en tienda", llevarPie: "Pasás a recogerlo", express: "Envío a domicilio", enviar: "Confirmar compra", verPedido: "Ver carrito", tuPedido: "Tu compra", pasaARecoger: "Pasá a recogerlo cuando te avisemos.", pieLlevar: "La tienda recibe tu pedido al instante y te avisa al teléfono cuando esté listo.", consultarWhatsapp: "Comprar por WhatsApp" },
    en: { titulo: "Catalog", llevar: "Store pickup", llevarPie: "Pick it up", express: "Home delivery", enviar: "Confirm purchase", verPedido: "View cart", tuPedido: "Your purchase", pasaARecoger: "Pick it up when we let you know.", pieLlevar: "The store gets your order instantly and lets you know when it's ready.", consultarWhatsapp: "Buy on WhatsApp" },
    fr: { titulo: "Catalogue", llevar: "Retrait en boutique", llevarPie: "Vous venez le chercher", express: "Livraison à domicile", enviar: "Confirmer l'achat", verPedido: "Voir le panier", tuPedido: "Votre achat", pasaARecoger: "Venez le chercher quand on vous prévient.", pieLlevar: "La boutique reçoit votre commande immédiatement et vous prévient quand elle est prête.", consultarWhatsapp: "Acheter sur WhatsApp" },
    it: { titulo: "Catalogo", llevar: "Ritiro in negozio", llevarPie: "Passi a ritirarlo", express: "Consegna a domicilio", enviar: "Conferma acquisto", verPedido: "Vedi carrello", tuPedido: "Il tuo acquisto", pasaARecoger: "Passa a ritirarlo quando ti avvisiamo.", pieLlevar: "Il negozio riceve subito il tuo ordine e ti avvisa quando è pronto.", consultarWhatsapp: "Compra su WhatsApp" },
    pt: { titulo: "Catálogo", llevar: "Retirar na loja", llevarPie: "Você passa para buscar", express: "Entrega em casa", enviar: "Confirmar compra", verPedido: "Ver carrinho", tuPedido: "Sua compra", pasaARecoger: "Passe para buscar quando avisarmos.", pieLlevar: "A loja recebe seu pedido na hora e avisa quando estiver pronto.", consultarWhatsapp: "Comprar pelo WhatsApp" },
    de: { titulo: "Katalog", llevar: "Abholung im Laden", llevarPie: "Du holst es ab", express: "Lieferung nach Hause", enviar: "Kauf bestätigen", verPedido: "Warenkorb ansehen", tuPedido: "Dein Einkauf", pasaARecoger: "Hol es ab, sobald wir uns melden.", pieLlevar: "Der Laden erhält deine Bestellung sofort und meldet sich, wenn sie fertig ist.", consultarWhatsapp: "Per WhatsApp kaufen" },
  },
};

/** Los rótulos públicos del catálogo de un rubro, en un idioma. */
export function rotulosDe(rubro: Rubro, idioma: Idioma): RotulosCatalogo {
  const tipo = tipoCatalogoDe(rubro);
  return ROTULOS_CATALOGO[tipo][idioma] ?? ROTULOS_CATALOGO[tipo].es;
}
