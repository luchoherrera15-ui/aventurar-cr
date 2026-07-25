"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { crearSolicitudReserva } from "./actions";
import type { DiaDisponibilidad, PrecioTier, ServicioAdicional } from "./types";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function fmtColones(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

export default function BookingCalendar({
  disponibilidad,
  tiers,
  servicios,
  tarifaDiciembre,
}: {
  disponibilidad: Record<string, DiaDisponibilidad>;
  tiers: PrecioTier[];
  servicios: ServicioAdicional[];
  tarifaDiciembre: number;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [dias, setDias] = useState(disponibilidad);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [invitados, setInvitados] = useState("");
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);
  const esDiciembre = selectedDateObj?.getMonth() === 11;

  const invitadosNum = parseInt(invitados) || 0;

  const tierBase = useMemo(() => {
    if (!invitadosNum) return null;
    if (esDiciembre) return invitadosNum * tarifaDiciembre;
    const tier = tiers.find(
      (t) => invitadosNum >= t.min_invitados && invitadosNum <= t.max_invitados,
    );
    return tier ? tier.precio : null;
  }, [invitadosNum, esDiciembre, tiers, tarifaDiciembre]);

  const addonsTotal = useMemo(() => {
    return servicios.reduce((acc, s) => {
      const eligible = !s.requisito_max_invitados || invitadosNum <= s.requisito_max_invitados;
      return acc + (eligible && addons[s.id] ? s.precio : 0);
    }, 0);
  }, [servicios, addons, invitadosNum]);

  const total = tierBase === null ? null : tierBase + addonsTotal;

  function cambiarMes(dir: number) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function elegirFecha(fecha: string) {
    setSelectedDate(fecha);
    setConfirmado(false);
    setSubmitError(null);
  }

  function limpiarSeleccion() {
    setSelectedDate(null);
    setConfirmado(false);
    setInvitados("");
    setAddons({});
    setNombre("");
    setContacto("");
    setTipoEvento("");
    setMensaje("");
    setMetodoPago("");
    setComprobante(null);
    setComprobantePreview(null);
    setSubmitError(null);
  }

  function onComprobanteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setComprobante(file);
    if (file) setComprobantePreview(URL.createObjectURL(file));
  }

  async function enviarSolicitud(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !comprobante || total === null) return;
    setSubmitting(true);
    setSubmitError(null);

    const supabase = createClient();
    const path = `${selectedDate}/${Date.now()}-${comprobante.name}`;
    const { error: uploadError } = await supabase.storage
      .from("comprobantes")
      .upload(path, comprobante);

    if (uploadError) {
      setSubmitError("No se pudo subir el comprobante: " + uploadError.message);
      setSubmitting(false);
      return;
    }

    const res = await crearSolicitudReserva({
      fecha: selectedDate,
      nombre,
      contacto,
      tipo_evento: tipoEvento,
      invitados: invitadosNum,
      deposito_monto: total,
      metodo_pago: metodoPago as "sinpe" | "transferencia",
      deposito_comprobante_url: path,
      notas: mensaje || null,
    });

    setSubmitting(false);

    if (res.error) {
      setSubmitError(res.error);
      return;
    }

    setDias((prev) => {
      const dia = prev[selectedDate] ?? { confirmada: false, pendientes: 0 };
      return { ...prev, [selectedDate]: { ...dia, pendientes: dia.pendientes + 1 } };
    });
    setConfirmado(true);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const inputCls =
    "w-full rounded-[10px] border border-white/10 bg-zinc-800 px-3 py-2.5 text-[13.5px] text-white placeholder:text-zinc-500";
  const labelCls =
    "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-zinc-400";

  return (
    <section id="reservar" className="py-9 pb-16">
      <div className="mx-auto max-w-[1080px] px-7">
        <div className="mb-6.5 max-w-[640px]">
          <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
            Aventurea CR · Rancho de Eventos
          </p>
          <h1 className="mt-2.5 text-[28px] font-bold text-white sm:text-[32px]">
            Reserva tu fecha
          </h1>
          <p className="mt-2.5 text-[14.5px] text-zinc-400">
            Elegí un día en el calendario. Te mostramos el precio al instante
            y enviás tu solicitud — queda pendiente hasta que la confirmemos.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          {/* Calendario */}
          <div className="rounded-[18px] border border-white/10 bg-zinc-900 p-5.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-bold capitalize text-white">
                {MESES[viewMonth]} {viewYear}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => cambiarMes(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white hover:border-aventurea-orange hover:text-aventurea-orange"
                >
                  ‹
                </button>
                <button
                  onClick={() => cambiarMes(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white hover:border-aventurea-orange hover:text-aventurea-orange"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="mt-4.5 grid grid-cols-7 gap-1.5">
              {DOW.map((d, i) => (
                <div
                  key={i}
                  className="pb-1 text-center text-[10.5px] font-bold uppercase tracking-wide text-zinc-500"
                >
                  {d}
                </div>
              ))}
              {celdas.map((d, i) => {
                if (d === null) return <div key={i} />;
                const fecha = iso(viewYear, viewMonth, d);
                const cellDate = new Date(viewYear, viewMonth, d);
                const isPast = cellDate < today;
                const isToday = cellDate.getTime() === today.getTime();
                const info = dias[fecha];
                const isSelected = fecha === selectedDate;

                let cls =
                  "relative flex aspect-square items-center justify-center rounded-lg text-[13px]";
                if (isPast) {
                  cls += " text-zinc-700 cursor-default";
                } else if (info?.confirmada) {
                  cls += " bg-zinc-700 text-white font-bold";
                } else {
                  cls += " bg-zinc-800 border border-white/10 text-zinc-300 cursor-pointer hover:border-aventurea-orange hover:text-aventurea-orange";
                  if (info && info.pendientes > 0) {
                    cls += " bg-aventurea-orange/15 border-aventurea-orange/40 text-aventurea-orange font-bold";
                  }
                }
                if (isToday) cls += " ring-2 ring-inset ring-aventurea-orange";
                if (isSelected) cls += " ring-2 ring-inset ring-white";

                return (
                  <div
                    key={i}
                    onClick={() => !isPast && !info?.confirmada && elegirFecha(fecha)}
                    className={cls}
                  >
                    {d}
                    {!isPast && info && info.pendientes > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-aventurea-orange text-[8.5px] font-bold text-zinc-950">
                        {info.pendientes}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4.5 flex flex-wrap gap-4">
              <span className="flex items-center gap-1.5 text-[11.5px] text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-[3px] border border-white/10 bg-zinc-800" />
                Disponible
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-[3px] border border-aventurea-orange/40 bg-aventurea-orange/15" />
                Con solicitudes
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-zinc-700" />
                Confirmada
              </span>
            </div>

            <div className="mt-4 rounded-[10px] bg-aventurea-orange/10 p-3 text-xs text-aventurea-orange">
              Varias personas pueden solicitar la misma fecha — nosotros
              elegimos cuál confirmar.
            </div>
          </div>

          {/* Panel */}
          <div className="rounded-[18px] border border-white/10 bg-zinc-900 p-6 shadow-sm">
            {!selectedDate && (
              <div className="py-7 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-aventurea-orange/15 text-2xl">
                  📅
                </div>
                <h3 className="mt-4 text-[17px] font-bold text-white">
                  Seleccioná una fecha
                </h3>
                <p className="mx-auto mt-2 max-w-[34ch] text-[13px] text-zinc-400">
                  Elegí un día disponible en el calendario para indicar los
                  invitados, ver el precio y enviar tu solicitud.
                </p>
              </div>
            )}

            {selectedDate && confirmado && (
              <div className="py-3.5 text-center">
                <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-full bg-aventurea-orange/15 text-2xl">
                  ✓
                </div>
                <h3 className="mt-3.5 text-lg font-bold text-white">
                  Solicitud registrada
                </h3>
                <p className="mt-2 text-[13px] text-zinc-400">
                  Tu solicitud y tu comprobante quedaron guardados para esa
                  fecha. Aventurea CR va a validar el pago y confirmar — si
                  hay más solicitudes para el mismo día, elegimos cuál
                  confirmar.
                </p>
                <button
                  onClick={limpiarSeleccion}
                  className="mt-4 rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  Hacer otra solicitud
                </button>
              </div>
            )}

            {selectedDate && !confirmado && (
              <form onSubmit={enviarSolicitud} className="flex flex-col gap-3.5">
                <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
                  Solicitud de reserva
                </p>
                <div className="text-base font-bold text-white">
                  {selectedDateObj?.toLocaleDateString("es-CR", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </div>

                {dias[selectedDate] && dias[selectedDate].pendientes > 0 && (
                  <div className="rounded-[10px] bg-aventurea-orange/10 p-3 text-xs leading-relaxed text-aventurea-orange">
                    Ya hay {dias[selectedDate].pendientes} solicitud
                    {dias[selectedDate].pendientes > 1 ? "es" : ""} pendiente
                    {dias[selectedDate].pendientes > 1 ? "s" : ""} para esta
                    fecha. Igual podés enviar la tuya.
                  </div>
                )}

                <div>
                  <label className={labelCls}>Número de invitados</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={invitados}
                    onChange={(e) => setInvitados(e.target.value)}
                    placeholder="Ej. 40"
                    className={inputCls}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 px-3.5 py-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-zinc-400">
                    Precio estimado
                  </span>
                  <span className="text-[15px] font-bold text-white">
                    {tierBase === null
                      ? invitadosNum
                        ? "Cotización personalizada"
                        : "— indicá tus invitados —"
                      : fmtColones(tierBase)}
                  </span>
                </div>
                {esDiciembre && invitadosNum > 0 && (
                  <p className="-mt-2 text-[11px] text-zinc-500">
                    Tarifa de diciembre: {fmtColones(tarifaDiciembre)} por persona
                  </p>
                )}

                {servicios.length > 0 && invitadosNum > 0 && (
                  <div>
                    <label className={labelCls}>Servicios adicionales</label>
                    <div>
                      {servicios.map((s) => {
                        const eligible =
                          !s.requisito_max_invitados || invitadosNum <= s.requisito_max_invitados;
                        return (
                          <label
                            key={s.id}
                            className={`flex items-start gap-2.5 border-b border-white/10 py-2.5 last:border-none ${
                              eligible ? "" : "opacity-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!eligible}
                              checked={!!addons[s.id]}
                              onChange={(e) =>
                                setAddons((prev) => ({ ...prev, [s.id]: e.target.checked }))
                              }
                              className="mt-0.5 h-[17px] w-[17px] accent-aventurea-orange"
                            />
                            <div>
                              <span className="text-[13px] text-zinc-200">{s.nombre}</span>
                              <span className="ml-1.5 text-xs font-bold text-aventurea-orange">
                                {fmtColones(s.precio)}
                              </span>
                              {s.requisito_max_invitados && (
                                <div className="mt-0.5 text-[11px] text-zinc-500">
                                  {eligible
                                    ? `Disponible para grupos de hasta ${s.requisito_max_invitados} personas`
                                    : `No disponible — aplica solo hasta ${s.requisito_max_invitados} personas`}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Nombre completo</label>
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Tu nombre"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>WhatsApp o correo</label>
                    <input
                      type="text"
                      required
                      value={contacto}
                      onChange={(e) => setContacto(e.target.value)}
                      placeholder="+506 .... o correo"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Tipo de evento</label>
                  <select
                    required
                    value={tipoEvento}
                    onChange={(e) => setTipoEvento(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Selecciona una opción</option>
                    <option>Boda</option>
                    <option>Cumpleaños</option>
                    <option>Evento corporativo</option>
                    <option>Otro</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Mensaje (opcional)</label>
                  <textarea
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Contanos más sobre tu evento"
                    className={`min-h-[56px] ${inputCls}`}
                  />
                </div>

                {total !== null && (
                  <div className="flex items-center justify-between rounded-xl bg-zinc-800 px-3.5 py-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-zinc-400">
                      Total estimado
                    </span>
                    <span className="text-lg font-bold text-white">{fmtColones(total)}</span>
                  </div>
                )}
                {total !== null && (
                  <div className="rounded-[10px] bg-aventurea-orange/10 p-3 text-xs leading-relaxed text-aventurea-orange">
                    El monto de arriba es el <strong>depósito para reservar</strong> —
                    se paga por SINPE o transferencia. El resto se coordina para el día del evento.
                  </div>
                )}

                <div>
                  <label className={labelCls}>Método de pago del depósito</label>
                  <select
                    required
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="sinpe">SINPE Móvil</option>
                    <option value="transferencia">Transferencia bancaria</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Comprobante de pago</label>
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 p-4 text-center hover:border-aventurea-orange">
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={onComprobanteChange}
                      className="hidden"
                    />
                    {comprobantePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={comprobantePreview}
                        alt="Comprobante"
                        className="max-h-[140px] rounded-lg"
                      />
                    ) : (
                      <span className="text-xs text-zinc-400">
                        Tocá para subir una foto del comprobante
                      </span>
                    )}
                  </label>
                </div>

                {submitError && (
                  <p className="rounded-lg bg-red-950/40 p-2.5 text-[13px] text-red-400">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || total === null}
                  className="rounded-full bg-aventurea-orange py-3 text-center text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
                >
                  {submitting ? "Enviando..." : "Enviar solicitud"}
                </button>
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  className="text-center text-xs text-zinc-500 underline hover:text-white"
                >
                  ← Elegir otra fecha
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
