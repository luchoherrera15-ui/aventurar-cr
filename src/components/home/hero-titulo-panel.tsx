"use client";

import Link from "next/link";
import { useState } from "react";
import { MarcoTelefono } from "./carrusel-hero-servicios";

/**
 * EL HÉROE — título enorme + botón a la izquierda, el panel del
 * negocio a la derecha. Reemplaza al héroe con el desfile de
 * teléfonos: esos mockups pasaron a ser su propia sección, más abajo
 * (`CarruselServicios`, la de "Todo lo que Bookea te da").
 *
 * SEGUNDA PASADA (pedido del dueño): la primera versión reusaba
 * `MockupPanelNegocio` (el panel dentro de una laptop dibujada) tal
 * cual — "no me pongas una PC solo como el dashboard [quieto]". Ahora
 * es un panel PROPIO de esta pantalla, sin marco de laptop, con un
 * botón de verdad ("Enviar 20% OFF a todos los pases") que dispara
 * una notificación animada en el teléfono de al lado — la misma idea
 * que ya cuenta el video de la primera diapositiva del carrusel viejo
 * (`walletheader.mp4`: "Enviar promoción" → notificación en el
 * teléfono), pero interactiva de verdad en vez de un video que se
 * mira pasar.
 */

const TRAZO = "M2,30 C 16,28 22,24 32,25 C 44,26 48,14 62,15 C 76,16 80,6 96,7 C 108,8 112,1 124,0";
const LARGO_TRAZO = 210;

function PanelInteractivo() {
  const [enviando, setEnviando] = useState(false);
  const [notifVisible, setNotifVisible] = useState(false);
  const [tanda, setTanda] = useState(0);

  function enviarPromocion() {
    if (enviando) return;
    setEnviando(true);
    setNotifVisible(false);
    setTimeout(() => {
      setTanda((n) => n + 1);
      setNotifVisible(true);
      setEnviando(false);
    }, 650);
    setTimeout(() => setNotifVisible(false), 650 + 4200);
  }

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center lg:justify-start">
      {/* ── El panel: gráfico + sumas + botón de verdad ── */}
      <div className="w-full max-w-[360px] rounded-3xl border border-white/10 bg-white p-5 shadow-[0_35px_80px_-25px_rgba(0,0,0,.45)] sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
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

        <div
          className="mt-4 rounded-2xl border border-[#e9ecf3] p-4"
          style={{ background: "linear-gradient(135deg,#f7f9fd 0%,#eef3fb 100%)" }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#6b7386]">
            Ventas con Bookea
          </p>
          <p className="mt-0.5 text-[28px] font-extrabold leading-tight tabular-nums text-[#0d1733]">
            ₡184.500
          </p>
          <svg aria-hidden viewBox="0 0 128 34" className="mt-1.5 h-8 w-full" style={{ color: "var(--navy)" }}>
            <path
              d={TRAZO}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: LARGO_TRAZO, strokeDashoffset: 0 }}
            />
          </svg>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-[#edf0f5] bg-[#f9fafc] p-3">
            <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#8a91a4]">
              Clientes recurrentes
            </p>
            <p className="mt-0.5 text-[16px] font-extrabold tabular-nums text-[#0d1733]">23</p>
          </div>
          <div className="rounded-xl border border-[#edf0f5] bg-[#f9fafc] p-3">
            <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#8a91a4]">
              Recompensas canjeadas
            </p>
            <p className="mt-0.5 text-[16px] font-extrabold tabular-nums" style={{ color: "var(--orange)" }}>
              9
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={enviarPromocion}
          disabled={enviando}
          className="presionable mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-extrabold text-white transition-transform hover:scale-[1.01] disabled:opacity-70"
          style={{ background: "var(--navy)" }}
        >
          {enviando ? "Enviando…" : "📣 Enviar 20% OFF a todos los pases"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-snug text-[#8a91a4]">
          Tocá el botón y mirá cómo le llega al teléfono →
        </p>
      </div>

      {/* ── El teléfono que recibe la promo ── */}
      <div className="relative shrink-0">
        <MarcoTelefono>
          <div className="flex h-full flex-col items-center bg-gradient-to-b from-[#0a1226] to-[#16295e] px-3 pt-6">
            <p className="text-[11px] font-semibold text-white/45">9:41</p>
            <p className="mt-1 text-[13.5px] font-bold text-white/75">martes 24</p>
          </div>
        </MarcoTelefono>

        <div
          key={tanda}
          className={`absolute left-1/2 top-9 z-20 w-[190px] -translate-x-1/2 rounded-2xl border border-white/15 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-500 ${
            notifVisible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-extrabold text-white"
              style={{ background: "linear-gradient(145deg,#16295e,#0f4c9e)" }}
            >
              b
            </span>
            <p className="text-[9.5px] font-bold uppercase tracking-wide text-zinc-500">
              Bookea Wallet · ahora
            </p>
          </div>
          <p className="mt-1 text-[12.5px] font-extrabold text-[#0b2447]">🎉 20% OFF hoy</p>
          <p className="mt-0.5 text-[10.5px] leading-snug text-zinc-500">
            En tu próxima visita a Café Aurora
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HeroTituloPanel() {
  return (
    <section className="relative overflow-hidden bg-[color:var(--navy)] py-16 sm:py-20 lg:py-24">
      {/* El resplandor: dos manchas naranjas bien difuminadas detrás de
          todo — pedido del dueño, "un poco de blur con naranja". Bajo
          opacidad y `blur-3xl` para que sea clima, no una forma que
          compita con el título o el panel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orange) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orange) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto grid max-w-[1200px] items-center gap-12 px-5 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
        <div className="text-center lg:text-left">
          <h1 className="titulo text-[clamp(38px,6vw,72px)] leading-[1.03] text-white">
            ¡Te ayudamos a impulsar tus ventas!
          </h1>
          <p className="mx-auto mt-5 max-w-[46ch] text-[clamp(15px,1.6vw,18px)] leading-relaxed text-white/70 lg:mx-0">
            Lealtad, automatización por WhatsApp, invitaciones digitales y marketplace — las
            cuatro herramientas de Bookea, trabajando juntas para que consigas y te quedes
            con más clientes.
          </p>

          <Link
            href="/publicar"
            className="presionable motion-safe:animate-bounce mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-extrabold shadow-[0_18px_40px_rgba(243,146,0,.35)]"
            style={{ background: "var(--orange)", color: "#fff" }}
          >
            ¡Comience a trabajar con nosotros! →
          </Link>
        </div>

        <div className="mx-auto w-full max-w-[560px] lg:max-w-none">
          <PanelInteractivo />
        </div>
      </div>
    </section>
  );
}
