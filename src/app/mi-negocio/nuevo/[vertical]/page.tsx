import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NuevoRanchoForm, { type Vertical } from "../nuevo-rancho-form";

const VERTICALES: Record<
  Vertical,
  { kicker: string; titulo: string; detalle: string }
> = {
  eventos: {
    kicker: "Eventos",
    titulo: "Contanos de tu negocio de eventos",
    detalle:
      "Salones, catering, música, decoración — completá estos datos y quedás pendiente de revisión.",
  },
  citas: {
    kicker: "Citas y Reservas",
    titulo: "Contanos de tu negocio de citas",
    detalle:
      "Estos son los datos básicos; el horario, tu equipo y los servicios con precio los configurás después en tu panel.",
  },
  hospedajes: {
    kicker: "Hospedajes",
    titulo: "Contanos de tu hospedaje",
    detalle:
      "El tipo de propiedad, dónde está y cuántos huéspedes recibe — las fotos y tarifas van después en tu panel.",
  },
  restaurantes: {
    kicker: "Restaurantes",
    titulo: "Contanos de tu restaurante",
    detalle:
      "Lo básico para tu perfil; el menú, las mesas y el horario los configurás después en tu panel.",
  },
};

/**
 * El registro de UNA vertical, elegida en el selector de
 * /mi-negocio/nuevo. Cada una es un formulario independiente con los
 * campos que le aplican.
 */
export default async function NuevoPorVerticalPage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  if (!(vertical in VERTICALES)) notFound();
  const v = vertical as Vertical;
  const textos = VERTICALES[v];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-negocio/login");

  return (
    <main className="mx-auto max-w-[640px] px-5 py-12">
      <Link
        href="/mi-negocio/nuevo"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Elegir otro tipo de negocio
      </Link>
      <p className="mt-3 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-bookea-azul before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
        {textos.kicker}
      </p>
      <h1 className="mt-2.5 text-2xl font-bold text-aventurea-ink">
        {textos.titulo}
      </h1>
      <p className="mt-1.5 max-w-[52ch] text-[13.5px] text-aventurea-ink-soft">
        {textos.detalle}
      </p>

      <NuevoRanchoForm vertical={v} />
    </main>
  );
}
