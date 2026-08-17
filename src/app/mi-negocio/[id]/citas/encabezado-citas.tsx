import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import * as Iconos from "@/components/icons";
import { fmtColones } from "@/lib/finanzas";
import { DIAS_INACTIVO } from "@/lib/crm-citas";
import { variablesAcento, type IdentidadNegocio } from "@/lib/business/identidad";
import { etiquetaHoras, type MetricasDia } from "./metricas-dia";

/**
 * La cabecera de la pantalla de Citas: quién es este negocio y cómo va
 * su día.
 *
 * Es el lugar donde el panel deja de ser genérico. El ícono, el color y
 * las palabras salen del catálogo de identidad (lib/business/identidad),
 * no de esta pantalla: acá solo se pintan. El acento entra UNA vez como
 * variables CSS en el contenedor y todo lo de adentro lo hereda con
 * `var(--acento…)`, así no hay un solo hexadecimal suelto en el JSX.
 *
 * Las tarjetas de números: cada una se muestra solo si su dato existe
 * de verdad (ver metricas-dia.ts). La de ocupación desaparece cuando el
 * negocio no tiene horario configurado — preferimos una tarjeta menos
 * que un porcentaje que nadie puede reproducir.
 */

/** Un número del día. `detalle` es opcional: si no hay, no se inventa. */
function Tarjeta({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-aventurea-line bg-white px-4 py-3.5">
      <p
        className="text-[10.5px] font-bold uppercase tracking-wide"
        style={{ color: "var(--acento)" }}
      >
        {etiqueta}
      </p>
      <p className="mt-1 text-[22px] font-extrabold leading-none tabular-nums text-aventurea-ink">
        {valor}
      </p>
      {detalle && (
        <p className="mt-1.5 text-[11.5px] leading-snug text-aventurea-ink-soft">{detalle}</p>
      )}
    </article>
  );
}

export default function EncabezadoCitas({
  identidad,
  tipoLabel,
  hrefConfig,
  nombreNegocio,
  fecha,
  titulo,
  descripcion,
  metricas,
  muestraPagos,
  personas,
}: {
  identidad: IdentidadNegocio;
  /**
   * El label del tipo ("Barbería"), o `null` cuando el negocio todavía
   * no tiene uno de verdad. Decir "Otro" no le informa nada a nadie: en
   * ese caso se le ofrece elegirlo, que es lo que hace que el panel se
   * adapte.
   */
  tipoLabel: string | null;
  /** A dónde se elige el tipo de negocio. */
  hrefConfig: string;
  nombreNegocio: string;
  /** El día que se está mirando, "YYYY-MM-DD". */
  fecha: string;
  /** "Citas", "Consultas", "Sesiones"… ya resuelto por la página. */
  titulo: string;
  descripcion: ReactNode;
  metricas: MetricasDia;
  /** ¿Este negocio lleva el cobro por acá? (módulo `pagos`) */
  muestraPagos: boolean;
  /** El CRM, si el negocio lo usa (módulo `clientes`). */
  personas: { total: number; inactivos: number } | null;
}) {
  const Icono = Iconos[identidad.icono];
  const { visita, persona } = identidad.vocabulario;

  // La fecha se arma desde el ISO al mediodía UTC: la fecha del día ya
  // viene resuelta en la zona del negocio (hoyISOCR), y formatearla con
  // la zona del servidor la correría un día para quien mira de noche.
  const largoDelDia = new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`));

  // El detalle de la tarjeta del día se arma con las piezas que de
  // verdad hay: un día sin pendientes no dice "0 sin confirmar".
  const desglose = [
    metricas.confirmadas > 0 ? `${metricas.confirmadas} confirmadas` : null,
    metricas.sinConfirmar > 0 ? `${metricas.sinConfirmar} sin confirmar` : null,
    metricas.yaVinieron > 0 ? `${metricas.yaVinieron} ya vinieron` : null,
    metricas.noVinieron > 0 ? `${metricas.noVinieron} no vinieron` : null,
  ].filter(Boolean);

  return (
    <header style={variablesAcento(identidad) as CSSProperties}>
      <div className="flex items-start gap-3.5">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6"
          style={{ backgroundColor: "var(--acento-suave)", color: "var(--acento)" }}
          aria-hidden
        >
          <Icono />
        </span>
        <div className="min-w-0">
          <p
            className="text-[10.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--acento)" }}
          >
            {largoDelDia}
          </p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-[1.15] tracking-tight text-aventurea-navy sm:text-[28px]">
            {titulo} de {nombreNegocio}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-aventurea-ink-soft">
            {tipoLabel ? (
              <>
                <span
                  className="rounded-lg px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: "var(--acento-suave)", color: "var(--acento)" }}
                >
                  {tipoLabel}
                </span>
                <span className="min-w-0">{identidad.descripcion}</span>
              </>
            ) : (
              <span className="min-w-0">
                Todavía no elegiste tu tipo de negocio —{" "}
                <Link href={hrefConfig} className="font-bold text-aventurea-navy underline">
                  elegilo en Configuración
                </Link>{" "}
                y esta pantalla se adapta a tu rubro.
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="mt-4 max-w-[70ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        {descripcion}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          etiqueta={`${visita.Plural} hoy`}
          valor={String(metricas.total)}
          detalle={desglose.length > 0 ? desglose.join(" · ") : undefined}
        />

        {/* Solo con jornada real contra la cual medir. Sin horario
            configurado la tarjeta no existe, en vez de mostrar 0%. */}
        {metricas.ocupacion !== null && (
          <Tarjeta
            etiqueta="Ocupación de hoy"
            valor={`${metricas.ocupacion}%`}
            detalle={`${etiquetaHoras(metricas.minutosAgendados)} ocupados de ${etiquetaHoras(
              metricas.minutosDeAgenda,
            )}`}
          />
        )}

        {muestraPagos && (
          <Tarjeta
            etiqueta="Cobrado hoy"
            valor={fmtColones(metricas.cobrado)}
            detalle={
              metricas.porCobrar > 0
                ? `${fmtColones(metricas.porCobrar)} sin cobrar`
                : metricas.total > 0
                  ? "Nada pendiente de cobro"
                  : undefined
            }
          />
        )}

        {personas && (
          <Tarjeta
            etiqueta={persona.Plural}
            valor={String(personas.total)}
            detalle={
              personas.inactivos > 0
                ? `${personas.inactivos} sin venir hace ${DIAS_INACTIVO}+ días`
                : undefined
            }
          />
        )}
      </div>
    </header>
  );
}
