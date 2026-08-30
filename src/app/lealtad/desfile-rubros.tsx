"use client";

import { useEffect, useRef, useState } from "react";
import { CodigoQR } from "@/components/lealtad/codigo-qr";
import { PANTALLAS_RUBRO, type PantallaRubro } from "@/lib/lealtad/pantallas-rubro";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL DESFILE DE RUBROS — «así se ve en un negocio como el tuyo»
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (30 ago 2026), en dos vueltas:
 *   1ª — tarjetas tipo pantalla de teléfono (barbería, salón, lavacar,
 *        tienda en línea, joyería, cafetería) desfilando hacia la
 *        derecha, y que la de abajo del cursor se levante.
 *   2ª — «que el card quede más estructurado y elaborado, que
 *        pareciera el pase del Wallet, tipo código QR y todo eso», y
 *        «poder agarrarlo y lanzarlo con el mouse».
 *
 * ── POR QUÉ DEJÓ DE SER UNA ANIMACIÓN CSS ──────────────────────────
 * La primera versión era un riel con `@keyframes` y cero JavaScript.
 * Eso NO admite arrastrar: una animación de `transform` no se puede
 * tomar por la mitad y seguir desde ahí sin pelearse con el motor de
 * animación del navegador.
 *
 * Acá el riel es un contenedor con SCROLL NATIVO y el avance automático
 * lo hace `requestAnimationFrame` moviendo `scrollLeft`. Con eso:
 *   · arrastrar es mover `scrollLeft`, sin fórmulas ni saltos;
 *   · en teléfono el gesto de deslizar ya funciona solo, porque es
 *     scroll de verdad y no un truco;
 *   · la rueda del mouse y el teclado siguen sirviendo.
 *
 * ── EL BUCLE INFINITO ──────────────────────────────────────────────
 * La lista se pinta DOS veces. Cuando el scroll pasa la mitad, se le
 * resta la mitad del ancho: como la segunda copia es idéntica a la
 * primera, el salto cae en un punto donde el dibujo es exactamente el
 * mismo y no se ve. Es el mismo principio del desfile de invitaciones,
 * solo que con scroll en vez de `translate`.
 *
 * ── SE FRENA CUANDO CORRESPONDE ────────────────────────────────────
 * Al pasar el mouse por encima (para poder mirar un pase con calma), y
 * mientras se arrastra. También respeta `prefers-reduced-motion`: ahí
 * NO avanza solo nunca — pero el riel sigue siendo scrolleable a mano,
 * porque quien pidió menos movimiento no pidió menos contenido.
 */
export default function DesfileRubros() {
  const riel = useRef<HTMLDivElement>(null);
  const [quieto, setQuieto] = useState(false);
  /** La posición del riel en decimales (ver el comentario del efecto). */
  const pos = useRef(0);
  const arrastre = useRef<{ activo: boolean; x0: number; scroll0: number; movio: boolean }>({
    activo: false,
    x0: 0,
    scroll0: 0,
    movio: false,
  });

  // ── El avance automático ────────────────────────────────────────────
  //
  // ⚠️ LA POSICIÓN SE LLEVA APARTE, EN `pos`, Y NO SE LEE DE
  // `scrollLeft`. A 26 px/s cada cuadro avanza ~0,43 px, y el navegador
  // REDONDEA `scrollLeft` al asignarlo: sumarle 0,43 sesenta veces por
  // segundo lo deja clavado donde estaba, porque cada fracción se pierde
  // en el redondeo. Con el acumulador propio la fracción sobrevive entre
  // cuadros y el riel avanza de verdad (se vio: no se movía ni un píxel).
  useEffect(() => {
    const el = riel.current;
    if (!el) return;
    const menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (menosMovimiento) return;

    let pedido = 0;
    let previo = 0;
    // px por segundo. Lento a propósito: esto es ambientación, no un
    // carrusel que haya que seguir con la vista.
    const VELOCIDAD = 26;

    const paso = (t: number) => {
      if (previo === 0) previo = t;
      const dt = (t - previo) / 1000;
      previo = t;
      if (!quieto && !arrastre.current.activo) {
        const mitad = el.scrollWidth / 2;
        pos.current += VELOCIDAD * dt;
        // Al pasar la mitad se vuelve al mismo punto de la primera
        // copia: el contenido es idéntico, así que no se percibe.
        if (mitad > 0 && pos.current >= mitad) pos.current -= mitad;
        el.scrollLeft = pos.current;
      }
      pedido = requestAnimationFrame(paso);
    };
    pedido = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(pedido);
  }, [quieto]);

  // ── Arrastrar con el mouse ──────────────────────────────────────────
  // En teléfono NO se hace nada: el scroll táctil nativo ya resuelve el
  // gesto, y meterle `pointer` encima solo lo empeora.
  function alPresionar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    const el = riel.current;
    if (!el) return;
    arrastre.current = { activo: true, x0: e.clientX, scroll0: el.scrollLeft, movio: false };
    el.setPointerCapture(e.pointerId);
  }

  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    const el = riel.current;
    if (!el || !arrastre.current.activo) return;
    const dx = e.clientX - arrastre.current.x0;
    if (Math.abs(dx) > 3) arrastre.current.movio = true;
    el.scrollLeft = arrastre.current.scroll0 - dx;
    // El acumulador sigue a la mano: sin esto, al soltar, el riel
    // saltaría de vuelta a donde venía la animación.
    pos.current = el.scrollLeft;
    // El bucle también mientras se arrastra, en los dos sentidos.
    const mitad = el.scrollWidth / 2;
    if (mitad > 0) {
      if (el.scrollLeft >= mitad) {
        el.scrollLeft -= mitad;
        arrastre.current.scroll0 -= mitad;
        pos.current = el.scrollLeft;
      } else if (el.scrollLeft <= 0) {
        el.scrollLeft += mitad;
        arrastre.current.scroll0 += mitad;
        pos.current = el.scrollLeft;
      }
    }
  }

  function alSoltar(e: React.PointerEvent<HTMLDivElement>) {
    const el = riel.current;
    if (!el || !arrastre.current.activo) return;
    arrastre.current.activo = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* el puntero ya se fue (salió de la ventana): no hay nada que soltar */
    }
  }

  const vueltas = [...PANTALLAS_RUBRO, ...PANTALLAS_RUBRO];

  return (
    <div
      ref={riel}
      onPointerDown={alPresionar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onMouseEnter={() => setQuieto(true)}
      onMouseLeave={() => setQuieto(false)}
      /* `sin-barra` esconde la barra de scroll sin perder el scroll (ver
         globals.css).

         ⚠️ SIN `touch-action` PROPIO. Se probó con `touch-pan-x` y en
         teléfono eso ATRAPA el dedo: sobre el carrusel la página deja de
         scrollear en vertical. Con el valor por defecto el navegador
         decide según la dirección del gesto —horizontal mueve el riel,
         vertical scrollea la página— que es lo que la gente espera.

         `overscroll-x-contain` evita que al llegar al borde el gesto se
         propague y dispare el «volver atrás» del navegador. */
      className="sin-barra cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing"
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)",
      }}
    >
      <ul className="flex w-max items-end gap-5 px-5 py-6 sm:px-8">
        {vueltas.map((r, i) => (
          <li
            key={`${r.id}-${i}`}
            aria-hidden={i >= PANTALLAS_RUBRO.length}
            className="tarjeta-rubro shrink-0"
          >
            <TelefonoConPase rubro={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * UN TELÉFONO CON EL PASE ADENTRO.
 *
 * El pase imita la anatomía REAL de Apple Wallet, que es la que ya
 * dibuja `vista-pase.tsx` para el negocio: encabezado (logo + nombre +
 * saldo), la franja con la foto, los campos secundarios y el código
 * abajo sobre blanco. No es el mismo componente porque aquel necesita
 * una configuración de pase completa —colores, tipo, beneficio, reglas—
 * y acá lo que hay es una maqueta de vitrina con seis ejemplos fijos;
 * pero el ORDEN de los elementos es el mismo a propósito, para que
 * quien después arme su tarjeta reconozca lo que vio.
 *
 * El código es un QR DE VERDAD (`codigo-qr.tsx`), el mismo que usan
 * los otros dos mockups de la página: escanearlo lleva a /lealtad.
 */
function TelefonoConPase({ rubro }: { rubro: PantallaRubro }) {
  const faltan = Math.max(0, rubro.meta - rubro.saldo);

  return (
    <figure className="w-[186px] sm:w-[202px]">
      <div
        className="relative rounded-[28px] p-[3px]"
        style={{
          background:
            "linear-gradient(150deg,#6b7280,#2a2f38 20%,#171b22 50%,#3f454f 76%,#6b7280)",
          boxShadow: "0 18px 38px -16px rgba(6,12,26,.5)",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[25px] bg-black"
          style={{ aspectRatio: "9 / 18", boxShadow: "inset 0 0 0 2px #05070c" }}
        >
          {/* La isla dinámica. */}
          <span
            aria-hidden
            className="absolute left-1/2 top-[6px] z-30 h-[14px] w-[48px] -translate-x-1/2 rounded-full bg-black"
          />
          {/* La barra de estado: sin ella el rectángulo negro no se lee
              como un teléfono encendido. */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 z-20 flex h-[26px] items-center justify-between px-3 text-[7.5px] font-semibold text-white"
          >
            <span>9:41</span>
            <span className="flex items-center gap-[3px]">
              <span className="flex items-end gap-[1px]">
                {[3, 5, 7, 9].map((h) => (
                  <span key={h} className="w-[2px] rounded-sm bg-white" style={{ height: h }} />
                ))}
              </span>
              <span className="ml-[1px] h-[7px] w-[12px] rounded-[2px] border border-white/80">
                <span className="block h-full w-2/3 rounded-[1px] bg-white" />
              </span>
            </span>
          </div>

          <p
            aria-hidden
            className="absolute inset-x-0 top-[26px] z-20 px-3 text-[11px] font-bold text-white"
          >
            Wallet
          </p>

          {/* ── EL PASE ──────────────────────────────────────────────── */}
          <div className="absolute inset-x-[7px] bottom-[7px] top-[46px] z-10 overflow-hidden rounded-[14px]">
            <div className="flex h-full flex-col" style={{ background: rubro.color }}>
              {/* Encabezado: logo, negocio y el saldo a la derecha —
                  mismo orden que el pase real. */}
              <div className="flex items-start justify-between gap-2 px-2.5 pt-2.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] bg-white/90 text-[8px] font-black text-black">
                    {rubro.negocio.charAt(0)}
                  </span>
                  <span className="truncate text-[9px] font-bold text-white/95">
                    {rubro.negocio}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[6px] font-bold uppercase tracking-[0.12em] text-white/60">
                    Sellos
                  </span>
                  <span className="block text-[11px] font-extrabold leading-none text-white">
                    {rubro.saldo}/{rubro.meta}
                  </span>
                </span>
              </div>

              {/* La FRANJA: en un pase de verdad la foto y los sellos son
                  UNA sola imagen (el strip), por eso los sellos van
                  encima de la foto y no debajo. */}
              <div className="relative mt-2 h-[74px] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto
                    remota de Cloudflare dentro de una maqueta decorativa. */}
                <img
                  src={rubro.foto}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 h-full w-full select-none object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(4,10,26,.1) 0%, rgba(4,10,26,.72) 100%)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-1.5 flex flex-wrap justify-center gap-[3px] px-2">
                  {Array.from({ length: rubro.meta }).map((_, i) => (
                    <span
                      key={i}
                      className="h-[8px] w-[8px] rounded-full border"
                      style={{
                        background: i < rubro.saldo ? "#ffffff" : "transparent",
                        borderColor: i < rubro.saldo ? "#ffffff" : "rgba(255,255,255,.5)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Los campos secundarios, con los rótulos en versalitas
                  como en el pase real. */}
              <div className="flex-1 px-2.5 pt-2">
                <p className="text-[6px] font-bold uppercase tracking-[0.12em] text-white/60">
                  Para tu próxima regalía
                </p>
                <p className="text-[8.5px] font-bold leading-tight text-white">
                  {faltan === 0 ? "¡Ya podés canjear!" : `Te faltan ${faltan} sellos`}
                </p>
                <p className="mt-1.5 text-[6px] font-bold uppercase tracking-[0.12em] text-white/60">
                  Regalía
                </p>
                <p className="truncate text-[8.5px] font-bold text-white">{rubro.premio}</p>
              </div>

              {/* El código, SIEMPRE sobre blanco: sobre el color de la
                  marca un lector no lo agarra, y acá además es lo que
                  hace que se lea como un pase y no como una tarjeta. */}
              <div className="mt-1.5 flex flex-col items-center bg-white px-2 py-1.5">
                <CodigoQR lado={44} />
                <span className="mt-[3px] text-[5.5px] font-semibold text-black/45">
                  Powered by Bookea.lat
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-2.5 text-center text-[12px] font-bold text-aventurea-ink-soft">
        {rubro.rubro}
      </figcaption>
    </figure>
  );
}
