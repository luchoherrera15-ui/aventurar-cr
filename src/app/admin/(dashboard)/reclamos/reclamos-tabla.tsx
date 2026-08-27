"use client";

import { useState, useTransition } from "react";
import { aprobarReclamo, rechazarReclamo } from "./actions";

export type ReclamoFila = {
  id: string;
  negocio: string;
  slug: string | null;
  nombre: string;
  correo: string;
  telefono: string | null;
  mensaje: string | null;
  estado: "pendiente" | "aprobado" | "rechazado";
  creadoEn: string;
  notaInterna: string | null;
};

const ETIQUETA: Record<ReclamoFila["estado"], { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  aprobado: { texto: "Aprobado", clase: "bg-emerald-50 text-emerald-800 ring-emerald-600/20" },
  rechazado: { texto: "Rechazado", clase: "bg-slate-100 text-slate-600 ring-slate-500/20" },
};

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * La bandeja de reclamos. Aprobar TRASPASA el negocio, así que el botón
 * pide una confirmación explícita en dos pasos — no un `confirm()` del
 * navegador, que se aprende a cerrar sin leer.
 */
export default function ReclamosTabla({ filas }: { filas: ReclamoFila[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** El reclamo cuyo botón de aprobar está esperando el segundo clic. */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [lista, setLista] = useState(filas);

  function aprobar(id: string) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const res = await aprobarReclamo(id);
      setConfirmando(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.aviso) setAviso(res.aviso);
      setLista((prev) =>
        prev.map((f) => (f.id === id ? { ...f, estado: "aprobado" as const } : f)),
      );
    });
  }

  function rechazar(id: string) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const res = await rechazarReclamo(id, "");
      if (res.error) {
        setError(res.error);
        return;
      }
      setLista((prev) =>
        prev.map((f) => (f.id === id ? { ...f, estado: "rechazado" as const } : f)),
      );
    });
  }

  if (lista.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-8 text-center text-[14px] text-aventurea-ink-soft">
        Todavía nadie reclamó un negocio. Cuando alguien lo haga, llega un correo y la
        solicitud aparece acá.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </p>
      )}
      {aviso && (
        <p className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800">{aviso}</p>
      )}

      {lista.map((f) => {
        const e = ETIQUETA[f.estado];
        return (
          <div
            key={f.id}
            className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-aventurea-ink">
                  {f.slug ? (
                    <a
                      href={`/${f.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-aventurea-navy"
                    >
                      {f.negocio}
                    </a>
                  ) : (
                    f.negocio
                  )}
                </p>
                <p className="mt-0.5 text-[13px] text-aventurea-ink-soft">
                  {f.nombre} · <a className="underline" href={`mailto:${f.correo}`}>{f.correo}</a>
                  {f.telefono ? ` · ${f.telefono}` : ""}
                  {" · "}
                  {fecha(f.creadoEn)}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ring-1 ring-inset ${e.clase}`}
              >
                {e.texto}
              </span>
            </div>

            {f.mensaje && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-aventurea-ink">
                {f.mensaje}
              </p>
            )}

            {f.estado === "pendiente" && (
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {confirmando === f.id ? (
                  <>
                    <span className="text-[13px] font-bold text-aventurea-ink">
                      ¿Traspasarle {f.negocio} a {f.correo}?
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => aprobar(f.id)}
                      className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-50"
                    >
                      {pending ? "Traspasando…" : "Sí, traspasar"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirmando(null)}
                      className="rounded-xl border border-aventurea-line px-4 py-2 text-[13px] font-bold text-aventurea-ink"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirmando(f.id)}
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-50"
                    >
                      Aprobar y traspasar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => rechazar(f.id)}
                      className="rounded-xl border border-aventurea-line px-4 py-2 text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
                    >
                      Rechazar
                    </button>
                    <span className="text-[12px] text-aventurea-ink-soft">
                      La persona necesita una cuenta de Bookea con ese correo — si no
                      existe, el traspaso avisa y no hace nada.
                    </span>
                  </>
                )}
              </div>
            )}

            {f.notaInterna && (
              <p className="mt-2 text-[12px] text-aventurea-ink-soft">
                Nota: {f.notaInterna}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
