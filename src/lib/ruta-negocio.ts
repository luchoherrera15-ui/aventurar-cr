/**
 * DÓNDE VIVE PÚBLICAMENTE LA FICHA DE UN NEGOCIO.
 *
 * `/{slug}` no sirve para todos: los negocios de Citas y de
 * Restaurantes viven en `/citas/{slug}` y `/restaurantes/{slug}`, y
 * `src/app/[slug]/page.tsx` los REDIRIGE. O sea que enlazar a `/{slug}`
 * funciona, pero le regala a cada visita un viaje de ida y vuelta: el
 * navegador pide, el servidor contesta «andá a otro lado», y recién ahí
 * empieza la carga de verdad.
 *
 * ------------------------------------------------------------------
 * POR QUÉ VIVE ACÁ, EN UN ARCHIVO PROPIO
 * ------------------------------------------------------------------
 * Esta misma lógica llegó a estar escrita TRES veces: en el carrusel de
 * destacados, en los datos de la portada y —faltando— en la tarjeta del
 * directorio, que enlazaba a `/{slug}` para todo el mundo.
 *
 * No se pudo compartir antes porque la copia de la portada vive en un
 * módulo de servidor (`home-datos.ts` importa `next/headers` a través
 * del cliente de Supabase) y la tarjeta es un componente de cliente:
 * importar de allá para acá revienta el build. Este archivo es NEUTRO
 * —sin "use client", sin `next/headers`, sin imports de servidor— así
 * que los dos lados pueden usarlo.
 *
 * El día que aparezca una vertical nueva con ruta propia, se agrega
 * ACÁ y la portada, el carrusel y el directorio se enteran juntos.
 */

/** Lo mínimo que hace falta para saber a dónde va un negocio. */
export type NegocioEnlazable = {
  id: string;
  slug: string | null;
  vertical?: string | null;
};

export function rutaDeNegocio(negocio: NegocioEnlazable): string {
  // Sin slug no hay URL bonita: queda la ruta por id, que solo existe
  // en Eventos.
  if (!negocio.slug) return `/eventos/${negocio.id}`;

  switch (negocio.vertical ?? "eventos") {
    case "citas":
      return `/citas/${negocio.slug}`;
    case "restaurantes":
      return `/restaurantes/${negocio.slug}`;
    default:
      // Eventos y Hospedajes usan la URL corta de la raíz, que para
      // ellos NO redirige.
      return `/${negocio.slug}`;
  }
}
