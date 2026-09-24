import { RUTA } from "@/lib/celebrar/rutas";
import { IconoCelebraciones } from "../iconos-celebrar";
import { EnlaceCelebrar } from "../rutas-cliente";

/**
 * Las piezas del panel de CELEBRAR: cabecera de sección, tarjeta,
 * estado vacío y dato. Componentes de servidor, sin estado. Las
 * tarjetas son `c-tarjeta` (blancas, borde, sombra plana); la marina y
 * la coral son para destacar una entre varias.
 *
 * Regla heredada del sistema de diseño del repo: una tarjeta sin dato
 * real no se rellena con un cero ni con «--». `EstadoVacio` dice qué
 * va a aparecer y qué hacer; no simula que ya hay algo.
 */

export function EncabezadoPanel({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-[clamp(1.6rem,2.6vw,2.1rem)] leading-[1.15] text-(--c-tinta)">{titulo}</h1>
        {descripcion && (
          <p className="mt-2 text-[15px] leading-relaxed text-(--c-tinta-suave)">{descripcion}</p>
        )}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}

export function TarjetaPanel({
  children,
  className = "",
  tono = "blanca",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  tono?: "blanca" | "marina" | "coral";
  id?: string;
}) {
  const fondo =
    tono === "marina"
      ? "sobre-oscuro rounded-[var(--c-radio-tarjeta)] bg-(--c-marino) text-(--c-blanco)"
      : tono === "coral"
        ? "rounded-[var(--c-radio-tarjeta)] bg-(--c-coral-suave) text-(--c-coral-tinta)"
        : "c-tarjeta text-(--c-tinta)";
  return (
    <section id={id} className={`p-6 lg:p-8 ${fondo} ${className}`}>
      {children}
    </section>
  );
}

export function EstadoVacio({
  titulo,
  texto,
  accionTexto = "Crear celebración",
  accionRuta = RUTA.appCrear,
  Icono = IconoCelebraciones,
}: {
  titulo: string;
  texto: string;
  accionTexto?: string | null;
  accionRuta?: string;
  Icono?: (p: { className?: string }) => React.JSX.Element;
}) {
  return (
    <TarjetaPanel className="flex flex-col items-start gap-5">
      <span className="c-disco">
        <Icono className="h-5 w-5" />
      </span>
      <div className="max-w-xl">
        <h2 className="text-xl leading-tight text-(--c-tinta)">{titulo}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-(--c-tinta-suave)">{texto}</p>
      </div>
      {accionTexto && (
        <EnlaceCelebrar a={accionRuta} className="c-boton c-boton-primario">
          {accionTexto}
        </EnlaceCelebrar>
      )}
    </TarjetaPanel>
  );
}

/** Un dato con su rótulo, para fichas de cuenta y resúmenes. */
export function Dato({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-(--c-linea) py-4 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-6">
      <dt className="c-montserrat text-[13px] font-semibold text-(--c-tinta-suave)">{rotulo}</dt>
      <dd className="text-[15px] text-(--c-tinta)">{valor}</dd>
    </div>
  );
}
