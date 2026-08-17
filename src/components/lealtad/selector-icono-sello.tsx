"use client";

import { ICONOS_SELLO_LISTA, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { Icono, SelloConIcono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * QUÉ DIBUJO LLEVA CADA SELLO.
 *
 * Hasta la 0145 el sello era siempre el LOGO del negocio metido en un
 * círculo, y eso falla justo con quien más usa una tarjeta de sellos:
 * la soda que no tiene logo, la barbería cuyo logo es el nombre escrito
 * —ilegible a 30 píxeles—, y sobre todo la marca de logo BLANCO, que
 * sobre el círculo blanco del sello desaparece entera.
 *
 * Doce iconos, ni uno más. La lista corta se mira de un vistazo; con
 * cincuenta, elegir se vuelve una tarea y la gente la saltea.
 *
 * La primera opción es «Mi logo», y no está de adorno: es lo que hace
 * TODO lo emitido hasta hoy, así que tiene que estar a la vista y ser
 * la de arranque. Nadie que ya tenía su tarjeta funcionando se
 * encuentra con que le cambiamos el sello.
 *
 * Se usa en el creador y en el editor del diseño. Una sola pantalla de
 * elección, no dos: dos copias se separan en cuanto alguien agrega el
 * icono trece en una.
 */

export default function SelectorIconoSello({
  valor,
  alElegir,
  colorFondo,
  colorSello,
}: {
  valor: IconoSello | null;
  alElegir: (icono: IconoSello | null) => void;
  /** Los colores de la tarjeta: cada opción se muestra como se va a ver. */
  colorFondo: string;
  colorSello: string;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5"
      role="group"
      aria-label="Icono del sello"
    >
      <Opcion
        etiqueta="Mi logo"
        puesto={valor === null}
        alElegir={() => alElegir(null)}
        colorFondo={colorFondo}
      >
        <span
          className="grid h-8 w-8 place-items-center rounded-full border border-dashed"
          style={{ borderColor: colorSello, color: colorSello }}
        >
          <Icono nombre="camara" className="h-4 w-4" />
        </span>
      </Opcion>

      {ICONOS_SELLO_LISTA.map((i) => (
        <Opcion
          key={i.id}
          etiqueta={i.nombre}
          puesto={valor === i.id}
          alElegir={() => alElegir(i.id)}
          colorFondo={colorFondo}
        >
          {/* Lleno, que es como se ve el sello ya ganado: es el estado
              que el dueño quiere juzgar al elegir. */}
          <SelloConIcono
            icono={i.id}
            encendido
            colorFondo={colorFondo}
            colorSello={colorSello}
            lado={32}
          />
        </Opcion>
      ))}
    </div>
  );
}

/**
 * Una opción: la muestra sobre el fondo REAL de la tarjeta y el nombre
 * debajo. El fondo importa — un icono se juzga sobre el color donde va
 * a vivir, no sobre el blanco del formulario.
 */
function Opcion({
  etiqueta,
  puesto,
  alElegir,
  colorFondo,
  children,
}: {
  etiqueta: string;
  puesto: boolean;
  alElegir: () => void;
  colorFondo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={puesto}
      onClick={alElegir}
      title={etiqueta}
      className={`presionable overflow-hidden rounded-xl border text-center ${
        puesto ? "border-bookea-azul ring-2 ring-bookea-azul" : "border-bookea-linea"
      }`}
    >
      <span className="flex h-14 items-center justify-center" style={{ background: colorFondo }}>
        {children}
      </span>
      <span className="block truncate px-1 py-1.5 text-[10.5px] font-bold text-bookea-tinta">
        {etiqueta}
      </span>
    </button>
  );
}
