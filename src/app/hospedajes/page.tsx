import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import SelectorVertical from "@/components/selector-vertical";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import type { Rancho } from "@/app/mi-negocio/types";
import { COLUMNAS_CARD } from "@/lib/ranchos-publicos";

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

  // Tres tandas a Supabase se vuelven una. `auth.getUser()` estaba
  // esperando sola al principio (para un anónimo no sale a la red, pero
  // para quien tiene sesión era una ida y vuelta entera antes de
  // empezar), y las calificaciones filtraban por los ids de los
  // hospedajes solo para ahorrarse filas: hoy la tabla entera pesa
  // 2 bytes cuando está vacía, así que traerla completa y cruzarla acá
  // sale ~55 ms más barato que esperar la consulta anterior.
  const [
    {
      data: { user },
    },
    { data: ranchosData },
    { data: califData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    // Las mismas columnas que /eventos, y por el mismo motivo: con
    // `select("*")` este directorio le servía a cualquier anónimo el
    // SINPE y la cuenta bancaria de TODOS los hospedajes de la lista,
    // no de uno (ver el comentario grande de @/lib/ranchos-publicos).
    supabase
      .from("ranchos")
      .select(COLUMNAS_CARD)
      .eq("vertical", "hospedajes")
      .eq("estado", "aprobado")
      .order("destacado_orden", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
  ]);
  // Mismo cast (y mismo motivo) que /eventos: la tarjeta pide el tipo
  // `Rancho` completo pero solo lee las columnas de COLUMNAS_CARD.
  const hospedajes = (ranchosData ?? []) as unknown as Rancho[];

  const favoritosRes = user
    ? await supabase.from("favoritos").select("rancho_id").eq("cliente_id", user.id)
    : { data: [] };
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
