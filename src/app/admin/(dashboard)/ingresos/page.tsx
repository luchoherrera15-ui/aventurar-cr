import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import IngresosPanel, { type Cobro } from "./ingresos-panel";

/**
 * Control de dineros de INVITACIONES DIGITALES: cuánto entra por
 * SINPE, transferencia y Stripe, día por día.
 *
 * Ojo: acá solo vive la plata de las invitaciones. Las reservas de
 * ranchos y servicios llevan su propio control en /admin/balance y en
 * el panel de finanzas de cada negocio — no se mezclan.
 */
export default async function AdminIngresosPage() {
  const supabase = await createClient();

  // La tabla llegó con la 0075: si todavía no corrió, el panel lo
  // dice en vez de romperse.
  const { data, error } = await supabase
    .from("pedidos_invitacion")
    .select(
      "id, paquete, metodo_pago, monto_crc, precio_crc, estado, pagado_en, created_at, nombre_evento, contacto_nombre",
    )
    .not("metodo_pago", "is", null);

  const cobros: Cobro[] = [];
  for (const p of data ?? []) {
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
        Control de dineros · Invitaciones
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        Ingresos de invitaciones digitales
      </h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Cuánto entra por SINPE Móvil, transferencia y Stripe, día por día. Las
        reservas de negocios llevan su propio control en{" "}
        <Link href="/admin/balance" className="font-bold text-aventurea-navy hover:underline">
          Balance y finanzas
        </Link>
        .
      </p>

      {error ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Todavía no existe la tabla de pedidos: corré la migración{" "}
          <strong>0075_pedidos_invitacion.sql</strong> en Supabase y esta
          pantalla empieza a llenarse sola.
        </p>
      ) : (
        <IngresosPanel cobros={cobros} />
      )}
    </div>
  );
}
