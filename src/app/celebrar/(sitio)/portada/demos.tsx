import TarjetasDemos from "@/components/celebrar/demo/tarjetas-demos";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { RUTA } from "@/lib/celebrar/rutas";

/**
 * «Ver demos»: las invitaciones de muestra destacadas (con música), el
 * álbum de la fiesta y el panel del anfitrión, cada una con su botón.
 * Para que quien llega entienda el producto entero antes de crear nada.
 */
export default function Demos() {
  return (
    <section id="demos" aria-labelledby="demos-titulo" className="bg-(--c-hielo) py-16 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="c-pastilla">Ver demos</p>
            <h2 id="demos-titulo" className="mt-4 text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.1] text-(--c-tinta)">
              Probalo como lo vería un invitado
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-(--c-tinta-suave)">
              Invitaciones completas con música y animación, el álbum que se arma durante la fiesta y el panel donde llegan las confirmaciones. Tocá «Ver demo» y scrolleá.
            </p>
          </div>
          <EnlaceCelebrar a={RUTA.demos} className="c-boton c-boton-secundario shrink-0">
            Todos los demos
          </EnlaceCelebrar>
        </div>
        <div className="mt-10">
          <TarjetasDemos soloDestacadas />
        </div>
      </div>
    </section>
  );
}
