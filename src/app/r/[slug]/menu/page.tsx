import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtColones } from "@/lib/finanzas";
import { agruparMenu, anclaDeSeccion, type ItemMenu } from "@/app/restaurantes/tipos";
import { datosDePaginaPublica, mesaDeBusqueda } from "../datos";

/**
 * /r/<slug>/menu — EL MENÚ DIGITAL, vestido con la marca del negocio.
 *
 * Los platos son los MISMOS `rancho_items` que ya edita el dueño en su
 * catálogo (públicos por la 0035) — acá no hay modelo nuevo: solo el
 * vestido. Las secciones respetan el orden que el dueño definió en
 * `categorias_negocio` (0119); lo que no está catalogado va después,
 * en orden de aparición.
 *
 * `?mesa=N` se propaga de vuelta a la portada — la prevista de
 * pedidos viaja en el link, nunca se pierde por navegar.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await datosDePaginaPublica(slug);
  if (!datos) return { title: "Página no encontrada" };
  return {
    title: `El menú · ${datos.negocio.nombre}`,
    description: `Platos y precios de ${datos.negocio.nombre}.`,
  };
}

export default async function MenuPublicoPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const busqueda = await searchParams;
  const datos = await datosDePaginaPublica(slug);
  if (!datos || !datos.pagina.mostrar_menu) notFound();

  const { negocio, marca } = datos;
  const mesa = mesaDeBusqueda(busqueda.mesa);

  const admin = createAdminClient();
  if (!admin) notFound();

  const [{ data: itemsData }, { data: categoriasData }] = await Promise.all([
    admin
      .from("rancho_items")
      .select("id, nombre, descripcion, precio, unidad, grupo, foto_url")
      .eq("rancho_id", negocio.id)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    admin
      .from("categorias_negocio")
      .select("nombre, orden")
      .eq("rancho_id", negocio.id)
      .order("orden", { ascending: true }),
  ]);

  const items = (itemsData ?? []) as ItemMenu[];
  if (items.length === 0) notFound();

  // El orden del dueño primero (0119); el resto, como aparece.
  const ordenDe = new Map(
    ((categoriasData ?? []) as { nombre: string; orden: number }[]).map((c) => [
      c.nombre,
      c.orden,
    ]),
  );
  const secciones = agruparMenu(items).sort(([a], [b]) => {
    const oa = ordenDe.get(a);
    const ob = ordenDe.get(b);
    if (oa !== undefined && ob !== undefined) return oa - ob;
    if (oa !== undefined) return -1;
    if (ob !== undefined) return 1;
    return 0; // sort estable: conserva el orden de aparición
  });

  return (
    <main
      className="min-h-svh px-5 pb-12 pt-5"
      style={{ background: marca.colorFondo, color: marca.tinta }}
    >
      <div className="mx-auto w-full max-w-[520px]">
        {/* ── Cabecera con la vuelta a la portada ───────────────── */}
        <header className="flex items-center justify-between gap-3">
          {/* `portada=1`: con el QR configurado «directo al menú», la
              portada redirige acá — sin el bypass este botón rebotaba
              en bucle y la portada quedaba inalcanzable. */}
          <Link
            href={`/r/${negocio.slug}?portada=1${mesa ? `&mesa=${mesa}` : ""}`}
            className="rounded-xl border px-3 py-1.5 text-[12.5px] font-bold"
            style={{ borderColor: marca.borde, color: marca.suave }}
          >
            ← {negocio.nombre}
          </Link>
          {mesa && (
            <span
              className="rounded-full px-3 py-1 text-[12px] font-bold"
              style={{ background: marca.superficie, border: `1px solid ${marca.borde}` }}
            >
              Mesa {mesa}
            </span>
          )}
        </header>

        <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.02em]">El menú</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: marca.suave }}>
          Precios en colones
        </p>

        {/* ── Anclas de sección (sin JS, como la carta) ─────────── */}
        {secciones.length > 1 && (
          <nav
            aria-label="Secciones del menú"
            className="sticky top-0 z-10 -mx-5 mt-4 overflow-x-auto px-5 py-2.5"
            style={{ background: marca.colorFondo }}
          >
            <div className="flex w-max gap-2">
              {secciones.map(([nombre]) => (
                <a
                  key={nombre}
                  href={`#${anclaDeSeccion(nombre)}`}
                  className="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold"
                  style={{ borderColor: marca.borde, color: marca.suave }}
                >
                  {nombre}
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* ── Los platos ────────────────────────────────────────── */}
        <div className="mt-4 flex flex-col gap-7">
          {secciones.map(([nombre, platos]) => (
            <section key={nombre} id={anclaDeSeccion(nombre)} className="scroll-mt-16">
              <h2
                className="border-b pb-2 text-[15px] font-extrabold uppercase tracking-[0.08em]"
                style={{ borderColor: marca.borde, color: marca.acentoTexto }}
              >
                {nombre}
              </h2>
              <ul className="mt-3 flex flex-col gap-3.5">
                {platos.map((p) => (
                  <li key={p.id} className="flex items-start gap-3">
                    {p.foto_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.foto_url}
                        alt=""
                        className="h-[58px] w-[58px] shrink-0 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-bold leading-snug">{p.nombre}</p>
                      {p.descripcion && (
                        <p
                          className="mt-0.5 text-[12.5px] leading-snug"
                          style={{ color: marca.suave }}
                        >
                          {p.descripcion}
                        </p>
                      )}
                    </div>
                    <p
                      className="shrink-0 text-[14px] font-extrabold tabular-nums"
                      style={{ color: marca.acentoTexto }}
                    >
                      {p.precio !== null ? fmtColones(p.precio) : "Consultar"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-10 text-center text-[11px]" style={{ color: marca.suave }}>
          <a href="https://www.bookea.lat/lealtad" className="hover:underline">
            Hecho con Bookea
          </a>
        </footer>
      </div>
    </main>
  );
}
