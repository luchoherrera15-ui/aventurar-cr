"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * La ventanita promocional de Invitaciones Digitales en la portada.
 *
 * Reglas de aparición:
 *  - Con sesión iniciada: UNA sola vez por cuenta (marca en
 *    localStorage con el id del usuario).
 *  - Sin cuenta: cada vez que REINGRESA al sitio (sessionStorage:
 *    dentro de la misma visita no se repite, en la próxima sí).
 * Se cierra sola a los 5 segundos o con la ✕.
 */
const CLAVE_SESION = "promo_invitaciones_vista";

export default function PopupInvitaciones() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let cancelado = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelado) return;

        if (user) {
          const clave = `${CLAVE_SESION}:${user.id}`;
          if (localStorage.getItem(clave)) return;
          localStorage.setItem(clave, "1");
        } else {
          if (sessionStorage.getItem(CLAVE_SESION)) return;
          sessionStorage.setItem(CLAVE_SESION, "1");
        }

        setVisible(true);
        timeout = setTimeout(() => setVisible(false), 5000);
      } catch {
        // Sin storage o sin red, la portada sigue sin popup.
      }
    })();

    return () => {
      cancelado = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="anim-velo-entrar fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(10,18,42,0.45)] p-5 backdrop-blur-[3px]">
      <div className="anim-panel-entrar relative w-full max-w-[420px] overflow-hidden rounded-[24px] bg-aventurea-navy p-7 text-center shadow-[0_48px_120px_-40px_rgba(6,12,32,0.7)]">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => setVisible(false)}
          className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          ×
        </button>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
          ✦ Nuevo en Bookea
        </p>
        <p className="titulo mt-3 text-[24px] leading-tight text-white">
          Invitaciones digitales que enamoran
        </p>
        <p className="mx-auto mt-2.5 max-w-[34ch] text-[13.5px] leading-relaxed text-white/75">
          Un link precioso para tu boda, cumple o baby shower: tus invitados
          confirman en un minuto y vos ves la lista en vivo.
        </p>
        <Link
          href="/invitaciones"
          onClick={() => setVisible(false)}
          className="mt-5 inline-flex items-center justify-center rounded-full bg-aventurea-orange px-6 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
        >
          Conocelas →
        </Link>
        {/* La barrita del autocierre: 5 s y se va sola. */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
          <div className="h-full origin-left animate-[popup-barra_5s_linear_forwards] bg-aventurea-orange" />
        </div>
      </div>
    </div>
  );
}
