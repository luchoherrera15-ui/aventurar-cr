import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NuevoRanchoForm from "./nuevo-rancho-form";

export default async function NuevoRanchoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { count } = await supabase
    .from("ranchos")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const yaTieneAlgo = (count ?? 0) > 0;

  return (
    <main className="mx-auto max-w-[640px] px-5 py-12">
      {yaTieneAlgo && (
        <Link
          href="/mi-rancho"
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Todas tus publicaciones
        </Link>
      )}
      <p className="mt-3 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Salones para Eventos
      </p>
      <h1 className="mt-2.5 text-2xl font-bold text-aventurea-orange-dark">
        {yaTieneAlgo
          ? "Contanos del nuevo servicio"
          : "Contanos de tu salón o rancho"}
      </h1>
      <p className="mt-1.5 max-w-[52ch] text-[13.5px] text-aventurea-ink-soft">
        {yaTieneAlgo
          ? "Se publica aparte, con sus propias reservas y finanzas — no reemplaza lo que ya tenés."
          : "Completá estos datos básicos para publicarlo. Bookear CR revisa cada espacio antes de que aparezca en el directorio público."}
      </p>

      <NuevoRanchoForm />
    </main>
  );
}
