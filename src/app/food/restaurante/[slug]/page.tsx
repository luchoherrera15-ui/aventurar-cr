import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAnonClient, createClient } from "@/lib/supabase/server";
import { hoyISOCR, TZ_CR } from "@/lib/fechas";
import { CRC, type FoodFranja, type FoodMenuCategory, type FoodMenuItem } from "@/lib/food/tipos";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import FoodDemoBanner from "@/components/food/demo-banner";
import { IconCloche, IconUtensils } from "@/components/icons";
import ReservarForm from "./reservar-form";

export const revalidate = 30;

/** La hora de ahora en Costa Rica, "HH:MM:SS" — para comparar contra `food_franjas.hora`. */
function horaActualCR(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ_CR,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const anon = createAnonClient();
  const { data } = await anon
    .from("food_businesses")
    .select("nombre, descripcion, foto_portada_url, es_demo")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();
  if (!data) return { title: "Restaurante · FOOD.BOOKEA" };

  const descripcion =
    data.descripcion ?? `Reservá tu mesa en ${data.nombre} con descuento por horario, en FOOD.BOOKEA.`;
  return {
    title: `${data.nombre} · FOOD.BOOKEA`,
    description: descripcion,
    // La ficha de un restaurante se comparte por WhatsApp más que por
    // cualquier otro lado — sin la foto en el Open Graph, el enlace
    // sale como una línea de texto gris (mismo criterio que
    // /restaurantes/[slug]/page.tsx).
    openGraph: {
      title: data.nombre,
      description: descripcion,
      type: "website",
      images: data.foto_portada_url ? [data.foto_portada_url] : undefined,
    },
    // Un negocio demo (0193) no es real: no queremos que Google lo
    // indexe aunque se comparta el enlace directo.
    robots: data.es_demo ? { index: false } : undefined,
  };
}

export default async function RestauranteFoodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const anon = createAnonClient();

  const { data: negocio } = await anon
    .from("food_businesses")
    .select("id, nombre, descripcion, foto_portada_url, telefono, es_demo")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();

  if (!negocio) notFound();

  // hoyISOCR(), no `new Date().toISOString()`: el servidor corre en
  // UTC, así que entre las 6pm y medianoche hora de Costa Rica esa
  // expresión ya daba la fecha de "mañana" — la cena entera
  // desaparecía del listado justo en la hora pico. Ver src/lib/fechas.ts.
  const hoy = hoyISOCR();
  const horaAhora = horaActualCR();

  const [
    { data: categorias, error: errCategorias },
    { data: items, error: errItems },
    { data: franjas, error: errFranjas },
    sesion,
  ] = await Promise.all([
    anon
      .from("food_menu_categories")
      .select("id, nombre, orden")
      .eq("business_id", negocio.id)
      .order("orden"),
    anon
      .from("food_menu_items")
      .select("id, category_id, nombre, descripcion, precio, foto_url, activo, orden")
      .eq("business_id", negocio.id)
      .eq("activo", true)
      .order("orden"),
    anon
      .from("food_franjas")
      .select("id, business_id, location_id, fecha, hora, capacidad, reservado, descuento_porcentaje")
      .eq("business_id", negocio.id)
      .eq("activa", true)
      .gte("fecha", hoy)
      .order("fecha")
      .order("hora"),
    (async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    })(),
  ]);

  if (errCategorias || errItems || errFranjas) {
    console.error(
      "[food/restaurante] no se pudo cargar todo:",
      errCategorias?.message, errItems?.message, errFranjas?.message,
    );
  }

  // Franjas de HOY cuya hora ya pasó: se descartan acá, ANTES de que
  // el cliente pueda elegirlas. El RPC (0191) las rechaza igual si de
  // algún modo llegara el intento, pero mostrarlas como "disponibles"
  // hasta que el servidor las rebota es un callejón sin salida que se
  // repite todos los días a la hora del almuerzo.
  const franjasVigentes = ((franjas ?? []) as FoodFranja[]).filter(
    (f) => f.fecha !== hoy || f.hora >= horaAhora,
  );

  const itemsPorCategoria = new Map<string, FoodMenuItem[]>();
  for (const it of (items ?? []) as FoodMenuItem[]) {
    const lista = itemsPorCategoria.get(it.category_id) ?? [];
    lista.push(it);
    itemsPorCategoria.set(it.category_id, lista);
  }

  return (
    <>
      <SiteHeader breadcrumb="FOOD.BOOKEA" />
      {negocio.es_demo && <FoodDemoBanner />}
      <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-3xl bg-aventurea-blue-light">
        {negocio.foto_portada_url ? (
          <Image
            src={negocio.foto_portada_url}
            alt={negocio.nombre}
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

      <h1 className="mt-5 text-2xl font-bold text-aventurea-ink sm:text-3xl">{negocio.nombre}</h1>
      {negocio.descripcion && (
        <p className="mt-2 max-w-[600px] text-[14px] text-aventurea-ink-soft">{negocio.descripcion}</p>
      )}
      {negocio.telefono && (
        <p className="mt-1 text-[13px] text-aventurea-ink-soft">📞 {negocio.telefono}</p>
      )}

      <section className="mt-8">
        <h2 className="text-[17px] font-bold text-aventurea-ink">Reservá tu horario</h2>
        <p className="mt-1 text-[13px] text-aventurea-ink-soft">
          El descuento es del horario, no del plato: se aplica a toda tu cuenta.
        </p>
        <div className="mt-4">
          <ReservarForm franjas={franjasVigentes} logueado={!!sesion} slug={slug} />
        </div>
      </section>

      {(categorias ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="text-[17px] font-bold text-aventurea-ink">Menú</h2>
          <div className="mt-4 flex flex-col gap-6">
            {(categorias as FoodMenuCategory[]).map((cat) => {
              const lista = itemsPorCategoria.get(cat.id) ?? [];
              if (lista.length === 0) return null;
              return (
                <div key={cat.id}>
                  <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    {cat.nombre}
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {lista.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-start gap-3 rounded-xl border border-aventurea-line bg-white p-3.5"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-aventurea-blue-light">
                          {it.foto_url ? (
                            <Image
                              src={it.foto_url}
                              alt={it.nombre}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-aventurea-navy/40">
                              <IconUtensils className="h-5 w-5" />
                            </span>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-aventurea-ink">{it.nombre}</p>
                            {it.descripcion && (
                              <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">{it.descripcion}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-[14px] font-bold text-aventurea-ink">
                            {CRC.format(it.precio)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
      </main>
      <SiteFooter />
    </>
  );
}
