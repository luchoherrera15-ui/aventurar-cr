import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardVacia, PildoraEstado } from "@/components/panel/piezas";
import {
  CIFRA,
  CUERPO_SUAVE,
  DETALLE,
  GAP_TABLERO,
  RADIO_CARD,
  RADIO_METRICA,
  ROTULO_CIFRA,
  SUPERFICIE_PANEL,
} from "@/components/panel/sistema";
import { ActividadFiltrable, CanjePendientePos } from "./lealtad-secciones-cliente";

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
    .limit(200);

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

  // Los datos planos para el cliente: él filtra (nombre, fechas) sin
  // volver a consultar nada.
  const filasParaFiltrar = filas.map((t) => ({
    transaccionId: t.id as string,
    miembroId: t.miembro_id as string,
    nombre: nombres.get(t.miembro_id as string) ?? "Cliente",
    tipo: t.tipo as string,
    puntos: t.puntos as number,
    motivo: (t.motivo as string) ?? "",
    saldoPosterior: t.saldo_posterior as number | null,
    esReversion: t.reversion_de !== null,
    porQuien: t.usuario_id
      ? (nombreOperador.get(t.usuario_id as string) ?? "Colaborador")
      : null,
    fecha: FECHA.format(new Date(t.created_at as string)),
    // YYYY-MM-DD en hora de Costa Rica, para el filtro por fechas.
    fechaISO: new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t.created_at as string)),
  }));

  return (
    <ActividadFiltrable
      ranchoId={ranchoId}
      filas={filasParaFiltrar}
      totalMiembros={nombres.size}
    />
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
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      <Card
        eyebrow="Cómo se registran"
        titulo={modo === "api" ? `Integrado (${integracion?.proveedor ?? "API"})` : "Modo manual"}
        // Esta sección se monta bajo un <Rotulo> h3 de page.tsx, así
        // que su tarjeta es h3: saltarse un nivel rompe la navegación
        // por encabezados de un lector de pantalla.
        nivel="h3"
        /* El contador se cuenta de la lista, no se escribe. */
        accion={
          <PildoraEstado estado={pendientes.length > 0 ? "aviso" : "neutro"}>
            {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"}
          </PildoraEstado>
        }
      >
        <p className={CUERPO_SUAVE}>
          {modo === "api"
            ? "Los canjes se envían a tu POS por API."
            : "Bookea registra el canje y te dice qué poner en la factura; vos lo marcás acá cuando lo pasás a tu caja. La integración automática con un POS llega cuando haya un proveedor conectado — no antes."}
        </p>
      </Card>

      {pendientes.length === 0 ? (
        <Vacio texto="No hay canjes pendientes de registrar en tu caja." />
      ) : (
        <div className={`overflow-hidden ${RADIO_CARD} border border-aventurea-line bg-aventurea-surface`}>
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
  return <CardVacia>{texto}</CardVacia>;
}

/**
 * El número de estas secciones, con la anatomía de la `.metric` del
 * sistema: rótulo en versalitas, cifra en `tabular-nums` y detalle
 * debajo.
 *
 * `alerta` ya NO pinta la tarjeta entera de rojo tenue. Pintar el
 * fondo completo es exactamente lo que se sacó del calendario del
 * panel de negocio: el color se come el dato y además obliga a medir
 * cada texto contra dos fondos distintos. Ahora el estado lo dice una
 * PÍLDORA —con palabras, no solo con color—, y la tarjeta se queda
 * blanca como todas.
 */
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
    <div className={`${SUPERFICIE_PANEL} ${RADIO_METRICA} px-4 py-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <p className={ROTULO_CIFRA}>{titulo}</p>
        {alerta && <PildoraEstado estado="alerta">Revisar</PildoraEstado>}
      </div>
      <p className={`mt-1.5 ${CIFRA}`}>{valor}</p>
      {detalle && <p className={`mt-1.5 ${DETALLE}`}>{detalle}</p>}
    </div>
  );
}
