"use client";

import { useRef, useState } from "react";
import { PaseWallet } from "@/app/lealtad/pase-wallet";

/**
 * "MIRÁ LAS FORMAS QUE PUEDE TENER TU TARJETA" — un carrusel deslizable
 * con la MISMA tarjeta de Lavacar El Rayo en sus cuatro formas: sellos,
 * descuento, puntos y cashback. No son cuatro negocios de ejemplo
 * distintos: es UN negocio mostrando que el tipo de tarjeta es una
 * elección, no una limitación del producto.
 *
 * El patrón de riel con `snap-x` + índice por `scrollLeft` es el mismo
 * que ya usa `galeria-hero.tsx` para el carrusel de fotos en móvil —no
 * uno nuevo inventado acá.
 */

const NEGRO = "#050505";
const ACENTO = "var(--orange)";

const FOTO_SELLOS = "/lealtad/plantillas/franjas/lavacar-1.jpg";
const FOTO_RESTO = "/lealtad/plantillas/franjas/lavacar-2.jpg";

type Slide = {
  id: string;
  etiqueta: string;
  etiquetaCampo: string;
  valorCampo: string;
  foto: string;
  contenido: React.ReactNode;
};

function Check({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Saldo({ valor, detalle }: { valor: string; detalle: string }) {
  return (
    <div className="pb-1">
      <p className="text-[26px] font-extrabold leading-none text-white">{valor}</p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-white/70">{detalle}</p>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    id: "sellos",
    etiqueta: "Sellos",
    etiquetaCampo: "Lavados",
    valorCampo: "4/6",
    foto: FOTO_SELLOS,
    contenido: (
      <div className="grid grid-cols-6 gap-2 pb-1">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="flex aspect-square items-center justify-center rounded-full"
            style={i < 4 ? { background: ACENTO, color: "#0a1226" } : { border: "2px dashed rgba(255,255,255,.3)" }}
          >
            {i < 4 && <Check className="h-3 w-3" />}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "descuento",
    etiqueta: "Descuento",
    etiquetaCampo: "Tu descuento",
    valorCampo: "20% OFF",
    foto: FOTO_RESTO,
    contenido: <Saldo valor="20% OFF" detalle="Válido en el tratamiento cerámico este mes" />,
  },
  {
    id: "puntos",
    etiqueta: "Puntos",
    etiquetaCampo: "Tus puntos",
    valorCampo: "480 pts",
    foto: FOTO_RESTO,
    contenido: <Saldo valor="480 pts" detalle="1 punto por cada ₡1.000 en servicios" />,
  },
  {
    id: "cashback",
    etiqueta: "Cashback",
    etiquetaCampo: "Tu cashback",
    valorCampo: "₡3.200",
    foto: FOTO_RESTO,
    contenido: <Saldo valor="₡3.200" detalle="5% de cada servicio vuelve a tu tarjeta" />,
  },
];

export default function CarruselTiposDeTarjeta() {
  const [activo, setActivo] = useState(0);
  const rielRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<(HTMLDivElement | null)[]>([]);

  function irA(i: number) {
    slidesRef.current[i]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return (
    <div>
      {/* La etiqueta de arriba, más los cuatro botones para ir directo
          a una forma sin tener que deslizar. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => irA(i)}
            aria-current={activo === i}
            className={`border px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.1em] transition-colors ${
              activo === i
                ? "border-white bg-white text-black"
                : "border-white/25 text-white/50 hover:border-white/50 hover:text-white/85"
            }`}
          >
            {s.etiqueta}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[12.5px] font-bold uppercase tracking-[0.14em] text-white/45">
        Ahora estás viendo: <span style={{ color: ACENTO }}>{SLIDES[activo].etiqueta}</span>
      </p>

      <div
        ref={rielRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          setActivo(Math.min(SLIDES.length - 1, Math.max(0, i)));
        }}
        className="mt-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            ref={(el) => {
              slidesRef.current[i] = el;
            }}
            className="w-full shrink-0 snap-center px-4"
          >
            <div className="mx-auto w-full max-w-[300px]">
              <PaseWallet
                marca="apple"
                negocio="Lavacar El Rayo"
                foto={s.foto}
                etiquetaCampo={s.etiquetaCampo}
                valorCampo={s.valorCampo}
                colorFondo={NEGRO}
                serial="BK · DEMO 0000"
              >
                {s.contenido}
              </PaseWallet>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === activo ? "w-4 bg-white" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
