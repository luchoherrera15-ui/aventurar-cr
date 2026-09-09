import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { paginaPublica, mesaDeBusqueda } from "@/lib/solutions/datos";
import { urlDelNegocio } from "@/lib/solutions/tipos";
import { vocabDe } from "@/lib/solutions/rubros";
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
  // Lo que se ve al COMPARTIR este link (dueño, 6 sep 2026): el negocio
  // con su marca, no Bookea. `title.absolute` esquiva el «| Bookea» del
  // layout; el `openGraph` propio le gana al del sitio. La imagen la
  // dibuja `opengraph-image.tsx` de esta carpeta con la portada, el
  // logo y los colores del negocio.
  const v = vocabDe(datos.negocio.rubro);
  const titulo = datos.negocio.nombre;
  const descripcion =
    datos.negocio.bajada ||
    (datos.addons.menu && datos.menu.length > 0
      ? `${v.catalogo}, enlaces y contacto de ${datos.negocio.nombre}, en un solo lugar.`
      : `Los enlaces y el contacto de ${datos.negocio.nombre}, en un solo lugar.`);
  return {
    title: { absolute: titulo },
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      url: urlDelNegocio(datos.negocio),
      siteName: datos.negocio.nombre,
      type: "website",
      locale: "es_CR",
    },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}

export default async function PaginaSolutions({ params, searchParams }: Props) {
  const { slug } = await params;
  const busqueda = await searchParams;
  const datos = await paginaPublica(slug);
  if (!datos) notFound();

  const { negocio, links, menu, addons } = datos;
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
            formato: l.formato,
            descripcion: l.descripcion,
          })),
          seccionesMenu: menu.map((g) => g.seccion?.nombre ?? "Otros"),
          // El menú es un add-on (0233): sin él no hay puerta, tenga o no platos.
          hayMenu: addons.menu && negocio.mostrar_menu && menu.length > 0,
          aceptaPedidos: negocio.acepta_pedidos,
          mesa,
          hrefMenu: `/s/${negocio.slug}/menu${sufijoMesa}`,
          // 0236: el diseño fino, la moneda, el país, el rubro y la vitrina.
          diseno: negocio.diseno,
          moneda: negocio.moneda,
          pais: negocio.pais,
          rubro: negocio.rubro,
        }}
        className="min-h-svh"
      />
    </main>
  );
}
