"use client";

import { useState } from "react";

/**
 * Carga rápida del historial: para el propietario que ya venía
 * trabajando antes de Bookea y necesita meter de un solo sus fechas
 * reservadas — con montos, cobros y cantidad de personas — sin llenar
 * el formulario grande una por una.
 *
 * Es una tabla de filas cortas (fecha · nombre · personas · total ·
 * cobrado) y un solo botón "Guardar todo": cada fila pasa por la
 * misma acción validada de la reserva manual (crearReservaManual) y
 * muestra su resultado al lado — las que fallan quedan marcadas y se
 * pueden corregir y reintentar sin tocar las demás.
 *
 * El "cobrado" se traduce así: si cubre el total → evento pagado; si
 * es parcial → queda como adelanto recibido; 0 → nada cobrado aún.
 * Con eso Finanzas queda cuadrado desde el día uno.
 */

type Fila = {
  fecha: string;
  nombre: string;
  personas: string;
  total: string;
  cobrado: string;
  estado: "pendiente" | "guardando" | "ok" | "error";
  error?: string;
};

const FILA_VACIA: Fila = {
  fecha: "",
  nombre: "",
  personas: "",
  total: "",
  cobrado: "",
  estado: "pendiente",
};

const inputCls =
  "w-full rounded-[8px] border border-aventurea-line bg-white px-2 py-1.5 text-[12.5px] text-aventurea-ink placeholder:text-zinc-400 focus:border-aventurea-navy focus:outline-none disabled:bg-aventurea-cream-2 disabled:text-zinc-400";

export default function CargaHistorialForm({
  onCrear,
}: {
  onCrear: (input: {
    fecha: string;
    nombre: string;
    tipo_evento: string;
    invitados: number | null;
    notas: string | null;
    montoTotal: number;
    depositoMonto: number;
    depositoRecibido: boolean;
    eventoPagado: boolean;
  }) => Promise<{ error: string | null }>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<Fila[]>([
    { ...FILA_VACIA },
    { ...FILA_VACIA },
    { ...FILA_VACIA },
  ]);
  const [guardando, setGuardando] = useState(false);

  function set(i: number, cambios: Partial<Fila>) {
    setFilas((prev) =>
      prev.map((f, j) =>
        j === i ? { ...f, ...cambios, ...(cambios.estado ? {} : { estado: "pendiente" as const, error: undefined }) } : f,
      ),
    );
  }

  function validar(f: Fila): string | null {
    if (!f.fecha) return "Falta la fecha.";
    if (!f.nombre.trim()) return "Falta el nombre.";
    const total = Number(f.total);
    if (!f.total.trim() || !Number.isFinite(total) || total <= 0) {
      return "Falta el monto total.";
    }
    const cobrado = f.cobrado.trim() ? Number(f.cobrado) : 0;
    if (!Number.isFinite(cobrado) || cobrado < 0) return "El cobrado no es válido.";
    if (cobrado > total) return "El cobrado no puede superar el total.";
    return null;
  }

  async function guardarTodo() {
    setGuardando(true);
    // Secuencial a propósito: el cupo por día se valida en el servidor
    // y dos filas de la misma fecha en paralelo se pisarían.
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      if (f.estado === "ok") continue;
      const esVacia = !f.fecha && !f.nombre.trim() && !f.total.trim();
      if (esVacia) continue;

      const invalida = validar(f);
      if (invalida) {
        set(i, { estado: "error", error: invalida });
        continue;
      }

      set(i, { estado: "guardando" });
      const total = Number(f.total);
      const cobrado = f.cobrado.trim() ? Number(f.cobrado) : 0;
      const res = await onCrear({
        fecha: f.fecha,
        nombre: f.nombre.trim(),
        tipo_evento: "",
        invitados: f.personas.trim() ? Number(f.personas) : null,
        notas: "Cargada del historial (reserva previa a Bookea).",
        montoTotal: total,
        // Cobro parcial = adelanto recibido; cobro completo = pagado.
        depositoMonto: cobrado >= total ? 0 : cobrado,
        depositoRecibido: cobrado > 0 && cobrado < total,
        eventoPagado: cobrado >= total && total > 0,
      });
      set(i, res.error ? { estado: "error", error: res.error } : { estado: "ok" });
    }
    setGuardando(false);
  }

  const guardadas = filas.filter((f) => f.estado === "ok").length;
  const conError = filas.filter((f) => f.estado === "error").length;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-fit rounded-xl border border-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
      >
        Cargar historial de reservas
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold text-aventurea-ink">
            Carga rápida del historial
          </h3>
          <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            Las fechas que ya tenías reservadas antes de Bookea, de un solo:
            fecha, quién reservó, personas, cuánto vale y cuánto te han
            pagado. Quedan confirmadas y contando en Finanzas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          Cerrar
        </button>
      </div>

      {/* Encabezados (desde sm; en el teléfono cada fila se apila). */}
      <div className="mt-4 hidden grid-cols-[130px_1fr_70px_100px_100px_28px] gap-2 px-1 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft sm:grid">
        <span>Fecha</span>
        <span>Quién reservó</span>
        <span>Personas</span>
        <span>Total ₡</span>
        <span>Cobrado ₡</span>
        <span />
      </div>

      <div className="mt-1.5 flex flex-col gap-2">
        {filas.map((f, i) => (
          <div key={i}>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-aventurea-line/70 bg-aventurea-cream-2/40 p-2 sm:grid-cols-[130px_1fr_70px_100px_100px_28px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:px-1">
              <input
                type="date"
                value={f.fecha}
                disabled={f.estado === "ok" || guardando}
                onChange={(e) => set(i, { fecha: e.target.value })}
                className={inputCls}
              />
              <input
                value={f.nombre}
                disabled={f.estado === "ok" || guardando}
                onChange={(e) => set(i, { nombre: e.target.value })}
                placeholder="Nombre del cliente"
                className={inputCls}
              />
              <input
                value={f.personas}
                disabled={f.estado === "ok" || guardando}
                onChange={(e) => set(i, { personas: e.target.value.replace(/\D/g, "") })}
                placeholder="50"
                inputMode="numeric"
                className={inputCls}
              />
              <input
                value={f.total}
                disabled={f.estado === "ok" || guardando}
                onChange={(e) => set(i, { total: e.target.value.replace(/[^\d]/g, "") })}
                placeholder="250000"
                inputMode="numeric"
                className={inputCls}
              />
              <input
                value={f.cobrado}
                disabled={f.estado === "ok" || guardando}
                onChange={(e) => set(i, { cobrado: e.target.value.replace(/[^\d]/g, "") })}
                placeholder="0"
                inputMode="numeric"
                className={inputCls}
              />
              <span className="flex items-center justify-center text-[15px]">
                {f.estado === "ok" && <span className="text-aventurea-green">✓</span>}
                {f.estado === "guardando" && (
                  <span className="text-[11px] text-aventurea-ink-soft">…</span>
                )}
                {f.estado === "error" && <span className="text-red-600">!</span>}
                {f.estado === "pendiente" && filas.length > 1 && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Quitar fila"
                    onClick={() => setFilas((prev) => prev.filter((_, j) => j !== i))}
                    className="text-zinc-400 hover:text-red-600"
                  >
                    ×
                  </button>
                )}
              </span>
            </div>
            {f.estado === "error" && f.error && (
              <p className="mt-1 px-1 text-[11.5px] font-semibold text-red-600">{f.error}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={guardando}
          onClick={() => setFilas((prev) => [...prev, { ...FILA_VACIA }])}
          className="rounded-lg border border-aventurea-line px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
        >
          + Agregar fila
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={guardarTodo}
          className="rounded-lg bg-aventurea-navy px-5 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar todo"}
        </button>
        {(guardadas > 0 || conError > 0) && (
          <span className="text-[12.5px] font-semibold text-aventurea-ink-soft">
            {guardadas > 0 && `${guardadas} guardada${guardadas === 1 ? "" : "s"} ✓`}
            {guardadas > 0 && conError > 0 && " · "}
            {conError > 0 && (
              <span className="text-red-600">{conError} con error</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
