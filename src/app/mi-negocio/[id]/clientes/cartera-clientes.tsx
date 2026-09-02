"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtColones } from "@/lib/finanzas";
import { fmtFechaCorta } from "@/lib/fechas";
import {
  CRITERIO_SEGMENTO,
  NOMBRE_SEGMENTO,
  SEGMENTOS,
  type Segmento,
} from "@/lib/crm-segmentos";
import { Card, CardVacia, Metrica } from "@/components/panel/piezas";
import { CAMPO_PANEL, DETALLE, RADIO_PILDORA } from "@/components/panel/sistema";

/**
 * LA CARTERA, OPERABLE — la mitad cliente del módulo Clientes.
 *
 * El servidor deriva y segmenta (page.tsx); acá solo se filtra, se
 * busca y se navega. Cero consultas desde el navegador: con 4000
 * reservas la cartera son unos cientos de filas, y filtrar en memoria
 * responde al teclazo sin spinner.
 *
 * ── POR QUÉ LA FILA ES UN LINK Y NO UN ACORDEÓN ────────────────────
 * El ancla vieja (`/citas#clientes`) expandía al cliente en el lugar.
 * Un CRM navega: la ficha 360° tiene historial, lealtad y notas — eso
 * no cabe en una fila expandida, y meterlo a la fuerza es lo que tenía
 * a «Clientes» como una lista de asistencia.
 */

export type FilaCartera = {
  clave: string;
  claveUrl: string;
  nombre: string | null;
  correo: string | null;
  whatsapp: string | null;
  segmento: Segmento;
  cumplidas: number;
  ultimaVisita: string | null;
  proximaCita: string | null;
  gastoTotal: number;
  diasSinVenir: number | null;
  etiquetas: string[];
};

/** El color de cada segmento — pares ya usados por el sistema del panel. */
const PILDORA_SEGMENTO: Record<Segmento, string> = {
  en_riesgo: "bg-red-50 text-red-700",
  inactivo: "bg-aventurea-cream-2 text-aventurea-ink-soft",
  vip: "bg-amber-50 text-amber-800",
  frecuente: "bg-aventurea-green-light text-aventurea-green",
  nuevo: "bg-aventurea-sky-light text-aventurea-navy",
  ocasional: "bg-aventurea-cream-2 text-aventurea-ink-soft",
};

export default function CarteraClientes({
  negocioId,
  filas,
  conteo,
}: {
  negocioId: string;
  filas: FilaCartera[];
  conteo: Record<Segmento, number>;
}) {
  const [segmento, setSegmento] = useState<Segmento | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      // Buscar IGNORA el segmento elegido: quien escribe un nombre está
      // buscando a ESA persona, y que no aparezca por una pestaña es el
      // peor resultado posible. Mismo criterio que el admin de Lealtad.
      if (q) {
        return (
          (f.nombre ?? "").toLowerCase().includes(q) ||
          (f.correo ?? "").toLowerCase().includes(q) ||
          (f.whatsapp ?? "").includes(q) ||
          f.etiquetas.some((e) => e.toLowerCase().includes(q))
        );
      }
      return segmento === "todos" || f.segmento === segmento;
    });
  }, [filas, segmento, busqueda]);

  const total = filas.length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── El pulso de la cartera ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Clientes" valor={String(total)} />
        <Metrica rotulo="En riesgo" valor={String(conteo.en_riesgo)} />
        <Metrica rotulo="Nuevos (30 días)" valor={String(conteo.nuevo)} />
        <Metrica rotulo="Inactivos" valor={String(conteo.inactivo)} />
      </div>

      {/* ── Buscar + segmentos ─────────────────────────────────────── */}
      <Card>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo, WhatsApp o etiqueta…"
          className={CAMPO_PANEL}
        />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSegmento("todos")}
            className={`${RADIO_PILDORA} px-2.5 py-1 text-[12px] font-bold ${
              segmento === "todos"
                ? "bg-aventurea-navy text-white"
                : "border border-aventurea-line bg-white text-aventurea-ink-soft"
            }`}
          >
            Todos · {total}
          </button>
          {SEGMENTOS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSegmento(s)}
              title={CRITERIO_SEGMENTO[s]}
              className={`${RADIO_PILDORA} px-2.5 py-1 text-[12px] font-bold ${
                segmento === s
                  ? "bg-aventurea-navy text-white"
                  : "border border-aventurea-line bg-white text-aventurea-ink-soft"
              }`}
            >
              {NOMBRE_SEGMENTO[s]} · {conteo[s]}
            </button>
          ))}
        </div>

        {/* El criterio del segmento elegido, dicho — un filtro que no
            explica su regla obliga a adivinarla. */}
        {segmento !== "todos" && !busqueda.trim() && (
          <p className={`mt-2 ${DETALLE}`}>{CRITERIO_SEGMENTO[segmento]}</p>
        )}
      </Card>

      {/* ── La cartera ─────────────────────────────────────────────── */}
      {visibles.length === 0 ? (
        <CardVacia>
          {busqueda.trim()
            ? "Nadie calza con esa búsqueda."
            : "Todavía no hay clientes en este segmento. Aparecen solos con cada reserva."}
        </CardVacia>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-white">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-aventurea-line bg-aventurea-cream-2/50 text-left text-[11px] uppercase tracking-[0.1em] text-aventurea-ink-soft">
                <th className="px-3.5 py-2.5 font-bold">Cliente</th>
                <th className="px-3.5 py-2.5 font-bold">Segmento</th>
                <th className="px-3.5 py-2.5 text-right font-bold">Visitas</th>
                <th className="px-3.5 py-2.5 text-right font-bold">Gastado</th>
                <th className="px-3.5 py-2.5 font-bold">Última visita</th>
                <th className="px-3.5 py-2.5 font-bold">Próxima</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr
                  key={f.clave}
                  className="border-b border-aventurea-line/60 transition-colors last:border-b-0 hover:bg-aventurea-cream-2/40"
                >
                  <td className="px-3.5 py-2.5">
                    {/* El link envuelve el nombre y no la fila entera:
                        una <tr> clickeable rompe la selección de texto
                        y el copiar un correo. */}
                    <Link
                      href={`/mi-negocio/${negocioId}/clientes/${f.claveUrl}`}
                      className="font-bold text-aventurea-navy hover:underline"
                    >
                      {f.nombre ?? f.correo ?? f.whatsapp ?? "Sin nombre"}
                    </Link>
                    <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                      {[f.correo, f.whatsapp].filter(Boolean).join(" · ") || "sin contacto"}
                    </span>
                    {f.etiquetas.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {f.etiquetas.map((e) => (
                          <span
                            key={e}
                            className="rounded-md bg-aventurea-sky-light px-1.5 py-0.5 text-[10.5px] font-bold text-aventurea-navy"
                          >
                            {e}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className={`${RADIO_PILDORA} inline-block px-2 py-0.5 text-[11px] font-bold ${PILDORA_SEGMENTO[f.segmento]}`}
                    >
                      {NOMBRE_SEGMENTO[f.segmento]}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums text-aventurea-ink">
                    {f.cumplidas}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-bold tabular-nums text-aventurea-ink">
                    {f.gastoTotal > 0 ? fmtColones(f.gastoTotal) : "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-aventurea-ink-soft">
                    {f.ultimaVisita ? (
                      <>
                        {fmtFechaCorta(f.ultimaVisita)}
                        {f.diasSinVenir !== null && f.diasSinVenir > 0 && (
                          <span className="ml-1 text-[11px]">({f.diasSinVenir} días)</span>
                        )}
                      </>
                    ) : (
                      "nunca vino"
                    )}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {f.proximaCita ? (
                      <span className="font-bold text-aventurea-green">
                        {fmtFechaCorta(f.proximaCita)}
                      </span>
                    ) : (
                      <span className="text-aventurea-ink-soft">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
