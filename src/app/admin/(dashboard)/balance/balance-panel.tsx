"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  agregarGasto,
  borrarGasto,
  guardarComision,
} from "./actions";
import PasarelaPreview from "./pasarela-preview";
import DetalleNegocio from "./detalle-negocio";
import CobroNegocioForm from "./cobro-negocio-form";
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  RECURRENCIAS,
  RECURRENCIA_LABEL,
  type Gasto,
  type RanchoBalance,
  type ReservaBalance,
} from "./types";
import { SECCION_CORTA, type SeccionAdmin } from "../vertical";
import {
  etiquetaCobro,
  ingresoPorRancho,
  type CobroNegocio,
} from "@/lib/cobro-plataforma";
import { aFecha } from "@/lib/finanzas";

function fmt(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

function addDays(iso: string, delta: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function calcularDelta(actual: number, previo: number) {
  if (previo === 0) {
    if (actual === 0) return { texto: "sin cambios", signo: null as boolean | null };
    return { texto: "nuevo este periodo", signo: true };
  }
  const pct = ((actual - previo) / previo) * 100;
  return {
    texto: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs. periodo anterior`,
    signo: pct >= 0,
  };
}

const PERIODOS = [
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "anio", label: "Este año" },
  { key: "todo", label: "Todo" },
] as const;

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function BalancePanel({
  reservas,
  ranchos,
  gastosIniciales,
  comisionInicial,
  seccion = "todas",
  cobros = [],
}: {
  reservas: ReservaBalance[];
  ranchos: RanchoBalance[];
  gastosIniciales: Gasto[];
  comisionInicial: number;
  seccion?: SeccionAdmin;
  /** Tarifas propias por negocio (0098); vacío si la tabla no existe. */
  cobros?: CobroNegocio[];
}) {
  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  const inicioAnio = `${hoy.getFullYear()}-01-01`;
  const finAnio = `${hoy.getFullYear()}-12-31`;

  const [comision, setComision] = useState(comisionInicial);
  const [comisionMsg, setComisionMsg] = useState<string | null>(null);
  const [comisionSimulada, setComisionSimulada] = useState(150);
  const [gastos, setGastos] = useState(gastosIniciales);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [ranchoFiltro, setRanchoFiltro] = useState("todos");
  const [desde, setDesde] = useState(inicioAnio);
  const [hasta, setHasta] = useState(finAnio);
  const [periodoActivo, setPeriodoActivo] = useState<string | null>("anio");

  function aplicarPeriodo(key: string) {
    setPeriodoActivo(key);
    if (key === "7d") { setDesde(addDays(hoyIso, -6)); setHasta(hoyIso); }
    else if (key === "30d") { setDesde(addDays(hoyIso, -29)); setHasta(hoyIso); }
    else if (key === "90d") { setDesde(addDays(hoyIso, -89)); setHasta(hoyIso); }
    else if (key === "anio") { setDesde(inicioAnio); setHasta(finAnio); }
    else if (key === "todo") { setDesde("2020-01-01"); setHasta("2100-12-31"); }
  }

  const rangoDias = useMemo(() => {
    if (!desde || !hasta) return 1;
    const ms = new Date(hasta).getTime() - new Date(desde).getTime();
    return Math.max(1, Math.round(ms / 86_400_000) + 1);
  }, [desde, hasta]);
  const rangoSemanas = rangoDias / 7;

  const previoDesde = useMemo(() => addDays(desde, -rangoDias), [desde, rangoDias]);
  const previoHasta = useMemo(() => addDays(desde, -1), [desde]);

  const nombrePorRancho = useMemo(
    () => new Map(ranchos.map((r) => [r.id, r.nombre])),
    [ranchos],
  );

  const enRango = useCallback(
    (fecha: string) => (!desde || fecha >= desde) && (!hasta || fecha <= hasta),
    [desde, hasta],
  );
  const enRangoPrevio = useCallback(
    (fecha: string) => fecha >= previoDesde && fecha <= previoHasta,
    [previoDesde, previoHasta],
  );
  const coincideRancho = useCallback(
    (r: ReservaBalance) => ranchoFiltro === "todos" || r.rancho_id === ranchoFiltro,
    [ranchoFiltro],
  );

  // Las tarifas propias por negocio (0098), como mapa para el motor.
  const cobrosPorRancho = useMemo(
    () => new Map(cobros.map((c) => [c.rancho_id, c])),
    [cobros],
  );

  // Ingresos por rancho según el rango elegido — cada negocio con SU
  // tarifa (propia o la global ₡/persona). El cálculo vive en
  // src/lib/cobro-plataforma.ts, probado aparte; acá solo se decora
  // con nombre y métricas de la fila.
  const porRancho = useMemo(() => {
    const filtradas = reservas.filter(coincideRancho);
    const mapa = ingresoPorRancho(
      filtradas,
      cobrosPorRancho,
      comision,
      aFecha(desde),
      aFecha(hasta),
    );
    return [...mapa.entries()]
      .map(([id, v]) => {
        const personasProy = v.personas;
        return {
          id,
          nombre: nombrePorRancho.get(id) ?? "Sin asignar",
          reservas: v.reservas,
          personas: v.personas,
          personasProy,
          sinMonto: v.sinMonto,
          cobro: v.cobro,
          comision: v.ingreso,
          comisionSimulada: personasProy * comisionSimulada,
          reservasPorSemana: v.reservas / rangoSemanas,
          promedioPorReserva: v.reservas > 0 ? v.ingreso / v.reservas : 0,
        };
      })
      .sort((a, b) => b.comision - a.comision || b.personas - a.personas);
  }, [reservas, coincideRancho, cobrosPorRancho, comision, comisionSimulada, desde, hasta, rangoSemanas, nombrePorRancho]);

  const totalPersonas = porRancho.reduce((a, r) => a + r.personas, 0);
  const totalPersonasProy = porRancho.reduce((a, r) => a + r.personasProy, 0);
  const totalReservas = porRancho.reduce((a, r) => a + r.reservas, 0);
  const totalIngresos = porRancho.reduce((a, r) => a + r.comision, 0);
  const totalIngresosSimulados = totalPersonasProy * comisionSimulada;
  const promedioPorReserva = totalReservas > 0 ? totalIngresos / totalReservas : 0;

  const maxBarra = Math.max(
    1,
    ...porRancho.map((r) => (totalIngresos > 0 ? r.comision : r.personas)),
  );

  // Los gastos de la sección activa; los generales (sin sección) solo
  // cuentan en la vista "Todas" para no cargárselos a una sola vertical.
  const esDeSeccion = useCallback(
    (g: Gasto) => seccion === "todas" || g.vertical === seccion,
    [seccion],
  );
  const gastosFiltrados = useMemo(
    () => gastos.filter((g) => enRango(g.fecha) && esDeSeccion(g)),
    [gastos, enRango, esDeSeccion],
  );
  const gastosGenerales = useMemo(
    () =>
      seccion === "todas"
        ? 0
        : gastos
            .filter((g) => enRango(g.fecha) && !g.vertical)
            .reduce((a, g) => a + Number(g.monto), 0),
    [gastos, enRango, seccion],
  );
  const totalGastos = gastosFiltrados.reduce((a, g) => a + Number(g.monto), 0);
  const neto = totalIngresos - totalGastos;
  const netoProyectado = totalIngresosSimulados - totalGastos;

  // Periodo anterior (misma duración, inmediatamente antes) para
  // comparar — mismo motor que el periodo actual, para que el delta
  // compare manzanas con manzanas.
  const previo = useMemo(() => {
    const mapa = ingresoPorRancho(
      reservas.filter(coincideRancho),
      cobrosPorRancho,
      comision,
      aFecha(previoDesde),
      aFecha(previoHasta),
    );
    let cuentaReservas = 0;
    let personas = 0;
    let ingresos = 0;
    for (const v of mapa.values()) {
      cuentaReservas += v.reservas;
      personas += v.personas;
      ingresos += v.ingreso;
    }
    const gastosPrevios = gastos
      .filter((g) => enRangoPrevio(g.fecha) && esDeSeccion(g))
      .reduce((a, g) => a + Number(g.monto), 0);
    return {
      reservas: cuentaReservas,
      personas,
      ingresos,
      gastos: gastosPrevios,
      neto: ingresos - gastosPrevios,
      promedioPorReserva: cuentaReservas > 0 ? ingresos / cuentaReservas : 0,
    };
  }, [reservas, gastos, enRangoPrevio, coincideRancho, cobrosPorRancho, comision, previoDesde, previoHasta, esDeSeccion]);

  function onGuardarComision() {
    setComisionMsg(null);
    startTransition(async () => {
      const res = await guardarComision(comision);
      setComisionMsg(res.error ? res.error : "Guardado.");
    });
  }

  function onAgregarGasto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const nuevo = {
      concepto: String(fd.get("concepto") || "").trim(),
      categoria: String(fd.get("categoria") || "otro"),
      monto: Number(fd.get("monto") || 0),
      recurrencia: String(fd.get("recurrencia") || "unico"),
      fecha: String(fd.get("fecha") || ""),
      notas: null,
      vertical: String(fd.get("vertical") || "") || null,
    };
    if (!nuevo.concepto || !nuevo.fecha) return;

    setError(null);
    startTransition(async () => {
      const res = await agregarGasto(nuevo);
      if (res.error || !res.id) {
        setError(res.error ?? "No se pudo guardar el gasto.");
        return;
      }
      setGastos((prev) => [{ id: res.id!, ...nuevo }, ...prev]);
      form.reset();
    });
  }

  function onBorrarGasto(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await borrarGasto(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setGastos((prev) => prev.filter((g) => g.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Filtros */}
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Periodo</label>
            <div className="flex flex-wrap gap-1.5">
              {PERIODOS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => aplicarPeriodo(p.key)}
                  className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                    periodoActivo === p.key
                      ? "bg-aventurea-ink text-white"
                      : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Negocio</label>
            <select
              value={ranchoFiltro}
              onChange={(e) => setRanchoFiltro(e.target.value)}
              className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
            >
              <option value="todos">Todos los negocios</option>
              {ranchos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setPeriodoActivo(null); }}
              className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
            />
          </div>
          <div>
            <label className={labelCls}>Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPeriodoActivo(null); }}
              className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
            />
          </div>
        </div>
        <p className="text-[12px] text-aventurea-ink-soft">
          {rangoDias} día{rangoDias === 1 ? "" : "s"} · comparado contra los {rangoDias} día{rangoDias === 1 ? "" : "s"} anteriores
        </p>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </p>
      )}

      {/* Resumen ejecutivo */}
      <section>
        <p className="mb-3 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Resumen ejecutivo
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            icon={<IconWallet />}
            label="Ingresos por comisión"
            value={fmt(totalIngresos)}
            delta={calcularDelta(totalIngresos, previo.ingresos)}
          />
          <KpiCard
            icon={<IconReceipt />}
            label="Gastos del periodo"
            value={fmt(totalGastos)}
            delta={calcularDelta(totalGastos, previo.gastos)}
            invertido
          />
          <KpiCard
            icon={<IconCalendarCheck />}
            label="Reservas confirmadas"
            value={totalReservas.toLocaleString("es-CR")}
            delta={calcularDelta(totalReservas, previo.reservas)}
          />
          <KpiCard
            icon={<IconUsers2 />}
            label="Personas reservadas"
            value={totalPersonas.toLocaleString("es-CR")}
            delta={calcularDelta(totalPersonas, previo.personas)}
          />
          <KpiCard
            icon={<IconTrend />}
            label="Promedio por reserva"
            value={fmt(promedioPorReserva)}
            delta={calcularDelta(promedioPorReserva, previo.promedioPorReserva)}
          />
          <KpiCard
            icon={<IconScale />}
            label="Balance neto"
            value={fmt(neto)}
            delta={calcularDelta(neto, previo.neto)}
            destacado
            negativo={neto < 0}
          />
        </div>
        {(comision > 0 || cobros.length > 0) && (
          <p className="mt-3 text-[12px] text-aventurea-ink-soft">
            Los ingresos son <strong>proyección</strong> según la tarifa
            configurada (global o propia de cada negocio) — todavía no se
            cobra automáticamente.
          </p>
        )}
        {comision === 0 && cobros.length === 0 && (
          <div className="mt-4 rounded-2xl bg-aventurea-navy p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
                  Proyección — todavía no cobramos
                </p>
                <p className="mt-1 max-w-[64ch] text-[12.5px] leading-relaxed text-white/75">
                  Lo que estaría dejando la plataforma con todas las reservas
                  confirmadas de este periodo (cada cita cuenta como mínimo 1
                  persona). Cuando empecemos a cobrar, este número pasa a ser
                  el ingreso real de arriba.
                </p>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-white/75">
                ₡
                <input
                  type="number"
                  min={0}
                  value={comisionSimulada}
                  onChange={(e) => setComisionSimulada(Number(e.target.value))}
                  className="w-24 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1.5 text-[13px] font-bold text-white"
                />
                por persona
              </label>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 p-3.5">
                <div className="text-xl font-bold tabular-nums text-white">
                  {fmt(totalIngresosSimulados)}
                </div>
                <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white/60">
                  Ingresos proyectados
                </div>
              </div>
              <div className="rounded-xl bg-white/10 p-3.5">
                <div
                  className={`text-xl font-bold tabular-nums ${netoProyectado < 0 ? "text-red-300" : "text-white"}`}
                >
                  {fmt(netoProyectado)}
                </div>
                <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white/60">
                  Neto proyectado (menos gastos)
                </div>
              </div>
              <div className="rounded-xl bg-white/10 p-3.5">
                <div className="text-xl font-bold tabular-nums text-white">
                  {fmt(totalReservas > 0 ? totalIngresosSimulados / totalReservas : 0)}
                </div>
                <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white/60">
                  Promedio proyectado por reserva
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Ranking por rancho */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Ranking de negocios
          </p>
          <p className="text-[12px] text-aventurea-ink-soft">
            {totalIngresos > 0 ? "Por comisión generada" : "Por volumen de personas (comisión en ₡0)"}
          </p>
        </div>

        {porRancho.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-aventurea-line bg-aventurea-surface p-10 text-center text-[13.5px] text-zinc-500">
            No hay reservas confirmadas en este periodo.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {porRancho.map((r, i) => {
              const metrica = totalIngresos > 0 ? r.comision : r.personas;
              const barPct = Math.max(3, (metrica / maxBarra) * 100);
              const pctDelTotal =
                totalIngresos > 0
                  ? (r.comision / totalIngresos) * 100
                  : totalPersonas > 0 ? (r.personas / totalPersonas) * 100 : 0;
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-aventurea-line bg-aventurea-surface p-4 transition-colors hover:border-aventurea-navy/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aventurea-cream-2 text-[11px] font-bold text-aventurea-ink-soft">
                        {i + 1}
                      </span>
                      <span className="truncate text-[13.5px] font-bold text-aventurea-ink">
                        {r.nombre}
                      </span>
                      <span
                        className={`hidden shrink-0 rounded-lg px-2 py-0.5 text-[10.5px] font-bold sm:inline-flex ${
                          r.cobro.esGlobal
                            ? "bg-aventurea-cream-2 text-aventurea-ink-soft"
                            : "bg-aventurea-navy/10 text-aventurea-navy"
                        }`}
                      >
                        {etiquetaCobro(r.cobro)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2">
                      <span className="text-[14.5px] font-bold tabular-nums text-aventurea-ink">
                        {fmt(r.comision)}
                      </span>
                      <span className="text-[11px] font-bold tabular-nums text-aventurea-ink-soft">
                        {pctDelTotal.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {r.cobro.modelo === "comision_porcentaje" && r.sinMonto > 0 && (
                    <p className="mt-1.5 text-[11px] font-bold text-aventurea-orange">
                      {r.sinMonto} reserva{r.sinMonto === 1 ? "" : "s"} sin monto: con
                      tarifa de % aportan ₡0 — el número real es mayor.
                    </p>
                  )}
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-xl bg-aventurea-cream-2">
                    <div
                      className="h-full rounded-full bg-aventurea-navy transition-[width] duration-300"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular-nums text-aventurea-ink-soft">
                    <span>
                      {r.reservas} reserva{r.reservas === 1 ? "" : "s"} · {r.reservasPorSemana.toFixed(1)}/semana
                    </span>
                    <span>{r.personas.toLocaleString("es-CR")} personas</span>
                    <span>Promedio {fmt(r.promedioPorReserva)}/reserva</span>
                    <span>A ₡{comisionSimulada}/persona: {fmt(r.comisionSimulada)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Detalle del negocio elegido en el select: su desglose por
          día/semana/mes y su tarifa editable, uno debajo del otro. */}
      {ranchoFiltro !== "todos" && (
        <>
          <DetalleNegocio
            nombre={nombrePorRancho.get(ranchoFiltro) ?? "este negocio"}
            reservas={reservas.filter((r) => r.rancho_id === ranchoFiltro)}
            cobro={
              porRancho.find((r) => r.id === ranchoFiltro)?.cobro ?? {
                rancho_id: ranchoFiltro,
                modelo: "comision_por_persona",
                valor: comision,
                esGlobal: true,
              }
            }
            desde={desde}
            hasta={hasta}
            rangoDias={rangoDias}
          />
          <CobroNegocioForm
            key={ranchoFiltro}
            ranchoId={ranchoFiltro}
            nombre={nombrePorRancho.get(ranchoFiltro) ?? "este negocio"}
            cobroActual={cobrosPorRancho.get(ranchoFiltro) ?? null}
            comisionGlobal={comision}
          />
        </>
      )}

      {/* Tarifa global */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Modelo de cobro
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Tarifa global (default) — comisión por persona reservada
        </h3>
        <p className="mt-1 max-w-[70ch] text-[12.5px] text-aventurea-ink-soft">
          Aplica a todo negocio SIN tarifa propia
          {cobros.length > 0 &&
            ` (${cobros.length} negocio${cobros.length === 1 ? " tiene" : "s tienen"} tarifa propia — elegí uno en el filtro de arriba para verla o cambiarla)`}
          . Dejala en ₡0 mientras la plataforma sea gratis; cuando decidas
          empezar a cobrar, poné el monto y los balances se recalculan solos.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] font-bold text-aventurea-ink-soft">₡</span>
          <input
            type="number"
            min={0}
            value={comision}
            onChange={(e) => setComision(Number(e.target.value))}
            className="w-32 rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
          />
          <span className="text-[12.5px] text-aventurea-ink-soft">
            por persona
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={onGuardarComision}
            className="rounded-xl bg-aventurea-navy px-5 py-2 text-[13px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
          >
            Guardar
          </button>
          {comisionMsg && (
            <span className="text-[12.5px] font-bold text-aventurea-green">
              ✓ {comisionMsg}
            </span>
          )}
        </div>

        <div className="mt-5 border-t border-dashed border-aventurea-line pt-4">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-navy">
            Simulador — &quot;¿y si cobráramos X por persona?&quot;
          </label>
          <p className="mb-2.5 text-[12px] text-aventurea-ink-soft">
            Solo para previsualizar, no cambia el cobro real. Usa las mismas
            reservas del periodo filtrado arriba.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[13px] font-bold text-aventurea-ink-soft">₡</span>
            <input
              type="number"
              min={0}
              value={comisionSimulada}
              onChange={(e) => setComisionSimulada(Number(e.target.value))}
              className="w-32 rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <span className="text-[12.5px] text-aventurea-ink-soft">por persona →</span>
            <span className="text-[14px] font-bold text-aventurea-navy">
              {fmt(totalIngresosSimulados)} proyectados
            </span>
          </div>
        </div>
      </section>

      <PasarelaPreview />

      {/* Gastos */}
      <section>
        <p className="mb-3 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Gastos de la plataforma
        </p>

        <form
          onSubmit={onAgregarGasto}
          className="mb-4 grid grid-cols-1 items-end gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm sm:grid-cols-3 lg:grid-cols-7"
        >
          <div className="lg:col-span-2">
            <label className={labelCls}>Concepto</label>
            <input type="text" name="concepto" required placeholder="Ej. Hosting Vercel" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Categoría</label>
            <select name="categoria" defaultValue="hosting" className={inputCls}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sección</label>
            <select
              name="vertical"
              key={seccion}
              defaultValue={seccion === "todas" ? "" : seccion}
              className={inputCls}
            >
              <option value="">General</option>
              <option value="citas">Agendas y citas</option>
              <option value="eventos">Eventos</option>
              <option value="hospedajes">Hospedajes</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Monto (₡)</label>
            <input type="number" name="monto" min={0} required placeholder="12000" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Recurrencia</label>
            <select name="recurrencia" defaultValue="mensual" className={inputCls}>
              {RECURRENCIAS.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCIA_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Fecha</label>
            <input
              type="date"
              name="fecha"
              required
              defaultValue={hoy.toISOString().slice(0, 10)}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="h-[42px] rounded-xl bg-aventurea-navy px-5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60 lg:col-span-7 lg:w-fit"
          >
            ＋ Agregar gasto
          </button>
        </form>

        {seccion !== "todas" && gastosGenerales > 0 && (
          <p className="mb-4 rounded-[10px] bg-aventurea-cream-2 p-3 text-[12.5px] text-aventurea-ink-soft">
            Además hay {fmt(gastosGenerales)} en gastos generales de la
            plataforma en este periodo — esos se cuentan solo en la vista
            &quot;Todas&quot;.
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-aventurea-cream-2/60">
                {["Concepto", "Categoría", "Sección", "Recurrencia", "Fecha", "Monto", ""].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-aventurea-line px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[13.5px] text-zinc-500">
                    No hay gastos registrados en este periodo.
                  </td>
                </tr>
              )}
              {gastosFiltrados.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="px-4 py-3.5 text-[13.5px] font-bold text-aventurea-ink">
                    {g.concepto}
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                    {CATEGORIA_LABEL[g.categoria] ?? g.categoria}
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                    {g.vertical ? (SECCION_CORTA[g.vertical] ?? g.vertical) : "General"}
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                    {RECURRENCIA_LABEL[g.recurrencia] ?? g.recurrencia}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                    {g.fecha}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-[13.5px] font-bold text-aventurea-ink">
                    {fmt(Number(g.monto))}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      disabled={pending}
                      onClick={() => onBorrarGasto(g.id)}
                      className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink-soft hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  delta,
  invertido = false,
  destacado = false,
  negativo = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: { texto: string; signo: boolean | null };
  invertido?: boolean;
  destacado?: boolean;
  negativo?: boolean;
}) {
  // Para gastos, subir es malo (invertido); para el resto, subir es bueno.
  const favorable = delta.signo === null ? null : invertido ? !delta.signo : delta.signo;

  if (destacado) {
    return (
      <div
        className={`rounded-2xl p-5 shadow-sm ${negativo ? "bg-red-700" : "bg-aventurea-green"}`}
      >
        <div className="flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
            {icon}
          </span>
          {delta.signo !== null && (
            <span className="text-[11px] font-bold text-white/85">
              {delta.signo ? "↑ " : "↓ "}
              {delta.texto}
            </span>
          )}
        </div>
        <div className="mt-3 text-2xl font-bold leading-tight tabular-nums text-white">
          {value}
        </div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-white/70">
          {label}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-aventurea-navy/10 text-aventurea-navy">
          {icon}
        </span>
        <span
          className={`text-[11px] font-bold ${
            favorable === null
              ? "text-aventurea-ink-soft"
              : favorable
                ? "text-aventurea-green"
                : "text-red-700"
          }`}
        >
          {favorable !== null && (delta.signo ? "↑ " : "↓ ")}
          {delta.texto}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold leading-tight tabular-nums text-aventurea-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {label}
      </div>
    </div>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8H5.5A2.5 2.5 0 0 1 3 5.5" />
      <rect x="3" y="8" width="18" height="11" rx="2" />
      <circle cx="16" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z" />
      <path strokeLinecap="round" d="M9 8h6M9 12h6" />
    </svg>
  );
}
function IconCalendarCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px]">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 14.5 10.5 16.5 15.5 13" />
    </svg>
  );
}
function IconUsers2() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px]">
      <circle cx="9" cy="8" r="3.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.7 19.5a6.3 6.3 0 0 1 12.6 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 5.3a3.2 3.2 0 0 1 0 5.4M17 14.3a6.3 6.3 0 0 1 4 5.2" />
    </svg>
  );
}
function IconTrend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17 9 11l4 4 8-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h6v6" />
    </svg>
  );
}
function IconScale() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" d="M12 3v18M7 21h10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h6M14 7h6M4 7l-2 5a3 3 0 0 0 6 0Zm16 0-2 5a3 3 0 0 0 6 0Z" />
    </svg>
  );
}
