import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import { configPorDefecto, type ConfigBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import NavLealtad from "../../nav-lealtad";
import BurbujaContacto from "../../burbuja-contacto";
import { INDUSTRIAS, industriaPorSlug } from "../datos";

/**
 * /lealtad/industrias/[slug] — una página comercial POR INDUSTRIA
 * (pedido del dueño, ago 2026): el pase demo configurado para ese
 * rubro con el componente REAL del producto (VistaPase — no un dibujo
 * aparte), la mecánica concreta, los dolores del dueño y la
 * explicación profesional de por qué SU negocio lo necesita. El
 * contenido vive en ../datos.ts; los negocios son ficticios y no hay
 * estadísticas inventadas.
 */

export function generateStaticParams() {
  return INDUSTRIAS.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ind = industriaPorSlug(slug);
  if (!ind) return { title: "Industrias · Bookea Lealtad" };
  return {
    title: `Lealtad para ${ind.nombre.toLowerCase()}`,
    description: ind.subtitulo,
    alternates: { canonical: `/lealtad/industrias/${ind.slug}` },
  };
}

export default async function IndustriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ind = industriaPorSlug(slug);
  if (!ind) notFound();

  // ⚠️ ACÁ SE LEÍA LA SESIÓN EN EL SERVIDOR, Y ERA LO ÚNICO QUE
  // VOLVÍA DINÁMICA A ESTA PÁGINA.
  //
  // Es una landing de marketing: el mismo HTML para todo el mundo. El
  // único await era `sesionDelNavLealtad()` —leer una cookie para saber
  // qué decir en la esquina del nav—, y Next no puede prerenderizar una
  // página que lee cookies. Resultado: la landing entera se armaba de
  // nuevo, con su CPU, en cada visita (x-vercel-cache: MISS siempre).
  //
  // Ahora  resuelve la sesión solo, en el navegador, con el
  // cliente de Supabase del navegador. Esta página se prerenderiza y
  // sale del CDN. Ver el comentario de .

  // El beneficio del pase demo: sellos con la meta y la regalía del
  // rubro. Se narra el tipo para poder pisar los campos sin `any`.
  const base = configPorDefecto("sellos");
  const beneficio: ConfigBeneficio =
    base.tipo === "sellos"
      ? { ...base, requeridos: ind.metaSellos, recompensa: ind.regalia }
      : base;

  const datosVista: DatosVista = {
    negocioNombre: ind.negocioFicticio,
    modo: "sellos",
    beneficio,
    colorFondo: ind.colorFondo,
    colorSello: ind.colorSello,
    logoUrl: null,
    iconoSello: null,
  };

  const otras = INDUSTRIAS.filter((i) => i.slug !== ind.slug);

  return (
    <main className="min-h-svh bg-white">
      <RevealOnScroll />
      <NavLealtad />
      <BurbujaContacto />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 78% 35%, rgba(15,76,158,.10), transparent 32%)," +
            "radial-gradient(circle at 90% 80%, rgba(243,146,0,.08), transparent 26%)," +
            "linear-gradient(180deg,#ffffff 0%,#fbfcff 100%)",
        }}
      >
        <div className="mx-auto grid w-[min(1180px,92vw)] items-center gap-10 pb-14 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p
              className="inline-flex items-center gap-2 rounded-full border border-[#dbe3f4] bg-white/75 px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em]"
              style={{ color: "var(--accion)" }}
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--orange-acento-claro)" }} />
              Bookea Lealtad · {ind.nombre}
            </p>
            <h1 className="titulo mt-5 max-w-[16ch] text-balance text-[clamp(32px,4.6vw,52px)] leading-[1.04] tracking-tight text-aventurea-navy">
              {ind.titulo}
            </h1>
            <p className="mt-4 max-w-[52ch] text-[clamp(14.5px,1.6vw,17px)] leading-relaxed text-aventurea-ink-soft">
              {ind.subtitulo}
            </p>

            <div className="mt-6 rounded-2xl border border-aventurea-line bg-white p-4 shadow-[0_14px_36px_-26px_rgba(16,40,90,0.4)]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
                Así funcionaría en tu negocio
              </p>
              <p className="mt-1.5 text-[14px] font-bold leading-relaxed text-aventurea-navy">
                {ind.mecanica}
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/lealtad"
                className="presionable inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-[15px] font-extrabold text-white transition-transform hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg,#0b3168,#0f4c9e 55%,#3672c9)",
                  boxShadow: "0 14px 34px rgba(15,60,130,.28)",
                }}
              >
                ¡Creá tu pase de lealtad! <span aria-hidden>→</span>
              </Link>
              <Link
                href="/lealtad/industrias"
                className="text-[13.5px] font-bold underline-offset-2 hover:underline"
                style={{ color: "var(--accion)" }}
              >
                Ver otros rubros
              </Link>
            </div>
          </div>

          <div data-reveal className="mx-auto">
            <VistaPase datos={datosVista} superficie="clara" marco="telefono" />
          </div>
        </div>
      </section>

      {/* ── Dolores ──────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <h2 className="titulo max-w-[24ch] text-[clamp(24px,3.6vw,38px)] leading-[1.08] text-aventurea-navy">
            ¿Te suena?
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ind.dolores.map((d, i) => (
              <div
                key={d}
                data-reveal
                className="rounded-3xl border border-aventurea-line bg-white p-6 shadow-[0_10px_28px_-20px_rgba(22,41,94,0.4)]"
                style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
              >
                <span aria-hidden className="text-[20px]">😖</span>
                <p className="mt-3 text-[15px] font-bold leading-relaxed text-aventurea-ink">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────────── */}
      <section className="bg-aventurea-sky-light/40 px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
            En tu mostrador
          </p>
          <h2 className="titulo mt-3 max-w-[26ch] text-[clamp(24px,3.6vw,38px)] leading-[1.08] text-aventurea-navy">
            Así se ve un día con Bookea Lealtad
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {ind.comoFunciona.map((p, i) => (
              <li
                key={p}
                data-reveal
                className="rounded-3xl border border-aventurea-line bg-white p-6"
                style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-[15px] font-extrabold"
                  style={{ background: "var(--orange-acento-claro)", color: "#0a1226" }}
                >
                  {i + 1}
                </span>
                <p className="mt-4 text-[14px] leading-relaxed text-aventurea-ink">{p}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Por qué ──────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[820px]">
          <h2 className="titulo max-w-[26ch] text-[clamp(24px,3.6vw,38px)] leading-[1.08] text-aventurea-navy">
            Por qué tu {ind.nombre.toLowerCase() === "casilleros" ? "casillero" : ind.nombre.toLowerCase()} lo necesita
          </h2>
          <div className="mt-6 space-y-5">
            {ind.porQue.map((p) => (
              <p key={p.slice(0, 40)} className="text-[15.5px] leading-relaxed text-aventurea-ink-soft">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Otras industrias ─────────────────────────────────────── */}
      <section className="px-5 pb-16 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
            Otros rubros
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {otras.map((o) => (
              <Link
                key={o.slug}
                href={`/lealtad/industrias/${o.slug}`}
                className="presionable rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
              >
                {o.nombre}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre ───────────────────────────────────────────────── */}
      <section className="px-5 pb-20 sm:px-8">
        <div
          data-tema="oscuro"
          className="relative mx-auto w-full max-w-[980px] overflow-hidden rounded-[32px] px-6 py-14 text-center sm:px-10"
          style={{ background: "#0a1226", boxShadow: "0 35px 80px rgba(12,25,64,.2)" }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-52 h-[430px] w-[430px] rounded-full"
            style={{ background: "rgba(157,180,255,.14)" }}
          />
          <div className="relative">
            <h2 className="titulo text-[clamp(26px,4vw,42px)] leading-[1.06] text-white">
              Armá la tarjeta de {ind.negocioFicticio.split(",")[0]} con tu nombre.
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/60">
              La primera tarjeta es gratis, sin tarjeta de crédito — la armás en minutos y la ves
              en el teléfono antes de decidir nada.
            </p>
            <Link
              href="/lealtad"
              className="presionable mt-8 inline-block rounded-full px-8 py-4 text-[15px] font-extrabold"
              style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
            >
              ¡Creá tu pase de lealtad! →
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
