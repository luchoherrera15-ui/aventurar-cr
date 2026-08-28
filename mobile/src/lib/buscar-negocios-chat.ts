import { supabase } from "@/lib/supabase";
import { normalizarTexto } from "@/lib/busqueda";
import { CATEGORIA_LABEL, SUBCATEGORIA_LABEL } from "@/lib/types";
import { CATEGORIA_CITA_LABEL } from "@/lib/citas";
import { CATEGORIA_HOSPEDAJE_LABEL } from "@/lib/hospedajes";
import { CATEGORIA_RESTAURANTE_LABEL } from "@/lib/restaurantes";

/**
 * La búsqueda de "con qué negocio empiezo un chat nuevo" — antes vivía
 * SOLO adentro de `explorar-chat.tsx` (la pestaña "Explorar" de
 * Mensajes, un modo de pantalla completa aparte). El buscador de
 * arriba de Mensajes pasó a ser "multitasking" (pedido del dueño): un
 * solo campo que filtra tus chats Y busca negocios para empezar uno
 * nuevo, así que esta lógica se extrae acá para que ambos (la lista
 * unificada y — si algún día hace falta— una pantalla aparte) usen la
 * misma consulta, en vez de mantener dos copias que se desalinean.
 *
 * El nombre va con ilike a la base y el término también se compara
 * contra los labels de categoría y subcategoría (normalizados, sin
 * tildes) para traducirlo a ids — así "dj" encuentra a los de
 * subcategoría dj_discomovil aunque no se llamen así. Los labels salen
 * de las listas que la app ya mantiene EN PARIDAD con la web.
 */

export type NegocioChatRow = {
  id: string;
  nombre: string;
  categoria: string | null;
  subcategoria: string | null;
  vertical: string | null;
  provincia: string | null;
  canton: string | null;
  foto_url: string | null;
  owner_id: string | null;
  destacado_orden: number | null;
  detalles: Record<string, unknown> | null;
};

const SELECCION =
  "id, nombre, categoria, subcategoria, vertical, provincia, canton, foto_url, owner_id, destacado_orden, detalles";

/** El rubro legible según la vertical del negocio. */
export function rubroDeNegocioChat(n: NegocioChatRow): string {
  const cat = n.categoria ?? "";
  switch (n.vertical ?? "eventos") {
    case "citas":
      return (CATEGORIA_CITA_LABEL as Record<string, string>)[cat] ?? "Servicios";
    case "hospedajes":
      return (CATEGORIA_HOSPEDAJE_LABEL as Record<string, string>)[cat] ?? "Hospedajes";
    case "restaurantes":
      return (CATEGORIA_RESTAURANTE_LABEL as Record<string, string>)[cat] ?? "Restaurantes";
    default:
      return (
        SUBCATEGORIA_LABEL[n.subcategoria ?? ""] ??
        (CATEGORIA_LABEL as Record<string, string>)[cat] ??
        "Eventos"
      );
  }
}

/**
 * Qué ids de categoría/subcategoría "significa" el término: se compara
 * contra los labels de las cuatro verticales sin tildes ni mayúsculas.
 */
function categoriasQueMatchean(termNorm: string): { categorias: string[]; subcategorias: string[] } {
  const categorias = new Set<string>();
  const subcategorias = new Set<string>();
  const labelsDeCategoria: Record<string, string>[] = [
    CATEGORIA_LABEL,
    CATEGORIA_CITA_LABEL,
    CATEGORIA_HOSPEDAJE_LABEL,
    CATEGORIA_RESTAURANTE_LABEL,
  ];
  for (const labels of labelsDeCategoria) {
    for (const [id, label] of Object.entries(labels)) {
      if (normalizarTexto(label).includes(termNorm)) categorias.add(id);
    }
  }
  for (const [id, label] of Object.entries(SUBCATEGORIA_LABEL)) {
    if (normalizarTexto(label).includes(termNorm)) subcategorias.add(id);
  }
  return { categorias: [...categorias], subcategorias: [...subcategorias] };
}

/**
 * Busca negocios para empezar un chat nuevo. Con término vacío trae
 * sugerencias (destacados primero); con término, nombre + categoría.
 * Nunca trae al propio negocio del que busca ni uno pausado.
 */
export async function buscarNegociosParaChat(
  termino: string,
  miId: string,
  limite = 12,
): Promise<NegocioChatRow[]> {
  const termNorm = normalizarTexto(termino).trim();

  let data: NegocioChatRow[] = [];
  if (termNorm.length === 0) {
    const { data: sugeridos } = await supabase
      .from("ranchos")
      .select(SELECCION)
      .eq("estado", "aprobado")
      // ⚠️ Sin los negocios de la DEMO (27 ago 2026). El seed de
      // /demo-bookea siembra 99 negocios APROBADOS con
      // en_marketplace=false — la web los filtra así desde
      // home-datos.ts, pero la app no lo hacía y los 99 se le
      // colaron a los listados. `neq` y no `eq(true)`: un NULL
      // viejo no es ni igual ni distinto a true en Postgres.
      .neq("en_marketplace", false)
      .order("destacado_orden", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limite);
    data = (sugeridos ?? []) as NegocioChatRow[];
  } else {
    const { categorias, subcategorias } = categoriasQueMatchean(termNorm);
    // Los caracteres con significado en el filtro `or` de PostgREST se
    // neutralizan para que un término raro no rompa la consulta.
    const seguro = termino.replace(/[%_,()]/g, " ").trim();
    const partes: string[] = [];
    if (seguro.length > 0) partes.push(`nombre.ilike.%${seguro}%`);
    if (categorias.length > 0) partes.push(`categoria.in.(${categorias.join(",")})`);
    if (subcategorias.length > 0) partes.push(`subcategoria.in.(${subcategorias.join(",")})`);
    if (partes.length > 0) {
      const { data: encontrados } = await supabase
        .from("ranchos")
        .select(SELECCION)
        .eq("estado", "aprobado")
        // ⚠️ Sin los negocios de la DEMO (27 ago 2026). El seed de
        // /demo-bookea siembra 99 negocios APROBADOS con
        // en_marketplace=false — la web los filtra así desde
        // home-datos.ts, pero la app no lo hacía y los 99 se le
        // colaron a los listados. `neq` y no `eq(true)`: un NULL
        // viejo no es ni igual ni distinto a true en Postgres.
        .neq("en_marketplace", false)
        .or(partes.join(","))
        .limit(30);
      data = (encontrados ?? []) as NegocioChatRow[];
    }
  }

  return data
    .filter((n) => n.detalles?.en_configuracion !== true && n.owner_id !== miId)
    .sort((a, b) => (a.destacado_orden ?? Infinity) - (b.destacado_orden ?? Infinity))
    .slice(0, limite);
}
