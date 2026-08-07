"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import MapaLatam from "@/components/mapa-latam";

/** Cuánto dura la entrada antes de pasar sola a Eventos. */
const DURACION_MS = 5000;

/** Para no volver a secuestrar el home en la misma visita al sitio. */
const YA_ENTRO = "bookea:portada-vista";

/**
 * LA ENTRADA AL SITIO (pedido del dueño): al llegar a bookea.lat se ve
 * el mapa de Centroamérica con sus pines encendiéndose como targets
 * durante cinco segundos, y después la página pasa sola a Eventos.
 * Quien no quiera esperar toca la pantalla y entra de una.
 *
 * Es un VELO a pantalla completa, no un aviso al pie: el mapa tiene
 * que ser lo único, si no la "entrada" se ve igual que el home de
 * siempre. El home real queda debajo y aparece si alguien cancela con
 * Escape o si ya entró antes en esta visita.
 *
 * TRES DECISIONES QUE NO SE VEN PERO EVITAN BUGS REALES:
 *
 * 1. `router.replace`, no `push`. Con push, /eventos quedaría con el
 *    home debajo en el historial: tocar "atrás" volvería a la portada,
 *    que a los cinco segundos volvería a mandar a Eventos — un lazo
 *    del que no se sale.
 *
 * 2. El envío automático pasa UNA vez por visita (sessionStorage). Sin
 *    eso, el logo de Bookea —que está en todas las páginas y apunta al
 *    home— se volvería un botón que siempre tira a Eventos: alguien
 *    mirando Citas que toca el logo terminaría en la vertical
 *    equivocada.
 *
 * 3. El velo se monta solo en el cliente (useSyncExternalStore, no un
 *    efecto que cambie estado): el HTML que llega sigue siendo el home
 *    entero, que es lo que lee Google, y sin JavaScript la portada
 *    funciona como toda la vida.
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
  const primeraVez = useSyncExternalStore(
    () => () => {},
    leerPrimeraVez,
    () => false,
  );
  const [cancelada, setCancelada] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const activa = primeraVez && !cancelada;

  useEffect(() => {
    if (!activa) return;

    const marcarVisto = () => {
      try {
        sessionStorage.setItem(YA_ENTRO, "1");
      } catch {
        /* sin almacenamiento se repetirá la próxima vez: aceptable */
      }
    };

    const entrar = () => {
      if (yaSalio.current) return;
      yaSalio.current = true;
      marcarVisto();
      // El velo se desvanece mientras Next ya está trayendo /eventos:
      // el corte seco se siente como un error del sitio.
      setSaliendo(true);
      router.replace("/eventos");
    };

    const t = setTimeout(entrar, DURACION_MS);

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Escape = "dejame ver el home", no "llevame".
        yaSalio.current = true;
        clearTimeout(t);
        marcarVisto();
        setCancelada(true);
      } else if (e.key === "Enter" || e.key === " ") {
        clearTimeout(t);
        entrar();
      }
    };
    document.addEventListener("keydown", alTeclear);

    // Mientras el velo cubre la pantalla no tiene sentido scrollear.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [activa, router]);

  if (!activa) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Entrar a Eventos"
      onClick={() => {
        if (yaSalio.current) return;
        yaSalio.current = true;
        try {
          sessionStorage.setItem(YA_ENTRO, "1");
        } catch {
          /* ignorado */
        }
        setSaliendo(true);
        router.replace("/eventos");
      }}
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-aventurea-cream transition-opacity duration-500 ${
        saliendo ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* PRIMER TIEMPO: el logo aparece, se sostiene y se disuelve
          hacia adelante. Sale del flujo (absolute) para que el mapa
          entre exactamente en el mismo centro, sin salto. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-bookea.png"
        alt="Bookea"
        width={260}
        height={70}
        className="intro-logo pointer-events-none absolute left-1/2 top-1/2 z-20 w-[min(58vw,260px)] -translate-x-1/2 -translate-y-1/2"
      />

      {/* SEGUNDO TIEMPO: entra el mapa con los targets ya corriendo —
          Costa Rica primero, en naranja. */}
      <MapaLatam className="intro-mapa pointer-events-none absolute left-1/2 top-1/2 h-[min(88vmin,760px)] w-[min(88vmin,760px)] -translate-x-1/2 -translate-y-1/2 text-aventurea-navy" />

      <div className="pointer-events-none relative z-10 flex flex-col items-center px-6 text-center">
        <p
          className="intro-texto text-[11px] font-bold uppercase tracking-[0.34em] text-aventurea-orange"
          style={{ "--retraso": "2.9s" } as React.CSSProperties}
        >
          Bookea · Costa Rica
        </p>
        <p
          className="intro-texto titulo mt-5 max-w-[15ch] text-[clamp(32px,7vw,60px)] leading-[1.04] text-aventurea-ink"
          style={{ "--retraso": "3.1s" } as React.CSSProperties}
        >
          Reservá en todo el país
        </p>
      </div>

      {/* La cuenta, abajo: una pantalla que salta sola sin avisar se
          lee como una falla; con la barra a la vista se entiende. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2.5 px-5 pb-9">
        <span className="portada-barra block h-[3px] w-40 overflow-hidden rounded-full bg-aventurea-navy/12">
          <span className="portada-barra-relleno block h-full w-full origin-left rounded-full bg-aventurea-orange" />
        </span>
        <p className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-aventurea-ink-soft">
          Entrando a Eventos
        </p>
        <p className="text-[11.5px] text-aventurea-ink-soft/70">
          Tocá la pantalla para entrar ya
        </p>
      </div>
    </div>
  );
}
