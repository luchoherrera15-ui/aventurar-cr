"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { IconCheck, IconStar } from "@/components/icons";
import { TZ_CR } from "@/lib/fechas";
import BookingBottomSheet from "./booking-bottom-sheet";
import type { ProfesionalPerfil, ResenaPerfil } from "./perfil-tipos";

type Pestana = "informacion" | "resenas";

/** "2026-08-13T..." → "13 ago 2026", en hora de Costa Rica. */
function fechaBonita(fecha: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: TZ_CR,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(fecha));
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA FICHA DE UN PROFESIONAL — INFORMACIÓN / RESEÑAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Lo que se abre al tocar un círculo del equipo en móvil. Monta sobre
 * `BookingBottomSheet`, que ya sabe deslizar, cerrar con el fondo, con
 * Escape y con la ✕ — acá no se reimplementa nada de eso.
 *
 * ── EL BOTÓN DE RESERVAR NO ES DECORADO ─────────────────────────────
 *
 * En móvil los círculos REEMPLAZAN a las tarjetas grandes, y esas
 * tarjetas eran las únicas que traían «Ver disponibilidad» por
 * profesional. Sin ese botón acá, el cambio de diseño le quitaría a
 * quien entra por teléfono la forma de reservar con una persona
 * concreta. Va fijo al pie y visible en las DOS pestañas: quien está
 * leyendo reseñas es justamente el que ya casi decidió.
 *
 * ── LAS RESEÑAS SE FILTRAN POR ID ───────────────────────────────────
 *
 * Por `profesionalId`, no por nombre. Ver `perfil-tipos.ts`: con dos
 * personas del mismo nombre, cruzar por texto le muestra a cada una las
 * reseñas de la otra —con nota incluida— y nadie se entera.
 */
export default function ProfessionalSheet({
  profesional,
  resenas,
  abierta,
  onCerrar,
  onReservar,
}: {
  /** null = no hay ninguno elegido. */
  profesional: ProfesionalPerfil | null;
  /** TODAS las del negocio; acá se filtran las de esta persona. */
  resenas: ResenaPerfil[];
  abierta: boolean;
  onCerrar: () => void;
  onReservar: (servicioId: string | null, miembroId: string | null) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>("informacion");

  /**
   * ⚠️ LA PESTAÑA SE QUEDABA PEGADA DE UNA PERSONA A LA SIGUIENTE.
   *
   * Este componente NUNCA se desmonta: `TeamSection` lo renderiza una
   * sola vez fuera de la lista, y devolver `null` desde el render (el
   * guard de abajo) NO desmonta nada — el estado sobrevive intacto.
   *
   * Entonces: se abre la ficha de Ana, se toca «Reseñas», se cierra, se
   * abre la de Beto... y aparece en «Reseñas». Peor: si Beto no tiene
   * ninguna, lo primero que se lee de él es «todavía no tiene reseñas»,
   * cuando nadie preguntó eso. Su información quedó escondida detrás de
   * una pestaña que eligió otra persona.
   *
   * Se reinicia comparando contra el id previo EN EL RENDER (el patrón
   * oficial de React para derivar estado de una prop). En un efecto
   * llegaría un frame tarde y se vería el parpadeo de la pestaña vieja.
   */
  const [abiertaPrevia, setAbiertaPrevia] = useState(abierta);
  if (abierta !== abiertaPrevia) {
    setAbiertaPrevia(abierta);
    // Al ABRIR, no al cambiar de persona. Primero lo até al id del
    // profesional y NO alcanzaba: un negocio con una sola persona en el
    // equipo —el caso más común, y el de Glow Nails— nunca cambia de
    // id, así que reabrir la misma ficha seguía cayendo en «Reseñas».
    // Se vio midiéndolo en el navegador, no leyendo el código.
    if (abierta) setPestana("informacion");
  }

  const suyas = useMemo(() => {
    if (!profesional) return [];
    return resenas
      .filter((r) => r.profesionalId === profesional.id)
      .slice()
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [resenas, profesional]);

  // El guard mira al profesional y NO a `abierta`: la hoja sigue
  // montada un rato después de cerrarse para poder animar la salida, y
  // si el contenido se fuera en cuanto `abierta` pasa a false, se
  // vaciaría de golpe a mitad del deslizamiento. Quien maneja ese ciclo
  // de vida es BookingBottomSheet.
  if (!profesional) return null;

  const { nombre, rol, foto_url, promedio, totalResenas, serviciosPrincipales, citasAtendidas } =
    profesional;

  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;

  const PESTANAS: { id: Pestana; label: string }[] = [
    { id: "informacion", label: "Información" },
    { id: "resenas", label: totalResenas > 0 ? "Reseñas (" + totalResenas + ")" : "Reseñas" },
  ];

  return (
    <BookingBottomSheet
      abierto={abierta}
      onCerrar={onCerrar}
      // Sin título propio: el encabezado de acá abajo YA dice de quién
      // es la ficha, y con foto. Repetir el nombre arriba en negrita
      // solo gasta alto de pantalla, que en un teléfono es lo caro.
    >
      <div className="flex items-center gap-3.5 pb-4">
        <span className="relative block h-[64px] w-[64px] shrink-0 overflow-hidden rounded-full border border-aventurea-line bg-aventurea-blue-light">
          {foto_url ? (
            <Image src={foto_url} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-aventurea-navy text-[24px] font-extrabold text-white">
              {nombre.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-extrabold leading-tight tracking-[-0.2px] text-aventurea-ink">
            {nombre}
          </h2>
          {rol && (
            <p className="truncate text-[12.5px] font-semibold text-aventurea-ink-soft">{rol}</p>
          )}
          {promedio != null && totalResenas > 0 ? (
            <p className="mt-1 flex items-center gap-1 text-[12.5px] font-bold text-aventurea-ink">
              <IconStar className="h-3.5 w-3.5 text-aventurea-orange" />
              {promedio.toFixed(1).replace(".", ",")}
              <span className="font-semibold text-aventurea-ink-soft">
                ({totalResenas} reseña{totalResenas === 1 ? "" : "s"})
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[12.5px] font-semibold text-aventurea-ink-soft">
              Sin reseñas todavía
            </p>
          )}
        </div>
      </div>

      {/* `role="tablist"` de verdad y no dos botones sueltos: un lector
          de pantalla tiene que poder anunciar «pestaña 2 de 2,
          seleccionada». */}
      <div
        role="tablist"
        aria-label={"Información de " + nombre}
        className="sticky top-0 z-10 -mx-5 flex gap-1 border-b border-aventurea-line bg-white px-5"
      >
        {PESTANAS.map((p) => {
          const activa = pestana === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={"tab-" + p.id}
              aria-selected={activa}
              aria-controls={"panel-" + p.id}
              onClick={() => setPestana(p.id)}
              className={
                "relative -mb-px px-3 pb-2.5 pt-1 text-[13.5px] font-bold transition-colors " +
                (activa
                  ? "text-aventurea-navy"
                  : "text-aventurea-ink-soft hover:text-aventurea-ink")
              }
            >
              {p.label}
              <span
                aria-hidden
                className={
                  "absolute inset-x-2 bottom-0 h-[2.5px] rounded-full transition-colors " +
                  (activa ? "bg-aventurea-navy" : "bg-transparent")
                }
              />
            </button>
          );
        })}
      </div>

      {/* ⚠️ EL ALTO MÍNIMO EVITA QUE LA HOJA SALTE BAJO EL DEDO.
          La hoja se ancla ABAJO y su alto lo decide el contenido. Si
          «Información» es corta y «Reseñas» larga, al tocar una pestaña
          la hoja crece y TODO sube de golpe: las pestañas se van de
          donde estaba el dedo, y el segundo toque cae en otra cosa.
          Con un piso, los cambios chicos no mueven nada. */}
      <div className="min-h-[220px]">
      {pestana === "informacion" ? (
        <div
          id="panel-informacion"
          role="tabpanel"
          aria-labelledby="tab-informacion"
          className="pt-4"
        >
          {serviciosPrincipales.length > 0 && (
            <>
              <h3 className="text-[12.5px] font-extrabold uppercase tracking-[0.4px] text-aventurea-ink-soft">
                Qué hace
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {serviciosPrincipales.map((servicio) => (
                  <span
                    key={servicio}
                    className="rounded-lg bg-aventurea-blue-light px-2.5 py-1 text-[11.5px] font-bold text-aventurea-navy"
                  >
                    {servicio}
                  </span>
                ))}
              </div>
            </>
          )}

          {citasAtendidas > 0 && (
            <p className="mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-aventurea-ink-soft">
              <IconCheck className="h-4 w-4 shrink-0 text-aventurea-orange" />
              {citasAtendidas} cita{citasAtendidas === 1 ? "" : "s"} atendida
              {citasAtendidas === 1 ? "" : "s"} en Bookea
            </p>
          )}

          {/* Que no quede un panel en blanco: si el dueño todavía no le
              asignó servicios y la persona no atendió a nadie, las dos
              secciones de arriba desaparecen y la pestaña se vería
              vacía, como si algo hubiera fallado al cargar. */}
          {serviciosPrincipales.length === 0 && citasAtendidas === 0 && (
            <p className="text-[13px] font-semibold text-aventurea-ink-soft">
              Todavía no hay más detalles de {primerNombre}.
            </p>
          )}
        </div>
      ) : (
        <div id="panel-resenas" role="tabpanel" aria-labelledby="tab-resenas" className="pt-4">
          {suyas.length === 0 ? (
            <p className="text-[13px] font-semibold text-aventurea-ink-soft">
              {primerNombre} todavía no tiene reseñas. Se escriben después de una cita, así que
              aparecen solas con el tiempo.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {suyas.map((r) => (
                <li key={r.id} className="border-b border-aventurea-line pb-4 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5" aria-hidden>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <IconStar
                          key={n}
                          className={
                            "h-3.5 w-3.5 " +
                            (n <= r.calificacion
                              ? "text-aventurea-orange"
                              : "text-aventurea-line")
                          }
                        />
                      ))}
                    </span>
                    <span className="sr-only">{r.calificacion} de 5</span>
                    <span className="text-[11.5px] font-semibold text-aventurea-ink-soft">
                      {fechaBonita(r.fecha)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-extrabold text-aventurea-ink">
                    {r.clienteNombre}
                    {r.servicioNombre && (
                      <span className="font-semibold text-aventurea-ink-soft">
                        {" · "}
                        {r.servicioNombre}
                      </span>
                    )}
                  </p>
                  {r.comentario && (
                    <p className="mt-1 text-[13px] leading-relaxed text-aventurea-ink-soft">
                      {r.comentario}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>

      {/* Pegado al pie del área que scrollea. Con una lista larga de
          reseñas, un botón al final del contenido se pierde: habría que
          leerlas todas para poder reservar. */}
      <div className="sticky bottom-0 -mx-5 mt-5 border-t border-aventurea-line bg-white px-5 pb-1 pt-3">
        <button
          type="button"
          onClick={() => onReservar(null, profesional.id)}
          /* `sky-dark` y no `sky`: blanco sobre #2f7cbe da 4,42:1 y
             AA pide 4,5:1 para texto de 14 px (no cuenta como «grande»
             ni siendo bold — para eso hacen falta 18,66 px). #24638f
             da 6,45:1 y es el mismo azul de la paleta, un tono abajo.
             El hover baja a navy para que siga habiendo respuesta. */
          className="flex h-12 w-full items-center justify-center rounded-xl bg-aventurea-sky-dark text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy"
        >
          Ver disponibilidad
        </button>
      </div>
    </BookingBottomSheet>
  );
}
