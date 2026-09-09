"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  IconCloche,
  IconInstagram,
  IconPlay,
  IconSpotify,
  IconTiktok,
  IconWhatsapp,
  IconYoutube,
} from "@/components/icons";
import type { Bloque } from "./vitrina-escenas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  MOCKUPS VIVOS — el teléfono del que se salen las piezas
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026), con la sección «Create and customize
 * your Linktree in minutes» en pantalla, y después: «te podés lucir
 * más: mirá la calidad, el diseño, la imagen».
 *
 * ── DE QUÉ ESTÁ HECHO ──────────────────────────────────────────────
 * · Las PANTALLAS llevan fotos de verdad: las tres escenas HD que ya
 *   viven en Cloudflare Images (las del héroe), recortadas con
 *   `object-position` sobre la persona o el plato. Una página de
 *   enlaces con foto de fondo es exactamente lo que el producto hace.
 * · Los OBJETOS que se salen son CSS y SVG dibujados acá: un vinilo que
 *   gira (degradados radiales), audífonos, una mancuerna, una tarjeta
 *   de lealtad con sus sellos, tarjetas con recortes de las fotos.
 * · El teléfono tiene bisel, botones laterales, isla y un brillo de
 *   pantalla; está en perspectiva y GIRA al entrar y al salir.
 *
 * ── LA COREOGRAFÍA ─────────────────────────────────────────────────
 * Cada pieza conoce el vector al centro del teléfono (`--dx`, `--dy`):
 * nace ahí, chica y transparente, y BROTA a su lugar con rebote,
 * escalonada 90 ms por `--i` (keyframes en globals.css). Después
 * FLOTA despacio (un hijo aparte, para que las dos animaciones no se
 * pisen). Al cambiar de escena vuelve a meterse. Cada escena se monta
 * con `key` propia: React la remonta y la animación se repite sola;
 * la anterior queda 650 ms terminando de salir.
 *
 * Con `prefers-reduced-motion`: sin carrusel, piezas quietas.
 */

const CF = "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g";
const FOTO = {
  gimnasio: `${CF}/linksy-hero-gimnasio/gallery`,
  restaurante: `${CF}/linksy-hero-restaurante/gallery`,
  lavacar: `${CF}/linksy-hero-lavacar/gallery`,
};

type Red = "instagram" | "tiktok" | "whatsapp" | "spotify" | "youtube";
const REDES: Record<Red, { Icono: (p: { className?: string }) => ReactNode; nombre: string }> = {
  instagram: { Icono: IconInstagram, nombre: "Instagram" },
  tiktok: { Icono: IconTiktok, nombre: "TikTok" },
  whatsapp: { Icono: IconWhatsapp, nombre: "WhatsApp" },
  spotify: { Icono: IconSpotify, nombre: "Spotify" },
  youtube: { Icono: IconYoutube, nombre: "YouTube" },
};

/** Una pieza que se sale del teléfono: dónde queda, de dónde brota, y qué es. */
type Pieza = {
  id: string;
  left: string;
  top: string;
  dx: string;
  dy: string;
  rot?: string;
  /** Retraso de la flotación, para que no suban todas a la vez. */
  flota?: string;
  nodo: ReactNode;
};

type EscenaMock = {
  id: string;
  marca: string;
  rubro: string;
  /** La foto de la pantalla y su encuadre. Sin foto: degradado. */
  foto?: { src: string; pos: string };
  fondo: [Bloque, Bloque];
  /** El bloque cuyo color de tinta se usa sobre la pantalla. */
  claro: boolean;
  tabs: [string, string];
  puertas: { texto: string; icono?: ReactNode }[];
  extra?: ReactNode;
  piezas: Pieza[];
  redes: [Red, Red, Red];
};

const bloque = (b: Bloque) => ({ background: `var(--linksy-${b})`, color: `var(--linksy-${b}-tinta)` });

// ── Los objetos ──────────────────────────────────────────────────────

function Vinilo() {
  return (
    <div className="linksy-mock-gira relative h-[168px] w-[168px] rounded-full" style={{ filter: "drop-shadow(0 24px 30px rgba(0,0,0,.45))" }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.05) 0 1.5px, rgba(0,0,0,0) 1.5px 4px), radial-gradient(circle at 50% 50%, var(--linksy-carbon) 0 100%)",
        }}
      />
      {/* El reflejo de la luz sobre los surcos. */}
      <div aria-hidden className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 210deg, rgba(255,255,255,0) 0 30%, rgba(255,255,255,.16) 36%, rgba(255,255,255,0) 42% 78%, rgba(255,255,255,.12) 84%, rgba(255,255,255,0) 90%)" }} />
      <div className="absolute left-1/2 top-1/2 grid h-[62px] w-[62px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full" style={bloque("coral")}>
        <span className="titulo text-[11px] font-extrabold uppercase tracking-[0.14em]">Nova</span>
        <span aria-hidden className="absolute h-2.5 w-2.5 rounded-full" style={{ background: "var(--linksy-papel)" }} />
      </div>
    </div>
  );
}

function Audifonos() {
  return (
    <svg viewBox="0 0 120 120" className="h-[132px] w-[132px]" style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,.4))" }} aria-hidden>
      <path d="M22 76V58a38 38 0 0 1 76 0v18" fill="none" stroke="var(--linksy-papel)" strokeWidth="11" strokeLinecap="round" />
      <path d="M22 76V58a38 38 0 0 1 76 0v18" fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" />
      <rect x="8" y="64" width="28" height="44" rx="12" fill="var(--linksy-papel)" />
      <rect x="84" y="64" width="28" height="44" rx="12" fill="var(--linksy-papel)" />
      <rect x="14" y="70" width="16" height="32" rx="8" fill="var(--linksy-lila)" />
      <rect x="90" y="70" width="16" height="32" rx="8" fill="var(--linksy-lila)" />
      <circle cx="22" cy="86" r="4" fill="var(--linksy-carbon)" opacity=".35" />
      <circle cx="98" cy="86" r="4" fill="var(--linksy-carbon)" opacity=".35" />
    </svg>
  );
}

function Mancuerna() {
  return (
    <svg viewBox="0 0 140 70" className="h-[76px] w-[152px]" style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,.4))" }} aria-hidden>
      <rect x="34" y="30" width="72" height="10" rx="5" fill="var(--linksy-papel)" />
      <rect x="14" y="10" width="18" height="50" rx="6" fill="var(--linksy-lima)" />
      <rect x="108" y="10" width="18" height="50" rx="6" fill="var(--linksy-lima)" />
      <rect x="4" y="18" width="12" height="34" rx="5" fill="var(--linksy-carbon)" />
      <rect x="124" y="18" width="12" height="34" rx="5" fill="var(--linksy-carbon)" />
      <rect x="18" y="14" width="4" height="42" rx="2" fill="rgba(255,255,255,.45)" />
      <rect x="112" y="14" width="4" height="42" rx="2" fill="rgba(255,255,255,.45)" />
    </svg>
  );
}

/** Una tarjeta con un recorte de foto de verdad. */
function TarjetaFoto({ src, pos, zoom = 1, titulo, pie, chip }: { src: string; pos: string; /** Acerca el recorte sobre `pos`: 2 = el doble. */ zoom?: number; titulo: string; pie: string; chip?: string }) {
  return (
    <div className="w-[156px] rounded-[22px] p-2.5 shadow-flotante" style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}>
      <div className="relative h-[110px] overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- recorte de una escena de Cloudflare */}
        <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: pos, transform: `scale(${zoom})`, transformOrigin: pos }} />
        {chip && (
          <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]" style={bloque("lima")}>
            {chip}
          </span>
        )}
      </div>
      <p className="titulo mt-2 truncate text-[14px] font-extrabold leading-tight">{titulo}</p>
      <p className="text-[12px] font-bold" style={{ color: "var(--linksy-tinta-suave)" }}>
        {pie}
      </p>
    </div>
  );
}

/** La tarjeta de lealtad, con sus sellos: lo que ningún linktree tiene. */
function TarjetaLealtad({ sellos, meta, marca, premio }: { sellos: number; meta: number; marca: string; premio: string }) {
  return (
    <div className="w-[176px] rounded-[20px] p-3.5 shadow-flotante" style={bloque("carbon")}>
      <div className="flex items-center justify-between">
        <span className="titulo text-[12px] font-extrabold">{marca}</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={bloque("lima")}>
          {sellos}/{meta}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-5 gap-1.5">
        {Array.from({ length: meta }, (_, i) => (
          <span
            key={i}
            className="grid aspect-square place-items-center rounded-full text-[9px] font-extrabold"
            style={i < sellos ? bloque("lima") : { background: "rgba(255,255,255,.12)" }}
          >
            {i < sellos ? "✓" : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] font-bold opacity-80">{premio}</p>
    </div>
  );
}

/** La tarjeta de un set, con ecualizador vivo. */
function TarjetaSet() {
  return (
    <div className="w-[164px] rounded-[22px] p-2.5 shadow-flotante" style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}>
      <div className="relative flex h-[104px] items-end justify-between overflow-hidden rounded-2xl px-3 pb-3" style={{ background: "linear-gradient(160deg, var(--linksy-lila), var(--linksy-azul))" }}>
        <span className="linksy-mock-eq flex items-end gap-[3px]" aria-hidden>
          {[0.5, 0.9, 0.4, 1, 0.7, 0.35, 0.8].map((h, i) => (
            <span key={i} className="w-[5px] rounded-full" style={{ height: `${h * 44}px`, background: "var(--linksy-lima)", "--d": `${i * 110}ms` } as CSSProperties} />
          ))}
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full" style={bloque("lima")}>
          <IconPlay className="h-4 w-4" />
        </span>
      </div>
      <p className="titulo mt-2 truncate text-[14px] font-extrabold leading-tight">Spring set · en vivo</p>
      <p className="text-[12px] font-bold" style={{ color: "var(--linksy-tinta-suave)" }}>
        Spotify · 58 min
      </p>
    </div>
  );
}

function Cloche() {
  return (
    <div className="grid h-[132px] w-[132px] place-items-center rounded-full" style={{ ...bloque("amarillo"), boxShadow: "0 24px 30px rgba(0,0,0,.4), inset 0 -10px 0 rgba(0,0,0,.08)" }}>
      <IconCloche className="h-[62px] w-[62px]" />
    </div>
  );
}

// ── Las escenas ──────────────────────────────────────────────────────

const ESCENAS: EscenaMock[] = [
  {
    id: "shaep",
    marca: "shaep",
    rubro: "Gimnasio y coach",
    foto: { src: FOTO.gimnasio, pos: "78% 20%" },
    fondo: ["lima", "menta"],
    claro: false,
    tabs: ["Planes", "Comunidad"],
    puertas: [{ texto: "Plan 12 semanas" }, { texto: "Guía de nutrición" }, { texto: "Clase de prueba gratis" }],
    piezas: [
      { id: "mancuerna", left: "396px", top: "62px", dx: "-162px", dy: "214px", rot: "-12deg", flota: "0s", nodo: <Mancuerna /> },
      { id: "plan", left: "4px", top: "306px", dx: "228px", dy: "-92px", rot: "-4deg", flota: "1.2s", nodo: <TarjetaFoto src={FOTO.gimnasio} pos="6% 88%" zoom={3.1} titulo="Plan 12 semanas" pie="₡24 900 / mes" chip="Nuevo" /> },
      { id: "lealtad", left: "440px", top: "468px", dx: "-218px", dy: "-229px", rot: "4deg", flota: "2.1s", nodo: <TarjetaLealtad sellos={8} meta={10} marca="shaep · club" premio="Una clase gratis al completar" /> },
    ],
    redes: ["instagram", "tiktok", "youtube"],
  },
  {
    id: "nova",
    marca: "NOVA",
    rubro: "DJ · música",
    fondo: ["carbon", "azul"],
    claro: false,
    tabs: ["Sets", "Fechas"],
    puertas: [{ texto: "Nuevo set · escuchalo", icono: <IconPlay className="h-4 w-4" /> }, { texto: "Próxima fecha · 21 sep" }, { texto: "Bookings" }],
    extra: (
      <span className="linksy-mock-eq mt-4 flex h-10 items-end gap-1" aria-hidden>
        {[0.4, 0.8, 0.55, 1, 0.65, 0.35, 0.9, 0.5, 0.75, 0.45, 0.85, 0.6].map((h, i) => (
          <span key={i} className="w-[6px] rounded-full" style={{ height: `${h * 40}px`, background: "var(--linksy-lima)", "--d": `${i * 90}ms` } as CSSProperties} />
        ))}
      </span>
    ),
    piezas: [
      { id: "vinilo", left: "412px", top: "22px", dx: "-186px", dy: "208px", rot: "0deg", flota: "0.4s", nodo: <Vinilo /> },
      { id: "audifonos", left: "12px", top: "330px", dx: "232px", dy: "-82px", rot: "-8deg", flota: "1.5s", nodo: <Audifonos /> },
      { id: "set", left: "444px", top: "468px", dx: "-216px", dy: "-224px", rot: "4deg", flota: "2.4s", nodo: <TarjetaSet /> },
    ],
    redes: ["spotify", "youtube", "instagram"],
  },
  {
    id: "sabores",
    marca: "Sabores",
    rubro: "Restaurante",
    foto: { src: FOTO.restaurante, pos: "24% 50%" },
    fondo: ["coral", "amarillo"],
    claro: false,
    tabs: ["Menú", "Pedidos"],
    puertas: [{ texto: "Pedí por WhatsApp", icono: <IconWhatsapp className="h-4 w-4" /> }, { texto: "Reservá una mesa" }, { texto: "Menú del día" }],
    piezas: [
      { id: "cloche", left: "430px", top: "40px", dx: "-186px", dy: "208px", rot: "0deg", flota: "0.2s", nodo: <Cloche /> },
      { id: "plato", left: "4px", top: "306px", dx: "228px", dy: "-92px", rot: "-4deg", flota: "1.1s", nodo: <TarjetaFoto src={FOTO.restaurante} pos="30% 62%" zoom={2.8} titulo="Filete a la parrilla" pie="₡12 800" chip="Hoy" /> },
      { id: "lealtad", left: "440px", top: "468px", dx: "-218px", dy: "-229px", rot: "4deg", flota: "2s", nodo: <TarjetaLealtad sellos={7} meta={10} marca="Sabores" premio="Un postre gratis al completar" /> },
    ],
    redes: ["instagram", "whatsapp", "tiktok"],
  },
];

const INTERVALO_MS = 5600;
const SALIDA_MS = 650;

// ── Una escena: teléfono + piezas ────────────────────────────────────

function Telefono({ e }: { e: EscenaMock }) {
  const tinta = e.claro ? "var(--linksy-tinta)" : "var(--linksy-carbon-tinta)";
  return (
    <div className="linksy-mock-telefono absolute left-[186px] top-[58px] h-[512px] w-[248px]">
      {/* Botones laterales */}
      <span aria-hidden className="absolute -left-[3px] top-[110px] h-[34px] w-[3px] rounded-l" style={{ background: "rgba(255,255,255,.25)" }} />
      <span aria-hidden className="absolute -left-[3px] top-[156px] h-[58px] w-[3px] rounded-l" style={{ background: "rgba(255,255,255,.25)" }} />
      <span aria-hidden className="absolute -right-[3px] top-[140px] h-[74px] w-[3px] rounded-r" style={{ background: "rgba(255,255,255,.25)" }} />
      {/* Bisel */}
      <div className="h-full w-full rounded-[46px] p-[8px] shadow-flotante" style={{ background: "var(--linksy-carbon)", boxShadow: "0 40px 60px -20px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.14)" }}>
        <div className="relative h-full w-full overflow-hidden rounded-[38px]" style={{ background: `linear-gradient(170deg, var(--linksy-${e.fondo[0]}) 0%, var(--linksy-${e.fondo[1]}) 100%)`, color: tinta }}>
          {e.foto && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- escena HD de Cloudflare */}
              <img src={e.foto.src} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: e.foto.pos }} />
              <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,16,20,.15) 0%, rgba(16,16,20,.2) 40%, rgba(16,16,20,.82) 100%)" }} />
            </>
          )}
          {/* Isla */}
          <span aria-hidden className="absolute left-1/2 top-3 h-[26px] w-[92px] -translate-x-1/2 rounded-full" style={{ background: "var(--linksy-carbon)" }} />
          {/* Brillo de pantalla */}
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,.06) 28%, rgba(255,255,255,0) 46%)" }} />

          <div className="relative flex h-full flex-col justify-end p-5 pb-6">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] opacity-80">{e.rubro}</p>
            <p className={`titulo mt-1 font-extrabold leading-none tracking-tight ${e.id === "nova" ? "text-[44px] tracking-[0.08em]" : "text-[32px]"}`}>{e.marca}</p>
            {e.extra}
            <div className="mt-4 flex gap-2">
              {e.tabs.map((t, i) => (
                <span key={t} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold" style={i === 0 ? bloque("lima") : { background: "rgba(255,255,255,.22)", color: tinta, backdropFilter: "blur(6px)" }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {e.puertas.map((p, i) => (
                <span key={p.texto} className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[12.5px] font-extrabold" style={{ background: `rgba(255,255,255,${i === 0 ? ".9" : ".22"})`, color: i === 0 ? "var(--linksy-tinta)" : tinta, backdropFilter: "blur(8px)" }}>
                  {p.icono}
                  {p.texto}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Escena({ e, fase }: { e: EscenaMock; fase: "entra" | "sale" }) {
  return (
    <div className="linksy-mock-escena absolute inset-0" data-fase={fase} aria-hidden={fase === "sale"}>
      {/* EL ESCENARIO. Tres capas, en este orden: la luz grande del
          color de la escena detrás del teléfono, un rebote del segundo
          color abajo a la derecha para que el negro no se lea plano, y
          la sombra de contacto en el piso — sin ella el aparato flota y
          el conjunto entero parece pegado encima del fondo. */}
      <span aria-hidden className="absolute rounded-full blur-[70px]" style={{ left: 150, top: 74, width: 330, height: 330, background: `var(--linksy-${e.fondo[0]})`, opacity: 0.42 }} />
      <span aria-hidden className="absolute rounded-full blur-[70px]" style={{ left: 380, top: 380, width: 240, height: 240, background: `var(--linksy-${e.fondo[1]})`, opacity: 0.22 }} />
      <span aria-hidden className="absolute rounded-[50%] blur-xl" style={{ left: 208, top: 566, width: 210, height: 26, background: "rgba(0,0,0,.6)" }} />

      <Telefono e={e} />

      {e.piezas.map((p, i) => (
        <div key={p.id} className="linksy-mock-pieza absolute" style={{ "--i": i + 1, "--dx": p.dx, "--dy": p.dy, "--rot": p.rot ?? "0deg", left: p.left, top: p.top } as CSSProperties}>
          <div className="linksy-mock-flota" style={{ "--f": p.flota ?? "0s" } as CSSProperties}>
            {p.nodo}
          </div>
        </div>
      ))}

      {e.redes.map((r, i) => {
        const R = REDES[r];
        return (
          <span
            key={r}
            title={R.nombre}
            className="linksy-mock-pieza absolute grid h-14 w-14 place-items-center rounded-full shadow-elevado"
            style={{ "--i": i + 4, "--dx": "142px", "--dy": `${192 - i * 72}px`, "--rot": "0deg", left: 122, top: 100 + i * 74, ...bloque("lima") } as CSSProperties}
          >
            <span className="linksy-mock-flota grid place-items-center" style={{ "--f": `${0.6 + i * 0.5}s` } as CSSProperties}>
              <R.Icono className="h-6 w-6" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ── El carrusel ──────────────────────────────────────────────────────

export default function MockupsVivos() {
  const [activa, setActiva] = useState(0);
  const [saliente, setSaliente] = useState<number | null>(null);
  const [pausa, setPausa] = useState(false);
  const [reducido, setReducido] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setReducido(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);

  const ir = (n: number) => {
    const destino = (n + ESCENAS.length) % ESCENAS.length;
    if (destino === activa) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    setSaliente(activa);
    setActiva(destino);
    temporizador.current = setTimeout(() => setSaliente(null), SALIDA_MS);
  };

  useEffect(() => {
    if (pausa || reducido) return;
    const id = setInterval(() => ir(activa + 1), INTERVALO_MS);
    return () => clearInterval(id);
    // `ir` cambia con `activa`; el intervalo se rearma con cada escena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa, pausa, reducido]);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  return (
    <div className="linksy-mock-marco mx-auto w-[640px] max-w-full" onPointerEnter={() => setPausa(true)} onPointerLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      {/* El escenario mide SIEMPRE 620×660 y el teléfono va centrado en
          él (x 186–434, más lo que la perspectiva ensancha). Cada pieza
          se coloca en píxeles contra ese rectángulo: ninguna cae sobre un
          texto y solo el objeto de arriba pisa la foto, a propósito. En
          pantallas angostas se escala entero. */}
      <div className="linksy-mock-escenario relative h-[660px] w-[640px]" role="group" aria-roledescription="carrusel" aria-label="Ejemplos de páginas de Linksy">
        {saliente !== null && <Escena key={`sale-${saliente}`} e={ESCENAS[saliente]} fase="sale" />}
        <Escena key={`entra-${activa}`} e={ESCENAS[activa]} fase="entra" />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2" role="tablist" aria-label="Elegir ejemplo">
          {ESCENAS.map((e, i) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={i === activa}
              aria-label={`${e.marca} · ${e.rubro}`}
              onClick={() => ir(i)}
              className="h-2.5 rounded-full transition-all"
              style={{ width: i === activa ? 28 : 10, background: "var(--linksy-lima)", opacity: i === activa ? 1 : 0.45, transitionDuration: "var(--duracion-micro, 200ms)" }}
            />
          ))}
        </div>
        <p className="text-[13px] font-bold opacity-80">
          {ESCENAS[activa].marca} · {ESCENAS[activa].rubro}
        </p>
      </div>
    </div>
  );
}
