"use client";

import { useRef, type CSSProperties } from "react";
import * as Iconos from "@/components/icons";
import {
  FAMILIAS,
  FAMILIA_LABEL,
  tiposDeVertical,
  type TipoNegocioId,
} from "@/lib/business/modulos";
import { identidadDe, variablesAcento } from "@/lib/business/identidad";

/**
 * ¿QUÉ CLASE DE NEGOCIO ES ESTE? — el paso del registro.
 *
 * Bookea sabe armar un panel distinto para cada rubro desde la 0108
 * (menú, vocabulario y herramientas salen de `modulos.ts` +
 * `identidad.ts`), pero ningún registro preguntaba el dato: todos los
 * negocios nacían en null y el panel se resolvía adivinando de la
 * categoría del marketplace, que solo distingue seis rubros. Un gimnasio
 * terminaba en el panel neutro sin que nadie se enterara.
 *
 * Se PREGUNTA, no se adivina en silencio, y la diferencia no es
 * cosmética: "Estudio Marbella" puede ser pilates, uñas o fotografía, y
 * un panel equivocado que el dueño no eligió es un panel que no entiende
 * ni sabe cómo arreglar. Lo que sí hace el adivinador
 * (`adivinar-tipo.ts`) es venir con uno YA MARCADO, así que en el caso
 * bueno esto cuesta cero clics y en el malo cuesta uno.
 *
 * Tarjetas y no un <select> gris a propósito: es el momento en que el
 * dueño descubre que el panel se arma para SU rubro. Un desplegable
 * esconde justamente eso — que hay catorce rubros pensados y que el que
 * le toca trae sus propias herramientas.
 *
 * ------------------------------------------------------------------
 * ACCESIBILIDAD
 * ------------------------------------------------------------------
 * Es una radiogroup de verdad, con el patrón WAI-ARIA: una sola parada
 * de tabulación para todas las opciones («roving tabindex»: `tabIndex`
 * 0 solo en la elegida) y las flechas moviendo selección y foco juntos.
 * Las familias van en `role="group"` con su nombre, que es lo que hace
 * que un lector de pantalla pueda anunciar "Fitness y gimnasios,
 * Pilates" en vez de leer catorce nombres sueltos.
 *
 * Las cuatro flechas mueven de a UNO (derecha/abajo al siguiente,
 * izquierda/arriba al anterior), que es el patrón plano de la APG. Acá
 * NO se hace lo del selector de tarjetas de lealtad —donde arriba/abajo
 * saltan dos porque su grilla siempre tiene dos columnas—: esta grilla
 * cambia de una a dos columnas según el ancho, y un salto que solo
 * acierta en desktop se siente roto en el teléfono.
 *
 * No decide nada: quien lo monta guarda el valor y el servidor lo vuelve
 * a validar contra la vertical (`tipoNegocioDeAlta`), que es el único
 * lado que el navegador no se puede saltar.
 */

export default function SelectorTipoNegocio({
  vertical,
  valor,
  sugerido,
  alElegir,
  alSaltar,
  textoSaltar = "Prefiero elegirlo después",
  textoSinElegir = "Sin elegir, tu panel arranca en el modo neutro — vas a poder elegir el rubro cuando quieras desde Configuración.",
}: {
  /** La vertical ya elegida: acota qué tipos se ofrecen. */
  vertical: string;
  /** El tipo marcado hoy. null = todavía nadie eligió (o se saltó el paso). */
  valor: TipoNegocioId | null;
  /** El que adivinamos del nombre: se marca con una insignia. */
  sugerido: TipoNegocioId | null;
  alElegir: (tipo: TipoNegocioId) => void;
  /** Saltarse el paso. Deja el campo en null, que la columna acepta. */
  alSaltar: () => void;
  textoSaltar?: string;
  textoSinElegir?: string;
}) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  // Agrupadas por familia y en el orden del catálogo. La lista PLANA es
  // la que ordena el teclado: las flechas recorren lo mismo que ve el
  // ojo, atravesando las familias sin quedarse atrapadas en una.
  const opciones = tiposDeVertical(vertical);
  const grupos = FAMILIAS.map((familia) => ({
    familia,
    tipos: opciones.filter((t) => t.familia === familia),
  })).filter((g) => g.tipos.length > 0);
  const planas = grupos.flatMap((g) => g.tipos);

  const indiceActual = valor ? planas.findIndex((t) => t.id === valor) : -1;

  function mover(delta: number) {
    if (planas.length === 0) return;
    // Sin nada elegido, la primera flecha marca la primera opción — no
    // la segunda, que es lo que pasaría si se sumara el delta a un
    // índice inexistente.
    const destino =
      indiceActual === -1
        ? planas[0]
        : planas[(indiceActual + delta + planas.length) % planas.length];
    alElegir(destino.id);
    botones.current[planas.findIndex((t) => t.id === destino.id)]?.focus();
  }

  function alTeclado(e: React.KeyboardEvent) {
    const saltos: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const delta = saltos[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    mover(delta);
  }

  // La ficha de lo elegido: qué palabras va a usar el panel. Va abajo y
  // una sola vez, no dentro de cada tarjeta — repetido catorce veces
  // sería ruido, y acá lo que importa es confirmar la que se marcó.
  const identidadElegida = valor ? identidadDe(valor) : null;

  return (
    <div>
      <div role="radiogroup" aria-label="Tipo de negocio" onKeyDown={alTeclado}>
        {grupos.map((grupo) => (
          <div
            key={grupo.familia}
            role="group"
            aria-label={FAMILIA_LABEL[grupo.familia]}
            className="mt-3 first:mt-0"
          >
            {/* El rótulo de la familia solo cuando hay más de una: en
                eventos son tres tarjetas y un encabezado sobre cada
                bloque de una sola opción es puro adorno. */}
            {grupos.length > 1 && (
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                {FAMILIA_LABEL[grupo.familia]}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {grupo.tipos.map((tipo) => {
                const identidad = identidadDe(tipo.id);
                const Icono = Iconos[identidad.icono];
                const elegido = tipo.id === valor;
                const esSugerido = tipo.id === sugerido;
                const indice = planas.findIndex((t) => t.id === tipo.id);

                return (
                  <button
                    key={tipo.id}
                    ref={(el) => {
                      botones.current[indice] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    // Una sola parada de tabulación para todas. Sin nada
                    // elegido la parada es la primera tarjeta, así el Tab
                    // nunca cae en un grupo sin puerta de entrada.
                    tabIndex={elegido || (indiceActual === -1 && indice === 0) ? 0 : -1}
                    onClick={() => alElegir(tipo.id)}
                    style={variablesAcento(identidad) as CSSProperties}
                    className={`relative flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                      elegido
                        ? "border-aventurea-navy bg-white shadow-sm"
                        : "border-aventurea-line bg-white hover:border-aventurea-sky"
                    }`}
                  >
                    {/* El acento del rubro pinta el disco del ícono: es
                        el mismo color con el que le va a quedar el panel
                        (identidad.ts lo mide contra AA), así que la
                        tarjeta ya se parece a lo que va a recibir. */}
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[17px]"
                      style={{ background: "var(--acento-suave)", color: "var(--acento)" }}
                    >
                      <Icono className="h-[1em] w-[1em]" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-aventurea-ink">
                        {tipo.label}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-aventurea-ink-soft">
                        {identidad.descripcion}
                      </span>
                      {/* Por qué viene marcada. Sin decirlo, el dueño no
                          entiende si la eligió él o si el sistema decidió
                          por él — y esa duda es justo la que hace que no
                          la corrija cuando está mal. */}
                      {esSugerido && (
                        <span className="mt-1.5 inline-block rounded-md bg-aventurea-sky-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-aventurea-ink">
                          Por tu nombre
                        </span>
                      )}
                    </span>

                    {/* El punto de la elegida. Decorativo: quien no ve
                        la pantalla ya lo sabe por `aria-checked`. */}
                    <span
                      aria-hidden
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border transition-colors ${
                        elegido
                          ? "border-[6px] border-aventurea-navy"
                          : "border-aventurea-line"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {identidadElegida ? (
          <p className="text-[11.5px] leading-relaxed text-aventurea-ink-soft">
            Tu panel le va a decir{" "}
            <strong className="text-aventurea-ink">
              {identidadElegida.vocabulario.persona.plural}
            </strong>{" "}
            a quien viene y{" "}
            <strong className="text-aventurea-ink">
              {identidadElegida.vocabulario.visita.plural}
            </strong>{" "}
            a lo que se agenda.
          </p>
        ) : (
          <p className="text-[11.5px] leading-relaxed text-aventurea-ink-soft">
            {textoSinElegir}
          </p>
        )}

        {/* Saltarlo tiene que PODERSE (la columna es anulable y nadie
            debería quedar trabado en una lista de rubros), pero no puede
            competir con elegir: por eso es un enlace de texto y no un
            botón del tamaño del de continuar. */}
        {valor !== null && (
          <button
            type="button"
            onClick={alSaltar}
            className="text-[11.5px] font-bold text-aventurea-ink-soft underline underline-offset-2 hover:text-aventurea-ink"
          >
            {textoSaltar}
          </button>
        )}
      </div>
    </div>
  );
}
