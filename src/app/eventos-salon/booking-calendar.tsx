"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cancelarReservaTemporal,
  completarReservaTemporal,
  crearReservaTemporal,
} from "./actions";
import type { DiaDisponibilidad, HorarioBloque, PrecioTier, ServicioAdicional } from "./types";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

const TERMINOS = [
  "El depósito debe ser de al menos ₡25.000. Si el comprobante muestra un monto menor, la reserva no será válida y el dinero no se reembolsa.",
  "El depósito de reserva no es reembolsable en caso de cancelación por parte del cliente.",
  "El tipo de evento debe coincidir exactamente con el indicado al reservar; si no coincide, el anfitrión puede cancelar la reserva sin devolución del depósito.",
  "Subir el comprobante no confirma la fecha por sí solo — la reserva queda en aprobación hasta que el anfitrión la revise y confirme.",
  "El alquiler es por un bloque de 6 horas (mañana y tarde, o tarde y noche), con hora máxima de salida a las 12:00 medianoche.",
  "Cualquier daño a las instalaciones o al mobiliario durante el evento es responsabilidad de quien hizo la reserva.",
];

const HORARIOS: { value: HorarioBloque; label: string }[] = [
  { value: "manana_tarde", label: "Mañana y tarde (aprox. 7:00 a.m. – 1:00 p.m.)" },
  { value: "tarde_noche", label: "Tarde y noche (aprox. 6:00 p.m. – 12:00 medianoche)" },
];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function fmtColones(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}
function fmtCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtFechaLarga(fechaIso: string) {
  const [y, m, d] = fechaIso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function BookingCalendar({
  ranchoId,
  nombreRancho,
  disponibilidad,
  tiers,
  servicios,
  tarifaDiciembre,
  depositoReserva,
}: {
  ranchoId: string;
  nombreRancho: string;
  disponibilidad: Record<string, DiaDisponibilidad>;
  tiers: PrecioTier[];
  servicios: ServicioAdicional[];
  tarifaDiciembre: number;
  depositoReserva: number;
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

  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdExpiraEn, setHoldExpiraEn] = useState<string | null>(null);
  const [holdCreando, setHoldCreando] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [holdVencido, setHoldVencido] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [invitados, setInvitados] = useState("");
  const [horarioBloque, setHorarioBloque] = useState<HorarioBloque | "">("");
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<string | null>(null);

  // Cuenta regresiva del hold temporal.
  useEffect(() => {
    if (!holdExpiraEn || confirmado) return;
    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(holdExpiraEn).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
      if (diff <= 0) setHoldVencido(true);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [holdExpiraEn, confirmado]);

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

  const cotizacionTotal = tierBase === null ? null : tierBase + addonsTotal;

  const puedeEnviar =
    !!holdId &&
    !holdVencido &&
    invitadosNum > 0 &&
    !!horarioBloque &&
    !!nombre &&
    !!contacto &&
    !!tipoEvento &&
    !!metodoPago &&
    !!comprobante &&
    terminosAceptados;

  function resetFormulario() {
    setInvitados("");
    setHorarioBloque("");
    setAddons({});
    setNombre("");
    setContacto("");
    setTipoEvento("");
    setMensaje("");
    setMetodoPago("");
    setComprobante(null);
    setComprobantePreview(null);
    setTerminosAceptados(false);
    setSubmitError(null);
  }

  function cambiarMes(dir: number) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  async function elegirFecha(fecha: string) {
    if (holdId && !confirmado) {
      await cancelarReservaTemporal(holdId);
    }
    setSelectedDate(fecha);
    setConfirmado(false);
    setHoldVencido(false);
    setHoldError(null);
    resetFormulario();
    setHoldId(null);
    setHoldExpiraEn(null);
    setHoldCreando(true);

    const res = await crearReservaTemporal(ranchoId, fecha);
    setHoldCreando(false);

    if (res.error || !res.id) {
      setHoldError(res.error ?? "No se pudo reservar temporalmente la fecha.");
      return;
    }

    setHoldId(res.id);
    setHoldExpiraEn(res.expiraEn);
    setDias((prev) => {
      const dia = prev[fecha] ?? { confirmada: false, pendientes: 0, temporales: 0 };
      return { ...prev, [fecha]: { ...dia, temporales: dia.temporales + 1 } };
    });
  }

  function handleDateClick(fecha: string) {
    if (fecha === selectedDate) return;
    if (holdId && !confirmado && !holdVencido) {
      setSwitchTarget(fecha);
      return;
    }
    elegirFecha(fecha);
  }

  function confirmarCambioFecha() {
    if (!switchTarget) return;
    const fecha = switchTarget;
    setSwitchTarget(null);
    elegirFecha(fecha);
  }

  function limpiarSeleccion() {
    if (holdId && !confirmado) {
      cancelarReservaTemporal(holdId);
    }
    setSelectedDate(null);
    setHoldId(null);
    setHoldExpiraEn(null);
    setHoldVencido(false);
    setHoldError(null);
    setConfirmado(false);
    resetFormulario();
  }

  function onComprobanteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setComprobante(file);
    if (file) setComprobantePreview(URL.createObjectURL(file));
  }

  async function enviarSolicitud(e: React.FormEvent) {
    e.preventDefault();
    if (!holdId || !selectedDate || !comprobante || !horarioBloque) return;
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

    const res = await completarReservaTemporal(holdId, {
      nombre,
      contacto,
      tipo_evento: tipoEvento,
      invitados: invitadosNum,
      horario_bloque: horarioBloque,
      monto_total: cotizacionTotal ?? 0,
      deposito_monto: depositoReserva,
      metodo_pago: metodoPago as "sinpe" | "transferencia",
      deposito_comprobante_url: path,
      terminos_aceptados: terminosAceptados,
      notas: mensaje || null,
    });

    setSubmitting(false);

    if (res.error) {
      setSubmitError(res.error);
      return;
    }

    setDias((prev) => {
      const dia = prev[selectedDate] ?? { confirmada: false, pendientes: 0, temporales: 0 };
      return {
        ...prev,
        [selectedDate]: {
          ...dia,
          temporales: Math.max(0, dia.temporales - 1),
          pendientes: dia.pendientes + 1,
        },
      };
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
    "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
  const labelCls =
    "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

  return (
    <section id="reservar" className="py-9 pb-16">
      <div className="mx-auto max-w-[1080px] px-7">
        <div className="mb-6.5 max-w-[640px]">
          <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
            {nombreRancho}
          </p>
          <h1 className="mt-2.5 text-[28px] font-bold text-aventurea-orange-dark sm:text-[32px]">
            Reserva tu fecha
          </h1>
          <p className="mt-2.5 text-[14.5px] text-aventurea-ink-soft">
            Elegí un día en el calendario, completá tus datos y subí el
            comprobante del depósito. Tu reserva queda en aprobación hasta
            que la confirmemos.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-aventurea-line bg-white p-4">
          <span className="text-xl leading-none">🕐</span>
          <p className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            El rancho se alquila en bloques de <strong className="text-aventurea-ink">6 horas</strong>,
            a elegir entre <strong className="text-aventurea-ink">mañana y tarde</strong> o{" "}
            <strong className="text-aventurea-ink">tarde y noche</strong>. Hora máxima de
            salida: <strong className="text-aventurea-ink">12:00 medianoche</strong>.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          {/* Calendario */}
          <div className="rounded-[18px] border border-aventurea-line bg-white p-5.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-bold capitalize text-aventurea-ink">
                {MESES[viewMonth]} {viewYear}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => cambiarMes(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
                >
                  ‹
                </button>
                <button
                  onClick={() => cambiarMes(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
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
                const isHeldByOther = !!(info && info.temporales > 0 && !isSelected);
                const isBlocked = isPast || !!info?.confirmada || isHeldByOther;

                let cls =
                  "relative flex aspect-square items-center justify-center rounded-lg text-[13px]";
                let badge: number | null = null;

                if (isPast) {
                  cls += " text-zinc-300 cursor-default";
                } else if (info?.confirmada) {
                  cls += " bg-red-100 border border-red-300 text-red-700 font-bold line-through cursor-not-allowed";
                } else if (isHeldByOther) {
                  cls += " bg-blue-500/10 border border-blue-500/25 text-blue-700/60 cursor-not-allowed";
                } else {
                  cls += " bg-aventurea-cream-2 border border-aventurea-line text-aventurea-ink-soft cursor-pointer hover:border-aventurea-orange hover:text-aventurea-orange";
                  if (info && info.pendientes > 0) {
                    cls += " bg-aventurea-orange/15 border-aventurea-orange/40 text-aventurea-orange font-bold";
                    badge = info.pendientes;
                  }
                }
                if (isToday) cls += " ring-2 ring-inset ring-aventurea-orange";
                if (isSelected) cls += " ring-2 ring-inset ring-aventurea-ink";

                return (
                  <div
                    key={i}
                    onClick={() => !isBlocked && !holdCreando && handleDateClick(fecha)}
                    className={cls}
                  >
                    {d}
                    {!isPast && badge !== null && (
                      <span className="absolute -right-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-white text-[8.5px] font-bold text-zinc-950">
                        {badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4.5 flex flex-wrap gap-4">
              <span className="flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
                <span className="h-2.5 w-2.5 rounded-[3px] border border-aventurea-line bg-aventurea-cream-2" />
                Disponible
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
                <span className="h-2.5 w-2.5 rounded-[3px] border border-blue-500/25 bg-blue-500/10" />
                Reserva temporal (bloqueada)
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
                <span className="h-2.5 w-2.5 rounded-[3px] border border-aventurea-orange/40 bg-aventurea-orange/15" />
                En aprobación
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
                <span className="h-2.5 w-2.5 rounded-[3px] border border-red-300 bg-red-100" />
                Reservada
              </span>
            </div>

          </div>

          {/* Panel */}
          <div className="rounded-[18px] border border-aventurea-line bg-white p-6 shadow-sm">
            {!selectedDate && (
              <div className="py-7 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-aventurea-orange/15 text-2xl">
                  📅
                </div>
                <h3 className="mt-4 text-[17px] font-bold text-aventurea-ink">
                  Seleccioná una fecha
                </h3>
                <p className="mx-auto mt-2 max-w-[34ch] text-[13px] text-aventurea-ink-soft">
                  Elegí un día disponible en el calendario para indicar los
                  invitados, ver el precio y reservar la fecha.
                </p>
              </div>
            )}

            {selectedDate && holdCreando && (
              <div className="py-10 text-center text-[13px] text-aventurea-ink-soft">
                Reservando la fecha por 10 minutos...
              </div>
            )}

            {selectedDate && holdError && (
              <div className="py-7 text-center">
                <h3 className="text-[17px] font-bold text-aventurea-ink">
                  No se pudo reservar la fecha
                </h3>
                <p className="mx-auto mt-2 max-w-[34ch] text-[13px] text-aventurea-ink-soft">
                  {holdError}
                </p>
                <button
                  onClick={limpiarSeleccion}
                  className="mt-4 rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  Intentar de nuevo
                </button>
              </div>
            )}

            {selectedDate && holdVencido && !confirmado && (
              <div className="py-7 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-2xl">
                  ⏳
                </div>
                <h3 className="mt-4 text-[17px] font-bold text-aventurea-ink">
                  Se venció el tiempo
                </h3>
                <p className="mx-auto mt-2 max-w-[34ch] text-[13px] text-aventurea-ink-soft">
                  Pasaron los 10 minutos para subir el comprobante del
                  depósito y la fecha volvió a quedar disponible. Podés
                  elegirla de nuevo.
                </p>
                <button
                  onClick={limpiarSeleccion}
                  className="mt-4 rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  Elegir una fecha
                </button>
              </div>
            )}

            {selectedDate && confirmado && (
              <div className="py-3.5 text-center">
                <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-full bg-aventurea-orange/15 text-2xl">
                  ✓
                </div>
                <h3 className="mt-3.5 text-lg font-bold text-aventurea-ink">
                  Reserva en aprobación
                </h3>
                <p className="mt-2 text-[13px] text-aventurea-ink-soft">
                  Tu reserva y tu comprobante quedaron guardados para esa
                  fecha. {nombreRancho} va a validar el depósito y confirmar
                  — si hay más reservas para el mismo día, se confirma una
                  sola. Te avisamos por el contacto que dejaste.
                </p>
                <button
                  onClick={limpiarSeleccion}
                  className="mt-4 rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  Hacer otra reserva
                </button>
              </div>
            )}

            {selectedDate && holdId && !holdVencido && !confirmado && !holdCreando && (
              <form onSubmit={enviarSolicitud} className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between rounded-xl border border-blue-500/40 bg-blue-500/10 px-3.5 py-2.5">
                  <span className="text-[11.5px] font-bold text-blue-700">
                    ⏱ Reserva temporal
                  </span>
                  <span className="font-mono text-[13.5px] font-bold text-aventurea-ink">
                    {fmtCountdown(secondsLeft)}
                  </span>
                </div>
                <p className="-mt-1.5 text-[11px] text-zinc-500">
                  Subí el comprobante del depósito antes de que se acabe el
                  tiempo, o la fecha vuelve a quedar disponible.
                </p>

                <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
                  Reserva de fecha
                </p>
                <div className="text-base font-bold text-aventurea-ink">
                  {selectedDateObj?.toLocaleDateString("es-CR", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </div>

                {dias[selectedDate] && dias[selectedDate].pendientes > 0 && (
                  <div className="rounded-[10px] bg-aventurea-orange/10 p-3 text-xs leading-relaxed text-aventurea-orange">
                    Ya hay {dias[selectedDate].pendientes} reserva
                    {dias[selectedDate].pendientes > 1 ? "s" : ""} en
                    aprobación para esta fecha. Igual podés reservar la tuya
                    — {nombreRancho} confirma una sola.
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

                <div>
                  <label className={labelCls}>Horario (bloque de 6 horas)</label>
                  <select
                    required
                    value={horarioBloque}
                    onChange={(e) => setHorarioBloque(e.target.value as HorarioBloque)}
                    className={inputCls}
                  >
                    <option value="">Selecciona una opción</option>
                    {HORARIOS.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-aventurea-line px-3.5 py-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Cotización estimada del evento
                  </span>
                  <span className="text-[15px] font-bold text-aventurea-ink">
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
                            className={`flex items-start gap-2.5 border-b border-aventurea-line py-2.5 last:border-none ${
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

                {cotizacionTotal !== null && (
                  <div className="flex items-center justify-between rounded-xl bg-aventurea-cream-2 px-3.5 py-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                      Total estimado del evento
                    </span>
                    <span className="text-lg font-bold text-aventurea-ink">{fmtColones(cotizacionTotal)}</span>
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

                <div className="flex items-center justify-between rounded-xl bg-aventurea-orange/10 px-3.5 py-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-orange">
                    Depósito para reservar
                  </span>
                  <span className="text-lg font-bold text-aventurea-ink">{fmtColones(depositoReserva)}</span>
                </div>
                <p className="-mt-2 text-[11px] leading-relaxed text-zinc-500">
                  Este monto fijo es lo que se paga ahora por SINPE o
                  transferencia para reservar la fecha. El resto de la
                  cotización se coordina para el día del evento.
                </p>
                <div className="rounded-[10px] border border-red-500/30 bg-red-50 p-3 text-[11.5px] leading-relaxed text-red-700">
                  ⚠ Si el comprobante muestra un monto <strong>menor a {fmtColones(depositoReserva)}</strong>,
                  la reserva no queda válida y el dinero no se reembolsa.
                </div>

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

                <label className="flex items-start gap-2.5 text-[12.5px] text-aventurea-ink-soft">
                  <input
                    type="checkbox"
                    checked={terminosAceptados}
                    onChange={(e) => setTerminosAceptados(e.target.checked)}
                    required
                    className="mt-0.5 h-[17px] w-[17px] accent-aventurea-orange"
                  />
                  <span>
                    Acepto los{" "}
                    <button
                      type="button"
                      onClick={() => setMostrarTerminos(true)}
                      className="font-bold text-aventurea-orange underline"
                    >
                      términos y condiciones
                    </button>{" "}
                    de la reserva.
                  </span>
                </label>

                <div>
                  <label className={labelCls}>Comprobante de pago</label>
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-aventurea-line p-4 text-center hover:border-aventurea-orange">
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
                      <span className="text-xs text-aventurea-ink-soft">
                        Tocá para subir una foto del comprobante
                      </span>
                    )}
                  </label>
                </div>

                {submitError && (
                  <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !puedeEnviar}
                  className="rounded-full bg-aventurea-orange py-3 text-center text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
                >
                  {submitting ? "Enviando..." : "Confirmar mi reserva"}
                </button>
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  className="text-center text-xs text-zinc-500 underline hover:text-aventurea-ink"
                >
                  ← Elegir otra fecha
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {switchTarget && selectedDate && (
        <div
          onClick={() => setSwitchTarget(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-aventurea-line bg-white p-6 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-2xl">
              🔓
            </div>
            <h3 className="mt-3.5 text-base font-bold text-aventurea-ink">
              ¿Cambiar de fecha?
            </h3>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
              Tu reserva temporal del{" "}
              <strong className="text-aventurea-ink">{fmtFechaLarga(selectedDate)}</strong>{" "}
              dejará de estar bloqueada y quedará disponible para cualquiera.
              Vas a reservar el{" "}
              <strong className="text-aventurea-ink">{fmtFechaLarga(switchTarget)}</strong>{" "}
              en su lugar.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setSwitchTarget(null)}
                className="flex-1 rounded-full border border-aventurea-line py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange/40"
              >
                Mantener mi fecha
              </button>
              <button
                onClick={confirmarCambioFecha}
                className="flex-1 rounded-full bg-aventurea-orange py-2.5 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark"
              >
                Sí, cambiar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarTerminos && (
        <div
          onClick={() => setMostrarTerminos(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-aventurea-line bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-aventurea-ink">
                Términos y condiciones
              </h3>
              <button
                onClick={() => setMostrarTerminos(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-aventurea-line text-aventurea-ink hover:border-aventurea-orange"
              >
                ×
              </button>
            </div>
            <ol className="mt-4 flex flex-col gap-3">
              {TERMINOS.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
                  <span className="font-bold text-aventurea-orange">{i + 1}.</span>
                  {t}
                </li>
              ))}
            </ol>
            <button
              onClick={() => setMostrarTerminos(false)}
              className="mt-5 w-full rounded-full bg-aventurea-orange py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
