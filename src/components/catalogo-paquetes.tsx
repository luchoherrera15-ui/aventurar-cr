"use client";

import type { RanchoItem } from "@/app/mi-rancho/types";
import { agruparPorSeccion, cupoRestante, etiquetaDuracion } from "@/lib/catalogo";

/**
 * El catálogo como lo ve el cliente: paquetes con foto para elegir
 * ("Estación 1 · 5 horas · ₡85.000 · Queda 1") y productos por
 * cantidad con contador. Genérico a propósito — hoy lo usa el flujo
 * de servicios, y está pensado para servirle también a los servicios
 * adicionales de los Lugares más adelante.
 */

function fmtColones(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

function Contador({
  valor,
  min,
  max,
  onCambiar,
}: {
  valor: number;
  min: number;
  max: number | null;
  onCambiar: (v: number) => void;
}) {
  // Al activar un ítem se salta directo a su mínimo por reserva; al
  // bajar del mínimo se apaga (0). Así "mínimo 30 porciones" no obliga
  // a apretar + treinta veces.
  const bajar = () => onCambiar(valor <= min ? 0 : valor - 1);
  const subir = () =>
    onCambiar(valor === 0 ? min : max !== null && valor >= max ? valor : valor + 1);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={bajar}
        disabled={valor === 0}
        aria-label="Quitar"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-aventurea-line bg-aventurea-cream-2 text-[15px] font-bold text-aventurea-ink disabled:opacity-30"
      >
        −
      </button>
      <span className="w-7 text-center text-[14px] font-bold text-aventurea-ink">
        {valor}
      </span>
      <button
        type="button"
        onClick={subir}
        disabled={max !== null && valor >= max}
        aria-label="Agregar"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-aventurea-line bg-aventurea-cream-2 text-[15px] font-bold text-aventurea-ink disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

export default function CatalogoPaquetes({
  items,
  cantidades,
  reservadasPorItem,
  hayFecha,
  onCambiar,
  eleccionesPorGrupo,
  elegidos,
  onElegir,
}: {
  items: RanchoItem[];
  cantidades: Record<string, number>;
  /** item_id → unidades ya reservadas para la fecha elegida. */
  reservadasPorItem: Record<string, number>;
  /** Sin fecha elegida no se muestra "Queda N" (no hay contra qué). */
  hayFecha: boolean;
  onCambiar: (itemId: string, cantidad: number) => void;
  /** Sección → cuántos ítems van INCLUIDOS en la tarifa ("elegí hasta
   *  N sin costo", detalles.elecciones_incluidas). Los ítems de esas
   *  secciones se marcan con un toggle y no suman al total. */
  eleccionesPorGrupo?: Record<string, number>;
  /** item_id → elegido como incluido (solo secciones con elección). */
  elegidos?: Record<string, boolean>;
  onElegir?: (itemId: string, elegido: boolean) => void;
}) {
  const secciones = agruparPorSeccion(items.filter((i) => i.activo));

  return (
    <div className="flex flex-col gap-5">
      {secciones.map(({ grupo, items: delGrupo }) => {
        const topeEleccion =
          grupo && onElegir ? (eleccionesPorGrupo?.[grupo] ?? 0) : 0;
        const esEleccion = topeEleccion > 0;
        const marcados = esEleccion
          ? delGrupo.filter((i) => elegidos?.[i.id]).length
          : 0;
        return (
        <div key={grupo ?? "__sin_grupo__"}>
          {grupo && (
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              {grupo}
            </p>
          )}
          {esEleccion && (
            <p className="mb-2 text-[12px] font-bold text-aventurea-green">
              Incluido en tu tarifa — elegí hasta {topeEleccion} sin costo (
              {marcados}/{topeEleccion})
            </p>
          )}
          <div className="flex flex-col gap-3">
            {delGrupo.map((item) => {
              // Sección "incluida": nada de contadores ni precios — un
              // toggle para marcar la elección, con tope N por sección.
              if (esEleccion) {
                const marcado = !!elegidos?.[item.id];
                const bloqueado = !marcado && marcados >= topeEleccion;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={bloqueado}
                    onClick={() => onElegir!(item.id, !marcado)}
                    aria-pressed={marcado}
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                      marcado
                        ? "border-aventurea-green bg-aventurea-green/5"
                        : bloqueado
                          ? "border-aventurea-line opacity-50"
                          : "border-aventurea-line bg-aventurea-surface hover:border-aventurea-green"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold text-aventurea-ink">
                        {item.nombre}
                      </p>
                      {item.descripcion && (
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-aventurea-ink-soft">
                          {item.descripcion}
                        </p>
                      )}
                      <p className="mt-0.5 text-[12px] font-bold text-aventurea-green">
                        Incluido en tu tarifa
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-bold ${
                        marcado
                          ? "bg-aventurea-green text-white"
                          : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink"
                      }`}
                    >
                      {marcado ? "Elegido ✓" : "Elegir"}
                    </span>
                  </button>
                );
              }
              const restante = hayFecha
                ? cupoRestante(item, reservadasPorItem[item.id] ?? 0)
                : null;
              const agotado = restante !== null && restante <= 0;
              const cantidad = cantidades[item.id] ?? 0;
              // El tope efectivo por pedido: el máximo del proveedor y
              // lo que quede del día, lo que sea menor.
              const topes = [item.max_por_reserva, restante].filter(
                (v): v is number => v !== null,
              );
              const topeEfectivo = topes.length > 0 ? Math.min(...topes) : null;
              const duracion = etiquetaDuracion(item.duracion_horas);

              if (item.tipo === "paquete") {
                const elegido = cantidad > 0;
                return (
                  <div
                    key={item.id}
                    className={`overflow-hidden rounded-2xl border transition-colors ${
                      agotado
                        ? "border-aventurea-line opacity-50"
                        : elegido
                          ? "border-aventurea-orange bg-aventurea-orange/5"
                          : "border-aventurea-line bg-aventurea-surface"
                    }`}
                  >
                    <div className="flex gap-3 p-3">
                      {item.foto_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.foto_url}
                          alt={item.nombre}
                          className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-bold text-aventurea-ink">
                          {item.nombre}
                        </p>
                        {item.descripcion && (
                          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                            {item.descripcion}
                          </p>
                        )}
                        <p className="mt-1 text-[13.5px] font-bold text-aventurea-navy">
                          {item.precio !== null ? fmtColones(item.precio) : "A cotizar"}
                          {duracion && (
                            <span className="font-normal text-aventurea-ink-soft">
                              {" "}
                              · {duracion}
                            </span>
                          )}
                          {item.es_paquete_base === true && (
                            <span className="font-normal text-aventurea-ink-soft">
                              {" "}
                              · sustituye la tarifa base
                            </span>
                          )}
                        </p>
                        {restante !== null && !agotado && (
                          <p className="mt-0.5 text-[11.5px] font-bold text-aventurea-orange">
                            {restante === 1
                              ? "Queda 1 para esta fecha"
                              : `Quedan ${restante} para esta fecha`}
                          </p>
                        )}
                        {agotado && (
                          <p className="mt-0.5 text-[11.5px] font-bold text-zinc-500">
                            Agotado para esta fecha
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center">
                        {agotado ? null : topeEfectivo !== null &&
                          topeEfectivo <= 1 &&
                          item.min_por_reserva <= 1 ? (
                          <button
                            type="button"
                            onClick={() => onCambiar(item.id, elegido ? 0 : 1)}
                            className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors ${
                              elegido
                                ? "bg-aventurea-orange text-white"
                                : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink hover:border-aventurea-orange"
                            }`}
                          >
                            {elegido ? "Elegido ✓" : "Elegir"}
                          </button>
                        ) : (
                          <Contador
                            valor={cantidad}
                            min={item.min_por_reserva}
                            max={topeEfectivo}
                            onCambiar={(v) => onCambiar(item.id, v)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Producto: fila compacta con contador.
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface px-3.5 py-3 ${
                    agotado ? "opacity-50" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-aventurea-ink">
                      {item.nombre}
                    </p>
                    {item.descripcion && (
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-aventurea-ink-soft">
                        {item.descripcion}
                      </p>
                    )}
                    <p className="mt-0.5 text-[12.5px] font-bold text-aventurea-navy">
                      {item.precio !== null ? fmtColones(item.precio) : "A cotizar"}
                      {item.precio !== null && item.unidad && (
                        <span className="font-normal text-aventurea-ink-soft">
                          {" "}
                          {item.unidad}
                        </span>
                      )}
                      {item.min_por_reserva > 1 && (
                        <span className="font-normal text-aventurea-ink-soft">
                          {" "}
                          · mínimo {item.min_por_reserva}
                        </span>
                      )}
                    </p>
                    {agotado && (
                      <p className="mt-0.5 text-[11.5px] font-bold text-zinc-500">
                        Agotado para esta fecha
                      </p>
                    )}
                  </div>
                  {!agotado && (
                    <Contador
                      valor={cantidad}
                      min={item.min_por_reserva}
                      max={topeEfectivo}
                      onCambiar={(v) => onCambiar(item.id, v)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}
