import {
  DISENO_BASE,
  type Diseno,
  type Efecto,
  type EstiloLinks,
  type EstiloPortada,
  type Fuente,
  type Tema,
} from "./temas";
import { estiloMenuParaPlan } from "./menu-estilos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS DOS MEMBRESÍAS DE LINKSY — Gratis y Pro, al estilo Linktree
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (8 sep 2026): «dos membresías: un link hub como el
 * de Linktree, nada más los links en cards a lo largo, ese es el plan
 * básico; y para rediseñarlo, para darle más customización, sí hay que
 * pagar: el paquete premium. Copiémosle el modelo, pero a nuestra
 * forma».
 *
 * ── EL MODELO ──────────────────────────────────────────────────────
 * Linktree regala el link hub (links ilimitados, apariencia básica) y
 * cobra la apariencia avanzada, la programación de links, la analítica
 * y el dominio propio. Acá igual, en dos escalones y no en cuatro:
 *
 *   GRATIS  la página de enlaces completa —botones, íconos de red,
 *           títulos y textos, sin límite—, logo, nombre y bajada, tres
 *           temas con tu color de acento, bordes y alineación, el QR y
 *           tu dirección en linksy.lat o bookea.lat. Es lo que hace
 *           falta para estar en la calle hoy.
 *   PRO     todo lo que es DISEÑO: los trece temas, las seis fuentes,
 *           los efectos (vidrio, elevado…), los estilos de botón, los
 *           fondos animados, el movimiento, los encabezados Héroe y De
 *           fondo y sus marcos, las piezas sueltas, la cuadrícula, la
 *           vitrina de productos dentro de la página, el color
 *           automático desde tu foto, la foto de fondo en las cards y
 *           tu propio dominio.
 *
 * Los add-ons (catálogo, ventas, lealtad) son OTRA cosa: se prenden
 * aparte y hoy son gratis en prueba (ver addons.ts). Instagram Auto
 * Reply va en los dos planes: es lo que nos distingue, no lo que
 * cobramos.
 *
 * ── DÓNDE SE HACE CUMPLIR ─────────────────────────────────────────
 * En el EDITOR, lo Pro se ve con su candado (el dueño sabe qué existe);
 * en el SERVIDOR, `sanearParaPlan` devuelve al valor gratis cualquier
 * campo Pro que llegue de un negocio sin Pro — aunque lo mande a mano.
 * El plan vive en `solutions_negocios.plan` (0239) y hoy lo pone Bookea
 * a mano al activar Pro: no hay pasarela todavía.
 */

export const PLANES_LINKSY = ["gratis", "pro"] as const;
export type PlanLinksy = (typeof PLANES_LINKSY)[number];

export function planLinksyDe(v: unknown): PlanLinksy {
  return (PLANES_LINKSY as readonly unknown[]).includes(v) ? (v as PlanLinksy) : "gratis";
}

export const esPro = (plan: PlanLinksy): boolean => plan === "pro";

export type DefinicionPlanLinksy = {
  nombre: string;
  bajada: string;
  /** Dólares por mes: un precio de lista para toda Latinoamérica. */
  precioMes: number;
  incluye: string[];
};

export const PLAN_LINKSY: Record<PlanLinksy, DefinicionPlanLinksy> = {
  gratis: {
    nombre: "Gratis",
    bajada: "Tu link hub, hoy mismo. Como Linktree, sin pagar.",
    precioMes: 0,
    incluye: [
      "Enlaces sin límite: botones, íconos de red, títulos y textos",
      "Logo, nombre y bajada",
      "Tres temas con tu color de acento",
      "Bordes, alineación y espacio entre piezas",
      "Dos diseños de menú (Clásico y Carta)",
      "Tu dirección en linksy.lat o bookea.lat, y tu QR",
      "Instagram Auto Reply",
    ],
  },
  pro: {
    nombre: "Pro",
    bajada: "Tu página, exactamente como la imaginás.",
    precioMes: 9,
    incluye: [
      "Trece temas y seis fuentes",
      "Veinticuatro diseños de menú más, con su papel y su letra",
      "Efectos de las tarjetas: vidrio, elevado, contorno, degradado",
      "Estilos de botón y fondos animados",
      "Movimiento: cómo entra la página y qué hacen los botones",
      "Encabezados Héroe y De fondo, marco libre o grabado",
      "Piezas sueltas y cuadrícula",
      "Vitrina de productos dentro de tu página",
      "Color automático desde tu foto",
      "Foto de fondo en cada card",
      "Tu propio dominio (tunegocio.com)",
    ],
  },
};

/** Los temas que trae el plan gratis: la marca del negocio, claro y noche. */
export const TEMAS_GRATIS: readonly Tema[] = ["marca", "claro", "noche"];

/**
 * Qué controles del editor son Pro. Es la lista que el editor usa para
 * poner el candado y la que `sanearParaPlan` hace cumplir; una sola.
 */
export const CAPACIDADES_PRO = [
  "temas_todos",
  "fuentes",
  "efectos",
  "botones",
  "fondos",
  "movimiento",
  "encabezado_disenos",
  "encabezado_marco",
  "piezas_sueltas",
  "cuadricula",
  "vitrina",
  "auto_color",
  "foto_en_cards",
  "dominio_propio",
  "menu_disenos",
] as const;
export type CapacidadPro = (typeof CAPACIDADES_PRO)[number];

export function puedeLinksy(plan: PlanLinksy, _capacidad: CapacidadPro): boolean {
  return esPro(plan);
}

/** Las partes del «vestido» de la página que el plan puede limitar. */
export type VestidoPagina = {
  tema: Tema;
  estiloLinks: EstiloLinks;
  fuente: Fuente;
  estiloPortada: EstiloPortada;
  efecto: Efecto;
  diseno: Diseno;
};

/**
 * Devuelve el vestido tal cual si el plan lo permite; si no, cada campo
 * Pro vuelve a su valor gratis. Puro y determinista: se prueba solo.
 */
export function sanearParaPlan(v: VestidoPagina, plan: PlanLinksy): VestidoPagina {
  if (esPro(plan)) return v;
  return {
    tema: TEMAS_GRATIS.includes(v.tema) ? v.tema : "marca",
    estiloLinks: "lista",
    fuente: "sistema",
    estiloPortada: v.estiloPortada === "card" || v.estiloPortada === "sin" ? v.estiloPortada : "sin",
    efecto: "plano",
    diseno: {
      ...v.diseno,
      animacion: DISENO_BASE.animacion,
      hover: DISENO_BASE.hover,
      fondo: DISENO_BASE.fondo,
      boton: DISENO_BASE.boton,
      vitrina: DISENO_BASE.vitrina,
      encabezado: DISENO_BASE.encabezado,
      piezas: DISENO_BASE.piezas,
      // El catálogo tiene su propio juego de diseños (menu-estilos.ts):
      // dos en Gratis, los veinticinco en Pro.
      menu: estiloMenuParaPlan(v.diseno.menu, false),
    },
  };
}

// ── El dominio de marca de la página ────────────────────────────────

/**
 * En qué dirección se MUESTRA la página (8 sep 2026, «que se pueda
 * elegir el dominio, bookea o linksy»): `linksy.lat/<slug>` o
 * `bookea.lat/s/<slug>`. Las dos sirven siempre —el proxy reescribe una
 * a la otra—; esto decide cuál se enseña en el panel, se comparte y va
 * en el QR. Vive en `solutions_negocios.host_marca` (0239).
 */
export const HOSTS_MARCA = ["linksy", "bookea"] as const;
export type HostMarca = (typeof HOSTS_MARCA)[number];

export function hostMarcaDe(v: unknown): HostMarca {
  return (HOSTS_MARCA as readonly unknown[]).includes(v) ? (v as HostMarca) : "linksy";
}

export const HOST_MARCA: Record<HostMarca, { nombre: string; ejemplo: string; pie: string }> = {
  linksy: { nombre: "linksy.lat", ejemplo: "linksy.lat/tu-negocio", pie: "Corta, para la bio y el QR" },
  bookea: { nombre: "bookea.lat", ejemplo: "bookea.lat/s/tu-negocio", pie: "Con la marca Bookea" },
};
