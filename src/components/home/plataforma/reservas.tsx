import EscenaAgenda from "./escena-agenda";
import { Encabezado, ListaIncluye, NotaDemo, Seccion } from "./piezas";

/**
 * RESERVAS — el menú de la barbería y la agenda del barbero.
 *
 * La escena vive en `escena-agenda.tsx`: a la izquierda lo que elige
 * el cliente, a la derecha la cita ya metida en el día del barbero.
 *
 * ── LO QUE ESTA SECCIÓN NO DICE ─────────────────────────────────────
 *
 * · «Buscá disponibilidad en todos los negocios» — no existe consulta
 *   de disponibilidad transversal al directorio. Es la misma promesa
 *   que el proyecto ya se sacó del buscador y de `como-funciona.tsx`.
 * · «Reservá tu mesa» — las mesas no son un recurso reservable.
 */

/** Lo que viene incluido y no se ve en la escena. */
const INCLUYE = [
  "Horarios y descansos por persona",
  "Bloqueos y días libres",
  "Lista de espera",
  "Recordatorios automáticos",
  "Importar y exportar tu calendario",
  "Reserva instantánea, sin aprobar a mano",
] as const;

export default function Reservas() {
  return (
    <Seccion id="reservas">
      <Encabezado rotulo="Reservas" titulo="Tus clientes reservan solos.">
        Eligen servicio y hora en tu página. La cita aparece en tu agenda al
        instante, sin que la apruebes.
      </Encabezado>

      {/* Todo esto existe: agenda por persona, bloqueos, lista de
          espera, recordatorios e importación/exportación de calendario
          en las dos direcciones (migraciones 0071 y 0072). */}
      <ListaIncluye items={INCLUYE} />

      <div className="mx-auto mt-12 w-full max-w-[880px] sm:mt-14">
        <EscenaAgenda />
        <NotaDemo>
          Ejemplo de una barbería. Los servicios, las duraciones y los precios
          los ponés vos.
        </NotaDemo>
      </div>
    </Seccion>
  );
}
