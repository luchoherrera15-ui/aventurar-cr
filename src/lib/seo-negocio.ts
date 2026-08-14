import type { Metadata } from "next";
import { urlSitio } from "./sitio";

/**
 * ============================================================
 * CÓMO SE VE UN NEGOCIO CUANDO ALGUIEN LO COMPARTE
 * ============================================================
 *
 * En Costa Rica una ficha se recomienda por WhatsApp: alguien pega el
 * enlace en el grupo de la familia y ahí se decide. Hasta ahora esa
 * ficha salía sin foto y con el título genérico del sitio ("Bookea —
 * Reservá espacios y servicios en Costa Rica"), porque ni `/[slug]` ni
 * `/citas/[slug]` declaraban `generateMetadata`. Es conversión perdida
 * en el momento exacto de la recomendación.
 *
 * Las dos rutas arman lo mismo desde acá — el título, la descripción,
 * el Open Graph con la foto y los datos estructurados — para que la
 * ficha de un rancho y la de una barbería no se compartan distinto.
 *
 * ⚠️ ESTE MÓDULO NO SABE LEER LA BASE, A PROPÓSITO. Recibe un objeto
 * ya armado por la página con los campos que un visitante puede ver.
 * Nada de `select("*")` acá adentro: la fila de `ranchos` guarda el
 * SINPE y la cuenta bancaria del proveedor (ver el comentario grande de
 * ./ranchos-publicos), y una foto de más en el HTML es un mal día,
 * pero un número de cuenta de más ya pasó dos veces.
 */

/** Lo que hace falta para presentar un negocio afuera. Nada más. */
export type NegocioSeo = {
  nombre: string;
  /** La ruta pública, con barra inicial: "/rancholastorres". */
  ruta: string;
  /** "Lugares", "Barbería"… en palabras, ya resuelto por quien llama. */
  categoriaLabel: string | null;
  descripcion: string | null;
  provincia: string | null;
  canton: string | null;
  direccionExacta: string | null;
  latitud: number | null;
  longitud: number | null;
  /** Fotos absolutas, la primera es la de portada. */
  fotos: string[];
  precioDesde: number | null;
  /** "por evento", "por persona"… o null. */
  unidadPrecio: string | null;
  telefono: string | null;
  /** Instagram, Facebook, TikTok, sitio propio — lo que haya. */
  redes: (string | null | undefined)[];
};

const colones = (n: number) => "₡" + Math.round(n).toLocaleString("es-CR");

/**
 * "Atenas, Alajuela" — lo que la gente reconoce de un vistazo.
 *
 * Cuando el cantón se llama igual que la provincia (Alajuela, Cartago,
 * Heredia, Limón, Puntarenas: la cabecera lleva el nombre de su
 * provincia) se dice UNA vez. "Alajuela, Alajuela" en el título de
 * WhatsApp se lee como un error de la plataforma.
 */
export function ubicacionNegocio(n: Pick<NegocioSeo, "canton" | "provincia">): string | null {
  const partes = [n.canton?.trim(), n.provincia?.trim()].filter(
    (p): p is string => !!p && p.length > 0,
  );
  const unicas = partes.filter(
    (p, i) => partes.findIndex((q) => q.toLocaleLowerCase("es-CR") === p.toLocaleLowerCase("es-CR")) === i,
  );
  return unicas.join(", ") || null;
}

/** Las fotos utilizables, sin repetidas y sin vacíos. */
function fotosLimpias(fotos: string[], tope: number): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const foto of fotos) {
    const url = typeof foto === "string" ? foto.trim() : "";
    if (!url || vistas.has(url)) continue;
    vistas.add(url);
    salida.push(url);
    if (salida.length === tope) break;
  }
  return salida;
}

/**
 * La descripción que se lee en el preview de WhatsApp y en Google.
 *
 * La del dueño manda; si no escribió ninguna se arma una honesta con lo
 * que sí se sabe (qué es y dónde queda) en vez de dejar la del sitio,
 * que hablaba de "espacios y servicios en Costa Rica" para todos.
 */
export function descripcionNegocio(n: NegocioSeo): string {
  const propia = n.descripcion?.trim();
  if (propia) return propia.length > 200 ? propia.slice(0, 197).trimEnd() + "…" : propia;

  const donde = ubicacionNegocio(n);
  const que = n.categoriaLabel ? `${n.categoriaLabel}` : "Negocio";
  const precio =
    n.precioDesde && n.precioDesde > 0
      ? ` Desde ${colones(n.precioDesde)}${n.unidadPrecio ? ` ${n.unidadPrecio}` : ""}.`
      : "";
  return `${que}${donde ? ` en ${donde}` : ""}.${precio} Mirá fotos, precios y disponibilidad, y reservá en Bookea.`;
}

/** "Desde ₡150 000 por evento" — `priceRange` de schema.org es texto. */
function rangoPrecio(n: NegocioSeo): string | undefined {
  if (!n.precioDesde || n.precioDesde <= 0) return undefined;
  return `Desde ${colones(n.precioDesde)}${n.unidadPrecio ? ` ${n.unidadPrecio}` : ""}`;
}

/**
 * El título, la descripción y el Open Graph de una ficha.
 *
 * El layout raíz declara `title.template = "%s | Bookea"`, así que acá
 * va solo la parte del negocio. El bloque `openGraph` REEMPLAZA al del
 * layout (Next no lo mezcla campo por campo), por eso se repiten
 * `siteName` y `locale`: sin ellos, el preview perdería el nombre del
 * sitio al ganar la foto.
 */
export function metadataNegocio(n: NegocioSeo): Metadata {
  const donde = ubicacionNegocio(n);
  const titulo = donde ? `${n.nombre} — ${donde}` : n.nombre;
  const descripcion = descripcionNegocio(n);
  const url = urlSitio(n.ruta);
  // La foto es LA razón de todo esto: sin `og:image` el enlace sale
  // como una línea de texto gris en el chat.
  const imagenes = fotosLimpias(n.fotos, 3).map((url) => ({ url, alt: n.nombre }));

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: descripcion,
      type: "website",
      url,
      siteName: "Bookea",
      locale: "es_CR",
      images: imagenes.length > 0 ? imagenes : undefined,
    },
    twitter: {
      card: imagenes.length > 0 ? "summary_large_image" : "summary",
      title: titulo,
      description: descripcion,
      images: imagenes.length > 0 ? imagenes.map((i) => i.url) : undefined,
    },
  };
}

/**
 * Los datos estructurados del negocio (JSON-LD, `LocalBusiness`).
 *
 * Es lo que le permite a Google mostrar la ficha con dirección y rango
 * de precio en vez de un resultado de texto pelado. Se omite todo lo
 * que esté vacío: un `address` a medias es peor que ninguno.
 */
export function datosEstructuradosNegocio(n: NegocioSeo): Record<string, unknown> {
  const url = urlSitio(n.ruta);
  const datos: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": url,
    name: n.nombre,
    description: descripcionNegocio(n),
    url,
  };

  const imagenes = fotosLimpias(n.fotos, 6);
  if (imagenes.length > 0) datos.image = imagenes;

  const direccion: Record<string, string> = { "@type": "PostalAddress", addressCountry: "CR" };
  if (n.direccionExacta) direccion.streetAddress = n.direccionExacta;
  if (n.canton) direccion.addressLocality = n.canton;
  if (n.provincia) direccion.addressRegion = n.provincia;
  if (Object.keys(direccion).length > 2) datos.address = direccion;

  if (typeof n.latitud === "number" && typeof n.longitud === "number") {
    datos.geo = { "@type": "GeoCoordinates", latitude: n.latitud, longitude: n.longitud };
  }

  const precio = rangoPrecio(n);
  if (precio) datos.priceRange = precio;
  if (n.telefono) datos.telephone = n.telefono;

  // `sameAs` tiene que ser una URL. El dueño escribe ese campo a mano y
  // a veces pone el arroba suelto ("@rancholastorres"): eso no es un
  // perfil, es texto, y ensuciaría el JSON-LD entero.
  const redes = n.redes.filter(
    (r): r is string => typeof r === "string" && /^https?:\/\//i.test(r.trim()),
  );
  if (redes.length > 0) datos.sameAs = redes.map((r) => r.trim());

  return datos;
}

/**
 * El JSON-LD listo para meter en un `<script type="application/ld+json">`.
 *
 * `JSON.stringify` escapa comillas pero NO `</script>`: una descripción
 * escrita por el dueño que contenga esa cadena cerraría la etiqueta y
 * lo que siguiera se ejecutaría como HTML. Acá cada "menor que" sale
 * como su escape unicode, que dentro de una cadena JSON significa
 * exactamente lo mismo y ya no cierra ninguna etiqueta.
 */
export function jsonLdSeguro(datos: Record<string, unknown>): string {
  return JSON.stringify(datos).replace(/</g, "\\u003c");
}
