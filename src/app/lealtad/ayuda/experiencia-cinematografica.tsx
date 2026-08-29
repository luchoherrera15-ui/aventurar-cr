"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import "./cinematica.css";
import { Contador, SeccionViva } from "./historia-lealtad";

/**
 * ════════════════════════════════════════════════════════════════════
 *  BOOKEA LEALTAD — LA EXPERIENCIA (rediseño total, 29 ago 2026)
 * ════════════════════════════════════════════════════════════════════
 *
 * El encargo: reemplazar por completo la dirección visual. Nada de
 * repetir título+teléfono+botones; nada de cards; UN solo teléfono
 * protagonista que se queda FIJO y evoluciona con el scroll contando
 * la historia (crear → conectar por QR → guardar el pase → acumular
 * sellos → recompensa → el negocio aprende → el cliente vuelve).
 *
 * El cómo del motor está en cinematica.css. Acá va la escena fija y su
 * motor: por scroll se escribe `data-fase`, el transform del teléfono
 * y `--sellos`. Sin GSAP ni dependencias nuevas — el motor propio ya
 * es transform/opacity puro (60fps).
 */

/* ── utilería ── */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function suavizar(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
/** Interpola una propiedad sobre puntos de control {p, v}. */
function interp(p: number, stops: { p: number; v: number }[]) {
  if (p <= stops[0].p) return stops[0].v;
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i].p) {
      const t = suavizar((p - stops[i - 1].p) / (stops[i].p - stops[i - 1].p));
      return lerp(stops[i - 1].v, stops[i].v, t);
    }
  }
  return stops[stops.length - 1].v;
}

/* Las fronteras de las cuatro fases dentro de la escena fija. */
const F1 = 0.24;
const F2 = 0.46;
const F3 = 0.6; // desde acá se llenan los sellos (la fase más larga)
const SELLOS_FULL = 0.92; // en qué progreso llegan a 10

/* ── un QR de utilería (dibujo, no dato) ── */
function QrDibujo({ className = "" }: { className?: string }) {
  const celdas = [
    "1111111 0110 1111111",
    "1000001 0100 1000001",
    "1011101 1101 1011101",
    "1011101 0011 1011101",
    "1011101 1010 1011101",
    "1000001 0101 1000001",
    "1111111 0101 1111111",
    "0000000 1100 0000000",
    "1101011 0110 1010110",
    "0100010 1011 0101101",
    "1110110 0100 1110011",
    "0011001 1101 0100101",
    "0000000 1010 1101011",
    "1111111 0011 1010010",
    "1000001 1100 0110110",
    "1011101 0101 1101001",
    "1011101 1010 0011011",
    "1011101 0110 1100101",
    "1000001 1001 0101101",
    "1111111 0100 1011011",
  ];
  return (
    <div className={`grid ${className}`} style={{ gridTemplateColumns: "repeat(20, 1fr)", gridTemplateRows: "repeat(20, 1fr)" }}>
      {celdas.flatMap((fila, y) =>
        fila.replace(/ /g, "").split("").map((c, x) => (
          <span key={`${x}-${y}`} style={{ background: c === "1" ? "#0a1226" : "transparent" }} />
        )),
      )}
    </div>
  );
}

/* ═════════════ EL TELÉFONO GRANDE Y SUS 4 PANTALLAS ═════════════ */

function MarcoGrande({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[min(62vw,340px)]">
      {/* Halo suave detrás: sobre el fondo negro el teléfono se perdía;
          este resplandor lo despega del fondo sin encender la página. */}
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[64px]"
        style={{ background: "radial-gradient(closest-side, rgba(47,107,255,0.28), rgba(255,255,255,0.06) 42%, transparent 72%)" }}
      />

      {/* Botones laterales del aparato (sobresalen del bisel). */}
      <span aria-hidden className="absolute left-[-3px] top-[24%] h-14 w-[3px] rounded-l bg-gradient-to-b from-[#4a5266] to-[#1a1f2b]" />
      <span aria-hidden className="absolute left-[-3px] top-[38%] h-9 w-[3px] rounded-l bg-gradient-to-b from-[#4a5266] to-[#1a1f2b]" />
      <span aria-hidden className="absolute right-[-3px] top-[30%] h-20 w-[3px] rounded-r bg-gradient-to-b from-[#4a5266] to-[#1a1f2b]" />

      {/* Bisel de titanio: dos degradados (uno para el metal, un aro de
          luz interno) + una sombra profunda. Más fino y realista que
          el borde plano de antes. */}
      <div
        className="rounded-[52px] p-[10px] shadow-[0_70px_150px_-40px_rgba(0,0,0,0.95),0_10px_30px_-10px_rgba(0,0,0,0.7)]"
        style={{ background: "linear-gradient(145deg,#4a5164 0%,#20262f 22%,#0c0f15 55%,#242a34 100%)" }}
      >
        {/* Aro interior brillante (el filo pulido del marco). */}
        <div className="rounded-[44px] p-[2px]" style={{ background: "linear-gradient(160deg,rgba(255,255,255,0.35),rgba(255,255,255,0.02) 30%,rgba(0,0,0,0.4))" }}>
          <div className="relative overflow-hidden rounded-[42px] bg-black">
            <div className="relative aspect-[9/19.2] bg-[#f6f8fc]">
              {/* Isla dinámica con la cámara. */}
              <span aria-hidden className="absolute left-1/2 top-[10px] z-30 flex h-[26px] w-[98px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2.5">
                <span className="h-2 w-2 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%,#3b5170,#0a0f18)" }} />
              </span>
              {children}
              {/* Brillo de vidrio: un barrido diagonal muy sutil por
                  encima de la pantalla, sin robar clics. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-40"
                style={{ background: "linear-gradient(125deg,rgba(255,255,255,0.16) 0%,rgba(255,255,255,0.04) 14%,transparent 34%,transparent 100%)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fase 0 · el configurador, con los campos entrando en cascada. */
function ScreenConfigurador() {
  return (
    <div className="absolute inset-0 flex flex-col px-5 pb-6 pt-12">
      <p className="cfg-campo text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a91a4]">Tu panel</p>
      <p className="cfg-campo mt-0.5 text-[17px] font-extrabold text-[#0d1733]">Crear programa</p>
      <div className="cfg-campo mt-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#16295e] text-[13px] font-extrabold text-white">b</span>
        <div className="flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#8a91a4]">Nombre</p>
          <p className="text-[13px] font-extrabold text-[#0d1733]">Club Café</p>
        </div>
      </div>
      <div className="cfg-campo mt-3">
        <p className="text-[9px] font-bold uppercase tracking-wide text-[#8a91a4]">Colores</p>
        <div className="mt-1 flex gap-1.5">
          {["#16295e", "#2f6bff", "#0f4c9e", "#e2e8f5"].map((c) => (
            <span key={c} className="h-6 w-6 rounded-full ring-2 ring-white" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="cfg-campo mt-3">
        <p className="text-[9px] font-bold uppercase tracking-wide text-[#8a91a4]">Sellos para la meta</p>
        <div className="mt-1 flex items-center gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="h-4 flex-1 rounded-full bg-[#dfe5f1]" />
          ))}
          <span className="ml-1 text-[12px] font-extrabold text-[#16295e]">10</span>
        </div>
      </div>
      <div className="cfg-campo mt-3 rounded-xl border border-[#e6eaf3] bg-white px-3 py-2 text-[12px] font-extrabold text-[#0d1733]">
        Recompensa · Café gratis ☕
      </div>
      <div className="mt-auto rounded-2xl bg-[#16295e] py-3 text-center text-[13px] font-extrabold text-white">
        Crear plan
      </div>
    </div>
  );
}

/** Fase 1 · el QR gigante con su línea de escaneo. */
function ScreenQR() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      <p className="text-[12px] font-extrabold text-[#0d1733]">Escaneá y guardá tu tarjeta</p>
      <div className="relative mt-4 aspect-square w-[74%] rounded-2xl bg-white p-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.3)]">
        <QrDibujo className="h-full w-full" />
        <span className="qr-scan absolute inset-x-3 h-[3px] rounded-full bg-[#2f6bff] shadow-[0_0_14px_rgba(47,107,255,0.9)]" style={{ top: "88%", opacity: 0 }} />
      </div>
      <p className="mt-5 text-[11px] font-semibold text-[#8a91a4]">bookea.lat/tarjeta/tu-negocio</p>
    </div>
  );
}

/** El pase (fresco en fase 2; con sellos vivos en fase 3). */
function ScreenPase({ conSellos = false }: { conSellos?: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col px-5 pb-6 pt-12">
      <p className="text-center text-[13px] font-extrabold tabular-nums text-[#0d1733]">9:41</p>
      {!conSellos && (
        <div className="mt-2 self-center rounded-full bg-[#eaf2ff] px-3 py-1 text-[10px] font-extrabold text-[#2f6bff]">
          ✓ Guardado en Apple Wallet
        </div>
      )}
      <div className="relative mt-4 flex-1">
        {/* El pase normal. */}
        <div className="pase-normal absolute inset-0">
          <div className="flex h-full flex-col rounded-3xl p-5 text-white shadow-xl" style={{ background: "linear-gradient(155deg,#16295e,#0f4c9e)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-extrabold">Mi Café</p>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[12px] font-extrabold text-[#16295e]">b</span>
            </div>
            <p className="mt-5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/70">Tus sellos</p>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className="sello aspect-square text-[11px]"
                  style={{ ["--i" as string]: i }}
                >
                  {conSellos ? (
                    <span className="lleno text-[11px]">✓</span>
                  ) : (
                    i < 1 && <span className="lleno text-[11px]" style={{ opacity: 1, transform: "none" }}>✓</span>
                  )}
                </span>
              ))}
            </div>
            <p className="mt-auto text-[13px] font-extrabold">
              {conSellos ? "Cada visita, un sello más" : "1 / 10 sellos"}
            </p>
            <p className="text-[10.5px] font-semibold text-white/70">
              {conSellos ? "Seguí sumando para tu café gratis" : "Recién guardada — empezá a sumar"}
            </p>
          </div>
        </div>
        {/* La recompensa: el pase muta cuando se completan los 10. */}
        {conSellos && (
          <div className="pase-reward absolute inset-0">
            <div className="flex h-full flex-col items-center justify-center rounded-3xl p-6 text-center text-white" style={{ background: "linear-gradient(155deg,#2f6bff,#0f4c9e)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/80">Recompensa desbloqueada</p>
              <p className="mt-3 text-[30px] font-extrabold leading-none">Café gratis ☕</p>
              <p className="mt-3 text-[11px] font-semibold text-white/80">Y la tarjeta vuelve a empezar.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** La pantalla bloqueada con las notificaciones que hacen volver. */
function ScreenNotificacion() {
  const avisos = [
    ["☕", "Te falta 1 sello para tu café gratis"],
    ["🎉", "20% off toda esta semana — te esperamos"],
    ["💛", "Te extrañamos… ¿un cafecito hoy?"],
  ];
  return (
    <div
      className="absolute inset-0 flex flex-col px-4 pb-6 pt-14 text-white"
      style={{ background: "linear-gradient(180deg,#0b1430 0%,#16295e 55%,#1e356e 100%)" }}
    >
      <p className="text-center text-[12px] font-semibold text-white/60">martes 20 de agosto</p>
      <p className="text-center text-[52px] font-extrabold leading-none tabular-nums">9:41</p>
      <div className="mt-9 flex flex-col gap-2.5">
        {avisos.map(([emoji, texto]) => (
          <div key={texto} className="rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur">
            <p className="flex items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-wide text-white/70">
              <span className="grid h-4 w-4 place-items-center rounded bg-[#2f6bff] text-[9px]">{emoji}</span>
              Bookea Lealtad · ahora
            </p>
            <p className="mt-1 text-[12px] font-bold leading-tight text-white">{texto}</p>
          </div>
        ))}
      </div>
      <p className="mt-auto text-center text-[9.5px] font-semibold text-white/45">
        Directo a la tarjeta que ya tienen en el Wallet
      </p>
    </div>
  );
}

/* ── la galería de rubros (fotos verificadas, por el optimizador) ── */
const RUBROS = [
  { label: "Barbería", foto: "photo-1599351431202-1e0f0137899a", premio: "Cada 8 cortes, uno gratis" },
  { label: "Cafetería", foto: "photo-1554118811-1e0d58224f24", premio: "9 cafés, el 10.º va" },
  { label: "Restaurante", foto: "photo-1552566626-52f8b828add9", premio: "Postre gratis a la 6.ª" },
  { label: "Salón", foto: "photo-1470259078422-826894b933aa", premio: "Tratamiento a la 7.ª" },
  { label: "Spa", foto: "photo-1600334089648-b0d9d3028eb2", premio: "5 visitas, un masaje" },
  { label: "Uñas", foto: "photo-1610992015732-2449b76344bc", premio: "10.º servicio con 50% off" },
];
const fotoUrl = (id: string, w: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/* ═════════════ LA GALERÍA QUE FLUYE Y SE EMPUJA ═════════════
   Los cards corren solos hacia la derecha (marquee) y se pueden
   AGARRAR y empujar a los lados con inercia: un flick los lanza rápido
   y van frenando solos. Todo con un track y translate3d (GPU), un solo
   rAF; los cards van DUPLICADOS para que el bucle no tenga costura. */
function GaleriaFluida() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const est = useRef({ pos: 0, setW: 0, vel: 0, arrastrando: false, ultimoX: 0, raf: 0, listo: false });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    // `s` es el mismo objeto-ref durante toda la vida del efecto (nunca
    // se reasigna), así que usarlo en el cleanup es seguro y calla la
    // regla del exhaustive-deps sobre `est.current`.
    const s = est.current;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const AUTO = 0.5; // velocidad del flujo automático (px/frame), hacia la derecha

    const medir = () => {
      s.setW = track.scrollWidth / 2; // hay dos copias
      if (!s.listo && s.setW) { s.pos = -s.setW / 2; s.listo = true; }
    };
    medir();
    window.addEventListener("resize", medir);

    const envolver = () => {
      if (!s.setW) return;
      if (s.pos > 0) s.pos -= s.setW;
      if (s.pos <= -s.setW) s.pos += s.setW;
    };

    const frame = () => {
      if (!s.arrastrando) {
        if (Math.abs(s.vel) > 0.08) {
          s.pos += s.vel;      // inercia tras soltar
          s.vel *= 0.95;       // fricción
        } else if (!reducir) {
          s.pos += AUTO;       // flujo automático hacia la derecha
        }
      }
      envolver();
      track.style.transform = `translate3d(${s.pos}px,0,0)`;
      s.raf = requestAnimationFrame(frame);
    };
    s.raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener("resize", medir);
    };
  }, []);

  const alBajar = (e: React.PointerEvent) => {
    const s = est.current;
    s.arrastrando = true;
    s.ultimoX = e.clientX;
    s.vel = 0;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const alMover = (e: React.PointerEvent) => {
    const s = est.current;
    if (!s.arrastrando) return;
    const dx = e.clientX - s.ultimoX;
    s.ultimoX = e.clientX;
    s.pos += dx;
    s.vel = dx; // el último desplazamiento se vuelve el impulso
  };
  const alSoltar = () => { est.current.arrastrando = false; };

  return (
    <div
      className="cursor-grab overflow-hidden active:cursor-grabbing"
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerLeave={alSoltar}
      onPointerCancel={alSoltar}
    >
      <div
        ref={trackRef}
        className="flex w-max gap-5 will-change-transform"
        style={{ touchAction: "pan-y" }}
      >
        {[...RUBROS, ...RUBROS].map((r, i) => (
          <div
            key={r.label + i}
            className="relative h-[440px] w-[320px] shrink-0 select-none overflow-hidden rounded-[28px] sm:h-[520px] sm:w-[360px]"
          >
            <Image
              src={fotoUrl(r.foto, 1400)}
              alt={r.label}
              fill
              quality={82}
              sizes="(max-width: 640px) 340px, 380px"
              draggable={false}
              className="pointer-events-none object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-[24px] font-extrabold tracking-tight text-white">{r.label}</p>
              <p className="mt-1 text-[13px] font-semibold text-[color:var(--azul-claro)]">{r.premio}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExperienciaCinematografica() {
  // Un solo elemento alto (460vh) que es a la vez el que se mide para el
  // progreso, el padre del sticky (por eso el teléfono se queda anclado
  // durante todo el tramo) y el que lleva los data-* que lee el CSS.
  const escenaRef = useRef<HTMLElement | null>(null);
  const telRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const escena = escenaRef.current;
    const fija = escena;
    const tel = telRef.current;
    if (!escena || !fija) return;

    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ticking = false;

    const pintar = () => {
      ticking = false;
      const rect = escena.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      const fase = p < F1 ? 0 : p < F2 ? 1 : p < F3 ? 2 : 3;
      if (fija.dataset.fase !== String(fase)) fija.dataset.fase = String(fase);

      // Sellos: 0 hasta F3, luego suben a 10.
      const sellos = p < F3 ? 0 : Math.min(10, ((p - F3) / (SELLOS_FULL - F3)) * 10);
      fija.style.setProperty("--sellos", sellos.toFixed(2));
      const reward = p > 0.95 ? "1" : "0";
      if (fija.dataset.reward !== reward) fija.dataset.reward = reward;

      if (tel && !reducir) {
        const x = interp(p, [
          { p: 0, v: 10 },
          { p: F1, v: 6 },
          { p: F2, v: 0 },
          { p: F3, v: -2 },
          { p: 1, v: -8 },
        ]);
        const s = interp(p, [
          { p: 0, v: 1.0 },
          { p: F2, v: 1.12 },
          { p: F3, v: 1.08 },
          { p: 1, v: 1.0 },
        ]);
        const r = interp(p, [
          { p: 0, v: -3 },
          { p: F2, v: 0 },
          { p: 1, v: 2 },
        ]);
        tel.style.transform = `translate3d(${x}%, 0, 0) rotate(${r}deg) scale(${s})`;
      }
    };

    const alScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(pintar);
    };

    pintar();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, []);

  const CAPS = [
    { n: "01", k: "Creá", t: ["CREÁ TU", "PROGRAMA."], d: "Nombre, colores, sellos y el premio. En minutos, listo para Apple y Google Wallet." },
    { n: "02", k: "Conectá", t: ["UN QR.", "NADA MÁS."], d: "Lo pegás donde tus clientes lo vean. Lo escanean y su tarjeta queda en el teléfono." },
    { n: "03", k: "Su pase", t: ["SU PASE.", "SIEMPRE", "CON ÉL."], d: "Se guarda en el Wallet como una tarjeta de embarque. Sin instalar nada." },
    { n: "04", k: "Cada visita", t: ["CADA VISITA", "CUENTA."], d: "Cada sello lo acerca a la meta. Al completarla, la recompensa se desbloquea sola." },
  ];

  return (
    <div className="cine">
      {/* ═══════════ HÉROE — editorial, asimétrico ═══════════ */}
      <section className="relative min-h-[100svh] overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute right-[-10%] top-[-10%] h-[70vh] w-[70vh] rounded-full" style={{ background: "radial-gradient(circle,rgba(47,107,255,0.22),transparent 70%)" }} />
        <div className="mx-auto grid min-h-[100svh] max-w-[1320px] items-center gap-8 px-6 pt-28 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div>
            <p className="cine-kicker cine-e1">Bookea Lealtad</p>
            <h1 className="cine-display cine-e2 mt-6 text-[clamp(56px,11vw,150px)]">
              HAZ QUE<br />VUELVAN.
            </h1>
            <p className="cine-e3 mt-7 max-w-[40ch] text-[17px] leading-relaxed text-[color:var(--humo)]">
              Convertí cada visita en una nueva oportunidad. Un programa de
              lealtad digital que vive en el teléfono de tus clientes.
            </p>
            <div className="cine-e4 mt-9 flex flex-wrap items-center gap-6">
              <Link href="/lealtad/nuevo" className="cine-cta">
                Crear mi plan <span aria-hidden>→</span>
              </Link>
              <a href="#historia" className="cine-cta-fantasma">
                Ver cómo funciona <span aria-hidden>↓</span>
              </a>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="cine-flotar">
              <MarcoGrande>
                <ScreenPase />
              </MarcoGrande>
            </div>
          </div>
        </div>
        <div className="cine-hint absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[color:var(--humo-2)]">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.3em]">Scroll</span>
          <span aria-hidden>↓</span>
        </div>
      </section>

      {/* ═══════════ LA ESCENA FIJA — un teléfono, 4 capítulos ═══════════ */}
      {/* La altura da el «riel» de scroll: ~4.6 pantallas para las 4 fases. */}
      <section id="historia" ref={escenaRef} data-fase="0" data-reward="0" style={{ height: "460vh" }} className="escena-fija relative bg-[color:var(--neg-2)]">
        <div className="escena-sticky">
            {/* Los números fantasma, uno por fase. */}
            {CAPS.map((c, i) => (
              <span
                key={c.n}
                data-f={i}
                className="fase-ghost cine-ghost pointer-events-none absolute left-4 top-[8%] select-none text-[clamp(120px,26vw,340px)] sm:left-[6%]"
              >
                {c.n}
              </span>
            ))}

            <div className="relative mx-auto grid h-full max-w-[1320px] items-center gap-6 px-6 lg:grid-cols-[0.9fr_1.1fr]">
              {/* Columna de texto (crossfade por fase). */}
              <div className="relative z-10 order-2 min-h-[42vh] lg:order-1 lg:min-h-[50vh]">
                {CAPS.map((c, i) => (
                  <div key={c.n} data-f={i} className="fase-txt absolute inset-0 flex flex-col justify-center">
                    <p className="cine-kicker">{c.n} · {c.k}</p>
                    <h2 className="cine-display mt-4 text-[clamp(40px,7vw,92px)]">
                      {c.t.map((linea, j) => (
                        <span key={j} className="block">{linea}</span>
                      ))}
                    </h2>
                    <p className="mt-6 max-w-[38ch] text-[16px] leading-relaxed text-[color:var(--humo)]">{c.d}</p>
                  </div>
                ))}
              </div>

              {/* El teléfono protagonista, sticky y evolucionando. */}
              <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
                <div ref={telRef} style={{ willChange: "transform" }}>
                  <MarcoGrande>
                    <div className="tel-pantalla" data-f="0"><ScreenConfigurador /></div>
                    <div className="tel-pantalla" data-f="1"><ScreenQR /></div>
                    <div className="tel-pantalla" data-f="2"><ScreenPase /></div>
                    <div className="tel-pantalla" data-f="3"><ScreenPase conSellos /></div>
                  </MarcoGrande>
                </div>
              </div>
            </div>

            {/* El riel de progreso 01–04. */}
            <div className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-5 lg:flex">
              {CAPS.map((c, i) => (
                <div key={c.n} data-f={i} className="cine-riel-item flex items-center gap-2">
                  <span className="cine-riel-barra block rounded-full" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--humo)]">{c.n}</span>
                </div>
              ))}
            </div>
          </div>
      </section>

      {/* ═══════════ 05 · CONOCE A TUS CLIENTES ═══════════ */}
      <SeccionViva className="bg-[color:var(--neg)] py-32">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="cine-kicker cine-reveal">Los datos</p>
              <h2 className="cine-display cine-reveal mt-5 text-[clamp(42px,7vw,104px)]">
                CONOCÉ<br />A TUS<br /><span className="text-[color:var(--azul-claro)]">CLIENTES.</span>
              </h2>
            </div>
            <p className="cine-reveal max-w-[42ch] text-[17px] leading-relaxed text-[color:var(--humo)]">
              Cada sello es un dato. Sabés quién vuelve, cada cuánto y quién se
              está enfriando — para saber a quién hablarle. No solo fidelizás:
              aprendés.
            </p>
          </div>

          <div className="cine-reveal mt-16 grid gap-5 sm:grid-cols-3">
            {[
              { n: 1284, l: "Clientes", suf: "" },
              { n: 4892, l: "Visitas", suf: "" },
              { n: 73, l: "% recurrentes", suf: "%" },
            ].map((k) => (
              <div key={k.l} className="rounded-3xl border border-[color:var(--linea)] bg-[color:var(--neg-3)] px-7 py-9">
                <Contador hasta={k.n} sufijo={k.suf} className="block text-[clamp(44px,6vw,72px)] font-extrabold tracking-tight text-[color:var(--azul-claro)]" />
                <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--humo)]">{k.l}</p>
              </div>
            ))}
          </div>

          {/* Un tablero grande, no una card chica. */}
          <div className="cine-reveal mt-6 rounded-3xl border border-[color:var(--linea)] bg-[color:var(--neg-3)] p-8">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-extrabold text-white">Visitas por día · esta semana</p>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--humo)]">Ejemplo ilustrativo</span>
            </div>
            <div className="mt-7 flex h-40 items-end gap-3">
              {[
                { px: 70, d: "L" }, { px: 95, d: "M" }, { px: 84, d: "M" },
                { px: 120, d: "J" }, { px: 138, d: "V" }, { px: 104, d: "S" }, { px: 56, d: "D" },
              ].map((b, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="cine-barra w-full rounded-t-lg" style={{ height: b.px + "px", background: i >= 4 ? "var(--azul)" : "rgba(122,162,255,0.28)" }} />
                  <span className="text-[10px] font-bold text-[color:var(--humo-2)]">{b.d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SeccionViva>

      {/* ═══════════ 06 · GALERÍA EDITORIAL HORIZONTAL ═══════════ */}
      <SeccionViva className="bg-[color:var(--neg-2)] py-32">
        <div className="mx-auto max-w-[1320px] px-6">
          <h2 className="cine-display cine-reveal max-w-[22ch] text-[clamp(38px,6vw,80px)]">
PENSADO PARA TODO TIPO DE NEGOCIO.
          </h2>
        </div>
        <div className="cine-reveal mt-14">
          <GaleriaFluida />
          <p className="mt-6 px-6 text-[12px] font-semibold text-[color:var(--humo-2)]">
            Fluyen solos — o agarralos y empujalos ↔
          </p>
        </div>
      </SeccionViva>

      {/* ═══════════ 07 · NOTIFICACIONES — no esperes, avisáles ═══════════ */}
      <SeccionViva className="bg-[color:var(--neg-3)] py-32">
        <div className="mx-auto grid max-w-[1320px] items-center gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="cine-kicker cine-reveal">Notificaciones</p>
            <h2 className="cine-display cine-reveal mt-5 text-[clamp(40px,7vw,96px)]">
              NO ESPERES.
              <br />
              <span className="text-[color:var(--azul-claro)]">AVISÁLES.</span>
            </h2>
            <p className="cine-reveal mt-6 max-w-[44ch] text-[17px] leading-relaxed text-[color:var(--humo)]">
              Con un toque mandás una notificación a la tarjeta que tus clientes
              ya tienen en el teléfono — una promo, un recordatorio, un martes
              flojo que querés llenar. Llega directo, sin apps ni números que
              nadie guardó.
            </p>
            <div className="cine-reveal mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {["Promos y descuentos", "«Te falta 1 sello»", "«Te extrañamos»"].map((t) => (
                <span key={t} className="flex items-center gap-2 text-[14px] font-bold text-white">
                  <span className="text-[color:var(--azul-claro)]">✓</span> {t}
                </span>
              ))}
            </div>
          </div>
          <div className="cine-reveal flex justify-center lg:justify-end">
            <div className="cine-flotar">
              <MarcoGrande>
                <ScreenNotificacion />
              </MarcoGrande>
            </div>
          </div>
        </div>
      </SeccionViva>

      {/* ═══════════ CIERRE ═══════════ */}
      <SeccionViva className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[color:var(--neg)] px-6 py-28 text-center">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle,rgba(47,107,255,0.18),transparent 70%)" }} />
        {/* Un pase casi completo (8/10): fuera de la escena fija no hay
            `--sellos` que herede, así que se lo damos acá para que el
            cierre no muestre una tarjeta vacía. */}
        <div className="cine-flotar cine-reveal relative mb-12" style={{ ["--sellos" as string]: 8 }}>
          <MarcoGrande>
            <ScreenPase conSellos />
          </MarcoGrande>
        </div>
        <h2 className="cine-display cine-reveal text-[clamp(52px,11vw,140px)]">
          EMPEZÁ<br />HOY.
        </h2>
        <p className="cine-reveal mt-6 max-w-[46ch] text-[17px] text-[color:var(--humo)]">
          Tu programa de lealtad, listo en minutos. Empezá a construir
          relaciones que duran.
        </p>
        <div className="cine-reveal mt-10 flex flex-wrap items-center justify-center gap-6">
          <Link href="/lealtad/nuevo" className="cine-cta">
            Crear mi plan de lealtad <span aria-hidden>→</span>
          </Link>
          <Link href="/lealtad/demo" className="cine-cta-fantasma">
            Ver demostración <span aria-hidden>→</span>
          </Link>
        </div>
      </SeccionViva>
    </div>
  );
}
