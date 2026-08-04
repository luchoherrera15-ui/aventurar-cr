"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  marcarDepositoValidado,
  obtenerUrlComprobante,
  setEstadoReserva,
} from "./actions";
import type { DetallePedido, Reserva } from "./types";
import { formatearHora, mostrarHorarioReserva } from "@/app/mi-negocio/types";

const ESTADO_LABEL: Record<Reserva["estado"], string> = {
  pendiente: "En aprobación",
  confirmada: "Reservada",
  rechazada: "Rechazada",
  bloqueada: "Bloqueada",
};

const ESTADO_BADGE: Record<Reserva["estado"], string> = {
  pendiente: "bg-aventurea-orange/15 text-aventurea-orange",
  confirmada: "bg-aventurea-navy text-white",
  rechazada: "bg-aventurea-cream-2 text-aventurea-ink-soft",
  bloqueada: "bg-aventurea-cream-2 text-aventurea-ink",
};

function fmtMoney(n: number | null) {
  return "₡" + Number(n || 0).toLocaleString("es-CR");
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "5 jun 2026" o "5 jun 2026 → 7 jun 2026" si es un alquiler multi-día. */
function fmtRango(r: Reserva) {
  return r.fecha_fin && r.fecha_fin > r.fecha
    ? `${fmtDate(r.fecha)} → ${fmtDate(r.fecha_fin)}`
    : fmtDate(r.fecha);
}

/**
 * El horario de la reserva: los Lugares guardan el bloque elegido
 * (horario_bloque); los servicios guardan hora_inicio + duración
 * desde 0067. Sin ninguno de los dos: "—".
 */
function horarioDeReserva(r: Reserva) {
  if (r.horario_bloque) return mostrarHorarioReserva(r.horario_bloque);
  if (r.hora_inicio) {
    const hora = formatearHora(r.hora_inicio.slice(0, 5));
    return r.duracion_horas
      ? `${hora} · ${r.duracion_horas} h`
      : hora;
  }
  return "—";
}

/**
 * El pedido que el cliente armó desde el catálogo (solo servicios).
 * Hasta ahora este dato se guardaba pero no se mostraba en ningún
 * lado: el proveedor lo veía únicamente como texto dentro del chat.
 */
function PedidoDetalle({
  detalle,
  compacto,
}: {
  detalle: DetallePedido | null;
  compacto?: boolean;
}) {
  if (!detalle || !Array.isArray(detalle.items) || detalle.items.length === 0) return null;
  return (
    <div className={compacto ? "" : "mt-3 border-t border-aventurea-line pt-3"}>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        Pedido
      </div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {detalle.items.map((linea) => (
          <li
            key={linea.item_id}
            className="flex items-baseline justify-between gap-3 text-[12.5px] text-aventurea-ink"
          >
            <span>
              <span className="font-bold">{linea.cantidad}×</span> {linea.nombre}
            </span>
            <span className="shrink-0 text-aventurea-ink-soft">
              {linea.precio !== null
                ? fmtMoney(linea.precio * linea.cantidad)
                : "A cotizar"}
            </span>
          </li>
        ))}
      </ul>
      {detalle.total_estimado !== null && (
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-aventurea-line pt-1 text-[12.5px] font-bold text-aventurea-ink">
          <span>Total del pedido</span>
          <span>{fmtMoney(detalle.total_estimado)}</span>
        </div>
      )}
    </div>
  );
}

const MOSTRAR_INICIAL = 5;

/** Acento por estado — el mismo lenguaje azul/naranja del resto del
 *  panel: confirmada es la de fiar (azul), pendiente es la que pide
 *  acción (naranja). */
const ACENTO_ESTADO: Record<Reserva["estado"], string> = {
  confirmada: "border-aventurea-blue",
  pendiente: "border-aventurea-orange",
  rechazada: "border-aventurea-line",
  bloqueada: "border-aventurea-line",
};

export default function ReservasTable({
  initialReservas,
  nombrePorRancho,
  mostrarMensajes,
  variante = "tabla",
}: {
  initialReservas: Reserva[];
  nombrePorRancho?: Map<string, string>;
  /** Solo tiene sentido desde el panel del propio proveedor: el admin
   *  no es parte de la conversación con el cliente. */
  mostrarMensajes?: boolean;
  /** "cards": grilla de tarjetas en todos los tamaños, con las
   *  primeras 5 y un botón para ver el resto — el panel del propio
   *  negocio. "tabla" (default): tabla ancha en desktop + tarjetas
   *  solo en celular, sin paginar — el panel de admin, sin tocar. */
  variante?: "tabla" | "cards";
}) {
  const [reservas, setReservas] = useState(initialReservas);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [verTodas, setVerTodas] = useState(false);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [comprobanteLoading, setComprobanteLoading] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservas
      .filter((r) => (!q ? true : (r.nombre ?? "").toLowerCase().includes(q)))
      .filter((r) => filtro === "todas" || r.estado === filtro)
      // En "cards" (panel del propio negocio), "Todos los estados" no
      // mete las rechazadas de una vez — quien las quiera ver las busca
      // filtrando por "Rechazada" a propósito. El admin ("tabla") sigue
      // viendo todo junto, sin este filtro extra.
      .filter((r) => variante !== "cards" || filtro === "rechazada" || r.estado !== "rechazada")
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [reservas, query, filtro, variante]);

  const visibles =
    variante === "cards" && !verTodas ? list.slice(0, MOSTRAR_INICIAL) : list;

  function cambiarEstado(id: string, estado: Reserva["estado"]) {
    setActionError(null);
    startTransition(async () => {
      const res = await setEstadoReserva(id, estado);
      if (res?.error) {
        // El servidor ya distingue "la fecha está llena" (mensaje del
        // disparador del cupo, en español) de cualquier otro fallo —
        // acá no se inventa nada por encima.
        setActionError(res.error);
        return;
      }
      setReservas((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado } : r)),
      );
    });
  }

  async function verComprobante(path: string) {
    setComprobanteLoading(true);
    setActionError(null);
    const res = await obtenerUrlComprobante(path);
    setComprobanteLoading(false);
    if (res.url) {
      setComprobanteUrl(res.url);
    } else {
      setActionError(res.error ?? "No se pudo abrir el comprobante.");
    }
  }

  function marcarValidado(id: string) {
    setActionError(null);
    startTransition(async () => {
      const res = await marcarDepositoValidado(id, true);
      if (res?.error) {
        setActionError(res.error);
        return;
      }
      setReservas((prev) =>
        prev.map((r) => (r.id === id ? { ...r, deposito_validado: true } : r)),
      );
    });
  }

  return (
    <div>
      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          <input
            type="search"
            placeholder="Buscar cliente..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:zinc-500"
          />
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
          >
            <option value="todas">Todos los estados</option>
            <option value="pendiente">En aprobación</option>
            <option value="confirmada">Reservada</option>
            <option value="rechazada">Rechazada</option>
            <option value="bloqueada">Bloqueada</option>
          </select>
        </div>
      </div>

      {actionError && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {actionError}
        </p>
      )}

      {/* En "tabla" (admin), cards apiladas SOLO en pantallas chicas — la
          tabla ancha obligaba a hacer scroll horizontal justo donde la
          mayoría aprueba o rechaza reservas desde el celular. En "cards"
          (panel del propio negocio) es la única vista, en todos los
          tamaños, paginada de a 5. */}
      <div
        className={
          variante === "cards"
            ? "grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3"
            : "flex flex-col gap-3 sm:hidden"
        }
      >
        {list.length === 0 && (
          <div className="col-span-full rounded-2xl border border-aventurea-line bg-aventurea-surface p-8 text-center text-[13.5px] text-zinc-500">
            No hay reservas que coincidan con la búsqueda.
          </div>
        )}
        {visibles.map((r) => {
          // Con correo + WhatsApp + cédula + comprobante, la tarjeta
          // angosta se volvía carrilera de larga. Esas mismas ocupan 2
          // columnas para que el contenido de más fluya al costado en
          // vez de apilarse hacia abajo.
          const esDetallada = Boolean(r.correo || r.whatsapp || r.cedula || r.deposito_comprobante_url);
          return (
          <div
            key={r.id}
            className={`rounded-2xl border border-aventurea-line border-l-4 bg-aventurea-surface p-4 shadow-sm ${ACENTO_ESTADO[r.estado]} ${esDetallada ? "sm:col-span-2" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-bold text-aventurea-ink">
                  {fmtRango(r)}
                </div>
                {nombrePorRancho && (
                  <div className="text-[12px] text-aventurea-ink-soft">
                    {(r.rancho_id && nombrePorRancho.get(r.rancho_id)) ?? "—"}
                  </div>
                )}
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-[11px] font-bold ${ESTADO_BADGE[r.estado]}`}
              >
                {ESTADO_LABEL[r.estado]}
              </span>
            </div>

            <div className="mt-3 border-t border-aventurea-line pt-3">
              <div className="font-bold text-aventurea-ink">{r.nombre}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {r.correo || r.whatsapp ? (
                  <>
                    {r.correo && <div className="text-xs text-zinc-500">{r.correo}</div>}
                    {r.whatsapp && <div className="text-xs text-zinc-500">{r.whatsapp}</div>}
                  </>
                ) : (
                  <div className="text-xs text-zinc-500">{r.contacto}</div>
                )}
                {r.cedula && (
                  <div className="text-xs text-zinc-500">Cédula: {r.cedula}</div>
                )}
              </div>
            </div>

            <div
              className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-aventurea-line pt-3 text-[13px] ${esDetallada ? "sm:grid-cols-4" : ""}`}
            >
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Evento
                </div>
                <div className="text-aventurea-ink">{r.tipo_evento || "—"}</div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Horario
                </div>
                <div className="text-aventurea-ink">{horarioDeReserva(r)}</div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Invitados
                </div>
                <div className="text-aventurea-ink">{r.invitados ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Depósito
                </div>
                {r.deposito_validado ? (
                  <span className="inline-flex items-center rounded-lg bg-aventurea-green/15 px-2 py-0.5 text-[11px] font-bold text-aventurea-green">
                    ✓ {fmtMoney(r.deposito_monto)}
                  </span>
                ) : r.deposito_comprobante_url ? (
                  <span className="inline-flex items-center rounded-lg bg-aventurea-orange/15 px-2 py-0.5 text-[11px] font-bold text-aventurea-orange">
                    Por validar
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-lg bg-aventurea-cream-2 px-2 py-0.5 text-[11px] font-bold text-zinc-500">
                    Sin comprobante
                  </span>
                )}
              </div>
            </div>

            <PedidoDetalle detalle={r.detalle_pedido} />

            {r.deposito_comprobante_url && (
              <div className="mt-3 flex gap-4 border-t border-aventurea-line pt-3">
                <button
                  disabled={comprobanteLoading}
                  onClick={() => verComprobante(r.deposito_comprobante_url!)}
                  className="text-[12.5px] font-bold text-aventurea-ink underline disabled:opacity-50"
                >
                  Ver comprobante
                </button>
                {!r.deposito_validado && (
                  <button
                    disabled={pending}
                    onClick={() => marcarValidado(r.id)}
                    className="text-[12.5px] font-bold text-aventurea-green underline disabled:opacity-50"
                  >
                    Marcar validado
                  </button>
                )}
              </div>
            )}

            {r.estado === "pendiente" && (
              <div className="mt-3.5 flex gap-2.5 border-t border-aventurea-line pt-3.5">
                <button
                  disabled={pending}
                  onClick={() => cambiarEstado(r.id, "confirmada")}
                  className="h-11 flex-1 rounded-xl bg-aventurea-green text-[13.5px] font-bold text-white disabled:opacity-50"
                >
                  Aprobar
                </button>
                <button
                  disabled={pending}
                  onClick={() => cambiarEstado(r.id, "rechazada")}
                  className="h-11 flex-1 rounded-xl border border-red-200 bg-red-50 text-[13.5px] font-bold text-red-700 disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
            )}

            {mostrarMensajes && r.cliente_id && (
              <Link
                href={`/mensajes/${r.id}`}
                className="mt-3.5 flex h-10 items-center justify-center rounded-xl border border-aventurea-line bg-aventurea-cream-2 text-[12.5px] font-bold text-aventurea-navy hover:border-aventurea-navy"
              >
                Mensajes
              </Link>
            )}
          </div>
          );
        })}
      </div>

      {variante === "cards" && list.length > MOSTRAR_INICIAL && (
        <button
          type="button"
          onClick={() => setVerTodas((v) => !v)}
          className="mt-4 flex w-full items-center justify-center rounded-xl border border-aventurea-line bg-aventurea-surface py-2.5 text-[13px] font-bold text-aventurea-navy hover:border-aventurea-navy sm:w-auto sm:px-6"
        >
          {verTodas ? "Ver menos" : `Ver las ${list.length - MOSTRAR_INICIAL} restantes`}
        </button>
      )}

      {variante !== "cards" && (
      <div className="hidden overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-aventurea-cream-2/60">
              {[
                "Fecha",
                ...(nombrePorRancho ? ["Rancho"] : []),
                "Cliente",
                "Evento",
                "Horario",
                "Invitados",
                "Estado",
                "Depósito",
                "Acciones",
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-aventurea-line px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={nombrePorRancho ? 9 : 8}
                  className="px-4 py-10 text-center text-[13.5px] text-zinc-500"
                >
                  No hay reservas que coincidan con la búsqueda.
                </td>
              </tr>
            )}
            {list.map((r) => (
              <Fragment key={r.id}>
              <tr className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40">
                <td className="px-4 py-3.5 text-[13.5px] text-aventurea-ink-soft">{fmtRango(r)}</td>
                {nombrePorRancho && (
                  <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                    {(r.rancho_id && nombrePorRancho.get(r.rancho_id)) ?? "—"}
                  </td>
                )}
                <td className="px-4 py-3.5">
                  <div className="font-bold text-aventurea-ink">{r.nombre}</div>
                  {r.correo || r.whatsapp ? (
                    <>
                      {r.correo && <div className="text-xs text-zinc-500">{r.correo}</div>}
                      {r.whatsapp && <div className="text-xs text-zinc-500">{r.whatsapp}</div>}
                    </>
                  ) : (
                    // Reservas de antes de separar correo y WhatsApp.
                    <div className="text-xs text-zinc-500">{r.contacto}</div>
                  )}
                  {r.cedula && (
                    <div className="text-xs text-zinc-500">Cédula: {r.cedula}</div>
                  )}
                </td>
                <td className="px-4 py-3.5 text-[13.5px] text-aventurea-ink-soft">{r.tipo_evento}</td>
                <td className="px-4 py-3.5 text-[13.5px] text-aventurea-ink-soft">
                  {horarioDeReserva(r)}
                </td>
                <td className="px-4 py-3.5 text-[13.5px] text-aventurea-ink-soft">{r.invitados ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold ${ESTADO_BADGE[r.estado]}`}
                  >
                    {ESTADO_LABEL[r.estado]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col items-start gap-1">
                    {r.deposito_validado ? (
                      <span className="inline-flex items-center rounded-lg bg-aventurea-green/15 px-2.5 py-1 text-[11px] font-bold text-aventurea-green">
                        ✓ Validado · {fmtMoney(r.deposito_monto)}
                      </span>
                    ) : r.deposito_comprobante_url ? (
                      <span className="inline-flex items-center rounded-lg bg-aventurea-orange/15 px-2.5 py-1 text-[11px] font-bold text-aventurea-orange">
                        Por validar · {fmtMoney(r.deposito_monto)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-aventurea-cream-2 px-2.5 py-1 text-[11px] font-bold text-zinc-500">
                        Sin comprobante
                      </span>
                    )}
                    {r.deposito_comprobante_url && (
                      <div className="flex gap-2.5">
                        <button
                          disabled={comprobanteLoading}
                          onClick={() => verComprobante(r.deposito_comprobante_url!)}
                          className="text-[11px] font-bold text-aventurea-ink underline hover:text-aventurea-orange disabled:opacity-50"
                        >
                          Ver comprobante
                        </button>
                        {!r.deposito_validado && (
                          <button
                            disabled={pending}
                            onClick={() => marcarValidado(r.id)}
                            className="text-[11px] font-bold text-aventurea-green underline hover:text-aventurea-ink disabled:opacity-50"
                          >
                            Marcar validado
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {r.estado === "pendiente" && (
                      <>
                        <button
                          disabled={pending}
                          onClick={() => cambiarEstado(r.id, "confirmada")}
                          className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-green hover:border-aventurea-green disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => cambiarEstado(r.id, "rechazada")}
                          className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-red-700 hover:border-red-400 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {mostrarMensajes && r.cliente_id && (
                      <Link
                        href={`/mensajes/${r.id}`}
                        className="flex h-[30px] items-center rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-navy hover:border-aventurea-navy"
                      >
                        Mensajes
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
              {r.detalle_pedido && Array.isArray(r.detalle_pedido.items) && r.detalle_pedido.items.length > 0 && (
                <tr className="border-b border-aventurea-line last:border-none">
                  <td colSpan={nombrePorRancho ? 9 : 8} className="bg-aventurea-cream-2/30 px-4 py-2.5">
                    <PedidoDetalle detalle={r.detalle_pedido} compacto />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {comprobanteUrl && (
        <div
          onClick={() => setComprobanteUrl(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-7"
        >
          <button
            onClick={() => setComprobanteUrl(null)}
            aria-label="Cerrar"
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-xl text-white hover:bg-white/20"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comprobanteUrl}
            alt="Comprobante de depósito"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] max-w-[92vw] rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
