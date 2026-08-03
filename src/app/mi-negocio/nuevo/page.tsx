import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IconClock, IconHouse, IconRancho } from "@/components/icons";

/**
 * El selector del alta: la persona elige QUÉ tipo de negocio tiene —
 * Eventos, Citas o Hospedajes — y cada card la lleva a SU registro
 * independiente (/mi-negocio/nuevo/[vertical]), porque cada vertical
 * pide información distinta. Mismas tres cards que la portada, en la
 * línea bento sobre el lienzo claro.
 */

const VERTICALES = [
  {
    id: "eventos",
    titulo: "Eventos",
    detalle:
      "Salones y fincas, catering, música, decoración — todo lo que se contrata para un evento.",
    pide: "Te pedimos el rubro, tu zona y (si es un lugar) la capacidad.",
    icono: <IconRancho />,
    color: "bg-aventurea-orange-light text-aventurea-orange",
    borde: "hover:border-aventurea-orange",
  },
  {
    id: "citas",
    titulo: "Citas y Reservas",
    detalle:
      "Salón de belleza, barbería, uñas, spa, consultorio — atendés con cita por hora.",
    pide: "Te pedimos el rubro y la dirección del local; el horario y tu equipo van después en el panel.",
    icono: <IconClock />,
    color: "bg-aventurea-blue-light text-aventurea-navy",
    borde: "hover:border-aventurea-navy",
  },
  {
    id: "hospedajes",
    titulo: "Hospedajes",
    detalle:
      "Casa, villa, hotel, cabaña — recibís huéspedes por estadía.",
    pide: "Te pedimos el tipo de hospedaje, la ubicación y cuántos huéspedes recibís.",
    icono: <IconHouse />,
    color: "bg-aventurea-blue-light text-aventurea-navy",
    borde: "hover:border-aventurea-navy",
  },
] as const;

export default async function NuevoRanchoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-negocio/login");

  const { count } = await supabase
    .from("ranchos")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const yaTieneAlgo = (count ?? 0) > 0;

  return (
    <main className="mx-auto max-w-[900px] px-5 py-12">
      {yaTieneAlgo && (
        <Link
          href="/mi-negocio"
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Todas tus publicaciones
        </Link>
      )}
      <p className="mt-3 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Publicá tu negocio
      </p>
      <h1 className="titulo mt-2.5 text-[28px] text-aventurea-ink sm:text-[34px]">
        ¿Qué tipo de negocio tenés?
      </h1>
      <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
        Cada tipo tiene su propio registro — solo te pedimos lo que aplica a
        tu negocio. Bookea revisa cada publicación antes de que aparezca en
        el directorio.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {VERTICALES.map((v) => (
          <Link
            key={v.id}
            href={`/mi-negocio/nuevo/${v.id}`}
            className={`group flex flex-col gap-3 rounded-3xl border border-aventurea-line bg-white p-6 shadow-[0_10px_36px_-24px_rgba(16,26,44,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_44px_-24px_rgba(16,26,44,0.45)] ${v.borde}`}
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6 ${v.color}`}
            >
              {v.icono}
            </span>
            <span className="text-[18px] font-extrabold tracking-[-0.3px] text-aventurea-ink">
              {v.titulo}
            </span>
            <span className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              {v.detalle}
            </span>
            <span className="mt-auto border-t border-aventurea-line/70 pt-3 text-[11.5px] leading-relaxed text-zinc-500">
              {v.pide}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-aventurea-orange">
              Empezar mi registro
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
