"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Telefono from "@/components/solutions/telefono";
import VistaPagina from "@/components/solutions/vista-pagina";
import { PAGINAS_DEMO } from "./paginas-demo";
import PantallaMenu from "./pantalla-menu";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL TELÉFONO DEL HÉROE — el producto, en uso, turnándose
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «que los mockups sean 100 %
 * interactivos, que se vean en movimiento, que se demuestre en
 * carrusel lo que podemos ofrecer».
 *
 * Adentro del teléfono no hay capturas: hay componentes.
 *
 *   1. **El menú digital** (`PantallaMenu`) — portada, categorías,
 *      platos y carrito, y se mueve solo: cambia de categoría, agrega
 *      un plato y la barra de abajo actualiza el total. Es la pantalla
 *      que el dueño pidió con nombre y apellido, y va PRIMERA porque
 *      es la que más vende.
 *   2. **Tres páginas de negocio** (`VistaPagina`, el componente que
 *      sirve `/s/<slug>`) de rubros distintos, cada una con su tema,
 *      su color y su tipografía.
 *
 * Debajo va el rótulo —«Casa Matcha · menú digital»— y los puntos. Sin
 * el rótulo el cambio se lee como un parpadeo en vez de como «esto se
 * personaliza», que es todo el argumento.
 *
 * ── POR QUÉ CUATRO PANTALLAS Y NO OCHO ──────────────────────────────
 *
 * A 5 segundos cada una, cuatro dan 20 segundos de vuelta completa.
 * Ocho darían 40, y nadie mira un héroe 40 segundos: la mitad de las
 * pantallas no se vería nunca.
 *
 * ── DETALLES QUE IMPORTAN ───────────────────────────────────────────
 *
 * · `prefers-reduced-motion` lo deja quieto en la primera. Los puntos
 *   siguen funcionando, así que no se pierde nada salvo el movimiento
 *   que nadie pidió.
 * · El fundido va con las pantallas SUPERPUESTAS, no con un `key` que
 *   remonte: remontar haría que cada página entre desde cero —con su
 *   cascada de aparición— cada cinco segundos, y eso marea.
 * · `pointer-events-none` en la que no se ve, o la oculta se comería
 *   los clics de la visible.
 */

const PASO_MS = 5000;

type Pantalla = {
  id: string;
  pie: string;
  nodo: ReactNode;
  /** El color del velo del corte inferior. */
  fondo: string | null;
};

/**
 * El menú va primero. Las tres páginas que lo siguen NO incluyen la de
 * Casa Matcha: sería el mismo negocio dos veces seguidas y el carrusel
 * parecería trabado.
 */
const PANTALLAS: Pantalla[] = [
  {
    id: "menu",
    pie: "Casa Matcha · menú digital",
    nodo: <PantallaMenu />,
    fondo: null,
  },
  ...PAGINAS_DEMO.filter((p) => p.id !== "cafe").map((p) => ({
    id: p.id,
    pie: p.pie,
    nodo: (
      <VistaPagina
        datos={p.datos}
        inerte
        nivelTitulo="p"
        credito="Hecho con Bookea"
      />
    ),
    fondo: p.datos.colorFondo,
  })),
];

export default function TelefonoRotativo({ ancho = 300 }: { ancho?: number }) {
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
      () => setI((n) => (n + 1) % PANTALLAS.length),
      PASO_MS,
    );
    return () => {
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = null;
    };
  }, [i, quieto]);

  return (
    <div className="flex flex-col items-center">
      <Telefono ancho={ancho} barraEstado={false}>
        <div className="relative h-full w-full overflow-hidden bg-white">
          {PANTALLAS.map((p, n) => (
            <div
              key={p.id}
              aria-hidden={n !== i}
              className={`absolute inset-0 overflow-hidden transition-opacity duration-700 ${
                n === i ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {p.nodo}
              {/* Las páginas son más altas que la pantalla y el corte
                  caía donde caía —una vez partió el crédito del pie por
                  la mitad de una letra, que se lee como un error—. El
                  velo del color de fondo lo apaga: ahora el corte dice
                  «sigue para abajo», que es la verdad.
                  El menú no lo lleva: está hecho para ocupar la pantalla
                  exacta y termina en su barra de carrito. */}
              {p.fondo ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
                  style={{
                    background: `linear-gradient(to top, ${p.fondo}, transparent)`,
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </Telefono>

      <div className="mt-5 flex items-center gap-4">
        <p className="text-[13px] font-semibold text-white/70">
          {PANTALLAS[i].pie}
        </p>
        <div className="flex items-center gap-1.5">
          {PANTALLAS.map((p, n) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setI(n)}
              aria-label={p.pie}
              aria-current={n === i}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
