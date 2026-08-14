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
