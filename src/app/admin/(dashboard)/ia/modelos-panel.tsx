"use client";

import { useMemo, useState, useTransition } from "react";
import { guardarConfigIA } from "./actions";
import {
  AGENTES,
  calcularCosto,
  esModeloValido,
  etiquetaPrecioAmbas,
  formatearAmbas,
  formatearCRC,
  formatearUSD,
  LISTA_MODELOS,
  MODELOS,
  preciosVigentes,
  type AgenteIA,
  type ModeloIA,
} from "@/lib/ia/modelos";

/**
 * Lo que consumió un agente en el último mes. Trae dos cosas distintas
 * a propósito:
 *   - `costoUSD` / `costoCRC`: lo que YA se gastó, tal como quedó
 *     asentado en uso_ia (con el modelo y el tipo de cambio que regían
 *     cada día). Es historia y no se recalcula nunca.
 *   - los tokens: la base sobre la que se PROYECTA cuánto costaría el
 *     mismo consumo con otro modelo a precios de hoy.
 * Mezclarlas fue el error original: se mostraba una proyección con
 * verbo en pasado y podía dar cinco veces menos que el gasto real.
 */
export type ConsumoAgente = {
  llamadas: number;
  tokensInput: number;
  tokensOutput: number;
  /** Gasto asentado en la bitácora, en dólares. */
  costoUSD: number;
  /** Gasto asentado en colones, con el tipo de cambio congelado. */
  costoCRC: number;
  /** Con qué modelos corrió de verdad, del más usado al menos. */
  modelos: { modelo: string; llamadas: number }[];
};

export type ConfigIaPanel = {
  activa: boolean;
  modelos: Record<AgenteIA, ModeloIA>;
  topeMensualUSD: number;
  tipoCambio: number;
};

/**
 * Estos dos agentes hacen trabajo pesado: el generador escribe una
 * invitación entera y el lector de agenda interpreta un texto o una
 * foto. Con un modelo que no razona la calidad se nota enseguida.
 */
const AGENTES_QUE_NECESITAN_RAZONAR: AgenteIA[] = ["invitacion_generar", "agenda_leer"];

const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const inputCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink";

function miles(n: number): string {
  return Math.round(n).toLocaleString("es-CR");
}

function nombreModelo(id: string): string {
  return esModeloValido(id) ? MODELOS[id].nombre : id;
}

/** Gasto ya asentado: dólares pagados y colones congelados en la fila. */
function ambasHistoricas(usd: number, crc: number): string {
  return `${formatearUSD(usd)} · ${formatearCRC(crc)}`;
}

const chipHistorial =
  "mr-1.5 inline-block rounded-md bg-aventurea-cream-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const chipProyeccion =
  "mr-1.5 inline-block rounded-md bg-aventurea-navy/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-aventurea-navy";

/** "2026-08-31" → "31/08/2026", sin depender de la zona del navegador. */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default function ModelosPanel({
  config,
  consumo,
  diasConsumo,
  consumoAproximado,
  maxRespaldo,
  fechaISO,
}: {
  config: ConfigIaPanel;
  consumo: Record<AgenteIA, ConsumoAgente>;
  diasConsumo: number;
  /** true si el consumo salió de filas acotadas y no de la agregación. */
  consumoAproximado: boolean;
  maxRespaldo: number;
  /**
   * El instante que el SERVIDOR usó para resolver los precios, en ISO.
   * Baja como texto porque es lo único que cruza el límite servidor →
   * cliente sin deformarse. Sin esto, este componente llamaría a
   * new Date() por su cuenta y el día que vence un precio de
   * lanzamiento (Sonnet 5, 31/08/2026) el HTML del servidor y el del
   * navegador dirían precios distintos: mismatch de hidratación.
   */
  fechaISO: string;
}) {
  const [modelos, setModelos] = useState<Record<AgenteIA, ModeloIA>>(config.modelos);
  const [activa, setActiva] = useState(config.activa);
  const [tope, setTope] = useState(String(config.topeMensualUSD));
  const [tipoCambio, setTipoCambio] = useState(String(config.tipoCambio));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  const tipoCambioNum = Number(tipoCambio) > 0 ? Number(tipoCambio) : config.tipoCambio;

  // La fecha de referencia se reconstruye una sola vez y se le pasa a
  // TODO lo que resuelve precios (preciosVigentes, calcularCosto,
  // etiquetaPrecioAmbas). Que sea la misma en las dos corridas es lo que
  // garantiza que el render del servidor y el del navegador coincidan.
  const fechaRef = useMemo(() => new Date(fechaISO), [fechaISO]);

  const hayCambios = useMemo(() => {
    if (activa !== config.activa) return true;
    if (Number(tope) !== config.topeMensualUSD) return true;
    if (Number(tipoCambio) !== config.tipoCambio) return true;
    return AGENTES.some((a) => modelos[a.id] !== config.modelos[a.id]);
  }, [activa, tope, tipoCambio, modelos, config]);

  // Dos números que no se pueden mezclar: `realUSD/realCRC` es lo que
  // la bitácora dice que se gastó, y `actual/nuevo` son proyecciones a
  // precios de hoy. `actual` NO es el gasto histórico: es lo que habría
  // costado ese mismo consumo si todo el periodo hubiera corrido con la
  // configuración guardada hoy.
  const totales = useMemo(() => {
    let realUSD = 0;
    let realCRC = 0;
    let actual = 0;
    let nuevo = 0;
    let llamadas = 0;
    for (const a of AGENTES) {
      const c = consumo[a.id];
      if (!c) continue;
      realUSD += c.costoUSD;
      realCRC += c.costoCRC;
      llamadas += c.llamadas;
      actual += calcularCosto(config.modelos[a.id], c.tokensInput, c.tokensOutput, fechaRef);
      nuevo += calcularCosto(modelos[a.id], c.tokensInput, c.tokensOutput, fechaRef);
    }
    return { realUSD, realCRC, llamadas, actual, nuevo, diferencia: nuevo - actual };
  }, [consumo, modelos, config.modelos, fechaRef]);

  function onGuardar() {
    setMensaje(null);
    setError(null);
    startTransition(async () => {
      const res = await guardarConfigIA({
        activa,
        modelos,
        topeMensualUSD: Number(tope) || 0,
        tipoCambio: Number(tipoCambio) || 0,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setMensaje("Configuración guardada. Los agentes ya están usando estos modelos.");
    });
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Interruptor general */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Interruptor general
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[15.5px] font-bold text-aventurea-ink">
              Inteligencia artificial {activa ? "encendida" : "apagada"}
            </h3>
            <p className="mt-1 max-w-[72ch] text-[12.5px] text-aventurea-ink-soft">
              Con esto apagado ningún agente gasta un token: el chat del
              diseñador, el generador de invitaciones y el asistente de los
              negocios le avisan al cliente que la función no está
              disponible, en vez de fallar.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
            <input
              type="checkbox"
              checked={activa}
              onChange={(e) => setActiva(e.target.checked)}
              className="h-4 w-4 accent-aventurea-navy"
            />
            Encendida
          </label>
        </div>
        {!activa && (
          <p className="mt-3.5 rounded-[10px] bg-aventurea-orange-light p-3 text-[12.5px] font-bold text-aventurea-orange-dark">
            Mientras esté apagada, ninguna invitación se puede generar con IA.
          </p>
        )}
      </section>

      {/* Un modelo por agente */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Qué modelo usa cada agente
          </p>
          <p className="max-w-[60ch] text-[12px] text-aventurea-ink-soft">
            <strong>Historial</strong> es lo que la bitácora dice que ya se
            gastó. <strong>Proyección</strong> aplica los precios de hoy a los
            tokens de los últimos {diasConsumo} días: sirve para comparar
            modelos, no para contabilidad.
          </p>
        </div>

        {consumoAproximado && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3.5 text-[12.5px] leading-relaxed text-amber-800">
            El consumo de los últimos {diasConsumo} días salió de las últimas{" "}
            {miles(maxRespaldo)} llamadas y no del periodo completo: falta
            aplicar la migración <strong>0078_panel_ia.sql</strong>.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {AGENTES.map((agente) => {
            const elegido = modelos[agente.id];
            const guardado = config.modelos[agente.id];
            const info = MODELOS[elegido];
            const uso = consumo[agente.id] ?? {
              llamadas: 0,
              tokensInput: 0,
              tokensOutput: 0,
              costoUSD: 0,
              costoCRC: 0,
              modelos: [],
            };
            // Proyecciones: los dos lados se recalculan a precios de hoy
            // para que la comparación sea entre peras y peras. Ninguno de
            // los dos es el gasto histórico — ese es uso.costoUSD.
            const costoActual = calcularCosto(guardado, uso.tokensInput, uso.tokensOutput, fechaRef);
            const costoNuevo = calcularCosto(elegido, uso.tokensInput, uso.tokensOutput, fechaRef);
            const diferencia = costoNuevo - costoActual;
            const modelosUsados = uso.modelos
              .map((m) => `${nombreModelo(m.modelo)} (${miles(m.llamadas)})`)
              .join(" · ");
            const necesitaRazonar = AGENTES_QUE_NECESITAN_RAZONAR.includes(agente.id);

            return (
              <div
                key={agente.id}
                className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[280px] flex-1">
                    <h3 className="text-[14px] font-bold text-aventurea-ink">{agente.nombre}</h3>
                    <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                      {agente.queHace}
                    </p>
                  </div>
                  <div className="w-full sm:w-[360px]">
                    <label className={labelCls} htmlFor={`modelo-${agente.id}`}>
                      Modelo
                    </label>
                    <select
                      id={`modelo-${agente.id}`}
                      value={elegido}
                      onChange={(e) =>
                        setModelos((prev) => ({
                          ...prev,
                          [agente.id]: e.target.value as ModeloIA,
                        }))
                      }
                      className={`${inputCls} w-full`}
                    >
                      {LISTA_MODELOS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} — {etiquetaPrecioAmbas(m.id, tipoCambioNum, fechaRef)}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">{info.paraQue}</p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-col gap-2 border-t border-dashed border-aventurea-line pt-3">
                  {uso.llamadas === 0 ? (
                    <p className="text-[12px] text-aventurea-ink-soft">
                      Sin consumo en los últimos {diasConsumo} días: no hay con qué estimar.
                    </p>
                  ) : (
                    <>
                      {/* Pasado: el costo asentado, nunca uno recalculado. */}
                      <p className="text-[12px] tabular-nums text-aventurea-ink-soft">
                        <span className={chipHistorial}>Historial</span>
                        {miles(uso.llamadas)} llamada{uso.llamadas === 1 ? "" : "s"} en los
                        últimos {diasConsumo} días gastaron{" "}
                        <strong className="text-aventurea-ink">
                          {ambasHistoricas(uso.costoUSD, uso.costoCRC)}
                        </strong>
                        {modelosUsados ? ` con ${modelosUsados}` : ""}.
                      </p>
                      {/* Futuro: hipótesis a precios de hoy, dicho en futuro. */}
                      {elegido === guardado ? (
                        <p className="text-[12px] tabular-nums text-aventurea-ink-soft">
                          <span className={chipProyeccion}>Proyección</span>
                          Con ese mismo consumo y los precios de hoy,{" "}
                          {MODELOS[guardado].nombre} costaría{" "}
                          {formatearAmbas(costoActual, tipoCambioNum)}.
                        </p>
                      ) : (
                        <p className="text-[12.5px] tabular-nums text-aventurea-ink">
                          <span className={chipProyeccion}>Proyección</span>
                          Con ese mismo consumo y los precios de hoy:{" "}
                          <span className="text-aventurea-ink-soft line-through">
                            {formatearAmbas(costoActual, tipoCambioNum)} con{" "}
                            {MODELOS[guardado].nombre}
                          </span>{" "}
                          → <strong>{formatearAmbas(costoNuevo, tipoCambioNum)}</strong>{" "}
                          <span
                            className={`font-bold ${
                              diferencia > 0 ? "text-aventurea-orange-dark" : "text-aventurea-green"
                            }`}
                          >
                            ({diferencia > 0 ? "+" : ""}
                            {formatearAmbas(diferencia, tipoCambioNum)} cada {diasConsumo} días)
                          </span>
                        </p>
                      )}
                    </>
                  )}
                </div>

                {necesitaRazonar && !info.soportaEsfuerzo && (
                  <p className="mt-3 rounded-[10px] bg-aventurea-orange-light p-3 text-[12.5px] leading-relaxed text-aventurea-orange-dark">
                    <strong>{info.nombre}</strong> no acepta el parámetro de
                    esfuerzo y no razona por su cuenta. Para este agente
                    conviene un modelo que sí (Sonnet 5, Opus 5 o Fable 5): con
                    Haiku el resultado sale más pobre aunque cueste menos.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {totales.llamadas > 0 && (
          <div className="mt-4 rounded-2xl bg-aventurea-navy p-5 shadow-sm">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
              Últimos {diasConsumo} días
            </p>
            <p className="mt-1.5 text-[14px] tabular-nums text-white">
              <span className="mr-1.5 inline-block rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
                Historial
              </span>
              Se gastaron{" "}
              <strong>{ambasHistoricas(totales.realUSD, totales.realCRC)}</strong> en{" "}
              {miles(totales.llamadas)} llamada{totales.llamadas === 1 ? "" : "s"}, con los
              modelos que estaban puestos cada día y el tipo de cambio de cada
              día.
            </p>
            {Math.abs(totales.diferencia) > 0.000001 ? (
              <p className="mt-2 text-[14px] tabular-nums text-white">
                <span className="mr-1.5 inline-block rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
                  Proyección
                </span>
                A precios de hoy y a ₡{miles(tipoCambioNum)} por dólar, ese mismo
                consumo daría{" "}
                <strong>{formatearAmbas(totales.actual, tipoCambioNum)}</strong> con la
                configuración guardada y{" "}
                <strong>{formatearAmbas(totales.nuevo, tipoCambioNum)}</strong> con la
                selección de arriba: {totales.diferencia > 0 ? "+" : ""}
                {formatearAmbas(totales.diferencia, tipoCambioNum)}.
              </p>
            ) : (
              <p className="mt-2 text-[13px] tabular-nums text-white/75">
                <span className="mr-1.5 inline-block rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
                  Proyección
                </span>
                A precios de hoy, ese mismo consumo daría{" "}
                <strong>{formatearAmbas(totales.nuevo, tipoCambioNum)}</strong>. Cambiá
                un modelo arriba para comparar.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Tope y tipo de cambio */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Freno de gasto
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-5">
          <div>
            <label className={labelCls} htmlFor="ia-tope">
              Tope mensual (US$)
            </label>
            <input
              id="ia-tope"
              type="number"
              min={0}
              step="0.01"
              value={tope}
              onChange={(e) => setTope(e.target.value)}
              className={`${inputCls} w-40`}
            />
            <p className="mt-1.5 max-w-[42ch] text-[11.5px] text-aventurea-ink-soft">
              0 = sin tope. Alcanzado el monto, los agentes dejan de gastar y le
              avisan al cliente con un mensaje amable.
            </p>
          </div>
          <div>
            <label className={labelCls} htmlFor="ia-tipo-cambio">
              Tipo de cambio (₡ por US$)
            </label>
            <input
              id="ia-tipo-cambio"
              type="number"
              min={1}
              step="0.01"
              value={tipoCambio}
              onChange={(e) => setTipoCambio(e.target.value)}
              className={`${inputCls} w-40`}
            />
            <p className="mt-1.5 max-w-[42ch] text-[11.5px] text-aventurea-ink-soft">
              Con esto se convierte a colones todo lo que Anthropic cobra en
              dólares. Cada llamada guarda el que regía ese día.
            </p>
          </div>
          {Number(tope) > 0 && (
            <p className="text-[12.5px] text-aventurea-ink-soft">
              Tope equivalente: <strong>{formatearCRC(Number(tope) * tipoCambioNum)}</strong> al mes.
            </p>
          )}
        </div>
      </section>

      {/* Guardar */}
      <section className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={guardando || !hayCambios}
          onClick={onGuardar}
          className="rounded-xl bg-aventurea-navy px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar configuración"}
        </button>
        {!hayCambios && !mensaje && (
          <span className="text-[12.5px] text-aventurea-ink-soft">
            No hay cambios pendientes.
          </span>
        )}
        {mensaje && (
          <span className="text-[12.5px] font-bold text-aventurea-green">{mensaje}</span>
        )}
        {error && (
          <span className="rounded-[10px] bg-aventurea-orange-light px-3 py-2 text-[12.5px] font-bold text-aventurea-orange-dark">
            {error}
          </span>
        )}
      </section>

      {/* Tabla de precios */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Precios de los modelos
          </p>
          <p className="text-[12px] text-aventurea-ink-soft">
            Por millón de tokens, convertido a ₡{miles(tipoCambioNum)} por dólar.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-aventurea-cream-2/60">
                {[
                  "Modelo",
                  "Para qué sirve",
                  "Entrada / millón",
                  "Salida / millón",
                  "Contexto",
                  "Salida máxima",
                  "Razonamiento",
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
              {LISTA_MODELOS.map((m) => {
                const precios = preciosVigentes(m.id, fechaRef);
                const enUso = AGENTES.filter((a) => modelos[a.id] === m.id);
                return (
                  <tr
                    key={m.id}
                    className="border-b border-aventurea-line align-top last:border-none hover:bg-aventurea-cream-2/40"
                  >
                    <td className="px-4 py-3.5">
                      <span className="text-[13.5px] font-bold text-aventurea-ink">{m.nombre}</span>
                      {precios.enPromo && precios.promoHasta && (
                        <span className="mt-1 block rounded-md bg-aventurea-orange-light px-2 py-1 text-[11px] font-bold text-aventurea-orange-dark">
                          Precio de lanzamiento hasta el {fechaCorta(precios.promoHasta)}; después
                          sube a {formatearAmbas(m.entradaUSD, tipoCambioNum)} entrada /{" "}
                          {formatearAmbas(m.salidaUSD, tipoCambioNum)} salida
                        </span>
                      )}
                      {enUso.length > 0 && (
                        <span className="mt-1 block text-[11px] text-aventurea-ink-soft">
                          En uso: {enUso.map((a) => a.nombre).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[34ch] px-4 py-3.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                      {m.paraQue}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-aventurea-ink">
                      {formatearUSD(precios.entradaUSD)}
                      <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                        {formatearCRC(precios.entradaUSD * tipoCambioNum)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-aventurea-ink">
                      {formatearUSD(precios.salidaUSD)}
                      <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                        {formatearCRC(precios.salidaUSD * tipoCambioNum)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] tabular-nums text-aventurea-ink-soft">
                      {miles(m.contexto)} tokens
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] tabular-nums text-aventurea-ink-soft">
                      {miles(m.salidaMaxima)} tokens
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-aventurea-ink-soft">
                      {m.soportaEsfuerzo
                        ? m.razonaPorDefecto
                          ? "Razona solo y acepta esfuerzo"
                          : "Acepta esfuerzo"
                        : "No razona ni acepta esfuerzo"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
