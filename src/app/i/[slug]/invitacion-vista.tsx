"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconClock, IconPin, IconWaze } from "@/components/icons";
import type { PreguntaInvitacion } from "@/lib/invitaciones-preguntas";
import { confirmarAsistencia } from "./actions";
import {
  AmbienteParticulas,
  CarritoNovios,
  ConfettiRsvp,
  CuentaRegresiva,
  SobreApertura,
  inicialesDe,
  useMovimientoReducido,
} from "./invitacion-animada";

/** Los campos de la invitación que usa la vista pública. */
export type Invitacion = {
  id: string;
  slug: string;
  titulo: string;
  anfitriones: string | null;
  mensaje: string | null;
  fecha_evento: string;
  hora: string | null;
  lugar_nombre: string | null;
  direccion: string | null;
  maps_url: string | null;
  portada_url: string | null;
  html_personalizado: string | null;
  tema: string;
};

/* La paleta de la plantilla clásica: papel marfil, tinta suave y
   dorado champán — líneas finas, nada de navy. */
const inputCls =
  "w-full rounded-xl border border-[#ddd2bc] bg-white px-4 py-3 text-[15px] text-[#3d3a35] placeholder:text-[#b3aa97] focus:border-[#b08d57] focus:outline-none";
const labelCls =
  "mb-1.5 block text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8378]";

/**
 * El lienzo inmersivo de la invitación, pantalla completa y sin header
 * del sitio — la invitación ES la página. La plantilla clásica va en
 * marfil y crema con acentos dorado champán y serif fina (Cormorant,
 * vía --inv3-serif). Si el equipo diseñó un HTML a la medida se
 * renderiza tal cual sobre el lienzo navy de siempre. El bloque de
 * confirmación va siempre al pie: es el corazón del producto.
 */
export default function InvitacionVista({
  invitacion,
  preguntas,
  esEjemplo = false,
  fechaLarga,
  claseFuente,
}: {
  invitacion: Invitacion;
  /** Las preguntas configurables del RSVP (vacío = como siempre). */
  preguntas: PreguntaInvitacion[];
  /** Copia de vitrina: se ve el diseño, pero no se puede confirmar. */
  esEjemplo?: boolean;
  fechaLarga: string;
  /** La clase de next/font que define --inv3-serif (Cormorant). */
  claseFuente: string;
}) {
  // La experiencia animada (sobre, carrito, pétalos…) viste solo la
  // plantilla clásica; un HTML a la medida se respeta tal cual.
  const animada = !invitacion.html_personalizado;

  // El sobre: cerrado → abriendo (animación) → abierto (se desmonta).
  // Con movimiento reducido se deriva "abierto" directo, sin efecto.
  const [faseSobre, setFase] = useState<"cerrado" | "abriendo" | "abierto">(
    animada ? "cerrado" : "abierto",
  );
  const aperturaRef = useRef<number | null>(null);
  const reducido = useMovimientoReducido();
  const fase = reducido ? "abierto" : faseSobre;
  const iniciales = useMemo(() => inicialesDe(invitacion.titulo), [invitacion.titulo]);

  // Mientras el sobre cubre la pantalla no tiene sentido scrollear.
  useEffect(() => {
    if (fase === "abierto") return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [fase]);

  useEffect(
    () => () => {
      if (aperturaRef.current) window.clearTimeout(aperturaRef.current);
    },
    [],
  );

  function tocarSobre() {
    if (fase === "cerrado") {
      setFase("abriendo");
      aperturaRef.current = window.setTimeout(() => setFase("abierto"), 1800);
    } else {
      // Segundo toque = saltarse la animación.
      if (aperturaRef.current) window.clearTimeout(aperturaRef.current);
      setFase("abierto");
    }
  }

  // El RSVP como CARD MODAL (pedido del dueño): si el diseño a la
  // medida trae algún elemento con data-bookea="abrir-rsvp", el
  // formulario deja de ser una sección al pie y pasa a abrirse como
  // card flotante al tocar ese botón. Derivado del HTML — los diseños
  // sin la marca siguen con el bloque al pie de siempre.
  const rsvpEnModal =
    !esEjemplo && !!invitacion.html_personalizado?.includes('data-bookea="abrir-rsvp"');
  const [rsvpAbierto, setRsvpAbierto] = useState(false);

  useEffect(() => {
    if (!rsvpEnModal) return;
    // Delegado en document: el botón vive dentro del HTML inyectado,
    // así que no hay ref de React que lo alcance.
    const alTocar = (e: MouseEvent) => {
      const marcado = (e.target as Element | null)?.closest?.(
        '[data-bookea="abrir-rsvp"]',
      );
      if (marcado) {
        e.preventDefault();
        setRsvpAbierto(true);
      }
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRsvpAbierto(false);
    };
    document.addEventListener("click", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("click", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [rsvpEnModal]);

  // Destino de "cómo llegar": el link exacto si el equipo lo cargó, o
  // la búsqueda por texto del lugar. Waze siempre busca por texto.
  const busqueda = [invitacion.lugar_nombre, invitacion.direccion, "Costa Rica"]
    .filter(Boolean)
    .join(", ");
  const hrefMaps =
    invitacion.maps_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busqueda)}`;
  const hrefWaze = `https://waze.com/ul?q=${encodeURIComponent(busqueda)}&navigate=yes`;

  return (
    <main
      className={`relative min-h-svh overflow-hidden ${
        animada ? "bg-[#faf7f2] text-[#3d3a35]" : "bg-[#16295e] text-white"
      } ${claseFuente}`}
    >
      <RevealOnScroll />

      {/* Animación del "gracias": los keyframes viven acá porque solo
          esta página los usa — no ensucian globals.css. */}
      <style>{`
        @keyframes invitacion-pop {
          0% { opacity: 0; transform: scale(0.92) translateY(10px); }
          60% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .anim-invitacion-pop { animation: invitacion-pop 0.6s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .anim-invitacion-pop { animation: none; }
        }
      `}</style>

      {animada ? (
        <>
          {/* Fondo marfil con dos veladuras champán muy suaves y una
              trama de puntos dorada apenas visible — fijas al viewport
              para que acompañen todo el recorrido, papel fino, nada
              de texturas cargadas. */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0"
            style={{
              background:
                "radial-gradient(52rem 34rem at 85% -8%, rgba(201,169,106,0.14), transparent 60%)," +
                "radial-gradient(46rem 30rem at -12% 32%, rgba(176,141,87,0.1), transparent 60%)," +
                "radial-gradient(40rem 28rem at 55% 108%, rgba(201,169,106,0.12), transparent 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "radial-gradient(rgba(176,141,87,0.6) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
          {/* El paspartú: un marco fijo de línea fina dorada pegado a
              los bordes del viewport — acompaña, no encierra. */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-2.5 z-40 border border-[#c9a96a]/35"
          />
        </>
      ) : (
        <>
          {/* El lienzo navy de siempre para los diseños a la medida. */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0"
            style={{
              background:
                "radial-gradient(52rem 34rem at 85% -8%, rgba(238,116,32,0.16), transparent 60%)," +
                "radial-gradient(46rem 30rem at -12% 32%, rgba(59,127,196,0.2), transparent 60%)," +
                "radial-gradient(40rem 28rem at 55% 108%, rgba(238,116,32,0.1), transparent 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 opacity-[0.16]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
        </>
      )}

      {/* Pétalos blancos y champán en dos capas, detrás del contenido. */}
      {animada && <AmbienteParticulas />}

      <div
        className={`relative flex min-h-svh w-full flex-col ${
          fase === "abriendo" ? "inv2-anim-contenido" : ""
        }`}
      >
        {invitacion.html_personalizado ? (
          /* Diseño a la medida: el HTML del equipo manda tal cual y
             ocupa todo el ancho del viewport — sin columna ni marco.
             Sin data-reveal: las plantillas traen sus propias entradas
             y así ningún transform atrapa sus elementos fijos. */
          <DisenoPropio
            html={invitacion.html_personalizado}
            fechaIso={invitacion.fecha_evento}
            hora={invitacion.hora}
          />
        ) : (
          <PlantillaClasico
            invitacion={invitacion}
            iniciales={iniciales}
            fechaLarga={fechaLarga}
            hrefMaps={hrefMaps}
            hrefWaze={hrefWaze}
          />
        )}

        {esEjemplo ? (
          /* Muestra del catálogo: sin RSVP, para que nadie confirme en
             el evento de otra persona. */
          <div className="relative mx-auto w-full max-w-[640px] px-5 py-10 text-center">
            <p
              className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                animada ? "text-[#8a6a3f]" : "text-white/60"
              }`}
            >
              Muestra de diseño
            </p>
            <p
              className={`mt-2 text-[14px] leading-relaxed ${
                animada ? "text-[#5b5449]" : "text-white/75"
              }`}
            >
              Así se vería tu invitación. En la tuya, tus invitados confirman
              acá mismo y vos ves la lista en vivo.
            </p>
            <Link
              href="/invitaciones#paquetes"
              className="mt-5 inline-block rounded-xl bg-aventurea-sky px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark"
            >
              Quiero la mía
            </Link>
          </div>
        ) : rsvpEnModal ? (
          /* El diseño trae su propio botón de confirmar: el formulario
             vive en una card flotante, no como sección al pie. */
          rsvpAbierto && (
            <div
              className="fixed inset-0 z-[95] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Confirmá tu asistencia"
            >
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setRsvpAbierto(false)}
                className="anim-velo-entrar absolute inset-0 cursor-default bg-[#1c1730]/60 backdrop-blur-[2px]"
              />
              <div className="anim-panel-entrar relative max-h-[92svh] w-full max-w-[600px] overflow-y-auto rounded-3xl">
                <button
                  type="button"
                  onClick={() => setRsvpAbierto(false)}
                  aria-label="Cerrar"
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#3d3a35]/10 text-[17px] font-bold text-[#6b6459] transition-colors hover:bg-[#3d3a35]/20"
                >
                  ✕
                </button>
                <BloqueRsvp
                  invitacionId={invitacion.id}
                  preguntas={preguntas}
                  animada={animada}
                  enModal
                />
              </div>
            </div>
          )
        ) : (
          <BloqueRsvp invitacionId={invitacion.id} preguntas={preguntas} animada={animada} />
        )}

        <footer
          className={`relative mt-auto py-9 text-center text-[12px] ${
            animada ? "text-[#a39a89]" : "text-white/45"
          }`}
        >
          Invitación digital por{" "}
          <Link
            href="/"
            className={`font-bold underline-offset-2 hover:underline ${
              animada
                ? "text-[#8a6a3f] hover:text-[#6b5636]"
                : "text-white/70 hover:text-white"
            }`}
          >
            Bookea
          </Link>{" "}
          ✦
        </footer>
      </div>

      {/* El sobre cerrado cubre todo hasta que lo toquen. */}
      {animada && fase !== "abierto" && (
        <SobreApertura
          iniciales={iniciales}
          titulo={invitacion.titulo}
          abriendo={fase === "abriendo"}
          onTocar={tocarSobre}
        />
      )}
    </main>
  );
}

/** La línea fina — rombo — línea fina que separa secciones. */
function Ornamento({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center gap-3 text-[#c9a96a] ${className}`}
    >
      <span className="h-px w-16 bg-current opacity-60" />
      <span className="h-1.5 w-1.5 rotate-45 border border-current" />
      <span className="h-px w-16 bg-current opacity-60" />
    </span>
  );
}

/** Donde el diseño pide que vaya la cuenta regresiva de verdad. */
export const MARCA_CUENTA_REGRESIVA = "cuenta-regresiva";

/**
 * El diseño a la medida (el HTML que salió del generador), con la
 * cuenta regresiva VIVA metida donde el diseño la haya pedido.
 *
 * El HTML se inyecta con innerHTML, y eso nunca ejecuta <script> — por
 * eso el generador los tiene prohibidos. La consecuencia es que una
 * cuenta regresiva dibujada por el modelo queda CONGELADA en los
 * números que le tocaron el día que se generó: al día siguiente miente.
 *
 * La salida es que el diseño solo marque el lugar
 * (<div data-bookea="cuenta-regresiva"></div>) y que acá se le monte
 * encima el mismo componente que usa la plantilla clásica. Se hace con
 * un portal y no partiendo el HTML en pedazos: la marca puede venir
 * anidada dentro de una sección, y cortar el texto ahí rompería el
 * árbol. Si el diseño no trae la marca, todo funciona como antes.
 *
 * memo(): OBLIGATORIO, no una optimización. Los <script> de las
 * plantillas sembradas (docs/plantillas-invitaciones) llegan por SSR y
 * corren al parsear el documento — mutan su propio DOM (countdown que
 * tictaquea, pétalos sembrados, el sobre en el top layer, listeners).
 * En React 19 + Next 16, CUALQUIER re-render del padre que alcance
 * este div vuelve a aplicar el dangerouslySetInnerHTML sobre el mismo
 * nodo aunque __html no cambió: el DOM mutado se reemplaza por HTML
 * fresco cuyos <script> ya no ejecutan — countdown congelado en "—",
 * música sin gesto, partículas vacías. Se reprodujo con dos disparos
 * reales: el flip post-hidratación de useMovimientoReducido (visitante
 * con reduced motion — el bug que el dueño vio en producción) y
 * setRsvpAbierto al tocar "Confirmá tu asistencia". Con memo y props
 * estables (strings), los re-renders del padre nunca tocan este árbol.
 */
const DisenoPropio = memo(function DisenoPropio({
  html,
  fechaIso,
  hora,
}: {
  html: string;
  fechaIso: string;
  hora: string | null;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [destino, setDestino] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const nodo = contenedor.current?.querySelector<HTMLElement>(
      `[data-bookea="${MARCA_CUENTA_REGRESIVA}"]`,
    );
    // Lo que el modelo haya dejado adentro era un marcador de posición
    // (números de ejemplo, casi siempre): se limpia antes de montar el
    // real para que no queden dos cuentas una encima de la otra.
    if (nodo) nodo.replaceChildren();
    setDestino(nodo ?? null);
  }, [html]);

  return (
    <>
      <HtmlDelEquipo html={html} contenedor={contenedor} />
      {destino &&
        createPortal(<CuentaRegresiva fechaIso={fechaIso} hora={hora} />, destino)}
    </>
  );
});

/**
 * El HTML del equipo, aislado en su propio componente memo.
 *
 * No es cosmético: DisenoPropio se re-renderiza SOLO cuando su efecto
 * encuentra la marca de la cuenta regresiva y llama a setDestino. En ese
 * re-render React volvía a aplicar el dangerouslySetInnerHTML sobre el
 * mismo div —aunque el string no cambió— y se llevaba puesto el DOM que
 * ya había: las clases que agregó el <script> de la plantilla y, peor,
 * el nodo marcado al que el portal acababa de mandar la cuenta regresiva
 * (que quedaba tictaqueando en un nodo huérfano, invisible). Es decir:
 * la marca data-bookea="cuenta-regresiva" se rompía a sí misma.
 *
 * Con el HTML acá adentro y props estables (un string y un ref), memo
 * corta ese re-render antes de que llegue al DOM: el árbol inyectado se
 * monta una vez y no lo vuelve a tocar nadie.
 *
 * suppressHydrationWarning: React en dev compara este string contra el
 * innerHTML que el navegador ya NORMALIZÓ (comillas, `&` → `&amp;`,
 * orden de entidades…), así que nunca coinciden textualmente aunque sean
 * el mismo HTML — y React igual no parcha contenido de innerHTML ("won't
 * be patched up"). Sin esto, TODAS las invitaciones con diseño propio
 * llenan la consola de dev con un aviso de hidratación que no es un bug.
 */
const HtmlDelEquipo = memo(function HtmlDelEquipo({
  html,
  contenedor,
}: {
  html: string;
  contenedor: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={contenedor}
      className="w-full"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/**
 * La plantilla "clásico" en secciones a pantalla completa, estilo
 * storytelling: hero de 100svh con el monograma y los nombres
 * gigantes, y luego mensaje, cuenta regresiva y el lugar, cada una
 * de borde a borde con el contenido centrado y legible.
 */
function PlantillaClasico({
  invitacion,
  iniciales,
  fechaLarga,
  hrefMaps,
  hrefWaze,
}: {
  invitacion: Invitacion;
  iniciales: string;
  fechaLarga: string;
  hrefMaps: string;
  hrefWaze: string;
}) {
  // "S&A" → "S & A" para que el monograma respire dentro del rombo.
  const monograma = iniciales.replace("&", " & ");

  return (
    <div className="w-full text-center">
      {/* 1 · Hero a pantalla completa: monograma, nombres y fecha. */}
      <section className="relative flex min-h-svh w-full flex-col items-center justify-center px-6 py-24">
        {/* El monograma en su ornamento: un rombo de línea fina dorada
            con dos líneas que corren hacia los bordes. */}
        <div data-reveal className="flex w-full items-center justify-center gap-4 sm:gap-6">
          <span
            aria-hidden
            className="h-px max-w-24 flex-1 bg-gradient-to-l from-[#c9a96a]/60 to-transparent sm:max-w-48"
          />
          <span className="flex h-[72px] w-[72px] rotate-45 items-center justify-center border border-[#c9a96a]/70 md:h-[92px] md:w-[92px]">
            <span className="inv3-serif -rotate-45 whitespace-nowrap text-[19px] text-[#b08d57] md:text-[23px]">
              {monograma}
            </span>
          </span>
          <span
            aria-hidden
            className="h-px max-w-24 flex-1 bg-gradient-to-r from-[#c9a96a]/60 to-transparent sm:max-w-48"
          />
        </div>

        <p
          data-reveal
          style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          className="mt-10 pl-[0.44em] text-[11px] font-semibold uppercase tracking-[0.44em] text-[#b08d57] md:text-[13px]"
        >
          Te invitamos
        </p>

        {/* Los nombres en Cormorant gigante, escalando con el viewport. */}
        <h1
          data-reveal
          style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
          className="inv3-serif mx-auto mt-5 max-w-[16ch] text-[clamp(40px,9.5vw,118px)] text-[#3d3a35]"
        >
          {invitacion.titulo}
        </h1>

        {invitacion.anfitriones && (
          <p
            data-reveal
            style={{ "--reveal-delay": "260ms" } as React.CSSProperties}
            className="inv3-serif mx-auto mt-6 max-w-[45ch] text-[clamp(16px,2vw,24px)] italic text-[#7d766a]"
          >
            {invitacion.anfitriones}
          </p>
        )}

        <div data-reveal style={{ "--reveal-delay": "340ms" } as React.CSSProperties}>
          <Ornamento className="mt-9" />
        </div>

        <div data-reveal style={{ "--reveal-delay": "420ms" } as React.CSSProperties} className="mt-8">
          <p className="inv3-serif text-[clamp(24px,3.6vw,46px)] text-[#3d3a35]">{fechaLarga}</p>
          {invitacion.hora && (
            <p className="mt-3 inline-flex items-center gap-2 text-[15px] font-semibold text-[#7d766a] md:text-[17px]">
              <IconClock className="h-4 w-4 text-[#b08d57]" /> {invitacion.hora}
            </p>
          )}
        </div>

        <p
          aria-hidden
          className="inv2-anim-pulso absolute bottom-7 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#a39a89]"
        >
          Deslizá ▼
        </p>
      </section>

      {/* 2 · El mensaje de los anfitriones, con la foto si la hay. */}
      {(invitacion.portada_url || invitacion.mensaje) && (
        <section className="relative flex min-h-[70svh] w-full flex-col items-center justify-center bg-white/40 px-6 py-24">
          {invitacion.portada_url && (
            <div
              data-reveal
              className="w-full max-w-[560px] rounded-2xl border border-[#e6dcc6] bg-white p-2 shadow-[0_24px_60px_-32px_rgba(122,101,62,0.45)]"
            >
              {/* Sin aspect ratio fijo — la portada la sube cada cliente
                  con su propia proporción. width/height acá son solo la
                  pista para el srcset; width:100%/height:auto en el
                  style manda el tamaño real (mismo patrón que el álbum
                  digital, src/app/a/[slug]/galeria.tsx). */}
              <Image
                src={invitacion.portada_url}
                alt={invitacion.titulo}
                width={1200}
                height={800}
                sizes="(max-width: 560px) 100vw, 560px"
                className="rounded-xl object-cover"
                style={{ width: "100%", height: "auto" }}
              />
            </div>
          )}
          {invitacion.mensaje && (
            <p
              data-reveal
              className="mx-auto mt-10 max-w-[65ch] text-[clamp(15.5px,1.5vw,20px)] leading-relaxed text-[#5c564c] first:mt-0"
            >
              {invitacion.mensaje}
            </p>
          )}
          <div data-reveal>
            <Ornamento className="mt-10" />
          </div>
        </section>
      )}

      {/* 3 · La cuenta regresiva viva, segundo a segundo. */}
      <section className="relative flex min-h-[70svh] w-full flex-col items-center justify-center px-6 py-24">
        <CuentaRegresiva fechaIso={invitacion.fecha_evento} hora={invitacion.hora} />
      </section>

      {/* 4 · El lugar, con la ubicación a un toque. */}
      {(invitacion.lugar_nombre || invitacion.direccion) && (
        <section className="relative flex min-h-[70svh] w-full flex-col items-center justify-center bg-[#f4ecdb]/70 px-6 py-24">
          <p
            data-reveal
            className="inline-flex items-center gap-2 pl-[0.18em] text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8a8378] md:text-[12px]"
          >
            <IconPin className="h-3.5 w-3.5 text-[#b08d57]" /> El lugar
          </p>
          {invitacion.lugar_nombre && (
            <h2
              data-reveal
              className="inv3-serif mx-auto mt-4 max-w-[24ch] text-[clamp(30px,4.6vw,58px)] text-[#3d3a35]"
            >
              {invitacion.lugar_nombre}
            </h2>
          )}
          {invitacion.direccion && (
            <p
              data-reveal
              className="mx-auto mt-4 max-w-[55ch] text-[clamp(14px,1.4vw,17px)] leading-relaxed text-[#7d766a]"
            >
              {invitacion.direccion}
            </p>
          )}
          <div data-reveal className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={hrefMaps}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#b08d57] px-7 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#9a7847] md:px-9 md:py-3.5 md:text-[15px]"
            >
              Google Maps
            </a>
            <a
              href={hrefWaze}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#b08d57]/50 px-6 py-3 text-[14px] font-bold text-[#8a6a3f] transition-colors hover:border-[#b08d57] hover:bg-[#b08d57]/10 md:px-8 md:py-3.5 md:text-[15px]"
            >
              <IconWaze className="h-4 w-4" /> Waze
            </a>
          </div>
        </section>
      )}

      {/* 5 · El carrito de recién casados: su caminito ahora corre de
          borde a borde del viewport; avanza con el scroll y responde
          al toque (saltito, corazones y "¡beep beep!"). */}
      <section className="relative w-full overflow-hidden py-14">
        <CarritoNovios />
      </section>
    </div>
  );
}

/** "¿Nos acompañás?" — el formulario de confirmación, al pie. */
function BloqueRsvp({
  invitacionId,
  preguntas,
  animada,
  enModal = false,
}: {
  invitacionId: string;
  preguntas: PreguntaInvitacion[];
  /** true en la plantilla clásica: habilita el confetti del "sí". */
  animada: boolean;
  /** Dentro de la card flotante: sin fondo de sección ni data-reveal. */
  enModal?: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [acompanantes, setAcompanantes] = useState("0");
  const [asistira, setAsistira] = useState<boolean | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  function responder(id: string, valor: string) {
    setRespuestas((prev) => ({ ...prev, [id]: valor }));
  }

  function enviar() {
    if (asistira === null) {
      setError("Elegí si vas a asistir o no.");
      return;
    }
    if (!nombre.trim()) {
      setError("Contanos tu nombre para apuntarte.");
      return;
    }
    setError(null);
    const respuesta = asistira;
    startTransition(async () => {
      const res = await confirmarAsistencia({
        invitacionId,
        nombre,
        correo: correo || null,
        acompanantes: parseInt(acompanantes) || 0,
        asistira: respuesta,
        mensaje: mensaje || null,
        // Si al final no viene, sus respuestas de dieta no aplican.
        respuestas: respuesta ? respuestas : {},
      });
      if (res.error) setError(res.error);
      else setEnviado(respuesta);
    });
  }

  // El RSVP como sección de borde a borde: el fondo llena el viewport
  // y la tarjeta del formulario queda centrada y legible. En la card
  // flotante no hay fondo ni relleno: el panel del modal ya encuadra.
  const seccionCls = enModal
    ? "relative flex w-full flex-col items-center"
    : `relative flex w-full flex-col items-center justify-center px-6 py-20 sm:py-24 ${
        animada ? "bg-[#efe5d0]/60" : "bg-black/20"
      }`;

  if (enviado !== null) {
    return (
      <section className={seccionCls}>
        <div className="anim-invitacion-pop relative w-full max-w-[480px] overflow-hidden rounded-3xl border border-[#e3d9c4] bg-[#fffdf8] p-8 text-center shadow-[0_24px_60px_-36px_rgba(122,101,62,0.5)]">
          {/* Si viene, ¡que estalle el confetti sobre el gracias! */}
          {animada && enviado && <ConfettiRsvp />}
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#b08d57] text-[26px]">
            {enviado ? "🎉" : "🤍"}
          </span>
          <h2 className="inv3-serif mt-4 text-[28px] text-[#3d3a35]">¡Gracias por confirmar!</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6b6459]">
            {enviado
              ? "Quedaste en la lista — nos vemos ahí."
              : "Lamentamos que no puedas venir. ¡Gracias por avisar!"}
          </p>
        </div>
      </section>
    );
  }

  return (
    // Sin data-reveal dentro del modal: el observador de scroll corre
    // al montar la página y una card que aparece después quedaría
    // invisible esperando un scroll que nunca la alcanza.
    <section
      {...(enModal ? {} : { "data-reveal": true })}
      className={enModal ? seccionCls : `${seccionCls} min-h-[70svh]`}
    >
      <div className="w-full max-w-[560px] rounded-3xl border border-[#e3d9c4] bg-[#fffdf8] p-7 shadow-[0_24px_60px_-36px_rgba(122,101,62,0.5)] sm:p-10">
      <h2 className="inv3-serif text-center text-[clamp(26px,5.4vw,32px)] text-[#3d3a35]">
        ¿Nos acompañás?
      </h2>
      <p className="mt-2 text-center text-[13px] text-[#8a8378]">
        Confirmá tu asistencia acá mismo — toma menos de un minuto.
      </p>

      <div className="mt-6 grid gap-4">
        <div>
          <label htmlFor="rsvp-nombre" className={labelCls}>
            Tu nombre *
          </label>
          <input
            id="rsvp-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="rsvp-correo" className={labelCls}>
            Tu correo (opcional)
          </label>
          <input
            id="rsvp-correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="Por si los anfitriones necesitan avisarte algo"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="rsvp-acomp" className={labelCls}>
            ¿Cuántas personas te acompañan?
          </label>
          <input
            id="rsvp-acomp"
            type="number"
            min={0}
            max={20}
            value={acompanantes}
            onChange={(e) => setAcompanantes(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            aria-pressed={asistira === true}
            onClick={() => setAsistira(true)}
            className={`rounded-xl border px-4 py-3 text-[14px] font-bold transition-colors ${
              asistira === true
                ? "border-[#b08d57] bg-[#b08d57] text-white"
                : "border-[#ddd2bc] bg-white text-[#6b6459] hover:border-[#b08d57]"
            }`}
          >
            Sí asistiré
          </button>
          <button
            type="button"
            aria-pressed={asistira === false}
            onClick={() => setAsistira(false)}
            className={`rounded-xl border px-4 py-3 text-[14px] font-bold transition-colors ${
              asistira === false
                ? "border-[#3d3a35] bg-[#3d3a35] text-[#faf7f2]"
                : "border-[#ddd2bc] bg-white text-[#6b6459] hover:border-[#3d3a35]"
            }`}
          >
            No podré ir
          </button>
        </div>

        {/* Las preguntas que configuró el equipo (dieta, alergias…):
            solo tienen sentido para quien sí viene, así que se esconden
            al marcar "No podré ir". */}
        {asistira !== false &&
          preguntas.map((p) => (
            <div key={p.id}>
              <label htmlFor={`rsvp-${p.id}`} className={labelCls}>
                {p.etiqueta}
              </label>
              {p.tipo === "opciones" ? (
                <select
                  id={`rsvp-${p.id}`}
                  value={respuestas[p.id] ?? ""}
                  onChange={(e) => responder(p.id, e.target.value)}
                  className={`${inputCls} [&>option]:text-[#3d3a35]`}
                >
                  <option value="">Elegí una opción…</option>
                  {(p.opciones ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`rsvp-${p.id}`}
                  type="text"
                  value={respuestas[p.id] ?? ""}
                  onChange={(e) => responder(p.id, e.target.value)}
                  placeholder="Escribí tu respuesta"
                  className={inputCls}
                />
              )}
            </div>
          ))}

        <div>
          <label htmlFor="rsvp-mensaje" className={labelCls}>
            Un mensajito (opcional)
          </label>
          <textarea
            id="rsvp-mensaje"
            rows={3}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Dejales unas palabras a los anfitriones…"
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={enviar}
          className="rounded-xl bg-[#b08d57] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#9a7847] disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar confirmación"}
        </button>
      </div>
      </div>
    </section>
  );
}
