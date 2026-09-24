import type { Metadata } from "next";
import { EncabezadoPanel, EstadoVacio, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { EnlaceCelebrar, EnlacePlanoCelebrar } from "@/components/celebrar/rutas-cliente";
import { confirmacionesDe, conteoConfirmaciones, invitacionDe, misCelebraciones } from "@/lib/celebrar/datos";
import { normalizarDocumento } from "@/lib/celebrar/invitacion/esquema";
import { RUTA, rutaEditor } from "@/lib/celebrar/rutas";
import { fechaLargaCR } from "@/lib/fechas";
import BotonCopiar from "@/components/boton-copiar";
import { urlPublicaCelebrar } from "@/lib/celebrar/dominios";

export const metadata: Metadata = { title: "Invitados" };

/**
 * EL PANEL DE LA CELEBRACIÓN: lo que la invitación recibe, en un solo
 * lugar. Se elige la celebración arriba y se ve quién confirmó, cuántas
 * personas vienen, quién no puede, y las respuestas a las preguntas que
 * el anfitrión configuró en la invitación (alergias, transporte…).
 * Cuando existan los álbumes y demás add-ons, se administran desde acá.
 */
export default async function InvitadosPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: elegida } = await searchParams;
  const [celebraciones, conteos] = await Promise.all([misCelebraciones(), conteoConfirmaciones()]);
  const activas = celebraciones.filter((c) => c.estado !== "archivada");

  if (activas.length === 0) {
    return (
      <div className="grid gap-8">
        <EncabezadoPanel titulo="Invitados" descripcion="Acá llegan las confirmaciones de tu invitación, con las preguntas que vos configurés." />
        <EstadoVacio titulo="Todavía no tenés celebraciones" texto="Creá la primera: cuando publiqués la invitación con confirmación en la página, las respuestas aparecen acá." />
      </div>
    );
  }

  const celebracion = activas.find((c) => c.id === elegida) ?? activas.find((c) => c.estado === "publicada") ?? activas[0];
  const [confirmaciones, inv] = await Promise.all([confirmacionesDe(celebracion.id), invitacionDe(celebracion.id)]);
  const doc = inv ? normalizarDocumento(inv.contenido) : null;
  const rsvp = doc?.secciones.find((s) => s.tipo === "rsvp");
  const preguntas = rsvp && rsvp.tipo === "rsvp" ? rsvp.datos.preguntas : [];
  const modo = rsvp && rsvp.tipo === "rsvp" ? rsvp.datos.modo : "whatsapp";
  const pedirContacto = rsvp && rsvp.tipo === "rsvp" ? rsvp.datos.pedirContacto : false;

  const asisten = confirmaciones.filter((x) => x.asiste);
  const noAsisten = confirmaciones.filter((x) => !x.asiste);
  const personas = asisten.reduce((n, x) => n + x.personas, 0);
  const urlPublica = urlPublicaCelebrar(`/${celebracion.slug}`);

  return (
    <div className="grid gap-8">
      <EncabezadoPanel titulo="Invitados" descripcion="Lo que responde la gente en tu invitación, en vivo. Elegí la celebración y mirá quién viene." />

      {/* La celebración */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Celebración">
        <div className="flex w-max gap-2">
          {activas.map((c) => {
            const n = conteos[c.id];
            const activa = c.id === celebracion.id;
            return (
              <EnlaceCelebrar
                key={c.id}
                a={`${RUTA.appInvitados}?c=${c.id}`}
                role="tab"
                aria-selected={activa}
                className={`c-montserrat inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${activa ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}
              >
                {c.nombre}
                {n && n.confirmados > 0 && <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${activa ? "bg-(--c-blanco)/15" : "bg-(--c-hielo)"}`}>{n.confirmados}</span>}
              </EnlaceCelebrar>
            );
          })}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaPanel tono="marina">
          <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-sobre-marino-suave)">Confirmaron</p>
          <p className="c-montserrat mt-2 text-4xl font-extrabold leading-none text-(--c-blanco)">{asisten.length}</p>
          <p className="mt-2 text-[13px] text-(--c-sobre-marino-suave)">{personas} {personas === 1 ? "persona" : "personas"} en total</p>
        </TarjetaPanel>
        <TarjetaPanel>
          <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">No pueden ir</p>
          <p className="c-montserrat mt-2 text-4xl font-extrabold leading-none text-(--c-tinta)">{noAsisten.length}</p>
          <p className="mt-2 text-[13px] text-(--c-tinta-suave)">avisaron que no llegan</p>
        </TarjetaPanel>
        <TarjetaPanel>
          <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">La invitación</p>
          <p className="mt-2 text-[14px] leading-snug text-(--c-tinta)">
            {celebracion.estado === "publicada" ? "Publicada" : "Todavía en borrador"} ·{" "}
            {modo === "panel" ? "confirman en la página" : "confirman por WhatsApp"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {celebracion.estado === "publicada" && <BotonCopiar texto={urlPublica} etiqueta="Copiar link" className="c-boton c-boton-secundario min-h-9 text-[12px]" />}
            <EnlaceCelebrar a={rutaEditor(celebracion.id)} className="c-boton c-boton-secundario min-h-9 text-[12px]">
              {modo === "panel" ? "Editar preguntas" : "Activar confirmación en la página"}
            </EnlaceCelebrar>
          </div>
        </TarjetaPanel>
      </div>

      {/* La lista */}
      <TarjetaPanel className="overflow-hidden !p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--c-linea) px-6 py-4">
          <div>
            <h2 className="text-xl leading-tight text-(--c-tinta)">Confirmaciones</h2>
            <p className="mt-0.5 text-[13px] text-(--c-tinta-suave)">
              {confirmaciones.length === 0 ? "Todavía no hay respuestas." : `${confirmaciones.length} ${confirmaciones.length === 1 ? "respuesta" : "respuestas"}, la más reciente primero.`}
            </p>
          </div>
          {confirmaciones.length > 0 && (
            <EnlacePlanoCelebrar a={`${RUTA.appInvitados}/csv?c=${celebracion.id}`} className="c-boton c-boton-secundario min-h-9 text-[12px]" download>
              Descargar CSV
            </EnlacePlanoCelebrar>
          )}
        </div>
        {confirmaciones.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-[14px] leading-relaxed text-(--c-tinta-suave)">
              {modo === "panel"
                ? celebracion.estado === "publicada"
                  ? "Compartí el link: cada confirmación aparece acá al instante."
                  : "Publicá la invitación para empezar a recibir confirmaciones."
                : "Con la confirmación por WhatsApp las respuestas te llegan al teléfono. Si querés verlas acá, activá la confirmación en la página desde el editor."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-(--c-hielo) text-(--c-tinta-suave)">
                <tr>
                  <th className="c-montserrat px-4 py-3 font-semibold">Nombre</th>
                  <th className="c-montserrat px-4 py-3 font-semibold">Asiste</th>
                  <th className="c-montserrat px-4 py-3 font-semibold">Personas</th>
                  {preguntas.map((q) => (
                    <th key={q.id} className="c-montserrat px-4 py-3 font-semibold">
                      {q.etiqueta}
                    </th>
                  ))}
                  {pedirContacto && <th className="c-montserrat px-4 py-3 font-semibold">Contacto</th>}
                  <th className="c-montserrat px-4 py-3 font-semibold">Mensaje</th>
                  <th className="c-montserrat px-4 py-3 font-semibold">Cuándo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--c-linea) text-(--c-tinta)">
                {confirmaciones.map((x) => (
                  <tr key={x.id} className={x.asiste ? "" : "text-(--c-tinta-suave)"}>
                    <td className="px-4 py-3 font-semibold">{x.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={x.asiste ? "c-pastilla c-pastilla-ok" : "c-pastilla"}>{x.asiste ? "Sí" : "No"}</span>
                    </td>
                    <td className="px-4 py-3">{x.asiste ? x.personas : "—"}</td>
                    {preguntas.map((q) => (
                      <td key={q.id} className="px-4 py-3">
                        {x.respuestas[q.id] ?? "—"}
                      </td>
                    ))}
                    {pedirContacto && <td className="px-4 py-3">{x.contacto ?? "—"}</td>}
                    <td className="max-w-[260px] px-4 py-3 text-(--c-tinta-suave)">{x.mensaje ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-(--c-tinta-suave)">
                      {fechaLargaCR(x.created_at.slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TarjetaPanel>

      <p className="text-[13px] leading-relaxed text-(--c-tinta-suave)">
        Cuando estén los álbumes y los demás complementos de la celebración, también se administran desde acá.
      </p>
    </div>
  );
}
