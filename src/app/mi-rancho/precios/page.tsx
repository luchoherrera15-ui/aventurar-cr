import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PreciosForm from "@/components/precios-form";
import DescuentosForm from "@/components/descuentos-form";
import TerminosForm from "@/components/terminos-form";
import HorariosForm from "@/components/horarios-form";
import {
  guardarPreciosPropio,
  guardarCodigosPropio,
  guardarPromocionesPropio,
  guardarTerminosPropio,
  guardarHorariosPropio,
} from "./actions";
import { normalizarCategoria } from "../types";
import type {
  CodigoDescuento,
  PrecioTier,
  PromocionDia,
  Rancho,
  ServicioAdicional,
} from "../types";

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
  const rancho = {
    ...(data as Rancho),
    categoria: normalizarCategoria((data as Rancho).categoria),
  };

  // Los precios por cantidad de invitados y los servicios adicionales son
  // parte del flujo de reserva en línea, que hoy solo tienen los lugares.
  // Los descuentos, en cambio, los puede usar cualquier negocio.
  const esLugar = rancho.categoria === "lugares";

  const [tiersRes, serviciosRes, codigosRes, promocionesRes] = await Promise.all([
    supabase
      .from("precio_tiers")
      .select("*")
      .eq("rancho_id", rancho.id)
      .order("min_invitados", { ascending: true }),
    supabase.from("servicios_adicionales").select("*").eq("rancho_id", rancho.id),
    supabase
      .from("codigos_descuento")
      .select("*")
      .eq("rancho_id", rancho.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("promociones_dia")
      .select("*")
      .eq("rancho_id", rancho.id)
      .order("created_at", { ascending: true }),
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
        {esLugar ? "Precios y descuentos" : "Códigos de descuento"}
      </h1>
      <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
        Lo que guardes acá se refleja al instante en tu página pública.
      </p>

      {esLugar && (
        <PreciosForm
          initialTiers={(tiersRes.data ?? []) as PrecioTier[]}
          initialServicios={(serviciosRes.data ?? []) as ServicioAdicional[]}
          initialTarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 0}
          initialDepositoReserva={rancho.deposito_reserva}
          onGuardar={guardarPreciosPropio}
        />
      )}

      {esLugar && (
        <>
          <h2 className="mb-1 mt-9 text-lg font-bold text-aventurea-orange-dark">
            Horarios de alquiler
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Vos definís en qué bloques alquilás y a qué hora entra y sale el
            cliente. Es lo que va a poder elegir al reservar.
          </p>
          <HorariosForm
            initialHorarios={rancho.horarios_bloques ?? []}
            onGuardar={guardarHorariosPropio}
          />
        </>
      )}

      <h2 className="mb-1 mt-9 text-lg font-bold text-aventurea-orange-dark">
        Descuentos y promociones
      </h2>
      <p className="mb-4 text-[13px] text-aventurea-ink-soft">
        Atraé más clientes con cupones y descuentos automáticos por día.
      </p>
      <DescuentosForm
        initialCodigos={(codigosRes.data ?? []) as CodigoDescuento[]}
        initialPromociones={(promocionesRes.data ?? []) as PromocionDia[]}
        onGuardarCodigos={guardarCodigosPropio}
        onGuardarPromociones={guardarPromocionesPropio}
      />

      <h2 className="mb-1 mt-9 text-lg font-bold text-aventurea-orange-dark">
        Términos y monto mínimo
      </h2>
      <p className="mb-4 text-[13px] text-aventurea-ink-soft">
        Las condiciones que el cliente acepta antes de contratarte. Te dejamos
        unas por defecto y las podés cambiar por las tuyas.
      </p>
      <TerminosForm
        initialTerminos={rancho.terminos ?? []}
        initialMontoMinimo={rancho.monto_minimo}
        depositoReserva={rancho.deposito_reserva}
        esLugar={esLugar}
        onGuardar={guardarTerminosPropio}
      />
    </main>
  );
}
