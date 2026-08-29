"use client";

import { useEffect, useState } from "react";
import { Icono } from "./panel/[id]/iconos";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";
import { useMockupVivo } from "./use-mockup-vivo";

/**
 * LA COMPOSICIÓN ANIMADA DE «LOS CLIENTES VUELVEN MÁS SEGUIDO».
 *
 * A diferencia de `mockup-cercania.tsx` y `mockup-hitos.tsx` —que son
 * un TELÉFONO recibiendo algo— acá no hay teléfono: lo que se cuenta es
 * una comparación, y una comparación se lee en un gráfico, no en una
 * pantalla de bloqueo. Seis meses de visitas de UN cliente, con un
 * interruptor de dos posiciones que cambia el escenario: sin tarjeta
 * (visitas bajas y sueltas) y con tarjeta (visitas que suben mes a mes).
 *
 * ⚠️ ACÁ ES DONDE ESTE REPO YA SE QUEMÓ UNA VEZ, Y POR ESO ESTE
 * COMENTARIO ES TAN LARGO.
 *
 * `mockup-panel-negocio.tsx` mostraba «Ventas de la semana» con cifras
 * que no salían de ningún lado y hubo que sacarlas: la landing le
 * enseñaba a quien está por pagar un número que Bookea no puede
 * respaldar. Una pieza que compara «sin producto» contra «con
 * producto» es EXACTAMENTE el lugar donde vuelve a pasar, porque la
 * tentación es escribir «los negocios con Bookea Lealtad venden 34 %
 * más». Eso sería una estadística falsa presentada como real.
 *
 * Las tres defensas que tiene esta pieza, y ninguna es opcional:
 *
 *   1. El rótulo «Ejemplo ilustrativo» va VISIBLE arriba, dentro del
 *      propio mockup — no en una nota al pie de la sección, que el
 *      lector no asocia con el gráfico.
 *   2. El pie lo dice con todas las letras: son los meses de UN cliente
 *      inventado, no un promedio de la plataforma ni una promesa.
 *   3. Los totales y el promedio NO están escritos a mano: se calculan
 *      de `VISITAS`. Así nadie puede editar una barra y dejar el
 *      resumen diciendo otra cosa — que es la otra forma de mentir sin
 *      querer.
 */

type Modo = "sin" | "con";

const MESES = ["Mar", "Abr", "May", "Jun", "Jul", "Ago"];

/**
 * Las visitas mes a mes del cliente de ejemplo.
 *
 * Los dos escenarios ARRANCAN en el mismo 2 a propósito: es la misma
 * persona, el mismo café y el mismo punto de partida — lo que cambia es
 * lo que pasa después. Si «con tarjeta» empezara más arriba, el gráfico
 * estaría comparando dos clientes distintos y el mensaje se caería
 * solo.
 *
 * Y están elegidos para que el promedio dé ENTERO (12/6 = 2, 30/6 = 5):
 * un resumen que dice «1,8 visitas al mes» se lee como un dato medido,
 * y esto no lo es.
 */
const VISITAS: Record<Modo, number[]> = {
  sin: [2, 1, 3, 1, 2, 3], // suelto e irregular: viene cuando se acuerda
  con: [2, 3, 4, 6, 7, 8], // sube mes a mes: tiene algo que completar
};

/** Cuántos sellos pide el premio, igual que en `mockup-hitos.tsx`. */
const META = 8;

/**
 * La escala del gráfico es COMPARTIDA entre los dos escenarios.
 *
 * Si cada modo se normalizara a su propio máximo, las dos versiones se
 * verían casi iguales —la barra más alta siempre tocaría el techo— y la
 * comparación, que es todo el punto de la pieza, desaparecería.
 */
const MAX = Math.max(...VISITAS.sin, ...VISITAS.con);

const ETIQUETAS: Record<Modo, string> = {
  sin: "Sin tarjeta",
  con: "Con tarjeta",
};

const MODOS: Modo[] = ["sin", "con"];

/** Cada cuánto alterna solo, mientras nadie toque el interruptor. */
const MS_POR_ESCENARIO = 3500;

/**
 * Un solo formateador para el promedio.
 *
 * El resumen visible y la descripción para lector de pantalla no pueden
 * redondear distinto: si uno dice «2» y el otro «1,9», la pieza está
 * dando dos datos para el mismo cliente inventado.
 */
function formatearPromedio(n: number) {
  return n.toLocaleString("es-CR", { maximumFractionDigits: 1 });
}

/**
 * ⚠️ EL TEXTO DEL LECTOR DE PANTALLA TAMBIÉN SALE DE `VISITAS`.
 *
 * El párrafo `sr-only` tenía las cifras escritas a mano —«unas dos
 * veces», «unas cinco veces», «treinta sellos», «tres premios»— y eso
 * rompía la tercera defensa que el comentario de arriba dice que esta
 * pieza tiene. Con las cifras a mano, cambiar un número de `VISITAS`
 * dejaba el gráfico contando una cosa y la descripción accesible
 * contando otra, para siempre y en silencio: la única persona que NO
 * puede detectar la contradicción es justamente la que solo recibe el
 * texto. Ahora las dos mitades salen del mismo arreglo.
 */
const TOTALES: Record<Modo, number> = {
  sin: VISITAS.sin.reduce((s, n) => s + n, 0),
  con: VISITAS.con.reduce((s, n) => s + n, 0),
};

/** «una vez» / «unas N veces»: el plural también se rompe si alguien edita. */
function vecesAlMes(total: number) {
  const p = total / MESES.length;
  return p === 1 ? "una vez" : `unas ${formatearPromedio(p)} veces`;
}

const PREMIOS_EJEMPLO = Math.floor(TOTALES.con / META);

export default function MockupFidelidad() {
  const reducido = useMovimientoReducido();

  /* `vivo` (de `useMockupVivo`) gatea solo el bucle que alterna
     escenarios: movimiento bienvenido Y mockup cerca del viewport.
     `reducido` conserva su trabajo propio en las transiciones de CSS y
     en `desplegado`, que aplican también con el bucle pausado por
     scroll. */
  const { ref, vivo } = useMockupVivo<HTMLDivElement>();

  /**
   * Arranca en «con tarjeta» —el estado FINAL y completo— y no en
   * «sin».
   *
   * No es un detalle de guion: `prefers-reduced-motion` apaga el
   * MOVIMIENTO, no el contenido, así que quien pidió menos movimiento
   * no ve el bucle nunca y se queda con este primer estado para
   * siempre. Tiene que ser el que cuenta la historia entera, con las
   * barras altas y la tarjeta llena.
   *
   * El bonus es que así no hace falta un `setState` sincrónico dentro
   * del efecto para «reiniciar» el loop —el patrón con
   * `eslint-disable-next-line react-hooks/set-state-in-effect` que
   * arrastran los mockups viejos—: el intervalo simplemente alterna.
   */
  const [modo, setModo] = useState<Modo>("con");

  /**
   * EL BUCLE CEDE. En cuanto alguien toca el interruptor, la
   * reproducción automática se apaga PARA SIEMPRE: si siguiera
   * corriendo, a los 3,5 s le cambiaría el gráfico por debajo a quien
   * acaba de elegir qué quería ver, y eso se siente roto, no vivo.
   */
  const [manual, setManual] = useState(false);

  /**
   * Las barras nacen aplastadas y suben en el primer cuadro. Es un
   * `useState` y no una clase de CSS porque el escalonado necesita el
   * índice de cada barra, y porque el mismo valor tiene que servir
   * después para reanimar al cambiar de escenario.
   */
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMontado(true), 40);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Con movimiento reducido no hay bucle: un gráfico que se da vuelta
    // solo cada 3,5 s es justo lo que esa preferencia pide evitar. Y
    // fuera del viewport tampoco (`vivo` junta las dos condiciones):
    // alternar escenarios que nadie ve es re-renderizar de gratis. El
    // interruptor sigue funcionando a mano, y el estado inicial ya
    // muestra el escenario completo.
    if (manual || !vivo) return;
    const t = setInterval(() => {
      setModo((m) => (m === "con" ? "sin" : "con"));
    }, MS_POR_ESCENARIO);
    // Limpiar SIEMPRE: un intervalo suelto en una landing es CPU
    // quemándose en segundo plano mientras la pestaña siga abierta.
    return () => clearInterval(t);
  }, [manual, vivo]);

  function elegir(m: Modo) {
    setManual(true);
    setModo(m);
  }

  const datos = VISITAS[modo];
  const total = datos.reduce((s, n) => s + n, 0);
  const promedio = total / MESES.length;

  /**
   * Sin tarjeta no hay sellos que juntar — no es que junte pocos, es
   * que no existe la tarjeta. Por eso los tres contadores van a cero en
   * ese escenario en vez de a un número chico: la diferencia no es de
   * grado.
   */
  const conTarjeta = modo === "con";
  const sellos = conTarjeta ? total : 0;
  const premios = conTarjeta ? Math.floor(total / META) : 0;
  const enLaTarjeta = conTarjeta ? total % META : 0; // lo que va de la tarjeta en curso

  /**
   * Con movimiento reducido las barras no esperan al efecto: se dibujan
   * en su altura final desde el primer cuadro del cliente. Es un valor
   * DERIVADO y no un `setState` extra justamente para que no exista el
   * fotograma vacío intermedio.
   */
  const desplegado = montado || reducido;

  return (
    <div ref={ref} className="w-full max-w-[580px]">
      {/* ⚠️ ESTE PÁRRAFO VA FUERA DE CUALQUIER `aria-hidden`.
          Un `aria-hidden` esconde el subárbol ENTERO: el bug real que
          documenta `mockup-cercania.tsx` fue exactamente este texto
          metido adentro del dibujo, y el resultado era un hueco mudo
          para quien no ve la pantalla. Acá abajo el `aria-hidden` está
          puesto SOLO sobre el gráfico —que es una ilustración— y ni el
          interruptor ni el resumen quedan adentro. */}
      <p className="sr-only">
        Ejemplo ilustrativo con datos inventados: un mismo cliente de un café a
        lo largo de {MESES.length} meses. Sin tarjeta de lealtad vuelve{" "}
        {vecesAlMes(TOTALES.sin)} al mes, con visitas sueltas e irregulares. Con
        tarjeta vuelve {vecesAlMes(TOTALES.con)} al mes y las visitas suben mes
        a mes, hasta juntar {TOTALES.con} sellos y canjear {PREMIOS_EJEMPLO}{" "}
        {PREMIOS_EJEMPLO === 1 ? "premio" : "premios"}. No son datos de Bookea
        ni una promesa de resultados.
      </p>

      <div
        className="rounded-3xl border border-[#e6eaf3] bg-white p-5 sm:p-7"
        style={{ boxShadow: "0 26px 60px rgba(16,30,66,.12)" }}
      >
        {/* ── Encabezado ─────────────────────────────────────────────
            El rótulo «Ejemplo ilustrativo» va acá arriba, VISIBLE y
            dentro del mockup, no en una nota al pie de la sección: la
            nota al pie nadie la asocia con el gráfico que está mirando. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
              style={{
                background: "var(--accion-suave)",
                color: "var(--accion-fuerte)",
              }}
            >
              <Icono nombre="repetir" className="h-4 w-4" />
            </span>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
              Visitas por mes
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
            style={{
              background: "var(--orange-suave)",
              color: "var(--orange-acento-claro)",
            }}
          >
            Ejemplo ilustrativo
          </span>
        </div>

        <p className="mt-2.5 text-[17px] font-extrabold leading-tight text-aventurea-navy sm:text-[19px]">
          Un mismo cliente, medio año
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-aventurea-ink-soft">
          Movelo vos: compará cómo vuelve el mismo cliente sin tarjeta y con
          tarjeta.
        </p>

        {/* ── EL INTERRUPTOR ─────────────────────────────────────────
            Dos `<button type="button">` de verdad, no divs con onClick:
            se alcanzan con Tab, se activan con Enter y con la barra
            espaciadora, y `aria-pressed` es lo que le dice al lector de
            pantalla cuál de los dos está puesto.

            Y van FUERA del `aria-hidden` del gráfico. Un control
            interactivo escondido del árbol de accesibilidad es la peor
            de las dos mitades: el teclado llega igual, pero llega a un
            botón que nadie anuncia. */}
        <div
          role="group"
          aria-label="Escenario del ejemplo"
          className="mt-4 inline-flex rounded-full bg-[#f2f4f8] p-1"
        >
          {MODOS.map((m) => {
            const activo = m === modo;
            return (
              <button
                key={m}
                type="button"
                onClick={() => elegir(m)}
                aria-pressed={activo}
                className="presionable rounded-full px-3.5 py-1.5 text-[12px] font-bold sm:text-[12.5px]"
                style={
                  activo
                    ? {
                        background: "var(--accion)",
                        color: "var(--accion-tinta)",
                        boxShadow: "0 4px 12px rgba(15,76,158,.28)",
                      }
                    : { color: "#8a91a4" }
                }
              >
                {ETIQUETAS[m]}
              </button>
            );
          })}
        </div>

        {/* ── EL DIBUJO ──────────────────────────────────────────────
            Desde acá y hasta el cierre es ilustración pura: números
            sueltos, abreviaturas de mes y puntitos. Nada de esto se
            entiende leído en voz alta fuera de contexto, y todo lo que
            SÍ importa ya está en el `sr-only` de arriba y en el resumen
            de abajo — los dos fuera del `aria-hidden`. */}
        <div
          aria-hidden
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_168px] sm:gap-4"
        >
          {/* El gráfico de barras */}
          <div className="flex items-end justify-between gap-1.5 rounded-2xl border border-[#e9ecf3] bg-[#f9fafc] px-3 pb-3 pt-4 sm:gap-2 sm:px-4">
            {MESES.map((mes, i) => {
              const valor = datos[i];
              const fraccion = valor / MAX;
              const esPico = valor === MAX;
              return (
                <div
                  key={mes}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  {/* ⚠️ LA CIFRA VA AFUERA DE LA BARRA, NO ADENTRO.
                      La barra vive escalada (`scaleY` menor que 1);
                      cualquier texto adentro se estiraría con ella y
                      quedaría aplastado y borroso. Acá arriba se
                      renderiza a escala 1, nítido. */}
                  <p className="text-[10px] font-extrabold tabular-nums text-aventurea-navy">
                    {valor}
                  </p>

                  {/* ── LA BARRA CRECE CON `scaleY`, NUNCA CON `height`
                      El alto de la barra es SIEMPRE el 100 % del carril
                      y lo que cambia es la escala. Dos razones:

                      1. Animar `height` rehace el layout en cada
                         fotograma, en el mismo hilo que atiende los
                         clics — seis barras a la vez es lo que hunde el
                         INP. `transform` corre en el compositor.
                      2. Como la escala ES la altura, cambiar de
                         escenario reanima sola: la transición de
                         `transform` interpola de la altura vieja a la
                         nueva. Con `height` habría que animar una
                         propiedad de layout o aceptar un salto seco.

                      `origin-bottom` es lo que hace que crezca desde el
                      piso y no desde el centro.

                      El `scale` acá es seguro —a diferencia del que
                      desenfocaba texto en las cards— porque adentro de
                      la barra no hay ni una letra: es un rectángulo de
                      color plano. Por eso mismo el radio se deja en 4 px:
                      escalado a un octavo queda en medio píxel, o sea
                      prácticamente recto, y así no se nota que la
                      curvatura se aplasta con la barra. */}
                  <div className="flex h-28 w-full items-end overflow-hidden rounded-[5px] bg-[#eef1f6] sm:h-32">
                    <div
                      className="w-full origin-bottom rounded-[4px]"
                      style={{
                        height: "100%",
                        transform: `scaleY(${desplegado ? fraccion : 0})`,
                        transition: reducido
                          ? "none"
                          : "transform 620ms var(--ease-bookea, cubic-bezier(.22,1,.36,1)), background-color 300ms",
                        // El escalonado: cada barra sale 70 ms después
                        // de la anterior, así el gráfico se lee como una
                        // ola y no como una persiana subiendo de golpe.
                        transitionDelay: reducido ? "0ms" : `${i * 70}ms`,
                        background: conTarjeta
                          ? esPico
                            ? "var(--orange-acento-claro)"
                            : "var(--accion)"
                          : // Sin tarjeta el gris no es «menos color»:
                            // es lo que hace que el salto entre los dos
                            // escenarios se vea antes de leer un número.
                            "#aab4c6",
                      }}
                    />
                  </div>

                  <p className="text-[10px] font-bold text-aventurea-ink-soft">
                    {mes}
                  </p>
                </div>
              );
            })}
          </div>

          {/* La tarjeta al costado: los sellos que dejaron esas visitas */}
          <div className="rounded-2xl border border-[#e9ecf3] bg-[#f9fafc] p-3.5">
            <div className="flex items-center gap-1.5">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                style={
                  conTarjeta
                    ? {
                        background: "var(--accion-suave)",
                        color: "var(--accion-fuerte)",
                      }
                    : { background: "#eef1f6", color: "#aab4c6" }
                }
              >
                <Icono nombre="sellos" className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                Su tarjeta
              </p>
            </div>

            {/* La tira de sellos, igual que en `mockup-hitos.tsx`: los
                mismos 8 de meta, para que las dos piezas de la sección
                hablen del mismo producto. Los puntos también se animan
                con `transform` y color, nunca con `width`. */}
            <div className="mt-2.5 flex flex-wrap gap-[6px]">
              {Array.from({ length: META }, (_, i) => {
                const lleno = i < enLaTarjeta;
                return (
                  <span
                    key={i}
                    className="h-[13px] w-[13px] rounded-full"
                    style={{
                      background: lleno ? "var(--accion)" : "#dfe5ee",
                      transform: lleno ? "scale(1)" : "scale(0.8)",
                      transition: reducido
                        ? "none"
                        : "transform 260ms var(--ease-bookea, cubic-bezier(.22,1,.36,1)), background-color 260ms",
                      transitionDelay: reducido ? "0ms" : `${i * 45}ms`,
                    }}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] font-bold text-aventurea-ink-soft">
              {conTarjeta
                ? `${enLaTarjeta} de ${META} sellos`
                : "No tiene tarjeta"}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white px-2.5 py-2">
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Sellos
                </p>
                <p
                  className="text-[16px] font-extrabold leading-tight tabular-nums"
                  style={{ color: conTarjeta ? "var(--accion)" : "#aab4c6" }}
                >
                  {sellos}
                </p>
              </div>
              <div className="rounded-xl bg-white px-2.5 py-2">
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Premios
                </p>
                <p
                  className="text-[16px] font-extrabold leading-tight tabular-nums"
                  style={{
                    color: conTarjeta
                      ? "var(--orange-acento-claro)"
                      : "#aab4c6",
                  }}
                >
                  {premios}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── EL RESUMEN ─────────────────────────────────────────────
            Fuera del `aria-hidden`, porque es la conclusión de la
            pieza: la cifra que cambia al mover el interruptor.

            `aria-live` se enciende SOLO cuando la persona tomó el
            control. Dejarlo prendido durante la reproducción automática
            haría que un lector de pantalla anuncie el resumen entero
            cada 3,5 segundos para siempre, que es hostil. Mientras el
            bucle manda, la descripción de arriba ya contó las dos
            mitades; cuando alguien elige, ahí sí se anuncia lo que
            eligió. */}
        <div
          aria-live={manual ? "polite" : "off"}
          className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-2xl border border-[#e9ecf3] px-4 py-3"
          style={{
            background: conTarjeta ? "var(--accion-suave)" : "#f9fafc",
            transition: reducido ? "none" : "background-color 400ms",
          }}
        >
          <p className="text-[13px] font-bold text-aventurea-navy">
            <span
              className="text-[22px] font-extrabold tabular-nums"
              style={{
                color: conTarjeta ? "var(--accion-fuerte)" : "#6b7386",
              }}
            >
              {formatearPromedio(promedio)}
            </span>{" "}
            visitas al mes {ETIQUETAS[modo].toLowerCase()}
          </p>
          <p className="text-[11.5px] font-bold text-aventurea-ink-soft tabular-nums">
            {total} visitas en {MESES.length} meses
          </p>
        </div>

        {/* La segunda defensa contra la cifra inventada: dicho con todas
            las letras, en el propio mockup y no en una nota de la
            sección. */}
        <p className="mt-3 text-[10.5px] leading-snug text-aventurea-ink-soft">
          Números de un cliente de ejemplo, inventados para mostrar la idea. No
          son un promedio de Bookea ni una promesa de resultados.
        </p>
      </div>
    </div>
  );
}
