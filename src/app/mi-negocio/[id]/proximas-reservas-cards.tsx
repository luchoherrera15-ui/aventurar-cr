"use client";

import { useState } from "react";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import type { EventoAgenda } from "@/components/agenda-eventos";
import { CardVacia, ContextoFila, FilaPanel, PildoraEstado } from "@/components/panel/piezas";
import type { EstadoPanel } from "@/components/panel/sistema";
import { IconChevronDown } from "@/components/icons";

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
 * CLICKEABLE (0163): cada fila se abre en el lugar — mismo patrón de
 * `historico-reservas.tsx` (fila-botón + `IconChevronDown` que rota +
 * detalle que se despliega con la utilidad `desplegable`, sin animar
 * `height`). No hay pantalla ni modal aparte: `EventoAgenda` ya trae
 * todo lo que hace falta mostrar (fecha, hora, tipo, invitados, monto,
 * estado) sin pedirle nada nuevo al servidor. Por eso pasó a ser
 * componente de CLIENTE — antes era de servidor porque no había nada
 * que tocar.
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

function fechaLarga(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function ProximasReservasCards({ eventos }: { eventos: EventoAgenda[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
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
        const abiertaAca = abierta === e.id;
        const hora = e.hora_inicio ?? e.horario_bloque ?? null;

        return (
          <div key={e.id} className={i < proximas.length - 1 ? "border-b border-aventurea-line" : ""}>
            <button
              type="button"
              onClick={() => setAbierta(abiertaAca ? null : e.id)}
              aria-expanded={abiertaAca}
              className="w-full text-left transition-colors hover:bg-aventurea-cream-2/60"
            >
              <FilaPanel
                separador={false}
                marca={estado}
                contexto={
                  esHoy || esManana ? (
                    <ContextoFila fuerte={esHoy ? "Hoy" : "Mañana"} />
                  ) : (
                    <ContextoFila fuerte={diaCorto(e.fecha)} suave={mesCorto(e.fecha)} />
                  )
                }
                titulo={e.nombre ?? "Sin nombre"}
                detalle={monto}
                derecha={
                  <span className="flex items-center gap-2">
                    <PildoraEstado estado={estado} colapsa>
                      {etiqueta}
                    </PildoraEstado>
                    <IconChevronDown
                      aria-hidden
                      className={`h-4 w-4 shrink-0 text-aventurea-ink-soft transition-transform ${
                        abiertaAca ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                }
              />
            </button>

            {/* `desplegable`: expandir/contraer sin animar `height` — el
                navegador interpola el grid-template-rows solo. */}
            <div className="desplegable" data-abierto={abiertaAca}>
              <div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-aventurea-cream-2 px-4 py-3.5 text-[12.5px] sm:grid-cols-3">
                  <div>
                    <dt className="font-bold uppercase tracking-wide text-[10.5px] text-aventurea-ink-soft">
                      Fecha
                    </dt>
                    <dd className="mt-0.5 capitalize text-aventurea-ink">{fechaLarga(e.fecha)}</dd>
                  </div>
                  {hora && (
                    <div>
                      <dt className="font-bold uppercase tracking-wide text-[10.5px] text-aventurea-ink-soft">
                        Hora
                      </dt>
                      <dd className="mt-0.5 text-aventurea-ink">{hora}</dd>
                    </div>
                  )}
                  {e.tipo_evento && (
                    <div>
                      <dt className="font-bold uppercase tracking-wide text-[10.5px] text-aventurea-ink-soft">
                        Tipo
                      </dt>
                      <dd className="mt-0.5 text-aventurea-ink">{e.tipo_evento}</dd>
                    </div>
                  )}
                  {e.invitados !== null && (
                    <div>
                      <dt className="font-bold uppercase tracking-wide text-[10.5px] text-aventurea-ink-soft">
                        Invitados
                      </dt>
                      <dd className="mt-0.5 text-aventurea-ink">{e.invitados}</dd>
                    </div>
                  )}
                  {monto && (
                    <div>
                      <dt className="font-bold uppercase tracking-wide text-[10.5px] text-aventurea-ink-soft">
                        Monto
                      </dt>
                      <dd className="mt-0.5 font-bold text-aventurea-ink">{monto}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
