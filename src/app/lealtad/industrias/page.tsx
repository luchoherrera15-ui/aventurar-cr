import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import NavLealtad from "../nav-lealtad";
import BurbujaContacto from "../burbuja-contacto";
import { INDUSTRIAS } from "./datos";

export const metadata: Metadata = {
  title: "Industrias · Bookea Lealtad",
  description:
    "Programas de lealtad en Apple y Google Wallet para lavacar, casilleros, salas de belleza, barberías, gasolineras y carnicerías.",
  alternates: { canonical: "/lealtad/industrias" },
};

/** El índice de rubros — cada card lleva a la página de su industria. */
export default async function IndustriasPage() {
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

  return (
    <main className="min-h-svh bg-white">
      <RevealOnScroll />
      <NavLealtad />
      <BurbujaContacto />

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
            Industrias
          </p>
          <h1 className="titulo mt-3 max-w-[22ch] text-[clamp(30px,4.6vw,50px)] leading-[1.06] text-aventurea-navy">
            Tu rubro, tu tarjeta, tus clientes de vuelta
          </h1>
          <p className="mt-4 max-w-[56ch] text-[15.5px] leading-relaxed text-aventurea-ink-soft">
            Elegí tu industria y mirá cómo se vería tu programa de lealtad funcionando — con la
            mecánica, la regalía y el pase de ejemplo de tu rubro.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIAS.map((ind, i) => (
              <Link
                key={ind.slug}
                href={`/lealtad/industrias/${ind.slug}`}
                data-reveal
                className="presionable group rounded-3xl border border-aventurea-line bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-[0_24px_55px_-22px_rgba(16,40,90,0.35)]"
                style={{ "--reveal-delay": `${i * 60}ms` } as React.CSSProperties}
              >
                <span
                  aria-hidden
                  className="block h-2.5 w-12 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${ind.colorFondo}, ${ind.colorSello})` }}
                />
                <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                  {ind.nombre}
                </p>
                <p className="titulo mt-1.5 text-[19px] leading-snug text-aventurea-navy">
                  {ind.titulo}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-aventurea-ink-soft">
                  {ind.mecanica}
                </p>
                <p className="mt-4 text-[13.5px] font-extrabold" style={{ color: "var(--accion)" }}>
                  Ver cómo funcionaría <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
