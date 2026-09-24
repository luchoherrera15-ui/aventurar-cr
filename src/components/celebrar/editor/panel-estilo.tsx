"use client";

import { useState } from "react";
import CampoColor from "@/components/campo-color";
import AyudaDiseno from "../panel/ayuda-diseno";
import { normalizarColor } from "@/lib/invitaciones/paleta";
import {
  BORDES,
  DISPOSICIONES_DECORACION,
  GRUPOS_APERTURA,
  ENTRADAS,
  ESCALAS_DECORACION,
  ESQUINAS,
  FONDOS_VIVOS,
  GRUPOS_DECORACION,
  HEROES,
  INTENSIDADES,
  NOMBRE_FONDO_VIVO,
  NOMBRE_INTENSIDAD,
  NOMBRE_VELOCIDAD,
  NOMBRE_DECORACION,
  NOMBRE_DISPOSICION_DECORACION,
  NOMBRE_APERTURA,
  NOMBRE_ENTRADA,
  NOMBRE_ESCALA_DECORACION,
  NOMBRE_ESQUINAS,
  NOMBRE_HEROE,
  NOMBRE_ORNAMENTO,
  NOMBRE_PARTICULAS,
  NOMBRE_RITMO,
  NOMBRE_TEMA,
  NOMBRE_TEXTURA,
  NOMBRE_TRANSICION,
  ORNAMENTOS,
  PARTICULAS,
  RITMOS,
  TEMAS,
  TEXTURAS,
  TRANSICIONES,
  VELOCIDADES,
  type Documento,
  type Estilo,
  type Paleta,
} from "@/lib/celebrar/invitacion/esquema";
import { FUENTES, pilaDe, urlGoogleFonts } from "@/lib/celebrar/invitacion/fuentes";
import type { TipoCelebracionId } from "@/lib/celebrar/marca";
import { PALETAS } from "@/lib/celebrar/plantillas/paletas";
import { patronDecoracion } from "../invitacion/decoracion";
import EsquinasDecorativas from "../invitacion/esquinas";
import { Ornamento } from "../invitacion/ornamentos";
import { mezclar } from "@/lib/celebrar/invitacion/colores";
import { Interruptor, Selector } from "./campos";
import MiniaturaPlantilla from "./miniatura-plantilla";

const NOMBRE_BORDES = { rectos: "Rectos", suaves: "Suaves", redondos: "Redondos" } as const;

/** Un grupo de opciones como pastillas (una sola activa). */
function Pastillas<T extends string>({
  opciones,
  valor,
  nombres,
  alElegir,
  columnas,
}: {
  opciones: readonly T[];
  valor: T;
  nombres: Record<T, string>;
  alElegir: (v: T) => void;
  columnas?: number;
}) {
  return (
    <div className={columnas ? "mt-3 grid gap-2" : "mt-3 flex flex-wrap gap-2"} style={columnas ? { gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` } : undefined}>
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => alElegir(o)}
          aria-pressed={valor === o}
          className={`c-montserrat min-h-9 rounded-lg px-3 text-[13px] font-semibold transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${valor === o ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}
        >
          {nombres[o]}
        </button>
      ))}
    </div>
  );
}

function Titulo({ children, ayuda }: { children: React.ReactNode; ayuda?: string }) {
  return (
    <div>
      <h3 className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">{children}</h3>
      {ayuda && <p className="mt-0.5 text-[12px] leading-snug text-(--c-tinta-suave)">{ayuda}</p>}
    </div>
  );
}

/**
 * La pestaña «Estilo»: TODO lo que hace que una invitación se vea como
 * se ve — paleta (con el color de escena), letras, portada, ornamento,
 * textura, ritmo de escenas, borde entre escenas, partículas, motivo,
 * bordes, marco y animaciones. Cada cambio se ve al instante en el
 * teléfono. Lo propio de cada sección (su tono, su foto de fondo, su
 * alineación) se edita en «Secciones».
 */
export default function PanelEstilo({
  doc,
  tipo,
  cambiar,
  celebracionId = null,
}: {
  doc: Documento;
  tipo: TipoCelebracionId;
  cambiar: (fn: (d: Documento) => Documento) => void;
  /** Para «¿No estás contento con tu diseño?»: el pedido queda atado a esta celebración. */
  celebracionId?: string | null;
}) {
  const e = doc.estilo;
  const setEstilo = (parche: Partial<Estilo>) => cambiar((d) => ({ ...d, estilo: { ...d.estilo, ...parche } }));
  const setPaleta = (parche: Partial<Paleta>) => cambiar((d) => ({ ...d, estilo: { ...d.estilo, paleta: { ...d.estilo.paleta, ...parche } } }));
  // Lo que la persona va tecleando en un color, antes de que sea un hex
  // válido: se muestra pero no entra al documento hasta que lo sea.
  const [borradores, setBorradores] = useState<Partial<Record<keyof Paleta, string>>>({});
  const color = (campo: keyof Paleta) => ({
    valor: borradores[campo] ?? e.paleta[campo],
    alCambiar: (v: string) => {
      const limpio = normalizarColor(v);
      if (limpio) {
        setPaleta({ [campo]: limpio } as Partial<Paleta>);
        setBorradores((b) => ({ ...b, [campo]: undefined }));
      } else {
        setBorradores((b) => ({ ...b, [campo]: v }));
      }
    },
  });
  const paletas = PALETAS[tipo];
  const actual = paletas.find((p) => p.fondo === e.paleta.fondo && p.tinta === e.paleta.tinta && p.acento === e.paleta.acento);

  const opcionesFuente = FUENTES.map((f) => ({ valor: f.id, texto: `${f.nombre} · ${f.caracter}`, estilo: { fontFamily: pilaDe(f.id) } }));

  return (
    <div className="grid gap-7">
      <link rel="stylesheet" href={urlGoogleFonts(FUENTES.map((f) => f.id))} precedence="default" />

      <section>
        <Titulo ayuda="Fondo, acento y el color de escena (el segundo color, donde cambia el ambiente).">Paleta</Titulo>
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {paletas.map((p) => {
            const activa = actual?.nombre === p.nombre;
            return (
              <li key={p.nombre}>
                <button
                  type="button"
                  onClick={() =>
                    setPaleta({ fondo: p.fondo, tinta: p.tinta, acento: p.acento, suave: p.suave, superficie: p.superficie, escena: p.escena, tintaEscena: p.tintaEscena })
                  }
                  aria-pressed={activa}
                  title={p.nombre}
                  className={`flex w-full flex-col overflow-hidden rounded-xl border-2 transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${activa ? "border-(--c-marino)" : "border-(--c-linea) hover:border-(--c-tinta-suave)"}`}
                >
                  <span className="flex h-10 w-full">
                    <span className="flex-[3]" style={{ background: p.fondo }} />
                    <span className="flex-[2]" style={{ background: p.escena }} />
                    <span className="flex-1" style={{ background: p.acento }} />
                  </span>
                  <span className="truncate px-1.5 py-1 text-[11px] text-(--c-tinta-suave)">{p.nombre}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <details className="mt-3 rounded-xl border border-(--c-linea)">
          <summary className="c-montserrat cursor-pointer list-none px-3 py-2.5 text-[13px] font-semibold text-(--c-tinta) [&::-webkit-details-marker]:hidden">
            Colores personalizados {actual ? "" : "(en uso)"}
          </summary>
          <div className="grid gap-3 border-t border-(--c-linea) p-3">
            <CampoColor id="pal-fondo" etiqueta="Fondo" {...color("fondo")} />
            <CampoColor id="pal-tinta" etiqueta="Texto" {...color("tinta")} />
            <CampoColor id="pal-acento" etiqueta="Acento (ornamentos, botones)" {...color("acento")} />
            <CampoColor id="pal-suave" etiqueta="Texto secundario" {...color("suave")} />
            <CampoColor id="pal-superficie" etiqueta="Tarjetas" {...color("superficie")} />
            <CampoColor id="pal-escena" etiqueta="Escena (segundo fondo)" {...color("escena")} />
            <CampoColor id="pal-tinta-escena" etiqueta="Texto sobre la escena" {...color("tintaEscena")} />
          </div>
        </details>
      </section>

      <section>
        <Titulo ayuda="Una invitación temática de verdad: un escenario dibujado en la portada y un personaje que cruza cada sección al llegar a ella.">Tema</Titulo>
        <Pastillas opciones={TEMAS} valor={e.tema} nombres={NOMBRE_TEMA} alElegir={(v) => setEstilo({ tema: v })} />
      </section>

      <section>
        <Titulo ayuda="Qué secciones van sobre el fondo y cuáles sobre la escena, y cómo se pasa de una a otra.">Escenas</Titulo>
        <Pastillas opciones={RITMOS} valor={e.ritmo} nombres={NOMBRE_RITMO} alElegir={(v) => setEstilo({ ritmo: v })} />
        <p className="c-montserrat mt-4 text-[12px] font-semibold text-(--c-tinta-suave)">Borde entre escenas</p>
        <Pastillas opciones={TRANSICIONES} valor={e.transicion} nombres={NOMBRE_TRANSICION} alElegir={(v) => setEstilo({ transicion: v })} />
      </section>

      <section className="grid gap-3">
        <Titulo>Tipografía</Titulo>
        <Selector id="f-titulo" etiqueta="Títulos" valor={e.fuenteTitulo} opciones={opcionesFuente} alCambiar={(v) => setEstilo({ fuenteTitulo: v })} />
        <Selector id="f-texto" etiqueta="Texto" valor={e.fuenteTexto} opciones={opcionesFuente} alCambiar={(v) => setEstilo({ fuenteTexto: v })} />
        <p className="rounded-xl border border-(--c-linea) px-4 py-3" style={{ fontFamily: pilaDe(e.fuenteTitulo) }}>
          <span className="text-2xl leading-none text-(--c-tinta)">Sofía & Andrés</span>
          <span className="mt-1 block text-[13px] text-(--c-tinta-suave)" style={{ fontFamily: pilaDe(e.fuenteTexto) }}>
            Sábado 12 de diciembre, 4:00 p. m.
          </span>
        </p>
      </section>

      <section>
        <Titulo>Portada</Titulo>
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {HEROES.map((h) => (
            <li key={h}>
              <button
                type="button"
                onClick={() => setEstilo({ heroe: h })}
                aria-pressed={e.heroe === h}
                className={`w-full rounded-xl border-2 p-1 text-left transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${e.heroe === h ? "border-(--c-marino)" : "border-(--c-linea) hover:border-(--c-tinta-suave)"}`}
              >
                <MiniaturaPlantilla estilos={{ ...e, heroe: h }} muestra="Sofía & Andrés" saludo="Nos casamos" />
                <span className="mt-1 block truncate px-1 text-[11px] text-(--c-tinta-suave)">{NOMBRE_HEROE[h]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Titulo ayuda="El adorno bajo los títulos: la firma de la invitación.">Ornamento</Titulo>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ORNAMENTOS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setEstilo({ ornamento: o })}
              aria-pressed={e.ornamento === o}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${e.ornamento === o ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta) hover:border-(--c-tinta-suave)"}`}
            >
              {o === "ninguno" ? <span className="h-4" /> : <Ornamento tipo={o} className="h-4 w-28" />}
              <span className="c-montserrat text-[11px] font-semibold">{NOMBRE_ORNAMENTO[o]}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <Titulo ayuda="Formas grandes y lentas detrás de cada escena: ondas que se mecen, una aurora, un degradado que corre…">Fondo vivo</Titulo>
        <Pastillas opciones={FONDOS_VIVOS} valor={e.fondoVivo} nombres={NOMBRE_FONDO_VIVO} alElegir={(v) => setEstilo({ fondoVivo: v })} />
        {e.fondoVivo !== "ninguno" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Intensidad</p>
              <Pastillas opciones={INTENSIDADES} valor={e.fondoIntensidad} nombres={NOMBRE_INTENSIDAD} alElegir={(v) => setEstilo({ fondoIntensidad: v })} columnas={3} />
            </div>
            <div>
              <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Velocidad</p>
              <Pastillas opciones={VELOCIDADES} valor={e.fondoVelocidad} nombres={NOMBRE_VELOCIDAD} alElegir={(v) => setEstilo({ fondoVelocidad: v })} columnas={3} />
            </div>
          </div>
        )}
        <p className="mt-2 text-[12px] text-(--c-tinta-suave)">Cada sección puede tener el suyo: Secciones → Diseño de esta sección.</p>
      </section>

      <section>
        <Titulo ayuda="Lo que hace que un color plano se sienta papel, seda o noche.">Textura del fondo</Titulo>
        <Pastillas opciones={TEXTURAS} valor={e.textura} nombres={NOMBRE_TEXTURA} alElegir={(v) => setEstilo({ textura: v })} />
      </section>

      <section>
        <Titulo ayuda="Un ambiente vivo y sutil en la portada y el cierre.">Partículas</Titulo>
        <Pastillas opciones={PARTICULAS} valor={e.particulas} nombres={NOMBRE_PARTICULAS} alElegir={(v) => setEstilo({ particulas: v })} />
      </section>

      <section>
        <Titulo ayuda="Un patrón de línea fina detrás de las escenas, en el color de la paleta. Botánicos, florales, geométricos, de fiesta.">Motivo decorativo</Titulo>
        <button
          type="button"
          onClick={() => setEstilo({ decoracion: "ninguna" })}
          aria-pressed={e.decoracion === "ninguna"}
          className={`c-montserrat mt-3 min-h-9 rounded-lg px-3 text-[13px] font-semibold ${e.decoracion === "ninguna" ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}
        >
          Sin motivo
        </button>
        {GRUPOS_DECORACION.map((grupo) => (
          <div key={grupo.nombre} className="mt-4">
            <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">{grupo.nombre}</p>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {grupo.motivos.map((m) => {
                const patron = patronDecoracion(m, mezclar(e.paleta.tinta, e.paleta.fondo, 0.55), e.paleta.fondo, "fina");
                const activo = e.decoracion === m;
                return (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => setEstilo({ decoracion: m })}
                      aria-pressed={activo}
                      title={NOMBRE_DECORACION[m]}
                      className={`w-full overflow-hidden rounded-xl border-2 text-left transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${activo ? "border-(--c-marino)" : "border-(--c-linea) hover:border-(--c-tinta-suave)"}`}
                    >
                      <span className="block h-16 w-full" style={{ backgroundColor: e.paleta.fondo, ...(patron ?? {}), opacity: 0.9 }} aria-hidden="true" />
                      <span className="block truncate px-2 py-1 text-[11px] text-(--c-tinta-suave)">{NOMBRE_DECORACION[m]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {e.decoracion !== "ninguna" && (
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Tamaño</p>
                <Pastillas opciones={ESCALAS_DECORACION} valor={e.decoracionEscala} nombres={NOMBRE_ESCALA_DECORACION} alElegir={(v) => setEstilo({ decoracionEscala: v })} columnas={3} />
              </div>
              <div>
                <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Intensidad</p>
                <Pastillas opciones={INTENSIDADES} valor={e.decoracionIntensidad} nombres={NOMBRE_INTENSIDAD} alElegir={(v) => setEstilo({ decoracionIntensidad: v })} columnas={3} />
              </div>
            </div>
            <div>
              <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">Dónde va</p>
              <Pastillas opciones={DISPOSICIONES_DECORACION} valor={e.decoracionDisposicion} nombres={NOMBRE_DISPOSICION_DECORACION} alElegir={(v) => setEstilo({ decoracionDisposicion: v })} />
            </div>
          </div>
        )}
      </section>

      <section>
        <Titulo ayuda="Ilustraciones de línea en las cuatro esquinas de la portada y del cierre, en el color de acento.">Adornos de esquina</Titulo>
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {ESQUINAS.map((q) => {
            const activo = e.esquinas === q;
            return (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => setEstilo({ esquinas: q })}
                  aria-pressed={activo}
                  className={`w-full overflow-hidden rounded-xl border-2 text-left transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${activo ? "border-(--c-marino)" : "border-(--c-linea) hover:border-(--c-tinta-suave)"}`}
                >
                  <span className="relative block h-20 w-full overflow-hidden" style={{ backgroundColor: e.paleta.fondo, color: e.paleta.acento }} aria-hidden="true">
                    {q !== "ninguna" && (
                      <span className="absolute inset-0 [&_.inv-esquina]:h-14 [&_.inv-esquina]:w-14 [&_.inv-esquina-ai]:left-1 [&_.inv-esquina-ai]:top-1 [&_.inv-esquina-ad]:right-1 [&_.inv-esquina-ad]:top-1 [&_.inv-esquina-bi]:bottom-1 [&_.inv-esquina-bi]:left-1 [&_.inv-esquina-bd]:bottom-1 [&_.inv-esquina-bd]:right-1">
                        <EsquinasDecorativas tipo={q} />
                      </span>
                    )}
                  </span>
                  <span className="block truncate px-2 py-1 text-[11px] text-(--c-tinta-suave)">{NOMBRE_ESQUINAS[q]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <Titulo>Bordes</Titulo>
        <Pastillas opciones={BORDES} valor={e.bordes} nombres={NOMBRE_BORDES} alElegir={(v) => setEstilo({ bordes: v })} columnas={3} />
      </section>

      <section>
        <Titulo ayuda="La invitación llega cerrada: la persona la toca, se abre con esta animación y arranca la música. Se ve en «Vista previa» y en la página publicada (no en este teléfono).">Apertura</Titulo>
        <div className="grid gap-3">
          {GRUPOS_APERTURA.map((g) => (
            <div key={g.nombre}>
              <p className="c-montserrat mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--c-tinta-suave)">{g.nombre}</p>
              <Pastillas opciones={g.aperturas} valor={e.apertura} alElegir={(v) => setEstilo({ apertura: v })} nombres={NOMBRE_APERTURA} columnas={2} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <Titulo ayuda="Cómo aparece cada escena al ir bajando. Con «suave» cada pieza tiene su propia entrada; las demás le dan un mismo carácter a toda la invitación.">Animación al scrollear</Titulo>
        <Pastillas opciones={ENTRADAS} valor={e.entrada} nombres={NOMBRE_ENTRADA} alElegir={(v) => setEstilo({ entrada: v, animaciones: true })} />
      </section>

      <div className="grid gap-1 rounded-xl border border-(--c-linea) px-4">
        <Interruptor id="marco" etiqueta="Filete fino en los bordes de toda la invitación" activo={e.marco} alCambiar={(v) => setEstilo({ marco: v })} />
        <Interruptor id="anim" etiqueta="Animaciones al entrar cada escena" activo={e.animaciones} alCambiar={(v) => setEstilo({ animaciones: v })} />
      </div>

      <AyudaDiseno celebracionId={celebracionId} compacto />
    </div>
  );
}
