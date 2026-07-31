import { createClient } from "@/lib/supabase/server";
import IngresosPanel, { type Cobro } from "./ingresos-panel";

/**
 * Control de dineros: cuánto entra por SINPE, transferencia y Stripe,
 * día por día. Junta las dos fuentes reales de plata de la
 * plataforma — los depósitos de reservas y los pedidos de
 * invitaciones digitales — en una sola línea de tiempo.
 */
export default async function AdminIngresosPage() {
  const supabase = await createClient();

  const [reservasRes, pedidosRes] = await Promise.all([
    supabase
      .from("reservas")
      .select(
        "id, fecha, metodo_pago, deposito_monto, deposito_validado, deposito_pagado_en, monto_cobrado_final, evento_pagado",
      )
      .not("metodo_pago", "is", null),
    // La tabla llegó con la 0075: si todavía no corrió, el panel
    // muestra solo las reservas en vez de romperse.
    supabase
      .from("pedidos_invitacion")
      .select("id, metodo_pago, monto_crc, precio_crc, estado, pagado_en, created_at, nombre_evento")
      .not("metodo_pago", "is", null),
  ]);

  const cobros: Cobro[] = [];

  for (const r of reservasRes.data ?? []) {
    const monto = Number(r.deposito_monto ?? 0);
    if (!monto) continue;
    cobros.push({
      id: String(r.id),
      fuente: "reserva",
      concepto: "Depósito de reserva",
      metodo: (r.metodo_pago as Cobro["metodo"]) ?? "sinpe",
      monto,
      // La fecha en que entró la plata; si no quedó registrada, la
      // del evento como aproximación.
      fecha: String(r.deposito_pagado_en ?? r.fecha ?? "").slice(0, 10),
      confirmado: Boolean(r.deposito_validado),
    });

    // El saldo que se cobró al final del evento, si lo hubo.
    const saldo = Number(r.monto_cobrado_final ?? 0);
    if (saldo > 0 && r.evento_pagado) {
      cobros.push({
        id: `${r.id}-saldo`,
        fuente: "reserva",
        concepto: "Saldo del evento",
        metodo: (r.metodo_pago as Cobro["metodo"]) ?? "sinpe",
        monto: saldo,
        fecha: String(r.fecha ?? "").slice(0, 10),
        confirmado: true,
      });
    }
  }

  for (const p of pedidosRes.data ?? []) {
    const monto = Number(p.monto_crc ?? p.precio_crc ?? 0);
    if (!monto) continue;
    cobros.push({
      id: String(p.id),
      fuente: "invitacion",
      concepto: `Invitación · ${p.nombre_evento ?? "sin nombre"}`,
      metodo: (p.metodo_pago as Cobro["metodo"]) ?? "sinpe",
      monto,
      fecha: String(p.pagado_en ?? p.created_at ?? "").slice(0, 10),
      // Solo cuenta como confirmado cuando el equipo validó el pago.
      confirmado: ["pagado", "en_diseno", "entregado"].includes(String(p.estado)),
    });
  }

  cobros.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Control de dineros
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        Ingresos por método de pago
      </h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Cuánto entra por SINPE Móvil, transferencia y Stripe — depósitos de
        reservas y pedidos de invitaciones, día por día.
      </p>

      {pedidosRes.error && (
        <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Todavía no se ven los pedidos de invitaciones (falta correr la
          migración 0075). El resto de los cobros sí está al día.
        </p>
      )}

      <IngresosPanel cobros={cobros} />
    </div>
  );
}
