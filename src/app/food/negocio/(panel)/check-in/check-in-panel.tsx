"use client";

import { useMemo, useState, useTransition } from "react";
import { horaCorta, type FoodReservationEstado } from "@/lib/food/tipos";
import { InsigniaEstado, TarjetaPanel } from "@/components/food/panel";
import { useToastFood } from "@/components/food/panel/toast";
import { hacerCheckInPorCodigo, hacerCheckInPorId, marcarNoShow } from "../panel-actions";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  CHECK-IN — la operación real de hoy (mostrador + lista)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Evolución del panel que solo tenía el input de código: ahora son
 * dos superficies sobre las MISMAS actions de siempre (panel-actions,
 * sin tocar):
 *
 * — EL MOSTRADOR: el código de 6 caracteres que trae el cliente.
 *   Primero en el DOM a propósito — en el teléfono (el aparato que
 *   está en el mostrador) es lo que tiene que aparecer arriba; en
 *   escritorio se va a la columna derecha con lg:order.
 * — LA LISTA DE HOY: cada reserva confirmada con su botón grande de
 *   "Registrar check-in" y el secundario "No llegó". Las resueltas
 *   (check-in hecho, no se presentó, cancelada) quedan visibles más
 *   abajo con su insignia — el repaso del servicio de un vistazo.
 *
 * ACTUALIZACIÓN EN PANTALLA: cada acción exitosa se refleja al
 * instante con un overlay optimista por id (`sobreescritos`) y las
 * actions además revalidan la ruta, así que los props del servidor
 * llegan detrás confirmando lo mismo. El check-in por CÓDIGO no
 * conoce el id de la reserva (la action devuelve solo partySize), así
 * que ese camino depende solo de la revalidación — por eso el overlay
 * no intenta adivinarlo. Todos los números de esta pantalla son
 * REALES: acá no entra utilería.
 */

export type ReservaHoy = {
  id: string;
  /** "HH:MM:SS" tal como la guarda food_franjas.hora. */
  hora: string;
  partySize: number;
  codigo: string;
  estado: FoodReservationEstado;
};

export default function CheckInPanel({
  negocioId,
  reservas,
}: {
  negocioId: string;
  reservas: ReservaHoy[];
}) {
  const { avisar, toast } = useToastFood();
  const [pendiente, iniciar] = useTransition();
  /** Qué fila está procesándose — para el spinner de ESA, no de todas. */
  const [enProceso, setEnProceso] = useState<string | null>(null);
  /** Overlay optimista: estado nuevo por id, encima de los props. */
  const [sobreescritos, setSobreescritos] = useState<Record<string, FoodReservationEstado>>({});

  const filas = useMemo(
    () =>
      reservas.map((r) => {
        const nuevo = sobreescritos[r.id];
        return nuevo ? { ...r, estado: nuevo } : r;
      }),
    [reservas, sobreescritos],
  );

  const porLlegar = filas.filter((f) => f.estado === "confirmada");
  const resueltas = filas.filter((f) => f.estado !== "confirmada");
  const conCheckIn = filas.filter((f) => f.estado === "check_in");
  const personasHoy = filas.reduce((a, f) => a + f.partySize, 0);

  function marcar(reserva: ReservaHoy, accion: "check_in" | "no_show") {
    setEnProceso(reserva.id);
    iniciar(async () => {
      const r =
        accion === "check_in"
          ? await hacerCheckInPorId(negocioId, reserva.id)
          : await marcarNoShow(negocioId, reserva.id);
      setEnProceso(null);
      if (!r.ok) {
        avisar("error", r.error);
        return;
      }
      setSobreescritos((prev) => ({ ...prev, [reserva.id]: accion }));
      avisar(
        "exito",
        accion === "check_in"
          ? `Check-in registrado · ${reserva.partySize} ${reserva.partySize === 1 ? "persona" : "personas"}`
          : "Reserva marcada como no presentada.",
      );
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
      {/* ── El mostrador (primero en el DOM = arriba en móvil) ─────── */}
      <TarjetaPanel kicker="Mostrador" titulo="Check-in por código" className="lg:order-2">
        <Mostrador negocioId={negocioId} />
      </TarjetaPanel>

      {/* ── La lista de hoy (real) ─────────────────────────────────── */}
      <TarjetaPanel
        kicker="Hoy"
        titulo="Reservas de hoy"
        className="lg:order-1"
        accion={
          filas.length > 0 ? (
            <span className="text-[12px] font-bold text-aventurea-ink-soft">
              {conCheckIn.length}/{filas.length} con check-in
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <MiniStatHoy valor={filas.length} rotulo="Reservas" />
          <MiniStatHoy valor={personasHoy} rotulo="Personas" />
          <MiniStatHoy valor={conCheckIn.length} rotulo="Con check-in" acento />
        </div>

        {filas.length === 0 ? (
          <p className="mt-3 rounded-xl bg-aventurea-cream-2 px-6 py-8 text-center text-[13px] text-aventurea-ink-soft">
            No hay reservas para hoy. Cuando alguien reserve por Bookea, aparece acá al
            instante.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {porLlegar.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
                  Por llegar ({porLlegar.length})
                </p>
                <ul className="flex flex-col gap-2">
                  {porLlegar.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-aventurea-line bg-white p-3.5 transition-shadow hover:shadow-[var(--shadow-plano)]"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-extrabold leading-tight text-aventurea-navy">
                          {horaCorta(f.hora)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
                          {f.partySize} {f.partySize === 1 ? "persona" : "personas"} · código{" "}
                          <span className="font-mono font-bold text-aventurea-ink">{f.codigo}</span>
                        </p>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        {/* EL botón de la pantalla: grande, uno por
                            fila, imposible de errar con el servicio
                            encima. */}
                        <button
                          type="button"
                          disabled={pendiente}
                          onClick={() => marcar(f, "check_in")}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-aventurea-navy px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
                        >
                          {enProceso === f.id ? "Registrando…" : "Registrar check-in"}
                        </button>
                        <button
                          type="button"
                          disabled={pendiente}
                          onClick={() => marcar(f, "no_show")}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-aventurea-line px-3.5 text-[12.5px] font-bold text-aventurea-ink-soft transition-colors hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                        >
                          No llegó
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resueltas.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
                  Resueltas ({resueltas.length})
                </p>
                <ul className="flex flex-col gap-1.5">
                  {resueltas.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-aventurea-cream-2 px-3.5 py-2.5"
                    >
                      <p className="text-[13px] font-bold text-aventurea-ink">
                        {horaCorta(f.hora)}
                      </p>
                      <p className="text-[12px] text-aventurea-ink-soft">
                        {f.partySize} {f.partySize === 1 ? "persona" : "personas"} ·{" "}
                        <span className="font-mono">{f.codigo}</span>
                      </p>
                      <span className="ml-auto">
                        <InsigniaEstado estado={f.estado} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </TarjetaPanel>

      {toast}
    </div>
  );
}

function MiniStatHoy({
  valor,
  rotulo,
  acento = false,
}: {
  valor: number;
  rotulo: string;
  acento?: boolean;
}) {
  return (
    <div className="rounded-xl bg-aventurea-cream-2 p-3 text-center">
      <p
        className={`text-[22px] font-extrabold leading-none ${
          acento ? "text-aventurea-orange-dark" : "text-aventurea-ink"
        }`}
      >
        {valor.toLocaleString("es-CR")}
      </p>
      <p className="mt-1 text-[11px] font-bold text-aventurea-ink-soft">{rotulo}</p>
    </div>
  );
}

/**
 * El check-in por código de confirmación — la esencia del panel
 * anterior, con la misma action (hacerCheckInPorCodigo). El resultado
 * se muestra EN GRANDE en la propia tarjeta y no solo en un toast: en
 * un mostrador con ruido, el "✓ 4 personas" tiene que poder leerse a
 * un metro de distancia. La lista de al lado se actualiza sola por la
 * revalidación que hace la action (por código no conocemos el id de
 * la reserva, así que no hay overlay optimista que aplicarle).
 */
function Mostrador({ negocioId }: { negocioId: string }) {
  const [codigo, setCodigo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<
    { tipo: "ok"; partySize: number } | { tipo: "error"; mensaje: string } | null
  >(null);

  function confirmar() {
    if (pendiente || codigo.trim().length < 4) return;
    setResultado(null);
    iniciar(async () => {
      const r = await hacerCheckInPorCodigo(negocioId, codigo);
      if (!r.ok) {
        setResultado({ tipo: "error", mensaje: r.error });
        return;
      }
      setResultado({ tipo: "ok", partySize: r.partySize });
      setCodigo("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
        Pedile al cliente el código de 6 caracteres de su reserva y escribilo acá.
      </p>
      <label htmlFor="codigo-checkin" className="sr-only">
        Código de confirmación de 6 caracteres
      </label>
      <input
        id="codigo-checkin"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && confirmar()}
        maxLength={6}
        placeholder="A1B2C3"
        autoComplete="off"
        className="w-full rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-3.5 text-center font-mono text-[26px] font-extrabold uppercase tracking-[0.24em] text-aventurea-navy outline-none transition-colors focus:border-aventurea-navy focus:bg-white"
      />
      <button
        type="button"
        disabled={pendiente || codigo.trim().length < 4}
        onClick={confirmar}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-aventurea-navy px-5 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
      >
        {pendiente ? "Verificando…" : "Confirmar check-in"}
      </button>

      {resultado?.tipo === "ok" && (
        <p
          role="status"
          className="rounded-xl bg-aventurea-green-light px-4 py-3.5 text-center text-[15px] font-extrabold text-aventurea-green"
        >
          ✓ Check-in listo — {resultado.partySize}{" "}
          {resultado.partySize === 1 ? "persona" : "personas"}
        </p>
      )}
      {resultado?.tipo === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-center text-[13.5px] font-bold text-red-700"
        >
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
