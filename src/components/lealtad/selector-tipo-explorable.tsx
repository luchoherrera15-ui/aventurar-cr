"use client";

import { TIPOS_TARJETA_LISTA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { planQueDesbloquea, tiposDelPlan, type PlanId } from "@/lib/lealtad/planes";
import { Icono, type NombreIcono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * LOS OCHO TIPOS, SIEMPRE EXPLORABLES — la vitrina de `/lealtad`.
 *
 * Es una extracción literal de lo que hasta hoy vivía inline en
 * `configurador-lealtad.tsx` (el paso «negocio» de los puntitos, líneas
 * 494-534 de esa versión): la misma grilla de 4, el mismo badge
 * «Gratis»/nombre del paquete. Se separa a su propio archivo porque
 * ahora lo usan DOS lugares —el menú inicial (Modo 1) y la sección «Tu
 * negocio» del editor completo (Modo 3, de otro agente)— y una función
 * de armar el badge escrita dos veces se desincroniza la primera vez
 * que alguien la retoque en un solo lado.
 *
 * ------------------------------------------------------------------
 * ⚠️ EL `plan` MANDA CUANDO VIENE — Y NO SIEMPRE VIENE
 * ------------------------------------------------------------------
 * Sin `plan` los ocho se pueden elegir: es la vitrina de la landing,
 * donde todavía no hay paquete y el flujo es «explorá gratis, pagá
 * para activar». Ahí bloquear cerraría la exploración.
 *
 * PERO desde que el asistente arranca eligiendo el paquete (paso 1),
 * cuando llega al tipo el plan YA está decidido, y dejar elegir uno
 * que ese paquete no incluye es prometer algo que se cae al final:
 * `validarTarjetaDeAlta` valida el tipo contra el paquete y rebota el
 * alta después de que la persona armó la tarjeta entera (dueño, 31
 * ago 2026: «si escojo el plan Starter me deja elegir algunos que son
 * solo de Impulso»).
 *
 * Los bloqueados NO se esconden: se ven apagados con su badge, que es
 * lo que convierte un «no puedo» en un «con qué paquete sí».
 */
export default function SelectorTipoExplorable({
  valor,
  alElegir,
  plan = null,
}: {
  valor: TipoTarjeta;
  alElegir: (tipo: TipoTarjeta) => void;
  /**
   * El paquete ya elegido. `null` = la vitrina, sin paquete todavía:
   * ahí los ocho se pueden tocar.
   */
  plan?: PlanId | null;
}) {
  const tiposGratis = tiposDelPlan("prueba");
  const incluidos = plan ? tiposDelPlan(plan) : null;

  return (
    <div role="radiogroup" aria-label="Tipo de tarjeta" className="grid grid-cols-4 gap-1.5">
      {TIPOS_TARJETA_LISTA.map((t) => {
        const elegido = t.id === valor;
        const gratis = tiposGratis.includes(t.id);
        const abre = !gratis ? planQueDesbloquea(t.id) : null;
        // `incluidos === null` = vitrina sin paquete: nada se bloquea.
        const bloqueado = incluidos !== null && !incluidos.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={elegido}
            disabled={bloqueado}
            title={
              bloqueado && abre
                ? `Este tipo viene con el paquete ${abre.nombre}`
                : undefined
            }
            onClick={() => {
              if (bloqueado) return;
              alElegir(t.id);
            }}
            className={`presionable relative flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center ${
              bloqueado
                ? "cursor-not-allowed border-bookea-linea bg-white opacity-45"
                : elegido
                  ? "border-bookea-azul bg-bookea-azul-suave"
                  : "border-bookea-linea bg-white hover:border-bookea-azul/40"
            }`}
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-lg"
              style={{
                background: elegido ? "var(--navy)" : "var(--navy-suave)",
                color: elegido ? "#fff" : "var(--navy)",
              }}
            >
              <Icono nombre={t.icono as NombreIcono} className="h-3.5 w-3.5" />
            </span>
            <span className="text-[9.5px] font-extrabold leading-tight text-bookea-tinta">
              {t.nombre}
            </span>
            <span
              className={`rounded-full px-1.5 py-[1px] text-[9.5px] font-extrabold uppercase tracking-wide ${
                gratis ? "bg-emerald-50 text-emerald-700" : "bg-bookea-azul-suave text-bookea-azul"
              }`}
            >
              {gratis ? "Gratis" : abre?.nombre}
            </span>
          </button>
        );
      })}
    </div>
  );
}
