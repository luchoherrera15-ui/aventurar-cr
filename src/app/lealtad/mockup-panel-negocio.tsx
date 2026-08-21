"use client";

import { useEffect, useRef, useState } from "react";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";
import LaptopMockup from "./laptop-mockup";

/**
 * EL MOCKUP DEL PANEL DEL NEGOCIO — las cinco cifras reales que ya
 * arma `ImpactoComercial` (panel/[id]/impacto-comercial.tsx), en una
 * vista de ejemplo con conteo animado y jerarquía real, adentro de
 * una laptop dibujada (`LaptopMockup`) — el contrapunto del teléfono
 * que protagoniza el resto de la página.
 *
 * No son cifras inventadas: son las MISMAS cinco columnas de esa
 * pantalla real —Ventas con Bookea, Compras registradas, Ticket
 * promedio, Clientes recurrentes, Recompensas canjeadas— con números
 * de utilería declarada ("Vista de ejemplo").
 *
 * Segunda pasada sobre este componente: la primera versión metía las
 * cinco en una grilla uniforme dentro de una tarjeta plana, y al lado
 * de los teléfonos —con su metal, su vidrio, su reflejo— se veía como
 * un genérico "dashboard de plantilla". Ahora "Ventas con Bookea" es
 * la cifra protagonista (con una curva decorativa que se dibuja sola
 * al entrar en pantalla — utilería visual, sin fechas ni ejes, para
 * no inventar una tendencia que `kpi.tsx` documenta que el panel real
 * nunca rellena), las otras cuatro son su fila de apoyo, y
 * "Recompensas canjeadas" usa el naranja del sistema — el mismo papel
 * que tiene en toda la página: lo que el cliente GANA.
 */

type Kpi = { rotulo: string; valor: number; prefijo?: string; icono: NombreIcono; detalle: string };

const VENTAS: Kpi = {
  rotulo: "Ventas con Bookea",
  valor: 184_500,
  prefijo: "₡",
  icono: "moneda",
  detalle: "últimos 30 días",
};

const SECUNDARIAS: Kpi[] = [
  { rotulo: "Compras registradas", valor: 62, icono: "escanear", detalle: "cada escaneo del mostrador" },
  { rotulo: "Ticket promedio", valor: 6_150, prefijo: "₡", icono: "metricas", detalle: "por compra con monto" },
  { rotulo: "Clientes recurrentes", valor: 23, icono: "repetir", detalle: "con 2 o más compras" },
  { rotulo: "Recompensas canjeadas", valor: 9, icono: "regalo", detalle: "premios entregados" },
];

const NAV: { icono: NombreIcono; etiqueta: string; activo?: boolean }[] = [
  { icono: "inicio", etiqueta: "Inicio" },
  { icono: "clientes", etiqueta: "Clientes" },
  { icono: "metricas", etiqueta: "Métricas", activo: true },
  { icono: "plan", etiqueta: "Paquete" },
];

/** El trazo decorativo detrás de "Ventas con Bookea": sube de
 *  izquierda a derecha, sin ejes ni fechas — no es un gráfico con
 *  datos, es la MISMA idea que un shimmer de carga: forma, no cifra. */
const TRAZO = "M2,32 C 16,30 22,26 32,27 C 44,28 48,16 62,17 C 76,18 80,8 96,9 C 108,10 112,3 124,2";
const LARGO_TRAZO = 210;

export default function MockupPanelNegocio() {
  const ref = useRef<HTMLDivElement>(null);
  const [animar, setAnimar] = useState(false);
  const [saltar, setSaltar] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- decide una sola vez, tras confirmar que el movimiento no es bienvenido
      setSaltar(true);
      return;
    }
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setSaltar(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setAnimar(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <LaptopMockup>
        {/* Barra superior */}
        <div className="flex items-center justify-between border-b border-[#edf0f5] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-lg text-[12px] font-extrabold text-white"
              style={{ background: "linear-gradient(145deg,#16295e,#0f4c9e)" }}
            >
              b
            </span>
            <span className="text-[13px] font-extrabold text-[#0d1733]">Café Aurora · Panel</span>
          </div>
          <span className="rounded-full bg-[#f2f4f8] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
            Vista de ejemplo
          </span>
        </div>

        <div className="grid sm:grid-cols-[148px_1fr]">
          <div className="hidden flex-col gap-1 border-r border-[#edf0f5] p-3 sm:flex">
            {NAV.map((n) => (
              <span
                key={n.etiqueta}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12px] font-bold"
                style={
                  n.activo
                    ? { background: "var(--accion-suave)", color: "var(--accion-fuerte)" }
                    : { color: "#8a91a4" }
                }
              >
                <Icono nombre={n.icono} className="h-4 w-4 shrink-0" />
                {n.etiqueta}
              </span>
            ))}
          </div>

          <div className="p-5 sm:p-7">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8a91a4]">
              Impacto comercial
            </p>

            {/* La cifra protagonista */}
            <div
              className="elevar mt-3.5 flex flex-col justify-between gap-4 rounded-2xl border border-[#e9ecf3] p-4 sm:flex-row sm:items-center sm:p-5"
              style={{ background: "linear-gradient(135deg,#f7f9fd 0%,#eef3fb 100%)" }}
            >
              <div>
                <span
                  aria-hidden
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ background: "white", color: "var(--accion-fuerte)", boxShadow: "0 4px 12px rgba(16,30,66,.08)" }}
                >
                  <Icono nombre={VENTAS.icono} className="h-[18px] w-[18px]" />
                </span>
                <p className="mt-2.5 text-[10.5px] font-bold uppercase tracking-wide text-[#6b7386]">
                  {VENTAS.rotulo}
                </p>
                <p className="mt-0.5 text-[30px] font-extrabold leading-tight tabular-nums text-[#0d1733] sm:text-[34px]">
                  <Cifra kpi={VENTAS} animar={animar} saltar={saltar} />
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[#8a91a4]">{VENTAS.detalle}</p>
              </div>

              <svg
                aria-hidden
                viewBox="0 0 128 36"
                className="h-9 w-full shrink-0 sm:w-[150px]"
                style={{ color: "var(--accion)" }}
              >
                <path
                  d={TRAZO}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: LARGO_TRAZO,
                    strokeDashoffset: saltar || animar ? 0 : LARGO_TRAZO,
                    transition: "stroke-dashoffset 1100ms var(--ease-bookea)",
                  }}
                />
              </svg>
            </div>

            {/* Las cuatro de apoyo */}
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {SECUNDARIAS.map((k) => {
                const esGanancia = k.rotulo === "Recompensas canjeadas";
                return (
                  <div
                    key={k.rotulo}
                    className="elevar rounded-2xl border border-[#edf0f5] bg-[#f9fafc] p-3.5"
                  >
                    <span
                      aria-hidden
                      className="grid h-8 w-8 place-items-center rounded-lg"
                      style={
                        esGanancia
                          ? { background: "var(--orange-suave)", color: "var(--orange-acento-claro)" }
                          : { background: "var(--accion-suave)", color: "var(--accion-fuerte)" }
                      }
                    >
                      <Icono nombre={k.icono} className="h-4 w-4" />
                    </span>
                    <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-[#8a91a4]">
                      {k.rotulo}
                    </p>
                    <p
                      className="mt-0.5 text-[17px] font-extrabold leading-tight tabular-nums"
                      style={{ color: esGanancia ? "var(--orange-acento-claro)" : "#0d1733" }}
                    >
                      <Cifra kpi={k} animar={animar} saltar={saltar} />
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-[#8a91a4]">{k.detalle}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </LaptopMockup>
    </div>
  );
}

function Cifra({ kpi, animar, saltar }: { kpi: Kpi; animar: boolean; saltar: boolean }) {
  const [valor, setValor] = useState(saltar ? kpi.valor : 0);

  useEffect(() => {
    if (saltar) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- salta directo al valor final, sin animación
      setValor(kpi.valor);
      return;
    }
    if (!animar) return;
    const inicio = performance.now();
    const DURACION_MS = 900;
    let cuadro: number;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS);
      const suavizado = 1 - (1 - t) ** 3;
      setValor(Math.round(kpi.valor * suavizado));
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [animar, saltar, kpi.valor]);

  return (
    <>
      {kpi.prefijo}
      {new Intl.NumberFormat("es-CR").format(valor)}
    </>
  );
}
