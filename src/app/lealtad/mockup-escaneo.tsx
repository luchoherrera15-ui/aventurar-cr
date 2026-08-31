"use client";

import { useEffect, useState } from "react";
import { Icono } from "./panel/[id]/iconos";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";
import { useMockupVivo } from "./use-mockup-vivo";

/**
 * MOCKUP 2 DE 3 — «EL ESCANEO» (ago 2026).
 *
 * Las otras dos franjas de esta sección muestran UN lado del mostrador:
 * el teléfono del cliente, solo. Acá el punto es justamente que son DOS
 * lados y pasan a la vez — el cliente muestra el código, el negocio lo
 * lee, y el sello cae del otro lado sin que nadie escriba nada. Por eso
 * la composición es asimétrica a propósito: a la izquierda el TELÉFONO
 * (mismo marco que `mockup-cercania` y `mockup-hitos`, para que se lean
 * como familia) y a la derecha la PANTALLA del panel (mismo lenguaje de
 * card blanca que `mockup-panel-negocio`), que es lo que el negocio
 * tiene de verdad enfrente: el escáner vive en el panel, no en una app
 * aparte — ver `panel/[id]/escaner-panel.tsx`.
 *
 * ── POR QUÉ ESTE ES INTERACTIVO Y LOS OTROS NO ────────────────────────
 * El pedido era «mockups animados E INTERACTIVOS». Acá la interacción
 * tiene sentido porque la acción del mockup ES la acción del producto:
 * apretar el botón hace exactamente lo que hace la persona en la caja.
 * En «cuando pasan cerca» no había nada que apretar — eso sale solo.
 *
 * El bucle automático existe para que la sección se vea viva cuando
 * nadie la toca, pero CEDE en el primer clic (`tomado`). Si el bucle
 * siguiera corriendo por encima del visitante, el mockup se sentiría
 * roto: apretás, y dos segundos después algo se mueve sin que hayas
 * hecho nada.
 *
 * ── LOS NÚMEROS SON DE MUESTRA ────────────────────────────────────────
 * «María R.», «Café Aurora» y la cuenta de sellos son utilería, y el
 * mockup lo DICE en dos lugares (la píldora «Vista de ejemplo» de la
 * pantalla del negocio y el pie debajo del botón). Este repo ya tuvo
 * un mockup con cifras inventadas que se leían como estadísticas
 * reales y hubo que sacarlas — ver el comentario de
 * `mockup-panel-negocio.tsx`. Acá no hay ni una sola cifra agregada
 * («X negocios», «Y sellos por día»): lo único que se cuenta son los
 * sellos de esta tarjeta de mentira.
 */

const META = 8;
/** Con cuántos sellos arranca la tarjeta de ejemplo: «4 de 8» → «5 de 8». */
const INICIAL = 4;
const NEGOCIO = "Café Aurora";
const CLIENTE = "María R.";
const RECOMPENSA = "Café gratis";

/** Alto del visor, en píxeles. Lo comparten la caja y el recorrido del
 *  barrido, así que vive en una constante y no escrito dos veces. */
const ALTO_VISOR = 196;

/* ═══════════════════════════════════════════════════════════════════
   EL CÓDIGO QR DE MENTIRA
   ═══════════════════════════════════════════════════════════════════

   Se dibuja con un HASH DETERMINISTA, nunca con `Math.random()`: el
   servidor y el cliente tienen que pintar el MISMO código o React 19
   reporta un desajuste de hidratación y vuelve a renderizar el árbol.
   Además, un patrón que cambia en cada render se ve titilar.

   Y sale como UN SOLO `<path>`, no como 289 `<rect>`: el QR aparece dos
   veces en pantalla (el del teléfono y el del visor), y ~580 nodos de
   DOM para un adorno es exactamente el tipo de peso que no se nota al
   escribirlo y sí se nota al hacer scroll. */

const MODULOS = 17;
/** El cuadrado de las tres esquinas de un QR real. */
const LADO_MIRA = 5;
const ESQUINAS: readonly (readonly [number, number])[] = [
  [0, 0],
  [MODULOS - LADO_MIRA, 0],
  [0, MODULOS - LADO_MIRA],
];

function enLaMira(x: number, y: number) {
  return ESQUINAS.some(
    ([ox, oy]) => x >= ox && x < ox + LADO_MIRA && y >= oy && y < oy + LADO_MIRA,
  );
}

/** Ruido entero repetible: mismo (x, y) ⇒ mismo bit, siempre. */
function bitDeModulo(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0 & 255) > 118;
}

const TRAZO_QR = (() => {
  const partes: string[] = [];
  for (let y = 0; y < MODULOS; y++) {
    for (let x = 0; x < MODULOS; x++) {
      if (enLaMira(x, y)) continue;
      if (bitDeModulo(x, y)) partes.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return partes.join("");
})();

function CodigoQr({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`-1 -1 ${MODULOS + 2} ${MODULOS + 2}`}
      className={className}
      shapeRendering="crispEdges"
      fill="#0a1226"
    >
      <path d={TRAZO_QR} />
      {ESQUINAS.map(([ox, oy]) => (
        <g key={`${ox}-${oy}`}>
          <path d={`M${ox} ${oy}h${LADO_MIRA}v${LADO_MIRA}h-${LADO_MIRA}z`} />
          {/* El hueco blanco del anillo: el QR siempre se pinta sobre una
              teja blanca, en el teléfono y en el visor. */}
          <path
            d={`M${ox + 1} ${oy + 1}h${LADO_MIRA - 2}v${LADO_MIRA - 2}h-${LADO_MIRA - 2}z`}
            fill="#ffffff"
          />
          <path
            d={`M${ox + 2} ${oy + 2}h${LADO_MIRA - 4}v${LADO_MIRA - 4}h-${LADO_MIRA - 4}z`}
          />
        </g>
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LAS TRES FASES DEL MOSTRADOR
   ═══════════════════════════════════════════════════════════════════
   `esperando`  — el visor abierto, buscando el código (el reposo real
                  del escáner: «Buscando el código…»).
   `escaneando` — el barrido corre sobre el QR.
   `listo`      — la confirmación en pantalla y el sello ya puesto.

   El estado INICIAL es `listo` con 4 sellos, y eso no es casualidad: es
   el mismo fotograma que ve quien pidió movimiento reducido, y tiene
   que ser un estado COMPLETO y legible por sí solo —la tarjeta con su
   cuenta, la confirmación con el nombre del cliente—, no un mockup
   vacío esperando una animación que nunca va a arrancar. */
type Fase = "esperando" | "escaneando" | "listo";

export default function MockupEscaneo() {
  /* `useMovimientoReducido` y no un `matchMedia` capturado en un
     `useState`: es la fuente de verdad del repo (`useSyncExternalStore`),
     así el servidor usa el valor por defecto sin fingir que sabe y, si
     alguien enciende «menos movimiento» con la página abierta, el bucle
     se apaga en el acto en vez de seguir corriendo hasta recargar. */
  const reducido = useMovimientoReducido();

  /* `vivo` (de `useMockupVivo`) gatea SOLO el bucle automático.
     `reducido` sigue teniendo trabajo propio: decide si el clic de
     `sellar()` dibuja el barrido y si las transiciones de CSS corren —
     cosas que aplican aunque el bucle esté pausado por scroll. */
  const { ref, vivo } = useMockupVivo<HTMLDivElement>();

  const [sellos, setSellos] = useState(INICIAL);
  const [fase, setFase] = useState<Fase>("listo");
  /** true en cuanto el visitante toca el botón: el bucle automático cede. */
  const [tomado, setTomado] = useState(false);
  /** Índice del sello que acaba de caer — el único que anima su entrada. */
  const [ultimoCaido, setUltimoCaido] = useState<number | null>(null);

  const completa = sellos >= META;

  /* ── El barrido SIEMPRE termina acreditando ───────────────────────
     Va en su propio efecto, separado del bucle automático, justamente
     para que el clic del visitante no dependa de que el bucle siga
     vivo: cuando el visitante toma el control, el bucle se apaga, y si
     el «acreditar» viviera adentro de él, apretar el botón dejaría el
     barrido corriendo para siempre sin sumar nada. */
  useEffect(() => {
    if (fase !== "escaneando") return;
    const t = setTimeout(() => {
      setUltimoCaido(sellos); // el índice del nuevo = cuántos había
      setSellos(Math.min(META, sellos + 1));
      setFase("listo");
    }, 720);
    return () => clearTimeout(t);
  }, [fase, sellos]);

  /* ── El bucle automático: una visita cada ~2,5 s ──────────────────
     Se apaga con `!vivo` (movimiento reducido O mockup fuera del
     viewport: un mostrador atendiendo solo, sin nadie mirando, es CPU
     regalada) y con `tomado` (manda el visitante). El tramo
     `escaneando` se saltea acá a propósito: ese lo cierra el efecto de
     arriba, y dos timers sobre la misma fase se pisarían. Ese efecto
     tampoco se gatea con `vivo`: es el remate one-shot de UNA lectura
     ya arrancada (720 ms), y cortarlo a mitad dejaría el barrido
     corriendo sin acreditar nada. */
  useEffect(() => {
    if (!vivo || tomado || fase === "escaneando") return;
    let t: ReturnType<typeof setTimeout>;
    if (fase === "listo") {
      t = setTimeout(
        () => {
          // Llegó a la meta: arranca otra vuelta sola, igual que hace
          // el producto (la tarjeta completa se reinicia al canjear).
          if (completa) {
            setSellos(0);
            setUltimoCaido(null);
          }
          setFase("esperando");
        },
        // El premio se queda más rato en pantalla: es el momento que se
        // quiere que alguien alcance a leer.
        completa ? 2600 : 1250,
      );
    } else {
      t = setTimeout(() => setFase("escaneando"), 520);
    }
    return () => clearTimeout(t);
  }, [vivo, tomado, fase, sellos, completa]);

  function sellar() {
    // A partir de acá manda el visitante, pase lo que pase.
    setTomado(true);

    if (completa) {
      setSellos(0);
      setUltimoCaido(null);
      setFase("esperando");
      return;
    }

    if (reducido) {
      // Sin barrido: quien pidió menos movimiento igual tiene que poder
      // usar el control y ver el RESULTADO. Se apaga el recorrido, no
      // la función.
      setUltimoCaido(null);
      setSellos(sellos + 1);
      setFase("listo");
      return;
    }

    // Un segundo clic mientras el barrido corre no hace nada (la fase ya
    // es `escaneando`, así que el efecto no se re-dispara y no se cuela
    // un sello de más). Por eso el botón NO se deshabilita: un control
    // que desaparece del recorrido de teclado a mitad de una acción es
    // peor que uno que ignora el clic de más.
    setFase("escaneando");
  }

  /* ── QUÉ SE ANUNCIA, Y CUÁNDO ─────────────────────────────────────
     El anuncio depende de la FASE, no solo de la cuenta. `tomado` se
     enciende en el mismo commit que `fase = "escaneando"`, o sea que
     un anuncio que solo mirara la cuenta hablaría en el instante del
     clic —cuando todavía no hay nada acreditado— y diría el número
     VIEJO («lleva 4 de 8») para corregirse 720 ms después con el
     nuevo. Quien no ve la pantalla escucharía dos veces lo mismo, y la
     primera con el dato equivocado.

     Mientras corre el barrido la región queda VACÍA a propósito: una
     región viva que se vacía no anuncia nada, así que el único aviso
     que sale es el correcto, al final.

     El tramo `esperando` sí habla —pero solo puede llegar acá después
     de «Empezar otra vuelta», porque el bucle automático ya cedió—: sin
     esto, ese botón sería mudo para el lector de pantalla. */
  function textoDelAnuncio() {
    if (fase === "escaneando") return "";
    if (fase === "esperando")
      return `Tarjeta reiniciada. ${CLIENTE} arranca de nuevo en 0 de ${META} sellos.`;
    if (completa)
      return `Tarjeta completa. ${CLIENTE} ya puede reclamar su ${RECOMPENSA.toLowerCase()}.`;
    return `Sello acreditado. ${CLIENTE} lleva ${sellos} de ${META} sellos.`;
  }
  const anuncio = textoDelAnuncio();

  return (
    <div ref={ref} className="flex flex-col items-center gap-7">
      {/* ⚠️ ESTE PÁRRAFO VA FUERA DE LOS `aria-hidden` DE ABAJO.
          Un `aria-hidden` esconde el subárbol ENTERO: si el texto queda
          adentro, quien no ve la pantalla se encuentra con un hueco
          mudo. Ya pasó en este repo — ver el comentario de
          `mockup-cercania.tsx`. Los dos dibujos van escondidos (son
          ilustraciones) y esta descripción es lo único que ese público
          recibe de ellos; el botón y su pie, más abajo, tampoco están
          dentro de ningún `aria-hidden`. */}
      <p className="sr-only">
        Demostración de los dos lados del mostrador: el cliente abre su pase en
        el teléfono y muestra el código; el negocio lo escanea desde su panel y
        el sello queda acreditado al instante, sin apuntar nada a mano. Los
        datos son de ejemplo.
      </p>

      <div className="flex w-full flex-col items-center gap-7 lg:flex-row lg:items-center lg:justify-center lg:gap-10">
        {/* ══ IZQUIERDA — EL TELÉFONO DEL CLIENTE ══════════════════ */}
        <div
          aria-hidden
          className="relative h-[496px] w-[238px] shrink-0 -rotate-[1.5deg] rounded-[42px] p-[8px] sm:h-[528px] sm:w-[252px]"
          style={{
            background: "linear-gradient(145deg,#121827,#3d4557 50%,#0c101a)",
            boxShadow:
              "0 45px 90px rgba(10,18,38,.28), 0 8px 25px rgba(10,18,38,.14)",
          }}
        >
          <span className="absolute left-1/2 top-[14px] z-[8] h-[20px] w-[71px] -translate-x-1/2 rounded-full bg-[#070b12]" />
          <div className="relative h-full overflow-hidden rounded-[35px] bg-[#f7f8fb]">
            <div className="flex justify-between px-5 pt-4 text-[11px] font-bold text-[#0d1733]">
              <span>9:41</span>
              <span>● ◒ ▰</span>
            </div>
            <div className="flex items-center justify-between px-5 pb-2.5 pt-1.5">
              <span className="text-[20px] font-extrabold text-[#0d1733]">
                Wallet
              </span>
              <span className="text-[17px] text-[#0d1733]/50">⊕</span>
            </div>

            {/* ── La tarjeta del pase ──────────────────────────── */}
            <div
              className="relative mx-4 overflow-hidden rounded-[18px] p-4 text-white"
              style={{
                background:
                  "linear-gradient(145deg,#0a1226 0%,#16295e 52%,#0f4c9e 100%)",
                boxShadow: "0 18px 38px rgba(10,24,60,.24)",
              }}
            >
              <span className="absolute -right-16 -top-16 h-[170px] w-[170px] rounded-full bg-white/[0.09]" />
              <div className="flex items-center justify-between text-[11.5px] font-bold">
                <span className="truncate">{NEGOCIO}</span>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white text-[12px] font-extrabold text-[#16295e]">
                  b
                </span>
              </div>

              <p className="mt-4 text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/70">
                Cliente
              </p>
              <p className="text-[15px] font-extrabold leading-tight">
                {CLIENTE}
              </p>

              {/* ── LA FILA DE SELLOS ────────────────────────────
                  Ocho huecos fijos: el aro vacío se queda dibujado en
                  vez de aparecer recién cuando se llena, que es lo que
                  hace el pase de verdad (`SelloConIcono`: lleno el
                  ganado, contorno el que falta). Así se lee «me faltan
                  cuatro» de un vistazo, sin contar.

                  El disco de adentro se MONTA recién cuando el sello se
                  gana, y ese montaje es lo que dispara su caída — ver
                  `SelloQueCae`. */}
              {/* 20 px × 8 + 3 px × 7 = 181 px, y el ancho útil de la
                  tarjeta en el teléfono chico es 186 px. La cuenta está
                  escrita acá porque con `justify-between` un sello un
                  poco más grande no se ve apretado: se sale del marco. */}
              <div className="mt-3.5 flex justify-between gap-[3px]">
                {Array.from({ length: META }, (_, i) => (
                  <span
                    key={i}
                    className="relative grid h-[20px] w-[20px] place-items-center rounded-full border"
                    style={{ borderColor: "rgba(255,255,255,.38)" }}
                  >
                    {i < sellos && (
                      <SelloQueCae cae={!reducido && i === ultimoCaido} />
                    )}
                  </span>
                ))}
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2">
                {/* Al llegar a la meta la cuenta cede el lugar al premio:
                    «8 de 8» es un dato correcto pero muerto — lo que
                    importa en ese momento es que hay algo que reclamar. */}
                {completa ? (
                  <>
                    <span
                      className="shrink-0 rounded-md px-2 py-1 text-[10.5px] font-extrabold"
                      style={{ background: "var(--orange-claro)", color: "#0a1226" }}
                    >
                      ¡Premio listo!
                    </span>
                    <span
                      className="truncate text-[10.5px] font-extrabold"
                      style={{ color: "var(--orange-claro)" }}
                    >
                      {RECOMPENSA}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="shrink-0 text-[11px] font-extrabold tabular-nums">
                      {sellos} de {META} sellos
                    </span>
                    <span className="truncate text-[10.5px] font-bold text-white/70">
                      {RECOMPENSA}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ── El código, abajo, como en el pase real ────────── */}
            <div className="relative mx-auto mt-5 w-fit">
              {/* El halo del momento en que lo están leyendo. Solo
                  `opacity`: es un aviso, no un elemento que se mueva. */}
              <span
                className="absolute -inset-2 rounded-2xl"
                style={{
                  boxShadow: "0 0 0 3px var(--orange-claro)",
                  opacity: fase === "escaneando" ? 0.9 : 0,
                  transition: reducido ? "none" : "opacity 260ms ease-out",
                }}
              />
              <div className="relative grid h-[92px] w-[92px] place-items-center rounded-xl bg-white shadow-[0_10px_26px_rgba(13,23,51,.10)]">
                <CodigoQr className="h-[74px] w-[74px]" />
              </div>
            </div>
            <p className="mt-2 text-center text-[9.5px] font-bold text-[#6d7484]">
              Mostrá este código en la caja
            </p>

            <span className="absolute bottom-2 left-1/2 h-[5px] w-[104px] -translate-x-1/2 rounded-full bg-[#0d1733]/25" />
          </div>
        </div>

        {/* ══ DERECHA — LA PANTALLA DEL NEGOCIO ════════════════════ */}
        <div
          aria-hidden
          className="w-full max-w-[400px] overflow-hidden rounded-3xl border border-aventurea-line bg-aventurea-surface shadow-[0_24px_60px_-34px_rgba(16,38,88,0.22)]"
        >
          <div className="flex items-center justify-between border-b border-[#edf0f5] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-7 w-7 place-items-center rounded-lg text-[12px] font-extrabold text-white"
                style={{ background: "linear-gradient(145deg,#16295e,#0f4c9e)" }}
              >
                b
              </span>
              <span className="text-[13px] font-extrabold text-[#0d1733]">
                {NEGOCIO} · Mostrador
              </span>
            </div>
            {/* El aviso de que nada de esto es un dato real, en la misma
                píldora que ya usa `mockup-panel-negocio`. */}
            <span className="rounded-full bg-[#f2f4f8] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
              Ejemplo
            </span>
          </div>

          <div className="p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8a91a4]">
              Escáner
            </p>
            <p className="mt-0.5 text-[15px] font-extrabold text-[#0d1733]">
              Escanear la tarjeta
            </p>

            {/* ── EL VISOR ──────────────────────────────────────── */}
            <div
              className="relative mt-3.5 overflow-hidden rounded-2xl bg-[#0a1226]"
              style={{ height: ALTO_VISOR }}
            >
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid h-[104px] w-[104px] place-items-center rounded-lg bg-white p-1.5">
                  <CodigoQr className="h-full w-full" />
                </div>
              </div>

              {/* Las esquinas de mira: cuatro escuadras, quietas. Es la
                  misma referencia visual que el escáner de verdad
                  (`escaner-panel.tsx`), donde el personal apunta más
                  rápido con una mira que con una instrucción escrita. */}
              <div className="pointer-events-none absolute inset-6">
                <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-white/80" />
                <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-[3px] border-t-[3px] border-white/80" />
                <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-white/80" />
                <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-[3px] border-r-[3px] border-white/80" />
              </div>

              {/* El destello del momento de la lectura: SOLO `opacity`
                  sobre una capa plana. Nada de filtros ni de `filter:
                  brightness()`, que repintan el subárbol entero. */}
              <span
                className="pointer-events-none absolute inset-0 bg-white"
                style={{
                  opacity: fase === "escaneando" ? 0.16 : 0,
                  transition: reducido ? "none" : "opacity 200ms ease-out",
                }}
              />

              {/* El barrido se MONTA solo mientras se escanea: así cada
                  lectura arranca su recorrido desde arriba sin tener que
                  reiniciar una animación a mano. */}
              {fase === "escaneando" && !reducido && <Barrido />}
            </div>

            {/* ── EL ESTADO ─────────────────────────────────────────
                Alto mínimo fijo: sin esto la card entera crece y encoge
                en cada lectura y la página da un salto. */}
            <div className="mt-3.5 min-h-[74px]">
              {fase === "listo" ? (
                /* `entra-suave` es la utilidad de la casa para «esto se
                   reemplazó»: sube unos píxeles mientras se funde, o sea
                   `transform` + `opacity` y nada más. Y ya viene con su
                   excepción escrita en el bloque de movimiento reducido
                   de globals.css —se acorta a 1 ms en vez de apagarse—,
                   así que con la preferencia activada la confirmación
                   igual aparece ENTERA en vez de quedarse invisible.

                   El `key` la re-monta en cada acreditación: sin él, la
                   segunda confirmación cambiaría el texto sin volver a
                   entrar y no se notaría que pasó algo nuevo. */
                <div
                  key={`${completa ? "premio" : "sello"}-${sellos}`}
                  className="entra-suave flex items-start gap-3 rounded-2xl p-3.5"
                  style={{
                    background: completa
                      ? "var(--orange-suave)"
                      : "var(--accion-suave)",
                  }}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
                    style={{
                      background: completa
                        ? "var(--orange-acento-claro)"
                        : "var(--accion)",
                    }}
                  >
                    <Icono nombre={completa ? "regalo" : "listo"} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-[13px] font-extrabold"
                      style={{
                        color: completa
                          ? "var(--orange-fuerte)"
                          : "var(--accion-fuerte)",
                      }}
                    >
                      {completa ? "¡Premio listo!" : "Sello acreditado"}
                    </p>
                    <p className="mt-0.5 text-[11.5px] font-bold leading-snug text-[#3a4356]">
                      {completa
                        ? `Entregale su ${RECOMPENSA.toLowerCase()} a ${CLIENTE} — su tarjeta arranca otra vuelta.`
                        : `${CLIENTE} · ${sellos} de ${META} sellos en su tarjeta.`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-[#edf0f5] bg-[#f9fafc] p-3.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef0f5] text-[#8a91a4]">
                    <Icono nombre="escanear" className="h-4 w-4" />
                  </span>
                  <p className="text-[12.5px] font-bold text-[#8a91a4]">
                    {fase === "escaneando"
                      ? "Leyendo el código…"
                      : "Buscando el código…"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ EL CONTROL — fuera de todo `aria-hidden` ════════════════
          Un `<button type="button">` de verdad, con texto visible: se
          alcanza con Tab, se dispara con Enter y con la barra, y hereda
          el anillo de foco global de `globals.css`. Un `div` con
          `onClick` no hace ninguna de las tres cosas. */}
      <div className="flex flex-col items-center gap-2.5">
        <button
          type="button"
          onClick={sellar}
          className="presionable rounded-full px-7 py-3.5 text-[14px] font-extrabold shadow-[0_14px_32px_rgba(15,76,158,.28)]"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          {completa ? "Empezar otra vuelta" : "Escaneá el pase"}
        </button>
        <p className="max-w-[420px] text-center text-[11.5px] leading-relaxed text-aventurea-ink-soft">
          Probalo: cada vez que lo presionás, el negocio escanea y el sello cae
          en el pase del cliente. Ejemplo ilustrativo — {CLIENTE} y {NEGOCIO}{" "}
          son de muestra, no datos de un negocio real.
        </p>
      </div>

      {/* El resultado, para quien no ve la pantalla. Solo habla DESPUÉS
          del primer clic: mientras corre el bucle automático nadie pidió
          nada, y una región viva anunciando un sello cada dos segundos
          y medio convierte la landing en un lector de números. */}
      <p role="status" className="sr-only">
        {tomado ? anuncio : ""}
      </p>
    </div>
  );
}

/**
 * EL SELLO QUE CAE.
 *
 * Se anima con `transform` (`translateY` + `scale`) y `opacity`, jamás
 * con `height` ni `width`: esas dos disparan layout en cada cuadro.
 * El disco NO lleva texto adentro a propósito — escalar un elemento con
 * letras las resamplea y las deja borrosas mientras dura la animación.
 *
 * La caída se dispara con el MONTAJE, no con una clase que se agrega:
 * el disco no existe hasta que el sello se gana, así que su primer
 * render ya es el fotograma de arriba y el segundo es el de abajo.
 */
function SelloQueCae({ cae }: { cae: boolean }) {
  // Sin caída, nace puesto: nunca hay un cuadro invisible.
  const [puesto, setPuesto] = useState(!cae);

  useEffect(() => {
    if (!cae) return;
    // Un tick de verdad y no 0 ms: el navegador tiene que PINTAR el
    // estado de arriba antes de que el cambio cuente como transición.
    // Con 0 ms React puede juntar los dos estados en el mismo cuadro y
    // el sello aparecería de golpe, sin caer.
    const t = setTimeout(() => setPuesto(true), 20);
    return () => clearTimeout(t);
  }, [cae]);

  return (
    <span
      className="absolute inset-[2px] rounded-full bg-white"
      style={{
        transform: puesto
          ? "translateY(0) scale(1)"
          : "translateY(-18px) scale(0.45)",
        opacity: puesto ? 1 : 0,
        transition: cae
          ? "transform 460ms cubic-bezier(.24,1.32,.4,1), opacity 200ms ease-out"
          : "none",
      }}
    />
  );
}

/**
 * EL BARRIDO DEL VISOR — una línea que recorre el código de arriba a
 * abajo, una sola vez por lectura.
 *
 * Misma técnica que el sello: monta arriba, pinta, y transiciona hacia
 * abajo. No hay `@keyframes` porque no hace falta —es un recorrido de
 * ida, no un bucle— y porque una keyframe propia habría que agregarla a
 * `globals.css`, con su excepción en el bloque de movimiento reducido.
 * Acá alcanza con no montar el componente: el llamador ya lo condiciona
 * a que el movimiento sea bienvenido.
 */
function Barrido() {
  const [abajo, setAbajo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAbajo(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <span
      className="pointer-events-none absolute left-0 right-0 top-0 h-[3px]"
      style={{
        background:
          "linear-gradient(90deg,transparent,var(--orange-claro) 20%,#ffffff 50%,var(--orange-claro) 80%,transparent)",
        boxShadow: "0 0 18px 3px rgba(255,176,118,.55)",
        transform: `translateY(${abajo ? ALTO_VISOR - 3 : 0}px)`,
        transition: "transform 660ms cubic-bezier(.36,0,.28,1)",
      }}
    />
  );
}
