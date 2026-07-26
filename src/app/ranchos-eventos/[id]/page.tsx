import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_ICONO, CATEGORIA_LABEL, type Rancho } from "../../mi-rancho/types";
import { NOMBRE_RANCHO_AVENTUREA } from "../constants";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default async function RanchoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .eq("estado", "aprobado")
    .maybeSingle();

  if (!data) notFound();

  const rancho = data as Rancho;

  if (rancho.nombre === NOMBRE_RANCHO_AVENTUREA) {
    redirect("/eventos-salon");
  }

  const precio = fmtColones(rancho.precio_desde);
  const whatsappHref = rancho.contacto_whatsapp
    ? `https://wa.me/${rancho.contacto_whatsapp.replace(/[^0-9]/g, "")}`
    : null;

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-5 px-7 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aventurea-orange text-[14.5px] font-bold text-zinc-950">
              A
            </span>
            <span className="text-base font-bold text-aventurea-ink">AVENTUREA CR</span>
          </Link>
          <Link
            href="/ranchos-eventos"
            className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange"
          >
            ← Ver todos los espacios
          </Link>
        </div>
      </header>

      <section className="py-9 pb-16">
        <div className="mx-auto max-w-[720px] px-7">
          <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-[18px] border border-aventurea-line bg-gradient-to-br from-zinc-800 to-zinc-900">
            <span className="text-5xl opacity-25">{CATEGORIA_ICONO[rancho.categoria]}</span>
            {rancho.provincia && (
              <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white/80">
                {rancho.provincia}
                {rancho.canton ? ` · ${rancho.canton}` : ""}
              </span>
            )}
            <span className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white/80">
              {CATEGORIA_LABEL[rancho.categoria]}
            </span>
          </div>

          <h1 className="mt-5 text-[26px] font-bold text-aventurea-ink">
            {rancho.nombre}
          </h1>

          {rancho.descripcion && (
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
              {rancho.descripcion}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-aventurea-line bg-white p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Capacidad
              </div>
              <div className="mt-1 text-[14px] font-bold text-aventurea-ink">
                {rancho.capacidad_min || rancho.capacidad_max
                  ? `${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas`
                  : "A consultar"}
              </div>
            </div>
            <div className="rounded-xl border border-aventurea-line bg-white p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Precio desde
              </div>
              <div className="mt-1 text-[14px] font-bold text-aventurea-orange">
                {precio ?? "A consultar"}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[16px] border border-aventurea-line bg-white p-5">
            <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
              Este espacio todavía no tiene reservas en línea — escribile
              directamente para consultar disponibilidad.
            </p>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
              >
                Contactar por WhatsApp
              </a>
            ) : (
              <p className="mt-3 text-[13px] font-bold text-zinc-500">
                Este rancho todavía no dejó un contacto público.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
