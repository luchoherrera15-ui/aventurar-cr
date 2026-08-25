"use client";

import { useState } from "react";
import ChatAyuda from "@/app/ayuda/chat-ayuda";
import { enlaceWhatsapp } from "@/lib/contacto-bookea";
import type { HiloAyudaGeneral } from "@/lib/ayuda-general/tipos";

/**
 * «¿PREFERÍS ATENCIÓN PERSONALIZADA?» — el cuadro de ayuda que
 * acompaña al configurador en /lealtad/crear.
 *
 * ── POR QUÉ ACÁ Y NO EN LA LANDING ─────────────────────────────────
 * Pedido del dueño (ago 2026): el botón de crear el pase abre su
 * propia pantalla en blanco, y AL LADO va este cuadro. Tiene sentido
 * justo acá y no en /lealtad: este es el momento en que alguien está
 * armando su tarjeta y se traba — el minuto exacto en que una persona
 * de verdad vale más que otra sección de marketing. En la landing la
 * ayuda sigue estando donde estaba (la burbuja flotante).
 *
 * ── LOS DOS CAMINOS, Y POR QUÉ EL SEGUNDO NO ES UN BOT ─────────────
 * 1. WhatsApp — se va del sitio, contesta una persona.
 * 2. «Chatear con Bookea» — abre acá mismo el hilo de ayuda general
 *    (migración 0182), el MISMO que atiende el equipo desde
 *    /admin/chats. No es el bot de Gemini de la burbuja de la landing
 *    (`chat-agente.tsx`): eso contesta solo y no deja a nadie del otro
 *    lado. Acá lo que se promete es que alguien toma el chat, así que
 *    lo que se abre tiene que ser un hilo que un humano de verdad vea
 *    en una bandeja. Reusar el hilo que ya existe —en vez de inventar
 *    una tabla nueva de "chats de lealtad"— es lo que hace que esa
 *    promesa sea cierta desde el primer día.
 *
 * ── EL CUADRO ARRANCA CERRADO ──────────────────────────────────────
 * `ChatAyuda` monta un polling cada ~3.5 s en cuanto aparece. Dejarlo
 * abierto de entrada le pondría ese costo a todo el que entre a armar
 * su pase, que es justo la mayoría que no necesita ayuda. Se monta
 * cuando lo piden — salvo que la persona YA tenga un hilo abierto, en
 * cuyo caso arranca desplegado: llegó con una conversación en curso y
 * esconderla detrás de un botón sería perderle la respuesta.
 */
export default function AyudaAlCrear({
  hiloInicial,
  sesionActiva,
}: {
  hiloInicial: HiloAyudaGeneral | null;
  sesionActiva: boolean;
}) {
  const [abierto, setAbierto] = useState(hiloInicial !== null);
  const whatsapp = enlaceWhatsapp(
    "¡Hola! Estoy armando mi tarjeta de lealtad en Bookea y quiero ayuda.",
  );

  return (
    <aside className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 shadow-[0_1px_2px_rgba(10,18,38,.04)]">
      <h2 className="text-[16px] font-extrabold leading-snug text-aventurea-navy">
        ¿Preferís atención personalizada?
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
        Armar la tarjeta toma dos minutos, pero si preferís que alguien te acompañe, escribinos
        y lo vemos juntos.
      </p>

      {!abierto && (
        <div className="mt-4 flex flex-col gap-2.5">
          {whatsapp !== null && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="presionable inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-[13.5px] font-bold text-[#062b16] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
            >
              <span aria-hidden>💬</span> Escribinos por WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="presionable inline-flex items-center justify-center gap-2 rounded-xl bg-aventurea-navy px-5 py-3 text-[13.5px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
          >
            <span aria-hidden>🗨️</span> Chatear con Bookea
          </button>
          <p className="text-[12px] leading-relaxed text-aventurea-ink-soft">
            El chat te contesta una persona del equipo, acá mismo. Si escribís fuera de horario,
            te respondemos al contacto que dejes.
          </p>
        </div>
      )}

      {abierto && (
        <div className="mt-4 flex min-h-[420px] flex-col">
          <ChatAyuda hiloInicial={hiloInicial} sesionActiva={sesionActiva} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {whatsapp !== null && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-bold text-[color:var(--accion)] hover:underline"
              >
                ¿Mejor por WhatsApp? →
              </a>
            )}
            {/* Cerrar solo se ofrece si NO hay hilo: con una
                conversación en curso, esconderla sería perderle la
                respuesta a quien está esperando. */}
            {hiloInicial === null && (
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="ml-auto text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
