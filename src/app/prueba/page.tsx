import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { IconWhatsapp, IconFacebook, IconInstagram, IconX } from "@/components/icons";

/**
 * /prueba — PÁGINA DE EXPERIMENTO, sin link desde ningún lado del
 * sitio (pedido puntual del dueño: "hazlo así para probar cómo
 * queda"). `noindex` a propósito: no es contenido real todavía, así
 * que no debería aparecer en Google mientras se prueba.
 *
 * SEGUNDA PASADA: tres carriles (no uno), de lado a lado de LA
 * PANTALLA (no de un bloque centrado — por eso el `<main>` no lleva
 * padding horizontal y el desfile es el único hijo a ancho completo).
 * Carriles alternos van en direcciones opuestas —`animationDirection:
 * "reverse"` en los impares— para que se lea como un muro fluyendo, no
 * tres copias de la misma fila. Reusan `.anim-mini-inv-desfile` de
 * globals.css (lista duplicada ×2 + `translateX(-50%)` en loop, pausa
 * al pasar el mouse, se apaga con prefers-reduced-motion) — no una
 * animación nueva por carril.
 */

export const metadata: Metadata = {
  title: "Prueba · Bookea",
  robots: { index: false, follow: false },
};

type App = {
  id: string;
  fondo: string;
  Icono: React.ComponentType<{ className?: string }>;
};

const APPS: App[] = [
  { id: "whatsapp", fondo: "#25D366", Icono: IconWhatsapp },
  { id: "facebook", fondo: "#1877F2", Icono: IconFacebook },
  {
    id: "instagram",
    fondo: "linear-gradient(135deg,#f58529,#dd2a7b 45%,#8134af,#515bd4)",
    Icono: IconInstagram,
  },
  { id: "x", fondo: "#000000", Icono: IconX },
];

/** Tres carriles, cada uno con las cuatro apps en un orden distinto —
 *  para que no se lean como la misma fila repetida tres veces. */
const CARRILES: App[][] = [
  APPS,
  [APPS[2], APPS[0], APPS[3], APPS[1]],
  [APPS[1], APPS[3], APPS[0], APPS[2]],
];

function Carril({ apps, reverso, duracion }: { apps: App[]; reverso: boolean; duracion: string }) {
  // Ocho copias del set de cuatro (×2 para el loop sin salto, ×4 más
  // para que el carril quede denso a ancho completo de pantalla, no
  // solo cuatro iconos sueltos flotando en un mar de espacio vacío).
  const fila = [...apps, ...apps, ...apps, ...apps];
  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="anim-mini-inv-desfile flex items-center gap-6"
        style={{ animationDuration: duracion, animationDirection: reverso ? "reverse" : "normal" }}
      >
        {[...fila, ...fila].map((a, i) => (
          <div
            key={`${a.id}-${i}`}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,.4)] [&_svg]:h-7 [&_svg]:w-7 sm:h-20 sm:w-20 sm:rounded-[22px] sm:[&_svg]:h-9 sm:[&_svg]:w-9"
            style={{ background: a.fondo }}
          >
            <a.Icono />
          </div>
        ))}
      </div>
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-20 sm:w-32"
        style={{ background: "linear-gradient(to right, #f4f4f2, transparent)" }}
      />
      <span
        className="pointer-events-none absolute inset-y-0 right-0 w-20 sm:w-32"
        style={{ background: "linear-gradient(to left, #f4f4f2, transparent)" }}
      />
    </div>
  );
}

export default function PruebaPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[#f4f4f2] py-24 text-center">
      <div className="px-5">
        <Image
          src="/logo-bookea-nav-v4.png"
          alt="Bookea"
          width={140}
          height={40}
          className="mx-auto h-[30px] w-auto"
        />

        <h1 className="mx-auto mt-6 max-w-[17ch] text-[clamp(42px,9vw,124px)] font-black leading-[0.96] tracking-tight text-black">
          Reservá. Fidelizá. Crecé.
        </h1>

        <p className="mx-auto mt-6 max-w-[46ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-black/45">
          Todo lo que tu negocio necesita para conseguir clientes y hacerlos volver, en un solo lugar.
        </p>

        <Link
          href="/publicar"
          className="presionable mt-9 inline-flex items-center gap-2 rounded-full bg-black px-7 py-3.5 text-[14.5px] font-bold text-white transition-transform hover:scale-[1.03]"
        >
          Empezar gratis →
        </Link>
      </div>

      {/* ── Los tres carriles, de lado a lado de la pantalla ── */}
      <div aria-hidden className="mt-20 flex w-full flex-col gap-5">
        <Carril apps={CARRILES[0]} reverso={false} duracion="26s" />
        <Carril apps={CARRILES[1]} reverso={true} duracion="30s" />
        <Carril apps={CARRILES[2]} reverso={false} duracion="22s" />
      </div>
    </main>
  );
}
