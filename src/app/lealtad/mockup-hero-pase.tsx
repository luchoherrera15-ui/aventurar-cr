"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FICHAS } from "./contenido-tipos";

/**
 * LA COMPOSICIÓN ANIMADA DEL HERO — ahora cicla TRES tipos de pase, no
 * uno solo (pedido: "que se cambien los diferentes tipos de pases...
 * que informe"). Cada vuelta cuenta la misma historia completa —sube,
 * llega a la meta, canjea, aparece "¡Felicidades!"— pero con el tipo,
 * el negocio, los colores y el texto REALES de `contenido-tipos.ts`
 * (la misma fuente que usa el selector de "Soluciones"): sellos →
 * puntos → cashback → vuelve a sellos.
 *
 * Solo se ciclan los TRES tipos que "acumulan" con un número que sube
 * (`tipos-tarjeta.ts`: sellos, puntos, cashback): un cupón o una
 * membresía no tienen una barra de progreso que mostrar, y forzarles
 * una inventaría una mecánica que el producto no tiene.
 *
 * Respeta `prefers-reduced-motion`: si la persona pidió menos
 * movimiento, el mockup queda quieto en el primer tipo (sellos, 7/10)
 * — la versión estática de siempre. La animación es azúcar, no
 * información.
 *
 * "Café Aurora" y "María González" (sellos) siguen siendo la utilería
 * propia del hero (pedido del dueño, ago 2026) — no se tocan. Puntos y
 * cashback usan el negocio de ejemplo real de esos tipos (Súper La
 * Cosecha, Lavacar El Rayo) para que el hero cuente la MISMA historia
 * que el resto de la página, no una tercera y cuarta marca inventada.
 */

type Fase = "sumando" | "completa" | "canje";

type DemoTipo = {
  negocio: string;
  /** [fondo, medio, claro] — medio no se usa acá, solo fondo y acento. */
  colores: readonly [string, string, string];
  etiqueta: string;
  inicio: number;
  meta: number;
  paso: number;
  /** Si lleva grilla de sellos (círculos) o un número grande. */
  esSellos: boolean;
  formato: (n: number) => string;
  /** El detalle debajo del valor: mismo dato que ya muestra el resto de la página para este tipo. */
  filaSecundaria: { etiqueta: string; valor: string };
  faltan: (restante: number) => string;
  logrado: string;
  recompensa: string;
  popup: { titulo: string; sub: string; detalle: string };
  notificacion: { titulo: string; texto: (valor: number) => string };
};

const DEMOS: DemoTipo[] = [
  {
    negocio: "Café Aurora",
    colores: ["#0a1226", "#16295e", "#0f4c9e"],
    etiqueta: "Sellos",
    inicio: 4,
    meta: 10,
    paso: 1,
    esSellos: true,
    formato: (n) => `${n}/10`,
    filaSecundaria: { etiqueta: "Cliente", valor: "María González" },
    faltan: (restante) => `Te faltan ${restante} sellos para tu café ☕`,
    logrado: "¡Tarjeta completa! 🎉",
    recompensa: "Café gratis",
    popup: {
      titulo: "¡Felicidades!",
      sub: "Reclamaste tu recompensa",
      detalle: "Café gratis · Café Aurora — tu tarjeta arranca otra vuelta sola.",
    },
    notificacion: {
      titulo: "✓ Nuevo sello agregado",
      texto: (v) => `Llevás ${v}/10 sellos en Café Aurora.`,
    },
  },
  {
    negocio: FICHAS.puntos.negocio,
    colores: FICHAS.puntos.colores,
    etiqueta: "Puntos",
    inicio: 140,
    meta: 200,
    paso: 10,
    esSellos: false,
    formato: (n) => `${n}`,
    filaSecundaria: FICHAS.puntos.detalle[2] ?? { etiqueta: "Canje mínimo", valor: "200 pts" },
    faltan: (restante) => `Te faltan ${restante} puntos para poder canjear`,
    logrado: "¡Ya podés canjear! 🎁",
    recompensa: "Canjear premio",
    popup: {
      titulo: "¡Buenísimo!",
      sub: "Ya podés canjear tus puntos",
      detalle: `200 puntos · ${FICHAS.puntos.negocio} — seguís sumando desde acá.`,
    },
    notificacion: {
      titulo: "✓ Puntos actualizados",
      texto: (v) => `Llevás ${v} puntos en ${FICHAS.puntos.negocio}.`,
    },
  },
  {
    negocio: FICHAS.cashback.negocio,
    colores: FICHAS.cashback.colores,
    etiqueta: "Saldo",
    inicio: 1500,
    meta: 3000,
    paso: 250,
    esSellos: false,
    formato: (n) => `₡${n.toLocaleString("es-CR")}`,
    filaSecundaria: FICHAS.cashback.detalle[0] ?? { etiqueta: "Devolución", valor: "5% de cada compra" },
    faltan: (restante) => `Te faltan ₡${restante.toLocaleString("es-CR")} de vuelta`,
    logrado: "¡Ya tenés saldo! 🚗",
    recompensa: "Usar en tu próximo lavado",
    popup: {
      titulo: "¡Ya se sumó!",
      sub: "Tenés saldo para tu próximo lavado",
      detalle: `₡3.000 de cashback · ${FICHAS.cashback.negocio} — seguís ganando con cada visita.`,
    },
    notificacion: {
      titulo: "✓ Cashback acreditado",
      texto: (v) => `Llevás ₡${v.toLocaleString("es-CR")} en ${FICHAS.cashback.negocio}.`,
    },
  },
];

/** Lo que se ve si el movimiento no es bienvenido: sellos, a mitad de camino. */
const VALOR_ESTATICO = 7;

export default function MockupHeroPase() {
  const [demoIdx, setDemoIdx] = useState(0);
  const [valor, setValor] = useState(VALOR_ESTATICO);
  const [fase, setFase] = useState<Fase>("sumando");
  const [animar, setAnimar] = useState(false);

  const demo = DEMOS[demoIdx];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return; // quieto: sellos, 7/10
    // eslint-disable-next-line react-hooks/set-state-in-effect -- arranca el loop una sola vez, tras confirmar que el movimiento es bienvenido
    setAnimar(true);
    setValor(7);
  }, []);

  useEffect(() => {
    if (!animar) return;
    let t: ReturnType<typeof setTimeout>;
    if (fase === "sumando") {
      if (valor < demo.meta) {
        t = setTimeout(() => setValor((v) => Math.min(demo.meta, v + demo.paso)), valor === demo.inicio ? 1400 : 950);
      } else {
        t = setTimeout(() => setFase("completa"), 700);
      }
    } else if (fase === "completa") {
      t = setTimeout(() => setFase("canje"), 1300);
    } else {
      t = setTimeout(() => {
        const siguiente = (demoIdx + 1) % DEMOS.length;
        setDemoIdx(siguiente);
        setValor(DEMOS[siguiente].inicio);
        setFase("sumando");
      }, 3600);
    }
    return () => clearTimeout(t);
  }, [animar, fase, valor, demo, demoIdx]);

  const canjeada = fase === "canje";
  const restante = Math.max(0, demo.meta - valor);
  const progresoPct = Math.round((valor / demo.meta) * 100);

  return (
    <div className="relative flex h-[560px] items-center justify-center sm:h-[640px]">
      {/* ── "¡Ver demos!" — arriba a la derecha del mockup, por encima
          de la tarjeta de "Personalizá tu tarjeta" (que empieza más
          abajo, en top-[68px]). Rebota para que no se confunda con el
          resto de piezas quietas de la composición; `motion-safe:`
          hace que quien pidió menos movimiento la vea fija en vez de
          rebotando — mismo criterio que ya usa el resto del sitio. */}
      <Link
        href="/lealtad/demo"
        className="presionable motion-safe:animate-bounce absolute -top-2 right-0 z-[9] rounded-full px-3.5 py-2 text-[11.5px] font-extrabold shadow-[0_14px_30px_rgba(243,146,0,.35)] sm:-top-3 lg:-right-2"
        style={{ background: "var(--orange)", color: "#fff" }}
      >
        ¡Ver demos! →
      </Link>

      {/* ── El teléfono ─────────────────────────────────────────── */}
      <div
        className="relative z-[4] h-[560px] w-[300px] rotate-[1.5deg] rounded-[46px] p-[9px] sm:h-[600px] sm:w-[322px]"
        style={{
          background: "linear-gradient(145deg,#121827,#3d4557 50%,#0c101a)",
          boxShadow: "0 45px 90px rgba(10,18,38,.28), 0 8px 25px rgba(10,18,38,.14)",
        }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-[15px] z-[8] h-[26px] w-[100px] -translate-x-1/2 rounded-[18px] bg-[#070b12]"
        />
        <div className="relative h-full overflow-hidden rounded-[38px] bg-[#f7f8fb]">
          <div className="flex justify-between px-5 pt-4 text-[11px] font-bold text-[#0d1733]">
            <span>9:41</span>
            <span aria-hidden>● ◒ ▰</span>
          </div>
          <div className="flex items-center justify-between px-6 pb-3 pt-2">
            <span className="text-[23px] font-extrabold text-[#0d1733]">Wallet</span>
            <span aria-hidden className="text-[19px] text-[#0d1733]/60">⊕</span>
          </div>

          {/* ── La tarjeta — cambia de tipo, negocio y color ─────── */}
          <div
            className="relative mx-4 overflow-hidden rounded-[20px] p-5 text-white transition-[background,box-shadow] duration-500"
            style={{
              background: `linear-gradient(145deg,${demo.colores[0]} 0%,${demo.colores[1]} 52%,${demo.colores[2]} 100%)`,
              boxShadow: canjeada
                ? "0 20px 44px rgba(238,116,32,.35)"
                : "0 20px 40px rgba(10,24,60,.24)",
            }}
          >
            <span
              aria-hidden
              className="absolute -right-16 -top-16 h-[190px] w-[190px] rounded-full bg-white/[0.09]"
            />
            <div className="flex items-center justify-between text-[12px] font-bold">
              <span className="truncate">{demo.negocio}</span>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white text-[13px] font-extrabold text-[#16295e]">
                b
              </span>
            </div>
            <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">
              {demo.etiqueta}
            </p>
            <p className="text-[34px] font-extrabold leading-tight tracking-tight tabular-nums">
              {demo.formato(valor)}
            </p>
            <div className="mt-4 flex justify-between text-[8.5px] font-bold uppercase tracking-wide text-white/75">
              <span>{demo.filaSecundaria.etiqueta}</span>
              <span>{demo.esSellos ? "Regalía" : "Detalle"}</span>
            </div>
            <div className="mt-0.5 flex justify-between text-[11.5px] font-extrabold">
              <span className="truncate">{demo.filaSecundaria.valor}</span>
              <span
                className={canjeada ? "rounded-md px-1.5 transition-colors" : "shrink-0 transition-colors"}
                style={{
                  color: canjeada ? "#0a1226" : "var(--orange-claro)",
                  background: canjeada ? "var(--orange-claro)" : "transparent",
                }}
              >
                {demo.esSellos ? demo.recompensa : demo.etiqueta.toLowerCase()}
              </span>
            </div>

            {/* Grilla de sellos SOLO para el tipo que acumula así — los
                otros dos muestran su progreso en el número grande de
                arriba, ya animado, así que acá va una barra continua en
                vez de forzar diez círculos que no representan nada. */}
            {demo.esSellos ? (
              <div className="mt-4 grid grid-cols-10 gap-1.5">
                {Array.from({ length: demo.meta }, (_, i) => {
                  const lleno = i < valor;
                  const recien = animar && fase === "sumando" && i === valor - 1 && valor > demo.inicio;
                  return (
                    <span
                      key={i}
                      className={`grid h-[18px] place-items-center rounded-full border text-[7px] font-bold transition-all duration-300 ${
                        lleno
                          ? "border-white bg-white text-[#16295e]"
                          : "border-white/45 text-white/70"
                      } ${recien ? "ring-2 ring-white/70" : ""}`}
                    >
                      {lleno ? "✓" : i + 1}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 h-[6px] overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, progresoPct)}%` }}
                />
              </div>
            )}

            <p className="mt-4 text-center text-[9px] font-bold text-white/85" aria-live="polite">
              {fase === "sumando" && valor < demo.meta && demo.faltan(restante)}
              {fase === "sumando" && valor >= demo.meta && demo.logrado}
              {fase === "completa" && demo.logrado}
              {canjeada && `Canjeado: ${demo.recompensa} — arrancás de nuevo`}
            </p>
          </div>

          <div className="mx-auto mt-5 grid h-[76px] w-[76px] place-items-center rounded-xl bg-white shadow-[0_10px_26px_rgba(13,23,51,.10)]">
            <span
              aria-hidden
              className="h-[48px] w-[48px] opacity-90"
              style={{
                background:
                  "linear-gradient(90deg,#111 10%,transparent 10% 20%,#111 20% 30%,transparent 30% 42%,#111 42% 54%,transparent 54% 63%,#111 63% 74%,transparent 74% 82%,#111 82%)," +
                  "linear-gradient(#111 10%,transparent 10% 20%,#111 20% 30%,transparent 30% 42%,#111 42% 54%,transparent 54% 63%,#111 63% 74%,transparent 74% 82%,#111 82%)",
              }}
            />
          </div>
          <p className="mt-1.5 text-center text-[8px] font-bold text-[#6d7484]">
            Código del cliente
          </p>
          <div className="mx-4 mt-3 rounded-xl border border-[#e6e8ee] bg-white p-3 text-center text-[11px] font-bold text-[#0d1733]">
             Agregar a Apple Wallet
          </div>
        </div>
      </div>

      {/* ── Puntitos de progreso: qué tipo se está mostrando ahora ──
          Nuevo (pedido: "que informe"): sin esto, alguien que mira 2
          segundos no se entera de que hay TRES tipos ciclando — solo
          vería un número cambiar. Tres puntos, uno resaltado, dicen
          "esto se adapta a tu negocio" sin una palabra. */}
      <div
        aria-hidden
        className="absolute -bottom-2 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-1.5 sm:bottom-1"
      >
        {DEMOS.map((d, i) => (
          <span
            key={d.etiqueta}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: i === demoIdx ? 18 : 6,
              background: i === demoIdx ? "var(--accion)" : "rgba(15,40,90,.18)",
            }}
          />
        ))}
      </div>

      {/* ── Flotante: personalización (arriba derecha, solo desde sm) ── */}
      <div
        className="absolute right-0 top-[68px] z-[7] hidden w-[176px] rounded-2xl border border-[#e6eaf3]/90 bg-white/95 p-4 backdrop-blur-xl sm:block lg:-right-3"
        style={{ boxShadow: "0 22px 55px rgba(16,30,66,.15)" }}
      >
        <h4 className="text-[11px] font-extrabold text-[#0d1733]">Personalizá tu tarjeta</h4>
        <div className="mt-2 flex items-center justify-between border-t border-[#edf0f5] py-2 text-[9.5px] font-bold text-[#667085]">
          <span>Logo</span>
          <span aria-hidden>☕</span>
        </div>
        <div className="flex items-center justify-between border-t border-[#edf0f5] py-2 text-[9.5px] font-bold text-[#667085]">
          <span>Color</span>
          <span
            aria-hidden
            className="h-[17px] w-[17px] rounded-full border-[3px] border-[#eef3fb]"
            style={{ background: "linear-gradient(135deg,#16295e,#0f4c9e)" }}
          />
        </div>
        <div className="flex items-center justify-between border-t border-[#edf0f5] py-2 text-[9.5px] font-bold text-[#667085]">
          <span>Regalía</span>
          <span className="font-extrabold" style={{ color: "var(--orange-acento-claro)" }}>
            Café gratis
          </span>
        </div>
        <div
          className="mt-1.5 rounded-lg py-2 text-center text-[9px] font-extrabold text-white"
          style={{ background: "var(--accion)" }}
        >
          Guardar cambios
        </div>
      </div>

      {/* ── Flotante inferior: notificación o FELICIDADES ────────────
          Centrada bajo el teléfono en móvil (donde el panel de arriba
          está oculto): antes vivía pegada a `left-0`, y sin la tarjeta
          de la derecha para hacerle contrapeso la composición se leía
          corrida — pedido explícito: "que el iPhone se vea centrado". */}
      {canjeada ? (
        <div
          key="popup"
          className="entra-suave absolute bottom-[54px] left-1/2 z-[7] w-[240px] -translate-x-1/2 rounded-2xl border-2 bg-white px-4 py-4 sm:bottom-[44px] sm:left-2 sm:translate-x-0 lg:left-0"
          style={{
            borderColor: "var(--orange-acento-claro)",
            boxShadow: "0 26px 60px rgba(200,100,20,.28)",
          }}
          role="status"
        >
          <p aria-hidden className="text-[26px] leading-none">🎉</p>
          <p className="mt-1.5 text-[15px] font-extrabold leading-tight text-[#0d1733]">
            {demo.popup.titulo}
          </p>
          <p className="mt-0.5 text-[12px] font-bold leading-snug" style={{ color: "var(--orange-acento-claro)" }}>
            {demo.popup.sub}
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-[#667085]">{demo.popup.detalle}</p>
        </div>
      ) : (
        <div
          key="notificacion"
          className="absolute bottom-[64px] left-1/2 z-[7] w-[218px] -translate-x-1/2 rounded-2xl border border-[#e6eaf3]/90 bg-white/95 px-4 py-3.5 backdrop-blur-xl sm:bottom-[54px] sm:left-2 sm:translate-x-0 lg:left-0"
          style={{ boxShadow: "0 22px 55px rgba(16,30,66,.15)" }}
        >
          <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#8a91a4]">
            Bookea Lealtad · Ahora
          </p>
          <p className="mt-1 text-[12px] font-extrabold text-[#0d1733]">
            {fase === "completa" || valor >= demo.meta ? demo.logrado : demo.notificacion.titulo}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#667085]">
            {demo.notificacion.texto(valor)}
          </p>
        </div>
      )}
    </div>
  );
}
