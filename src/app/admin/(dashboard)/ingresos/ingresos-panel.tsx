"use client";

import { useMemo, useState } from "react";
import { fmtColones } from "@/lib/finanzas";
import BotonEliminar from "@/components/boton-eliminar";
import { eliminarPedidoInvitacion } from "../invitaciones/actions";

export type Cobro = {
  id: string;
  /** De qué producto de Bookea entró la plata. */
  fuente: "invitaciones" | "lealtad";
  /** El evento de la invitación, o el negocio del plan de lealtad. */
  concepto: string;
  cliente: string;
  paquete: string;
  metodo: "sinpe" | "transferencia" | "stripe";
  monto: number;
  /** YYYY-MM-DD del día en que entró la plata. */
  fecha: string;
  /** Ya verificado por el equipo (vs. comprobante por revisar). */
  confirmado: boolean;
  /** La captura del depósito, si el flujo la guarda (lealtad, 0128). */
  comprobanteUrl?: string | null;
};

const METODOS: { id: Cobro["metodo"]; label: string; color: string }[] = [
  { id: "sinpe", label: "SINPE Móvil", color: "bg-aventurea-navy" },
  { id: "transferencia", label: "Transferencia", color: "bg-[#3b7fc4]" },
  { id: "stripe", label: "Stripe (tarjeta)", color: "bg-aventurea-sky" },
];

const FUENTES: { id: Cobro["fuente"]; label: string }[] = [
  { id: "invitaciones", label: "Invitaciones" },
  { id: "lealtad", label: "Planes de Lealtad" },
];

const PERIODOS = [
  { id: "7d", label: "7 días", dias: 7 },
  { id: "30d", label: "30 días", dias: 30 },
  { id: "90d", label: "90 días", dias: 90 },
  { id: "todo", label: "Todo", dias: 0 },
] as const;

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function restarDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function IngresosPanel({ cobros }: { cobros: Cobro[] }) {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["id"]>("30d");
  const [fuente, setFuente] = useState<"todas" | Cobro["fuente"]>("todas");
  const [soloConfirmados, setSoloConfirmados] = useState(false);
  /**
   * Los cobros que se acaban de borrar. El servidor revalida
   * /admin/finanzas y las props vuelven ya sin ellos, pero eso llega un
   * instante después: hasta entonces la fila desaparece igual y los
   * totales del periodo se recalculan de una vez. Cuando las props se
   * refrescan, el id simplemente ya no está y el filtro deja de tener
   * efecto — no hay estado que se quede desincronizado.
   */
  const [borrados, setBorrados] = useState<string[]>([]);

  const desde = useMemo(() => {
    const p = PERIODOS.find((x) => x.id === periodo);
    return p && p.dias > 0 ? restarDias(p.dias) : "0000-01-01";
  }, [periodo]);

  const filtrados = useMemo(
    () =>
      cobros.filter(
        (c) =>
          !borrados.includes(c.id) &&
          c.fecha >= desde &&
          c.fecha <= hoyISO() &&
          (fuente === "todas" || c.fuente === fuente) &&
          (!soloConfirmados || c.confirmado),
      ),
    [cobros, borrados, desde, fuente, soloConfirmados],
  );

  /**
   * El control minucioso: por cada producto, cuánto entró y POR DÓNDE
   * (SINPE vs transferencia vs tarjeta). Ignora el filtro de fuente a
   * propósito — esta tabla ES la comparación entre fuentes.
   */
  const porFuente = useMemo(() => {
    const base = cobros.filter(
      (c) =>
        !borrados.includes(c.id) &&
        c.fecha >= desde &&
        c.fecha <= hoyISO() &&
        (!soloConfirmados || c.confirmado),
    );
    return FUENTES.map((f) => {
      const propios = base.filter((c) => c.fuente === f.id);
      const porMetodo: Record<string, number> = {};
      for (const m of METODOS) {
        porMetodo[m.id] = propios
          .filter((c) => c.metodo === m.id)
          .reduce((s, c) => s + c.monto, 0);
      }
      return {
        ...f,
        n: propios.length,
        total: propios.reduce((s, c) => s + c.monto, 0),
        porMetodo,
      };
    });
  }, [cobros, borrados, desde, soloConfirmados]);

  /** Totales por método, y cuánto está aún por verificar. */
  const porMetodo = useMemo(() => {
    const acc: Record<string, { total: number; porVerificar: number; n: number }> = {};
    for (const m of METODOS) acc[m.id] = { total: 0, porVerificar: 0, n: 0 };
    for (const c of filtrados) {
      const fila = acc[c.metodo];
      if (!fila) continue;
      fila.total += c.monto;
      fila.n += 1;
      if (!c.confirmado) fila.porVerificar += c.monto;
    }
    return acc;
  }, [filtrados]);

  const total = useMemo(
    () => filtrados.reduce((s, c) => s + c.monto, 0),
    [filtrados],
  );
  const totalPorVerificar = useMemo(
    () => filtrados.filter((c) => !c.confirmado).reduce((s, c) => s + c.monto, 0),
    [filtrados],
  );

  /** Una fila por día, con el desglose por método. */
  const porDia = useMemo(() => {
    const mapa = new Map<string, Record<string, number> & { total: number }>();
    for (const c of filtrados) {
      if (!c.fecha) continue;
      const fila =
        mapa.get(c.fecha) ??
        ({ sinpe: 0, transferencia: 0, stripe: 0, total: 0 } as Record<
          string,
          number
        > & { total: number });
      fila[c.metodo] = (fila[c.metodo] ?? 0) + c.monto;
      fila.total += c.monto;
      mapa.set(c.fecha, fila);
    }
    return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtrados]);

  const maxDia = Math.max(1, ...porDia.map(([, f]) => f.total));

  return (
    <div className="grid gap-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={`rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
              periodo === p.id
                ? "bg-aventurea-navy text-white"
                : "border border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-aventurea-line" aria-hidden />
        {(["todas", ...FUENTES.map((f) => f.id)] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFuente(f)}
            className={`rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
              fuente === f
                ? "bg-aventurea-navy text-white"
                : "border border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            {f === "todas" ? "Todo" : FUENTES.find((x) => x.id === f)?.label}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-aventurea-ink">
          <input
            type="checkbox"
            checked={soloConfirmados}
            onChange={(e) => setSoloConfirmados(e.target.checked)}
            className="h-4 w-4 rounded border-aventurea-line accent-aventurea-navy"
          />
          Solo pagos verificados
        </label>
      </div>

      {/* Por producto: cuánto entra de cada cosa, y POR DÓNDE entra */}
      <div>
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Por producto
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-aventurea-cream-2/60">
              <tr>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Producto
                </th>
                {METODOS.map((m) => (
                  <th
                    key={m.id}
                    className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {porFuente.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="px-4 py-3 font-bold text-aventurea-ink">
                    {f.label}
                    <span className="ml-2 text-[11px] font-normal text-aventurea-ink-soft">
                      {f.n} cobro{f.n === 1 ? "" : "s"}
                    </span>
                  </td>
                  {METODOS.map((m) => (
                    <td
                      key={m.id}
                      className="px-4 py-3 text-right tabular-nums text-aventurea-ink-soft"
                    >
                      {f.porMetodo[m.id] ? fmtColones(f.porMetodo[m.id]) : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-aventurea-ink">
                    {fmtColones(f.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales por método */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METODOS.map((m) => {
          const d = porMetodo[m.id];
          const pct = total > 0 ? Math.round((d.total / total) * 100) : 0;
          return (
            <div
              key={m.id}
              className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  {m.label}
                </p>
                <span className="text-[11px] font-bold text-aventurea-ink-soft">
                  {pct}%
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold leading-tight tabular-nums text-aventurea-ink">
                {fmtColones(d.total)}
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-xl bg-aventurea-cream-2">
                <div
                  className={`h-full rounded-full ${m.color} transition-[width] duration-300`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
                {d.n} cobro{d.n === 1 ? "" : "s"}
                {d.porVerificar > 0 && (
                  <span className="ml-1 font-bold text-amber-700">
                    · {fmtColones(d.porVerificar)} por verificar
                  </span>
                )}
              </p>
            </div>
          );
        })}

        <div className="rounded-2xl bg-aventurea-green p-5 text-white shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">
            Total del periodo
          </p>
          <p className="mt-2 text-2xl font-bold leading-tight tabular-nums">
            {fmtColones(total)}
          </p>
          <p className="mt-2 text-[11.5px] text-white/75">
            {totalPorVerificar > 0
              ? `${fmtColones(totalPorVerificar)} esperan verificación`
              : "Todo verificado"}
          </p>
        </div>
      </div>

      {/* Día por día */}
      <div>
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Día por día
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-aventurea-cream-2/60">
              <tr>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Fecha
                </th>
                {METODOS.map((m) => (
                  <th
                    key={m.id}
                    className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Total del día
                </th>
              </tr>
            </thead>
            <tbody>
              {porDia.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[13px] text-aventurea-ink-soft"
                  >
                    Todavía no hay pagos en este periodo.
                  </td>
                </tr>
              )}
              {porDia.map(([fecha, fila]) => (
                <tr
                  key={fecha}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="px-4 py-3 font-bold text-aventurea-ink">{fecha}</td>
                  {METODOS.map((m) => (
                    <td
                      key={m.id}
                      className="px-4 py-3 text-right tabular-nums text-aventurea-ink-soft"
                    >
                      {fila[m.id] ? fmtColones(fila[m.id]) : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold tabular-nums text-aventurea-ink">
                      {fmtColones(fila.total)}
                    </span>
                    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-aventurea-cream-2">
                      <span
                        className="block h-full rounded-full bg-aventurea-navy"
                        style={{ width: `${Math.round((fila.total / maxDia) * 100)}%` }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* El detalle, para cuadrar contra el banco */}
      <div>
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Cobro por cobro
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-aventurea-cream-2/60">
              <tr>
                {[
                  "Fecha",
                  "Evento",
                  "Cliente",
                  "Paquete",
                  "Método",
                  "Estado",
                  "Monto",
                  "",
                ].map((h, i) => (
                  <th
                    key={h || `acciones-${i}`}
                    className={`px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft ${
                      h === "Monto" ? "text-right" : ""
                    }`}
                  >
                    {h || <span className="sr-only">Acciones</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, 100).map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="px-4 py-3 text-aventurea-ink-soft">{c.fecha}</td>
                  <td className="max-w-[240px] px-4 py-3">
                    <span className="block truncate font-semibold text-aventurea-ink">
                      {c.concepto}
                    </span>
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                      {FUENTES.find((f) => f.id === c.fuente)?.label ?? c.fuente}
                    </span>
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-aventurea-ink-soft">
                    {c.cliente || "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-aventurea-ink-soft">
                    {c.paquete || "—"}
                  </td>
                  <td className="px-4 py-3 text-aventurea-ink-soft">
                    {METODOS.find((m) => m.id === c.metodo)?.label ?? c.metodo}
                    {c.comprobanteUrl && (
                      <a
                        href={c.comprobanteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-[11.5px] font-bold text-aventurea-navy underline"
                      >
                        comprobante
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                        c.confirmado
                          ? "bg-[#e1f0e6] text-[#1f7a4d]"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {c.confirmado ? "Verificado" : "Por verificar"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-aventurea-ink">
                    {fmtColones(c.monto)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* Un cobro de lealtad vive en su solicitud (0126):
                        no se borra desde acá — el registro es la
                        auditoría del depósito. */}
                    {c.fuente === "invitaciones" && (
                    <BotonEliminar
                      variante="texto"
                      que="este cobro"
                      detalles={[
                        { rotulo: "Evento", valor: c.concepto },
                        { rotulo: "Cliente", valor: c.cliente },
                        { rotulo: "Paquete", valor: c.paquete },
                        {
                          rotulo: "Método",
                          valor: METODOS.find((m) => m.id === c.metodo)?.label ?? c.metodo,
                        },
                        { rotulo: "Monto", valor: fmtColones(c.monto) },
                        { rotulo: "Fecha", valor: c.fecha },
                        {
                          rotulo: "Estado",
                          valor: c.confirmado ? "Verificado" : "Por verificar",
                        },
                      ]}
                      advertencia={
                        `Esta fila es plata: se borra de forma PERMANENTE el pedido de invitación completo ` +
                        `y ${fmtColones(c.monto)} salen del total del periodo. ` +
                        `El pedido también desaparece de Invitaciones digitales. ` +
                        `La invitación que ya se le entregó al cliente no se toca.`
                      }
                      onEliminar={() => eliminarPedidoInvitacion(c.id)}
                      onEliminado={() => setBorrados((prev) => [...prev, c.id])}
                    />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length > 100 && (
          <p className="mt-2 text-[12px] text-aventurea-ink-soft">
            Mostrando los 100 cobros más recientes de {filtrados.length}.
          </p>
        )}
      </div>
    </div>
  );
}
