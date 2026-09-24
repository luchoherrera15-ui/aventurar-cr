import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EditorInvitacion from "@/components/celebrar/editor/editor-invitacion";
import ElegirPlantilla from "@/components/celebrar/editor/elegir-plantilla";
import MarcaCelebrar from "@/components/celebrar/marca-celebrar";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { celebracionPorId, conteosPorCategoria, invitacionDe, plantillasParaTipo, saldoCreditos } from "@/lib/celebrar/datos";
import { CATEGORIAS_PLANTILLA } from "@/lib/celebrar/marca";
import { fechaLargaCR } from "@/lib/fechas";
import { tipoCelebracion } from "@/lib/celebrar/marca";
import { urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { normalizarDocumento } from "@/lib/celebrar/invitacion/esquema";
import { partnerAprobado } from "@/lib/celebrar/partners";
import { rutaEditor, rutaFicha } from "@/lib/celebrar/rutas";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await celebracionPorId(id);
  return { title: c ? `Editor · ${c.nombre}` : "Editor" };
}

const SALUDO_POR_TIPO: Record<string, string> = {
  boda: "Nos casamos",
  cumpleanos: "¡Estás invitado!",
  xv: "Mis quince años",
  baby_shower: "Baby shower",
  bautizo: "Mi bautizo",
  graduacion: "Graduación",
  aniversario: "Nuestro aniversario",
  despedida: "Despedida",
  fiesta: "¡Fiesta!",
  corporativo: "Invitación",
  otro: "Te invitamos",
};

/** Lo que dice el editor al volver de pagar la invitación (ver /app/pago). */
const AVISO_PAGO: Record<string, string> = {
  ok: "¡Pago recibido y publicada! Tu link ya está activo.",
  pendiente: "Recibimos tu pago y lo estamos confirmando. En un minuto tocá Publicar: ya no se cobra de nuevo.",
  cancelado: "No se hizo ningún cobro. Cuando quieras, tocá Publicar.",
  error: "No encontramos ese pago en tu cuenta. Si se cobró, escribinos con el comprobante y lo resolvemos.",
};

/**
 * /celebrar/editor/<id>. Sin documento todavía (o con `?plantillas=1`),
 * muestra el paso 3: elegir plantilla o crear con IA. Con documento,
 * el editor en vivo.
 */
export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plantillas?: string; estilo?: string; pago?: string }>;
}) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const { plantillas } = q;
  const c = await celebracionPorId(id);
  if (!c) notFound();
  const inv = await invitacionDe(c.id);

  if (!inv || plantillas === "1") {
    const estilo = CATEGORIAS_PLANTILLA.some((x) => x.id === q.estilo) ? q.estilo : undefined;
    const [catalogo, conteo] = await Promise.all([plantillasParaTipo(c.tipo, estilo), conteosPorCategoria(c.tipo)]);
    return (
      <div className="min-h-screen bg-(--c-hielo)">
        <header className="sticky top-0 z-30 border-b border-(--c-linea) bg-(--c-blanco)">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <EnlaceCelebrar a={inv ? rutaEditor(c.id) : rutaFicha(c.id)} className="c-montserrat flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-(--c-tinta-suave) hover:text-(--c-tinta)">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {inv ? "Volver al editor" : "Volver"}
              </EnlaceCelebrar>
              <MarcaCelebrar tamano="sm" />
            </div>
            <p className="c-montserrat truncate text-[14px] font-semibold text-(--c-tinta)">{c.nombre}</p>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <p className="c-pastilla">Paso 3 de 7</p>
          <h1 className="mt-3 text-[clamp(1.6rem,2.6vw,2.1rem)] leading-[1.15] text-(--c-tinta)">Elegí el diseño</h1>
        </div>
        <ElegirPlantilla
          celebracionId={c.id}
          nombre={c.nombre}
          saludo={SALUDO_POR_TIPO[c.tipo] ?? "Te invitamos"}
          plantillas={catalogo}
          conteo={Object.fromEntries(conteo)}
          categoriaActiva={estilo ?? "todas"}
          tieneDocumento={!!inv}
          saldo={await saldoCreditos()}
          datosIA={{
            quien: c.nombre,
            tipo: tipoCelebracion(c.tipo)?.nombre ?? c.tipo,
            fecha: c.fecha ? fechaLargaCR(c.fecha) : "",
            hora: c.hora ? c.hora.slice(0, 5) : "",
            lugar: [c.lugar_nombre, c.direccion].filter(Boolean).join(", "),
          }}
        />
      </div>
    );
  }

  const partner = await partnerAprobado();
  return (
    <EditorInvitacion
      celebracion={c}
      documentoInicial={normalizarDocumento(inv.contenido)}
      urlPublica={urlPublicaCelebrar(`/${c.slug}`)}
      esPartner={!!partner}
      avisoPago={AVISO_PAGO[q.pago ?? ""] ?? null}
    />
  );
}
