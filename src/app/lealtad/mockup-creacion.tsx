"use client";

import { useEffect, useState } from "react";
import { CodigoQR } from "@/components/lealtad/codigo-qr";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";
import { useMockupVivo } from "./use-mockup-vivo";
import { MarcoIPhone } from "./telefono-mockup";

/**
 * LA COMPOSICIÓN ANIMADA DE «CREÁ TU PASE» (ago 2026) — la primera de
 * las tres franjas: el DUEÑO armando su tarjeta y viéndola quedar al
 * instante.
 *
 * A la izquierda (arriba en móvil) el panelito de controles; a la
 * derecha el pase dentro del mismo teléfono que usan `mockup-anuncios`,
 * `mockup-hitos` y `mockup-cercania`, para que las cuatro se lean como
 * una familia. Lo que cambia acá es de quién es la mano: en las otras
 * tres el visitante MIRA algo que pasa solo; en esta puede TOCAR.
 *
 * Tres decisiones que vale la pena dejar escritas:
 *
 *   1. LOS CONTROLES SON BOTONES DE VERDAD, y por eso viven FUERA del
 *      `aria-hidden`. Ver el comentario grande más abajo: un control
 *      dentro de un subárbol escondido es un botón al que el teclado
 *      llega y el lector de pantalla no anuncia.
 *   2. EL BUCLE CEDE. Mientras nadie toca nada, el mockup recorre solo
 *      el guion de combinaciones. En cuanto alguien hace clic, el bucle
 *      se apaga entero y manda el visitante — si siguiera corriendo por
 *      encima del clic, el mockup se sentiría roto.
 *   3. TODO LO QUE SE VE ES UTILERÍA DECLARADA. «Café Aurora», el
 *      cliente, los 6 de 8 sellos, los 180 puntos y el código del cupón
 *      son un ejemplo ilustrativo, y el propio mockup lo dice en texto
 *      visible. No son cifras de Bookea ni de un negocio real.
 */

/* ── El vocabulario del mockup ──────────────────────────────────────
   Los tres tipos que se pueden mostrar acá. El id coincide a propósito
   con el nombre del icono en `panel/[id]/iconos.tsx` (los ids de ese
   juego calcan `TipoTarjeta`), así el botón pinta su icono sin una
   tabla de traducción que alguien tenga que mantener al día. */
type TipoPase = "sellos" | "puntos" | "cupon";

const TIPOS: { id: TipoPase; etiqueta: string; icono: NombreIcono }[] = [
  { id: "sellos", etiqueta: "Sellos", icono: "sellos" },
  { id: "puntos", etiqueta: "Puntos", icono: "puntos" },
  { id: "cupon", etiqueta: "Cupón", icono: "cupon" },
];

/**
 * Las paletas del pase.
 *
 * Van en hexadecimal y NO en los tokens de `.lealtad` a propósito, con
 * el mismo criterio que `mockup-hero-pase.tsx`: el color del pase es
 * CONTENIDO —lo elige el negocio, es su marca—, no el color de la
 * interfaz de Bookea. Los tokens (`--accion`, `--accion-suave`…) sí
 * gobiernan todo el resto del mockup: panel, botones y estados.
 *
 * Las tres capas van de la más oscura a la más clara y el degradé
 * corre a 145°, así que el peor fondo para la letra blanca es siempre
 * `capas[2]`. Los cuatro están medidos contra blanco:
 *   #0f4c9e ....... 8,24:1 ✅ (es el propio --accion)
 *   #93551f ....... 5,90:1 ✅
 *   #1a7458 ....... 5,70:1 ✅
 *   #9c2350 ....... 7,60:1 ✅
 * Ninguna paleta nueva entra acá sin esa cuenta hecha. */
type Paleta = { id: string; nombre: string; capas: readonly [string, string, string] };

const COLORES: Paleta[] = [
  { id: "navy", nombre: "Navy", capas: ["#0a1226", "#16295e", "#0f4c9e"] },
  { id: "tostado", nombre: "Tostado", capas: ["#241206", "#4d2a12", "#93551f"] },
  { id: "bosque", nombre: "Bosque", capas: ["#04231a", "#0b4133", "#1a7458"] },
  { id: "vino", nombre: "Vino", capas: ["#26071a", "#551232", "#9c2350"] },
];

/**
 * La regalía. El tercer control existe porque es el campo que un dueño
 * cambia de verdad al armar su tarjeta, y porque afecta a los TRES
 * tipos: en sellos y puntos es lo que se gana al llegar a la meta, y en
 * cupón es el cupón mismo (con su código). Un control que no hiciera
 * nada en uno de los tres estados sería un control que miente. */
const BENEFICIOS: { id: string; etiqueta: string; codigo: string }[] = [
  { id: "cafe", etiqueta: "Café gratis", codigo: "AURORA-CAFE" },
  { id: "dos-por-uno", etiqueta: "2×1 en bebidas", codigo: "AURORA-2X1" },
  { id: "descuento", etiqueta: "25% de descuento", codigo: "AURORA-25" },
];

/**
 * EL GUION DEL BUCLE — cada paso cambia UNA sola cosa.
 *
 * Cambiar dos a la vez se lee como un corte de escena y no como alguien
 * configurando: la gracia del mockup es que se entienda que ESE control
 * produjo ESE cambio. Por eso la vuelta alterna tipo → color →
 * regalía → tipo… y el último paso vuelve al primero también con un
 * único cambio, para que el reinicio no se note.
 *
 * El paso 0 es además EL ESTADO DE REPOSO: es lo que se ve quieto
 * cuando el visitante pidió menos movimiento, y por eso es un pase
 * completo y legible —sellos, navy, café gratis— y no un fotograma a
 * medio camino. */
const GUION: { tipo: number; color: number; beneficio: number }[] = [
  { tipo: 0, color: 0, beneficio: 0 }, // sellos · navy · café gratis  (reposo)
  { tipo: 0, color: 1, beneficio: 0 }, // ← color
  { tipo: 1, color: 1, beneficio: 0 }, // ← tipo
  { tipo: 1, color: 1, beneficio: 1 }, // ← regalía
  { tipo: 1, color: 2, beneficio: 1 }, // ← color
  { tipo: 2, color: 2, beneficio: 1 }, // ← tipo
  { tipo: 2, color: 3, beneficio: 1 }, // ← color
  { tipo: 2, color: 3, beneficio: 2 }, // ← regalía
  { tipo: 0, color: 3, beneficio: 2 }, // ← tipo
  { tipo: 0, color: 0, beneficio: 2 }, // ← color (y de acá vuelve al 0 cambiando la regalía)
];

const DURACION_PASO = 2200;

/* Utilería del pase: números de ejemplo, dichos como ejemplo. */
const SELLOS_META = 8;
const SELLOS_EJEMPLO = 6;
const PUNTOS_META = 200;
const PUNTOS_EJEMPLO = 180;

export default function MockupCreacion() {
  /**
   * `useMovimientoReducido()` y no una copia local con `useEffect` +
   * `useState`: es el hook del repo (`useSyncExternalStore`), y existe
   * porque la copia local ya causó un bug — leía `window.matchMedia`
   * durante el render, el servidor no tiene `window` y eso es un
   * desajuste de hidratación; además, capturada en un `useState`, nunca
   * se enteraba si alguien cambiaba la preferencia con la página
   * abierta. Está contado entero en `mockup-panel-negocio.tsx`.
   *
   * Acá encaja incluso mejor que en `mockup-cercania.tsx`: allá el
   * estado quieto y el arranque de la animación son distintos y hay que
   * "resetear" al empezar; acá el paso 0 del guion YA es el estado de
   * reposo, así que alcanza con no arrancar el bucle.
   */
  const reducido = useMovimientoReducido();

  /**
   * `vivo` (de `useMockupVivo`) gatea SOLO el bucle automático:
   * movimiento bienvenido Y mockup cerca del viewport. `reducido` se
   * queda aparte porque acá también gobierna las transiciones de CSS y
   * el modo manual — que funcionan igual con el bucle pausado por
   * scroll.
   */
  const { ref, vivo } = useMockupVivo<HTMLDivElement>();

  const [paso, setPaso] = useState(0);
  const [tipoIdx, setTipoIdx] = useState(GUION[0].tipo);
  const [colorIdx, setColorIdx] = useState(GUION[0].color);
  const [beneficioIdx, setBeneficioIdx] = useState(GUION[0].beneficio);

  /** El visitante tomó el mando: el bucle se calla hasta que lo suelte. */
  const [manual, setManual] = useState(false);

  useEffect(() => {
    // Tres motivos para no armar el timer: la persona pidió menos
    // movimiento, el mockup no está a la vista (`vivo` junta esos dos),
    // o está manejando ella. En todos los casos el mockup se queda
    // EXACTAMENTE donde está — completo y legible, nunca vacío.
    if (!vivo || manual) return;

    const t = setTimeout(() => {
      const siguiente = (paso + 1) % GUION.length;
      setPaso(siguiente);
      setTipoIdx(GUION[siguiente].tipo);
      setColorIdx(GUION[siguiente].color);
      setBeneficioIdx(GUION[siguiente].beneficio);
    }, DURACION_PASO);

    // Sin este clear, cada cambio de `paso` dejaría un timer huérfano y
    // la landing quedaría quemando CPU en segundo plano.
    return () => clearTimeout(t);
  }, [vivo, manual, paso]);

  const tipo = TIPOS[tipoIdx];
  const color = COLORES[colorIdx];
  const beneficio = BENEFICIOS[beneficioIdx];

  /** Cualquier clic en un control apaga el bucle antes de aplicar el cambio. */
  const elegirTipo = (i: number) => {
    setManual(true);
    setTipoIdx(i);
  };
  const elegirColor = (i: number) => {
    setManual(true);
    setColorIdx(i);
  };
  const elegirBeneficio = (i: number) => {
    setManual(true);
    setBeneficioIdx(i);
  };

  /**
   * Devolverle el mando al bucle REINICIA el guion en vez de retomarlo
   * donde iba. Retomarlo dejaría un salto sin causa 2 segundos después
   * del clic; reiniciarlo hace que el cambio sea la respuesta directa a
   * lo que la persona acaba de tocar, que es lo que espera.
   */
  const soltarElMando = () => {
    setManual(false);
    setPaso(0);
    setTipoIdx(GUION[0].tipo);
    setColorIdx(GUION[0].color);
    setBeneficioIdx(GUION[0].beneficio);
  };

  const pieDelPase =
    tipo.id === "sellos"
      ? `Al completar los ${SELLOS_META} sellos: ${beneficio.etiqueta}`
      : tipo.id === "puntos"
        ? `Canjeás ${PUNTOS_META} puntos por: ${beneficio.etiqueta}`
        : "Un solo uso · vence el 30 de setiembre";

  return (
    <div ref={ref}>
      {/* ⚠️ ESTE PÁRRAFO VA FUERA DE TODO `aria-hidden`, Y NO ES UN
          DETALLE. Un `aria-hidden` esconde el subárbol ENTERO: si la
          descripción queda adentro, quien no ve la pantalla se
          encuentra con un hueco mudo donde debería estar la explicación
          del mockup. Ya pasó en este repo —está documentado en
          `mockup-cercania.tsx`— y por eso acá el texto sale primero y
          solo el DIBUJO queda escondido. */}
      <p className="sr-only">
        Demostración interactiva: desde el panel de tu negocio elegís el tipo de
        tarjeta —sellos, puntos o cupón—, el color y la regalía, y el pase de
        Wallet de tus clientes se actualiza al instante. El negocio, los números
        y el código son un ejemplo ilustrativo.
      </p>

      {/* ⚠️ SE ABRE EN lg Y SE VUELVE A CERRAR EN xl, Y NO ES UN ERROR.

          Este mockup vive dentro del slider de «¿Cómo funciona?», que
          se parte en dos columnas recién en xl (1280). Entonces:
          · hasta 1279 el slider va apilado y acá SÍ hay ancho para
            poner el panel y el teléfono lado a lado (a 1100 px,
            apilarlos empujaba la sección a 1.502 px);
          · desde 1280 el slider ya tomó la mitad del ancho para el
            texto, así que este mockup se cierra a una columna o
            quedarían tres columnas apretadas.
          Medido a 1100 y a 1440 px. */}
      <div className="grid items-center justify-items-center gap-10 lg:grid-cols-2 lg:gap-8">
        {/* ═══ IZQUIERDA: LOS CONTROLES ═══════════════════════════════
            Sin `aria-hidden` a propósito. Son botones reales, con foco,
            texto y `aria-pressed`; meterlos en un subárbol escondido
            dejaría controles a los que el teclado llega y el lector de
            pantalla no anuncia — el peor de los dos mundos. */}
        <div
          className="w-full max-w-[440px] rounded-3xl border border-aventurea-line bg-aventurea-surface p-6 sm:p-7"
          style={{ boxShadow: "0 26px 60px rgba(16,30,66,.12)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-aventurea-ink-soft">
              Tu panel · Creador de tarjeta
            </p>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-extrabold uppercase leading-none tracking-wide"
              style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
            >
              Ejemplo
            </span>
          </div>

          <h3 className="mt-2 text-[19px] font-extrabold leading-tight text-aventurea-navy">
            Armá tu tarjeta y mirá cómo queda
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            Elegí el tipo, el color y la regalía. La vista previa se actualiza
            mientras elegís — no hay que guardar para ver.
          </p>

          {/* ── Tipo de tarjeta ─────────────────────────────────────── */}
          <div role="group" aria-label="Tipo de tarjeta" className="mt-5">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
              Tipo de tarjeta
            </p>
            <div className="mt-2 flex gap-2">
              {TIPOS.map((t, i) => {
                const activo = i === tipoIdx;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => elegirTipo(i)}
                    aria-pressed={activo}
                    className={`presionable flex flex-1 flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-[12px] font-bold ${
                      activo ? "" : "border-aventurea-line text-aventurea-ink-soft"
                    }`}
                    style={
                      activo
                        ? {
                            borderColor: "var(--accion)",
                            background: "var(--accion-suave)",
                            color: "var(--accion-fuerte)",
                          }
                        : undefined
                    }
                  >
                    <Icono nombre={t.icono} className="h-[19px] w-[19px]" />
                    {t.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Color ───────────────────────────────────────────────── */}
          <div role="group" aria-label="Color de la tarjeta" className="mt-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                Color
              </p>
              {/* El nombre del color elegido, en texto visible: un disco
                  de color solo con `aria-label` es accesible pero deja a
                  quien SÍ ve la pantalla adivinando cómo se llama. */}
              <p className="text-[11.5px] font-bold text-aventurea-navy">{color.nombre}</p>
            </div>
            <div className="mt-2 flex gap-3">
              {COLORES.map((c, i) => {
                const activo = i === colorIdx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => elegirColor(i)}
                    aria-pressed={activo}
                    aria-label={`Color ${c.nombre}`}
                    className="presionable grid h-10 w-10 place-items-center rounded-full text-white"
                    style={{
                      background: `linear-gradient(145deg, ${c.capas[0]}, ${c.capas[2]})`,
                      // El indicador de elegido es el visto BLANCO dentro
                      // del disco, no un anillo con separación: el anillo
                      // necesita pintar el color del fondo entre medio y
                      // ese fondo cambia con el tema oscuro de Lealtad.
                      // Un visto blanco se lee sobre las cuatro paletas
                      // (todas ≥5,7:1 contra blanco) y sobre los dos temas.
                      boxShadow: activo
                        ? "0 0 0 3px var(--accion-suave), 0 6px 14px rgba(16,30,66,.22)"
                        : "0 0 0 1px rgba(16,30,66,.14)",
                    }}
                  >
                    {activo && <Icono nombre="listo" className="h-[17px] w-[17px]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Regalía ─────────────────────────────────────────────── */}
          <div role="group" aria-label="Regalía" className="mt-5">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
              Regalía
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BENEFICIOS.map((b, i) => {
                const activo = i === beneficioIdx;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => elegirBeneficio(i)}
                    aria-pressed={activo}
                    className={`presionable rounded-full border px-3.5 py-2 text-[12px] font-bold ${
                      activo ? "" : "border-aventurea-line text-aventurea-ink-soft"
                    }`}
                    style={
                      activo
                        ? {
                            borderColor: "var(--accion)",
                            background: "var(--accion-suave)",
                            color: "var(--accion-fuerte)",
                          }
                        : undefined
                    }
                  >
                    {b.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── El pie: quién está manejando, y la advertencia de que
                 todo esto es utilería ──────────────────────────────── */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-aventurea-line pt-4">
            <p className="text-[11px] font-bold leading-snug text-aventurea-ink-soft">
              {manual ? "Estás manejando vos la vista previa." : "La demo va sola — tocá cualquier opción y tomás el mando."}
            </p>
            {manual && (
              <button
                type="button"
                onClick={soltarElMando}
                className="presionable shrink-0 rounded-full px-3.5 py-2 text-[11.5px] font-extrabold"
                style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
              >
                Ver la demo sola
              </button>
            )}
          </div>

          {/* Regla de la casa: si hay números, se dicen ejemplo en el
              propio mockup. No son datos de Bookea ni de un negocio real. */}
          <p className="mt-3 text-[10.5px] leading-snug text-aventurea-ink-soft">
            Ejemplo ilustrativo: «Café Aurora», el cliente, los saldos y el código
            del cupón son de muestra.
          </p>

          {/* El estado de la vista previa, en texto, para quien no la ve.
              Solo se dicta CUANDO MANDA EL VISITANTE: si el bucle
              automático también avisara, le dictaría algo nuevo cada dos
              segundos a un lector de pantalla — que es exactamente la
              clase de ruido que hace que la gente apague la página. Con
              el bucle corriendo alcanza la descripción general de arriba.

              ⚠️ LO QUE SE APAGA ES EL TEXTO, NO EL `aria-live`.
              Esto estaba escrito como `aria-live={manual ? "polite" :
              "off"}`, y esa forma se come justo el aviso que más
              importa: el del PRIMER clic. Una región solo se anuncia si
              ya estaba viva ANTES de que su contenido cambiara; si el
              atributo pasa de «off» a «polite» en el mismo render en
              que aparece el texto, NVDA, JAWS y VoiceOver la tratan
              como región recién agregada y se quedan callados. El
              visitante que no ve la pantalla tocaba un botón y no
              recibía nada — la única señal de que el control funcionó.

              Con la región viva desde el montaje y VACÍA mientras corre
              el bucle: no dicta nada de entrada (no hay texto), no
              dicta nada durante el bucle (sigue vacía), y en el primer
              clic el texto entra en una región ya establecida y sí se
              anuncia. */}
          <p className="sr-only" aria-live="polite">
            {manual
              ? `Vista previa: tarjeta de ${tipo.etiqueta.toLowerCase()} de Café Aurora, color ${color.nombre}, regalía ${beneficio.etiqueta}.`
              : ""}
          </p>
        </div>

        {/* ═══ DERECHA: LA VISTA PREVIA ══════════════════════════════ */}
        <div className="flex flex-col items-center">
          {/* Solo el DIBUJO va escondido: no tiene nada que un lector de
              pantalla pueda aprovechar, y todo lo que dice ya está en
              texto arriba. Adentro no hay un solo control enfocable. */}
          {/* El chasis sale de `MarcoIPhone`: acá había uno dibujado a
              mano, y otro distinto en cada mockup — seis teléfonos con
              distinto degradado, radio e isla en la misma página. */}
          <MarcoIPhone
            ancho="w-[268px] sm:w-[287px]"
            fondoPantalla={"#f7f8fb"}
            className="relative rotate-[1.5deg]"
            conBrillo={false}
          >
              <div className="flex justify-between px-5 pt-4 text-[11px] font-bold text-[#0d1733]">
                <span>9:41</span>
                <span>● ◒ ▰</span>
              </div>
              <div className="flex items-center justify-between px-6 pb-3 pt-2">
                <span className="text-[23px] font-extrabold text-[#0d1733]">Wallet</span>
                <span className="text-[19px] text-[#0d1733]/60">⊕</span>
              </div>

              {/* ── EL PASE ──────────────────────────────────────────
                  El color de fondo NO se anima con `transition:
                  background`: los degradés no interpolan, así que eso da
                  un salto seco. En vez de eso hay una capa por paleta,
                  apiladas, y se funden con OPACIDAD — que es una de las
                  dos propiedades que sí corren en el compositor. */}
              <div
                className="relative mx-4 overflow-hidden rounded-[20px] p-5 text-white"
                style={{
                  background: color.capas[0],
                  boxShadow: "0 20px 40px rgba(10,24,60,.24)",
                }}
              >
                {COLORES.map((c, i) => (
                  <span
                    key={c.id}
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(145deg,${c.capas[0]} 0%,${c.capas[1]} 52%,${c.capas[2]} 100%)`,
                      opacity: i === colorIdx ? 1 : 0,
                      // Con movimiento reducido el cambio es instantáneo:
                      // la preferencia apaga el MOVIMIENTO, no el
                      // contenido — el color nuevo se pone igual, sin la
                      // fundida.
                      transition: reducido ? "none" : "opacity 450ms var(--ease-bookea)",
                    }}
                  />
                ))}
                <span className="absolute -right-16 -top-16 h-[190px] w-[190px] rounded-full bg-white/[0.09]" />

                <div className="relative">
                  {/* Cabecera del pase: negocio + su logo. El cuadrito
                      blanco es el logo DEL NEGOCIO (por eso la taza), no
                      la marca de Bookea. */}
                  <div className="flex items-center justify-between text-[12px] font-bold">
                    <span className="truncate">Café Aurora</span>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-[14px]">
                      ☕
                    </span>
                  </div>

                  {/* El cuerpo cambia entero con el tipo. La `key` fuerza
                      el remontaje para que `entra-suave` vuelva a correr;
                      esa clase anima solo transform y opacity, y
                      globals.css la baja a 1 ms con movimiento reducido
                      (aparece puesta, sin deslizarse). */}
                  <div key={tipo.id} className="entra-suave">
                    <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">
                      {tipo.etiqueta}
                    </p>

                    {/* EL TITULAR TAMBIÉN LLEVA PISO, por el mismo
                        motivo que la zona de progreso de abajo: las tres
                        variantes miden distinto y sin el piso el pase
                        entero cambiaba de alto en cada paso del bucle,
                        arrastrando con él el código del cliente y el
                        botón de Wallet — un salto de ~11 px cada dos
                        segundos, dentro del teléfono.
                        44 px alcanza para el caso más alto: 34 px con
                        `leading-tight` son 42,5. `items-end` apoya las
                        tres variantes en la misma línea de base óptica,
                        así el titular no flota cuando es el más chico.
                        Y el cupón baja de 25 a 22 px porque la regalía
                        más larga («25% de descuento») a 25 px se pasa de
                        los ~210 px de ancho útil en el teléfono angosto
                        y se partía en dos líneas — que es justo el salto
                        que este piso viene a sacar. */}
                    <div className="flex min-h-[44px] items-end">
                      {tipo.id === "sellos" && (
                        <p className="text-[34px] font-extrabold leading-tight tracking-tight tabular-nums">
                          {SELLOS_EJEMPLO}/{SELLOS_META}
                        </p>
                      )}
                      {tipo.id === "puntos" && (
                        <p className="text-[34px] font-extrabold leading-tight tracking-tight tabular-nums">
                          {PUNTOS_EJEMPLO}
                          <span className="ml-1 text-[15px] font-bold text-white/75">pts</span>
                        </p>
                      )}
                      {tipo.id === "cupon" && (
                        <p className="text-[22px] font-extrabold leading-tight tracking-tight">
                          {beneficio.etiqueta}
                        </p>
                      )}
                    </div>

                    {/* La zona de progreso, con alto mínimo: las tres
                        variantes miden distinto y sin el piso el pase
                        entero cambiaría de tamaño al elegir el tipo. */}
                    <div className="mt-4 min-h-[52px]">
                      {tipo.id === "sellos" && (
                        <div className="grid grid-cols-8 gap-1.5">
                          {Array.from({ length: SELLOS_META }, (_, i) => {
                            const lleno = i < SELLOS_EJEMPLO;
                            return (
                              <span
                                key={i}
                                className="grid h-[24px] place-items-center rounded-full border text-[9px] font-extrabold"
                                style={{
                                  // Nada de `scale()` acá, ni siquiera
                                  // para el sello lleno: estos círculos
                                  // llevan texto adentro y escalar texto
                                  // es lo que lo deja entre píxeles. El
                                  // relleno solo dice lo mismo, y el
                                  // cambio de tipo ya entra con
                                  // `entra-suave` (transform + opacity).
                                  background: lleno ? "#ffffff" : "transparent",
                                  borderColor: lleno ? "#ffffff" : "rgba(255,255,255,.45)",
                                  color: lleno ? color.capas[1] : "rgba(255,255,255,.75)",
                                }}
                              >
                                {lleno ? "✓" : i + 1}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {tipo.id === "puntos" && (
                        <>
                          {/* ── LA BARRA CRECE CON `scaleX`, NO CON `width`
                              ni con `height` ────────────────────────────
                              Animar una medida obliga al navegador a
                              rehacer el layout en cada fotograma, y ese es
                              el mismo hilo que atiende los clics — justo lo
                              que hunde el INP de una landing. `transform`
                              corre en el compositor y no toca layout.
                              `origin-left` es lo que hace que crezca desde
                              la izquierda y no desde el centro; y el
                              `scale` es seguro porque la barra es un
                              rectángulo de color plano, sin una letra
                              adentro que resamplear. */}
                          <div className="h-[7px] w-full overflow-hidden rounded-full bg-white/20">
                            <div
                              className="h-full w-full origin-left rounded-full bg-white"
                              style={{
                                transform: `scaleX(${PUNTOS_EJEMPLO / PUNTOS_META})`,
                                transition: reducido
                                  ? "none"
                                  : "transform 600ms var(--ease-bookea)",
                              }}
                            />
                          </div>
                          <p className="mt-2.5 text-[10.5px] font-bold text-white/80">
                            {PUNTOS_EJEMPLO} de {PUNTOS_META} para tu próximo canje
                          </p>
                        </>
                      )}

                      {tipo.id === "cupon" && (
                        <div className="rounded-xl border border-dashed border-white/45 bg-white/10 px-3 py-2 text-center">
                          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/70">
                            Código
                          </p>
                          <p className="mt-0.5 text-[14px] font-extrabold tracking-[0.16em]">
                            {beneficio.codigo}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between text-[8.5px] font-bold uppercase tracking-wide text-white/75">
                    <span>Cliente</span>
                    <span>Regalía</span>
                  </div>
                  <div className="mt-0.5 flex justify-between gap-3 text-[11.5px] font-extrabold">
                    <span className="truncate">María González</span>
                    <span className="shrink-0" style={{ color: "var(--orange-claro)" }}>
                      {beneficio.etiqueta}
                    </span>
                  </div>

                  <p className="mt-3.5 text-center text-[9px] font-bold text-white/85">
                    {pieDelPase}
                  </p>
                </div>
              </div>

              {/* El código del cliente y el botón de Wallet: son lo que
                  termina de leerse como un PASE y no como una card de
                  sitio web. El código es un QR DE VERDAD desde el 30 ago
                  2026 (antes era una grilla de gradientes que no escaneaba
                  nada) — ver `codigo-qr.tsx`. */}
              <div className="mx-auto mt-4 grid h-[70px] w-[70px] place-items-center rounded-xl bg-white text-[#0a1226] shadow-[0_10px_26px_rgba(13,23,51,.10)]">
                <CodigoQR lado={50} />
              </div>
              <p className="mt-1.5 text-center text-[8px] font-bold text-[#6d7484]">
                Código del cliente
              </p>
              <div className="mx-4 mt-3 rounded-xl border border-[#e6e8ee] bg-white p-2.5 text-center text-[11px] font-bold text-[#0d1733]">
                Agregar a Apple Wallet
              </div>
          </MarcoIPhone>

          <p className="mt-4 text-center text-[11px] font-bold text-aventurea-ink-soft">
            Así lo ve tu cliente en su teléfono
          </p>
        </div>
      </div>
    </div>
  );
}
