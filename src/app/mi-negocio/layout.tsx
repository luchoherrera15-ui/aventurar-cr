import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saldoPendiente, type ReservaFinanzas } from "@/lib/finanzas";
import { hoyISOCR } from "@/lib/fechas";
import NotificacionesBell, { type NotificacionItem } from "./notificaciones-bell";

/**
 * Lo pendiente de TODOS los negocios de la cuenta (no solo el que
 * estés mirando), para la campana del menú — mismo criterio que antes
 * usaba `PendientesRancho` (mi-negocio/[id]/pendientes-rancho.tsx, hoy
 * solo por negocio) y `resumenFinanciero`/`saldoPendiente` (lib/
 * finanzas.ts), pero agregado entre negocios.
 */
async function cargarNotificaciones(): Promise<NotificacionItem[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: misRanchos } = await supabase
    .from("ranchos")
    .select("id, nombre")
    .eq("owner_id", user.id);
  const ranchos = misRanchos ?? [];
  if (ranchos.length === 0) return [];

  const nombrePorId = new Map(ranchos.map((r) => [r.id as string, r.nombre as string]));
  const hoy = hoyISOCR();
  const { data: reservas } = await supabase
    .from("reservas")
    .select(
      "id, rancho_id, nombre, fecha, estado, deposito_validado, deposito_monto, monto_total, monto_cobrado_final, evento_pagado",
    )
    .in("rancho_id", Array.from(nombrePorId.keys()))
    .in("estado", ["pendiente", "confirmada"]);

  const items: NotificacionItem[] = [];
  for (const r of (reservas ?? []) as (ReservaFinanzas & {
    id: string;
    rancho_id: string;
    nombre: string;
    estado: string;
    deposito_validado: boolean;
    deposito_monto: number | null;
  })[]) {
    const negocio = nombrePorId.get(r.rancho_id);
    if (!negocio) continue;
    if (r.estado === "pendiente") {
      items.push({
        id: `reserva-${r.id}`,
        texto: `${r.nombre || "Una reserva"} espera tu aprobación`,
        negocio,
        href: `/mi-negocio/${r.rancho_id}?tab=agenda`,
      });
    }
    if (!r.deposito_validado && Number(r.deposito_monto ?? 0) > 0) {
      items.push({
        id: `deposito-${r.id}`,
        texto: `Depósito de ${r.nombre || "una reserva"} sin validar`,
        negocio,
        href: `/mi-negocio/${r.rancho_id}?tab=finanzas`,
      });
    }
    if (r.estado === "confirmada" && r.fecha === hoy && saldoPendiente(r) > 0) {
      items.push({
        id: `cobrar-${r.id}`,
        texto: `${r.nombre || "Un evento"} de hoy tiene saldo por cobrar`,
        negocio,
        href: `/mi-negocio/${r.rancho_id}?tab=finanzas`,
      });
    }
  }
  return items;
}

export default async function MiRanchoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const notificaciones = await cargarNotificaciones();

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-5 px-7 py-3.5">
          <Link href="/eventos" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- el
                logo oficial es un PNG estático: next/image no aporta
                nada acá. */}
            <img src="/logo-bookea-v3.png" alt="Bookear" className="h-7 w-auto shrink-0" />
            <span className="text-zinc-300">/</span>
            <span className="text-[13px] font-light text-aventurea-ink-soft">
              Publicá tu negocio
            </span>
          </Link>
          <div className="flex items-center gap-3.5">
            {notificaciones !== null && <NotificacionesBell items={notificaciones} />}
            <Link
              href="/eventos"
              className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
