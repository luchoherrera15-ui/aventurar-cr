"use client";

import { useState, useTransition } from "react";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL, CUERPO_SUAVE, ROTULO_CAMPO } from "@/components/panel/sistema";
import { bytesUtf8, MAX_BYTES_DM, armarMensajePrivado } from "@/lib/instagram/mensaje";
import { sanearPalabras } from "@/lib/instagram/coincidencia";
import { MODOS_COINCIDENCIA, TOPES_IG, type AutomatizacionIg, type Disparador, type ModoCoincidencia, type PublicacionIg } from "@/lib/instagram/tipos";
import { guardarAutomatizacionIg, listarPublicacionesIg } from "./actions";

/**
 * CREAR / EDITAR UNA AUTOMATIZACIÓN.
 *
 * La publicación se elige de la lista que da Graph (`GET /<IG_ID>/media`):
 * miniatura, texto, fecha, tipo. Se pide al tocar «Elegir publicación»,
 * no al abrir el panel — es una llamada a Meta que no hace falta hasta
 * que se necesita. Si la lista no carga (token, permisos), queda el
 * campo para pegar el ID numérico a mano: la automatización funciona
 * igual, lo único que no tiene es la miniatura.
 */

const NOMBRE_MODO: Record<ModoCoincidencia, { nombre: string; pie: string }> = {
  palabra: { nombre: "Palabra entera", pie: "«precio» sí, «precioso» no. Sin distinguir mayúsculas ni acentos." },
  exacta: { nombre: "Comentario exacto", pie: "Solo si el comentario es exactamente la palabra." },
  contiene: { nombre: "Contiene", pie: "En cualquier parte, aunque esté dentro de otra palabra." },
};

const FECHA = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", timeZone: "America/Costa_Rica" });

export default function FormularioAutomatizacion({
  negocioId,
  inicial,
  urlPagina,
  onCerrar,
  onGuardado,
}: {
  negocioId: string;
  inicial: AutomatizacionIg | null;
  urlPagina: string;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [media, setMedia] = useState<{ id: string; permalink: string | null; resumen: string | null; miniatura: string | null }>({
    id: inicial?.media_id ?? "",
    permalink: inicial?.media_permalink ?? null,
    resumen: inicial?.media_resumen ?? null,
    miniatura: inicial?.media_miniatura_url ?? null,
  });
  const [disparador, setDisparador] = useState<Disparador>(inicial?.disparador ?? "palabra");
  const [modo, setModo] = useState<ModoCoincidencia>(inicial?.modo_coincidencia ?? "palabra");
  const [palabras, setPalabras] = useState<string[]>(inicial?.palabras ?? []);
  const [palabraNueva, setPalabraNueva] = useState("");
  const [mensaje, setMensaje] = useState(inicial?.mensaje_privado ?? "¡Hola! 👋 Gracias por comentar. Acá tenés toda la información:");
  const [enlace, setEnlace] = useState(inicial?.enlace ?? urlPagina);
  const [publica, setPublica] = useState(inicial?.respuesta_publica ?? false);
  const [mensajePublico, setMensajePublico] = useState(inicial?.mensaje_publico ?? "¡Te enviamos la información por DM! 👋");

  const [publicaciones, setPublicaciones] = useState<PublicacionIg[] | null>(null);
  const [cargandoPub, setCargandoPub] = useState(false);
  const [errorPub, setErrorPub] = useState<string | null>(null);
  const [mostrarSelector, setMostrarSelector] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [ocupado, arrancar] = useTransition();

  const bytes = bytesUtf8(armarMensajePrivado(mensaje, enlace));

  const agregarPalabra = () => {
    const nuevas = sanearPalabras([...palabras, ...palabraNueva.split(",")], TOPES_IG.palabras, TOPES_IG.palabra);
    setPalabras(nuevas);
    setPalabraNueva("");
  };

  const cargarPublicaciones = async () => {
    setMostrarSelector(true);
    if (publicaciones) return;
    setCargandoPub(true);
    setErrorPub(null);
    const r = await listarPublicacionesIg(negocioId);
    setCargandoPub(false);
    if (!r.ok) return setErrorPub(r.motivo);
    setPublicaciones(r.publicaciones);
  };

  const elegir = (p: PublicacionIg) => {
    setMedia({ id: p.id, permalink: p.permalink, resumen: (p.caption ?? "").replace(/\s+/g, " ").slice(0, TOPES_IG.mediaResumen) || null, miniatura: p.thumbnail_url ?? p.media_url });
    setMostrarSelector(false);
  };

  const guardar = () => {
    setError(null);
    arrancar(async () => {
      const r = await guardarAutomatizacionIg(negocioId, {
        id: inicial?.id ?? null,
        nombre,
        mediaId: media.id,
        mediaPermalink: media.permalink,
        mediaResumen: media.resumen,
        mediaMiniaturaUrl: media.miniatura,
        disparador,
        modo,
        palabras,
        mensajePrivado: mensaje,
        enlace,
        respuestaPublica: publica,
        mensajePublico,
      });
      if (!r.ok) return setError(r.motivo);
      onGuardado();
    });
  };

  return (
    <div className="rounded-2xl border border-aventurea-navy bg-white p-4 sm:p-5">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-bookea-azul">{inicial ? "Editar automatización" : "Nueva automatización"}</p>

      <div className="mt-3 grid gap-4">
        <div>
          <label htmlFor="ig-nombre" className={ROTULO_CAMPO}>Nombre</label>
          <input id="ig-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={TOPES_IG.nombre} placeholder="Promo septiembre" className={`mt-1.5 ${CAMPO_PANEL}`} />
        </div>

        {/* ── La publicación ── */}
        <div>
          <p className={ROTULO_CAMPO}>Publicación</p>
          {media.id ? (
            <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-2.5">
              {media.miniatura ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de Instagram
                <img src={media.miniatura} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-lg bg-white text-[11px] font-bold text-aventurea-ink-soft">ID</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-aventurea-navy">{media.resumen || `Publicación ${media.id}`}</p>
                {media.permalink && (
                  <a href={media.permalink} target="_blank" rel="noopener noreferrer" className="text-[12px] text-aventurea-ink-soft underline-offset-2 hover:underline">
                    Ver en Instagram →
                  </a>
                )}
              </div>
              <button type="button" onClick={cargarPublicaciones} className={BOTON_PANEL}>Cambiar</button>
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={cargarPublicaciones} className={BOTON_PANEL_PRIMARIO}>Elegir publicación</button>
              <span className={CUERPO_SUAVE}>o pegá el ID:</span>
              <input value={media.id} onChange={(e) => setMedia({ id: e.target.value.replace(/\D/g, ""), permalink: null, resumen: null, miniatura: null })} placeholder="1800000000000000" className={`${CAMPO_PANEL} max-w-[220px]`} />
            </div>
          )}

          {mostrarSelector && (
            <div className="mt-2 rounded-xl border border-aventurea-line bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-bold text-aventurea-navy">Tus últimas publicaciones</p>
                <button type="button" onClick={() => setMostrarSelector(false)} className="text-[12px] font-bold text-aventurea-ink-soft">Cerrar</button>
              </div>
              {cargandoPub && <p className={`mt-2 ${CUERPO_SUAVE}`}>Pidiéndoselas a Instagram…</p>}
              {errorPub && <p className="mt-2 text-[12.5px] font-bold text-red-700">{errorPub}</p>}
              {publicaciones && publicaciones.length === 0 && <p className={`mt-2 ${CUERPO_SUAVE}`}>Instagram no devolvió publicaciones.</p>}
              {publicaciones && publicaciones.length > 0 && (
                <div className="mt-2 grid max-h-[320px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
                  {publicaciones.map((p) => {
                    const foto = p.thumbnail_url ?? p.media_url;
                    return (
                      <button key={p.id} type="button" onClick={() => elegir(p)} className="presionable group relative aspect-square overflow-hidden rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-left">
                        {foto ? (
                          // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de Instagram
                          <img src={foto} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-[10px] text-aventurea-ink-soft">{p.media_type ?? "media"}</span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-1 text-[10px] leading-tight text-white">
                          {p.media_product_type === "REELS" ? "Reel" : "Post"} · {p.timestamp ? FECHA.format(new Date(p.timestamp)) : ""}
                          {p.caption ? ` · ${p.caption.slice(0, 40)}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── El disparador ── */}
        <div>
          <p className={ROTULO_CAMPO}>Se dispara con</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(
              [
                ["palabra", "Una palabra clave"],
                ["cualquier_comentario", "Cualquier comentario"],
              ] as [Disparador, string][]
            ).map(([v, t]) => (
              <label key={v} className={`presionable cursor-pointer rounded-xl border px-3.5 py-2 text-[12.5px] font-bold ${disparador === v ? "border-aventurea-navy bg-aventurea-navy text-white" : "border-aventurea-line bg-white text-aventurea-ink"}`}>
                <input type="radio" name="ig-disparador" value={v} checked={disparador === v} onChange={() => setDisparador(v)} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </div>

        {disparador === "palabra" && (
          <div>
            <label htmlFor="ig-palabra" className={ROTULO_CAMPO}>Palabras clave</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {palabras.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-lg bg-aventurea-cream-2 px-2.5 py-1 text-[12.5px] font-bold text-aventurea-navy">
                  {p}
                  <button type="button" aria-label={`Quitar ${p}`} onClick={() => setPalabras(palabras.filter((x) => x !== p))} className="text-aventurea-ink-soft hover:text-red-700">×</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                id="ig-palabra"
                value={palabraNueva}
                onChange={(e) => setPalabraNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    agregarPalabra();
                  }
                }}
                maxLength={TOPES_IG.palabra}
                placeholder="precio, costo, info…"
                className={CAMPO_PANEL}
              />
              <button type="button" onClick={agregarPalabra} className={BOTON_PANEL}>Agregar</button>
            </div>
            <div className="mt-2">
              <label htmlFor="ig-modo" className={ROTULO_CAMPO}>Cómo se compara</label>
              <select id="ig-modo" value={modo} onChange={(e) => setModo(e.target.value as ModoCoincidencia)} className={`mt-1.5 ${CAMPO_PANEL}`}>
                {MODOS_COINCIDENCIA.map((m) => (
                  <option key={m} value={m}>{NOMBRE_MODO[m].nombre}</option>
                ))}
              </select>
              <p className={`mt-1 ${CUERPO_SUAVE}`}>{NOMBRE_MODO[modo].pie}</p>
            </div>
          </div>
        )}

        {/* ── El DM ── */}
        <div>
          <label htmlFor="ig-mensaje" className={ROTULO_CAMPO}>Mensaje privado</label>
          <textarea id="ig-mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} maxLength={TOPES_IG.mensajePrivado} className={`mt-1.5 ${CAMPO_PANEL}`} />
          <label htmlFor="ig-enlace" className={`mt-2 block ${ROTULO_CAMPO}`}>Enlace (va al final del mensaje)</label>
          <input id="ig-enlace" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder={urlPagina} className={`mt-1.5 ${CAMPO_PANEL}`} />
          <p className={`mt-1 ${CUERPO_SUAVE} ${bytes > MAX_BYTES_DM ? "text-red-700" : ""}`}>
            {bytes} / {MAX_BYTES_DM} bytes (el tope de Instagram). Solo texto: Instagram no permite botones en estas respuestas.
          </p>
        </div>

        {/* ── La pública ── */}
        <div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-aventurea-navy">
            <input type="checkbox" checked={publica} onChange={(e) => setPublica(e.target.checked)} className="h-4 w-4" />
            Responder también en público, debajo del comentario
          </label>
          {publica && (
            <textarea value={mensajePublico} onChange={(e) => setMensajePublico(e.target.value)} rows={2} maxLength={TOPES_IG.mensajePublico} className={`mt-2 ${CAMPO_PANEL}`} />
          )}
        </div>

        {error && <p className="text-[13px] font-bold text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={guardar} disabled={ocupado} className={BOTON_PANEL_PRIMARIO}>
            {ocupado ? "Guardando…" : "Guardar automatización"}
          </button>
          <button type="button" onClick={onCerrar} disabled={ocupado} className={BOTON_PANEL}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
