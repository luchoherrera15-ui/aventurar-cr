import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditarRanchoForm from "./editar-form";
import type { Rancho } from "../../types";
import { normalizarCategoria } from "../../types";

export default async function EditarRanchoPage({
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

  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <main className="mx-auto max-w-[720px] px-5 py-12">
      <Link
        href={`/mi-rancho/${id}`}
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-aventurea-orange-dark">
        Editar mi publicación
      </h1>
      <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
        Los cambios se reflejan al instante en el directorio.
      </p>

      <EditarRanchoForm
        rancho={{
          ...(data as Rancho),
          categoria: normalizarCategoria((data as Rancho).categoria),
        }}
      />
    </main>
  );
}
