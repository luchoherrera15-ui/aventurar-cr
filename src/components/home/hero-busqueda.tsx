import BuscadorHero from "@/components/home/buscador-hero";
import RubrosIcono from "@/components/home/rubros-icono";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL HÉROE DE LA PORTADA — la aurora naranja y el buscador
 * ════════════════════════════════════════════════════════════════════
 *
 * El buscador es la pieza principal de toda la página: lo que el dueño
 * pidió es que quien llega entienda de una que acá se reserva algo.
 *
 * ── EL FONDO: DOS CAPAS QUE HACEN COSAS DISTINTAS ───────────────────
 *
 * 1. Un lavado crema ESTÁTICO, en la propia sección. Se pinta una sola
 *    vez y da el piso cálido. Es lo que hace que el LCP —el h1, que es
 *    texto— caiga sobre un fondo ya pintado, sin depender de ninguna
 *    animación. Por eso las manchas móviles no necesitan alfa alta.
 *
 * 2. La AURORA: tres manchas de luz que derivan despacio (`aurora-*` en
 *    globals.css). Duraciones primas entre sí, así que el bucle no se
 *    repite en horas y el ojo nunca lo encuentra.
 *
 * ── ⚠️ EL RECORTE VIVE EN LA CAJA DE LA AURORA, NO EN LA <section> ──
 *
 * Es la tercera vez que este repo tropieza con lo mismo: con el
 * `overflow-hidden` en la sección, cualquier panel más alto que el héroe
 * queda cortado en seco. El mega menú del header es más alto que esto.
 * Por eso `aurora-caja` es un div propio con su propio recorte, y la
 * sección no recorta nada.
 *
 * Este archivo es de SERVIDOR y no lleva estado: el buscador, que sí lo
 * necesita, vive aparte en `buscador-hero.tsx`.
 */
export default function HeroBusqueda({
  /** El rubro que la URL está filtrando, para marcar su ícono. */
  rubroActivo = null,
}: {
  rubroActivo?: string | null;
}) {
  return (
    <section
      /* ⚠️ ESTE `pb` ES EL QUE DECIDE SI SE VE EL CATÁLOGO.
         Era `pb-28 sm:pb-36` y dejaba media pantalla de aire naranja
         entre los íconos y los negocios: había que scrollear para
         encontrar lo único que la portada tiene de verdad. El `pt`
         también bajó — el titular no necesita tanto respiro arriba
         cuando ya viene precedido por la franja navy y el header. */
      /* ⚠️ EL FONDO Y LA AURORA YA NO VIVEN ACÁ.
         Se subieron a `AtmosferaPortada` (page.tsx), que envuelve al
         header Y al héroe. El motivo es del dueño: «el blur naranja es
         estático, hacé que se mueva lentamente por todo el header» — y
         no podía, porque la aurora estaba encerrada en esta sección,
         que empieza DEBAJO del header. Una caja con `overflow: hidden`
         no puede pintar fuera de sí misma.
         El `pb` corto lo decide `AtmosferaPortada`, que ahora es quien
         le da a la máscara dónde apagarse. */
      className="relative px-5 pb-12 pt-12 sm:pb-16 sm:pt-16"
    >
      <div className="relative z-10 mx-auto max-w-[860px] text-center">
        <h1 className="titulo text-[clamp(32px,5.2vw,58px)] leading-[1.04] text-[color:var(--navy)]">
          ¿Qué querés reservar?
        </h1>
        <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-relaxed text-aventurea-ink-soft sm:text-[18px]">
          Encontrá servicios, experiencias y lugares cerca de ti.
        </p>

        <BuscadorHero />
        <RubrosIcono activo={rubroActivo} />
      </div>
    </section>
  );
}
