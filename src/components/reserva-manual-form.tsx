"use client";

import { useState, useTransition } from "react";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export type ReservaManualInput = {
  fecha: string;
  nombre: string;
  tipo_evento: string;
  invitados: string;
  notas: string;
};

const VACIO: ReservaManualInput = {
  fecha: "",
  nombre: "",
  tipo_evento: "",
  invitados: "",
  notas: "",
};

/**
 * Para cargar a mano una reserva que llegó por teléfono o en persona —
 * queda confirmada de una vez, sin pasar por depósito ni comprobante.
 */
export default function ReservaManualForm({
  capacidadMax,
  onCrear,
}: {
  capacidadMax: number | null;
  onCrear: (input: {
    fecha: string;
    nombre: string;
    tipo_evento: string;
    invitados: number | null;
    notas: string | null;
  }) => Promise<{ error: string | null }>;
}) {
  const [datos, setDatos] = useState(VACIO);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [abierto, setAbierto] = useState(false);

  function set<K extends keyof ReservaManualInput>(campo: K, valor: string) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setOk(false);
  }

  function guardar() {
    setError(null);
    setOk(false);

    if (!datos.fecha) {
      setError("Elegí la fecha del evento.");
      return;
    }
    if (!datos.nombre.trim()) {
      setError("Escribí el nombre de quien reserva.");
      return;
    }
    const invitadosNum = datos.invitados.trim() ? Number(datos.invitados) : null;
    if (invitadosNum !== null && (!Number.isFinite(invitadosNum) || invitadosNum <= 0)) {
      setError("La cantidad de invitados no es válida.");
      return;
    }
    if (capacidadMax && invitadosNum && invitadosNum > capacidadMax) {
      setError(`Este lugar recibe hasta ${capacidadMax} personas.`);
      return;
    }

    startTransition(async () => {
      const res = await onCrear({
        fecha: datos.fecha,
        nombre: datos.nombre.trim(),
        tipo_evento: datos.tipo_evento.trim(),
        invitados: invitadosNum,
        notas: datos.notas.trim() || null,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDatos(VACIO);
      setOk(true);
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-navy hover:text-aventurea-navy"
      >
        + Agregar reserva manual
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[13.5px] font-bold text-aventurea-ink">
          Nueva reserva manual
        </h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          Cerrar
        </button>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Para cuando alguien reserva por teléfono o en persona. Queda confirmada
        directamente, sin depósito ni comprobante.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Fecha</label>
          <input
            type="date"
            value={datos.fecha}
            onChange={(e) => set("fecha", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nombre de quien reserva</label>
          <input
            type="text"
            value={datos.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Nombre completo"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Tipo de evento</label>
          <input
            type="text"
            value={datos.tipo_evento}
            onChange={(e) => set("tipo_evento", e.target.value)}
            placeholder="Ej. Cumpleaños, boda..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            Invitados {capacidadMax ? `(máximo ${capacidadMax})` : ""}
          </label>
          <input
            type="number"
            min={1}
            max={capacidadMax ?? undefined}
            value={datos.invitados}
            onChange={(e) => set("invitados", e.target.value)}
            placeholder="Opcional"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notas</label>
          <textarea
            value={datos.notas}
            onChange={(e) => set("notas", e.target.value)}
            placeholder="Opcional"
            rows={2}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-4 rounded-lg bg-aventurea-green/10 p-2.5 text-[13px] font-bold text-aventurea-green">
          ✓ Reserva creada y confirmada.
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={pending}
        className="mt-4 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Confirmar reserva"}
      </button>
    </div>
  );
}
