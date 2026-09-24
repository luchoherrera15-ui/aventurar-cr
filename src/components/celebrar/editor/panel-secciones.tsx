"use client";

import { useEffect, useRef, useState } from "react";
import { prepararSubidaCelebrar } from "@/app/celebrar/editor/acciones";
import CampoColor from "@/components/campo-color";
import SubirImagen from "@/components/subir-imagen";
import { normalizarColor } from "@/lib/invitaciones/paleta";
import { PRECIO_PLANTILLA_CRC, colones } from "@/lib/celebrar/creditos";
import {
  ALINEACIONES,
  FONDOS_VIVOS_SECCION,
  MODOS_RSVP,
  NOMBRE_MODO_RSVP,
  NOMBRE_TIPO_PREGUNTA,
  TIPOS_PREGUNTA,
  NOMBRE_FONDO_VIVO,
  NOMBRE_SECCION,
  NOMBRE_TAMANO_SECCION,
  NOMBRE_TONO_SECCION,
  TAMANOS_SECCION,
  TIPOS_SECCION,
  TONOS_SECCION,
  idSeccion,
  moverSeccion,
  normalizarSeccion,
  type DatosSeccion,
  type DisenoSeccion,
  type Documento,
  type Seccion,
  type TipoSeccion,
} from "@/lib/celebrar/invitacion/esquema";
import { Area, BotonFila, Campo, Interruptor } from "./campos";

/** Las secciones que traen algo más que texto: se venden como «Pro» en el catálogo. */
const PRO: ReadonlySet<TipoSeccion> = new Set(["historia", "galeria", "itinerario", "dress_code", "faq"]);

/** El ícono de línea de cada tipo de sección, para la lista. */
const ICONO: Record<TipoSeccion, React.ReactNode> = {
  hero: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  countdown: <path d="M7 3h10M9 3v4l-3 4 3 4v6h6v-6l3-4-3-4V3" />,
  detalles: <path d="M4 5h16v15H4zM4 10h16M8 3v4M16 3v4" />,
  ubicacion: <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  historia: <path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5z" />,
  galeria: <path d="M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M15 9h.01" />,
  dress_code: <path d="M8 3l4 3 4-3 3 4-3 2v12H8V9L5 7z" />,
  itinerario: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  rsvp: <path d="M3 6h18v12H3zM3 7l9 6 9-6" />,
  regalos: <path d="M3 9h18v11H3zM3 13h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z" />,
  mensaje: <path d="M4 5h16v11H9l-5 4z" />,
  faq: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5M12 17h.01" />,
};

function IconoSeccion({ tipo, className = "h-5 w-5" }: { tipo: TipoSeccion; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONO[tipo]}
    </svg>
  );
}

/**
 * La pestaña «Secciones» — el corazón del editor. Cada sección es una
 * tarjeta con su ícono, su nombre, su interruptor y sus flechas; la
 * activa se abre y muestra sus campos ahí mismo, más «Diseño de esta
 * sección» (tono, foto de fondo, alineación, aire, ornamento) y un botón
 * «Siguiente sección» para recorrer la invitación de arriba a abajo.
 * Tocar una sección acá la resalta en el teléfono, y tocarla en el
 * teléfono la abre acá.
 */
export default function PanelSecciones({
  doc,
  celebracionId,
  cambiar,
  activa,
  alSeleccionar,
}: {
  doc: Documento;
  celebracionId: string;
  cambiar: (fn: (d: Documento) => Documento) => void;
  /** El id de la sección seleccionada (compartido con la previa). */
  activa: string | null;
  alSeleccionar: (id: string | null) => void;
}) {
  const presentes = new Set(doc.secciones.map((s) => s.tipo));
  const faltantes = TIPOS_SECCION.filter((t) => t !== "hero" && !presentes.has(t));

  function actualizar(id: string, fn: (s: Seccion) => Seccion) {
    cambiar((d) => ({ ...d, secciones: d.secciones.map((s) => (s.id === id ? fn(s) : s)) }));
  }
  function quitar(id: string) {
    cambiar((d) => ({ ...d, secciones: d.secciones.filter((s) => s.id !== id) }));
    if (activa === id) alSeleccionar(null);
  }
  function agregar(tipo: TipoSeccion) {
    const nueva = normalizarSeccion({ id: idSeccion(), tipo, visible: true, datos: { titulo: NOMBRE_SECCION[tipo] } });
    if (!nueva) return;
    cambiar((d) => ({ ...d, secciones: [...d.secciones, nueva] }));
    alSeleccionar(nueva.id);
  }

  return (
    <div className="grid gap-3">
      <p className="text-[13px] leading-snug text-(--c-tinta-suave)">
        Prendé una sección y editala acá mismo. Los cambios se ven al instante en el teléfono; tocá una sección en el
        teléfono para abrirla acá.
      </p>

      {doc.secciones.map((s, i) => (
        <TarjetaSeccion
          key={s.id}
          s={s}
          indice={i}
          total={doc.secciones.length}
          abierta={activa === s.id}
          celebracionId={celebracionId}
          alAbrir={() => alSeleccionar(activa === s.id ? null : s.id)}
          alSiguiente={() => alSeleccionar(doc.secciones[i + 1]?.id ?? null)}
          alMover={(dir) => cambiar((d) => ({ ...d, secciones: moverSeccion(d.secciones, s.id, dir) }))}
          alCambiarVisible={(v) => actualizar(s.id, (x) => ({ ...x, visible: v }) as Seccion)}
          actualizar={(fn) => actualizar(s.id, fn)}
          quitar={() => quitar(s.id)}
        />
      ))}

      {faltantes.length > 0 && (
        <div className="c-tarjeta p-4">
          <p className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">Agregar sección</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {faltantes.map((t) => (
              <button key={t} type="button" onClick={() => agregar(t)} className="c-montserrat inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-(--c-linea) px-3 text-[13px] font-semibold text-(--c-tinta) hover:border-(--c-marino)">
                <IconoSeccion tipo={t} className="h-4 w-4 text-(--c-tinta-suave)" />
                {NOMBRE_SECCION[t]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── La tarjeta de una sección ─────────────────────────────────── */

function TarjetaSeccion({
  s,
  indice,
  total,
  abierta,
  celebracionId,
  alAbrir,
  alSiguiente,
  alMover,
  alCambiarVisible,
  actualizar,
  quitar,
}: {
  s: Seccion;
  indice: number;
  total: number;
  abierta: boolean;
  celebracionId: string;
  alAbrir: () => void;
  alSiguiente: () => void;
  alMover: (dir: -1 | 1) => void;
  alCambiarVisible: (v: boolean) => void;
  actualizar: (fn: (s: Seccion) => Seccion) => void;
  quitar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pestana, setPestana] = useState<"contenido" | "diseno">("contenido");
  const esHero = s.tipo === "hero";
  const apagada = !esHero && !s.visible;

  // Cuando se selecciona desde el teléfono, la tarjeta se trae a la vista.
  useEffect(() => {
    if (abierta) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [abierta]);

  return (
    <div
      ref={ref}
      className={`c-tarjeta overflow-hidden transition-shadow duration-(--duracion-micro) ease-(--ease-bookea) ${abierta ? "shadow-elevado ring-2 ring-(--c-marino)" : ""} ${apagada ? "opacity-70" : ""}`}
      data-seccion={s.id}
    >
      <div className="flex min-h-14 items-center gap-3 px-3 py-2">
        <button type="button" onClick={alAbrir} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={abierta}>
          <span className={`c-disco h-9 w-9 shrink-0 rounded-xl ${apagada ? "opacity-60" : ""}`}>
            <IconoSeccion tipo={s.tipo} className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className={`c-montserrat truncate text-[14px] font-semibold ${apagada ? "text-(--c-tinta-suave)" : "text-(--c-tinta)"}`}>
                {NOMBRE_SECCION[s.tipo]}
              </span>
              <span className={`c-montserrat shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ${PRO.has(s.tipo) ? "bg-(--c-marino) text-(--c-blanco)" : "bg-(--c-hielo) text-(--c-tinta-suave)"}`}>
                {PRO.has(s.tipo) ? "Pro" : "Básico"}
              </span>
            </span>
            <span className="block text-[12px] text-(--c-azul)">{apagada ? "Tocá para prenderla y editar" : abierta ? "Editando" : "Editar"}</span>
          </span>
        </button>
        {esHero ? (
          <span className="c-montserrat text-[11px] font-semibold text-(--c-tinta-suave)">Fija</span>
        ) : (
          <>
            <span className="flex flex-col">
              <BotonFila etiqueta="Subir" disabled={indice <= 1} onClick={() => alMover(-1)}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 15 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </BotonFila>
              <BotonFila etiqueta="Bajar" disabled={indice >= total - 1} onClick={() => alMover(1)}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </BotonFila>
            </span>
            <Interruptor id={`vis-${s.id}`} etiqueta="" activo={s.visible} alCambiar={alCambiarVisible} />
          </>
        )}
      </div>

      {abierta && (
        <div className="border-t border-(--c-linea)">
          <div className="flex gap-1 px-3 pt-3" role="tablist" aria-label="Qué editar de la sección">
            {(["contenido", "diseno"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={pestana === p}
                onClick={() => setPestana(p)}
                className={`c-montserrat min-h-8 rounded-lg px-3 text-[12px] font-semibold ${pestana === p ? "bg-(--c-hielo) text-(--c-tinta)" : "text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}
              >
                {p === "contenido" ? "Contenido" : "Diseño de esta sección"}
              </button>
            ))}
          </div>
          <div className="grid gap-4 px-4 py-4">
            {pestana === "contenido" ? (
              <CamposDeSeccion s={s} actualizar={actualizar} />
            ) : (
              <DisenoDeSeccion s={s} celebracionId={celebracionId} actualizar={actualizar} />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--c-linea) pt-4">
              {!esHero ? (
                <button type="button" onClick={quitar} className="text-[13px] font-medium text-(--c-coral-tinta) underline underline-offset-4">
                  Quitar esta sección
                </button>
              ) : (
                <span />
              )}
              {indice < total - 1 && (
                <button type="button" onClick={alSiguiente} className="c-boton c-boton-secundario min-h-10 text-[13px]">
                  Siguiente sección →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── El diseño propio de una sección ───────────────────────────── */

function DisenoDeSeccion({ s, celebracionId, actualizar }: { s: Seccion; celebracionId: string; actualizar: (fn: (s: Seccion) => Seccion) => void }) {
  const set = (parche: Partial<DisenoSeccion>) => actualizar((x) => ({ ...x, diseno: { ...x.diseno, ...parche } }) as Seccion);
  const d = s.diseno;
  const esHero = s.tipo === "hero";
  return (
    <>
      {!esHero && (
        <div>
          <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta)">Sobre qué color va</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TONOS_SECCION.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set({ tono: t })}
                aria-pressed={d.tono === t}
                className={`c-montserrat min-h-9 rounded-lg px-2 text-[12px] font-semibold ${d.tono === t ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}
              >
                {NOMBRE_TONO_SECCION[t]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
          <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta)">Foto de fondo (opcional)</p>
          <p className="mb-2 mt-0.5 text-[12px] text-(--c-tinta-suave)">
            {esHero
              ? "Va detrás de la portada con un velo del color de tu paleta; las letras conservan sus colores. Las plantillas traen una de ambiente que podés cambiar o quitar."
              : "Va detrás de la sección con un velo oscuro; el texto pasa a blanco."}
          </p>
          <SubirImagen
            valor={d.fondoUrl}
            alCambiar={(u) => set({ fondoUrl: u })}
            destino="foto"
            etiqueta={`Fondo de ${NOMBRE_SECCION[s.tipo]}`}
            carpeta={`celebrar/${celebracionId}`}
            subidaDirecta={prepararSubidaCelebrar}
          />
          {d.fondoUrl && (
            <button type="button" onClick={() => set({ fondoUrl: "" })} className="mt-2 text-[12px] text-(--c-coral-tinta) underline underline-offset-4">
              Quitar la foto de fondo
            </button>
          )}
        </div>
      <div>
        <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta)">Alineación</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ALINEACIONES.map((a) => (
            <button key={a} type="button" onClick={() => set({ alineacion: a })} aria-pressed={d.alineacion === a} className={`c-montserrat min-h-9 rounded-lg px-2 text-[12px] font-semibold ${d.alineacion === a ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}>
              {a === "centro" ? "Centrada" : "A la izquierda"}
            </button>
          ))}
        </div>
      </div>
      {!esHero && (
        <div>
          <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta)">Aire</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TAMANOS_SECCION.map((t) => (
              <button key={t} type="button" onClick={() => set({ tamano: t })} aria-pressed={d.tamano === t} className={`c-montserrat min-h-9 rounded-lg px-2 text-[12px] font-semibold ${d.tamano === t ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}>
                {NOMBRE_TAMANO_SECCION[t]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta)">Fondo vivo de esta sección</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FONDOS_VIVOS_SECCION.map((f) => (
            <button key={f} type="button" onClick={() => set({ fondoVivo: f })} aria-pressed={d.fondoVivo === f} className={`c-montserrat min-h-9 rounded-lg px-2.5 text-[12px] font-semibold ${d.fondoVivo === f ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}>
              {f === "auto" ? "El de toda la invitación" : NOMBRE_FONDO_VIVO[f]}
            </button>
          ))}
        </div>
      </div>
      <Interruptor id={`orn-${s.id}`} etiqueta="Mostrar el ornamento en esta sección" activo={d.ornamento} alCambiar={(v) => set({ ornamento: v })} />
      <p className="text-[12px] text-(--c-tinta-suave)">Los colores, letras, ornamento y texturas de toda la invitación se cambian en la pestaña «Estilo».</p>
    </>
  );
}

/* ── Los campos de cada tipo de sección ─────────────────────────── */

/** Un color más para la paleta sugerida del código de vestimenta. */
function AgregarColor({ alAgregar }: { alAgregar: (hex: string) => void }) {
  const [valor, setValor] = useState("");
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <CampoColor
          id="dc-nuevo-color"
          etiqueta="Agregar color"
          valor={valor}
          alCambiar={(v) => {
            setValor(v);
          }}
        />
      </div>
      <button
        type="button"
        disabled={!normalizarColor(valor)}
        onClick={() => {
          const hex = normalizarColor(valor);
          if (hex) {
            alAgregar(hex);
            setValor("");
          }
        }}
        className="c-boton c-boton-secundario min-h-10 text-[13px] disabled:opacity-40"
      >
        Agregar
      </button>
    </div>
  );
}

function CamposDeSeccion({ s, actualizar }: { s: Seccion; actualizar: (fn: (s: Seccion) => Seccion) => void }) {
  const set = <T extends TipoSeccion>(parche: Partial<DatosSeccion[T]>) =>
    actualizar((x) => ({ ...x, datos: { ...x.datos, ...parche } }) as Seccion);
  const id = (campo: string) => `sec-${s.id}-${campo}`;

  switch (s.tipo) {
    case "hero":
      return (
        <>
          <Campo id={id("saludo")} etiqueta="Saludo (arriba del nombre)" valor={s.datos.saludo} alCambiar={(v) => set<"hero">({ saludo: v })} placeholder="Nos casamos" ia={{ seccion: "hero", campo: "saludo" }} />
          <Campo id={id("titulo")} etiqueta="Nombre de la celebración" valor={s.datos.titulo} alCambiar={(v) => set<"hero">({ titulo: v })} ayuda="Con un «&» o una «y» entre dos nombres, el símbolo se dibuja en el color de acento." />
          <Campo id={id("sub")} etiqueta="Frase" valor={s.datos.subtitulo} alCambiar={(v) => set<"hero">({ subtitulo: v })} ia={{ seccion: "hero", campo: "subtitulo" }} />
          <Interruptor id={id("fecha")} etiqueta="Mostrar la fecha en la portada" activo={s.datos.mostrarFecha} alCambiar={(v) => set<"hero">({ mostrarFecha: v })} />
          <p className="text-[12px] text-(--c-tinta-suave)">La foto de portada se sube en la pestaña «Fotos»; la disposición de la portada, en «Estilo».</p>
        </>
      );
    case "countdown":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"countdown">({ titulo: v })} ia={{ seccion: "countdown", campo: "titulo" }} />
          <Campo id={id("texto")} etiqueta="Texto debajo" valor={s.datos.texto} alCambiar={(v) => set<"countdown">({ texto: v })} ia={{ seccion: "countdown", campo: "texto" }} />
          <p className="text-[12px] text-(--c-tinta-suave)">Cuenta hasta la fecha y hora de la celebración (se cambian en «Esencial»).</p>
        </>
      );
    case "detalles":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Rótulo" valor={s.datos.titulo} alCambiar={(v) => set<"detalles">({ titulo: v })} placeholder="Agendá la fecha" ia={{ seccion: "detalles", campo: "titulo" }} />
          <Area id={id("texto")} etiqueta="Texto" valor={s.datos.texto} filas={3} alCambiar={(v) => set<"detalles">({ texto: v })} ia={{ seccion: "detalles", campo: "texto" }} />
          <p className="text-[12px] text-(--c-tinta-suave)">La fecha en grande y el botón «Agregar al calendario» salen de la fecha y hora de la celebración («Esencial»).</p>
        </>
      );
    case "dress_code":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"dress_code">({ titulo: v })} ia={{ seccion: "dress_code", campo: "titulo" }} />
          {s.datos.grupos.map((g, i) => (
            <fieldset key={i} className="grid gap-3 rounded-xl border border-(--c-linea) p-3">
              <div className="flex items-center justify-between">
                <legend className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Grupo {i + 1}</legend>
                <button type="button" className="text-[12px] text-(--c-coral-tinta) underline underline-offset-4" onClick={() => set<"dress_code">({ grupos: s.datos.grupos.filter((_, j) => j !== i) })}>
                  Eliminar
                </button>
              </div>
              <Campo id={id(`g${i}-t`)} etiqueta="Quiénes (Caballeros, Damas…)" valor={g.titulo} alCambiar={(v) => set<"dress_code">({ grupos: s.datos.grupos.map((x, j) => (j === i ? { ...x, titulo: v } : x)) })} />
              <Campo id={id(`g${i}-x`)} etiqueta="Qué llevar" valor={g.texto} maxLength={300} alCambiar={(v) => set<"dress_code">({ grupos: s.datos.grupos.map((x, j) => (j === i ? { ...x, texto: v } : x)) })} />
            </fieldset>
          ))}
          {s.datos.grupos.length < 4 && (
            <button type="button" onClick={() => set<"dress_code">({ grupos: [...s.datos.grupos, { titulo: "", texto: "" }] })} className="c-boton c-boton-secundario min-h-10 justify-self-start text-[13px]">
              + Agregar grupo
            </button>
          )}
          <div>
            <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta)">Paleta sugerida</p>
            {s.datos.colores.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.datos.colores.map((c, i) => (
                  <button key={`${c}-${i}`} type="button" title={`Quitar ${c}`} onClick={() => set<"dress_code">({ colores: s.datos.colores.filter((_, j) => j !== i) })} className="h-8 w-8 rounded-full border-2 border-(--c-linea)" style={{ background: c }} aria-label={`Quitar el color ${c}`} />
                ))}
              </div>
            )}
            {s.datos.colores.length < 8 && (
              <div className="mt-2">
                <AgregarColor alAgregar={(hex) => set<"dress_code">({ colores: [...s.datos.colores, hex] })} />
              </div>
            )}
          </div>
          <Area id={id("texto")} etiqueta="Nota (opcional)" valor={s.datos.texto} filas={2} alCambiar={(v) => set<"dress_code">({ texto: v })} placeholder="Colores a evitar: blanco y marfil — reservados para la novia." ia={{ seccion: "dress_code", campo: "texto" }} />
        </>
      );
    case "itinerario":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"itinerario">({ titulo: v })} ia={{ seccion: "itinerario", campo: "titulo" }} />
          {s.datos.items.map((m, i) => (
            <fieldset key={i} className="grid gap-3 rounded-xl border border-(--c-linea) p-3">
              <div className="flex items-center justify-between">
                <legend className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Momento {i + 1}</legend>
                <button type="button" className="text-[12px] text-(--c-coral-tinta) underline underline-offset-4" onClick={() => set<"itinerario">({ items: s.datos.items.filter((_, j) => j !== i) })}>
                  Eliminar
                </button>
              </div>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <Campo id={id(`m${i}-h`)} etiqueta="Hora" valor={m.hora} maxLength={40} placeholder="4:00 p. m." alCambiar={(v) => set<"itinerario">({ items: s.datos.items.map((x, j) => (j === i ? { ...x, hora: v } : x)) })} />
                <Campo id={id(`m${i}-t`)} etiqueta="Qué pasa" valor={m.titulo} alCambiar={(v) => set<"itinerario">({ items: s.datos.items.map((x, j) => (j === i ? { ...x, titulo: v } : x)) })} />
              </div>
              <Campo id={id(`m${i}-d`)} etiqueta="Detalle (opcional)" valor={m.detalle} maxLength={300} alCambiar={(v) => set<"itinerario">({ items: s.datos.items.map((x, j) => (j === i ? { ...x, detalle: v } : x)) })} />
            </fieldset>
          ))}
          {s.datos.items.length < 12 && (
            <button type="button" onClick={() => set<"itinerario">({ items: [...s.datos.items, { hora: "", titulo: "", detalle: "" }] })} className="c-boton c-boton-secundario min-h-10 justify-self-start text-[13px]">
              + Agregar momento
            </button>
          )}
        </>
      );
    case "historia":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"historia">({ titulo: v })} ia={{ seccion: "historia", campo: "titulo" }} />
          <Area id={id("texto")} etiqueta="La historia" valor={s.datos.texto} filas={6} alCambiar={(v) => set<"historia">({ texto: v })} ia={{ seccion: "historia", campo: "texto" }} />
          <p className="text-[12px] text-(--c-tinta-suave)">La foto de esta sección (en polaroid) se sube en «Fotos».</p>
        </>
      );
    case "galeria":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"galeria">({ titulo: v })} ia={{ seccion: "galeria", campo: "titulo" }} />
          <p className="text-[12px] text-(--c-tinta-suave)">Las fotos ({s.datos.fotos.length}) se suben en «Fotos» y se muestran como polaroids.</p>
        </>
      );
    case "ubicacion":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"ubicacion">({ titulo: v })} ia={{ seccion: "ubicacion", campo: "titulo" }} />
          {s.datos.lugares.map((l, i) => (
            <fieldset key={i} className="grid gap-3 rounded-xl border border-(--c-linea) p-3">
              <div className="flex items-center justify-between">
                <legend className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Lugar {i + 1}</legend>
                <button type="button" className="text-[12px] text-(--c-coral-tinta) underline underline-offset-4" onClick={() => set<"ubicacion">({ lugares: s.datos.lugares.filter((_, j) => j !== i) })}>
                  Eliminar
                </button>
              </div>
              <Campo id={id(`l${i}-titulo`)} etiqueta="Título (Ceremonia, Fiesta…)" valor={l.titulo} alCambiar={(v) => set<"ubicacion">({ lugares: s.datos.lugares.map((x, j) => (j === i ? { ...x, titulo: v } : x)) })} />
              <Campo id={id(`l${i}-lugar`)} etiqueta="Lugar" valor={l.lugar} alCambiar={(v) => set<"ubicacion">({ lugares: s.datos.lugares.map((x, j) => (j === i ? { ...x, lugar: v } : x)) })} />
              <Campo id={id(`l${i}-dir`)} etiqueta="Dirección" valor={l.direccion} maxLength={300} alCambiar={(v) => set<"ubicacion">({ lugares: s.datos.lugares.map((x, j) => (j === i ? { ...x, direccion: v } : x)) })} />
              <div className="grid grid-cols-2 gap-3">
                <Campo id={id(`l${i}-hora`)} etiqueta="Hora" valor={l.hora} maxLength={40} placeholder="4:00 p. m." alCambiar={(v) => set<"ubicacion">({ lugares: s.datos.lugares.map((x, j) => (j === i ? { ...x, hora: v } : x)) })} />
                <Campo id={id(`l${i}-maps`)} etiqueta="Link de mapa" tipo="url" valor={l.mapsUrl} maxLength={600} placeholder="https://maps.app.goo.gl/…" alCambiar={(v) => set<"ubicacion">({ lugares: s.datos.lugares.map((x, j) => (j === i ? { ...x, mapsUrl: v } : x)) })} />
              </div>
            </fieldset>
          ))}
          {s.datos.lugares.length < 6 && (
            <button type="button" onClick={() => set<"ubicacion">({ lugares: [...s.datos.lugares, { titulo: "", lugar: "", direccion: "", hora: "", mapsUrl: "" }] })} className="c-boton c-boton-secundario min-h-10 justify-self-start text-[13px]">
              + Agregar lugar
            </button>
          )}
          <p className="text-[12px] text-(--c-tinta-suave)">Cada lugar sale con su mapa y los botones «Cómo llegar» (Google Maps) y «Waze».</p>
        </>
      );
    case "rsvp":
      return (
        <>
          <div>
            <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta)">Cómo confirman los invitados</p>
            <div className="mt-2 grid gap-2">
              {MODOS_RSVP.map((m) => {
                const activo = s.datos.modo === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set<"rsvp">({ modo: m })}
                    aria-pressed={activo}
                    className={`flex items-start justify-between gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${activo ? "border-(--c-marino) bg-(--c-hielo)" : "border-(--c-linea) hover:border-(--c-tinta-suave)"}`}
                  >
                    <span>
                      <span className="c-montserrat block text-[13px] font-semibold text-(--c-tinta)">{NOMBRE_MODO_RSVP[m]}</span>
                      <span className="block text-[12px] leading-snug text-(--c-tinta-suave)">
                        {m === "panel"
                          ? "Formulario en la invitación con tus preguntas; las respuestas llegan a Invitados en tu panel."
                          : "El botón abre un chat con tu número y llevás la lista a mano."}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11.5px] text-(--c-tinta-suave)">Las dos formas están incluidas en el precio de la invitación ({colones(PRECIO_PLANTILLA_CRC)}, se paga al publicar).</p>
          </div>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"rsvp">({ titulo: v })} ia={{ seccion: "rsvp", campo: "titulo" }} />
          <Area id={id("texto")} etiqueta="Texto" valor={s.datos.texto} filas={3} alCambiar={(v) => set<"rsvp">({ texto: v })} ia={{ seccion: "rsvp", campo: "texto" }} />
          <div className="grid grid-cols-2 gap-3">
            <Campo id={id("limite")} etiqueta="Confirmar antes de" tipo="date" valor={s.datos.fechaLimite} maxLength={10} alCambiar={(v) => set<"rsvp">({ fechaLimite: v })} />
            <Campo id={id("boton")} etiqueta="Texto del botón" valor={s.datos.boton} maxLength={40} alCambiar={(v) => set<"rsvp">({ boton: v })} />
          </div>
          {s.datos.modo === "whatsapp" ? (
            <Campo
              id={id("wa")}
              etiqueta="WhatsApp donde confirman"
              tipo="tel"
              valor={s.datos.whatsapp}
              maxLength={20}
              placeholder="8888 8888"
              alCambiar={(v) => set<"rsvp">({ whatsapp: v })}
              ayuda="El botón abre un chat con este número con «confirmo mi asistencia» ya escrito."
            />
          ) : (
            <>
              <div className="grid gap-1 rounded-xl border border-(--c-linea) px-4">
                <Interruptor id={id("personas")} etiqueta="Preguntar cuántas personas van" activo={s.datos.pedirPersonas} alCambiar={(v) => set<"rsvp">({ pedirPersonas: v })} />
                <Interruptor id={id("contacto")} etiqueta="Pedir teléfono o correo" activo={s.datos.pedirContacto} alCambiar={(v) => set<"rsvp">({ pedirContacto: v })} />
              </div>
              <div>
                <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta)">Tus preguntas</p>
                <p className="mt-0.5 text-[12px] text-(--c-tinta-suave)">Nombre y sí/no van siempre. Agregá lo que necesités saber: alergias, transporte, canción, mesa…</p>
              </div>
              {s.datos.preguntas.map((q, i) => (
                <fieldset key={q.id} className="grid gap-3 rounded-xl border border-(--c-linea) p-3">
                  <div className="flex items-center justify-between">
                    <legend className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Pregunta {i + 1}</legend>
                    <button type="button" className="text-[12px] text-(--c-coral-tinta) underline underline-offset-4" onClick={() => set<"rsvp">({ preguntas: s.datos.preguntas.filter((_, j) => j !== i) })}>
                      Eliminar
                    </button>
                  </div>
                  <Campo id={id(`p${i}-e`)} etiqueta="La pregunta" valor={q.etiqueta} alCambiar={(v) => set<"rsvp">({ preguntas: s.datos.preguntas.map((x, j) => (j === i ? { ...x, etiqueta: v } : x)) })} placeholder="¿Alguna alergia o restricción alimentaria?" />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1">
                      <span className="c-rotulo">Tipo de respuesta</span>
                      <select value={q.tipo} onChange={(e) => set<"rsvp">({ preguntas: s.datos.preguntas.map((x, j) => (j === i ? { ...x, tipo: e.target.value as typeof x.tipo } : x)) })} className="c-campo min-h-11 text-[14px]">
                        {TIPOS_PREGUNTA.map((t) => (
                          <option key={t} value={t}>
                            {NOMBRE_TIPO_PREGUNTA[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end">
                      <Interruptor id={id(`p${i}-req`)} etiqueta="Obligatoria" activo={q.requerida} alCambiar={(v) => set<"rsvp">({ preguntas: s.datos.preguntas.map((x, j) => (j === i ? { ...x, requerida: v } : x)) })} />
                    </div>
                  </div>
                  {q.tipo === "opcion" && (
                    <Campo
                      id={id(`p${i}-op`)}
                      etiqueta="Opciones (separadas por coma)"
                      valor={q.opciones.join(", ")}
                      maxLength={400}
                      placeholder="Pollo, Res, Vegetariano"
                      alCambiar={(v) => set<"rsvp">({ preguntas: s.datos.preguntas.map((x, j) => (j === i ? { ...x, opciones: v.split(",").map((o) => o.trim()).filter(Boolean).slice(0, 8) } : x)) })}
                    />
                  )}
                </fieldset>
              ))}
              {s.datos.preguntas.length < 8 && (
                <button
                  type="button"
                  onClick={() => set<"rsvp">({ preguntas: [...s.datos.preguntas, { id: idSeccion(), etiqueta: "", tipo: "texto", opciones: [], requerida: false }] })}
                  className="c-boton c-boton-secundario min-h-10 justify-self-start text-[13px]"
                >
                  + Agregar pregunta
                </button>
              )}
            </>
          )}
        </>
      );
    case "regalos":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"regalos">({ titulo: v })} ia={{ seccion: "regalos", campo: "titulo" }} />
          <Area id={id("texto")} etiqueta="Texto" valor={s.datos.texto} filas={3} alCambiar={(v) => set<"regalos">({ texto: v })} ia={{ seccion: "regalos", campo: "texto" }} />
          <Campo id={id("sinpe")} etiqueta="SINPE Móvil (opcional)" tipo="tel" valor={s.datos.sinpe} maxLength={20} placeholder="8888 8888" alCambiar={(v) => set<"regalos">({ sinpe: v })} ayuda="Sale en una tarjeta con el número en grande." />
          {s.datos.items.map((r, i) => (
            <fieldset key={i} className="grid gap-3 rounded-xl border border-(--c-linea) p-3">
              <div className="flex items-center justify-between">
                <legend className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Opción {i + 1}</legend>
                <button type="button" className="text-[12px] text-(--c-coral-tinta) underline underline-offset-4" onClick={() => set<"regalos">({ items: s.datos.items.filter((_, j) => j !== i) })}>
                  Eliminar
                </button>
              </div>
              <Campo id={id(`r${i}-t`)} etiqueta="Título (lista de regalos, cuenta, mesa…)" valor={r.titulo} alCambiar={(v) => set<"regalos">({ items: s.datos.items.map((x, j) => (j === i ? { ...x, titulo: v } : x)) })} />
              <Campo id={id(`r${i}-d`)} etiqueta="Detalle (IBAN, nota)" valor={r.detalle} maxLength={300} alCambiar={(v) => set<"regalos">({ items: s.datos.items.map((x, j) => (j === i ? { ...x, detalle: v } : x)) })} />
              <Campo id={id(`r${i}-u`)} etiqueta="Link (opcional)" tipo="url" valor={r.url} maxLength={600} alCambiar={(v) => set<"regalos">({ items: s.datos.items.map((x, j) => (j === i ? { ...x, url: v } : x)) })} />
            </fieldset>
          ))}
          {s.datos.items.length < 8 && (
            <button type="button" onClick={() => set<"regalos">({ items: [...s.datos.items, { titulo: "", detalle: "", url: "" }] })} className="c-boton c-boton-secundario min-h-10 justify-self-start text-[13px]">
              + Agregar opción
            </button>
          )}
        </>
      );
    case "mensaje":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Rótulo" valor={s.datos.titulo} alCambiar={(v) => set<"mensaje">({ titulo: v })} placeholder="Con amor" ia={{ seccion: "mensaje", campo: "titulo" }} />
          <Area id={id("texto")} etiqueta="Mensaje" valor={s.datos.texto} alCambiar={(v) => set<"mensaje">({ texto: v })} ia={{ seccion: "mensaje", campo: "texto" }} />
          <Campo id={id("firma")} etiqueta="Firma (en grande)" valor={s.datos.firma} alCambiar={(v) => set<"mensaje">({ firma: v })} placeholder="Sofía & Andrés" ayuda="Vacía, firma con el nombre de la celebración." />
        </>
      );
    case "faq":
      return (
        <>
          <Campo id={id("titulo")} etiqueta="Título" valor={s.datos.titulo} alCambiar={(v) => set<"faq">({ titulo: v })} ia={{ seccion: "faq", campo: "titulo" }} />
          {s.datos.items.map((q, i) => (
            <fieldset key={i} className="grid gap-3 rounded-xl border border-(--c-linea) p-3">
              <div className="flex items-center justify-between">
                <legend className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Pregunta {i + 1}</legend>
                <button type="button" className="text-[12px] text-(--c-coral-tinta) underline underline-offset-4" onClick={() => set<"faq">({ items: s.datos.items.filter((_, j) => j !== i) })}>
                  Eliminar
                </button>
              </div>
              <Campo id={id(`q${i}-p`)} etiqueta="Pregunta" valor={q.pregunta} alCambiar={(v) => set<"faq">({ items: s.datos.items.map((x, j) => (j === i ? { ...x, pregunta: v } : x)) })} />
              <Area id={id(`q${i}-r`)} etiqueta="Respuesta" valor={q.respuesta} filas={2} alCambiar={(v) => set<"faq">({ items: s.datos.items.map((x, j) => (j === i ? { ...x, respuesta: v } : x)) })} />
            </fieldset>
          ))}
          {s.datos.items.length < 12 && (
            <button type="button" onClick={() => set<"faq">({ items: [...s.datos.items, { pregunta: "", respuesta: "" }] })} className="c-boton c-boton-secundario min-h-10 justify-self-start text-[13px]">
              + Agregar pregunta
            </button>
          )}
        </>
      );
  }
}
