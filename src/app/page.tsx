import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import RielProveedores from "@/components/riel-proveedores";
import type { Calificacion } from "@/components/rancho-card";
import type { Rancho } from "@/app/mi-negocio/types";
import {
  IconChatBubble,
  IconPalmera,
  IconStar,
  IconStopwatch,
  IconTagLine,
  IconWand,
} from "@/components/icons";

/**
 * El home de Bookea — el techo común de las verticales. Antes / era un
 * redirect directo a /eventos; ahora la portada muestra tres rieles con
 * negocios REALES (pedido del dueño): uno de Eventos, uno de Citas y el
 * de Hospedajes como "muy pronto".
 *
 * Cada riel muestra hasta 5 tarjetas, con el ancho achicado para que
 * las 5 quepan SIN scroll horizontal en desktop (en el teléfono se
 * desliza, como todo riel). El "Ver todo" de cada riel lleva a su
 * directorio.
 *
 * Quién sale acá: los destacados del admin primero y después los más
 * nuevos. A futuro este espacio será de pago (suscripción de
 * visibilidad por negocio) — POR AHORA es gratis para todos, así que no
 * hay ningún gate: solo el orden destacados → recientes.
 */

const TOPE_POR_RIEL = 5;

/** 5 tarjetas + 4 gaps de 14px caben en el contenedor de 1280 sin
 *  scroll (5×232 + 56 = 1216). */
const ANCHO_TARJETA_HOME = "clamp(200px, 42vw, 232px)";

const PROMESAS = [
  { Icono: IconStopwatch, texto: "Confirmación al instante" },
  { Icono: IconTagLine, texto: "Precios claros, en colones" },
  { Icono: IconChatBubble, texto: "Chat directo con el negocio" },
  { Icono: IconStar, texto: "Reseñas de clientes reales" },
] as const;

const PASOS = [
  {
    numero: "01",
    titulo: "Elegí",
    texto:
      "Compará opciones reales: fotos, precios en colones y reseñas de gente que ya reservó ahí.",
  },
  {
    numero: "02",
    titulo: "Reservá",
    texto:
      "Escogé la fecha o la hora y confirmá al instante. El depósito va por SINPE, sin vueltas.",
  },
  {
    numero: "03",
    titulo: "Llegá",
    texto:
      "La confirmación te cae al correo con todos los detalles — y el chat queda abierto por si querés preguntar algo.",
  },
] as const;

/** Destacados del admin primero (en su orden), después los más nuevos. */
function topDelVertical(negocios: Rancho[], vertical: string): Rancho[] {
  return negocios
    .filter((r) => (r.vertical ?? "eventos") === vertical)
    .sort(
      (a, b) =>
        (a.destacado_orden ?? Infinity) - (b.destacado_orden ?? Infinity) ||
        (a.created_at < b.created_at ? 1 : -1),
    )
    .slice(0, TOPE_POR_RIEL);
}

export default async function Home() {
  const supabase = await createClient();

  const [negociosRes, califRes, userRes] = await Promise.all([
    supabase
      .from("ranchos")
      .select("*")
      .eq("estado", "aprobado")
      .in("vertical", ["eventos", "citas"])
      .order("created_at", { ascending: false })
      .limit(120),
    supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
    supabase.auth.getUser(),
  ]);

  const negocios = (negociosRes.data ?? []) as Rancho[];
  const rielEventos = topDelVertical(negocios, "eventos");
  const rielCitas = topDelVertical(negocios, "citas");

  const calificaciones = new Map<string, Calificacion>(
    ((califRes.data ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );

  const user = userRes.data.user;
  let favoritosIds = new Set<string>();
  if (user) {
    const { data: favData } = await supabase
      .from("favoritos")
      .select("rancho_id")
      .eq("cliente_id", user.id);
    favoritosIds = new Set((favData ?? []).map((f) => f.rancho_id as string));
  }

  // Sin cálculo de disponibilidad en el home (eso es del directorio):
  // el chip "Libre ahora" simplemente no se muestra acá.
  const proximasLibres = new Map<string, string | null>();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <RevealOnScroll />
      <SiteHeader />

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="mx-auto max-w-[1280px] px-4 pt-12 sm:px-5 sm:pt-14">
          <p className="flex items-center justify-center gap-2 text-[11px] font-light uppercase tracking-[0.18em] text-aventurea-orange">
            <span aria-hidden className="block h-[1.5px] w-[18px] bg-aventurea-sky" />
            Reservas en Costa Rica
            <span aria-hidden className="block h-[1.5px] w-[18px] bg-aventurea-sky" />
          </p>
          <h1 className="titulo mx-auto mt-4 max-w-[16ch] text-center text-[38px] text-aventurea-ink sm:text-[54px]">
            ¿Qué vas a reservar hoy?
          </h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-center text-[14.5px] leading-relaxed text-aventurea-ink-soft sm:text-[15.5px]">
            El salón del evento, la cita de la semana o la próxima escapada:
            acá se compara con precios reales y se reserva al instante — sin
            cadenas de WhatsApp.
          </p>
        </section>

        {/* ---------- Los tres rieles ---------- */}
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pt-8 sm:px-5">
          <div data-reveal>
            <RielProveedores
              titulo="Todo para tu evento"
              subtitulo="Lugares, catering, música y decoración — reservá cada pieza de tu fiesta."
              items={rielEventos}
              verTodoHref="/eventos"
              calificaciones={calificaciones}
              proximasLibres={proximasLibres}
              favoritosIds={favoritosIds}
              sesionActiva={!!user}
              anchoTarjeta={ANCHO_TARJETA_HOME}
            />
          </div>

          <div data-reveal>
            <RielProveedores
              titulo="Cualquier servicio que necesités agendar"
              subtitulo="Belleza, barbería, uñas y spa — elegí la hora y con quién, y quedá confirmado al instante."
              items={rielCitas}
              verTodoHref="/citas"
              calificaciones={calificaciones}
              proximasLibres={proximasLibres}
              favoritosIds={favoritosIds}
              sesionActiva={!!user}
              anchoTarjeta={ANCHO_TARJETA_HOME}
            />
          </div>

          {/* Hospedajes: el riel que ya se anuncia pero todavía no
              tiene negocios — placeholder con la palmera de marca. */}
          <section data-reveal className="py-3">
            <h2 className="px-1 text-[21px] font-bold leading-tight tracking-tight text-aventurea-ink">
              Tu próxima escapada
            </h2>
            <div className="relative mt-3.5 flex flex-col gap-2 overflow-hidden rounded-2xl border border-aventurea-navy/10 bg-aventurea-blue-light p-6 sm:p-7">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-5 -top-6 rotate-[14deg] text-aventurea-navy/10 [&_svg]:h-36 [&_svg]:w-36"
              >
                <IconPalmera />
              </span>
              <span className="relative z-10 flex items-center gap-2.5 text-[21px] font-extrabold text-aventurea-ink">
                Hospedajes
                <span className="rounded-lg bg-aventurea-navy px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white">
                  Muy pronto
                </span>
              </span>
              <span className="relative z-10 max-w-[52ch] text-[13px] leading-snug text-aventurea-ink-soft">
                Escapadas y estadías frente al mar y la montaña — ya casi están
                acá.
              </span>
            </div>
          </section>

          {/* La promesa de la casa */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-aventurea-line pt-6 sm:grid-cols-4">
            {PROMESAS.map(({ Icono, texto }) => (
              <p
                key={texto}
                className="flex items-center justify-center gap-2 text-center text-[12px] font-bold text-aventurea-ink-soft"
              >
                <Icono className="h-4 w-4 shrink-0 text-aventurea-orange" />
                {texto}
              </p>
            ))}
          </div>
        </div>

        {/* ---------- Así de simple ---------- */}
        <section className="mx-auto max-w-[1280px] px-5 py-14 sm:py-16">
          <div data-reveal className="text-center">
            <p className="text-[11px] font-light uppercase tracking-[0.18em] text-aventurea-orange">
              Así funciona
            </p>
            <h2 className="titulo mt-2 text-[27px] text-aventurea-ink sm:text-[34px]">
              Reservar toma tres pasos
            </h2>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {PASOS.map(({ numero, titulo, texto }, i) => (
              <div
                key={numero}
                data-reveal
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
                className="bento bento-blanco p-6"
              >
                <p className="text-[13px] font-extrabold text-aventurea-orange">
                  {numero}
                </p>
                <h3 className="titulo mt-1.5 text-[19px] text-aventurea-ink">
                  {titulo}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  {texto}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Los dos extras: invitaciones y publicar ---------- */}
        <section className="mx-auto grid max-w-[1280px] gap-3 px-5 pb-16 sm:grid-cols-2">
          <div data-reveal className="bento bento-azul flex flex-col items-start p-7 sm:p-9">
            <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              <IconWand className="h-4 w-4" /> El complemento del evento
            </p>
            <h2 className="titulo mt-3 text-[24px] text-aventurea-ink sm:text-[28px]">
              Invitaciones digitales
            </h2>
            <p className="mt-2.5 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Invitaciones animadas con confirmación de invitados, recordatorios
              automáticos y un álbum de fotos con QR para el gran día.
            </p>
            <Link href="/invitaciones" className="btn-contorno mt-6">
              Ver las invitaciones
            </Link>
          </div>

          <div
            data-reveal
            style={{ "--reveal-delay": "90ms" } as React.CSSProperties}
            className="bento bento-navy flex flex-col items-start p-7 sm:p-9"
          >
            <span aria-hidden className="bento-orbe -right-16 -top-20" />
            <p className="relative text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              ¿Tenés un negocio?
            </p>
            <h2 className="titulo relative mt-3 text-[24px] text-white sm:text-[28px]">
              Publicalo gratis en Bookea
            </h2>
            <p className="relative mt-2.5 max-w-[44ch] text-[13.5px] leading-relaxed text-white/75">
              Tu agenda, tus reservas, tus cobros y tus clientes en un solo
              panel — y una página como las que acabás de ver, lista para
              compartir.
            </p>
            <Link href="/publicar" className="btn-blanco relative mt-6">
              Publicá tu negocio
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
