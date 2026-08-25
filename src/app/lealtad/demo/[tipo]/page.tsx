import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DEMOS } from "../datos-demos";
import TarjetaDemoInteractiva from "./tarjeta-demo-interactiva";

/**
 * LA HOJA DE DEMO POR CATEGORÍA: el dueño de una barbería (o lavacar, o
 * spa…) toca su chip en la landing y se ve — SU tipo de negocio, con
 * una tarjeta de ejemplo, las reglas típicas y la regalía que sus
 * clientes perseguirían. Vender con el producto puesto, no con
 * promesas genéricas.
 *
 * Cada demo declara su MODO, que son los tres que el motor soporta de
 * verdad (0121): sellos, cashback (% de vuelta) y puntos. Así el dueño
 * de un restaurante ve plata devuelta y el de una cafetería ve sellos —
 * no la misma maqueta con otro nombre.
 */

const NAVY_PROFUNDO = "#0a1226";

/** Lo que además puede vivir en la misma tarjeta del cliente. */
const TAMBIEN = [
  {
    titulo: "Gift cards digitales",
    texto:
      "Tu cliente compra una tarjeta de regalo y le llega al Wallet a quien la recibe, lista para usarse.",
  },
  {
    titulo: "Paquetes prepagados",
    texto: "«5 lavados», «10 clases»: cobrás por adelantado y el pase descuenta solo.",
  },
  {
    titulo: "Cupones con vencimiento",
    texto: "«Hace 30 días no venís, tenés 15% off» — con fecha límite, no perdido en un chat.",
  },
];

export function generateStaticParams() {
  return Object.keys(DEMOS).map((tipo) => ({ tipo }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>;
}): Promise<Metadata> {
  const { tipo } = await params;
  const demo = DEMOS[tipo];
  return { title: demo ? `Demo · ${demo.categoria} · Lealtad Bookea` : "Demo · Lealtad" };
}

export default async function DemoCategoriaPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const demo = DEMOS[tipo];
  if (!demo) notFound();

  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex items-center justify-between">
          <Link href="/lealtad" className="text-[12.5px] font-bold text-white/50 hover:text-white">
            ← Volver
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

        <TarjetaDemoInteractiva demo={demo} />

        {/* ── Lo que además cabe en la misma tarjeta ── */}
        <div className="mt-14 border-t border-white/10 pt-8">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Y en la misma tarjeta también podés dar
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {TAMBIEN.map((t) => (
              <div
                key={t.titulo}
                className="rounded-2xl border border-white/12 p-4"
                style={{ background: "rgba(255,255,255,.04)" }}
              >
                <p className="text-[13.5px] font-extrabold text-white">{t.titulo}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{t.texto}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Los otros demos ── */}
        <div className="mt-10 border-t border-white/10 pt-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Mirá otro tipo de negocio
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {Object.entries(DEMOS)
              .filter(([slug]) => slug !== tipo)
              .map(([slug, d]) => (
                <Link
                  key={slug}
                  href={`/lealtad/demo/${slug}`}
                  className="rounded-xl border border-white/15 px-3.5 py-2 text-[12.5px] font-bold text-white/75 transition-colors hover:border-[color:var(--accion-claro)] hover:text-white"
                >
                  {d.categoria}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
