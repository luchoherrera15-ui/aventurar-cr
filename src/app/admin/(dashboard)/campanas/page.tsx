import { createClient } from "@/lib/supabase/server";
import CampanasPanel, { type PerfilCampana } from "./campanas-panel";

export default async function AdminCampanasPage() {
  const supabase = await createClient();

  // Todas las cuentas con correo — las que entraron con Google también
  // tienen su email en perfiles, así que no hay que tratarlas distinto.
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, email, nombre, rol")
    .not("email", "is", null)
    .order("created_at", { ascending: false });

  const perfiles: PerfilCampana[] = (data ?? [])
    .filter((p) => Boolean(p.email))
    .map((p) => ({
      id: p.id as string,
      email: p.email as string,
      nombre: (p.nombre as string | null) ?? null,
      rol: p.rol as PerfilCampana["rol"],
    }));

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        Campañas de correo
      </h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Elegí a quiénes escribirles, armá el correo y envialo — sale con la
        plantilla de la marca a todas las cuentas seleccionadas.
      </p>

      {error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las cuentas: {error.message}
        </p>
      )}

      <CampanasPanel perfiles={perfiles} />
    </div>
  );
}
