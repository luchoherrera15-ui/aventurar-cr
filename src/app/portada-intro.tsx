"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

/** Lo que dura la entrada antes de pasar sola a Eventos. */
const DURACION_MS = 1400;

/**
 * LA ENTRADA AL SITIO: el logo de Bookea, una barrita que carga y
 * adentro — la página de Eventos. Nada más. Quien no quiera ni eso,
 * toca la pantalla y entra de una.
 *
 * DURACION_MS y la animación .intro-carga-relleno de home.css duran LO
 * MISMO a propósito: si la barra terminara antes, el visitante se
 * quedaría mirando una barra llena esperando que pase algo.
 *
 * TRES DECISIONES QUE NO SE VEN PERO EVITAN BUGS REALES:
 *
 * 1. `router.replace`, no `push`. Con push, /eventos quedaría con el
 *    home debajo en el historial: tocar "atrás" volvería a la portada,
 *    que a los tres segundos volvería a mandar a Eventos — un lazo del
 *    que no se sale.
 *
 * 2. `router.prefetch` apenas monta. Los tres segundos no son una
 *    espera decorativa: se usan para traer Eventos, así que cuando la
 *    barra termina la página ya está lista y el cambio es instantáneo.
 *    Eso es lo que hace que la barra no sea mentira.
 *
 * 3. El velo se monta solo en el cliente (useSyncExternalStore, no un
 *    efecto que cambie estado): el HTML que llega sigue siendo el home
 *    entero —que es lo que lee Google— y sin JavaScript la portada
 *    funciona como toda la vida.
 */
export default function PortadaIntro() {
  const router = useRouter();
  const yaSalio = useRef(false);
  // En el servidor devuelve false (no hay velo en el HTML); el cliente
  // lo enciende al hidratar, sin un render de más.
  const enElNavegador = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    if (!enElNavegador) return;

    // Que los tres segundos sirvan para algo: mientras la barra carga,
    // Next ya está trayendo /eventos.
    router.prefetch("/eventos");

    const entrar = () => {
      if (yaSalio.current) return;
      yaSalio.current = true;
      // El velo se desvanece mientras la página entra: el corte seco se
      // siente como un error del sitio.
      setSaliendo(true);
      router.replace("/eventos");
    };

    const t = setTimeout(entrar, DURACION_MS);
    const alTeclear = () => entrar();
    document.addEventListener("keydown", alTeclear);

    // Mientras el velo cubre no tiene sentido scrollear lo de atrás.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [enElNavegador, router]);

  if (!enElNavegador) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Entrar a Eventos"
      onClick={() => {
        if (yaSalio.current) return;
        yaSalio.current = true;
        setSaliendo(true);
        router.replace("/eventos");
      }}
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-9 bg-white transition-opacity duration-300 ${
        saliendo ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-bookea-v3.png"
        alt="Bookea"
        width={300}
        height={80}
        className="intro-logo pointer-events-none w-[min(62vw,300px)]"
      />

      <span className="pointer-events-none block h-[3px] w-40 overflow-hidden rounded-full bg-aventurea-navy/10">
        <span className="intro-carga-relleno block h-full w-0 rounded-full bg-aventurea-orange" />
      </span>
    </div>
  );
}
