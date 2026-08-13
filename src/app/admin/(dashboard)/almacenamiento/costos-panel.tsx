"use client";

/**
 * Auditoría de plata: qué cuesta la multimedia y de dónde sale.
 *
 * ── LA REGLA DE ESTA PANTALLA ────────────────────────────────────────
 *
 * Hay tres calidades de número conviviendo acá y NO se pueden ver igual:
 *
 *   MEDIDO      bytes e imágenes guardadas. Sale de nuestra base.
 *   REAL        el total de entregas del mes. Lo dice Cloudflare.
 *   ESTIMADO    el reparto de ese total por álbum. Lo calculamos nosotros.
 *
 * Cloudflare no agrupa sus entregas por nuestros álbumes y nunca lo va a
 * hacer: su analítica es de la cuenta. Así que la columna de entregas
 * por fila es una estimación, y va marcada fila por fila. Una pantalla
 * de costos que muestre los tres niveles con la misma tipografía es peor
 * que no tenerla — invita a decidir con una precisión que no existe.
 */

import { useMemo, useState } from "react";
import { formatearBytes, formatearCRC, formatearUSD } from "@/lib/dinero";
import type { Comparacion, FilaAlbumLegacy, FilaAuditada, Progreso } from "@/lib/media/auditoria";
import type { Precios } from "@/lib/media/precios";

export type DatosCostos = {
  precios: Precios;
  /** Qué precios están pisados por variable de entorno. */
  ajustados: string[];
  preciosAl: string;
  analitica:
    | { disponible: true; entregas: number | null; desde: string; hasta: string; parcial: string[] }
    | { disponible: false; motivo: string };
  albumes: (FilaAlbumLegacy & { costoLegacyUSD: number })[];
  filas: FilaAuditada[];
  comparacion: Comparacion;
  progreso: Progreso;
};

const thCls =
  "px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const tdCls = "px-4 py-3 align-top";

/** Un sello que dice de qué calidad es el número de al lado. */
function Sello({ base }: { base: FilaAuditada["baseDelReparto"] }) {
  const estilos = {
    "trafico-medido": {
      clase: "bg-emerald-50 text-emerald-700",
      texto: "con tráfico real",
      ayuda: "Se ajustó con las visitas medidas de esta entidad.",
    },
    proporcional: {
      clase: "bg-amber-50 text-amber-700",
      texto: "estimado",
      ayuda:
        "Reparto proporcional a las imágenes guardadas: esta entidad no tiene contador de visitas.",
    },
    "sin-datos": {
      clase: "bg-aventurea-cream-2 text-aventurea-ink-soft",
      texto: "sin datos",
      ayuda: "Cloudflare no devolvió el total de entregas.",
    },
  }[base];
  return (
    <span
      title={estilos.ayuda}
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${estilos.clase}`}
    >
      {estilos.texto}
    </span>
  );
}

function Tarjeta({
  titulo,
  valor,
  pie,
  tono = "normal",
}: {
  titulo: string;
  valor: string;
  pie?: string;
  tono?: "normal" | "bueno" | "navy";
}) {
  const fondo =
    tono === "navy"
      ? "bg-aventurea-navy text-white"
      : tono === "bueno"
        ? "bg-emerald-50"
        : "bg-aventurea-surface";
  const suave = tono === "navy" ? "text-white/70" : "text-aventurea-ink-soft";
  return (
    <div className={`rounded-2xl border border-aventurea-line p-5 shadow-sm ${fondo}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wide ${suave}`}>{titulo}</p>
      <p className="mt-2 text-2xl font-bold leading-tight tabular-nums">{valor}</p>
      {pie && <p className={`mt-2 text-[11.5px] ${suave}`}>{pie}</p>}
    </div>
  );
}

const TABS = [
  { id: "plata", label: "Costo", hint: "Qué se paga y de dónde sale" },
  { id: "albumes", label: "Por álbum", hint: "El mayor volumen, uno por uno" },
  { id: "entidades", label: "Ya en Cloudflare", hint: "Lo migrado, por entidad" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function CostosPanel({ datos }: { datos: DatosCostos }) {
  const [activa, setActiva] = useState<Tab>("plata");
  const { precios, comparacion, progreso, analitica } = datos;

  const maxAlbum = useMemo(
    () => Math.max(1, ...datos.albumes.map((a) => a.bytes)),
    [datos.albumes],
  );

  const dinero = (usd: number) => `${formatearUSD(usd)} · ${formatearCRC(usd * precios.tipoCambio)}`;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Auditoría de costos"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-aventurea-line bg-aventurea-surface p-1.5 shadow-sm"
      >
        {TABS.map((t) => {
          const sel = activa === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setActiva(t.id)}
              className={`basis-full rounded-xl px-4 py-2.5 text-left transition-colors sm:flex-1 sm:basis-0 ${
                sel
                  ? "bg-aventurea-navy text-white"
                  : "text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
              }`}
            >
              <span className="block text-[13.5px] font-bold">{t.label}</span>
              <span
                className={`mt-0.5 hidden text-[11.5px] sm:block ${
                  sel ? "text-white/70" : "text-aventurea-ink-soft"
                }`}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Costo ────────────────────────────────────────────── */}
      <div className={`mt-6 ${activa === "plata" ? "" : "hidden"}`}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tarjeta
            titulo="Hoy, en Supabase"
            valor={dinero(comparacion.supabase.totalUSD)}
            pie={`${formatearUSD(comparacion.supabase.entregaUSD)} son de egreso`}
            tono="navy"
          />
          <Tarjeta
            titulo="Lo mismo en Cloudflare"
            valor={dinero(comparacion.cloudflare.totalUSD)}
            pie="R2 no cobra egreso: ese renglón vale $0"
          />
          <Tarjeta
            titulo="Ahorro por mes"
            valor={dinero(comparacion.ahorroUSD)}
            pie={`${Math.round(comparacion.ahorroPorcentaje)}% menos · ${formatearUSD(
              comparacion.ahorroPorEgresoUSD,
            )} vienen del egreso`}
            tono={comparacion.ahorroUSD > 0 ? "bueno" : "normal"}
          />
          <Tarjeta
            titulo="Migrado"
            valor={`${Math.round(progreso.porcentaje)}%`}
            pie={`${progreso.archivosMigrados.toLocaleString("es-CR")} de ${progreso.archivosLegacy.toLocaleString(
              "es-CR",
            )} archivos · ${progreso.albumesSinTocar} álbumes sin tocar`}
          />
        </div>

        {/* De dónde salen los números. Va arriba, no en una nota al pie. */}
        <div className="mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 shadow-sm">
          <h3 className="text-[13.5px] font-bold text-aventurea-ink">De dónde salen estos números</h3>
          <ul className="mt-3 space-y-2 text-[12.5px] text-aventurea-ink-soft">
            <li>
              <strong className="text-aventurea-ink">Gigas e imágenes guardadas:</strong> medidos por
              nosotros. Son exactos.
            </li>
            <li>
              <strong className="text-aventurea-ink">Entregas del mes:</strong>{" "}
              {analitica.disponible ? (
                <>
                  {analitica.entregas === null ? (
                    <span className="text-amber-700">
                      Cloudflare respondió pero no devolvió el dato.
                    </span>
                  ) : (
                    <>
                      {analitica.entregas.toLocaleString("es-CR")} imágenes servidas entre el{" "}
                      {analitica.desde} y el {analitica.hasta}, según Cloudflare. Es un dato real,
                      pero <strong>de la cuenta entera</strong>.
                    </>
                  )}
                  {analitica.parcial.length > 0 && (
                    <span className="text-amber-700">
                      {" "}
                      No se pudo leer: {analitica.parcial.join(" · ")}.
                    </span>
                  )}
                </>
              ) : (
                <span className="text-amber-700">{analitica.motivo}</span>
              )}
            </li>
            <li>
              <strong className="text-aventurea-ink">Entregas por álbum:</strong> una{" "}
              <strong>estimación</strong> nuestra. Cloudflare no agrupa sus entregas por nuestras
              entidades, así que su total se reparte proporcionalmente a las imágenes guardadas,
              ajustado por visitas donde las medimos. Cada fila dice en qué se apoya.
            </li>
            <li>
              <strong className="text-aventurea-ink">Precios:</strong> lista pública al{" "}
              {datos.preciosAl}, no tu factura.{" "}
              {datos.ajustados.length > 0 ? (
                <>Ajustaste {datos.ajustados.length} por variable de entorno.</>
              ) : (
                <>Ninguno está ajustado; se pueden pisar por variable de entorno.</>
              )}{" "}
              R2 ${precios.r2AlmacenamientoGbMes}/GB-mes · Images $
              {precios.imagenesEntregadas100k}/100k entregas · Supabase egreso $
              {precios.supabaseEgressGb}/GB · ₡{precios.tipoCambio}/USD.
            </li>
          </ul>
        </div>
      </div>

      {/* ── Por álbum ─────────────────────────────────────────── */}
      <div className={`mt-6 ${activa === "albumes" ? "" : "hidden"}`}>
        {datos.albumes.length === 0 ? (
          <p className="rounded-2xl bg-aventurea-cream-2 p-5 text-[13px] text-aventurea-ink-soft">
            Ningún álbum tiene fotos en Supabase Storage todavía.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-aventurea-line">
                <tr>
                  <th className={thCls}>Álbum</th>
                  <th className={thCls}>Fotos</th>
                  <th className={thCls}>Peso</th>
                  <th className={thCls}>Costo hoy (mes)</th>
                  <th className={thCls}>Migración</th>
                </tr>
              </thead>
              <tbody>
                {datos.albumes.map((a) => {
                  const pct = a.archivos > 0 ? Math.min(100, (a.migradas / a.archivos) * 100) : 0;
                  return (
                    <tr key={a.albumId} className="border-b border-aventurea-line/60 last:border-0">
                      <td className={tdCls}>
                        <span className="font-bold text-aventurea-ink">{a.titulo || "—"}</span>
                        <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                          /a/{a.slug}
                        </span>
                      </td>
                      <td className={`${tdCls} tabular-nums`}>{a.archivos.toLocaleString("es-CR")}</td>
                      <td className={`${tdCls} tabular-nums`}>
                        {formatearBytes(a.bytes)}
                        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-aventurea-cream-2">
                          <span
                            className="block h-full rounded-full bg-aventurea-navy"
                            style={{ width: `${Math.max((a.bytes / maxAlbum) * 100, 2)}%` }}
                          />
                        </span>
                      </td>
                      <td className={`${tdCls} tabular-nums`}>{dinero(a.costoLegacyUSD)}</td>
                      <td className={tdCls}>
                        {pct === 0 ? (
                          <span className="text-[11.5px] text-aventurea-ink-soft">Sin tocar</span>
                        ) : pct >= 100 ? (
                          <span className="text-[11.5px] font-bold text-emerald-700">Migrado</span>
                        ) : (
                          <span className="text-[11.5px] font-bold text-amber-700">
                            {Math.round(pct)}% a medias
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Ya en Cloudflare ──────────────────────────────────── */}
      <div className={`mt-6 ${activa === "entidades" ? "" : "hidden"}`}>
        {datos.filas.length === 0 ? (
          <p className="rounded-2xl bg-aventurea-cream-2 p-5 text-[13px] text-aventurea-ink-soft">
            Todavía no hay nada en R2 ni en Cloudflare Images. Cuando corra la migración, acá se ve
            qué cuesta cada álbum, invitación y negocio.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="border-b border-aventurea-line">
                <tr>
                  <th className={thCls}>Qué</th>
                  <th className={thCls}>Tipo</th>
                  <th className={thCls}>Peso en R2</th>
                  <th className={thCls}>Imágenes</th>
                  <th className={thCls}>Entregas del mes</th>
                  <th className={thCls}>Costo (mes)</th>
                </tr>
              </thead>
              <tbody>
                {datos.filas.map((f) => (
                  <tr key={f.entityId} className="border-b border-aventurea-line/60 last:border-0">
                    <td className={tdCls}>
                      <span className="font-bold text-aventurea-ink">{f.nombre}</span>
                      {f.visitas30d !== null && (
                        <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                          {f.visitas30d.toLocaleString("es-CR")} visitas en 30 días
                        </span>
                      )}
                    </td>
                    <td className={`${tdCls} text-[11.5px] text-aventurea-ink-soft`}>
                      {f.entityType}
                    </td>
                    <td className={`${tdCls} tabular-nums`}>{formatearBytes(f.bytes)}</td>
                    <td className={`${tdCls} tabular-nums`}>{f.imagenesCf.toLocaleString("es-CR")}</td>
                    <td className={tdCls}>
                      <span className="tabular-nums">
                        {f.entregasEstimadas === null
                          ? "—"
                          : f.entregasEstimadas.toLocaleString("es-CR")}
                      </span>
                      <span className="mt-1 block">
                        <Sello base={f.baseDelReparto} />
                      </span>
                    </td>
                    <td className={`${tdCls} tabular-nums font-bold`}>
                      {dinero(f.costo.totalUSD)}
                      <span className="mt-0.5 block text-[11px] font-normal text-aventurea-ink-soft">
                        {formatearUSD(f.costo.almacenamientoUSD)} disco +{" "}
                        {formatearUSD(f.costo.entregaUSD)} entrega
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
