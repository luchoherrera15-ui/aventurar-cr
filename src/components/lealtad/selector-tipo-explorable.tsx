"use client";

import { TIPOS_TARJETA_LISTA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { planQueDesbloquea, tiposDelPlan } from "@/lib/lealtad/planes";
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
 * A propósito NO es `SelectorTipo` (`./selector-tipo.tsx`): ese
 * componente bloquea con `aria-disabled` + un `onClick` que ignora el
 * tipo si está bloqueado — correcto en el panel post-firma, donde el
 * plan ya es real y pagado. Acá el plan todavía no existe: los ocho
 * tienen que poder elegirse siempre, porque este flujo entero es
 * "explorá gratis, pagá para activar" (el aviso de Modo 2/paquetes
 * existe precisamente para permitir ese vaivén). Bloquear un tipo acá
 * cerraría la exploración que el dueño pidió.
 */
export default function SelectorTipoExplorable({
  valor,
  alElegir,
}: {
  valor: TipoTarjeta;
  alElegir: (tipo: TipoTarjeta) => void;
}) {
  const tiposGratis = tiposDelPlan("prueba");

  return (
    <div role="radiogroup" aria-label="Tipo de tarjeta" className="grid grid-cols-4 gap-1.5">
      {TIPOS_TARJETA_LISTA.map((t) => {
        const elegido = t.id === valor;
        const gratis = tiposGratis.includes(t.id);
        const abre = !gratis ? planQueDesbloquea(t.id) : null;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={elegido}
            onClick={() => alElegir(t.id)}
            className={`presionable relative flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center ${
              elegido
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
