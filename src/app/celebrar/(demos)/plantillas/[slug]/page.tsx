import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BarraDemo from "@/components/celebrar/barra-demo";
import RenderInvitacion from "@/components/celebrar/invitacion/render-invitacion";
import { plantillaPorSlug } from "@/lib/celebrar/datos";
import { normalizarDocumento } from "@/lib/celebrar/invitacion/esquema";
import { rellenarConCelebracion } from "@/lib/celebrar/invitacion/rellenar";
import { celebracionDeMuestra, NOMBRE_MUESTRA, SALUDO_MUESTRA } from "@/lib/celebrar/muestras";
import { tipoCelebracion } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await plantillaPorSlug(slug);
  return { title: p ? `Vista previa · ${p.nombre}` : "Vista previa", robots: { index: false } };
}

/**
 * LA PLANTILLA COMPLETA, ANTES DE USARLA. Las tarjetas del catálogo solo
 * muestran la portada; acá se ve la invitación entera —con su apertura,
 * sus escenas, su programa y su formulario de confirmación— llena con
 * datos de muestra. Nada se guarda: la barra de abajo vuelve al catálogo
 * o arranca una celebración con este diseño.
 */
export default async function PreviaPlantillaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const plantilla = await plantillaPorSlug(slug);
  if (!plantilla) notFound();

  const tipo = tipoCelebracion(plantilla.tipos_evento[0] ?? "")?.id ?? "otro";
  const celebracion = celebracionDeMuestra(tipo);
  const base = normalizarDocumento(plantilla.esquema);
  // El saludo y el nombre de muestra, como en las tarjetas del catálogo.
  const documento = rellenarConCelebracion(
    {
      ...base,
      secciones: base.secciones.map((s, i) =>
        i === 0 && s.tipo === "hero"
          ? { ...s, datos: { ...s.datos, saludo: s.datos.saludo || SALUDO_MUESTRA[tipo] || "Te invitamos", titulo: NOMBRE_MUESTRA[tipo] ?? celebracion.nombre } }
          : s,
      ),
    },
    { tipo, nombre: celebracion.nombre, fecha: celebracion.fecha, hora: celebracion.hora, lugarNombre: celebracion.lugarNombre, direccion: celebracion.direccion, mapsUrl: "" },
  );
  return (
    <div className="relative min-h-screen">
      <RenderInvitacion documento={documento} celebracion={celebracion} modo="demo" className="min-h-screen" escenario apertura />
      <BarraDemo
        texto={`Vista previa · ${plantilla.nombre}`}
        cta="Usar este diseño"
        ctaA={`${RUTA.appCrear}?tipo=${tipo}&plantilla=${plantilla.slug}`}
        volver="Volver al catálogo"
        volverA={`${RUTA.appPlantillas}?tipo=${tipo}&estilo=${plantilla.categoria_id}`}
      />
    </div>
  );
}
