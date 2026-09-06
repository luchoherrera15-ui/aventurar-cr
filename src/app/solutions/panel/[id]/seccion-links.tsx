"use client";

import { useState, useTransition } from "react";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL } from "@/components/panel/sistema";
import { IconArrastrar } from "@/components/icons";
import SubirImagen from "@/components/subir-imagen";
import { iconoPorUrl } from "@/components/solutions/icono-link";
import {
  FORMATO_LINK,
  FORMATOS_LINK,
  ICONOS_LINK,
  ICONO_LINK,
  TOPES,
  type FormatoLink,
  type IconoLink,
  type LinkSolutions,
} from "@/lib/solutions/tipos";
import { guardarLinksSolutions } from "./actions";
import { prepararSubidaSolutions } from "../../subida-actions";

/**
 * ENLACES — el linktree, con arrastrar y soltar.
 *
 * Pedido del dueño (4 sep 2026): «poder editar las cosas en tiempo real
 * tipo drag and drop de agregar cosas, mover, etc.». Y el 6 sep 2026:
 * «que TODO sea 100 % customizable en el link hub, tipo Linktree».
 *
 * ── LO QUE UN ENLACE PUEDE SER (0236) ──────────────────────────────
 * Un botón (con descripción opcional debajo), un ÍCONO de red (va en la
 * fila de círculos bajo el nombre), un TÍTULO (separa grupos) o un
 * TEXTO (un párrafo: horario, promo). Título y texto no llevan a
 * ningún lado. El ícono se adivina al pegar la dirección
 * (`iconoPorUrl`): instagram.com/… ya sale con su logo.
 *
 * ── POR QUÉ HTML5 NATIVO Y NO UNA LIBRERÍA ─────────────────────────
 * `draggable` + dragstart/dragover/drop ya vienen en el navegador y
 * resuelven este caso —una lista en una sola columna— sin sumar una
 * dependencia de decenas de KB al bundle. Las librerías de DnD valen
 * cuando hay varias zonas, anidamiento o listas virtualizadas; acá
 * sería peso sin beneficio.
 *
 * ── EL TECLADO Y EL DEDO NO ARRASTRAN ──────────────────────────────
 * El arrastre HTML5 no existe en touch y es hostil con teclado, así que
 * los botones ↑ ↓ SE QUEDAN: son el camino accesible y el único que
 * funciona en teléfono. Arrastrar es el atajo del mouse, no el único
 * medio — si fuera el único, la pantalla quedaría inservible en la
 * mitad de los dispositivos.
 */

type Fila = {
  etiqueta: string;
  url: string;
  icono: IconoLink;
  visible: boolean;
  /** Foto detrás de esta puerta (0232). "" = sin foto. */
  fondoUrl: string;
  formato: FormatoLink;
  descripcion: string;
  /** true = el dueño eligió el ícono a mano; no se lo pisa al pegar una URL. */
  iconoFijado: boolean;
};

const PLACEHOLDER: Record<FormatoLink, { etiqueta: string; url: string }> = {
  boton: { etiqueta: "Reservá tu mesa", url: "instagram.com/tu-negocio" },
  icono: { etiqueta: "Instagram", url: "instagram.com/tu-negocio" },
  titulo: { etiqueta: "Nuestros servicios", url: "(sin dirección)" },
  texto: { etiqueta: "Abrimos de lunes a sábado, 9 a 18", url: "(sin dirección)" },
};

export default function SeccionLinks({
  negocioId,
  links,
}: {
  negocioId: string;
  links: LinkSolutions[];
}) {
  const [filas, setFilas] = useState<Fila[]>(
    links.map((l) => ({
      etiqueta: l.etiqueta,
      url: l.url,
      icono: l.icono,
      visible: l.visible,
      fondoUrl: l.fondo_url ?? "",
      formato: l.formato ?? "boton",
      descripcion: l.descripcion ?? "",
      iconoFijado: true,
    })),
  );
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta"; texto: string } | null>(null);
  const [guardando, arrancar] = useTransition();
  /** Índice que se está arrastrando, y sobre cuál está parado. */
  const [origen, setOrigen] = useState<number | null>(null);
  const [encima, setEncima] = useState<number | null>(null);

  const cambiar = (i: number, parte: Partial<Fila>) =>
    setFilas((p) => p.map((f, j) => (j === i ? { ...f, ...parte } : f)));

  /** Al escribir la dirección, el ícono se adivina — salvo que ya lo hayan elegido a mano. */
  const cambiarUrl = (i: number, url: string) =>
    setFilas((p) =>
      p.map((f, j) => {
        if (j !== i) return f;
        const adivinado = f.iconoFijado ? null : iconoPorUrl(url);
        return { ...f, url, icono: adivinado ?? f.icono };
      }),
    );

  /** Saca de `desde` y lo mete en `hasta` — el movimiento, uno solo. */
  const reordenar = (desde: number, hasta: number) =>
    setFilas((p) => {
      if (desde === hasta || desde < 0 || hasta < 0 || desde >= p.length || hasta >= p.length) return p;
      const c = [...p];
      const [x] = c.splice(desde, 1);
      c.splice(hasta, 0, x);
      return c;
    });

  const agregar = (formato: FormatoLink) =>
    setFilas((p) => [
      ...p,
      { etiqueta: "", url: "", icono: formato === "icono" ? "instagram" : "link", visible: true, fondoUrl: "", formato, descripcion: "", iconoFijado: false },
    ]);

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

  const redes = filas.filter((f) => f.formato === "icono").length;

  return (
    <div className="flex flex-col gap-4">
      <Card
        eyebrow="Tu link hub"
        titulo="Tus enlaces"
        accion={
          <PildoraEstado estado="neutro">
            {filas.length} de {TOPES.links}
          </PildoraEstado>
        }
      >
        <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
          Las piezas de tu página, en este orden. Arrastralas del asa de la izquierda para
          acomodarlas, o usá ↑ ↓. Un <strong>botón</strong> es una puerta grande; un{" "}
          <strong>ícono de red</strong> va en la fila de círculos bajo tu nombre; un{" "}
          <strong>título</strong> separa grupos y un <strong>texto</strong> es un párrafo corto. El
          catálogo ya tiene su botón propio. Pegá la dirección y el ícono se elige solo.
        </p>

        {filas.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2.5">
            {filas.map((l, i) => {
              const sinDestino = l.formato === "titulo" || l.formato === "texto";
              const ph = PLACEHOLDER[l.formato];
              return (
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
                  className={`grid gap-2 rounded-xl border p-2.5 transition-colors sm:grid-cols-[auto_120px_130px_minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-center ${
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
                    aria-label="Qué es"
                    value={l.formato}
                    onChange={(e) => cambiar(i, { formato: e.target.value as FormatoLink })}
                    className={CAMPO_PANEL}
                    title={FORMATO_LINK[l.formato].pie}
                  >
                    {FORMATOS_LINK.map((f) => (
                      <option key={f} value={f}>
                        {FORMATO_LINK[f].nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Ícono"
                    value={l.icono}
                    disabled={sinDestino}
                    onChange={(e) => cambiar(i, { icono: e.target.value as IconoLink, iconoFijado: true })}
                    className={`${CAMPO_PANEL} disabled:opacity-40`}
                  >
                    {ICONOS_LINK.filter((ic) => ic !== "menu").map((ic) => (
                      <option key={ic} value={ic}>
                        {ICONO_LINK[ic].nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={l.formato === "titulo" ? "Título" : l.formato === "texto" ? "Texto" : "Texto del botón"}
                    type="text"
                    value={l.etiqueta}
                    maxLength={l.formato === "texto" ? TOPES.textoLink : TOPES.etiquetaLink}
                    placeholder={ph.etiqueta}
                    onChange={(e) => cambiar(i, { etiqueta: e.target.value })}
                    className={CAMPO_PANEL}
                  />
                  <input
                    aria-label="Dirección"
                    type="text"
                    value={l.url}
                    disabled={sinDestino}
                    placeholder={ph.url}
                    onChange={(e) => cambiarUrl(i, e.target.value)}
                    className={`${CAMPO_PANEL} disabled:opacity-40`}
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

                  {/* ── Solo los botones: descripción y foto de fondo ──
                      Ocupan el ancho entero de la fila y no una columna
                      más: a 390 px la fila ya lleva seis controles. */}
                  {l.formato === "boton" && (
                    <div className="grid gap-2 sm:col-span-6 sm:grid-cols-2">
                      <div>
                        <input
                          aria-label="Descripción bajo el botón"
                          type="text"
                          value={l.descripcion}
                          maxLength={TOPES.descripcionLink}
                          placeholder="Descripción (opcional): «Lunes a viernes, 20 % off»"
                          onChange={(e) => cambiar(i, { descripcion: e.target.value })}
                          className={CAMPO_PANEL}
                        />
                      </div>
                      {/* `destino="banner"` y no uno nuevo: una card es
                          apaisada como una banda, y ese preset ya comprime a
                          1200 px, de sobra para un fondo de 400 px de ancho. */}
                      <SubirImagen
                        valor={l.fondoUrl}
                        alCambiar={(u) => cambiar(i, { fondoUrl: u })}
                        destino="banner"
                        etiqueta="Foto de fondo (opcional)"
                        carpeta="solutions/links"
                        bucket="solutions-fotos"
                        subidaDirecta={prepararSubidaSolutions}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {filas.length < TOPES.links && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => agregar("boton")} className={BOTON_PANEL}>
              + Botón
            </button>
            <button type="button" onClick={() => agregar("icono")} className={BOTON_PANEL}>
              + Ícono de red{redes > 0 ? ` (${redes})` : ""}
            </button>
            <button type="button" onClick={() => agregar("titulo")} className={BOTON_PANEL}>
              + Título
            </button>
            <button type="button" onClick={() => agregar("texto")} className={BOTON_PANEL}>
              + Texto
            </button>
          </div>
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
