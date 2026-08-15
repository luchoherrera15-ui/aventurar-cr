import { IconCheck } from "@/components/icons";
import { diaDeSemana, instanteEnZona } from "@/lib/agenda/disponibilidad";
import { DIAS_SEMANA_LABEL, horaBonita, type HorarioSemana } from "../tipos";
import type { BadgeNegocio } from "./perfil-tipos";

const TITULO = "titulo text-[18px] text-aventurea-navy";

/**
 * Horario semanal, comodidades y política de cancelación — la
 * "ficha técnica" del negocio. Cada bloque es independiente y se salta
 * solo si no hay nada que mostrar (la política de cancelación es la
 * excepción: siempre hay algo, real o el texto genérico neutro).
 */
export default function BusinessInfoSection({
  horario,
  comodidades,
  politicaCancelacion,
  zonaHoraria = "America/Costa_Rica",
}: {
  horario: HorarioSemana | null;
  comodidades: BadgeNegocio[];
  politicaCancelacion: string | null;
  /** Opcional: para resaltar "hoy" con precisión si el padre la tiene a mano.
   *  Sin ella se asume la zona por defecto del negocio (CR), que es la
   *  correcta para casi todos los casos en este marketplace. */
  zonaHoraria?: string;
}) {
  const dow = diaDeSemana(instanteEnZona(new Date().toISOString(), zonaHoraria).fecha);

  return (
    <>
      {horario && (
        <div className="mt-9">
          <h2 className={TITULO}>Horario</h2>
          <div className="mt-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 sm:p-5">
            <div className="flex flex-col divide-y divide-[#eef2f9]">
              {DIAS_SEMANA_LABEL.map((dia, i) => {
                const d = horario[String(i)];
                const esHoy = i === dow;
                return (
                  <div
                    key={dia}
                    className={`flex items-center justify-between py-2 text-[13px] first:pt-0 last:pb-0 ${
                      esHoy ? "font-extrabold text-aventurea-ink" : "text-aventurea-ink-soft"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {dia}
                      {esHoy && (
                        <span className="rounded-md bg-aventurea-blue-light px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-aventurea-navy">
                          Hoy
                        </span>
                      )}
                    </span>
                    <span>
                      {d ? `${horaBonita(d.abre)} – ${horaBonita(d.cierra)}` : "Cerrado"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {comodidades.length > 0 && (
        <div className="mt-9">
          <h2 className={TITULO}>Comodidades</h2>
          {/* Lista con checks — mismo lenguaje que ComodidadesSeccion
              (detalles-seccion.tsx) y DetallesServicioSeccion para los
              booleanos: un check verde y el texto, sin repetir acá el
              set de íconos por tipo que ya usa BusinessBadges arriba
              de la página. */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {comodidades.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-2.5 rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13px] font-semibold text-aventurea-ink"
              >
                <IconCheck className="h-3.5 w-3.5 shrink-0 text-aventurea-green" />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-9">
        <h2 className={TITULO}>Política de cancelación</h2>
        <p className="mt-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
          {politicaCancelacion ??
            "Consultá la política de cancelación directamente con el negocio."}
        </p>
      </div>
    </>
  );
}
