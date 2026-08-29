"use client";

import { useEffect, useState } from "react";
import { useMockupVivo } from "./use-mockup-vivo";

/**
 * LA COMPOSICIÓN ANIMADA DE «MARKETING» (pedido del dueño, ago 2026):
 * a la izquierda la tarjetita del panel donde el anuncio SE ESCRIBE
 * SOLO con efecto de tipeo y el botón «Enviar» se presiona al
 * terminar; a la derecha un iPhone en pantalla de bloqueo donde la
 * notificación LLEGA deslizándose desde arriba. Es la función real de
 * la sección Marketing del panel (`enviarNotificacionPromocional`,
 * cupo por paquete de la 0183) contada en un loop de ~10 segundos.
 *
 * Mismo patrón de timers encadenados que mockup-hero-pase.tsx, y la
 * misma regla con `prefers-reduced-motion`: si la persona pidió menos
 * movimiento, todo queda quieto con el anuncio ya escrito y la
 * notificación ya visible — la animación es azúcar, no información.
 * Desde la auditoría de rendimiento la regla también vale para el
 * scroll: el reloj corre solo con el mockup a la vista (`useMockupVivo`).
 *
 * "Café Aurora" es la misma utilería declarada del hero, nunca un
 * negocio real. El texto del anuncio también es utilería.
 */

const MENSAJE = "Te extrañamos ☕ Esta semana, doble sello en tu bebida favorita";

type Fase = "tipeo" | "envio" | "notificacion" | "reinicio";

export default function MockupAnuncios() {
  // Arranca en el estado FINAL (texto completo y notificación puesta):
  // es lo que se queda quieto si el movimiento no es bienvenido — el
  // mismo criterio que el 7/10 estático del hero.
  const [letras, setLetras] = useState(MENSAJE.length);
  const [fase, setFase] = useState<Fase>("notificacion");

  // `vivo` reemplaza al viejo `animar`: además de la preferencia de
  // movimiento, mira si el mockup está cerca del viewport, así el
  // typewriter no gasta hilo principal mientras el visitante lee otra
  // parte de la página. Y el reset del montaje sobra: el loop entra
  // por `notificacion` —que ES el estado inicial— y de ahí gira solo,
  // igual que cuando reinicia cada vuelta.
  const { ref, vivo } = useMockupVivo<HTMLDivElement>();

  useEffect(() => {
    if (!vivo) return;
    let t: ReturnType<typeof setTimeout>;
    if (fase === "tipeo") {
      if (letras < MENSAJE.length) {
        t = setTimeout(() => setLetras((n) => n + 1), letras === 0 ? 800 : 45);
      } else {
        t = setTimeout(() => setFase("envio"), 500);
      }
    } else if (fase === "envio") {
      t = setTimeout(() => setFase("notificacion"), 700);
    } else if (fase === "notificacion") {
      t = setTimeout(() => setFase("reinicio"), 4200);
    } else {
      t = setTimeout(() => {
        setLetras(0);
        setFase("tipeo");
      }, 700);
    }
    return () => clearTimeout(t);
  }, [vivo, fase, letras]);

  const texto = MENSAJE.slice(0, letras);
  const enviado = fase === "notificacion" || fase === "reinicio" || !vivo;
  const notificacionVisible = fase === "notificacion";

  return (
    <div ref={ref}>
      {/* La composición entera es decorativa y va con aria-hidden; el
          texto que tipea NO lleva aria-live a propósito — anunciaría
          letra por letra y eso sí molesta. Lo que un lector de
          pantalla recibe es esta descripción quieta. */}
      <p className="sr-only">
        Demostración: escribís el anuncio en el panel de tu negocio, tocás Enviar y les
        llega como notificación a la pantalla de bloqueo del teléfono de tus clientes.
      </p>

      <div
        aria-hidden
        className="grid items-center justify-items-center gap-10 lg:grid-cols-2 lg:gap-6"
      >
        {/* ── IZQUIERDA: la tarjetita del panel ─────────────────── */}
        <div
          className="w-full max-w-[420px] rounded-3xl border border-[#e6eaf3] bg-white p-6 sm:p-7"
          style={{ boxShadow: "0 26px 60px rgba(16,30,66,.12)" }}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a91a4]">
            Tu panel · Marketing
          </p>
          <h3 className="mt-2 text-[18px] font-extrabold leading-tight text-[#0d1733]">
            Enviá un anuncio a tus clientes
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#667085]">
            Les llega como notificación al pase que llevan en su Wallet.
          </p>

          <p className="mt-5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">
            Mensaje
          </p>
          <div className="mt-1.5 min-h-[96px] rounded-xl border border-[#e6e8ee] bg-[#f7f8fb] p-3.5 text-[13.5px] leading-relaxed text-[#0d1733]">
            {texto}
            {vivo && fase === "tipeo" && (
              <span className="ml-[1px] inline-block h-[15px] w-[2px] translate-y-[2px] animate-pulse rounded-full bg-[#0f4c9e]" />
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold leading-snug text-[#8a91a4]">
              {/* ⚠️ ACÁ DECÍA «✓ Enviado — ya está en sus teléfonos».
                  Eso afirma la ENTREGA, y la entrega no se puede
                  prometer: el aviso viaja por el servicio de Wallet de
                  Apple y de Google, que lo pueden demorar o descartar
                  —el teléfono apagado, sin datos, o el sistema
                  decidiendo que ya hubo demasiados—. El producto se
                  prohibió esa afirmación en su propio flujo justamente
                  por eso, y la landing la seguía haciendo.

                  Lo que SÍ es cierto es que el anuncio salió. La
                  diferencia entre «se envió» y «está en sus teléfonos»
                  es la que separa una promesa que se cumple de una que
                  depende de terceros. */}
              {enviado ? (
                <span style={{ color: "var(--accion)" }}>✓ Anuncio enviado</span>
              ) : (
                "Va a los clientes con tu tarjeta"
              )}
            </p>
            <span
              className={`shrink-0 rounded-full px-6 py-2.5 text-[13px] font-extrabold text-white transition-all duration-200 ${
                fase === "envio" ? "scale-[0.93] opacity-85" : ""
              }`}
              style={{ background: "var(--accion)" }}
            >
              Enviar
            </span>
          </div>
        </div>

        {/* ── DERECHA: el teléfono en pantalla de bloqueo ─────────
            El marco copia el patrón visual de mockup-hero-pase.tsx:
            mismo degradado del chasis, mismo notch, mismas sombras. */}
        <div
          className="relative h-[560px] w-[300px] -rotate-[1.5deg] rounded-[46px] p-[9px] sm:h-[600px] sm:w-[322px]"
          style={{
            background: "linear-gradient(145deg,#121827,#3d4557 50%,#0c101a)",
            boxShadow: "0 45px 90px rgba(10,18,38,.28), 0 8px 25px rgba(10,18,38,.14)",
          }}
        >
          <span className="absolute left-1/2 top-[15px] z-[8] h-[26px] w-[100px] -translate-x-1/2 rounded-[18px] bg-[#070b12]" />
          <div
            className="relative h-full overflow-hidden rounded-[38px]"
            style={{
              background:
                "radial-gradient(circle at 22% 16%, rgba(157,180,255,.35), transparent 52%)," +
                "linear-gradient(195deg,#1b2a55 0%,#31437c 52%,#7286c4 100%)",
            }}
          >
            <div className="pt-14 text-center text-white">
              <p className="text-[13px] opacity-80">🔒</p>
              <p className="mt-2 text-[13px] font-bold text-white/85">miércoles, 20 de agosto</p>
              <p className="mt-0.5 text-[64px] font-extrabold leading-none tracking-tight">
                9:41
              </p>
            </div>

            {/* La notificación: llega deslizándose cuando el panel la
                envía, y se retira cuando el loop reinicia. */}
            <div
              className={`mx-3 mt-9 rounded-[18px] bg-white/95 p-3.5 transition-[transform,opacity] duration-500 ${
                notificacionVisible ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0"
              }`}
              style={{ boxShadow: "0 14px 34px rgba(10,18,38,.25)" }}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[16px]"
                  style={{ background: "linear-gradient(145deg,#16295e,#0f4c9e)" }}
                >
                  ☕
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12.5px] font-extrabold text-[#0d1733]">Café Aurora</p>
                    <p className="shrink-0 text-[10px] font-bold text-[#8a91a4]">ahora</p>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[#3a4356]">{MENSAJE}</p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-between px-9">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-[15px]">
                🔦
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-[15px]">
                📷
              </span>
            </div>
            <span className="absolute bottom-2 left-1/2 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-white/85" />
          </div>
        </div>
      </div>
    </div>
  );
}
