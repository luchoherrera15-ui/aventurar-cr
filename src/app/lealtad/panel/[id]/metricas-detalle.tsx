"use client";

import { useState } from "react";
import Kpi from "./kpi";
import {
  CUERPO_SUAVE,
  DETALLE,
  ESTADO_PILDORA,
  GAP_METRICAS,
  RADIO_TILE,
} from "@/components/panel/sistema";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS CIFRAS DE MÉTRICAS, QUE AHORA SE ABREN
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (30 ago 2026): «que todas esas cards sean clickeables
 * para ver más a fondo o con más detalle de cada cosa».
 *
 * Antes las cuatro cifras eran un callejón sin salida: «49 clientes
 * nuevos» y nada más — ni quiénes son, ni cuándo entraron. Para un
 * negocio, el número sin los nombres no se puede accionar; el nombre
 * sí, porque a una persona se le escribe.
 *
 * ── POR QUÉ SE DESPLIEGA ACÁ Y NO NAVEGA A OTRA PANTALLA ───────────
 * La sección Clientes ya tiene el padrón completo con filtros. Mandar
 * ahí haría perder el contexto de la cifra que se venía mirando, y
 * obligaría a re-aplicar el filtro a mano. Abrir la lista DEBAJO de la
 * cifra deja las dos cosas a la vista: cuánto, y quiénes.
 *
 * ── UNA SOLA ABIERTA A LA VEZ ──────────────────────────────────────
 * Con las cuatro abiertas la pantalla se vuelve un muro de nombres y
 * la comparación entre cifras —que es para lo que sirve una fila de
 * KPIs— desaparece.
 *
 * Se usa `desplegable` de globals.css (grid-template-rows 0fr→1fr): el
 * navegador lo interpola sin medir contenido ni inventar un max-height,
 * y no dispara layout como animar `height`.
 */

export type FilaDetalle = {
  id: string;
  nombre: string;
  /** La línea de apoyo: «hace 12 días», «se afilió el 03/08»… */
  apoyo: string;
  /** Opcional, a la derecha: un saldo, un conteo. */
  cifra?: string;
};

export type MetricaAbrible = {
  clave: string;
  titulo: string;
  valor: string;
  detalle: string;
  icono: "afiliar" | "clientes" | "sumar" | "regalo";
  tendencia?: string | null;
  /** Las personas detrás del número. Vacío = no hay a quién mostrar. */
  filas: FilaDetalle[];
  /** Qué decir cuando la lista está vacía, sin inventar un dato. */
  vacio: string;
};

export default function MetricasConDetalle({ metricas }: { metricas: MetricaAbrible[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <div className={`grid grid-cols-2 ${GAP_METRICAS} lg:grid-cols-4`}>
      {metricas.map((m) => {
        const activa = abierta === m.clave;
        return (
          <div key={m.clave} className="min-w-0">
            {/* El botón envuelve la métrica entera: el área de toque es
                toda la tarjeta, no un enlacito de 12px. */}
            <button
              type="button"
              onClick={() => setAbierta(activa ? null : m.clave)}
              aria-expanded={activa}
              /* `rounded-xl` para que el anillo de foco siga la forma de
                 la tarjeta, y no un rectángulo pegado a sus esquinas. El
                 anillo lo pone el bloque `.lealtad :focus-visible` de
                 globals.css. */
              className="presionable block w-full rounded-xl text-left"
            >
              <Kpi
                titulo={m.titulo}
                valor={m.valor}
                detalle={m.detalle}
                icono={m.icono}
                tendencia={m.tendencia ?? null}
              />
              <span
                className={`mt-1.5 flex items-center justify-center gap-1 ${DETALLE} transition-colors duration-200 ease-[var(--ease-bookea)]`}
              >
                {activa ? "Ocultar" : "Ver quiénes"}
                {/* Chevron inline: el set de `iconos.tsx` no tiene flecha,
                    y agregar una al catálogo por un detalle de esta
                    pantalla ensucia un vocabulario compartido. */}
                <svg
                  aria-hidden
                  viewBox="0 0 12 12"
                  className={`h-3 w-3 transition-transform duration-200 ease-[var(--ease-bookea)] ${activa ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 4.5 6 7.5 9 4.5" />
                </svg>
              </span>
            </button>

            <div className="desplegable" data-abierto={activa ? "true" : "false"}>
              <div className="min-h-0 overflow-hidden">
                <ListaDetalle metrica={m} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Las personas detrás de una cifra. Tope de 8 y el resto contado: una
 *  lista de 200 nombres dentro de una tarjeta no se lee, se sufre. */
function ListaDetalle({ metrica }: { metrica: MetricaAbrible }) {
  const TOPE = 8;
  const visibles = metrica.filas.slice(0, TOPE);
  const resto = metrica.filas.length - visibles.length;

  return (
    <div
      className={`mt-2 ${RADIO_TILE} border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5`}
    >
      {visibles.length === 0 ? (
        <p className={CUERPO_SUAVE}>{metrica.vacio}</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visibles.map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-aventurea-ink">
                    {f.nombre}
                  </span>
                  <span className={`block truncate ${DETALLE}`}>{f.apoyo}</span>
                </span>
                {f.cifra && (
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-aventurea-ink">
                    {f.cifra}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {resto > 0 && (
            <p className={`mt-2 ${DETALLE}`}>
              y {resto} más — la lista completa está en Clientes.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  ¿QUIÉNES NO ESTÁN VOLVIENDO?
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (30 ago 2026): «necesitamos métricas ejemplo
 * ¡QUIÉNES NO ESTÁN VOLVIENDO! una lista de clientes que tengan más de
 * una semana de no venir — la idea es que seamos una herramienta para
 * los negocios».
 *
 * Es la diferencia entre un tablero y una herramienta: «39 clientes
 * activos» no se puede accionar; «María no viene hace 12 días» sí.
 *
 * ── EL CORTE NO ES UNA SEMANA FIJA, Y ESO ES A PROPÓSITO ───────────
 * Una semana sin venir es normal en una barbería y es una alarma en una
 * cafetería. El repo ya resuelve esto: `ciclo-cliente.ts` clasifica
 * según el RITMO que el dueño eligió para su negocio (diario, semanal,
 * quincenal, mensual) y de ahí salen los tramos «en riesgo» y
 * «dormido». Se reusa esa clasificación en vez de clavar 7 días —
 * inventar un segundo criterio haría que esta lista y la de Clientes se
 * contradigan.
 *
 * «Perdido» queda afuera igual que en `TRAMOS_RESCATABLES`: a quien se
 * fue hace meses no se le escribe primero.
 */
export function ClientesQueNoVuelven({
  filas,
  ritmoEtiqueta,
  diasEnRiesgo,
  totalEnRiesgo,
  totalDormidos,
  hayClientes,
}: {
  filas: FilaDetalle[];
  ritmoEtiqueta: string;
  /** A partir de cuántos días sin venir cuenta como «en riesgo» en
   *  ESTE negocio. Se dice en pantalla: sin el número, «según tu
   *  ritmo» le pide al dueño que confíe en un cálculo que no ve. */
  diasEnRiesgo: number;
  totalEnRiesgo: number;
  totalDormidos: number;
  /** Sin clientes, «nadie se está enfriando» sería mentira. */
  hayClientes: boolean;
}) {
  const TOPE = 10;
  const visibles = filas.slice(0, TOPE);
  const resto = filas.length - visibles.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${ESTADO_PILDORA.aviso} rounded-lg px-2.5 py-1 text-[11px] font-bold`}>
          {totalEnRiesgo} en riesgo
        </span>
        <span className={`${ESTADO_PILDORA.neutro} rounded-lg px-2.5 py-1 text-[11px] font-bold`}>
          {totalDormidos} dormidos
        </span>
        <span className={DETALLE}>
          {ritmoEtiqueta.toLowerCase()} · se enfría a los {diasEnRiesgo} días
        </span>
      </div>

      {visibles.length === 0 ? (
        // Tres situaciones distintas que antes decían todas lo mismo
        // («nadie se está enfriando»), y en dos de ellas era falso.
        <p className={CUERPO_SUAVE}>
          {!hayClientes
            ? "Todavía no hay clientes afiliados: cuando empiecen a llegar, acá vas a ver a quiénes se les está espaciando la visita."
            : totalEnRiesgo + totalDormidos > 0
              ? "Hay clientes enfriándose, pero ninguno tiene visitas registradas todavía — sin una primera visita no se puede saber hace cuánto no vuelven."
              : "Ninguno de tus clientes pasó del margen que da tu ritmo. Cuando alguien empiece a espaciarse, aparece acá."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {visibles.map((f) => (
              <li
                key={f.id}
                className={`flex items-center justify-between gap-3 ${RADIO_TILE} border border-aventurea-line bg-aventurea-surface px-3 py-2.5`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-aventurea-ink">
                    {f.nombre}
                  </span>
                  <span className={`block truncate ${DETALLE}`}>{f.apoyo}</span>
                </span>
                {/* El tramo va en la píldora del sistema y no en texto
                    gris: «en riesgo» y «dormido» pedían distinguirse de
                    un vistazo, y en gris plano se veían idénticos. */}
                {f.cifra && (
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                      f.cifra.toLowerCase().includes("riesgo")
                        ? ESTADO_PILDORA.aviso
                        : ESTADO_PILDORA.neutro
                    }`}
                  >
                    {f.cifra}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {resto > 0 && (
            <p className={DETALLE}>
              y {resto} más. Desde <strong>Clientes</strong> los podés filtrar y escribirles a
              todos juntos.
            </p>
          )}
        </>
      )}
    </div>
  );
}
