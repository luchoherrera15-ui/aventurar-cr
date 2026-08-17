"use client";

import { useMemo, useState, useTransition } from "react";
import { formatearCRC, formatearUSD } from "@/lib/dinero";
import { nombreAddon } from "@/lib/addons";
import {
  HALLAZGO_INFO,
  LO_QUE_LA_BASE_NO_GUARDA,
  METODO_LABEL,
  METODOS_COBRO,
  MIGRACION_COBROS,
  PERIODO_LABEL,
  PERIODOS_VISTA,
  PRODUCTO_LABEL,
  PRODUCTOS_COBRO,
  diaCR,
  enPeriodo,
  esIngreso,
  nombrePlan,
  resumenCortesias,
  totalesDe,
  totalesPor,
  type ClaveHallazgo,
  type CobroModulo,
  type CobroSinMonto,
  type CortesiaDePlan,
  type Hallazgo,
  type MetodoCobro,
  type PeriodoVista,
  type ProductoCobro,
  type Totales,
} from "@/lib/auditoria-modulos";
import FormularioCobro, {
  type NegocioOpcion,
  type PrellenadoCobro,
} from "./formulario-cobro";
import { anularCobro } from "./actions";

export type { NegocioOpcion };

/**
 * La pantalla de la auditoría de módulos.
 *
 * El orden no es decorativo: primero los PROBLEMAS, después el agujero
 * que la base todavía tiene, y de último los totales. Una tabla de
 * sumas se lee y no encuentra nada; lo que hace útil una auditoría es
 * la lista de contradicciones que alguien tiene que ir a resolver.
 *
 * Los totales salen SIEMPRE de las filas que se están mostrando
 * (`totalesDe(filtrados)`), nunca de otra consulta: un total que no
 * cuadra con la lista de abajo es la forma clásica de que un panel de
 * plata mienta sin que nadie lo note.
 */
export default function AuditoriaPanel({
  cobros,
  ocultosPorSeccion,
  seccionLabel,
  hallazgos,
  sinMonto,
  stripeSinCobro,
  negocios,
  faltaMigracion,
  cuentasLegibles,
  cortesiasDePlan,
  movimientosLegibles,
}: {
  cobros: CobroModulo[];
  ocultosPorSeccion: number;
  seccionLabel: string | null;
  hallazgos: Hallazgo[];
  sinMonto: CobroSinMonto[];
  stripeSinCobro: number;
  negocios: NegocioOpcion[];
  faltaMigracion: boolean;
  cuentasLegibles: boolean;
  /** Paquetes regalados desde el panel (bitácora de planes). */
  cortesiasDePlan: CortesiaDePlan[];
  movimientosLegibles: boolean;
}) {
  const [periodo, setPeriodo] = useState<PeriodoVista>("mes");
  const [filtroProducto, setFiltroProducto] = useState<"todos" | ProductoCobro>("todos");
  const [filtroMetodo, setFiltroMetodo] = useState<"todos" | MetodoCobro>("todos");
  const [formulario, setFormulario] = useState<PrellenadoCobro | null>(null);

  const filtrados = useMemo(() => {
    const ahora = new Date();
    return cobros.filter(
      (c) =>
        enPeriodo(c.cobrado_en, periodo, ahora) &&
        (filtroProducto === "todos" || c.producto === filtroProducto) &&
        (filtroMetodo === "todos" || c.metodo === filtroMetodo),
    );
  }, [cobros, periodo, filtroProducto, filtroMetodo]);

  const totales = useMemo(() => totalesDe(filtrados), [filtrados]);
  const porMetodo = useMemo(() => totalesPor(filtrados, (c) => c.metodo), [filtrados]);
  const porProducto = useMemo(() => totalesPor(filtrados, (c) => c.producto), [filtrados]);
  const cortesias = useMemo(() => resumenCortesias(filtrados), [filtrados]);
  const anulados = filtrados.filter((c) => c.anulado_en).length;

  // Los paquetes regalados desde el panel viven en otra tabla y se
  // cuentan aparte: sumarlos con las cortesías del libro contaría dos
  // veces las que algún día queden anotadas en los dos lados.
  const regalosDePlan = useMemo(
    () => cortesiasDePlan.filter((c) => enPeriodo(c.creadoEn, periodo, new Date())),
    [cortesiasDePlan, periodo],
  );

  return (
    <div className="flex flex-col gap-8">
      {faltaMigracion && <AvisoMigracion />}

      {formulario && (
        <FormularioCobro
          negocios={negocios}
          inicial={formulario}
          deshabilitado={faltaMigracion}
          onListo={() => setFormulario(null)}
        />
      )}

      <Hallazgos hallazgos={hallazgos} cuentasLegibles={cuentasLegibles} />

      <SinMonto
        filas={sinMonto}
        stripeSinCobro={stripeSinCobro}
        onAnotar={(f) =>
          setFormulario({
            ranchoId: f.ranchoId,
            plan: f.plan,
            metodo: f.metodo === "transferencia" ? "transferencia" : "sinpe",
            solicitudId: f.solicitudId,
            fecha: f.fecha,
          })
        }
      />

      {/* ── LOS TOTALES ─────────────────────────────────────────── */}
      <section>
        <div className="mb-4 border-t border-aventurea-line pt-6">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-ink-soft before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-ink-soft">
            Lo que entró
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[19px] font-bold text-aventurea-ink">
              Ingresos por medio de pago
            </h2>
            <button
              type="button"
              onClick={() => setFormulario({})}
              className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white"
            >
              Anotar un cobro
            </button>
          </div>
          <p className="mt-1 max-w-[78ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
            Colones y dólares van en columnas separadas y{" "}
            <strong>no se suman nunca</strong>: los paquetes están tarifados en
            dólares y el SINPE entra en colones al tipo de cambio del día, que
            no se guarda por transacción. Un total mixto sería un número que no
            es plata.
          </p>
        </div>

        {seccionLabel && (
          <p className="mb-4 rounded-xl bg-aventurea-navy/5 px-4 py-3 text-[12.5px] text-aventurea-ink">
            Vista de <strong>{seccionLabel}</strong>
            {ocultosPorSeccion > 0 ? (
              <>
                : {ocultosPorSeccion} cobro{ocultosPorSeccion === 1 ? "" : "s"} de otras
                secciones (o de negocios dados de baja) quedaron fuera de estos
                totales. Poné el conmutador en «Todas» para ver la plataforma
                completa.
              </>
            ) : (
              <>. No hay cobros de otras secciones fuera de estos totales.</>
            )}
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Grupo>
            {PERIODOS_VISTA.map((p) => (
              <Pastilla key={p.id} activo={periodo === p.id} onClick={() => setPeriodo(p.id)}>
                {p.label}
              </Pastilla>
            ))}
          </Grupo>
          <Grupo>
            <Pastilla
              activo={filtroProducto === "todos"}
              onClick={() => setFiltroProducto("todos")}
            >
              Todo
            </Pastilla>
            {PRODUCTOS_COBRO.map((p) => (
              <Pastilla
                key={p}
                activo={filtroProducto === p}
                onClick={() => setFiltroProducto(p)}
              >
                {PRODUCTO_LABEL[p]}
              </Pastilla>
            ))}
          </Grupo>
          <Grupo>
            <Pastilla activo={filtroMetodo === "todos"} onClick={() => setFiltroMetodo("todos")}>
              Todos los medios
            </Pastilla>
            {METODOS_COBRO.map((m) => (
              <Pastilla key={m} activo={filtroMetodo === m} onClick={() => setFiltroMetodo(m)}>
                {METODO_LABEL[m]}
              </Pastilla>
            ))}
          </Grupo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta titulo="Total del período" totales={totales} destacada />
          {METODOS_COBRO.filter(
            (m) => m !== "otro" || (porMetodo.get(m)?.cobros ?? 0) > 0,
          ).map((m) => (
            <Tarjeta
              key={m}
              titulo={METODO_LABEL[m]}
              totales={porMetodo.get(m) ?? { crc: 0, usd: 0, cobros: 0 }}
            />
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PRODUCTOS_COBRO.map((p) => (
            <Tarjeta
              key={p}
              titulo={PRODUCTO_LABEL[p]}
              totales={porProducto.get(p) ?? { crc: 0, usd: 0, cobros: 0 }}
            />
          ))}
        </div>

        <p className="mt-3 text-[12px] text-aventurea-ink-soft">
          Estos totales son la suma exacta de las {filtrados.length} fila
          {filtrados.length === 1 ? "" : "s"} de abajo: {totales.cobros} cuenta
          {totales.cobros === 1 ? "" : "n"} como ingreso
          {cortesias.cantidad > 0 && `, ${cortesias.cantidad} son cortesías`}
          {anulados > 0 && `, ${anulados} están anuladas`}.
        </p>

        <TablaCobros cobros={filtrados} />
      </section>

      {/* ── LAS CORTESÍAS, APARTE ───────────────────────────────── */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Regalías del período
        </p>
        <h2 className="mt-1 text-[17px] font-bold text-aventurea-ink">
          {cortesias.cantidad === 0 && regalosDePlan.length === 0
            ? "No se regaló nada en este período"
            : [
                cortesias.cantidad > 0 &&
                  `${cortesias.cantidad} cortesía${cortesias.cantidad === 1 ? "" : "s"} en el libro`,
                regalosDePlan.length > 0 &&
                  `${regalosDePlan.length} paquete${regalosDePlan.length === 1 ? "" : "s"} regalado${regalosDePlan.length === 1 ? "" : "s"} desde el panel`,
              ]
                .filter(Boolean)
                .join(" · ")}
        </h2>
        <p className="mt-2 max-w-[74ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
          Una cortesía <strong>no es ingreso</strong> y no suma ni un colón a los
          totales de arriba — la base lo obliga con un candado (
          <code>es_cortesia</code> exige <code>monto = 0</code>), así que aunque
          una pantalla se olvidara de filtrarlas, sumarlas no movería el total.
          Lo que sí se anota es cuánto valían, porque cuánto se está regalando
          es una pregunta tan válida como cuánto se está cobrando.
        </p>
        {cortesias.cantidad > 0 && (
          <p className="mt-3 text-[14px] font-bold text-aventurea-ink">
            Valor de catálogo regalado: {formatearUSD(cortesias.valorListaUsd)}
            {cortesias.sinValor > 0 && (
              <span className="ml-2 text-[12.5px] font-normal text-aventurea-ink-soft">
                ({cortesias.sinValor} sin valor anotado — la cifra queda corta)
              </span>
            )}
          </p>
        )}

        {!movimientosLegibles && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
            No se pudo leer la bitácora de planes, así que los paquetes
            regalados desde /admin/complementos no aparecen acá y tampoco se
            pudo cruzar «se vendió» contra «entró plata». Si la migración de
            regalías todavía no se pegó, es eso.
          </p>
        )}

        {regalosDePlan.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {regalosDePlan.map((c) => (
              <li key={c.id} className="text-[12.5px] text-aventurea-ink-soft">
                <span className="font-bold text-aventurea-ink">{c.negocio}</span> ·{" "}
                {nombrePlan(c.plan)} · regalado el {diaCR(c.creadoEn)}
                {c.cortesiaHasta
                  ? ` · hasta ${diaCR(c.cortesiaHasta)}`
                  : " · sin fecha de fin"}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── LO QUE NO SE PUEDE SABER ────────────────────────────── */}
      <section className="rounded-2xl border border-dashed border-aventurea-line p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Los límites de esta pantalla
        </p>
        <h2 className="mt-1 text-[17px] font-bold text-aventurea-ink">
          Lo que la base todavía no guarda
        </h2>
        <ul className="mt-3 flex flex-col gap-1.5">
          {LO_QUE_LA_BASE_NO_GUARDA.map((linea) => (
            <li
              key={linea}
              className="flex gap-2 text-[12.5px] leading-relaxed text-aventurea-ink-soft"
            >
              <span aria-hidden="true" className="text-aventurea-ink-soft">
                ·
              </span>
              <span>{linea}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ───────────────────────── piezas ───────────────────────── */

function AvisoMigracion() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
        Falta correr una migración
      </p>
      <h2 className="mt-1 text-[17px] font-bold text-amber-900">
        El libro de cobros de los módulos todavía no existe
      </h2>
      <p className="mt-2 max-w-[76ch] text-[13.5px] leading-relaxed text-amber-900">
        Hasta que se pegue, no hay dónde anotar cuánto entró por cada paquete:
        ni el SINPE ni Stripe guardan hoy el monto en ninguna tabla. Los
        hallazgos de abajo sí funcionan (salen de lo que ya existe), pero los
        totales van a quedar en cero porque no hay nada que sumar —{" "}
        <strong>no porque no haya entrado plata</strong>.
      </p>
      <p className="mt-3 overflow-x-auto rounded-lg bg-amber-100 px-3 py-2 font-mono text-[12.5px] text-amber-900">
        {MIGRACION_COBROS}
      </p>
    </section>
  );
}

function Hallazgos({
  hallazgos,
  cuentasLegibles,
}: {
  hallazgos: Hallazgo[];
  cuentasLegibles: boolean;
}) {
  const porClave = new Map<ClaveHallazgo, Hallazgo[]>();
  for (const h of hallazgos) {
    porClave.set(h.clave, [...(porClave.get(h.clave) ?? []), h]);
  }

  return (
    <section>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-ink-soft before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-ink-soft">
        Lo primero
      </p>
      <h2 className="mt-1 text-[19px] font-bold text-aventurea-ink">
        {hallazgos.length === 0
          ? "Sin contradicciones que revisar"
          : `${hallazgos.length} cosa${hallazgos.length === 1 ? "" : "s"} que no cuadra${hallazgos.length === 1 ? "" : "n"}`}
      </h2>
      <p className="mt-1 max-w-[78ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
        Paquetes de pago sin rastro de cobro, suscripciones duplicadas o
        huérfanas, comprobantes esperando aprobación. Esto{" "}
        <strong>no se filtra por sección</strong>: un problema escondido detrás
        del conmutador del header es un problema que nadie arregla.
      </p>

      {!cuentasLegibles && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
          No se pudo leer la tabla <code>cuentas</code> (0134), donde vive el
          paquete que de verdad manda. Los desfases entre{" "}
          <code>cuentas.plan</code> y <code>ranchos.plan_lealtad</code> no se
          revisaron: esta lista puede estar incompleta.
        </p>
      )}

      {hallazgos.length === 0 ? (
        <p className="mt-4 rounded-xl border border-aventurea-line bg-aventurea-surface p-4 text-[13px] text-aventurea-ink-soft">
          Nada que revisar con los datos de hoy. Ojo: eso no quiere decir que
          todo esté cobrado — quiere decir que no hay contradicciones entre las
          tablas que sí existen.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {[...porClave.entries()].map(([clave, lista]) => {
            const info = HALLAZGO_INFO[clave];
            return (
              <div
                key={clave}
                className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface"
              >
                <div className="border-b border-aventurea-line px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase ${
                        info.gravedad === "alta"
                          ? "bg-red-100 text-red-700"
                          : info.gravedad === "media"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-aventurea-navy/10 text-aventurea-navy"
                      }`}
                    >
                      {info.gravedad}
                    </span>
                    <h3 className="text-[14.5px] font-bold text-aventurea-ink">
                      {info.titulo}
                    </h3>
                    <span className="text-[12px] text-aventurea-ink-soft">
                      · {lista.length}
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-[80ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                    {info.porQue}
                  </p>
                  <p className="mt-1 max-w-[80ch] text-[12.5px] leading-relaxed text-aventurea-ink">
                    <strong>Qué hacer:</strong> {info.queHacer}
                  </p>
                </div>
                <ul className="divide-y divide-aventurea-line">
                  {lista.map((h) => (
                    <li key={h.id} className="px-4 py-2.5">
                      <p className="text-[13px] font-bold text-aventurea-ink">{h.negocio}</p>
                      <p className="text-[12.5px] text-aventurea-ink-soft">{h.detalle}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SinMonto({
  filas,
  stripeSinCobro,
  onAnotar,
}: {
  filas: CobroSinMonto[];
  stripeSinCobro: number;
  onAnotar: (f: CobroSinMonto) => void;
}) {
  if (filas.length === 0 && stripeSinCobro === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
        El agujero, dicho en voz alta
      </p>
      <h2 className="mt-1 text-[17px] font-bold text-amber-900">
        Cobros que ocurrieron y de los que no se sabe el monto
      </h2>
      <p className="mt-2 max-w-[78ch] text-[13.5px] leading-relaxed text-amber-900">
        Estos cobros entraron —hay una solicitud aprobada con su depósito— pero
        el importe nunca se guardó en ninguna columna: solo está en la imagen
        del comprobante. <strong>No se estiman</strong> desde el precio de
        lista: el depósito pudo ser anual, o en colones a otro tipo de cambio.
        Se anotan a mano, leyendo la captura, y entonces empiezan a sumar.
      </p>

      {stripeSinCobro > 0 && (
        <p className="mt-3 max-w-[78ch] text-[13px] leading-relaxed text-amber-900">
          Además hay <strong>{stripeSinCobro}</strong> suscripción
          {stripeSinCobro === 1 ? "" : "es"} de Stripe viva
          {stripeSinCobro === 1 ? "" : "s"} sin ningún cobro anotado. El importe
          de cada renovación existe en Stripe, no acá: el webhook no atiende{" "}
          <code>invoice.paid</code>, así que ninguna renovación deja monto en
          esta base.
        </p>
      )}

      {filas.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {filas.map((f) => (
            <li
              key={f.solicitudId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-aventurea-ink">
                  {f.negocio}
                </p>
                <p className="text-[12px] text-aventurea-ink-soft">
                  {nombrePlan(f.plan)} · {f.metodo} · {diaCR(f.fecha) || "sin fecha"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {f.comprobanteUrl && (
                  <a
                    href={f.comprobanteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink"
                  >
                    Ver comprobante
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onAnotar(f)}
                  className="rounded-lg bg-aventurea-navy px-3 py-1.5 text-[12.5px] font-bold text-white"
                >
                  Anotar el monto
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TablaCobros({ cobros }: { cobros: CobroModulo[] }) {
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  if (cobros.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-aventurea-line bg-aventurea-surface p-4 text-[13px] text-aventurea-ink-soft">
        No hay cobros anotados en este período. Si sabés que entró plata, es que
        todavía no se registró — no que no haya entrado.
      </p>
    );
  }

  function anular(id: string) {
    setError(null);
    empezar(async () => {
      const res = await anularCobro(id, motivo);
      if (res.error) {
        setError(res.error);
        return;
      }
      setAnulando(null);
      setMotivo("");
    });
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface">
      <table className="w-full min-w-[900px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-aventurea-line text-left text-[11.5px] uppercase tracking-wide text-aventurea-ink-soft">
            <th className="px-4 py-2.5 font-bold">Día</th>
            <th className="px-4 py-2.5 font-bold">Negocio</th>
            <th className="px-4 py-2.5 font-bold">Qué</th>
            <th className="px-4 py-2.5 font-bold">Medio</th>
            <th className="px-4 py-2.5 text-right font-bold">Colones</th>
            <th className="px-4 py-2.5 text-right font-bold">Dólares</th>
            <th className="px-4 py-2.5 font-bold">Nota</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-aventurea-line">
          {cobros.map((c) => {
            const cuenta = esIngreso(c);
            return (
              <tr key={c.id} className={cuenta ? "" : "bg-aventurea-cream/40"}>
                <td className="whitespace-nowrap px-4 py-2.5 text-aventurea-ink-soft">
                  {diaCR(c.cobrado_en)}
                </td>
                <td className="px-4 py-2.5 font-bold text-aventurea-ink">
                  {c.negocio_nombre ?? "(negocio dado de baja)"}
                </td>
                <td className="px-4 py-2.5 text-aventurea-ink-soft">
                  {c.producto === "plan_lealtad"
                    ? nombrePlan(c.plan)
                    : nombreAddon(c.addon ?? "")}
                  <span className="ml-1 text-[11.5px]">· {PERIODO_LABEL[c.periodo]}</span>
                  {c.es_cortesia && (
                    <span className="ml-2 rounded-md bg-aventurea-navy/10 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-aventurea-navy">
                      cortesía
                    </span>
                  )}
                  {c.anulado_en && (
                    <span className="ml-2 rounded-md bg-red-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-red-700">
                      anulado
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-aventurea-ink-soft">
                  {METODO_LABEL[c.metodo]}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-aventurea-ink">
                  {cuenta && c.moneda === "CRC" ? formatearCRC(c.monto) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-aventurea-ink">
                  {cuenta && c.moneda === "USD" ? formatearUSD(c.monto) : "—"}
                </td>
                <td className="max-w-[26ch] truncate px-4 py-2.5 text-[12px] text-aventurea-ink-soft">
                  {c.anulado_en
                    ? `Anulado: ${c.anulado_motivo ?? "sin motivo"}`
                    : c.es_cortesia
                      ? `Valor de catálogo: ${
                          c.valor_lista_usd === null ? "sin anotar" : formatearUSD(c.valor_lista_usd)
                        }`
                      : (c.notas ??
                        (c.tipo_cambio ? `Tipo de cambio ₡${c.tipo_cambio}` : "—"))}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {!c.anulado_en &&
                    (anulando === c.id ? (
                      <span className="flex items-center gap-1.5">
                        <input
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          placeholder="Motivo"
                          className="w-36 rounded-lg border border-aventurea-line px-2 py-1 text-[12px]"
                        />
                        <button
                          type="button"
                          onClick={() => anular(c.id)}
                          disabled={guardando}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-[12px] font-bold text-white disabled:opacity-50"
                        >
                          Anular
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnulando(null)}
                          className="text-[12px] text-aventurea-ink-soft"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAnulando(c.id);
                          setMotivo("");
                          setError(null);
                        }}
                        className="text-[12px] font-bold text-aventurea-ink-soft hover:text-red-700"
                      >
                        Anular
                      </button>
                    ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && (
        <p className="border-t border-aventurea-line bg-red-50 px-4 py-2 text-[12.5px] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function Tarjeta({
  titulo,
  totales,
  destacada,
}: {
  titulo: string;
  totales: Totales;
  destacada?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destacada
          ? "border-aventurea-navy/30 bg-aventurea-navy/5"
          : "border-aventurea-line bg-aventurea-surface"
      }`}
    >
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p className="mt-2 text-[19px] font-bold leading-tight text-aventurea-ink">
        {formatearCRC(totales.crc)}
      </p>
      <p className="text-[19px] font-bold leading-tight text-aventurea-ink">
        {formatearUSD(totales.usd)}
      </p>
      <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">
        {totales.cobros} cobro{totales.cobros === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function Grupo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-aventurea-line bg-aventurea-surface p-1">
      {children}
    </div>
  );
}

function Pastilla({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${
        activo ? "bg-aventurea-navy text-white" : "text-aventurea-ink-soft hover:text-aventurea-ink"
      }`}
    >
      {children}
    </button>
  );
}
