"use client";

import { useMemo, useState, useActionState } from "react";
import { solicitarCotizacion, type CotizacionState } from "../cotizacion-actions";
import type { RanchoItem } from "@/app/mi-rancho/types";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

const DOW = ["D", "L", "M", "M", "J", "V", "S"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fmtColones(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

/**
 * Reserva en línea para servicios (todo lo que no es Lugares): elegís
 * la fecha en el calendario, armás tu pedido con el catálogo del
 * proveedor y la solicitud abre un chat con el resumen ya escrito.
 *
 * A diferencia de los Lugares, acá las fechas no se bloquean entre sí:
 * un catering puede atender más de un evento el mismo día, así que el
 * calendario solo bloquea el pasado y la anticipación mínima que el
 * proveedor pida.
 */
export default function ReservaServicio({
  ranchoId,
  items,
  anticipacionDias,
  etiquetaCatalogo,
}: {
  ranchoId: string;
  items: RanchoItem[];
  anticipacionDias: number;
  etiquetaCatalogo: string;
}) {
  const accion = solicitarCotizacion.bind(null, ranchoId);
  const [state, formAction, pending] = useActionState<CotizacionState, FormData>(
    accion,
    undefined,
  );

  const hoy = useMemo(() => new Date(), []);
  const [mesOffset, setMesOffset] = useState(0);
  const [fecha, setFecha] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  // Primer día habilitado: hoy + anticipación del proveedor.
  const minima = useMemo(() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + Math.max(0, anticipacionDias));
    return iso(d.getFullYear(), d.getMonth(), d.getDate());
  }, [hoy, anticipacionDias]);

  const vista = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const anio = vista.getFullYear();
  const mes = vista.getMonth();
  const primerDow = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  const celdas: (number | null)[] = [
    ...Array.from({ length: primerDow }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  function cambiarCantidad(id: string, delta: number) {
    setCantidades((prev) => {
      const nueva = Math.max(0, Math.min(999, (prev[id] ?? 0) + delta));
      const copia = { ...prev };
      if (nueva === 0) delete copia[id];
      else copia[id] = nueva;
      return copia;
    });
  }

  const totalEstimado = items.reduce((s, i) => {
    const c = cantidades[i.id] ?? 0;
    return i.precio !== null ? s + i.precio * c : s;
  }, 0);
  const seleccionados = Object.values(cantidades).reduce((s, c) => s + c, 0);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* ---------- Paso 1: la fecha ---------- */}
      <div>
        <p className={labelCls}>1 · Elegí la fecha de tu evento</p>
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMesOffset((v) => v - 1)}
              disabled={mesOffset === 0}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink disabled:opacity-30"
            >
              ←
            </button>
            <p className="text-[14px] font-bold text-aventurea-ink">
              {MESES[mes]} {anio}
            </p>
            <button
              type="button"
              onClick={() => setMesOffset((v) => v + 1)}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DOW.map((d, i) => (
              <span key={i} className="py-1 text-[10.5px] font-bold uppercase text-zinc-500">
                {d}
              </span>
            ))}
            {celdas.map((dia, i) => {
              if (dia === null) return <span key={`v-${i}`} />;
              const valor = iso(anio, mes, dia);
              const deshabilitado = valor < minima;
              const activo = fecha === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  disabled={deshabilitado}
                  onClick={() => setFecha(valor)}
                  aria-pressed={activo}
                  className={`aspect-square rounded-lg text-[13px] font-bold transition-colors ${
                    activo
                      ? "bg-aventurea-navy text-white"
                      : deshabilitado
                        ? "text-zinc-300"
                        : "text-aventurea-ink hover:bg-aventurea-cream-2"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          {anticipacionDias > 0 && (
            <p className="mt-2 text-[11.5px] text-zinc-500">
              Este proveedor pide al menos {anticipacionDias} día
              {anticipacionDias === 1 ? "" : "s"} de anticipación.
            </p>
          )}
        </div>
        {fecha && (
          <p className="mt-2 text-[12.5px] font-bold text-aventurea-navy">
            Fecha elegida: {fecha}
          </p>
        )}
      </div>

      <input type="hidden" name="fecha" value={fecha ?? ""} />
      <input type="hidden" name="pedido" value={JSON.stringify(cantidades)} />

      {/* ---------- Paso 2: el pedido (solo si hay catálogo) ---------- */}
      {items.length > 0 && (
        <div>
          <p className={labelCls}>
            2 · Armá tu pedido del {etiquetaCatalogo.toLowerCase()} (opcional)
          </p>
          <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
            {items.map((item) => {
              const cantidad = cantidades[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-aventurea-line px-4 py-3 last:border-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-aventurea-ink">{item.nombre}</p>
                    {item.descripcion && (
                      <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
                        {item.descripcion}
                      </p>
                    )}
                    <p className="mt-0.5 text-[12.5px] font-bold text-aventurea-navy">
                      {item.precio !== null
                        ? `${fmtColones(item.precio)}${item.unidad ? ` ${item.unidad}` : ""}`
                        : "A cotizar"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.id, -1)}
                      disabled={cantidad === 0}
                      aria-label={`Quitar ${item.nombre}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-aventurea-line text-aventurea-ink disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-[14px] font-bold text-aventurea-ink">
                      {cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.id, 1)}
                      aria-label={`Agregar ${item.nombre}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-aventurea-navy text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {seleccionados > 0 && (
            <p className="mt-2 text-[13px] font-bold text-aventurea-ink">
              {seleccionados} ítem{seleccionados === 1 ? "" : "s"} elegido
              {seleccionados === 1 ? "" : "s"}
              {totalEstimado > 0 && (
                <>
                  {" "}
                  · Total estimado:{" "}
                  <span className="text-aventurea-navy">{fmtColones(totalEstimado)}</span>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {/* ---------- Paso 3: los datos ---------- */}
      <div>
        <p className={labelCls}>
          {items.length > 0 ? "3" : "2"} · Contanos de tu evento
        </p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Cantidad de invitados (opcional)</label>
            <input type="number" name="invitados" min={1} placeholder="Ej. 80" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tipo de evento (opcional)</label>
            <input
              type="text"
              name="tipo_evento"
              placeholder="Ej. Cumpleaños, boda, corporativo..."
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notas para el proveedor (opcional)</label>
            <textarea
              name="notas"
              rows={3}
              placeholder="Ej. El evento es en Santa Ana, al aire libre. ¿Tenés opción vegetariana?"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error}</p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending || !fecha}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-aventurea-navy px-6 text-sm font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-60 sm:w-fit"
        >
          {pending
            ? "Enviando..."
            : fecha
              ? "Enviar solicitud de reserva"
              : "Elegí una fecha para continuar"}
        </button>
        <p className="mt-2 text-[12px] text-aventurea-ink-soft">
          Al enviar se abre un chat con el proveedor, con tu pedido ya detallado
          — ahí mismo te confirma disponibilidad y precio final.
        </p>
      </div>
    </form>
  );
}
