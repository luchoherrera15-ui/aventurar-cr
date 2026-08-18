"use client";

import { useState } from "react";
import { PLANTILLAS_ICONO, dataUriPlantillaIcono } from "@/lib/lealtad/plantillas-icono";
import { PRESETS_RUBRO } from "@/lib/lealtad/presets-rubro";

/**
 * LA GALERÍA DE "IMAGEN DEL NEGOCIO" del editor completo — sucesora del
 * grid fijo de 5 que tenía `configurador-lealtad.tsx` (que leía de
 * `imagen-stock.ts`, BORRADO en este mismo trabajo), ahora con 27
 * opciones y el mismo patrón de pestañas + "Mostrar N más" que
 * `SelectorFranja` — mismo lenguaje de interacción entre las dos
 * galerías, a propósito: quien ya aprendió a usar una sabe usar la otra.
 *
 * ------------------------------------------------------------------
 * STANDALONE Y PURO: NO CALCULA `logoUrl`
 * ------------------------------------------------------------------
 * Recibe `valor`/`alElegir` (el id de una `PlantillaIcono`, o `null`) y
 * `colorFondo` (para pintar cada opción con el color real de la tarjeta,
 * igual que ya hacía el grid viejo). Quien monta esto —el editor
 * completo— es quien decide qué hacer con el id: pintarlo en la vista
 * previa del pase llamando a `dataUriPlantillaIcono` de nuevo, y
 * NUNCA mandarlo como `logoUrl` al servidor (no hay archivo real detrás:
 * ver el comentario de cabecera de `plantillas-icono.ts`). Ese cableado
 * es responsabilidad del editor, no de este archivo.
 *
 * ------------------------------------------------------------------
 * LAS PESTAÑAS AGRUPAN POR `PlantillaIcono.rubro`
 * ------------------------------------------------------------------
 * Mismo criterio que `SelectorFranja`: el id fino de `presets-rubro.ts`,
 * con nombre buscado ahí y no copiado a mano. Los comodines sin rubro
 * (`corazon`, `estrella`, `regalo`, `salud`) quedan en su propia pestaña
 * "General".
 */

function nombreDeRubroPreset(id: string): string {
  for (const lista of Object.values(PRESETS_RUBRO)) {
    const preset = lista.find((p) => p.id === id);
    if (preset) return preset.nombre;
  }
  return id;
}

type PlantillaConUri = { id: string; nombre: string; uri: string | null };
type Grupo = { rubro: string; nombre: string; iconos: readonly PlantillaConUri[] };

/** Ocho por pestaña alcanza para una fila de vistazo; el resto queda a un click. */
const VISIBLES_INICIAL = 8;

export default function SelectorImagenNegocio({
  valor,
  alElegir,
  colorFondo,
  rubroSugerido = null,
}: {
  /** El id de una `PlantillaIcono`, o `null`. */
  valor: string | null;
  alElegir: (id: string | null) => void;
  /** El disco se pinta con este color — mismo criterio que `dataUriPlantillaIcono`. */
  colorFondo: string;
  /** Un `PresetRubro.id` para preseleccionar la pestaña. Nadie lo pasa todavía. */
  rubroSugerido?: string | null;
}) {
  // Se recalcula con `colorFondo`: cada disco tiene que verse con el
  // color que la persona ya eligió, no con uno fijo — la elección de
  // ícono es una decisión visual y el color es la mitad de esa decisión.
  const grupos: readonly Grupo[] = (() => {
    const orden: string[] = [];
    const mapa = new Map<string, PlantillaConUri[]>();
    for (const p of PLANTILLAS_ICONO) {
      const clave = p.rubro ?? "general";
      if (!mapa.has(clave)) {
        orden.push(clave);
        mapa.set(clave, []);
      }
      mapa.get(clave)!.push({ id: p.id, nombre: p.nombre, uri: dataUriPlantillaIcono(p.id, colorFondo) });
    }
    return orden.map((clave) => ({
      rubro: clave,
      nombre: clave === "general" ? "General" : nombreDeRubroPreset(clave),
      iconos: mapa.get(clave)!,
    }));
  })();

  const [pestana, setPestana] = useState(
    () => grupos.find((g) => g.rubro === rubroSugerido)?.rubro ?? grupos[0]?.rubro ?? "",
  );
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  // Si la pestaña activa ya no existe en este render (no debería pasar:
  // los grupos son estables entre renders, solo cambia el color de cada
  // ícono) se cae a la primera en vez de no mostrar nada.
  const pestanaEfectiva = grupos.some((g) => g.rubro === pestana) ? pestana : (grupos[0]?.rubro ?? "");

  return (
    <div>
      {/* Botones de filtro, no pestañas de verdad: `role="tab"` promete
          navegación con flechas y `aria-controls` que acá no existen.
          `aria-pressed` describe exactamente lo que hay — un filtro que
          cambia qué grupo se ve abajo. */}
      <div role="group" aria-label="Rubro del ícono" className="flex flex-wrap gap-1.5">
        {grupos.map((g) => {
          const activa = g.rubro === pestanaEfectiva;
          return (
            <button
              key={g.rubro}
              type="button"
              aria-pressed={activa}
              onClick={() => setPestana(g.rubro)}
              className={`presionable rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                activa
                  ? "bg-bookea-azul-suave text-bookea-azul"
                  : "border border-bookea-linea text-bookea-gris hover:border-bookea-azul/40"
              }`}
            >
              {g.nombre}
            </button>
          );
        })}
      </div>

      {grupos.map((g) => {
        const activa = g.rubro === pestanaEfectiva;
        const expandida = expandidas[g.rubro] ?? false;
        const visibles = expandida ? g.iconos : g.iconos.slice(0, VISIBLES_INICIAL);
        const restantes = g.iconos.length - visibles.length;

        return (
          <div key={g.rubro} hidden={!activa} className="mt-2.5">
            <div
              role="group"
              aria-label={`Íconos de ${g.nombre}`}
              className="grid grid-cols-4 gap-1.5 min-[420px]:grid-cols-5 sm:grid-cols-6"
            >
              {visibles.map((p) => {
                const puesto = valor === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={puesto}
                    title={p.nombre}
                    onClick={() => alElegir(puesto ? null : p.id)}
                    className={`presionable overflow-hidden rounded-xl border text-center ${
                      puesto ? "border-bookea-azul ring-2 ring-bookea-azul" : "border-bookea-linea"
                    }`}
                  >
                    {p.uri && (
                      // eslint-disable-next-line @next/next/no-img-element -- data: URI generado, no un archivo
                      <img
                        src={p.uri}
                        // El nombre ya está visible en el <span> de abajo — un alt
                        // igual lo repetiría dos veces para un lector de pantalla.
                        alt=""
                        className="aspect-square w-full"
                      />
                    )}
                    <span className="block truncate px-1 py-1 text-[9.5px] font-bold text-bookea-tinta">
                      {p.nombre}
                    </span>
                  </button>
                );
              })}
            </div>

            {restantes > 0 && (
              <button
                type="button"
                onClick={() => setExpandidas((e) => ({ ...e, [g.rubro]: true }))}
                className="presionable mt-2 text-[11.5px] font-bold text-bookea-azul underline"
              >
                Mostrar {restantes} más
              </button>
            )}
          </div>
        );
      })}

      {valor && (
        <button
          type="button"
          onClick={() => alElegir(null)}
          className="presionable mt-2.5 text-[11.5px] font-bold text-bookea-gris underline"
        >
          Quitar imagen
        </button>
      )}
    </div>
  );
}
