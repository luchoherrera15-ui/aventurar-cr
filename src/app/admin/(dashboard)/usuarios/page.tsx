import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarCategoria } from "@/app/mi-rancho/types";
import UsuariosPanel, { type PerfilRow } from "./usuarios-panel";

export default async function AdminUsuariosPage() {
  const supabase = await createClient();

  const [{ data: userData }, perfilesRes, ranchosRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("perfiles").select("*").order("created_at", { ascending: false }),
    supabase.from("ranchos").select("owner_id, nombre, categoria"),
  ]);

  // Una cuenta puede tener más de un negocio, y no necesariamente todos
  // de la misma categoría (podría tener un rancho y además un catering) —
  // por eso el rol de la cuenta ("dueno_rancho") no dice de qué rubro es;
  // eso solo se sabe mirando sus negocios.
  const negociosPorDueno = new Map<string, { nombre: string; categoria: string }[]>();
  (ranchosRes.data ?? []).forEach((r) => {
    const lista = negociosPorDueno.get(r.owner_id as string) ?? [];
    lista.push({ nombre: r.nombre as string, categoria: normalizarCategoria(r.categoria as string) });
    negociosPorDueno.set(r.owner_id as string, lista);
  });

  const perfiles: PerfilRow[] = (perfilesRes.data ?? []).map((p) => ({
    id: p.id as string,
    email: p.email as string | null,
    nombre: p.nombre as string | null,
    rol: p.rol as PerfilRow["rol"],
    created_at: p.created_at as string,
    negocios: negociosPorDueno.get(p.id as string) ?? [],
  }));

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-orange-dark">
        Cuentas y accesos
      </h1>
      <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
        {perfiles.length} cuenta{perfiles.length === 1 ? "" : "s"} registrada
        {perfiles.length === 1 ? "" : "s"}.
      </p>

      {perfilesRes.error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las cuentas: {perfilesRes.error.message}
        </p>
      )}

      <UsuariosPanel
        initialPerfiles={perfiles}
        puedeCrearCuentas={createAdminClient() !== null}
        miId={userData.user?.id ?? null}
      />
    </div>
  );
}
