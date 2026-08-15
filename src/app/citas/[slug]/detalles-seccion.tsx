import { IconCheck } from "@/components/icons";
import { formatearValor } from "@/app/mi-negocio/campos-servicio";
import { CAMPOS_POR_CATEGORIA_CITA } from "../campos-servicio";
import { COMODIDADES_CITA } from "../comodidades";
import type { CategoriaCita } from "../tipos";

/**
 * Lado público de src/app/citas/campos-servicio.ts: lo que el dueño
 * cargó en "Detalles del servicio" (editar-form.tsx), pintado en el
 * portal. Misma idea que DetallesSeccion de Eventos
 * (src/app/eventos/[id]/portal-secciones.tsx) pero con la paleta navy
 * de Citas en vez del acento naranja de Eventos.
 */
export function DetallesServicioSeccion({
  categoria,
  detalles,
}: {
  categoria: CategoriaCita;
  detalles: Record<string, unknown>;
}) {
  const grupos = (CAMPOS_POR_CATEGORIA_CITA[categoria] ?? [])
    .map((g) => ({
      titulo: g.titulo,
      items: g.campos
        .map((campo) => ({
          label: campo.label,
          valor: formatearValor(campo, detalles?.[campo.id]),
          tipo: campo.tipo,
        }))
        .filter((i) => i.valor !== null),
    }))
    .filter((g) => g.items.length > 0);

  if (grupos.length === 0) return null;

  return (
    <div className="mt-9">
      <h2 className="titulo text-[18px] text-aventurea-navy">
        Detalles del servicio
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {grupos.map((g) => (
          <div
            key={g.titulo}
            className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4"
          >
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">
              {g.titulo}
            </h3>
            <ul className="mt-2.5 flex flex-col gap-2">
              {g.items.map((i) => (
                <li key={i.label} className="text-[13px]">
                  {/* Los "sí/no" se leen mejor como check que como
                      "Atendés niños: Sí". */}
                  {i.tipo === "booleano" ? (
                    <span className="flex items-center gap-2 text-aventurea-ink">
                      <IconCheck className="h-3.5 w-3.5 shrink-0 text-aventurea-green" />
                      {i.label}
                    </span>
                  ) : (
                    <>
                      <span className="block text-[11.5px] text-aventurea-ink-soft">
                        {i.label}
                      </span>
                      <span className="mt-0.5 block font-bold text-aventurea-ink">
                        {i.valor}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Lado público de src/app/citas/comodidades.ts: la lista de chips con
 * check, mismo patrón visual que usan las tarjetas del equipo y las
 * reseñas de este portal (bordes suaves, sin la ficha por categorías
 * que usa Eventos — acá son 6 ids como mucho, no hace falta agrupar).
 */
export function ComodidadesSeccion({ amenidades }: { amenidades: string[] }) {
  const items = COMODIDADES_CITA.filter((c) => amenidades.includes(c.id));
  if (items.length === 0) return null;

  return (
    <div className="mt-9">
      <h2 className="titulo text-[18px] text-aventurea-navy">
        Comodidades del local
      </h2>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {items.map((c) => (
          <span
            key={c.id}
            className="flex items-center gap-2 rounded-xl border border-aventurea-line bg-white px-3.5 py-2 text-[13px] font-semibold text-aventurea-ink"
          >
            <IconCheck className="h-3.5 w-3.5 shrink-0 text-aventurea-green" />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
