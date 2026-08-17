/**
 * CON QUÉ PAÍS ABRE EL BUSCADOR — las reglas, sin tocar el request.
 *
 * ── EL PEDIDO ──────────────────────────────────────────────────────
 * «Que detecte la ubicación y no haya que escoger país». Hasta hoy el
 * `<select>` de país del buscador abría SIEMPRE en Costa Rica
 * (`PAIS_POR_DEFECTO`), así que un panameño tenía que corregirlo a mano
 * antes de cada búsqueda.
 *
 * ── DE DÓNDE SALE LA UBICACIÓN ─────────────────────────────────────
 * De `x-vercel-ip-country`, la cabecera que Vercel pega en TODA request
 * (ISO 3166-1 alfa-2, en mayúscula). Es gratis, ya viene en el request,
 * no agrega ni una consulta y —lo importante— NO le pide permiso a
 * nadie.
 *
 * A propósito NO se usa `navigator.geolocation`: ese cartel del
 * navegador apareciendo apenas alguien entra a la portada espanta más
 * gente de la que ayuda, y para saber el PAÍS (no la cuadra) es una
 * precisión que sobra por tres órdenes de magnitud.
 *
 * ── EL ORDEN DE PRECEDENCIA, Y POR QUÉ ─────────────────────────────
 *   1. Lo que la persona ELIGIÓ a mano (cookie).
 *   2. Lo que dice la IP, si es uno de los 8 países del catálogo.
 *   3. Costa Rica.
 *
 * La elección manual gana porque la detección por IP se equivoca
 * seguido justo acá: buena parte del tráfico centroamericano sale
 * ruteado por Miami, y con VPN se equivoca siempre. Si alguien tuvo que
 * corregir el país una vez, obligarlo a corregirlo otra vez en la
 * siguiente visita es peor que no haber detectado nada.
 *
 * Y la detección NUNCA esconde el `<select>`. Además de lo anterior,
 * hay gente que busca en otro país a propósito (una boda en Panamá) y
 * está el rastreo: Google entra desde Estados Unidos, y un sitio que
 * cambia de contenido por IP sin dejar navegar a cada país deja siete
 * mercados sin indexar.
 *
 * ── ESTE MÓDULO ES PURO ────────────────────────────────────────────
 * Sin `next/headers`, sin `document`, sin red: entra un string y sale
 * un código de país. Lo puede importar el componente de cliente (para
 * escribir la cookie) y el de servidor (para leerla), sin arrastrar la
 * frontera "use client" ni obligar a un test a montar un request — que
 * es exactamente el error que ya rompió el build dos veces en este
 * repo. Quien SÍ toca el request es `@/lib/pais-visitante`, que es
 * `server-only` y no lo puede importar un componente de cliente.
 */

import { PAIS_POR_DEFECTO, esPais, type CodigoPais } from "@/lib/paises";

/**
 * La cookie donde queda el país que la persona eligió a mano.
 *
 * La escribe el `<select>` del buscador desde el navegador (no un
 * server action: no vale una ida al servidor por cambiar un
 * desplegable) y la lee la portada al renderizar. Por eso NO es
 * `HttpOnly` — tiene que ser escribible desde JS— y no hay problema:
 * lo único que guarda es un código de país de dos letras, que además
 * ya viaja a la vista en la URL (`?pais=pa`).
 */
export const COOKIE_PAIS = "bookea_pais";

/**
 * La cabecera de geolocalización de Vercel. Fuera de Vercel —`next
 * dev`, otro hosting— simplemente no viene, y entonces manda el
 * default. Nunca es un error que falte.
 */
export const CABECERA_PAIS = "x-vercel-ip-country";

/**
 * Un año, en segundos. Es una preferencia de comodidad, no una sesión:
 * quien vive en Panamá va a seguir viviendo en Panamá el mes que viene,
 * y cada expiración le devuelve el país equivocado que ya corrigió.
 */
export const EDAD_COOKIE_PAIS = 60 * 60 * 24 * 365;

/**
 * El país que dice la IP, o `null` si no es uno de los nuestros.
 *
 * Devuelve `null` —y no Costa Rica— a propósito: quien llama necesita
 * distinguir "detecté Guatemala" de "no detecté nada", porque son dos
 * pasos distintos de la precedencia. Quedarse en Costa Rica es decisión
 * de `paisInicialDelBuscador`, no de acá.
 *
 * Baja a minúscula porque la cabecera viene en mayúscula ("CR") y el
 * código canónico del catálogo es minúscula (es lo que va a la URL).
 * Un país que Bookea todavía no atiende —Estados Unidos, España— y los
 * centinelas que manda Vercel cuando no puede ubicar la IP ("XX", y las
 * conexiones por Tor) caen todos en el mismo `null`.
 */
export function paisDetectado(
  cabecera: string | null | undefined,
): CodigoPais | null {
  const limpio = typeof cabecera === "string" ? cabecera.trim().toLowerCase() : "";
  return esPais(limpio) ? limpio : null;
}

/**
 * El país que la persona eligió a mano, o `null` si nunca eligió.
 *
 * Una cookie vieja con un país que se sacó del catálogo, o con basura
 * escrita por otra pestaña, cae en `null`: se vuelve a detectar en vez
 * de dejar el `<select>` sin nada marcado.
 */
export function paisElegido(cookie: string | null | undefined): CodigoPais | null {
  const limpio = typeof cookie === "string" ? cookie.trim().toLowerCase() : "";
  return esPais(limpio) ? limpio : null;
}

/**
 * LA REGLA COMPLETA: elección > detección > Costa Rica.
 *
 * Nunca tira y nunca devuelve nada raro. Es la única función que
 * decide esto en todo el sitio, así que el servidor (que pinta el HTML
 * inicial) y cualquier prueba responden exactamente lo mismo.
 */
export function paisInicialDelBuscador({
  elegido,
  detectado,
}: {
  /** El valor crudo de la cookie `bookea_pais`. */
  elegido?: string | null;
  /** El valor crudo de la cabecera `x-vercel-ip-country`. */
  detectado?: string | null;
}): CodigoPais {
  return paisElegido(elegido) ?? paisDetectado(detectado) ?? PAIS_POR_DEFECTO;
}

/**
 * La línea que se le asigna a `document.cookie` para recordar el país.
 *
 * Se arma acá —y no en el componente— para poder probarla: una cookie
 * mal escrita no rompe nada visible, simplemente no se guarda, y eso
 * solo se descubre volviendo a entrar al sitio al día siguiente.
 *
 * · `path=/` para que valga en todo el sitio y no solo en la portada.
 * · `SameSite=Lax` porque no se necesita en peticiones de terceros;
 *   `None` obligaría a `Secure` y expondría la preferencia a cualquier
 *   sitio que embeba una imagen nuestra.
 * · `Secure` va SOLO en https. Se pasa como argumento en vez de mirar
 *   `location` acá adentro para que el módulo siga siendo puro — y
 *   porque el sitio se prueba de verdad desde un teléfono contra
 *   `http://192.168.x.x:3000`, donde una cookie `Secure` la descarta el
 *   navegador sin avisar.
 *
 * El valor se normaliza contra el catálogo: nunca se escribe en la
 * cookie algo que después `paisElegido` vaya a descartar.
 */
export function cookieDePais(codigo: string | null | undefined, seguro: boolean): string {
  const pais = paisElegido(codigo) ?? PAIS_POR_DEFECTO;
  const partes = [
    `${COOKIE_PAIS}=${pais}`,
    "path=/",
    `max-age=${EDAD_COOKIE_PAIS}`,
    "samesite=lax",
  ];
  if (seguro) partes.push("secure");
  return partes.join("; ");
}
