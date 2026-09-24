import { Encabezado, Escenario, Marco, NotaDemo, Seccion } from "./piezas";

/**
 * MÉTRICAS — los números del NEGOCIO, no los de Bookea.
 *
 * Nada de «+12.000 reservas procesadas»: no hay de dónde sacarlo y
 * sería prueba social inventada. Lo que se enseña son datos de un
 * negocio de muestra, y la nota al pie lo dice.
 */

const TARJETAS = [
  { rotulo: "Reservas del mes", valor: "126", destacada: false },
  { rotulo: "Ingresos", valor: "₡842.000", destacada: true },
  { rotulo: "Ticket promedio", valor: "₡6.680", destacada: false },
  { rotulo: "Vuelven", valor: "58 %", destacada: false },
];

/** Las horas pico, como barras. Alturas relativas, no porcentajes. */
const HORAS = [28, 44, 62, 40, 70, 88, 100, 76, 52];
const ETIQUETAS = ["9", "10", "11", "12", "14", "15", "16", "17", "18"];

export default function Metricas() {
  return (
    <Seccion fondo="gris" id="metricas">
      <Encabezado rotulo="Métricas" titulo="Sabé cómo va tu negocio.">
        Ingresos, horas pico y qué se pide más. Todo exportable a CSV.
      </Encabezado>

      <Escenario>
        <Marco className="p-6 sm:p-8">
          {/* Cuatro tarjetas y UNA en azul: la que el dueño busca
              primero. Pintar las cuatro sería un bloque de color;
              pintar una es una jerarquía. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TARJETAS.map((t) => (
              <div
                key={t.rotulo}
                className={`rounded-[12px] px-4 py-3.5 text-left ${
                  t.destacada
                    ? "bg-[color:var(--acento)]"
                    : "bg-white"
                }`}
              >
                <p
                  className={`text-[11px] font-extrabold uppercase tracking-[0.1em] ${
                    t.destacada ? "text-white/75" : "text-[color:var(--tinta-suave)]"
                  }`}
                >
                  {t.rotulo}
                </p>
                <p
                  className={`titulo mt-1.5 text-[clamp(22px,3vw,30px)] leading-none ${
                    t.destacada ? "text-white" : "text-[color:var(--tinta)]"
                  }`}
                >
                  {t.valor}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-9 border-t border-[color:var(--linea)] pt-7">
            <p className="text-left text-[13px] font-extrabold text-[color:var(--tinta)]">
              A qué hora se te llena
            </p>
            {/* ⚠️ El alto va en PÍXELES, no en `%`. La columna de cada
                barra es `flex-col` y su alto lo decide el contenido, así
                que un `height: 62%` no tiene contra qué resolverse y la
                barra mide 0. Pasó exactamente eso la primera vez. */}
            <div className="mt-5 flex items-end justify-between gap-2">
              {HORAS.map((alto, i) => (
                <div key={ETIQUETAS[i]} className="flex flex-1 flex-col items-center gap-2">
                  {/* Las barras van en AZUL, no en tinta: un gráfico
                      es exactamente el lugar donde el color tiene que
                      estar. La hora pico se destaca sola con la
                      opacidad, que sigue al valor. */}
                  <div
                    className="w-full rounded-t-[5px] bg-[color:var(--acento)]"
                    style={{ height: `${Math.round(alto * 1.4)}px`, opacity: 0.3 + alto / 160 }}
                  />
                  <span className="text-[11px] text-[color:var(--tinta-suave)]">
                    {ETIQUETAS[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Marco>
        <NotaDemo>Datos de un negocio de muestra.</NotaDemo>
      </Escenario>
    </Seccion>
  );
}
