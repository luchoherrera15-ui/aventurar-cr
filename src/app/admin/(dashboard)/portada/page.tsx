import { createClient } from "@/lib/supabase/server";
import SeccionesPanel from "./secciones-panel";
import { normalizarCategoria, type Categoria, type HomeSeccion } from "@/app/mi-rancho/types";

export default async function AdminPortadaPage() {
  const supabase = await createClient();

  const [{ data: seccionesData }, { data: ranchosData }] = await Promise.all([
    supabase.from("home_secciones").select("*").order("orden", { ascending: true }),
    supabase
      .from("ranchos")
      .select("id, nombre, categoria")
      .eq("estado", "aprobado")
      .order("nombre", { ascending: true }),
  ]);

  const secciones = (seccionesData ?? []) as HomeSeccion[];
  const ranchosDisponibles = ((ranchosData ?? []) as { id: string; nombre: string; categoria: string }[]).map(
    (r) => ({ ...r, categoria: normalizarCategoria(r.categoria) as Categoria }),
  );

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-orange-dark">Portada del sitio</h1>
      <p className="mb-6 mt-1 max-w-2xl text-[13.5px] text-aventurea-ink-soft">
        Los rieles que se ven en bookearcr.com al entrar. Mientras no armes ninguna sección acá, el
        home muestra un riel automático por categoría con los proveedores más recientes.
      </p>

      <SeccionesPanel initialSecciones={secciones} ranchosDisponibles={ranchosDisponibles} />
    </div>
  );
}
