import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { SECCION_LABEL, perteneceASeccion } from "../vertical";
import { seccionActiva } from "../vertical-server";
import {
  cobrosConocidosSinMonto,
  cortesiasDePlan,
  detectarHallazgos,
  faltaTablaCobros,
  suscripcionesSinCobro,
  type CobroModulo,
  type CuentaAuditoria,
  type EntradaAuditoria,
  type MovimientoPlanAuditoria,
  type NegocioAuditoria,
  type SolicitudAuditoria,
  type SuscripcionAuditoria,
} from "@/lib/auditoria-modulos";
import AuditoriaPanel, { type NegocioOpcion } from "./auditoria-panel";

/**
 * AUDITORÍA DE LOS MÓDULOS — cuánto se cobra por los paquetes de
 * Lealtad y los complementos, y por dónde entró.
 *
 * Es la pantalla hermana de /admin/finanzas y NO se pisa con ella:
 * aquella cuadra el dinero de las RESERVAS (comisión de la plataforma,
 * `reservas` + `cobros_plataforma`); ésta cuadra lo que los negocios le
 * pagan a Bookea por el software.
 *
 * ── LO QUE ESTA PANTALLA ADMITE QUE NO SABE ──────────────────────────
 *
 * Hasta la 0172 ningún camino de cobro de Lealtad guardaba el MONTO: ni
 * el SINPE (`solicitudes_lealtad` guarda método y captura, no importe)
 * ni Stripe (`suscripciones` guarda el estado, no la factura). Así que
 * acá no se estima nada desde el precio de lista: los cobros conocidos
 * sin monto se listan aparte, con su comprobante a mano, para anotarlos
 * uno por uno. Un total al que le faltan cobros y no lo dice se lee
 * como una caída de ventas que no ocurrió.
 *
 * ── POR QUÉ NO HAY UN «TOTAL» ────────────────────────────────────────
 *
 * Los paquetes están tarifados en dólares y el SINPE entra en colones
 * al tipo de cambio del día, que el sistema no guarda por transacción.
 * Sumarlos daría un número que no es plata. Se muestran dos columnas,
 * ₡ y $, y nunca se cruzan.
 */
export default async function AdminModulosPage() {
  const admin = createAdminClient();
  const seccion = await seccionActiva();

  if (!admin) {
    return (
      <div>
        <Encabezado />
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{FALTA_SERVICE_KEY}</p>
      </div>
    );
  }

  const [
    ranchosRes,
    cuentasRes,
    addonsRes,
    solicitudesRes,
    suscripcionesRes,
    cobrosRes,
    movimientosRes,
  ] = await Promise.all([
      admin.from("ranchos").select("id, nombre, vertical, plan_lealtad").order("nombre"),
      // `cuentas` es de la 0134 y ahí vive el paquete que MANDA. Si la
      // consulta falla, la pantalla NO afirma que nada discrepa.
      admin.from("cuentas").select("id, rancho_id, plan"),
      admin.from("addons_negocio").select("rancho_id, addon, activo, vence_en"),
      // `select *`: metodo_pago/comprobante_url son de la 0128 y
      // negocio_nombre de la 0130 — con un select explícito la página
      // entera se caería en una base sin esas migraciones.
      admin.from("solicitudes_lealtad").select("*"),
      admin
        .from("suscripciones")
        .select("id, rancho_id, cuenta_id, plan, estado, periodo, periodo_fin"),
      // El libro de la 0172. Sin límite a propósito: es el ingreso
      // propio de Bookea (decenas de filas por mes, no miles), y un
      // límite haría que el total de "Todo" dejara de ser el total.
      admin.from("cobros_modulo").select("*").order("cobrado_en", { ascending: false }),
      // La bitácora de planes la escribe OTRA pieza (la que da las
      // regalías desde /admin/complementos). Acá solo se lee, y si su
      // migración todavía no corrió la pantalla sigue funcionando: sin
      // ella no se puede cruzar «se vendió» contra «entró plata», y se
      // dice en pantalla en vez de dar el cruce por bueno.
      admin
        .from("historial_plan_lealtad")
        .select("rancho_id, concepto, plan_despues, cortesia_hasta, creado_en"),
    ]);

  // NO se consulta `miembros`: contar la tabla entera para pintar un
  // número es lo que ya hace pesada a /admin/complementos, y acá no
  // hace falta ningún dato de miembros.

  const faltaLibro = cobrosRes.error ? faltaTablaCobros(cobrosRes.error) : false;

  const errores: string[] = [];
  if (ranchosRes.error) errores.push(`negocios: ${ranchosRes.error.message}`);
  if (addonsRes.error) errores.push(`complementos: ${addonsRes.error.message}`);
  if (cobrosRes.error && !faltaLibro) errores.push(`libro de cobros: ${cobrosRes.error.message}`);

  type FilaRancho = {
    id: string;
    nombre: string;
    vertical: string | null;
    plan_lealtad: string | null;
  };
  const filasRancho = (ranchosRes.data ?? []) as FilaRancho[];

  const addonsPorRancho = new Map<string, NegocioAuditoria["addons"]>();
  for (const a of (addonsRes.data ?? []) as {
    rancho_id: string;
    addon: string;
    activo: boolean;
    vence_en: string | null;
  }[]) {
    addonsPorRancho.set(a.rancho_id, [
      ...(addonsPorRancho.get(a.rancho_id) ?? []),
      { addon: a.addon, activo: a.activo, venceEn: a.vence_en },
    ]);
  }

  const negocios: NegocioAuditoria[] = filasRancho.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    vertical: r.vertical,
    planRancho: r.plan_lealtad ?? null,
    addons: addonsPorRancho.get(r.id) ?? [],
  }));

  const cuentasLegibles = !cuentasRes.error;
  const cuentas: CuentaAuditoria[] = (
    (cuentasRes.data ?? []) as { id: string; rancho_id: string | null; plan: string | null }[]
  ).map((c) => ({ id: c.id, ranchoId: c.rancho_id, plan: c.plan }));

  type FilaSolicitud = {
    id: string;
    rancho_id: string | null;
    plan: string;
    estado: string;
    created_at: string;
    metodo_pago?: string | null;
    comprobante_url?: string | null;
    atendida_en?: string | null;
    negocio_nombre?: string | null;
  };
  const solicitudes: SolicitudAuditoria[] = (
    (solicitudesRes.data ?? []) as FilaSolicitud[]
  ).map((s) => ({
    id: s.id,
    ranchoId: s.rancho_id,
    negocioNombre: s.negocio_nombre ?? null,
    plan: s.plan,
    estado: s.estado,
    metodoPago: s.metodo_pago ?? null,
    comprobanteUrl: s.comprobante_url ?? null,
    createdAt: s.created_at,
    atendidaEn: s.atendida_en ?? null,
  }));

  const suscripciones: SuscripcionAuditoria[] = (
    (suscripcionesRes.data ?? []) as {
      id: string;
      rancho_id: string | null;
      cuenta_id: string | null;
      plan: string | null;
      estado: string;
      periodo: string;
      periodo_fin: string | null;
    }[]
  ).map((s) => ({
    id: s.id,
    ranchoId: s.rancho_id,
    cuentaId: s.cuenta_id,
    plan: s.plan,
    estado: s.estado,
    periodo: s.periodo,
    periodoFin: s.periodo_fin,
  }));

  const cobros = (faltaLibro ? [] : ((cobrosRes.data ?? []) as CobroModulo[])).map((c) => ({
    ...c,
    monto: Number(c.monto),
    valor_lista_usd: c.valor_lista_usd === null ? null : Number(c.valor_lista_usd),
    tipo_cambio: c.tipo_cambio === null ? null : Number(c.tipo_cambio),
  }));

  const movimientosLegibles = !movimientosRes.error;
  const movimientos: MovimientoPlanAuditoria[] = (
    (movimientosRes.data ?? []) as {
      rancho_id: string;
      concepto: string;
      plan_despues: string | null;
      cortesia_hasta: string | null;
      creado_en: string;
    }[]
  )
    .filter(
      (m): m is typeof m & { concepto: MovimientoPlanAuditoria["concepto"] } =>
        m.concepto === "venta" ||
        m.concepto === "cortesia" ||
        m.concepto === "correccion" ||
        m.concepto === "baja",
    )
    .map((m) => ({
      ranchoId: m.rancho_id,
      concepto: m.concepto,
      planDespues: m.plan_despues,
      cortesiaHasta: m.cortesia_hasta,
      creadoEn: m.creado_en,
    }));

  const entrada: EntradaAuditoria = {
    negocios,
    cuentas,
    cuentasLegibles,
    solicitudes,
    suscripciones,
    cobros,
    movimientos,
    ahora: new Date(),
  };

  // LOS HALLAZGOS NO SE FILTRAN POR SECCIÓN, a propósito. El conmutador
  // del header decide qué se MIRA, y esconder un problema detrás de una
  // cookie de otra pantalla es la forma más fácil de que nadie lo
  // arregle. Cada fila lleva su negocio, así que se ve de cuál es.
  const hallazgos = detectarHallazgos(entrada);
  const sinMonto = cobrosConocidosSinMonto(entrada);
  const stripeSinCobro = suscripcionesSinCobro(entrada).length;

  // Los cobros SÍ siguen la sección: son la vista de la plata, y ahí la
  // pregunta "¿cuánto entró en Citas?" es legítima. Lo que quede fuera
  // se dice con su número, para que el total nunca parezca el de la
  // plataforma entera cuando no lo es.
  const verticalDe = new Map(negocios.map((n) => [n.id, n.vertical]));
  const visibles =
    seccion === "todas"
      ? cobros
      : cobros.filter((c) =>
          c.rancho_id ? perteneceASeccion(verticalDe.get(c.rancho_id) ?? null, seccion) : false,
        );
  const ocultos = cobros.length - visibles.length;

  const opciones: NegocioOpcion[] = negocios.map((n) => ({
    id: n.id,
    nombre: n.nombre,
    vertical: n.vertical,
    plan: n.planRancho,
  }));

  return (
    <div>
      <Encabezado />

      {errores.length > 0 && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar todo: {errores.join(" · ")}
        </p>
      )}

      <AuditoriaPanel
        cobros={visibles}
        ocultosPorSeccion={ocultos}
        seccionLabel={seccion === "todas" ? null : SECCION_LABEL[seccion]}
        hallazgos={hallazgos}
        sinMonto={sinMonto}
        stripeSinCobro={stripeSinCobro}
        negocios={opciones}
        faltaMigracion={faltaLibro}
        cuentasLegibles={cuentasLegibles}
        cortesiasDePlan={cortesiasDePlan(entrada)}
        movimientosLegibles={movimientosLegibles}
      />
    </div>
  );
}

function Encabezado() {
  return (
    <div className="mb-6">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Monetización · Auditoría
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Ingresos de los módulos</h1>
      <p className="mt-1 max-w-[78ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        Lo que los negocios le pagan a Bookea por los paquetes de Lealtad y los
        complementos, separado por medio de pago. La plata de las reservas
        —comisión de la plataforma— se cuadra en{" "}
        <span className="font-bold">Finanzas</span>, que es otra pantalla y otro
        dinero.
      </p>
    </div>
  );
}
