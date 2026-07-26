"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  agregarGasto,
  borrarGasto,
  guardarComision,
} from "./actions";
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  RECURRENCIAS,
  RECURRENCIA_LABEL,
  type Gasto,
  type RanchoBalance,
  type ReservaBalance,
} from "./types";

function fmt(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function BalancePanel({
  reservas,
  ranchos,
  gastosIniciales,
  comisionInicial,
}: {
  reservas: ReservaBalance[];
  ranchos: RanchoBalance[];
  gastosIniciales: Gasto[];
  comisionInicial: number;
}) {
  const hoy = new Date();
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

  const rangoDias = useMemo(() => {
    if (!desde || !hasta) return 1;
    const ms = new Date(hasta).getTime() - new Date(desde).getTime();
    return Math.max(1, Math.round(ms / 86_400_000) + 1);
  }, [desde, hasta]);
  const rangoSemanas = rangoDias / 7;

  const nombrePorRancho = useMemo(
    () => new Map(ranchos.map((r) => [r.id, r.nombre])),
    [ranchos],
  );

  const enRango = useCallback(
    (fecha: string) =>
      (!desde || fecha >= desde) && (!hasta || fecha <= hasta),
    [desde, hasta],
  );

  // Ingresos por rancho, según el rango de fechas elegido.
  const porRancho = useMemo(() => {
    const acc = new Map<
      string,
      { nombre: string; reservas: number; personas: number }
    >();
    reservas
      .filter((r) => enRango(r.fecha))
      .filter((r) => ranchoFiltro === "todos" || r.rancho_id === ranchoFiltro)
      .forEach((r) => {
        const key = r.rancho_id ?? "sin-rancho";
        const nombre =
          (r.rancho_id && nombrePorRancho.get(r.rancho_id)) ?? "Sin asignar";
        const prev = acc.get(key) ?? { nombre, reservas: 0, personas: 0 };
        prev.reservas += 1;
        prev.personas += r.invitados ?? 0;
        acc.set(key, prev);
      });
    return [...acc.entries()]
      .map(([id, v]) => ({
        id,
        ...v,
        comision: v.personas * comision,
        comisionSimulada: v.personas * comisionSimulada,
        reservasPorSemana: v.reservas / rangoSemanas,
        personasPorSemana: v.personas / rangoSemanas,
      }))
      .sort((a, b) => b.comision - a.comision || b.personas - a.personas);
  }, [reservas, ranchoFiltro, enRango, comision, comisionSimulada, rangoSemanas, nombrePorRancho]);

  const totalPersonas = porRancho.reduce((a, r) => a + r.personas, 0);
  const totalReservas = porRancho.reduce((a, r) => a + r.reservas, 0);
  const totalIngresos = totalPersonas * comision;
  const totalIngresosSimulados = totalPersonas * comisionSimulada;

  const gastosFiltrados = useMemo(
    () => gastos.filter((g) => enRango(g.fecha)),
    [gastos, enRango],
  );
  const totalGastos = gastosFiltrados.reduce((a, g) => a + Number(g.monto), 0);
  const neto = totalIngresos - totalGastos;

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
    <div className="flex flex-col gap-6">
      {/* Comisión */}
      <section className="rounded-2xl border border-aventurea-line bg-white p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Modelo de cobro
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Comisión por persona reservada
        </h3>
        <p className="mt-1 max-w-[70ch] text-[12.5px] text-aventurea-ink-soft">
          Se cobra por cada persona de las reservas ya confirmadas. Dejalo en
          ₡0 mientras la plataforma sea gratis; cuando decidas empezar a
          cobrar, poné 100 y los balances se recalculan solos.
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
            className="rounded-full bg-aventurea-orange px-5 py-2 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
          >
            Guardar
          </button>
          {comisionMsg && (
            <span className="text-[12.5px] font-bold text-aventurea-green">
              ✓ {comisionMsg}
            </span>
          )}
        </div>
        {comision === 0 && (
          <p className="mt-3 rounded-[10px] bg-aventurea-orange/10 p-3 text-[12.5px] text-aventurea-orange">
            Ahora mismo la plataforma es gratis (₡0 por persona), así que los
            ingresos aparecen en cero. Todo lo demás ya se está registrando.
          </p>
        )}

        <div className="mt-5 border-t border-dashed border-aventurea-line pt-4">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-orange">
            Simulador — &quot;¿y si cobráramos X por persona?&quot;
          </label>
          <p className="mb-2.5 text-[12px] text-aventurea-ink-soft">
            Solo para previsualizar, no cambia el cobro real. Usa las mismas
            reservas del periodo filtrado abajo.
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
            <span className="text-[14px] font-bold text-aventurea-orange">
              {fmt(totalIngresosSimulados)} proyectados
            </span>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-aventurea-line bg-white p-4.5 shadow-sm">
        <div>
          <label className={labelCls}>Salón</label>
          <select
            value={ranchoFiltro}
            onChange={(e) => setRanchoFiltro(e.target.value)}
            className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
          >
            <option value="todos">Todos los salones</option>
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
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
          />
        </div>
        <div>
          <label className={labelCls}>Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setRanchoFiltro("todos");
            setDesde(inicioAnio);
            setHasta(finAnio);
          }}
          className="rounded-full border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
        >
          Restablecer
        </button>
      </section>

      {/* Totales */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Ingresos por comisión" value={fmt(totalIngresos)} color="orange" />
        <Stat label="Gastos del periodo" value={fmt(totalGastos)} color="ink" />
        <Stat
          label="Balance neto"
          value={fmt(neto)}
          color={neto >= 0 ? "green" : "red"}
        />
        <Stat
          label="Personas reservadas"
          value={`${totalPersonas.toLocaleString("es-CR")} · ${totalReservas} reserva${totalReservas === 1 ? "" : "s"}`}
          color="navy"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </p>
      )}

      {/* Ingresos por salón */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15.5px] font-bold text-aventurea-ink">
            Ingresos por salón
          </h3>
          <p className="text-[12px] text-aventurea-ink-soft">
            Periodo: {rangoDias} día{rangoDias === 1 ? "" : "s"} (≈ {rangoSemanas.toFixed(1)} semanas)
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-aventurea-cream-2/60">
                {[
                  "Salón",
                  "Reservas",
                  "Reservas/semana",
                  "Personas",
                  "Personas/semana",
                  "Comisión generada",
                  `A ₡${comisionSimulada}/persona`,
                ].map((h) => (
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
              {porRancho.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[13.5px] text-zinc-500">
                    No hay reservas confirmadas en este periodo.
                  </td>
                </tr>
              )}
              {porRancho.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="px-4 py-3.5 text-[13.5px] font-bold text-aventurea-ink">
                    {r.nombre}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-aventurea-ink-soft">
                    {r.reservas}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-aventurea-ink-soft">
                    {r.reservasPorSemana.toFixed(1)}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-aventurea-ink-soft">
                    {r.personas.toLocaleString("es-CR")}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-aventurea-ink-soft">
                    {r.personasPorSemana.toFixed(1)}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] font-bold text-aventurea-orange">
                    {fmt(r.comision)}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] font-bold text-aventurea-ink-soft">
                    {fmt(r.comisionSimulada)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gastos */}
      <section>
        <h3 className="mb-3 text-[15.5px] font-bold text-aventurea-ink">
          Gastos de la plataforma
        </h3>

        <form
          onSubmit={onAgregarGasto}
          className="mb-4 grid grid-cols-1 items-end gap-3 rounded-2xl border border-aventurea-line bg-white p-4.5 shadow-sm sm:grid-cols-3 lg:grid-cols-6"
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
            className="h-[42px] rounded-full bg-aventurea-orange px-5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60 lg:col-span-6 lg:w-fit"
          >
            ＋ Agregar gasto
          </button>
        </form>

        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-aventurea-cream-2/60">
                {["Concepto", "Categoría", "Recurrencia", "Fecha", "Monto", ""].map((h) => (
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
                  <td colSpan={6} className="px-4 py-10 text-center text-[13.5px] text-zinc-500">
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

const STAT_BG: Record<string, string> = {
  orange: "bg-aventurea-orange",
  navy: "bg-aventurea-navy",
  green: "bg-aventurea-green",
  ink: "bg-aventurea-ink",
  red: "bg-red-700",
};

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: keyof typeof STAT_BG;
}) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${STAT_BG[color]}`}>
      <div className="text-xl font-bold leading-tight text-white">{value}</div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70">
        {label}
      </div>
    </div>
  );
}
