/**
 * ============================================================
 * LA DIRECCIÓN OFICIAL DEL SITIO
 * ============================================================
 *
 * Un solo origen para todo lo que un buscador lee: el `metadataBase`
 * del layout, el `<link rel="canonical">` del directorio, el sitemap y
 * el robots.txt. Si estos cuatro no dicen EXACTAMENTE el mismo host,
 * Google ve dos sitios donde hay uno.
 *
 * VA A MANO Y NO POR `NEXT_PUBLIC_SITE_URL` a propósito. Esa variable
 * se usa hoy con dos valores distintos según el archivo —unos caen a
 * `https://bookea.lat` y otros a `https://www.bookea.lat`— y eso, que
 * en un correo solo hace un redirect de más, acá cambiaría el host
 * canónico de TODO el sitio sin que nada falle: el build pasa, las
 * páginas responden, y la autoridad se parte en dos dominios en
 * silencio durante semanas.
 *
 * SI ALGÚN DÍA EL DOMINIO PRINCIPAL PASA AL APEX (`bookea.lat`, sin
 * www), se cambia acá y en el `metadataBase` del layout — y hay que
 * comprobar que el dominio principal de Vercel sea ese mismo, porque
 * el canónico y el redirect del hosting tienen que apuntar al mismo
 * lado.
 */
export const SITIO = "https://www.bookea.lat";

/** El sitio + una ruta, sin barras dobles. */
export function urlSitio(ruta: string): string {
  return ruta === "/" ? `${SITIO}/` : `${SITIO}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA IMAGEN QUE SE VE AL COMPARTIR — hay que pedirla a mano
 * ════════════════════════════════════════════════════════════════════
 *
 * `src/app/opengraph-image.tsx` la dibuja, y Next la enchufa sola en
 * las rutas que NO declaran su propio `openGraph`.
 *
 * ⚠️ EL PROBLEMA ES JUSTO ESE «NO». Una página que declara su bloque
 * `openGraph` —para tener su propio título al compartirse— REEMPLAZA el
 * del padre ENTERO, y con él se va la imagen. Verificado en producción:
 * la portada emitía `og:image` y `/invitaciones`, que sí declaraba su
 * bloque, no emitía ninguna. Facebook entonces vuelve a agarrar la
 * primera foto que encuentre en la página — que es el problema que la
 * imagen venía a resolver.
 *
 * Así que toda página con `openGraph` propio tiene que pasar
 * `images: [IMAGEN_OG]`. Se declara acá y no se escribe a mano en cada
 * una para que el día que cambie la ruta no haya que buscarlas.
 *
 * URL ABSOLUTA: los scrapers de Facebook y WhatsApp no resuelven rutas
 * relativas. `metadataBase` del layout las arregla para las rutas
 * relativas que Next genera, pero acá se manda completa y no depende de
 * eso.
 */
export const IMAGEN_OG = {
  url: urlSitio("/opengraph-image"),
  width: 1200,
  height: 630,
  alt: "Bookea — Convertí cada interacción en una experiencia",
} as const;
