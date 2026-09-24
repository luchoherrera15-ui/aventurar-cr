import type { Metadata } from "next";
import TarjetasDemos from "@/components/celebrar/demo/tarjetas-demos";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";

export const metadata: Metadata = {
  title: "Demos",
  description: "Invitaciones digitales de muestra con música y animación, el álbum colaborativo de la fiesta y el panel del anfitrión. Probalo como lo vería un invitado.",
  alternates: { canonical: urlPublicaCelebrar(RUTA.demos) },
};

export default function DemosPage() {
  return (
    <>
      <section className="bg-(--c-marino) py-14 text-(--c-blanco) lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="c-pastilla">Demos</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06]">Abrí una y scrolleá: así lo recibe un invitado</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-(--c-sobre-marino-suave)">
            Bodas, quince años, cumpleaños infantiles y eventos corporativos, con música, programa, vestimenta, galería y el formulario de confirmación al final. Más el álbum de la fiesta y el panel donde el anfitrión ve quién viene.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-claro">
              Crear mi invitación
            </EnlaceCelebrar>
            <EnlaceCelebrar a={RUTA.plantillas} className="c-boton c-boton-fantasma">
              Ver los 440 diseños
            </EnlaceCelebrar>
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <TarjetasDemos />
      </section>
    </>
  );
}
