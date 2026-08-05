"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AGENTES,
  esModeloValido,
  formatearAmbas,
  formatearCRC,
  formatearUSD,
  MODELOS,
  NOMBRE_AGENTE,
} from "@/lib/ia/modelos";

/** Una llamada a un modelo, tal como quedó registrada en uso_ia. */
export type FilaUso = {
  id: string;
  agente: string;
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  costoUSD: number;
  /** Colones congelados en la fila: el tipo de cambio de ese día. */
  costoCRC: number;
  exito: boolean;
  error: string | null;
  /** created_at en ISO (UTC). */
  creado: string;
};

/** Lo que gastó un agente en el periodo, sumado en la base. */
export type ResumenAgente = {
  agente: string;
  llamadas: number;
  tokensInput: number;
  tokensOutput: number;
  costoUSD: number;
  costoCRC: number;
  fallidas: number;
  modelos: { modelo: string; llamadas: number }[];
};

/** Un día tico del periodo, ya sumado en la base. */
export type ResumenDia = {
  dia: string;
  llamadas: number;
  tokensInput: number;
  tokensOutput: number;
  costoUSD: number;
  costoCRC: number;
};

const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const inputCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink";

/**
 * Costa Rica es UTC-6 todo el año (no hay horario de verano), así que
 * el corrimiento es fijo. Se hace a mano en vez de con toLocaleString
 * para que el servidor y el navegador pinten exactamente lo mismo.
 */
function enHoraCR(iso: string): Date {
  return new Date(new Date(iso).getTime() - 6 * 3_600_000);
}

function fechaHoraCR(iso: string): string {
  const d = enHoraCR(iso).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)}`;
}

function nombreAgente(id: string): string {
  const tabla = NOMBRE_AGENTE as Record<string, string | undefined>;
  return tabla[id] ?? id;
}

function nombreModelo(id: string): string {
  return esModeloValido(id) ? MODELOS[id].nombre : id;
}

function miles(n: number): string {
  return Math.round(n).toLocaleString("es-CR");
}

/**
 * Gasto ya asentado: los dólares que se pagaron y los colones que se
 * congelaron en esa misma fila. NO recalcula con el tipo de cambio de
 * hoy — junio ya cerrado no puede cambiar de monto porque el admin
 * corrija el tipo de cambio en agosto.
 */
function ambasHistoricas(usd: number, crc: number): string {
  return `${formatearUSD(usd)} · ${formatearCRC(crc)}`;
}

/** Los atajos de periodo, resueltos siempre en fecha de Costa Rica. */
function rangosRapidos(): { key: string; label: string; desde: string; hasta: string }[] {
  const hoy = enHoraCR(new Date().toISOString()).toISOString().slice(0, 10);
  const menos = (dias: number) => {
    const d = new Date(`${hoy}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - dias);
    return d.toISOString().slice(0, 10);
  };
  return [
    { key: "mes", label: "Este mes", desde: `${hoy.slice(0, 7)}-01`, hasta: hoy },
    { key: "7d", label: "7 días", desde: menos(6), hasta: hoy },
    { key: "30d", label: "30 días", desde: menos(29), hasta: hoy },
    { key: "anio", label: "Este año", desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy },
  ];
}

export default function GastoPanel({
  resumenAgentes,
  porDia,
  filas,
  maxDetalle,
  desde,
  hasta,
  tipoCambio,
  gastoMesUSD,
  gastoMesCRC,
  mesCRCAproximado,
  topeMensualUSD,
  totalesTruncados,
  maxRespaldo,
}: {
  /** Totales por agente, sumados en Postgres (no son filas contadas). */
  resumenAgentes: ResumenAgente[];
  porDia: ResumenDia[];
  /** Solo el detalle reciente: nunca sale un total de acá. */
  filas: FilaUso[];
  maxDetalle: number;
  desde: string;
  hasta: string;
  tipoCambio: number;
  gastoMesUSD: number;
  gastoMesCRC: number;
  mesCRCAproximado: boolean;
  topeMensualUSD: number;
  totalesTruncados: boolean;
  maxRespaldo: number;
}) {
  const router = useRouter();
  const [cargando, startTransition] = useTransition();
  const [desdeEdit, setDesdeEdit] = useState(desde);
  const [hastaEdit, setHastaEdit] = useState(hasta);
  const [agenteFiltro, setAgenteFiltro] = useState("todos");
  const [limiteDetalle, setLimiteDetalle] = useState(50);

  const rangos = useMemo(() => rangosRapidos(), []);
  const filtrando = agenteFiltro !== "todos";

  // El rango vive en la URL porque la consulta la hace el servidor: así
  // el filtro se puede compartir o recargar y trae lo mismo.
  function aplicarRango(nuevoDesde: string, nuevoHasta: string) {
    setDesdeEdit(nuevoDesde);
    setHastaEdit(nuevoHasta);
    startTransition(() => {
      router.push(`/admin/ia?tab=gasto&desde=${nuevoDesde}&hasta=${nuevoHasta}`, {
        scroll: false,
      });
    });
  }

  // El filtro por agente se aplica sobre el resumen agregado, no sobre
  // el detalle: así los totales y el pie del filtro hablan de lo mismo.
  const porAgente = useMemo(
    () =>
      filtrando ? resumenAgentes.filter((a) => a.agente === agenteFiltro) : resumenAgentes,
    [resumenAgentes, agenteFiltro, filtrando],
  );

  const totales = useMemo(() => {
    let costoUSD = 0;
    let costoCRC = 0;
    let tokensInput = 0;
    let tokensOutput = 0;
    let fallidas = 0;
    let llamadas = 0;
    for (const a of porAgente) {
      costoUSD += a.costoUSD;
      costoCRC += a.costoCRC;
      tokensInput += a.tokensInput;
      tokensOutput += a.tokensOutput;
      fallidas += a.fallidas;
      llamadas += a.llamadas;
    }
    return { costoUSD, costoCRC, tokensInput, tokensOutput, fallidas, llamadas };
  }, [porAgente]);

  const detalleVisible = useMemo(
    () => (filtrando ? filas.filter((f) => f.agente === agenteFiltro) : filas),
    [filas, agenteFiltro, filtrando],
  );

  const maxDia = Math.max(1, ...porDia.map((d) => d.costoUSD));
  const maxAgente = Math.max(1, ...porAgente.map((a) => a.costoUSD));

  const pctTope = topeMensualUSD > 0 ? (gastoMesUSD / topeMensualUSD) * 100 : 0;
  const cercaDelTope = topeMensualUSD > 0 && pctTope >= 80;
  const pasoElTope = topeMensualUSD > 0 && pctTope >= 100;

  // Los agentes del catálogo, más los que aparezcan en los datos y ya
  // no existan en el código (un nombre viejo, o uno mal escrito).
  const agentesDelFiltro = useMemo(() => {
    const conocidos = AGENTES.map((a) => a.id as string);
    const extras = [...new Set(resumenAgentes.map((a) => a.agente))].filter(
      (id) => !conocidos.includes(id),
    );
    return [...conocidos, ...extras];
  }, [resumenAgentes]);

  return (
    <div className="flex flex-col gap-7">
      {/* Lo gastado en el mes contra el tope */}
      <section
        className={`rounded-2xl p-5.5 shadow-sm ${
          pasoElTope ? "bg-aventurea-sky-dark" : "bg-aventurea-navy"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
              Gasto de IA del mes corriente
            </p>
            <p className="mt-1.5 text-3xl font-bold tabular-nums text-white">
              {ambasHistoricas(gastoMesUSD, gastoMesCRC)}
            </p>
            <p className="mt-1 text-[12.5px] text-white/70">
              {topeMensualUSD > 0
                ? `Tope del mes: ${formatearAmbas(topeMensualUSD, tipoCambio)} · ${pctTope.toFixed(0)}% usado`
                : "Sin tope configurado. Podés poner uno en la pestaña Modelos."}
            </p>
          </div>
          <p className="max-w-[38ch] text-[12px] leading-relaxed text-white/65">
            El mes se corta en hora de Costa Rica, igual que el periodo de
            abajo. Los colones de lo ya gastado son los que se congelaron en
            cada llamada
            {mesCRCAproximado
              ? " (o, si no se pudieron leer, una conversión con el tipo de cambio de hoy)"
              : ""}
            ; el tipo de cambio configurado (₡{miles(tipoCambio)} por dólar) se
            usa solo para topes y precios de lista.
          </p>
        </div>

        {topeMensualUSD > 0 && (
          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-xl bg-white/15">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  pasoElTope ? "bg-white" : cercaDelTope ? "bg-aventurea-sky" : "bg-white/85"
                }`}
                style={{ width: `${Math.min(100, Math.max(1.5, pctTope))}%` }}
              />
            </div>
            {pasoElTope && (
              <p className="mt-2.5 text-[12.5px] font-bold text-white">
                Se alcanzó el tope: los agentes están respondiendo que el
                límite del mes se agotó. Subilo o esperá al mes que viene.
              </p>
            )}
            {!pasoElTope && cercaDelTope && (
              <p className="mt-2.5 text-[12.5px] font-bold text-white/90">
                Queda menos del 20% del tope del mes.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Filtros del periodo */}
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Periodo</label>
            <div className="flex flex-wrap gap-1.5">
              {rangos.map((r) => {
                const puesto = desde === r.desde && hasta === r.hasta;
                return (
                  <button
                    key={r.key}
                    type="button"
                    disabled={cargando}
                    onClick={() => aplicarRango(r.desde, r.hasta)}
                    className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition-colors disabled:opacity-60 ${
                      puesto
                        ? "bg-aventurea-ink text-white"
                        : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Desde</label>
            <input
              type="date"
              value={desdeEdit}
              onChange={(e) => setDesdeEdit(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Hasta</label>
            <input
              type="date"
              value={hastaEdit}
              onChange={(e) => setHastaEdit(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            disabled={cargando || !desdeEdit || !hastaEdit}
            onClick={() => aplicarRango(desdeEdit, hastaEdit)}
            className="h-[42px] rounded-xl bg-aventurea-navy px-5 text-[13px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
          >
            {cargando ? "Buscando…" : "Aplicar"}
          </button>
          <div>
            <label className={labelCls}>Agente</label>
            <select
              value={agenteFiltro}
              onChange={(e) => setAgenteFiltro(e.target.value)}
              className={inputCls}
            >
              <option value="todos">Todos los agentes</option>
              {agentesDelFiltro.map((id) => (
                <option key={id} value={id}>
                  {nombreAgente(id)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* El pie cuenta lo MISMO que las tarjetas: si hay filtro puesto,
            son las llamadas de ese agente, no las de todos. */}
        <p className="text-[12px] text-aventurea-ink-soft">
          {desde} al {hasta} · {miles(totales.llamadas)} llamada
          {totales.llamadas === 1 ? "" : "s"}{" "}
          {filtrando ? `de ${nombreAgente(agenteFiltro)}` : "registradas"}
        </p>
      </section>

      {totalesTruncados && (
        <p className="rounded-xl bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-800">
          <strong>Totales truncados.</strong> No se pudieron usar las funciones
          de agregación de la migración <strong>0078_panel_ia.sql</strong>, así
          que estos números salen de las últimas {miles(maxRespaldo)} llamadas
          del periodo y no del periodo completo. Corré la migración para ver el
          total de verdad.
        </p>
      )}

      {/* Resumen del periodo */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Resumen del periodo
          </p>
          <p className="text-[12px] text-aventurea-ink-soft">
            {totalesTruncados
              ? "Suma parcial: faltan las llamadas más viejas del periodo."
              : "Sumado en la base: es el periodo completo, no una muestra."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Kpi
            label="Costo total"
            valor={formatearUSD(totales.costoUSD)}
            pie={`${formatearCRC(totales.costoCRC)} al cambio de cada llamada`}
            destacado
          />
          <Kpi label="Llamadas" valor={miles(totales.llamadas)} pie="a los modelos" />
          <Kpi
            label="Tokens de entrada"
            valor={miles(totales.tokensInput)}
            pie="lo que se les mandó"
          />
          <Kpi
            label="Tokens de salida"
            valor={miles(totales.tokensOutput)}
            pie="lo que respondieron"
          />
          <Kpi
            label="Llamadas fallidas"
            valor={miles(totales.fallidas)}
            pie="se pagan igual"
            alerta={totales.fallidas > 0}
          />
        </div>
      </section>

      {/* Por agente */}
      <section>
        <p className="mb-3 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Gasto por agente
        </p>
        {porAgente.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-aventurea-line bg-aventurea-surface p-10 text-center text-[13.5px] text-zinc-500">
            No hay llamadas registradas en este periodo.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {porAgente.map((a) => (
              <div
                key={a.agente}
                className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-bold text-aventurea-ink">
                    {nombreAgente(a.agente)}
                  </span>
                  <span className="shrink-0 text-[14.5px] font-bold tabular-nums text-aventurea-ink">
                    {formatearUSD(a.costoUSD)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-xl bg-aventurea-cream-2">
                  <div
                    className="h-full rounded-full bg-aventurea-navy"
                    style={{ width: `${Math.max(3, (a.costoUSD / maxAgente) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[12px] tabular-nums text-aventurea-ink-soft">
                  {formatearCRC(a.costoCRC)} · {miles(a.llamadas)} llamada
                  {a.llamadas === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-[11.5px] tabular-nums text-aventurea-ink-soft">
                  {miles(a.tokensInput)} tokens de entrada · {miles(a.tokensOutput)} de salida
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {a.modelos.map((m) => (
                    <span
                      key={m.modelo}
                      className="rounded-md bg-aventurea-cream-2 px-2 py-1 text-[11px] font-bold text-aventurea-ink-soft"
                    >
                      {nombreModelo(m.modelo)} · {miles(m.llamadas)}
                    </span>
                  ))}
                </div>
                {a.fallidas > 0 && (
                  <p className="mt-2.5 rounded-md bg-aventurea-sky-light px-2.5 py-1.5 text-[11.5px] font-bold text-aventurea-orange-dark">
                    {miles(a.fallidas)} llamada{a.fallidas === 1 ? "" : "s"} sin respuesta
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Día por día */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Día por día
          </p>
          {/* La agregación diaria no se abre por agente: mejor decirlo que
              dejar creer que la tabla siguió el filtro. */}
          <p className="text-[12px] text-aventurea-ink-soft">
            {filtrando
              ? "Todos los agentes: el filtro de arriba no aplica a esta tabla."
              : "Días de Costa Rica, del más reciente al más viejo."}
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-aventurea-cream-2/60">
                {["Fecha", "Llamadas", "Tokens de entrada", "Tokens de salida", "Costo", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap border-b border-aventurea-line px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {porDia.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[13.5px] text-zinc-500">
                    Ningún día del periodo tuvo consumo.
                  </td>
                </tr>
              )}
              {porDia.map((d) => (
                <tr
                  key={d.dia}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-bold text-aventurea-ink">
                    {d.dia}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-aventurea-ink-soft">
                    {miles(d.llamadas)}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-aventurea-ink-soft">
                    {miles(d.tokensInput)}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-aventurea-ink-soft">
                    {miles(d.tokensOutput)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-bold tabular-nums text-aventurea-ink">
                    {ambasHistoricas(d.costoUSD, d.costoCRC)}
                  </td>
                  <td className="w-[22%] px-4 py-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-xl bg-aventurea-cream-2">
                      <div
                        className="h-full rounded-full bg-aventurea-navy"
                        style={{ width: `${Math.max(3, (d.costoUSD / maxDia) * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detalle llamada por llamada */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Últimas llamadas
          </p>
          {/* Esta tabla SÍ es una muestra: se dice, para que nadie sume acá. */}
          <p className="max-w-[62ch] text-[12px] text-aventurea-ink-soft">
            Detalle reciente, no el total: como mucho las últimas{" "}
            {miles(maxDetalle)} llamadas del periodo. Hora de Costa Rica; las que
            fallaron se cobran igual.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-aventurea-cream-2/60">
                {["Fecha", "Agente", "Modelo", "Entrada", "Salida", "Costo", "Estado"].map((h) => (
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
              {detalleVisible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[13.5px] text-zinc-500">
                    No hay llamadas que mostrar.
                  </td>
                </tr>
              )}
              {detalleVisible.slice(0, limiteDetalle).map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular-nums text-aventurea-ink-soft">
                    {fechaHoraCR(f.creado)}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold text-aventurea-ink">
                    {nombreAgente(f.agente)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-aventurea-ink-soft">
                    {nombreModelo(f.modelo)}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] tabular-nums text-aventurea-ink-soft">
                    {miles(f.tokensInput)}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] tabular-nums text-aventurea-ink-soft">
                    {miles(f.tokensOutput)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] font-bold tabular-nums text-aventurea-ink">
                    {ambasHistoricas(f.costoUSD, f.costoCRC)}
                  </td>
                  <td className="px-4 py-3">
                    {f.exito ? (
                      <span className="text-[12px] text-aventurea-ink-soft">Correcta</span>
                    ) : (
                      <span
                        title={f.error ?? undefined}
                        className="inline-block max-w-[26ch] truncate rounded-md bg-aventurea-sky-light px-2 py-1 text-[11.5px] font-bold text-aventurea-orange-dark"
                      >
                        Falló{f.error ? `: ${f.error}` : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {detalleVisible.length > limiteDetalle && (
          <button
            type="button"
            onClick={() => setLimiteDetalle((n) => n + 50)}
            className="mt-3 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
          >
            Ver 50 más ({miles(detalleVisible.length - limiteDetalle)} restantes)
          </button>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  valor,
  pie,
  destacado = false,
  alerta = false,
}: {
  label: string;
  valor: string;
  pie: string;
  destacado?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        destacado
          ? "border-aventurea-navy/30 bg-aventurea-navy/5"
          : "border-aventurea-line bg-aventurea-surface"
      }`}
    >
      <div
        className={`text-2xl font-bold leading-tight tabular-nums ${
          alerta ? "text-aventurea-orange-dark" : "text-aventurea-ink"
        }`}
      >
        {valor}
      </div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {label}
      </div>
      <div className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">{pie}</div>
    </div>
  );
}
