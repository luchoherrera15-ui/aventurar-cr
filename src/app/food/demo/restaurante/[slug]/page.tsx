import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  CRC_DEMO,
  horaBonita,
  mejorDescuento,
  precioSimbolo,
} from "@/lib/food/demo/tipos";
import { RESTAURANTES_DEMO, restauranteDemoPorSlug } from "@/lib/food/demo/datos";
import ReservaWidget from "@/components/food/demo/reserva-widget";
import { IconPin, IconStar } from "@/components/icons";

/**
 * La ficha de un restaurante de la DEMO — todo sale del set estático
 * (src/lib/food/demo/datos), así que las 45 fichas se prerenderizan y
 * la navegación en una reunión de venta es instantánea. El noindex
 * viene del layout del segmento demo.
 */

export function generateStaticParams() {
  return RESTAURANTES_DEMO.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = restauranteDemoPorSlug(slug);
  if (!r) return { title: "Restaurante · Demo FOOD.BOOKEA" };
  return {
    title: `${r.nombre} · Demo FOOD.BOOKEA`,
    description: r.descripcion,
  };
}

const POLITICAS = [
  "El descuento del horario aplica sobre el consumo total de la mesa.",
  "Llegá 10 minutos antes — la mesa se libera pasados 15 minutos de la hora reservada.",
  "Cancelación sin costo hasta 2 horas antes de la reserva.",
];

export default async function RestauranteDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ hora?: string }>;
}) {
  const [{ slug }, { hora }] = await Promise.all([params, searchParams]);
  const r = restauranteDemoPorSlug(slug);
  if (!r) notFound();

  const descuento = mejorDescuento(r);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Hero + galería ─────────────────────────────────────────── */}
      <div className="grid gap-2 lg:h-[420px] lg:grid-cols-[2fr_1fr]">
        <div className="relative h-[240px] overflow-hidden rounded-3xl bg-aventurea-blue-light sm:h-[340px] lg:h-full lg:rounded-l-4xl lg:rounded-r-none">
          <Image
            src={r.fotoPrincipal}
            alt={r.nombre}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 780px"
            className="object-cover"
          />
          {descuento > 0 && (
            <span className="absolute right-4 top-4 rounded-xl bg-aventurea-orange px-3.5 py-2 text-white shadow-elevado">
              <span className="block text-[9px] font-bold uppercase tracking-wide">Hasta</span>
              <span className="block text-[20px] font-extrabold leading-none">−{descuento}%</span>
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {r.galeria.slice(0, 2).map((foto, i) => (
            <div
              key={foto}
              className={`relative h-[120px] overflow-hidden bg-aventurea-blue-light sm:h-[160px] lg:h-full ${
                i === 0 ? "rounded-2xl lg:rounded-none lg:rounded-tr-4xl" : "rounded-2xl lg:rounded-none lg:rounded-br-4xl"
              }`}
            >
              <Image
                src={foto}
                alt={`${r.nombre} — galería`}
                fill
                sizes="(max-width: 1024px) 45vw, 390px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="titulo flex flex-wrap items-center gap-x-3 text-[26px] leading-tight text-aventurea-navy sm:text-[34px]">
            {r.nombre}
            {r.esNuevo && (
              <span className="rounded-full bg-aventurea-orange-light px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-aventurea-orange-dark">
                Nuevo
              </span>
            )}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] font-bold text-aventurea-ink-soft">
            <span className="flex items-center gap-1 text-aventurea-ink">
              <IconStar className="h-4 w-4 text-amber-500" />
              {r.rating.toFixed(1)}
              <span className="font-bold text-aventurea-ink-soft">({r.resenas} reseñas)</span>
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <IconPin className="h-3.5 w-3.5 text-aventurea-navy" />
              {r.zona}
            </span>
            <span aria-hidden>·</span>
            <span>{r.cocina}</span>
            <span aria-hidden>·</span>
            <span>{precioSimbolo(r.precioNivel)}</span>
          </p>
        </div>
      </div>

      <p className="mt-4 max-w-[640px] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
        {r.descripcion}
      </p>

      {/* ── Reserva + detalle ──────────────────────────────────────── */}
      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
        <aside className="rounded-3xl border border-aventurea-line bg-white p-5 shadow-flotante sm:p-6 lg:sticky lg:top-20 lg:order-2">
          <h2 className="titulo text-[19px] text-aventurea-navy">¿Cuándo querés ir?</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            El descuento es del horario, no del plato: se aplica a toda tu cuenta.
          </p>
          <div className="mt-4">
            <ReservaWidget r={r} horaInicial={hora} />
          </div>
        </aside>

        <div className="flex flex-col gap-8 lg:order-1">
          {/* Menú — el sustento del "precio promedio por persona" que
              usan la card y el widget de reserva. */}
          <section id="menu" className="scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="titulo text-[19px] text-aventurea-navy">Menú</h2>
              <p className="text-[12px] font-bold text-aventurea-ink-soft">
                Consumo promedio por persona: {CRC_DEMO.format(r.precioPromedio)}
              </p>
            </div>
            <ul className="mt-3.5 flex flex-col gap-2.5">
              {r.menu.map((plato) => (
                <li
                  key={plato.nombre}
                  className="flex items-center gap-3.5 rounded-2xl border border-aventurea-line bg-white p-3"
                >
                  <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-aventurea-blue-light">
                    <Image
                      src={plato.foto}
                      alt={plato.nombre}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-extrabold text-aventurea-ink">
                      {plato.nombre}
                    </span>
                    {plato.descripcion && (
                      <span className="mt-0.5 block text-[12px] leading-snug text-aventurea-ink-soft">
                        {plato.descripcion}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[14px] font-extrabold text-aventurea-navy">
                    {CRC_DEMO.format(plato.precio)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Promociones por horario */}
          <section>
            <h2 className="titulo text-[19px] text-aventurea-navy">Promociones por horario</h2>
            <p className="mt-1 text-[13px] text-aventurea-ink-soft">
              Entre más lejos de la hora pico, mejor el descuento.
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {r.promociones.map((p) => (
                <span
                  key={p.hora}
                  className={`rounded-xl border px-3 py-2 text-[13px] font-bold ${
                    p.descuento === descuento
                      ? "border-aventurea-orange/40 bg-aventurea-orange-light text-aventurea-ink"
                      : "border-aventurea-line bg-white text-aventurea-ink"
                  }`}
                >
                  {horaBonita(p.hora)}
                  <span className="ml-1.5 text-aventurea-orange-dark">−{p.descuento}%</span>
                </span>
              ))}
            </div>
          </section>

          {/* Información */}
          <section>
            <h2 className="titulo text-[19px] text-aventurea-navy">Información</h2>
            <dl className="mt-3.5 grid gap-x-8 gap-y-3 text-[13.5px] sm:grid-cols-2">
              <div>
                <dt className="font-extrabold uppercase tracking-wide text-[11px] text-aventurea-ink-soft">
                  Dirección
                </dt>
                <dd className="mt-0.5 text-aventurea-ink">
                  {r.direccion}, {r.zona}
                </dd>
              </div>
              <div>
                <dt className="font-extrabold uppercase tracking-wide text-[11px] text-aventurea-ink-soft">
                  Teléfono
                </dt>
                <dd className="mt-0.5 text-aventurea-ink">{r.telefono}</dd>
              </div>
              <div>
                <dt className="font-extrabold uppercase tracking-wide text-[11px] text-aventurea-ink-soft">
                  Horario
                </dt>
                <dd className="mt-0.5 text-aventurea-ink">{r.horario}</dd>
              </div>
              <div>
                <dt className="font-extrabold uppercase tracking-wide text-[11px] text-aventurea-ink-soft">
                  Cocina
                </dt>
                <dd className="mt-0.5 text-aventurea-ink">
                  {r.categoria} · {r.cocina}
                </dd>
              </div>
            </dl>
          </section>

          {/* Políticas */}
          <section>
            <h2 className="titulo text-[19px] text-aventurea-navy">Políticas de reserva</h2>
            <ul className="mt-3.5 flex flex-col gap-2">
              {POLITICAS.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-aventurea-orange" />
                  {p}
                </li>
              ))}
            </ul>
          </section>

          {/* Galería completa */}
          {r.galeria.length > 0 && (
            <section>
              <h2 className="titulo text-[19px] text-aventurea-navy">Galería</h2>
              <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[r.fotoPrincipal, ...r.galeria].map((foto) => (
                  <div key={foto} className="relative h-[130px] overflow-hidden rounded-2xl bg-aventurea-blue-light sm:h-[160px]">
                    <Image
                      src={foto}
                      alt={`${r.nombre} — galería`}
                      fill
                      sizes="(max-width: 640px) 45vw, 250px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
