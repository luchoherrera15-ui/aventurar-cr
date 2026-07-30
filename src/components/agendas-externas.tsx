"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  conectarAgendaExterna,
  desconectarAgendaExterna,
  resincronizarAgendaExterna,
} from "@/app/mi-rancho/[id]/agendas-externas-actions";
import { IconCalendarLine } from "./icons";

export type AgendaExternaFila = {
  id: string;
  nombre: string;
  url: string;
  ultima_sync: string | null;
  ultimo_error: string | null;
  eventos_importados: number;
};

/**
 * "Sincronizar agendas" (importar): el proveedor conecta el calendario
 * que ya usaba (Google/Apple) pegando su dirección .ics privada; sus
 * compromisos entran como bloqueos y esas horas dejan de ofrecerse.
 * El resultado se verifica visual en el calendario de ocupación de la
 * misma pestaña. `null` en `agendas` = la 0072 no ha corrido — no se
 * muestra nada.
 */
export default function AgendasExternas({
  ranchoId,
  agendas,
}: {
  ranchoId: string;
  agendas: AgendaExternaFila[] | null;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (agendas === null) return null;

  function conectar() {
    setMensaje(null);
    startTransition(async () => {
      const res = await conectarAgendaExterna(ranchoId, { nombre, url });
      if (res.error) {
        setMensaje({ tipo: "error", texto: res.error });
      } else {
        setMensaje({
          tipo: "ok",
          texto: `Listo: ${res.importados ?? 0} eventos importados como bloqueos. Revisá el calendario de arriba.`,
        });
        setNombre("");
        setUrl("");
      }
      router.refresh();
    });
  }

  function resincronizar(agendaId: string) {
    setOcupada(agendaId);
    setMensaje(null);
    startTransition(async () => {
      const res = await resincronizarAgendaExterna(ranchoId, agendaId);
      setOcupada(null);
      setMensaje(
        res.error
          ? { tipo: "error", texto: res.error }
          : { tipo: "ok", texto: `Sincronizado: ${res.importados ?? 0} eventos importados.` },
      );
      router.refresh();
    });
  }

  function desconectar(agendaId: string, nombreAgenda: string) {
    if (
      !window.confirm(
        `¿Desconectar "${nombreAgenda}"? Se borran también los bloqueos que se importaron de ese calendario.`,
      )
    ) {
      return;
    }
    setOcupada(agendaId);
    startTransition(async () => {
      const res = await desconectarAgendaExterna(ranchoId, agendaId);
      setOcupada(null);
      if (res.error) setMensaje({ tipo: "error", texto: res.error });
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13px] text-aventurea-ink placeholder:text-aventurea-ink-soft/60 focus:border-aventurea-navy focus:outline-none";

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-5">
      <h3 className="flex items-center gap-2 text-[14px] font-extrabold text-aventurea-ink">
        <IconCalendarLine className="h-4.5 w-4.5 text-aventurea-orange" />
        Sincronizar agendas
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
        ¿Ya llevabas tu agenda en Google Calendar o en el iPhone? Conectala y
        tus compromisos existentes entran como bloqueos: esas fechas y horas
        dejan de ofrecerse en Bookea. Verificá el resultado en el calendario
        de ocupación de arriba.
      </p>
      <ul className="mt-2 grid gap-1 text-[12px] leading-relaxed text-aventurea-ink-soft">
        <li>
          <span className="font-bold text-aventurea-ink">Google:</span>{" "}
          Configuración del calendario → &quot;Dirección secreta en formato
          iCal&quot; → copiá el link.
        </li>
        <li>
          <span className="font-bold text-aventurea-ink">Apple/iCloud:</span>{" "}
          Calendario → compartir → &quot;Calendario público&quot; → copiá el
          link webcal://.
        </li>
      </ul>

      {agendas.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-aventurea-line bg-white">
          {agendas.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-aventurea-line px-4 py-3 last:border-none"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-aventurea-ink">{a.nombre}</p>
                <p className="text-[11.5px] text-aventurea-ink-soft">
                  {a.eventos_importados} evento{a.eventos_importados === 1 ? "" : "s"} importado
                  {a.eventos_importados === 1 ? "" : "s"}
                  {a.ultima_sync
                    ? ` · última sync ${new Date(a.ultima_sync).toLocaleString("es-CR", {
                        timeZone: "America/Costa_Rica",
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : " · sin sincronizar todavía"}
                </p>
                {a.ultimo_error && (
                  <p className="text-[11.5px] font-semibold text-red-600">{a.ultimo_error}</p>
                )}
              </div>
              <button
                type="button"
                disabled={pendiente && ocupada === a.id}
                onClick={() => resincronizar(a.id)}
                className="rounded-full border border-aventurea-line px-3 py-1 text-[11.5px] font-bold text-aventurea-navy hover:border-aventurea-navy disabled:opacity-50"
              >
                {pendiente && ocupada === a.id ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
              <button
                type="button"
                disabled={pendiente && ocupada === a.id}
                onClick={() => desconectar(a.id, a.nombre)}
                className="text-[11.5px] font-bold text-red-600 hover:underline disabled:opacity-50"
              >
                Desconectar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_2fr_auto]">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (ej. Mi Google Calendar)"
          className={inputCls}
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Pegá acá la dirección .ics o webcal://"
          className={inputCls}
        />
        <button
          type="button"
          disabled={pendiente || !url.trim()}
          onClick={conectar}
          className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-50"
        >
          {pendiente && !ocupada ? "Conectando…" : "Conectar y sincronizar"}
        </button>
      </div>

      {mensaje && (
        <p
          className={`mt-2.5 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold ${
            mensaje.tipo === "ok"
              ? "border border-aventurea-green/30 bg-aventurea-green/10 text-aventurea-green"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
