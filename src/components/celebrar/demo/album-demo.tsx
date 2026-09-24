"use client";

import { useState } from "react";
import { ALBUM_DEMO, MOMENTOS_ALBUM, type FotoAlbum } from "@/lib/celebrar/demo-album";
import { RUTA } from "@/lib/celebrar/rutas";
import MarcaCelebrar from "../marca-celebrar";
import { EnlaceCelebrar } from "../rutas-cliente";

type Momento = (typeof MOMENTOS_ALBUM)[number][0];

/**
 * EL ÁLBUM DE LA CELEBRACIÓN, como lo ven los invitados: la portada con
 * la fiesta, el botón «Subir mis fotos» (el QR de la mesa lleva acá), los
 * filtros por momento, el mosaico con quién subió cada foto, los
 * corazones y la foto en grande. Es un demo: los corazones se cuentan en
 * la pantalla y «subir» explica qué pasaría en la versión real.
 */
export default function AlbumDemo() {
  const [momento, setMomento] = useState<Momento>("todas");
  const [likes, setLikes] = useState<Record<string, number>>(() => Object.fromEntries(ALBUM_DEMO.fotos.map((f) => [f.id, f.likes])));
  const [mios, setMios] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<FotoAlbum | null>(null);
  const [subir, setSubir] = useState(false);

  const fotos = momento === "todas" ? ALBUM_DEMO.fotos : ALBUM_DEMO.fotos.filter((f) => f.momento === momento);

  function alternarLike(id: string) {
    setMios((s) => {
      const n = new Set(s);
      const ya = n.has(id);
      if (ya) n.delete(id);
      else n.add(id);
      setLikes((l) => ({ ...l, [id]: l[id] + (ya ? -1 : 1) }));
      return n;
    });
  }

  return (
    <div className="celebrar min-h-screen bg-(--c-hielo)">
      {/* Portada */}
      <header className="relative isolate overflow-hidden bg-(--c-marino) text-(--c-blanco)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ALBUM_DEMO.portada} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-(--c-marino) via-(--c-marino)/60 to-transparent" aria-hidden="true" />
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-5 sm:px-6">
          <MarcaCelebrar tono="claro" tamano="sm" />
          <span className="c-montserrat rounded-full bg-(--c-blanco)/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]">Álbum · demo</span>
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-24 sm:px-6 lg:pb-14 lg:pt-36">
          <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.14em] text-(--c-sobre-marino-suave)">El álbum de la fiesta</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3.4rem)] leading-[1.02]">{ALBUM_DEMO.celebracion}</h1>
          <p className="mt-3 text-[15px] text-(--c-sobre-marino-suave)">
            {ALBUM_DEMO.fecha} · {ALBUM_DEMO.lugar}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSubir(true)} className="c-boton c-boton-claro min-h-11">
              <IconoCamara />
              Subir mis fotos
            </button>
            <p className="text-[13px] text-(--c-sobre-marino-suave)">
              {ALBUM_DEMO.fotos.length} fotos · {ALBUM_DEMO.invitados} invitados subiendo
            </p>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="sticky top-0 z-20 border-b border-(--c-linea) bg-(--c-hielo)/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl gap-2 overflow-x-auto px-4 py-3 sm:px-6" role="tablist" aria-label="Momentos">
          {MOMENTOS_ALBUM.map(([id, t]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={momento === id}
              onClick={() => setMomento(id)}
              className={`c-montserrat shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
                momento === id ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta-suave) hover:text-(--c-tinta)"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Mosaico */}
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>li]:mb-3 [&>li]:break-inside-avoid">
          {fotos.map((f) => (
            <li key={f.id} className="group relative overflow-hidden rounded-2xl border border-(--c-linea) bg-(--c-blanco)">
              <button type="button" onClick={() => setAbierta(f)} className="block w-full" aria-label={`Ver ${f.pie}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.pie} loading="lazy" className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${f.alta ? "aspect-[3/4]" : "aspect-[4/3]"}`} />
              </button>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="c-montserrat truncate text-[12.5px] font-semibold text-(--c-tinta)">{f.autor}</p>
                  <p className="truncate text-[12px] text-(--c-tinta-suave)">{f.pie}</p>
                </div>
                <button
                  type="button"
                  onClick={() => alternarLike(f.id)}
                  aria-pressed={mios.has(f.id)}
                  aria-label="Me gusta"
                  className={`c-montserrat inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${mios.has(f.id) ? "bg-(--c-coral-suave) text-(--c-coral-tinta)" : "bg-(--c-hielo) text-(--c-tinta-suave)"}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={mios.has(f.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" strokeLinejoin="round" />
                  </svg>
                  {likes[f.id]}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <section className="mt-10 grid gap-4 rounded-[var(--c-radio-tarjeta)] bg-(--c-marino) p-6 text-(--c-blanco) sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.12em] text-(--c-sobre-marino-suave)">Cómo funciona</p>
            <h2 className="mt-1 text-xl leading-tight">Un QR en cada mesa. Todos suben, todos ven.</h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">
              Los invitados escanean, suben sus fotos desde el teléfono sin instalar nada, y el álbum se arma solo durante la fiesta. Después queda como la página de recuerdos de la celebración.
            </p>
          </div>
          <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-claro">
            Crear mi celebración
          </EnlaceCelebrar>
        </section>
      </main>

      {/* Foto en grande */}
      {abierta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--c-marino)/85 p-4" role="dialog" aria-modal="true" aria-label={abierta.pie} onClick={() => setAbierta(null)}>
          <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={abierta.url.replace("w=900", "w=1600")} alt={abierta.pie} className="max-h-[80vh] w-auto rounded-2xl object-contain shadow-elevado" />
            <figcaption className="mt-3 flex items-center justify-between gap-3 text-(--c-blanco)">
              <span>
                <span className="c-montserrat font-semibold">{abierta.autor}</span>
                <span className="text-(--c-sobre-marino-suave)"> · {abierta.pie}</span>
              </span>
              <button type="button" onClick={() => setAbierta(null)} className="c-boton c-boton-fantasma min-h-9 text-[13px]">
                Cerrar
              </button>
            </figcaption>
          </figure>
        </div>
      )}

      {/* «Subir» explicado */}
      {subir && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-(--c-marino)/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="subir-titulo" onClick={() => setSubir(false)}>
          <div className="w-full max-w-md rounded-[20px] bg-(--c-blanco) p-6 shadow-elevado" onClick={(e) => e.stopPropagation()}>
            <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">En la fiesta real</p>
            <h3 id="subir-titulo" className="mt-1 text-xl leading-tight text-(--c-tinta)">Acá se abre tu cámara</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-(--c-tinta-suave)">
              El invitado escanea el QR de la mesa, escribe su nombre una vez y sube fotos o videos desde el teléfono, sin instalar nada ni crear cuenta. Aparecen en el álbum al instante, con su nombre.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setSubir(false)} className="c-boton c-boton-secundario min-h-10 text-[13px]">
                Entendido
              </button>
              <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-primario min-h-10 text-[13px]">
                Quiero esto para mi fiesta
              </EnlaceCelebrar>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
