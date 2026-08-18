"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  iniciarHilo,
  mandarMensaje,
  obtenerHiloVisitante,
} from "@/lib/ayuda-general/acciones";
import type { HiloAyudaGeneral, MensajeAyudaGeneral } from "@/lib/ayuda-general/tipos";

/**
 * EL CHAT DE /ayuda — visitante ↔ administración de Bookea, a pantalla
 * completa (no burbuja flotante: esto es una página).
 *
 * Sin sesión de Supabase anónima en ningún punto de este archivo — es
 * el bug que ya costó caro (ver AGENTS del pedido): una sesión anónima
 * no trae nombre ni correo, y tratarla como si supiera quién es la
 * persona es exactamente lo que salió mal la vez pasada. Acá la
 * identidad de quien no tiene cuenta es nombre+contacto explícitos, y
 * la continuidad la da una cookie httpOnly que ni este componente
 * puede leer — todo pasa por las server actions de
 * `@/lib/ayuda-general/acciones`.
 *
 * Tres mecanismos de "en vivo" según quién mira (mismo criterio que el
 * plan, §3):
 *  · Con sesión real: canal de Supabase Realtime (igual patrón que
 *    `hilo-chat.tsx`), con fallback a polling si el socket no conecta.
 *  · Sin sesión: sin intento de canal (RLS no le muestra nada a
 *    `anon` — sería un CHANNEL_ERROR garantizado). Polling directo
 *    cada ~3.5s contra la misma server action que arma el estado
 *    inicial.
 */

type FilaCruda = {
  id: string;
  texto: string;
  de_bookea: boolean;
  autor_id: string | null;
  created_at: string;
};

function mapearFila(f: FilaCruda): MensajeAyudaGeneral {
  return { id: f.id, texto: f.texto, deBookea: f.de_bookea, fecha: f.created_at, autorId: f.autor_id };
}

export default function ChatAyuda({
  hiloInicial,
  sesionActiva,
}: {
  hiloInicial: HiloAyudaGeneral | null;
  sesionActiva: boolean;
}) {
  const [hilo, setHilo] = useState(hiloInicial);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [panal, setPanal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  // Anuncio para lector de pantalla: solo cuando llega una respuesta
  // NUEVA de Bookea (no en cada render, no con lo que uno mismo acaba
  // de escribir — eso ya lo ve en pantalla quien lo tecleó).
  const anunciadoRef = useRef<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  useEffect(() => {
    if (!hilo || hilo.mensajes.length === 0) return;
    const ultimo = hilo.mensajes[hilo.mensajes.length - 1];
    if (ultimo.deBookea && anunciadoRef.current !== ultimo.id) {
      anunciadoRef.current = ultimo.id;
      setAnuncio(`Bookea respondió: ${ultimo.texto}`);
    }
  }, [hilo]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [hilo?.mensajes.length]);

  // El mecanismo de "en vivo". Se re-arma solo cuando cambia DE hilo
  // (o el tipo de identidad), nunca en cada mensaje nuevo — si no, cada
  // respuesta reabriría el canal desde cero. Por eso el efecto depende
  // del id (primitivo), no del objeto `hilo` completo: dependerlo de
  // `hilo` lo re-armaría con cada mensaje que ese mismo objeto trae.
  const hiloId = hilo?.id ?? null;
  useEffect(() => {
    if (!hiloId) return;

    if (!sesionActiva) {
      // Sin sesión: `anon` no tiene ninguna política de RLS sobre esta
      // tabla (§2 del diseño) — intentar un canal acá sería un
      // CHANNEL_ERROR seguro. Se pide el hilo entero por la MISMA
      // server action que arma el estado inicial.
      const intervalo = setInterval(async () => {
        const actual = await obtenerHiloVisitante();
        if (actual) setHilo(actual);
      }, 3500);
      return () => clearInterval(intervalo);
    }

    const supabase = createClient();
    let pollId: ReturnType<typeof setInterval> | null = null;

    async function refrescar() {
      const { data } = await supabase
        .from("mensajes_ayuda_general")
        .select("id, texto, de_bookea, autor_id, created_at")
        .eq("hilo_id", hiloId)
        .order("created_at", { ascending: true });
      if (data) {
        const mapeados = (data as FilaCruda[]).map(mapearFila);
        setHilo((prev) => (prev ? { ...prev, mensajes: mapeados } : prev));
      }
    }

    const canal = supabase
      .channel(`ayuda-hilo-${hiloId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes_ayuda_general",
          filter: `hilo_id=eq.${hiloId}`,
        },
        (payload) => {
          const nuevo = mapearFila(payload.new as FilaCruda);
          setHilo((prev) =>
            prev
              ? prev.mensajes.some((m) => m.id === nuevo.id)
                ? prev
                : { ...prev, mensajes: [...prev.mensajes, nuevo] }
              : prev,
          );
        },
      )
      // Si Realtime no conecta, el chat no se puede quedar mudo: se cae
      // a refrescar cada pocos segundos (mismo patrón que hilo-chat.tsx).
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
  }, [hiloId, sesionActiva]);

  function enviarPrimerMensaje(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const limpio = mensaje.trim();
    if (!limpio) return;
    if (!sesionActiva) {
      if (nombre.trim().length < 2) {
        setError("Contanos tu nombre.");
        return;
      }
      if (contacto.trim().length < 5) {
        setError("Dejanos un correo o un WhatsApp para responderte.");
        return;
      }
    }
    startTransition(async () => {
      const res = await iniciarHilo({
        mensaje: limpio,
        nombre: sesionActiva ? undefined : nombre.trim(),
        contacto: sesionActiva ? undefined : contacto.trim(),
        panal,
      });
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      // `res.hilo` puede ser null: es lo que devuelve el señuelo
      // anti-bot cuando `panal` viene lleno (mismo criterio que
      // `contacto-actions.ts` — se contesta éxito sin escribir nada,
      // nunca se le enseña al bot que falló). Una persona real nunca
      // pasa por acá con `hilo` en null.
      if (res.hilo) setHilo(res.hilo);
      setMensaje("");
    });
  }

  function enviarRespuesta(e: FormEvent) {
    e.preventDefault();
    if (!hilo) return;
    const limpio = mensaje.trim();
    if (!limpio) return;
    setMensaje("");
    setError(null);
    startTransition(async () => {
      const res = await mandarMensaje(hilo.id, limpio);
      if (!res.ok) {
        setError(res.motivo);
        setMensaje(limpio);
        return;
      }
      const nuevo = res.mensaje;
      if (!nuevo) return;
      setHilo((prev) =>
        prev
          ? prev.mensajes.some((m) => m.id === nuevo.id)
            ? prev
            : { ...prev, mensajes: [...prev.mensajes, nuevo] }
          : prev,
      );
    });
  }

  // ── Sin hilo todavía: el formulario mínimo (o, con sesión, solo el
  //    mensaje — nombre y correo ya se sabe de dónde salen). ─────────
  if (!hilo) {
    return (
      <form
        onSubmit={enviarPrimerMensaje}
        className="flex flex-1 flex-col gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 sm:p-5"
      >
        {!sesionActiva && (
          <>
            <div>
              <label
                htmlFor="ayuda-nombre"
                className="mb-1 block text-[12px] font-bold text-aventurea-ink-soft"
              >
                Tu nombre
              </label>
              <input
                id="ayuda-nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={100}
                placeholder="¿Cómo te llamás?"
                className="w-full rounded-xl border border-aventurea-line bg-aventurea-cream-2/60 px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-sky focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="ayuda-contacto"
                className="mb-1 block text-[12px] font-bold text-aventurea-ink-soft"
              >
                Correo o WhatsApp
              </label>
              <input
                id="ayuda-contacto"
                type="text"
                required
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                maxLength={150}
                placeholder="Para poder contestarte si no volvés a esta página"
                className="w-full rounded-xl border border-aventurea-line bg-aventurea-cream-2/60 px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-sky focus:outline-none"
              />
            </div>
            {/* Señuelo para bots: invisible para una persona, ver
                contacto-actions.ts (mismo patrón). */}
            <input
              type="text"
              value={panal}
              onChange={(e) => setPanal(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
          </>
        )}
        <div className="flex-1">
          <label
            htmlFor="ayuda-mensaje-inicial"
            className="mb-1 block text-[12px] font-bold text-aventurea-ink-soft"
          >
            ¿Qué necesitás?
          </label>
          <textarea
            id="ayuda-mensaje-inicial"
            required
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Contanos qué necesitás..."
            className="w-full resize-none rounded-xl border border-aventurea-line bg-aventurea-cream-2/60 px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-sky focus:outline-none"
          />
        </div>
        {error && (
          <p role="alert" className="text-[12.5px] font-bold text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || !mensaje.trim()}
          className="presionable rounded-xl bg-aventurea-navy px-5 py-3 text-[13.5px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Enviando..." : "Enviar"}
        </button>
      </form>
    );
  }

  // ── Hay hilo: la conversación, alineada por quién la escribió. ────
  const cerrado = hilo.estado === "cerrada";
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
      <div className="flex shrink-0 items-center justify-between border-b border-aventurea-line px-4 py-2.5">
        <p className="text-[12.5px] font-bold text-aventurea-ink-soft">
          {cerrado ? "Hilo cerrado" : "Hilo abierto"}
        </p>
        {cerrado && (
          <p className="text-[11.5px] text-aventurea-ink-soft">
            Escribí y se reabre solo.
          </p>
        )}
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {anuncio}
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {hilo.mensajes.length === 0 && (
          <p className="mt-6 text-center text-[13px] text-aventurea-ink-soft">
            Ya recibimos tu mensaje. Te contestamos en cuanto lo veamos.
          </p>
        )}
        {hilo.mensajes.map((m) => (
          <div key={m.id} className={`flex ${m.deBookea ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13.5px] ${
                m.deBookea
                  ? "bg-aventurea-cream-2 text-aventurea-ink"
                  : "bg-aventurea-navy text-white"
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      {error && (
        <p role="alert" className="border-t border-aventurea-line bg-red-50 px-4 py-2 text-[12.5px] text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={enviarRespuesta} className="flex items-center gap-2 border-t border-aventurea-line p-3">
        <label htmlFor="ayuda-mensaje" className="sr-only">
          Escribir un mensaje
        </label>
        <input
          id="ayuda-mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={2000}
          placeholder="Escribí un mensaje..."
          className="flex-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !mensaje.trim()}
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-white disabled:opacity-50"
        >
          →
        </button>
      </form>
    </div>
  );
}
