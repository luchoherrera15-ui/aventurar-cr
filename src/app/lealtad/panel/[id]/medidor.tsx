import { Icono, type NombreIcono } from "./iconos";
import { DISCO_LEALTAD } from "../sistema-lealtad";

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
     con el naranja de marca, que no significa advertencia.

     Los tres son ELEMENTOS GRÁFICOS y necesitan 3:1 contra la tarjeta
     traducida al tema oscuro (#151d30):
       #ef4444 (lleno) ......... 4,46:1 ✅
       #f59e0b (cerca) ......... 7,82:1 ✅
       #9db4ff (en regla) ...... 8,32:1 ✅ */
  const color = alerta ? "#ef4444" : aviso ? "#f59e0b" : "var(--accion-claro)";

  return (
    <div>
      {/* El disco de ícono en vez del ícono suelto: es la misma cabecera
          que usan las métricas del panel (`.metric-ico` de la maqueta),
          y hace que un medidor y un número se lean como parientes. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-aventurea-ink">
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-xl"
            style={DISCO_LEALTAD}
          >
            <Icono nombre={icono} className="h-[15px] w-[15px]" />
          </span>
          <span className="min-w-0 truncate">{etiqueta}</span>
        </span>
        <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-aventurea-ink">
          {tope === null
            ? usado.toLocaleString("es-CR")
            : `${usado.toLocaleString("es-CR")} / ${tope.toLocaleString("es-CR")}`}
        </span>
      </div>

      {tope === null ? (
        <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">
          {detalle ?? "Sin tope en tu paquete."}
        </p>
      ) : (
        /* 6px y no 8: es la `.progress` de la maqueta (4px), subida a la
           escala del panel. Y el carril es más OSCURO que la tarjeta, no
           más claro — sobre fondo oscuro un hueco se hunde apagándose. */
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/25">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}
