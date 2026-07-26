import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NuevoRanchoForm from "./nuevo-rancho-form";

export default async function NuevoRanchoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data: existente } = await supabase
    .from("ranchos")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existente) redirect("/mi-rancho");

  return (
    <main className="mx-auto max-w-[640px] px-5 py-12">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Marketplace de ranchos
      </p>
      <h1 className="mt-2.5 text-2xl font-bold text-white">
        Contanos de tu rancho
      </h1>
      <p className="mt-1.5 max-w-[52ch] text-[13.5px] text-zinc-400">
        Completá estos datos básicos para publicarlo. Aventurea CR revisa
        cada rancho antes de que aparezca en el directorio público.
      </p>

      <NuevoRanchoForm />
    </main>
  );
}
