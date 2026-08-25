"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fechaCortaMensaje } from "@/lib/fechas";
import { IconTrash } from "@/components/icons";
import BotonResuelto from "./boton-resuelto";
import PreviewMensaje from "@/components/preview-mensaje";
import { eliminarConversacion, vaciarResueltas } from "./actions";

/**
 * La lista de la bandeja de mensajes, separada de la página para poder
 * probarla con datos de mentira. No sabe nada de Supabase: recibe las
 * filas ya armadas. Dos pestañas — Activas y Resueltas — para poder
 * archivar una conversación ya cerrada sin perderla de vista del todo.
 *
 * Y para que las resueltas no se acumulen sin fin, cada fila se puede
 * eliminar (una por una o todas las archivadas de un golpe): el hilo
 * desaparece SOLO de esta bandeja — los mensajes no se borran y el otro
 * lado conserva su historial — y vuelve solo si llega un mensaje nuevo.
 */

export type TagChat = { texto: string; clase: string };

export type FilaConversacion = {
  id: string;
  /** /mensajes/[reservaId] para hilos de reserva, /mensajes/hilo/[id]
   *  para consultas directas sin reserva. */
  href: string;
  titulo: string;
  subtitulo: string;
  foto: string | null;
  ultimoTexto: string;
  actividad: string;
  pendientes: number;
  resuelta: boolean;
  tag: TagChat;
};

export default function ListaConversaciones({ filas }: { filas: FilaConversacion[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"activas" | "resueltas">("activas");
  // Lo que ya se eliminó en esta pantalla: la fila se va de una, sin
  // esperar el viaje al servidor ni el refresh de la página.
  const [eliminadas, setEliminadas] = useState<string[]>([]);
  const [vaciando, empezarVaciado] = useTransition();

  const presentes = filas.filter((f) => !eliminadas.includes(f.id));
  const activas = presentes.filter((f) => !f.resuelta);
  const resueltas = presentes.filter((f) => f.resuelta);
  const visibles = tab === "activas" ? activas : resueltas;

  function eliminar(id: string) {
    setEliminadas((prev) => [...prev, id]);
    void eliminarConversacion(id).then((r) => {
      // Si falló, la fila vuelve: mejor verla de nuevo que creer que se
      // limpió algo que sigue ahí.
      if (r.error) setEliminadas((prev) => prev.filter((x) => x !== id));
      router.refresh();
    });
  }

  function vaciar() {
    const ok = window.confirm(
      `¿Eliminar las ${resueltas.length} conversaciones resueltas de tu bandeja?\n\n` +
        "Los mensajes no se borran: podés seguir viéndolos desde la reserva, " +
        "y el chat vuelve solo si la otra persona escribe.",
    );
    if (!ok) return;
    const ids = resueltas.map((f) => f.id);
    setEliminadas((prev) => [...prev, ...ids]);
    empezarVaciado(async () => {
      const r = await vaciarResueltas();
      if (r.error) setEliminadas((prev) => prev.filter((x) => !ids.includes(x)));
      router.refresh();
    });
  }

  if (presentes.length === 0) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-8 text-center">
        <p className="text-[14px] font-bold text-aventurea-ink">
          Todavía no tenés conversaciones.
        </p>
        <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-aventurea-ink-soft">
          Cuando reservés un lugar o pidás una cotización, el chat con el
          proveedor aparece acá.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
        >
          Ver el directorio
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PestanaTab
          label="Activas"
          cantidad={activas.length}
          activo={tab === "activas"}
          onClick={() => setTab("activas")}
        />
        <PestanaTab
          label="Resueltas"
          cantidad={resueltas.length}
          activo={tab === "resueltas"}
          onClick={() => setTab("resueltas")}
        />
        {tab === "resueltas" && resueltas.length > 0 && (
          <button
            type="button"
            onClick={vaciar}
            disabled={vaciando}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-aventurea-line bg-aventurea-surface px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            <IconTrash className="h-3.5 w-3.5" />
            {vaciando ? "Vaciando…" : "Vaciar resueltas"}
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-8 text-center">
          <p className="text-[13.5px] text-aventurea-ink-soft">
            {tab === "activas"
              ? "No tenés conversaciones activas — todo al día."
              : "No tenés conversaciones archivadas."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {visibles.map((f) => {
            const nuevo = f.pendientes > 0;
            return (
              <Link
                key={f.id}
                href={f.href}
                className={`flex items-center gap-3.5 border-b border-aventurea-line px-4 py-3.5 transition-colors last:border-none ${
                  nuevo
                    ? "bg-aventurea-green/[0.06] hover:bg-aventurea-green/10"
                    : "hover:bg-aventurea-cream-2/50"
                }`}
              >
                <div
                  className="h-12 w-12 shrink-0 rounded-full bg-aventurea-cream-2 bg-cover bg-center"
                  style={f.foto ? { backgroundImage: `url(${f.foto})` } : undefined}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-aventurea-ink">
                    {f.titulo}
                  </p>
                  {f.subtitulo && (
                    <p className="truncate text-[12px] text-aventurea-ink-soft">
                      {f.subtitulo}
                    </p>
                  )}
                  <PreviewMensaje
                    texto={f.ultimoTexto}
                    className={`mt-0.5 block truncate text-[12.5px] ${
                      nuevo ? "font-bold text-aventurea-ink" : "text-aventurea-ink-soft"
                    }`}
                  />
                  <span className={`mt-1.5 inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold ${f.tag.clase}`}>
                    {f.tag.texto}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${
                      nuevo
                        ? "bg-aventurea-navy text-white"
                        : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft"
                    }`}
                  >
                    {fechaCortaMensaje(f.actividad)}
                  </span>
                  {nuevo && (
                    <span className="rounded-lg bg-aventurea-green px-2.5 py-1 text-[10.5px] font-bold text-white">
                      {f.pendientes} nuevo{f.pendientes === 1 ? "" : "s"}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <BotonResuelto conversacionId={f.id} resuelta={f.resuelta} />
                    <BotonEliminar onEliminar={() => eliminar(f.id)} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Saca el chat de la bandeja. Va dentro del <Link> de la fila, así que
 *  frena el clic para no abrir el hilo que se está eliminando. */
function BotonEliminar({ onEliminar }: { onEliminar: () => void }) {
  return (
    <button
      type="button"
      aria-label="Eliminar de mi bandeja"
      title="Eliminar de mi bandeja"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onEliminar();
      }}
      className="shrink-0 rounded-lg border border-aventurea-line p-1.5 text-aventurea-ink-soft transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
    >
      <IconTrash className="h-3.5 w-3.5" />
    </button>
  );
}

function PestanaTab({
  label,
  cantidad,
  activo,
  onClick,
}: {
  label: string;
  cantidad: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-ink"
      }`}
    >
      {label}
      <span className={`ml-1.5 ${activo ? "text-white/70" : "text-zinc-400"}`}>{cantidad}</span>
    </button>
  );
}
