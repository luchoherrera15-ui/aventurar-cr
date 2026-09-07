"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_AGREGAR, BOTON_PANEL, BOTON_PANEL_PRIMARIO, CUERPO_SUAVE } from "@/components/panel/sistema";
import type { AutomatizacionIg, ResumenAutomatizacion } from "@/lib/instagram/tipos";
import FormularioAutomatizacion from "./formulario-automatizacion";
import { activarAutomatizacionIg, borrarAutomatizacionIg } from "./actions";

/**
 * LA LISTA DE AUTOMATIZACIONES con sus números.
 *
 * Cada fila: la publicación (miniatura y texto), las palabras clave, el
 * estado, y cuatro cifras que salen de la bitácora (comentarios, DMs,
 * errores, última actividad). «Estadísticas» abre el detalle completo
 * de esa automatización, sin salir de la página.
 */

export type AutomatizacionConResumen = AutomatizacionIg & { resumen: ResumenAutomatizacion };

const FECHA_HORA = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica" });

export default function ListaAutomatizaciones({
  negocioId,
  automatizaciones,
  puedeCrear,
  motivoNoCrear,
  urlPagina,
}: {
  negocioId: string;
  automatizaciones: AutomatizacionConResumen[];
  puedeCrear: boolean;
  motivoNoCrear: string | null;
  urlPagina: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<AutomatizacionIg | "nueva" | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, arrancar] = useTransition();

  const correr = (fn: () => Promise<{ ok: boolean; motivo?: string }>) => {
    setError(null);
    arrancar(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.motivo ?? "No se pudo.");
      router.refresh();
    });
  };

  const accion =
    puedeCrear && editando === null ? (
      <button type="button" onClick={() => setEditando("nueva")} className={BOTON_PANEL_PRIMARIO}>
        Crear automatización
      </button>
    ) : null;

  return (
    <Card eyebrow="Instagram" titulo="Automatizaciones" accion={accion}>
      {editando !== null && (
        <div className="mb-4">
          <FormularioAutomatizacion
            negocioId={negocioId}
            inicial={editando === "nueva" ? null : editando}
            urlPagina={urlPagina}
            onCerrar={() => setEditando(null)}
            onGuardado={() => {
              setEditando(null);
              router.refresh();
            }}
          />
        </div>
      )}

      {automatizaciones.length === 0 && editando === null && (
        <div>
          <p className={CUERPO_SUAVE}>
            {puedeCrear
              ? "Todavía no hay ninguna. Elegí una publicación, una o varias palabras clave, y el mensaje que va a recibir quien comente."
              : (motivoNoCrear ?? "Conectá tu Instagram para crear la primera.")}
          </p>
          {puedeCrear && (
            <button type="button" onClick={() => setEditando("nueva")} className={`mt-3 ${BOTON_AGREGAR}`}>
              + Crear mi primera automatización
            </button>
          )}
        </div>
      )}

      {automatizaciones.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {automatizaciones.map((a) => {
            const r = a.resumen;
            const abierto = detalle === a.id;
            return (
              <li key={a.id} className="rounded-2xl border border-aventurea-line bg-white p-3.5">
                <div className="flex flex-wrap items-start gap-3">
                  {a.media_miniatura_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de Instagram
                    <img src={a.media_miniatura_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-aventurea-cream-2 text-[10px] font-bold text-aventurea-ink-soft">post</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-extrabold text-aventurea-navy">{a.nombre}</p>
                      <PildoraEstado estado={a.activa ? "exito" : "neutro"}>{a.activa ? "Activa" : "Pausada"}</PildoraEstado>
                    </div>
                    <p className={`truncate ${CUERPO_SUAVE}`}>
                      {a.media_permalink ? (
                        <a href={a.media_permalink} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                          {a.media_resumen || `Publicación ${a.media_id}`}
                        </a>
                      ) : (
                        a.media_resumen || `Publicación ${a.media_id}`
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {a.disparador === "cualquier_comentario" ? (
                        <span className="rounded-lg bg-aventurea-cream-2 px-2 py-0.5 text-[11.5px] font-bold text-aventurea-navy">Cualquier comentario</span>
                      ) : (
                        a.palabras.map((p) => (
                          <span key={p} className="rounded-lg bg-aventurea-cream-2 px-2 py-0.5 text-[11.5px] font-bold text-aventurea-navy">{p}</span>
                        ))
                      )}
                    </div>
                    <p className={`mt-1.5 ${CUERPO_SUAVE}`}>
                      {r.comentarios} comentarios · {r.dms} DMs · {r.errores} errores
                      {r.ultimaActividad ? ` · último ${FECHA_HORA.format(new Date(r.ultimaActividad))}` : " · sin actividad"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setDetalle(abierto ? null : a.id)} className={BOTON_PANEL}>Estadísticas</button>
                    <button type="button" onClick={() => setEditando(a)} disabled={ocupado} className={BOTON_PANEL}>Editar</button>
                    <button type="button" onClick={() => correr(() => activarAutomatizacionIg(negocioId, a.id, !a.activa))} disabled={ocupado} className={BOTON_PANEL}>
                      {a.activa ? "Pausar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`¿Borrar «${a.nombre}»? La bitácora de sus comentarios se conserva.`)) return;
                        correr(() => borrarAutomatizacionIg(negocioId, a.id));
                      }}
                      disabled={ocupado}
                      className={BOTON_PANEL}
                    >
                      Borrar
                    </button>
                  </div>
                </div>
                {abierto && (
                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-aventurea-line pt-3 text-center sm:grid-cols-6">
                    {(
                      [
                        ["Comentarios", r.comentarios],
                        ["Coincidencias", r.coincidencias],
                        ["DMs enviados", r.dms],
                        ["Públicas", r.publicas],
                        ["Errores", r.errores],
                        ["Tasa de éxito", r.tasaExito === null ? "—" : `${r.tasaExito} %`],
                      ] as [string, string | number][]
                    ).map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-aventurea-cream-2 px-2 py-2">
                        <dt className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">{k}</dt>
                        <dd className="text-[18px] font-extrabold text-aventurea-navy">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-3 text-[13px] font-bold text-red-700">{error}</p>}
    </Card>
  );
}
