import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReservasTable from "@/app/admin/(dashboard)/eventos/reservas-table";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";
import type { Rancho } from "../../types";
import { normalizarCategoria } from "../../types";

export default async function MiRanchoReservasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data: ranchoData } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!ranchoData) notFound();
  const rancho = {
    ...(ranchoData as Rancho),
    categoria: normalizarCategoria((ranchoData as Rancho).categoria),
  };

  if (rancho.categoria !== "lugares") {
    redirect(`/mi-rancho/${id}`);
  }

  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .eq("rancho_id", rancho.id)
    .neq("estado", "temporal")
    .order("fecha", { ascending: true });

  const reservas = (data ?? []) as Reserva[];
  const pendientes = reservas.filter((r) => r.estado === "pendiente").length;

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-12">
      <Link
        href={`/mi-rancho/${id}`}
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-aventurea-orange-dark">
        Tus reservas
      </h1>
      <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
        {pendientes} en aprobación · {reservas.length} en total.
      </p>

      {error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las reservas: {error.message}
        </p>
      )}

      <ReservasTable initialReservas={reservas} />
    </main>
  );
}
