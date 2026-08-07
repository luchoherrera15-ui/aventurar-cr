"use client";

import { useMemo, useState, useTransition } from "react";

import { aFecha, fmtColones } from "@/lib/finanzas";
import {
  agruparCobros,
  CONCEPTO_LABEL,
  explicarCobro,
  idsPagados,
  idsPendientes,
  resumenLibro,
  type CobroPlataforma,
  type GrupoCobros,
} from "@/lib/libro-cobros";

import { marcarCobrosPagados, volverCobrosAPendiente } from "./actions";

/**
 * LA CUENTA POR COBRAR DE LA PLATAFORMA.
 *
 * Lo primero que el dueño necesita ver al abrir Finanzas: cuánto hay
 * por cobrar esta semana y a quién. La proyección (lo que se ganaría)
 * queda abajo, en el panel de siempre — son dos cosas distintas y la
 * pantalla lo dice con todas las letras.
 *
 * Se cobra por SEMANA × NEGOCIO, que es como se cobra de verdad: al
 * negocio se le pasa la cuenta de la semana entera. Por eso el botón
 * grande marca el grupo completo, y marcar una sola reserva es la
 * excepción que vive escondida en el detalle.
 */

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Fecha corta y determinista: "23 ago 2026" (sin depender del ICU). */
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = aFecha(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Igual pero para timestamps (devengado_en, pagado_en). */
function fmtMomento(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * "3 reservas · 365 personas · 1 depósito retenido" — el renglón que
 * hace que el total del grupo cuadre a la vista. Sin nombrar los 10 %
 * de cancelación, el monto no sale de las personas y parece un error.
 */
function resumenGrupo(g: GrupoCobros): string {
  const partes = [
    `${g.reservas} reserva${g.reservas === 1 ? "" : "s"}`,
    `${g.personas.toLocaleString("es-CR")} persona${g.personas === 1 ? "" : "s"}`,
  ];
  if (g.cancelaciones > 0) {
    partes.push(
      `${g.cancelaciones} depósito${g.cancelaciones === 1 ? "" : "s"} retenido${g.cancelaciones === 1 ? "" : "s"}`,
    );
  }
  return partes.join(" · ");
}

type Override = { estado: CobroPlataforma["estado"]; pagado_en: string | null };

export default function LibroCobrosPanel({
  cobros,
  nombrePorRancho,
  hoyIso,
}: {
  cobros: CobroPlataforma[];
  nombrePorRancho: Record<string, string>;
  /** "Hoy" lo pone el servidor: así el corte de semana no cambia entre
   *  lo que se pinta en el servidor y lo que hidrata el navegador. */
  hoyIso: string;
}) {
  // Lo que se marcó en esta sesión, encima de lo que trajo el servidor.
  // Al revalidar, el servidor manda lo mismo y el override no estorba.
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [historicoAbierto, setHistoricoAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<{ ids: string[]; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  const filas = useMemo(
    () =>
      cobros.map((c) => (overrides[c.id] ? { ...c, ...overrides[c.id] } : c)),
    [cobros, overrides],
  );

  const hoy = useMemo(() => aFecha(hoyIso), [hoyIso]);
  const resumen = useMemo(() => resumenLibro(filas, hoy), [filas, hoy]);
  const { porCobrar, pagados, anulados } = useMemo(
    () => agruparCobros(filas, nombrePorRancho),
    [filas, nombrePorRancho],
  );

  function marcar(ids: string[], texto: string) {
    if (ids.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await marcarCobrosPagados(ids);
      if (res.error) {
        setError(res.error);
        return;
      }
      const ahora = new Date().toISOString();
      setOverrides((prev) => {
        const copia = { ...prev };
        for (const id of ids) copia[id] = { estado: "pagado", pagado_en: ahora };
        return copia;
      });
      setUltimo({ ids, texto });
    });
  }

  function deshacer(ids: string[]) {
    if (ids.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await volverCobrosAPendiente(ids);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOverrides((prev) => {
        const copia = { ...prev };
        for (const id of ids) copia[id] = { estado: "pendiente", pagado_en: null };
        return copia;
      });
      setUltimo(null);
    });
  }

  return (
    <section className="flex flex-col gap-6">
      {/* ---------- Encabezado: qué es esto y qué NO es ---------- */}
      <div>
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Lo que ya se debe
        </p>
        <h2 className="mt-1 text-[19px] font-bold text-aventurea-ink">
          Cuenta por cobrar de la plataforma
        </h2>
        <p className="mt-1 max-w-[74ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
          Cada reserva confirmada deja acá su cobro, con el monto congelado el
          día que se confirmó. Esto es plata <strong>devengada</strong>: ya se
          debe, aunque el evento sea dentro de tres meses. No confundir con la{" "}
          <em>proyección</em> de más abajo, que es lo que se ganaría si se
          aplicara la tarifa de hoy a todo el periodo.
        </p>
      </div>

      {/* ---------- El corte de la semana ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tarjeta
          etiqueta="Devengado esta semana"
          valor={fmtColones(resumen.devengadoSemana)}
          nota={resumen.semanaActualEtiqueta}
          detalle={`${resumen.reservasSemana} reserva${resumen.reservasSemana === 1 ? "" : "s"} confirmada${resumen.reservasSemana === 1 ? "" : "s"}`}
          destacado
        />
        <Tarjeta
          etiqueta="Por cobrar en total"
          valor={fmtColones(resumen.pendienteTotal)}
          nota="Todas las semanas sin cobrar"
          detalle={`${resumen.gruposPendientes} cuenta${resumen.gruposPendientes === 1 ? "" : "s"} en ${resumen.semanasPendientes} semana${resumen.semanasPendientes === 1 ? "" : "s"}`}
        />
        <Tarjeta
          etiqueta="Cobrado este mes"
          valor={fmtColones(resumen.cobradoMes)}
          nota="Marcado como pagado"
          detalle="Mes calendario en curso"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}

      {ultimo && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-aventurea-green-light p-3 text-[13px] text-aventurea-green">
          <span>Cobrada: {ultimo.texto}.</span>
          <button
            type="button"
            onClick={() => deshacer(ultimo.ids)}
            disabled={pendiente}
            className="font-bold underline underline-offset-2 disabled:opacity-50"
          >
            Deshacer
          </button>
        </p>
      )}

      {/* ---------- POR COBRAR ---------- */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15.5px] font-bold text-aventurea-ink">
            Por cobrar, semana por semana
          </h3>
          <p className="text-[12px] text-aventurea-ink-soft">
            Se le cobra al negocio la semana completa (lunes a domingo).
          </p>
        </div>

        {porCobrar.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-aventurea-line bg-aventurea-cream-2 p-6 text-center text-[13px] text-aventurea-ink-soft">
            No hay nada por cobrar. Cada reserva que se confirme va a aparecer
            acá sola, en la semana en que se confirmó.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {porCobrar.map((g) => (
              <TarjetaGrupo
                key={g.clave}
                grupo={g}
                abierto={!!abiertos[g.clave]}
                onToggle={() =>
                  setAbiertos((p) => ({ ...p, [g.clave]: !p[g.clave] }))
                }
                pendiente={pendiente}
                onCobrarGrupo={() =>
                  marcar(
                    idsPendientes(g),
                    `${g.negocio} · ${g.semanaEtiqueta} · ${fmtColones(g.total)}`,
                  )
                }
                onCobrarUno={(c) =>
                  marcar([c.id], `${c.cliente ?? "una reserva"} de ${g.negocio}`)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- HISTÓRICO ---------- */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
        <button
          type="button"
          onClick={() => setHistoricoAbierto((v) => !v)}
          aria-expanded={historicoAbierto}
          className="flex w-full flex-wrap items-center justify-between gap-2 p-4.5 text-left"
        >
          <span>
            <span className="block text-[14.5px] font-bold text-aventurea-ink">
              Histórico de semanas pagadas
            </span>
            <span className="mt-0.5 block text-[12px] text-aventurea-ink-soft">
              {pagados.length === 0
                ? "Todavía no se ha cobrado ninguna semana"
                : `${pagados.length} cuenta${pagados.length === 1 ? "" : "s"} ya cobrada${pagados.length === 1 ? "" : "s"}`}
              {anulados.length > 0 &&
                ` · ${anulados.length} cobro${anulados.length === 1 ? "" : "s"} anulado${anulados.length === 1 ? "" : "s"}`}
            </span>
          </span>
          <span className="text-[12.5px] font-bold text-aventurea-navy">
            {historicoAbierto ? "Ocultar" : "Ver"}
          </span>
        </button>

        {historicoAbierto && (
          <div className="flex flex-col gap-3 border-t border-aventurea-line p-4.5">
            {pagados.length === 0 && anulados.length === 0 && (
              <p className="text-[13px] text-aventurea-ink-soft">
                Cuando marqués una semana como pagada, se guarda acá con la
                fecha en que se cobró.
              </p>
            )}

            {pagados.map((g) => (
              <TarjetaPagada
                key={g.clave}
                grupo={g}
                abierto={!!abiertos[g.clave]}
                onToggle={() =>
                  setAbiertos((p) => ({ ...p, [g.clave]: !p[g.clave] }))
                }
                pendiente={pendiente}
                onDeshacer={() => deshacer(idsPagados(g))}
              />
            ))}

            {anulados.length > 0 && (
              <div className="mt-1">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Anulados — plata que dejó de deberse
                </p>
                <div className="flex flex-col gap-2">
                  {anulados.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-dashed border-aventurea-line bg-aventurea-cream-2 p-3 opacity-70"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-[13px] font-bold text-aventurea-ink">
                          {c.cliente || "Sin nombre"}
                          <span className="ml-2 font-normal text-aventurea-ink-soft">
                            {nombrePorRancho[c.rancho_id ?? ""] ??
                              "Negocio dado de baja"}
                          </span>
                        </span>
                        <span className="text-[13px] font-bold text-aventurea-ink-soft line-through tabular-nums">
                          {fmtColones(Number(c.monto))}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-aventurea-ink-soft">
                        {c.notas ?? "Anulado"} · evento del{" "}
                        {fmtFecha(c.fecha_evento)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  nota,
  detalle,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  detalle: string;
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
        className={`mt-1.5 text-[22px] font-bold tabular-nums ${
          destacado ? "text-white" : "text-aventurea-ink"
        }`}
      >
        {valor}
      </p>
      <p
        className={`mt-1 text-[12px] ${
          destacado ? "text-white/80" : "text-aventurea-ink-soft"
        }`}
      >
        {nota}
      </p>
      <p
        className={`mt-0.5 text-[11.5px] ${
          destacado ? "text-white/60" : "text-aventurea-ink-soft"
        }`}
      >
        {detalle}
      </p>
    </div>
  );
}

/** El renglón grande: una semana de un negocio, con su botón de cobrar. */
function TarjetaGrupo({
  grupo,
  abierto,
  onToggle,
  pendiente,
  onCobrarGrupo,
  onCobrarUno,
}: {
  grupo: GrupoCobros;
  abierto: boolean;
  onToggle: () => void;
  pendiente: boolean;
  onCobrarGrupo: () => void;
  onCobrarUno: (c: CobroPlataforma) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-navy">
            {grupo.semanaEtiqueta}
          </p>
          <h4 className="mt-0.5 truncate text-[15.5px] font-bold text-aventurea-ink">
            {grupo.negocio}
          </h4>
          <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
            {resumenGrupo(grupo)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-[21px] font-bold tabular-nums text-aventurea-ink">
            {fmtColones(grupo.total)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={abierto}
              className="rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
            >
              {abierto ? "Cerrar detalle" : "Ver detalle"}
            </button>
            <button
              type="button"
              onClick={onCobrarGrupo}
              disabled={pendiente}
              className="rounded-lg bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-50"
            >
              Marcar pagada
            </button>
          </div>
        </div>
      </div>

      {abierto && (
        <div className="border-t border-aventurea-line bg-aventurea-cream-2 p-4">
          <div className="flex flex-col gap-2">
            {grupo.cobros.map((c) => (
              <FilaCobro
                key={c.id}
                cobro={c}
                pendiente={pendiente}
                onCobrar={() => onCobrarUno(c)}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/** Una reserva dentro de la cuenta. Tarjeta, no fila de tabla: en el
 *  teléfono una tabla de siete columnas se arrastra de lado. */
function FilaCobro({
  cobro,
  pendiente,
  onCobrar,
}: {
  cobro: CobroPlataforma;
  pendiente: boolean;
  onCobrar?: () => void;
}) {
  return (
    <div className="rounded-xl border border-aventurea-line bg-aventurea-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13.5px] font-bold text-aventurea-ink">
          {cobro.cliente || "Sin nombre"}
        </span>
        <span className="text-[14px] font-bold tabular-nums text-aventurea-ink">
          {fmtColones(Number(cobro.monto))}
        </span>
      </div>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-4">
        <Dato titulo="Se confirmó" valor={fmtMomento(cobro.devengado_en)} />
        <Dato titulo="Evento" valor={fmtFecha(cobro.fecha_evento)} />
        <Dato
          titulo="Personas"
          valor={cobro.personas.toLocaleString("es-CR")}
        />
        <Dato titulo="Tarifa aplicada" valor={explicarCobro(cobro)} />
      </dl>
      {/* La nota, cuando la hay, ya explica el concepto (el trigger la
          escribe): repetir las dos líneas decía dos veces lo mismo. */}
      <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">
        {cobro.notas ?? CONCEPTO_LABEL[cobro.concepto]}
      </p>
      {onCobrar && cobro.estado === "pendiente" && (
        <button
          type="button"
          onClick={onCobrar}
          disabled={pendiente}
          className="mt-2 text-[12px] font-bold text-aventurea-navy underline underline-offset-2 disabled:opacity-50"
        >
          Marcar pagada solo esta
        </button>
      )}
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </dt>
      {/* Envuelve en vez de cortar: la tarifa aplicada es justamente lo
          que hay que poder leer entero en el teléfono. */}
      <dd className="break-words text-aventurea-ink">{valor}</dd>
    </div>
  );
}

/** Una cuenta ya cobrada: apagada, con la fecha del cobro y el deshacer. */
function TarjetaPagada({
  grupo,
  abierto,
  onToggle,
  pendiente,
  onDeshacer,
}: {
  grupo: GrupoCobros;
  abierto: boolean;
  onToggle: () => void;
  pendiente: boolean;
  onDeshacer: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-aventurea-line bg-aventurea-cream-2">
      <div className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-green">
            Pagada el {fmtMomento(grupo.pagadoEn)}
          </p>
          <h4 className="mt-0.5 truncate text-[14px] font-bold text-aventurea-ink">
            {grupo.negocio}
          </h4>
          <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
            {grupo.semanaEtiqueta} · {resumenGrupo(grupo)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span className="text-[16px] font-bold tabular-nums text-aventurea-ink">
            {fmtColones(grupo.total)}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={abierto}
            className="text-[12px] font-bold text-aventurea-navy underline underline-offset-2"
          >
            {abierto ? "Cerrar" : "Detalle"}
          </button>
          <button
            type="button"
            onClick={onDeshacer}
            disabled={pendiente}
            className="text-[12px] text-aventurea-ink-soft underline underline-offset-2 hover:text-aventurea-ink disabled:opacity-50"
          >
            Volver a pendiente
          </button>
        </div>
      </div>

      {abierto && (
        <div className="flex flex-col gap-2 border-t border-aventurea-line bg-aventurea-surface p-3.5">
          {grupo.cobros.map((c) => (
            <FilaCobro key={c.id} cobro={c} pendiente={pendiente} />
          ))}
        </div>
      )}
    </article>
  );
}
