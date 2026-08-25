import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { DEMOS, ETIQUETA_MODO } from "./datos-demos";

/**
 * EL ÍNDICE DEL CATÁLOGO DE DEMOS — una card por rubro, cada una a
 * `/lealtad/demo/[tipo]`. Antes cada hoja de demo solo se enlazaba
 * desde DENTRO de otra hoja de demo ("Mirá otro tipo de negocio"); acá
 * hay una puerta de entrada propia para quien llega directo a
 * `/lealtad/demo` sin haber pasado por ninguna.
 *
 * Mismos tokens navy/naranja que `[tipo]/page.tsx` — es la misma
 * familia de pantallas, así que no inventa paleta nueva.
 */

const NAVY_PROFUNDO = "#0a1226";
const ACCION = "var(--accion-claro)";
const ACENTO = "var(--orange)";

export const metadata: Metadata = {
  title: "Catálogo de demos · Lealtad Bookea",
  description: "Elegí tu rubro y mirá cómo se vería tu tarjeta de lealtad, con su regla y su regalía.",
  alternates: { canonical: "/lealtad/demo" },
};

export default function IndiceDemosPage() {
  const entradas = Object.entries(DEMOS);

  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="flex items-center justify-between">
          <Link href="/lealtad" className="text-[12.5px] font-bold text-white/50 hover:text-white">
            ← Volver a Lealtad
          </Link>
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-blanco-v4.png"
              alt="Bookea"
              width={110}
              height={34}
              className="h-[24px] w-auto"
            />
          </Link>
        </header>

        <div className="mx-auto mt-10 max-w-[56ch] text-center">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ background: "rgba(157,180,255,.14)", color: ACCION }}
          >
            Catálogo de demos
          </span>
          <h1 className="titulo mt-4 text-[clamp(28px,4.5vw,42px)] leading-[1.08] text-white">
            Elegí tu rubro y mirá tu tarjeta
          </h1>
          <p className="mx-auto mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-white/60">
            Cada demo es un negocio de ejemplo con su regla y su regalía ya armadas — la
            tuya llevaría tu nombre, tus colores y tu premio.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entradas.map(([slug, demo]) => (
            <Link
              key={slug}
              href={`/lealtad/demo/${slug}`}
              className="presionable group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/25"
            >
              {demo.foto ? (
                <div className="relative h-32 w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- mezcla hotlinks de Unsplash con rutas de public/, sin un dominio único que next/image pueda optimizar */}
                  <img
                    src={demo.foto}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(180deg, rgba(10,18,38,0) 40%, ${NAVY_PROFUNDO} 100%)` }}
                  />
                </div>
              ) : (
                <div
                  aria-hidden
                  className="flex h-32 w-full items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(157,180,255,.12), rgba(243,146,0,.1))" }}
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/30">
                    Bookea Lealtad
                  </span>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-extrabold text-white">{demo.categoria}</p>
                  {/* Los DOS modos que trae este rubro — de un vistazo,
                      antes de entrar, que quede claro que no es una
                      sola maqueta fija. */}
                  <div className="flex shrink-0 gap-1">
                    {demo.variantes.map((v) => (
                      <span
                        key={v.modo}
                        className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                        style={{ background: "rgba(255,255,255,.08)", color: ACENTO }}
                      >
                        {ETIQUETA_MODO[v.modo]}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/55">
                  {demo.variantes[0].regalia}
                </p>
                <p className="mt-3 text-[12px] font-bold text-white/70 group-hover:text-white">
                  Ver demo →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
