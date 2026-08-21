/**
 * EL DIAGRAMA DE UNA LÍNEA — "esto corre solo", contado en cuatro
 * casilleros y no en un párrafo.
 *
 * Encabeza la franja de automatizaciones (rescate + hitos + cercanía)
 * para que el visitante entienda la IDEA general en dos segundos, antes
 * de ver los tres mockups que la prueban en detalle. Server Component,
 * sin animación propia — el `data-reveal` de la sección que lo envuelve
 * ya lo revela.
 */
const PASOS = [
  { etiqueta: "Cliente frecuente", tono: "neutro" as const },
  { etiqueta: "30 días sin volver", tono: "aviso" as const },
  { etiqueta: "Le llega un aviso", tono: "accion" as const },
  { etiqueta: "Vuelve a comprar", tono: "exito" as const },
];

const CLASES = {
  neutro: "border border-aventurea-line bg-white text-aventurea-navy",
  aviso: "border border-transparent bg-amber-50 text-amber-800",
  accion: "border border-transparent text-white",
  exito: "border border-transparent bg-aventurea-green-light text-aventurea-green",
};

export default function FlujoAutomatizaciones() {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:gap-1.5"
    >
      {PASOS.map((p, i) => (
        <div key={p.etiqueta} className="flex items-center gap-2 sm:gap-1.5">
          <span
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-extrabold ${CLASES[p.tono]}`}
            style={p.tono === "accion" ? { background: "var(--accion)" } : undefined}
          >
            {p.etiqueta}
          </span>
          {i < PASOS.length - 1 && (
            <span className="text-[13px] font-bold text-aventurea-ink-soft/60">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
