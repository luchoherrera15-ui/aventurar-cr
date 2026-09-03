"use client";

import { useRef } from "react";
import { TIPOS_TARJETA_LISTA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { planQueDesbloquea, tiposDelPlan } from "@/lib/lealtad/planes";
import { Icono, type NombreIcono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * PASO 1 DEL CREADOR: qué clase de tarjeta se va a hacer.
 *
 * Es una RADIOGROUP de verdad, no ocho divs con onClick. La diferencia
 * importa y no es cosmética:
 *
 *   · un lector de pantalla anuncia «grupo de opciones, 1 de 8» y el
 *     estado de cada una, en vez de leer ocho textos sueltos sin decir
 *     que hay que elegir uno;
 *   · las flechas del teclado mueven entre opciones y el Tab salta al
 *     siguiente campo — que es lo que un formulario hace;
 *   · una sola parada de tabulación para las ocho, no ocho.
 *
 * El patrón es el de WAI-ARIA: `tabIndex` 0 solo en la seleccionada
 * («roving tabindex»), y las flechas mueven la selección y el foco a
 * la vez.
 *
 * ------------------------------------------------------------------
 * LOS TIPOS QUE EL PAQUETE NO TRAE SE MUESTRAN, BLOQUEADOS
 * ------------------------------------------------------------------
 * Desde el reparto de la 0142 cada paquete trae un juego distinto
 * (Prueba: sellos, puntos y cashback; Arranque suma cupón y descuento;
 * de Impulso para arriba, los ocho). Los que no entran se pintan
 * apagados y con el nombre del paquete que los abre, NO se esconden:
 * escondiéndolos, el dueño no se entera de que existen — y enterarse es
 * buena parte de la razón para pagar.
 *
 * Esto es ayuda visual, no autorización: `crear-actions.ts` vuelve a
 * comprobarlo en el servidor, que es el único lado que el navegador no
 * se puede saltar.
 */

/** Wrap-around: de la última a la primera, como espera el patrón. */
function siguiente(indice: number, delta: number, total: number): number {
  return (indice + delta + total) % total;
}

export default function SelectorTipo({
  valor,
  alElegir,
  plan,
}: {
  valor: TipoTarjeta;
  alElegir: (tipo: TipoTarjeta) => void;
  /** El paquete del negocio. Decide cuáles quedan bloqueados. */
  plan: string | null;
}) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const permitidos = tiposDelPlan(plan);
  // Las flechas se mueven SOLO entre los que se pueden elegir: llevar
  // el foco a una opción bloqueada deja al teclado en un callejón.
  const elegibles = TIPOS_TARJETA_LISTA.filter((t) => permitidos.includes(t.id));
  const indiceActual = elegibles.findIndex((t) => t.id === valor);

  function mover(delta: number) {
    if (elegibles.length === 0) return;
    const i = siguiente(Math.max(0, indiceActual), delta, elegibles.length);
    const destino = elegibles[i].id;
    alElegir(destino);
    botones.current[TIPOS_TARJETA_LISTA.findIndex((t) => t.id === destino)]?.focus();
  }

  function alTeclado(e: React.KeyboardEvent) {
    // En una grilla, abajo/arriba saltan una fila. Se asume la grilla
    // de 2 columnas del móvil como mínimo común: en desktop son 4 y el
    // salto se siente igual de natural.
    const saltos: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 2,
      ArrowLeft: -1,
      ArrowUp: -2,
    };
    const delta = saltos[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    mover(delta);
  }

  return (
    /* `@container` + `@2xl:` y NO `lg:` (2 sep 2026, sobre captura del
       dueño: «esos box están mal alineados»): el breakpoint de viewport
       mentía dentro del panel de edición — a 1440px de pantalla el
       contenedor mide ~660px y `lg:grid-cols-4` metía cuatro tarjetas
       flacas con textos envueltos a alturas dispares. Con la consulta
       de CONTENEDOR, 4 columnas solo cuando el propio bloque mide
       ≥672px (el creador público); en el panel quedan 2, anchas y
       parejas. */
    <div className="@container">
    <div
      role="radiogroup"
      aria-label="Tipo de tarjeta"
      onKeyDown={alTeclado}
      className="grid grid-cols-2 gap-2.5 @2xl:grid-cols-4"
    >
      {TIPOS_TARJETA_LISTA.map((tipo, i) => {
        const bloqueado = !permitidos.includes(tipo.id);
        const elegido = !bloqueado && tipo.id === valor;
        const abre = bloqueado ? planQueDesbloquea(tipo.id) : null;
        const primeroElegible = elegibles[0]?.id === tipo.id;

        return (
          <button
            key={tipo.id}
            ref={(el) => {
              botones.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={elegido}
            // `aria-disabled` y NO `disabled`, a propósito. Un botón
            // con `disabled` no recibe eventos de mouse ni foco en la
            // mayoría de navegadores: el aviso de abajo —el que explica
            // qué paquete lo abre— no aparecería nunca al pasar el
            // mouse, y quien navega con teclado jamás llegaría a él.
            // Con `aria-disabled` la opción sigue siendo explorable y
            // el lector de pantalla la sigue anunciando como no
            // disponible; que no se pueda elegir lo hace el onClick de
            // abajo (y el servidor, que es el único que autoriza).
            aria-disabled={bloqueado || undefined}
            // El lector de pantalla tiene que decir POR QUÉ no se puede,
            // no solo que está deshabilitado.
            aria-label={
              abre ? `${tipo.nombre} — se desbloquea con el paquete ${abre.nombre}` : undefined
            }
            // Roving tabindex: una sola parada para las ocho. Los
            // bloqueados quedan fuera del recorrido de Tab, pero se
            // pueden alcanzar con las flechas y con el mouse — que es
            // donde el aviso tiene que salir.
            tabIndex={elegido || (indiceActual === -1 && primeroElegible) ? 0 : -1}
            onClick={() => {
              if (!bloqueado) alElegir(tipo.id);
            }}
            // SIN `opacity` sobre la tarjeta entera. Bajarle la opacidad
            // al bloque completo apaga TAMBIÉN el texto, y un texto
            // translúcido sobre blanco se lee borroso —el antialias del
            // navegador tiene menos contraste con el que trabajar— además
            // de hundir el contraste por debajo de AA.
            //
            // Lo apagado tiene que ser lo DECORATIVO: el borde punteado y
            // el disco del ícono dicen «esto no se puede elegir» de sobra.
            // El nombre y la descripción quedan nítidos y legibles, que es
            // lo que hace falta para decidir si vale la pena pagar por él.
            className={`elevar group relative flex h-full flex-col items-start rounded-3xl border p-4 text-left ${
              bloqueado
                ? "cursor-not-allowed border-dashed border-bookea-linea bg-bookea-fondo"
                : elegido
                  ? "border-bookea-azul bg-bookea-azul-suave"
                  : "border-bookea-linea bg-white hover:border-bookea-azul/40"
            }`}
          >
            {/* El check de la seleccionada. `scale` y no `display`:
                aparecer de golpe se lee como un parpadeo.

                El par relleno+letra va junto y por token: el disco se
                monta en /crear (claro) y en el panel (oscuro), y
                `.lealtad-oscuro` gira los dos a la vez. Dejar la letra
                en `text-white` era el bug: sobre el azul claro del
                panel oscuro daba 1,6:1. */}
            <span
              aria-hidden
              className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full transition-transform duration-200 ${
                elegido ? "scale-100" : "scale-0"
              }`}
              style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
            >
              <Icono nombre="listo" className="h-3.5 w-3.5" />
            </span>

            {/* El disco del ícono es lo ÚNICO que se apaga en una
                bloqueada: es decorativo, así que perder contraste ahí no
                le cuesta legibilidad a nadie. */}
            <span
              className={`grid h-10 w-10 place-items-center rounded-2xl transition-colors ${
                elegido ? "text-white" : bloqueado ? "text-bookea-gris" : "text-bookea-azul"
              }`}
              style={{
                background: elegido ? "var(--navy)" : "var(--navy-suave)",
                opacity: bloqueado ? 0.55 : 1,
              }}
            >
              <Icono nombre={tipo.icono as NombreIcono} className="h-5 w-5" />
            </span>

            <span className="mt-3 block text-[14px] font-extrabold text-bookea-tinta">
              {tipo.nombre}
            </span>
            {/* `flex-1`: la descripción absorbe el alto sobrante para
                que la insignia de paquete quede ANCLADA abajo — sin
                esto, cada píldora flotaba a una altura distinta según
                cuánto envolvía el texto de arriba. */}
            <span className="mt-1 block flex-1 text-[11.5px] leading-snug text-bookea-gris">
              {tipo.descripcion}
            </span>

            {/* Qué paquete lo abre. Sin esto, un tipo apagado se lee
                como «esto está roto» y no como «esto se compra». */}
            {abre && (
              <span
                aria-hidden
                className="mt-2.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                style={{ background: "var(--navy-suave)", color: "var(--navy)" }}
              >
                Con {abre.nombre}
              </span>
            )}

            {/* EL AVISO, al pasar el mouse o al llegar con el teclado.
                La insignia de arriba dice el nombre del paquete; esto
                dice la frase completa, que es lo que hace falta cuando
                alguien se detiene justo en la opción que quería y no
                entiende por qué no la puede tocar.

                `group-hover` + `group-focus-visible` juntos: el mouse y
                el teclado tienen que llegar los dos. Va `aria-hidden`
                porque lo que anuncia el lector de pantalla es el
                `aria-label` del botón, con el mismo contenido — sin
                esto lo diría dos veces.

                `pointer-events-none` para que el globo no se coma el
                hover del propio botón y quede parpadeando. */}
            {abre && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-2 bottom-full z-20 mb-1.5 rounded-xl px-3 py-2 text-[11px] font-bold leading-snug opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                style={{ background: "var(--navy)", color: "#ffffff" }}
              >
                Necesitás el paquete {abre.nombre} para armar tarjetas de{" "}
                {tipo.nombre.toLowerCase()}.
              </span>
            )}
          </button>
        );
      })}
    </div>
    </div>
  );
}
