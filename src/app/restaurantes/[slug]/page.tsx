import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { IconCloche, IconPin, IconStar } from "@/components/icons";
import { linkGoogleMaps, linkWaze } from "@/app/mi-negocio/types";
import {
  CATEGORIA_RESTAURANTE_LABEL,
  RANGO_PRECIO_LABEL,
  agruparMenu,
  normalizarCategoriaRestaurante,
  opcionesDeDetalles,
  type ItemMenu,
} from "../tipos";
import ProveedorActual from "@/components/proveedor-actual";
import VisitasPagina from "@/components/visitas-pagina";
import AccionesLocal from "./acciones-local";
import FichaCarta from "./carta";

type Local = {
  id: string;
  owner_id: string;
  slug: string | null;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  descripcion_larga: string | null;
  provincia: string | null;
  canton: string | null;
  direccion_exacta: string | null;
  foto_url: string | null;
  precio_desde: number | null;
  contacto_whatsapp: string | null;
  latitud: number | null;
  longitud: number | null;
  detalles: unknown;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select("nombre, descripcion, foto_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return { title: "Restaurante" };
  const descripcion =
    (data.descripcion as string | null) ??
    `Mirá el menú de ${data.nombre} y reservá tu mesa en Bookea.`;
  const foto = data.foto_url as string | null;
  return {
    title: data.nombre as string,
    description: descripcion,
    // La ficha de un local se comparte por WhatsApp más que por
    // cualquier otro lado: sin la foto en el Open Graph, el enlace
    // sale como una línea de texto gris.
    openGraph: {
      title: data.nombre as string,
      description: descripcion,
      type: "website",
      images: foto ? [foto] : undefined,
    },
  };
}

/**
 * La ficha del restaurante: su menú por secciones, cómo llegar y qué
 * se puede hacer acá (reservar mesa, pedir para recoger o consultar
 * por el chat). La reserva de mesa con hora y el pedido llegan en la
 * siguiente entrega; por ahora todo desemboca en el chat, que ya
 * funciona.
 *
 * Los datos se leen UNA vez acá y el dibujo lo decide el TEMA que el
 * local declaró en `detalles.tema_ficha` (ver `TEMAS_FICHA` en
 * ../tipos): "estandar" es esta misma página de siempre; "carta" es la
 * versión editorial de ./carta.tsx, para locales que viven de que su
 * menú se vea caro. La consulta y las reglas son las mismas para los
 * dos — lo único que cambia es cómo se ve.
 */
export default async function RestaurantePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // La sesión y el local, juntos: `auth.getUser()` estaba esperando sola
  // antes de que arrancara siquiera la consulta del restaurante, y no
  // depende una de la otra. Una ida y vuelta menos (~55 ms medidos)
  // para quien tiene sesión abierta.
  const [sesion, { data }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("ranchos")
      .select(
        "id, owner_id, slug, nombre, categoria, descripcion, descripcion_larga, provincia, canton, direccion_exacta, foto_url, precio_desde, contacto_whatsapp, latitud, longitud, detalles",
      )
      .eq("slug", slug)
      .eq("vertical", "restaurantes")
      .eq("estado", "aprobado")
      .maybeSingle(),
  ]);
  const user = sesion.data.user;

  const local = data as Local | null;
  if (!local) notFound();

  const [{ data: itemsData }, { data: calif }] = await Promise.all([
    supabase
      .from("rancho_items")
      .select("id, nombre, descripcion, precio, unidad, grupo, foto_url")
      .eq("rancho_id", local.id)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("calificaciones_rancho")
      .select("promedio, total")
      .eq("rancho_id", local.id)
      .maybeSingle(),
  ]);

  const items = (itemsData ?? []) as ItemMenu[];
  // El menú se agrupa por secciones ("Entradas", "Fuertes"...); lo que
  // no tenga sección cae en una general al final.
  const secciones = agruparMenu(items);

  const categoria = normalizarCategoriaRestaurante(local.categoria);
  const opciones = opcionesDeDetalles(local.detalles);
  const calificacion = calif as { promedio: number; total: number } | null;
  const ubicacion = [local.canton, local.provincia].filter(Boolean).join(", ");
  const senas = [local.direccion_exacta, ubicacion].filter(Boolean).join(", ");
  const hrefMaps = linkGoogleMaps(local.latitud, local.longitud, senas);
  const hrefWaze = linkWaze(local.latitud, local.longitud, senas);

  /* La burbuja de chat flotante solo tiene sentido acá si quien mira
     no es el dueño — nadie se manda una consulta a sí mismo. */
  const burbujaChat =
    local.owner_id !== user?.id ? (
      <ProveedorActual ranchoId={local.id} nombre={local.nombre} />
    ) : null;

  if (opciones.tema === "carta") {
    return (
      <FichaCarta
        local={local}
        categoria={categoria}
        opciones={opciones}
        secciones={secciones}
        calificacion={calificacion}
        ubicacion={ubicacion}
        hrefMaps={hrefMaps}
        hrefWaze={hrefWaze}
        conBurbujaChat={burbujaChat}
      />
    );
  }

  return (
    <div className="min-h-screen bg-aventurea-cream-2">
      {burbujaChat}
      <SiteHeader breadcrumb="Restaurantes" />

      <section className="mx-auto max-w-[900px] px-4 pb-12 pt-4 sm:px-6">
        <Link
          href="/restaurantes"
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Todos los restaurantes
        </Link>

        {/* Prueba social real: "12 personas visitaron este sitio hoy".
            Con pocas visitas no se muestra nada — un número bajo vende
            menos que ningún número. */}
        <VisitasPagina ranchoId={local.id} className="mt-3" />

        {/* La portada */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-aventurea-line bg-white">
          <div className="relative aspect-[16/7] bg-aventurea-blue-light">
            {local.foto_url ? (
              <Image
                src={local.foto_url}
                alt={local.nombre}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 900px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-aventurea-navy/40">
                <IconCloche className="h-14 w-14" />
              </span>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-navy">
                  {CATEGORIA_RESTAURANTE_LABEL[categoria]}
                  {opciones.rangoPrecio
                    ? ` · ${RANGO_PRECIO_LABEL[opciones.rangoPrecio]}`
                    : ""}
                </p>
                <h1 className="mt-1 text-[26px] font-black leading-tight text-aventurea-ink">
                  {local.nombre}
                </h1>
                {ubicacion && (
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-aventurea-ink-soft">
                    <IconPin className="h-4 w-4 text-aventurea-navy" />
                    {local.direccion_exacta ? `${local.direccion_exacta} · ` : ""}
                    {ubicacion}
                  </p>
                )}
              </div>
              {calificacion && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-aventurea-cream-2 px-3 py-1.5 text-[13px] font-bold text-aventurea-ink">
                  <IconStar className="h-4 w-4 text-aventurea-orange" />
                  {Number(calificacion.promedio).toFixed(1)}
                  <span className="font-semibold text-aventurea-ink-soft">
                    ({calificacion.total})
                  </span>
                </span>
              )}
            </div>

            {local.descripcion && (
              <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
                {local.descripcion}
              </p>
            )}

            {/* Qué se puede hacer acá */}
            <AccionesLocal
              ranchoId={local.id}
              nombre={local.nombre}
              whatsapp={local.contacto_whatsapp}
              opciones={opciones}
              tema="estandar"
            />

            {(hrefMaps || hrefWaze) && (
              <div className="mt-3 flex flex-wrap gap-2.5 text-[13px] font-bold">
                {hrefMaps && (
                  <a
                    href={hrefMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-aventurea-navy hover:text-aventurea-orange"
                  >
                    Cómo llegar (Maps) →
                  </a>
                )}
                {hrefWaze && (
                  <a
                    href={hrefWaze}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-aventurea-navy hover:text-aventurea-orange"
                  >
                    Waze →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* El menú */}
        <div className="mt-5">
          <h2 className="text-[19px] font-extrabold tracking-tight text-aventurea-ink">
            Menú
          </h2>

          {items.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-aventurea-line bg-white p-8 text-center">
              <p className="text-[14px] font-bold text-aventurea-ink">
                Este restaurante todavía no publicó su menú
              </p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
                Escribiles por el chat y te cuentan qué tienen hoy.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-6">
              {secciones.map(([seccion, platos]) => (
                <div key={seccion}>
                  <h3 className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange">
                    {seccion}
                  </h3>
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                    {platos.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-start gap-3.5 rounded-2xl border border-aventurea-line bg-white p-3.5"
                      >
                        {p.foto_url && (
                          <Image
                            src={p.foto_url}
                            alt={p.nombre}
                            width={64}
                            height={64}
                            className="h-16 w-16 shrink-0 rounded-xl object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-[14px] font-extrabold text-aventurea-ink">
                              {p.nombre}
                            </p>
                            {p.precio != null && (
                              <p className="shrink-0 text-[14px] font-black text-aventurea-ink">
                                ₡{Number(p.precio).toLocaleString("es-CR")}
                                {p.unidad && (
                                  <span className="ml-1 text-[11px] font-semibold text-aventurea-ink-soft">
                                    {p.unidad}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          {p.descripcion && (
                            <p className="mt-1 text-[12.5px] leading-snug text-aventurea-ink-soft">
                              {p.descripcion}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
