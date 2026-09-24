import {
  IconoAlbumes,
  IconoConfirmacion,
  IconoFirma,
  IconoInvitacion,
  IconoQr,
  IconoRegalo,
  IconoVideos,
} from "@/components/celebrar/iconos-celebrar";
import { FUNCIONES } from "@/lib/celebrar/marca";

type Icono = (p: { className?: string }) => React.JSX.Element;

const ICONO: Record<(typeof FUNCIONES)[number]["id"], Icono> = {
  invitaciones: IconoInvitacion,
  video: IconoVideos,
  rsvp: IconoConfirmacion,
  album: IconoAlbumes,
  firmas: IconoFirma,
  regalos: IconoRegalo,
  qr: IconoQr,
};

/**
 * Las siete funciones en tarjetas con ícono, sobre fondo hielo. Cada
 * tarjeta tiene su ancla (`#invitaciones`, `#album`…) para que el pie y
 * los correos puedan apuntar a una.
 */
export default function Funciones() {
  return (
    <section
      id="funciones"
      aria-labelledby="funciones-titulo"
      className="scroll-mt-20 bg-(--c-hielo) py-16 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="c-pastilla">Todo en una sola página</p>
          <h2 id="funciones-titulo" className="mt-4 text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.1] text-(--c-tinta)">
            Todo lo que tu celebración necesita, en una sola dirección
          </h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-(--c-tinta-suave)">
            No son siete herramientas sueltas: es una página que va cambiando con la fiesta. Antes
            invita, durante recibe, después guarda.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FUNCIONES.map((f, i) => {
            const Icono = ICONO[f.id];
            // La primera tarjeta ocupa dos columnas en escritorio: es la
            // función principal y así la grilla de 7 cierra en 2 filas.
            const ancha = i === 0 ? "lg:col-span-2" : "";
            return (
              <li key={f.id} id={f.id} className={`c-tarjeta scroll-mt-24 p-6 ${ancha}`}>
                <span className="c-disco">
                  <Icono className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg leading-tight text-(--c-tinta)">{f.nombre}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-(--c-tinta-suave)">{f.detalle}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
