"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { elegirPlantilla } from "@/app/celebrar/editor/acciones";
import MiniaturaPlantilla from "@/components/celebrar/editor/miniatura-plantilla";
import { EnlaceCelebrar, usePrefijo } from "@/components/celebrar/rutas-cliente";
import { conPrefijo } from "@/lib/celebrar/dominios";
import type { PlantillaCatalogo } from "@/lib/celebrar/datos";
import { FUENTES, urlGoogleFonts } from "@/lib/celebrar/invitacion/fuentes";
import { TIPOS_CELEBRACION, type CategoriaPlantilla } from "@/lib/celebrar/marca";
import { RUTA, rutaEditor, rutaPreviaPlantilla } from "@/lib/celebrar/rutas";
import type { Celebracion } from "@/lib/celebrar/tipos";

/** El saludo de muestra de cada tipo, para que la portada se lea como la ocasión. */
const SALUDO: Record<string, string> = {
  boda: "Nos casamos",
  cumpleanos: "¡Estás invitado!",
  xv: "Mis quince años",
  baby_shower: "Baby shower",
  bautizo: "Mi bautizo",
  graduacion: "Graduación",
  aniversario: "Nuestro aniversario",
  despedida: "Despedida",
  fiesta: "¡Fiesta!",
  corporativo: "Invitación",
  otro: "Te invitamos",
};
const MUESTRA: Record<string, string> = {
  boda: "Sofía & Andrés",
  cumpleanos: "Los 7 de Mateo",
  xv: "Camila Fernanda",
  baby_shower: "Bebé Valentina",
  bautizo: "Bautizo de Lucas",
  graduacion: "Graduación de Daniela",
  aniversario: "25 años juntos",
  despedida: "La despedida de Andrea",
  fiesta: "Noche Blanca",
  corporativo: "Cena anual 2026",
  otro: "Nuestra celebración",
};

const CUANTAS = 24;

/**
 * ══════════════════════════════════════════════════════════════════
 *  LA GALERÍA DEL PANEL — ~2 000 diseños, de a 24
 * ══════════════════════════════════════════════════════════════════
 *
 * El catálogo tiene veinte diseños por cada estilo y tipo, así que el
 * filtrado NO puede vivir en el navegador: la página consulta la base
 * con el estilo y el tipo que vienen en la URL y manda solo esa tanda.
 * Los chips son enlaces (compartibles, y con el botón «atrás» del
 * navegador funcionando) y solo se muestran los estilos que ese tipo
 * usa: un corporativo no ofrece «infantil» para abrirse vacío.
 *
 * «Usar esta» aplica el diseño a una celebración de la persona (o abre
 * el asistente con el tipo y la plantilla ya elegidos).
 */
export default function GaleriaPlantillas({
  plantillas,
  conteo,
  categoriaActiva,
  tipoActivo,
  hayMas,
  categorias,
  celebraciones,
}: {
  /** Solo la tanda que se está viendo. */
  plantillas: PlantillaCatalogo[];
  /** Cuántos diseños hay por estilo, ya con el tipo elegido. */
  conteo: Record<string, number>;
  categoriaActiva: string;
  tipoActivo: string;
  hayMas: boolean;
  categorias: readonly CategoriaPlantilla[];
  celebraciones: Pick<Celebracion, "id" | "nombre" | "tipo" | "plantilla_id">[];
}) {
  const router = useRouter();
  const prefijo = usePrefijo();
  const [eligiendo, setEligiendo] = useState<PlantillaCatalogo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const categoriasVisibles = categorias.filter((c) => (conteo[c.id] ?? 0) > 0);
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);

  const enlace = (cat: string, tipo: string, cuantas?: number) => {
    const q = new URLSearchParams();
    if (cat !== "todas") q.set("estilo", cat);
    if (tipo !== "todos") q.set("tipo", tipo);
    if (cuantas) q.set("ver", String(cuantas));
    const cola = q.toString();
    return `${RUTA.appPlantillas}${cola ? `?${cola}` : ""}`;
  };

  function usar(p: PlantillaCatalogo, celebracionId: string) {
    setError(null);
    iniciar(async () => {
      const r = await elegirPlantilla(celebracionId, p.slug);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      router.push(conPrefijo(rutaEditor(celebracionId), prefijo));
    });
  }

  function alUsar(p: PlantillaCatalogo) {
    const tipoP = p.tipos_evento[0] ?? "otro";
    const candidatas = celebraciones.filter((c) => c.tipo === tipoP);
    if (candidatas.length === 0) {
      router.push(conPrefijo(`${RUTA.appCrear}?tipo=${tipoP}&plantilla=${p.slug}`, prefijo));
      return;
    }
    setEligiendo(p);
  }

  return (
    <div className="grid gap-6">
      <link rel="stylesheet" href={urlGoogleFonts(FUENTES.map((f) => f.id))} precedence="default" />

      {/* Estilos */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Estilos">
        <div className="flex w-max gap-2">
          <Pestana activa={categoriaActiva === "todas"} a={enlace("todas", tipoActivo)}>
            Todas <span className="opacity-60">{total}</span>
          </Pestana>
          {categoriasVisibles.map((c) => (
            <Pestana key={c.id} activa={categoriaActiva === c.id} a={enlace(c.id, tipoActivo)}>
              {c.nombre} <span className="opacity-60">{conteo[c.id] ?? 0}</span>
            </Pestana>
          ))}
        </div>
      </div>

      {/* Qué es ese estilo + filtro por tipo */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          {categoriaActiva !== "todas" ? (
            <>
              <h2 className="text-2xl leading-tight text-(--c-tinta)">{categorias.find((c) => c.id === categoriaActiva)?.nombre}</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">{categorias.find((c) => c.id === categoriaActiva)?.detalle}</p>
            </>
          ) : (
            <p className="text-[14px] leading-relaxed text-(--c-tinta-suave)">
              {total} diseños con este filtro, todos gratis y editables en vivo: colores, letras, portada, fondos en movimiento,
              música, fotos y secciones. Lo que se paga es publicar.
            </p>
          )}
        </div>
        <label className="grid gap-1 text-[12px] font-semibold text-(--c-tinta-suave)">
          <span className="c-montserrat">Tipo de celebración</span>
          <select
            value={tipoActivo}
            onChange={(e) => router.push(conPrefijo(enlace(categoriaActiva, e.target.value), prefijo))}
            className="c-campo min-w-[220px]"
          >
            <option value="todos">Todos los tipos</option>
            {TIPOS_CELEBRACION.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plural}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-(--c-coral-suave) px-4 py-3 text-[14px] text-(--c-coral-tinta)">
          {error}
        </p>
      )}

      {plantillas.length === 0 ? (
        <p className="c-tarjeta p-8 text-center text-[14px] text-(--c-tinta-suave)">No hay diseños con ese filtro. Probá otro estilo u otro tipo.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {plantillas.map((p) => {
            const t = p.tipos_evento[0] ?? "otro";
            const nombreTipo = TIPOS_CELEBRACION.find((x) => x.id === t)?.nombre ?? t;
            return (
              <li key={p.id} className="c-tarjeta elevar flex flex-col overflow-hidden">
                <button type="button" onClick={() => alUsar(p)} className="block p-2 text-left" aria-label={`Usar ${p.nombre}`}>
                  <MiniaturaPlantilla
                    estilos={p.estilos}
                    esquema={p.portada ? { secciones: [p.portada] } : undefined}
                    muestra={MUESTRA[t] ?? "Nuestra celebración"}
                    saludo={SALUDO[t] ?? "Te invitamos"}
                  />
                </button>
                <div className="flex flex-1 flex-col px-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="c-montserrat truncate text-[14px] font-semibold leading-tight text-(--c-tinta)">{p.nombre}</p>
                      <p className="mt-0.5 text-[12px] text-(--c-tinta-suave)">{nombreTipo}</p>
                    </div>
                    {p.nivel === "premium" && <span className="c-pastilla shrink-0">Premium</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <EnlaceCelebrar a={rutaPreviaPlantilla(p.slug)} target="_blank" className="c-boton c-boton-secundario min-h-10 text-[13px]">
                      Ver
                    </EnlaceCelebrar>
                    <button type="button" onClick={() => alUsar(p)} disabled={pendiente} className="c-boton c-boton-primario min-h-10 text-[13px]">
                      Usar esta
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hayMas && (
        <div className="text-center">
          <EnlaceCelebrar a={enlace(categoriaActiva, tipoActivo, plantillas.length + CUANTAS)} scroll={false} className="c-boton c-boton-secundario">
            Ver más diseños
          </EnlaceCelebrar>
        </div>
      )}

      {/* ¿En cuál celebración? */}
      {eligiendo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-(--c-marino)/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="usar-titulo" onClick={() => setEligiendo(null)}>
          <div className="w-full max-w-md rounded-[20px] bg-(--c-blanco) p-6 shadow-elevado" onClick={(e) => e.stopPropagation()}>
            <h3 id="usar-titulo" className="text-xl leading-tight text-(--c-tinta)">¿Para cuál celebración?</h3>
            <p className="mt-1 text-[14px] text-(--c-tinta-suave)">
              «{eligiendo.nombre}» se aplica a una de tus celebraciones. Si ya tenía diseño, se reemplaza (los textos que coincidan se conservan).
            </p>
            <ul className="mt-4 grid gap-2">
              {celebraciones
                .filter((c) => c.tipo === (eligiendo.tipos_evento[0] ?? "otro"))
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => usar(eligiendo, c.id)}
                      className="flex min-h-12 w-full items-center justify-between rounded-xl border border-(--c-linea) px-4 text-left text-[14px] font-semibold text-(--c-tinta) hover:border-(--c-marino)"
                    >
                      {c.nombre}
                      <span className="text-[12px] font-normal text-(--c-tinta-suave)">{c.plantilla_id ? "Reemplazar diseño" : "Aplicar"}</span>
                    </button>
                  </li>
                ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <EnlaceCelebrar a={`${RUTA.appCrear}?tipo=${eligiendo.tipos_evento[0] ?? "otro"}&plantilla=${eligiendo.slug}`} className="text-[13px] font-semibold text-(--c-azul) underline underline-offset-4">
                Crear una celebración nueva con este diseño
              </EnlaceCelebrar>
              <button type="button" onClick={() => setEligiendo(null)} className="c-boton c-boton-secundario min-h-10 text-[13px]">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pestana({ activa, a, children }: { activa: boolean; a: string; children: React.ReactNode }) {
  return (
    <EnlaceCelebrar
      a={a}
      role="tab"
      aria-selected={activa}
      scroll={false}
      className={`c-montserrat flex min-h-10 items-center whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
        activa ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta-suave) hover:text-(--c-tinta)"
      }`}
    >
      {children}
    </EnlaceCelebrar>
  );
}
