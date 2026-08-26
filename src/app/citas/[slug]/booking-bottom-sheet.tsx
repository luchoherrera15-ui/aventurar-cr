"use client";

import { useEffect, useRef, useState } from "react";
import { IconX } from "@/components/icons";
import { bloquearScroll } from "@/lib/bloqueo-scroll";

/** Debe coincidir con la duración de `duration-*` usada abajo: el
 *  timeout que desmonta el panel espera a que la transición de salida
 *  termine de jugar antes de sacarlo del DOM. */
const DURACION_MS = 260;

/** Lo que el navegador considera enfocable, para el ciclo del Tab. */
const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Primitivo genérico de hoja inferior estilo app nativa (bottom
 * sheet): entra deslizando desde abajo, tiene manija arriba, cierra
 * con el fondo, con Escape o con la ✕, y bloquea el scroll de la
 * página mientras está abierta.
 *
 * No sabe nada del contenido que muestra — quien lo usa le pasa sus
 * propios pasos por `children` (acá: el flujo de reserva y la ficha de
 * un profesional, sin que este componente conozca ni servicios ni
 * citas).
 */
export default function BookingBottomSheet({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo?: string;
  children: React.ReactNode;
}) {
  // Sigue montada un instante más allá de `abierto = false`: si se
  // desmontara de una vez no habría transición de salida, el panel
  // simplemente desaparecería de golpe.
  const [montado, setMontado] = useState(abierto);
  const [visible, setVisible] = useState(false);
  const [abiertoPrevio, setAbiertoPrevio] = useState(abierto);
  const cierreTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entradaFrame = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  const focoPrevio = useRef<HTMLElement | null>(null);

  /**
   * ⚠️ `onCerrar` VIVE EN UNA REF, Y SIN ESTO EL FOCO NO VOLVÍA.
   *
   * Quien usa esta hoja le pasa una flecha en línea —
   * `onCerrar={() => setAbierta(false)}`— que es una función NUEVA en
   * cada render. Con `onCerrar` en las dependencias del efecto, el
   * efecto se limpiaba y se volvía a montar en cada render.
   *
   * Y ese efecto es el que guarda «quién tenía el foco antes de
   * abrir». Al re-montarse, volvía a guardar... el panel, que es lo que
   * él mismo acababa de enfocar. Para cuando la hoja se cerraba de
   * verdad, la referencia al botón de origen hacía rato que se había
   * perdido, y el foco terminaba en el body.
   *
   * Se detectó midiéndolo en el navegador: el arreglo «estaba escrito»
   * y no funcionaba. La ref deja el efecto dependiendo solo de
   * `montado`, que es lo único que de verdad describe su ciclo de vida.
   */
  const cerrarRef = useRef(onCerrar);
  // En un efecto y no en el render: escribir una ref durante el render
  // es lo que marca la regla `react-hooks/refs`, y con razón — en modo
  // concurrente un render puede descartarse y dejar la ref adelantada
  // respecto de lo que se pintó. El efecto corre después de CADA
  // render, y el manejador de teclado la lee tarde, cuando ya está al
  // día.
  useEffect(() => {
    cerrarRef.current = onCerrar;
  });

  // Ajuste EN EL RENDER, no en un efecto (patrón oficial de React para
  // sincronizar estado con un cambio de prop): "montado"/"visible"
  // tienen que reflejar el nuevo `abierto` en el MISMO render, antes
  // del primer pintado — un efecto llegaría un frame tarde y el panel
  // arrancaría con un estado viejo.
  if (abierto !== abiertoPrevio) {
    setAbiertoPrevio(abierto);
    if (abierto) setMontado(true);
    else setVisible(false);
  }

  useEffect(() => {
    if (abierto) {
      if (cierreTimeout.current) {
        clearTimeout(cierreTimeout.current);
        cierreTimeout.current = null;
      }
      // Doble rAF: el primer frame pinta el estado "cerrado" (recién
      // montado), el segundo dispara la transición hacia "abierto".
      // Con un solo rAF, algunos navegadores lo coalescen con el
      // pintado inicial y el panel aparece sin deslizar.
      entradaFrame.current = requestAnimationFrame(() => {
        entradaFrame.current = requestAnimationFrame(() => setVisible(true));
      });
    } else {
      cierreTimeout.current = setTimeout(() => setMontado(false), DURACION_MS);
    }
    return () => {
      if (entradaFrame.current) cancelAnimationFrame(entradaFrame.current);
    };
  }, [abierto]);

  useEffect(() => {
    if (!montado) return;
    // El scroll se congela con el candado CONTADO, no guardando el
    // valor acá. Ver `bloqueo-scroll.ts`: esta hoja y el modal de
    // reserva pueden estar montados a la vez (la ficha de un
    // profesional abre el modal desde adentro de la hoja), y dos
    // guardar/restaurar independientes dejaban la página congelada
    // para siempre al cerrar el segundo.
    const soltar = bloquearScroll();

    /**
     * ════════════════════════════════════════════════════════════════
     *  EL FOCO ENTRA, SE QUEDA ADENTRO Y VUELVE — FALTABAN LOS TRES
     * ════════════════════════════════════════════════════════════════
     *
     * Este panel declara `aria-modal="true"`, que es una PROMESA: le
     * dice al lector de pantalla «lo de atrás no existe mientras esto
     * esté abierto». El navegador no la cumple solo — hay que moverle
     * el foco, atraparlo y devolverlo. No se hacía ninguna de las tres.
     *
     * Sin esto, con un teclado (o con VoiceOver en modo foco, o con
     * Switch Control) pasaba lo siguiente: se abre la hoja, el foco
     * sigue en el botón de atrás, y al tabular se recorre la PÁGINA
     * ENTERA que el atributo declara inexistente — a ciegas, porque lo
     * que se ve arriba es la hoja. Y al cerrar, el foco caía al body y
     * había que tabular desde el principio para volver.
     *
     * `preventScroll` porque el foco NO debe scrollear: el panel acaba
     * de entrar deslizando y un salto de scroll encima se ve como un
     * parpadeo.
     */
    focoPrevio.current = document.activeElement as HTMLElement | null;
    const entrar = requestAnimationFrame(() => {
      panel.current?.focus({ preventScroll: true });
    });

    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cerrarRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;

      const dentro = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
        // Un elemento escondido (por ejemplo en la pestaña que no está
        // activa) no debe recibir el foco: llevaría a un salto a la
        // nada.
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (dentro.length === 0) {
        // Sin nada que enfocar, el foco se queda en el panel en vez de
        // escaparse a la página de atrás.
        e.preventDefault();
        panel.current.focus({ preventScroll: true });
        return;
      }

      const primero = dentro[0]!;
      const ultimo = dentro[dentro.length - 1]!;
      const activo = document.activeElement;

      if (e.shiftKey && (activo === primero || activo === panel.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alTeclado);
    return () => {
      soltar();
      cancelAnimationFrame(entrar);
      document.removeEventListener("keydown", alTeclado);
      // De vuelta a donde estaba. `isConnected` porque el disparador
      // pudo desaparecer del DOM mientras la hoja estaba abierta;
      // enfocar un nodo huérfano no hace nada y deja el foco en el
      // body igual que antes.
      const volver = focoPrevio.current;
      if (volver && volver.isConnected) volver.focus({ preventScroll: true });
      focoPrevio.current = null;
    };
  }, [montado]);

  if (!montado) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo ?? "Hoja inferior"}
      /**
       * ⚠️ `pointer-events-none` MIENTRAS NO ESTÁ VISIBLE, Y NO ES UN
       * DETALLE.
       *
       * Entre que se pide cerrar y que el panel se desmonta pasan 260
       * ms de animación. Durante ese cuarto de segundo esta capa sigue
       * siendo un `fixed inset-0` que cubre TODA la pantalla, aunque ya
       * se vea transparente y corrida hacia abajo.
       *
       * O sea: se cierra la ficha, se toca enseguida otra cosa, y el
       * toque se lo come un panel invisible. Para quien lo vive es «la
       * pantalla se colgó un momento» — y en un teléfono, donde la
       * gente toca rápido y encadenado, se vive seguido.
       */
      className={`fixed inset-0 z-[100] flex items-end justify-center ${
        visible ? "" : "pointer-events-none"
      }`}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className={`absolute inset-0 cursor-default bg-[rgba(10,18,42,0.55)] backdrop-blur-[2px] transition-opacity duration-[260ms] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panel}
        // `-1` para poder enfocarlo por código al abrir sin meterlo en
        // el recorrido normal del Tab.
        tabIndex={-1}
        className={`relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-24px_60px_-24px_rgba(6,12,32,0.45)] outline-none transition-all duration-[260ms] ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        style={{ maxHeight: "88vh" }}
      >
        {/* La manija visual — puramente decorativa, el cierre real es
            por el fondo, Escape o la ✕. */}
        <div className="flex shrink-0 justify-center pb-1 pt-2.5" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-aventurea-line" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-1">
          {titulo ? (
            <h2 className="text-[16px] font-extrabold tracking-[-0.2px] text-aventurea-ink">
              {titulo}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-aventurea-line text-aventurea-ink transition-colors hover:border-aventurea-navy"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div
          className="overflow-y-auto overscroll-contain px-5"
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
