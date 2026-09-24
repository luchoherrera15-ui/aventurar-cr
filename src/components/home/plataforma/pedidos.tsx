import { Encabezado, Escenario, Marco, NotaDemo, Seccion } from "./piezas";

/**
 * PEDIDOS — con el límite adentro de la frase, no en un recuadro.
 *
 * «Te llegan por WhatsApp, armados y listos para preparar» dice a la
 * vez lo que el producto hace y hasta dónde llega. No hay checkout, no
 * hay cobro en línea, no hay inventario ni delivery — y por eso la
 * sección no usa nunca la palabra «ventas» ni la palabra «tienda».
 *
 * El precio de los extras lo calcula el servidor, no el navegador.
 */

const RENGLONES = [
  {
    plato: "Casado con pollo",
    extras: ["Sin ensalada", "Doble plátano (+₡700)"],
    precio: "₡4.900",
  },
  { plato: "Refresco de cas", extras: ["Sin hielo"], precio: "₡1.200" },
];

export default function Pedidos() {
  return (
    <Seccion fondo="gris" id="pedidos">
      <Encabezado rotulo="Pedidos" titulo="Recibí pedidos desde tu página.">
        Te llegan por WhatsApp, armados y listos para preparar, con los extras
        que eligió cada persona.
      </Encabezado>

      <Escenario ancho="medio">
        <Marco>
          {/* Los estados del pedido, en color y con significado: azul
              para lo que acaba de entrar, verde para lo que ya está
              resuelto. Es el color que el dueño va a ver en su panel. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--linea)] bg-white px-6 py-4 text-left">
            <div>
              <p className="text-[15px] font-extrabold text-[color:var(--tinta)]">
                Pedido #1207 · Mesa 4
              </p>
              <p className="text-[12.5px] text-[color:var(--tinta-suave)]">
                Hace 2 minutos
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <span className="rounded-full bg-[color:var(--acento-suave)] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[color:var(--acento)]">
                Nuevo
              </span>
              <span className="rounded-full bg-[color:var(--ok-suave)] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[color:var(--ok)]">
                Para el local
              </span>
            </div>
          </div>
          <ul className="divide-y divide-[color:var(--linea)] text-left">
            {RENGLONES.map((r) => (
              <li key={r.plato} className="px-6 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-extrabold text-[color:var(--tinta)]">
                    1 × {r.plato}
                  </span>
                  <span className="shrink-0 text-[15px] font-bold text-[color:var(--tinta)]">
                    {r.precio}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {r.extras.map((extra) => (
                    <li key={extra} className="text-[13.5px] text-[color:var(--tinta-suave)]">
                      · {extra}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between gap-3 bg-[color:var(--superficie)] px-6 py-4">
            <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--tinta-suave)]">
              Total
            </span>
            <span className="titulo text-[22px] text-[color:var(--tinta)]">₡6.100</span>
          </div>
        </Marco>
        <NotaDemo>
          Pedido de muestra. El cobro lo arreglás como siempre: Bookea no cobra
          en línea.
        </NotaDemo>
      </Escenario>
    </Seccion>
  );
}
