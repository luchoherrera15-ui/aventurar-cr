import CarruselTipos, { type TarjetaTipo } from "@/components/celebrar/carrusel-tipos";
import { FOTO_TIPO } from "@/lib/celebrar/fotos-tipos";
import { TIPOS_EN_PORTADA } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";

/**
 * Las ocasiones, en un carrusel de tarjetas con foto que pasa solo y se
 * puede arrastrar (la primera decisión de la plataforma: «¿qué
 * celebrás?»). Cada tarjeta abre el asistente con el tipo ya elegido.
 * Las fotos viven en `fotos-tipos.ts` (Unsplash, ids verificados).
 */
export default function Tipos() {
  const tarjetas: TarjetaTipo[] = TIPOS_EN_PORTADA.filter((t) => t.id !== "otro").map((t) => ({
    id: t.id,
    plural: t.plural,
    href: `${RUTA.appCrear}?tipo=${t.id}`,
    foto: FOTO_TIPO[t.id as keyof typeof FOTO_TIPO],
  }));

  return (
    <section
      id="tipos"
      aria-labelledby="tipos-titulo"
      className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="tipos-titulo" className="text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.1] text-(--c-tinta)">
          Para lo que estén celebrando
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-(--c-tinta-suave)">
          Elegí la ocasión y te mostramos primero los diseños que le quedan. La forma de invitar,
          confirmar y guardar es la misma para todas.
        </p>
      </div>

      <div className="mt-12">
        <CarruselTipos tarjetas={tarjetas} />
      </div>
    </section>
  );
}
