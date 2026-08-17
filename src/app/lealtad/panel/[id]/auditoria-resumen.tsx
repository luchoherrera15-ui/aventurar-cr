import { createAdminClient } from "@/lib/supabase/admin";
import { CardVacia } from "@/components/panel/piezas";
import { RADIO_CARD, ROTULO_CIFRA } from "@/components/panel/sistema";

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
    return <CardVacia>Sin movimientos en los últimos 30 días.</CardVacia>;
  }

  // UNA sola plantilla de columnas para la cabecera y las filas: con
  // `auto` cada fila resolvía su propio ancho y los encabezados no
  // caían nunca sobre sus datos. El min-w + scroll evita que en móvil
  // se aplaste el nombre.
  const COLS = "grid-cols-[minmax(0,1fr)_44px_60px_92px]";

  /* La tabla se lleva la piel de la tarjeta del sistema y sus filas la
     altura de la fila canónica (48px acá porque no hay dos renglones de
     texto). El scroll horizontal vive DENTRO de la tarjeta: el cuerpo de
     la página nunca se desplaza de lado, que es la regla de la
     auditoría de responsive. */
  return (
    <div className={`overflow-x-auto ${RADIO_CARD} border border-aventurea-line bg-aventurea-surface`}>
      <div
        className={`grid ${COLS} min-w-[420px] items-center gap-x-4 border-b border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5`}
      >
        <span className={ROTULO_CIFRA}>Operador (30 días)</span>
        <span className={ROTULO_CIFRA}>Dio</span>
        <span className={ROTULO_CIFRA}>Canjeó</span>
        <span className={ROTULO_CIFRA}>Último</span>
      </div>
      {filas.map((f) => (
        <div
          key={f.id ?? "sistema"}
          className={`grid ${COLS} min-h-[48px] min-w-[420px] items-center gap-x-4 border-b border-aventurea-line px-4 py-2.5 transition-colors last:border-b-0 hover:bg-aventurea-cream-2`}
        >
          <span className="truncate text-[13.5px] font-bold text-aventurea-ink">{f.nombre}</span>
          <span className="text-[13.5px] font-bold tabular-nums text-aventurea-ink">
            {f.acreditados}
          </span>
          <span className="text-[13.5px] font-bold tabular-nums text-aventurea-ink">
            {f.canjes}
          </span>
          <span className="text-[11.5px] tabular-nums text-aventurea-ink-soft">
            {f.ultima ? FECHA.format(new Date(f.ultima)) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
