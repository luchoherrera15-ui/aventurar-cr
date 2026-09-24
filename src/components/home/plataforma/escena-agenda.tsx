import { IconCalendarLine } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  DEL MENÚ DE LA BARBERÍA A LA AGENDA DEL BARBERO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (23 sep 2026): «un menú de las barberías, luego que
 * se convierte en una agenda del barbero, todo se va viendo en tiempo
 * real».
 *
 * Antes acá había cinco pasos numerados —servicio, con quién, día y
 * hora, datos, listo—. Describían el flujo pero no enseñaban nada: los
 * cinco renglones se veían iguales y ninguno mostraba el producto.
 *
 * Ahora son las dos puntas del mismo hecho, lado a lado:
 *
 *   IZQUIERDA   el menú de servicios, como lo ve el cliente
 *   DERECHA     la agenda del barbero, con la cita ya adentro
 *
 * Es el mismo armado que el héroe (menú → WhatsApp) y funciona por la
 * misma razón: una flecha entre dos pantallas cuenta el producto mejor
 * que una lista de pasos.
 *
 * ── LO QUE LA ESCENA SÍ DICE, Y ES VERDAD ───────────────────────────
 *
 * · La agenda tiene HUECOS LIBRES y BLOQUEOS (el almuerzo): el motor
 *   los maneja de verdad (`bloqueos_agenda`, `horarios_recurso`).
 * · La cita entra sola, sin aprobar a mano — la reserva es instantánea.
 * · Cada barbero tiene su propia columna y su propio horario.
 *
 * Los nombres y las horas son de muestra.
 */

/** El menú, tal como lo ve quien va a reservar. */
const SERVICIOS = [
  { nombre: "Corte clásico", duracion: "30 min", precio: "₡6.500", elegido: false },
  { nombre: "Corte y barba", duracion: "45 min", precio: "₡9.000", elegido: true },
  { nombre: "Perfilado de barba", duracion: "20 min", precio: "₡4.000", elegido: false },
  { nombre: "Corte + niño", duracion: "40 min", precio: "₡8.500", elegido: false },
];

type Bloque =
  | { hora: string; tipo: "cita"; quien: string; que: string; nueva?: boolean }
  | { hora: string; tipo: "libre" }
  | { hora: string; tipo: "bloqueo"; que: string };

/** El día del barbero. */
const AGENDA: Bloque[] = [
  { hora: "9:00", tipo: "cita", quien: "Juan Vargas", que: "Corte clásico" },
  { hora: "10:00", tipo: "libre" },
  { hora: "10:30", tipo: "cita", quien: "María Jiménez", que: "Corte y barba", nueva: true },
  { hora: "12:00", tipo: "bloqueo", que: "Almuerzo" },
  { hora: "14:00", tipo: "cita", quien: "Carlos Mora", que: "Perfilado de barba" },
];

export default function EscenaAgenda() {
  return (
    <div
      // Demostración, no interfaz: nada navega y un lector de pantalla
      // no tiene por qué recorrerla como si fueran controles.
      aria-hidden
      className="grid select-none gap-4 text-left sm:grid-cols-2 sm:items-start"
    >
      {/* ── IZQUIERDA: EL MENÚ DE LA BARBERÍA ──────────────────── */}
      <div className="overflow-hidden rounded-[18px] border border-[color:var(--linea)] bg-white shadow-[0_24px_60px_-34px_rgba(20,22,26,0.28)]">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--linea)] px-5 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[color:var(--tinta)] text-[13px] font-extrabold text-white">
            S
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-extrabold text-[color:var(--tinta)]">
              Silence Barber
            </span>
            <span className="block truncate text-[11px] text-[color:var(--tinta-suave)]">
              bookea.lat/s/silence-barber
            </span>
          </span>
        </div>

        <p className="px-5 pt-4 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--tinta-suave)]">
          Servicios
        </p>

        <ul className="px-3 pb-3 pt-1.5">
          {SERVICIOS.map((s) => (
            <li
              key={s.nombre}
              className={`flex items-center gap-3 rounded-[10px] px-2.5 py-2.5 ${
                s.elegido ? "bg-[color:var(--acento-suave)]" : ""
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                  s.elegido
                    ? "bg-[color:var(--acento)] text-white"
                    : "border border-[color:var(--linea)] text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-[13.5px] ${
                      s.elegido
                        ? "font-extrabold text-[color:var(--tinta)]"
                        : "text-[color:var(--tinta-suave)]"
                    }`}
                  >
                    {s.nombre}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold text-[color:var(--tinta-suave)]">
                    {s.precio}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[color:var(--tinta-suave)]">
                  {s.duracion}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {/* La hora elegida, que es lo que ata las dos pantallas. */}
        <div className="border-t border-[color:var(--linea)] bg-[color:var(--superficie)] px-5 py-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--tinta-suave)]">
            Hoy
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["9:30", "10:30", "11:15", "14:00"].map((h) => (
              <span
                key={h}
                className={`rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-bold ${
                  h === "10:30"
                    ? "bg-[color:var(--acento)] text-white"
                    : "bg-white text-[color:var(--tinta-suave)]"
                }`}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── DERECHA: LA AGENDA DEL BARBERO ─────────────────────── */}
      <div className="overflow-hidden rounded-[18px] border border-[color:var(--linea)] bg-white shadow-[0_24px_60px_-34px_rgba(20,22,26,0.28)]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--linea)] px-5 py-3.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[color:var(--superficie)] text-[color:var(--tinta)]">
              <IconCalendarLine className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-extrabold text-[color:var(--tinta)]">
                Agenda de Diego
              </span>
              <span className="block text-[11px] text-[color:var(--tinta-suave)]">
                Hoy · 3 citas
              </span>
            </span>
          </span>
          {/* «En tiempo real»: el punto que late. Se queda quieto con
              `prefers-reduced-motion` porque `animate-pulse` de
              Tailwind ya lo respeta. */}
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--ok-suave)] px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--ok)]" />
            <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-[color:var(--ok)]">
              En vivo
            </span>
          </span>
        </div>

        <ul className="divide-y divide-[color:var(--linea)]">
          {AGENDA.map((b) => (
            <li
              key={b.hora}
              className={`flex items-center gap-3 px-5 py-3 ${
                b.tipo === "cita" && b.nueva ? "bg-[color:var(--acento-suave)]" : ""
              }`}
            >
              <span className="w-[46px] shrink-0 text-[12px] font-semibold text-[color:var(--tinta-suave)]">
                {b.hora}
              </span>

              {b.tipo === "libre" ? (
                <span className="flex-1 rounded-[8px] border border-dashed border-[color:var(--linea)] px-3 py-2 text-[12.5px] text-[color:var(--tinta-suave)]">
                  Libre
                </span>
              ) : b.tipo === "bloqueo" ? (
                <span className="flex-1 rounded-[8px] bg-[color:var(--superficie)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--tinta-suave)]">
                  {b.que}
                </span>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={`h-8 w-1 shrink-0 rounded-full ${
                      b.nueva
                        ? "bg-[color:var(--acento)]"
                        : "bg-[color:var(--linea)]"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-extrabold text-[color:var(--tinta)]">
                      {b.quien}
                    </span>
                    <span className="block truncate text-[11.5px] text-[color:var(--tinta-suave)]">
                      {b.que}
                    </span>
                  </span>
                  {b.nueva ? (
                    <span className="shrink-0 rounded-full bg-[color:var(--acento)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      Nueva
                    </span>
                  ) : null}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
