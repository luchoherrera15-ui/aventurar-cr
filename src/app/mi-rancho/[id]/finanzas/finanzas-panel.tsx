"use client";

import { useMemo, useState, useTransition } from "react";
import {
  IconCalendarLine,
  IconCheck,
  IconClock,
  IconTrash,
  IconWarning,
} from "@/components/icons";
import {
  CATEGORIAS_GASTO,
  GASTO_LABEL,
  fmtColones,
  saldoPendiente,
  totalEvento,
  type Gasto,
  type ReservaFinanzas,
  type ResumenFinanzas,
} from "@/lib/finanzas";
import SeccionPlegable from "@/components/seccion-plegable";
import GraficoSemanal from "./grafico-semanal";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

function fmtFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function FinanzasPanel({
  resumen,
  gastos,
  onMarcarDeposito,
  onRegistrarPago,
  onRevertirPago,
  onAgregarGasto,
  onBorrarGasto,
}: {
  resumen: ResumenFinanzas;
  gastos: Gasto[];
  onMarcarDeposito: (
    id: string,
    recibido: boolean,
  ) => Promise<{ error: string | null }>;
  onRegistrarPago: (
    id: string,
    montoFinal: number | null,
  ) => Promise<{ error: string | null }>;
  onRevertirPago: (id: string) => Promise<{ error: string | null }>;
  onAgregarGasto: (entrada: {
    fecha: string;
    concepto: string;
    categoria: string;
    monto: number;
    nota: string | null;
  }) => Promise<{ error: string | null }>;
  onBorrarGasto: (id: string) => Promise<{ error: string | null }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<ReservaFinanzas | null>(null);

  function correr(accion: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-7">
      {error && (
        <p className="rounded-xl bg-red-50 p-3.5 text-[13px] text-red-700">{error}</p>
      )}

      <Indicadores resumen={resumen} />

      {/* Primero lo que pide acción (cobros vencidos, adelantos por
          confirmar, cobros que vienen); los análisis largos — semana a
          semana y gastos — van plegados al final. */}
      {resumen.cobrosVencidos.length > 0 && (
        <CobrosVencidos
          reservas={resumen.cobrosVencidos}
          total={resumen.vencido}
          onCobrar={setCobrando}
          pending={pending}
        />
      )}

      {resumen.depositosSinValidar.length > 0 && (
        <DepositosSinValidar
          reservas={resumen.depositosSinValidar}
          pending={pending}
          onConfirmar={(id) => correr(() => onMarcarDeposito(id, true))}
        />
      )}

      <ProximosCobros
        reservas={resumen.cobrosProximos}
        onCobrar={setCobrando}
        pending={pending}
      />

      <GraficoSemanal semanas={resumen.semanas} maximoSemanal={resumen.maximoSemanal} />

      <GastosCard
        gastos={gastos}
        pending={pending}
        onAgregar={(entrada) => correr(() => onAgregarGasto(entrada))}
        onBorrar={(id) => correr(() => onBorrarGasto(id))}
      />

      {cobrando && (
        <ModalCobro
          reserva={cobrando}
          pending={pending}
          onCerrar={() => setCobrando(null)}
          onConfirmar={(montoFinal) => {
            correr(() => onRegistrarPago(cobrando.id, montoFinal));
            setCobrando(null);
          }}
          onRevertir={() => {
            correr(() => onRevertirPago(cobrando.id));
            setCobrando(null);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Indicadores
// ------------------------------------------------------------

function Indicadores({ resumen }: { resumen: ResumenFinanzas }) {
  const mes = new Date().toLocaleDateString("es-CR", { month: "long" });

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        titulo={`Entró en ${mes}`}
        valor={fmtColones(resumen.entroEsteMes)}
        detalle="Adelantos + saldos ya cobrados"
        acento="verde"
      />
      <Tile
        titulo="Por cobrar (30 días)"
        valor={fmtColones(resumen.porCobrarProximos30)}
        detalle={`${resumen.eventosProximos30} evento${
          resumen.eventosProximos30 === 1 ? "" : "s"
        } · ${fmtColones(resumen.agendadoProximos30)} agendados`}
        acento="azul"
      />
      <Tile
        titulo="Saldos vencidos"
        valor={fmtColones(resumen.vencido)}
        detalle={
          resumen.cobrosVencidos.length > 0
            ? `${resumen.cobrosVencidos.length} evento${
                resumen.cobrosVencidos.length === 1 ? "" : "s"
              } ya pasaron sin cobrarse`
            : "Todo al día"
        }
        acento={resumen.vencido > 0 ? "critico" : "neutro"}
        icono={resumen.vencido > 0 ? <IconWarning className="h-3.5 w-3.5" /> : null}
      />
      <Tile
        titulo={`Neto de ${mes}`}
        valor={fmtColones(resumen.netoEsteMes)}
        detalle={`Menos ${fmtColones(resumen.gastosEsteMes)} de gastos`}
        acento={resumen.netoEsteMes < 0 ? "critico" : "neutro"}
      />
    </div>
  );
}

const ACENTOS = {
  verde: "text-aventurea-green",
  azul: "text-aventurea-blue",
  critico: "text-red-700",
  neutro: "text-aventurea-ink",
} as const;

function Tile({
  titulo,
  valor,
  detalle,
  acento,
  icono = null,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  acento: keyof typeof ACENTOS;
  icono?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm">
      <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {icono}
        {titulo}
      </p>
      <p className={`titulo mt-2 text-[26px] ${ACENTOS[acento]}`}>{valor}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-aventurea-ink-soft">
        {detalle}
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// Cobros
// ------------------------------------------------------------

function CobrosVencidos({
  reservas,
  total,
  onCobrar,
  pending,
}: {
  reservas: ReservaFinanzas[];
  total: number;
  onCobrar: (r: ReservaFinanzas) => void;
  pending: boolean;
}) {
  return (
    <section className="rounded-2xl border border-red-300 bg-red-50/60 p-5.5">
      <h2 className="flex items-center gap-2 text-[16px] font-bold text-red-800">
        <IconWarning className="h-4 w-4" />
        Te deben {fmtColones(total)}
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-red-700">
        Estos eventos ya se hicieron y el saldo sigue sin registrarse. Si ya
        te pagaron, marcalo para que las cuentas cierren.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {reservas.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-white p-3.5"
          >
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-aventurea-ink">
                {r.nombre ?? "Sin nombre"}
                <span className="ml-2 font-normal text-aventurea-ink-soft">
                  {fmtFecha(r.fecha)}
                </span>
              </p>
              <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
                {r.tipo_evento ?? "Evento"} · total {fmtColones(totalEvento(r))} ·
                adelanto {fmtColones(Number(r.deposito_monto ?? 0))}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[15px] font-bold text-red-700">
                {fmtColones(saldoPendiente(r))}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => onCobrar(r)}
                className="rounded-lg bg-aventurea-orange px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
              >
                Registrar cobro
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DepositosSinValidar({
  reservas,
  onConfirmar,
  pending,
}: {
  reservas: ReservaFinanzas[];
  onConfirmar: (id: string) => void;
  pending: boolean;
}) {
  return (
    <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      <h2 className="flex items-center gap-2 text-[16px] font-bold text-aventurea-ink">
        <IconClock className="h-4 w-4 text-aventurea-ink-soft" />
        Adelantos por confirmar ({reservas.length})
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        El cliente subió el comprobante pero todavía no confirmaste que la
        plata llegó. Hasta que lo marqués, no se cuenta como ingreso.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {reservas.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-aventurea-line p-3.5"
          >
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-aventurea-ink">
                {r.nombre ?? "Sin nombre"}
                <span className="ml-2 font-normal text-aventurea-ink-soft">
                  {fmtFecha(r.fecha)}
                </span>
              </p>
              <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
                Adelanto de {fmtColones(Number(r.deposito_monto ?? 0))}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => onConfirmar(r.id)}
              className="rounded-lg border border-aventurea-line px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-green hover:text-aventurea-green disabled:opacity-60"
            >
              Marcar recibido
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProximosCobros({
  reservas,
  onCobrar,
  pending,
}: {
  reservas: ReservaFinanzas[];
  onCobrar: (r: ReservaFinanzas) => void;
  pending: boolean;
}) {
  return (
    <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      <h2 className="flex items-center gap-2 text-[16px] font-bold text-aventurea-ink">
        <IconCalendarLine className="h-4 w-4 text-aventurea-ink-soft" />
        Qué cobrás el día del evento
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        El saldo que te queda por cobrar en cada evento agendado.
      </p>

      {reservas.length === 0 ? (
        <p className="mt-4 rounded-xl bg-aventurea-cream-2 p-4 text-center text-[13px] text-aventurea-ink-soft">
          No tenés eventos por delante con saldo pendiente.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {reservas.slice(0, 12).map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-aventurea-line p-3.5"
            >
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-aventurea-ink">
                  {fmtFecha(r.fecha)}
                  <span className="ml-2 font-normal text-aventurea-ink-soft">
                    {r.nombre ?? "Sin nombre"}
                  </span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
                  {r.tipo_evento ?? "Evento"}
                  {r.invitados ? ` · ${r.invitados} invitados` : ""} · total{" "}
                  {fmtColones(totalEvento(r))}
                  {r.estado === "pendiente" && " · en aprobación"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-bold text-aventurea-blue">
                  {fmtColones(saldoPendiente(r))}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onCobrar(r)}
                  className="rounded-lg border border-aventurea-line px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-green hover:text-aventurea-green disabled:opacity-60"
                >
                  Ya me pagaron
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Modal de cobro
// ------------------------------------------------------------

function ModalCobro({
  reserva,
  pending,
  onCerrar,
  onConfirmar,
  onRevertir,
}: {
  reserva: ReservaFinanzas;
  pending: boolean;
  onCerrar: () => void;
  onConfirmar: (montoFinal: number | null) => void;
  onRevertir: () => void;
}) {
  const cotizado = totalEvento(reserva);
  const adelanto = Number(reserva.deposito_monto ?? 0);
  const [montoFinal, setMontoFinal] = useState(String(cotizado));

  const finalNum = Number(montoFinal) || 0;
  const saldo = Math.max(0, finalNum - adelanto);
  const cambio = finalNum !== cotizado;

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-aventurea-ink/40 backdrop-blur-md sm:items-center sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar cobro"
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-aventurea-surface p-5.5 shadow-2xl sm:max-w-[440px] sm:rounded-2xl sm:border sm:border-aventurea-line"
      >
        <h3 className="text-[17px] font-bold text-aventurea-ink">
          Registrar el cobro
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          {reserva.nombre ?? "Sin nombre"} · {fmtFecha(reserva.fecha)}
        </p>

        <div className="mt-4">
          <label className={labelCls}>Cuánto cobraste en total por el evento</label>
          <input
            type="number"
            min={0}
            value={montoFinal}
            onChange={(e) => setMontoFinal(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">
            Cotizaste {fmtColones(cotizado)}. Cambialo si el día del evento se
            cobró distinto — más invitados, horas extra, un descuento de
            última hora.
          </p>
        </div>

        <dl className="mt-4 flex flex-col gap-1.5 rounded-xl bg-aventurea-cream-2 p-3.5 text-[12.5px]">
          <div className="flex justify-between">
            <dt className="text-aventurea-ink-soft">Adelanto ya recibido</dt>
            <dd className="font-bold text-aventurea-ink">{fmtColones(adelanto)}</dd>
          </div>
          <div className="flex justify-between border-t border-aventurea-line pt-1.5">
            <dt className="text-aventurea-ink-soft">Saldo de este cobro</dt>
            <dd className="text-[15px] font-bold text-aventurea-green">
              {fmtColones(saldo)}
            </dd>
          </div>
        </dl>

        {cambio && (
          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-aventurea-orange">
            <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Este monto reemplaza la cotización en todos tus números.
          </p>
        )}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 rounded-xl border border-aventurea-line py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange/40"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onConfirmar(cambio ? finalNum : null)}
            className="flex-1 rounded-xl bg-aventurea-green py-2.5 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-60"
          >
            <IconCheck className="h-3.5 w-3.5" /> Confirmar cobro
          </button>
        </div>

        {reserva.evento_pagado && (
          <button
            type="button"
            onClick={onRevertir}
            className="mt-3 w-full text-center text-[11.5px] text-zinc-500 underline hover:text-red-700"
          >
            Marqué esto por error — deshacer el cobro
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Gastos
// ------------------------------------------------------------

function GastosCard({
  gastos,
  pending,
  onAgregar,
  onBorrar,
}: {
  gastos: Gasto[];
  pending: boolean;
  onAgregar: (entrada: {
    fecha: string;
    concepto: string;
    categoria: string;
    monto: number;
    nota: string | null;
  }) => void;
  onBorrar: (id: string) => void;
}) {
  const [fecha, setFecha] = useState(hoyIso());
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<string>("insumos");
  const [monto, setMonto] = useState("");

  const totalMes = useMemo(() => {
    const ahora = new Date();
    return gastos
      .filter((g) => {
        const [y, m] = g.fecha.split("-").map(Number);
        return y === ahora.getFullYear() && m === ahora.getMonth() + 1;
      })
      .reduce((acc, g) => acc + Number(g.monto), 0);
  }, [gastos]);

  function enviar() {
    const montoNum = Number(monto);
    if (!concepto.trim() || !montoNum) return;
    onAgregar({
      fecha,
      concepto,
      categoria,
      monto: montoNum,
      nota: null,
    });
    setConcepto("");
    setMonto("");
  }

  return (
    <SeccionPlegable
      titulo="Gastos"
      descripcion="Sin esto el panel te dice cuánto facturaste, no cuánto ganaste."
      resumen={`Este mes: ${fmtColones(totalMes)}`}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[130px_1fr_180px_130px_auto]">
        <div>
          <label className={labelCls}>Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>En qué gastaste</label>
          <input
            type="text"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. Cloro para la piscina"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={inputCls}
          >
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Monto (₡)</label>
          <input
            type="number"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="15000"
            className={inputCls}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={pending || !concepto.trim() || !monto}
            onClick={enviar}
            className="w-full rounded-xl bg-aventurea-orange px-4 py-2.5 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
          >
            Agregar
          </button>
        </div>
      </div>

      {gastos.length > 0 && (
        <ul className="mt-5 flex flex-col divide-y divide-aventurea-line border-t border-aventurea-line">
          {gastos.slice(0, 15).map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] text-aventurea-ink">{g.concepto}</p>
                <p className="text-[11.5px] text-aventurea-ink-soft">
                  {fmtFecha(g.fecha)} · {GASTO_LABEL[g.categoria] ?? "Otro"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-bold text-aventurea-ink">
                  −{fmtColones(Number(g.monto))}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onBorrar(g.id)}
                  aria-label={`Borrar el gasto ${g.concepto}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SeccionPlegable>
  );
}
