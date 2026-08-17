import {
  ESTILOS,
  type ContenidoPoster,
  type EstiloPlantilla,
  type EstiloPoster,
  type TipografiaPoster,
} from "@/lib/lealtad/plantillas-poster";
import MarcasWallet from "./marcas-wallet";

/**
 * LA HOJA. La misma para los seis estilos y para la vista previa en
 * vivo del personalizador.
 *
 * NO lleva "use client" a propósito: así la puede renderizar tanto la
 * página (servidor) como el personalizador (cliente), sin dos copias
 * del mismo JSX. Dos copias es como el póster empezó a decir «sumá
 * sellos» para las gift cards: el texto se arregla en una y la otra
 * sigue mintiendo.
 *
 * Lo que cambia entre estilos es el CSS (`data-estilo`), no esto: acá
 * solo se decide QUÉ bloques existen, nunca dónde caen.
 */

/** Lo del negocio, que no cambia mientras se edita. */
export type DatosHoja = {
  negocio: string;
  logoUrl: string | null;
  /** La banda del pase (0132). Solo la usa el estilo vitrina. */
  bannerUrl: string | null;
  /** El QR ya renderizado como SVG por el servidor. */
  svgQr: string;
  /** null = este tipo de tarjeta no promete una meta. */
  etiquetaMeta: string | null;
  premio: string | null;
};

export default function HojaPoster({
  estilo,
  layout,
  letra,
  contenido,
  variables,
  datos,
}: {
  estilo: EstiloPoster;
  /** El layout que se dibuja. Para el personalizado, su plantilla base. */
  layout: EstiloPlantilla;
  /**
   * La tipografía elegida. Solo la manda el personalizador: los cinco
   * terminados se imprimen con la suya, que es parte del diseño.
   */
  letra?: TipografiaPoster;
  contenido: ContenidoPoster;
  /** Los colores, como variables CSS (`variablesDePoster`). */
  variables: Record<string, string>;
  datos: DatosHoja;
}) {
  const personalizado = estilo === "personalizado";
  // Sale del catálogo y no de un prop: en el personalizador la base
  // cambia en vivo, y quien dibuja tiene que enterarse de que ahora hay
  // (o ya no hay) banda de foto sin que nadie se lo recuerde.
  const usaFoto = ESTILOS[layout].usaFoto;

  return (
    <div
      className="poster-hoja"
      data-estilo={layout}
      // El personalizado se marca aparte para poder desandar lo que la
      // plantilla da por sentado: el minimalista esconde los pasos por
      // CSS, y si el dueño los prende tienen que aparecer igual.
      data-personalizado={personalizado ? "" : undefined}
      // El id de la letra, no su pila: el `font-family` de cada una vive
      // en `poster.css` colgado de este atributo. Ver ahí el porqué.
      data-letra={letra}
      style={variables as React.CSSProperties}
    >
      {usaFoto && (
        <div className="poster-foto">
          {datos.bannerUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- se
               imprime tal cual; next/image no aporta acá. */
            <img src={datos.bannerUrl} alt="" className="poster-foto-img" />
          ) : null}
        </div>
      )}

      <div className="poster-cuerpo">
        <header className="poster-encabezado">
          {datos.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- se
               imprime tal cual; next/image no aporta acá. */
            <img src={datos.logoUrl} alt="" className="poster-logo" />
          ) : null}
          <p className="poster-negocio">{datos.negocio}</p>
        </header>

        <h1 className="poster-titulo">
          {contenido.titulo.split("\n").map((linea, i) => (
            <span key={i} className="poster-linea">
              {linea}
            </span>
          ))}
        </h1>

        <div className="poster-foco">
          <div className="poster-qr" dangerouslySetInnerHTML={{ __html: datos.svgQr }} />
          <p className="poster-escanea">{contenido.invitacion}</p>
        </div>

        {contenido.mostrarPremio && datos.etiquetaMeta && datos.premio && (
          <div className="poster-premio">
            <span className="poster-premio-etiqueta">{datos.etiquetaMeta}</span>
            <span className="poster-premio-nombre">{datos.premio}</span>
          </div>
        )}

        {contenido.mostrarPasos && (
          <ol className="poster-pasos">
            {contenido.pasos.map((paso, i) => (
              <li key={i}>
                <span className="poster-num">{i + 1}</span>
                {paso}
              </li>
            ))}
          </ol>
        )}

        {/* Las insignias van SIEMPRE, aunque el pie se apague: son la
            respuesta a «¿me va a funcionar en mi teléfono?», que es la
            duda que frena a la mitad de los que miran el afiche. */}
        <footer className="poster-cierre">
          <MarcasWallet />
          {contenido.mostrarPie && <p className="poster-pie">Sin apps que instalar</p>}
        </footer>
      </div>

      {/* La marca, anclada a la hoja y no al pie. Va afuera de
          `.poster-cuerpo` a propósito: absoluta no gasta alto, y cada
          estilo del cartel tiene su presupuesto de 141.4cqw contado a
          mano. Además así no desaparece cuando el dueño apaga el pie —
          la atribución no debería depender de una opción de diseño. */}
      <span className="poster-marca">Powered by Bookea.lat</span>
    </div>
  );
}
