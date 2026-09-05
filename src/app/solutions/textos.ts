/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS TEXTOS DE LA LANDING DE SOLUTIONS — español e inglés
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (5 sep 2026): «bookea.lat/solutions en inglés y en
 * español, y también bookea.lat/soluciones».
 *
 * Un solo componente (`landing-solutions.tsx`) y dos diccionarios. Todo
 * lo que se lee en la página sale de acá; el JSX no tiene ni una
 * frase suelta. Así las dos versiones no se despegan: agregar una
 * sección obliga a escribirla en los dos idiomas o TypeScript no
 * compila.
 *
 * Sin `"use client"` ni JSX: lo importan Server Components y el
 * componente de cliente del héroe.
 */

export type IdiomaLanding = "es" | "en";

export type TextosLanding = {
  meta: { title: string; description: string };
  otroIdioma: { etiqueta: string; href: string };
  nav: { enlaces: { href: string; label: string }[]; cta: string; ingresar: string };
  hero: { kicker: string; titulo: string; tituloAcento: string; bajada: string; bajadaFuerte: string; cta: string; ver: string; nota: string };
  looks: Record<"completa" | "fondo" | "tarjeta" | "menu" | "marca", { nombre: string; pie: string }>;
  carrusel: { anterior: string; siguiente: string; lista: string };
  productos: {
    kicker: string;
    titulo: string;
    bajada: string;
    items: { kicker: string; precio: string; titulo: string; bajada: string; puntos: string[]; cta: string }[];
  };
  pasos: { kicker: string; titulo: string; items: { titulo: string; detalle: string }[] };
  incluye: { kicker: string; titulo: string; items: { t: string; d: string }[] };
  qr: { kicker: string; titulo: string; p1: string; fuerte1: string; p2: string; fuerte2: string; p3: string; pasos: [string, string][] };
  faq: { titulo: string; items: { pregunta: string; respuesta: string }[] };
  cierre: { titulo: string; bajada: string; cta: string };
};

export const TEXTOS: Record<IdiomaLanding, TextosLanding> = {
  es: {
    meta: {
      title: "Bookea Solutions · Tu página, tu menú digital y tu QR",
      description:
        "Creá la página de tu negocio con tu menú digital en varios idiomas, pedidos desde la mesa sin comisión y tu tarjeta de lealtad. Un solo QR para todo, 100 % configurable.",
    },
    otroIdioma: { etiqueta: "English", href: "/solutions/en" },
    nav: {
      enlaces: [
        { href: "/solutions#productos", label: "Add-ons y precios" },
        { href: "/solutions#como-funciona", label: "Cómo funciona" },
      ],
      cta: "Crear mi página gratis",
      ingresar: "Ingresar",
    },
    hero: {
      kicker: "Para restaurantes, cafeterías y servicios",
      titulo: "Tu página, tu menú y tu QR.",
      tituloAcento: "Diseñados por vos.",
      bajada: "Armá una página de enlaces 100 % configurable con tu menú digital en varios idiomas, pedidos desde la mesa sin comisión y tu programa de lealtad.",
      bajadaFuerte: "Un solo QR para todo.",
      cta: "Crear mi página gratis →",
      ver: "Ver cómo funciona",
      nota: "Sin tarjeta. Empezás con el plan Gratis y subís cuando lo necesités.",
    },
    looks: {
      completa: { nombre: "Portada completa", pie: "La foto de borde a borde · Noche · Elegante" },
      fondo: { nombre: "Foto de fondo", pie: "La foto viste la página entera · Vino · Condensada" },
      tarjeta: { nombre: "Foto en la tarjeta", pie: "Solo en el encabezado · Crema · Editorial" },
      menu: { nombre: "Menú digital", pie: "Con su portada · Claro · Del sitio" },
      marca: { nombre: "Solo tu marca", pie: "Sin foto: colores y degradado · Bosque · Redonda" },
    },
    carrusel: { anterior: "Diseño anterior", siguiente: "Diseño siguiente", lista: "Diseños de muestra" },
    productos: {
      kicker: "Una cuenta, tus add-ons",
      titulo: "Empezás gratis y agregás lo que necesités",
      bajada: "Creás tu cuenta, tenés tu link hub, y desde el panel sumás el menú, los pedidos o la tarjeta cuando te hagan falta. Un panel, un QR, una factura.",
      items: [
        {
          kicker: "Incluido",
          precio: "Gratis",
          titulo: "Tu link hub: una página con tu marca",
          bajada: "Tus puertas en el orden que quieras: el menú, WhatsApp, Instagram, reservas, cómo llegar. Seis temas, seis fuentes, cinco efectos y foto de fondo por botón.",
          puntos: ["Hasta doce enlaces, ordenados arrastrando", "Se edita escribiendo encima de la página", "bookea.lat/s/tu-negocio — o tu propio dominio"],
          cta: "Crear mi página gratis",
        },
        {
          kicker: "Add-on",
          precio: "₡0 en prueba",
          titulo: "Menú digital",
          bajada: "Secciones, platos, fotos y precios, vestidos con tu marca. En hasta seis idiomas, con ficha nutricional por plato si querés.",
          puntos: ["Marcás «agotado hoy» y desaparece del menú", "Español, inglés, francés, italiano, portugués y alemán", "Lo prendés desde tu panel cuando lo necesités"],
          cta: "Empezar con mi página",
        },
        {
          kicker: "Add-on",
          precio: "₡0 en prueba",
          titulo: "Pedidos: mesa, To go y exprés",
          bajada: "Un QR por mesa, y To go o exprés desde tu página. Todo cae en tu Modo restaurante, marcado, con nuevo → preparando → listo.",
          puntos: ["Sin comisión por pedido — el cobro es tuyo", "Modo restaurante: la pantalla de la cocina y la caja", "To go y exprés con nombre, teléfono, dirección y forma de pago"],
          cta: "Empezar con mi página",
        },
        {
          kicker: "Add-on",
          precio: "Con Bookea Lealtad",
          titulo: "Tarjeta de lealtad en el teléfono",
          bajada: "Sellos, puntos o cashback en Apple Wallet y Google Wallet. Se arma con la misma cuenta y aparece como una puerta más en tu página.",
          puntos: ["Tu logo, tus colores y tu regalía", "Se agrega con un QR en el mostrador", "Correos automáticos en los hitos"],
          cta: "Ver Bookea Lealtad",
        },
      ],
    },
    pasos: {
      kicker: "De cero a recibir pedidos",
      titulo: "Cuatro pasos, una tarde",
      items: [
        { titulo: "Creás tu página", detalle: "Escribís el nombre y ya tenés tu enlace. Elegís tema, colores y forma mirando cómo queda al lado." },
        { titulo: "Cargás tu menú", detalle: "Secciones, platos, fotos y precios. Lo que marcás agotado desaparece del menú hasta que vuelva a haber." },
        { titulo: "Imprimís tus QR", detalle: "Una hoja con un QR por mesa, lista para recortar. El número de mesa viaja en el enlace." },
        { titulo: "Recibís pedidos", detalle: "El cliente escanea, arma su pedido y te llega al Modo restaurante con su mesa. Vos lo movés a preparando y listo." },
      ],
    },
    incluye: {
      kicker: "Lo que viene incluido",
      titulo: "Sin plugins, sin plantillas que comprar",
      items: [
        { t: "Seis temas", d: "Noche, claro, crema, bosque, vino o tus propios colores." },
        { t: "Editás en vivo", d: "Tocás el texto en la vista del teléfono y lo escribís ahí." },
        { t: "Arrastrar y soltar", d: "Acomodás tus enlaces arrastrándolos. También con flechas." },
        { t: "QR por mesa", d: "Hasta 99 mesas, cada una con su código, en una hoja imprimible." },
        { t: "Comandas en vivo", d: "El Modo restaurante se refresca solo mientras la cocina trabaja." },
        { t: "Tu equipo", d: "Invitás meseros por correo: ven comandas, no tocan la configuración." },
        { t: "Sin comisión", d: "El pedido es un comandero, no una pasarela. Cobrás en tu caja." },
        { t: "Sin apps", d: "Tu cliente escanea y listo. No instala nada." },
      ],
    },
    qr: {
      kicker: "Un solo código",
      titulo: "El cliente escanea una vez y encuentra todo.",
      p1: "El QR de la mesa abre ",
      fuerte1: "bookea.lat/s/tu-negocio",
      p2: ": tu página, con tu marca. Desde ahí ve el menú, pide, suma sellos y te escribe. Y como el número de mesa viaja en el código, sabés de dónde viene cada pedido ",
      fuerte2: "sin reimprimir nada",
      p3: ".",
      pasos: [
        ["Escanea", "El QR de la mesa o del mostrador."],
        ["Elige", "Menú, reservas, WhatsApp — tus puertas."],
        ["Pide", "La comanda llega al Modo restaurante con su mesa."],
      ],
    },
    faq: {
      titulo: "Preguntas frecuentes",
      items: [
        { pregunta: "¿Necesito varias cuentas?", respuesta: "No. Una sola cuenta de Bookea. Con ella creás tu negocio en Solutions y te queda tu link hub gratis; el menú digital, los pedidos y la tarjeta de lealtad son add-ons que agregás desde el panel cuando los necesités — con esa misma cuenta." },
        { pregunta: "¿Cuánto cuesta?", respuesta: "El link hub es gratis, siempre. Los add-ons se venden por separado y, mientras dure la prueba, están en ₡0: los prendés desde Inicio y los apagás cuando quieras. Cuando tengan precio lo vas a ver ahí mismo, antes de activarlos." },
        { pregunta: "¿El menú puede estar en varios idiomas?", respuesta: "Sí: español, inglés, francés, italiano, portugués y alemán. Prendés los idiomas que querés, traducís a mano o con un botón de IA que completa todo de una vez, y tu cliente cambia de idioma arriba del menú. Lo que no esté traducido se muestra en español." },
        { pregunta: "¿Cómo funcionan To go y Exprés?", respuesta: "El cliente abre tu menú desde tu página, va sumando —un combo, unas papas, un refresco—, elige To go o Exprés, llena nombre, teléfono, cédula, dirección y cómo paga, y toca enviar. Recibe un código, y a vos te cae al instante en el Modo restaurante, marcado. Cuando esté listo, le avisás al teléfono con un toque." },
        { pregunta: "¿Los pedidos cobran comisión?", respuesta: "No, y no es un detalle: es una comanda, no una pasarela. Desde la mesa, To go o exprés, todo te llega al Modo restaurante. El cobro sigue siendo tuyo: en tu caja, al recoger o al entregar." },
        { pregunta: "¿Puedo usar mi propio dominio?", respuesta: "Sí. Desde Mi página escribís tu dominio, te decimos qué registro poner en tu DNS y, cuando responde, tu página vive ahí: casanostra.com o menu.casanostra.com. El QR que ya imprimiste sigue funcionando." },
      ],
    },
    cierre: {
      titulo: "Tu negocio, en el teléfono de tus clientes, hoy.",
      bajada: "Se arma en una tarde y no pide tarjeta. Empezá por el nombre.",
      cta: "Crear mi página gratis →",
    },
  },

  en: {
    meta: {
      title: "Bookea Solutions · Your page, your digital menu and your QR",
      description:
        "Build your business page with a digital menu in six languages, table ordering with no commission, and your loyalty card. One QR for everything, 100% customizable.",
    },
    otroIdioma: { etiqueta: "Español", href: "/solutions" },
    nav: {
      enlaces: [
        { href: "/solutions/en#productos", label: "Add-ons & pricing" },
        { href: "/solutions/en#como-funciona", label: "How it works" },
      ],
      cta: "Create my page for free",
      ingresar: "Sign in",
    },
    hero: {
      kicker: "For restaurants, cafés and service businesses",
      titulo: "Your page, your menu and your QR.",
      tituloAcento: "Designed by you.",
      bajada: "Build a fully customizable link page with a digital menu in several languages, table ordering with no commission, and your loyalty program.",
      bajadaFuerte: "One QR for everything.",
      cta: "Create my page for free →",
      ver: "See how it works",
      nota: "No card required. Start on the Free plan and upgrade when you need to.",
    },
    looks: {
      completa: { nombre: "Full-bleed cover", pie: "Edge-to-edge photo · Night · Elegant" },
      fondo: { nombre: "Background photo", pie: "The photo dresses the whole page · Wine · Condensed" },
      tarjeta: { nombre: "Photo in the card", pie: "Header only · Cream · Editorial" },
      menu: { nombre: "Digital menu", pie: "With its cover · Light · Default" },
      marca: { nombre: "Just your brand", pie: "No photo: colors and gradient · Forest · Round" },
    },
    carrusel: { anterior: "Previous design", siguiente: "Next design", lista: "Sample designs" },
    productos: {
      kicker: "One account, your add-ons",
      titulo: "Start free and add what you need",
      bajada: "Create your account, get your link hub, and add the menu, orders or the loyalty card from your panel whenever you need them. One panel, one QR, one invoice.",
      items: [
        {
          kicker: "Included",
          precio: "Free",
          titulo: "Your link hub: a page with your brand",
          bajada: "Your doors in the order you want: the menu, WhatsApp, Instagram, reservations, directions. Six themes, six fonts, five effects and a background photo per button.",
          puntos: ["Up to twelve links, drag to reorder", "Edit by typing right on the page", "bookea.lat/s/your-business — or your own domain"],
          cta: "Create my page for free",
        },
        {
          kicker: "Add-on",
          precio: "₡0 during the trial",
          titulo: "Digital menu",
          bajada: "Sections, dishes, photos and prices, dressed in your brand. In up to six languages, with an optional nutrition card per dish.",
          puntos: ["Mark “sold out today” and it disappears from the menu", "Spanish, English, French, Italian, Portuguese and German", "Turn it on from your panel when you need it"],
          cta: "Start with my page",
        },
        {
          kicker: "Add-on",
          precio: "₡0 during the trial",
          titulo: "Orders: table, to go and delivery",
          bajada: "One QR per table, plus to-go and delivery from your page. Everything lands in your Restaurant Mode, labeled, with new → preparing → ready.",
          puntos: ["No commission per order — the money is yours", "Restaurant Mode: the screen for the kitchen and the register", "To go and delivery with name, phone, address and payment method"],
          cta: "Start with my page",
        },
        {
          kicker: "Add-on",
          precio: "With Bookea Lealtad",
          titulo: "Loyalty card on the phone",
          bajada: "Stamps, points or cashback in Apple Wallet and Google Wallet. Built with the same account, it shows up as one more door on your page.",
          puntos: ["Your logo, your colors, your reward", "Added with a QR at the counter", "Automatic emails at milestones"],
          cta: "See Bookea Lealtad",
        },
      ],
    },
    pasos: {
      kicker: "From zero to taking orders",
      titulo: "Four steps, one afternoon",
      items: [
        { titulo: "Create your page", detalle: "Type the name and you have your link. Pick theme, colors and shape while watching it next to you." },
        { titulo: "Load your menu", detalle: "Sections, dishes, photos and prices. Whatever you mark sold out disappears until it's back." },
        { titulo: "Print your QRs", detalle: "One sheet with a QR per table, ready to cut. The table number travels in the link." },
        { titulo: "Take orders", detalle: "The customer scans, builds the order, and it reaches your Restaurant Mode with the table. You move it to preparing and ready." },
      ],
    },
    incluye: {
      kicker: "What's included",
      titulo: "No plugins, no templates to buy",
      items: [
        { t: "Six themes", d: "Night, light, cream, forest, wine, or your own colors." },
        { t: "Live editing", d: "Tap the text on the phone preview and type right there." },
        { t: "Drag and drop", d: "Arrange your links by dragging. Arrows work too." },
        { t: "QR per table", d: "Up to 99 tables, each with its code, on a printable sheet." },
        { t: "Live orders", d: "Restaurant Mode refreshes itself while the kitchen works." },
        { t: "Your team", d: "Invite waiters by email: they see orders, not the settings." },
        { t: "No commission", d: "An order is a ticket, not a payment gateway. You charge at your register." },
        { t: "No apps", d: "Your customer scans and that's it. Nothing to install." },
      ],
    },
    qr: {
      kicker: "One single code",
      titulo: "The customer scans once and finds everything.",
      p1: "The table QR opens ",
      fuerte1: "bookea.lat/s/your-business",
      p2: ": your page, with your brand. From there they see the menu, order, collect stamps and message you. And since the table number travels in the code, you know where every order comes from ",
      fuerte2: "without reprinting anything",
      p3: ".",
      pasos: [
        ["Scan", "The QR at the table or the counter."],
        ["Choose", "Menu, reservations, WhatsApp — your doors."],
        ["Order", "The ticket reaches Restaurant Mode with its table."],
      ],
    },
    faq: {
      titulo: "Frequently asked questions",
      items: [
        { pregunta: "Do I need several accounts?", respuesta: "No. One Bookea account. With it you create your business in Solutions and get your link hub for free; the digital menu, orders and the loyalty card are add-ons you turn on from the panel when you need them — with that same account." },
        { pregunta: "How much does it cost?", respuesta: "The link hub is free, always. Add-ons are sold separately and, during the trial, they're ₡0: you turn them on from Home and off whenever you want. When they have a price you'll see it right there, before activating." },
        { pregunta: "Can the menu be in several languages?", respuesta: "Yes: Spanish, English, French, Italian, Portuguese and German. Turn on the languages you want, translate by hand or with an AI button that fills everything at once, and your customer switches language at the top of the menu. Anything untranslated shows in Spanish." },
        { pregunta: "How do to-go and delivery work?", respuesta: "The customer opens your menu from your page, adds items, chooses to go or delivery, fills in name, phone, ID, address and payment method, and taps send. They get a code, and it lands instantly in your Restaurant Mode, labeled. When it's ready, you notify their phone with one tap." },
        { pregunta: "Do orders charge a commission?", respuesta: "No, and that's not a detail: it's a ticket, not a payment gateway. Table, to go or delivery, everything reaches your Restaurant Mode. The money stays yours: at your register, on pickup or on delivery." },
        { pregunta: "Can I use my own domain?", respuesta: "Yes. From My page you type your domain, we tell you which DNS record to add and, once it responds, your page lives there: casanostra.com or menu.casanostra.com. The QR you already printed keeps working." },
      ],
    },
    cierre: {
      titulo: "Your business, on your customers' phones, today.",
      bajada: "Set up in one afternoon, no card required. Start with the name.",
      cta: "Create my page for free →",
    },
  },
};
