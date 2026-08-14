"use client";

import { useState, useTransition } from "react";
import { hoyISOCR } from "@/lib/fechas";
import { formatearHora } from "@/lib/agenda/importar-agenda";
import ReservaManualForm from "./reserva-manual-form";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fechaLarga(isoFecha: string) {
  const [y, m, d] = isoFecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function colones(n: number | null) {
  return n === null ? null : "₡" + Number(n).toLocaleString("es-CR");
}

export type DiaOcupado = {
  id: string;
  fecha: string;
  estado: string;
  nombre: string | null;
  tipo_evento?: string | null;
  invitados?: number | null;
  notas?: string | null;
  montoTotal?: number | null;
  depositoMonto?: number | null;
  horarioBloque?: string | null;
  /** "HH:MM[:SS]" — lo que de verdad le tapa la franja a la agenda
   *  pública. Un lugar de alquiler no lo lleva. */
  horaInicio?: string | null;
};

/** Lo que acepta `actualizarReservaManual` (la fecha no se toca acá). */
export type ReservaEditable = {
  nombre: string;
  tipo_evento: string | null;
  invitados: number | null;
  notas: string | null;
  montoTotal: number | null;
  depositoMonto: number | null;
  horarioBloque: string | null;
};

/** Lo que acepta `crearReservaManual`. */
export type ReservaNueva = {
  fecha: string;
  /** "HH:MM" — obligatoria donde se agenda por franjas (ver `pideHora`). */
  horaInicio: string | null;
  /** "HH:MM" de cierre; opcional. */
  horaFin: string | null;
  nombre: string;
  tipo_evento: string;
  invitados: number | null;
  notas: string | null;
  montoTotal: number;
  depositoMonto: number;
  depositoRecibido: boolean;
  eventoPagado: boolean;
};

type Resultado = { error: string | null };

const ETIQUETA: Record<string, { texto: string; cls: string }> = {
  confirmada: { texto: "Confirmada", cls: "bg-red-50 text-red-700" },
  pendiente: { texto: "En aprobación", cls: "bg-amber-50 text-amber-800" },
  bloqueada: { texto: "Bloqueado", cls: "bg-zinc-100 text-zinc-600" },
};

/**
 * Calendario mensual de ocupación, y el lugar desde donde se maneja la
 * agenda del día a día.
 *
 * Antes era de solo lectura: se veía qué días estaban tomados y para
 * tocar algo había que irse a otra pantalla. Ahora se toca un día y
 * ahí mismo se confirma, se corrige o se cancela lo que haya — que es
 * como se trabaja cuando alguien llama para mover su fiesta.
 *
 * Si no se le pasan acciones, se comporta como antes (solo lectura):
 * así la misma pieza sirve para una vista donde nadie puede editar.
 */
export default function OcupacionCalendario({
  dias,
  onConfirmar,
  onCancelar,
  onEditar,
  onMover,
  onCrear,
  capacidadMax = null,
  pideHora = false,
}: {
  dias: DiaOcupado[];
  onConfirmar?: (reservaId: string) => Promise<Resultado>;
  onCancelar?: (reservaId: string) => Promise<Resultado>;
  onEditar?: (reservaId: string, datos: ReservaEditable) => Promise<Resultado>;
  /** Mover una reserva (o un bloqueo) a otra fecha. */
  onMover?: (reservaId: string, nuevaFecha: string) => Promise<Resultado>;
  /** Con esto, el panel del día deja cargar una reserva nueva sin salir
   *  del calendario — la fecha ya viene puesta, es la que se clickeó. */
  onCrear?: (datos: ReservaNueva) => Promise<Resultado>;
  capacidadMax?: number | null;
  /** El negocio agenda por FRANJAS (un proveedor de eventos, una mesa):
   *  la reserva que se carga desde acá necesita hora de inicio o no le
   *  tapa la franja a nadie en la agenda pública. */
  pideHora?: boolean;
}) {
  const hoy = hoyISOCR();
  const [y0, m0] = hoy.split("-").map(Number);
  const [viewYear, setViewYear] = useState(y0);
  const [viewMonth, setViewMonth] = useState(m0 - 1);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);

  const editable = Boolean(onConfirmar || onCancelar || onEditar || onMover);

  // Un mismo día puede tener varias reservas (un bloqueo y una fiesta,
  // o dos eventos si el negocio admite más de uno por día), así que se
  // agrupa en lista y no en un solo valor por fecha.
  const porFecha = new Map<string, DiaOcupado[]>();
  for (const d of dias) {
    const lista = porFecha.get(d.fecha);
    if (lista) lista.push(d);
    else porFecha.set(d.fecha, [d]);
  }

  /** Lo confirmado manda sobre lo pendiente, y eso sobre un bloqueo. */
  function estadoDelDia(lista: DiaOcupado[]): string {
    if (lista.some((r) => r.estado === "confirmada")) return "confirmada";
    if (lista.some((r) => r.estado === "pendiente")) return "pendiente";
    return "bloqueada";
  }

  function cambiarMes(dir: number) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    setSeleccion(null);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const delDia = seleccion ? (porFecha.get(seleccion) ?? []) : [];

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold capitalize text-aventurea-ink">
          {MESES[viewMonth]} {viewYear}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-[15px] text-aventurea-ink hover:border-aventurea-navy"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-[15px] text-aventurea-ink hover:border-aventurea-navy"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5">
        {DOW.map((d, i) => (
          <div
            key={i}
            className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
          >
            {d}
          </div>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const fecha = iso(viewYear, viewMonth, d);
          const lista = porFecha.get(fecha);
          const estado = lista ? estadoDelDia(lista) : null;
          const esHoy = fecha === hoy;
          const elegido = fecha === seleccion;

          let cls =
            "relative flex min-h-[40px] flex-col items-center justify-center rounded-lg text-[12.5px] transition-colors sm:min-h-[52px] sm:text-[13.5px]";
          if (estado === "confirmada") cls += " bg-red-100 font-bold text-red-700";
          else if (estado === "pendiente") cls += " bg-amber-100 font-bold text-amber-800";
          else if (estado === "bloqueada") cls += " bg-aventurea-cream-2 font-bold text-aventurea-ink-soft";
          else cls += " border border-aventurea-line text-aventurea-ink-soft";
          if (esHoy) cls += " ring-1 ring-aventurea-sky";
          // El día abierto se marca con un anillo grueso, que se lee
          // igual sobre cualquiera de los cuatro fondos.
          if (elegido) cls += " ring-2 ring-aventurea-navy ring-offset-1 ring-offset-aventurea-surface";

          if (!editable) {
            return (
              <div key={i} className={cls} title={lista?.[0]?.nombre ?? undefined}>
                {d}
              </div>
            );
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSeleccion(elegido ? null : fecha);
                setAgregando(false);
              }}
              aria-pressed={elegido}
              aria-label={`${fechaLarga(fecha)}${
                lista ? ` — ${lista.length} reserva${lista.length === 1 ? "" : "s"}` : " — libre"
              }`}
              className={`${cls} cursor-pointer hover:ring-2 hover:ring-white/60`}
            >
              {d}
              {lista && lista.length > 1 && (
                <span className="text-[9px] font-bold leading-none opacity-70">
                  {lista.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-[11.5px] text-aventurea-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Confirmada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> En aprobación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-aventurea-cream-2 ring-1 ring-inset ring-aventurea-line" /> Bloqueado / agenda externa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-aventurea-line" /> Libre
        </span>
      </div>

      {editable && (
        <p className="mt-3 text-[12px] text-aventurea-ink-soft">
          Tocá un día para ver lo que hay y confirmarlo, corregirlo o cancelarlo.
        </p>
      )}

      {seleccion && (
        <div className="mt-4 rounded-2xl bg-aventurea-cream-2 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] font-bold capitalize text-aventurea-ink">
              {fechaLarga(seleccion)}
            </p>
            <button
              type="button"
              onClick={() => {
                setSeleccion(null);
                setAgregando(false);
              }}
              className="shrink-0 text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
            >
              Cerrar
            </button>
          </div>

          {delDia.length === 0 && !onCrear && (
            <p className="mt-2 text-[13px] text-aventurea-ink-soft">
              Este día está libre. Podés cargar una reserva con el formulario de
              más abajo.
            </p>
          )}

          {delDia.length > 0 && (
            <div className="mt-3 flex flex-col gap-3">
              {delDia.map((r) => (
                <FilaReserva
                  key={r.id}
                  reserva={r}
                  onConfirmar={onConfirmar}
                  onCancelar={onCancelar}
                  onMover={onMover}
                  onEditar={onEditar}
                />
              ))}
            </div>
          )}

          {/* Cargar una reserva sin salir del calendario: la fecha ya
              es la que se clickeó, no hay que volver a elegirla. */}
          {onCrear &&
            (agregando ? (
              <div className="mt-3">
                <ReservaManualForm
                  capacidadMax={capacidadMax}
                  onCrear={onCrear}
                  fechaFija={seleccion}
                  pideHora={pideHora}
                  onCancelar={() => setAgregando(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAgregando(true)}
                className="mt-3 rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-navy hover:text-aventurea-navy"
              >
                + Agregar {delDia.length > 0 ? "otra reserva" : "una reserva"} este día
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** Una reserva del día abierto: su resumen y lo que se puede hacer con ella. */
function FilaReserva({
  reserva,
  onConfirmar,
  onCancelar,
  onEditar,
  onMover,
}: {
  reserva: DiaOcupado;
  onConfirmar?: (reservaId: string) => Promise<Resultado>;
  onCancelar?: (reservaId: string) => Promise<Resultado>;
  onEditar?: (reservaId: string, datos: ReservaEditable) => Promise<Resultado>;
  onMover?: (reservaId: string, nuevaFecha: string) => Promise<Resultado>;
}) {
  const [editando, setEditando] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  // Cancelar pide un segundo clic en vez de un confirm() del navegador:
  // liberar un día por accidente se arregla volviendo a cargar la
  // reserva a mano, y eso nadie quiere hacerlo un sábado.
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const badge = ETIQUETA[reserva.estado] ?? {
    texto: reserva.estado,
    cls: "bg-aventurea-cream-2 text-aventurea-ink-soft",
  };

  function correr(accion: () => Promise<Resultado>) {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res.error) setError(res.error);
      else {
        setEditando(false);
        setConfirmandoBaja(false);
        setMoviendo(false);
      }
    });
  }

  const detalle = [
    reserva.tipo_evento,
    reserva.invitados ? `${reserva.invitados} personas` : null,
    // El texto del bloque manda si lo hay; si no, la hora de inicio
    // suelta — una reserva por franja sin hora de cierre igual tiene
    // que verse a qué hora es.
    reserva.horarioBloque ??
      (reserva.horaInicio ? formatearHora(reserva.horaInicio.slice(0, 5)) : null),
    colones(reserva.montoTotal ?? null),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl border border-aventurea-line bg-aventurea-surface p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] font-bold text-aventurea-ink">
          {reserva.nombre ?? "Sin nombre"}
        </p>
        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}>
          {badge.texto}
        </span>
      </div>
      {detalle && (
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">{detalle}</p>
      )}
      {reserva.notas && (
        <p className="mt-1 text-[12px] italic text-aventurea-ink-soft">{reserva.notas}</p>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">
          {error}
        </p>
      )}

      {editando && onEditar ? (
        <FormularioReserva
          reserva={reserva}
          pendiente={pendiente}
          onCancelarEdicion={() => setEditando(false)}
          onGuardar={(datos) => correr(() => onEditar(reserva.id, datos))}
        />
      ) : moviendo && onMover ? (
        <FormularioMover
          fechaActual={reserva.fecha}
          pendiente={pendiente}
          onCancelarMovida={() => setMoviendo(false)}
          onMover={(nuevaFecha) => correr(() => onMover(reserva.id, nuevaFecha))}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {onConfirmar && reserva.estado === "pendiente" && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => onConfirmar(reserva.id))}
              className="rounded-xl bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
            >
              Confirmar
            </button>
          )}
          {onEditar && reserva.estado !== "bloqueada" && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => setEditando(true)}
              className="rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50"
            >
              Modificar
            </button>
          )}
          {onMover && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => setMoviendo(true)}
              className="rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50"
            >
              Mover
            </button>
          )}
          {onCancelar &&
            (confirmandoBaja ? (
              <>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => correr(() => onCancelar(reserva.id))}
                  className="rounded-xl bg-red-600 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {pendiente ? "Cancelando…" : "Sí, cancelar y liberar el día"}
                </button>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => setConfirmandoBaja(false)}
                  className="rounded-xl border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft disabled:opacity-50"
                >
                  Mejor no
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => setConfirmandoBaja(true)}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-[12.5px] font-bold text-red-700 transition-colors hover:border-red-400 disabled:opacity-50"
              >
                {reserva.estado === "bloqueada" ? "Liberar el día" : "Cancelar"}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * El formulario de corrección. La FECHA no está: mover una reserva de
 * día cambia el cupo, puede chocar con otra confirmada y afecta al
 * cliente — es otra operación, no un campo más de este formulario. Esa
 * operación es `FormularioMover`, más abajo.
 */
function FormularioReserva({
  reserva,
  pendiente,
  onGuardar,
  onCancelarEdicion,
}: {
  reserva: DiaOcupado;
  pendiente: boolean;
  onGuardar: (datos: ReservaEditable) => void;
  onCancelarEdicion: () => void;
}) {
  const numero = (v: FormDataEntryValue | null): number | null => {
    const t = String(v ?? "").trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const texto = (v: FormDataEntryValue | null): string | null => {
    const t = String(v ?? "").trim();
    return t || null;
  };

  const campo =
    "w-full rounded-xl border border-aventurea-line bg-aventurea-surface px-3 py-2 text-[13px] text-aventurea-ink";
  const rotulo = "text-[11.5px] font-bold text-aventurea-ink-soft";

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onGuardar({
          nombre: String(f.get("nombre") ?? "").trim(),
          tipo_evento: texto(f.get("tipo_evento")),
          invitados: numero(f.get("invitados")),
          notas: texto(f.get("notas")),
          montoTotal: numero(f.get("montoTotal")),
          depositoMonto: numero(f.get("depositoMonto")),
          horarioBloque: texto(f.get("horarioBloque")),
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className={rotulo}>Nombre de quien reserva</span>
        <input name="nombre" defaultValue={reserva.nombre ?? ""} required className={campo} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Tipo de evento</span>
          <input name="tipo_evento" defaultValue={reserva.tipo_evento ?? ""} className={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Personas</span>
          <input
            name="invitados"
            type="number"
            min={0}
            defaultValue={reserva.invitados ?? ""}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Horario</span>
          <input
            name="horarioBloque"
            defaultValue={reserva.horarioBloque ?? ""}
            placeholder="Ej: 2 p. m. a 10 p. m."
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Total del evento (₡)</span>
          <input
            name="montoTotal"
            type="number"
            min={0}
            defaultValue={reserva.montoTotal ?? ""}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Adelanto (₡)</span>
          <input
            name="depositoMonto"
            type="number"
            min={0}
            defaultValue={reserva.depositoMonto ?? ""}
            className={campo}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={rotulo}>Notas</span>
        <textarea name="notas" rows={2} defaultValue={reserva.notas ?? ""} className={campo} />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={onCancelarEdicion}
          className="rounded-xl border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
    </form>
  );
}

/** Elegir la fecha nueva y mover — el cupo del día se revisa en el
 *  servidor, así que acá solo hace falta la fecha. */
function FormularioMover({
  fechaActual,
  pendiente,
  onMover,
  onCancelarMovida,
}: {
  fechaActual: string;
  pendiente: boolean;
  onMover: (nuevaFecha: string) => void;
  onCancelarMovida: () => void;
}) {
  const [nuevaFecha, setNuevaFecha] = useState(fechaActual);
  const campo =
    "w-full rounded-xl border border-aventurea-line bg-aventurea-surface px-3 py-2 text-[13px] text-aventurea-ink";

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (nuevaFecha && nuevaFecha !== fechaActual) onMover(nuevaFecha);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11.5px] font-bold text-aventurea-ink-soft">
          Mover al día
        </span>
        <input
          type="date"
          value={nuevaFecha}
          onChange={(e) => setNuevaFecha(e.target.value)}
          className={campo}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente || !nuevaFecha || nuevaFecha === fechaActual}
          className="rounded-xl bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
        >
          {pendiente ? "Moviendo…" : "Mover reserva"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={onCancelarMovida}
          className="rounded-xl border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
    </form>
  );
}
