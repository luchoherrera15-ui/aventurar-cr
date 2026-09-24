import { RUTA } from "@/lib/celebrar/rutas";
import { EnlaceCelebrar } from "./rutas-cliente";

/**
 * La barra flotante de los demos a pantalla completa: dice que es una
 * muestra, vuelve al índice y lleva a crear la propia. Va abajo, fuera
 * del flujo de la invitación (que no sabe que es un demo).
 */
export default function BarraDemo({
  texto = "Estás viendo un demo",
  cta = "Crear mi invitación",
  ctaA = RUTA.appCrear,
  volver = "Más demos",
  volverA = RUTA.demos,
}: {
  texto?: string;
  cta?: string;
  ctaA?: string;
  volver?: string;
  volverA?: string;
}) {
  return (
    <div className="celebrar fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="region" aria-label="Demo">
      <div className="flex max-w-full items-center gap-2 rounded-full border border-(--c-linea) bg-(--c-blanco)/95 p-1.5 pl-4 shadow-flotante backdrop-blur">
        <p className="c-montserrat hidden truncate text-[13px] font-semibold text-(--c-tinta) sm:block">{texto}</p>
        <EnlaceCelebrar a={volverA} className="c-boton c-boton-secundario min-h-10 rounded-full text-[13px]">
          {volver}
        </EnlaceCelebrar>
        <EnlaceCelebrar a={ctaA} className="c-boton c-boton-primario min-h-10 rounded-full text-[13px]">
          {cta}
        </EnlaceCelebrar>
      </div>
    </div>
  );
}
