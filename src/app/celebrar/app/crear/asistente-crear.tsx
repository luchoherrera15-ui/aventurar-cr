"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ICONO_TIPO } from "@/components/celebrar/iconos-tipos";
import { sitioCelebrar } from "@/lib/celebrar/dominios";
import { TIPOS_CELEBRACION, type TipoCelebracionId } from "@/lib/celebrar/marca";
import { limpiarSlugEscrito, sugerirSlug, veredictoSlug } from "@/lib/celebrar/slug";
import { esTipoCelebracion } from "@/lib/celebrar/validar-celebracion";
import { createClient } from "@/lib/supabase/client";
import { crearCelebracion, type EstadoCrear } from "./acciones";

/** Los siete pasos del asistente (brief, sección 33). Acá viven el 1 y el 2. */
export const PASOS_ASISTENTE = [
  "¿Qué estás celebrando?",
  "Información básica",
  "Elegir diseño",
  "Personalizar",
  "Agregar funciones",
  "Vista previa",
  "Publicar",
] as const;

type Disponibilidad =
  | { estado: "vacio" }
  | { estado: "invalido"; motivo: string }
  | { estado: "comprobando" }
  | { estado: "libre" }
  | { estado: "ocupado" }
  | { estado: "sin-base" };

/**
 * El asistente de creación. Un solo formulario en dos pantallas: el
 * tipo (paso 1) y los datos básicos (paso 2). Al crear, la persona cae
 * en la página de su celebración, donde siguen los pasos 3 a 7.
 *
 * El slug se sugiere desde el nombre y se comprueba en vivo contra la
 * base (`celebrar_slug_disponible`, solo sí/no: no revela de quién es
 * uno ocupado). La validación de forma es la misma función pura del
 * servidor; la base vuelve a validar al crear.
 */
export default function AsistenteCrear({
  tipoInicial,
  personalizado = false,
  plantilla,
}: {
  tipoInicial?: string;
  personalizado?: boolean;
  /** Slug de la plantilla elegida en el catálogo: se aplica al crear. */
  plantilla?: string;
}) {
  const [tipo, setTipo] = useState<TipoCelebracionId | "">(
    esTipoCelebracion(tipoInicial) ? tipoInicial : "",
  );
  const [paso, setPaso] = useState<1 | 2>(esTipoCelebracion(tipoInicial) ? 2 : 1);
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  // Lo que respondió la base para un slug concreto. Se compara con el
  // slug actual: si no coincide, todavía se está comprobando.
  const [remoto, setRemoto] = useState<{ slug: string; resultado: "libre" | "ocupado" | "sin-base" } | null>(null);
  const [estado, enviar, pendiente] = useActionState<EstadoCrear, FormData>(crearCelebracion, null);

  // "www.bookea.lat/celebrar" o "celebrar.lat": la base sin el esquema.
  const base = useMemo(() => sitioCelebrar().split("://").pop() ?? "", []);
  const veredicto = useMemo(() => (slug ? veredictoSlug(slug) : null), [slug]);

  // Comprobación en vivo contra la base, con espera corta para no
  // consultar por letra. Solo la respuesta asíncrona escribe estado.
  useEffect(() => {
    if (!slug || !veredicto?.ok) return;
    let cancelado = false;
    const id = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("celebrar_slug_disponible", { p_slug: slug });
      if (cancelado) return;
      setRemoto({ slug, resultado: error ? "sin-base" : data ? "libre" : "ocupado" });
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [slug, veredicto]);

  const disponibilidad: Disponibilidad = !slug
    ? { estado: "vacio" }
    : veredicto && !veredicto.ok
      ? { estado: "invalido", motivo: veredicto.motivo }
      : remoto?.slug === slug
        ? { estado: remoto.resultado }
        : { estado: "comprobando" };

  const errores = estado?.errores ?? {};
  const puedeCrear =
    tipo !== "" &&
    nombre.trim().length >= 2 &&
    (disponibilidad.estado === "libre" || disponibilidad.estado === "sin-base");

  return (
    <div className="grid gap-8">
      <ol className="flex flex-wrap gap-2" aria-label="Pasos del asistente">
        {PASOS_ASISTENTE.map((p, i) => {
          const numero = i + 1;
          const actual = numero === paso;
          const hecho = numero < paso;
          return (
            <li
              key={p}
              aria-current={actual ? "step" : undefined}
              className={`c-montserrat flex min-h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold ${
                actual
                  ? "bg-(--c-marino) text-(--c-blanco)"
                  : hecho
                    ? "bg-(--c-celeste) text-(--c-azul-tinta)"
                    : "border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta-suave)"
              }`}
            >
              <span className="tabular-nums">{String(numero).padStart(2, "0")}</span>
              {p}
            </li>
          );
        })}
      </ol>

      <form action={enviar} className="c-tarjeta p-6 lg:p-8" noValidate>
        <input type="hidden" name="tipo" value={tipo} />
        {personalizado && <input type="hidden" name="modo" value="personalizado" />}
        {plantilla && <input type="hidden" name="plantilla" value={plantilla} />}

        {paso === 1 && (
          <div>
            <h2 className="text-2xl leading-tight text-(--c-tinta)">¿Qué estás celebrando?</h2>
            <p className="mt-2 text-[15px] text-(--c-tinta-suave)">
              Define qué diseños te mostramos primero y cómo hablamos de tu evento.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TIPOS_CELEBRACION.map((t) => {
                const Icono = ICONO_TIPO[t.id];
                const activo = tipo === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTipo(t.id);
                        setPaso(2);
                      }}
                      aria-pressed={activo}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left text-[15px] font-medium transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
                        activo
                          ? "border-(--c-marino) bg-(--c-celeste) text-(--c-marino)"
                          : "border-(--c-linea) bg-(--c-hielo) text-(--c-tinta) hover:border-(--c-marino)"
                      }`}
                    >
                      <span className="c-disco h-9 w-9 rounded-[10px]">
                        <Icono className="h-4.5 w-4.5" />
                      </span>
                      {t.nombre}
                    </button>
                  </li>
                );
              })}
            </ul>
            {errores.tipo && <Error>{errores.tipo}</Error>}
          </div>
        )}

        {paso === 2 && (
          <div className="grid gap-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl leading-tight text-(--c-tinta)">Información básica</h2>
                <p className="mt-2 text-[15px] text-(--c-tinta-suave)">
                  Lo mínimo para crear la celebración. Todo se puede cambiar después.
                </p>
              </div>
              <button type="button" onClick={() => setPaso(1)} className="c-boton c-boton-secundario">
                {tipo ? `Cambiar: ${TIPOS_CELEBRACION.find((t) => t.id === tipo)?.nombre}` : "Elegir tipo"}
              </button>
            </div>

            <div>
              <label htmlFor="crear-nombre" className="c-rotulo">
                Nombre de la celebración
              </label>
              <input
                id="crear-nombre"
                name="nombre"
                type="text"
                required
                maxLength={120}
                autoFocus
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  // La sugerencia sigue al nombre hasta que la persona toca el slug.
                  if (!slugTocado) setSlug(sugerirSlug(e.target.value));
                }}
                className="c-campo"
                placeholder={tipo === "boda" ? "Sofía & Andrés" : tipo === "cumpleanos" ? "Mateo cumple 5" : "Cómo se llama"}
              />
              {errores.nombre && <Error>{errores.nombre}</Error>}
            </div>

            <div>
              <label htmlFor="crear-slug" className="c-rotulo">
                Tu dirección
              </label>
              <div className="c-campo flex items-center gap-1 px-0">
                <span className="shrink-0 pl-4 text-[14px] text-(--c-tinta-suave)">{base}/</span>
                <input
                  id="crear-slug"
                  name="slug"
                  type="text"
                  required
                  maxLength={60}
                  autoComplete="off"
                  spellCheck={false}
                  value={slug}
                  onChange={(e) => {
                    setSlugTocado(true);
                    setSlug(limpiarSlugEscrito(e.target.value));
                  }}
                  className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-[15px] text-(--c-tinta) outline-none"
                  placeholder="sofia-y-andres"
                />
              </div>
              <EstadoSlug d={disponibilidad} errorServidor={errores.slug} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="crear-fecha" className="c-rotulo">
                  Fecha <span className="font-normal text-(--c-tinta-suave)">(opcional)</span>
                </label>
                <input id="crear-fecha" name="fecha" type="date" className="c-campo" />
                {errores.fecha && <Error>{errores.fecha}</Error>}
              </div>
              <div>
                <label htmlFor="crear-hora" className="c-rotulo">
                  Hora <span className="font-normal text-(--c-tinta-suave)">(opcional)</span>
                </label>
                <input id="crear-hora" name="hora" type="time" className="c-campo" />
                {errores.hora && <Error>{errores.hora}</Error>}
              </div>
            </div>

            <div>
              <label htmlFor="crear-lugar" className="c-rotulo">
                Lugar <span className="font-normal text-(--c-tinta-suave)">(opcional)</span>
              </label>
              <input id="crear-lugar" name="lugarNombre" type="text" maxLength={160} className="c-campo" placeholder="Hacienda Los Sueños" />
              {errores.lugarNombre && <Error>{errores.lugarNombre}</Error>}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="crear-direccion" className="c-rotulo">
                  Dirección <span className="font-normal text-(--c-tinta-suave)">(opcional)</span>
                </label>
                <input id="crear-direccion" name="direccion" type="text" maxLength={300} className="c-campo" placeholder="San Rafael de Escazú" />
                {errores.direccion && <Error>{errores.direccion}</Error>}
              </div>
              <div>
                <label htmlFor="crear-maps" className="c-rotulo">
                  Link de Google Maps o Waze <span className="font-normal text-(--c-tinta-suave)">(opcional)</span>
                </label>
                <input id="crear-maps" name="mapsUrl" type="url" inputMode="url" className="c-campo" placeholder="https://maps.app.goo.gl/…" />
                {errores.mapsUrl && <Error>{errores.mapsUrl}</Error>}
              </div>
            </div>

            {estado?.mensaje && (
              <p role="alert" className="rounded-xl bg-(--c-coral-suave) px-4 py-3 text-[14px] leading-relaxed text-(--c-coral-tinta)">
                {estado.mensaje}
              </p>
            )}

            <div className="flex flex-col gap-4 border-t border-(--c-linea) pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14px] leading-relaxed text-(--c-tinta-suave)">
                Se crea como borrador: nada se publica hasta que lo decidás. El diseño y las
                funciones vienen en los pasos siguientes.
              </p>
              <button type="submit" disabled={!puedeCrear || pendiente} className="c-boton c-boton-primario shrink-0">
                {pendiente ? "Creando…" : "Crear celebración"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function EstadoSlug({ d, errorServidor }: { d: Disponibilidad; errorServidor?: string }) {
  if (errorServidor) return <Error>{errorServidor}</Error>;
  const clase = "mt-2 text-[13px]";
  switch (d.estado) {
    case "vacio":
      return <p className={`${clase} text-(--c-tinta-suave)`}>Se arma solo con el nombre; podés cambiarlo.</p>;
    case "invalido":
      return <p className={`${clase} text-(--c-coral-tinta)`}>{d.motivo}</p>;
    case "comprobando":
      return <p className={`${clase} text-(--c-tinta-suave)`}>Comprobando si está libre…</p>;
    case "libre":
      return <p className={`${clase} font-medium text-(--c-ok)`}>Disponible.</p>;
    case "ocupado":
      return <p className={`${clase} text-(--c-coral-tinta)`}>Esa dirección ya está tomada. Probá con otra.</p>;
    case "sin-base":
      return <p className={`${clase} text-(--c-tinta-suave)`}>No se pudo comprobar la disponibilidad; se valida al crear.</p>;
  }
}

function Error({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 text-[13px] text-(--c-coral-tinta)">
      {children}
    </p>
  );
}
