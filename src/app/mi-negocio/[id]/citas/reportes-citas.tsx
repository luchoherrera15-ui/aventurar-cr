"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtColones } from "@/lib/finanzas";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { reporteCitas, type CitaReporte, type ReporteCitas } from "@/lib/metricas-citas";
import type { Vocabulario } from "@/lib/business/identidad";
import {
  Card,
  CardVacia,
  EsqueletoMetrica,
  FilaPanel,
  Metrica,
  PildoraEstado,
} from "@/components/panel/piezas";
import {
  ACCION_ACENTO,
  CUERPO_SUAVE,
  DETALLE,
  ESTADO_AVISO,
  GAP_METRICAS,
  GAP_TABLERO,
  MARCA_ACENTO,
} from "@/components/panel/sistema";
import {
  IconCalendarLine,
  IconChartBars,
  IconCheck,
  IconWarning,
} from "@/components/icons";

/**
 * Los números del negocio de citas: cuántas citas, quién las atendió,
 * la tasa de no-shows, los servicios más pedidos y las horas pico.
 * Todo derivado de las reservas (lib metricas-citas, probada sin
 * React); las barras van a mano en divs, como el gráfico de Finanzas.
 *
 * Las palabras y el color los pone el tipo de negocio: el mismo reporte
 * cuenta CONSULTAS en un consultorio y SESIONES en un gimnasio.
 *
 * ── EL REDISEÑO ────────────────────────────────────────────────────
 * La piel es la del panel (`referencia/bookeapaneles.html`): los cuatro
 * números arriba son `Metrica` con el disco de ícono en el acento del
 * rubro, y los tres listados son `Card` + `FilaPanel`, la misma fila que
 * usan la agenda y Finanzas.
 *
 * Y los números ya no cambian de color. El no-show alto se pintaba con
 * la tarjeta entera en rojo, o sea una métrica normal y otra que parece
 * un error del sistema; ahora la cifra va siempre en la tinta fuerte
 * (18,10:1) y la alarma es una píldora `alerta` con palabras. Mismo
 * umbral, misma cuenta: `tasaNoShow >= 0.15`.
 *
 * Ni una consulta ni un cálculo cambiaron: la query a `reservas` y
 * `reporteCitas()` son exactamente los mismos.
 */

type Rango = "30" | "90" | "365";

const RANGO_LABEL: Record<Rango, string> = {
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  "365": "Último año",
};

export default function ReportesCitas({
  ranchoId,
  equipo,
  vocabulario,
}: {
  ranchoId: string;
  equipo: { id: string; nombre: string }[];
  vocabulario: Vocabulario;
}) {
  const { visita } = vocabulario;
  const [rango, setRango] = useState<Rango>("30");
  const [reporte, setReporte] = useState<ReporteCitas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nombreMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));

  useEffect(() => {
    let vigente = true;
    const hoy = hoyISOCR();
    const desde = sumarDiasISO(hoy, -Number(rango));
    const supabase = createClient();
    supabase
      .from("reservas")
      .select("fecha, hora_inicio, estado, miembro_id, monto_total, tipo_evento")
      .eq("rancho_id", ranchoId)
      .gte("fecha", desde)
      .lte("fecha", hoy)
      .not("hora_inicio", "is", null)
      .limit(5000)
      .then(({ data, error: errorCarga }) => {
        if (!vigente) return;
        if (errorCarga) {
          setError("No se pudieron cargar los números: " + errorCarga.message);
          return;
        }
        setError(null);
        setReporte(reporteCitas((data ?? []) as CitaReporte[], hoy));
      });
    return () => {
      vigente = false;
    };
  }, [ranchoId, rango]);

  const maxHora = Math.max(1, ...(reporte?.horasPico.map((h) => h.veces) ?? [1]));
  const noShowAlto = reporte?.tasaNoShow !== null && (reporte?.tasaNoShow ?? 0) >= 0.15;

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {/* El selector de rango: el activo lleva el acento del tipo de
          negocio (`sobreSolido` sobre `solido`, ≥5,18:1 en los ocho
          acentos del catálogo). Es una ACCIÓN, que es uno de los tres
          papeles que el acento tiene permitido. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Período del reporte">
        {(Object.keys(RANGO_LABEL) as Rango[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRango(r)}
            aria-pressed={rango === r}
            style={rango === r ? (ACCION_ACENTO as CSSProperties) : undefined}
            className={`inline-flex h-9 items-center rounded-xl border px-3.5 text-[12.5px] font-bold transition-colors ${
              rango === r
                ? "border-transparent"
                : "border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
            }`}
          >
            {RANGO_LABEL[r]}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className={`rounded-xl p-3 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}
        >
          {error}
        </p>
      )}

      {!reporte ? (
        // El esqueleto calca los cuatro números que vienen: si midiera
        // distinto, la sección saltaría al llegar los datos.
        <div className={`grid grid-cols-2 ${GAP_METRICAS} lg:grid-cols-4`}>
          {[0, 1, 2, 3].map((i) => (
            <EsqueletoMetrica key={i} />
          ))}
        </div>
      ) : reporte.total === 0 ? (
        <CardVacia>
          Sin {visita.plural} en ese rango todavía. Cuando empieces a agendar, acá vas a
          ver la asistencia, los ingresos y las horas en que más te buscan.
        </CardVacia>
      ) : (
        <>
          <div className={`grid grid-cols-2 ${GAP_METRICAS} lg:grid-cols-4`}>
            <Metrica
              rotulo={visita.Plural}
              valor={String(reporte.total)}
              detalle={RANGO_LABEL[rango].toLowerCase()}
              icono={<IconCalendarLine />}
            />
            <Metrica
              rotulo="Atendidas"
              valor={String(reporte.cumplidas)}
              detalle={`de ${reporte.total} agendadas`}
              icono={<IconCheck />}
            />
            <Metrica
              rotulo="No-shows"
              valor={
                reporte.tasaNoShow === null
                  ? String(reporte.noShows)
                  : `${reporte.noShows} (${Math.round(reporte.tasaNoShow * 100)}%)`
              }
              icono={<IconWarning />}
              // La alarma es una píldora con palabras, no la tarjeta
              // teñida de rojo. Mismo umbral que antes.
              tendencia={
                noShowAlto ? <PildoraEstado estado="alerta">Alto</PildoraEstado> : undefined
              }
            />
            <Metrica
              rotulo="Ingresos"
              valor={fmtColones(reporte.ingresos)}
              detalle="solo las atendidas"
              icono={<IconChartBars />}
            />
          </div>

          {reporte.sinMarcar > 0 && (
            <p className={`rounded-xl p-3 text-[12.5px] leading-relaxed ${ESTADO_AVISO.info}`}>
              {reporte.sinMarcar} {reporte.sinMarcar === 1 ? visita.singular : visita.plural} de
              días pasados sin marcar (¿vino o no vino?) — los números de asistencia quedan
              incompletos hasta marcarlas en la Agenda del día.
            </p>
          )}

          {reporte.porMiembro.length > 0 && (
            <Card
              eyebrow="Quién atiende"
              titulo="Por persona"
              accion={
                <PildoraEstado estado="neutro">
                  {reporte.porMiembro.length}{" "}
                  {reporte.porMiembro.length === 1 ? "persona" : "personas"}
                </PildoraEstado>
              }
            >
              {reporte.porMiembro.map((m, i) => (
                <FilaPanel
                  key={m.miembroId ?? "sin"}
                  marca={m.noShows > 0 ? "aviso" : "exito"}
                  titulo={
                    m.miembroId
                      ? (nombreMiembro.get(m.miembroId) ?? "Alguien que ya no está")
                      : "Sin asignar"
                  }
                  detalle={`${m.citas} ${m.citas === 1 ? visita.singular : visita.plural} · ${
                    m.cumplidas
                  } atendida${m.cumplidas === 1 ? "" : "s"}${
                    m.noShows > 0
                      ? ` · ${m.noShows} no-show${m.noShows === 1 ? "" : "s"}`
                      : ""
                  }`}
                  separador={i < reporte.porMiembro.length - 1}
                  derecha={<Monto>{fmtColones(m.ingresos)}</Monto>}
                />
              ))}
            </Card>
          )}

          <div className={`grid grid-cols-1 ${GAP_TABLERO} lg:grid-cols-2`}>
            {reporte.topServicios.length > 0 && (
              <Card
                eyebrow="Demanda"
                titulo="Servicios más pedidos"
                accion={
                  <PildoraEstado estado="neutro">{reporte.topServicios.length}</PildoraEstado>
                }
              >
                {reporte.topServicios.map((s, i) => (
                  <FilaPanel
                    key={s.nombre}
                    marca="info"
                    titulo={s.nombre}
                    detalle={`${s.veces} ${s.veces === 1 ? "vez" : "veces"}`}
                    separador={i < reporte.topServicios.length - 1}
                    derecha={<Monto>{fmtColones(s.ingresos)}</Monto>}
                  />
                ))}
              </Card>
            )}

            {reporte.horasPico.length > 0 && (
              <Card
                eyebrow="Cuándo te buscan"
                titulo="Horas pico"
                accion={
                  <span className={CUERPO_SUAVE}>
                    {visita.plural} por hora
                  </span>
                }
              >
                <div className="flex flex-col gap-2">
                  {reporte.horasPico.map((h) => (
                    <div key={h.hora} className="flex items-center gap-2.5">
                      <span className="w-[46px] shrink-0 text-[12px] font-bold tabular-nums text-aventurea-ink-soft">
                        {String(h.hora).padStart(2, "0")}:00
                      </span>
                      {/* Carril hundido + relleno en el acento del rubro:
                          el mismo par que la barra de progreso del menú.
                          Sólido contra el gris del carril, ≥4,71:1. */}
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-aventurea-line bg-aventurea-cream-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round((h.veces / maxHora) * 100)}%`,
                            ...(MARCA_ACENTO as CSSProperties),
                          }}
                        />
                      </div>
                      <span className="w-[30px] shrink-0 text-right text-[12px] font-bold tabular-nums text-aventurea-ink">
                        {h.veces}
                      </span>
                    </div>
                  ))}
                </div>
                <p className={`mt-3 ${DETALLE}`}>
                  Las horas en que más {visita.plural} se agendaron en el período.
                </p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Un monto de la columna derecha: alineado a la derecha, tabular y sin
 *  partirse nunca — «₡12.500.000» cortado no es un número redondeado,
 *  es un número equivocado. */
function Monto({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 whitespace-nowrap text-right text-[13px] font-extrabold tabular-nums text-aventurea-ink">
      {children}
    </span>
  );
}
