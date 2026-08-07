import { Bloque, EsqueletoHeader } from "../esqueleto";

/**
 * El esqueleto de la página pública de un negocio de Eventos
 * (/rancholastorres, /eventos/[id]).
 *
 * Va como `fallback` de un `<Suspense>` DENTRO de la página, no como un
 * `loading.tsx`: /[slug] resuelve `notFound()` y `redirect()` según la
 * fila de `ranchos`, y si el armazón ya salió por el cable la cabecera
 * HTTP ya se mandó — un slug inexistente respondería 200 en vez de 404,
 * que para Google es una página basura indexable. Poniendo el Suspense
 * después de esa consulta, el estado queda decidido y igual se gana lo
 * importante: el `<head>` con los preloads de CSS y JS sale ~55 ms antes
 * (una ida y vuelta a Supabase) en vez de esperar a que carguen fotos,
 * precios, disponibilidad y reseñas.
 *
 * Medido en producción: en /rancholastorres NINGÚN recurso arrancaba
 * antes de los 948 ms — todo estaba detrás de esa espera.
 *
 * Calca la forma real: galería arriba, título con la línea de estrellas
 * y capacidad, columna de contenido y la tarjeta de precio pegada a la
 * derecha.
 */
export default function EsqueletoPortal() {
  return (
    <div className="min-h-screen bg-aventurea-cream-2">
      <EsqueletoHeader ancho="max-w-[1080px]" />

      {/* La galería: una foto grande a la izquierda y cuatro chicas */}
      <div className="mx-auto max-w-[1080px] px-7 pt-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Bloque className="aspect-[4/3] w-full rounded-2xl" />
          <div className="hidden grid-cols-2 gap-2 sm:grid">
            {Array.from({ length: 4 }, (_, i) => (
              <Bloque key={i} className="aspect-[4/3] w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-7 pt-6">
        <Bloque className="h-3 w-24" />
        <Bloque className="mt-2 h-8 w-[300px] max-w-full" />
        <Bloque className="mt-3 h-3.5 w-[420px] max-w-full" />

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <Bloque className="h-4 w-40" />
            <Bloque className="mt-3 h-3.5 w-full" />
            <Bloque className="mt-2 h-3.5 w-[92%]" />
            <Bloque className="mt-2 h-3.5 w-[78%]" />

            <Bloque className="mt-8 h-4 w-44" />
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Bloque key={i} className="h-8 w-[150px] rounded-lg" />
              ))}
            </div>

            <Bloque className="mt-8 h-4 w-48" />
            <Bloque className="mt-3 h-[132px] w-full rounded-2xl" />
          </div>

          {/* La tarjeta de reserva que acompaña el scroll */}
          <aside className="hidden lg:block">
            <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-6">
              <Bloque className="h-3 w-12" />
              <Bloque className="mt-2 h-7 w-36" />
              <div className="mt-4 flex flex-col gap-2 border-t border-aventurea-line pt-4">
                <Bloque className="h-3.5 w-40" />
                <Bloque className="h-3.5 w-48" />
                <Bloque className="h-3.5 w-44" />
              </div>
              <Bloque className="mt-5 h-12 w-full rounded-xl" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
