import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { RUTA } from "@/lib/celebrar/rutas";

/** La banda final: marino, centrada, un solo llamado. */
export default function Cierre() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8 lg:pb-24">
      <div className="sobre-oscuro relative overflow-hidden rounded-[24px] bg-(--c-marino) px-6 py-14 text-center text-(--c-blanco) lg:px-16 lg:py-20">
        <span aria-hidden="true" className="c-confeti h-4 w-4 bg-(--c-coral)" style={{ top: "18%", left: "8%" }} />
        <span aria-hidden="true" className="c-confeti h-6 w-6 border-2 border-(--c-sobre-marino-suave)" style={{ top: "62%", left: "5%" }} />
        <span aria-hidden="true" className="c-confeti h-3 w-3 bg-(--c-sobre-marino-suave)" style={{ top: "22%", left: "92%" }} />
        <span aria-hidden="true" className="c-confeti h-5 w-5 border-2 border-(--c-coral)" style={{ top: "70%", left: "90%" }} />
        <h2 className="mx-auto max-w-3xl text-[clamp(1.9rem,4vw,3.25rem)] leading-[1.06] text-(--c-blanco)">
          ¿Qué están celebrando?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-(--c-sobre-marino-suave)">
          Empezá con la fecha y el nombre. Lo demás —el diseño, los invitados, el álbum— se va
          sumando a la misma página.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-claro">
            Crear mi invitación
          </EnlaceCelebrar>
          <EnlaceCelebrar a={RUTA.entrar} className="c-boton c-boton-fantasma">
            Ya tengo cuenta
          </EnlaceCelebrar>
        </div>
      </div>
    </section>
  );
}
