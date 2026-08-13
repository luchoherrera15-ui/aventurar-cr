import { estadoDelLimite } from "@/lib/lealtad/planes";
import { cargarLealtad } from "./datos-lealtad";
import Kpi from "./kpi";

/**
 * El estado del programa: cuánta gente hay, quién está por ganarse algo
 * y quién se está enfriando.
 *
 * Todo se deriva del ledger — acá no se lee ningún contador guardado.
 * Las consultas viven en `cargarLealtad` (datos-lealtad.ts) y no acá:
 * el tablero de Inicio muestra los mismos números, y con la consulta
 * adentro de este componente el mismo render traía dos veces los
 * miembros, el ledger y los pases del negocio.
 */
export default async function LealtadEstado({

  programaId,
  plan,
  meta,
}: {

  programaId: string | null;
  plan: string | null;
  /** Costo de la recompensa activa más barata. null = sin meta. */
  meta: number | null;
}) {
  if (!programaId) {
    return (
      <div className="rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center">
        <p className="text-[13.5px] text-aventurea-ink-soft">
          Todavía no hay programa. Cuando el equipo de Bookea lo active, acá vas a ver
          quién se afilia, cuántos sellos lleva cada quien y a quién le toca su regalía.
        </p>
      </div>
    );
  }

  const datos = await cargarLealtad(programaId, meta);
  if (!datos) return null;

  const { fichas, resumen } = datos;
  const limite = estadoDelLimite(plan, "clientesActivos", resumen.miembros);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          titulo="Miembros"
          valor={String(resumen.miembros)}
          detalle={
            limite.limite
              ? `de ${limite.limite.toLocaleString("es-CR")} del plan`
              : "sin tope"
          }
          tono={limite.lleno ? "alerta" : limite.cerca ? "aviso" : "normal"}
        />
        <Kpi
          titulo="Con tarjeta"
          valor={String(resumen.conPase)}
          detalle="la llevan en el teléfono"
        />
        <Kpi
          titulo="Sellos (30 días)"
          valor={String(resumen.sellosRecientes)}
          detalle={`${resumen.canjes} canje${resumen.canjes === 1 ? "" : "s"} en total`}
        />
        <Kpi
          titulo="Les toca su regalía"
          valor={String(resumen.listosParaCanjear)}
          detalle={
            resumen.enRiesgo > 0
              ? `${resumen.enRiesgo} sin venir hace 2 meses`
              : "nadie se está enfriando"
          }
          tono={resumen.listosParaCanjear > 0 ? "aviso" : "normal"}
        />
      </div>

      {limite.lleno && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-[12.5px] font-bold text-red-700">
          El plan llegó a su tope: un cliente nuevo ya no se puede afiliar. Hay que subir
          de plan para seguir sumando gente.
        </p>
      )}

      {fichas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
          Nadie se ha afiliado todavía. El cliente se afilia solo al agregar su tarjeta al
          Wallet desde tu página.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
          {fichas.slice(0, 50).map((f, i) => (
            <div
              key={f.miembroId}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 ${
                i > 0 ? "border-t border-aventurea-line" : ""
              } ${f.puedeCanjear ? "bg-aventurea-green-light/40" : ""}`}
            >
              {/* En móvil el nombre toma su propia línea: compitiendo
                  con el saldo, el chip y la fecha quedaba en ~60px y se
                  leía «Mar…» — el dato más importante de la fila. */}
              <span className="w-full min-w-0 truncate text-[13.5px] font-bold text-aventurea-ink sm:w-auto sm:flex-1">
                {f.nombre}
                {f.conPase && (
                  <span className="ml-2 rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft">
                    en Wallet
                  </span>
                )}
              </span>

              <span className="text-[12.5px] font-bold text-aventurea-ink">
                {meta === null ? `${f.saldo} pts` : `${f.saldo} de ${meta}`}
              </span>

              <span
                className={`text-[12px] ${
                  f.puedeCanjear ? "font-bold text-aventurea-green" : "text-aventurea-ink-soft"
                }`}
              >
                {f.puedeCanjear
                  ? "puede canjear"
                  : f.faltan !== null
                    ? `faltan ${f.faltan}`
                    : ""}
              </span>

              <span className="text-[12px] text-aventurea-ink-soft">
                {f.diasSinVenir === null
                  ? "recién afiliado"
                  : f.diasSinVenir === 0
                    ? "vino hoy"
                    : `hace ${f.diasSinVenir} día${f.diasSinVenir === 1 ? "" : "s"}`}
              </span>
            </div>
          ))}
          {fichas.length > 50 && (
            <p className="border-t border-aventurea-line px-4 py-2.5 text-[12px] text-aventurea-ink-soft">
              Se muestran los 50 con más saldo, de {fichas.length}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

