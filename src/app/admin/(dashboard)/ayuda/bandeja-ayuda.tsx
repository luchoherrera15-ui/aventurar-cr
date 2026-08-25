"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { HiloAyudaGeneral } from "@/lib/ayuda-general/tipos";
import {
  cerrarHilo,
  listarHilosAdmin,
  reabrirHilo,
  responderComoBookea,
} from "@/lib/ayuda-general/acciones";

/**
 * LA BANDEJA DE «HABLÁ CON BOOKEA» — el lado del equipo.
 *
 * Patrón visual calcado de `ayuda-panel.tsx` (complementos/): cabecera
 * navy, badge ámbar "Sin contestar", fila que se expande para leer y
 * contestar sin salir de la lista. La diferencia con aquel es que ACÁ
 * la pantalla entera es esto —no un widget que puede no tener nada que
 * mostrar y desaparecer con `return null`— así que el estado vacío es
 * explícito.
 *
 * Tiempo real: un solo canal fijo `ayuda-general-admin`, sin filtro
 * (calca `chat-flotante.tsx`) — la política de SELECT de
 * `mensajes_ayuda_general` ya deja pasar todo con `is_admin()`, así que
 * no hace falta filtrar en el canal, filtra la RLS. Cada INSERT nuevo
 * (mensaje o hilo abierto) dispara un refresco con `listarHilosAdmin()`
 * en vez de intentar parchear el mensaje suelto a mano: el evento de
 * Realtime trae la fila cruda de la tabla, no el hilo ya armado en
 * camelCase, y esta pantalla no tiene por qué duplicar esa costura —ya
 * vive una sola vez en `@/lib/ayuda-general/hilo.ts`. Si el socket no
 * conecta, cae a sondear cada 4s (mismo fallback de `hilo-chat.tsx`).
 */
export default function BandejaAyuda({
  hilosIniciales,
}: {
  hilosIniciales: HiloAyudaGeneral[];
}) {
  const [hilos, setHilos] = useState(hilosIniciales);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let pollId: ReturnType<typeof setInterval> | null = null;
    let cancelado = false;

    async function refrescar() {
      const frescos = await listarHilosAdmin();
      if (!cancelado) setHilos(frescos);
    }

    const canal = supabase
      .channel("ayuda-general-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes_ayuda_general" },
        () => {
          refrescar();
        },
      )
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
      cancelado = true;
      if (pollId) clearInterval(pollId);
      supabase.removeChannel(canal);
    };
  }, []);

  const ordenados = ordenarPorAtencion(hilos);
  const sinContestarTotal = ordenados.filter((h) => sinContestar(h) && h.estado === "abierta").length;

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Panel Admin
      </p>
      <h1 className="titulo mt-1 text-2xl text-aventurea-ink">Chats</h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        {ordenados.length === 0
          ? "Todavía no hay ningún chat abierto."
          : `${ordenados.length} hilo${ordenados.length === 1 ? "" : "s"}` +
            (sinContestarTotal > 0
              ? ` · ${sinContestarTotal} sin contestar`
              : "")}
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-aventurea-navy bg-white">
        {ordenados.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13.5px] text-aventurea-ink-soft">
            No hay mensajes de soporte por ahora.
          </p>
        ) : (
          ordenados.map((hilo, i) => (
            <Fila
              key={hilo.id}
              hilo={hilo}
              primera={i === 0}
              abierto={abiertoId === hilo.id}
              alAbrir={() => setAbiertoId((v) => (v === hilo.id ? null : hilo.id))}
              alCambiar={(nuevo) =>
                setHilos((prev) => prev.map((h) => (h.id === nuevo.id ? nuevo : h)))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Sin ninguna respuesta del equipo todavía. */
function sinContestar(hilo: HiloAyudaGeneral): boolean {
  return !hilo.mensajes.some((m) => m.deBookea);
}

/**
 * Abiertas sin contestar primero, después abiertas ya contestadas,
 * después cerradas. Dentro de cada grupo se respeta el orden con el
 * que llegó la lista —`listarHilosAdmin()` ya la trae por última
 * actividad, más nuevo primero— porque `Array.prototype.sort` es
 * estable: no hace falta una fecha cruda acá para no desordenar dos
 * hilos del mismo grupo.
 */
function ordenarPorAtencion(hilos: HiloAyudaGeneral[]): HiloAyudaGeneral[] {
  const rango = (h: HiloAyudaGeneral): number => {
    if (h.estado === "cerrada") return 2;
    return sinContestar(h) ? 0 : 1;
  };
  return [...hilos].sort((a, b) => rango(a) - rango(b));
}

function Fila({
  hilo,
  primera,
  abierto,
  alAbrir,
  alCambiar,
}: {
  hilo: HiloAyudaGeneral;
  primera: boolean;
  abierto: boolean;
  alAbrir: () => void;
  alCambiar: (nuevo: HiloAyudaGeneral) => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const faltaContestar = sinContestar(hilo);
  const ultimo = hilo.mensajes[hilo.mensajes.length - 1];

  function responder() {
    const limpio = texto.trim();
    if (!limpio) return;
    setError(null);
    iniciar(async () => {
      const res = await responderComoBookea(hilo.id, limpio);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      setTexto("");
      // `res.hilo` es null si la cabeza ya no está (se borró el hilo
      // entero, algo que hoy no hace ningún camino de la UI) — no hay
      // nada que actualizar en ese caso, un refresco de la lista lo
      // va a hacer desaparecer solo en el próximo evento de Realtime.
      if (res.hilo) alCambiar(res.hilo);
    });
  }

  function alternarCierre() {
    setError(null);
    iniciar(async () => {
      const res =
        hilo.estado === "cerrada" ? await reabrirHilo(hilo.id) : await cerrarHilo(hilo.id);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      alCambiar({ ...hilo, estado: hilo.estado === "cerrada" ? "abierta" : "cerrada" });
    });
  }

  return (
    <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-aventurea-ink">
          {hilo.nombre || "Sin nombre"}
        </span>
        {faltaContestar && hilo.estado === "abierta" && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-amber-800">
            Sin contestar
          </span>
        )}
        {hilo.estado === "cerrada" && (
          <span className="rounded-full bg-aventurea-cream-2 px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-aventurea-ink-soft">
            Cerrado
          </span>
        )}
        {hilo.contacto && (
          <span className="truncate text-[11.5px] text-aventurea-ink-soft">{hilo.contacto}</span>
        )}
        <span className="text-[11.5px] text-aventurea-ink-soft">{ultimo?.fecha}</span>
        <button
          type="button"
          onClick={alAbrir}
          className="rounded-[10px] bg-aventurea-navy px-3.5 py-2 text-[12.5px] font-bold text-white"
          aria-expanded={abierto}
        >
          {abierto ? "Cerrar el hilo" : faltaContestar ? "Leer y contestar" : "Ver el hilo"}
        </button>
        <button
          type="button"
          onClick={alternarCierre}
          disabled={ocupado}
          className="text-[12px] font-bold text-red-700 underline disabled:opacity-40"
        >
          {hilo.estado === "cerrada" ? "Reabrir" : "Marcar resuelto"}
        </button>
      </div>

      {!abierto && ultimo && (
        <p className="mt-1 truncate text-[12.5px] italic text-aventurea-ink-soft">
          {ultimo.deBookea ? "Vos: " : ""}
          &ldquo;{ultimo.texto}&rdquo;
        </p>
      )}

      {abierto && (
        <div className="mt-3">
          <div className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto rounded-2xl border border-aventurea-line bg-aventurea-cream p-3.5">
            {hilo.mensajes.map((m) => (
              <div key={m.id} className={`flex ${m.deBookea ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13.5px] ${
                    m.deBookea
                      ? "bg-aventurea-navy text-white"
                      : "bg-white text-aventurea-ink"
                  }`}
                >
                  {m.texto}
                  <span
                    className={`mt-1 block text-[10.5px] ${
                      m.deBookea ? "text-white/60" : "text-aventurea-ink-soft"
                    }`}
                  >
                    {m.fecha}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hilo.estado === "cerrada" ? (
            <p className="mt-2.5 text-[12.5px] text-aventurea-ink-soft">
              Este hilo está cerrado. Si escribe de nuevo, se reabre solo.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                responder();
              }}
              className="mt-2.5 flex items-center gap-2"
            >
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribí la respuesta..."
                className="flex-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={ocupado || !texto.trim()}
                className="rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
              >
                Enviar
              </button>
            </form>
          )}

          {error && <p className="mt-1.5 text-[12.5px] font-bold text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
