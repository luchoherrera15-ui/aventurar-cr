"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { fmtColones } from "@/lib/finanzas";
import { IconChevronDown, IconSearch } from "@/components/icons";
import type { ActividadItem } from "./metricas";

/** Cuántas reservas se ven antes de tocar "Ver más". */
const PASO = 6;

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En aprobación",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
  // La vertical Citas usa estados propios; llegan por el mismo select.
  cancelada: "Cancelada",
  cumplida: "Cumplida",
  no_asistio: "No asistió",
};

/**
 * Píldoras sobrias — el panel del anfitrión es navy/negro, no naranja.
 *
 * Tonos SÓLIDOS y no `color/10` sobre lo que haya detrás: la píldora
 * aparece sobre la tarjeta blanca y también sobre la fila gris del
 * histórico, y con alfa el mismo estado se veía de dos colores según
 * dónde cayera. Los pares medidos: navy sobre `sky-light` 12,24:1;
 * verde sobre `green-light` 4,51:1 (AA); los bordes, 4,42:1 y 5,32:1
 * contra blanco, sobre el 3:1 que pide un elemento no textual.
 */
const ESTADO_CLASE: Record<string, string> = {
  pendiente: "border-aventurea-sky bg-aventurea-sky-light text-aventurea-navy",
  confirmada: "border-aventurea-green bg-aventurea-green-light text-aventurea-green",
  rechazada: "border-aventurea-line bg-aventurea-cream-2 text-zinc-500",
  cancelada: "border-aventurea-line bg-aventurea-cream-2 text-zinc-500",
  cumplida: "border-aventurea-green bg-aventurea-green-light text-aventurea-green",
  no_asistio: "border-red-200 bg-red-50 text-red-700",
};

/** El punto de color de la pastilla — mismo criterio que `ESTADO_CLASE`. */
const ESTADO_PUNTO: Record<string, string> = {
  pendiente: "bg-aventurea-sky",
  confirmada: "bg-aventurea-green",
  rechazada: "bg-zinc-400",
  cancelada: "bg-zinc-400",
  cumplida: "bg-aventurea-green",
  no_asistio: "bg-red-600",
};

const ORIGEN_LABEL: Record<string, string> = {
  web: "Página web",
  movil: "App móvil",
  manual: "Cargada a mano",
};

const METODO_LABEL: Record<string, string> = {
  sinpe: "SINPE Móvil",
  transferencia: "Transferencia",
};

const ZONA = "America/Costa_Rica";

function estadoLabel(estado: string) {
  return ESTADO_LABEL[estado] ?? estado;
}

function estadoClase(estado: string) {
  return ESTADO_CLASE[estado] ?? "border-aventurea-line bg-aventurea-cream-2 text-zinc-500";
}

function plata(n: number | null) {
  if (n === null || n === undefined) return "—";
  return fmtColones(Number(n));
}

/** "12 ago 2026" — la fecha de un día calendario (sin hora, sin zona). */
function fmtDia(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "12 ago 2026, 3:40 p.m." — un instante real, siempre en hora de CR
 *  (fijar la zona además evita que el servidor y el navegador pinten
 *  horas distintas y React se queje de la hidratación). */
function fmtInstante(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CR", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Solo la hora, para la segunda línea de la columna "Se reservó". */
function fmtHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-CR", {
    timeZone: ZONA,
    hour: "numeric",
    minute: "2-digit",
  });
}

function Pastilla({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-0.5 text-[11px] font-bold ${estadoClase(estado)}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${ESTADO_PUNTO[estado] ?? "bg-zinc-400"}`}
      />
      {estadoLabel(estado)}
    </span>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {rotulo}
      </p>
      <p className="break-words text-[12.5px] leading-snug text-aventurea-ink">{children}</p>
    </div>
  );
}

/**
 * El detalle de auditoría de UNA reserva — el mismo bloque para la fila
 * abierta del escritorio y la tarjeta abierta del teléfono, para no
 * mantener dos versiones de la misma información.
 */
function Detalle({
  it,
  onVerComprobante,
  onMarcarValidado,
}: {
  it: ActividadItem;
  onVerComprobante?: (path: string) => Promise<{ url: string | null; error: string | null }>;
  onMarcarValidado?: (reservaId: string, validado: boolean) => Promise<{ error: string | null }>;
}) {
  const [validado, setValidado] = useState(it.depositoValidado);
  const [error, setError] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [pendiente, startTransition] = useTransition();

  async function abrirComprobante() {
    if (!onVerComprobante || !it.comprobanteUrl) return;
    setAbriendo(true);
    setError(null);
    const res = await onVerComprobante(it.comprobanteUrl);
    setAbriendo(false);
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else setError(res.error ?? "No se pudo abrir el comprobante.");
  }

  function marcarRecibido() {
    if (!onMarcarValidado) return;
    setError(null);
    startTransition(async () => {
      const res = await onMarcarValidado(it.id, true);
      if (res?.error) setError(res.error);
      else setValidado(true);
    });
  }

  return (
    <div className="border-t border-aventurea-line bg-aventurea-cream-2/40 px-4 py-3.5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <Campo rotulo="Correo">
          {it.correo ? (
            <a href={`mailto:${it.correo}`} className="text-aventurea-navy underline">
              {it.correo}
            </a>
          ) : (
            (it.contacto ?? "—")
          )}
        </Campo>
        <Campo rotulo="WhatsApp">{it.whatsapp ?? "—"}</Campo>
        <Campo rotulo="Reservó el">{fmtInstante(it.creadoEn)}</Campo>
        <Campo rotulo="Día del evento">
          {fmtDia(it.fechaEvento)}
          {it.horario ? ` · ${it.horario}` : ""}
        </Campo>

        <Campo rotulo="Total">
          <span className="font-bold tabular-nums">{plata(it.monto)}</span>
        </Campo>
        <Campo rotulo="Depositado">
          <span className="font-bold tabular-nums">{plata(it.adelanto)}</span>
          {!validado && Number(it.depositoMonto ?? 0) > 0 && (
            /* El monto ya está en tinta fuerte al lado; esta acotación
               es la que dice que falta revisarlo. En naranja daba 2,94:1
               —el peor contraste de toda la fila para el dato que más
               atención pide—; navy sólido da 13,88:1 y la negrita sigue
               haciendo la diferencia con el gris de alrededor. */
            <span className="ml-1.5 text-[11px] font-bold text-aventurea-navy">
              ({plata(it.depositoMonto)} sin validar)
            </span>
          )}
          {validado && <span className="ml-1.5 text-[11px] text-aventurea-green">✓ validado</span>}
        </Campo>
        <Campo rotulo="Pendiente">
          <span className="font-bold tabular-nums">{plata(it.pendiente)}</span>
        </Campo>
        <Campo rotulo="Estado del cobro">
          {it.eventoPagado ? "Saldo cobrado" : it.adelanto > 0 ? "Solo el adelanto" : "Sin cobrar"}
          {it.adelantoDevuelto ? " · adelanto devuelto" : ""}
        </Campo>

        <Campo rotulo="Depósito pagado el">{fmtInstante(it.depositoPagadoEn)}</Campo>
        <Campo rotulo="Saldo pagado el">{fmtInstante(it.saldoPagadoEn)}</Campo>
        <Campo rotulo="Método de pago">
          {it.metodoPago ? (METODO_LABEL[it.metodoPago] ?? it.metodoPago) : "—"}
        </Campo>
        <Campo rotulo="Origen">{ORIGEN_LABEL[it.origen] ?? it.origen}</Campo>

        <Campo rotulo="Descuento">
          {it.codigoDescuento || it.descuentoMonto
            ? `${it.codigoDescuento ?? "Promoción"}${
                it.descuentoMonto ? ` · −${plata(it.descuentoMonto)}` : ""
              }`
            : "—"}
        </Campo>
        <Campo rotulo="Invitados">{it.invitados ?? "—"}</Campo>
        <Campo rotulo="Tipo de evento">{it.tipoEvento ?? "—"}</Campo>
        <Campo rotulo="Cédula">{it.cedula ?? "—"}</Campo>
      </div>

      {it.nota && (
        <p className="mt-3 rounded-xl border border-aventurea-line bg-aventurea-surface px-3.5 py-2.5 text-[12.5px] leading-relaxed text-aventurea-ink">
          <span className="mr-1.5 font-bold">Nota:</span>
          {it.nota}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {it.comprobanteUrl && onVerComprobante && (
          <button
            type="button"
            onClick={abrirComprobante}
            disabled={abriendo}
            className="text-[12.5px] font-bold text-aventurea-navy underline disabled:opacity-50"
          >
            {abriendo ? "Abriendo…" : "Ver comprobante"}
          </button>
        )}
        {it.comprobanteUrl && !validado && onMarcarValidado && (
          <button
            type="button"
            onClick={marcarRecibido}
            disabled={pendiente}
            className="text-[12.5px] font-bold text-aventurea-green underline disabled:opacity-50"
          >
            Marcar depósito recibido
          </button>
        )}
        {it.clienteId && (
          <Link
            href={`/mensajes/${it.id}`}
            className="text-[12.5px] font-bold text-aventurea-navy underline"
          >
            Mensajes
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * El histórico con auditoría de Inicio: las últimas reservas hechas, con
 * cuándo se hicieron (fecha y hora), con qué correo, cuánto entró y
 * cuánto falta. En escritorio es una tabla densa; en teléfono, tarjetas
 * compactas que se abren al tocarlas — nunca una tabla que se arrastra
 * de lado.
 */
export default function HistoricoReservas({
  items,
  onVerComprobante,
  onMarcarValidado,
}: {
  items: ActividadItem[];
  onVerComprobante?: (path: string) => Promise<{ url: string | null; error: string | null }>;
  onMarcarValidado?: (reservaId: string, validado: boolean) => Promise<{ error: string | null }>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
  const [visibles, setVisibles] = useState(PASO);
  const [abierta, setAbierta] = useState<string | null>(null);

  const estadosPresentes = useMemo(
    () => Array.from(new Set(items.map((i) => i.estado))),
    [items],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((i) => {
      if (estado !== "todos" && i.estado !== estado) return false;
      if (!q) return true;
      return [i.nombre, i.correo, i.whatsapp, i.contacto]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(q));
    });
  }, [items, busqueda, estado]);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
        Todavía no hay reservas para auditar. Apenas entre la primera, acá vas a ver quién la
        hizo, a qué hora, cuánto depositó y cuánto queda pendiente.
      </p>
    );
  }

  const mostrados = filtrados.slice(0, visibles);
  const restantes = filtrados.length - mostrados.length;

  const props = { onVerComprobante, onMarcarValidado };

  return (
    <div className="flex flex-col gap-3">
      {/* Buscador y filtro: en teléfono uno debajo del otro, a lo ancho. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex min-w-0 flex-1 items-center">
          <IconSearch className="pointer-events-none absolute left-3 h-4 w-4 text-aventurea-ink-soft" />
          <span className="sr-only">Buscar por nombre o correo</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setVisibles(PASO);
            }}
            placeholder="Buscar por nombre o correo…"
            className="h-11 w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 pl-9 pr-3 text-[13.5px] text-aventurea-ink outline-none placeholder:text-zinc-500 focus:border-aventurea-navy"
          />
        </label>
        <label className="shrink-0">
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setVisibles(PASO);
            }}
            className="h-11 w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 text-[13.5px] font-bold text-aventurea-ink outline-none focus:border-aventurea-navy sm:w-auto"
          >
            <option value="todos">Todos los estados</option>
            {estadosPresentes.map((e) => (
              <option key={e} value={e}>
                {estadoLabel(e)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
          Ninguna reserva coincide con lo que buscaste.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {/* ESCRITORIO — tabla densa, cifras tabulares y alineadas.
              Las filas son GRID y no flex a propósito: con `minmax(0,1fr)`
              la columna del cliente puede achicarse de verdad, así el
              nombre largo de un cliente no empuja la página a lo ancho
              (con flex, el `min-w-0` deja encoger pero el ancho MÍNIMO
              del contenedor lo sigue fijando el texto). Aparece desde
              1280px: abajo de eso el panel deja menos de 750px libres
              al lado del menú y la tabla no cabría. */}
          <div className="hidden xl:block">
            <div className="grid grid-cols-[minmax(0,1fr)_128px_116px_104px_96px_96px_96px_18px] items-center gap-3 border-b border-aventurea-line bg-aventurea-navy/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              <span>Cliente y correo</span>
              <span>Se reservó</span>
              <span>Evento</span>
              <span>Estado</span>
              <span className="text-right">Depositado</span>
              <span className="text-right">Pendiente</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {mostrados.map((it, i) => (
              <div key={it.id} className={i > 0 ? "border-t border-aventurea-line/70" : ""}>
                <button
                  type="button"
                  onClick={() => setAbierta(abierta === it.id ? null : it.id)}
                  aria-expanded={abierta === it.id}
                  className="grid w-full grid-cols-[minmax(0,1fr)_128px_116px_104px_96px_96px_96px_18px] items-center gap-3 px-4 py-2.5 text-left hover:bg-aventurea-cream-2/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-aventurea-ink">
                      {it.nombre ?? "Sin nombre"}
                    </span>
                    <span className="block truncate text-[11.5px] text-aventurea-ink-soft">
                      {it.correo ?? it.whatsapp ?? it.contacto ?? "Sin contacto"}
                    </span>
                  </span>
                  <span className="min-w-0 text-[12px] text-aventurea-ink-soft">
                    <span className="block tabular-nums text-aventurea-ink">
                      {fmtDia(it.creadoEn)}
                    </span>
                    <span className="block tabular-nums">{fmtHora(it.creadoEn)}</span>
                  </span>
                  <span className="min-w-0 text-[12px] text-aventurea-ink-soft">
                    <span className="block tabular-nums text-aventurea-ink">
                      {fmtDia(it.fechaEvento)}
                    </span>
                    {it.horario && <span className="block truncate">{it.horario}</span>}
                  </span>
                  <span className="min-w-0">
                    <Pastilla estado={it.estado} />
                  </span>
                  <span className="text-right text-[12.5px] font-bold tabular-nums text-aventurea-green">
                    {plata(it.adelanto)}
                  </span>
                  <span
                    className={`text-right text-[12.5px] font-bold tabular-nums ${
                      it.pendiente > 0 ? "text-aventurea-ink" : "text-aventurea-ink-soft"
                    }`}
                  >
                    {plata(it.pendiente)}
                  </span>
                  <span className="text-right text-[12.5px] tabular-nums text-aventurea-ink-soft">
                    {plata(it.monto)}
                  </span>
                  <span className="flex justify-end">
                    <IconChevronDown
                      className={`h-4 w-4 text-aventurea-ink-soft transition-transform ${
                        abierta === it.id ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
                {abierta === it.id && <Detalle it={it} {...props} />}
              </div>
            ))}
          </div>

          {/* TELÉFONO — una tarjeta por reserva con lo esencial; el resto
              se abre al tocarla. Nada que arrastrar de lado: la tarjeta
              también es grid con `minmax(0,1fr)`, por lo mismo. */}
          <div className="xl:hidden">
            {mostrados.map((it, i) => (
              <div key={it.id} className={i > 0 ? "border-t border-aventurea-line/70" : ""}>
                <button
                  type="button"
                  onClick={() => setAbierta(abierta === it.id ? null : it.id)}
                  aria-expanded={abierta === it.id}
                  className="grid w-full grid-cols-[minmax(0,1fr)_16px] items-start gap-2.5 px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-[13.5px] font-bold text-aventurea-ink">
                        {it.nombre ?? "Sin nombre"}
                      </span>
                      <Pastilla estado={it.estado} />
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-aventurea-ink-soft">
                      Reservó el {fmtDia(it.creadoEn)}, {fmtHora(it.creadoEn)}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px]">
                      <span className="text-aventurea-ink-soft">
                        Depositado{" "}
                        <strong className="tabular-nums text-aventurea-green">
                          {plata(it.adelanto)}
                        </strong>
                      </span>
                      <span className="text-aventurea-ink-soft">
                        Pendiente{" "}
                        <strong className="tabular-nums text-aventurea-ink">
                          {plata(it.pendiente)}
                        </strong>
                      </span>
                    </span>
                  </span>
                  <IconChevronDown
                    className={`mt-1 h-4 w-4 text-aventurea-ink-soft transition-transform ${
                      abierta === it.id ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {abierta === it.id && <Detalle it={it} {...props} />}
              </div>
            ))}
          </div>

          {restantes > 0 && (
            <button
              type="button"
              onClick={() => setVisibles((v) => v + PASO * 2)}
              className="w-full border-t border-aventurea-line py-2.5 text-[12.5px] font-bold text-aventurea-navy hover:bg-aventurea-cream-2/60"
            >
              Ver más ({restantes} {restantes === 1 ? "reserva" : "reservas"})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
