"use client";

import { useState } from "react";
import { PaseWallet } from "@/app/lealtad/pase-wallet";

/**
 * EL SLIDER DE PASES, en el hero — pedido explícito del dueño sobre el
 * mockup que trajo (`puramatcha/lavacar.html`): ese archivo traía un
 * slider de OFERTAS de servicio (Lavado Premium, Cerámico, DX) en el
 * mismo lugar; acá se reemplaza por la TARJETA de Lavacar El Rayo en
 * sus cuatro formas -sellos, descuento, puntos, cashback- porque lo
 * que este slider tiene que vender es la tarjeta, no un menú de
 * precios (eso ya vive abajo, en "Productos").
 *
 * El mockup apilaba sus tres tarjetas EN FLUJO NORMAL (una debajo de
 * otra, con la inactiva atenuada por opacidad) y por eso entraban
 * justas en los 690px del hero. Con `PaseWallet` -que ya es un pase
 * completo, más alto que esas tarjetas de servicio- cuatro apiladas no
 * entrarían ni cerca. Por eso acá se ve UNA sola a la vez -carrusel de
 * verdad, no apilado con opacidad- con flechas y puntos para moverse.
 */

const NAVY_PROFUNDO = "#0a1226";

const FOTO_A = "/lealtad/plantillas/franjas/lavacar-1.jpg";
const FOTO_B = "/lealtad/plantillas/franjas/lavacar-2.jpg";

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

type Slide = {
  id: string;
  etiqueta: string;
  etiquetaCampo: string;
  valorCampo: string;
  foto: string;
  contenido: React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    id: "sellos",
    etiqueta: "Sellos",
    etiquetaCampo: "Lavados",
    valorCampo: "4/6",
    foto: FOTO_A,
    contenido: (
      <div className="grid grid-cols-6 gap-2 pb-1">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="flex aspect-square items-center justify-center rounded-full"
            style={
              i < 4
                ? { background: "var(--orange)", color: "#0a1226" }
                : { border: "2px dashed rgba(255,255,255,.3)" }
            }
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
    foto: FOTO_B,
    contenido: <Saldo valor="20% OFF" detalle="Válido en el tratamiento cerámico este mes" />,
  },
  {
    id: "puntos",
    etiqueta: "Puntos",
    etiquetaCampo: "Tus puntos",
    valorCampo: "480 pts",
    foto: FOTO_B,
    contenido: <Saldo valor="480 pts" detalle="1 punto por cada ₡1.000 en servicios" />,
  },
  {
    id: "cashback",
    etiqueta: "Cashback",
    etiquetaCampo: "Tu cashback",
    valorCampo: "₡3.200",
    foto: FOTO_B,
    contenido: <Saldo valor="₡3.200" detalle="5% de cada servicio vuelve a tu tarjeta" />,
  },
];

const AMARILLO = "#ffb800";

export default function PasesSlider() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];

  function ir(paso: number) {
    setI((actual) => (actual + paso + SLIDES.length) % SLIDES.length);
  }

  return (
    <div className="w-full max-w-[340px]">
      <p className="text-center text-[9px] font-extrabold uppercase tracking-[.18em] text-white/45">
        Tu tarjeta, a tu manera
      </p>
      <p className="mt-1 text-center text-[11px] font-extrabold uppercase tracking-[.1em] text-white">
        Ahora estás viendo: <span style={{ color: AMARILLO }}>{slide.etiqueta}</span>
      </p>

      {/* Pedido explícito: "que se vea bastante" — un `scale` sube TODO
          el pase de forma proporcional (texto, ícono, sellos) en vez de
          solo ensanchar el contenedor, que dejaría los elementos
          internos con el mismo tamaño flotando en más aire. El margen
          vertical extra compensa el alto que gana al escalar, para que
          no se pegue con la etiqueta de arriba ni los puntos de abajo. */}
      <div className="my-5 scale-110">
        <PaseWallet
          marca="apple"
          negocio="Lavacar El Rayo"
          foto={slide.foto}
          etiquetaCampo={slide.etiquetaCampo}
          valorCampo={slide.valorCampo}
          colorFondo={NAVY_PROFUNDO}
          serial="BK · DEMO 0000"
        >
          {slide.contenido}
        </PaseWallet>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          {SLIDES.map((s, n) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Ver la forma ${s.etiqueta}`}
              aria-current={n === i}
              onClick={() => setI(n)}
              className="h-[3px] w-[22px] border-0"
              style={{ background: n === i ? "#fff" : "#555" }}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Forma anterior"
            onClick={() => ir(-1)}
            className="flex h-8 w-8 items-center justify-center border border-white/12 bg-[#0b0c0e] text-white"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Forma siguiente"
            onClick={() => ir(1)}
            className="flex h-8 w-8 items-center justify-center border border-white/12 bg-[#0b0c0e] text-white"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
