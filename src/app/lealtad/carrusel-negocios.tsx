"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * LOS NEGOCIOS, EN TARJETAS QUE SE DESLIZAN.
 *
 * Reemplaza la fila de chips de texto que había: «Barberías →» no le
 * dice nada a un barbero. Una foto de una barbería sí, y ahí es donde
 * se reconoce y toca.
 *
 * Cada tarjeta lleva a `/lealtad/demo/{tipo}`, que ya existe y muestra
 * la tarjeta de ejemplo de ESE rubro con sus reglas y su regalía —
 * cómo se le vería el programa a él, no una promesa genérica.
 *
 * ------------------------------------------------------------------
 * POR QUÉ SE DESLIZA EN TODOS LADOS Y NO SOLO EN MÓVIL
 * ------------------------------------------------------------------
 * Son siete rubros y van a ser más. Una grilla los apila en tres filas
 * que empujan el resto de la página hacia abajo; el carrusel los
 * mantiene en una línea, deja ver que hay más a la derecha, y en
 * escritorio se recorre con las flechas de al lado.
 *
 * El encuadre lo hace `scroll-snap` del navegador, no JavaScript: se
 * siente nativo y respeta la inercia del sistema.
 */

const NARANJA = "#ee7420";

type Negocio = {
  tipo: string;
  nombre: string;
  /** Qué usa ese rubro, en tres palabras. */
  mecanica: string;
  foto: string;
};

/**
 * Las fotos son de Unsplash, que ya es un dominio permitido en
 * next.config y el que usan los negocios de ejemplo sembrados. Van con
 * `w=800&q=70`: a mayor tamaño no se nota en una tarjeta de 260px y
 * son siete imágenes en la misma pantalla.
 */
const NEGOCIOS: Negocio[] = [
  {
    tipo: "barberias",
    nombre: "Barberías",
    mecanica: "Sellos por corte",
    foto: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=70",
  },
  {
    tipo: "cafeterias",
    nombre: "Cafeterías",
    mecanica: "El décimo café va",
    foto: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=70",
  },
  {
    tipo: "salones",
    nombre: "Salones de belleza",
    mecanica: "Puntos por servicio",
    foto: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=70",
  },
  {
    tipo: "restaurantes",
    nombre: "Restaurantes",
    mecanica: "Cashback de la cuenta",
    foto: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=70",
  },
  {
    tipo: "spas",
    nombre: "Spas",
    mecanica: "Paquetes prepagados",
    foto: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=70",
  },
  {
    tipo: "gimnasios",
    nombre: "Gimnasios",
    mecanica: "Membresía en el pase",
    foto: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=70",
  },
  {
    tipo: "lavacars",
    nombre: "Lavacars",
    mecanica: "Sellos por lavado",
    foto: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=70",
  },
];

export default function CarruselNegocios() {
  const pista = useRef<HTMLDivElement | null>(null);
  const [alInicio, setAlInicio] = useState(true);
  const [alFinal, setAlFinal] = useState(false);

  function alDeslizar() {
    const el = pista.current;
    if (!el) return;
    setAlInicio(el.scrollLeft < 8);
    // -8 de margen: el redondeo del navegador nunca deja el número
    // exacto y la flecha quedaría habilitada sin nada que mostrar.
    setAlFinal(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }

  function mover(dir: 1 | -1) {
    const el = pista.current;
    if (!el) return;
    // Se mueve casi una pantalla, dejando una tarjeta a la vista como
    // ancla: saltar de bloque en bloque desorienta.
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={pista}
        onScroll={alDeslizar}
        className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {NEGOCIOS.map((n) => (
          <Link
            key={n.tipo}
            href={`/lealtad/demo/${n.tipo}`}
            className="elevar group w-[240px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/12 sm:w-[280px]"
            style={{ background: "rgba(255,255,255,.04)" }}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={n.foto}
                alt=""
                fill
                sizes="(max-width: 640px) 240px, 280px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Degradado para que el texto de abajo se lea sobre
                  cualquier foto, clara u oscura. */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(10,18,38,.92) 0%, rgba(10,18,38,.15) 55%, transparent 100%)",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="text-[17px] font-extrabold leading-tight text-white">
                  {n.nombre}
                </p>
                <p className="mt-0.5 text-[12.5px] text-white/70">{n.mecanica}</p>
              </div>
            </div>

            <p
              className="flex items-center justify-between px-4 py-3 text-[13px] font-bold"
              style={{ color: NARANJA }}
            >
              Ver cómo funcionaría
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </p>
          </Link>
        ))}
      </div>

      {/* Las flechas: solo con puntero, porque en un teléfono se desliza
          con el dedo y dos botones flotando estorban. `disabled` real,
          no un botón que no hace nada. */}
      <div className="mt-4 hidden justify-end gap-2 lg:flex">
        <button
          type="button"
          onClick={() => mover(-1)}
          disabled={alInicio}
          aria-label="Ver negocios anteriores"
          className="presionable grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white/70 disabled:opacity-30"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => mover(1)}
          disabled={alFinal}
          aria-label="Ver más negocios"
          className="presionable grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white/70 disabled:opacity-30"
        >
          →
        </button>
      </div>
    </div>
  );
}
