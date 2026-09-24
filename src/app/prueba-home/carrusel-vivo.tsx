"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { VerMas } from "@/components/home/plataforma/piezas";
import { PRODUCTOS } from "@/lib/productos";
import { VISUAL } from "./piezas-vivo";

/**
 * Las dos portadas que necesitan estado, juntas para no repartir
 * `"use client"` por media carpeta.
 *
 *   `CarruselVivo`  la idea 09: los cuatro se turnan solos en un marco.
 *   `PorRubro`      la idea 13: la portada se arma según el rubro que
 *                   la persona elige.
 *
 * Las dos respetan `prefers-reduced-motion` por el mismo motivo que las
 * demos: un carrusel que gira solo es movimiento no pedido, y para
 * alguien con sensibilidad vestibular eso es un problema real, no una
 * preferencia. Quieto, muestra el primero y los botones siguen
 * funcionando.
 */

const PASO_MS = 4200;

export function CarruselVivo() {
  const [i, setI] = useState(0);
  const [quieto, setQuieto] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setQuieto(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);

  useEffect(() => {
    if (quieto) return;
    reloj.current = setTimeout(
      () => setI((n) => (n + 1) % PRODUCTOS.length),
      PASO_MS,
    );
    return () => {
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = null;
    };
  }, [i, quieto]);

  const p = PRODUCTOS[i];

  return (
    <div>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] [&>*]:min-w-0">
        <div className="text-left">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
            {String(i + 1).padStart(2, "0")} / 0{PRODUCTOS.length}
          </p>
          <h2 className="titulo mt-3 text-[clamp(26px,3.4vw,38px)] leading-[1.1] text-[color:var(--tinta)]">
            {p.nombre}
          </h2>
          <p className="mt-3 max-w-[40ch] text-[16px] leading-relaxed text-[color:var(--tinta-suave)]">
            {p.promesa}
          </p>
          <ul className="mt-5 space-y-2">
            {p.incluye.map((linea) => (
              <li key={linea} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok-suave)] text-[11px] font-extrabold text-[color:var(--ok)]"
                >
                  ✓
                </span>
                <span className="text-[14px] leading-snug text-[color:var(--tinta-suave)]">
                  {linea}
                </span>
              </li>
            ))}
          </ul>
          <Link href={p.verMas} className="group mt-6 inline-block">
            <VerMas />
          </Link>
        </div>

        <div
          aria-hidden
          className="mx-auto flex h-[430px] w-full max-w-[380px] select-none items-center justify-center"
        >
          <div className="w-full">{VISUAL[p.id]}</div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2">
        {PRODUCTOS.map((otro, n) => (
          <button
            key={otro.id}
            type="button"
            onClick={() => setI(n)}
            aria-label={otro.nombre}
            aria-current={n === i}
            className={`h-2 rounded-full transition-all ${
              n === i
                ? "w-8 bg-[color:var(--tinta)]"
                : "w-2 bg-[color:var(--linea)] hover:bg-[color:var(--tinta-tenue)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Los rubros de la idea 13. Cada uno cambia el titular y el ejemplo. */
const RUBROS = [
  {
    id: "restaurante",
    label: "Restaurante",
    titulo: "Tu carta, tus pedidos y tus clientes. En un link.",
    destaca: "pagina" as const,
  },
  {
    id: "cafeteria",
    label: "Cafetería",
    titulo: "El décimo café gratis, sin cartoncitos que se pierden.",
    destaca: "lealtad" as const,
  },
  {
    id: "barberia",
    label: "Barbería",
    titulo: "Que te reserven solos, sin contestar un mensaje.",
    destaca: "marketplace" as const,
  },
  {
    id: "tienda",
    label: "Tienda",
    titulo: "Tu catálogo en línea y los pedidos por WhatsApp.",
    destaca: "pagina" as const,
  },
  {
    id: "salon",
    label: "Salón de belleza",
    titulo: "Tu agenda llena y tus clientas volviendo.",
    destaca: "marketplace" as const,
  },
];

export function PorRubro() {
  const [activo, setActivo] = useState(0);
  const r = RUBROS[activo];
  const p = PRODUCTOS.find((x) => x.id === r.destaca) ?? PRODUCTOS[0];

  return (
    <div>
      <div className="text-center">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
          ¿Qué negocio tenés?
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {RUBROS.map((otro, n) => (
            <button
              key={otro.id}
              type="button"
              onClick={() => setActivo(n)}
              aria-pressed={n === activo}
              className={`rounded-full border px-4 py-2 text-[14px] font-extrabold transition-colors ${
                n === activo
                  ? "border-[color:var(--tinta)] bg-[color:var(--tinta)] text-[color:var(--papel)]"
                  : "border-[color:var(--linea)] bg-[color:var(--superficie)] text-[color:var(--tinta)] hover:border-[color:var(--tinta-tenue)]"
              }`}
            >
              {otro.label}
            </button>
          ))}
        </div>

        <h1 className="titulo mx-auto mt-8 max-w-[16ch] text-balance text-[clamp(30px,5vw,46px)] leading-[1.08] text-[color:var(--tinta)]">
          {r.titulo}
        </h1>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/empezar" className="btn-tinta">
            Empezá gratis
          </Link>
          <Link href="/solutions" className="btn-tinta-contorno">
            Ver cómo funciona
          </Link>
        </div>
      </div>

      <div className="mt-14 grid items-center gap-10 lg:grid-cols-2 [&>*]:min-w-0">
        <div
          aria-hidden
          className="mx-auto flex h-[420px] w-full max-w-[380px] select-none items-center justify-center"
        >
          <div className="w-full">{VISUAL[p.id]}</div>
        </div>
        <div className="text-left">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
            Lo que más usan {r.label.toLowerCase()}s como el tuyo
          </p>
          <h2 className="titulo mt-3 text-[clamp(24px,3vw,32px)] text-[color:var(--tinta)]">
            {p.nombre}
          </h2>
          <p className="mt-3 max-w-[42ch] text-[16px] leading-relaxed text-[color:var(--tinta-suave)]">
            {p.promesa}
          </p>
          <Link href={p.verMas} className="group mt-6 inline-block">
            <VerMas />
          </Link>
        </div>
      </div>
    </div>
  );
}
