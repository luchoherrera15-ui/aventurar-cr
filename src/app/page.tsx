import type { Metadata } from "next";
import ModoDescubrir from "@/components/home/modo-descubrir";
import ModoPlataforma from "@/components/home/modo-plataforma";
import { leerCatalogoPortada } from "./home-datos";
import { urlSitio } from "@/lib/sitio";
import { rubroDeParametro } from "@/lib/rubros-portada";
import { modoHome, type ParamsHome } from "@/lib/home-modo";

/**
 * ============================================================
 * LA PORTADA DE BOOKEA — `bookea.lat`
 * ============================================================
 *
 * ── QUINTA VUELTA (sep 2026): DOS MODOS, UNA SOLA RUTA ────────────
 *
 * Este archivo ya no dibuja: DECIDE. Mira la URL y elige quién
 * contesta (la regla vive en `src/lib/home-modo.ts`, probada aparte):
 *
 *   `/` con q/lugar/rubro/…  →  `<ModoDescubrir>`   el catálogo
 *   `/` sin parámetros       →  `<ModoPlataforma>`  qué es Bookea
 *
 * ── POR QUÉ NO SON DOS RUTAS ──────────────────────────────────────
 *
 * Porque `/` es la PÁGINA DE RESULTADOS del sitio. Los directorios
 * `/citas` y `/eventos` se borraron y sus 301 caen acá con el query
 * intacto (ver `next.config.ts`), igual que el buscador del héroe. De
 * ese lado hay links compartidos por WhatsApp, favoritos y resultados
 * de Google todavía indexados. Una ruta nueva obligaría a reescribir
 * redirects que hoy funcionan; un `if` sobre la URL, no.
 *
 * ── EL MODO DESCUBRIR NO SE TOCÓ ──────────────────────────────────
 *
 * `<ModoDescubrir>` es el árbol de la cuarta vuelta movido tal cual:
 * aviso, header, héroe con aurora y rieles. Cambió de archivo, no de
 * comportamiento — y `scripts/verificar-home.mjs` lo comprueba.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ────────────────────────────────────
 * Ni estrellas, ni cifras inventadas, ni negocios de mentira. Vale
 * para los dos modos.
 */

/** Lo que dice la portada cuando alguien llega buscando. */
const META_DESCUBRIR = {
  titulo: "Bookea — Reservá servicios y encontrá proveedores para eventos",
  descripcion:
    "Reservá citas de belleza, barbería, spa y salud, y encontrá lugares, catering, música y decoración para tu evento en todo Costa Rica. Precios en colones, a la vista, y reserva directa sin cadenas de WhatsApp.",
};

/** Lo que dice cuando llega alguien que tiene un negocio. */
const META_PLATAFORMA = {
  titulo: "Bookea — Aumentá tus ventas",
  descripcion:
    "Creá la página de tu negocio, recibí reservas y pedidos, conocé a tus clientes y hacelos volver. Bookea es la plataforma que centraliza la operación digital de tu negocio en Costa Rica.",
};

/**
 * ⚠️ METADATA POR MODO, CANÓNICO ÚNICO.
 *
 * El título cambia con el modo porque son dos páginas distintas para
 * quien llega: una presenta un producto y la otra lista resultados.
 * Pero el CANÓNICO no lleva parámetros nunca — si cada combinación de
 * filtros fuera su propia URL canónica, Google indexaría decenas de
 * duplicados de la portada compitiendo entre sí.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ParamsHome>;
}): Promise<Metadata> {
  const params = await searchParams;
  const meta = modoHome(params) === "descubrir" ? META_DESCUBRIR : META_PLATAFORMA;
  return {
    title: { absolute: meta.titulo },
    description: meta.descripcion,
    alternates: { canonical: urlSitio("/") },
  };
}

/**
 * ── EL FILTRO EN LA MISMA PÁGINA (`?rubro=`) ────────────────────────
 *
 * Pedido del dueño (ago 2026): los nueve íconos del héroe dejaron de
 * mandar a `/citas` y `/eventos` — «la idea es que TODO se encuentre
 * acá mismo». Ahora escriben `?rubro=` y el catálogo de abajo se
 * recorta sin salir de la portada.
 *
 * ⚠️ ESTA PÁGINA PASA A SER DINÁMICA. Leer `searchParams` se lo dice a
 * Next solo: ya no se puede prerenderizar una única versión estática
 * porque hay diez (sin filtro + nueve rubros). No es un descuido; es el
 * precio de que el filtro viva en la URL — y vivir en la URL es lo que
 * hace que el filtro se pueda compartir, marcar y volver atrás con el
 * botón del navegador, que es lo que un visitante espera.
 *
 * El canónico NO lleva el parámetro y eso es a propósito: las diez
 * versiones muestran el mismo catálogo recortado de distinta forma, no
 * diez páginas distintas. Sin eso, Google indexaría nueve duplicados de
 * la portada compitiendo entre sí.
 */
export default async function Home({
  searchParams,
  demo = false,
  forzarDescubrir = false,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
  /**
   * ⚠️ EL CATÁLOGO SIEMPRE, SIN FILTROS DE POR MEDIO.
   *
   * Lo usa `/all`, la dirección fija del marketplace (dueño, 24 sep
   * 2026: «que en www.bookea.lat/all salga el marketplace que teníamos
   * antes, de citas y reservas»).
   *
   * Es distinto de `demo`: acá los negocios son los de VERDAD. La
   * única diferencia con `/` es que no hay que traer un parámetro en
   * la URL para ver el catálogo.
   */
  forzarDescubrir?: boolean;
  /**
   * ⚠️ EL MODO DEMOSTRACIÓN: LA MISMA PORTADA, CON EL OTRO CATÁLOGO.
   *
   * Pedido del dueño (27 ago 2026): «necesito el MISMO MISMO sitio de
   * Bookea, solamente que lleno de demos, con los cards iguales a los
   * de Bookea normal, todo igual».
   *
   * Primero le hice una página aparte y estaba mal: por más que reusara
   * las mismas piezas, era OTRA pantalla — con su encabezado, su franja
   * y su propio armado. Lo que se enseña en una demo tiene que ser el
   * producto, no una imitación del producto.
   *
   * Así que la portada es UNA sola y este bandera cambia únicamente de
   * dónde salen los negocios. Todo lo demás —el héroe, el buscador, los
   * íconos de rubro, los carriles, la tarjeta— es literalmente el mismo
   * código. Si mañana cambia la tarjeta, cambia en los dos a la vez,
   * que es la única forma de que la demo no se despegue del producto.
   */
  demo?: boolean;
}) {
  /**
   * ⚠️ ACÁ SE PRE-CALENTABA `leerCenso()` (dos viajes a Supabase en
   * paralelo en vez de en fila; llegó a medirse en 480 ms el servidor
   * de `/`). Se quitó el 28 ago 2026: la grilla de rubros de dos
   * carriles tiene orden CURADO y ya no consulta el censo, así que la
   * llamada calentaba una promesa que nadie esperaba — una ida a la
   * base por visita, de regalo. Si algún componente de la portada
   * vuelve a necesitar el censo, este es el lugar donde arrancarlo.
   */
  const params = await searchParams;

  /**
   * ⚠️ EL CATÁLOGO SOLO SE LEE EN EL MODO DESCUBRIR.
   *
   * Antes se pedía SIEMPRE, en paralelo con `searchParams`. Tenía
   * sentido cuando los dos modos pintaban los rieles; desde que el
   * modo Plataforma se redujo al héroe y los cuatro teléfonos, ya no
   * usa el catálogo para nada — y seguir pidiéndolo era una ida a
   * Supabase por cada visita a la portada, de regalo.
   *
   * Se decide ANTES de pedir los datos, no después: por eso el modo se
   * resuelve acá arriba y no en el `return`.
   */
  const modo = modoHome(params, { demo, forzarDescubrir });
  const rubro = rubroDeParametro(params.rubro, params.sub);

  /**
   * ── LA BÚSQUEDA DEL HÉROE (`?q=` y `?lugar=`) ────────────────────
   * El buscador grande ya no manda a /citas ni /eventos — esos
   * directorios se borraron y sus redirects traen a la gente ACÁ con
   * el query intacto — así que la portada es quien filtra.
   * `?provincia=` se acepta como sinónimo de `?lugar=`: es el nombre
   * que llevaban los enlaces de los directorios viejos, y esos siguen
   * vivos en historiales y chats compartidos.
   */
  const uno = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const busqueda = {
    q: uno(params.q),
    lugar: uno(params.lugar) || uno(params.provincia),
  };


  /**
   * LA BIFURCACIÓN.
   *
   * `demo` fuerza Descubrir: `/demo-bookea` existe para enseñar el
   * catálogo lleno de negocios de muestra, y en el modo Plataforma
   * dejaría de mostrar lo único que la hace existir.
   */
  if (modo === "descubrir") {
    const catalogo = await leerCatalogoPortada(demo);
    return <ModoDescubrir catalogo={catalogo} rubro={rubro} busqueda={busqueda} />;
  }

  return <ModoPlataforma />;
}
