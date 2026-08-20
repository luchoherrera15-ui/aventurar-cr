import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/server";
import { hoyISOCR } from "@/lib/fechas";
import { fechaCorta, horaCorta, type FoodBusiness, type FoodFranja } from "@/lib/food/tipos";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import FoodDemoBanner from "@/components/food/demo-banner";
import {
  IconCheck,
  IconClock,
  IconCloche,
  IconCompass,
  IconGorroChef,
  IconHamburguesa,
  IconParrilla,
  IconPasta,
  IconPin,
  IconSushi,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Demo · FOOD.BOOKEA",
  description:
    "Un recorrido de ejemplo por FOOD.BOOKEA: restaurantes, menús y franjas horarias con descuento — todo de mentira, para mostrar cómo funciona el producto.",
  // Puramente demostrativo: nunca queremos que esto salga en Google.
  robots: { index: false },
};

// Cada restaurante demo se sembró con un tipo de cocina fijo
// (scripts/seed-food-demo.mjs) — acá solo se mapea a la etiqueta y al
// ícono que lo representan en esta vista. Si el seed cambia de
// restaurantes, este mapa se actualiza junto con él.
const COCINA_POR_SLUG: Record<string, { etiqueta: string; Icono: typeof IconCloche }> = {
  "demo-la-parrilla-del-barrio": { etiqueta: "Parrilla · Carnes", Icono: IconParrilla },
  "demo-sushi-koji": { etiqueta: "Japonesa · Sushi", Icono: IconSushi },
  "demo-trattoria-nonna": { etiqueta: "Italiana · Pastas", Icono: IconPasta },
  "demo-cuadra-burger": { etiqueta: "Hamburguesas", Icono: IconHamburguesa },
  "demo-fogon-del-chef": { etiqueta: "Cocina de autor", Icono: IconGorroChef },
};

const CATEGORIAS = [
  { etiqueta: "Todas", Icono: IconCompass },
  { etiqueta: "Carnes", Icono: IconParrilla },
  { etiqueta: "Sushi", Icono: IconSushi },
  { etiqueta: "Pastas", Icono: IconPasta },
  { etiqueta: "Hamburguesas", Icono: IconHamburguesa },
  { etiqueta: "Cocina de autor", Icono: IconGorroChef },
];

const CIUDADES = [
  { archivo: "ciudad-cdmx.jpg", nombre: "Ciudad de México", pais: "México" },
  { archivo: "ciudad-buenosaires.jpg", nombre: "Buenos Aires", pais: "Argentina" },
  { archivo: "ciudad-santiago.jpg", nombre: "Santiago", pais: "Chile" },
  { archivo: "ciudad-saopaulo.jpg", nombre: "São Paulo", pais: "Brasil" },
  { archivo: "ciudad-bogota.jpg", nombre: "Bogotá", pais: "Colombia" },
  { archivo: "ciudad-lima.jpg", nombre: "Lima", pais: "Perú" },
];

const PASOS = [
  {
    numero: "01",
    titulo: "Elegí un restaurante",
    texto: "Mirá el menú y la foto antes de decidir — igual que en el producto real.",
  },
  {
    numero: "02",
    titulo: "Elegí un horario",
    texto: "Cada franja tiene su propio descuento: entre más lejos de la hora pico, mejor precio.",
  },
  {
    numero: "03",
    titulo: "Así se confirma",
    texto: "El mismo flujo de reserva real, pero acá no crea ninguna reserva de verdad.",
  },
];

/**
 * /food/demo — EL SHOWCASE DE FOOD.BOOKEA (0193).
 *
 * Es una vista distinta sobre los mismos datos y componentes de FOOD:
 * mismo `createAnonClient`, mismos tipos (`src/lib/food/tipos.ts`),
 * misma ficha (`/food/restaurante/[slug]`) para entrar a un
 * restaurante — la única diferencia es el filtro `es_demo = true` y el
 * banner permanente de `FoodDemoBanner`. El directorio real (/food)
 * hace exactamente lo opuesto (`es_demo = false`, ver ese archivo).
 */
export default async function FoodDemoPage() {
  const supabase = createAnonClient();
  const hoy = hoyISOCR();

  const { data: negociosData, error: errNegocios } = await supabase
    .from("food_businesses")
    .select("id, nombre, slug, descripcion, foto_portada_url")
    .eq("activo", true)
    .eq("es_demo", true)
    .order("nombre");

  if (errNegocios) console.error("[food/demo] no se pudo cargar los negocios demo:", errNegocios.message);

  const negocios = (negociosData ?? []) as Pick<
    FoodBusiness,
    "id" | "nombre" | "slug" | "descripcion" | "foto_portada_url"
  >[];
  const negocioIds = negocios.map((n) => n.id);

  const { data: franjasData } =
    negocioIds.length === 0
      ? { data: [] as FoodFranja[] }
      : await supabase
          .from("food_franjas")
          .select("id, business_id, location_id, fecha, hora, capacidad, reservado, descuento_porcentaje")
          .in("business_id", negocioIds)
          .eq("activa", true)
          .gte("fecha", hoy)
          .order("fecha")
          .order("hora");

  const franjasPorNegocio = new Map<string, FoodFranja[]>();
  for (const f of (franjasData ?? []) as FoodFranja[]) {
    const lista = franjasPorNegocio.get(f.business_id) ?? [];
    lista.push(f);
    franjasPorNegocio.set(f.business_id, lista);
  }

  // La mejor franja de todas — la que ancla la burbuja de descuento y
  // la tarjeta del hero, para que ese número también salga de la base
  // en vez de estar escrito a mano.
  let mejorNegocio: (typeof negocios)[number] | null = null;
  let mejorFranja: FoodFranja | null = null;
  for (const n of negocios) {
    for (const f of franjasPorNegocio.get(n.id) ?? []) {
      if (!mejorFranja || f.descuento_porcentaje > mejorFranja.descuento_porcentaje) {
        mejorFranja = f;
        mejorNegocio = n;
      }
    }
  }

  return (
    <>
      <SiteHeader breadcrumb="FOOD.BOOKEA — Demo" />
      <FoodDemoBanner />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-aventurea-surface">
        <div className="mx-auto grid max-w-[1100px] items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:py-14">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-aventurea-orange">
              <span className="h-1.5 w-1.5 rounded-full bg-aventurea-orange" />
              Vista de ejemplo de FOOD.BOOKEA
            </p>
            <h1 className="mt-3 text-[38px] font-extrabold leading-[0.98] tracking-tight text-aventurea-navy sm:text-[52px]">
              Comé rico.
              <br />
              <span className="text-aventurea-orange">Pagá menos.</span>
            </h1>
            <p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-aventurea-ink-soft">
              Reservás una franja horaria y comés con descuento — entre
              antes o después de la hora pico reservés, mejor precio.
              Esto que ves acá es una muestra: restaurantes y menús de
              ejemplo para explicar el producto.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] font-bold text-aventurea-ink-soft">
              <span>✓ Sin pago anticipado</span>
              <span>✓ Hasta 50% OFF</span>
              <span>✓ Reservá en segundos</span>
            </div>
            <div className="mt-6">
              <Link
                href="/food"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-aventurea-navy px-5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
              >
                Ir al directorio real →
              </Link>
            </div>
          </div>

          <div className="relative h-[280px] sm:h-[360px] lg:h-[420px]">
            <div className="relative h-full w-full overflow-hidden rounded-[28px]">
              <Image
                src="/food-demo/hero.jpg"
                alt="Plato de ejemplo de FOOD.BOOKEA"
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 520px"
                className="object-cover"
              />
            </div>
            <div className="absolute -left-3 top-5 rounded-2xl bg-aventurea-orange px-4 py-2.5 text-white shadow-lg">
              <p className="text-[9px] font-bold uppercase tracking-wide">Hasta</p>
              <p className="text-[28px] font-extrabold leading-none">
                {mejorFranja ? mejorFranja.descuento_porcentaje : 40}%
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wide">OFF</p>
            </div>
            {mejorNegocio && mejorFranja && (
              <div className="absolute -bottom-4 left-4 min-w-[220px] rounded-2xl bg-white p-4 shadow-lg">
                <p className="text-[10px] text-aventurea-ink-soft">Oferta de ejemplo</p>
                <p className="mt-0.5 text-[15px] font-bold text-aventurea-ink">{mejorNegocio.nombre}</p>
                <p className="mt-0.5 text-[11.5px] font-bold text-aventurea-orange">
                  {mejorFranja.descuento_porcentaje}% OFF · {fechaCorta(mejorFranja.fecha)}{" "}
                  {horaCorta(mejorFranja.hora)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1100px] px-4 sm:px-6">
        {/* ── Ofertas ────────────────────────────────────────────── */}
        <section className="pt-14">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold text-aventurea-navy sm:text-[26px]">
                Ofertas de ejemplo
              </h2>
              <p className="mt-1 text-[13px] text-aventurea-ink-soft">
                El descuento cambia según la hora — así se ve en la práctica.
              </p>
            </div>
          </div>

          {negocios.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-12 text-center">
              <p className="text-[14px] font-bold text-aventurea-ink">
                Todavía no hay restaurantes de ejemplo sembrados.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {negocios.map((n) => {
                const franjas = (franjasPorNegocio.get(n.id) ?? []).slice(0, 2);
                const cocina = COCINA_POR_SLUG[n.slug];
                const mejorDescuento = franjas.reduce(
                  (max, f) => Math.max(max, f.descuento_porcentaje),
                  0,
                );
                return (
                  <Link
                    key={n.id}
                    href={`/food/restaurante/${n.slug}`}
                    className="overflow-hidden rounded-2xl border border-aventurea-line bg-white transition-shadow hover:shadow-lg"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-aventurea-blue-light">
                      {n.foto_portada_url ? (
                        <Image
                          src={n.foto_portada_url}
                          alt={n.nombre}
                          fill
                          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 366px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-aventurea-navy/40">
                          <IconCloche className="h-10 w-10" />
                        </span>
                      )}
                      {mejorDescuento > 0 && (
                        <span className="absolute left-2.5 top-2.5 rounded-lg bg-aventurea-orange px-2.5 py-1 text-[11px] font-extrabold text-white shadow">
                          -{mejorDescuento}%
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-[15px] font-bold text-aventurea-ink">{n.nombre}</p>
                      {cocina && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
                          <cocina.Icono className="h-3.5 w-3.5" />
                          {cocina.etiqueta}
                        </p>
                      )}
                      {franjas.length > 0 && (
                        <div className="mt-3 flex gap-1.5">
                          {franjas.map((f) => (
                            <span
                              key={f.id}
                              className="flex-1 rounded-lg bg-aventurea-cream-2 px-2 py-1.5 text-center text-[10.5px] font-bold text-aventurea-ink-soft"
                            >
                              {horaCorta(f.hora)} · -{f.descuento_porcentaje}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Categorías ─────────────────────────────────────────── */}
        <section className="pt-14">
          <h2 className="text-[22px] font-bold text-aventurea-navy sm:text-[26px]">
            Tipos de cocina en esta demo
          </h2>
          <div className="mt-5 flex gap-4 overflow-x-auto pb-1">
            {CATEGORIAS.map((c) => (
              <div key={c.etiqueta} className="flex min-w-[80px] flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-aventurea-line bg-aventurea-cream-2 text-aventurea-navy">
                  <c.Icono className="h-6 w-6" />
                </span>
                <p className="mt-1.5 text-[11px] font-bold text-aventurea-ink">{c.etiqueta}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Cómo funciona ──────────────────────────────────────── */}
        <section className="pt-14">
          <div className="rounded-[28px] bg-aventurea-navy px-6 py-8 text-white sm:px-9 sm:py-10">
            <h2 className="text-[24px] font-bold tracking-tight sm:text-[28px]">
              Así se recorre FOOD.BOOKEA
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {PASOS.map((p) => (
                <div key={p.numero} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[13px] font-extrabold">
                    {p.numero}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">{p.titulo}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/70">{p.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Ciudades ───────────────────────────────────────────── */}
        <section className="pt-14">
          <h2 className="text-[22px] font-bold text-aventurea-navy sm:text-[26px]">
            Ciudades donde queremos crecer
          </h2>
          <p className="mt-1 text-[13px] text-aventurea-ink-soft">
            FOOD.BOOKEA arranca en Costa Rica — esta demo también sirve
            para mostrar hacia dónde apunta el producto en la región.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CIUDADES.map((c) => (
              <div key={c.nombre} className="relative h-[130px] overflow-hidden rounded-2xl">
                <Image
                  src={`/food-demo/${c.archivo}`}
                  alt={c.nombre}
                  fill
                  sizes="(max-width: 640px) 45vw, 180px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute left-2.5 bottom-2 text-white">
                  <p className="text-[12px] font-bold leading-tight">{c.nombre}</p>
                  <p className="text-[9.5px] text-white/80">{c.pais}</p>
                </div>
                <span className="absolute right-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-aventurea-navy">
                  Próximamente
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Beneficios ─────────────────────────────────────────── */}
        <section className="py-14">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icono: IconCheck, titulo: "Descuentos reales", texto: "El % viaja congelado en cada reserva." },
              { Icono: IconClock, titulo: "Por franja horaria", texto: "Más lejos de la hora pico, mejor precio." },
              { Icono: IconPin, titulo: "Cerca tuyo", texto: "Pensado para que descubrás lugares nuevos." },
              { Icono: IconCompass, titulo: "Hecho para LATAM", texto: "Una experiencia pensada para crecer en la región." },
            ].map((b) => (
              <div key={b.titulo} className="bg-white p-5">
                <b.Icono className="h-5 w-5 text-aventurea-orange" />
                <p className="mt-2.5 text-[13px] font-bold text-aventurea-ink">{b.titulo}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-aventurea-ink-soft">{b.texto}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-aventurea-line bg-white p-6">
            <div>
              <p className="text-[15px] font-bold text-aventurea-ink">¿Tenés un restaurante de verdad?</p>
              <p className="mt-1 text-[13px] text-aventurea-ink-soft">
                Sumalo al directorio real de FOOD.BOOKEA — esta demo no
                reemplaza tu ficha, es solo para explicar el producto.
              </p>
            </div>
            <Link
              href="/food/negocio/nuevo"
              className="shrink-0 rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
            >
              Sumá tu restaurante
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
