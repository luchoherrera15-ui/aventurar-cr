"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type ModalidadPrecioLugar,
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
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_REGEX = /^[0-9+\s-]{8,16}$/;

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
  modalidadPrecio = "rango_personas",
  precioHora = null,
  precioFijo = null,
  promociones = [],
  terminos = [],
  montoMinimo = null,
  horarios = [],
  compacto = false,
  descripcion = null,
  sinpeNumero = null,
  sinpeTitular = null,
  cuentaBanco = null,
  cuentaNumero = null,
  cuentaTitular = null,
  cuentaTipo = null,
  capacidadMax = null,
}: {
  ranchoId: string;
  nombreRancho: string;
  disponibilidad: Record<string, DiaDisponibilidad>;
  tiers: PrecioTier[];
  servicios: ServicioAdicional[];
  tarifaDiciembre: number;
  depositoReserva: number;
  /** Cómo cotiza este lugar; default = los rangos de siempre. */
  modalidadPrecio?: ModalidadPrecioLugar;
  /** Para modalidad "hora": lo que cobra cada hora contratada. */
  precioHora?: number | null;
  /** Para modalidad "fijo": el único precio del evento. */
  precioFijo?: number | null;
  promociones?: PromocionDia[];
  /** Los del proveedor; vacío = usar los que trae la plataforma. */
  terminos?: string[];
  montoMinimo?: number | null;
  /** Los bloques de alquiler del dueño; vacío = no se pregunta el horario. */
  horarios?: HorarioBloqueConfig[];
  /** true = sin el encabezado grande (el portal ya muestra nombre y
   *  descripción arriba); solo el título de sección y el calendario. */
  compacto?: boolean;
  descripcion?: string | null;
  /** Datos de cobro del proveedor; vacío = esa forma de pago no se ofrece. */
  sinpeNumero?: string | null;
  sinpeTitular?: string | null;
  cuentaBanco?: string | null;
  cuentaNumero?: string | null;
  cuentaTitular?: string | null;
  cuentaTipo?: string | null;
  /** El lugar no acepta grupos más grandes que esto (capacidad_max). */
  capacidadMax?: number | null;
}) {
  // Un proveedor que nunca los tocó muestra siempre los vigentes de
  // Bookea, armados con su propio depósito y monto mínimo.
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
  const [horasEvento, setHorasEvento] = useState("");
  const [horarioBloque, setHorarioBloque] = useState("");
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cedula, setCedula] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  const [avisoAceptado, setAvisoAceptado] = useState(false);
  // Paso 1: datos del evento. Paso 2: cómo pagar. Separarlo simplifica
  // lo que se ve de una sola vez, sobre todo en el celular.
  const [paso, setPaso] = useState<1 | 2>(1);

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

  // Con sesión iniciada los datos de contacto llegan precargados — la
  // persona no reescribe lo que la plataforma ya sabe. El perfil vive
  // en un ref porque el formulario se RESETEA en cada elección de
  // fecha (resetFormulario) y hay que volver a aplicarlo ahí.
  const perfilSesionRef = useRef<{ nombre: string; correo: string; whatsapp: string } | null>(
    null,
  );

  const aplicarPrefill = useCallback(() => {
    const p = perfilSesionRef.current;
    if (!p) return;
    if (p.correo) setCorreo((prev) => prev || p.correo);
    if (p.nombre) setNombre((prev) => prev || p.nombre);
    if (p.whatsapp) setWhatsapp((prev) => prev || p.whatsapp);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const nombreMeta = [meta.nombre, meta.full_name].find(
        (v): v is string => typeof v === "string" && v.trim() !== "",
      );
      const whatsappMeta = meta.whatsapp;
      perfilSesionRef.current = {
        nombre: nombreMeta ?? "",
        correo: user.email ?? "",
        whatsapp:
          typeof whatsappMeta === "string" && whatsappMeta.trim() !== "" ? whatsappMeta : "",
      };
      if (user.email) setCorreo((prev) => prev || user.email!);
      if (nombreMeta) setNombre((prev) => prev || nombreMeta);
      if (typeof whatsappMeta === "string" && whatsappMeta.trim() !== "") {
        setWhatsapp((prev) => prev || whatsappMeta);
      }
    });
  }, []);

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
  const horasNum = parseInt(horasEvento) || 0;

  // La cotización se calcula distinto según cómo el dueño configuró su
  // cobro (panel → pestaña Precios): por rangos de invitados (de
  // siempre), por hora, o un precio fijo del evento sin importar
  // invitados. El resto del flujo (fecha, depósito, comprobante) es
  // exactamente el mismo para las tres.
  const tierBase = useMemo(() => {
    if (modalidadPrecio === "fijo") return precioFijo ?? null;
    if (modalidadPrecio === "hora") {
      if (!horasNum || precioHora === null) return null;
      return horasNum * precioHora;
    }
    if (!invitadosNum) return null;
    if (esDiciembre) return invitadosNum * tarifaDiciembre;
    const tier = tiers.find(
      (t) => invitadosNum >= t.min_invitados && invitadosNum <= t.max_invitados,
    );
    return tier ? tier.precio : null;
  }, [modalidadPrecio, precioFijo, horasNum, precioHora, invitadosNum, esDiciembre, tiers, tarifaDiciembre]);

  const addonsTotal = useMemo(() => {
    return servicios.reduce((acc, s) => {
      const eligible = !s.requisito_max_invitados || invitadosNum <= s.requisito_max_invitados;
      return acc + (eligible && addons[s.id] ? s.precio : 0);
    }, 0);
  }, [servicios, addons, invitadosNum]);

  const cotizacionTotal = tierBase === null ? null : tierBase + addonsTotal;

  // La mejor promoción de cada día de la semana, para poder marcar el
  // descuento en las celdas del calendario sin recalcular por celda.
  const promoPorDiaSemana = useMemo(() => {
    const mapa: Record<number, PromocionDia> = {};
    promociones
      .filter((p) => p.activo && p.porcentaje_descuento > 0)
      .forEach((p) => {
        p.dias_semana.forEach((dow) => {
          const actual = mapa[dow];
          if (!actual || p.porcentaje_descuento > actual.porcentaje_descuento) {
            mapa[dow] = p;
          }
        });
      });
    return mapa;
  }, [promociones]);

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
  const correoValido = CORREO_REGEX.test(correo.trim());
  const whatsappValido = WHATSAPP_REGEX.test(whatsapp.trim());

  // Solo se ofrece la forma de pago que el proveedor realmente configuró.
  const metodosReales = useMemo(() => {
    const metodos: { value: "sinpe" | "transferencia"; label: string }[] = [];
    if (sinpeNumero) metodos.push({ value: "sinpe", label: "SINPE Móvil" });
    if (cuentaNumero) metodos.push({ value: "transferencia", label: "Transferencia bancaria" });
    return metodos;
  }, [sinpeNumero, cuentaNumero]);

  // "Tarjeta" se muestra siempre como vista previa de lo que vendría —
  // no procesa nada todavía, así que nunca cuenta para poder enviar.
  const metodosDisponibles = useMemo(
    () => [...metodosReales, { value: "tarjeta" as const, label: "Tarjeta (vista previa)" }],
    [metodosReales],
  );

  // Lo que hace falta para avanzar cambia según la modalidad: por
  // rangos necesita invitados, por hora necesita las horas, y el
  // precio fijo no depende de ninguno de los dos.
  const cotizacionCompleta =
    modalidadPrecio === "hora"
      ? horasNum > 0
      : modalidadPrecio === "fijo"
        ? true
        : invitadosNum > 0;

  // El lugar tiene un tope físico de gente — no se puede reservar para
  // más de lo que da su capacidad_max, sin importar la modalidad de cobro.
  const excedeCapacidad =
    modalidadPrecio === "rango_personas" &&
    !!capacidadMax &&
    invitadosNum > capacidadMax;

  const puedeAvanzar =
    !!holdId &&
    !holdVencido &&
    cotizacionCompleta &&
    !excedeCapacidad &&
    (horarios.length === 0 || !!horarioBloque) &&
    !!nombre &&
    correoValido &&
    whatsappValido &&
    cedulaValida &&
    !!tipoEvento &&
    avisoAceptado;

  const puedeEnviar =
    puedeAvanzar &&
    (metodoPago === "sinpe" || metodoPago === "transferencia") &&
    !!comprobante &&
    terminosAceptados;

  const resetFormulario = useCallback(() => {
    setInvitados("");
    setHorarioBloque("");
    setAddons({});
    setCedula("");
    setNombre("");
    setCorreo("");
    setWhatsapp("");
    setTipoEvento("");
    setMensaje("");
    setMetodoPago("");
    setComprobante(null);
    setComprobantePreview(null);
    setTerminosAceptados(false);
    setAvisoAceptado(false);
    setPaso(1);
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
    // El reset borra también el precargado de la sesión — se vuelve a
    // poner de una, para que el formulario llegue lleno.
    aplicarPrefill();
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

    // Sin columna propia para las horas contratadas, se anteponen a las
    // notas para que el dueño las vea igual al revisar la reserva.
    const notasConHoras =
      modalidadPrecio === "hora" && horasNum > 0
        ? `Evento contratado por ${horasNum} hora${horasNum === 1 ? "" : "s"}.${mensaje ? " " + mensaje : ""}`
        : mensaje || null;

    const res = await completarReservaTemporal(holdId, {
      nombre,
      correo: correo.trim(),
      whatsapp: whatsapp.trim(),
      cedula: cedula.trim(),
      tipo_evento: tipoEvento,
      invitados: invitadosNum,
      horario_bloque: horarioBloque || null,
      monto_total: totalFinal ?? 0,
      deposito_monto: depositoReserva,
      metodo_pago: metodoPago as "sinpe" | "transferencia",
      deposito_comprobante_url: path,
      terminos_aceptados: terminosAceptados,
      aviso_prohibiciones_aceptado: avisoAceptado,
      notas: notasConHoras,
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
    // La próxima reserva de esta persona sale precargada: nombre y
    // WhatsApp quedan en sus metadatos (si hay sesión; si no, no pasa nada).
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        void supabase.auth.updateUser({
          data: { nombre, whatsapp: whatsapp.trim() },
        });
      }
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

  // Inputs grandes y etiquetas legibles (sin microtexto en
  // mayúsculas): quien reserva no siempre es hábil con la tecnología.
  const inputCls =
    "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[14px] text-aventurea-ink placeholder:text-zinc-400 focus:border-aventurea-navy focus:outline-none";
  const labelCls = "mb-1.5 block text-[12.5px] font-bold text-aventurea-ink";

  // Dentro del modal de vidrio (compacto), elegir una fecha SWAPEA la
  // vista: el calendario se esconde y el formulario toma su lugar —
  // nada de un segundo panel flotante encima del modal.
  const vistaFormulario = compacto && panelAbierto && !!selectedDate;

  return (
    <section id="reservar" className={compacto ? "" : "border-t border-aventurea-line bg-aventurea-cream-2/40"}>
      <div className={compacto ? "mx-auto max-w-[1080px] py-2" : "mx-auto max-w-[1080px] px-5 py-12 sm:px-7 sm:py-14"}>
        {compacto ? null : (
          <div className="mb-7 max-w-[640px]">
            <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-5 before:bg-aventurea-navy">
              Reservá tu fecha
            </p>
            <h1 className="titulo mt-3 text-[32px] text-aventurea-ink sm:text-[44px]">
              {nombreRancho}
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
              {descripcion ??
                "Elegí un día en el calendario, completá tus datos y subí el comprobante del depósito. Tu reserva queda en aprobación hasta que la confirmemos."}
            </p>
          </div>
        )}

        {horarios.length > 0 && !vistaFormulario && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-aventurea-line bg-aventurea-surface p-4">
            <span className="text-aventurea-navy"><IconClock className="h-5 w-5" /></span>
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

        <div
          className={`rounded-[20px] border border-aventurea-line bg-aventurea-surface p-4 shadow-sm sm:p-5 ${vistaFormulario ? "hidden" : ""}`}
        >
          <div className="flex items-center justify-between">
            <span className="titulo text-[18px] capitalize text-aventurea-ink sm:text-[20px]">
              {MESES[viewMonth]} {viewYear}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => cambiarMes(-1)}
                aria-label="Mes anterior"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-aventurea-line text-[17px] text-aventurea-ink hover:border-aventurea-navy hover:bg-aventurea-cream-2"
              >
                ‹
              </button>
              <button
                onClick={() => cambiarMes(1)}
                aria-label="Mes siguiente"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-aventurea-line text-[17px] text-aventurea-ink hover:border-aventurea-navy hover:bg-aventurea-cream-2"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-7 gap-1.5">
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

              // Celdas compactas: el mes completo tiene que caber en el
              // modal sin scroll — 88px de alto por día era un edificio.
              let cls =
                "relative flex min-h-[40px] flex-col justify-between rounded-lg p-1 text-[12.5px] transition sm:min-h-[44px] sm:p-1.5 sm:text-[13px]";
              let etiqueta: string | null = null;
              let badge: number | null = null;
              // Solo tiene sentido anunciar el descuento en días que se
              // pueden reservar: en uno ocupado es publicidad muerta.
              const promoDia = isBlocked
                ? null
                : promoPorDiaSemana[cellDate.getDay()] ?? null;

              if (isPast) {
                cls += " cursor-default text-zinc-300";
              } else if (info?.confirmada) {
                cls += " cursor-not-allowed border border-red-200 bg-red-50 font-bold text-red-700";
                etiqueta = "Reservada";
              } else if (isHeldByOther) {
                cls += " cursor-not-allowed border border-sky-200 bg-sky-50 text-sky-700";
                etiqueta = "Bloqueada";
              } else {
                cls += " cursor-pointer border border-aventurea-line bg-aventurea-cream-2/50 text-aventurea-ink hover:border-aventurea-navy hover:bg-aventurea-navy/5";
                etiqueta = "Disponible";
                if (info && info.pendientes > 0) {
                  cls += " border-amber-300 bg-amber-50 font-bold text-amber-800";
                  etiqueta = "En aprobación";
                  badge = info.pendientes;
                }
              }
              if (isToday) cls += " ring-2 ring-inset ring-aventurea-navy/35";
              if (isSelected) cls += " ring-2 ring-inset ring-aventurea-navy";

              return (
                <div
                  key={i}
                  onClick={() => !isBlocked && !holdCreando && handleDateClick(fecha)}
                  className={cls}
                  title={promoDia ? promoDia.etiqueta : undefined}
                >
                  <span className="font-bold leading-none">{d}</span>
                  {promoDia ? (
                    <span className="mt-1 self-start rounded-full bg-aventurea-green px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white sm:px-2 sm:py-1 sm:text-[10.5px]">
                      {promoDia.porcentaje_descuento}% off
                    </span>
                  ) : (
                    etiqueta && (
                      <span className="hidden text-[10px] font-bold uppercase leading-none tracking-wide opacity-70 sm:block">
                        {etiqueta}
                      </span>
                    )
                  )}
                  {!isPast && badge !== null && (
                    <span className="absolute right-1.5 top-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-aventurea-navy text-[9.5px] font-bold text-white">
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
              <span className="h-2.5 w-2.5 rounded-[3px] border border-sky-200 bg-sky-50" />
              Reserva temporal (bloqueada)
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-amber-300 bg-amber-50" />
              En aprobación
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-red-200 bg-red-50" />
              Reservada
            </span>
            {Object.keys(promoPorDiaSemana).length > 0 && (
              <span className="flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-aventurea-green" />
                Día con descuento
              </span>
            )}
          </div>
        </div>

        {!selectedDate && (
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-[13px] text-aventurea-ink-soft">
            <IconCalendarLine className="h-4 w-4" />
            Tocá un día disponible para indicar tus invitados, ver el precio y
            reservar la fecha.
          </p>
        )}
      </div>

      {/* El panel de reserva: dentro del modal de vidrio va INLINE
          (reemplaza al calendario — un solo vidrio, un solo scroll);
          en la página suelta sigue siendo el flotante de siempre. */}
      {panelAbierto && selectedDate && (
        <div
          onClick={compacto ? undefined : cerrarPanel}
          className={
            compacto
              ? ""
              : "fixed inset-0 z-[90] flex items-end justify-center bg-aventurea-ink/35 backdrop-blur-md sm:items-center sm:p-6"
          }
        >
          <div
            role="dialog"
            aria-modal={compacto ? undefined : "true"}
            aria-label="Reservar fecha"
            onClick={(e) => e.stopPropagation()}
            className={
              compacto
                ? "panel-solido mx-auto flex w-full max-w-[720px] flex-col overflow-hidden rounded-[22px] border border-aventurea-line bg-aventurea-surface"
                : "flex h-full w-full flex-col overflow-hidden bg-aventurea-surface shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-[560px] sm:rounded-[22px] sm:border sm:border-aventurea-line"
            }
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

            <div
              className={
                compacto
                  ? "px-4 py-3.5 sm:px-5"
                  : "flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
              }
            >
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (paso === 1) {
                    if (puedeAvanzar) setPaso(2);
                    return;
                  }
                  enviarSolicitud(e);
                }}
                className="flex flex-col gap-3.5"
              >
                {/* El camino completo, con la fecha ya lista de primera:
                    saber dónde se está y cuánto falta baja el susto. */}
                <div className="mb-1 flex items-center gap-2">
                  <PasoPill numero={1} activo={false} hecho label="Fecha" />
                  <span className="h-px flex-1 bg-aventurea-line" />
                  <PasoPill numero={2} activo={paso === 1} hecho={paso > 1} label="Tus datos" />
                  <span className="h-px flex-1 bg-aventurea-line" />
                  <PasoPill numero={3} activo={paso === 2} hecho={false} label="Pagar depósito" />
                </div>

                <p className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-[11px] leading-snug text-blue-700">
                  Fecha bloqueada 10 minutos —{" "}
                  {paso === 1 ? "completá tus datos" : "subí el comprobante"} antes
                  de que se acabe el tiempo.
                </p>

                {paso === 1 && (
                  <>
                    {dias[selectedDate] && dias[selectedDate].pendientes > 0 && (
                      <div className="rounded-[10px] bg-aventurea-orange/10 p-3 text-xs leading-relaxed text-aventurea-orange">
                        Ya hay {dias[selectedDate].pendientes} reserva
                        {dias[selectedDate].pendientes > 1 ? "s" : ""} en
                        aprobación para esta fecha. Igual podés reservar la tuya
                        — {nombreRancho} confirma una sola.
                      </div>
                    )}

                    {/* Dos columnas: menos alto, cero scroll. */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {modalidadPrecio === "hora" ? (
                      <div>
                        <label className={labelCls}>Cantidad de horas</label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={horasEvento}
                          onChange={(e) => setHorasEvento(e.target.value)}
                          placeholder="Ej. 5"
                          className={inputCls}
                        />
                      </div>
                    ) : modalidadPrecio === "rango_personas" ? (
                      <div>
                        <label className={labelCls}>
                          Número de invitados
                          {capacidadMax ? ` (máximo ${capacidadMax})` : ""}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={capacidadMax ?? undefined}
                          required
                          value={invitados}
                          onChange={(e) => setInvitados(e.target.value)}
                          placeholder="Ej. 40"
                          className={inputCls}
                        />
                        {excedeCapacidad && (
                          <p className="mt-1.5 text-[12px] font-bold text-red-700">
                            {nombreRancho} recibe hasta {capacidadMax} personas — para
                            grupos más grandes, escribile directo para coordinar.
                          </p>
                        )}
                      </div>
                    ) : null}

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
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-aventurea-line px-3.5 py-2.5">
                      <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Cotización estimada del evento
                      </span>
                      <span className="text-[15px] font-bold text-aventurea-ink">
                        {tierBase !== null
                          ? fmtColones(tierBase)
                          : modalidadPrecio === "hora"
                            ? horasNum
                              ? "Consultar precio por hora"
                              : "— indicá las horas —"
                            : modalidadPrecio === "fijo"
                              ? "Consultar precio del evento"
                              : invitadosNum
                                ? "Cotización personalizada"
                                : "— indicá tus invitados —"}
                      </span>
                    </div>
                    {modalidadPrecio === "rango_personas" && esDiciembre && invitadosNum > 0 && (
                      <p className="-mt-2 text-[11px] text-zinc-500">
                        Tarifa de diciembre: {fmtColones(tarifaDiciembre)} por persona
                      </p>
                    )}

                    {servicios.length > 0 && cotizacionCompleta && (
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelCls}>Nombre completo *</label>
                        <input
                          type="text"
                          required
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          placeholder="Tu nombre"
                          autoComplete="name"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Número de cédula *</label>
                        <input
                          type="text"
                          required
                          value={cedula}
                          onChange={(e) => setCedula(e.target.value)}
                          placeholder="Ej. 1-2345-6789"
                          inputMode="numeric"
                          className={inputCls}
                        />
                        {cedula && !cedulaValida && (
                          <p className="mt-1 text-[11px] font-bold text-red-700">
                            Escribí solo números (y guiones si querés), sin espacios ni letras.
                          </p>
                        )}
                        <p className="mt-1 text-[10.5px] leading-snug text-zinc-500">
                          Privada — solo la ven {nombreRancho} y Bookea.
                        </p>
                      </div>
                      <div>
                        <label className={labelCls}>Correo electrónico *</label>
                        <input
                          type="email"
                          required
                          value={correo}
                          onChange={(e) => setCorreo(e.target.value)}
                          placeholder="tucorreo@ejemplo.com"
                          autoComplete="email"
                          inputMode="email"
                          className={inputCls}
                        />
                        {correo && !correoValido && (
                          <p className="mt-1 text-[11px] font-bold text-red-700">
                            Escribí un correo válido.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>WhatsApp *</label>
                        <input
                          type="tel"
                          required
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          placeholder="+506 8888-8888"
                          autoComplete="tel"
                          inputMode="tel"
                          className={inputCls}
                        />
                        {whatsapp && !whatsappValido && (
                          <p className="mt-1 text-[11px] font-bold text-red-700">
                            Escribí solo números, sin espacios de más.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                        className={`min-h-[44px] ${inputCls}`}
                      />
                    </div>
                    </div>

                    {/* Aviso importante: aparte de los términos generales, esta
                        es la aceptación específica sobre qué NO se alquila. */}
                    <div className="rounded-xl border border-aventurea-orange/30 bg-aventurea-orange/10 p-3">
                      <p className="text-[11.5px] leading-snug text-aventurea-ink">
                        <IconWarning className="mr-1 inline h-3.5 w-3.5 text-aventurea-orange" />
                        <strong>Aviso importante:</strong> este lugar no se
                        alquila para serenatas, fiestas de menores de edad ni
                        fiestas clandestinas donde se venda alcohol. Si se
                        reserva para eso, {nombreRancho} puede cancelarla sin
                        devolución.
                      </p>
                      <label className="mt-2 flex items-start gap-2.5 text-[12px] font-bold text-aventurea-ink">
                        <input
                          type="checkbox"
                          checked={avisoAceptado}
                          onChange={(e) => setAvisoAceptado(e.target.checked)}
                          required
                          className="mt-0.5 h-[17px] w-[17px] accent-aventurea-orange"
                        />
                        Entiendo y confirmo que mi evento no es ninguno de estos.
                      </label>
                    </div>
                  </>
                )}

                {paso === 2 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPaso(1)}
                      className="-mt-1 flex items-center gap-1 self-start text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
                    >
                      ← Volver a mis datos
                    </button>

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

                    {promoAplicable && cotizacionTotal !== null && (
                      <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-aventurea-green">
                        <IconTagLine className="h-3.5 w-3.5" /> {promoAplicable.etiqueta} aplicado (-{fmtColones(descuentoPromoMonto)})
                      </p>
                    )}

                    {/* Total y depósito lado a lado: dos datos, una fila. */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {cotizacionTotal !== null && (
                        <div className="rounded-xl bg-aventurea-cream-2 px-3.5 py-2.5">
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                            Total estimado del evento
                          </span>
                          <span className="flex items-baseline gap-1.5">
                            {descuentoTotalMonto > 0 && (
                              <span className="text-[12px] text-zinc-500 line-through">
                                {fmtColones(cotizacionTotal)}
                              </span>
                            )}
                            <span className="text-[17px] font-bold text-aventurea-ink">
                              {fmtColones(totalFinal ?? cotizacionTotal)}
                            </span>
                            {descuentoTotalMonto > 0 && (
                              <span className="text-[11px] font-bold text-aventurea-green">
                                ahorrás {fmtColones(descuentoTotalMonto)}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      <div className={`rounded-xl bg-aventurea-orange/10 px-3.5 py-2.5 ${cotizacionTotal === null ? "sm:col-span-2" : ""}`}>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-aventurea-orange">
                          Depósito para reservar (se paga ahora)
                        </span>
                        <span className="text-[17px] font-bold text-aventurea-ink">
                          {fmtColones(depositoReserva)}
                        </span>
                      </div>
                    </div>
                    <p className="-mt-1.5 text-[10.5px] leading-snug text-zinc-500">
                      Solo el depósito se paga ahora — el resto de la cotización
                      se coordina para el día del evento.
                    </p>

                    <div>
                      <label className={labelCls}>Realizar pago</label>
                      {metodosReales.length === 0 && (
                        <p className="mb-2.5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                          {nombreRancho} todavía no configuró SINPE ni
                          transferencia. Escribile por el contacto que dejaste
                          para coordinar cómo pagar el depósito — abajo podés
                          ver cómo se vería pagar con tarjeta más adelante.
                        </p>
                      )}
                      <select
                        required
                        value={metodoPago}
                        onChange={(e) => setMetodoPago(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Selecciona una opción</option>
                        {metodosDisponibles.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>

                      {metodoPago === "sinpe" && sinpeNumero && (
                        <div className="mt-2.5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3.5">
                          <CampoCopiable etiqueta="Número SINPE" valor={sinpeNumero} />
                          {sinpeTitular && (
                            <CampoCopiable etiqueta="A nombre de" valor={sinpeTitular} />
                          )}
                        </div>
                      )}

                      {metodoPago === "transferencia" && cuentaNumero && (
                        <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3.5">
                          {cuentaBanco && (
                            <CampoCopiable etiqueta="Banco" valor={cuentaBanco} />
                          )}
                          <CampoCopiable etiqueta="Cuenta / IBAN" valor={cuentaNumero} />
                          {cuentaTipo && (
                            <CampoCopiable
                              etiqueta="Tipo"
                              valor={cuentaTipo === "ahorro" ? "Ahorro" : "Corriente"}
                            />
                          )}
                          {cuentaTitular && (
                            <CampoCopiable etiqueta="A nombre de" valor={cuentaTitular} />
                          )}
                        </div>
                      )}

                      {metodoPago === "tarjeta" && (
                        <TarjetaVistaPrevia monto={depositoReserva} nombreRancho={nombreRancho} />
                      )}
                    </div>

                    {/* Sin método real elegido no hay nada que pagar ni que
                        comprobar — mostrar el resto del formulario
                        (comprobante, términos, botón siempre gris) solo
                        confunde y no lleva a ningún lado. */}
                    {(metodoPago === "sinpe" || metodoPago === "transferencia") && (
                      <>
                        <p className="flex items-start gap-1.5 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 p-3 text-[11.5px] leading-relaxed text-aventurea-ink-soft">
                          <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-aventurea-orange" />
                          Depositá exactamente {fmtColones(depositoReserva)}. Si el
                          comprobante muestra un monto menor, la reserva no queda
                          válida y el dinero no se reembolsa.
                        </p>

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
                      </>
                    )}
                  </>
                )}

                {submitError && (
                  <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">
                    {submitError}
                  </p>
                )}

                {paso === 1 ? (
                  <button
                    type="submit"
                    disabled={!puedeAvanzar}
                    className="rounded-xl bg-aventurea-orange py-3 text-center text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
                  >
                    Siguiente: pagar el depósito →
                  </button>
                ) : metodoPago === "tarjeta" ? (
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-xl bg-aventurea-cream-2 py-3 text-center text-[14px] font-bold text-aventurea-ink-soft"
                  >
                    Pago con tarjeta — próximamente
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || !puedeEnviar}
                    className="rounded-xl bg-aventurea-orange py-3 text-center text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
                  >
                    {submitting ? "Enviando..." : "Confirmar mi reserva"}
                  </button>
                )}
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

function PasoPill({
  numero,
  label,
  activo,
  hecho,
}: {
  numero: number;
  label: string;
  activo: boolean;
  hecho: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        activo
          ? "bg-aventurea-orange text-white"
          : hecho
            ? "bg-aventurea-green/15 text-aventurea-green"
            : "bg-aventurea-cream-2 text-aventurea-ink-soft"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
          activo ? "bg-white/25" : hecho ? "bg-aventurea-green/20" : "bg-white"
        }`}
      >
        {hecho ? "✓" : numero}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

/** Un dato de cobro con botón de copiar — para que el cliente no tenga
 * que transcribir a mano el número de SINPE o la cuenta. */
function CampoCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin acceso al portapapeles (permiso denegado, http sin TLS...) el
      // dato sigue visible en pantalla para copiarlo a mano.
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          {etiqueta}
        </p>
        <p className="truncate text-[13.5px] font-bold text-aventurea-ink">{valor}</p>
      </div>
      <button
        type="button"
        onClick={copiar}
        className="shrink-0 rounded-lg border border-aventurea-line bg-aventurea-surface px-2.5 py-1.5 text-[11px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
      >
        {copiado ? "✓ Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/**
 * Vista previa de cómo se vería pagar con tarjeta — no procesa nada
 * real todavía (Bookea hoy solo recibe comprobantes de SINPE o
 * transferencia). Los campos son decorativos a propósito: por eso el
 * botón de confirmar queda deshabilitado mientras esta opción esté
 * elegida.
 */
function TarjetaVistaPrevia({ monto, nombreRancho }: { monto: number; nombreRancho: string }) {
  const [numero, setNumero] = useState("");
  const [venc, setVenc] = useState("");
  const [cvv, setCvv] = useState("");

  return (
    <div className="mt-2.5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3.5">
      <p className="mb-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-aventurea-orange">
        <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Vista previa — todavía no procesamos pagos con tarjeta. Elegí SINPE o
        transferencia arriba para completar tu reserva.
      </p>

      <div className="relative aspect-[1.586/1] w-full max-w-[280px] overflow-hidden rounded-xl bg-gradient-to-br from-aventurea-navy to-aventurea-navy-2 p-4 text-white shadow-lg">
        <div className="text-[10px] font-bold uppercase tracking-wide text-white/60">
          Bookea Pay
        </div>
        <div className="mt-6 text-[15px] font-bold tracking-[0.12em] tabular-nums">
          {numero ? numero.padEnd(19, "•") : "•••• •••• •••• ••••"}
        </div>
        <div className="mt-4 flex items-center justify-between text-[10.5px] text-white/70">
          <span>{venc || "MM/AA"}</span>
          <span className="font-bold uppercase tracking-wide">Débito / Crédito</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        <input
          type="text"
          inputMode="numeric"
          maxLength={19}
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="Número de tarjeta"
          className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-surface px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:text-zinc-500"
        />
        <div className="grid grid-cols-2 gap-2.5">
          <input
            type="text"
            maxLength={5}
            value={venc}
            onChange={(e) => setVenc(e.target.value)}
            placeholder="MM/AA"
            className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-surface px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:text-zinc-500"
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="CVV"
            className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-surface px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-aventurea-surface p-3">
        <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Si se cobrara 15% por pagar con tarjeta
        </p>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-aventurea-ink-soft">Monto a pagar</span>
          <span className="font-bold text-aventurea-ink">{fmtColones(monto)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-aventurea-ink-soft">Comisión Bookea (15%)</span>
          <span className="font-bold text-aventurea-orange">{fmtColones(monto * 0.15)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-aventurea-line pt-1.5 text-[13px]">
          <span className="text-aventurea-ink-soft">Le llega a {nombreRancho}</span>
          <span className="font-bold text-aventurea-green">{fmtColones(monto * 0.85)}</span>
        </div>
      </div>
    </div>
  );
}
