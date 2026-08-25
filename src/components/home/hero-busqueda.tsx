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
export default function HeroBusqueda() {
  return (
    <section
      className="relative isolate px-5 pb-28 pt-20 sm:pb-36 sm:pt-28"
      /* EL LAVADO ESTÁTICO, y sus paradas también están elegidas.
         Antes llegaba a blanco puro en el 64 % y de ahí seguía blanco:
         eso deja el último tercio de la sección plano, y contra el
         degradado de arriba se lee como un corte. Ahora se apaga con
         tres paradas y toca el blanco recién al final, así que el
         empalme con el catálogo es continuo. El `pb` largo le da a la
         máscara de la aurora dónde apagarse sin comerse el buscador. */
      style={{
        background: "linear-gradient(180deg,#fff4e6 0%,#fffaf3 46%,#fffdfa 76%,#ffffff 100%)",
      }}
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
        <RubrosIcono />
      </div>
    </section>
  );
}
