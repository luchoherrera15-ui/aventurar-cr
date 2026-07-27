import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import RielProveedores from "@/components/riel-proveedores";
import type { Calificacion } from "@/components/rancho-card";
import { proximaFechaLibre } from "@/lib/fechas";
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  normalizarCategoria,
  type HomeSeccion,
  type Rancho,
} from "./mi-rancho/types";

const LIMITE_RIEL = 14;

type FechaOcupada = { rancho_id: string; fecha: string };
type SupabaseServidor = Awaited<ReturnType<typeof createClient>>;

type Riel = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  items: Rancho[];
  verTodoHref?: string;
};

function normalizar(r: Rancho): Rancho {
  return { ...r, categoria: normalizarCategoria(r.categoria) };
}

async function resolverRanchos(supabase: SupabaseServidor, seccion: HomeSeccion): Promise<Rancho[]> {
  if (seccion.tipo === "manual") {
    if (!seccion.rancho_ids || seccion.rancho_ids.length === 0) return [];
    const { data } = await supabase
      .from("ranchos")
      .select("*")
      .in("id", seccion.rancho_ids)
      .eq("estado", "aprobado");
    // `in(...)` no garantiza el orden — se respeta el orden en que el
    // admin armó la lista, no el que devuelva la base de datos.
    const porId = new Map(((data ?? []) as Rancho[]).map((r) => [r.id, r]));
    return seccion.rancho_ids
      .map((id) => porId.get(id))
      .filter((r): r is Rancho => !!r)
      .map(normalizar);
  }

  let query = supabase.from("ranchos").select("*").eq("estado", "aprobado");
  if (seccion.tipo === "categoria") {
    query = query.eq("categoria", seccion.categoria);
    if (seccion.subcategoria) query = query.eq("subcategoria", seccion.subcategoria);
  } else {
    if (seccion.provincia) query = query.eq("provincia", seccion.provincia);
    if (seccion.canton) query = query.eq("canton", seccion.canton);
  }

  const { data } = await query.order("created_at", { ascending: false }).limit(LIMITE_RIEL);
  return ((data ?? []) as Rancho[]).map(normalizar);
}

function hrefDeSeccion(seccion: HomeSeccion): string | undefined {
  if (seccion.tipo === "categoria" && seccion.categoria) {
    const params = new URLSearchParams({ categoria: seccion.categoria });
    if (seccion.subcategoria) params.set("subcategoria", seccion.subcategoria);
    return `/ranchos-eventos?${params.toString()}`;
  }
  if (seccion.tipo === "ubicacion" && seccion.provincia) {
    const params = new URLSearchParams({ provincia: seccion.provincia });
    if (seccion.canton) params.set("canton", seccion.canton);
    return `/ranchos-eventos?${params.toString()}`;
  }
  // "manual" es una selección armada a mano: no hay un filtro del
  // directorio que la reproduzca, así que no hay a dónde mandar "ver todo".
  return undefined;
}

/**
 * Mientras nadie configuró ninguna sección en /admin/inicio, el home
 * no se queda en blanco: arma un riel por cada categoría que ya tenga
 * al menos un proveedor publicado, con los más recientes primero.
 */
async function rielesPorDefecto(supabase: SupabaseServidor): Promise<Riel[]> {
  const rieles: Riel[] = [];
  for (const cat of CATEGORIAS) {
    const { data } = await supabase
      .from("ranchos")
      .select("*")
      .eq("estado", "aprobado")
      .eq("categoria", cat)
      .order("created_at", { ascending: false })
      .limit(LIMITE_RIEL);
    const items = ((data ?? []) as Rancho[]).map(normalizar);
    if (items.length > 0) {
      rieles.push({
        id: cat,
        titulo: `${CATEGORIA_LABEL[cat]} para tu evento`,
        subtitulo: null,
        items,
        verTodoHref: `/ranchos-eventos?categoria=${cat}`,
      });
    }
  }
  return rieles;
}

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: seccionesData }, { data: confirmadas }, { data: calificacionesData }] = await Promise.all([
    supabase.from("home_secciones").select("*").eq("activo", true).order("orden", { ascending: true }),
    supabase.from("disponibilidad_rancho").select("rancho_id, fecha").eq("estado", "confirmada"),
    supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favoritosIniciales: string[] = [];
  if (user) {
    const { data: favData } = await supabase
      .from("favoritos")
      .select("rancho_id")
      .eq("cliente_id", user.id);
    favoritosIniciales = (favData ?? []).map((f) => f.rancho_id as string);
  }

  const secciones = (seccionesData ?? []) as HomeSeccion[];

  const rieles: Riel[] =
    secciones.length > 0
      ? await Promise.all(
          secciones.map(async (s) => ({
            id: s.id,
            titulo: s.titulo,
            subtitulo: s.subtitulo,
            items: await resolverRanchos(supabase, s),
            verTodoHref: hrefDeSeccion(s),
          })),
        )
      : await rielesPorDefecto(supabase);

  const rielesConContenido = rieles.filter((r) => r.items.length > 0);

  const fechasOcupadas = (confirmadas ?? []) as FechaOcupada[];
  const ocupadosPorFecha = new Map<string, Set<string>>();
  fechasOcupadas.forEach((f) => {
    if (!ocupadosPorFecha.has(f.fecha)) ocupadosPorFecha.set(f.fecha, new Set());
    ocupadosPorFecha.get(f.fecha)!.add(f.rancho_id);
  });

  const calificaciones = new Map<string, Calificacion>(
    ((calificacionesData ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );
  const favoritosIds = new Set(favoritosIniciales);

  // Solo "lugares" reserva por fecha en línea — el resto no tiene
  // calendario, así que ni siquiera entran a este cálculo.
  const proximasLibres = new Map<string, string | null>();
  rielesConContenido.forEach((riel) => {
    riel.items.forEach((r) => {
      if (r.categoria === "lugares" && !proximasLibres.has(r.id)) {
        proximasLibres.set(r.id, proximaFechaLibre(r.id, ocupadosPorFecha));
      }
    });
  });

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader />

      <section className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
        <div className="mb-7">
          <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-5 before:bg-aventurea-navy">
            Directorio nacional
          </p>
          <h1 className="titulo mt-2 text-[34px] text-aventurea-ink sm:text-[44px]">
            Todo para tu evento
          </h1>
        </div>

        {rielesConContenido.length === 0 ? (
          <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface px-6 py-12 text-center">
            <p className="text-[15px] font-bold text-aventurea-ink">
              Todavía no hay proveedores publicados.
            </p>
            <p className="mt-1.5 text-[13.5px] text-aventurea-ink-soft">
              Sé el primero —{" "}
              <Link href="/publicar" className="font-bold text-aventurea-navy underline">
                publicá tu negocio
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="divide-y divide-aventurea-line">
            {rielesConContenido.map((riel) => (
              <RielProveedores
                key={riel.id}
                titulo={riel.titulo}
                subtitulo={riel.subtitulo ?? undefined}
                items={riel.items}
                verTodoHref={riel.verTodoHref}
                calificaciones={calificaciones}
                proximasLibres={proximasLibres}
                favoritosIds={favoritosIds}
                sesionActiva={!!user}
              />
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-aventurea-navy/20 bg-aventurea-navy/5 px-6 py-5">
          <div>
            <h2 className="text-[15px] font-bold text-aventurea-ink">
              ¿Tenés un negocio para eventos?
            </h2>
            <p className="mt-1 text-[13px] text-aventurea-ink-soft">
              Lugares, comida, animación, decoración y más — publicalo gratis en
              Bookear CR y llegá a más clientes en todo el país.
            </p>
          </div>
          <Link
            href="/publicar"
            className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
          >
            Publicar mi espacio
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/ranchos-eventos"
            className="text-[13.5px] font-bold text-aventurea-navy hover:underline"
          >
            Ver el directorio completo →
          </Link>
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          BOOKEAR CR — Costa Rica ·{" "}
          <Link href="/puntaleona-web" className="font-bold text-aventurea-navy">
            Paquetes vacacionales
          </Link>
        </p>
      </footer>
    </div>
  );
}
