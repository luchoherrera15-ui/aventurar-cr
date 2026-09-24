import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RenderInvitacion from "@/components/celebrar/invitacion/render-invitacion";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { celebracionPorId, invitacionDe } from "@/lib/celebrar/datos";
import { normalizarDocumento } from "@/lib/celebrar/invitacion/esquema";
import { rutaEditor } from "@/lib/celebrar/rutas";

export const metadata: Metadata = { title: "Vista previa", robots: { index: false } };

/**
 * La invitación a pantalla completa, tal como la verán los invitados,
 * pero solo para su dueña (RLS) y aunque esté en borrador. Una barra
 * flotante vuelve al editor.
 */
export default async function PreviaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, inv] = await Promise.all([celebracionPorId(id), invitacionDe(id)]);
  if (!c || !inv) notFound();
  return (
    <div className="relative min-h-screen">
      <RenderInvitacion
        documento={normalizarDocumento(inv.contenido)}
        celebracion={{ nombre: c.nombre, fecha: c.fecha, hora: c.hora, lugarNombre: c.lugar_nombre, direccion: c.direccion, mapsUrl: c.maps_url }}
        className="min-h-screen"
        escenario
        apertura
      />
      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <EnlaceCelebrar a={rutaEditor(c.id)} className="c-boton c-boton-primario shadow-flotante">
          Volver al editor
        </EnlaceCelebrar>
      </div>
    </div>
  );
}
