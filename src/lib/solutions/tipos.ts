/**
 * ════════════════════════════════════════════════════════════════════
 *  BOOKEA SOLUTIONS — LOS TIPOS Y LAS LISTAS CERRADAS (0230)
 * ════════════════════════════════════════════════════════════════════
 *
 * Todo lo que el panel, las páginas públicas y las actions comparten.
 * Las listas cerradas ESPEJAN los CHECK de la migración: si acá se
 * agrega un ícono o un estado, hay que agregarlo también en la base —
 * y al revés. Tenerlos en un solo archivo es lo que hace que se note
 * cuando se despegan.
 *
 * Nada de acá importa de `@/lib/lealtad` ni de `ranchos`: Solutions es
 * un producto aparte (dueño, 3 sep 2026).
 */

export const ICONOS_LINK = [
  "link",
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
  "telefono",
  "mapa",
  "reservar",
  "web",
  "correo",
  "youtube",
  "tienda",
  "menu",
] as const;
export type IconoLink = (typeof ICONOS_LINK)[number];

/**
 * Cómo se llama cada ícono en el editor. El DIBUJO no vive acá: lo pone
 * `components/solutions/icono-link.tsx` con el set de trazo del sitio.
 * Acá solo texto, porque esto alimenta un <option> de un <select> y ahí
 * no entra JSX.
 */
export const ICONO_LINK: Record<IconoLink, { nombre: string }> = {
  link: { nombre: "Enlace" },
  instagram: { nombre: "Instagram" },
  facebook: { nombre: "Facebook" },
  tiktok: { nombre: "TikTok" },
  whatsapp: { nombre: "WhatsApp" },
  telefono: { nombre: "Teléfono" },
  mapa: { nombre: "Cómo llegar" },
  reservar: { nombre: "Reservas" },
  web: { nombre: "Sitio web" },
  correo: { nombre: "Correo" },
  youtube: { nombre: "YouTube" },
  tienda: { nombre: "Tienda" },
  menu: { nombre: "Menú" },
};

export const ESTADOS_PEDIDO = ["nuevo", "preparando", "listo", "entregado", "cancelado"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

/** Rótulo, y a qué estado lleva el botón principal de cada uno. */
export const ESTADO_PEDIDO: Record<
  EstadoPedido,
  { rotulo: string; siguiente: EstadoPedido | null; accion: string | null }
> = {
  nuevo: { rotulo: "Nuevo", siguiente: "preparando", accion: "Empezar" },
  preparando: { rotulo: "Preparando", siguiente: "listo", accion: "Está listo" },
  listo: { rotulo: "Listo", siguiente: "entregado", accion: "Entregado" },
  entregado: { rotulo: "Entregado", siguiente: null, accion: null },
  cancelado: { rotulo: "Cancelado", siguiente: null, accion: null },
};

/**
 * ── CÓMO SE PIDE (0233) ─────────────────────────────────────────────
 * mesa    = desde el QR de la mesa; llega al panel y se paga en caja.
 * llevar  = para recoger en el local; se manda por WhatsApp.
 * express = envío a domicilio; se manda por WhatsApp con dirección.
 */
export const MODALIDADES = ["mesa", "llevar", "express"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const MODALIDAD: Record<Modalidad, { rotulo: string; pie: string }> = {
  mesa: { rotulo: "En la mesa", pie: "Pide desde el QR de su mesa" },
  llevar: { rotulo: "To go", pie: "Pasa a recogerlo" },
  express: { rotulo: "Exprés", pie: "Se lo llevás a su dirección" },
};

/** Con qué paga. Lista cerrada — el CHECK de la 0233 la espeja. */
export const METODOS_PAGO = ["efectivo", "tarjeta", "transferencia"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export function modalidadDe(v: unknown): Modalidad {
  return (MODALIDADES as readonly unknown[]).includes(v) ? (v as Modalidad) : "mesa";
}
export function metodoPagoDe(v: unknown): MetodoPago | null {
  return (METODOS_PAGO as readonly unknown[]).includes(v) ? (v as MetodoPago) : null;
}
/** Lee el text[] crudo. Vacío o roto ⇒ efectivo, que todo local acepta. */
export function metodosPagoDe(v: unknown): MetodoPago[] {
  const lista = Array.isArray(v) ? v.filter((x): x is MetodoPago => metodoPagoDe(x) !== null) : [];
  return lista.length > 0 ? Array.from(new Set(lista)) : ["efectivo"];
}

/** El estado del dominio propio (0234). Lo decide una sonda, no el negocio. */
export const ESTADOS_DOMINIO = ["pendiente", "activo", "error"] as const;
export type EstadoDominio = (typeof ESTADOS_DOMINIO)[number];
export function estadoDominioDe(v: unknown): EstadoDominio {
  return (ESTADOS_DOMINIO as readonly unknown[]).includes(v) ? (v as EstadoDominio) : "pendiente";
}

export const ROLES_COLABORADOR = ["admin", "equipo"] as const;
export type RolColaborador = (typeof ROLES_COLABORADOR)[number];

/** Topes — espejo de los CHECK de la 0230. */
export const TOPES = {
  nombre: 80,
  bajada: 140,
  direccion: 160,
  links: 12,
  etiquetaLink: 40,
  secciones: 20,
  seccionNombre: 40,
  items: 150,
  itemNombre: 80,
  itemDescripcion: 240,
  mesas: 99,
  pedidoNombre: 60,
  pedidoNota: 280,
  cantidadPorRenglon: 20,
  renglonesPorPedido: 30,
  colaboradores: 15,
  /** Los datos del cliente en un pedido para llevar / exprés (0233). */
  telefono: 15,
  cedula: 20,
  direccionPedido: 200,
} as const;

// ── Las filas, ya tipadas ──────────────────────────────────────────

import type { Efecto, EstiloLinks, EstiloPortada, Fuente, Redondeo, Tema } from "./temas";
// Solo tipos: idiomas.ts importa TOPES de acá, y un import de valores
// en las dos direcciones sería un ciclo en tiempo de ejecución.
import type { IdiomaExtra, Nutricion, Traducciones } from "./idiomas";

export type NegocioSolutions = {
  id: string;
  owner_id: string;
  nombre: string;
  slug: string;
  bajada: string;
  color_fondo: string;
  color_acento: string;
  logo_url: string | null;
  foto_portada_url: string | null;
  whatsapp: string | null;
  direccion: string | null;
  publicado: boolean;
  mesas: number;
  mostrar_menu: boolean;
  acepta_pedidos: boolean;
  /** El vestido de la página (0231). */
  tema: Tema;
  estilo_links: EstiloLinks;
  redondeo: Redondeo;
  /** El vestido fino (0232): cara, qué hace la portada y el acabado. */
  fuente: Fuente;
  estilo_portada: EstiloPortada;
  efecto: Efecto;
  /** Cómo recibe pedidos además de la mesa (0233). */
  pedidos_llevar: boolean;
  pedidos_express: boolean;
  costo_express: number;
  metodos_pago: MetodoPago[];
  /** null = el `whatsapp` de la página. */
  whatsapp_pedidos: string | null;
  /** El dominio propio (0234). null = solo bookea.lat/s/<slug>. */
  dominio: string | null;
  dominio_estado: EstadoDominio;
  dominio_verificado_en: string | null;
  dominio_nota: string | null;
  /** Idiomas que el menú ofrece además del español (0235). */
  idiomas_menu: IdiomaExtra[];
  /** Quién lo armó: el cliente (publico) o Bookea desde el admin (0235). */
  origen: "publico" | "admin";
  creado_en: string;
};

export type LinkSolutions = {
  id: string;
  negocio_id: string;
  etiqueta: string;
  url: string;
  icono: IconoLink;
  orden: number;
  visible: boolean;
  /** Foto detrás de esta puerta (0232). null = sin foto, que es lo normal. */
  fondo_url: string | null;
};

export type SeccionMenu = {
  id: string;
  negocio_id: string;
  nombre: string;
  orden: number;
  /** El nombre en otros idiomas (0235). */
  traducciones: Traducciones;
};

export type ItemMenuSolutions = {
  id: string;
  negocio_id: string;
  seccion_id: string | null;
  nombre: string;
  descripcion: string;
  precio: number | null;
  foto_url: string | null;
  disponible: boolean;
  agotado_hoy: boolean;
  orden: number;
  /** Nombre y descripción en otros idiomas (0235). */
  traducciones: Traducciones;
  /** La ficha nutricional, si la cargó (0235). */
  nutricion: Nutricion | null;
};

export type PedidoSolutions = {
  id: string;
  negocio_id: string;
  /** null cuando no es de mesa (0233). */
  mesa: number | null;
  modalidad: Modalidad;
  nombre: string;
  nota: string;
  estado: EstadoPedido;
  total: number;
  /** Los datos del cliente, solo en llevar / exprés (0233). */
  telefono: string | null;
  cedula: string | null;
  direccion: string | null;
  metodo_pago: MetodoPago | null;
  costo_envio: number;
  creado_en: string;
  actualizado_en: string;
  items: { id: string; nombre: string; precio: number; cantidad: number }[];
};

export type ColaboradorSolutions = {
  negocio_id: string;
  usuario_id: string | null;
  correo: string;
  rol: RolColaborador;
  creado_en: string;
};

/** La URL pública de un negocio, con el mismo respaldo de env del resto. */
export function urlPublicaSolutions(slug: string): string {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat";
  return `${sitio}/s/${slug}`;
}

/**
 * La URL que se comparte y va en el QR: el dominio propio SOLO si ya
 * está activo (una sonda lo confirmó); si no, bookea.lat/s/<slug>. Un
 * QR impreso con un dominio que todavía no sirve sería un QR roto.
 */
export function urlDelNegocio(n: Pick<NegocioSolutions, "slug" | "dominio" | "dominio_estado">): string {
  return n.dominio && n.dominio_estado === "activo" ? `https://${n.dominio}` : urlPublicaSolutions(n.slug);
}

/**
 * La paleta que sale de los dos colores del negocio. YIQ para decidir
 * la tinta: un fondo claro pide texto oscuro y viceversa. Sin depender
 * de `@/lib/lealtad/plantillas-poster` — la fórmula es de tres líneas.
 */
export function paletaDe(colorFondo: string, colorAcento: string) {
  const oscuro = esOscuro(colorFondo);
  return {
    fondo: colorFondo,
    acento: colorAcento,
    tinta: oscuro ? "#ffffff" : "#10192e",
    suave: oscuro ? "rgba(255,255,255,0.72)" : "rgba(16,25,46,0.68)",
    superficie: oscuro ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.05)",
    borde: oscuro ? "rgba(255,255,255,0.18)" : "rgba(16,24,40,0.14)",
    tintaSobreAcento: esOscuro(colorAcento) ? "#ffffff" : "#10192e",
  };
}

function esOscuro(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 150;
}

export const HEX = /^#[0-9a-fA-F]{6}$/;
