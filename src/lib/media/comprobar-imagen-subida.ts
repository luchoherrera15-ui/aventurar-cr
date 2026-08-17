/**
 * ¿LO QUE SE SUBIÓ ES DE VERDAD UNA IMAGEN, Y PESA LO QUE DIJO PESAR?
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO ALCANZA CON LO QUE YA HABÍA
 * ------------------------------------------------------------------
 * El archivo NO viaja por el server action: el navegador lo sube
 * directo al bucket con su propia sesión y solo manda la URL (ver
 * `src/components/subir-imagen.tsx`, y el porqué está escrito ahí). Eso
 * resuelve el techo del body de Vercel y deja al servidor con una sola
 * cosa para mirar: una cadena.
 *
 * Hasta acá esa cadena se comprobaba con `esUrlDeNuestroStorage`, que
 * responde «esta URL apunta a nuestro bucket» — y nada más. O sea que
 * un `accept="image/*"` en el input y un `startsWith("image/")` en el
 * navegador eran TODA la validación del contenido, y las dos corren en
 * la máquina de quien sube. Un `curl` a la API de storage con un ZIP
 * renombrado a `.png` pasaba las dos.
 *
 * ------------------------------------------------------------------
 * QUÉ COMPRUEBA, Y CÓMO
 * ------------------------------------------------------------------
 * Se le pide al storage el objeto con `Range: bytes=0-...`, o sea unos
 * pocos bytes, y con eso alcanza para las dos preguntas:
 *
 *   · el TAMAÑO real sale de `content-range` («bytes 0-31/48210»), que
 *     lo escribe el servidor de archivos y no quien subió;
 *   · el TIPO real sale de los MAGIC BYTES del principio del archivo,
 *     no del `content-type` — ese lo declaró el navegador al subir y se
 *     guarda tal cual, así que es exactamente el dato que un atacante
 *     controla.
 *
 * Es una llamada de red dentro de un guardado, y por eso se pide un
 * pedazo y no el archivo entero: bajar 2 MB para mirar 32 bytes sería
 * pagar el ancho de banda de la imagen dos veces (el generador del pase
 * ya la baja de verdad cuando arma el .pkpass).
 *
 * NUNCA lanza. Un fallo de red devuelve `ok: false` con un motivo en
 * español: es lo mismo que responder «no se subió bien, probá de
 * nuevo», que es lo que el dueño puede hacer al respecto.
 */

/** Los formatos que sharp dibuja adentro del sello sin sorpresas. */
const FIRMAS: readonly { tipo: string; bytes: readonly number[]; desde?: number }[] = [
  { tipo: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  // WebP: "RIFF" .... "WEBP" — la marca de verdad está en el byte 8.
  { tipo: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { tipo: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], desde: 8 },
];

/** Cuántos bytes hay que leer para reconocer cualquiera de las firmas. */
const BYTES_A_LEER = 32;

export type ImagenComprobada =
  | { ok: true; tipo: string; bytes: number | null }
  | { ok: false; motivo: string };

/** El tipo real, mirando el principio del archivo. null = ninguno conocido. */
export function tipoPorFirma(cabeza: Uint8Array): string | null {
  const png = FIRMAS[0];
  const jpeg = FIRMAS[1];
  const riff = FIRMAS[2];
  const webp = FIRMAS[3];

  const coincide = (f: (typeof FIRMAS)[number]) => {
    const desde = f.desde ?? 0;
    if (cabeza.length < desde + f.bytes.length) return false;
    return f.bytes.every((b, i) => cabeza[desde + i] === b);
  };

  if (coincide(png)) return png.tipo;
  if (coincide(jpeg)) return jpeg.tipo;
  // Un RIFF puede ser un WAV: las dos marcas juntas o no es WebP.
  if (coincide(riff) && coincide(webp)) return "image/webp";
  return null;
}

/** El total del archivo según `content-range` («bytes 0-31/48210»). */
export function bytesDelRango(cabecera: string | null): number | null {
  if (!cabecera) return null;
  const m = /\/(\d+)\s*$/.exec(cabecera.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function comprobarImagenSubida(
  url: string,
  opciones: {
    /** Tope duro. El mismo que muestra la pantalla al subir. */
    maxBytes: number;
    /** Inyectable para las pruebas; por defecto, el fetch del entorno. */
    traer?: typeof fetch;
  },
): Promise<ImagenComprobada> {
  const traer = opciones.traer ?? fetch;

  let res: Response;
  try {
    res = await traer(url, {
      headers: { Range: `bytes=0-${BYTES_A_LEER - 1}` },
      // El objeto acaba de subirse: una copia cacheada sería de otro
      // archivo o directamente un 404 de hace un minuto.
      cache: "no-store",
    });
  } catch {
    return { ok: false, motivo: "No se pudo leer el archivo que subiste. Probá de nuevo." };
  }

  // 206 con Range, 200 si el servidor lo ignoró. Cualquier otra cosa
  // (404, 403) significa que el archivo no está donde dice estar.
  if (!res.ok) {
    return { ok: false, motivo: "No se pudo leer el archivo que subiste. Probá de nuevo." };
  }

  const bytes = bytesDelRango(res.headers.get("content-range"));
  if (bytes !== null && bytes > opciones.maxBytes) {
    const mb = (opciones.maxBytes / 1024 / 1024).toFixed(0);
    return { ok: false, motivo: `Esa imagen pesa más de ${mb} MB. Probá con otra.` };
  }

  let cabeza: Uint8Array;
  try {
    cabeza = new Uint8Array(await res.arrayBuffer());
  } catch {
    return { ok: false, motivo: "No se pudo leer el archivo que subiste. Probá de nuevo." };
  }

  // Sin Range, el cuerpo es el archivo entero: el largo real también
  // sirve para el tope cuando `content-range` no vino.
  if (bytes === null && cabeza.length > opciones.maxBytes) {
    const mb = (opciones.maxBytes / 1024 / 1024).toFixed(0);
    return { ok: false, motivo: `Esa imagen pesa más de ${mb} MB. Probá con otra.` };
  }

  const tipo = tipoPorFirma(cabeza);
  if (!tipo) {
    return { ok: false, motivo: "Ese archivo no es una imagen PNG, JPG o WebP." };
  }

  return { ok: true, tipo, bytes };
}
