import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCategoria, type Rancho } from "../types";
import { resumenFinanciero, type Gasto, type ReservaFinanzas } from "@/lib/finanzas";
import FinanzasPanel from "./finanzas-panel";
import {
  agregarGasto,
  borrarGasto,
  marcarDepositoRecibido,
  registrarPagoFinal,
  revertirPagoFinal,
} from "./actions";

export default async function MiRanchoFinanzasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data: ranchoData } = await supabase
    .from("ranchos")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!ranchoData) redirect("/mi-rancho/nuevo");
  const rancho = {
    ...(ranchoData as Rancho),
    categoria: normalizarCategoria((ranchoData as Rancho).categoria),
  };

  const [reservasRes, gastosRes] = await Promise.all([
    supabase
      .from("reservas")
      .select(
        "id, fecha, nombre, tipo_evento, invitados, estado, monto_total, monto_cobrado_final, deposito_monto, deposito_validado, deposito_pagado_en, evento_pagado, saldo_pagado_en",
      )
      .eq("rancho_id", rancho.id)
      .neq("estado", "temporal")
      .order("fecha", { ascending: true }),
    supabase
      .from("gastos_rancho")
      .select("id, fecha, concepto, categoria, monto, nota")
      .eq("rancho_id", rancho.id)
      .order("fecha", { ascending: false }),
  ]);

  // Si las migraciones todavía no corrieron, las columnas nuevas no
  // existen y el select falla entero. Se avisa en vez de mostrar una
  // pantalla vacía que parezca "no vendiste nada".
  const errorEsquema = reservasRes.error ?? gastosRes.error;

  const reservas = (reservasRes.data ?? []) as ReservaFinanzas[];
  const gastos = (gastosRes.data ?? []) as Gasto[];
  const resumen = resumenFinanciero({ reservas, gastos });

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-12">
      <Link
        href="/mi-rancho"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver
      </Link>
      <h1 className="titulo mt-3 text-[30px] text-aventurea-orange-dark">
        Tus finanzas
      </h1>
      <p className="mb-7 mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        Cobrás en dos tiempos: el adelanto al reservar y el saldo el día del
        evento. Acá ves cuánto entró de verdad cada semana, cuánto te falta
        cobrar y qué eventos ya pasaron sin que se pagara el saldo.
      </p>

      {errorEsquema && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
          <strong>Faltan las migraciones.</strong> No se pudieron leer los
          datos económicos: {errorEsquema.message}. Corré{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
            supabase/aplicar-migraciones-pendientes.sql
          </code>{" "}
          en el SQL Editor de Supabase y volvé a entrar.
        </div>
      )}

      <FinanzasPanel
        resumen={resumen}
        gastos={gastos}
        onMarcarDeposito={marcarDepositoRecibido}
        onRegistrarPago={registrarPagoFinal}
        onRevertirPago={revertirPagoFinal}
        onAgregarGasto={agregarGasto}
        onBorrarGasto={borrarGasto}
      />
    </main>
  );
}
