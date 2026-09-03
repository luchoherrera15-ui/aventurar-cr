import { createAdminClient } from "@/lib/supabase/admin";
import { minutoISOCR } from "@/lib/fechas";
import { laDelLinkDeFilasCrudas, resumenDeFila } from "@/lib/wallet/programa-principal";
import { operaAhora } from "@/lib/lealtad/programas";
import { datosVistaDeFila } from "@/lib/lealtad/datos-vista-pase";
import { paletaSobre } from "@/lib/lealtad/plantillas-poster";
import { ratioContraste } from "@/lib/business/identidad";
import { paginaDelNegocio, TOPE_MESAS, type PaginaLealtad } from "@/lib/lealtad/pagina-negocio";

/**
 * LOS DATOS DE /r/<slug> — compartidos por la portada y el menú.
 *
 * La página pública del negocio de Lealtad (0229). Se lee con la LLAVE
 * DE SERVICIO por la misma razón que /tarjeta/[slug]: un negocio
 * nacido en Lealtad vive en estado «pendiente» (nadie lo aprueba — no
 * está en el marketplace) y la RLS de `ranchos` no se lo mostraría al
 * público. La frontera de publicación acá es OTRA: `pagina.publicada`.
 *
 * LA MARCA ES DEL NEGOCIO, NO DE BOOKEA: colores y logo salen de su
 * tarjeta de lealtad vía `datosVistaDeFila` (el mismo camino que el
 * .pkpass), y `paletaSobre` decide la tinta legible sobre ese fondo —
 * el mismo criterio YIQ del póster impreso.
 */

/** Colores de marca por defecto (los de `coloresDe`, wallet/tarjeta.ts). */
const FONDO_POR_DEFECTO = "#002472";
const SELLO_POR_DEFECTO = "#F39200";

export type MarcaPagina = {
  colorFondo: string;
  colorSello: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  /** Tinta principal y suave, legibles sobre `colorFondo` (YIQ). */
  tinta: string;
  suave: string;
  /** Tinta legible SOBRE `colorSello` (los discos y botones rellenos):
   *  con un sello claro, el blanco fijo desaparecía. */
  tintaSobreSello: string;
  /** El sello COMO TEXTO sobre `colorFondo` — solo si el par que el
   *  negocio eligió llega a AA; si no, cae a la tinta. Sin esto, un
   *  fondo navy con sello azul oscuro servía precios invisibles. */
  acentoTexto: string;
  /** Superficie y borde de los tiles, derivados del lado de la tinta. */
  superficie: string;
  borde: string;
};

export type NegocioPublico = {
  id: string;
  nombre: string;
  slug: string;
  provincia: string | null;
  direccionExacta: string | null;
  whatsapp: string | null;
};

export type DatosPaginaPublica = {
  negocio: NegocioPublico;
  pagina: PaginaLealtad;
  marca: MarcaPagina;
  /** true = hay tarjeta operando y el tile de lealtad se ofrece. */
  tarjetaActiva: boolean;
  /** La regalía activa más barata («Café gratis», 8) para la promesa. */
  meta: { nombre: string; costo: number } | null;
  /** Secciones del menú visibles (nombres, ya ordenadas) — [] = sin menú. */
  seccionesMenu: string[];
  totalPlatos: number;
};

function marcaDe(fila: Record<string, unknown> | null, nombre: string): MarcaPagina {
  const vista = fila ? datosVistaDeFila(nombre, fila) : null;
  const colorFondo = vista?.colorFondo || FONDO_POR_DEFECTO;
  const colorSello = vista?.colorSello || SELLO_POR_DEFECTO;
  const { tinta, suave } = paletaSobre(colorFondo);
  const fondoOscuro = tinta === "#ffffff";
  // `ratioContraste` lanza si el color no es hex; un valor raro de la
  // base no puede tumbar la página — cae a la tinta segura.
  let acentoTexto = tinta;
  try {
    if (ratioContraste(colorSello, colorFondo) >= 4.5) acentoTexto = colorSello;
  } catch {
    /* color no-hex: se queda la tinta */
  }
  return {
    colorFondo,
    colorSello,
    tintaSobreSello: paletaSobre(colorSello).tinta,
    acentoTexto,
    logoUrl: vista?.logoUrl ?? null,
    bannerUrl: vista?.bannerUrl ?? null,
    tinta,
    suave,
    superficie: fondoOscuro ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.05)",
    borde: fondoOscuro ? "rgba(255,255,255,0.18)" : "rgba(16,24,40,0.14)",
  };
}

/**
 * Todo lo que la portada y el menú necesitan, o null si la página no
 * existe o no está publicada (→ notFound del llamador).
 */
export async function datosDePaginaPublica(slug: string): Promise<DatosPaginaPublica | null> {
  const admin = createAdminClient();
  if (!admin || !slug) return null;

  const { data: rancho } = await admin
    .from("ranchos")
    .select("id, nombre, slug, provincia, direccion_exacta, contacto_whatsapp")
    .eq("slug", slug)
    .maybeSingle();
  if (!rancho) return null;

  const [pagina, { data: filasPrograma }, { data: itemsData }] = await Promise.all([
    paginaDelNegocio(admin, rancho.id as string),
    admin.from("programa_lealtad").select("*").eq("rancho_id", rancho.id as string),
    admin
      .from("rancho_items")
      .select("id, grupo")
      .eq("rancho_id", rancho.id as string)
      .eq("activo", true)
      .order("orden", { ascending: true }),
  ]);

  // Sin fila publicada no hay página: el interruptor del panel manda.
  if (!pagina || !pagina.publicada) return null;

  // La tarjeta del negocio: la MISMA elección que /tarjeta/<slug> (la
  // más vieja — el QR de papel es inmutable), y solo si opera ahora.
  const filas = (filasPrograma ?? []) as Record<string, unknown>[];
  const filaTarjeta = laDelLinkDeFilasCrudas(filas);
  const ahoraCR = minutoISOCR();
  const tarjetaActiva = !!filaTarjeta && operaAhora(resumenDeFila(filaTarjeta), ahoraCR);

  // La promesa concreta: la regalía activa más barata (mismo criterio
  // que la ficha de citas).
  let meta: { nombre: string; costo: number } | null = null;
  if (tarjetaActiva && filaTarjeta) {
    const { data: recompensa } = await admin
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", filaTarjeta.id as string)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (recompensa && typeof recompensa.nombre === "string") {
      meta = { nombre: recompensa.nombre, costo: Number(recompensa.costo_puntos) || 0 };
    }
  }

  // Las secciones del menú, en orden de aparición (rancho_items ya es
  // público por la 0035 — acá solo se resume para el tile).
  const items = (itemsData ?? []) as { id: string; grupo: string | null }[];
  const seccionesMenu: string[] = [];
  for (const it of items) {
    const g = (it.grupo ?? "").trim() || "Menú";
    if (!seccionesMenu.includes(g)) seccionesMenu.push(g);
  }

  return {
    negocio: {
      id: rancho.id as string,
      nombre: (rancho.nombre as string) ?? "",
      slug: (rancho.slug as string) ?? slug,
      provincia: (rancho.provincia as string | null) ?? null,
      direccionExacta: (rancho.direccion_exacta as string | null) ?? null,
      whatsapp: (rancho.contacto_whatsapp as string | null) ?? null,
    },
    pagina,
    marca: marcaDe(filaTarjeta, (rancho.nombre as string) ?? ""),
    tarjetaActiva,
    meta,
    seccionesMenu,
    totalPlatos: items.length,
  };
}

/** El número de mesa del QR (`?mesa=N`), validado; null = sin mesa. */
export function mesaDeBusqueda(valor: string | string[] | undefined): number | null {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  if (!crudo || !/^\d{1,2}$/.test(crudo)) return null;
  const n = parseInt(crudo, 10);
  return n >= 1 && n <= TOPE_MESAS ? n : null;
}
