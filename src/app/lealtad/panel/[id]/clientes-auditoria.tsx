"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  CIFRA,
  CUERPO,
  CUERPO_SUAVE,
  DETALLE,
  ROTULO_CAMPO,
  ROTULO_CIFRA,
} from "@/components/panel/sistema";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { RITMOS, TRAMOS, type RitmoNegocio, type TramoCliente } from "@/lib/lealtad/ciclo-cliente";
import type { ClienteAuditado, DatosClientes } from "./clientes-datos";
import { auditarCliente, enviarRescate, guardarRitmo } from "./rescate-actions";
import type { EventoCliente } from "./clientes-datos";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  AUDITORÍA DE CLIENTES — filtrar a detalle, ver a fondo, rescatar
 * ═══════════════════════════════════════════════════════════════════
 *
 * La pestaña "Clientes" ya tenía el MOSTRADOR (`LealtadEstado`): dar un
 * sello, canjear, ver a quién le toca su premio. Esto es la otra mitad
 * que pidió el dueño — modo AUDITORÍA: cada cliente con su gasto, sus
 * visitas, cuándo fue la última vez y en qué tramo del ciclo está, con
 * filtros de verdad y la posibilidad de escribirle a quien se está
 * yendo.
 *
 * Server component la carga UNA vez (`cargarClientesAuditados`, cache
 * de React) y la pasa acá entera: filtrar/ordenar/buscar es trabajo de
 * cliente sobre datos que ya llegaron, no una consulta por cada tecla.
 */

const TONO: Record<TramoCliente, "exito" | "aviso" | "alerta" | "neutro"> = {
  nuevo: "neutro",
  activo: "exito",
  en_riesgo: "aviso",
  dormido: "alerta",
  perdido: "alerta",
};

type Orden = "recientes" | "antiguos" | "mas_gasto" | "mas_visitas" | "nombre";

function formatoColones(monto: number): string {
  return `₡${monto.toLocaleString("es-CR")}`;
}

function formatoFecha(iso: string | null): string {
  if (iso === null) return "Nunca vino";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default function ClientesAuditoria({
  ranchoId,
  programaId,
  datos,
}: {
  ranchoId: string;
  programaId: string;
  datos: DatosClientes;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [tramosActivos, setTramosActivos] = useState<Set<TramoCliente>>(new Set());
  const [diasMin, setDiasMin] = useState("");
  const [gastoMin, setGastoMin] = useState("");
  /**
   * EL RANGO DE FECHAS, y sobre QUÉ fecha se aplica.
   *
   * Son dos preguntas distintas que el dueño hace seguido y que sin
   * esto no se podían contestar desde la pantalla:
   *   · «¿quiénes vinieron en Semana Santa?»        → última visita
   *   · «¿a quiénes afilié desde que puse el póster?» → afiliación
   *
   * Un solo par de campos con un selector de cuál fecha, en vez de dos
   * pares: cuatro campos de fecha en la misma fila se confunden entre
   * sí, y filtrar por los dos rangos a la vez no es algo que nadie
   * pida en una caja.
   *
   * Los dos extremos son INCLUSIVOS y se comparan como texto, sin
   * `new Date`: las fechas ya vienen del servidor en YYYY-MM-DD (hora
   * de Costa Rica, resuelta allá) y el orden alfabético de ese formato
   * ES el orden cronológico. Parsearlas acá las movería a la zona
   * horaria del navegador y correría un día a quien vino de noche.
   */
  const [campoFecha, setCampoFecha] = useState<"ultimaVisita" | "desde">("ultimaVisita");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [orden, setOrden] = useState<Orden>("recientes");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ritmo, setRitmo] = useState<RitmoNegocio>(datos.ritmo);
  const [guardandoRitmo, iniciarGuardadoRitmo] = useTransition();

  const filtrados = useMemo(() => {
    const aguja = busqueda.trim().toLowerCase();
    const dMin = diasMin.trim() === "" ? null : Number(diasMin);
    const gMin = gastoMin.trim() === "" ? null : Number(gastoMin);

    let lista = datos.clientes.filter((c) => {
      if (tramosActivos.size > 0 && !tramosActivos.has(c.tramo)) return false;
      if (dMin !== null && (c.diasSinVenir === null || c.diasSinVenir < dMin)) return false;
      if (gMin !== null && c.gastoTotal < gMin) return false;
      if (aguja && !`${c.nombre} ${c.contacto.join(" ")}`.toLowerCase().includes(aguja)) {
        return false;
      }
      if (fechaDesde || fechaHasta) {
        const fecha = campoFecha === "desde" ? c.desde : c.ultimaVisita;
        // Quien nunca vino no entra en un rango de «última visita»: no
        // tiene fecha que comparar, y colarlo sería decir que vino en
        // un período en el que no vino. Con el filtro apagado sí sale.
        if (fecha === null) return false;
        if (fechaDesde && fecha < fechaDesde) return false;
        if (fechaHasta && fecha > fechaHasta) return false;
      }
      return true;
    });

    lista = [...lista].sort((a, b) => {
      switch (orden) {
        case "antiguos":
          return (a.diasSinVenir ?? -1) - (b.diasSinVenir ?? -1);
        case "mas_gasto":
          return b.gastoTotal - a.gastoTotal;
        case "mas_visitas":
          return b.visitas - a.visitas;
        case "nombre":
          return a.nombre.localeCompare(b.nombre, "es");
        case "recientes":
        default:
          return (b.diasSinVenir ?? -1) - (a.diasSinVenir ?? -1);
      }
    });
    return lista;
  }, [
    datos.clientes,
    busqueda,
    tramosActivos,
    diasMin,
    gastoMin,
    campoFecha,
    fechaDesde,
    fechaHasta,
    orden,
  ]);

  const rescatablesFiltrados = filtrados.filter(
    (c) => c.tramo === "en_riesgo" || c.tramo === "dormido",
  );

  function alternarTramo(t: TramoCliente) {
    setTramosActivos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(t)) nuevo.delete(t);
      else nuevo.add(t);
      return nuevo;
    });
  }

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Los totales, como chips de filtro rápido ─────────────── */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["activo", datos.totales.activos],
            ["en_riesgo", datos.totales.enRiesgo],
            ["dormido", datos.totales.dormidos],
            ["perdido", datos.totales.perdidos],
            ["nuevo", datos.totales.nuevos],
          ] as [TramoCliente, number][]
        ).map(([t, n]) => {
          const activo = tramosActivos.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => alternarTramo(t)}
              title={TRAMOS[t].explica}
              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                activo
                  ? "border-aventurea-navy bg-aventurea-navy text-white"
                  : "border-aventurea-line bg-aventurea-surface hover:border-aventurea-navy"
              }`}
            >
              <p
                className={`${CIFRA} ${activo ? "text-white" : ""}`}
                style={activo ? undefined : undefined}
              >
                {n}
              </p>
              <p className={`${ROTULO_CIFRA} ${activo ? "text-white/75" : ""}`}>
                {TRAMOS[t].etiqueta}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── El ritmo del negocio: la perilla de la que cuelgan los tramos ── */}
      <Card sinPadding className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={CUERPO}>
              <strong>Ritmo de tu negocio:</strong> cada cuánto vuelve un cliente sano
            </p>
            <p className={CUERPO_SUAVE}>
              De esto dependen los tramos de arriba — cambialo si &ldquo;en riesgo&rdquo; te
              parece muy temprano o muy tarde.
            </p>
          </div>
          <select
            value={ritmo}
            onChange={(e) => {
              const nuevo = e.target.value as RitmoNegocio;
              setRitmo(nuevo);
              iniciarGuardadoRitmo(async () => {
                await guardarRitmo(ranchoId, programaId, nuevo);
              });
            }}
            disabled={guardandoRitmo}
            className={`${CAMPO_PANEL} w-auto`}
          >
            {(Object.keys(RITMOS) as RitmoNegocio[]).map((r) => (
              <option key={r} value={r}>
                {RITMOS[r].etiqueta} — {RITMOS[r].ejemplo}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* ── Los filtros a detalle ────────────────────────────────── */}
      <Card sinPadding className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Buscar</span>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, correo o teléfono"
              className={CAMPO_PANEL}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Días sin venir (mínimo)</span>
            <input
              type="number"
              min={0}
              value={diasMin}
              onChange={(e) => setDiasMin(e.target.value)}
              placeholder="Ej. 30"
              className={CAMPO_PANEL}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Gasto acumulado (mínimo ₡)</span>
            <input
              type="number"
              min={0}
              value={gastoMin}
              onChange={(e) => setGastoMin(e.target.value)}
              placeholder="Ej. 10000"
              className={CAMPO_PANEL}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Ordenar por</span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className={CAMPO_PANEL}
            >
              <option value="recientes">Más días sin venir primero</option>
              <option value="antiguos">Vino hace menos primero</option>
              <option value="mas_gasto">Mayor gasto</option>
              <option value="mas_visitas">Más visitas</option>
              <option value="nombre">Nombre (A-Z)</option>
            </select>
          </label>
        </div>

        {/* ── El rango de fechas, en su propia fila ──────────────────
            Renglón aparte y no una quinta columna de la grilla de
            arriba: son TRES controles que se leen como una sola frase
            («última visita, entre el X y el Y») y partirlos entre dos
            filas de la grilla los desarma. */}
        <div className="mt-3 grid gap-3 border-t border-aventurea-line pt-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Filtrar por fecha de</span>
            <select
              value={campoFecha}
              onChange={(e) => setCampoFecha(e.target.value as "ultimaVisita" | "desde")}
              className={CAMPO_PANEL}
            >
              <option value="ultimaVisita">Última visita</option>
              <option value="desde">Afiliación</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Desde</span>
            <input
              type="date"
              value={fechaDesde}
              // El tope alto lo pone el otro extremo: un rango con el
              // «desde» después del «hasta» no devuelve nada y se lee
              // como que no hay clientes, cuando el problema es el
              // filtro. El navegador lo impide antes de que pase.
              max={fechaHasta || undefined}
              onChange={(e) => setFechaDesde(e.target.value)}
              className={CAMPO_PANEL}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Hasta</span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => setFechaHasta(e.target.value)}
              className={CAMPO_PANEL}
            />
          </label>
        </div>

        {(tramosActivos.size > 0 ||
          busqueda ||
          diasMin ||
          gastoMin ||
          fechaDesde ||
          fechaHasta) && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setTramosActivos(new Set());
              setDiasMin("");
              setGastoMin("");
              setFechaDesde("");
              setFechaHasta("");
            }}
            className="mt-3 text-[12.5px] font-bold text-aventurea-navy hover:underline"
          >
            Quitar filtros
          </button>
        )}
      </Card>

      {/* ── El rescate ────────────────────────────────────────────── */}
      <ComposerRescate
        ranchoId={ranchoId}
        programaId={programaId}
        seleccion={seleccion}
        clientes={datos.clientes}
        onEnviado={() => setSeleccion(new Set())}
      />

      {/* ── La tabla ──────────────────────────────────────────────── */}
      <Card sinPadding>
        <div className="flex items-center justify-between gap-3 border-b border-aventurea-line px-4 py-3">
          <p className={CUERPO}>
            {filtrados.length} de {datos.clientes.length} clientes
          </p>
          {rescatablesFiltrados.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setSeleccion(new Set(rescatablesFiltrados.map((c) => c.miembroId)))
              }
              className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
            >
              Seleccionar los {rescatablesFiltrados.length} rescatables de esta lista
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-aventurea-line text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                <th scope="col" className="w-10 px-4 py-2.5" />
                <th scope="col" className="px-2 py-2.5">Cliente</th>
                <th scope="col" className="px-2 py-2.5">Tramo</th>
                <th scope="col" className="px-2 py-2.5">Visitas</th>
                <th scope="col" className="px-2 py-2.5">Última visita</th>
                <th scope="col" className="px-2 py-2.5">Gasto acumulado</th>
                <th scope="col" className="px-2 py-2.5">Ticket prom.</th>
                <th scope="col" className="px-2 py-2.5">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[13px] text-aventurea-ink-soft">
                    Nadie coincide con estos filtros.
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <FilaCliente
                    key={c.miembroId}
                    ranchoId={ranchoId}
                    programaId={programaId}
                    cliente={c}
                    seleccionado={seleccion.has(c.miembroId)}
                    onSeleccionar={() => alternarSeleccion(c.miembroId)}
                    rescatable={c.tramo === "en_riesgo" || c.tramo === "dormido"}
                    abierto={abierto === c.miembroId}
                    onAbrir={() => setAbierto(abierto === c.miembroId ? null : c.miembroId)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FilaCliente({
  ranchoId,
  programaId,
  cliente,
  seleccionado,
  onSeleccionar,
  rescatable,
  abierto,
  onAbrir,
}: {
  ranchoId: string;
  programaId: string;
  cliente: ClienteAuditado;
  seleccionado: boolean;
  onSeleccionar: () => void;
  rescatable: boolean;
  abierto: boolean;
  onAbrir: () => void;
}) {
  return (
    <>
      <tr className="border-b border-aventurea-line last:border-0 hover:bg-aventurea-cream-2">
        <td className="px-4 py-2.5">
          {rescatable && (
            <input
              type="checkbox"
              checked={seleccionado}
              onChange={onSeleccionar}
              aria-label={`Elegir a ${cliente.nombre} para el rescate`}
              className="h-4 w-4 rounded border-aventurea-line accent-[color:var(--accion,#0f4c9e)]"
            />
          )}
        </td>
        <td className="px-2 py-2.5">
          <button type="button" onClick={onAbrir} className="text-left">
            <p className={`${CUERPO} font-bold text-aventurea-navy hover:underline`}>
              {cliente.nombre}
            </p>
            {cliente.contacto.length > 0 && (
              <p className={CUERPO_SUAVE}>{cliente.contacto.join(" · ")}</p>
            )}
            {cliente.soloContacto && (
              <p className={`${DETALLE} text-amber-700`}>Identidad local — sin cuenta</p>
            )}
          </button>
        </td>
        <td className="px-2 py-2.5">
          <PildoraEstado estado={TONO[cliente.tramo]}>{TRAMOS[cliente.tramo].etiqueta}</PildoraEstado>
        </td>
        <td className={`px-2 py-2.5 ${CUERPO}`}>{cliente.visitas}</td>
        <td className="px-2 py-2.5">
          <p className={CUERPO}>{formatoFecha(cliente.ultimaVisita)}</p>
          {cliente.diasSinVenir !== null && (
            <p className={CUERPO_SUAVE}>hace {cliente.diasSinVenir} días</p>
          )}
        </td>
        <td className="px-2 py-2.5">
          <p className={CUERPO}>{formatoColones(cliente.gastoTotal)}</p>
          {cliente.ventasConMonto === 0 && cliente.visitas > 0 && (
            <p className={DETALLE}>sin montos registrados</p>
          )}
        </td>
        <td className={`px-2 py-2.5 ${CUERPO}`}>
          {cliente.ticketPromedio !== null ? formatoColones(cliente.ticketPromedio) : "—"}
        </td>
        <td className={`px-2 py-2.5 ${CUERPO}`}>
          {cliente.saldo}
          {cliente.puedeCanjear && (
            <span className="ml-1.5 text-[11px] font-bold text-aventurea-green">canjea</span>
          )}
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={8} className="border-b border-aventurea-line bg-aventurea-cream-2 px-4 py-4">
            <FichaAuditoria ranchoId={ranchoId} programaId={programaId} cliente={cliente} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * LA FICHA DE AUDITORÍA — la línea de tiempo completa de un cliente.
 *
 * Se abre EN LA FILA (no en un modal aparte): es más rápido de cerrar,
 * no necesita foco atrapado ni tecla Escape, y el panel no tiene un
 * patrón de diálogo propio que valga la pena montar para esto.
 */
function FichaAuditoria({
  ranchoId,
  programaId,
  cliente,
}: {
  ranchoId: string;
  programaId: string;
  cliente: ClienteAuditado;
}) {
  const [eventos, setEventos] = useState<EventoCliente[] | null>(null);
  const [cargando, iniciarCarga] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (eventos === null && !cargando && error === null) {
    iniciarCarga(async () => {
      const r = await auditarCliente(ranchoId, programaId, cliente.miembroId);
      if (r.ok) setEventos(r.eventos ?? []);
      else setError(r.motivo);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12.5px] text-aventurea-ink-soft">
        <span>
          Cliente desde <strong className="text-aventurea-ink">{formatoFecha(cliente.desde)}</strong>
        </span>
        <span>
          {cliente.canjes} canje{cliente.canjes === 1 ? "" : "s"} entregado
          {cliente.canjes === 1 ? "" : "s"}
        </span>
      </div>

      {cargando && <p className="text-[13px] text-aventurea-ink-soft">Cargando su historial…</p>}
      {error !== null && <p className="text-[13px] text-red-700">{error}</p>}

      {eventos !== null && eventos.length === 0 && (
        <p className="text-[13px] text-aventurea-ink-soft">Todavía no tiene ningún movimiento.</p>
      )}

      {eventos !== null && eventos.length > 0 && (
        <ol className="flex flex-col gap-2">
          {eventos.map((ev, i) => (
            <li
              key={`${ev.fecha}-${i}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-aventurea-ink">
                  {ev.tipo === "sello" ? "Sello acreditado" : ev.tipo === "canje" ? "Canje" : "Ajuste"}
                  {ev.producto && <span className="font-normal"> — {ev.producto}</span>}
                </p>
                <p className="text-[11.5px] text-aventurea-ink-soft">
                  {new Date(ev.fecha).toLocaleString("es-CR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {ev.referencia && ` · ${ev.referencia}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-bold text-aventurea-ink">
                  {ev.puntos > 0 ? "+" : ""}
                  {ev.puntos}
                </p>
                {ev.monto !== null && (
                  <p className="text-[11.5px] text-aventurea-ink-soft">{formatoColones(ev.monto)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * EL COMPOSER DEL RESCATE.
 *
 * Aparece cuando hay una selección. El mensaje default se puede editar
 * — no todos los negocios quieren decir lo mismo — y `enviarRescate`
 * vuelve a filtrar del lado del servidor por si algo cambió entre que
 * se armó la lista y se apretó enviar.
 */
function ComposerRescate({
  ranchoId,
  programaId,
  seleccion,
  clientes,
  onEnviado,
}: {
  ranchoId: string;
  programaId: string;
  seleccion: Set<string>;
  clientes: ClienteAuditado[];
  onEnviado: () => void;
}) {
  const [mensaje, setMensaje] = useState(
    "Hace rato no te vemos — tus sellos siguen guardados. ¡Te esperamos!",
  );
  const [enviando, iniciarEnvio] = useTransition();
  const [resultado, setResultado] = useState<
    { tipo: "ok"; texto: string } | { tipo: "error"; texto: string } | null
  >(null);

  if (seleccion.size === 0) return null;

  const nombres = clientes
    .filter((c) => seleccion.has(c.miembroId))
    .slice(0, 3)
    .map((c) => c.nombre.split(" ")[0]);
  const resto = seleccion.size - nombres.length;

  return (
    <Card sinPadding className="border-2 border-aventurea-navy p-4">
      <p className={CUERPO}>
        <strong>{seleccion.size}</strong> elegido{seleccion.size === 1 ? "" : "s"} para el
        rescate — {nombres.join(", ")}
        {resto > 0 ? ` y ${resto} más` : ""}.
      </p>
      <label className="mt-3 flex flex-col gap-1">
        <span className={ROTULO_CAMPO}>El mensaje que les va a llegar</span>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={178}
          rows={2}
          className={CAMPO_PANEL}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={enviando}
          onClick={() => {
            setResultado(null);
            iniciarEnvio(async () => {
              const r = await enviarRescate(ranchoId, programaId, [...seleccion], mensaje);
              if (r.ok) {
                const partes = [];
                if (r.correos > 0) partes.push(`${r.correos} por correo`);
                if (r.google > 0) partes.push(`${r.google} por Google Wallet`);
                const sinCanal = r.sinCanal > 0 ? ` — ${r.sinCanal} sin ningún canal directo` : "";
                setResultado({ tipo: "ok", texto: `Enviado: ${partes.join(" y ")}${sinCanal}.` });
                onEnviado();
              } else {
                setResultado({ tipo: "error", texto: r.motivo });
              }
            });
          }}
          className={BOTON_PANEL_PRIMARIO}
        >
          {enviando ? "Enviando…" : "Enviar rescate"}
        </button>
        <button type="button" onClick={onEnviado} className={BOTON_PANEL}>
          Cancelar
        </button>
      </div>
      {resultado && (
        <p
          className={`mt-2 text-[12.5px] font-bold ${resultado.tipo === "ok" ? "text-aventurea-green" : "text-red-700"}`}
        >
          {resultado.texto}
        </p>
      )}
    </Card>
  );
}
