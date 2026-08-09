import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/server";
import { enConfiguracion, type Rancho } from "@/app/mi-negocio/types";
import {
  IconCalendarLine,
  IconChevronLeft,
  IconClock,
  IconHouse,
} from "@/components/icons";

/**
 * /publicar/ejemplos — a donde lleva "Ver cómo se ve mi página" desde
 * el hero de /publicar.
 *
 * Tres tarjetas (Citas, Eventos, Hospedajes) y nada más: cada una es
 * un marco de navegador con la foto de portada de un negocio REAL y
 * publicado de esa vertical, y el link abre esa misma página. No hay
 * maqueta inventada — lo que se promete acá es exactamente lo que el
 * dueño va a poder abrir.
 *
 * Si una vertical no tiene ningún negocio publicado (hoy, Hospedajes)
 * la tarjeta cae sola al estado "Muy pronto" y en vez del ejemplo
 * ofrece anotarse. Ese estado sale de los datos, no de una bandera:
 * el día que se apruebe el primer hospedaje la tarjeta se enciende
 * sin tocar código.
 */

const NAVY_PROFUNDO = "#0a1226";
const NARANJA = "#ee7420";

/**
 * La página se ve idéntica para todo el mundo —tres negocios públicos
 * y aprobados—, así que se lee con el cliente SIN cookies y queda
 * cacheada en el borde una hora (ver createAnonClient en
 * lib/supabase/server.ts: un solo `cookies()` la volvería dinámica y
 * la CDN respondería MISS siempre).
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Así se ve tu página",
  description:
    "Ejemplos reales de páginas hechas con Bookea: citas, eventos y hospedajes. La misma página que va a ver tu cliente, con fotos, precios y botón de reservar.",
};

type Vertical = "citas" | "eventos" | "hospedajes";

type Ejemplo = Pick<
  Rancho,
  "slug" | "nombre" | "foto_url" | "canton" | "provincia" | "detalles"
> & { vertical: Vertical | null };

const TARJETAS: {
  vertical: Vertical;
  titulo: string;
  pie: string;
  gancho: string;
  acento: string;
  icono: React.ReactNode;
  /** El ejemplo preferido de esa vertical, si sigue publicado. */
  preferido: string;
  /** Qué ofrecer cuando esa vertical todavía no tiene ninguno. */
  ctaVacio: string;
}[] = [
  {
    vertical: "citas",
    titulo: "Citas",
    pie: "Reservan una hora",
    gancho:
      "Tus servicios con precio y duración, tu equipo y las horas que tenés libres. El cliente elige y la cita queda confirmada.",
    acento: "#5b9bdd",
    icono: <IconClock />,
    preferido: "demo-salon-elegance-cr",
    ctaVacio: "Publicar mi negocio",
  },
  {
    vertical: "eventos",
    titulo: "Eventos",
    pie: "Reservan una fecha",
    gancho:
      "Galería, paquetes y calendario de disponibilidad. El cliente aparta la fecha y deja el depósito con su comprobante.",
    acento: NARANJA,
    icono: <IconCalendarLine />,
    preferido: "rancholastorres",
    ctaVacio: "Publicar mi negocio",
  },
  {
    vertical: "hospedajes",
    titulo: "Hospedajes",
    pie: "Reservan una estadía",
    gancho:
      "Fotos, precio por noche y calendario por temporada. El cliente elige las noches y reserva la estadía directo con vos.",
    acento: "#8aa0d6",
    icono: <IconHouse />,
    preferido: "",
    ctaVacio: "Anotar mi propiedad",
  },
];

/** Citas vive bajo /citas/<slug>; el resto de las verticales, en la raíz. */
function hrefNegocio(vertical: Vertical, slug: string) {
  return vertical === "citas" ? `/citas/${slug}` : `/${slug}`;
}

export default async function EjemplosPage() {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("ranchos")
    .select("slug, nombre, vertical, foto_url, canton, provincia, detalles")
    .eq("estado", "aprobado")
    .in("vertical", ["citas", "eventos", "hospedajes"])
    .not("slug", "is", null);

  // Sirve de ejemplo solo lo que un desconocido podría abrir hoy: con
  // slug, con foto de portada y fuera del modo "en configuración" (esa
  // publicación se ve en el directorio pero no se puede entrar).
  const publicables = ((data ?? []) as Ejemplo[]).filter(
    (n) => n.slug && n.foto_url && !enConfiguracion(n.detalles),
  );

  const ejemploDe = (vertical: Vertical, preferido: string) =>
    publicables.find((n) => n.vertical === vertical && n.slug === preferido) ??
    publicables.find((n) => n.vertical === vertical) ??
    null;

  return (
    <main
      className="flex min-h-svh flex-col px-5 py-10 sm:px-8 sm:py-14"
      style={{ background: NAVY_PROFUNDO, color: "#ffffff" }}
    >
      {/* `w-full max-w-…` y no `w-[min(1120px,Nvw)]`: el vw no descuenta
          el px-5 de <main>, y en un teléfono de 390 px eso desbordaba
          la página a lo ancho (el texto quedaba cortado a la derecha). */}
      <div className="mx-auto w-full max-w-[1120px]">
        <Link
          href="/publicar"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-white/45 transition-colors hover:text-white"
        >
          <IconChevronLeft className="h-3.5 w-3.5" />
          Bookea para negocios
        </Link>
      </div>

      <section className="relative flex flex-1 flex-col justify-center py-14 sm:py-20">
        {/* El resplandor va como radial-gradient y no como círculo con
            blur: el círculo tenía que vivir dentro de un overflow-hidden
            que le cortaba el halo, y en pantallas angostas ese corte se
            veía como un rectángulo más claro. El degradado se apaga solo. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
          style={{
            background:
              "radial-gradient(62% 64% at 50% 0%, rgba(238,116,32,.20), rgba(10,18,38,0) 72%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-[1120px]">
          <div className="mx-auto max-w-[46ch] text-center">
            <p
              className="text-[11.5px] font-bold uppercase tracking-[0.24em]"
              style={{ color: NARANJA }}
            >
              Ejemplos en vivo
            </p>
            <h1 className="titulo mt-5 text-balance text-[clamp(34px,5.6vw,60px)] leading-[1.05]">
              Así se ve tu página
            </h1>
            <p className="mx-auto mt-5 max-w-[42ch] text-balance text-[15px] leading-relaxed text-white/55">
              Elegí el tipo de negocio y abrí una página publicada de
              verdad — la misma que va a ver tu cliente cuando le pasés tu
              enlace.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TARJETAS.map((t, i) => (
              <TarjetaVertical
                key={t.vertical}
                {...t}
                indice={i}
                ejemplo={ejemploDe(t.vertical, t.preferido)}
              />
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link
              href="/mi-negocio/nuevo"
              className="inline-flex rounded-full px-8 py-3.5 text-[14.5px] font-bold text-white transition-transform hover:scale-[1.03]"
              style={{ background: NARANJA }}
            >
              Crear la mía gratis
            </Link>
            <p className="mt-4 text-[12.5px] font-semibold text-white/40">
              Gratis · sin tarjeta · tu enlace listo el mismo día
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------- Piezas de la página ---------- */

function TarjetaVertical({
  vertical,
  titulo,
  pie,
  gancho,
  acento,
  icono,
  ctaVacio,
  indice,
  ejemplo,
}: {
  vertical: Vertical;
  titulo: string;
  pie: string;
  gancho: string;
  acento: string;
  icono: React.ReactNode;
  ctaVacio: string;
  indice: number;
  ejemplo: Ejemplo | null;
}) {
  // Sin ejemplo publicado la tarjeta no lleva a ningún lado: invita a
  // ser el primero de esa vertical.
  const href = ejemplo?.slug
    ? hrefNegocio(vertical, ejemplo.slug)
    : "/mi-negocio/nuevo";
  const ubicacion = ejemplo
    ? [ejemplo.canton, ejemplo.provincia].filter(Boolean).join(", ")
    : "";
  // Los negocios sembrados llevan el prefijo "demo-" y el sitio ya les
  // pinta el badge Demo adentro: la tarjeta lo dice antes de entrar en
  // vez de dejar que la persona lo descubra al abrir.
  const esDemo = !!ejemplo?.slug?.startsWith("demo-");

  return (
    <Link
      href={href}
      // El ejemplo se abre en otra pestaña: quien está evaluando
      // publicar viene a mirar y vuelve, no quiere perder la landing.
      // El link de "anotarse" sí navega normal — ahí sí se va.
      target={ejemplo ? "_blank" : undefined}
      rel={ejemplo ? "noopener" : undefined}
      className="anim-ejemplos-entrar group flex flex-col rounded-[26px] border border-white/12 p-3 transition-[transform,border-color,background-color] duration-300 hover:-translate-y-1.5 hover:border-white/30"
      style={
        {
          "--pub-delay": `${indice * 110}ms`,
          background: "rgba(255,255,255,.028)",
        } as React.CSSProperties
      }
    >
      {/* Marco de navegador: la barra de arriba con la URL de verdad es
          lo que responde la pregunta ("¿cómo se ve MI página?"). */}
      <div
        className="overflow-hidden rounded-[18px]"
        style={{ background: "#060c1a", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}
      >
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <span aria-hidden className="flex shrink-0 gap-1.5">
            {[0, 1, 2].map((p) => (
              <i key={p} className="block h-[6px] w-[6px] rounded-full bg-white/15" />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md px-2.5 py-1 text-[10px] font-semibold text-white/40" style={{ background: "rgba(255,255,255,.05)" }}>
            bookea.lat{ejemplo?.slug ? hrefNegocio(vertical, ejemplo.slug) : "/tu-negocio"}
          </span>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden">
          {ejemplo?.foto_url ? (
            <>
              <Image
                src={ejemplo.foto_url}
                alt={`Página de ${ejemplo.nombre} en Bookea`}
                fill
                // La primera tarjeta es el elemento más grande sobre el
                // pliegue en escritorio: sin esto sale con loading=lazy.
                loading={indice === 0 ? "eager" : undefined}
                fetchPriority={indice === 0 ? "high" : undefined}
                sizes="(max-width: 640px) 88vw, (max-width: 1024px) 44vw, 330px"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
              />
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-2/5"
                style={{ background: "linear-gradient(to top, rgba(6,12,26,.88), transparent)" }}
              />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-extrabold leading-tight text-white">
                    {ejemplo.nombre}
                  </span>
                  {ubicacion && (
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/55">
                      {ubicacion}
                    </span>
                  )}
                </span>
                <span
                  className="shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-extrabold text-white"
                  style={{ background: acento }}
                >
                  Reservar
                </span>
              </span>
            </>
          ) : (
            <span
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{
                background: `radial-gradient(120% 85% at 50% 15%, ${acento}22, rgba(6,12,26,0) 72%)`,
              }}
            >
              <span
                className="anim-publicar-flotar text-white/15 [&_svg]:h-14 [&_svg]:w-14"
                aria-hidden
              >
                {icono}
              </span>
              <span
                className="rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide"
                style={{ background: `${acento}26`, color: acento }}
              >
                Muy pronto
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-1 pt-6">
        <h2 className="flex items-center gap-2.5 text-[19px] font-extrabold leading-none tracking-[-0.02em] text-white">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: acento }} />
          {titulo}
        </h2>
        <p className="mt-1.5 pl-[18px] text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/35">
          {pie}
        </p>
        <p className="mt-4 text-[13.5px] leading-relaxed text-white/55">{gancho}</p>

        <span className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-[13px] font-extrabold">
          <span style={{ color: acento }}>
            {ejemplo ? "Ver el ejemplo" : ctaVacio}
            <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </span>
          <span className="shrink-0 text-[11.5px] font-semibold text-white/30">
            {!ejemplo ? "Sé el primero" : esDemo ? "Página de muestra" : "Negocio real"}
          </span>
        </span>
      </div>
    </Link>
  );
}
