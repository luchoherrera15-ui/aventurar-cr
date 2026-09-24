import { Encabezado, Escenario, Marco, NotaDemo, Seccion } from "./piezas";

/**
 * CLIENTES — la ficha grande, y el argumento en una línea.
 *
 * «Sin que nadie tenga que crear cuenta» es lo que en el repo se llama
 * `personas` (migración 0138): la llave de una persona son sus
 * contactos reales, no un usuario y una contraseña. Por eso la ficha
 * se llena sola en vez de depender de que el cliente se registre.
 */

const HISTORIAL = [
  { fecha: "12 set", que: "Corte + barba", monto: "₡9.000" },
  { fecha: "24 ago", que: "Corte", monto: "₡6.500" },
  { fecha: "2 ago", que: "Corte + barba", monto: "₡9.000" },
];

export default function Clientes() {
  return (
    <Seccion id="clientes">
      <Encabezado rotulo="Clientes" titulo="Cada reserva, un cliente que vuelve.">
        La ficha se llena sola con cada visita. Sin que nadie tenga que crear
        una cuenta.
      </Encabezado>

      <Escenario ancho="medio">
        <Marco>
          <div className="flex items-center gap-4 border-b border-[color:var(--linea)] px-6 py-5 text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--tinta)] text-[16px] font-extrabold text-white">
              MJ
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-extrabold text-[color:var(--tinta)]">
                María Jiménez
              </span>
              <span className="block text-[13px] text-[color:var(--tinta-suave)]">
                Cliente desde marzo
              </span>
            </span>
          </div>

          {/* La franja de números va en azul: es el dato que el dueño
              mira primero y el color lo separa del historial de abajo. */}
          <dl className="grid grid-cols-3 divide-x divide-white/25 border-b border-[color:var(--linea)] bg-[color:var(--acento)]">
            {[
              ["Visitas", "8"],
              ["Gastado", "₡64.500"],
              ["Última", "hace 10 d"],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="px-4 py-4 text-center">
                <dt className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-white/75">
                  {rotulo}
                </dt>
                <dd className="titulo mt-1 text-[20px] text-white">{valor}</dd>
              </div>
            ))}
          </dl>

          <ul className="divide-y divide-[color:var(--linea)] text-left">
            {HISTORIAL.map((h) => (
              <li
                key={h.fecha}
                className="flex items-baseline justify-between gap-3 px-6 py-3.5"
              >
                <span className="w-[68px] shrink-0 text-[14px] text-[color:var(--tinta-suave)]">
                  {h.fecha}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-[color:var(--tinta)]">
                  {h.que}
                </span>
                <span className="shrink-0 text-[14px] text-[color:var(--tinta-suave)]">
                  {h.monto}
                </span>
              </li>
            ))}
          </ul>
        </Marco>
        <NotaDemo>Ficha de muestra.</NotaDemo>
      </Escenario>
    </Seccion>
  );
}
