"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";
import { PedidoDetalle } from "@/app/admin/(dashboard)/eventos/reservas-table";
import { formatearHora, mostrarHorarioReserva } from "@/app/mi-negocio/types";
import { IconBell, IconCheck, IconChevronDown } from "@/components/icons";

function fmtMoney(n: number | null) {
  return "₡" + Number(n || 0).toLocaleString("es-CR");
}

function fmtFecha(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function horarioDe(r: Reserva) {
  if (r.horario_bloque) return mostrarHorarioReserva(r.horario_bloque);
  if (r.hora_inicio) {
    const hora = formatearHora(r.hora_inicio.slice(0, 5));
    return r.duracion_horas ? `${hora} · ${r.duracion_horas} h` : hora;
  }
  return null;
}

/**
 * Las solicitudes que esperan al dueño, como tarjetas de aviso arriba
 * del calendario de la Agenda — antes vivían solo plegadas dentro de
 * "Todas tus reservas" y había que saber ir a buscarlas. Cada tarjeta
 * se expande en el lugar: datos completos, el pedido del catálogo si
 * hay, el comprobante del depósito en un modal, y Confirmar/Rechazar.
 * Confirmar dispara el correo de "reserva confirmada" al cliente
 * (confirmarReserva → notificarReservaAprobada).
 */
export default function SolicitudesPendientes({
  reservas,
  onConfirmar,
  onRechazar,
  onVerComprobante,
  onMarcarValidado,
}: {
  reservas: Reserva[];
  onConfirmar: (reservaId: string) => Promise<{ error: string | null }>;
  onRechazar: (reservaId: string) => Promise<{ error: string | null }>;
  onVerComprobante: (path: string) => Promise<{ url: string | null; error: string | null }>;
  onMarcarValidado: (reservaId: string, validado: boolean) => Promise<{ error: string | null }>;
}) {
  const [lista, setLista] = useState(reservas);
  const [abierta, setAbierta] = useState<string | null>(
    reservas.length === 1 ? reservas[0].id : null,
  );
  const [resueltas, setResueltas] = useState<Record<string, "confirmada" | "rechazada">>({});
  const [error, setError] = useState<string | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [comprobanteLoading, setComprobanteLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  if (lista.length === 0) return null;

  function resolver(reserva: Reserva, decision: "confirmada" | "rechazada") {
    setError(null);
    startTransition(async () => {
      const res = await (decision === "confirmada"
        ? onConfirmar(reserva.id)
        : onRechazar(reserva.id));
      if (res?.error) {
        setError(res.error);
        return;
      }
      // La tarjeta no desaparece de golpe: muestra el resultado y un
      // botón para descartarla — así se ve que el correo ya salió.
      setResueltas((prev) => ({ ...prev, [reserva.id]: decision }));
    });
  }

  async function verComprobante(path: string) {
    setComprobanteLoading(true);
    setError(null);
    const res = await onVerComprobante(path);
    setComprobanteLoading(false);
    if (res.url) setComprobanteUrl(res.url);
    else setError(res.error ?? "No se pudo abrir el comprobante.");
  }

  function marcarValidado(reservaId: string) {
    setError(null);
    startTransition(async () => {
      const res = await onMarcarValidado(reservaId, true);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setLista((prev) =>
        prev.map((r) => (r.id === reservaId ? { ...r, deposito_validado: true } : r)),
      );
    });
  }

  const sinResolver = lista.filter((r) => !resueltas[r.id]).length;

  return (
    <section className="rounded-2xl border border-aventurea-sky/40 bg-aventurea-sky/5 p-4 sm:p-5">
      <h2 className="titulo flex items-center gap-2 text-[18px] text-aventurea-navy">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aventurea-sky text-white">
          <IconBell className="h-4 w-4" />
        </span>
        {sinResolver === 0
          ? "Solicitudes atendidas"
          : sinResolver === 1
            ? "Tenés 1 reserva nueva esperando tu respuesta"
            : `Tenés ${sinResolver} reservas nuevas esperando tu respuesta`}
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Tocá una para revisar los datos y el comprobante — al confirmarla, el cliente
        recibe el correo de confirmación al instante.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}

      <div className="mt-3.5 flex flex-col gap-2.5">
        {lista.map((r) => {
          const decidida = resueltas[r.id];
          const expandida = abierta === r.id;
          const horario = horarioDe(r);

          if (decidida) {
            return (
              <div
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5 ${
                  decidida === "confirmada"
                    ? "border-aventurea-green/40 bg-aventurea-green-light/60"
                    : "border-aventurea-line bg-aventurea-cream-2"
                }`}
              >
                <p className="flex items-center gap-2 text-[13px] font-bold text-aventurea-ink">
                  {decidida === "confirmada" && (
                    <IconCheck className="h-4 w-4 text-aventurea-green" />
                  )}
                  {r.nombre ?? "Sin nombre"} · {fmtFecha(r.fecha)}
                  <span
                    className={`font-normal ${decidida === "confirmada" ? "text-aventurea-green" : "text-aventurea-ink-soft"}`}
                  >
                    {decidida === "confirmada"
                      ? "confirmada — le avisamos al cliente por correo"
                      : "rechazada — la fecha quedó libre"}
                  </span>
                </p>
              </div>
            );
          }

          return (
            <div
              key={r.id}
              className="overflow-hidden rounded-xl border border-aventurea-line border-l-4 border-l-aventurea-orange bg-aventurea-surface shadow-sm"
            >
              <button
                type="button"
                onClick={() => setAbierta(expandida ? null : r.id)}
                aria-expanded={expandida}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-left hover:bg-aventurea-cream-2/50"
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold text-aventurea-ink">
                    {r.nombre ?? "Sin nombre"}
                    <span className="ml-2 font-normal capitalize text-aventurea-ink-soft">
                      {fmtFecha(r.fecha)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-aventurea-ink-soft">
                    {[
                      r.tipo_evento,
                      r.invitados ? `${r.invitados} personas` : null,
                      r.monto_total ? fmtMoney(r.monto_total) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin detalles"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.deposito_comprobante_url && !r.deposito_validado && (
                    <span className="rounded-lg bg-aventurea-sky/15 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-orange">
                      Comprobante por revisar
                    </span>
                  )}
                  <IconChevronDown
                    className={`h-4 w-4 text-aventurea-ink-soft transition-transform ${expandida ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {expandida && (
                <div className="border-t border-aventurea-line px-3.5 pb-3.5 pt-3">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px] sm:grid-cols-4">
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Contacto
                      </p>
                      <p className="break-words text-aventurea-ink">
                        {[r.correo, r.whatsapp].filter(Boolean).join(" · ") ||
                          r.contacto ||
                          "—"}
                      </p>
                      {r.cedula && (
                        <p className="text-[11.5px] text-aventurea-ink-soft">
                          Cédula: {r.cedula}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Horario
                      </p>
                      <p className="text-aventurea-ink">{horario ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Total del evento
                      </p>
                      <p className="font-bold text-aventurea-ink">
                        {r.monto_total !== null ? fmtMoney(r.monto_total) : "A cotizar"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Depósito
                      </p>
                      {r.deposito_validado ? (
                        <span className="inline-flex items-center rounded-lg bg-aventurea-green/15 px-2 py-0.5 text-[11px] font-bold text-aventurea-green">
                          ✓ {fmtMoney(r.deposito_monto)}
                        </span>
                      ) : r.deposito_comprobante_url ? (
                        <span className="inline-flex items-center rounded-lg bg-aventurea-sky/15 px-2 py-0.5 text-[11px] font-bold text-aventurea-orange">
                          Por validar · {fmtMoney(r.deposito_monto)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-lg bg-aventurea-cream-2 px-2 py-0.5 text-[11px] font-bold text-zinc-500">
                          Sin comprobante
                        </span>
                      )}
                    </div>
                  </div>

                  {r.notas && (
                    <p className="mt-3 rounded-xl bg-aventurea-cream-2 p-3 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                      {r.notas}
                    </p>
                  )}

                  <PedidoDetalle detalle={r.detalle_pedido} />

                  {r.deposito_comprobante_url && (
                    <div className="mt-3 flex flex-wrap gap-4 border-t border-aventurea-line pt-3">
                      <button
                        type="button"
                        disabled={comprobanteLoading}
                        onClick={() => verComprobante(r.deposito_comprobante_url!)}
                        className="text-[12.5px] font-bold text-aventurea-ink underline disabled:opacity-50"
                      >
                        {comprobanteLoading ? "Abriendo..." : "Ver comprobante"}
                      </button>
                      {!r.deposito_validado && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => marcarValidado(r.id)}
                          className="text-[12.5px] font-bold text-aventurea-green underline disabled:opacity-50"
                        >
                          Marcar recibido
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-3.5 flex flex-wrap gap-2.5 border-t border-aventurea-line pt-3.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => resolver(r, "confirmada")}
                      className="h-11 min-w-[150px] flex-1 rounded-xl bg-aventurea-green text-[13.5px] font-bold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      Confirmar reserva
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => resolver(r, "rechazada")}
                      className="h-11 min-w-[110px] flex-1 rounded-xl border border-red-200 bg-red-50 text-[13.5px] font-bold text-red-700 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    {r.cliente_id && (
                      <Link
                        href={`/mensajes/${r.id}`}
                        className="flex h-11 items-center rounded-xl border border-aventurea-line px-4 text-[13px] font-bold text-aventurea-navy hover:border-aventurea-navy"
                      >
                        Mensajes
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {comprobanteUrl && (
        <div
          onClick={() => setComprobanteUrl(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-7"
        >
          <button
            type="button"
            onClick={() => setComprobanteUrl(null)}
            aria-label="Cerrar"
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-xl text-white hover:bg-white/20"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- visor a
              pantalla completa de un comprobante: aspect ratio propio y
              desconocido, se ve tal cual (mismo caso que el lightbox de
              galeria-lightbox.tsx) */}
          <img
            src={comprobanteUrl}
            alt="Comprobante de depósito"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] max-w-[92vw] rounded-xl shadow-2xl"
          />
        </div>
      )}
    </section>
  );
}
