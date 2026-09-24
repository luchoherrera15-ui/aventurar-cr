import { MARCA } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";
import { EnlaceCelebrar } from "./rutas-cliente";

/**
 * El logotipo: la loseta marina con el anillo y la palabra en
 * Montserrat 700, minúsculas. `tono="claro"` invierte para fondos
 * marinos (loseta blanca, letra blanca). Es un link a la portada salvo
 * que se pida como texto (`comoTexto`).
 */
export default function MarcaCelebrar({
  tono = "oscuro",
  tamano = "md",
  comoTexto = false,
  className = "",
}: {
  tono?: "oscuro" | "claro";
  tamano?: "sm" | "md" | "lg";
  comoTexto?: boolean;
  className?: string;
}) {
  const color = tono === "claro" ? "text-(--c-blanco)" : "text-(--c-marino)";
  const tam = tamano === "lg" ? "text-3xl" : tamano === "sm" ? "text-lg" : "text-[22px]";
  const contenido = (
    <>
      <span className={`c-loseta ${tono === "claro" ? "c-loseta-clara" : ""}`} aria-hidden="true" />
      <span className="c-montserrat font-bold leading-none tracking-tight">{MARCA.logotipo}</span>
    </>
  );
  const clases = `inline-flex items-center gap-2.5 ${tam} ${color} ${className}`;
  if (comoTexto) {
    return (
      <span className={clases} aria-label={MARCA.nombre}>
        {contenido}
      </span>
    );
  }
  return (
    <EnlaceCelebrar a={RUTA.inicio} className={clases} aria-label={`${MARCA.nombre}, inicio`}>
      {contenido}
    </EnlaceCelebrar>
  );
}
