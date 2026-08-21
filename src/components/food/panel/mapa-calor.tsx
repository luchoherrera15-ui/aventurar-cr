"use client";

import { useRef, useState, type PointerEvent } from "react";
import { horaCorta } from "@/lib/food/tipos";

/**
 * MAPA DE CALOR DÍA × HORA — sin librerías, y sin SVG a propósito: una
 * grilla de intensidades ES una tabla, y hacerla con <table> regala la
 * semántica (encabezados de fila y columna, lectura por celdas con un
 * lector de pantalla) que un canvas de rectángulos obliga a duplicar
 * aparte. La "vista de tabla" que pide el sistema de dataviz y el
 * gráfico son acá la misma cosa.
 *
 * Color: escala SECUENCIAL de UN solo matiz (el celeste de datos del
 * tema), de claro a oscuro con color-mix sobre blanco — magnitud se
 * codifica con luminosidad, nunca con un arcoíris. No se introduce
 * ningún hexadecimal: solo el token y blanco. Como en las celdas más
 * claras el color casi desaparece, el valor NUNCA depende solo del
 * color: cada celda lleva su texto accesible y su tooltip.
 *
 * Interacción: el tooltip por celda sigue la misma anatomía que el de
 * GraficoBarras (caja blanca, marca de color, valor en fuerte). La
 * posición se mide del propio DOM en el handler del puntero — acá no
 * hay geometría calculada como en los SVG, así que se le pregunta a la
 * celda dónde está. `border-spacing` de 3px hace de separador entre
 * celdas (la regla del "gap de superficie" entre rellenos adyacentes).
 *
 * Los valores llegan como PORCENTAJE de la demanda total (0–100): es
 * una distribución estimada, no un conteo, y la pantalla lo rotula
 * así. Server Components pasan datos planos; el formato vive acá.
 */

export type DatosMapaCalor = {
  /** Rótulos de fila (días, orden CR: Lun..Dom). */
  filas: string[];
  /** Horas "HH:MM" de las columnas, como las guarda food_franjas. */
  columnas: string[];
  /** valores[fila][columna] = % de la demanda (0–100). */
  valores: number[][];
};

/** "19:00" → "7 p.m." — cabecera corta; el tooltip usa la hora completa. */
function horaTh(hhmm: string): string {
  const h = Number(hhmm.split(":")[0]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? "a.m." : "p.m."}`;
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CR", { maximumFractionDigits: 1 })}%`;
}

/** El relleno de una celda: 6 %–100 % del matiz según la intensidad. */
function fondoCelda(t: number): string {
  const pct = Math.round(6 + 94 * Math.max(0, Math.min(1, t)));
  return `color-mix(in srgb, var(--color-aventurea-sky) ${pct}%, white)`;
}

export function MapaCalor({
  filas,
  columnas,
  valores,
  serie,
  className = "",
}: DatosMapaCalor & {
  /** Qué mide el mapa ("Demanda estimada") — tooltip y accesibilidad. */
  serie: string;
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ f: number; c: number; x: number; y: number } | null>(null);

  const max = Math.max(0.1, ...valores.flat());

  // La posición del tooltip se mide contra el contenedor EXTERNO (el
  // que no scrollea): así el tooltip acompaña a la celda aunque la
  // tabla esté desplazada horizontalmente en un teléfono.
  const entrar = (f: number, c: number) => (e: PointerEvent<HTMLTableCellElement>) => {
    const cont = contenedorRef.current;
    if (!cont) return;
    const celda = e.currentTarget.getBoundingClientRect();
    const marco = cont.getBoundingClientRect();
    setHover({ f, c, x: celda.left - marco.left + celda.width / 2, y: celda.top - marco.top });
  };

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <div className="overflow-x-auto pb-1">
        <table
          className="w-full min-w-[560px] border-separate [border-spacing:3px]"
          onPointerLeave={() => setHover(null)}
        >
          <caption className="sr-only">
            {serie} por día de la semana y hora, como porcentaje del total.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-9" aria-label="Día" />
              {columnas.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="pb-0.5 text-center text-[9.5px] font-bold text-aventurea-ink-soft"
                >
                  {horaTh(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, f) => (
              <tr key={fila}>
                <th
                  scope="row"
                  className="pr-1 text-left text-[10.5px] font-bold text-aventurea-ink-soft"
                >
                  {fila}
                </th>
                {columnas.map((col, c) => {
                  const v = valores[f]?.[c] ?? 0;
                  const activa = hover?.f === f && hover?.c === c;
                  return (
                    <td
                      key={col}
                      onPointerEnter={entrar(f, c)}
                      className={`h-7 min-w-7 rounded-[5px] ${
                        activa ? "outline outline-2 -outline-offset-1 outline-aventurea-navy" : ""
                      }`}
                      style={{ backgroundColor: fondoCelda(v / max) }}
                    >
                      <span className="sr-only">
                        {fila} {horaCorta(col)}: {fmtPct(v)} de la demanda
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* La leyenda de la escala: menos → más, con el degradé del mismo
          matiz. Es decorativa (aria-hidden): la lectura real está en
          las celdas. */}
      <div className="mt-2 flex items-center gap-2 text-[10.5px] text-aventurea-ink-soft">
        <span>Menos demanda</span>
        <span
          aria-hidden
          className="h-2 w-24 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${fondoCelda(0)}, ${fondoCelda(1)})`,
          }}
        />
        <span>Más demanda</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-aventurea-line bg-white px-3 py-2 shadow-[var(--shadow-elevado)]"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <p className="whitespace-nowrap text-[10.5px] text-aventurea-ink-soft">
            {filas[hover.f]} · {horaCorta(columnas[hover.c])}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="h-2 w-2 rounded-[3px]"
              style={{ backgroundColor: fondoCelda((valores[hover.f]?.[hover.c] ?? 0) / max) }}
              aria-hidden
            />
            <span className="text-[13px] font-extrabold text-aventurea-ink">
              {fmtPct(valores[hover.f]?.[hover.c] ?? 0)}
            </span>
            <span className="text-[11px] text-aventurea-ink-soft">de tu demanda</span>
          </p>
        </div>
      )}
    </div>
  );
}
