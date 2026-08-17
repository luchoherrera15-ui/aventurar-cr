import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { estadoDeAddon } from "@/lib/addons";
import { planEfectivo } from "@/lib/lealtad/cuenta";
import { estadoVisible } from "@/lib/lealtad/programas";
import { minutoISOCR } from "@/lib/fechas";
import { SECCION_LABEL, type SeccionAdmin } from "../vertical";
import { seccionActiva } from "../vertical-server";
import { clientesPorNegocio } from "./clientes-por-negocio";
import ComplementosPanel, {
  type FilaAddon,
  type MovimientoPlan,
  type NegocioConAddons,
} from "./complementos-panel";
import SolicitudesPanel, { type SolicitudPendiente } from "./solicitudes-panel";
import NegociosRevisionPanel, { type NegocioEnRevision } from "./negocios-revision-panel";
import AyudaPanel, { type HiloConNegocio } from "./ayuda-panel";
import { hilosAbiertosDeAyuda } from "@/lib/lealtad/ayuda-hilo";

/**
 * La administración del módulo de LEALTAD: quién tiene qué, quién paga
 * qué y qué se está regalando.
 *
 * La pantalla arranca por LA LISTA —todos los negocios con su paquete,
 * sus clientes y sus complementos— y el detalle de uno se abre al
 * elegirlo. Antes era al revés: la lista era una columna angosta de
 * nombres y todo lo demás vivía en el panel del negocio elegido. Eso
 * sirve para EDITAR uno, no para tener el mapa; con dos negocios se
 * veía bien y con doscientos no contesta ninguna pregunta.
 *
 * Mientras no exista la pasarela de pago para todos los caminos, esta
 * pantalla ES el cobro: se enciende a mano cuando el negocio paga. Y
 * desde la 0173 también es donde se REGALA — con la regalía marcada
 * como tal, para que lo que se dio gratis no aparezca nunca como plata
 * que entró.
 *
 * La escritura va por server actions con la llave de servicio:
 * `addons_negocio` no le da política de escritura a nadie más (0077).
 */

/**
 * Techo de negocios que se traen. PostgREST corta en `max-rows` (1.000)
 * por su cuenta y sin avisar; pedirlo explícito permite comparar contra
 * el total y DECIRLO en pantalla. Una lista que corta filas en silencio
 * miente.
 */
const TOPE_NEGOCIOS = 1000;
/** Lo mismo para las tarjetas: son varias por negocio. */
const TOPE_PROGRAMAS = 2000;
/** Cuántos movimientos de plan se traen para resolver «quién y cuándo». */
const TOPE_HISTORIAL = 500;

export default async function AdminComplementosPage() {
  const admin = createAdminClient();
  const seccion = await seccionActiva();

  if (!admin) {
    return (
      <div>
        <Encabezado seccion={seccion} activos={0} vencidos={0} cortesias={0} />
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{FALTA_SERVICE_KEY}</p>
      </div>
    );
  }

  const [ranchosRes, addonsRes, programasRes, solicitudesRes, cuentasRes, suscripcionesRes, historialRes] =
    await Promise.all([
      // `select *`: lealtad_aprobado_en es de la 0129 y puede faltar —
      // con un select explícito la página entera se caería.
      admin
        .from("ranchos")
        .select("*", { count: "exact" })
        .order("nombre")
        .range(0, TOPE_NEGOCIOS - 1),
      // También `select *`, y desde la 0173 con más razón: `es_cortesia`
      // y `otorgado_por` pueden no existir todavía, y pedirlas por
      // nombre rompería la consulta ENTERA contra una base sin migrar.
      admin.from("addons_negocio").select("*"),
      // Las tarjetas de cada negocio. `select *` porque `estadoVisible`
      // necesita estado/activo/vigencias y esas columnas llegaron en
      // migraciones distintas (0125, 0136).
      admin.from("programa_lealtad").select("*", { count: "exact" }).range(0, TOPE_PROGRAMAS - 1),
      // La cola de solicitudes del plan (0126). Si la migración no corrió,
      // viene con error y la bandeja simplemente no se muestra.
      admin
        .from("solicitudes_lealtad")
        .select("*")
        .eq("estado", "pendiente")
        .order("created_at", { ascending: true }),
      // `cuentas` (0134): AQUÍ vive el plan que manda. La lista tiene que
      // mostrar el plan EFECTIVO —`planEfectivo` = cuenta ?? rancho— o
      // estaría diciendo el paquete equivocado justo en la pantalla desde
      // la que se cambia.
      admin.from("cuentas").select("id, rancho_id, plan"),
      // Quién paga con tarjeta (0143). No trae montos —`suscripciones` no
      // guarda ninguno— pero sí dice que hay un cobro automático corriendo,
      // que es lo que hay que saber ANTES de regalarle algo a alguien.
      admin.from("suscripciones").select("rancho_id, cuenta_id, plan, periodo, estado"),
      // La bitácora de cambios de paquete (0173).
      admin
        .from("historial_plan_lealtad")
        .select("*")
        .order("creado_en", { ascending: false })
        .limit(TOPE_HISTORIAL),
    ]);

  const filasRanchoTodas = (ranchosRes.data ?? []) as FilaRanchoAdmin[];
  const totalNegocios = ranchosRes.count ?? filasRanchoTodas.length;
  const negociosOcultosPorTope = Math.max(0, totalNegocios - filasRanchoTodas.length);

  // ── Los complementos, agrupados por negocio ────────────────────────
  const porRancho = new Map<string, FilaAddon[]>();
  for (const fila of (addonsRes.data ?? []) as Record<string, unknown>[]) {
    const a = leerAddon(fila);
    if (!a) continue;
    porRancho.set(a.rancho_id, [...(porRancho.get(a.rancho_id) ?? []), a]);
  }

  // ── Las tarjetas: cuántas ocupan cupo y cuántas están operando ─────
  // El criterio de «ocupa cupo» es el mismo de `cupo-tarjetas.ts`
  // (archivada = no, todo lo demás sí). Se repite la comparación acá y
  // no se importa aquel módulo porque vive dentro de la ruta del panel
  // del negocio, pero el criterio es literalmente `estadoVisible`.
  const ahoraCR = minutoISOCR();
  const tarjetasPorRancho = new Map<string, { ocupan: number; activas: number }>();
  const programasPlanos: { id: string; rancho_id: string | null }[] = [];
  for (const p of (programasRes.data ?? []) as Record<string, unknown>[]) {
    const id = typeof p.id === "string" ? p.id : null;
    const ranchoId = typeof p.rancho_id === "string" ? p.rancho_id : null;
    if (id) programasPlanos.push({ id, rancho_id: ranchoId });
    if (!ranchoId) continue;
    const estado = estadoVisible(
      {
        estado: typeof p.estado === "string" ? p.estado : null,
        activo: p.activo === true,
        vigente_desde: typeof p.vigente_desde === "string" ? p.vigente_desde : null,
        vigente_hasta: typeof p.vigente_hasta === "string" ? p.vigente_hasta : null,
      },
      ahoraCR,
    );
    const acc = tarjetasPorRancho.get(ranchoId) ?? { ocupan: 0, activas: 0 };
    if (estado !== "archivado") acc.ocupan += 1;
    if (estado === "activo") acc.activas += 1;
    tarjetasPorRancho.set(ranchoId, acc);
  }
  // Si las tarjetas vinieron cortadas, los conteos de tarjetas son
  // parciales y NO se muestran: un tope de tarjetas calculado sobre
  // datos incompletos haría avisar de cosas que no pasan (y callar las
  // que sí).
  const tarjetasCompletas = (programasRes.count ?? programasPlanos.length) <= programasPlanos.length;

  // ── Los clientes de cada negocio ───────────────────────────────────
  // Una consulta (0173) en vez de traer `miembros` entera a memoria.
  const clientes = await clientesPorNegocio(admin, programasPlanos);

  // ── El plan que MANDA ──────────────────────────────────────────────
  const planDeCuenta = new Map<string, string | null>();
  const cuentaDeRancho = new Map<string, string>();
  for (const c of (cuentasRes.data ?? []) as {
    id: string;
    rancho_id: string | null;
    plan: string | null;
  }[]) {
    if (!c.rancho_id) continue;
    cuentaDeRancho.set(c.rancho_id, c.id);
    planDeCuenta.set(c.rancho_id, c.plan ?? null);
  }

  // ── Quién paga con tarjeta ─────────────────────────────────────────
  // La suscripción puede colgar del rancho o de la cuenta (0143), así
  // que se resuelven las dos. El mapa inverso evita recorrer todas las
  // cuentas por cada suscripción.
  const ranchoDeCuenta = new Map<string, string>();
  for (const [ranchoId, cuentaId] of cuentaDeRancho) ranchoDeCuenta.set(cuentaId, ranchoId);

  const stripePorRancho = new Map<string, string>();
  for (const s of (suscripcionesRes.data ?? []) as {
    rancho_id: string | null;
    cuenta_id: string | null;
    estado: string | null;
  }[]) {
    const estado = s.estado ?? null;
    if (!estado) continue;
    if (s.rancho_id) stripePorRancho.set(s.rancho_id, estado);
    const porCuenta = s.cuenta_id ? ranchoDeCuenta.get(s.cuenta_id) : undefined;
    if (porCuenta) stripePorRancho.set(porCuenta, estado);
  }

  // ── El último movimiento de paquete de cada negocio (0173) ─────────
  // La bitácora viene ordenada de nuevo a viejo, así que la PRIMERA fila
  // de cada negocio es la última que pasó.
  const filasHistorial = (historialRes.data ?? []) as FilaHistorial[];
  const ultimoDe = new Map<string, FilaHistorial>();
  for (const h of filasHistorial) {
    if (!ultimoDe.has(h.rancho_id)) ultimoDe.set(h.rancho_id, h);
  }

  // Los nombres de los admins que movieron algo, más los dueños y
  // solicitantes de las bandejas: TODOS en una sola consulta a perfiles.
  const enRevision = filasRanchoTodas.filter(
    (r) => "lealtad_aprobado_en" in r && r.lealtad_aprobado_en === null,
  );
  const filasSolicitud = (solicitudesRes.data ?? []) as FilaSolicitud[];
  const idsPersona = [
    ...new Set(
      [
        ...enRevision.map((r) => r.owner_id),
        ...filasSolicitud.map((s) => s.solicitante_id),
        ...[...ultimoDe.values()].map((h) => h.autor_id),
      ].filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const { data: perfiles } = idsPersona.length
    ? await admin.from("perfiles").select("id, nombre, email").in("id", idsPersona)
    : { data: [] };
  const perfilDe = new Map(
    ((perfiles ?? []) as { id: string; nombre: string | null; email: string | null }[]).map((p) => [
      p.id,
      p,
    ]),
  );
  const nombreDe = (id: string | null): string | null => {
    if (!id) return null;
    const p = perfilDe.get(id);
    if (!p) return null;
    return (p.nombre ?? "").trim() || p.email || null;
  };

  // ── La lista ───────────────────────────────────────────────────────
  const negocios: NegocioConAddons[] = filasRanchoTodas
    // NO se filtra por sección acá: se le pasan todos al panel, que
    // aplica la sección como filtro VISIBLE y la ignora al buscar.
    // Filtrarlos en el servidor dejaba a un negocio invisible en la
    // única pantalla desde la que se le puede vender el primer plan, y
    // sin ninguna pista de que estaba escondido.
    .map((r) => {
      const planRancho = r.plan_lealtad ?? null;
      const planCuenta = planDeCuenta.get(r.id) ?? null;
      const tarjetas = tarjetasPorRancho.get(r.id) ?? { ocupan: 0, activas: 0 };
      const h = ultimoDe.get(r.id) ?? null;
      const movimiento: MovimientoPlan | null = h
        ? {
            concepto: h.concepto,
            motivo: h.motivo ?? null,
            plan: h.plan_despues ?? null,
            cortesiaHasta: h.cortesia_hasta ?? null,
            creadoEn: h.creado_en,
            autor: nombreDe(h.autor_id),
          }
        : null;

      return {
        id: r.id,
        nombre: r.nombre,
        slug: r.slug ?? null,
        vertical: r.vertical,
        estado: r.estado ?? null,
        addons: porRancho.get(r.id) ?? [],
        // El plan EFECTIVO, con la misma función que usa el resto del
        // módulo. Mostrar `ranchos.plan_lealtad` a secas hacía que la
        // pantalla dijera un paquete y el negocio operara con otro.
        planLealtad: planEfectivo({ planCuenta, planRancho }),
        planRancho,
        planCuenta,
        tieneCuenta: cuentaDeRancho.has(r.id),
        miembros: clientes.porNegocio.get(r.id) ?? 0,
        tarjetas: tarjetasCompletas ? tarjetas.ocupan : null,
        tarjetasActivas: tarjetasCompletas ? tarjetas.activas : null,
        creadoEn: r.created_at ?? null,
        stripe: stripePorRancho.get(r.id) ?? null,
        movimiento,
      };
    });

  // La bandeja de negocios EN REVISIÓN (0129): creados pero sin el
  // visto bueno. Si la columna no existe todavía, no hay bandeja.
  const FECHA_CORTA = new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Costa_Rica",
  });
  const negociosEnRevision: NegocioEnRevision[] = enRevision.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    vertical: r.vertical,
    creador: (perfilDe.get(r.owner_id)?.nombre ?? "").trim() || "(sin nombre)",
    correo: perfilDe.get(r.owner_id)?.email ?? "—",
    fecha: r.created_at ? FECHA_CORTA.format(new Date(r.created_at)) : "—",
  }));

  const nombreRancho = new Map(filasRanchoTodas.map((r) => [r.id, r.nombre]));
  const solicitudes: SolicitudPendiente[] = filasSolicitud.map((s) => ({
    id: s.id,
    ranchoId: s.rancho_id,
    negocio: s.rancho_id
      ? (nombreRancho.get(s.rancho_id) ?? "(negocio)")
      : (s.negocio_nombre ?? "(negocio nuevo)"),
    esAlta: !s.rancho_id,
    personalizado: s.personalizado === true,
    tipoNegocio:
      s.negocio_vertical === "otro" && s.negocio_detalle
        ? `otro — ${s.negocio_detalle}`
        : (s.negocio_vertical ?? null),
    plan: s.plan,
    solicitante: (perfilDe.get(s.solicitante_id)?.nombre ?? "").trim() || "(sin nombre)",
    correo: perfilDe.get(s.solicitante_id)?.email ?? "—",
    telefono: s.telefono,
    mensaje: s.mensaje,
    metodoPago: s.metodo_pago ?? null,
    comprobanteUrl: s.comprobante_url ?? null,
    fecha: FECHA_CORTA.format(new Date(s.created_at)),
  }));

  // Los pedidos de AYUDA CON EL DISEÑO (0149), sin cerrar. El nombre
  // del negocio se resuelve con el mapa que ya se armó arriba: la
  // lectura no vuelve a consultar `ranchos`. Si la migración no corrió,
  // `hilosAbiertosDeAyuda` devuelve [] y la bandeja no se muestra.
  const hilosAyuda: HiloConNegocio[] = (await hilosAbiertosDeAyuda(admin)).map((h) => ({
    ...h,
    negocio: nombreRancho.get(h.ranchoId) ?? "(negocio)",
  }));

  // Los contadores del encabezado se calculan sobre TODO lo cargado, no
  // sobre lo que el filtro de sección deje ver: son el estado del
  // módulo, no el de una pestaña.
  let activos = 0;
  let vencidos = 0;
  let cortesias = 0;
  for (const n of negocios) {
    for (const a of n.addons) {
      const estado = estadoDeAddon(a);
      if (estado === "activo") activos += 1;
      if (estado === "vencido") vencidos += 1;
      if (estado === "activo" && a.es_cortesia) cortesias += 1;
    }
    if (n.movimiento?.concepto === "cortesia" && n.movimiento.plan === n.planLealtad) {
      cortesias += 1;
    }
  }

  const faltaLaBitacora = Boolean(historialRes.error);

  return (
    <div>
      <Encabezado seccion={seccion} activos={activos} vencidos={vencidos} cortesias={cortesias} />

      {addonsRes.error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los complementos: {addonsRes.error.message}. Si dice que
          la tabla no existe, falta correr <strong>0077_importar_agenda.sql</strong>.
        </p>
      )}

      <NegociosRevisionPanel negocios={negociosEnRevision} />
      <SolicitudesPanel solicitudes={solicitudes} />
      <AyudaPanel hilos={hilosAyuda} />
      <ComplementosPanel
        negocios={negocios}
        seccion={seccion}
        faltaLaBitacora={faltaLaBitacora}
        negociosOcultosPorTope={negociosOcultosPorTope}
        totalNegocios={totalNegocios}
        conteoTruncado={clientes.truncado}
        conteoAMano={clientes.fuente === "a_mano"}
        tarjetasCompletas={tarjetasCompletas}
      />
    </div>
  );
}

/** La fila de `ranchos` tal como la devuelve el `select *`. */
type FilaRanchoAdmin = {
  id: string;
  nombre: string;
  slug?: string | null;
  vertical: string | null;
  estado?: string | null;
  plan_lealtad?: string | null;
  owner_id: string;
  created_at?: string | null;
  lealtad_aprobado_en?: string | null;
};

type FilaSolicitud = {
  id: string;
  /** null = solicitud de ALTA (0130): el negocio se crea al aprobar. */
  rancho_id: string | null;
  solicitante_id: string;
  plan: string;
  telefono: string | null;
  mensaje: string | null;
  created_at: string;
  /** 0128; ausentes si esa migración no corrió. */
  metodo_pago?: string | null;
  comprobante_url?: string | null;
  /** 0130. */
  negocio_nombre?: string | null;
  negocio_vertical?: string | null;
  negocio_detalle?: string | null;
  personalizado?: boolean | null;
};

type FilaHistorial = {
  rancho_id: string;
  plan_despues: string | null;
  concepto: string;
  motivo: string | null;
  cortesia_hasta: string | null;
  autor_id: string | null;
  creado_en: string;
};

/**
 * Lee una fila cruda de `addons_negocio`.
 *
 * `es_cortesia` y `otorgado_por` son de la 0173 y pueden no estar: una
 * fila sin la columna se lee como NO regalada, que es lo que era antes
 * de que la columna existiera. Lo que no se hace es adivinarla leyendo
 * `notas` — la nota es prosa escrita a mano y deducir de ahí si algo se
 * regaló sería exactamente el número inventado que esta pantalla no
 * puede permitirse.
 */
function leerAddon(fila: Record<string, unknown>): FilaAddon | null {
  const ranchoId = typeof fila.rancho_id === "string" ? fila.rancho_id : null;
  const addon = typeof fila.addon === "string" ? fila.addon : null;
  if (!ranchoId || !addon) return null;
  return {
    rancho_id: ranchoId,
    addon,
    activo: fila.activo === true,
    vence_en: typeof fila.vence_en === "string" ? fila.vence_en : null,
    notas: typeof fila.notas === "string" ? fila.notas : null,
    activado_en: typeof fila.activado_en === "string" ? fila.activado_en : null,
    es_cortesia: fila.es_cortesia === true,
  };
}

function Encabezado({
  seccion,
  activos,
  vencidos,
  cortesias,
}: {
  seccion: SeccionAdmin;
  activos: number;
  vencidos: number;
  cortesias: number;
}) {
  return (
    <div className="mb-6">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Monetización{seccion !== "todas" ? ` · ${SECCION_LABEL[seccion]}` : ""}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Lealtad y complementos</h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        {activos} complemento{activos === 1 ? "" : "s"} activo{activos === 1 ? "" : "s"}
        {vencidos > 0 ? ` · ${vencidos} vencido${vencidos === 1 ? "" : "s"}` : ""}
        {cortesias > 0 ? ` · ${cortesias} de regalía` : ""}. Qué paquete tiene cada negocio,
        qué se le está cobrando y qué se le está regalando.
      </p>
    </div>
  );
}
