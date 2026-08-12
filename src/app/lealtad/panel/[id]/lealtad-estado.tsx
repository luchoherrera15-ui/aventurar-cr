import { createAdminClient } from "@/lib/supabase/admin";
import {
  fichasDeMiembros,
  resumenDeLealtad,
  type MiembroCrudo,
  type PaseCrudo,
  type TransaccionCruda,
} from "@/lib/lealtad/tablero";
import { estadoDelLimite } from "@/lib/lealtad/planes";
import { hoyISOCR } from "@/lib/fechas";

/**
 * El estado del programa: cuánta gente hay, quién está por ganarse algo
 * y quién se está enfriando.
 *
 * Todo se deriva del ledger — acá no se lee ningún contador guardado.
 * Corre con la llave de servicio porque `transacciones_puntos` no le da
 * lectura al negocio (0060): el saldo es del cliente, y el dueño lo ve
 * a través de esta pantalla, no consultando la tabla.
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

  const db = createAdminClient();
  if (!db) return null;

  const { data: miembros } = await db
    .from("miembros")
    .select("id, cliente_id, estado, created_at")
    .eq("programa_id", programaId);

  const ids = (miembros ?? []).map((m) => m.id as string);

  const [{ data: tx }, { data: pases }, { data: perfiles }] = await Promise.all([
    ids.length
      ? db
          .from("transacciones_puntos")
          .select("miembro_id, puntos, tipo, created_at")
          .in("miembro_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db.from("pases_wallet").select("miembro_id, plataforma").in("miembro_id", ids)
      : Promise.resolve({ data: [] }),
    db
      .from("perfiles")
      .select("id, nombre")
      .in(
        "id",
        (miembros ?? []).map((m) => m.cliente_id).filter(Boolean) as string[],
      ),
  ]);

  const nombres = new Map(
    ((perfiles ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      (p.nombre ?? "").trim() || "Cliente",
    ]),
  );

  const hoy = hoyISOCR();
  const fichas = fichasDeMiembros({
    miembros: (miembros ?? []) as MiembroCrudo[],
    transacciones: (tx ?? []) as TransaccionCruda[],
    pases: (pases ?? []) as PaseCrudo[],
    nombres,
    meta,
    hoy,
  });
  const resumen = resumenDeLealtad({
    fichas,
    transacciones: (tx ?? []) as TransaccionCruda[],
    hoy,
  });
  const limite = estadoDelLimite(plan, resumen.miembros);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          titulo="Miembros"
          valor={String(resumen.miembros)}
          detalle={
            limite.limite
              ? `de ${limite.limite.toLocaleString("es-CR")} del plan`
              : "sin tope"
          }
          alerta={limite.lleno}
          aviso={limite.cerca && !limite.lleno}
        />
        <Dato
          titulo="Con tarjeta"
          valor={String(resumen.conPase)}
          detalle="la llevan en el teléfono"
        />
        <Dato
          titulo="Sellos (30 días)"
          valor={String(resumen.sellosRecientes)}
          detalle={`${resumen.canjes} canje${resumen.canjes === 1 ? "" : "s"} en total`}
        />
        <Dato
          titulo="Les toca su regalía"
          valor={String(resumen.listosParaCanjear)}
          detalle={
            resumen.enRiesgo > 0
              ? `${resumen.enRiesgo} sin venir hace 2 meses`
              : "nadie se está enfriando"
          }
          aviso={resumen.listosParaCanjear > 0}
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
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-aventurea-ink">
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

function Dato({
  titulo,
  valor,
  detalle,
  alerta,
  aviso,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  alerta?: boolean;
  aviso?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${
        alerta
          ? "border-red-200 bg-red-50"
          : aviso
            ? "border-aventurea-sky/30 bg-aventurea-sky/5"
            : "border-aventurea-line bg-white"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p className="mt-0.5 text-[24px] font-extrabold tabular-nums text-aventurea-ink">
        {valor}
      </p>
      <p className="text-[11.5px] leading-snug text-aventurea-ink-soft">{detalle}</p>
    </div>
  );
}
