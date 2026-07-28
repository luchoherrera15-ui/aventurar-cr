import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RanchosTable, { type RanchoConDueno } from "./ranchos-table";
import type { Rancho } from "@/app/mi-rancho/types";

export default async function AdminRanchosPage() {
  const supabase = await createClient();

  const [ranchosRes, perfilesRes] = await Promise.all([
    supabase.from("ranchos").select("*").order("created_at", { ascending: false }),
    supabase.from("perfiles").select("id, email"),
  ]);

  const emailPorId = new Map(
    (perfilesRes.data ?? []).map((p) => [p.id as string, p.email as string | null]),
  );

  const ranchos: RanchoConDueno[] = ((ranchosRes.data ?? []) as Rancho[]).map(
    (r) => ({ ...r, duenoEmail: emailPorId.get(r.owner_id) ?? null }),
  );

  const pendientes = ranchos.filter((r) => r.estado === "pendiente").length;
  const publicados = ranchos.filter((r) => r.estado === "aprobado").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
            Directorio
          </p>
          <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
            Salones y ranchos
          </h1>
          <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
            {publicados} publicado{publicados === 1 ? "" : "s"} ·{" "}
            {pendientes} pendiente{pendientes === 1 ? "" : "s"} de revisión.
          </p>
        </div>
        <Link
          href="/admin/ranchos/nuevo"
          className="rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
        >
          ＋ Agregar salón
        </Link>
      </div>

      {ranchosRes.error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los salones: {ranchosRes.error.message}
        </p>
      )}

      <RanchosTable initialRanchos={ranchos} />
    </div>
  );
}
