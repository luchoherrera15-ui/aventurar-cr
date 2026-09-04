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

/** Cómo se llama cada ícono en el editor, y el glifo con que se pinta. */
export const ICONO_LINK: Record<IconoLink, { nombre: string; glifo: string }> = {
  link: { nombre: "Enlace", glifo: "🔗" },
  instagram: { nombre: "Instagram", glifo: "📸" },
  facebook: { nombre: "Facebook", glifo: "👍" },
  tiktok: { nombre: "TikTok", glifo: "🎵" },
  whatsapp: { nombre: "WhatsApp", glifo: "💬" },
  telefono: { nombre: "Teléfono", glifo: "📞" },
  mapa: { nombre: "Cómo llegar", glifo: "📍" },
  reservar: { nombre: "Reservas", glifo: "📅" },
  web: { nombre: "Sitio web", glifo: "🌐" },
  correo: { nombre: "Correo", glifo: "✉️" },
  youtube: { nombre: "YouTube", glifo: "▶️" },
  tienda: { nombre: "Tienda", glifo: "🛍" },
  menu: { nombre: "Menú", glifo: "🍽" },
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
} as const;

// ── Las filas, ya tipadas ──────────────────────────────────────────

import type { EstiloLinks, Redondeo, Tema } from "./temas";

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
};

export type SeccionMenu = {
  id: string;
  negocio_id: string;
  nombre: string;
  orden: number;
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
};

export type PedidoSolutions = {
  id: string;
  negocio_id: string;
  mesa: number;
  nombre: string;
  nota: string;
  estado: EstadoPedido;
  total: number;
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
