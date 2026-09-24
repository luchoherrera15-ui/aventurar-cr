import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BarraDemo from "@/components/celebrar/barra-demo";
import RenderInvitacion from "@/components/celebrar/invitacion/render-invitacion";
import { DEMOS, demoPorId } from "@/lib/celebrar/demos";
import { APERTURAS, type Apertura } from "@/lib/celebrar/invitacion/esquema";

export function generateStaticParams() {
  return DEMOS.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = demoPorId(id);
  return { title: d ? `Demo · ${d.etiqueta}` : "Demo" };
}

/**
 * Una invitación de muestra a pantalla completa, tal como la recibiría
 * un invitado: escenas, música, formulario de confirmación (que acá no
 * guarda nada). Con la barra flotante para volver o crear la propia.
 */
export default async function DemoInvitacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ apertura?: string }>;
}) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const d = demoPorId(id);
  if (!d) notFound();
  // `?apertura=` prueba cualquiera de las 45 sobre esta misma demo: sirve
  // para elegir una sin tener que crear una celebración.
  const forzada = APERTURAS.includes(q.apertura as Apertura) ? (q.apertura as Apertura) : null;
  const documento = forzada ? { ...d.documento, estilo: { ...d.documento.estilo, apertura: forzada } } : d.documento;
  return (
    <div className="relative min-h-screen">
      <RenderInvitacion documento={documento} celebracion={d.celebracion} modo="demo" className="min-h-screen" escenario apertura />
      <BarraDemo texto={`Demo · ${d.etiqueta}`} />
    </div>
  );
}
