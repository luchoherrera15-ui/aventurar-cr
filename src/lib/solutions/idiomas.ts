/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MENÚ EN VARIOS IDIOMAS — y la ficha nutricional (0235)
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (5 sep 2026): «que el menú se pueda ver en cinco
 * idiomas al mismo tiempo: español, italiano, francés…», y «al
 * clickear la foto de un plato, poder ver cuánta proteína, cuánto tal
 * cosa — opcional».
 *
 * El español es la base y vive donde siempre (`nombre`, `descripcion`).
 * Los otros cinco van en `traducciones` (jsonb), y el negocio elige
 * cuáles OFRECE en `idiomas_menu`. `textoEn()` resuelve qué mostrar:
 * la traducción si existe, el español si no — un plato sin traducir
 * no desaparece del menú en inglés, se ve en español.
 *
 * Todo lo de acá es puro y está probado (idiomas.test.ts). Lo que
 * habla con la IA para traducir vive en la action del panel.
 */

import { TOPES } from "./tipos";

export const IDIOMAS_EXTRA = ["en", "fr", "it", "pt", "de"] as const;
export type IdiomaExtra = (typeof IDIOMAS_EXTRA)[number];
export const IDIOMAS = ["es", ...IDIOMAS_EXTRA] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** Cómo se llama cada idioma en español (para el panel) y en sí mismo (para el cliente). */
export const IDIOMA: Record<Idioma, { nombre: string; propio: string; codigo: string }> = {
  es: { nombre: "Español", propio: "Español", codigo: "ES" },
  en: { nombre: "Inglés", propio: "English", codigo: "EN" },
  fr: { nombre: "Francés", propio: "Français", codigo: "FR" },
  it: { nombre: "Italiano", propio: "Italiano", codigo: "IT" },
  pt: { nombre: "Portugués", propio: "Português", codigo: "PT" },
  de: { nombre: "Alemán", propio: "Deutsch", codigo: "DE" },
};

export function esIdiomaExtra(v: unknown): v is IdiomaExtra {
  return (IDIOMAS_EXTRA as readonly unknown[]).includes(v);
}

/** Lee el text[] crudo: solo idiomas válidos, sin repetidos, en el orden fijo de la lista. */
export function idiomasMenuDe(v: unknown): IdiomaExtra[] {
  const lista = Array.isArray(v) ? v.filter(esIdiomaExtra) : [];
  return IDIOMAS_EXTRA.filter((i) => lista.includes(i));
}

export type Traduccion = { nombre?: string; descripcion?: string };
export type Traducciones = Partial<Record<IdiomaExtra, Traduccion>>;

/**
 * Lee el jsonb crudo y devuelve solo lo que vale: idiomas conocidos,
 * strings recortados a los mismos topes que el español. Lo que no
 * encaja se descarta en silencio — es un dato de la base, no un
 * formulario.
 */
export function traduccionesDe(v: unknown): Traducciones {
  const salida: Traducciones = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return salida;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!esIdiomaExtra(k) || !val || typeof val !== "object" || Array.isArray(val)) continue;
    const t = val as Record<string, unknown>;
    const nombre = typeof t.nombre === "string" ? t.nombre.trim().slice(0, TOPES.itemNombre) : "";
    const descripcion = typeof t.descripcion === "string" ? t.descripcion.trim().slice(0, TOPES.itemDescripcion) : "";
    if (!nombre && !descripcion) continue;
    salida[k] = { ...(nombre ? { nombre } : {}), ...(descripcion ? { descripcion } : {}) };
  }
  return salida;
}

/** El texto de un plato o sección en el idioma pedido, con el español de respaldo. */
export function textoEn(
  x: { nombre: string; descripcion?: string; traducciones?: Traducciones },
  idioma: Idioma,
): { nombre: string; descripcion: string } {
  const base = { nombre: x.nombre, descripcion: x.descripcion ?? "" };
  if (idioma === "es") return base;
  const t = x.traducciones?.[idioma];
  if (!t) return base;
  return { nombre: t.nombre || base.nombre, descripcion: t.descripcion || base.descripcion };
}

/** ¿Este plato tiene traducción completa (al menos el nombre) en ese idioma? */
export function estaTraducido(traducciones: Traducciones | undefined, idioma: IdiomaExtra): boolean {
  return Boolean(traducciones?.[idioma]?.nombre);
}

/** Lee `?idioma=` y devuelve uno que el negocio ofrezca; si no, español. */
export function idiomaDeBusqueda(v: string | string[] | undefined, ofrecidos: IdiomaExtra[]): Idioma {
  const crudo = Array.isArray(v) ? v[0] : v;
  if (crudo && esIdiomaExtra(crudo) && ofrecidos.includes(crudo)) return crudo;
  return "es";
}

// ── La ficha nutricional ─────────────────────────────────────────────

export const ALERGENOS = ["gluten", "lacteos", "huevo", "mani", "frutos_secos", "soya", "mariscos", "pescado", "sesamo"] as const;
export type Alergeno = (typeof ALERGENOS)[number];

export const ALERGENO: Record<Alergeno, string> = {
  gluten: "Gluten",
  lacteos: "Lácteos",
  huevo: "Huevo",
  mani: "Maní",
  frutos_secos: "Frutos secos",
  soya: "Soya",
  mariscos: "Mariscos",
  pescado: "Pescado",
  sesamo: "Sésamo",
};

export type Nutricion = {
  /** «300 g», «1 taza». Texto libre y corto. */
  porcion?: string;
  calorias?: number;
  /** En gramos. */
  proteina?: number;
  carbohidratos?: number;
  grasa?: number;
  alergenos?: Alergeno[];
};

const TOPE_PORCION = 40;

function numeroValido(v: unknown, max: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return Math.round(n * 10) / 10;
}

/**
 * Lee el jsonb crudo (o lo que mandó el formulario). Devuelve null si no
 * queda NADA válido: así «no cargó la ficha» y «cargó una ficha vacía»
 * son lo mismo, y el menú no dibuja una ficha en blanco.
 */
export function nutricionDe(v: unknown): Nutricion | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>;
  const salida: Nutricion = {};
  const porcion = typeof c.porcion === "string" ? c.porcion.trim().slice(0, TOPE_PORCION) : "";
  if (porcion) salida.porcion = porcion;
  const calorias = numeroValido(c.calorias, 5000);
  if (calorias !== undefined) salida.calorias = Math.round(calorias);
  for (const k of ["proteina", "carbohidratos", "grasa"] as const) {
    const n = numeroValido(c[k], 1000);
    if (n !== undefined) salida[k] = n;
  }
  const alergenos = Array.isArray(c.alergenos)
    ? ALERGENOS.filter((a) => (c.alergenos as unknown[]).includes(a))
    : [];
  if (alergenos.length > 0) salida.alergenos = alergenos;
  return Object.keys(salida).length > 0 ? salida : null;
}
