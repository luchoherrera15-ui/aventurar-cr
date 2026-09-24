import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HOMES } from "../homes-vivos";

/**
 * /prueba-home/07 — UNA portada, a tamaño real y sola en la pantalla.
 *
 * Pedido del dueño (24 sep 2026): «mostrame los ejemplos pero 100 %
 * funcionales, o sea cómo se verían exactamente».
 *
 * Una ruta por idea, y no las veinte en una sola página larga, por dos
 * razones que importan al comparar:
 *
 *   · Cada una se ve **sola**, sin la de arriba contaminando el juicio.
 *   · El scroll es el de esa portada. Si una pide siete pantallas, se
 *     siente — y ese es justamente uno de los criterios para elegir.
 *
 * La barra flotante de abajo permite saltar entre ellas sin volver al
 * índice; se puede esconder para ver la portada limpia.
 */

export const metadata: Metadata = {
  title: "Portada a tamaño real",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return HOMES.map((h) => ({ n: h.n }));
}

export default async function PortadaViva({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const i = HOMES.findIndex((h) => h.n === n);
  if (i === -1) notFound();

  const home = HOMES[i];
  const anterior = HOMES[(i - 1 + HOMES.length) % HOMES.length];
  const siguiente = HOMES[(i + 1) % HOMES.length];

  return (
    <>
      {home.vista}

      {/* ── La barra de revisión ──────────────────────────────────
          Arranca PLEGADA: al revisar un diseño, cualquier cosa fija
          abajo termina compitiendo con el diseño. Un clic la abre. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 print:hidden">
        {/* Sin `open`: arranca plegado. Además de dejar la portada
            limpia para mirarla, evita el aviso de hidratación que da
            React cuando el atributo booleano `open` del servidor no
            coincide con la propiedad del DOM en el cliente. */}
        <details
          className="pointer-events-auto rounded-[16px] border border-white/15 bg-[#14161a] text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)]"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-[#14161a]">
              {home.n}
            </span>
            <span className="text-[14px] font-extrabold">{home.nombre}</span>
            <span className="ml-2 text-[11px] text-white/50">
              {i + 1} de {HOMES.length}
            </span>
          </summary>

          <div className="border-t border-white/10 px-4 py-3">
            <p className="max-w-[54ch] text-[12.5px] leading-snug text-white/70">
              {home.idea}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/prueba-home/${anterior.n}`}
                className="rounded-[9px] border border-white/20 px-3 py-1.5 text-[12.5px] font-extrabold hover:bg-white/10"
              >
                ← {anterior.n}
              </Link>
              <Link
                href={`/prueba-home/${siguiente.n}`}
                className="rounded-[9px] border border-white/20 px-3 py-1.5 text-[12.5px] font-extrabold hover:bg-white/10"
              >
                {siguiente.n} →
              </Link>
              <Link
                href="/prueba-home"
                className="rounded-[9px] bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-[#14161a]"
              >
                Ver las veinte
              </Link>
            </div>
          </div>
        </details>
      </div>
    </>
  );
}
