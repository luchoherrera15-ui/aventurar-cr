"use client";

import { useState, useTransition } from "react";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL } from "@/components/panel/sistema";
import { IconArrastrar } from "@/components/icons";
import {
  ICONOS_LINK,
  ICONO_LINK,
  TOPES,
  type IconoLink,
  type LinkSolutions,
} from "@/lib/solutions/tipos";
import { guardarLinksSolutions } from "./actions";

/**
 * ENLACES — el linktree, con arrastrar y soltar.
 *
 * Pedido del dueño (4 sep 2026): «poder editar las cosas en tiempo real
 * tipo drag and drop de agregar cosas, mover, etc.».
 *
 * ── POR QUÉ HTML5 NATIVO Y NO UNA LIBRERÍA ─────────────────────────
 * `draggable` + dragstart/dragover/drop ya vienen en el navegador y
 * resuelven este caso —una lista de ≤12 en una sola columna— sin sumar
 * una dependencia de decenas de KB al bundle. Las librerías de DnD
 * valen cuando hay varias zonas, anidamiento o listas virtualizadas;
 * acá sería peso sin beneficio.
 *
 * ── EL TECLADO Y EL DEDO NO ARRASTRAN ──────────────────────────────
 * El arrastre HTML5 no existe en touch y es hostil con teclado, así que
 * los botones ↑ ↓ SE QUEDAN: son el camino accesible y el único que
 * funciona en teléfono. Arrastrar es el atajo del mouse, no el único
 * medio — si fuera el único, la pantalla quedaría inservible en la
 * mitad de los dispositivos.
 */

type Fila = { etiqueta: string; url: string; icono: IconoLink; visible: boolean };

export default function SeccionLinks({
  negocioId,
  links,
}: {
  negocioId: string;
  links: LinkSolutions[];
}) {
  const [filas, setFilas] = useState<Fila[]>(
    links.map((l) => ({ etiqueta: l.etiqueta, url: l.url, icono: l.icono, visible: l.visible })),
  );
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta"; texto: string } | null>(null);
  const [guardando, arrancar] = useTransition();
  /** Índice que se está arrastrando, y sobre cuál está parado. */
  const [origen, setOrigen] = useState<number | null>(null);
  const [encima, setEncima] = useState<number | null>(null);

  const cambiar = (i: number, parte: Partial<Fila>) =>
    setFilas((p) => p.map((f, j) => (j === i ? { ...f, ...parte } : f)));

  /** Saca de `desde` y lo mete en `hasta` — el movimiento, uno solo. */
  const reordenar = (desde: number, hasta: number) =>
    setFilas((p) => {
      if (desde === hasta || desde < 0 || hasta < 0 || desde >= p.length || hasta >= p.length) return p;
      const c = [...p];
      const [x] = c.splice(desde, 1);
      c.splice(hasta, 0, x);
      return c;
    });

  const guardar = () => {
    setMsg(null);
    arrancar(async () => {
      const r = await guardarLinksSolutions(negocioId, filas);
      setMsg(
        r.ok
          ? { tono: "exito", texto: "Enlaces guardados." }
          : { tono: "alerta", texto: r.motivo },
      );
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        eyebrow="Tu linktree"
        titulo="Tus enlaces"
        accion={
          <PildoraEstado estado="neutro">
            {filas.length} de {TOPES.links}
          </PildoraEstado>
        }
      >
        <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
          Las puertas de tu página, en este orden. Arrastralas del asa de la izquierda para
          acomodarlas, o usá ↑ ↓. La carta ya tiene su botón propio.
        </p>

        {filas.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2.5">
            {filas.map((l, i) => (
              <li
                key={i}
                // El <li> entero es la zona de caída: soltar en cualquier
                // parte de la fila la inserta ahí, no solo sobre el asa.
                onDragOver={(e) => {
                  if (origen === null) return;
                  e.preventDefault();
                  setEncima(i);
                }}
                onDragLeave={() => setEncima((v) => (v === i ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (origen !== null) reordenar(origen, i);
                  setOrigen(null);
                  setEncima(null);
                }}
                className={`grid gap-2 rounded-xl border p-2.5 transition-colors sm:grid-cols-[auto_140px_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center ${
                  origen === i
                    ? "border-aventurea-navy opacity-50"
                    : encima === i
                      ? "border-aventurea-navy bg-aventurea-navy/5"
                      : "border-aventurea-line"
                }`}
              >
                {/* El asa. `draggable` va ACÁ y no en el <li>: si el
                    <li> entero fuera arrastrable, seleccionar texto en
                    los campos arrancaría un arrastre en vez de
                    seleccionar. */}
                <span
                  draggable
                  onDragStart={(e) => {
                    setOrigen(i);
                    e.dataTransfer.effectAllowed = "move";
                    // Firefox no arranca el arrastre sin datos puestos.
                    e.dataTransfer.setData("text/plain", String(i));
                  }}
                  onDragEnd={() => {
                    setOrigen(null);
                    setEncima(null);
                  }}
                  role="button"
                  tabIndex={-1}
                  aria-hidden
                  title="Arrastrá para mover"
                  className="hidden h-9 w-6 cursor-grab select-none items-center justify-center text-[15px] text-aventurea-ink-soft active:cursor-grabbing sm:flex"
                >
                  <IconArrastrar className="h-4 w-4" />
                </span>

                <select
                  aria-label="Ícono"
                  value={l.icono}
                  onChange={(e) => cambiar(i, { icono: e.target.value as IconoLink })}
                  className={CAMPO_PANEL}
                >
                  {ICONOS_LINK.map((ic) => (
                    <option key={ic} value={ic}>
                      {ICONO_LINK[ic].nombre}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Texto del botón"
                  type="text"
                  value={l.etiqueta}
                  maxLength={TOPES.etiquetaLink}
                  placeholder="Reservá tu mesa"
                  onChange={(e) => cambiar(i, { etiqueta: e.target.value })}
                  className={CAMPO_PANEL}
                />
                <input
                  aria-label="Dirección"
                  type="text"
                  value={l.url}
                  placeholder="instagram.com/tu-negocio"
                  onChange={(e) => cambiar(i, { url: e.target.value })}
                  className={CAMPO_PANEL}
                />
                <div className="flex items-center gap-1">
                  <label
                    className="mr-1 flex items-center gap-1 text-[11.5px] font-bold text-aventurea-ink-soft"
                    title="Visible en la página"
                  >
                    <input
                      type="checkbox"
                      checked={l.visible}
                      onChange={(e) => cambiar(i, { visible: e.target.checked })}
                      className="h-3.5 w-3.5"
                    />
                    ver
                  </label>
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => reordenar(i, i - 1)} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px] disabled:opacity-40">
                    ↑
                  </button>
                  <button type="button" aria-label="Bajar" disabled={i === filas.length - 1} onClick={() => reordenar(i, i + 1)} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px] disabled:opacity-40">
                    ↓
                  </button>
                  <button type="button" aria-label="Quitar" onClick={() => setFilas((p) => p.filter((_, j) => j !== i))} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px]">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {filas.length < TOPES.links && (
          <button
            type="button"
            onClick={() => setFilas((p) => [...p, { etiqueta: "", url: "", icono: "link", visible: true }])}
            className={`mt-3 ${BOTON_PANEL}`}
          >
            + Agregar enlace
          </button>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando} className={BOTON_PANEL_PRIMARIO}>
          {guardando ? "Guardando…" : "Guardar enlaces"}
        </button>
        {msg && (
          <p className={`text-[13px] font-bold ${msg.tono === "exito" ? "text-green-700" : "text-red-700"}`}>
            {msg.texto}
          </p>
        )}
      </div>
    </div>
  );
}
