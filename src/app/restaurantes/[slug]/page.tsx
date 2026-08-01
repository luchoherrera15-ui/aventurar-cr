import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { IconCloche, IconPin, IconStar, IconWhatsapp } from "@/components/icons";
import { linkGoogleMaps, linkWaze } from "@/app/mi-rancho/types";
import {
  CATEGORIA_RESTAURANTE_LABEL,
  RANGO_PRECIO_LABEL,
  normalizarCategoriaRestaurante,
  opcionesDeDetalles,
} from "../tipos";

type Local = {
  id: string;
  slug: string | null;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
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

type ItemMenu = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  unidad: string | null;
  grupo: string | null;
  foto_url: string | null;
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
    .select("nombre, descripcion")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return { title: "Restaurante" };
  return {
    title: data.nombre as string,
    description:
      (data.descripcion as string) ??
      `Mirá el menú de ${data.nombre} y reservá tu mesa en Bookea.`,
  };
}

/**
 * La ficha del restaurante: su menú por secciones, cómo llegar y qué
 * se puede hacer acá (reservar mesa, pedir para recoger o consultar
 * por el chat). La reserva de mesa con hora y el pedido llegan en la
 * siguiente entrega; por ahora todo desemboca en el chat, que ya
 * funciona.
 */
export default async function RestaurantePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("ranchos")
    .select(
      "id, slug, nombre, categoria, descripcion, provincia, canton, direccion_exacta, foto_url, precio_desde, contacto_whatsapp, latitud, longitud, detalles",
    )
    .eq("slug", slug)
    .eq("vertical", "restaurantes")
    .eq("estado", "aprobado")
    .maybeSingle();

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
  const secciones = new Map<string, ItemMenu[]>();
  for (const it of items) {
    const g = (it.grupo ?? "").trim() || "Menú";
    secciones.set(g, [...(secciones.get(g) ?? []), it]);
  }

  const categoria = normalizarCategoriaRestaurante(local.categoria);
  const { aceptaReservaMesa, aceptaPickup, rangoPrecio } = opcionesDeDetalles(
    local.detalles,
  );
  const ubicacion = [local.canton, local.provincia].filter(Boolean).join(", ");
  const senas = [local.direccion_exacta, ubicacion].filter(Boolean).join(", ");
  const hrefMaps = linkGoogleMaps(local.latitud, local.longitud, senas);
  const hrefWaze = linkWaze(local.latitud, local.longitud, senas);

  return (
    <div className="min-h-screen bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Restaurantes" />

      <section className="mx-auto max-w-[900px] px-4 pb-12 pt-4 sm:px-6">
        <Link
          href="/restaurantes"
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Todos los restaurantes
        </Link>

        {/* La portada */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-aventurea-line bg-white">
          <div className="relative aspect-[16/7] bg-aventurea-blue-light">
            {local.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
              <img
                src={local.foto_url}
                alt={local.nombre}
                className="h-full w-full object-cover"
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
                  {rangoPrecio ? ` · ${RANGO_PRECIO_LABEL[rangoPrecio]}` : ""}
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
              {calif && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-aventurea-cream-2 px-3 py-1.5 text-[13px] font-bold text-aventurea-ink">
                  <IconStar className="h-4 w-4 text-aventurea-orange" />
                  {Number(calif.promedio).toFixed(1)}
                  <span className="font-semibold text-aventurea-ink-soft">
                    ({calif.total})
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
            <div className="mt-5 flex flex-wrap gap-2.5">
              {aceptaReservaMesa && (
                <Link
                  href={`/mensajes/consulta/${local.id}`}
                  className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
                >
                  Reservar mesa
                </Link>
              )}
              {aceptaPickup && (
                <Link
                  href={`/mensajes/consulta/${local.id}`}
                  className="rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
                >
                  Pedir para recoger
                </Link>
              )}
              <Link
                href={`/mensajes/consulta/${local.id}`}
                className="rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
              >
                Escribirle al restaurante
              </Link>
              {local.contacto_whatsapp && (
                <a
                  href={`https://wa.me/${local.contacto_whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-green"
                >
                  <IconWhatsapp className="h-4 w-4 text-aventurea-green" /> WhatsApp
                </a>
              )}
            </div>

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
              {[...secciones.entries()].map(([seccion, platos]) => (
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
                          // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
                          <img
                            src={p.foto_url}
                            alt={p.nombre}
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
