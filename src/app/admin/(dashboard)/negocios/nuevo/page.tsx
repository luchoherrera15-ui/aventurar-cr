import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NuevoRanchoAdminForm, {
  type DuenoOption,
} from "./nuevo-rancho-admin-form";

export default async function NuevoRanchoAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfiles")
    .select("id, email")
    .order("email", { ascending: true });

  const duenos = (data ?? []) as DuenoOption[];
  const puedeCrearCuentas = createAdminClient() !== null;

  return (
    <div>
      <Link
        href="/admin/negocios"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver a los salones
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-aventurea-ink">
        Agregar un salón
      </h1>
      <p className="mb-6 mt-1 max-w-[60ch] text-[13.5px] text-aventurea-ink-soft">
        Cargá un salón vos mismo y, si hace falta, creale la cuenta al dueño
        en el mismo paso.
      </p>

      <NuevoRanchoAdminForm
        duenos={duenos}
        puedeCrearCuentas={puedeCrearCuentas}
      />
    </div>
  );
}
