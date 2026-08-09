/**
 * BOOKEA MEDIA — cómo se nombra un archivo en R2.
 *
 * El nombre que manda el navegador NUNCA es la clave. Se sanitiza y se
 * cuelga de un UUID, por tres razones distintas:
 *
 *  1. SEGURIDAD. Un nombre como `../../otro-negocio/portada.jpg` en un
 *     bucket que no normaliza rutas escribe donde no debe. El UUID
 *     además hace que la clave no se pueda adivinar.
 *
 *  2. NO PISAR NADA. Hoy tres pantallas del panel suben con
 *     `upsert: true` sobre la misma ruta (galería, catálogo, equipo).
 *     Eso rompe el `Cache-Control: immutable` —la URL deja de apuntar
 *     siempre al mismo byte— y encima explica los duplicados exactos que
 *     se midieron en el bucket. Acá cada subida nace en una clave nueva.
 *
 *  3. QUE SE PUEDA LEER. El nombre original sobrevive al final de la
 *     clave, sanitizado: cuando alguien mire el bucket a las 2 a. m.
 *     buscando por qué una foto pesa 5 MB, va a poder reconocerla.
 *
 * Módulo puro: sin red, sin SDK, sin `process.env`.
 */

// ------------------------------------------------------------
// Caracteres y nombres que no pueden pasar
// ------------------------------------------------------------

/**
 * Controles C0 y C1, más los que reordenan el texto a la vista.
 *
 * Se construye con `new RegExp` sobre una cadena escapada, y no con un
 * literal `/[...]/`: un carácter invisible pegado dentro de un regex es
 * imposible de revisar en un diff y se pierde en cualquier copiar y
 * pegar. Acá se lee qué bloquea sin tener que confiar en el editor.
 *
 * Los bidi overrides (U+202A-202E, U+2066-2069) merecen mención propia:
 * con ellos un nombre se DIBUJA como "foto.jpg" en el panel del admin y
 * en el bucket mientras el archivo real termina en otra extensión. Es un
 * engaño clásico y barato de bloquear acá.
 */
const PELIGROSOS = new RegExp(
  "[" +
    "\\u0000-\\u001F" + // controles C0 (incluye \0, \n, \r)
    "\\u007F-\\u009F" + // DEL y controles C1
    "\\u200B-\\u200F" + // espacios de ancho cero y marcas LTR/RTL
    "\\u202A-\\u202E" + // overrides de dirección
    "\\u2066-\\u2069" + // aislantes de dirección
    "\\uFEFF" + // BOM en medio del texto
    "]",
  "g",
);

/** Las marcas de acento que deja NFD, para transliterar a ASCII. */
const DIACRITICOS = new RegExp("[\\u0300-\\u036F]", "g");

/** Nombres que en Windows no son archivos sino dispositivos. */
const RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Lo único que sobrevive en un nombre, ya transliterado. */
const PERMITIDOS = /[^a-zA-Z0-9._-]+/g;

/** Tope del nombre visible (sin extensión). El resto es ruido. */
const MAX_BASE = 60;
/** Tope de la extensión: `.jpeg` son 4; 10 es holgura para `.heic` y amigos. */
const MAX_EXT = 10;
/** Tope de la clave completa. R2/S3 admite 1024 bytes. */
export const MAX_CLAVE = 1024;

// ------------------------------------------------------------
// Sanitizado del nombre
// ------------------------------------------------------------

/**
 * Convierte el nombre que mandó el usuario en algo seguro de escribir.
 *
 * NO es la clave: es el sufijo legible que va al final de la clave. El
 * que garantiza unicidad es el UUID que va delante.
 *
 * Devuelve siempre algo no vacío: "archivo" cuando no quedó nada que
 * salvar (un nombre de puros emojis, por ejemplo).
 */
export function sanitizarNombre(nombre: unknown): string {
  if (typeof nombre !== "string") return "archivo";

  // 1. Solo el último segmento: cualquier cosa que parezca ruta se
  //    descarta acá, con las DOS barras (Windows manda `\`).
  const soloNombre = nombre.split(/[/\\]/).pop() ?? "";

  // 2. NFC y fuera los invisibles. NFD separaría los acentos en dos
  //    puntos de código y el paso 4 se comería la letra base.
  const limpio = soloNombre.normalize("NFC").replace(PELIGROSOS, "");

  // 3. Partir base y extensión ANTES de tocar los puntos, si no
  //    `mi.foto.final.jpg` pierde la extensión.
  const punto = limpio.lastIndexOf(".");
  const hayExt = punto > 0 && punto < limpio.length - 1;
  const baseCruda = hayExt ? limpio.slice(0, punto) : limpio;
  const extCruda = hayExt ? limpio.slice(punto + 1) : "";

  // 4. Acentos a ASCII (acá sí NFD, y de inmediato se quitan las
  //    marcas), y todo lo demás a guion.
  const base = baseCruda
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .replace(PERMITIDOS, "-")
    .replace(/-+/g, "-")
    // Un punto o un guion al principio esconde el archivo en Unix o lo
    // hace parecer una opción de línea de comandos.
    .replace(/^[.-]+/, "")
    .replace(/[.-]+$/, "")
    .slice(0, MAX_BASE);

  const ext = extCruda
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase()
    .slice(0, MAX_EXT);

  // 5. `CON.jpg` sigue siendo el dispositivo CON en Windows: se le pone
  //    un prefijo en vez de rechazar la subida entera.
  const baseSegura = RESERVADOS_WINDOWS.test(base) ? `archivo-${base}` : base;

  if (!baseSegura) return ext ? `archivo.${ext}` : "archivo";
  return ext ? `${baseSegura}.${ext}` : baseSegura;
}

// ------------------------------------------------------------
// Validación de una clave completa
// ------------------------------------------------------------

export type ClaveInvalida =
  | "vacia"
  | "muy-larga"
  | "caracter-no-permitido"
  | "segmento-vacio"
  | "traversal"
  | "absoluta";

/**
 * ¿Esta clave se puede escribir en R2 sin sorpresas?
 *
 * Se valida la clave ARMADA, no solo sus partes: es la última red antes
 * de firmar una URL, y una URL prefirmada mal formada es una escritura
 * en un lugar que nadie eligió.
 */
export function revisarClave(clave: unknown): { ok: true } | { ok: false; motivo: ClaveInvalida } {
  if (typeof clave !== "string" || clave.length === 0) return { ok: false, motivo: "vacia" };
  if (clave.length > MAX_CLAVE) return { ok: false, motivo: "muy-larga" };
  if (clave.startsWith("/")) return { ok: false, motivo: "absoluta" };

  // Se mira ANTES de partir por "/": una barra invertida o un byte de
  // control no forman segmento pero sí cambian lo que interpreta el
  // otro lado.
  if (!/^[a-zA-Z0-9._\-/]+$/.test(clave)) return { ok: false, motivo: "caracter-no-permitido" };

  const partes = clave.split("/");
  for (const p of partes) {
    if (p.length === 0) return { ok: false, motivo: "segmento-vacio" };
    // `.` y `..` son los dos que se resuelven contra el padre. Un
    // segmento de puros puntos (`...`) tampoco tiene por qué existir.
    if (/^\.+$/.test(p)) return { ok: false, motivo: "traversal" };
  }
  return { ok: true };
}

export function esClaveSegura(clave: unknown): boolean {
  return revisarClave(clave).ok;
}

// ------------------------------------------------------------
// Armado de claves
// ------------------------------------------------------------

/** Un id nuevo para un asset. Aislado para poder fijarlo en los tests. */
export function nuevoAssetId(): string {
  return crypto.randomUUID();
}

/**
 * Los identificadores que van al medio de la clave (uuid del dueño, de
 * la entidad, del asset) tienen que ser inertes: si uno trae una barra,
 * inventa un nivel de carpeta que nadie pidió.
 */
const ID_VALIDO = /^[a-zA-Z0-9._-]+$/;

function exigirId(valor: string, campo: string): string {
  if (!valor || !ID_VALIDO.test(valor) || /^\.+$/.test(valor)) {
    throw new Error(`Clave de media inválida: ${campo} no es un identificador seguro.`);
  }
  return valor;
}

export type PartesClave = {
  /** El dueño; "compartido" para lo que no cuelga de un usuario. */
  propietarioId: string;
  entidad: string;
  entidadId: string;
  assetId: string;
  /** El nombre tal cual lo mandó el navegador; se sanitiza acá adentro. */
  nombre: string;
};

/**
 * La clave del ORIGINAL en R2:
 *
 *   originals/{propietarioId}/{entidad}/{entidadId}/{assetId}/{archivo}
 *
 * El `assetId` va como carpeta propia y no pegado al nombre para que
 * borrar un asset sea borrar un prefijo entero, sin riesgo de llevarse
 * el archivo de al lado por un prefijo que casualmente coincide.
 */
export function claveOriginal(partes: PartesClave): string {
  const clave = [
    "originals",
    exigirId(partes.propietarioId, "propietarioId"),
    exigirId(partes.entidad, "entidad"),
    exigirId(partes.entidadId, "entidadId"),
    exigirId(partes.assetId, "assetId"),
    sanitizarNombre(partes.nombre),
  ].join("/");

  const revision = revisarClave(clave);
  if (!revision.ok) {
    throw new Error(`Clave de media inválida (${revision.motivo}).`);
  }
  return clave;
}

/**
 * La clave del ZIP de un álbum. Vive aparte de `originals/` para poder
 * ponerle una regla de expiración propia en R2 sin tocar los originales.
 */
export function claveZip(albumId: string, jobId: string): string {
  const clave = ["exports", exigirId(albumId, "albumId"), `${exigirId(jobId, "jobId")}.zip`].join(
    "/",
  );
  const revision = revisarClave(clave);
  if (!revision.ok) throw new Error(`Clave de ZIP inválida (${revision.motivo}).`);
  return clave;
}

/** El prefijo de un asset, para borrar todo lo suyo de una. */
export function prefijoDeAsset(partes: Omit<PartesClave, "nombre">): string {
  return [
    "originals",
    exigirId(partes.propietarioId, "propietarioId"),
    exigirId(partes.entidad, "entidad"),
    exigirId(partes.entidadId, "entidadId"),
    exigirId(partes.assetId, "assetId"),
  ].join("/");
}

// ------------------------------------------------------------
// Extensión y MIME
// ------------------------------------------------------------

/**
 * La extensión que corresponde a un MIME. Se usa cuando el nombre no
 * trae ninguna (pasa con las fotos que vienen de la cámara en Android)
 * o cuando trae una que miente.
 */
const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export function extensionDeMime(mime: string): string | null {
  return EXT_POR_MIME[mime.toLowerCase().split(";")[0].trim()] ?? null;
}

/**
 * Un nombre con la extensión que de verdad le corresponde al contenido.
 *
 * El MIME manda sobre lo que diga el nombre: un `.jpg` que en realidad
 * es HEIC se sirve mal en todos lados, y el navegador ya nos dijo cuál
 * es. Si el MIME no se conoce, se respeta lo que vino.
 */
export function nombreConExtension(nombre: string, mime: string): string {
  const limpio = sanitizarNombre(nombre);
  const esperada = extensionDeMime(mime);
  if (!esperada) return limpio;

  const punto = limpio.lastIndexOf(".");
  const base = punto > 0 ? limpio.slice(0, punto) : limpio;
  const actual = punto > 0 ? limpio.slice(punto + 1).toLowerCase() : "";

  // `jpeg` y `jpg` son la misma cosa: no vale la pena reescribir el
  // nombre que el cliente reconoce.
  if (actual === esperada || (esperada === "jpg" && actual === "jpeg")) return limpio;
  return `${base}.${esperada}`;
}
