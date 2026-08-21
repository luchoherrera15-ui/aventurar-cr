import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAnonClient, createClient } from "@/lib/supabase/server";
import { hoyISOCR, TZ_CR } from "@/lib/fechas";
import { CRC, type FoodFranja, type FoodMenuCategory, type FoodMenuItem } from "@/lib/food/tipos";
import FoodHeader from "@/components/food/food-header";
import FoodFooter from "@/components/food/food-footer";
import FoodDemoBanner from "@/components/food/demo-banner";
import { IconCloche, IconPin, IconUtensils } from "@/components/icons";
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
    { data: sedes },
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
    anon
      .from("food_locations")
      .select("direccion")
      .eq("business_id", negocio.id)
      .limit(1),
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

  const direccion = sedes?.[0]?.direccion ?? null;
  const mejorDescuento = franjasVigentes.reduce(
    (max, f) => Math.max(max, f.descuento_porcentaje),
    0,
  );

  return (
    <>
      <FoodHeader />
      {negocio.es_demo && <FoodDemoBanner />}
      <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Hero comercial ───────────────────────────────────────────
          El nombre va SOBRE la foto (o sobre navy si no hay foto — el
          degradado navy garantiza contraste en los dos casos), con la
          dirección real de food_locations y el mejor % vigente como
          badge. La página debe leerse como una ficha de reserva, no
          como un detalle de CRUD. */}
      <div className="relative h-[250px] w-full overflow-hidden rounded-4xl bg-gradient-to-br from-aventurea-navy to-aventurea-navy-2 sm:h-[360px]">
        {negocio.foto_portada_url ? (
          <Image
            src={negocio.foto_portada_url}
            alt={negocio.nombre}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1180px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-white/25">
            <IconCloche className="h-16 w-16" />
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

        {mejorDescuento > 0 && (
          <span className="absolute right-4 top-4 rounded-xl bg-aventurea-orange px-3.5 py-2 text-white shadow-elevado sm:right-5 sm:top-5">
            <span className="block text-[9px] font-bold uppercase tracking-wide">Hasta</span>
            <span className="block text-[20px] font-extrabold leading-none">−{mejorDescuento}%</span>
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
          <h1 className="titulo text-[26px] leading-tight sm:text-[38px]">{negocio.nombre}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] font-bold text-white/85 sm:text-[13.5px]">
            {direccion && (
              <span className="flex items-center gap-1.5">
                <IconPin className="h-3.5 w-3.5 shrink-0" />
                {direccion}
              </span>
            )}
            {negocio.telefono && <span>📞 {negocio.telefono}</span>}
          </div>
        </div>
      </div>

      {negocio.descripcion && (
        <p className="mt-5 max-w-[640px] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
          {negocio.descripcion}
        </p>
      )}

      {/* ── Reserva + menú ───────────────────────────────────────────
          En desktop el panel de reserva vive fijo (sticky) a la
          derecha, como en cualquier ficha comercial de reserva; en
          móvil va PRIMERO (el aside está antes en el DOM), porque a
          eso vino el usuario — el menú es contexto, no la acción. */}
      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
        <aside className="rounded-3xl border border-aventurea-line bg-white p-5 shadow-flotante sm:p-6 lg:sticky lg:top-20 lg:order-2">
          <h2 className="titulo text-[19px] text-aventurea-navy">¿Cuándo querés ir?</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            El descuento es del horario, no del plato: se aplica a toda tu cuenta.
          </p>
          <div className="mt-4">
            <ReservarForm franjas={franjasVigentes} logueado={!!sesion} slug={slug} />
          </div>
        </aside>

      {(categorias ?? []).length > 0 && (
        <section className="lg:order-1">
          <h2 className="titulo text-[19px] text-aventurea-navy">Menú</h2>
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
      </div>
      </main>
      <FoodFooter />
    </>
  );
}
