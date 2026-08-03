"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconBalloon,
  IconBalloons,
  IconHeart,
  IconMail,
  IconSparkles,
  IconStar,
  IconX,
} from "@/components/icons";
import {
  CATALOGO_INVITACIONES,
  type DemoInvitacion,
} from "@/lib/catalogo-invitaciones";

/**
 * La venta cruzada suave en la página de un rancho: quien está viendo
 * dónde hacer su evento es exactamente quien va a necesitar mandar las
 * invitaciones. Aparece como un avisito abajo a la IZQUIERDA (la
 * derecha es de la burbuja de chat) y lleva a /invitaciones.
 *
 * La regla de oro es que la reserva manda:
 *  - sale recién a los segundos, no de golpe al abrir la página;
 *  - se esconde solo mientras el calendario de reserva está abierto
 *    (#reservar) y vuelve cuando se cierra;
 *  - va en z-30, por debajo de la barra de reservar (z-40), del chat
 *    (z-50) y de los modales (z-90/z-100);
 *  - el link abre en otra pestaña, así nadie pierde lo que ya llevaba
 *    armado de su reserva;
 *  - quien lo cierra con la X no lo vuelve a ver por una semana; quien
 *    toca "No mostrar más" no lo vuelve a ver nunca — son dos gestos
 *    distintos a propósito, para no obligar a nadie a silenciarlo para
 *    siempre solo por cerrarlo una vez.
 */

const ICONO_DEMO: Record<DemoInvitacion["icono"], React.ReactNode> = {
  corazon: <IconHeart />,
  destellos: <IconSparkles />,
  estrella: <IconStar />,
  globos: <IconBalloons />,
  globo: <IconBalloon />,
};

/**
 * Una miniatura del desfile: la silueta de una invitación real, no una
 * captura. Lienzo de la demo, su ícono, la ocasión y tres rayitas que
 * insinúan el texto — a este tamaño una captura de verdad se leería
 * como una mancha, y esto sugiere "invitación" en un vistazo.
 *
 * aria-hidden en todo el riel: es decoración. Lo que la persona
 * necesita saber está en el texto y en el botón de al lado.
 */
function MiniInvitacion({ demo }: { demo: DemoInvitacion }) {
  return (
    <div
      className={`relative flex h-[92px] w-[62px] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[9px] px-1.5 shadow-[0_6px_16px_rgba(6,12,28,0.4)] ring-1 ring-white/15 ${demo.lienzo}`}
    >
      {/* El brillo diagonal que tienen las invitaciones de verdad. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.22), transparent 55%)",
        }}
      />
      <span className={`relative [&_svg]:h-4 [&_svg]:w-4 ${demo.iconoClase}`}>
        {ICONO_DEMO[demo.icono]}
      </span>
      <span
        className={`relative text-center text-[5.5px] font-black uppercase leading-[1.15] tracking-[0.08em] ${demo.iconoClase}`}
      >
        {demo.ocasion}
      </span>
      {/* Las rayitas del cuerpo del texto. Llevan la misma clase de color
          que el ícono porque `bg-current` toma el color de TEXTO heredado:
          sin esto salían blancas, y sobre el lienzo claro de "¿Niño o
          Niña?" no se veían. */}
      <span
        aria-hidden
        className={`relative flex w-full flex-col items-center gap-[3px] ${demo.iconoClase}`}
      >
        <span className="h-[2px] w-8 rounded-full bg-current opacity-30" />
        <span className="h-[2px] w-6 rounded-full bg-current opacity-20" />
      </span>
    </div>
  );
}

const CLAVE = "bookea_aviso_invitaciones";
/** Lo que se guarda en `CLAVE` cuando alguien pide no verlo nunca más
 *  (distinto de un timestamp: ninguna resta de fechas lo va a vencer). */
const PARA_SIEMPRE = "nunca";
const DIAS_SILENCIO = 7;
const DEMORA_MS = 3500;
/** Si ya bajó a mirar el lugar, está enganchado: sale sin esperar más. */
const SCROLL_GATILLO = 600;
/** Cuánto se queda en pantalla si nadie lo toca. */
const VIDA_MS = 5_000;

export default function AvisoInvitacionesFlotante({
  conBarraMovil = false,
}: {
  /** Los Lugares tienen barra fija de reservar en celular: hay que subirse. */
  conBarraMovil?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [reservando, setReservando] = useState(false);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    let guardado = "";
    try {
      guardado = window.localStorage.getItem(CLAVE) ?? "";
    } catch {
      // Navegación privada sin storage: el aviso simplemente sale.
    }
    if (guardado === PARA_SIEMPRE) return;
    const cerradoEn = Number(guardado) || 0;
    if (Date.now() - cerradoEn < DIAS_SILENCIO * 86_400_000) return;

    // Lo que pase primero: el ratito de cortesía o que empiece a bajar.
    const mostrar = () => {
      setVisible(true);
      window.clearTimeout(t);
      window.removeEventListener("scroll", alBajar);
    };
    const alBajar = () => {
      if (window.scrollY > SCROLL_GATILLO) mostrar();
    };
    const t = window.setTimeout(mostrar, DEMORA_MS);
    window.addEventListener("scroll", alBajar, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", alBajar);
    };
  }, []);

  // El modal del calendario se abre con el hash #reservar: mientras esté
  // abierto, el aviso se quita del medio.
  useEffect(() => {
    const revisar = () => setReservando(window.location.hash === "#reservar");
    revisar();
    window.addEventListener("hashchange", revisar);
    return () => window.removeEventListener("hashchange", revisar);
  }, []);

  /**
   * Se retira solo a los 5 segundos. Dos cuidados:
   *
   *  - el reloj corre únicamente mientras el aviso está DE VERDAD en
   *    pantalla: si el calendario de reserva lo tapó, no cuenta, o se
   *    consumiría la vida entera detrás del modal;
   *  - se pausa mientras alguien lo tiene bajo el mouse o con el foco
   *    del teclado, que es justo cuando lo está leyendo.
   *
   * A diferencia de la X, irse solo NO silencia el aviso por una
   * semana: nadie lo rechazó, así que puede volver a aparecer.
   */
  useEffect(() => {
    if (!visible || reservando || pausado) return;
    const t = window.setTimeout(() => setVisible(false), VIDA_MS);
    return () => window.clearTimeout(t);
  }, [visible, reservando, pausado]);

  const cerrar = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      // Sin storage volverá a salir en la próxima página: no es grave.
    }
  }, []);

  /** A diferencia de la X (silencia 7 días), esto es un "nunca más"
   *  explícito — para quien ya sabe que no le interesa el producto. */
  const noMostrarMas = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(CLAVE, PARA_SIEMPRE);
    } catch {
      // Sin storage no hay dónde guardarlo: volverá a salir después.
    }
  }, []);

  if (!visible || reservando) return null;

  return (
    <div
      className={`anim-aviso-entrar fixed left-4 z-30 w-[calc(100vw-5rem)] max-w-[330px] sm:left-6 sm:w-[344px] lg:bottom-6 lg:w-[368px] ${
        conBarraMovil ? "bottom-[86px]" : "bottom-4"
      }`}
    >
      <div
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocusCapture={() => setPausado(true)}
        onBlurCapture={() => setPausado(false)}
        className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#16295e] p-4 pr-8 text-white shadow-[0_18px_50px_rgba(16,26,44,0.34)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(18rem 11rem at 88% -25%, rgba(238,116,32,0.32), transparent 62%)",
          }}
        />
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar el aviso"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>

        <div className="relative">
          <p className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-[#f5b98a]">
            <IconMail className="h-3 w-3" /> Invitaciones digitales
          </p>

          {/* ---------- El desfile de diseños ---------- */}
          <div
            aria-hidden
            className="relative mt-3 h-[92px] overflow-hidden rounded-xl"
          >
            {/* Papelitos flotando detrás del riel. */}
            <span className="anim-mini-inv-flotar pointer-events-none absolute left-[12%] top-1 h-1.5 w-1.5 rounded-[2px] bg-aventurea-orange" />
            <span
              className="anim-mini-inv-flotar pointer-events-none absolute right-[18%] top-2 h-1 w-2 rounded-[2px] bg-white"
              style={{ animationDelay: "1.4s" }}
            />
            <span
              className="anim-mini-inv-flotar pointer-events-none absolute left-[46%] bottom-1 h-1.5 w-1.5 rounded-full bg-[#f5b98a]"
              style={{ animationDelay: "2.6s" }}
            />

            {/* El riel. La lista va DOS veces para que el ciclo cierre
                sin salto (ver mini-inv-desfile en globals.css). */}
            <div className="anim-mini-inv-desfile flex gap-2.5">
              {[...CATALOGO_INVITACIONES, ...CATALOGO_INVITACIONES].map(
                (demo, i) => (
                  <MiniInvitacion key={`${demo.slug}-${i}`} demo={demo} />
                ),
              )}
            </div>

            {/* Los bordes se desvanecen: las miniaturas entran y salen
                en vez de aparecer cortadas contra el filo del card. */}
            <span
              className="pointer-events-none absolute inset-y-0 left-0 w-8"
              style={{
                background: "linear-gradient(to right, #16295e, transparent)",
              }}
            />
            <span
              className="pointer-events-none absolute inset-y-0 right-0 w-8"
              style={{
                background: "linear-gradient(to left, #16295e, transparent)",
              }}
            />
          </div>

          <p className="mt-3 text-[15.5px] font-black leading-tight">
            ¡Creá tu invitación digital con Bookea!
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/75">
            Un link precioso para tus invitados: confirman ahí mismo y vos
            llevás la lista al día.
          </p>
          <Link
            href="/invitaciones"
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-aventurea-orange px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
          >
            Ver cómo funciona →
          </Link>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[10px] leading-relaxed text-white/45">
              Se abre en otra pestaña — no perdés tu reserva.
            </p>
            <button
              type="button"
              onClick={noMostrarMas}
              className="shrink-0 text-[10px] font-bold text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
            >
              No mostrar más
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
