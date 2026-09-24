import type { Metadata } from "next";
import GaleriaPlantillas from "@/components/celebrar/panel/galeria-plantillas";
import { EncabezadoPanel } from "@/components/celebrar/panel/piezas";
import { catalogoPlantillas, conteosPorCategoria, misCelebraciones } from "@/lib/celebrar/datos";
import { CATEGORIAS_PLANTILLA } from "@/lib/celebrar/marca";

export const metadata: Metadata = { title: "Plantillas" };

/**
 * El catálogo, visto desde el panel: las once categorías como pestañas
 * con sus ~40 diseños cada una, cada uno con su portada de verdad.
 * «Usar» aplica el diseño a una celebración de la persona (o abre el
 * asistente para crearla con la plantilla ya elegida).
 */
export default async function PlantillasApp({ searchParams }: { searchParams: Promise<{ estilo?: string; tipo?: string; ver?: string }> }) {
  const q = await searchParams;
  const categoria = CATEGORIAS_PLANTILLA.some((c) => c.id === q.estilo) ? q.estilo : undefined;
  const tipo = q.tipo && q.tipo !== "todos" ? q.tipo : undefined;
  const ver = Math.min(Math.max(Number(q.ver) || 24, 24), 200);
  const [pagina, conteo, celebraciones] = await Promise.all([
    // Una de más: así se sabe si queda algo para «ver más».
    catalogoPlantillas({ tipo, categoria, limite: ver + 1 }),
    conteosPorCategoria(tipo),
    misCelebraciones(),
  ]);
  const plantillas = pagina.slice(0, ver);
  const total = [...conteo.values()].reduce((a, b) => a + b, 0);
  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo="Plantillas"
        descripcion={`${total} diseños con este filtro —veinte por cada estilo y tipo de celebración—, todos gratis. Elegís uno como punto de partida y lo hacés tuyo en el editor: colores, letras, fondos en movimiento, fotos, música y el orden de las secciones.`}
      />
      <GaleriaPlantillas
        plantillas={plantillas}
        conteo={Object.fromEntries(conteo)}
        categoriaActiva={categoria ?? "todas"}
        tipoActivo={tipo ?? "todos"}
        hayMas={pagina.length > ver}
        categorias={CATEGORIAS_PLANTILLA}
        celebraciones={celebraciones.filter((c) => c.estado !== "archivada").map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, plantilla_id: c.plantilla_id }))}
      />
    </div>
  );
}
