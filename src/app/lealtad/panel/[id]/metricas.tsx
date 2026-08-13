import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe } from "@/lib/lealtad/planes";

/**
 * La pestaña Métricas: ¿el programa está creciendo o no?
 *
 * Todo se DERIVA del ledger y de las fechas de alta — acá no hay
 * contadores guardados (doctrina del módulo: el saldo es la suma, el
 * stock se cuenta, y las métricas se calculan). Corre con la llave de
 * servicio porque las tablas no le dan lectura al negocio (0060).
 *
 * Las ventanas se comparan completas: los últimos 30 días contra los 30
 * anteriores. Comparar "lo que va del mes" contra un mes entero hace
 * ver caídas donde solo hay calendario.
 *
 * El cálculo vive FUERA del componente: el compilador de React no
 * acepta Date.now() en el cuerpo de un componente (y tiene razón — en
 * una función suelta la impureza es explícita).
 */

const DIA_MS = 24 * 60 * 60 * 1000;

type Datos = {
  semanas: { etiqueta: string; nuevos: number }[];
  maxSemana: number;
  nuevos30: number;
  nuevosPrev: number;
  activos30: number;
  sellos30: number;
  sellosPrev: number;
  canjes30: number;
  canjesPrev: number;
  totalMiembros: number;
  limite: number | null;
  ritmoSemanal: number;
  proyeccion30: number;
  emitidas: number;
  registradas: number;
};

async function calcularMetricas(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  programaId: string,
  plan: string | null,
): Promise<Datos> {
  const ahora = Date.now();
  const hace60 = new Date(ahora - 60 * DIA_MS).toISOString();

  const { data: miembros } = await db
    .from("miembros")
    .select("id, created_at")
    .eq("programa_id", programaId);

  const ids = (miembros ?? []).map((m) => m.id as string);

  const [{ data: tx }, { data: pases }] = await Promise.all([
    ids.length
      ? db
          .from("transacciones_puntos")
          .select("miembro_id, tipo, created_at")
          .in("miembro_id", ids)
          .gte("created_at", hace60)
      : Promise.resolve({ data: [] as { miembro_id: string; tipo: string; created_at: string }[] }),
    ids.length
      ? db.from("pases_wallet").select("serial_number").in("miembro_id", ids)
      : Promise.resolve({ data: [] as { serial_number: string }[] }),
  ]);

  const seriales = (pases ?? []).map((p) => p.serial_number as string);
  const { data: registros } = seriales.length
    ? await db
        .from("registros_dispositivo")
        .select("serial_number")
        .in("serial_number", seriales)
    : { data: [] };

  // ── Nuevos miembros por semana (últimas 8) ──────────────────────────
  const semanas: { etiqueta: string; nuevos: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const fin = ahora - i * 7 * DIA_MS;
    const inicio = fin - 7 * DIA_MS;
    const nuevos = (miembros ?? []).filter((m) => {
      const t = new Date(m.created_at as string).getTime();
      return t >= inicio && t < fin;
    }).length;
    const d = new Date(inicio);
    semanas.push({
      etiqueta: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      nuevos,
    });
  }

  // ── Ventanas de 30 días, completas ──────────────────────────────────
  const corte30 = ahora - 30 * DIA_MS;
  const enVentana = (fecha: string, reciente: boolean) => {
    const t = new Date(fecha).getTime();
    return reciente ? t >= corte30 : t < corte30;
  };

  const filas = (tx ?? []) as { miembro_id: string; tipo: string; created_at: string }[];
  const sellos30 = filas.filter((t) => t.tipo === "ganado" && enVentana(t.created_at, true)).length;
  const sellosPrev = filas.filter((t) => t.tipo === "ganado" && enVentana(t.created_at, false)).length;
  const canjes30 = filas.filter((t) => t.tipo === "canjeado" && enVentana(t.created_at, true)).length;
  const canjesPrev = filas.filter((t) => t.tipo === "canjeado" && enVentana(t.created_at, false)).length;

  const activos30 = new Set(
    filas.filter((t) => enVentana(t.created_at, true)).map((t) => t.miembro_id),
  ).size;

  const nuevos30 = (miembros ?? []).filter(
    (m) => new Date(m.created_at as string).getTime() >= corte30,
  ).length;
  const nuevosPrev = (miembros ?? []).filter((m) => {
    const t = new Date(m.created_at as string).getTime();
    return t >= ahora - 60 * DIA_MS && t < corte30;
  }).length;

  const totalMiembros = (miembros ?? []).length;
  const limite = definicionDe(plan)?.limites.clientesActivos ?? null;

  // A este ritmo (promedio de las últimas 4 semanas), en un mes hay:
  const ritmoSemanal = semanas.slice(-4).reduce((s, x) => s + x.nuevos, 0) / 4;
  const proyeccion30 = Math.round(totalMiembros + ritmoSemanal * 4.33);

  return {
    semanas,
    maxSemana: Math.max(1, ...semanas.map((s) => s.nuevos)),
    nuevos30,
    nuevosPrev,
    activos30,
    sellos30,
    sellosPrev,
    canjes30,
    canjesPrev,
    totalMiembros,
    limite,
    ritmoSemanal,
    proyeccion30,
    emitidas: seriales.length,
    registradas: new Set((registros ?? []).map((r) => r.serial_number as string)).size,
  };
}

export default async function MetricasLealtad({
  programaId,
  plan,
}: {
  programaId: string | null;
  plan: string | null;
}) {
  const db = createAdminClient();
  if (!db || !programaId) {
    return (
      <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
        Cuando el programa esté activo, acá se ve el crecimiento.
      </p>
    );
  }

  const d = await calcularMetricas(db, programaId, plan);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          titulo="Clientes nuevos (30 días)"
          valor={d.nuevos30}
          delta={delta(d.nuevos30, d.nuevosPrev)}
        />
        <Kpi titulo="Clientes activos (30 días)" valor={d.activos30} />
        <Kpi
          titulo="Sellos y puntos dados"
          valor={d.sellos30}
          delta={delta(d.sellos30, d.sellosPrev)}
        />
        <Kpi titulo="Canjes" valor={d.canjes30} delta={delta(d.canjes30, d.canjesPrev)} />
      </div>

      <div className="rounded-2xl border border-aventurea-line bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Clientes nuevos por semana
        </p>
        <div className="mt-3 flex items-end gap-2" style={{ height: 110 }}>
          {d.semanas.map((s) => (
            <div key={s.etiqueta} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10.5px] font-bold tabular-nums text-aventurea-ink">
                {s.nuevos || ""}
              </span>
              <div
                className="w-full rounded-t-md bg-aventurea-navy"
                style={{
                  height: `${Math.max(4, (s.nuevos / d.maxSemana) * 80)}px`,
                  opacity: s.nuevos ? 1 : 0.15,
                }}
              />
              <span className="text-[9.5px] text-aventurea-ink-soft">{s.etiqueta}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-aventurea-line bg-white px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Proyección
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-aventurea-ink">
            {d.ritmoSemanal > 0 ? (
              <>
                Al ritmo de las últimas 4 semanas (~{Math.round(d.ritmoSemanal * 10) / 10} por
                semana), en un mes andarías por <strong>{d.proyeccion30} miembros</strong>
                {d.limite !== null && d.proyeccion30 >= d.limite && (
                  <> — pasarías el tope de tu plan ({d.limite}): hora de mejorar el paquete</>
                )}
                .
              </>
            ) : (
              <>Sin afiliaciones en el último mes. El QR en el mostrador es lo que más afilia.</>
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-aventurea-line bg-white px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Tarjetas en Wallet
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-aventurea-ink">
            {d.emitidas} emitida{d.emitidas === 1 ? "" : "s"}; {d.registradas} con actualización
            automática en el teléfono.
          </p>
          {d.limite !== null && (
            <p className="mt-1 text-[12px] text-aventurea-ink-soft">
              {d.totalMiembros} de {d.limite} miembros del plan.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function delta(actual: number, anterior: number): string | null {
  if (anterior === 0) return actual > 0 ? "nuevo" : null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  if (pct === 0) return "igual que antes";
  return pct > 0 ? `+${pct}% vs 30 días previos` : `${pct}% vs 30 días previos`;
}

function Kpi({ titulo, valor, delta }: { titulo: string; valor: number; delta?: string | null }) {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-white px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p className="mt-0.5 text-[22px] font-extrabold tabular-nums text-aventurea-ink">{valor}</p>
      {delta && <p className="text-[11.5px] leading-snug text-aventurea-ink-soft">{delta}</p>}
    </div>
  );
}
