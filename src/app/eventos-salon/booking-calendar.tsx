"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  IconCalendarLine,
  IconClock,
  IconHourglass,
  IconStopwatch,
  IconTagLine,
  IconWarning,
} from "@/components/icons";
import {
  duracionHoras,
  etiquetaHorario,
  type HorarioBloqueConfig,
} from "@/app/mi-rancho/types";
import {
  cancelarReservaTemporal,
  completarReservaTemporal,
  crearReservaTemporal,
} from "./actions";
import type { DiaDisponibilidad, PrecioTier, ServicioAdicional } from "./types";
import { terminosPorDefecto } from "@/app/mi-rancho/types";
import type { PromocionDia } from "@/app/mi-rancho/types";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

const CEDULA_REGEX = /^[0-9-]{7,14}$/;

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
  promociones = [],
  terminos = [],
  montoMinimo = null,
  horarios = [],
}: {
  ranchoId: string;
  nombreRancho: string;
  disponibilidad: Record<string, DiaDisponibilidad>;
  tiers: PrecioTier[];
  servicios: ServicioAdicional[];
  tarifaDiciembre: number;
  depositoReserva: number;
  promociones?: PromocionDia[];
  /** Los del proveedor; vacío = usar los que trae la plataforma. */
  terminos?: string[];
  montoMinimo?: number | null;
  /** Los bloques de alquiler del dueño; vacío = no se pregunta el horario. */
  horarios?: HorarioBloqueConfig[];
}) {
  // Un proveedor que nunca los tocó muestra siempre los vigentes de
  // Aventurea, armados con su propio depósito y monto mínimo.
  const terminosVigentes =
    terminos.length > 0
      ? terminos
      : terminosPorDefecto(depositoReserva, montoMinimo);

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
  // Qué fecha tiene tomada este visitante, para poder devolverla al
  // calendario cuando la suelta (al cambiar de día, limpiar o vencerse).
  const [holdFecha, setHoldFecha] = useState<string | null>(null);
  const [holdCreando, setHoldCreando] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [holdVencido, setHoldVencido] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [invitados, setInvitados] = useState("");
  const [horarioBloque, setHorarioBloque] = useState("");
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [cedula, setCedula] = useState("");
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

  const [codigoInput, setCodigoInput] = useState("");
  const [codigoAplicado, setCodigoAplicado] = useState<{
    codigo: string;
    tipo: "porcentaje" | "monto_fijo";
    valor: number;
  } | null>(null);
  const [codigoError, setCodigoError] = useState<string | null>(null);
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);

  // Devuelve una fecha al calendario: su bloqueo temporal ya se soltó.
  const soltarTemporalLocal = useCallback((fecha: string | null) => {
    if (!fecha) return;
    setDias((prev) => {
      const dia = prev[fecha];
      if (!dia) return prev;
      return {
        ...prev,
        [fecha]: { ...dia, temporales: Math.max(0, dia.temporales - 1) },
      };
    });
  }, []);

  // Cuenta regresiva del hold temporal.
  useEffect(() => {
    if (!holdExpiraEn || confirmado) return;
    let vencidoAvisado = false;
    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(holdExpiraEn).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
      if (diff <= 0 && !vencidoAvisado) {
        vencidoAvisado = true;
        setHoldVencido(true);
        soltarTemporalLocal(holdFecha);
        setHoldFecha(null);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [holdExpiraEn, confirmado, holdFecha, soltarTemporalLocal]);

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

  const promoAplicable = useMemo(() => {
    if (!selectedDateObj) return null;
    const dow = selectedDateObj.getDay();
    const activas = promociones.filter((p) => p.activo && p.dias_semana.includes(dow));
    if (activas.length === 0) return null;
    return activas.reduce((mejor, p) =>
      p.porcentaje_descuento > mejor.porcentaje_descuento ? p : mejor,
    );
  }, [selectedDateObj, promociones]);

  const descuentoPromoMonto = useMemo(() => {
    if (cotizacionTotal === null || !promoAplicable) return 0;
    return Math.round(cotizacionTotal * (promoAplicable.porcentaje_descuento / 100));
  }, [cotizacionTotal, promoAplicable]);

  const totalConPromo =
    cotizacionTotal === null ? null : cotizacionTotal - descuentoPromoMonto;

  const descuentoCodigoMonto = useMemo(() => {
    if (totalConPromo === null || !codigoAplicado) return 0;
    if (codigoAplicado.tipo === "porcentaje") {
      return Math.round(totalConPromo * (codigoAplicado.valor / 100));
    }
    return Math.min(codigoAplicado.valor, totalConPromo);
  }, [totalConPromo, codigoAplicado]);

  const totalFinal =
    totalConPromo === null ? null : Math.max(0, totalConPromo - descuentoCodigoMonto);

  const descuentoTotalMonto = descuentoPromoMonto + descuentoCodigoMonto;

  async function verificarCodigo() {
    if (!codigoInput.trim()) return;
    setVerificandoCodigo(true);
    setCodigoError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("verificar_codigo_descuento", {
      p_rancho_id: ranchoId,
      p_codigo: codigoInput.trim(),
    });
    setVerificandoCodigo(false);
    if (error || !data || data.length === 0) {
      setCodigoAplicado(null);
      setCodigoError("Ese código no es válido o ya venció.");
      return;
    }
    const fila = data[0] as { tipo: "porcentaje" | "monto_fijo"; valor: number };
    setCodigoAplicado({ codigo: codigoInput.trim().toUpperCase(), ...fila });
  }

  function quitarCodigo() {
    setCodigoInput("");
    setCodigoAplicado(null);
    setCodigoError(null);
  }

  const cedulaValida = CEDULA_REGEX.test(cedula.trim());

  const puedeEnviar =
    !!holdId &&
    !holdVencido &&
    invitadosNum > 0 &&
    (horarios.length === 0 || !!horarioBloque) &&
    !!nombre &&
    !!contacto &&
    cedulaValida &&
    !!tipoEvento &&
    !!metodoPago &&
    !!comprobante &&
    terminosAceptados;

  const resetFormulario = useCallback(() => {
    setInvitados("");
    setHorarioBloque("");
    setAddons({});
    setCedula("");
    setNombre("");
    setContacto("");
    setTipoEvento("");
    setMensaje("");
    setMetodoPago("");
    setComprobante(null);
    setComprobantePreview(null);
    setTerminosAceptados(false);
    setSubmitError(null);
    setCodigoInput("");
    setCodigoAplicado(null);
    setCodigoError(null);
  }, []);

  function cambiarMes(dir: number) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  async function elegirFecha(fecha: string) {
    // Soltamos la fecha anterior antes de tomar la nueva, para no ir
    // dejando días bloqueados detrás mientras se compara el calendario.
    if (holdId && !confirmado) {
      await cancelarReservaTemporal(holdId);
      soltarTemporalLocal(holdFecha);
    }
    setHoldFecha(null);
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
    setHoldFecha(fecha);
    setDias((prev) => {
      const dia = prev[fecha] ?? { confirmada: false, pendientes: 0, temporales: 0 };
      return { ...prev, [fecha]: { ...dia, temporales: dia.temporales + 1 } };
    });
  }

  function handleDateClick(fecha: string) {
    if (fecha === selectedDate) return;
    elegirFecha(fecha);
  }

  // Cerrar el panel devuelve la fecha al calendario. Sin esto, cada vez
  // que alguien abre y cierra queda un día bloqueado que nadie está
  // usando — justo lo que arregla la migración 0017 del lado del server.
  const limpiarSeleccion = useCallback(() => {
    if (holdId && !confirmado) {
      cancelarReservaTemporal(holdId);
      soltarTemporalLocal(holdFecha);
    }
    setHoldFecha(null);
    setSelectedDate(null);
    setHoldId(null);
    setHoldExpiraEn(null);
    setHoldVencido(false);
    setHoldError(null);
    setConfirmado(false);
    resetFormulario();
  }, [holdId, confirmado, holdFecha, soltarTemporalLocal, resetFormulario]);

  const panelAbierto = !!selectedDate;

  // Mientras el panel está encima, el fondo no se mueve.
  useEffect(() => {
    if (!panelAbierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [panelAbierto]);

  // Escape cierra lo que esté más arriba: primero los diálogos chicos,
  // y de último el panel (soltando la reserva temporal).
  useEffect(() => {
    if (!panelAbierto) return;
    function alTeclado(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (mostrarTerminos) {
        setMostrarTerminos(false);
        return;
      }
      if (submitting) return;
      limpiarSeleccion();
    }
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [panelAbierto, mostrarTerminos, submitting, limpiarSeleccion]);

  function cerrarPanel() {
    if (submitting) return;
    limpiarSeleccion();
  }

  function onComprobanteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setComprobante(file);
    if (file) setComprobantePreview(URL.createObjectURL(file));
  }

  async function enviarSolicitud(e: React.FormEvent) {
    e.preventDefault();
    if (!holdId || !selectedDate || !comprobante) return;
    if (horarios.length > 0 && !horarioBloque) return;
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
      cedula: cedula.trim(),
      tipo_evento: tipoEvento,
      invitados: invitadosNum,
      horario_bloque: horarioBloque || null,
      monto_total: totalFinal ?? 0,
      deposito_monto: depositoReserva,
      metodo_pago: metodoPago as "sinpe" | "transferencia",
      deposito_comprobante_url: path,
      terminos_aceptados: terminosAceptados,
      notas: mensaje || null,
      codigo_descuento: codigoAplicado?.codigo ?? null,
      descuento_monto: descuentoTotalMonto,
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
    // El hold dejó de ser temporal: pasó a ser la reserva en aprobación.
    setHoldFecha(null);
    setConfirmado(true);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const inputCls =
    "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
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

        {promociones.some((p) => p.activo) && (
          <div className="mb-6 flex flex-wrap gap-2">
            {promociones
              .filter((p) => p.activo)
              .map((p) => (
                <span
                  key={p.id}
                  className="rounded-full border border-aventurea-orange/40 bg-aventurea-orange/15 px-3.5 py-1.5 text-[12.5px] font-bold text-aventurea-orange-dark"
                >
                  <IconTagLine className="h-3.5 w-3.5" /> {p.etiqueta}
                </span>
              ))}
          </div>
        )}

        {horarios.length > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-aventurea-line bg-aventurea-surface p-4">
            <span className="text-aventurea-ink-soft"><IconClock className="h-5 w-5" /></span>
            <div className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              <p className="mb-1.5">
                {nombreRancho} alquila por estos horarios — elegís uno al
                reservar:
              </p>
              <ul className="flex flex-col gap-1">
                {horarios.map((h) => {
                  const horas = duracionHoras(h.desde, h.hasta);
                  return (
                    <li key={h.id}>
                      <strong className="text-aventurea-ink">{etiquetaHorario(h)}</strong>
                      {horas !== null && ` · ${horas} h`}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Calendario a ancho completo */}
        <div className="rounded-[20px] border border-aventurea-line bg-aventurea-surface p-4 shadow-sm sm:p-7">
          <div className="flex items-center justify-between">
            <span className="titulo text-[20px] capitalize text-aventurea-ink sm:text-[24px]">
              {MESES[viewMonth]} {viewYear}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => cambiarMes(-1)}
                aria-label="Mes anterior"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-aventurea-line text-[17px] text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
              >
                ‹
              </button>
              <button
                onClick={() => cambiarMes(1)}
                aria-label="Mes siguiente"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-aventurea-line text-[17px] text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {DOW.map((d, i) => (
              <div
                key={i}
                className="pb-1.5 text-center text-[10.5px] font-bold uppercase tracking-wide text-zinc-500 sm:text-[11.5px]"
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
                "relative flex min-h-[52px] flex-col justify-between rounded-xl p-1.5 text-[14px] sm:min-h-[88px] sm:p-2.5 sm:text-[16px]";
              let etiqueta: string | null = null;
              let badge: number | null = null;

              if (isPast) {
                cls += " cursor-default text-zinc-300";
              } else if (info?.confirmada) {
                cls += " cursor-not-allowed border border-red-300 bg-red-50 font-bold text-red-700";
                etiqueta = "Reservada";
              } else if (isHeldByOther) {
                cls += " cursor-not-allowed border border-blue-500/25 bg-blue-500/10 text-blue-700/70";
                etiqueta = "Bloqueada";
              } else {
                cls += " cursor-pointer border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange";
                etiqueta = "Disponible";
                if (info && info.pendientes > 0) {
                  cls += " bg-aventurea-orange/15 border-aventurea-orange/40 text-aventurea-orange font-bold";
                  etiqueta = "En aprobación";
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
                  <span className="font-bold leading-none">{d}</span>
                  {etiqueta && (
                    <span className="hidden text-[10px] font-bold uppercase leading-none tracking-wide opacity-70 sm:block">
                      {etiqueta}
                    </span>
                  )}
                  {!isPast && badge !== null && (
                    <span className="absolute right-1.5 top-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-white text-[9.5px] font-bold text-zinc-950">
                      {badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-aventurea-line pt-4">
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
              <span className="h-2.5 w-2.5 rounded-[3px] border border-red-300 bg-red-50" />
              Reservada
            </span>
          </div>
        </div>

        {!selectedDate && (
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-[13px] text-aventurea-ink-soft">
            <IconCalendarLine className="h-4 w-4 text-aventurea-orange" />
            Tocá un día disponible para indicar tus invitados, ver el precio y
            reservar la fecha.
          </p>
        )}
      </div>

      {/* Panel de reserva sobre la página, con el fondo difuminado */}
      {panelAbierto && selectedDate && (
        <div
          onClick={cerrarPanel}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-aventurea-ink/35 backdrop-blur-md sm:items-center sm:p-6"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reservar fecha"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full flex-col overflow-hidden bg-aventurea-surface shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-[560px] sm:rounded-[22px] sm:border sm:border-aventurea-line"
          >
            {/* Encabezado fijo: la cuenta regresiva nunca se va con el scroll */}
            <div className="flex items-center gap-3 border-b border-aventurea-line px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-orange">
                  Reserva de fecha
                </p>
                <p className="truncate text-[15px] font-bold capitalize text-aventurea-ink">
                  {fmtFechaLarga(selectedDate)}
                </p>
              </div>
              {holdId && !holdVencido && !confirmado && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-blue-700">
                  <IconStopwatch className="h-3.5 w-3.5" />
                  <span className="font-mono text-[13.5px] font-bold">
                    {fmtCountdown(secondsLeft)}
                  </span>
                </span>
              )}
              <button
                onClick={cerrarPanel}
                aria-label="Cerrar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-aventurea-line text-[18px] text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
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
                  className="mt-4 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  Intentar de nuevo
                </button>
              </div>
            )}

            {selectedDate && holdVencido && !confirmado && (
              <div className="py-7 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-700">
                  <IconHourglass className="h-6 w-6" />
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
                  className="mt-4 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
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
                  className="mt-4 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  Hacer otra reserva
                </button>
              </div>
            )}

            {selectedDate && holdId && !holdVencido && !confirmado && !holdCreando && (
              <form onSubmit={enviarSolicitud} className="flex flex-col gap-3.5">
                <p className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-blue-700">
                  Esta fecha te queda bloqueada 10 minutos. Subí el
                  comprobante del depósito antes de que se acabe el tiempo, o
                  vuelve a quedar disponible para cualquiera.
                </p>

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

                {horarios.length > 0 && (
                  <div>
                    <label className={labelCls}>Horario</label>
                    <select
                      required
                      value={horarioBloque}
                      onChange={(e) => setHorarioBloque(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Selecciona una opción</option>
                      {horarios.map((h) => (
                        <option key={h.id} value={etiquetaHorario(h)}>
                          {etiquetaHorario(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                {promoAplicable && cotizacionTotal !== null && (
                  <p className="-mt-2 flex items-center gap-1.5 text-[11.5px] font-bold text-aventurea-green">
                    <IconTagLine className="h-3.5 w-3.5" /> {promoAplicable.etiqueta} aplicado (-{fmtColones(descuentoPromoMonto)})
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
                  <div>
                    <label className={labelCls}>¿Tenés un código de descuento?</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={codigoInput}
                        onChange={(e) => {
                          setCodigoInput(e.target.value.toUpperCase());
                          if (codigoAplicado) setCodigoAplicado(null);
                          if (codigoError) setCodigoError(null);
                        }}
                        placeholder="Ej. BODA10"
                        disabled={!!codigoAplicado}
                        className={`${inputCls} uppercase disabled:opacity-70`}
                      />
                      {codigoAplicado ? (
                        <button
                          type="button"
                          onClick={quitarCodigo}
                          className="whitespace-nowrap rounded-[10px] border border-aventurea-line px-3.5 py-2.5 text-[12.5px] font-bold text-aventurea-ink hover:border-red-400 hover:text-red-700"
                        >
                          Quitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={verificarCodigo}
                          disabled={verificandoCodigo || !codigoInput.trim()}
                          className="whitespace-nowrap rounded-[10px] bg-aventurea-ink px-3.5 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                        >
                          {verificandoCodigo ? "..." : "Aplicar"}
                        </button>
                      )}
                    </div>
                    {codigoAplicado && (
                      <p className="mt-1.5 text-[11.5px] font-bold text-aventurea-green">
                        ✓ Código {codigoAplicado.codigo} aplicado (-
                        {codigoAplicado.tipo === "porcentaje"
                          ? `${codigoAplicado.valor}%`
                          : fmtColones(codigoAplicado.valor)}
                        )
                      </p>
                    )}
                    {codigoError && (
                      <p className="mt-1.5 text-[11.5px] font-bold text-red-700">{codigoError}</p>
                    )}
                  </div>
                )}

                {cotizacionTotal !== null && (
                  <div className="rounded-xl bg-aventurea-cream-2 px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Total estimado del evento
                      </span>
                      <span className="flex items-baseline gap-1.5">
                        {descuentoTotalMonto > 0 && (
                          <span className="text-[12px] text-zinc-500 line-through">
                            {fmtColones(cotizacionTotal)}
                          </span>
                        )}
                        <span className="text-lg font-bold text-aventurea-ink">
                          {fmtColones(totalFinal ?? cotizacionTotal)}
                        </span>
                      </span>
                    </div>
                    {descuentoTotalMonto > 0 && (
                      <p className="mt-1 text-right text-[11px] font-bold text-aventurea-green">
                        Ahorrás {fmtColones(descuentoTotalMonto)}
                      </p>
                    )}
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
                  <label className={labelCls}>Número de cédula</label>
                  <input
                    type="text"
                    required
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="Ej. 1-2345-6789"
                    className={inputCls}
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                    Solo para identificar a quien reserva ante daños o
                    problemas en el evento. Es privado — lo ve únicamente{" "}
                    {nombreRancho} y Aventurea CR.
                  </p>
                  {cedula && !cedulaValida && (
                    <p className="mt-1 text-[11px] font-bold text-red-700">
                      Escribí solo números (y guiones si querés), sin espacios ni letras.
                    </p>
                  )}
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
                <div className="flex items-start gap-1.5 rounded-[10px] border border-red-500/30 bg-red-50 p-3 text-[11.5px] leading-relaxed text-red-700">
                  <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Si el comprobante muestra un monto <strong>menor a {fmtColones(depositoReserva)}</strong>,
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
                  className="rounded-xl bg-aventurea-orange py-3 text-center text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
                >
                  {submitting ? "Enviando..." : "Confirmar mi reserva"}
                </button>
                <button
                  type="button"
                  onClick={cerrarPanel}
                  className="text-center text-xs text-zinc-500 underline hover:text-aventurea-ink"
                >
                  ← Cerrar y elegir otra fecha
                </button>
              </form>
            )}
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
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-aventurea-line bg-aventurea-surface p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-aventurea-ink">
                Términos y condiciones
              </h3>
              <button
                onClick={() => setMostrarTerminos(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink hover:border-aventurea-orange"
              >
                ×
              </button>
            </div>
            <ol className="mt-4 flex flex-col gap-3">
              {terminosVigentes.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
                  <span className="font-bold text-aventurea-orange">{i + 1}.</span>
                  {t}
                </li>
              ))}
            </ol>
            <button
              onClick={() => setMostrarTerminos(false)}
              className="mt-5 w-full rounded-xl bg-aventurea-orange py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
