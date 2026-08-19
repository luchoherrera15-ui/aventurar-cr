import type { Serie } from "./datos";

/**
 * LOS GRÁFICOS DEL TABLERO, EN SVG A MANO.
 *
 * Sin librería, y no por ahorrar: una librería de gráficos son entre
 * 40 y 120 KB de JavaScript que el navegador tiene que bajar, parsear
 * y ejecutar ANTES de dibujar la primera barra. Estos son etiquetas
 * `<rect>` y un `<path>` que vienen ya renderizadas desde el servidor:
 * se ven en el primer pintado, sin JavaScript de por medio.
 *
 * Todos llevan su tabla equivalente en texto para lectores de
 * pantalla. Un gráfico sin eso es un rectángulo mudo.
 */

/** Un techo redondo para el eje: 7 → 10, 34 → 40, 260 → 300. */
export function techoLimpio(max: number): number {
  if (max <= 0) return 1;
  const magnitud = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitud) * magnitud;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** "2026-08-19" → "19 ago" */
function diaCorto(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTOS[(m ?? 1) - 1]}`;
}

/** "2026-08" → "ago" */
export function mesCorto(iso: string): string {
  const [, m] = iso.split("-").map(Number);
  return MESES_CORTOS[(m ?? 1) - 1] ?? iso;
}

/**
 * La chispa: catorce columnitas al pie de una métrica.
 *
 * No lleva ejes ni números. No es para leer valores —para eso está la
 * cifra grande de arriba— sino para ver de un vistazo si la cosa sube,
 * baja o está plana.
 */
export function Chispa({ serie, dias = 14 }: { serie: Serie; dias?: number }) {
  const datos = serie.slice(-dias);
  if (datos.length === 0) return null;
  const techo = Math.max(1, ...datos.map((d) => d.valor));
  const ANCHO = 4;
  const HUECO = 2;
  const ALTO = 22;
  const total = datos.length * (ANCHO + HUECO) - HUECO;

  return (
    <svg
      viewBox={`0 0 ${total} ${ALTO}`}
      className="mt-2 h-[22px] w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Últimos ${datos.length} días: ${datos.map((d) => d.valor).join(", ")}`}
    >
      {datos.map((d, i) => {
        // Mínimo 1.5px: una columna de altura cero desaparece y el día
        // sin nada se lee como "acá no hay dato" en vez de "acá hubo 0".
        const alto = d.valor === 0 ? 1.5 : Math.max(2, (d.valor / techo) * ALTO);
        return (
          <rect
            key={d.dia}
            x={i * (ANCHO + HUECO)}
            y={ALTO - alto}
            width={ANCHO}
            height={alto}
            rx={1}
            className={d.valor === 0 ? "fill-aventurea-line" : "fill-aventurea-navy/45"}
          />
        );
      })}
    </svg>
  );
}

/**
 * La serie diaria de 30 días, con eje y rótulos.
 */
export function ColumnasDiarias({ serie, titulo }: { serie: Serie; titulo: string }) {
  if (serie.length === 0) return null;
  const techo = techoLimpio(Math.max(...serie.map((d) => d.valor)));
  const ANCHO = 100 / serie.length;

  return (
    <div>
      <div className="flex items-end gap-3">
        <span className="w-8 shrink-0 text-right text-[10.5px] text-aventurea-ink-soft tabular-nums">
          {techo}
        </span>
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="h-[132px] w-full"
          role="img"
          aria-label={`${titulo}. ${serie.map((d) => `${diaCorto(d.dia)}: ${d.valor}`).join(". ")}`}
        >
          {serie.map((d, i) => {
            const alto = d.valor === 0 ? 0.6 : Math.max(0.8, (d.valor / techo) * 40);
            return (
              <rect
                key={d.dia}
                x={i * ANCHO + ANCHO * 0.18}
                y={40 - alto}
                width={ANCHO * 0.64}
                height={alto}
                className={d.valor === 0 ? "fill-aventurea-line" : "fill-aventurea-navy"}
              />
            );
          })}
        </svg>
      </div>
      <div className="mt-1.5 flex justify-between pl-11 text-[10.5px] text-aventurea-ink-soft">
        <span>{diaCorto(serie[0].dia)}</span>
        <span>{diaCorto(serie[Math.floor(serie.length / 2)].dia)}</span>
        <span>{diaCorto(serie[serie.length - 1].dia)}</span>
      </div>
    </div>
  );
}

export type ColumnaApilada = {
  etiqueta: string;
  partes: { nombre: string; valor: number; clase: string }[];
};

/**
 * Columnas apiladas: los seis meses del libro de plata, cada mes
 * partido en sus tres fuentes.
 *
 * Apiladas y no tres series al lado: la pregunta que contesta es
 * "¿cuánto entró en total ese mes, y de dónde?", y para eso la altura
 * total tiene que leerse de un vistazo.
 */
export function ColumnasApiladas({
  columnas,
  formato,
}: {
  columnas: ColumnaApilada[];
  formato: (n: number) => string;
}) {
  const totales = columnas.map((c) => c.partes.reduce((s, p) => s + p.valor, 0));
  const techo = techoLimpio(Math.max(1, ...totales));

  return (
    <div>
      <div className="flex h-[150px] items-end gap-2">
        {columnas.map((c, i) => {
          const total = totales[i];
          return (
            <div key={c.etiqueta} className="flex min-w-0 flex-1 flex-col justify-end">
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-t"
                style={{ height: `${Math.max(total === 0 ? 2 : 6, (total / techo) * 100)}%` }}
                role="img"
                aria-label={`${c.etiqueta}: ${formato(total)} — ${c.partes
                  .filter((p) => p.valor > 0)
                  .map((p) => `${p.nombre} ${formato(p.valor)}`)
                  .join(", ")}`}
              >
                {total === 0 ? (
                  <div className="h-full w-full bg-aventurea-line" />
                ) : (
                  c.partes
                    .filter((p) => p.valor > 0)
                    .map((p) => (
                      <div
                        key={p.nombre}
                        className={p.clase}
                        style={{ height: `${(p.valor / total) * 100}%` }}
                      />
                    ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {columnas.map((c) => (
          <span
            key={c.etiqueta}
            className="min-w-0 flex-1 text-center text-[10.5px] text-aventurea-ink-soft"
          >
            {c.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Una barra horizontal del desglose. */
export function BarraDesglose({
  nombre,
  valor,
  total,
  clase,
  formato,
}: {
  nombre: string;
  valor: number;
  total: number;
  clase: string;
  formato: (n: number) => string;
}) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[12.5px] text-aventurea-ink-soft">{nombre}</span>
        <span className="shrink-0 text-[13px] font-bold text-aventurea-ink tabular-nums">
          {formato(valor)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-aventurea-line">
        <div className={`h-full rounded-full ${clase}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
