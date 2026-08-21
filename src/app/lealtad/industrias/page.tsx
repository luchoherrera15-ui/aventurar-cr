import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";
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
  // Sesión + nombre en una sola lectura: el nav muestra de quién es la
  // cuenta (ver src/lib/lealtad/sesion-nav.ts).
  const sesion = await sesionDelNavLealtad();

  return (
    <main className="min-h-svh bg-white">
      <RevealOnScroll />
      <NavLealtad logueado={sesion.logueado} nombre={sesion.nombre} />
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
