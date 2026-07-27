import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutDueno } from "./actions";
import { IconPlus } from "@/components/icons";
import {
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  normalizarCategoria,
  type Rancho,
} from "./types";

const ESTADO_BADGE: Record<Rancho["estado"], string> = {
  pendiente: "bg-aventurea-orange/15 text-aventurea-orange",
  aprobado: "bg-aventurea-green/15 text-aventurea-green",
  rechazado: "bg-red-50 text-red-700",
};

const ESTADO_LABEL: Record<Rancho["estado"], string> = {
  pendiente: "Pendiente",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

export default async function MiRanchoHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const ranchos = ((data ?? []) as Rancho[]).map((r) => ({
    ...r,
    categoria: normalizarCategoria(r.categoria),
  }));

  // Nadie llega acá sin publicar nada todavía: el primer servicio se
  // arma con el formulario completo de onboarding, no con una card vacía.
  if (ranchos.length === 0) redirect("/mi-rancho/nuevo");

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-12">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
            Marketplace de ranchos
          </p>
          <h1 className="titulo mt-2.5 text-[26px] text-aventurea-orange-dark">
            Tus servicios y espacios
          </h1>
          <p className="mt-1 text-[13px] text-aventurea-ink-soft">
            Una misma cuenta puede ofrecer varias cosas — tu rancho, tu
            catering, un coffee bar. Cada uno con sus propias reservas y
            finanzas.
          </p>
        </div>
        <form action={logoutDueno}>
          <button
            type="submit"
            className="whitespace-nowrap rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ranchos.map((rancho) => (
          <Link
            key={rancho.id}
            href={`/mi-rancho/${rancho.id}`}
            className="group overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm transition hover:border-aventurea-orange/50 hover:shadow-md"
          >
            <div
              className="relative flex h-[110px] items-center justify-center bg-cover bg-center"
              style={
                rancho.foto_url
                  ? { backgroundImage: `url(${rancho.foto_url})` }
                  : { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
              }
            >
              {!rancho.foto_url && (
                <span className="opacity-30 [&_svg]:h-10 [&_svg]:w-10">
                  {CATEGORIA_ICONO[rancho.categoria]}
                </span>
              )}
              <span
                className={`absolute right-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold ${ESTADO_BADGE[rancho.estado]}`}
              >
                {ESTADO_LABEL[rancho.estado]}
              </span>
            </div>
            <div className="p-4.5">
              <h2 className="truncate text-[15px] font-bold text-aventurea-ink group-hover:text-aventurea-orange-dark">
                {rancho.nombre}
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-wide text-aventurea-orange">
                {CATEGORIA_LABEL[rancho.categoria]}
              </span>
              {rancho.provincia && (
                <p className="mt-1 text-[12px] text-zinc-500">{rancho.provincia}</p>
              )}
            </div>
          </Link>
        ))}

        <Link
          href="/mi-rancho/nuevo"
          className="group flex min-h-[220px] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-aventurea-line p-6 text-center text-aventurea-ink-soft transition hover:border-aventurea-orange hover:text-aventurea-orange"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-aventurea-cream-2 group-hover:bg-aventurea-orange/10">
            <IconPlus className="h-5 w-5" />
          </span>
          <span className="text-[13.5px] font-bold">Agregar otro servicio</span>
          <span className="max-w-[22ch] text-[11.5px] leading-relaxed">
            Catering, DJ, coffee bar, decoración... publicá algo más con esta
            misma cuenta.
          </span>
        </Link>
      </div>
    </main>
  );
}
