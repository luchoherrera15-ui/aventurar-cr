"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  EncabezadoPagina,
  InsigniaEstado,
  NotaDemo,
  NotaEstimacion,
} from "@/components/food/panel";
import { BOTON_PANEL_PRIMARIO, EYEBROW_NEUTRO, ROTULO_CAMPO } from "@/components/panel/sistema";
import { IconPlus, IconUsers, IconX } from "@/components/icons";
import { fechaCorta, horaCorta } from "@/lib/food/tipos";
import { sumarDiasISO } from "@/lib/fechas";
import { formatearCRC } from "@/lib/dinero";
import { hacerCheckInPorId, marcarNoShow } from "../panel-actions";
import { cancelarReservaDelNegocio } from "./actions";
import CalendarioReservas from "./calendario-reservas";
import NuevaReserva from "./nueva-reserva";
import {
  cumpleFiltros,
  hayFiltrosActivos,
  OPCIONES_ESTADO,
  OPCIONES_FRANJA,
  OPCIONES_PERSONAS,
  type EstadoReservaPanel,
  type FiltrosReservas,
  type FranjaDisponible,
  type ReservaPanelFila,
} from "./tipos";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  RESERVAS — la pantalla interactiva
 * ═══════════════════════════════════════════════════════════════════
 *
 * Recibe TODO ya resuelto por props desde page.tsx (filas unificadas
 * reales+demo, filtros leídos del querystring, franjas futuras) y se
 * encarga solo de pintar y de las interacciones: abrir el detalle,
 * anotar una reserva nueva, cambiar filtros y vista.
 *
 * DÓNDE VIVE EL ESTADO: en la URL. Filtros, vista (lista/calendario)
 * y el día ancla del calendario son querystring — cambiar un filtro es
 * un router.replace y el Server Component rehace el trabajo. El único
 * estado local es efímero: qué dialog está abierto y los "overrides"
 * de estado (el cambio optimista tras una acción real, o el cambio
 * simulado de una reserva de ejemplo).
 *
 * REGLA CON LAS DEMO: sus acciones funcionan (para que el dueño sienta
 * el flujo completo) pero solo mutan estado local y el detalle lo dice
 * con todas las letras — jamás tocan la base ni fingen persistir.
 */

const ORDEN_ASC = (a: ReservaPanelFila, b: ReservaPanelFila) =>
  (a.fecha + a.hora).localeCompare(b.fecha + b.hora);
const ORDEN_DESC = (a: ReservaPanelFila, b: ReservaPanelFila) =>
  (b.fecha + b.hora).localeCompare(a.fecha + a.hora);

/** "2026-08-21" → "jue" (día de semana corto, es-CR). */
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function diaSemanaDe(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return DIAS_CORTOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export default function ReservasCliente({
  negocioId,
  hoy,
  filas,
  filtros,
  vista,
  cal,
  ancla,
  franjas,
}: {
  negocioId: string;
  hoy: string;
  filas: ReservaPanelFila[];
  filtros: FiltrosReservas;
  vista: "lista" | "calendario";
  cal: "dia" | "semana" | "mes";
  ancla: string;
  franjas: FranjaDisponible[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Overrides de estado por id: la acción real actualiza optimista
  // (y además refresca al servidor); la demo solo vive acá.
  const [overrides, setOverrides] = useState<Record<string, EstadoReservaPanel>>({});
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

  /** Cambia parámetros del querystring conservando el resto (incluido
   *  el ?rango= de la topbar). null = borrar el parámetro. */
  const actualizarParams = (cambios: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") params.delete(clave);
      else params.set(clave, valor);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const filasEfectivas = useMemo(
    () =>
      filas.map((f) => {
        const nuevo = overrides[f.id];
        return nuevo ? { ...f, estado: nuevo } : f;
      }),
    [filas, overrides],
  );
  const filtradas = useMemo(
    () => filasEfectivas.filter((f) => cumpleFiltros(f, filtros)),
    [filasEfectivas, filtros],
  );

  // Los grupos de la lista. "Hoy" agarra TODO lo de hoy (el estado se
  // ve en la tarjeta); el resto se reparte por ciclo de vida.
  const deHoy = filtradas.filter((f) => f.fecha === hoy).sort(ORDEN_ASC);
  const proximas = filtradas
    .filter((f) => f.fecha > hoy && (f.estado === "confirmada" || f.estado === "pendiente"))
    .sort(ORDEN_ASC);
  const completadas = filtradas
    .filter((f) => f.fecha < hoy && (f.estado === "completada" || f.estado === "check_in"))
    .sort(ORDEN_DESC);
  const canceladas = filtradas
    .filter((f) => f.estado === "cancelada" && f.fecha !== hoy)
    .sort(ORDEN_DESC);
  const noShows = filtradas
    .filter((f) => f.estado === "no_show" && f.fecha !== hoy)
    .sort(ORDEN_DESC);

  const detalle = detalleId ? filasEfectivas.find((f) => f.id === detalleId) ?? null : null;

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Reservas"
        descripcion="Todas las reservas que Bookea le trae a tu restaurante, de hoy en adelante y hacia atrás."
        acciones={
          <button
            type="button"
            onClick={() => setNuevaAbierta(true)}
            className={BOTON_PANEL_PRIMARIO}
          >
            <IconPlus className="h-4 w-4" aria-hidden />
            Nueva reserva
          </button>
        }
      />

      {/* ── Vista: Lista | Calendario ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Botones con aria-pressed y no un tablist ARIA: el patrón de
            tabs exige manejo de flechas que acá no existe, y un patrón
            a medias confunde más al lector de pantalla que un par de
            botones honestos (mismo criterio que el selector del
            calendario). */}
        <div
          aria-label="Vista de reservas"
          className="inline-flex rounded-xl border border-aventurea-line bg-white p-1"
        >
          {(
            [
              { valor: "lista", label: "Lista" },
              { valor: "calendario", label: "Calendario" },
            ] as const
          ).map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={vista === t.valor}
              onClick={() =>
                actualizarParams(
                  t.valor === "lista"
                    ? { vista: null, cal: null, dia: null }
                    : { vista: "calendario" },
                )
              }
              className={`rounded-lg px-4 py-1.5 text-[12.5px] font-bold transition-colors ${
                vista === t.valor
                  ? "bg-aventurea-navy text-white"
                  : "text-aventurea-ink-soft hover:text-aventurea-navy"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <NotaDemo />
      </div>

      {vista === "calendario" ? (
        <CalendarioReservas
          filas={filasEfectivas}
          franjas={franjas}
          hoy={hoy}
          ancla={ancla}
          modo={cal}
          alNavegar={actualizarParams}
        />
      ) : (
        <>
          <BarraFiltros filtros={filtros} alCambiar={actualizarParams} />

          {/* ── HOY: tarjetas grandes, es la sección operativa ─────── */}
          <section aria-label="Reservas de hoy">
            <EncabezadoSeccion titulo="Hoy" filas={deHoy} />
            {deHoy.length === 0 ? (
              <p className="rounded-2xl border border-aventurea-line bg-white px-6 py-8 text-center text-[13px] text-aventurea-ink-soft">
                No hay reservas para hoy
                {hayFiltrosActivos(filtros) ? " con estos filtros" : ""}. Cuando alguien reserve
                por Bookea, aparece acá al instante.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {deHoy.map((f) => (
                  <li key={f.id}>
                    <TarjetaHoy fila={f} alAbrir={() => setDetalleId(f.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <SeccionLista titulo="Próximas" filas={proximas} hoy={hoy} alAbrir={setDetalleId} />
          <SeccionLista titulo="Completadas" filas={completadas} hoy={hoy} alAbrir={setDetalleId} />
          <SeccionLista titulo="Canceladas" filas={canceladas} hoy={hoy} alAbrir={setDetalleId} />
          <SeccionLista
            titulo="No se presentaron"
            filas={noShows}
            hoy={hoy}
            alAbrir={setDetalleId}
          />
        </>
      )}

      {detalle && (
        <DetalleReserva
          fila={detalle}
          negocioId={negocioId}
          hoy={hoy}
          alCerrar={() => setDetalleId(null)}
          alCambiarEstado={(id, estado, esReal) => {
            setOverrides((prev) => ({ ...prev, [id]: estado }));
            // Las reales además refrescan al servidor: el override es
            // solo el feedback inmediato mientras llega la verdad.
            if (esReal) router.refresh();
          }}
        />
      )}

      {nuevaAbierta && (
        <NuevaReserva
          negocioId={negocioId}
          franjas={franjas}
          alCerrar={() => setNuevaAbierta(false)}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  Filtros
// ───────────────────────────────────────────────────────────────────

function BarraFiltros({
  filtros,
  alCambiar,
}: {
  filtros: FiltrosReservas;
  alCambiar: (cambios: Record<string, string | null>) => void;
}) {
  const select =
    "h-10 rounded-xl border border-aventurea-line bg-white px-3 text-[12.5px] font-bold " +
    "text-aventurea-ink outline-none transition-colors hover:border-aventurea-navy focus:border-aventurea-navy";

  return (
    <div className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-aventurea-line bg-white p-3.5">
      <label className="block">
        <span className={`${ROTULO_CAMPO} mb-1 block`}>Fecha</span>
        <input
          type="date"
          value={filtros.fecha ?? ""}
          onChange={(ev) => alCambiar({ fecha: ev.target.value || null })}
          className={`${select} tabular-nums`}
          aria-label="Filtrar por fecha"
        />
      </label>
      <label className="block">
        <span className={`${ROTULO_CAMPO} mb-1 block`}>Estado</span>
        <select
          value={filtros.estado}
          onChange={(ev) => alCambiar({ estado: ev.target.value === "todos" ? null : ev.target.value })}
          className={select}
        >
          {OPCIONES_ESTADO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={`${ROTULO_CAMPO} mb-1 block`}>Personas</span>
        <select
          value={filtros.personas}
          onChange={(ev) =>
            alCambiar({ personas: ev.target.value === "todas" ? null : ev.target.value })
          }
          className={select}
        >
          {OPCIONES_PERSONAS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={`${ROTULO_CAMPO} mb-1 block`}>Franja horaria</span>
        <select
          value={filtros.franja}
          onChange={(ev) =>
            alCambiar({ franja: ev.target.value === "todas" ? null : ev.target.value })
          }
          className={select}
        >
          {OPCIONES_FRANJA.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {hayFiltrosActivos(filtros) && (
        <button
          type="button"
          onClick={() => alCambiar({ fecha: null, estado: null, personas: null, franja: null })}
          className="h-10 rounded-xl px-3 text-[12.5px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-cream-2"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  Piezas de la lista
// ───────────────────────────────────────────────────────────────────

/** El encabezado de un grupo: título, conteo y la marquita de demo si
 *  el grupo contiene filas de utilería. */
function EncabezadoSeccion({ titulo, filas }: { titulo: string; filas: ReservaPanelFila[] }) {
  const tieneDemo = filas.some((f) => f.origen === "demo");
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
      <h2 className={EYEBROW_NEUTRO}>
        {titulo}
        {filas.length > 0 && <span className="ml-1.5 text-aventurea-ink">· {filas.length}</span>}
      </h2>
      {tieneDemo && <NotaDemo />}
    </div>
  );
}

/** La marca sutil de una fila de utilería, para no repetir la píldora
 *  grande en cada tarjeta: un puntito naranja + "ejemplo". */
function MarcaEjemplo() {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
      <span className="h-1 w-1 rounded-full bg-aventurea-orange" aria-hidden />
      ejemplo
    </span>
  );
}

/** La tarjeta grande de HOY: hora protagonista, cliente, personas,
 *  ocasión y estado. Toda la tarjeta abre el detalle. */
function TarjetaHoy({ fila, alAbrir }: { fila: ReservaPanelFila; alAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={alAbrir}
      className="group flex h-full w-full flex-col gap-2 rounded-2xl border border-aventurea-line bg-white p-4 text-left shadow-[var(--shadow-elevado)] transition-colors hover:border-aventurea-navy"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[20px] font-extrabold leading-none tracking-tight tabular-nums text-aventurea-ink">
          {horaCorta(fila.hora)}
        </p>
        <InsigniaEstado estado={fila.estado} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-aventurea-ink">{fila.cliente}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-aventurea-ink-soft">
          <span className="inline-flex items-center gap-1">
            <IconUsers className="h-3.5 w-3.5" aria-hidden />
            {fila.personas} {fila.personas === 1 ? "persona" : "personas"}
          </span>
          {fila.codigo && <span className="font-mono">{fila.codigo}</span>}
          {fila.origen === "demo" && <MarcaEjemplo />}
        </p>
        {fila.nota && (
          <p className="mt-1.5 truncate rounded-lg bg-aventurea-cream-2 px-2 py-1 text-[11.5px] text-aventurea-ink-soft">
            {fila.nota}
          </p>
        )}
      </div>
    </button>
  );
}

/** Una fila compacta de las secciones que no son "Hoy". */
function FilaReserva({
  fila,
  hoy,
  alAbrir,
}: {
  fila: ReservaPanelFila;
  hoy: string;
  alAbrir: () => void;
}) {
  const manana = sumarDiasISO(hoy, 1);
  const rotuloFecha =
    fila.fecha === manana ? "Mañana" : `${diaSemanaDe(fila.fecha)} ${fechaCorta(fila.fecha)}`;

  return (
    <li>
      <button
        type="button"
        onClick={alAbrir}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-aventurea-line bg-white px-3.5 py-3 text-left transition-colors hover:border-aventurea-navy"
      >
        <span className="w-[86px] shrink-0 text-[12.5px] font-bold text-aventurea-ink">
          {rotuloFecha}
        </span>
        <span className="w-[74px] shrink-0 text-[12.5px] font-bold tabular-nums text-aventurea-ink">
          {horaCorta(fila.hora)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-aventurea-ink">
            {fila.cliente}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-aventurea-ink-soft">
            {fila.personas} {fila.personas === 1 ? "persona" : "personas"}
            {fila.codigo && <span className="font-mono">{fila.codigo}</span>}
            {fila.origen === "demo" && <MarcaEjemplo />}
          </span>
        </span>
        <InsigniaEstado estado={fila.estado} className="shrink-0" />
      </button>
    </li>
  );
}

function SeccionLista({
  titulo,
  filas,
  hoy,
  alAbrir,
}: {
  titulo: string;
  filas: ReservaPanelFila[];
  hoy: string;
  alAbrir: (id: string) => void;
}) {
  // El hook va ANTES del retorno temprano (regla de hooks): el conteo
  // de visibles existe aunque el grupo esté vacío en este render.
  const [visibles, setVisibles] = useState(8);

  // Un grupo vacío no pinta nada: cuatro cajas vacías apiladas serían
  // la "página blanca" que el diseño prohíbe. La excepción es "Hoy",
  // que siempre existe y tiene su mensaje propio.
  if (filas.length === 0) return null;

  return (
    <section aria-label={titulo}>
      <EncabezadoSeccion titulo={titulo} filas={filas} />
      <ul className="flex flex-col gap-2">
        {filas.slice(0, visibles).map((f) => (
          <FilaReserva key={f.id} fila={f} hoy={hoy} alAbrir={() => alAbrir(f.id)} />
        ))}
      </ul>
      {filas.length > visibles && (
        <button
          type="button"
          onClick={() => setVisibles((v) => v + 12)}
          className="mt-2 w-full rounded-xl border border-aventurea-line bg-white py-2 text-[12.5px] font-bold text-aventurea-navy transition-colors hover:border-aventurea-navy"
        >
          Ver más ({filas.length - visibles} restantes)
        </button>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────
//  El detalle (dialog)
// ───────────────────────────────────────────────────────────────────

function DetalleReserva({
  fila,
  negocioId,
  hoy,
  alCerrar,
  alCambiarEstado,
}: {
  fila: ReservaPanelFila;
  negocioId: string;
  hoy: string;
  alCerrar: () => void;
  alCambiarEstado: (id: string, estado: EstadoReservaPanel, esReal: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);

  // showModal() al montar: foco atrapado, Esc y backdrop gratis — el
  // mismo patrón del cajón móvil del shell (panel-nav.tsx).
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const esReal = fila.origen === "real";
  const esHoyOPasada = fila.fecha <= hoy;
  const esHoyOFutura = fila.fecha >= hoy;

  // Qué acciones tiene sentido ofrecer. El check-in y el no-show son
  // de una mesa que ya debería estar pasando (hoy o antes); cancelar
  // solo si la franja no pasó todavía (libera cupo re-vendible).
  const puedeConfirmar = !esReal && fila.estado === "pendiente";
  const puedeCheckIn =
    (fila.estado === "confirmada" || fila.estado === "pendiente") && esHoyOPasada;
  const puedeNoShow = puedeCheckIn;
  const puedeCancelar =
    (fila.estado === "confirmada" || fila.estado === "pendiente") && esHoyOFutura;

  // Las tres actions reales devuelven uniones distintas pero todas
  // caben en esta forma mínima; alcanza para pintar éxito o error.
  const ejecutarReal = (
    accion: () => Promise<{ ok: boolean; error?: string }>,
    estadoNuevo: EstadoReservaPanel,
  ) =>
    iniciar(async () => {
      setError(null);
      const r = await accion();
      if (!r.ok) {
        setError(r.error ?? "No se pudo completar la acción.");
        return;
      }
      alCambiarEstado(fila.id, estadoNuevo, true);
    });

  const simularDemo = (estadoNuevo: EstadoReservaPanel) => {
    setError(null);
    alCambiarEstado(fila.id, estadoNuevo, false);
  };

  const botonAccion =
    "rounded-xl px-3.5 py-2.5 text-[12.5px] font-bold transition-colors disabled:opacity-50";

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      aria-label="Detalle de la reserva"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) ev.currentTarget.close();
      }}
      className="m-auto w-[min(92vw,440px)] rounded-3xl bg-white p-0 shadow-[var(--shadow-flotante)] backdrop:bg-black/45"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={EYEBROW_NEUTRO}>Reserva</p>
            <p className="mt-1 text-[22px] font-extrabold leading-none tracking-tight text-aventurea-ink">
              {fila.fecha === hoy ? "Hoy" : `${diaSemanaDe(fila.fecha)} ${fechaCorta(fila.fecha)}`}{" "}
              · {horaCorta(fila.hora)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Cerrar detalle"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-aventurea-line text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <InsigniaEstado estado={fila.estado} />
          {fila.origen === "demo" && <NotaDemo />}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-aventurea-cream-2 p-4">
          <div>
            <dt className={ROTULO_CAMPO}>A nombre de</dt>
            <dd className="mt-0.5 text-[13.5px] font-bold text-aventurea-ink">{fila.cliente}</dd>
          </div>
          <div>
            <dt className={ROTULO_CAMPO}>Personas</dt>
            <dd className="mt-0.5 text-[13.5px] font-bold text-aventurea-ink">
              {fila.personas} {fila.personas === 1 ? "persona" : "personas"}
            </dd>
          </div>
          {fila.codigo && (
            <div>
              <dt className={ROTULO_CAMPO}>Código</dt>
              <dd className="mt-0.5 font-mono text-[13.5px] font-bold text-aventurea-ink">
                {fila.codigo}
              </dd>
            </div>
          )}
          {fila.telefono && (
            <div>
              <dt className={ROTULO_CAMPO}>Teléfono</dt>
              <dd className="mt-0.5 text-[13.5px] font-bold text-aventurea-ink">{fila.telefono}</dd>
            </div>
          )}
          {fila.nota && (
            <div className="col-span-2">
              <dt className={ROTULO_CAMPO}>Ocasión / nota</dt>
              <dd className="mt-0.5 text-[13px] leading-relaxed text-aventurea-ink">{fila.nota}</dd>
            </div>
          )}
          {fila.totalEstimado !== null && (
            <div className="col-span-2">
              <dt className={ROTULO_CAMPO}>Consumo estimado</dt>
              <dd className="mt-0.5 text-[15px] font-extrabold text-aventurea-ink">
                {formatearCRC(fila.totalEstimado)}
              </dd>
              <NotaEstimacion className="mt-1" />
            </div>
          )}
        </dl>

        {!esReal && (
          <p className="rounded-xl bg-aventurea-cream-2 px-3 py-2 text-[11.5px] leading-snug text-aventurea-ink-soft">
            Reserva de ejemplo: podés probar las acciones y el cambio se ve al instante, pero no
            se guarda nada.
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {error}
          </p>
        )}

        {(puedeConfirmar || puedeCheckIn || puedeNoShow || puedeCancelar) && (
          <div className="flex flex-wrap gap-2">
            {puedeConfirmar && (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => simularDemo("confirmada")}
                className={`${botonAccion} bg-aventurea-navy text-white hover:bg-aventurea-navy-2`}
              >
                Confirmar
              </button>
            )}
            {puedeCheckIn && (
              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  esReal
                    ? ejecutarReal(() => hacerCheckInPorId(negocioId, fila.id), "check_in")
                    : simularDemo("completada")
                }
                className={`${botonAccion} bg-aventurea-navy text-white hover:bg-aventurea-navy-2`}
              >
                {pendiente ? "…" : "Check-in"}
              </button>
            )}
            {puedeNoShow && (
              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  esReal
                    ? ejecutarReal(() => marcarNoShow(negocioId, fila.id), "no_show")
                    : simularDemo("no_show")
                }
                className={`${botonAccion} border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy`}
              >
                No se presentó
              </button>
            )}
            {puedeCancelar &&
              (confirmandoCancelacion ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold text-red-700">
                    ¿Cancelar y liberar el cupo?
                  </span>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() =>
                      esReal
                        ? ejecutarReal(
                            () => cancelarReservaDelNegocio(negocioId, fila.id),
                            "cancelada",
                          )
                        : simularDemo("cancelada")
                    }
                    className={`${botonAccion} bg-red-600 text-white hover:bg-red-700`}
                  >
                    {pendiente ? "…" : "Sí, cancelar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoCancelacion(false)}
                    className={`${botonAccion} border border-aventurea-line text-aventurea-ink-soft`}
                  >
                    Volver
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => setConfirmandoCancelacion(true)}
                  className={`${botonAccion} border border-aventurea-line text-aventurea-ink-soft hover:border-red-400 hover:text-red-700`}
                >
                  Cancelar reserva
                </button>
              ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
