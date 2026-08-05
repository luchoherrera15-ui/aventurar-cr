import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BalancePanel from "../balance/balance-panel";
import type { Gasto, RanchoBalance, ReservaBalance } from "../balance/types";
import IngresosPanel, { type Cobro } from "../ingresos/ingresos-panel";
import FinanzasTabs from "./finanzas-tabs";
import { esTabFinanzas } from "./pestanas";
import { perteneceASeccion, SECCION_LABEL } from "../vertical";
import { seccionActiva } from "../vertical-server";
import type { CobroNegocio } from "@/lib/cobro-plataforma";

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

  const [reservasRes, ranchosRes, gastosRes, configRes, pedidosRes] =
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
    ]);

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

  const cobros: Cobro[] = [];
  for (const p of pedidosRes.data ?? []) {
    const monto = Number(p.monto_crc ?? p.precio_crc ?? 0);
    if (!monto) continue;
    cobros.push({
      id: String(p.id),
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

      <FinanzasTabs
        inicial={esTabFinanzas(tab) ? tab : "alquileres"}
        alquileres={
          <div>
            {errores.length > 0 && (
              <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                No se pudo cargar todo: {errores.join(" · ")}
              </p>
            )}
            <BalancePanel
              reservas={reservas}
              ranchos={ranchos}
              gastosIniciales={(gastosRes.data ?? []) as Gasto[]}
              comisionInicial={Number(configRes.data?.comision_por_persona ?? 0)}
              seccion={seccion}
              cobros={cobrosNegocio}
            />
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
