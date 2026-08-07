"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

/** Cuánto dura la entrada antes de pasar solo a Eventos. */
const DURACION_MS = 5000;

/** Para no volver a secuestrar el home en la misma visita al sitio. */
const YA_ENTRO = "bookea:portada-vista";

/**
 * La portada como ENTRADA al sitio (pedido del dueño): el mapa con sus
 * pines encendiéndose corre cinco segundos y después la página se va
 * sola a /eventos. Quien no quiera esperar toca la pantalla y entra de
 * una.
 *
 * TRES DECISIONES QUE NO SE VEN PERO IMPORTAN:
 *
 * 1. `router.replace`, no `push`. Con `push`, /eventos quedaría con el
 *    home debajo en el historial: tocar "atrás" volvería a la portada,
 *    que a los cinco segundos volvería a mandar a /eventos — un lazo
 *    del que no se sale. Con `replace` el home no queda en el camino.
 *
 * 2. El envío automático pasa UNA sola vez por visita (sessionStorage).
 *    Sin eso, el logo de Bookea —que está en todas las páginas y
 *    apunta al home— se volvería un botón que siempre tira a Eventos:
 *    alguien mirando Citas que toca el logo terminaría en la vertical
 *    equivocada. La primera vez es la bienvenida; después el home es
 *    un home, con sus dos puertas.
 *
 * 3. El aviso y la barra son visibles a propósito. Una página que
 *    salta sola sin decir nada se siente como un error del sitio; con
 *    la cuenta a la vista se lee como lo que es, una entrada.
 */
/** ¿Es la primera vez que se pisa el home en esta visita al sitio? */
function leerPrimeraVez(): boolean {
  try {
    return sessionStorage.getItem(YA_ENTRO) !== "1";
  } catch {
    // Navegador con el almacenamiento bloqueado: se comporta como
    // primera visita. Peor sería no entrar nunca.
    return true;
  }
}

export default function PortadaIntro() {
  const router = useRouter();
  const yaSalio = useRef(false);
  // El servidor no puede saberlo (sessionStorage es del navegador):
  // manda `false` y el cliente lo resuelve al hidratar, sin un efecto
  // que dispare un segundo render. Así el HTML que llega sigue siendo
  // el home completo, que es lo que lee Google.
  const primeraVez = useSyncExternalStore(
    () => () => {},
    leerPrimeraVez,
    () => false,
  );
  const [cancelada, setCancelada] = useState(false);
  const activa = primeraVez && !cancelada;

  useEffect(() => {
    if (!activa) return;

    const entrar = () => {
      if (yaSalio.current) return;
      yaSalio.current = true;
      try {
        sessionStorage.setItem(YA_ENTRO, "1");
      } catch {
        /* sin almacenamiento, se repetirá la próxima vez: es aceptable */
      }
      router.replace("/eventos");
    };

    const t = setTimeout(entrar, DURACION_MS);

    // Tocar la pantalla entra de una. Se escucha en la fase de
    // captura para que el gesto cuente aunque caiga sobre una tarjeta…
    const alTocar = (e: MouseEvent) => {
      // …salvo que ESA tarjeta sea un enlace: quien toca "Citas y
      // servicios" quiere ir a Citas, no a Eventos. Ese clic sigue su
      // camino y acá solo se cancela el envío automático.
      if ((e.target as Element | null)?.closest?.("a[href], button")) {
        yaSalio.current = true;
        clearTimeout(t);
        try {
          sessionStorage.setItem(YA_ENTRO, "1");
        } catch {
          /* ignorado */
        }
        return;
      }
      entrar();
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Escape = "dejame ver el home", no "llevame".
        yaSalio.current = true;
        clearTimeout(t);
        setCancelada(true);
      } else if (e.key === "Enter" || e.key === " ") {
        entrar();
      }
    };

    document.addEventListener("click", alTocar, true);
    document.addEventListener("keydown", alTeclear);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", alTocar, true);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [activa, router]);

  if (!activa) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2.5 px-5 pb-7"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-aventurea-ink-soft">
        Entrando a Eventos
      </p>
      <span className="portada-barra block h-[3px] w-40 overflow-hidden rounded-full bg-aventurea-navy/12">
        <span className="portada-barra-relleno block h-full w-full origin-left rounded-full bg-aventurea-orange" />
      </span>
      <p className="text-[11.5px] text-aventurea-ink-soft/70">
        Tocá la pantalla para entrar ya
      </p>
    </div>
  );
}
