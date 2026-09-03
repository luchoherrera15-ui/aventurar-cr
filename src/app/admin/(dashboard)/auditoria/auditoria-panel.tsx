"use client";

import { useMemo, useState } from "react";

import { fmtColones } from "@/lib/finanzas";
import { explicarCobro } from "@/lib/libro-cobros";
import { etiquetaCobro } from "@/lib/cobro-plataforma";
import {
  ALERTA_INFO,
  ALERTAS,
  filtrarAuditoria,
  FILTRO_VACIO,
  fmtDia,
  fmtMomentoCR,
  lineaDeTiempo,
  LO_QUE_LA_BASE_NO_GUARDA,
  personasCongeladasVsHoy,
  resumirAuditoria,
  type ClaveAlerta,
  type FilaAuditoria,
} from "@/lib/auditoria-dinero";

/**
 * LA AUDITORÍA DEL DINERO, RESERVA POR RESERVA.
 *
 * Tres reglas gobiernan esta pantalla, y las tres son la razón de que
 * exista:
 *
 *  1. Los problemas van ARRIBA. Una tabla que solo lista filas no es una
 *     auditoría: las cinco tarjetas de alerta son el índice y el filtro.
 *  2. Los totales son SUMAS DE LO QUE SE ESTÁ VIENDO. Se recalculan
 *     sobre el mismo arreglo filtrado que se lista, así que no pueden
 *     discrepar de las filas.
 *  3. Nada se inventa. Donde la base no guarda el dato, se dice; el pie
 *     de la pantalla lista qué NO es auditable hoy.
 */

const PASO = 25;

export default function AuditoriaPanel({
  filas,
  recortadas,
  tope,
  tarifasDesconocidas,
}: {
  filas: FilaAuditoria[];
  /** true = la consulta llegó al tope y hay reservas que no se ven. */
  recortadas: boolean;
  tope: number;
  /** true = no se pudo leer `cobro_negocio`: las tarifas propias por
   *  negocio no se conocen y todo se resolvió con la global. */
  tarifasDesconocidas: boolean;
}) {
  const [alerta, setAlerta] = useState<ClaveAlerta | null>(null);
  const [soloProblemas, setSoloProblemas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [visibles, setVisibles] = useState(PASO);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});

  // El resumen de las alertas se calcula sobre TODAS las filas cargadas:
  // las tarjetas son el índice de problemas, no el resultado del filtro.
  const totalGeneral = useMemo(() => resumirAuditoria(filas), [filas]);

  const filtradas = useMemo(
    () => filtrarAuditoria(filas, { ...FILTRO_VACIO, alerta, soloProblemas, busqueda }),
    [filas, alerta, soloProblemas, busqueda],
  );
  // Este resumen sí es del filtro: es el que se pinta como total.
  const resumen = useMemo(() => resumirAuditoria(filtradas), [filtradas]);

  const hayFiltro = alerta !== null || soloProblemas || busqueda.trim() !== "";
  const enPantalla = filtradas.slice(0, visibles);

  function cambiarAlerta(clave: ClaveAlerta | null) {
    setAlerta((actual) => (actual === clave ? null : clave));
    setVisibles(PASO);
  }

  return (
    <div className="flex flex-col gap-7">
      {/* ---------- Avisos de alcance: qué se está mirando ---------- */}
      {recortadas && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          <strong>Esta pantalla está recortada.</strong> Hay más reservas en el
          periodo de las que se cargaron: se muestran las {tope} de fecha de
          evento más reciente. Achicá el periodo desde los botones de arriba
          para revisar el resto — una auditoría que corta filas en silencio
          miente, así que acá se dice.
        </p>
      )}
      {tarifasDesconocidas && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          No se pudieron leer las tarifas propias por negocio, así que todas se
          resolvieron con la comisión global. Si algún negocio tiene tarifa
          <em> gratis</em> o de <em>membresía mensual</em>, va a aparecer en
          «eventos pasados sin cobro» sin que sea un error.
        </p>
      )}

      {/* ---------- 1. LOS PROBLEMAS, ADELANTE ---------- */}
      <section>
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Lo primero
        </p>
        <h2 className="mt-1 text-[19px] font-bold text-aventurea-ink">
          Qué hay que revisar
        </h2>
        <p className="mt-1 max-w-[76ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
          Sobre las {totalGeneral.reservas.toLocaleString("es-CR")} reservas
          cargadas, {totalGeneral.conAlertas.toLocaleString("es-CR")}{" "}
          {totalGeneral.conAlertas === 1 ? "tiene" : "tienen"} algo que revisar.
          Tocá una tarjeta para ver solo esas.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {ALERTAS.map((clave) => (
            <TarjetaAlerta
              key={clave}
              clave={clave}
              cuantas={totalGeneral.porAlerta[clave]}
              activa={alerta === clave}
              onClick={() => cambiarAlerta(clave)}
            />
          ))}
        </div>
      </section>

      {/* ---------- 2. Filtros ---------- */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Buscar por cliente o negocio
            </span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setVisibles(PASO);
              }}
              placeholder="María Rojas, Salón El Guayabo…"
              className="w-full rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[13.5px] text-aventurea-ink outline-none focus:border-aventurea-navy"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-[13px] font-bold text-aventurea-ink">
            <input
              type="checkbox"
              checked={soloProblemas}
              onChange={(e) => {
                setSoloProblemas(e.target.checked);
                setVisibles(PASO);
              }}
              className="h-4 w-4 accent-aventurea-navy"
            />
            Solo las que tienen algo que revisar
          </label>

          {hayFiltro && (
            <button
              type="button"
              onClick={() => {
                setAlerta(null);
                setSoloProblemas(false);
                setBusqueda("");
                setVisibles(PASO);
              }}
              className="self-end rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
            >
              Quitar filtros
            </button>
          )}
        </div>

        {alerta && (
          <p className="mt-3 rounded-lg bg-aventurea-navy/5 px-3 py-2 text-[12.5px] leading-relaxed text-aventurea-ink">
            <strong>{ALERTA_INFO[alerta].titulo}:</strong>{" "}
            {ALERTA_INFO[alerta].explicacion}
          </p>
        )}
      </section>

      {/* ---------- 3. Totales de lo filtrado ---------- */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[19px] font-bold text-aventurea-ink">
            La plata de estas {resumen.reservas.toLocaleString("es-CR")} reservas
          </h2>
          <p className="text-[12px] text-aventurea-ink-soft">
            Cada cifra es la suma de las reservas que quedaron después del filtro
            {hayFiltro ? "" : " (ahora mismo, todas las cargadas)"}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Cifra
            etiqueta="Valor de lo listado"
            valor={fmtColones(resumen.totalEventos)}
            nota="Suma del monto de estas reservas, sea cual sea su estado — incluye canceladas y rechazadas"
            destacado
          />
          <Cifra
            etiqueta="Adelantos en caja"
            valor={fmtColones(resumen.adelantosEnCaja)}
            nota="Depósitos validados y no devueltos"
          />
          <Cifra
            etiqueta="Saldos cobrados"
            valor={fmtColones(resumen.saldosEnCaja)}
            nota="Marcados como pagados el día del evento"
          />
          <Cifra
            etiqueta="Saldo por cobrar"
            valor={fmtColones(resumen.saldoPorCobrar)}
            nota="Solo de reservas vivas"
          />
          <Cifra
            etiqueta="Comisión devengada"
            valor={fmtColones(resumen.comisionDevengada)}
            nota="Lo que Bookea ya ganó (sin anulados)"
          />
          <Cifra
            etiqueta="Comisión por cobrarle al negocio"
            valor={fmtColones(resumen.comisionPorCobrar)}
            nota={`Devengada menos ${fmtColones(resumen.comisionCobrada)} ya cobrados`}
          />
        </div>
      </section>

      {/* ---------- 4. Reserva por reserva ---------- */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[19px] font-bold text-aventurea-ink">
            El recorrido de cada reserva
          </h2>
          <p className="text-[12px] text-aventurea-ink-soft">
            Mostrando {enPantalla.length.toLocaleString("es-CR")} de{" "}
            {filtradas.length.toLocaleString("es-CR")}
            {" · "}orden: evento más reciente primero
          </p>
        </div>

        {filtradas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-aventurea-line bg-aventurea-cream-2 p-6 text-center text-[13px] text-aventurea-ink-soft">
            Ninguna reserva coincide con el filtro.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {enPantalla.map((f) => (
              <FilaReserva
                key={f.reserva.id}
                fila={f}
                abierta={!!abiertas[f.reserva.id]}
                onToggle={() =>
                  setAbiertas((p) => ({ ...p, [f.reserva.id]: !p[f.reserva.id] }))
                }
              />
            ))}
          </div>
        )}

        {visibles < filtradas.length && (
          <button
            type="button"
            onClick={() => setVisibles((v) => v + PASO)}
            className="mt-4 w-full rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-3 text-[13px] font-bold text-aventurea-navy hover:border-aventurea-navy"
          >
            Mostrar {Math.min(PASO, filtradas.length - visibles)} más (faltan{" "}
            {(filtradas.length - visibles).toLocaleString("es-CR")})
          </button>
        )}
      </section>

      {/* ---------- 5. Lo que la base NO guarda ---------- */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-5">
        <h2 className="text-[15px] font-bold text-aventurea-ink">
          Lo que esta pantalla no puede responder
        </h2>
        <p className="mt-1 max-w-[76ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
          Una auditoría también tiene que decir qué no es auditable. Estos datos
          no existen en la base, así que acá no se adivinan:
        </p>
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
        <p className="mt-3 max-w-[76ch] text-[12px] leading-relaxed text-aventurea-ink-soft">
          Los cobros de plataforma cuya reserva se borró no aparecen acá (esta
          vista se arma reserva por reserva): viven en el histórico de{" "}
          <strong>Finanzas → Alquileres</strong>.
        </p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------

function TarjetaAlerta({
  clave,
  cuantas,
  activa,
  onClick,
}: {
  clave: ClaveAlerta;
  cuantas: number;
  activa: boolean;
  onClick: () => void;
}) {
  const info = ALERTA_INFO[clave];
  const limpia = cuantas === 0;
  const grave = info.gravedad === "hallazgo";

  const fondo = limpia
    ? "border-aventurea-line bg-aventurea-surface"
    : grave
      ? "border-red-200 bg-red-50"
      : "border-amber-200 bg-amber-50";
  const numero = limpia
    ? "text-aventurea-ink-soft"
    : grave
      ? "text-red-700"
      : "text-amber-800";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex flex-col rounded-2xl border p-4 text-left shadow-sm transition-colors ${fondo} ${
        activa ? "ring-2 ring-aventurea-navy ring-offset-1" : ""
      } ${limpia ? "opacity-70" : "hover:border-aventurea-navy/50"}`}
    >
      <span className={`text-[26px] font-bold leading-none tabular-nums ${numero}`}>
        {cuantas}
      </span>
      <span className="mt-1.5 text-[13px] font-bold text-aventurea-ink">
        {info.titulo}
      </span>
      <span className="mt-1 text-[11.5px] leading-snug text-aventurea-ink-soft">
        {limpia
          ? "Sin casos en lo cargado"
          : grave
            ? "Hallazgo: hay que arreglarlo"
            : "Esperando una decisión"}
      </span>
    </button>
  );
}

function Cifra({
  etiqueta,
  valor,
  nota,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        destacado
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-aventurea-surface"
      }`}
    >
      <p
        className={`text-[10.5px] font-bold uppercase tracking-wide ${
          destacado ? "text-white/70" : "text-aventurea-ink-soft"
        }`}
      >
        {etiqueta}
      </p>
      <p
        className={`mt-1.5 text-[19px] font-bold tabular-nums ${
          destacado ? "text-white" : "text-aventurea-ink"
        }`}
      >
        {valor}
      </p>
      <p
        className={`mt-1 text-[11.5px] leading-snug ${
          destacado ? "text-white/70" : "text-aventurea-ink-soft"
        }`}
      >
        {nota}
      </p>
    </div>
  );
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
  cumplida: "Cumplida",
  no_asistio: "No asistió",
  bloqueada: "Bloqueada",
  temporal: "Temporal",
};

function FilaReserva({
  fila,
  abierta,
  onToggle,
}: {
  fila: FilaAuditoria;
  abierta: boolean;
  onToggle: () => void;
}) {
  const r = fila.reserva;
  const grave = fila.alertas.some((a) => ALERTA_INFO[a].gravedad === "hallazgo");
  const personas = personasCongeladasVsHoy(fila);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-aventurea-surface shadow-sm ${
        grave
          ? "border-red-200"
          : fila.alertas.length > 0
            ? "border-amber-200"
            : "border-aventurea-line"
      }`}
    >
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-navy">
            {fmtDia(r.fecha)} · {ESTADO_LABEL[r.estado] ?? r.estado}
            {fila.yaPaso ? " · ya pasó" : ""}
          </p>
          <h3 className="mt-0.5 truncate text-[15.5px] font-bold text-aventurea-ink">
            {r.nombre?.trim() || "Sin nombre"}
            <span className="ml-2 font-normal text-aventurea-ink-soft">
              {fila.negocio}
            </span>
          </h3>
          <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
            {fmtColones(fila.total)} el evento
            {fila.adelantoPactado > 0
              ? ` · ${fmtColones(fila.adelantoPactado)} de adelanto pactado`
              : " · sin adelanto pactado"}
            {fila.tarifaHoy ? ` · tarifa hoy: ${etiquetaCobro(fila.tarifaHoy)}` : ""}
          </p>

          {fila.detalles.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {fila.detalles.map((d) => (
                <li
                  key={d}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] leading-snug ${
                    grave ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {d}
                </li>
              ))}
            </ul>
          )}

          {personas && (
            <p className="mt-2 rounded-lg bg-aventurea-cream-2 px-2.5 py-1.5 text-[12px] leading-snug text-aventurea-ink-soft">
              El cobro se congeló con {personas.congeladas} personas y la reserva
              hoy dice {personas.hoy}. No es un error —los invitados cambian
              después de confirmar— pero explica por qué la comisión no se
              parece al evento.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-right sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Mini titulo="Adelanto en caja" valor={fmtColones(fila.adelantoEnCaja)} />
            <Mini titulo="Saldo por cobrar" valor={fmtColones(fila.saldoPorCobrar)} />
            <Mini titulo="Comisión devengada" valor={fmtColones(fila.comisionDevengada)} />
            <Mini titulo="Comisión cobrada" valor={fmtColones(fila.comisionCobrada)} />
          </dl>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={abierta}
            className="rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
          >
            {abierta ? "Cerrar la línea de tiempo" : "Ver la línea de tiempo"}
          </button>
        </div>
      </div>

      {abierta && (
        <div className="border-t border-aventurea-line bg-aventurea-cream-2 p-4">
          <LineaDeTiempo fila={fila} />
        </div>
      )}
    </article>
  );
}

function Mini({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </dt>
      <dd className="text-[13.5px] font-bold tabular-nums text-aventurea-ink">
        {valor}
      </dd>
    </div>
  );
}

const PUNTO: Record<string, string> = {
  hecho: "border-aventurea-navy bg-aventurea-navy",
  espera: "border-aventurea-ink-soft bg-aventurea-surface",
  alerta: "border-red-500 bg-red-500",
};

function LineaDeTiempo({ fila }: { fila: FilaAuditoria }) {
  const hitos = lineaDeTiempo(fila);
  return (
    <div>
      <ol className="flex flex-col">
        {hitos.map((h, i) => (
          <li key={h.clave} className="flex gap-3">
            {/* La columna del riel: punto + línea hasta el siguiente hito. */}
            <div className="flex w-4 shrink-0 flex-col items-center">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${PUNTO[h.estado]}`}
              />
              {i < hitos.length - 1 && (
                <span
                  aria-hidden="true"
                  className="w-px flex-1 bg-aventurea-line"
                />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-[13.5px] font-bold text-aventurea-ink">
                  {h.titulo}
                </p>
                {h.monto && (
                  <p className="text-[13.5px] font-bold tabular-nums text-aventurea-ink">
                    {h.monto}
                  </p>
                )}
              </div>
              <p className="text-[12px] text-aventurea-navy">{h.cuando}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-aventurea-ink-soft">
                {h.detalle}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {fila.cobros.length > 0 && (
        <div className="mt-1 rounded-xl border border-aventurea-line bg-aventurea-surface p-3">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Los cobros de plataforma de esta reserva, tal como están guardados
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-[12px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wide text-aventurea-ink-soft">
                  <th className="pb-1 pr-3 font-bold">Concepto</th>
                  <th className="pb-1 pr-3 font-bold">Tarifa congelada</th>
                  <th className="pb-1 pr-3 font-bold">Monto</th>
                  <th className="pb-1 pr-3 font-bold">Estado</th>
                  <th className="pb-1 pr-3 font-bold">Devengado</th>
                  <th className="pb-1 font-bold">Pagado</th>
                </tr>
              </thead>
              <tbody className="text-aventurea-ink">
                {fila.cobros.map((c) => (
                  <tr key={c.id} className="border-t border-aventurea-line">
                    <td className="py-1.5 pr-3">{c.concepto}</td>
                    <td className="py-1.5 pr-3">{explicarCobro(c)}</td>
                    <td className="py-1.5 pr-3 font-bold tabular-nums">
                      {fmtColones(Number(c.monto ?? 0))}
                    </td>
                    <td className="py-1.5 pr-3">{c.estado}</td>
                    <td className="py-1.5 pr-3">{fmtMomentoCR(c.devengado_en)}</td>
                    <td className="py-1.5">{fmtMomentoCR(c.pagado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
