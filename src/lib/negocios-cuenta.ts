import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { negociosDeLaCuenta } from "@/lib/solutions/acceso";
import { addonsDeVarios, ADDON, type AddonId as AddonPaginaId } from "@/lib/solutions/addons";
import { nombreAddon, estadoDeAddon } from "@/lib/addons";
import { rutaDeNegocio } from "@/lib/ruta-negocio";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS NEGOCIOS DE UNA CUENTA — las tres entidades, UNA lista
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «ahora vamos a tener un Bookea
 * totalmente junto… los negocios van a estar acá, en esta página
 * [/cuenta]… para que unifiques todo».
 *
 * Este módulo es la FEDERACIÓN DE LECTURA que eso necesita: junta en
 * una sola lista los negocios que la cuenta administra, vengan de
 * donde vengan —`ranchos` (marketplace y Lealtad) y
 * `solutions_negocios` (la página /s/)— sin tocar ni una tabla.
 *
 * ── LO QUE ESTE MÓDULO **NO** HACE, A PROPÓSITO ─────────────────────
 *
 * NO unifica las entidades. La decisión congelada #6 de
 * `docs/arquitectura.md` dice que `ranchos`, `solutions_negocios` y
 * `celebrar_perfiles` no se funden todavía: primero federación por
 * identidad, después migración progresiva. Esto es exactamente esa
 * federación: cada entidad se consulta con SUS consultas de siempre y
 * lo único nuevo es la lista de salida. Cero joins nuevos entre
 * productos, cero columnas nuevas.
 *
 * Celebrar queda fuera: es un producto aparte (decisión #4), no un
 * negocio del panel.
 *
 * ── DÓNDE SE USA ────────────────────────────────────────────────────
 * `/cuenta` (el modo Negocio). Antes esa pantalla solo miraba
 * `ranchos`: una cuenta cuyo único negocio era su página de `/s/`
 * entraba y ni siquiera veía el botón de «Modo Negocio».
 *
 * ⚠️ SOLO SERVIDOR: usa la llave de servicio (igual que
 * `negociosDeLaCuenta`). Desde un componente de cliente se importa
 * ÚNICAMENTE el tipo (`import type`), nunca la función — la frontera
 * cliente↔servidor ya rompió el build dos veces.
 */

/** En qué mundo vive el negocio — decide su URL pública y su panel. */
export type MundoNegocio = "marketplace" | "lealtad" | "pagina";

export type NegocioDeCuenta = {
  /** De qué entidad sale la fila. `rancho` = marketplace/Lealtad. */
  origen: "rancho" | "pagina";
  id: string;
  nombre: string;
  esDueno: boolean;
  mundo: MundoNegocio;
  /** true = visible al público (publicado / activo en el directorio). */
  publicado: boolean;
  fotoUrl: string | null;
  /** La página que ve el cliente final, si existe. */
  urlPublica: string | null;
  /** El panel que ya sabe administrar este negocio. */
  hrefPanel: string;
  /** Lo que tiene contratado/activo, con nombre legible. Para chips. */
  activos: string[];
  /** ¿Tiene tarjeta de lealtad armada (programa real, no solo add-on)? */
  tieneTarjeta: boolean;
};

type FilaRancho = {
  id: string;
  nombre: string | null;
  slug: string | null;
  vertical: string | null;
  estado: string | null;
  en_marketplace: boolean | null;
  foto_url: string | null;
};

const SELECT_RANCHO = "id, nombre, slug, vertical, estado, en_marketplace, foto_url";

/**
 * La lista federada, para la sesión actual. Devuelve `[]` sin sesión.
 *
 * Costo: 6 consultas fijas (2 ranchos + 1 colaboradores + 1 add-ons +
 * 1 programas + lo de Solutions). Nada por-negocio: todo va con `.in()`.
 */
export async function negociosDeCuenta(): Promise<NegocioDeCuenta[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // ── RANCHOS: propios + colaborados (0116), como /mi-negocio ───────
  const [{ data: propiosData }, { data: colabData }] = await Promise.all([
    supabase.from("ranchos").select(SELECT_RANCHO).eq("owner_id", user.id),
    supabase.from("rancho_colaboradores").select("rancho_id").eq("usuario_id", user.id),
  ]);
  const propios = (propiosData ?? []) as FilaRancho[];
  const idsColab = ((colabData ?? []) as { rancho_id: string }[])
    .map((c) => c.rancho_id)
    .filter((rid) => !propios.some((n) => n.id === rid));
  let colaborados: FilaRancho[] = [];
  if (idsColab.length > 0) {
    const { data } = await supabase.from("ranchos").select(SELECT_RANCHO).in("id", idsColab);
    colaborados = (data ?? []) as FilaRancho[];
  }
  const ranchos = [...propios.map((r) => ({ fila: r, esDueno: true })), ...colaborados.map((r) => ({ fila: r, esDueno: false }))];

  // Add-ons y tarjetas de TODOS los ranchos, en dos consultas planas.
  const idsRancho = ranchos.map((r) => r.fila.id);
  let addonsPorRancho = new Map<string, string[]>();
  const conTarjeta = new Set<string>();
  if (idsRancho.length > 0) {
    const admin = createAdminClient();
    const lector = admin ?? supabase;
    const [{ data: addonsData }, { data: programasData }] = await Promise.all([
      lector.from("addons_negocio").select("rancho_id, addon, activo, vence_en").in("rancho_id", idsRancho),
      lector.from("programa_lealtad").select("rancho_id").in("rancho_id", idsRancho),
    ]);
    addonsPorRancho = new Map();
    for (const a of (addonsData ?? []) as { rancho_id: string; addon: string; activo: boolean | null; vence_en: string | null }[]) {
      if (estadoDeAddon({ activo: a.activo === true, vence_en: a.vence_en }) !== "activo") continue;
      const lista = addonsPorRancho.get(a.rancho_id) ?? [];
      lista.push(nombreAddon(a.addon));
      addonsPorRancho.set(a.rancho_id, lista);
    }
    for (const p of (programasData ?? []) as { rancho_id: string | null }[]) {
      if (p.rancho_id) conTarjeta.add(p.rancho_id);
    }
  }

  const lista: NegocioDeCuenta[] = ranchos.map(({ fila, esDueno }) => {
    // El mismo criterio que /cuenta y /mi-negocio: `!== false`, así un
    // esquema sin la 0187 deja todo como estaba.
    const esMarketplace = fila.en_marketplace !== false;
    const activos = [...(addonsPorRancho.get(fila.id) ?? [])];
    if (conTarjeta.has(fila.id) && !activos.some((a) => a.toLowerCase().includes("lealtad"))) {
      activos.push("Tarjeta de lealtad");
    }
    return {
      origen: "rancho",
      id: fila.id,
      nombre: (fila.nombre ?? "").trim() || "Tu negocio",
      esDueno,
      mundo: esMarketplace ? "marketplace" : "lealtad",
      publicado: fila.estado === "activo",
      fotoUrl: fila.foto_url,
      urlPublica: esMarketplace
        ? rutaDeNegocio({ id: fila.id, slug: fila.slug, vertical: fila.vertical })
        : fila.slug
          ? `/r/${fila.slug}`
          : null,
      hrefPanel: esMarketplace ? `/mi-negocio/${fila.id}` : `/lealtad/panel/${fila.id}`,
      activos,
      tieneTarjeta: conTarjeta.has(fila.id),
    };
  });

  // ── LA PÁGINA (/s/): la consulta que ya existe, sin duplicarla ────
  const paginas = await negociosDeLaCuenta();
  if (paginas.length > 0) {
    const admin = createAdminClient();
    const ids = paginas.map((p) => p.id);
    const [addons, { data: extras }] = await Promise.all([
      admin ? addonsDeVarios(admin, ids) : Promise.resolve({} as Awaited<ReturnType<typeof addonsDeVarios>>),
      admin
        ? admin.from("solutions_negocios").select("id, logo_url").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; logo_url: string | null }[] }),
    ]);
    const logoPorId = new Map(((extras ?? []) as { id: string; logo_url: string | null }[]).map((e) => [e.id, e.logo_url]));
    for (const p of paginas) {
      const estado = addons[p.id];
      const activos = estado
        ? (Object.keys(estado) as AddonPaginaId[]).filter((a) => estado[a]).map((a) => ADDON[a].nombre)
        : [];
      lista.push({
        origen: "pagina",
        id: p.id,
        nombre: p.nombre,
        esDueno: p.esDueno,
        mundo: "pagina",
        publicado: p.publicado,
        fotoUrl: logoPorId.get(p.id) ?? null,
        urlPublica: `/s/${p.slug}`,
        hrefPanel: `/solutions/panel/${p.id}`,
        activos,
        tieneTarjeta: false,
      });
    }
  }

  // Dueños primero, y dentro de cada grupo por nombre — el orden que
  // uno espera en «mis negocios».
  return lista.sort((a, b) => Number(b.esDueno) - Number(a.esDueno) || a.nombre.localeCompare(b.nombre, "es"));
}
