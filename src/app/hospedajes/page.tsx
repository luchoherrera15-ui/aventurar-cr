import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import type { Rancho } from "@/app/mi-negocio/types";
import { COLUMNAS_CARD } from "@/lib/ranchos-publicos";
import {
  CATEGORIA_HOSPEDAJE_LABEL,
  normalizarCategoriaHospedaje,
} from "@/app/booking/tipos";

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
 *
 * ── `?categoria=` (ago 2026) ──────────────────────────────────────
 *
 * Este era el ÚNICO de los cuatro directorios que ignoraba el
 * parámetro: /eventos, /citas y /restaurantes ya filtraban por él. Se
 * sumó cuando la portada pasó a desplegar los rubros de cada vertical
 * (`src/components/home/nav-categorias.tsx`) — un link de «Cabaña» que
 * abriera la lista entera sin filtrar sería un link que miente.
 *
 * Se filtra EN LA CONSULTA y no en memoria, a diferencia de /citas y
 * /restaurantes: esos dos necesitan la lista completa para contar
 * cuántos hay por rubro en sus carriles; este no tiene carriles, así
 * que traer filas para descartarlas sería trabajo regalado.
 *
 * Un valor que no esté en CATEGORIAS_HOSPEDAJES cae en `null` —
 * `normalizarCategoriaHospedaje` ya devuelve `null` para lo
 * desconocido— y la página muestra todo, en vez de una lista vacía por
 * un typo en la URL.
 */
export default async function HospedajesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string | string[] }>;
}) {
  const params = await searchParams;
  const crudo = params.categoria;
  const categoria = normalizarCategoriaHospedaje(
    (Array.isArray(crudo) ? crudo[0] : crudo) ?? null,
  );

  const supabase = await createClient();

  // La consulta se arma antes del `Promise.all` porque el `.eq` de la
  // categoría es CONDICIONAL, y encadenarlo con un ternario adentro del
  // arreglo deja la expresión ilegible.
  const consultaBase = supabase
    .from("ranchos")
    // Las mismas columnas que /eventos, y por el mismo motivo: con
    // `select("*")` este directorio le servía a cualquier anónimo el
    // SINPE y la cuenta bancaria de TODOS los hospedajes de la lista,
    // no de uno (ver el comentario grande de @/lib/ranchos-publicos).
    .select(COLUMNAS_CARD)
    .eq("vertical", "hospedajes")
    .eq("estado", "aprobado")
    // Faltaba (2 sep 2026): las demos sembradas se colaban acá.
    .neq("en_marketplace", false);

  const consultaHospedajes = (categoria
    ? consultaBase.eq("categoria", categoria)
    : consultaBase
  )
    .order("destacado_orden", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

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
    consultaHospedajes,
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

          {/* El filtro activo se DICE. Un directorio que muestra menos
              de lo que tiene sin avisar por qué se lee como un
              directorio vacío, y la salida tiene que estar a un clic. */}
          {categoria && (
            <p className="mb-4 flex flex-wrap items-center gap-2 text-[13.5px] text-aventurea-ink-soft">
              <span className="rounded-lg border border-aventurea-line bg-white px-3 py-1.5 font-bold text-aventurea-ink">
                {CATEGORIA_HOSPEDAJE_LABEL[categoria]}
              </span>
              <Link
                href="/hospedajes"
                className="font-bold text-aventurea-navy underline underline-offset-4 hover:text-bookea-naranja-fuerte"
              >
                Ver todos los hospedajes
              </Link>
            </p>
          )}

          {hospedajes.length === 0 ? (
            <div className="bento bento-blanco mx-auto mt-8 max-w-[560px] p-10 text-center">
              <p className="text-[15px] font-extrabold text-aventurea-ink">
                {/* Con el rubro entre comillas y no metido en la frase:
                    los seis labels no comparten género ni número
                    («Villa», «Hotel o bed & breakfast»), y cualquier
                    plantilla que los conjugue queda mal en la mitad. */}
                {categoria
                  ? `Todavía no hay hospedajes en «${CATEGORIA_HOSPEDAJE_LABEL[categoria]}»`
                  : "Los primeros hospedajes están por llegar"}
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
