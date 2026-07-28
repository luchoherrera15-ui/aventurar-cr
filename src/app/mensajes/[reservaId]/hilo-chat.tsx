"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { enviarMensaje } from "../actions";
import type { Mensaje } from "@/app/mi-rancho/types";

export default function HiloChat({
  conversacionId,
  miId,
  mensajesIniciales,
}: {
  conversacionId: string;
  miId: string;
  mensajesIniciales: Mensaje[];
}) {
  const [mensajes, setMensajes] = useState(mensajesIniciales);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let pollId: ReturnType<typeof setInterval> | null = null;

    async function refrescar() {
      const { data } = await supabase
        .from("mensajes")
        .select("id, conversacion_id, autor_id, texto, created_at")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: true });
      if (data) setMensajes(data as Mensaje[]);
    }

    const canal = supabase
      .channel(`mensajes-${conversacionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes",
          filter: `conversacion_id=eq.${conversacionId}`,
        },
        (payload) => {
          const nuevo = payload.new as Mensaje;
          setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
        },
      )
      // Si Realtime no conecta (no está habilitado en el proyecto, la
      // tabla no está en la publicación, red...) el chat no puede quedar
      // muerto: se cae a refrescar la lista cada pocos segundos.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (pollId) {
            clearInterval(pollId);
            pollId = null;
          }
        } else if (
          !pollId &&
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
        ) {
          pollId = setInterval(refrescar, 4000);
        }
      });

    return () => {
      if (pollId) clearInterval(pollId);
      supabase.removeChannel(canal);
    };
  }, [conversacionId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  function enviar() {
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto("");
    setError(null);
    startTransition(async () => {
      const res = await enviarMensaje(conversacionId, limpio);
      if (res.error !== null) {
        setError(res.error);
        // Se le devuelve lo que escribió para que no lo pierda.
        setTexto(limpio);
        return;
      }
      const nuevo = res.mensaje;
      setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {mensajes.length === 0 && (
          <p className="mt-6 text-center text-[13px] text-aventurea-ink-soft">
            Todavía no hay mensajes. Escribí el primero.
          </p>
        )}
        {mensajes.map((m) => {
          const esMio = m.autor_id === miId;
          return (
            <div key={m.id} className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13.5px] ${
                  esMio
                    ? "bg-aventurea-navy text-white"
                    : "bg-aventurea-cream-2 text-aventurea-ink"
                }`}
              >
                {m.texto}
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      {error && (
        <p className="border-t border-aventurea-line bg-red-50 px-4 py-2 text-[12.5px] text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex items-center gap-2 border-t border-aventurea-line p-3"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí un mensaje..."
          className="flex-1 rounded-full border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !texto.trim()}
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-white disabled:opacity-50"
        >
          →
        </button>
      </form>
    </div>
  );
}
