import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { paginaPublica, mesaDeBusqueda } from "@/lib/solutions/datos";
import VistaPagina from "@/components/solutions/vista-pagina";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";

/**
 * /s/<slug> — LA PÁGINA PÚBLICA DE UN NEGOCIO DE SOLUTIONS.
 *
 * Esta pantalla ya no dibuja: resuelve los datos y se los pasa a
 * `VistaPagina`, el MISMO componente que pinta la vista previa del
 * panel y los mockups de la landing. Cuando el dueño acomoda su página
 * y ve cómo queda, está mirando este render, no una imitación.
 *
 * `?mesa=N` viene del QR de la mesa y se propaga al menú: es lo que
 * hace que la comanda sepa de dónde salió sin reimprimir nada.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await paginaPublica(slug);
  if (!datos) return { title: "Página no encontrada" };
  return {
    title: datos.negocio.nombre,
    description: datos.negocio.bajada || `${datos.negocio.nombre} en Bookea.`,
    openGraph: datos.negocio.foto_portada_url
      ? { images: [datos.negocio.foto_portada_url] }
      : undefined,
  };
}

export default async function PaginaSolutions({ params, searchParams }: Props) {
  const { slug } = await params;
  const busqueda = await searchParams;
  const datos = await paginaPublica(slug);
  if (!datos) notFound();

  const { negocio, links, menu } = datos;
  const mesa = mesaDeBusqueda(busqueda.mesa, negocio.mesas);
  const sufijoMesa = mesa ? `?mesa=${mesa}` : "";

  return (
    /* Las variables de las seis caras se declaran acá; `VistaPagina`
       elige cuál aplica. Van en el <main> y no en el layout raíz para
       que el resto del sitio no cargue el CSS de fuentes que no usa. */
    <main className={`min-h-svh ${CLASES_FUENTES}`}>
      <VistaPagina
        datos={{
          nombre: negocio.nombre,
          bajada: negocio.bajada,
          logoUrl: negocio.logo_url,
          fotoPortadaUrl: negocio.foto_portada_url,
          whatsapp: negocio.whatsapp,
          direccion: negocio.direccion,
          colorFondo: negocio.color_fondo,
          colorAcento: negocio.color_acento,
          tema: negocio.tema,
          estiloLinks: negocio.estilo_links,
          redondeo: negocio.redondeo,
          fuente: negocio.fuente,
          estiloPortada: negocio.estilo_portada,
          efecto: negocio.efecto,
          links: links.map((l) => ({
            id: l.id,
            etiqueta: l.etiqueta,
            url: l.url,
            icono: l.icono,
            fondoUrl: l.fondo_url,
          })),
          seccionesMenu: menu.map((g) => g.seccion?.nombre ?? "Otros"),
          hayMenu: negocio.mostrar_menu && menu.length > 0,
          aceptaPedidos: negocio.acepta_pedidos,
          mesa,
          hrefMenu: `/s/${negocio.slug}/menu${sufijoMesa}`,
        }}
        className="min-h-svh"
      />
    </main>
  );
}
