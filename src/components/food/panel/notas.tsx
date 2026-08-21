/**
 * Las dos notas de honestidad del panel de FOOD. Server-safe.
 *
 * — <NotaDemo />: marca sutil de que lo que se ve es utilería
 *   (src/lib/food/panel-demo.ts) y no datos del negocio. Va en TODA
 *   tarjeta que pinte números de demo; cuando la pantalla pase a datos
 *   reales, se quita la prop y listo.
 *
 * — <NotaEstimacion />: la letra chica OBLIGATORIA de cualquier cifra
 *   en colones. Bookea no conoce la facturación real del restaurante:
 *   todo lo económico se estima de reservas × ticket promedio, y esta
 *   nota es la que lo dice. Nunca mostrar un ₡ del panel sin ella
 *   cerca. El texto vive acá para que ninguna pantalla lo parafrasee
 *   distinto.
 */

/** Marquita "Datos de ejemplo" — discreta, no un banner. */
export function NotaDemo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-aventurea-orange" aria-hidden />
      Datos de ejemplo
    </span>
  );
}

/** La frase estándar. `enOscuro` la adapta a tarjetas navy. */
export function NotaEstimacion({
  enOscuro = false,
  className = "",
}: {
  enOscuro?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`text-[11.5px] leading-snug ${
        enOscuro ? "text-white/70" : "text-aventurea-ink-soft"
      } ${className}`}
    >
      Estimación basada en las reservas y el ticket promedio configurado por el restaurante.
    </p>
  );
}
