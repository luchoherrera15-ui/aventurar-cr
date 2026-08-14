import { IconStar } from "@/components/icons";
import type { ResumenResenas } from "./perfil-tipos";

/**
 * El resumen de reseñas: la nota grande con sus estrellas y, debajo,
 * las cinco barras de distribución (5 estrellas primero, como en
 * Google/Fresha). Mismo tono que la nota de TarjetaReservaSticky —
 * número grande y negro, estrellas en aventurea-orange — pero acá con
 * el detalle de cuántas reseñas hay de cada nota.
 */
export default function ReviewsSummary({ resumen }: { resumen: ResumenResenas }) {
  const { promedio, total, distribucion } = resumen;

  if (total === 0 || promedio === null) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-white p-5">
        <p className="text-[13px] text-aventurea-ink-soft">
          Este negocio todavía no tiene reseñas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-6">
        {/* La nota grande. */}
        <div className="flex flex-col items-start">
          <span className="text-[40px] font-black leading-none tracking-[-0.6px] text-aventurea-ink">
            {promedio.toFixed(1).replace(".", ",")}
          </span>
          <span className="mt-1.5 flex items-center gap-0.5 text-aventurea-orange">
            {Array.from({ length: 5 }, (_, i) => (
              <IconStar
                key={i}
                className={`h-4 w-4 ${i < Math.round(promedio) ? "" : "opacity-25"}`}
              />
            ))}
          </span>
          <span className="mt-1 text-[13px] font-semibold text-aventurea-ink-soft">
            {total} {total === 1 ? "reseña" : "reseñas"}
          </span>
        </div>

        {/* Las barras de distribución, 5 estrellas primero. */}
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          {([5, 4, 3, 2, 1] as const).map((nota) => {
            const cantidad = distribucion[nota] ?? 0;
            const porcentaje = total > 0 ? Math.round((cantidad / total) * 100) : 0;
            return (
              <div key={nota} className="flex items-center gap-2 text-[12px]">
                <span className="w-3 shrink-0 text-right font-bold text-aventurea-ink-soft">
                  {nota}
                </span>
                <IconStar className="h-3 w-3 shrink-0 text-aventurea-orange" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef2f9]">
                  <span
                    className="block h-full rounded-full bg-aventurea-orange"
                    style={{ width: `${porcentaje}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right text-aventurea-ink-soft">
                  {cantidad}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
