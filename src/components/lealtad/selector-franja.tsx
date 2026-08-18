"use client";

import { useState } from "react";
import { PLANTILLAS_FRANJA, type PlantillaFranja } from "@/lib/lealtad/plantillas-franjas";
import { PRESETS_RUBRO } from "@/lib/lealtad/presets-rubro";
import { Icono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * LA GALERÍA DE FRANJAS del editor completo — la sección "Apariencia",
 * bloque de foto de fondo, con el patrón de Passtastic que pidió el
 * dueño: pestañas por rubro, "Mostrar N más" adentro de cada una.
 *
 * ------------------------------------------------------------------
 * STANDALONE: NO SABE NADA DEL RESTO DEL EDITOR
 * ------------------------------------------------------------------
 * Recibe `valor`/`alElegir` y ya — quien lo monta decide qué hacer con
 * el id elegido (pintarlo en la vista previa, guardarlo en el estado).
 * Este componente no calcula ninguna URL final ni sabe que existe
 * `bannerUrl`.
 *
 * ------------------------------------------------------------------
 * ESTO ES PREVIEW-ONLY, A PROPÓSITO — NUNCA VIAJA AL SERVIDOR
 * ------------------------------------------------------------------
 * Las fotos son archivos de `public/`, con rutas como
 * `/lealtad/plantillas/franjas/cafe-1.jpg`. `tarjeta-alta.ts` solo acepta
 * `bannerUrl` cuando es una URL de NUESTRO Storage
 * (`esUrlDeNuestroStorage`) — una ruta de `public/` no lo es y el
 * servidor la rechazaría. Por eso quien monta este selector tiene que
 * guardar el id elegido en un campo separado (`franjaBancoId`, solo
 * preview) y mandar `bannerUrl: null` mientras la franja sea del banco;
 * solo una subida real por `SubirImagen` produce algo que sí se puede
 * guardar. Ese cableado es responsabilidad de quien monta esto, no de
 * este archivo — acá solo se avisa en el comentario para que no se
 * pierda la razón.
 *
 * ------------------------------------------------------------------
 * LAS PESTAÑAS AGRUPAN POR `PlantillaFranja.rubro`
 * ------------------------------------------------------------------
 * Ese campo ya es el id fino de `presets-rubro.ts` (barberia, unas,
 * spa…), no el `Rubro` amplio — mismo nivel de detalle que ya eligió
 * `plantillas-franjas.ts`. El nombre visible de cada pestaña se busca en
 * `PRESETS_RUBRO` en vez de escribirse a mano, así que si el catálogo de
 * presets renombra algo, la pestaña lo hereda sola.
 */

function nombreDeRubroPreset(id: string): string {
  for (const lista of Object.values(PRESETS_RUBRO)) {
    const preset = lista.find((p) => p.id === id);
    if (preset) return preset.nombre;
  }
  return id;
}

/**
 * Alt descriptivo por foto — mirado a mano, una por una: un lector de
 * pantalla no puede "ver" que es una franja de café con leche, y "franja
 * 3" no le dice nada de lo que se está por elegir.
 */
const ALT_FRANJA: Record<string, string> = {
  "cafe-2": "Interior de una cafetería con mesas de madera y clientela",
  "panaderia-1": "Vitrina de panadería con croissants y panes recién horneados",
  "panaderia-2": "Estantes de panadería con pan artesanal y bollería variada",
  "panaderia-3": "Canasta con panes y baguettes recién horneados",
  "barberia-1": "Sillones de barbería frente a espejos con productos de grooming",
  "barberia-3": "Capa de corte con el rayado clásico de barbería colgada frente a un espejo",
  "unas-2": "Manicurista aplicando esmalte en un salón de uñas",
  "spa-1": "Toalla enrollada, jabón artesanal y flores sobre una mesa de spa",
  "spa-2": "Velas y jabones sobre una bandeja de spa al aire libre",
  "restaurante-1": "Comedor elegante de un restaurante con mesas puestas",
  "restaurante-2": "Terraza de un restaurante con vista al mar al atardecer",
  "restaurante-3": "Salón de un restaurante con iluminación cálida y mesas servidas",
  "gimnasio-1": "Sala de pesas de un gimnasio con mancuernas ordenadas",
  "gimnasio-2": "Área de cardio de un gimnasio con cintas para correr",
  "tienda-2": "Percha con ropa colgada de colores variados en una tienda",
};

/** Franjas agrupadas por rubro, en el orden en que aparecen en el catálogo. */
type Grupo = { rubro: string; nombre: string; franjas: readonly PlantillaFranja[] };

const GRUPOS: readonly Grupo[] = (() => {
  const orden: string[] = [];
  const mapa = new Map<string, PlantillaFranja[]>();
  for (const f of PLANTILLAS_FRANJA) {
    if (!mapa.has(f.rubro)) {
      orden.push(f.rubro);
      mapa.set(f.rubro, []);
    }
    mapa.get(f.rubro)!.push(f);
  }
  return orden.map((rubro) => ({ rubro, nombre: nombreDeRubroPreset(rubro), franjas: mapa.get(rubro)! }));
})();

/** Ocho por pestaña alcanza para una fila de vistazo; el resto queda a un click. */
const VISIBLES_INICIAL = 8;

export default function SelectorFranja({
  valor,
  alElegir,
  rubroSugerido = null,
}: {
  /** El id de un `PlantillaFranja`, o `null` si no hay ninguna elegida del banco. */
  valor: string | null;
  alElegir: (id: string | null) => void;
  /** Un `PresetRubro.id` para preseleccionar la pestaña. Nadie lo pasa todavía. */
  rubroSugerido?: string | null;
}) {
  const [pestana, setPestana] = useState(
    () => GRUPOS.find((g) => g.rubro === rubroSugerido)?.rubro ?? GRUPOS[0]?.rubro ?? "",
  );
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  return (
    <div>
      {/* Botones de filtro, no pestañas de verdad: `role="tab"` promete
          navegación con flechas y `aria-controls` que acá no existen.
          `aria-pressed` describe exactamente lo que hay — un filtro que
          cambia qué grupo se ve abajo. */}
      <div role="group" aria-label="Rubro de la franja" className="flex flex-wrap gap-1.5">
        {GRUPOS.map((g) => {
          const activa = g.rubro === pestana;
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

      {GRUPOS.map((g) => {
        const activa = g.rubro === pestana;
        const expandida = expandidas[g.rubro] ?? false;
        const visibles = expandida ? g.franjas : g.franjas.slice(0, VISIBLES_INICIAL);
        const restantes = g.franjas.length - visibles.length;

        return (
          <div key={g.rubro} hidden={!activa} className="mt-2.5">
            <div
              role="group"
              aria-label={`Franjas de ${g.nombre}`}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {visibles.map((f) => {
                const puesta = valor === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={puesta}
                    onClick={() => alElegir(puesta ? null : f.id)}
                    className={`presionable relative overflow-hidden rounded-xl border ${
                      puesta ? "border-bookea-azul ring-2 ring-bookea-azul" : "border-bookea-linea"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- archivo de public/, no un asset de next/image */}
                    <img src={f.src} alt={ALT_FRANJA[f.id] ?? f.id} className="aspect-[3/1] w-full object-cover" />
                    {puesta && (
                      <span
                        aria-hidden
                        className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full"
                        style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                      >
                        <Icono nombre="listo" className="h-3 w-3" />
                      </span>
                    )}
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
          Quitar franja
        </button>
      )}
    </div>
  );
}
