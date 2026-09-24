import {
  FAMILIAS,
  FAMILIA_LABEL,
  TIPOS_NEGOCIO,
  type FamiliaId,
} from "@/lib/business/modulos";
import PanelDeTipo from "./panel-de-tipo";
import { Encabezado, Escenario, NotaDemo, Seccion } from "./piezas";

/**
 * PARA CADA RUBRO — la taxonomía real, leída del archivo.
 *
 * Los rubros NO se escriben acá: salen de `TIPOS_NEGOCIO` y `FAMILIAS`
 * (`src/lib/business/modulos.ts`), que es de donde salen también el
 * selector del alta y el menú del panel. Una lista escrita a mano en la
 * landing se desincroniza el día que se agrega un tipo.
 *
 * Por eso tampoco aparece «Tienda» ni «Cafetería»: no existen como
 * tipo. Si mañana existen, aparecen solas.
 *
 * Los dos paneles del mockup los arman las MISMAS funciones puras que
 * arman el panel de verdad. Una barbería y un gimnasio no comparten ni
 * la mitad del menú, y verlo al lado es el argumento entero.
 */

function tiposDe(familia: FamiliaId) {
  return TIPOS_NEGOCIO.filter((t) => t.familia === familia && t.id !== "otro");
}

export default function TiposDeNegocio() {
  const familias = FAMILIAS.filter((f) => f !== "otro").filter(
    (f) => tiposDe(f).length > 0,
  );

  return (
    <Seccion>
      <Encabezado rotulo="Para cada rubro" titulo="El panel se arma solo.">
        Elegís qué tipo de negocio tenés y Bookea enciende lo que usás. Nada de
        pantallas vacías.
      </Encabezado>

      {/* Los rubros: una fila de pastillas, no una grilla de tarjetas. */}
      <ul className="mx-auto mt-10 flex max-w-[880px] flex-wrap justify-center gap-2.5">
        {familias.map((familia) => (
          <li
            key={familia}
            className="rounded-full border border-[color:var(--linea)] bg-[color:var(--superficie)] px-4 py-2 text-[14px] font-semibold text-[color:var(--tinta)]"
          >
            {FAMILIA_LABEL[familia]}
            <span className="ml-1.5 text-[color:var(--tinta-suave)]">
              {tiposDe(familia).length}
            </span>
          </li>
        ))}
      </ul>

      <Escenario>
        <div className="grid gap-6 [&>*]:min-w-0 sm:grid-cols-2">
          <figure className="m-0">
            <figcaption className="mb-3 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--tinta-suave)]">
              Barbería
            </figcaption>
            <PanelDeTipo tipo="barberia" />
          </figure>
          <figure className="m-0">
            <figcaption className="mb-3 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--tinta-suave)]">
              Gimnasio
            </figcaption>
            <PanelDeTipo tipo="gimnasio" destacado />
          </figure>
        </div>
        <NotaDemo>
          Dos menús reales, armados por la misma función que arma tu panel. Lo
          que dice «Pronto» todavía no está construido.
        </NotaDemo>
      </Escenario>
    </Seccion>
  );
}
