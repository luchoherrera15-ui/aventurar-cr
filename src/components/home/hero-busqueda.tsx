import BuscadorHero from "@/components/home/buscador-hero";

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
export default function HeroBusqueda() {
  return (
    <section
      className="relative isolate px-5 py-20 sm:py-28"
      // El lavado estático. Va en `style` y no como clase porque son dos
      // paradas exactas de un degradado puntual, no un token de marca
      // que se reuse en otro lado.
      style={{ background: "linear-gradient(180deg,#fff6ec 0%,#ffffff 64%)" }}
    >
      <div aria-hidden className="aurora-caja -z-10">
        <div className="aurora-mancha aurora-1" />
        <div className="aurora-mancha aurora-2" />
        <div className="aurora-mancha aurora-3" />
      </div>

      <div className="relative z-10 mx-auto max-w-[860px] text-center">
        <h1 className="titulo text-[clamp(32px,5.2vw,58px)] leading-[1.04] text-[color:var(--navy)]">
          ¿Qué querés reservar?
        </h1>
        <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-relaxed text-aventurea-ink-soft sm:text-[18px]">
          Encontrá servicios, experiencias y lugares cerca de ti.
        </p>

        <BuscadorHero />
      </div>
    </section>
  );
}
