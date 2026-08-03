import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import SelectorVertical from "@/components/selector-vertical";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import type { Rancho } from "@/app/mi-negocio/types";

export const metadata = {
  title: "Booking Hospedajes — Bookea",
  description:
    "Casas, villas, cabañas y hoteles en Costa Rica — reservá tu estadía directo, sin intermediarios.",
};

/**
 * El directorio de la vertical de Hospedajes: mismo lienzo, mismo
 * conmutador y las mismas cards que el resto del ecosistema. Mientras
 * no haya negocios aprobados muestra el estado vacío con el CTA de
 * publicar (el alta de hospedajes ya funciona).
 */
export default async function HospedajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ranchosData } = await supabase
    .from("ranchos")
    .select("*")
    .eq("vertical", "hospedajes")
    .eq("estado", "aprobado")
    .order("destacado_orden", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  const hospedajes = (ranchosData ?? []) as Rancho[];

  const [{ data: califData }, favoritosRes] = await Promise.all([
    hospedajes.length
      ? supabase
          .from("calificaciones_rancho")
          .select("rancho_id, promedio, total")
          .in(
            "rancho_id",
            hospedajes.map((h) => h.id),
          )
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("favoritos").select("rancho_id").eq("cliente_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);
  const califPorRancho = new Map(
    ((califData ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );
  const favoritos = new Set(
    ((favoritosRes.data ?? []) as { rancho_id: string }[]).map((f) => f.rancho_id),
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Hospedajes" />

      <section className="pb-16 pt-4">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
          <h1 className="sr-only">Booking Hospedajes — Costa Rica</h1>
          <div className="mb-4">
            <SelectorVertical />
          </div>

          {hospedajes.length === 0 ? (
            <div className="bento bento-blanco mx-auto mt-8 max-w-[560px] p-10 text-center">
              <p className="text-[15px] font-extrabold text-aventurea-ink">
                Los primeros hospedajes están por llegar
              </p>
              <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                Estamos abriendo esta vertical. ¿Tenés una casa, villa,
                cabaña u hotel? Publicalo gratis y recibí reservas con tu
                propia página.
              </p>
              <Link href="/mi-negocio/nuevo/hospedajes" className="btn-naranja mt-6">
                Publicar mi hospedaje
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {hospedajes.map((h, i) => (
                <RanchoCard
                  key={h.id}
                  rancho={h}
                  index={i}
                  calificacion={califPorRancho.get(h.id) ?? null}
                  favoritoInicial={favoritos.has(h.id)}
                  sesionActiva={!!user}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
