import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS ADD-ONS DE SOLUTIONS — el catálogo y su lectura (0233)
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (4 sep 2026): «una cuenta principal; a base de eso
 * el negocio tiene add-ons que se venden por separado. Lo primero, lo
 * gratuito, es el link hub; de ahí la persona dice qué quiere añadir
 * por dinero. Ahorita todo es prueba, pero dejalo previsto».
 *
 * ── EL MODELO, EN UNA LÍNEA ─────────────────────────────────────────
 *   cuenta (auth.users) → negocio (solutions_negocios) → add-ons (esta tabla)
 *
 * La cuenta ya era una: es la misma con la que se entra a todo Bookea.
 * Lo que faltaba era el escalón de abajo, y este archivo es su único
 * catálogo: nombre, qué incluye, precio y si viene con la cuenta.
 *
 * ── POR QUÉ EL PRECIO VIVE ACÁ Y NO EN LA BASE ──────────────────────
 * Hoy todo vale ₡0 («todo es prueba»). Cuando se cobre, el precio de
 * lista es una decisión de producto que cambia junto con el código
 * que lo muestra —igual que `PLANES` en Lealtad—, y lo que se PAGÓ por
 * un negocio concreto quedará en su fila (`vence_en`, `notas`). Precio
 * de lista en código, contrato en la base.
 *
 * ── EL CHECK DE LA 0233 ESPEJA ESTA LISTA ───────────────────────────
 * Si se agrega un add-on, va acá y en la migración. Tenerlos en un
 * archivo cada uno es lo que hace que se note cuando se despegan.
 */

export const ADDONS = ["linkhub", "menu", "pedidos", "lealtad"] as const;
export type AddonId = (typeof ADDONS)[number];

export type DefinicionAddon = {
  nombre: string;
  /** Una línea: qué es. */
  pie: string;
  /** Qué trae, para la lista del tablero. */
  incluye: string[];
  /** ₡ por mes. 0 = gratis. */
  precioMes: number;
  /** Viene con la cuenta: siempre prendido, no se apaga ni se cobra. */
  incluido: boolean;
  /**
   * Se arma en otro producto de Bookea con la misma cuenta. Activarlo
   * acá solo lo marca en el tablero; el trabajo se hace allá.
   */
  externo?: { href: string; label: string };
};

export const ADDON: Record<AddonId, DefinicionAddon> = {
  linkhub: {
    nombre: "Link hub",
    pie: "Tu página bookea.lat/s/… con tus enlaces",
    incluye: ["Hasta doce enlaces, con foto de fondo", "Seis temas, seis fuentes, cinco efectos", "Un QR para todo"],
    precioMes: 0,
    incluido: true,
  },
  menu: {
    nombre: "Menú digital",
    pie: "Secciones, platos, fotos y precios",
    incluye: ["Menú con tu marca", "«Agotado hoy» con un toque", "Se abre desde tu página"],
    precioMes: 0,
    incluido: false,
  },
  pedidos: {
    nombre: "Pedidos",
    pie: "Desde la mesa, para llevar y exprés",
    incluye: ["QR por mesa y comandas en vivo", "Para llevar y exprés por WhatsApp", "Sin comisión: cobrás en tu caja"],
    precioMes: 0,
    incluido: false,
  },
  lealtad: {
    nombre: "Tarjeta de lealtad",
    pie: "Sellos o puntos en Apple y Google Wallet",
    incluye: ["Tu logo, tus colores, tu regalía", "Se agrega con un QR", "Correos en los hitos"],
    precioMes: 0,
    incluido: false,
    externo: { href: "/lealtad/crear", label: "Armar en Bookea Lealtad" },
  },
};

/** Qué tiene prendido un negocio. Siempre las cuatro llaves. */
export type EstadoAddons = Record<AddonId, boolean>;

/** El estado «sin fila»: solo lo incluido. */
export function addonsBase(): EstadoAddons {
  return { linkhub: true, menu: false, pedidos: false, lealtad: false };
}

export function esAddon(v: unknown): v is AddonId {
  return (ADDONS as readonly unknown[]).includes(v);
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Lee la tabla y devuelve las cuatro llaves, siempre.
 *
 * `linkhub` vuelve true aunque no haya fila: es lo incluido, y un
 * negocio creado antes de la 0233 no tiene por qué aparecer sin página.
 * El vencimiento se respeta acá y no en la RLS: la lectura del panel va
 * con la llave de servicio, que salta las políticas.
 */
export async function addonsDelNegocio(admin: Admin, negocioId: string): Promise<EstadoAddons> {
  const estado = addonsBase();
  const { data } = await admin
    .from("solutions_addons")
    .select("addon, activo, vence_en")
    .eq("negocio_id", negocioId);
  const ahora = Date.now();
  for (const f of data ?? []) {
    if (!esAddon(f.addon)) continue;
    const vigente = f.activo === true && (!f.vence_en || new Date(f.vence_en as string).getTime() > ahora);
    estado[f.addon] = vigente;
  }
  estado.linkhub = true;
  return estado;
}

/** Los add-ons de varios negocios de una vez, para la lista de la cuenta. */
export async function addonsDeVarios(admin: Admin, ids: string[]): Promise<Record<string, EstadoAddons>> {
  const salida: Record<string, EstadoAddons> = {};
  for (const id of ids) salida[id] = addonsBase();
  if (ids.length === 0) return salida;
  const { data } = await admin
    .from("solutions_addons")
    .select("negocio_id, addon, activo, vence_en")
    .in("negocio_id", ids);
  const ahora = Date.now();
  for (const f of data ?? []) {
    const id = f.negocio_id as string;
    if (!salida[id] || !esAddon(f.addon)) continue;
    salida[id][f.addon] = f.activo === true && (!f.vence_en || new Date(f.vence_en as string).getTime() > ahora);
  }
  return salida;
}
