import type { Metadata } from "next";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { CATEGORIAS_PLANTILLA } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";

export const metadata: Metadata = {
  title: "Plantillas",
  description:
    "Once estilos de invitación digital: elegante, minimalista, luxury, romántica, floral, moderna, editorial, tropical, infantil, fiesta y corporativa.",
  alternates: { canonical: urlPublicaCelebrar(RUTA.plantillas) },
};

/** Una paleta ilustrativa por categoría, para que la tarjeta muestre el carácter del estilo. */
const MUESTRA: Record<string, string> = {
  elegante: "linear-gradient(135deg,#0b1e45,#3b4f80)",
  minimalista: "linear-gradient(135deg,#f4f7fb,#dfe6f1)",
  luxury: "linear-gradient(135deg,#1a1a2e,#b8955a)",
  romantica: "linear-gradient(135deg,#fdece9,#f2b8ad)",
  floral: "linear-gradient(135deg,#e6f5ec,#9fd3b6)",
  moderna: "linear-gradient(135deg,#1f4fd8,#7fa1ff)",
  editorial: "linear-gradient(135deg,#0f1b33,#5b6b85)",
  tropical: "linear-gradient(135deg,#0d7a5f,#7fd6b3)",
  infantil: "linear-gradient(135deg,#ffd166,#f26b5b)",
  fiesta: "linear-gradient(135deg,#6a2cff,#ff5fa2)",
  corporativa: "linear-gradient(135deg,#142b5c,#8aa0c8)",
};

/**
 * El catálogo público, por categorías. Los diseños en sí viven en la
 * base (Fase 3) y aparecen acá cuando existan, con su previa real;
 * mientras, cada tarjeta lleva una paleta ilustrativa del estilo y
 * para qué sirve. Contenido cierto, no un «próximamente» vacío.
 */
export default function PlantillasPublicas() {
  return (
    <>
      <section className="bg-(--c-hielo) py-14 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="c-pastilla">Plantillas</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06] text-(--c-tinta)">
            Once estilos, un mismo cuidado
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-(--c-tinta-suave)">
            Cada plantilla es un punto de partida: colores, letra, fotos, música y el orden de las
            secciones se cambian en el editor, viendo el resultado en vivo. Todas se usan gratis:
            pagás ₡7 500 recién al publicar tu invitación.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIAS_PLANTILLA.map((c) => (
            <li key={c.id} id={c.id} className="c-tarjeta elevar flex flex-col overflow-hidden scroll-mt-24">
              <div className="aspect-[16/9]" style={{ background: MUESTRA[c.id] }} aria-hidden="true" />
              <div className="flex flex-1 flex-col p-6">
                <h2 className="text-xl leading-tight text-(--c-tinta)">{c.nombre}</h2>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-(--c-tinta-suave)">{c.detalle}</p>
                <p className="c-montserrat mt-4 text-[13px] font-semibold text-(--c-azul)">{c.para}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-14 flex flex-wrap items-center gap-3">
          <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-primario">
            Crear mi invitación
          </EnlaceCelebrar>
          <EnlaceCelebrar a={RUTA.precios} className="c-boton c-boton-secundario">
            Ver precios
          </EnlaceCelebrar>
        </div>
      </section>
    </>
  );
}
