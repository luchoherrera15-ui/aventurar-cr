import {
  IconoCompartir,
  IconoEditor,
  IconoFiesta,
  IconoRecuerdos,
} from "@/components/celebrar/iconos-celebrar";
import { PASOS } from "@/lib/celebrar/marca";

const ICONOS = [IconoEditor, IconoCompartir, IconoFiesta, IconoRecuerdos];

/**
 * Los cuatro verbos del lema como tarjetas numeradas. Acá el número
 * sí significa algo: es el orden en que pasa una celebración.
 */
export default function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-titulo"
      className="scroll-mt-20 bg-(--c-hielo) py-16 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="c-pastilla">Cómo funciona</p>
          <h2 id="como-titulo" className="mt-4 text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.1] text-(--c-tinta)">
            De principio a fin, en cuatro pasos
          </h2>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((p, i) => {
            const Icono = ICONOS[i];
            return (
              <li key={p.numero} className="c-tarjeta flex flex-col p-6">
                <div className="flex items-center justify-between">
                  <span className="c-disco">
                    <Icono className="h-5 w-5" />
                  </span>
                  <span aria-hidden="true" className="c-montserrat text-3xl font-extrabold tracking-tight text-(--c-linea)">
                    {p.numero}
                  </span>
                </div>
                <h3 className="mt-6 text-xl leading-tight text-(--c-marino)">{p.verbo}</h3>
                <p className="c-montserrat mt-1 text-[15px] font-semibold leading-snug text-(--c-tinta)">
                  {p.titulo}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-(--c-tinta-suave)">{p.detalle}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
