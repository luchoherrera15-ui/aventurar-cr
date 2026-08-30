"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * EL CARRUSEL DEL HÉROE — un producto de Bookea por diapositiva, cada
 * una con un mockup de producto ANIMADO (no fotos de banco). Pedido
 * explícito del dueño: ni la de Lealtad lleva foto — las 4 usan el
 * mismo lenguaje visual (degradado + mockup), para que ninguna se
 * sienta "la real" contra las otras tres "de relleno".
 *
 * Las animaciones de cada mockup reusan `.sello-entra` y `.entra-suave`
 * de globals.css (ya escritas para el módulo de Lealtad) en vez de
 * inventar keyframes nuevos — las dos ya respetan
 * `prefers-reduced-motion`, así que ese respeto viaja gratis acá
 * también. Lo que SÍ es nuevo es la SECUENCIA con tiempos (cliente
 * escribe → bot escribe → bot contesta → confirma): eso lo maneja cada
 * mockup con su propio `paso` en estado, avanzado por una cadena de
 * `setTimeout` en un `useEffect` — se reinicia cada vez que la
 * diapositiva vuelve a quedar activa (por el `key` que le pone el
 * carrusel), así la secuencia siempre arranca desde el principio y
 * nunca "a la mitad".
 */

/** true = el visitante pidió menos movimiento; se salta toda secuencia
 *  temporizada y cada mockup se planta directo en su estado final. */
export function useMovimientoReducido(): boolean {
  // Inicializador perezoso: el valor ya se conoce en el primer render
  // del cliente, así que no hace falta un setState síncrono adentro
  // del efecto solo para "sembrarlo" — eso dispara un render en
  // cascada de más.
  const [reducido, setReducido] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducido(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reducido;
}

type Diapositiva = {
  id: string;
  kicker: string;
  kickerIcono: React.ReactNode;
  titulo: string;
  bajada: string;
  cta: string;
  href: string;
  desde: string;
  hasta: string;
  Mockup: React.ComponentType<{ activo: boolean }>;
};

const DIAPOSITIVAS: Diapositiva[] = [
  {
    id: "lealtad",
    kicker: "Pases de lealtad",
    kickerIcono: <IconoWallet />,
    titulo: "Convertí cada visita en una razón para volver.",
    bajada:
      "Sellos, puntos y membresías que tus clientes llevan siempre encima, directo en Apple Wallet y Google Wallet — sin apps que instalar ni tarjetas que se pierden.",
    cta: "Conocer Bookea Lealtad",
    href: "#",
    desde: "#062653",
    hasta: "#0a1638",
    Mockup: MockupWallet,
  },
  {
    id: "automatizaciones",
    kicker: "Automatización de negocios",
    kickerIcono: <IconoChat />,
    titulo: "Tu agenda, resuelta sola por WhatsApp.",
    bajada:
      "Bookea Assist conversa con tus clientes en tu propio número, agenda y confirma citas por sí solo — y cada reserva llega directo a tu panel.",
    cta: "Conocer Bookea Assist",
    href: "#",
    desde: "#062653",
    hasta: "#124c93",
    Mockup: MockupWhatsApp,
  },
  {
    id: "invitaciones",
    kicker: "Invitaciones digitales",
    kickerIcono: <IconoSobre />,
    titulo: "Invitá bonito, confirmá sin esfuerzo.",
    bajada:
      "Diseñá tu invitación digital y mirá las confirmaciones llegar en tiempo real, todo en un solo lugar.",
    cta: "Crear una invitación",
    href: "#",
    desde: "#062653",
    hasta: "#6b2f6e",
    Mockup: MockupInvitacion,
  },
  {
    id: "marketplace",
    kicker: "Marketplace de lugares",
    kickerIcono: <IconoMapa />,
    titulo: "Tu negocio, donde ya te están buscando.",
    bajada:
      "Miles de personas buscan dónde reservar en Costa Rica. Aparecé en el marketplace de Bookea y que te encuentren.",
    cta: "Ver el marketplace",
    href: "#",
    desde: "#062653",
    hasta: "#2f7cbe",
    Mockup: MockupMapa,
  },
];

/** Cada cuánto avanza sola. */
const INTERVALO_MS = 6800;
/** Cuánto se espera después de un click manual antes de retomar el autoplay. */
const PAUSA_TRAS_CLICK_MS = 8000;

export default function CarruselHeroServicios() {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const ultimaInteraccion = useRef(0);
  const reducido = useMovimientoReducido();

  useEffect(() => {
    if (reducido || pausado) return;
    const id = setInterval(() => {
      if (Date.now() - ultimaInteraccion.current < PAUSA_TRAS_CLICK_MS) return;
      setIndice((i) => (i + 1) % DIAPOSITIVAS.length);
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [reducido, pausado]);

  function irA(i: number) {
    ultimaInteraccion.current = Date.now();
    setIndice((i + DIAPOSITIVAS.length) % DIAPOSITIVAS.length);
  }

  const d = DIAPOSITIVAS[indice];

  return (
    <section
      aria-label="Los productos de Bookea"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="relative h-[480px] w-full overflow-hidden bg-[color:var(--navy)] sm:h-[580px] xl:h-[640px]"
    >
      {DIAPOSITIVAS.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== indice}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === indice ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{ background: `linear-gradient(120deg, ${s.desde} 0%, ${s.hasta} 100%)` }}
        >
          {/* El mockup, montado SOLO mientras es la diapositiva activa (o
              la que se acaba de dejar, para que el fade de salida no se
              vea vacío): así cada secuencia temporizada arranca de cero
              la próxima vez que le toque, en vez de seguir corriendo
              escondida de fondo.

              (30 ago 2026: la diapositiva de lealtad traía acá un video
              de fondo de 6,3 MB. Se retiró —ya no se usaba en ningún
              header— y volvió a montar su mockup animado, que cuenta
              lo mismo sin pesar nada.) */}
          {/* Escondido en mobile: a 580px de alto no entra el bloque de
              texto Y el mockup sin que uno tape al otro — en vez de
              acortar el texto o estirar la sección, el mockup queda
              como mejora de escritorio, igual que ya hacía el
              placeholder de la versión anterior. */}
          <div className="absolute inset-0 hidden items-center justify-end px-[8%] pb-16 pt-16 lg:flex">
            {i === indice && <s.Mockup key={indice} activo={i === indice} />}
          </div>
        </div>
      ))}

      {/* Degradé navy a la izquierda: el texto siempre legible, sea cual
          sea el color de fondo de la diapositiva. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(6,38,83,.94) 0%, rgba(6,38,83,.8) 42%, rgba(6,38,83,.25) 70%, rgba(6,38,83,0) 88%)",
        }}
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1200px] items-center px-5 lg:px-6">
        <div className="max-w-[560px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
            <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{d.kickerIcono}</span>
            {d.kicker}
          </span>
          <h1 className="titulo mt-4 text-[clamp(28px,4vw,44px)] leading-[1.08] text-white">
            {d.titulo}
          </h1>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-white/80">{d.bajada}</p>
          <Link
            href={d.href}
            className="presionable mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[13.5px] font-extrabold text-[color:var(--navy)] hover:bg-aventurea-cream-2"
          >
            {d.cta}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      {/* Flechas — escondidas en mobile: el texto de la bajada ocupa casi
          todo el ancho ahí y termina tapado detrás del círculo. */}
      <button
        type="button"
        onClick={() => irA(indice - 1)}
        aria-label="Diapositiva anterior"
        className="presionable absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 sm:left-5 sm:grid"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => irA(indice + 1)}
        aria-label="Siguiente diapositiva"
        className="presionable absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 sm:right-5 sm:grid"
      >
        ›
      </button>

      {/* Puntos */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
        {DIAPOSITIVAS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => irA(i)}
            aria-label={`Ir a ${s.kicker}`}
            aria-current={i === indice}
            className={`h-2 rounded-full transition-all ${
              i === indice ? "w-7 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EL MARCO DE TELÉFONO — compartido por 3 de los 4 mockups.
   ═══════════════════════════════════════════════════════════════════ */

export function MarcoTelefono({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[360px] w-[186px] shrink-0 rounded-[32px] border-[6px] border-[#14171c] bg-[#0a0b0d] shadow-[0_30px_60px_-20px_rgba(0,0,0,.6)] sm:h-[400px] sm:w-[206px] xl:h-[460px] xl:w-[238px]">
      <span
        aria-hidden
        className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-[#14171c]"
      />
      <div className="absolute inset-[6px] top-[24px] overflow-hidden rounded-[24px] bg-white">
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   1 · WALLET — tarjeta flotante con la grilla de sellos.
   ═══════════════════════════════════════════════════════════════════ */

export function MockupWallet({ activo }: { activo: boolean }) {
  const reducido = useMovimientoReducido();
  const sellos = [true, true, true, true, true, false];
  const [toast, setToast] = useState(reducido);

  useEffect(() => {
    if (!activo || reducido) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    function ciclo() {
      if (!vivo) return;
      timers.push(setTimeout(() => vivo && setToast(true), 1600));
      timers.push(setTimeout(() => vivo && setToast(false), 4400));
      timers.push(setTimeout(ciclo, 7200));
    }
    ciclo();
    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
    };
  }, [activo, reducido]);

  return (
    <div className="relative w-full max-w-[340px] sm:max-w-[380px]">
      {/* La notificación de lock-screen: la misma que de verdad manda
          Apple/Google Wallet cuando el pase cambia — flota arriba a la
          izquierda de la tarjeta, no la tapa. */}
      <div
        className={`absolute -left-6 -top-14 z-10 w-[240px] rounded-2xl border border-white/15 bg-white/95 p-3 shadow-2xl backdrop-blur-xl transition-all duration-500 sm:-left-10 ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        <p className="text-[9.5px] font-bold uppercase tracking-wide text-zinc-500">
          Bookea Lealtad · ahora
        </p>
        <p className="mt-0.5 text-[12.5px] font-extrabold text-emerald-600">
          ✓ Nuevo sello agregado
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500">Llevás 5/6 sellos en Café Aurora.</p>
      </div>

      <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-[0_30px_70px_-20px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-7">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">
          Bookea Wallet
        </p>
        <div className="mt-5 grid grid-cols-3 gap-4">
          {sellos.map((lleno, i) => (
            <span
              key={i}
              className={
                lleno
                  ? `grid h-14 w-14 place-items-center rounded-full bg-[color:var(--orange)] text-white ${
                      activo && !reducido ? "sello-entra" : ""
                    }`
                  : "h-14 w-14 rounded-full border-2 border-dashed border-white/35"
              }
              style={activo && !reducido ? { animationDelay: `${i * 140}ms` } : undefined}
            >
              {lleno && (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              )}
            </span>
          ))}
        </div>
        <p className="mt-5 text-[15px] font-extrabold text-white">
          5/6 sellos · ¡Uno más y es gratis!
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   2 · WHATSAPP — la conversación que se contesta sola.
   ═══════════════════════════════════════════════════════════════════ */

export function MockupWhatsApp({
  activo,
  mostrarFlotante = true,
}: {
  activo: boolean;
  /** `false` en el desfile del héroe nuevo: los teléfonos van pegados
   *  uno al lado del otro, y esta tarjeta se sale del suyo y tapa al
   *  vecino — en el carrusel viejo tenía todo el ancho libre alrededor. */
  mostrarFlotante?: boolean;
}) {
  const reducido = useMovimientoReducido();
  const [paso, setPaso] = useState(reducido ? 4 : 0);

  useEffect(() => {
    // El `key={indice}` que le pone el carrusel remonta este componente
    // entero cada vez que vuelve a quedar activo — el `useState` de
    // arriba ya nace en 0, así que no hace falta un setState síncrono
    // acá adentro solo para reiniciar la secuencia.
    if (!activo || reducido) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    function ciclo() {
      if (!vivo) return;
      timers.push(setTimeout(() => vivo && setPaso(1), 500));
      timers.push(setTimeout(() => vivo && setPaso(2), 1900));
      timers.push(setTimeout(() => vivo && setPaso(3), 3300));
      timers.push(setTimeout(() => vivo && setPaso(4), 4700));
      timers.push(setTimeout(ciclo, 7600));
    }
    ciclo();
    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
    };
  }, [activo, reducido]);

  return (
    <div className="relative flex items-center">
      {/* La tarjeta flotante: el motivo por el que el negocio querría
          esto, no otro paso del chat — se muestra recién cuando el bot
          ya contestó, para que se lea como "resultado" y no como ruido
          que aparece antes que la propia conversación. */}
      {mostrarFlotante && (
        <div
          className={`absolute -left-8 top-10 z-10 hidden w-[200px] -translate-x-full rounded-2xl border border-white/15 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl transition-opacity duration-500 xl:block ${
            paso >= 4 ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-[9.5px] font-bold uppercase tracking-wide text-zinc-500">
            Bookea Assist
          </p>
          <p className="mt-0.5 text-[13px] font-extrabold text-[#0b2447]">
            ⚡ Contestado en 4 segundos
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-zinc-500">
            Sin que nadie del negocio tocara el teléfono.
          </p>
        </div>
      )}

      <MarcoTelefono>
      <div className="flex h-full flex-col justify-end gap-2 bg-[#e9e2d9] p-2.5">
        {paso >= 1 && (
          <div className="entra-suave ml-auto max-w-[82%] rounded-xl rounded-tr-sm bg-white px-2.5 py-1.5 text-[10.5px] leading-snug text-[#111] shadow-sm">
            ¿Tienen espacio mañana a las 3pm?
          </div>
        )}
        {paso === 2 && (
          <div className="entra-suave flex w-fit items-center gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
        {paso >= 3 && (
          <div className="entra-suave w-fit max-w-[82%] rounded-xl rounded-tl-sm bg-[#d9fdd3] px-2.5 py-1.5 text-[10.5px] leading-snug text-[#111] shadow-sm">
            ¡Sí! Te reservo mañana 3:00pm ✅
          </div>
        )}
        {paso >= 4 && (
          <div className="entra-suave rounded-xl bg-white px-3 py-2.5 text-center shadow-md">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-600">
              ✓ Reserva confirmada
            </p>
          </div>
        )}
      </div>
      </MarcoTelefono>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   3 · INVITACIÓN — la tarjeta, los avatares y el toast de confirmación.
   ═══════════════════════════════════════════════════════════════════ */

const AVATARES = [
  { inicial: "C", color: "#e08a3e" },
  { inicial: "M", color: "#6b6bd6" },
  { inicial: "J", color: "#3fa77a" },
  { inicial: "V", color: "#c05a8f" },
];

export function MockupInvitacion({
  activo,
  mostrarFlotante = true,
}: {
  activo: boolean;
  /** Ver el mismo parámetro en `MockupWhatsApp`. */
  mostrarFlotante?: boolean;
}) {
  const reducido = useMovimientoReducido();
  const [visibles, setVisibles] = useState(reducido ? AVATARES.length : 0);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    // El remonte por `key` ya deja `visibles`/`toast` en su valor
    // inicial — ver el comentario equivalente en MockupWhatsApp.
    if (!activo || reducido) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    function ciclo() {
      if (!vivo) return;
      AVATARES.forEach((_, i) => {
        timers.push(setTimeout(() => vivo && setVisibles(i + 1), 700 + i * 550));
      });
      timers.push(
        setTimeout(() => {
          if (!vivo) return;
          setToast(true);
          timers.push(setTimeout(() => vivo && setToast(false), 2400));
        }, 700 + AVATARES.length * 550 + 300),
      );
      timers.push(setTimeout(ciclo, 8200));
    }
    ciclo();
    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
    };
  }, [activo, reducido]);

  return (
    <div className="relative flex items-center">
      {/* La tarjeta flotante: el mismo estilo de notificación de
          lock-screen que usan Wallet y WhatsApp, para que las 4
          diapositivas se sientan de la misma familia. */}
      {mostrarFlotante && (
        <div
          className={`absolute -left-8 top-6 z-10 hidden w-[200px] -translate-x-full rounded-2xl border border-white/15 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl transition-opacity duration-500 xl:block ${
            toast ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-[9.5px] font-bold uppercase tracking-wide text-zinc-500">
            Bookea Invitaciones · ahora
          </p>
          <p className="mt-0.5 text-[13px] font-extrabold text-[#4a2b52]">
            ✓ Camila confirmó su asistencia
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-zinc-500">
            Vas a poder ver quién confirmó, en cualquier momento.
          </p>
        </div>
      )}

      <MarcoTelefono>
        <div className="relative flex h-full flex-col bg-gradient-to-b from-[#f6eef7] to-white p-3">
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <p className="text-[13px] font-extrabold text-[#4a2b52]">Cumpleaños de Vale 🎉</p>
            <p className="mt-1 text-[10px] leading-snug text-zinc-500">
              Sáb 14 dic · 3:00pm
              <br />
              Casa de Vale, Escazú
            </p>
          </div>

          <p className="mt-4 text-[9.5px] font-bold uppercase tracking-wide text-zinc-500">
            Confirmaron
          </p>
          <div className="mt-2 flex gap-1.5">
            {AVATARES.map((a, i) => (
              <span
                key={a.inicial}
                className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-extrabold text-white ${
                  i < visibles ? "sello-entra" : "opacity-0"
                }`}
                style={{ background: a.color }}
              >
                {a.inicial}
              </span>
            ))}
          </div>

          <div
            className={`absolute inset-x-3 bottom-3 rounded-lg bg-[#2f7cbe] px-2.5 py-2 text-center text-[9.5px] font-bold text-white shadow-lg transition-all duration-300 ${
              toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            ✓ Nueva confirmación de Camila
          </div>
        </div>
      </MarcoTelefono>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   4 · MAPA — los pines que caen y la tarjeta del negocio.
   ═══════════════════════════════════════════════════════════════════ */

const PINES = [
  { left: "28%", top: "38%", color: "#f39200" },
  { left: "62%", top: "26%", color: "#2f7cbe" },
  { left: "48%", top: "58%", color: "#1f7a4d" },
];

export function MockupMapa({
  activo,
  mostrarFlotante = true,
}: {
  activo: boolean;
  /** Ver el mismo parámetro en `MockupWhatsApp`. */
  mostrarFlotante?: boolean;
}) {
  const reducido = useMovimientoReducido();
  const [pinesVisibles, setPinesVisibles] = useState(reducido ? PINES.length : 0);
  const [tarjeta, setTarjeta] = useState(reducido);

  useEffect(() => {
    // El remonte por `key` ya deja `pinesVisibles`/`tarjeta` en su valor
    // inicial — ver el comentario equivalente en MockupWhatsApp.
    if (!activo || reducido) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    function ciclo() {
      if (!vivo) return;
      PINES.forEach((_, i) => {
        timers.push(setTimeout(() => vivo && setPinesVisibles(i + 1), 500 + i * 450));
      });
      timers.push(
        setTimeout(() => vivo && setTarjeta(true), 500 + PINES.length * 450 + 250),
      );
      timers.push(setTimeout(ciclo, 8000));
    }
    ciclo();
    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
    };
  }, [activo, reducido]);

  return (
    <div className="relative flex items-center">
      {/* La tarjeta flotante: misma familia de notificación de
          lock-screen que Wallet, WhatsApp e Invitación. */}
      {mostrarFlotante && (
        <div
          className={`absolute -left-8 top-8 z-10 hidden w-[200px] -translate-x-full rounded-2xl border border-white/15 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl transition-opacity duration-500 xl:block ${
            tarjeta ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-[9.5px] font-bold uppercase tracking-wide text-zinc-500">
            Bookea Marketplace · ahora
          </p>
          <p className="mt-0.5 text-[13px] font-extrabold text-[#0b2447]">
            📍 Te encontraron en el mapa
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-zinc-500">
            Nueva reserva en Rancho Las Torres.
          </p>
        </div>
      )}

      <MarcoTelefono>
        <div
          className="relative h-full bg-[#eef3fb]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(47,124,190,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(47,124,190,.12) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          {PINES.map((p, i) => (
            <span
              key={i}
              className={`absolute -translate-x-1/2 -translate-y-full ${
                i < pinesVisibles ? "sello-entra" : "opacity-0"
              }`}
              style={{ left: p.left, top: p.top }}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill={p.color} aria-hidden="true">
                <path d="M12 22s7-6.8 7-12.5A7 7 0 0 0 5 9.5C5 15.2 12 22 12 22Z" />
                <circle cx="12" cy="9.5" r="2.6" fill="white" />
              </svg>
            </span>
          ))}

          <div
            className={`entra-suave absolute inset-x-3 bottom-3 rounded-xl bg-white p-2.5 shadow-lg ${
              tarjeta ? "" : "hidden"
            }`}
          >
            <p className="text-[11px] font-extrabold text-[#0b2447]">Rancho Las Torres</p>
            <p className="mt-0.5 text-[9.5px] text-zinc-500">Alajuela · Eventos</p>
          </div>
        </div>
      </MarcoTelefono>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   5 · WALLET EN TELÉFONO — para "Todo lo que Bookea te da"
   (`carrusel-servicios.tsx`), que quiere los 4 productos "en el
   teléfono" por igual. Distinto del `MockupWallet` de más arriba
   (tarjeta flotante SIN marco, a propósito, para el héroe viejo) —
   ese ya no encajaba acá. Vive en ESTE archivo (con "use client" en la
   cabecera) porque usa `useMovimientoReducido`, un hook: definirlo en
   el archivo servidor que lo consume rompía con "Attempted to call
   useMovimientoReducido() from the server".
   ═══════════════════════════════════════════════════════════════════ */

export function MockupWalletTelefono({
  activo,
}: {
  activo: boolean;
  /** Ver el mismo parámetro en `MockupWhatsApp`. No usado acá — esta
   *  tarjeta nunca tuvo una flotante — pero mantiene el mismo tipo de
   *  props que sus tres hermanas para que `SERVICIOS` (en
   *  `carrusel-servicios.tsx`) pueda tratarlas todas igual. */
  mostrarFlotante?: boolean;
}) {
  const reducido = useMovimientoReducido();
  const sellos = [true, true, true, true, false, false];

  return (
    <MarcoTelefono>
      <div className="flex h-full flex-col bg-gradient-to-b from-[#16295e] to-[#0a1226] p-3.5">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/55">
          Bookea Wallet
        </p>
        <div className="mt-3 rounded-2xl bg-white/[0.08] p-3.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-white">
            <span>Café Aurora</span>
            <span className="grid h-5 w-5 place-items-center rounded bg-white text-[10.5px] font-extrabold text-[#16295e]">
              b
            </span>
          </div>
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {sellos.map((lleno, i) => (
              <span
                key={i}
                className={
                  lleno
                    ? `grid h-8 w-8 place-items-center rounded-full bg-[color:var(--orange)] text-white ${
                        activo && !reducido ? "sello-entra" : ""
                      }`
                    : "h-8 w-8 rounded-full border-2 border-dashed border-white/30"
                }
                style={activo && !reducido ? { animationDelay: `${i * 130}ms` } : undefined}
              >
                {lleno && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[10px] font-bold text-white/70">4/6 sellos · ¡2 más y es gratis!</p>
        </div>
      </div>
    </MarcoTelefono>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ÍCONOS de los kickers.
   ═══════════════════════════════════════════════════════════════════ */

function IconoWallet() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconoChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V5Z" />
    </svg>
  );
}

function IconoMapa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function IconoSobre() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
