import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PreciosForm from "@/components/precios-form";
import { guardarPreciosPropio } from "./actions";
import type { PrecioTier, Rancho, ServicioAdicional } from "../types";

export default async function MiRanchoPreciosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) redirect("/mi-rancho/nuevo");
  const rancho = data as Rancho;

  if (rancho.categoria !== "salon") {
    redirect("/mi-rancho");
  }

  const [tiersRes, serviciosRes] = await Promise.all([
    supabase
      .from("precio_tiers")
      .select("*")
      .eq("rancho_id", rancho.id)
      .order("min_invitados", { ascending: true }),
    supabase.from("servicios_adicionales").select("*").eq("rancho_id", rancho.id),
  ]);

  return (
    <main className="mx-auto max-w-[820px] px-5 py-12">
      <Link
        href="/mi-rancho"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-aventurea-orange-dark">
        Precios y servicios
      </h1>
      <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
        Lo que guardes acá se refleja al instante en tu página pública de
        reservas.
      </p>

      <PreciosForm
        initialTiers={(tiersRes.data ?? []) as PrecioTier[]}
        initialServicios={(serviciosRes.data ?? []) as ServicioAdicional[]}
        initialTarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 0}
        initialDepositoReserva={rancho.deposito_reserva}
        onGuardar={guardarPreciosPropio}
      />
    </main>
  );
}
