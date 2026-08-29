"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import "./historia.css";
import "./cinematica.css";
import {
  TelefonoMarco,
  PantallaTarjeta,
  PantallaConfigurador,
  PantallaRegistro,
  PantallaPremiar,
  Contador,
  SeccionViva,
} from "./historia-lealtad";

/**
 * ════════════════════════════════════════════════════════════════════
 *  BOOKEA LEALTAD — LA EXPERIENCIA CINEMATOGRÁFICA (29 ago 2026)
 * ════════════════════════════════════════════════════════════════════
 *
 * Reemplaza la «historia» anterior de /lealtad/ayuda por una landing
 * tipo marca premium (McLaren de referencia), en negro, con el azul de
 * Bookea como único acento y una narrativa que se recorre con el
 * scroll: PROBLEMA → CREAR → QR → VISITA → SELLOS → RECOMPENSA → DATOS
 * → RETENCIÓN → BOOKEA.
 *
 * El motor caliente (la escena sticky) escribe SOLO `data-cine` y el
 * transform del teléfono; el resto lo decide cinematica.css. Las
 * secciones de abajo se revelan con IntersectionObserver (SeccionViva).
 * Las pantallas del teléfono se reusan de historia-lealtad.tsx.
 */

/* ── utilería del motor ── */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function suavizar(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Las poses del teléfono por capítulo (la 4.ª es la salida). */
const POSES = [
  { s: 0.98, r: -4, y: 8 },
  { s: 1.06, r: 3, y: -6 },
  { s: 1.02, r: -2, y: 4 },
  { s: 1.1, r: 0, y: -14 },
];

const CAPS = [
  {
    n: "01",
    titulo: "CREÁ",
    texto:
      "Armás tu plan de lealtad en minutos: nombre, colores, cuántos sellos y cuál es el premio. Listo para Apple Wallet y Google Wallet al instante.",
    Pantalla: PantallaConfigurador,
    riel: "Creá",
  },
  {
    n: "02",
    titulo: "CONECTÁ",
    texto:
      "Imprimís tu código QR y lo pegás donde tus clientes lo vean. Lo escanean y su tarjeta queda guardada en el teléfono — sin descargar nada.",
    Pantalla: PantallaRegistro,
    riel: "Conectá",
  },
  {
    n: "03",
    titulo: "PREMIÁ",
    texto:
      "Cada visita suma un sello desde tu mostrador. Al llegar a la meta, entregás el premio ahí mismo y la tarjeta arranca la próxima vuelta.",
    Pantalla: PantallaPremiar,
    riel: "Premiá",
  },
];

/* ── la galería de rubros (07): fotos verificadas, las mismas del
   directorio, servidas por el optimizador ── */
const RUBROS = [
  { label: "Barberías", foto: "photo-1585747860715-2ba37e788b70", premio: "Cada 8 cortes, uno gratis" },
  { label: "Salones de uñas", foto: "photo-1604654894610-df63bc536371", premio: "10.º servicio con 50% off" },
  { label: "Cafeterías", foto: "photo-1521017432531-fbd92d768814", premio: "9 cafés, el 10.º va" },
  { label: "Spa y bienestar", foto: "photo-1540555700478-4be289fbecef", premio: "5 visitas, un masaje" },
  { label: "Restaurantes", foto: "photo-1517248135467-4c7edcad34c4", premio: "Postre gratis a la 6.ª" },
  { label: "Salones de belleza", foto: "photo-1470259078422-826894b933aa", premio: "Tratamiento a la 7.ª" },
  { label: "Fitness", foto: "photo-1534438327276-14e5300c3a48", premio: "Un mes extra al 12.º" },
  { label: "Estética", foto: "photo-1512290923902-8a9f81dc236c", premio: "Sesión gratis a la 8.ª" },
];
const fotoUrl = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export default function ExperienciaCinematografica() {
  const escenaRef = useRef<HTMLDivElement | null>(null);
  const telRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const escena = escenaRef.current;
    const tel = telRef.current;
    if (!escena) return;

    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ticking = false;

    const pintar = () => {
      ticking = false;
      const rect = escena.getBoundingClientRect();
      const vh = window.innerHeight;
      // Progreso 0→1 mientras la escena cruza la ventana.
      const total = rect.height - vh;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      // ¿Qué capítulo? Tres tramos iguales.
      const fase = Math.min(CAPS.length - 1, Math.floor(p * CAPS.length + 0.0001));
      if (escena.dataset.cine !== String(fase)) escena.dataset.cine = String(fase);

      if (tel && !reducir) {
        // Pose interpolada entre la actual y la siguiente dentro del tramo.
        const tramo = 1 / CAPS.length;
        const local = suavizar(Math.min(1, (p - fase * tramo) / tramo));
        const a = POSES[fase];
        const b = POSES[Math.min(POSES.length - 1, fase + 1)];
        const s = lerp(a.s, b.s, local);
        const r = lerp(a.r, b.r, local);
        const y = lerp(a.y, b.y, local);
        tel.style.transform = `translate3d(0, ${y}px, 0) rotate(${r}deg) scale(${s})`;
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

  return (
    <div className="cine">
      <div className="cine-fondo" aria-hidden />

      {/* ═══════════ HÉRO ═══════════ */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-5 pb-16 pt-28 text-center">
        <p className="cine-kicker cine-entrada">Bookea Lealtad</p>
        <h1 className="cine-display cine-entrada mt-5 text-[clamp(52px,12vw,150px)]">
          PROGRAMA
          <br />
          DE LEALTAD
        </h1>
        <p className="cine-entrada-2 mt-6 text-[clamp(20px,3vw,30px)] font-bold text-[color:var(--blanco)]">
          Hacé que tus clientes vuelvan.
        </p>
        <p className="cine-entrada-3 mx-auto mt-4 max-w-[56ch] text-[15.5px] leading-relaxed text-[color:var(--humo)]">
          Creá tu programa de lealtad digital, conectá con tus clientes y
          convertí cada visita en una nueva oportunidad de venta.
        </p>
        <div className="cine-entrada-3 mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/lealtad/nuevo" className="cine-cta">
            Crear mi plan de lealtad <span aria-hidden>→</span>
          </Link>
          <a href="#capitulos" className="cine-cta-fantasma">
            Ver cómo funciona
          </a>
        </div>

        {/* El teléfono del héroe, con la tarjeta real. */}
        <div className="cine-flotar mt-14">
          <TelefonoMarco>
            <PantallaTarjeta />
          </TelefonoMarco>
        </div>

        <div className="cine-scroll-hint mt-12 flex flex-col items-center gap-2 text-[color:var(--humo-2)]">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.28em]">
            Scroll para descubrir
          </span>
          <span aria-hidden className="text-[18px]">
            ↓
          </span>
        </div>
      </section>

      {/* ═══════════ LA ESCENA STICKY — 01 · 02 · 03 ═══════════ */}
      <div id="capitulos" ref={escenaRef} className="cine-escena relative" data-cine="0">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-5 lg:grid-cols-[64px_1fr_1fr]">
          {/* El riel de progreso (solo escritorio, sticky). */}
          <div className="hidden lg:block">
            <div className="sticky top-0 flex h-[100svh] flex-col justify-center gap-6">
              {CAPS.map((c, i) => (
                <div key={c.n} className="cine-riel-item flex items-center gap-3" data-p={i}>
                  <span className="cine-riel-barra block rounded-full" />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--humo)]">
                    {c.n} · {c.riel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Los capítulos de texto. En móvil cada uno trae su teléfono. */}
          <div>
            {CAPS.map((c, i) => {
              const P = c.Pantalla;
              return (
                <div
                  key={c.n}
                  data-p={i}
                  className="cine-cap flex min-h-[86svh] flex-col justify-center py-16 lg:min-h-[100svh]"
                >
                  <p className="cine-num-gigante text-[clamp(80px,14vw,200px)]">{c.n}</p>
                  <h2 className="cine-display mt-1 text-[clamp(40px,7vw,86px)]">{c.titulo}</h2>
                  <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-[color:var(--humo)]">
                    {c.texto}
                  </p>
                  {/* El teléfono propio de cada bloque — solo móvil. */}
                  <div className="mt-9 flex justify-center lg:hidden">
                    <TelefonoMarco>
                      <P />
                    </TelefonoMarco>
                  </div>
                </div>
              );
            })}
          </div>

          {/* El teléfono viajero — sticky, solo escritorio. */}
          <div className="hidden lg:block">
            <div className="sticky top-0 flex h-[100svh] items-center justify-center">
              <div ref={telRef} style={{ willChange: "transform" }}>
                <TelefonoMarco className="relative">
                  {CAPS.map((c, i) => {
                    const P = c.Pantalla;
                    return (
                      <div key={c.n} className="cine-pantalla" data-p={i}>
                        <P />
                      </div>
                    );
                  })}
                </TelefonoMarco>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ CLÍMAX — CADA VISITA CUENTA / SELLOS ═══════════ */}
      <SeccionViva className="mx-auto max-w-[1100px] px-5 py-28 text-center">
        <p className="cine-kicker cine-reveal">La recompensa</p>
        <h2 className="cine-display cine-reveal mx-auto mt-5 max-w-[16ch] text-[clamp(40px,8vw,96px)]">
          CADA VISITA
          <br />
          CUENTA.
        </h2>
        <p className="cine-reveal mx-auto mt-6 max-w-[52ch] text-[16px] leading-relaxed text-[color:var(--humo)]">
          Sello a sello, la tarjeta se completa. Y cuando llega a la meta, tu
          cliente ya tiene una razón para volver.
        </p>

        {/* Los diez sellos, completándose. */}
        <div className="mx-auto mt-14 flex max-w-[720px] flex-wrap items-center justify-center gap-3 sm:gap-4">
          {Array.from({ length: 10 }, (_, i) => {
            const meta = i === 9;
            const on = i < 9;
            return (
              <span
                key={i}
                className={
                  "cine-sello h-[52px] w-[52px] text-[20px] font-extrabold sm:h-[64px] sm:w-[64px] sm:text-[24px] " +
                  (meta ? "cine-sello-meta" : on ? "cine-sello-on" : "")
                }
              >
                {meta ? "★" : on ? "✓" : i + 1}
              </span>
            );
          })}
        </div>

        <div className="cine-recompensa mx-auto mt-14 inline-flex flex-col items-center rounded-2xl border border-[color:var(--linea)] bg-[color:var(--grafito)] px-8 py-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[color:var(--azul-claro)]">
            Recompensa desbloqueada
          </p>
          <p className="mt-2 text-[clamp(24px,4vw,38px)] font-extrabold tracking-tight text-white">
            Café gratis ☕
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[color:var(--humo)]">
            Y la tarjeta vuelve a empezar.
          </p>
        </div>
      </SeccionViva>

      {/* ═══════════ 04 · DASHBOARD — NO SOLO FIDELIZÁS, APRENDÉS ═══════ */}
      <SeccionViva className="mx-auto max-w-[1240px] px-5 py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="cine-kicker cine-reveal">Los datos</p>
            <h2 className="cine-display cine-reveal mt-5 text-[clamp(36px,6vw,72px)]">
              NO SOLO
              <br />
              FIDELIZÁS.
              <br />
              <span className="text-[color:var(--azul-claro)]">APRENDÉS.</span>
            </h2>
            <p className="cine-reveal mt-6 max-w-[44ch] text-[16px] leading-relaxed text-[color:var(--humo)]">
              Cada sello es un dato. Bookea te muestra quién vuelve, cada cuánto,
              y quiénes se están enfriando — para que sepas a quién hablarle.
            </p>
          </div>

          {/* El tablero. */}
          <div className="cine-reveal rounded-3xl border border-[color:var(--linea)] bg-[color:var(--neg-2)] p-6 shadow-[0_50px_120px_-50px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-extrabold text-white">Tu clientela</p>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--humo)]">
                Ejemplo ilustrativo
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { n: 1284, l: "Clientes" },
                { n: 4892, l: "Visitas" },
                { n: 73, l: "% recurrentes", suf: "%" },
              ].map((k) => (
                <div key={k.l} className="rounded-2xl bg-white/[0.03] px-3 py-4 text-center">
                  <Contador
                    hasta={k.n}
                    sufijo={k.suf ?? ""}
                    className="block text-[clamp(22px,3vw,32px)] font-extrabold text-[color:var(--azul-claro)]"
                  />
                  <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--humo)]">
                    {k.l}
                  </p>
                </div>
              ))}
            </div>
            {/* Barras semanales. */}
            <div className="mt-6">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--humo)]">
                Visitas por día
              </p>
              {/* Altura de cada barra en PX, no en % — un % de altura
                  contra una columna flex de alto automático colapsa a
                  0 (el tropiezo ya conocido del repo). La fila mide
                  h-28 (112px); las barras llegan hasta ~92px. */}
              <div className="mt-3 flex h-28 items-end gap-2">
                {[
                  { px: 48, d: "L" },
                  { px: 64, d: "M" },
                  { px: 56, d: "M" },
                  { px: 82, d: "J" },
                  { px: 92, d: "V" },
                  { px: 70, d: "S" },
                  { px: 38, d: "D" },
                ].map((b, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <div
                      className="cine-barra w-full rounded-t-md"
                      style={{
                        height: b.px + "px",
                        background: i >= 4 ? "var(--azul)" : "rgba(111,155,255,0.35)",
                      }}
                    />
                    <span className="text-[9px] font-bold text-[color:var(--humo-2)]">
                      {b.d}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SeccionViva>

      {/* ═══════════ 05 · TU BASE DE CLIENTES ═══════════ */}
      <SeccionViva className="mx-auto max-w-[1100px] px-5 py-28 text-center">
        <p className="cine-kicker cine-reveal">La base de datos</p>
        <h2 className="cine-display cine-reveal mx-auto mt-5 max-w-[18ch] text-[clamp(34px,6vw,72px)]">
          TU CLIENTE. TU RELACIÓN.{" "}
          <span className="text-[color:var(--azul-claro)]">TU NEGOCIO.</span>
        </h2>
        <p className="cine-reveal mx-auto mt-6 max-w-[56ch] text-[16px] leading-relaxed text-[color:var(--humo)]">
          Cada persona que se registra pasa a ser parte de tu base de clientes —
          tuya, para conocer sus visitas, su frecuencia y su actividad.
        </p>
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["MR", "María R.", "12 visitas"],
            ["CA", "Carlos A.", "8 visitas"],
            ["AN", "Andrea N.", "5 visitas"],
            ["JP", "José P.", "3 visitas"],
            ["LH", "Luis H.", "9 visitas"],
            ["KT", "Karla T.", "6 visitas"],
            ["PG", "Paola G.", "11 visitas"],
            ["EQ", "Esteban Q.", "2 visitas"],
          ].map(([ini, nombre, visitas]) => (
            <div
              key={ini}
              className="cine-perfil flex items-center gap-3 rounded-2xl border border-[color:var(--linea)] bg-[color:var(--grafito)] px-3 py-3 text-left"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--azul-tenue)] text-[11px] font-extrabold text-[color:var(--azul-claro)]">
                {ini}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-extrabold text-white">
                  {nombre}
                </span>
                <span className="block text-[10.5px] font-semibold text-[color:var(--humo)]">
                  {visitas}
                </span>
              </span>
            </div>
          ))}
        </div>
      </SeccionViva>

      {/* ═══════════ 06 · WALLET ═══════════ */}
      <SeccionViva className="mx-auto max-w-[1180px] px-5 py-28 text-center">
        <p className="cine-kicker cine-reveal">Apple Wallet · Google Wallet</p>
        <h2 className="cine-display cine-reveal mx-auto mt-5 max-w-[20ch] text-[clamp(32px,5.5vw,66px)]">
          TU PROGRAMA. SIEMPRE EN EL BOLSILLO DE TU CLIENTE.
        </h2>
        <p className="cine-reveal mx-auto mt-6 max-w-[52ch] text-[16px] leading-relaxed text-[color:var(--humo)]">
          El pase se guarda en el teléfono como cualquier tarjeta de embarque —
          sin instalar apps. Cada sello nuevo le llega ahí mismo.
        </p>
        <div className="mt-16 flex flex-wrap items-start justify-center gap-10 sm:gap-16">
          <div className="cine-pase flex flex-col items-center gap-4">
            <TelefonoMarco>
              <PantallaTarjeta />
            </TelefonoMarco>
            <span className="rounded-full border border-[color:var(--linea)] px-4 py-1.5 text-[12px] font-extrabold text-white">
               Apple Wallet
            </span>
          </div>
          <div className="cine-pase-2 flex flex-col items-center gap-4">
            <TelefonoMarco>
              <PantallaTarjeta />
            </TelefonoMarco>
            <span className="rounded-full border border-[color:var(--linea)] px-4 py-1.5 text-[12px] font-extrabold text-white">
              ▷ Google Wallet
            </span>
          </div>
        </div>
      </SeccionViva>

      {/* ═══════════ 07 · PARA TODO TIPO DE NEGOCIOS ═══════════ */}
      <SeccionViva className="py-28">
        <div className="mx-auto max-w-[1240px] px-5">
          <p className="cine-kicker cine-reveal">Para todo tipo de negocios</p>
          <h2 className="cine-display cine-reveal mt-5 max-w-[20ch] text-[clamp(32px,5vw,60px)]">
            SI TUS CLIENTES VUELVEN, ES PARA VOS.
          </h2>
        </div>
        <div className="cine-reveal mt-12 px-5">
          <div className="cine-galeria mx-auto max-w-[1400px]">
            {RUBROS.map((r) => (
              <div
                key={r.label}
                className="cine-galeria-item group relative h-[380px] w-[280px] overflow-hidden rounded-3xl border border-[color:var(--linea)] sm:h-[440px] sm:w-[320px]"
              >
                <Image
                  src={fotoUrl(r.foto, 640)}
                  alt={r.label}
                  fill
                  sizes="320px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-left">
                  <p className="text-[19px] font-extrabold text-white">{r.label}</p>
                  <p className="mt-1 text-[12.5px] font-semibold text-[color:var(--azul-claro)]">
                    {r.premio}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[12px] font-semibold text-[color:var(--humo-2)]">
            ← Deslizá para ver más rubros →
          </p>
        </div>
      </SeccionViva>

      {/* ═══════════ 08 · COMPARACIÓN ═══════════ */}
      <SeccionViva className="mx-auto max-w-[1100px] px-5 py-28 text-center">
        <h2 className="cine-display cine-reveal mx-auto max-w-[16ch] text-[clamp(36px,7vw,84px)]">
          DEJÁ DE ESPERAR QUE REGRESEN.
        </h2>
        <div className="mt-16 grid gap-5 md:grid-cols-2">
          <div className="cine-comp-sin rounded-3xl border border-[color:var(--linea)] bg-white/[0.02] p-8 text-left">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[color:var(--humo-2)]">
              Sin Bookea
            </p>
            <div className="mt-5 flex flex-col gap-3 text-[15px] font-semibold text-[color:var(--humo)]">
              <p>El cliente compra.</p>
              <p>Se va.</p>
              <p className="text-[color:var(--humo-2)]">No sabés si vuelve — ni cuándo.</p>
            </div>
          </div>
          <div className="cine-comp-con rounded-3xl border border-[color:var(--azul)]/40 bg-[color:var(--azul-tenue)] p-8 text-left">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[color:var(--azul-claro)]">
              Con Bookea
            </p>
            <div className="mt-5 flex flex-col gap-3 text-[15px] font-bold text-white">
              <p>El cliente compra.</p>
              <p>Acumula sellos.</p>
              <p>Recibe su recompensa.</p>
              <p className="text-[color:var(--azul-claro)]">Y regresa.</p>
            </div>
          </div>
        </div>
      </SeccionViva>

      {/* ═══════════ CIERRE — CTA ═══════════ */}
      <section className="relative flex min-h-[92svh] flex-col items-center justify-center px-5 py-28 text-center">
        <div className="cine-flotar mb-12">
          <TelefonoMarco>
            <PantallaTarjeta />
          </TelefonoMarco>
        </div>
        <h2 className="cine-display text-[clamp(52px,12vw,150px)]">
          HAZ QUE
          <br />
          VUELVAN.
        </h2>
        <p className="mt-6 text-[16px] leading-relaxed text-[color:var(--humo)]">
          Creá tu programa de lealtad digital con Bookea.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/lealtad/nuevo" className="cine-cta">
            Crear mi plan de lealtad <span aria-hidden>→</span>
          </Link>
          <Link href="/lealtad/demo" className="cine-cta-fantasma">
            Ver demostración
          </Link>
        </div>
      </section>
    </div>
  );
}
