"use client";

import { useEffect, useState } from "react";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * EL MOCKUP DEL PANEL DEL NEGOCIO — segunda pasada (pedido del dueño):
 * la primera versión metía las cifras dentro de una laptop dibujada
 * (`LaptopMockup`) y el menú de la izquierda era puro decorado —cuatro
 * ítems que no llevaban a ningún lado—. Ahora es un panel PROPIO, sin
 * marco de laptop, y las CUATRO pestañas navegan de verdad: Inicio
 * (las cifras protagonistas), Clientes (quién vino, cuándo se le sumó
 * el último sello, cuánto gastó), Métricas (un gráfico de ventas de
 * la semana) y Paquete (el plan y sus tres topes). Vista de ejemplo en
 * las cuatro — se sigue diciendo, ahora en cada pestaña — no son datos
 * de un negocio real.
 */

/** true = el visitante pidió menos movimiento; los contadores y el
 *  gráfico saltan directo a su valor final en vez de animar. */
function movimientoReducido(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Pestana = "inicio" | "clientes" | "metricas" | "paquete";

const NAV: { id: Pestana; icono: NombreIcono; etiqueta: string }[] = [
  { id: "inicio", icono: "inicio", etiqueta: "Inicio" },
  { id: "clientes", icono: "clientes", etiqueta: "Clientes" },
  { id: "metricas", icono: "metricas", etiqueta: "Métricas" },
  { id: "paquete", icono: "plan", etiqueta: "Paquete" },
];

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

const CLIENTES_EJEMPLO = [
  { nombre: "Ana Fernández", ultimoSello: "Hoy, 2:30pm", sellos: "5/6", gastado: 42_000 },
  { nombre: "Carlos Mora", ultimoSello: "Ayer, 11:15am", sellos: "3/6", gastado: 18_500 },
  { nombre: "Vale Rodríguez", ultimoSello: "Hace 3 días", sellos: "6/6", gastado: 65_000 },
  { nombre: "José Solano", ultimoSello: "Hace 5 días", sellos: "2/6", gastado: 9_800 },
  { nombre: "Camila Ureña", ultimoSello: "Hace 1 semana", sellos: "4/6", gastado: 31_200 },
];

const VENTAS_SEMANA = [
  { dia: "Lun", miles: 18 },
  { dia: "Mar", miles: 24 },
  { dia: "Mié", miles: 15 },
  { dia: "Jue", miles: 32 },
  { dia: "Vie", miles: 41 },
  { dia: "Sáb", miles: 52 },
  { dia: "Dom", miles: 28 },
];
const MAX_SEMANA = Math.max(...VENTAS_SEMANA.map((d) => d.miles));

const PAQUETE_EJEMPLO = {
  nombre: "Impulso",
  precio: "$42/mes",
  topes: [
    { etiqueta: "Clientes afiliados", usado: 312, tope: 1_000 },
    { etiqueta: "Tarjetas publicadas", usado: 3, tope: 5 },
    { etiqueta: "Anuncios este mes", usado: 8, tope: 15 },
  ],
};

export default function MockupPanelNegocio() {
  const [pestana, setPestana] = useState<Pestana>("inicio");

  return (
    <div className="overflow-hidden rounded-3xl border border-[#e6eaf3] bg-white shadow-[0_35px_80px_-25px_rgba(0,0,0,.45)]">
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
        {/* El menú — las cuatro pestañas navegan de verdad */}
        <div className="hidden flex-col gap-1 border-r border-[#edf0f5] p-3 sm:flex">
          {NAV.map((n) => {
            const activo = n.id === pestana;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setPestana(n.id)}
                aria-pressed={activo}
                className="presionable flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-bold transition-colors"
                style={activo ? { background: "var(--accion-suave)", color: "var(--accion-fuerte)" } : { color: "#8a91a4" }}
              >
                <Icono nombre={n.icono} className="h-4 w-4 shrink-0" />
                {n.etiqueta}
              </button>
            );
          })}
        </div>

        {/* Pestañas de mobile: mismo set, en fila arriba del contenido */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-[#edf0f5] p-3 sm:hidden">
          {NAV.map((n) => {
            const activo = n.id === pestana;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setPestana(n.id)}
                aria-pressed={activo}
                className="presionable flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors"
                style={activo ? { background: "var(--accion-suave)", color: "var(--accion-fuerte)" } : { background: "#f2f4f8", color: "#8a91a4" }}
              >
                <Icono nombre={n.icono} className="h-3.5 w-3.5 shrink-0" />
                {n.etiqueta}
              </button>
            );
          })}
        </div>

        <div key={pestana} className="entra-suave p-5 sm:p-7">
          {pestana === "inicio" && <VistaInicio />}
          {pestana === "clientes" && <VistaClientes />}
          {pestana === "metricas" && <VistaMetricas />}
          {pestana === "paquete" && <VistaPaquete />}
        </div>
      </div>
    </div>
  );
}

function VistaInicio() {
  const [animar, setAnimar] = useState(false);
  const [reducido] = useState(movimientoReducido);
  useEffect(() => {
    const t = setTimeout(() => setAnimar(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8a91a4]">
        Impacto comercial
      </p>

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
          <p className="mt-2.5 text-[10.5px] font-bold uppercase tracking-wide text-[#6b7386]">{VENTAS.rotulo}</p>
          <p className="mt-0.5 text-[30px] font-extrabold leading-tight tabular-nums text-[#0d1733] sm:text-[34px]">
            <Cifra kpi={VENTAS} animar={animar} />
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#8a91a4]">{VENTAS.detalle}</p>
        </div>

        <svg aria-hidden viewBox="0 0 128 36" className="h-9 w-full shrink-0 sm:w-[150px]" style={{ color: "var(--accion)" }}>
          <path
            d="M2,32 C 16,30 22,26 32,27 C 44,28 48,16 62,17 C 76,18 80,8 96,9 C 108,10 112,3 124,2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 210,
              strokeDashoffset: animar ? 0 : 210,
              transition: reducido ? "none" : "stroke-dashoffset 1100ms var(--ease-bookea)",
            }}
          />
        </svg>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {SECUNDARIAS.map((k) => {
          const esGanancia = k.rotulo === "Recompensas canjeadas";
          return (
            <div key={k.rotulo} className="elevar rounded-2xl border border-[#edf0f5] bg-[#f9fafc] p-3.5">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={esGanancia ? { background: "var(--orange-suave)", color: "var(--orange-acento-claro)" } : { background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
              >
                <Icono nombre={k.icono} className="h-4 w-4" />
              </span>
              <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-[#8a91a4]">{k.rotulo}</p>
              <p className="mt-0.5 text-[17px] font-extrabold leading-tight tabular-nums" style={{ color: esGanancia ? "var(--orange-acento-claro)" : "#0d1733" }}>
                <Cifra kpi={k} animar={animar} />
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-[#8a91a4]">{k.detalle}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

function VistaClientes() {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8a91a4]">
          Clientes recientes
        </p>
        <span className="text-[11px] font-bold text-[#8a91a4]">5 de 312</span>
      </div>

      <div className="mt-3.5 flex flex-col gap-2">
        {CLIENTES_EJEMPLO.map((c) => (
          <div
            key={c.nombre}
            className="flex items-center gap-3 rounded-2xl border border-[#edf0f5] bg-[#f9fafc] px-3.5 py-3"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white"
              style={{ background: "linear-gradient(145deg,#16295e,#0f4c9e)" }}
            >
              {c.nombre.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[#0d1733]">{c.nombre}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-[#8a91a4]">
                <Icono nombre="reloj" className="h-3 w-3 shrink-0" />
                Último sello: {c.ultimoSello}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12.5px] font-extrabold tabular-nums text-[#0d1733]">
                ₡{c.gastado.toLocaleString("es-CR")}
              </p>
              <p className="mt-0.5 text-[10px] font-bold text-[#8a91a4]">{c.sellos} sellos</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function VistaMetricas() {
  const [animar, setAnimar] = useState(false);
  const [reducido] = useState(movimientoReducido);
  useEffect(() => {
    const t = setTimeout(() => setAnimar(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8a91a4]">
        Ventas de la semana
      </p>

      <div className="mt-4 flex items-end justify-between gap-2 rounded-2xl border border-[#e9ecf3] bg-[#f9fafc] px-4 pb-3 pt-5 sm:px-5">
        {VENTAS_SEMANA.map((d, i) => (
          <div key={d.dia} className="flex flex-1 flex-col items-center gap-1.5">
            <p className="text-[9.5px] font-extrabold tabular-nums text-[#0d1733]">₡{d.miles}k</p>
            <div className="flex h-24 w-full items-end overflow-hidden rounded-md bg-[#e9ecf3]">
              <div
                className="w-full rounded-md ease-out"
                style={{
                  height: animar ? `${(d.miles / MAX_SEMANA) * 100}%` : "0%",
                  transition: reducido ? "none" : "height 700ms",
                  transitionDelay: reducido ? "0ms" : `${i * 70}ms`,
                  background: d.miles === MAX_SEMANA ? "var(--orange)" : "var(--accion)",
                }}
              />
            </div>
            <p className="text-[10px] font-bold text-[#8a91a4]">{d.dia}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-[#edf0f5] bg-[#f9fafc] p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a91a4]">Mejor día</p>
          <p className="mt-0.5 text-[15px] font-extrabold text-[#0d1733]">Sábado · ₡52.000</p>
        </div>
        <div className="rounded-2xl border border-[#edf0f5] bg-[#f9fafc] p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a91a4]">Promedio diario</p>
          <p className="mt-0.5 text-[15px] font-extrabold text-[#0d1733]">₡30.000</p>
        </div>
      </div>
    </>
  );
}

function VistaPaquete() {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8a91a4]">Tu paquete</p>
        <span
          className="rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase leading-none tracking-wide"
          style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
        >
          {PAQUETE_EJEMPLO.precio}
        </span>
      </div>
      <p className="mt-2 text-[22px] font-extrabold text-[#0d1733]">{PAQUETE_EJEMPLO.nombre}</p>

      <div className="mt-4 flex flex-col gap-3">
        {PAQUETE_EJEMPLO.topes.map((t) => {
          const pct = Math.min(100, Math.round((t.usado / t.tope) * 100));
          return (
            <div key={t.etiqueta}>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-bold text-[#0d1733]">{t.etiqueta}</span>
                <span className="font-bold text-[#8a91a4]">
                  {t.usado.toLocaleString("es-CR")} / {t.tope.toLocaleString("es-CR")}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#edf0f5]">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: "var(--accion)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Cifra({ kpi, animar }: { kpi: Kpi; animar: boolean }) {
  // Inicializador perezoso: con movimiento reducido el valor final ya
  // nace puesto, así que el efecto de abajo no necesita un setState
  // síncrono para "saltar" — solo se queda quieto.
  const [valor, setValor] = useState(() => (movimientoReducido() ? kpi.valor : 0));

  useEffect(() => {
    if (!animar || movimientoReducido()) return;
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
  }, [animar, kpi.valor]);

  return (
    <>
      {kpi.prefijo}
      {new Intl.NumberFormat("es-CR").format(valor)}
    </>
  );
}
