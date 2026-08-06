"use client";

import { useMemo, useState } from "react";
import BotonCopiar from "@/components/boton-copiar";
import BotonBorrarRsvp from "./boton-borrar-rsvp";

export type RsvpFila = {
  id: string;
  nombre: string;
  acompanantes: number;
  asistira: boolean;
  mensaje: string | null;
  correo?: string | null;
  respuestas?: Record<string, string> | null;
  created_at: string;
};

export type PreguntaEtiqueta = { id: string; etiqueta: string };

/**
 * La lista de confirmaciones como TABLA de control (pedido del dueño):
 * una fila por invitación, numerada, con su estado y cuántas personas
 * trae — y el total al pie, que es el número que se le pasa al salón y
 * al catering.
 *
 * Reemplaza las dos listas separadas ("Sí asistirán" / "No podrán ir"):
 * con 40 invitados había que sumar a ojo entre dos bloques para saber
 * cuánta gente iba a llegar.
 *
 * Los datos que no entran en una fila de tabla (el correo, el mensaje,
 * las respuestas a las preguntas propias) no se pierden: se abren al
 * tocar la fila. Y `window.print()` con estilos de impresión saca el
 * PDF sin traer ninguna librería.
 */

type Filtro = "todas" | "asistiran" | "no";

/** Cuánta gente trae esa confirmación (la persona + sus acompañantes). */
function personasDe(r: RsvpFila): number {
  return r.asistira ? 1 + (r.acompanantes ?? 0) : 0;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function TablaRsvps({
  rsvps,
  preguntas,
  invitacionId,
  nombreEvento,
}: {
  rsvps: RsvpFila[];
  preguntas: PreguntaEtiqueta[];
  invitacionId: string;
  nombreEvento: string;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  const asistiran = rsvps.filter((r) => r.asistira);
  const noVienen = rsvps.filter((r) => !r.asistira);
  const totalPersonas = asistiran.reduce((s, r) => s + personasDe(r), 0);

  const visibles = useMemo(() => {
    const term = normalizar(busqueda.trim());
    return rsvps
      .filter((r) =>
        filtro === "asistiran" ? r.asistira : filtro === "no" ? !r.asistira : true,
      )
      .filter((r) => (term ? normalizar(r.nombre).includes(term) : true));
  }, [rsvps, filtro, busqueda]);

  // El total del pie sigue a lo que se está viendo: filtrar por
  // "asistirán" y que el total contara a todos sería engañoso.
  const totalVisible = visibles.reduce((s, r) => s + personasDe(r), 0);

  const correosVisibles = visibles
    .map((r) => r.correo)
    .filter((c): c is string => !!c)
    .join(", ");

  const etiquetaDe = new Map(preguntas.map((p) => [p.id, p.etiqueta]));

  const chip = (activo: boolean) =>
    `flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
      activo
        ? "border-aventurea-navy bg-aventurea-navy text-white"
        : "border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-navy/40"
    }`;

  return (
    <div className="tabla-rsvps mt-5">
      {/* El título solo sale en el papel: en pantalla ya está arriba. */}
      <p className="solo-imprimir mb-2 text-[15px] font-bold text-aventurea-ink">
        {nombreEvento} — lista de confirmaciones
      </p>

      {/* Los chips: son resumen Y filtro a la vez. */}
      <div className="chips-resumen flex flex-wrap gap-2">
        <button type="button" onClick={() => setFiltro("todas")} className={chip(filtro === "todas")}>
          <span className="text-[15px] font-extrabold tabular-nums">{rsvps.length}</span>
          Invitaciones
        </button>
        <button
          type="button"
          onClick={() => setFiltro("asistiran")}
          className={chip(filtro === "asistiran")}
        >
          <span className="text-[15px] font-extrabold tabular-nums text-aventurea-green">
            {asistiran.length}
          </span>
          Asistirán
        </button>
        <button type="button" onClick={() => setFiltro("no")} className={chip(filtro === "no")}>
          <span className="text-[15px] font-extrabold tabular-nums text-red-600">
            {noVienen.length}
          </span>
          No asistirán
        </button>
        <span className="flex items-center gap-2 rounded-xl border border-aventurea-sky/40 bg-aventurea-sky/10 px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink">
          <span className="text-[15px] font-extrabold tabular-nums text-aventurea-sky-dark">
            {totalPersonas}
          </span>
          Personas
        </span>
      </div>

      {/* Buscar, copiar correos e imprimir */}
      <div className="sin-imprimir mt-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="min-w-[200px] flex-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500"
        />
        {correosVisibles && <BotonCopiar texto={correosVisibles} etiqueta="Copiar correos" />}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
        >
          Imprimir / PDF
        </button>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-aventurea-line p-5 text-center text-[13px] text-aventurea-ink-soft">
          {rsvps.length === 0
            ? "Todavía nadie ha confirmado. Compartí el link de arriba y acá van a ir apareciendo."
            : "Ninguna confirmación coincide con lo que buscaste."}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-aventurea-line">
          {/* En el teléfono la tabla se aprieta (el "#" se va, la
              insignia queda en ✓/✕) para que la columna de personas y
              el total del pie quepan sin arrastrar a los lados. */}
          <table className="w-full min-w-[300px] border-collapse text-left sm:min-w-[520px]">
            <thead>
              <tr className="bg-aventurea-cream-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                <th className="hidden w-10 px-3 py-2.5 text-center sm:table-cell">#</th>
                <th className="px-2.5 py-2.5 sm:px-3">Nombre</th>
                <th className="px-2.5 py-2.5 sm:px-3">
                  <span className="hidden sm:inline">Asistencia</span>
                  <span className="sm:hidden">Va</span>
                </th>
                <th className="px-2.5 py-2.5 text-right sm:px-3">
                  <span className="hidden sm:inline">Personas</span>
                  <span className="sm:hidden">Pers.</span>
                </th>
                <th className="sin-imprimir w-10 px-1 py-2.5 sm:px-3" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((r, i) => {
                const respuestas = Object.entries(r.respuestas ?? {});
                const tieneDetalle = !!(r.correo || r.mensaje || respuestas.length > 0);
                const estaAbierta = abierta === r.id;
                return (
                  <tr key={r.id} className="border-t border-aventurea-line align-top">
                    <td className="hidden px-3 py-2.5 text-center text-[12px] font-bold tabular-nums text-aventurea-ink-soft sm:table-cell">
                      {i + 1}
                    </td>
                    <td className="px-2.5 py-2.5 sm:px-3">
                      <button
                        type="button"
                        onClick={() => tieneDetalle && setAbierta(estaAbierta ? null : r.id)}
                        className={`text-left text-[13.5px] font-bold text-aventurea-ink ${
                          tieneDetalle ? "hover:underline" : "cursor-default"
                        }`}
                      >
                        {r.nombre}
                        {tieneDetalle && (
                          <span className="sin-imprimir ml-1.5 text-[11px] font-normal text-aventurea-ink-soft">
                            {estaAbierta ? "▴" : "▾"}
                          </span>
                        )}
                      </button>

                      {/* El detalle que no cabe en una columna. */}
                      {estaAbierta && (
                        <div className="mt-1.5 flex flex-col gap-1 text-[12.5px] text-aventurea-ink-soft">
                          {r.correo && (
                            <a
                              href={`mailto:${r.correo}`}
                              className="w-fit font-semibold text-aventurea-navy hover:underline"
                            >
                              {r.correo}
                            </a>
                          )}
                          {respuestas.length > 0 && (
                            <p>
                              {respuestas.map(([pid, valor], idx) => (
                                <span key={pid}>
                                  {idx > 0 && " · "}
                                  <span className="font-semibold text-aventurea-ink">
                                    {etiquetaDe.get(pid) ?? pid}:
                                  </span>{" "}
                                  {valor}
                                </span>
                              ))}
                            </p>
                          )}
                          {r.mensaje && <p className="italic">“{r.mensaje}”</p>}
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 sm:px-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide sm:px-2.5 ${
                          r.asistira
                            ? "bg-aventurea-green-light text-aventurea-green"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        <span className="hidden sm:inline">
                          {r.asistira ? "✓ Asistirá" : "✕ No asistirá"}
                        </span>
                        <span className="sm:hidden">{r.asistira ? "✓ Sí" : "✕ No"}</span>
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 text-right text-[13.5px] font-bold tabular-nums text-aventurea-ink sm:px-3">
                      {r.asistira ? personasDe(r) : "—"}
                    </td>
                    <td className="sin-imprimir px-1 py-2.5 sm:px-3">
                      <BotonBorrarRsvp
                        rsvpId={r.id}
                        invitacionId={invitacionId}
                        nombre={r.nombre}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* El total, que es para lo que se mira esta tabla. */}
            <tfoot>
              <tr className="border-t-2 border-aventurea-navy/20 bg-aventurea-cream-2">
                <td className="hidden sm:table-cell" />
                <td
                  colSpan={2}
                  className="px-2.5 py-3 text-[12.5px] font-bold text-aventurea-ink sm:px-3 sm:text-[13px]"
                >
                  Total de invitados que asistirán
                </td>
                <td className="px-2.5 py-3 text-right text-[17px] font-extrabold tabular-nums text-aventurea-ink sm:px-3">
                  {totalVisible}
                </td>
                <td className="sin-imprimir" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-2 text-[12px] leading-relaxed text-aventurea-ink-soft">
        El total cuenta a cada confirmado con sus acompañantes — es el número que le podés
        dar al catering y al lugar.
      </p>
    </div>
  );
}
