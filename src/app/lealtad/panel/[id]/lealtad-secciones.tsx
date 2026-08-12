import { createAdminClient } from "@/lib/supabase/admin";
import FilaActividad, { CanjePendientePos } from "./lealtad-secciones-cliente";

/**
 * Las secciones de consulta del programa: Actividad (el ledger en
 * pantalla), Wallet (los pases emitidos) e Integraciones (el estado
 * del POS). Son componentes de servidor con la llave de servicio,
 * porque `transacciones_puntos`, `pases_wallet` y `registros_dispositivo`
 * no le dan lectura al negocio (0060): el dueño ve a TRAVÉS de estas
 * pantallas, no consultando las tablas.
 */

const FECHA = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Costa_Rica",
});

async function nombresDeMiembros(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  programaId: string,
) {
  const { data: miembros } = await db
    .from("miembros")
    .select("id, cliente_id")
    .eq("programa_id", programaId);

  const clientes = (miembros ?? []).map((m) => m.cliente_id).filter(Boolean) as string[];
  const { data: perfiles } = clientes.length
    ? await db.from("perfiles").select("id, nombre").in("id", clientes)
    : { data: [] };

  const porCliente = new Map(
    ((perfiles ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      (p.nombre ?? "").trim() || "Cliente",
    ]),
  );
  return new Map(
    (miembros ?? []).map((m) => [
      m.id as string,
      (m.cliente_id && porCliente.get(m.cliente_id as string)) || "Cliente",
    ]),
  );
}

// ── Actividad: el libro mayor ───────────────────────────────────────
export async function ActividadLealtad({
  ranchoId,
  programaId,
}: {
  ranchoId: string;
  programaId: string | null;
}) {
  const db = createAdminClient();
  if (!db || !programaId) return <Vacio texto="Todavía no hay programa." />;

  const nombres = await nombresDeMiembros(db, programaId);
  const ids = [...nombres.keys()];
  if (ids.length === 0) return <Vacio texto="Todavía no hay movimientos." />;

  const { data: tx } = await db
    .from("transacciones_puntos")
    .select(
      "id, miembro_id, tipo, puntos, motivo, saldo_posterior, reversion_de, usuario_id, created_at",
    )
    .in("miembro_id", ids)
    .order("created_at", { ascending: false })
    .limit(60);

  const filas = tx ?? [];
  if (filas.length === 0) return <Vacio texto="Todavía no hay movimientos." />;

  // QUIÉN lo hizo: el colaborador o dueño que escaneó/canjeó/ajustó.
  // usuario_id null = lo hizo el sistema (ej. puntos por cita cumplida).
  const operadores = [
    ...new Set(filas.map((t) => t.usuario_id).filter(Boolean) as string[]),
  ];
  const { data: perfilesOp } = operadores.length
    ? await db.from("perfiles").select("id, nombre").in("id", operadores)
    : { data: [] };
  const nombreOperador = new Map(
    ((perfilesOp ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      (p.nombre ?? "").trim() || "Colaborador",
    ]),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
      {filas.map((t, i) => (
        <FilaActividad
          key={t.id as string}
          ranchoId={ranchoId}
          transaccionId={t.id as string}
          miembroId={t.miembro_id as string}
          nombre={nombres.get(t.miembro_id as string) ?? "Cliente"}
          tipo={t.tipo as string}
          puntos={t.puntos as number}
          motivo={(t.motivo as string) ?? ""}
          saldoPosterior={t.saldo_posterior as number | null}
          esReversion={t.reversion_de !== null}
          porQuien={
            t.usuario_id ? (nombreOperador.get(t.usuario_id as string) ?? "Colaborador") : null
          }
          fecha={FECHA.format(new Date(t.created_at as string))}
          primera={i === 0}
        />
      ))}
      <p className="border-t border-aventurea-line px-4 py-2.5 text-[11.5px] text-aventurea-ink-soft">
        Los últimos 60 movimientos. El libro nunca se edita: los errores se corrigen con el
        movimiento contrario, y las dos versiones quedan a la vista.
      </p>
    </div>
  );
}

// ── Wallet: los pases emitidos ──────────────────────────────────────
export async function WalletLealtad({ programaId }: { programaId: string | null }) {
  const db = createAdminClient();
  if (!db || !programaId) return <Vacio texto="Todavía no hay programa." />;

  const { data: miembros } = await db
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId);
  const ids = (miembros ?? []).map((m) => m.id as string);

  const { data: pases } = ids.length
    ? await db
        .from("pases_wallet")
        .select("serial_number, plataforma, actualizado_en")
        .in("miembro_id", ids)
    : { data: [] };

  const seriales = (pases ?? []).map((p) => p.serial_number as string);
  const { data: registros } = seriales.length
    ? await db.from("registros_dispositivo").select("serial_number").in("serial_number", seriales)
    : { data: [] };

  const emitidos = (pases ?? []).length;
  const registrados = new Set((registros ?? []).map((r) => r.serial_number as string)).size;
  const ultima = (pases ?? [])
    .map((p) => p.actualizado_en as string)
    .sort()
    .at(-1);

  const credencialesOk = !!(
    process.env.APPLE_PASS_CERT_B64 &&
    process.env.APPLE_PASS_KEY_B64 &&
    process.env.APPLE_WWDR_CERT_B64
  );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Dato titulo="Pases emitidos" valor={String(emitidos)} />
      <Dato
        titulo="Con actualización automática"
        valor={String(registrados)}
        detalle="teléfonos registrados para el push"
      />
      <Dato
        titulo="Última actualización"
        valor={ultima ? FECHA.format(new Date(ultima)) : "—"}
      />
      <Dato
        titulo="Credenciales de Apple"
        valor={credencialesOk ? "OK" : "Faltan"}
        detalle={credencialesOk ? "certificado cargado en el servidor" : "revisar variables APPLE_*"}
        alerta={!credencialesOk}
      />
    </div>
  );
}

// ── Integraciones: el POS ───────────────────────────────────────────
export async function IntegracionesLealtad({
  ranchoId,
  programaId,
}: {
  ranchoId: string;
  programaId: string | null;
}) {
  const db = createAdminClient();
  if (!db) return null;

  const { data: integracion } = await db
    .from("integraciones_pos")
    .select("modo, proveedor, activo")
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  const modo = (integracion?.modo as string | undefined) ?? "manual";

  // Los canjes entregados que nadie marcó en el POS: la lista de
  // trabajo del modo manual.
  let pendientes: {
    id: string;
    miembro_id: string;
    nombre: string;
    recompensa: string;
    sku: string | null;
    fecha: string;
  }[] = [];

  if (programaId) {
    const nombres = await nombresDeMiembros(db, programaId);
    const ids = [...nombres.keys()];
    if (ids.length) {
      const { data: canjes } = await db
        .from("canjes")
        .select("id, miembro_id, recompensa_id, created_at, recompensas(nombre, sku)")
        .in("miembro_id", ids)
        .eq("estado", "entregado")
        .is("pos_registrado_en", null)
        .order("created_at", { ascending: false })
        .limit(20);

      pendientes = ((canjes ?? []) as unknown as {
        id: string;
        miembro_id: string;
        created_at: string;
        recompensas: { nombre: string; sku: string | null } | null;
      }[]).map((c) => ({
        id: c.id,
        miembro_id: c.miembro_id,
        nombre: nombres.get(c.miembro_id) ?? "Cliente",
        recompensa: c.recompensas?.nombre ?? "Recompensa",
        sku: c.recompensas?.sku ?? null,
        fecha: FECHA.format(new Date(c.created_at)),
      }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-aventurea-line bg-white px-4 py-3.5">
        <p className="text-[13px] font-bold text-aventurea-ink">
          Modo: {modo === "api" ? `Integrado (${integracion?.proveedor ?? "API"})` : "Manual"}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          {modo === "api"
            ? "Los canjes se envían a tu POS por API."
            : "Bookea registra el canje y te dice qué poner en la factura; vos lo marcás acá cuando lo pasás a tu caja. La integración automática con un POS llega cuando haya un proveedor conectado — no antes."}
        </p>
      </div>

      {pendientes.length === 0 ? (
        <Vacio texto="No hay canjes pendientes de registrar en tu caja." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
          {pendientes.map((c, i) => (
            <CanjePendientePos key={c.id} ranchoId={ranchoId} canje={c} primera={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Piezas compartidas ──────────────────────────────────────────────
function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
      {texto}
    </p>
  );
}

function Dato({
  titulo,
  valor,
  detalle,
  alerta,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${
        alerta ? "border-red-200 bg-red-50" : "border-aventurea-line bg-white"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p className="mt-0.5 text-[20px] font-extrabold tabular-nums text-aventurea-ink">{valor}</p>
      {detalle && (
        <p className="text-[11.5px] leading-snug text-aventurea-ink-soft">{detalle}</p>
      )}
    </div>
  );
}
