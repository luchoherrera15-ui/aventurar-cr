import Link from "next/link";
import MarcaCelebrar from "@/components/celebrar/marca-celebrar";
import { PREFIJO_CELEBRAR } from "@/lib/celebrar/rutas";

/**
 * El 404 de CELEBRAR. Cuelga del layout raíz del producto (sin host ni
 * sesión), así que no puede usar `EnlaceCelebrar`: el link a la portada
 * va con el prefijo fijo — bajo celebrar.lat el proxy lo redirige a `/`.
 */
export default function NoEncontradoCelebrar() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <MarcaCelebrar comoTexto tamano="lg" />
      <h1 className="mt-10 text-[clamp(2.25rem,5vw,4rem)] leading-[1.04] text-(--c-tinta)">
        Esta página no existe.
      </h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-(--c-tinta-suave)">
        Puede que el link esté mal escrito o que la celebración ya no esté publicada.
      </p>
      <Link href={PREFIJO_CELEBRAR} className="c-boton c-boton-primario mt-9">
        Ir a la portada
      </Link>
    </section>
  );
}
