"use client";

import { useState, useTransition } from "react";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL } from "@/components/panel/sistema";
import { ICONOS_LINK, ICONO_LINK, TOPES, type IconoLink, type LinkSolutions } from "@/lib/solutions/tipos";
import { guardarLinksSolutions } from "./actions";

type Fila = { etiqueta: string; url: string; icono: IconoLink; visible: boolean };

/** ENLACES — el linktree. Filas sueltas, un solo «Guardar», reemplazo completo. */
export default function SeccionLinks({ negocioId, links }: { negocioId: string; links: LinkSolutions[] }) {
  const [filas, setFilas] = useState<Fila[]>(links.map((l) => ({ etiqueta: l.etiqueta, url: l.url, icono: l.icono, visible: l.visible })));
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta"; texto: string } | null>(null);
  const [guardando, arrancar] = useTransition();

  const cambiar = (i: number, parte: Partial<Fila>) => setFilas((p) => p.map((f, j) => (j === i ? { ...f, ...parte } : f)));
  const mover = (i: number, d: -1 | 1) =>
    setFilas((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const c = [...p];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const guardar = () => {
    setMsg(null);
    arrancar(async () => {
      const r = await guardarLinksSolutions(negocioId, filas);
      setMsg(r.ok ? { tono: "exito", texto: "Enlaces guardados." } : { tono: "alerta", texto: r.motivo });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card eyebrow="Tu linktree" titulo="Tus enlaces" accion={<PildoraEstado estado="neutro">{filas.length} de {TOPES.links}</PildoraEstado>}>
        <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
          Las puertas de tu página, en este orden: Instagram, reservas, tu web, cómo llegar… La carta ya tiene su
          botón propio, no hace falta agregarla.
        </p>

        {filas.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2.5">
            {filas.map((l, i) => (
              <li key={i} className="grid gap-2 rounded-xl border border-aventurea-line p-2.5 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center">
                <select aria-label="Ícono" value={l.icono} onChange={(e) => cambiar(i, { icono: e.target.value as IconoLink })} className={CAMPO_PANEL}>
                  {ICONOS_LINK.map((ic) => (
                    <option key={ic} value={ic}>{ICONO_LINK[ic].glifo} {ICONO_LINK[ic].nombre}</option>
                  ))}
                </select>
                <input aria-label="Texto del botón" type="text" value={l.etiqueta} maxLength={TOPES.etiquetaLink} placeholder="Reservá tu mesa" onChange={(e) => cambiar(i, { etiqueta: e.target.value })} className={CAMPO_PANEL} />
                <input aria-label="Dirección" type="text" value={l.url} placeholder="instagram.com/tu-negocio" onChange={(e) => cambiar(i, { url: e.target.value })} className={CAMPO_PANEL} />
                <div className="flex items-center gap-1">
                  <label className="mr-1 flex items-center gap-1 text-[11.5px] font-bold text-aventurea-ink-soft" title="Visible">
                    <input type="checkbox" checked={l.visible} onChange={(e) => cambiar(i, { visible: e.target.checked })} className="h-3.5 w-3.5" />
                    ver
                  </label>
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px] disabled:opacity-40">↑</button>
                  <button type="button" aria-label="Bajar" disabled={i === filas.length - 1} onClick={() => mover(i, 1)} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px] disabled:opacity-40">↓</button>
                  <button type="button" aria-label="Quitar" onClick={() => setFilas((p) => p.filter((_, j) => j !== i))} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px]">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {filas.length < TOPES.links && (
          <button type="button" onClick={() => setFilas((p) => [...p, { etiqueta: "", url: "", icono: "link", visible: true }])} className={`mt-3 ${BOTON_PANEL}`}>
            + Agregar enlace
          </button>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando} className={BOTON_PANEL_PRIMARIO}>
          {guardando ? "Guardando…" : "Guardar enlaces"}
        </button>
        {msg && <p className={`text-[13px] font-bold ${msg.tono === "exito" ? "text-green-700" : "text-red-700"}`}>{msg.texto}</p>}
      </div>
    </div>
  );
}
