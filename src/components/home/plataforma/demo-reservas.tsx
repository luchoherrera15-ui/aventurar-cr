"use client";

import { Escenas } from "./piezas";
import { useSecuencia } from "./use-secuencia";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA RESERVA, EN DOS ESCENAS QUE SE REEMPLAZAN
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «primero que salga lo de cuando
 * alguien está agendando la cita, luego que desaparezca y aparezca la
 * parte del barbero — que los cuadros se reemplacen».
 *
 * Antes las dos mitades se apilaban y la tarjeta quedaba larguísima.
 * Ahora ocupan el MISMO espacio y se cruzan:
 *
 *   ESCENA 1   el cliente: servicio → barbero → hora → reservado
 *   ESCENA 2   la agenda de Diego, con la cita ya adentro
 *
 * Se encadena sola y vuelve a empezar (`use-secuencia.ts`).
 *
 * ── QUÉ ES VERDAD ──────────────────────────────────────────────────
 *
 * El motor de agenda existe: servicios con duración y precio, equipo
 * con su horario, huecos calculados contra lo ocupado y los bloqueos,
 * y reserva INSTANTÁNEA —entra sin que el dueño la apruebe—. Eso
 * último es una regla del proyecto, no un detalle de esta animación.
 *
 * Los nombres y las horas son de muestra.
 */

const SERVICIOS = [
  { nombre: "Corte clásico", detalle: "30 min · ₡6.500" },
  { nombre: "Corte y barba", detalle: "45 min · ₡9.000" },
  { nombre: "Perfilado de barba", detalle: "20 min · ₡4.000" },
];

const BARBEROS = [
  { nombre: "Diego", detalle: "Libre a las 3:00" },
  { nombre: "Kevin", detalle: "Libre a las 5:30" },
];

const HORAS = ["2:15", "3:00", "4:30"];

/** Seis momentos. El primero es el hueco en blanco al rebobinar. */
const ESPERAS = [400, 1300, 1300, 1300, 1600, 2800];

/** El alto del escenario. Fijo, para que la tarjeta no salte. */
const ALTO = 268;

/** La cabecera de cada escena. */
function Cabecera({
  inicial,
  titulo,
  bajada,
  corriendo,
}: {
  inicial: string;
  titulo: string;
  bajada: string;
  corriendo: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--linea)] px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[color:var(--tinta)] text-[12px] font-extrabold text-white">
          {inicial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-extrabold text-[color:var(--tinta)]">
            {titulo}
          </span>
          <span className="block truncate text-[10px] text-[color:var(--tinta-suave)]">
            {bajada}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--ok-suave)] px-2 py-0.5">
        <span
          className={`h-1.5 w-1.5 rounded-full bg-[color:var(--ok)] ${
            corriendo ? "animate-pulse" : ""
          }`}
        />
        <span className="text-[9px] font-extrabold uppercase tracking-wide text-[color:var(--ok)]">
          Automático
        </span>
      </span>
    </div>
  );
}

export default function DemoReservas() {
  const { caja, visibles, corriendo } = useSecuencia({
    pasos: 6,
    esperas: ESPERAS,
  });

  const servicio = visibles >= 1;
  const barbero = visibles >= 2;
  const hora = visibles >= 3;
  const listo = visibles >= 4;
  // Desde el paso 5 manda la agenda: la escena del cliente se va.
  const escena = visibles >= 5 ? 1 : 0;

  const clienteReserva = (
    <div className="h-full overflow-hidden rounded-[18px] border border-[color:var(--linea)] bg-white">
      <Cabecera
        inicial="S"
        titulo="Silence Barber"
        bajada="bookea.lat/s/silence-barber"
        corriendo={corriendo}
      />

      <div className="space-y-2.5 px-4 py-3">
        <ul className="space-y-1">
          {SERVICIOS.map((s, i) => {
            const elegido = servicio && i === 1;
            const apagado = servicio && i !== 1;
            return (
              <li
                key={s.nombre}
                className={`flex items-center gap-2 rounded-[9px] px-2.5 py-1.5 transition-all duration-300 ${
                  elegido
                    ? "bg-[color:var(--acento-suave)] ring-1 ring-[color:var(--acento)]"
                    : apagado
                      ? "opacity-30"
                      : "bg-[color:var(--superficie)]"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white ${
                    elegido ? "bg-[color:var(--acento)]" : "bg-[color:var(--linea)]"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold text-[color:var(--tinta)]">
                  {s.nombre}
                </span>
                <span className="shrink-0 text-[10px] text-[color:var(--tinta-suave)]">
                  {s.detalle}
                </span>
              </li>
            );
          })}
        </ul>

        {barbero ? (
          <div className="anim-entra flex gap-1.5">
            {BARBEROS.map((b, i) => (
              <span
                key={b.nombre}
                className={`flex flex-1 items-center gap-1.5 rounded-[9px] px-2 py-1.5 ${
                  i === 0
                    ? "bg-[color:var(--acento-suave)] ring-1 ring-[color:var(--acento)]"
                    : "bg-[color:var(--superficie)] opacity-40"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--tinta)] text-[9px] font-extrabold text-white">
                  {b.nombre.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] font-extrabold text-[color:var(--tinta)]">
                    {b.nombre}
                  </span>
                  <span className="block truncate text-[9px] text-[color:var(--tinta-suave)]">
                    {b.detalle}
                  </span>
                </span>
              </span>
            ))}
          </div>
        ) : null}

        {hora ? (
          <div className="anim-entra flex gap-1.5">
            {HORAS.map((h, i) => (
              <span
                key={h}
                className={`rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold ${
                  i === 1
                    ? "bg-[color:var(--acento)] text-white"
                    : "bg-[color:var(--superficie)] text-[color:var(--tinta-suave)] opacity-50"
                }`}
              >
                {h}
              </span>
            ))}
          </div>
        ) : null}

        {listo ? (
          <div className="anim-entra flex items-center gap-2 rounded-[9px] bg-[color:var(--ok-suave)] px-2.5 py-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok)] text-[10px] font-extrabold text-white">
              ✓
            </span>
            <span className="text-[11px] font-extrabold text-[color:var(--tinta)]">
              Reservado · sin esperar aprobación
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const agendaBarbero = (
    <div className="h-full overflow-hidden rounded-[18px] border border-[color:var(--linea)] bg-white">
      <Cabecera
        inicial="D"
        titulo="Agenda de Diego"
        bajada="Hoy · 3 citas"
        corriendo={corriendo}
      />

      <ul className="divide-y divide-[color:var(--linea)]">
        {[
          { hora: "1:30", quien: "Juan Vargas", que: "Corte clásico", nueva: false },
          { hora: "3:00", quien: "María Jiménez", que: "Corte y barba · 45 min", nueva: true },
          { hora: "5:00", quien: "Carlos Mora", que: "Perfilado de barba", nueva: false },
        ].map((c) => (
          <li
            key={c.hora}
            className={`flex items-center gap-2.5 px-4 py-2.5 ${
              c.nueva ? "bg-[color:var(--acento-suave)]" : ""
            }`}
          >
            <span className="w-[38px] shrink-0 text-[10.5px] font-semibold text-[color:var(--tinta-suave)]">
              {c.hora}
            </span>
            <span
              className={`h-7 w-1 shrink-0 rounded-full ${
                c.nueva ? "bg-[color:var(--acento)]" : "bg-[color:var(--linea)]"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-extrabold text-[color:var(--tinta)]">
                {c.quien}
              </span>
              <span className="block truncate text-[10px] text-[color:var(--tinta-suave)]">
                {c.que}
              </span>
            </span>
            {c.nueva ? (
              <span className="anim-entra shrink-0 rounded-full bg-[color:var(--acento)] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                Nueva
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div ref={caja}>
      <Escenas alto={ALTO} activa={escena} escenas={[clienteReserva, agendaBarbero]} />
      {/* El rótulo dice en qué mitad estamos: sin él, el cambio de
          escena se lee como que la tarjeta se rompió. */}
      <p className="mt-2.5 text-center text-[11px] text-[color:var(--tinta-suave)]">
        {escena === 0
          ? "Tu cliente reserva desde tu página"
          : "↓ y entra a tu agenda, al instante"}
      </p>
    </div>
  );
}
