import { createAdminClient } from "@/lib/supabase/admin";

/**
 * El "quién hizo qué" agregado: por cada operador (dueño o
 * colaborador), cuántos sellos dio, cuántos canjes entregó y cuándo fue
 * su último movimiento — los últimos 30 días.
 *
 * Es la vista de control del administrador; el detalle fila por fila
 * está justo debajo (ActividadLealtad). `usuario_id` null = el sistema
 * (ej. puntos por cita cumplida): también se muestra, porque un
 * movimiento que nadie hizo también hay que poder explicarlo.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

type FilaOperador = {
  id: string | null;
  nombre: string;
  acreditados: number;
  canjes: number;
  ultima: string;
};

async function resumenPorOperador(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  programaId: string,
): Promise<FilaOperador[]> {
  const corte = new Date(Date.now() - 30 * DIA_MS).toISOString();

  const { data: miembros } = await db
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId);
  const ids = (miembros ?? []).map((m) => m.id as string);
  if (ids.length === 0) return [];

  const { data: tx } = await db
    .from("transacciones_puntos")
    .select("tipo, usuario_id, created_at")
    .in("miembro_id", ids)
    .gte("created_at", corte);

  const porOperador = new Map<string | null, { acreditados: number; canjes: number; ultima: string }>();
  for (const t of (tx ?? []) as { tipo: string; usuario_id: string | null; created_at: string }[]) {
    const llave = t.usuario_id;
    const fila = porOperador.get(llave) ?? { acreditados: 0, canjes: 0, ultima: "" };
    if (t.tipo === "ganado") fila.acreditados++;
    if (t.tipo === "canjeado") fila.canjes++;
    if (t.created_at > fila.ultima) fila.ultima = t.created_at;
    porOperador.set(llave, fila);
  }

  const idsOperadores = [...porOperador.keys()].filter(Boolean) as string[];
  const { data: perfiles } = idsOperadores.length
    ? await db.from("perfiles").select("id, nombre").in("id", idsOperadores)
    : { data: [] };
  const nombres = new Map(
    ((perfiles ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      (p.nombre ?? "").trim() || "Colaborador",
    ]),
  );

  return [...porOperador.entries()]
    .map(([id, f]) => ({
      id,
      nombre: id ? (nombres.get(id) ?? "Colaborador") : "sistema",
      ...f,
    }))
    .sort((a, b) => b.acreditados + b.canjes - (a.acreditados + a.canjes));
}

const FECHA = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Costa_Rica",
});

export default async function AuditoriaResumen({ programaId }: { programaId: string | null }) {
  const db = createAdminClient();
  if (!db || !programaId) return null;

  const filas = await resumenPorOperador(db, programaId);
  if (filas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-5 text-center text-[13px] text-aventurea-ink-soft">
        Sin movimientos en los últimos 30 días.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-b border-aventurea-line bg-aventurea-cream-2 px-4 py-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Operador (30 días)
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Dio
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Canjeó
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Último
        </span>
      </div>
      {filas.map((f) => (
        <div
          key={f.id ?? "sistema"}
          className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-b border-aventurea-line px-4 py-2.5 last:border-b-0"
        >
          <span className="truncate text-[13px] font-bold text-aventurea-ink">{f.nombre}</span>
          <span className="text-[13px] tabular-nums text-aventurea-ink">{f.acreditados}</span>
          <span className="text-[13px] tabular-nums text-aventurea-ink">{f.canjes}</span>
          <span className="text-[11.5px] tabular-nums text-aventurea-ink-soft">
            {f.ultima ? FECHA.format(new Date(f.ultima)) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
