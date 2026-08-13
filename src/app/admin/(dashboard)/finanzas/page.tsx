import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BalancePanel from "../balance/balance-panel";
import type { Gasto, RanchoBalance, ReservaBalance } from "../balance/types";
import IngresosPanel, { type Cobro } from "../ingresos/ingresos-panel";
import FinanzasTabs from "./finanzas-tabs";
import { esTabFinanzas } from "./pestanas";
import LibroCobrosPanel from "./libro-cobros-panel";
import { perteneceASeccion, SECCION_LABEL } from "../vertical";
import { seccionActiva } from "../vertical-server";
import type { CobroNegocio } from "@/lib/cobro-plataforma";
import {
  esTablaCobrosInexistente,
  MIGRACION_LIBRO,
  type CobroPlataforma,
} from "@/lib/libro-cobros";
import { definicionDe } from "@/lib/lealtad/planes";

/**
 * Finanzas: toda la plata de la plataforma en una sola pantalla.
 *
 *  - Alquileres: comisión de cada reserva confirmada, gastos y balance
 *    neto (filtrado por la sección elegida en el header).
 *  - Paquetes de promoción: todavía no se venden; queda la pestaña
 *    lista para cuando arranquen.
 *  - Invitaciones virtuales: cuánto entra por SINPE, transferencia y
 *    Stripe de los pedidos de invitaciones digitales. Es producto
 *    propio de Bookea, así que no se parte por sección.
 */
export default async function AdminFinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const seccion = await seccionActiva();

  const [reservasRes, ranchosRes, gastosRes, configRes, pedidosRes, libroRes] =
    await Promise.all([
      // Los montos hacen falta para la tarifa por % del evento (0098);
      // 'cumplida' entra porque en Citas la reserva atendida pasa a ese
      // estado y antes se caía del cálculo — un negocio de citas activo
      // se veía en ₡0.
      supabase
        .from("reservas")
        .select("id, fecha, invitados, rancho_id, estado, monto_total, monto_cobrado_final")
        .in("estado", ["confirmada", "cumplida"]),
      supabase.from("ranchos").select("id, nombre, vertical").order("nombre"),
      supabase.from("gastos").select("*").order("fecha", { ascending: false }),
      supabase
        .from("configuracion_plataforma")
        .select("comision_por_persona")
        .single(),
      // La tabla llegó con la 0075: si todavía no corrió, la pestaña lo
      // dice en vez de romperse.
      supabase
        .from("pedidos_invitacion")
        .select(
          "id, paquete, metodo_pago, monto_crc, precio_crc, estado, pagado_en, created_at, nombre_evento, contacto_nombre",
        )
        .not("metodo_pago", "is", null),
      // El LIBRO DE COBROS (0106). La migración la corre el dueño a
      // mano: mientras no exista la tabla, esto devuelve error y la
      // pantalla muestra el aviso en vez de romperse.
      supabase
        .from("cobros_plataforma")
        .select(
          "id, reserva_id, rancho_id, concepto, personas, tarifa, modelo, monto, estado, semana, cliente, fecha_evento, devengado_en, pagado_en, notas",
        )
        .order("semana", { ascending: true }),
    ]);

  // Los depósitos de los planes de lealtad (0126/0128). `select *`
  // porque metodo_pago/comprobante_url son de la 0128 y pueden faltar;
  // si la tabla entera no existe, la fuente simplemente queda vacía.
  const solicitudesLealtadRes = await supabase
    .from("solicitudes_lealtad")
    .select("*")
    .order("created_at", { ascending: false });

  // Los ingresos de la sección: solo reservas de negocios de esa vertical.
  const todosLosRanchos = (ranchosRes.data ?? []) as (RanchoBalance & {
    vertical?: string | null;
  })[];
  const verticalPorRancho = new Map(
    todosLosRanchos.map((r) => [r.id, r.vertical ?? null]),
  );
  const ranchos = todosLosRanchos.filter((r) =>
    perteneceASeccion(r.vertical, seccion),
  );
  const reservas = ((reservasRes.data ?? []) as ReservaBalance[]).filter((r) =>
    perteneceASeccion(r.rancho_id ? verticalPorRancho.get(r.rancho_id) : null, seccion),
  );

  // Tarifas propias por negocio (0098). La tabla tiene RLS sin
  // policies (solo la ve el admin de la plataforma), así que se lee
  // con la service key — y si la migración no corrió, queda vacío y
  // todo sigue con la tarifa global, sin romperse.
  let cobrosNegocio: CobroNegocio[] = [];
  const adminDb = createAdminClient();
  if (adminDb) {
    const { data: cobrosData, error: cobrosError } = await adminDb
      .from("cobro_negocio")
      .select("rancho_id, modelo, valor, notas")
      .in("rancho_id", ranchos.map((r) => r.id));
    if (cobrosError) {
      console.error("[admin-finanzas] No se pudo leer cobro_negocio:", cobrosError.message);
    } else {
      cobrosNegocio = (cobrosData ?? []) as CobroNegocio[];
    }
  }

  const errores = [reservasRes.error, ranchosRes.error, gastosRes.error]
    .filter(Boolean)
    .map((e) => e!.message);

  // --- El libro de cobros, filtrado por la sección del panel ---
  const faltaLibro = libroRes.error
    ? esTablaCobrosInexistente(libroRes.error)
    : false;
  // Un error que NO sea "falta la tabla" sí se cuenta como error real.
  if (libroRes.error && !faltaLibro) errores.push(libroRes.error.message);

  const cobrosLibro = ((libroRes.data ?? []) as CobroPlataforma[]).filter((c) =>
    perteneceASeccion(c.rancho_id ? verticalPorRancho.get(c.rancho_id) : null, seccion),
  );
  const nombrePorRancho: Record<string, string> = Object.fromEntries(
    todosLosRanchos.map((r) => [r.id, r.nombre]),
  );
  // "Hoy" en hora de Costa Rica, igual que el trigger que arma la
  // semana: si el servidor corre en UTC, después de las 6 p.m. de acá
  // ya sería el día siguiente y el corte semanal se correría solo.
  const hoyIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const cobros: Cobro[] = [];
  for (const p of pedidosRes.data ?? []) {
    const monto = Number(p.monto_crc ?? p.precio_crc ?? 0);
    if (!monto) continue;
    cobros.push({
      id: String(p.id),
      fuente: "invitaciones",
      concepto: String(p.nombre_evento ?? "Invitación"),
      cliente: String(p.contacto_nombre ?? ""),
      paquete: String(p.paquete ?? ""),
      metodo: (p.metodo_pago as Cobro["metodo"]) ?? "sinpe",
      monto,
      fecha: String(p.pagado_en ?? p.created_at ?? "").slice(0, 10),
      // Solo cuenta como verificado cuando el equipo revisó el pago.
      confirmado: ["pagado", "en_diseno", "entregado"].includes(String(p.estado)),
    });
  }

  // Los depósitos del plan de lealtad: el monto sale de la definición
  // del plan (el precio no se guarda en la fila — un solo lugar donde
  // cambiarlo), el método y la captura vienen de la 0128, y "verificado"
  // = un admin aprobó la solicitud. Las rechazadas no son ingreso.
  type SolicitudFila = {
    id: string;
    rancho_id: string;
    solicitante_id: string;
    plan: string;
    estado: string;
    created_at: string;
    metodo_pago?: string | null;
    comprobante_url?: string | null;
  };
  const solicitantesLealtad = new Map<string, string>();
  const filasLealtad = ((solicitudesLealtadRes.data ?? []) as SolicitudFila[]).filter(
    (s) => s.estado !== "rechazada" && (s.metodo_pago === "sinpe" || s.metodo_pago === "transferencia"),
  );
  if (filasLealtad.length > 0) {
    const { data: perfilesSol } = await supabase
      .from("perfiles")
      .select("id, nombre")
      .in("id", [...new Set(filasLealtad.map((s) => s.solicitante_id))]);
    for (const p of (perfilesSol ?? []) as { id: string; nombre: string | null }[]) {
      solicitantesLealtad.set(p.id, (p.nombre ?? "").trim());
    }
  }
  // Este panel cuadra COLONES, y los planes de Lealtad están tarifados
  // en DÓLARES (0133): el depósito SINPE se hace por un monto que fija
  // el tipo de cambio del día, que no está en el sistema. Sumar 9 a un
  // total en colones daría una cifra que parece plata y no lo es.
  //
  // Así que los depósitos de Lealtad se cuentan pero no se suman, y se
  // AVISA abajo: un total al que le faltan cobros sin decirlo se lee
  // como una caída de ventas que no ocurrió.
  const cobrosEnDolares = filasLealtad.filter(
    (s) => definicionDe(s.plan)?.precioMensual, // sin precio no hay monto que cuadrar
  ).length;

  cobros.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Panel Admin · {SECCION_LABEL[seccion]}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Finanzas</h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Todo el dinero de la plataforma en un solo lugar: lo que dejan los
        alquileres, lo que entra por invitaciones digitales y, más adelante,
        los paquetes de promoción.
      </p>

      {cobrosEnDolares > 0 && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <strong>
            {cobrosEnDolares} {cobrosEnDolares === 1 ? "depósito" : "depósitos"} de lealtad
          </strong>{" "}
          {cobrosEnDolares === 1 ? "quedó" : "quedaron"} fuera de estos totales:{" "}
          {cobrosEnDolares === 1 ? "corresponde" : "corresponden"} a planes tarifados en
          dólares y este panel cuadra colones. Para sumarlos hay que fijar el tipo de cambio
          con el que se cobra el SINPE.
        </p>
      )}

      <FinanzasTabs
        inicial={esTabFinanzas(tab) ? tab : "alquileres"}
        alquileres={
          <div className="flex flex-col gap-8">
            {errores.length > 0 && (
              <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                No se pudo cargar todo: {errores.join(" · ")}
              </p>
            )}

            {/* 1. Lo primero: lo que ya se debe y hay que cobrar. */}
            {faltaLibro ? (
              <AvisoLibroPendiente />
            ) : (
              <LibroCobrosPanel
                cobros={cobrosLibro}
                nombrePorRancho={nombrePorRancho}
                hoyIso={hoyIso}
              />
            )}

            {/* 2. Después: la proyección, el ranking y el simulador —
                que son otra cosa y la pantalla lo aclara. */}
            <div>
              <div className="mb-5 border-t border-aventurea-line pt-6">
                <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-ink-soft before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-ink-soft">
                  Lo que se ganaría
                </p>
                <h2 className="mt-1 text-[19px] font-bold text-aventurea-ink">
                  Proyección y análisis del periodo
                </h2>
                <p className="mt-1 max-w-[74ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
                  Esto <strong>no</strong> es plata que se deba: es una
                  simulación que aplica la tarifa de hoy a las reservas del
                  periodo que elijás, para comparar negocios y probar modelos de
                  cobro. Lo que de verdad hay que cobrar está arriba.
                </p>
              </div>
              <BalancePanel
                reservas={reservas}
                ranchos={ranchos}
                gastosIniciales={(gastosRes.data ?? []) as Gasto[]}
                comisionInicial={Number(configRes.data?.comision_por_persona ?? 0)}
                seccion={seccion}
                cobros={cobrosNegocio}
              />
            </div>
          </div>
        }
        promocion={<PaquetesPromocion />}
        invitaciones={
          pedidosRes.error ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Todavía no existe la tabla de pedidos: corré la migración{" "}
              <strong>0075_pedidos_invitacion.sql</strong> en Supabase y esta
              pestaña empieza a llenarse sola.
            </p>
          ) : (
            <IngresosPanel cobros={cobros} />
          )
        }
      />
    </div>
  );
}

/**
 * La 0106 la pega el dueño a mano en el SQL Editor. Hasta que eso pase
 * no hay libro de cobros — y en vez de reventar la pantalla (o, peor,
 * mostrar ₡0 como si nadie debiera nada) se dice exactamente qué falta.
 */
function AvisoLibroPendiente() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
        Falta correr una migración
      </p>
      <h2 className="mt-1 text-[17px] font-bold text-amber-900">
        El libro de cobros todavía no existe en la base
      </h2>
      <p className="mt-2 max-w-[74ch] text-[13.5px] leading-relaxed text-amber-900">
        Acá va la cuenta por cobrar: cuánto dejó cada reserva confirmada, junto
        por semana y por negocio, con el botón para marcarla pagada. Para que
        empiece a llenarse sola hay que pegar este archivo en el SQL Editor de
        Supabase:
      </p>
      <p className="mt-3 overflow-x-auto rounded-lg bg-amber-100 px-3 py-2 font-mono text-[12.5px] text-amber-900">
        {MIGRACION_LIBRO}
      </p>
      <p className="mt-3 max-w-[74ch] text-[12.5px] text-amber-800">
        Crea la tabla <code>cobros_plataforma</code> y el disparador que anota
        el cobro cuando una reserva se confirma. Mientras tanto, lo de abajo
        sigue funcionando: es la proyección de siempre, no lo devengado.
      </p>
    </section>
  );
}

function PaquetesPromocion() {
  return (
    <div className="rounded-2xl border border-dashed border-aventurea-line bg-aventurea-surface p-8 text-center shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        Más adelante
      </p>
      <h2 className="mt-2 text-[17px] font-bold text-aventurea-ink">
        Paquetes de promoción
      </h2>
      <p className="mx-auto mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        Acá va a llevarse el control de la plata que dejen los paquetes que
        los negocios contraten para aparecer destacados: cuánto se vendió,
        qué negocio lo compró y hasta cuándo le corre. Todavía no se venden,
        así que la pestaña queda lista y vacía.
      </p>
    </div>
  );
}
