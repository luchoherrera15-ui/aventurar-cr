"use client";

import { useEffect, useRef, useState } from "react";
import { responderAgenteLealtad, enviarTranscripcionAgente, type MensajeChat } from "./agente-actions";
import { volverAlSelectorBurbuja, irACorreoBurbuja, cerrarBurbujaContacto } from "./burbuja-contacto-estado";

/**
 * EL CHAT CON EL AGENTE — la otra mitad de la burbuja de contacto,
 * junto a "Enviar un correo" (`burbuja-contacto.tsx`, sin tocar).
 *
 * TOPE DE 10 mensajes del visitante (pedido del dueño): esto es
 * anónimo y público, así que sin tope alguien podría hacerlo hablar
 * solo y generar costo real de Gemini sin límite. El servidor
 * (`agente-actions.ts`) hace cumplir un tope más generoso por si
 * alguien arma un `fetch` a mano — acá es la experiencia normal.
 *
 * LA TRANSCRIPCIÓN SE MANDA POR CORREO al cerrar el chat o al llegar
 * al tope (pedido del dueño, "para poder revisar qué está
 * respondiendo") — fire-and-forget, no bloquea la UI ni le importa al
 * visitante si el correo salió o no.
 */

const TOPE_MENSAJES_USUARIO = 10;

const SALUDO: MensajeChat = {
  role: "assistant",
  content:
    "¡Hola! Soy el agente de Bookea Lealtad. Preguntame por los paquetes, cómo funciona el pase o cualquier duda — si en algún momento preferís hablar por correo, hay un botón para eso abajo.",
};

export default function ChatAgente() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([SALUDO]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const transcripcionEnviada = useRef(false);

  const mensajesUsuario = mensajes.filter((m) => m.role === "user").length;
  const tope = mensajesUsuario >= TOPE_MENSAJES_USUARIO;

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes]);

  // Al desmontar (cerrar el chat o volver al selector) se manda la
  // transcripción una sola vez, y solo si hubo alguna pregunta real —
  // el saludo solo no le sirve a nadie para revisar nada.
  useEffect(() => {
    return () => {
      if (!transcripcionEnviada.current && mensajesUsuario > 0) {
        transcripcionEnviada.current = true;
        void enviarTranscripcionAgente(mensajes);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se lee el `mensajes`/`mensajesUsuario` de la última renderización al desmontar, no hace falta que el efecto se reprograme en cada mensaje
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando || tope) return;

    setError(null);
    setTexto("");
    const conNuevo = [...mensajes, { role: "user" as const, content: limpio }];
    setMensajes(conNuevo);
    setEnviando(true);

    const resultado = await responderAgenteLealtad(conNuevo);
    setEnviando(false);

    if (resultado.ok) {
      setMensajes((prev) => [...prev, { role: "assistant", content: resultado.texto }]);
    } else {
      setError(resultado.motivo);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: "rgba(255,255,255,.1)" }}>
        <button
          type="button"
          onClick={volverAlSelectorBurbuja}
          className="text-[12.5px] font-bold text-white/55 hover:text-white"
        >
          ← Atrás
        </button>
        <div className="flex items-center gap-3">
          <p className="text-[12px] font-bold uppercase tracking-wide text-white/40">
            {mensajesUsuario}/{TOPE_MENSAJES_USUARIO}
          </p>
          <button
            type="button"
            onClick={cerrarBurbujaContacto}
            aria-label="Cerrar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex h-[320px] flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
              m.role === "user" ? "self-end rounded-br-sm text-white" : "self-start rounded-bl-sm text-white/90"
            }`}
            style={{
              background: m.role === "user" ? "var(--accion-claro)" : "rgba(255,255,255,.08)",
              color: m.role === "user" ? "var(--accion-claro-tinta)" : undefined,
            }}
          >
            {m.content}
          </div>
        ))}

        {enviando && (
          <div className="flex w-fit items-center gap-1 self-start rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ background: "rgba(255,255,255,.08)" }}>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-[12px] font-bold leading-relaxed text-red-300">
            {error}
          </p>
        )}

        {tope && (
          <p className="rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-white/70" style={{ background: "rgba(255,255,255,.06)" }}>
            Llegamos al límite de este chat. Si seguís con dudas, escribinos por correo.
          </p>
        )}

        <div ref={finRef} />
      </div>

      {tope ? (
        <div className="p-4 pt-0">
          <button
            type="button"
            onClick={irACorreoBurbuja}
            className="flex h-11 w-full items-center justify-center rounded-xl text-[13.5px] font-bold transition-colors"
            style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
          >
            Enviar un correo →
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex items-center gap-2 p-4 pt-0">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí tu pregunta…"
            maxLength={600}
            disabled={enviando}
            className="h-11 flex-1 rounded-xl border bg-white/[0.06] px-3.5 text-[13.5px] text-white placeholder:text-white/45 disabled:opacity-60"
            style={{ borderColor: "rgba(255,255,255,.15)" }}
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            aria-label="Enviar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold transition-colors disabled:opacity-50"
            style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
          >
            →
          </button>
        </form>
      )}
    </div>
  );
}
