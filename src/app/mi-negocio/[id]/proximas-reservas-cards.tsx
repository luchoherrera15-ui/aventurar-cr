import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import type { EventoAgenda } from "@/components/agenda-eventos";
import { CardVacia, ContextoFila, FilaPanel, PildoraEstado } from "@/components/panel/piezas";
import type { EstadoPanel } from "@/components/panel/sistema";

/**
 * LO QUE VIENE — el «Próximas citas» de la maqueta, con las cinco
 * reservas más cercanas.
 *
 * ERAN CINCO TARJETAS EN GRILLA Y AHORA SON CINCO FILAS. No es un
 * capricho: en la maqueta lo próximo es una LISTA (`.appointment`),
 * porque una lista se lee de arriba abajo en el orden en que van a
 * pasar las cosas, y una grilla de cinco cuadritos obliga a leer en
 * zigzag para reconstruir ese mismo orden. Además, a 390px las cinco
 * tarjetas quedaban de dos en dos con el nombre del cliente truncado a
 * la mitad; la fila le da el ancho completo al nombre y manda el estado
 * a un punto de color.
 *
 * Devuelve la LISTA PELADA, sin tarjeta: el `Card` con su encabezado y
 * el enlace «Ver agenda completa →» lo pone el tablero, que es quien
 * sabe si esa pantalla existe para este negocio.
 *
 * Componente de SERVIDOR: son datos y texto, no hay nada que tocar.
 */

const MOSTRAR = 5;

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En aprobación",
  confirmada: "Confirmada",
};

/**
 * El estado del sistema al que corresponde cada estado de reserva. Los
 * colores ya no viven acá: viven en `sistema.ts` con su contraste
 * medido, y esta tabla solo dice qué SIGNIFICA cada estado. Así, el día
 * que el verde de «confirmada» cambie, cambia en un solo renglón y en
 * las nueve pantallas a la vez.
 */
const ESTADO_PANEL: Record<string, EstadoPanel> = {
  pendiente: "aviso",
  confirmada: "exito",
};

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

function diaCorto(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", { day: "numeric" });
}

function mesCorto(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", { month: "short" });
}

export default function ProximasReservasCards({ eventos }: { eventos: EventoAgenda[] }) {
  const hoy = hoyISOCR();
  const manana = sumarDiasISO(hoy, 1);
  const proximas = eventos.slice(0, MOSTRAR);

  if (proximas.length === 0) {
    return <CardVacia>No hay reservas próximas en la agenda.</CardVacia>;
  }

  return (
    <div>
      {proximas.map((e, i) => {
        const esHoy = e.fecha === hoy;
        const esManana = e.fecha === manana;
        const monto = fmtColones(e.monto_total);
        const estado = ESTADO_PANEL[e.estado] ?? "neutro";
        const etiqueta = ESTADO_LABEL[e.estado] ?? e.estado;
        return (
          <FilaPanel
            key={e.id}
            separador={i < proximas.length - 1}
            marca={estado}
            /* La columna de contexto es la FECHA, que es el criterio por
               el que está ordenada la lista: «Hoy» y «Mañana» en
               palabras —que es como lo dice el dueño— y el resto en
               número + mes. */
            contexto={
              esHoy || esManana ? (
                <ContextoFila fuerte={esHoy ? "Hoy" : "Mañana"} />
              ) : (
                <ContextoFila fuerte={diaCorto(e.fecha)} suave={mesCorto(e.fecha)} />
              )
            }
            titulo={e.nombre ?? "Sin nombre"}
            detalle={monto}
            /* Por debajo de sm la píldora se vuelve un punto del color
               del estado y el texto queda en `sr-only`: el estado no
               desaparece para un lector de pantalla, solo deja de
               comerse el nombre del cliente en 390px. */
            derecha={
              <PildoraEstado estado={estado} colapsa>
                {etiqueta}
              </PildoraEstado>
            }
          />
        );
      })}
    </div>
  );
}
