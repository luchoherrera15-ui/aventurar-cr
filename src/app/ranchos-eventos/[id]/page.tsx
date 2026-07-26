import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  type Rancho,
} from "../../mi-rancho/types";
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
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");
  const puedeReservar = rancho.categoria === "salon";

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

      <section className="pb-16">
        <div className="relative flex h-[280px] items-end overflow-hidden sm:h-[360px]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={
              rancho.foto_url
                ? { backgroundImage: `url(${rancho.foto_url})` }
                : { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
            }
          />
          {!rancho.foto_url && (
            <span className="absolute inset-0 flex items-center justify-center text-7xl opacity-25">
              {CATEGORIA_ICONO[rancho.categoria]}
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

          <div className="relative mx-auto w-full max-w-[820px] px-7 pb-6">
            <div className="mb-2.5 flex flex-wrap gap-2">
              {rancho.provincia && (
                <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink">
                  {rancho.provincia}
                </span>
              )}
              <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white/90">
                {CATEGORIA_LABEL[rancho.categoria]}
              </span>
            </div>
            <h1 className="text-[26px] font-bold text-white drop-shadow-sm sm:text-[32px]">
              {rancho.nombre}
            </h1>
            {ubicacion && (
              <p className="mt-1 text-[13.5px] text-white/80">{ubicacion}</p>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-[820px] px-7">
          {rancho.descripcion && (
            <p className="mt-6 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
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
            {rancho.direccion_exacta && (
              <div className="col-span-2 rounded-xl border border-aventurea-line bg-white p-3.5 sm:col-span-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Dirección
                </div>
                <div className="mt-1 text-[13px] font-bold text-aventurea-ink">
                  {rancho.direccion_exacta}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-[16px] border border-aventurea-line bg-white p-5">
            {puedeReservar ? (
              <>
                <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
                  Elegí tu fecha, subí el comprobante del depósito y quedá en
                  aprobación al instante.
                </p>
                <Link
                  href={`/ranchos-eventos/${id}/reservar`}
                  className="mt-4 inline-flex rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  ¡Reservar ahora! →
                </Link>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
                Este espacio todavía no tiene reservas en línea — escribile
                directamente para consultar disponibilidad.
              </p>
            )}
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  puedeReservar
                    ? "mt-3 inline-flex rounded-full border border-aventurea-line px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange sm:ml-2.5 sm:mt-0"
                    : "mt-4 inline-flex rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                }
              >
                Contactar por WhatsApp
              </a>
            ) : (
              !puedeReservar && (
                <p className="mt-3 text-[13px] font-bold text-zinc-500">
                  Este negocio todavía no dejó un contacto público.
                </p>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
