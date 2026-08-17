import { urlSitio } from "@/lib/sitio";

/**
 * QUIÉN ES BOOKEA, EN EL IDIOMA QUE LEEN LOS BUSCADORES.
 *
 * Vivía dentro de `src/app/eventos/page.tsx`, que era a la vez el
 * directorio y —por rebote— la portada del sitio. Salió de ahí el día
 * que esas dos cosas se separaron.
 *
 * POR QUÉ TIENE QUE VIVIR APARTE, Y NO ES ORDEN POR ORDEN
 * ------------------------------------------------------------------
 * Allá adentro, estos datos se armaban con la MISMA constante que el
 * canónico del directorio. Mientras la portada y el directorio fueron
 * la misma página eso no se notaba, porque las dos valían `/`. Pero al
 * mudar el canónico del directorio a `/eventos`, la organización se
 * habría mudado con él: Bookea le estaría diciendo a Google que la
 * EMPRESA vive en `bookea.lat/eventos`, que es una sección.
 *
 * La organización y el sitio son siempre la RAÍZ, pase lo que pase con
 * el canónico de cualquier pantalla. Por eso `SITIO` se calcula acá y
 * no se recibe de afuera: separar los dos valores fue justamente el
 * arreglo.
 *
 * DÓNDE SE MONTA: en la portada y en ninguna otra parte. La
 * recomendación de Google es declarar la organización UNA vez, en la
 * portada — no repetida en cada pantalla del panel.
 *
 * Deliberadamente corto: nombre, logo, país e idioma. Los datos que no
 * se pueden sostener (teléfono, dirección física, redes) no se
 * inventan: un dato estructurado que no calza con lo que dice la
 * página vale menos que ninguno.
 */
const SITIO = urlSitio("/");

export const DATOS_ORGANIZACION = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITIO}#organizacion`,
      name: "Bookea",
      url: SITIO,
      logo: urlSitio("/logo-bookea-v3.png"),
      areaServed: { "@type": "Country", name: "Costa Rica" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITIO}#sitio`,
      name: "Bookea",
      url: SITIO,
      inLanguage: "es-CR",
      publisher: { "@id": `${SITIO}#organizacion` },
    },
  ],
};
