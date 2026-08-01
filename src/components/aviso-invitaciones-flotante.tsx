"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconMail, IconX } from "@/components/icons";

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
 *  - quien lo cierra no lo vuelve a ver por una semana.
 */

const CLAVE = "bookea_aviso_invitaciones";
const DIAS_SILENCIO = 7;
const DEMORA_MS = 3500;
/** Si ya bajó a mirar el lugar, está enganchado: sale sin esperar más. */
const SCROLL_GATILLO = 600;

export default function AvisoInvitacionesFlotante({
  conBarraMovil = false,
}: {
  /** Los Lugares tienen barra fija de reservar en celular: hay que subirse. */
  conBarraMovil?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [reservando, setReservando] = useState(false);

  useEffect(() => {
    let cerradoEn = 0;
    try {
      cerradoEn = Number(window.localStorage.getItem(CLAVE)) || 0;
    } catch {
      // Navegación privada sin storage: el aviso simplemente sale.
    }
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

  const cerrar = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      // Sin storage volverá a salir en la próxima página: no es grave.
    }
  }, []);

  if (!visible || reservando) return null;

  return (
    <div
      className={`anim-aviso-entrar fixed left-4 z-30 w-[calc(100vw-6.5rem)] max-w-[290px] sm:left-6 sm:w-[300px] lg:bottom-6 lg:w-[320px] ${
        conBarraMovil ? "bottom-[86px]" : "bottom-4"
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#16295e] p-4 pr-8 text-white shadow-[0_18px_50px_rgba(16,26,44,0.34)]">
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
          <p className="mt-2 text-[15px] font-black leading-tight">
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
          <p className="mt-2 text-[10px] leading-relaxed text-white/45">
            Se abre en otra pestaña — no perdés tu reserva.
          </p>
        </div>
      </div>
    </div>
  );
}
