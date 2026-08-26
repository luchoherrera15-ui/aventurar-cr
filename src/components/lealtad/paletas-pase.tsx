"use client";

import { PALETAS_PASE, cssDelFondo, type PaletaPase } from "@/lib/wallet/fondo-tira";
import { layoutDeLaTira, type ConfigTira } from "@/lib/wallet/layout-tira";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS OCHO TARJETAS TERMINADAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Cada opción NO es un par de cuadraditos de color: es la franja de
 * verdad, con su degradado de verdad y sus sellos de verdad, al alto que
 * le toca. Tocar una repinta el pase ENTERO —color de la tarjeta, color
 * del sello y degradado de la franja— y eso se ve al instante en la
 * vista previa de al lado.
 *
 * ── POR QUÉ ESTE COMPONENTE EXISTE ──────────────────────────────────
 *
 * `PALETAS_PASE` se escribió con los fondos con degradado y se quedó SIN
 * UN SOLO CONSUMIDOR: el motor sabía pintar degradados, la vista previa
 * sabía mostrarlos, y no había ninguna pantalla desde donde elegirlos.
 * En producción, ningún dueño podía llegar a ellos. Esto es esa perilla.
 *
 * ── POR QUÉ NO SE REUSÓ `PlantillasColor` ───────────────────────────
 *
 * Son dos catálogos genuinamente distintos, no una duplicación.
 * `PlantillasColor` lee `PALETAS_LISTA` —ocho paletas PLANAS atadas al
 * tipo de tarjeta, que además usa la landing— y tiene otros tres
 * consumidores (el menú inicial, el asistente de alta y la sección de
 * tarjeta digital del panel). Cambiarle el contrato para que entienda
 * degradados rompería esas tres pantallas de una.
 *
 * Migrar los otros tres consumidores a este catálogo es una pasada
 * aparte y vale la pena; mientras tanto conviven, y este comentario está
 * para que el próximo que pase no lo lea como descuido.
 */

/** Cuántos sellos dibuja la miniatura: los mismos de la tarjeta real. */
function sellosDeLaMuestra(meta: number): number {
  return Math.max(4, Math.min(meta, 10));
}

/**
 * La franja de una paleta, en chiquito.
 *
 * Las posiciones salen de `layoutDeLaTira` y el fondo de `cssDelFondo`:
 * las MISMAS funciones que componen el PNG que se manda al teléfono. La
 * miniatura no es una aproximación dibujada aparte — es el mismo cálculo
 * a otra escala, que es lo que impide que prometa algo que el pase no
 * cumple.
 */
function MuestraDeTarjeta({
  paleta,
  diseno,
  meta,
}: {
  paleta: PaletaPase;
  diseno: ConfigTira;
  meta: number;
}) {
  const total = sellosDeLaMuestra(meta);
  const layout = layoutDeLaTira(total, { ...diseno, fondo: paleta.degradado });
  const lado = (layout.diametro / layout.ancho) * 100;
  const ganados = Math.ceil(total * 0.4);

  return (
    <span
      aria-hidden
      className="relative block w-full overflow-hidden"
      style={{
        aspectRatio: "375 / 123",
        background: cssDelFondo(paleta.degradado, paleta.fondo),
      }}
    >
      {layout.posiciones.map((pos, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${(pos.x / layout.ancho) * 100}%`,
            top: `${(pos.y / layout.alto) * 100}%`,
            width: `${lado}%`,
            aspectRatio: "1 / 1",
            background: paleta.sello,
            opacity: i < ganados ? 1 : 0.3,
          }}
        />
      ))}
    </span>
  );
}

export default function PaletasPase({
  colorFondo,
  colorSello,
  diseno,
  meta,
  alElegir,
}: {
  /** El color de la tarjeta hoy, para marcar cuál está puesta. */
  colorFondo: string;
  colorSello: string;
  /** La geometría actual: la muestra dibuja los sellos donde de verdad van. */
  diseno: ConfigTira;
  /** Cuántos sellos promete la tarjeta. */
  meta: number;
  alElegir: (paleta: PaletaPase) => void;
}) {
  /**
   * Cuál se ve elegida. Se compara por los TRES valores que la paleta
   * fija, y no por un id guardado: el dueño puede haber elegido «Selva»
   * y después haberle cambiado el color de acento a mano. En ese caso no
   * hay ninguna marcada, que es la verdad — y es mejor que dejar
   * iluminada una paleta que ya no es la que tiene puesta.
   */
  const puesta = (p: PaletaPase) =>
    p.fondo.toLowerCase() === colorFondo.toLowerCase() &&
    p.sello.toLowerCase() === colorSello.toLowerCase() &&
    JSON.stringify(p.degradado) === JSON.stringify(diseno.fondo);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {PALETAS_PASE.map((p) => {
        const activa = puesta(p);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={activa}
            onClick={() => alElegir(p)}
            className={`presionable overflow-hidden rounded-xl border-2 text-left transition-colors ${
              activa
                ? "border-bookea-azul"
                : "border-transparent hover:border-bookea-linea"
            }`}
          >
            <MuestraDeTarjeta paleta={p} diseno={diseno} meta={meta} />
            <span
              className={`flex items-center justify-between gap-1 px-2.5 py-2 text-[12px] font-bold ${
                activa ? "text-bookea-azul" : "text-bookea-tinta"
              }`}
            >
              {p.nombre}
              {activa && (
                <span aria-hidden className="text-[13px] leading-none">
                  ✓
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
