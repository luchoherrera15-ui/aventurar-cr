import { Icono, type NombreIcono } from "./iconos";

/**
 * EL MEDIDOR DE CONSUMO contra un tope del paquete.
 *
 * Vivía adentro de `seccion-plan.tsx`. Salió acá cuando el tablero de
 * Inicio pasó a mostrar el estado del plan: las dos pantallas dibujan
 * el MISMO medidor con los mismos números, y dos copias del mismo
 * cuadrito es cómo un panel deja de verse como un panel (el mismo
 * motivo por el que existe `kpi.tsx`).
 *
 * Sin "use client": solo pinta, y así lo importan las dos secciones
 * —las dos del servidor— sin cruzar la frontera.
 *
 * Sin tope no dibuja barra: una barra al 0% con "sin límite" al lado se
 * lee como "no has usado nada de algo que se puede acabar", que es
 * justo lo contrario de lo que pasa.
 */
export default function Medidor({
  icono,
  etiqueta,
  usado,
  tope,
  detalle,
  alerta,
  aviso,
}: {
  icono: NombreIcono;
  etiqueta: string;
  usado: number;
  /** null = sin tope en el paquete. */
  tope: number | null;
  /** Qué decir cuando no hay tope que dibujar. */
  detalle?: string;
  /** Ya no entra nadie más. */
  alerta?: boolean;
  /** Pasó el 80%: conviene decidir antes de toparse. */
  aviso?: boolean;
}) {
  const pct = tope ? Math.min(100, Math.round((usado / tope) * 100)) : 0;
  /* Semáforo: rojo lleno, ámbar cerca, y el azul de acción cuando todo
     va bien. El escalón «cerca» no puede ser naranja — se confundiría
     con el naranja de marca, que no significa advertencia. */
  const color = alerta ? "#ef4444" : aviso ? "#f59e0b" : "var(--accion-claro)";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex items-center gap-2 text-[13px] font-bold text-aventurea-ink">
          <span className="text-aventurea-ink-soft">
            <Icono nombre={icono} className="h-[15px] w-[15px]" />
          </span>
          {etiqueta}
        </span>
        <span className="text-[13px] font-bold tabular-nums text-aventurea-ink-soft">
          {tope === null
            ? usado.toLocaleString("es-CR")
            : `${usado.toLocaleString("es-CR")} / ${tope.toLocaleString("es-CR")}`}
        </span>
      </div>

      {tope === null ? (
        <p className="mt-1 text-[11.5px] text-aventurea-ink-soft">
          {detalle ?? "Sin tope en tu paquete."}
        </p>
      ) : (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}
