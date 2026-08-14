"use client";

import { useState, useTransition } from "react";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export type ReservaManualInput = {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  nombre: string;
  tipo_evento: string;
  invitados: string;
  notas: string;
  montoTotal: string;
  depositoMonto: string;
  depositoRecibido: boolean;
  eventoPagado: boolean;
};

const VACIO: ReservaManualInput = {
  fecha: "",
  horaInicio: "",
  horaFin: "",
  nombre: "",
  tipo_evento: "",
  invitados: "",
  notas: "",
  montoTotal: "",
  depositoMonto: "",
  depositoRecibido: false,
  eventoPagado: false,
};

/**
 * Para cargar a mano una reserva que llegó por teléfono o en persona —
 * queda confirmada de una vez, sin depósito ni comprobante en línea.
 * Los montos sí se piden: sin eso, la reserva no cuenta para nada en
 * el panel de Finanzas y el control económico del negocio queda cojo.
 *
 * Y la HORA se pide a quien trabaja por horas (`pideHora`, que sale de
 * `ocupaFranjaHoraria` en el servidor). No es un campo cosmético: sin
 * `hora_inicio` la reserva no entra en `disponibilidad_citas` y la
 * agenda pública del proveedor le sigue ofreciendo esa fecha al
 * siguiente cliente. A un lugar de alquiler no se le muestra: alquila
 * la fecha entera y su horario es texto libre.
 */
export default function ReservaManualForm({
  capacidadMax,
  onCrear,
  fechaFija,
  onCancelar,
  pideHora = false,
}: {
  capacidadMax: number | null;
  onCrear: (input: {
    fecha: string;
    horaInicio: string | null;
    horaFin: string | null;
    nombre: string;
    tipo_evento: string;
    invitados: number | null;
    notas: string | null;
    montoTotal: number;
    depositoMonto: number;
    depositoRecibido: boolean;
    eventoPagado: boolean;
  }) => Promise<{ error: string | null }>;
  /** Con esto el formulario nace abierto y con la fecha ya fija (no
   *  editable) — así el panel de un día del calendario carga una
   *  reserva sin volver a elegir la fecha que ya se clickeó. */
  fechaFija?: string;
  /** Solo aplica junto con `fechaFija`: acá no hay botón propio de
   *  colapsar, así que "Cerrar" delega en quien lo incrusta. */
  onCancelar?: () => void;
  /** El negocio agenda por FRANJAS (proveedor de eventos, citas,
   *  restaurante): la hora de inicio es obligatoria. */
  pideHora?: boolean;
}) {
  const [datos, setDatos] = useState(fechaFija ? { ...VACIO, fecha: fechaFija } : VACIO);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [abierto, setAbierto] = useState(!!fechaFija);

  function set<K extends keyof ReservaManualInput>(campo: K, valor: ReservaManualInput[K]) {
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
    // El servidor lo vuelve a comprobar (resolverHorarioReserva); esto
    // es para no hacerle dar el viaje al dueño.
    if (pideHora && !datos.horaInicio.trim()) {
      setError(
        "Poné la hora de inicio: tu agenda se reserva por horas y sin ella esta fecha no le tapa ninguna hora a los clientes.",
      );
      return;
    }
    // Los invitados son obligatorios: sin ellos la reserva no cuenta
    // para la ocupación ni para lo que cobra la plataforma por persona.
    const invitadosNum = datos.invitados.trim() ? Number(datos.invitados) : null;
    if (invitadosNum === null) {
      setError("Indicá para cuántos invitados es la reserva.");
      return;
    }
    if (!Number.isFinite(invitadosNum) || invitadosNum <= 0) {
      setError("La cantidad de invitados no es válida.");
      return;
    }
    if (capacidadMax && invitadosNum && invitadosNum > capacidadMax) {
      setError(`Este lugar recibe hasta ${capacidadMax} personas.`);
      return;
    }
    const montoTotalNum = Number(datos.montoTotal);
    if (!datos.montoTotal.trim() || !Number.isFinite(montoTotalNum) || montoTotalNum <= 0) {
      setError("Ingresá cuánto vale el evento.");
      return;
    }
    const depositoMontoNum = datos.depositoMonto.trim() ? Number(datos.depositoMonto) : 0;
    if (!Number.isFinite(depositoMontoNum) || depositoMontoNum < 0) {
      setError("El adelanto no puede ser negativo.");
      return;
    }
    if (depositoMontoNum > montoTotalNum) {
      setError("El adelanto no puede ser mayor que el total del evento.");
      return;
    }

    startTransition(async () => {
      const res = await onCrear({
        fecha: datos.fecha,
        // Un lugar de alquiler nunca ve estos campos: manda null y su
        // reserva se guarda exactamente como siempre.
        horaInicio: pideHora ? datos.horaInicio.trim() || null : null,
        horaFin: pideHora ? datos.horaFin.trim() || null : null,
        nombre: datos.nombre.trim(),
        tipo_evento: datos.tipo_evento.trim(),
        invitados: invitadosNum,
        notas: datos.notas.trim() || null,
        montoTotal: montoTotalNum,
        depositoMonto: depositoMontoNum,
        depositoRecibido: datos.depositoRecibido,
        eventoPagado: datos.eventoPagado,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDatos(fechaFija ? { ...VACIO, fecha: fechaFija } : VACIO);
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
          onClick={() => (fechaFija ? onCancelar?.() : setAbierto(false))}
          className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          Cerrar
        </button>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Para cuando alguien reserva por teléfono o en persona. Queda confirmada
        directamente, sin comprobante — pero los montos sí se guardan, para que
        cuente igual en Finanzas.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Fecha</label>
          <input
            type="date"
            value={datos.fecha}
            onChange={(e) => set("fecha", e.target.value)}
            disabled={!!fechaFija}
            className={`${inputCls} ${fechaFija ? "opacity-70" : ""}`}
          />
        </div>
        {/* La hora, solo para quien trabaja por horas. Sin ella la
            reserva no le tapa la franja a nadie en la agenda pública. */}
        {pideHora && (
          <>
            <div>
              <label className={labelCls}>Hora de inicio *</label>
              <input
                type="time"
                required
                value={datos.horaInicio}
                onChange={(e) => set("horaInicio", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Hora de cierre</label>
              <input
                type="time"
                value={datos.horaFin}
                onChange={(e) => set("horaFin", e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-[11.5px] leading-snug text-aventurea-ink-soft">
                Si la dejás en blanco se toma el mismo bloque que asume tu
                agenda pública.
              </p>
            </div>
          </>
        )}
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
            Invitados * {capacidadMax ? `(máximo ${capacidadMax})` : ""}
          </label>
          <input
            type="number"
            min={1}
            max={capacidadMax ?? undefined}
            required
            value={datos.invitados}
            onChange={(e) => set("invitados", e.target.value)}
            placeholder="Ej. 40"
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-aventurea-cream-2 p-3.5">
        <p className="mb-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Plata del evento
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Monto total del evento (₡)</label>
            <input
              type="number"
              min={0}
              value={datos.montoTotal}
              onChange={(e) => set("montoTotal", e.target.value)}
              placeholder="Ej. 350000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Adelanto acordado (₡)</label>
            <input
              type="number"
              min={0}
              value={datos.depositoMonto}
              onChange={(e) => set("depositoMonto", e.target.value)}
              placeholder="0 si no se pidió"
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[12.5px] font-bold text-aventurea-ink">
            <input
              type="checkbox"
              checked={datos.depositoRecibido}
              onChange={(e) => set("depositoRecibido", e.target.checked)}
              className="h-4 w-4 rounded border-aventurea-line"
            />
            Ya recibí el adelanto
          </label>
          <label className="flex items-center gap-2 text-[12.5px] font-bold text-aventurea-ink">
            <input
              type="checkbox"
              checked={datos.eventoPagado}
              onChange={(e) => set("eventoPagado", e.target.checked)}
              className="h-4 w-4 rounded border-aventurea-line"
            />
            Ya me pagaron el evento completo
          </label>
        </div>
      </div>

      <div className="mt-4">
        <label className={labelCls}>Notas</label>
        <textarea
          value={datos.notas}
          onChange={(e) => set("notas", e.target.value)}
          placeholder="Opcional"
          rows={2}
          className={inputCls}
        />
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
        className="mt-4 rounded-xl bg-aventurea-sky px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Confirmar reserva"}
      </button>
    </div>
  );
}
