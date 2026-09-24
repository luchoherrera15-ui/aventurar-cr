import type { DatosPagina } from "@/components/solutions/vista-pagina";

/**
 * ════════════════════════════════════════════════════════════════════
 *  CUATRO NEGOCIOS DISTINTOS, LA MISMA PÁGINA
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): que el home de Bookea se vea como el
 * de Celebrar — «más profesional, textos más grandes que llenan más».
 *
 * En el héroe de Celebrar el teléfono no enseña una captura: enseña
 * INVITACIONES DE VERDAD que van rotando, y abajo dice cuál es («Carta
 * de Amor · boda»). Eso es lo que hace que se vea caro: no estás
 * mirando un mockup, estás mirando el producto, y encima cuatro veces.
 *
 * El equivalente de Bookea es la página del negocio. Así que estos son
 * cuatro negocios de rubros distintos, cada uno con SU tema, SU color,
 * SU tipografía y SUS botones. Rotan en el teléfono del héroe.
 *
 * ── POR QUÉ ESTO VENDE MÁS QUE UNA SOLA PÁGINA ──────────────────────
 *
 * La objeción número uno de un dueño mirando una plataforma es «se va a
 * ver igual que todas». Cuatro páginas que no se parecen en nada —una
 * cafetería en crema, una barbería de noche, un gimnasio, un lavacar—
 * contestan esa objeción sin escribir una línea de texto.
 *
 * ── LAS FOTOS SON LAS NUESTRAS ──────────────────────────────────────
 *
 * Las tres escenas que ya viven en Cloudflare Images. Donde no hay
 * foto, la página sale con `estiloPortada: "sin"` — que es una opción
 * REAL del producto, no un hueco: hay negocios que prefieren solo logo
 * y nombre.
 *
 * Ningún negocio de estos existe, así que ninguno lleva WhatsApp: un
 * número inventado en un mockup es una promesa que alguien va a marcar.
 */

const CF = "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g";

export type PaginaDemo = {
  id: string;
  /** Lo que dice el rótulo debajo del teléfono. */
  pie: string;
  datos: DatosPagina;
};

export const PAGINAS_DEMO: PaginaDemo[] = [
  {
    id: "cafe",
    pie: "Casa Matcha · cafetería",
    datos: {
      nombre: "Casa Matcha",
      bajada: "Cafetería de especialidad · Escazú",
      logoUrl: null,
      fotoPortadaUrl: `${CF}/linksy-hero-restaurante/gallery`,
      whatsapp: null,
      direccion: "Plaza Itskatzú, Escazú",
      colorFondo: "#f7f4ec",
      colorAcento: "#2f6b4f",
      tema: "crema",
      estiloLinks: "lista",
      redondeo: "redondo",
      fuente: "sistema",
      estiloPortada: "completa",
      efecto: "elevado",
      links: [
        { id: "pedir", etiqueta: "Pedir para llevar", url: "#", icono: "link" },
        { id: "reservar", etiqueta: "Reservar mesa", url: "#", icono: "link" },
        { id: "sellos", etiqueta: "Mi tarjeta de sellos", url: "#", icono: "link" },
        { id: "ig", etiqueta: "@casamatcha", url: "#", icono: "instagram" },
      ],
      seccionesMenu: ["Cafés de especialidad", "Matcha", "Repostería"],
      hayMenu: true,
      aceptaPedidos: true,
      mesa: null,
      rubro: "cafeteria",
      moneda: "CRC",
      pais: "CR",
    },
  },
  {
    id: "barberia",
    pie: "Silence Barber · barbería",
    datos: {
      nombre: "Silence Barber",
      bajada: "Barbería · Barrio Escalante",
      logoUrl: null,
      fotoPortadaUrl: null,
      whatsapp: null,
      direccion: "Barrio Escalante, San José",
      colorFondo: "#10141c",
      colorAcento: "#e0a34a",
      tema: "noche",
      estiloLinks: "lista",
      redondeo: "recto",
      fuente: "condensada",
      estiloPortada: "sin",
      efecto: "contorno",
      links: [
        { id: "cita", etiqueta: "Reservar cita", url: "#", icono: "link" },
        { id: "precios", etiqueta: "Servicios y precios", url: "#", icono: "link" },
        { id: "equipo", etiqueta: "Nuestro equipo", url: "#", icono: "link" },
        { id: "sellos", etiqueta: "Mi tarjeta de sellos", url: "#", icono: "link" },
        { id: "ig", etiqueta: "@silencebarber", url: "#", icono: "instagram" },
      ],
      seccionesMenu: [],
      hayMenu: false,
      aceptaPedidos: false,
      mesa: null,
      rubro: "barberia",
      moneda: "CRC",
      pais: "CR",
    },
  },
  {
    id: "gimnasio",
    pie: "Shaep · gimnasio",
    datos: {
      nombre: "Shaep",
      bajada: "Entrenamiento y nutrición · Santa Ana",
      logoUrl: null,
      fotoPortadaUrl: `${CF}/linksy-hero-gimnasio/gallery`,
      whatsapp: null,
      direccion: "Santa Ana, San José",
      colorFondo: "#12100f",
      colorAcento: "#d6c3a8",
      tema: "noche",
      estiloLinks: "grilla",
      redondeo: "suave",
      fuente: "sistema",
      estiloPortada: "completa",
      efecto: "vidrio",
      links: [
        { id: "planes", etiqueta: "Planes de entrenamiento", url: "#", icono: "link" },
        { id: "nutricion", etiqueta: "Guías de nutrición", url: "#", icono: "link" },
        { id: "clases", etiqueta: "Horario de clases", url: "#", icono: "link" },
        { id: "ig", etiqueta: "@shaep", url: "#", icono: "instagram" },
      ],
      seccionesMenu: ["Mensualidades", "Clases sueltas"],
      hayMenu: true,
      aceptaPedidos: false,
      mesa: null,
      rubro: "gimnasio",
      moneda: "CRC",
      pais: "CR",
    },
  },
  {
    id: "lavacar",
    pie: "Brillo Total · lavacar",
    datos: {
      nombre: "Brillo Total",
      bajada: "Lavado y detailing · Heredia",
      logoUrl: null,
      fotoPortadaUrl: `${CF}/linksy-hero-lavacar/gallery`,
      whatsapp: null,
      direccion: "Heredia centro",
      colorFondo: "#f2f5f8",
      colorAcento: "#0b5fa5",
      tema: "claro",
      estiloLinks: "lista",
      redondeo: "suave",
      fuente: "sistema",
      estiloPortada: "card",
      efecto: "plano",
      links: [
        { id: "cita", etiqueta: "Apartar mi cita", url: "#", icono: "link" },
        { id: "precios", etiqueta: "Paquetes y precios", url: "#", icono: "link" },
        { id: "domicilio", etiqueta: "Lavado a domicilio", url: "#", icono: "link" },
        { id: "ig", etiqueta: "@brillototalcr", url: "#", icono: "instagram" },
      ],
      seccionesMenu: ["Lavado", "Detailing", "Extras"],
      hayMenu: true,
      aceptaPedidos: false,
      mesa: null,
      rubro: "lavacar",
      moneda: "CRC",
      pais: "CR",
    },
  },
];
