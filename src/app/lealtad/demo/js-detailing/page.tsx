import type { Metadata } from "next";
import Link from "next/link";
import { PaseWallet } from "@/app/lealtad/pase-wallet";

/**
 * PITCH A LA MEDIDA — JS Detailing (lavado y detailing a domicilio).
 *
 * No es una categoría genérica del catálogo de `/lealtad/demo/[tipo]`
 * (esas venden con un negocio de mentira, "no existe — es el
 * ejemplo"): esto es una vista previa para UN prospecto real, así que
 * vive en su propia ruta estática — Next.js resuelve una carpeta
 * estática antes que la dinámica hermana `[tipo]`, así que las dos
 * conviven sin choque — y no aparece en el carrusel "Mirá otro tipo de
 * negocio" de esa página, que es para categorías, no para un negocio
 * puntual.
 *
 * Estética a propósito distinta del resto de /lealtad: pedido explícito
 * del dueño — "profesional, diseño agresivo y minimalista" — para un
 * servicio de detailing a domicilio. Negro puro en vez de navy,
 * tipografía apretada en mayúsculas, casi nada de radios redondeados.
 *
 * Los colores NO son propios: salen de los tokens de `.lealtad`, así
 * que la página respeta la misma doctrina que el resto del módulo —el
 * azul de acción manda y el naranja marca lo que se gana (el paso en
 * el que va y los sellos ya conseguidos)—, solo que sobre negro en vez
 * de navy. Antes mezclaba la clase de marca con un hex escrito a mano
 * en la misma pantalla: dos naranjas distintos a la vez.
 *
 * Los "íconos de Apple y Google Wallet" NO son el arte oficial de esas
 * marcas — ver `panel/[id]/poster/marcas-wallet.tsx` para el porqué
 * (guías de marca de terceros, redibujar el logo ajeno es justo lo que
 * una revisión rechaza). Acá se repite el mismo criterio: un glifo de
 * tarjeta genérico en tinta neutra + el nombre en texto plano.
 */

const NEGRO = "#050505";
/* Fondo negro = fondo oscuro: el par de acción es el claro. */
const ACCION = "var(--accion-claro)";
const ACCION_TINTA = "var(--accion-claro-tinta)";
const ACENTO = "var(--orange)";

export const metadata: Metadata = {
  title: "JS Detailing · Vista previa · Lealtad Bookea",
};

/** El mismo glifo neutro de `marcas-wallet.tsx`, sin las clases CSS de
 *  esa hoja (son propias del afiche) — acá con Tailwind, a tono con
 *  esta página. Nunca se tiñe de un color de marca a propósito: sería
 *  usar el color de Bookea para "vestir" el nombre de otra empresa. */
function GlifoTarjeta({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" aria-hidden focusable="false" className={className}>
      <rect
        x="0.9"
        y="0.9"
        width="22.2"
        height="14.2"
        rx="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M0.9 5.6h22.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14.6" y="8.6" width="5.8" height="3.6" rx="1" fill="currentColor" />
    </svg>
  );
}

const PASOS: [string, string, string] = [
  "El cliente agrega la tarjeta al Wallet la primera vez que lo llamás — un QR, sin apps.",
  "Cada lavado a domicilio suma su sello, esté donde esté: casa, oficina, donde sea.",
  "El sexto lavado va gratis — y esa fecha te la vuelve a agendar a vos, no a la competencia.",
];

export default function JsDetailingDemoPage() {
  const total = 6;
  const logrados = 4;

  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NEGRO }}>
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex items-center justify-between">
          <Link href="/lealtad" className="text-[12.5px] font-bold text-white/45 hover:text-white">
            ← Volver
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">
            Bookea
          </span>
        </header>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
          {/* ── El pitch ── */}
          <div>
            <span
              className="inline-block border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ borderColor: "rgba(157,180,255,.45)", color: ACCION }}
            >
              JS Detailing · Vista previa
            </span>
            <h1 className="mt-5 text-[clamp(30px,5vw,48px)] font-extrabold uppercase leading-[0.98] tracking-tight text-white">
              Un lavado a domicilio
              <br />
              no se olvida.
              <br />
              <span style={{ color: ACCION }}>Una tarjeta, sí.</span>
            </h1>
            <p className="mt-4 max-w-[48ch] text-[14.5px] leading-relaxed text-white/55">
              Así se vería la tarjeta de clientes de <strong className="text-white">JS Detailing</strong> en
              el teléfono de quien te contrata — sin depender de un local: funciona igual de bien puerta
              a puerta.
            </p>

            <div className="mt-7 grid gap-2.5">
              <div className="border border-white/12 px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/40">La regla</p>
                <p className="mt-0.5 text-[13.5px] font-bold text-white">1 sello por lavado a domicilio</p>
              </div>
              <div className="border border-white/12 px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/40">La regalía</p>
                <p className="mt-0.5 text-[13.5px] font-bold text-white">El sexto lavado va gratis</p>
              </div>
            </div>

            <ol className="mt-7 grid gap-3">
              {PASOS.map((p, i) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-white/65">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-extrabold"
                    style={{ background: ACENTO, color: "#0a1226" }}
                  >
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/lealtad/nuevo"
                className="px-6 py-3 text-[14px] font-bold uppercase tracking-wide transition-transform hover:scale-[1.02]"
                style={{ background: ACCION, color: ACCION_TINTA }}
              >
                Quiero esto en mi negocio
              </Link>
              <Link
                href="/lealtad/planes"
                className="border border-white/25 px-6 py-3 text-[14px] font-bold uppercase tracking-wide text-white/80 hover:border-white/60"
              >
                Ver los paquetes
              </Link>
            </div>
          </div>

          {/* ── La tarjeta de ejemplo ── */}
          <div className="mx-auto w-full max-w-[340px]">
            <PaseWallet
              marca="apple"
              negocio="JS Detailing"
              foto="https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=640&q=70"
              etiquetaCampo="Lavados"
              valorCampo={`${logrados}/${total}`}
              colorFondo={NEGRO}
              serial="BK · JS 0001"
            >
              <div className="grid grid-cols-6 gap-2 pb-1">
                {Array.from({ length: total }, (_, i) => (
                  /* Los sellos LOGRADOS se quedan naranja: el color
                     distingue lleno de vacío y es lo que el cliente
                     ganó. La palomita va navy — blanca sobre el
                     naranja da 2,35:1. */
                  <span
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-full"
                    style={
                      i < logrados
                        ? { background: ACENTO, color: "#0a1226" }
                        : { border: "2px dashed rgba(255,255,255,.3)" }
                    }
                  >
                    {i < logrados && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                ))}
              </div>
            </PaseWallet>

            <p className="mt-4 flex items-center justify-center gap-4 text-[11px] font-bold uppercase tracking-wide text-white/35">
              <span className="flex items-center gap-1.5">
                <GlifoTarjeta className="h-3.5 w-5" />
                Apple Wallet
              </span>
              <span className="flex items-center gap-1.5">
                <GlifoTarjeta className="h-3.5 w-5" />
                Google Wallet
              </span>
            </p>
            <p className="mt-1.5 text-center text-[11px] text-white/35">
              Se actualiza sola en cada visita — sin apps, sin cartón.
            </p>
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 pt-6 text-center">
          <p className="text-[11px] text-white/30">
            Esta tarjeta todavía no existe — es la vista previa de cómo quedaría. Se activa cuando
            JS Detailing la pide.
          </p>
        </div>
      </div>
    </main>
  );
}
