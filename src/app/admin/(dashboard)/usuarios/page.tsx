import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UsuariosPanel, { type PerfilRow } from "./usuarios-panel";
import AccesoDemo from "./acceso-demo";

export default async function AdminUsuariosPage() {
  const supabase = await createClient();

  const [{ data: userData }, perfilesRes, ranchosRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("perfiles").select("*").order("created_at", { ascending: false }),
    supabase.from("ranchos").select("owner_id, nombre, categoria, vertical"),
  ]);

  // Una cuenta puede tener más de un negocio, y no necesariamente todos
  // de la misma categoría (podría tener un rancho y además un catering) —
  // por eso el rol de la cuenta ("dueno_rancho") no dice de qué rubro es;
  // eso solo se sabe mirando sus negocios. Los negocios mezclan
  // vertical (Eventos/Citas/...): categoria queda tal cual llega de la
  // base (ya tiene CHECK constraint) y se muestra según su propio
  // vertical, no normalizada a la taxonomía de Eventos.
  const negociosPorDueno = new Map<
    string,
    { nombre: string; categoria: string; vertical: string | null }[]
  >();
  (ranchosRes.data ?? []).forEach((r) => {
    const lista = negociosPorDueno.get(r.owner_id as string) ?? [];
    lista.push({
      nombre: r.nombre as string,
      categoria: r.categoria as string,
      vertical: (r.vertical as string | null) ?? null,
    });
    negociosPorDueno.set(r.owner_id as string, lista);
  });

  /**
   * Los TELÉFONOS (pedido del dueño, 2 sep 2026). El WhatsApp nunca
   * vivió en `perfiles`: es metadata de auth desde el primer registro
   * (formulario-codigo-acceso.tsx la escribe). Se lee con la llave de
   * servicio paginando el listado de auth — 200 por página con tope de
   * 20 páginas (4.000 cuentas) para que un crecimiento raro no vuelva
   * esta pantalla un ciclo infinito. Sin llave de servicio, la columna
   * simplemente queda vacía y el resto del panel sigue igual.
   */
  const admin = createAdminClient();
  const telefonos = new Map<string, string>();
  if (admin) {
    for (let pagina = 1; pagina <= 20; pagina++) {
      const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        const w = (u.user_metadata as Record<string, unknown> | null)?.whatsapp;
        if (typeof w === "string" && w.trim()) telefonos.set(u.id, w.trim());
      }
      if (data.users.length < 200) break;
    }
  }

  const perfiles: PerfilRow[] = (perfilesRes.data ?? []).map((p) => ({
    id: p.id as string,
    email: p.email as string | null,
    nombre: p.nombre as string | null,
    whatsapp: telefonos.get(p.id as string) ?? null,
    rol: p.rol as PerfilRow["rol"],
    created_at: p.created_at as string,
    negocios: negociosPorDueno.get(p.id as string) ?? [],
  }));

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
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

      <AccesoDemo />

      <UsuariosPanel
        initialPerfiles={perfiles}
        puedeCrearCuentas={createAdminClient() !== null}
        miId={userData.user?.id ?? null}
      />
    </div>
  );
}
