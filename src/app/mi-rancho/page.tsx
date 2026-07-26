import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutDueno } from "./actions";
import type { Rancho } from "./types";

const ESTADO_LABEL: Record<Rancho["estado"], string> = {
  pendiente: "Pendiente de aprobación",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

const ESTADO_BADGE: Record<Rancho["estado"], string> = {
  pendiente: "bg-aventurea-orange/15 text-aventurea-orange",
  aprobado: "bg-aventurea-green/15 text-aventurea-green",
  rechazado: "bg-red-50 text-red-700",
};

function fmtColones(n: number | null) {
  if (n === null) return "—";
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default async function MiRanchoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) redirect("/mi-rancho/nuevo");

  const rancho = data as Rancho;

  return (
    <main className="mx-auto max-w-[640px] px-5 py-12">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
            Marketplace de ranchos
          </p>
          <h1 className="mt-2.5 text-2xl font-bold text-aventurea-orange-dark">
            Tu salón / rancho
          </h1>
        </div>
        <form action={logoutDueno}>
          <button
            type="submit"
            className="rounded-full border border-aventurea-line bg-white px-4 py-2 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="rounded-[18px] border border-aventurea-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-aventurea-ink">{rancho.nombre}</h2>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-bold ${ESTADO_BADGE[rancho.estado]}`}
          >
            {ESTADO_LABEL[rancho.estado]}
          </span>
        </div>

        {rancho.estado === "pendiente" && (
          <p className="mt-3 rounded-[10px] bg-aventurea-orange/10 p-3 text-[13px] leading-relaxed text-aventurea-orange">
            Aventurea CR está revisando tu rancho. Te avisamos apenas quede
            publicado en el directorio.
          </p>
        )}
        {rancho.estado === "rechazado" && (
          <p className="mt-3 rounded-[10px] bg-red-50 p-3 text-[13px] leading-relaxed text-red-700">
            Tu rancho no fue aprobado todavía. Escribinos si querés más
            información.
          </p>
        )}

        {rancho.descripcion && (
          <p className="mt-4 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
            {rancho.descripcion}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-aventurea-cream-2 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Provincia
            </div>
            <div className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
              {rancho.provincia ?? "—"}
            </div>
          </div>
          <div className="rounded-xl bg-aventurea-cream-2 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Capacidad
            </div>
            <div className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
              {rancho.capacidad_min ?? "—"}–{rancho.capacidad_max ?? "—"}
            </div>
          </div>
          <div className="rounded-xl bg-aventurea-cream-2 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Precio desde
            </div>
            <div className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
              {fmtColones(rancho.precio_desde)}
            </div>
          </div>
          <div className="rounded-xl bg-aventurea-cream-2 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              WhatsApp
            </div>
            <div className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
              {rancho.contacto_whatsapp ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-[12.5px] text-zinc-500">
        Muy pronto vas a poder editar estos datos, subir fotos y administrar
        tus propias reservas desde acá.
      </p>
    </main>
  );
}
