/**
 * BOOKEA MEDIA — el vocabulario compartido de la capa multimedia.
 *
 * Hoy cada producto guarda sus fotos a su manera: `ranchos.fotos` es un
 * jsonb de URLs absolutas, `album_fotos.path` es una ruta suelta del
 * bucket, `invitaciones.imagenes_urls` es un text[]. Tres formas del
 * mismo concepto, y ninguna sabe cuánto pesa, qué mide ni dónde vive de
 * verdad el archivo.
 *
 * `media_assets` (migración 0110, todavía SIN escribir ni correr) va a
 * unificar eso sin tocar ninguna de las tres: las tablas viejas se
 * quedan como están y sirven de red de seguridad. Este módulo es el
 * vocabulario de esa capa.
 *
 * ── UN ASSET VIVE EN VARIOS LADOS A LA VEZ ───────────────────────────
 *
 * Acá NO hay un campo `provider`. Lo hubo, y estaba mal: un asset
 * migrado tiene el original en R2, la copia visual en Cloudflare Images
 * Y el fallback en Supabase, los tres al mismo tiempo. Un único valor
 * no puede describir eso sin mentir sobre dos de los tres.
 *
 * Dónde está cada cosa se DERIVA de los campos que lo dicen de verdad:
 * `r2_key`, `cf_image_id`, `legacy_url`, `estado` y el tipo de archivo.
 *
 * Módulo NEUTRAL a propósito (sin "use client"), igual que
 * src/lib/business/modulos.ts: sin red, sin SDK, sin `process.env`.
 */

// ------------------------------------------------------------
// 1. Visibilidad — tres niveles, no dos
// ------------------------------------------------------------

/**
 * Quién puede ver el archivo. Son TRES y no dos porque el álbum digital
 * no entra en ninguna de las dos categorías obvias: no es público (no
 * está listado en ningún lado y no debería indexarse) pero tampoco es
 * privado (el invitado que escanea el QR de la mesa no tiene cuenta y
 * nunca va a tenerla).
 *
 *   publica     ranchos, catálogo, equipo, invitaciones activas.
 *               URL directa, cacheable como `immutable`.
 *
 *   compartida  álbumes digitales. Se entra con el token del álbum
 *               (QR/link); validado el token, el servidor entrega URLs
 *               firmadas de vida corta. NO alcanza con que la URL sea
 *               difícil de adivinar.
 *
 *   privada     comprobantes de pago, cédulas de verificación, ZIP
 *               generados. Exigen sesión y dueño; nunca URL pública.
 */
export const VISIBILIDADES = ["publica", "compartida", "privada"] as const;

export type Visibilidad = (typeof VISIBILIDADES)[number];

/**
 * El default es el MÁS RESTRICTIVO, a propósito.
 *
 * Un default `publica` convierte cualquier olvido —una fila insertada
 * por un camino nuevo, un backfill apurado, un bug— en una filtración
 * silenciosa. Con `privada`, el mismo olvido produce una foto que no se
 * ve: molesto, visible, y arreglable sin que se haya expuesto nada.
 */
export const VISIBILIDAD_POR_DEFECTO: Visibilidad = "privada";

/**
 * Cómo se entrega cada nivel. Es una tabla y no un `if` desparramado
 * para que agregar un producto nuevo obligue a decidir esto una vez.
 */
export const ENTREGA: Record<Visibilidad, "directa" | "firmada"> = {
  publica: "directa",
  compartida: "firmada",
  privada: "firmada",
};

// ------------------------------------------------------------
// 2. Entidades — contra qué tabla se valida la propiedad
// ------------------------------------------------------------

/**
 * A qué cuelga cada archivo. No hay `tenant_id` en este producto: la
 * propiedad se resuelve por tres caminos distintos (`ranchos.owner_id`,
 * `albumes.cliente_id`, `invitaciones.cliente_id`), y este campo es el
 * que dice cuál de los tres aplica.
 */
export const ENTIDADES = [
  "rancho",
  "rancho_item",
  "equipo",
  "album",
  "invitacion",
  "comprobante",
  "verificacion",
] as const;

export type EntidadMedia = (typeof ENTIDADES)[number];

/**
 * La visibilidad que le corresponde a cada producto.
 *
 * No es un default silencioso: quien crea un asset la pide explícita a
 * esta función, y si algún día aparece una entidad nueva TypeScript
 * obliga a agregarla acá antes de compilar.
 */
export const VISIBILIDAD_DE_ENTIDAD: Record<EntidadMedia, Visibilidad> = {
  rancho: "publica",
  rancho_item: "publica",
  equipo: "publica",
  invitacion: "publica",
  // El QR de la mesa, no una cuenta (ver `Visibilidad`).
  album: "compartida",
  comprobante: "privada",
  verificacion: "privada",
};

export function visibilidadDeEntidad(entidad: EntidadMedia): Visibilidad {
  return VISIBILIDAD_DE_ENTIDAD[entidad];
}

// ------------------------------------------------------------
// 3. Tipos de archivo y MIME
// ------------------------------------------------------------

/**
 * Los MIME que se aceptan.
 *
 * HEIC y HEIF están en la lista y siguen SIN PROBAR contra nuestra
 * cuenta de Cloudflare Images. La apuesta es que Cloudflare los
 * decodifique del lado del servidor —hoy el canvas del navegador no
 * puede fuera de Safari, y el álbum termina descartando la foto en
 * silencio—, pero eso es una expectativa, no un hecho medido. Hasta que
 * exista la prueba con archivos reales de iPhone (iOS 17 y 18), tratar
 * el soporte HEIC como no confirmado.
 */
export const MIMES_IMAGEN = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export const MIMES_VIDEO = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const MIMES_AUDIO = ["audio/mpeg", "audio/mp4", "audio/ogg"] as const;

export const MIMES_PERMITIDOS = [...MIMES_IMAGEN, ...MIMES_VIDEO, ...MIMES_AUDIO] as const;

export type MimePermitido = (typeof MIMES_PERMITIDOS)[number];

export type TipoArchivo = "imagen" | "video" | "audio";

/**
 * El tope de una imagen: 10 MB, que es el máximo que acepta Cloudflare
 * Images por archivo.
 *
 * Una imagen más grande se RECHAZA antes de firmar la subida, y eso es
 * a propósito. La alternativa —guardarla solo en R2— produce una foto
 * nueva que no se puede mostrar en ninguna variante, que nunca puede
 * completar el flujo dual y que se queda en `parcial_r2` para siempre:
 * un asset roto por diseño, creado por nosotros. Mejor pedirle a la
 * persona una foto más liviana que aceptarle una que no vamos a poder
 * dibujar.
 *
 * Que hoy no molesta a nadie está medido: el archivo más pesado de todo
 * `ranchos-fotos` son 5702 KB (5,57 MB), y el promedio del bucket de
 * álbumes son 716 KB. Todo lo que ya existe entra sin tocar nada.
 *
 * Derivar una copia visual para originales de más de 10 MB
 * (recomprimir antes de mandarla a Cloudflare) es un bloque aparte.
 */
export const MAX_BYTES_IMAGEN = 10 * 1024 * 1024;

/**
 * ── LO QUE ESTO NO DEMUESTRA ─────────────────────────────────────────
 *
 * El MIME sale del `Content-Type` que declara el navegador, y un
 * `HEAD` contra R2 devuelve el `Content-Type` que se firmó — o sea, el
 * mismo dato que se está tratando de verificar. Ninguno de los dos
 * prueba qué hay ADENTRO del archivo: quien pide una URL prefirmada
 * puede declarar `image/jpeg` y subir cualquier cosa.
 *
 * La confirmación de la subida (bloque 3) tiene que leer los primeros
 * bytes del objeto y comparar la firma real (magic bytes) contra el
 * MIME declarado, y borrar el objeto si no coinciden. Esta tabla es un
 * filtro de entrada, no una verificación.
 */
function normalizarMime(mime: string): string {
  return mime.toLowerCase().split(";")[0].trim();
}

export function tipoDeMime(mime: unknown): TipoArchivo | null {
  if (typeof mime !== "string") return null;
  const m = normalizarMime(mime);
  if ((MIMES_IMAGEN as readonly string[]).includes(m)) return "imagen";
  if ((MIMES_VIDEO as readonly string[]).includes(m)) return "video";
  if ((MIMES_AUDIO as readonly string[]).includes(m)) return "audio";
  return null;
}

export function esMimePermitido(mime: unknown): boolean {
  return tipoDeMime(mime) !== null;
}

// ------------------------------------------------------------
// 4. Estado y destinos obligatorios
// ------------------------------------------------------------

/**
 * La máquina de estados de la subida.
 *
 * Los dos estados PARCIALES existen porque las dos cargas pueden fallar
 * por separado y hay que poder reintentar solo la que falló, sin volver
 * a subir 30 MB al pedo.
 */
export const ESTADOS = [
  "pendiente",
  "subiendo",
  "parcial_r2",
  "parcial_cf",
  "listo",
  "error",
  "huerfano",
] as const;

export type EstadoMedia = (typeof ESTADOS)[number];

/** Los estados desde los que un reintento tiene sentido. */
export const ESTADOS_REINTENTABLES: readonly EstadoMedia[] = [
  "pendiente",
  "subiendo",
  "parcial_r2",
  "parcial_cf",
  "error",
];

/**
 * Qué destinos tiene que tener confirmados un archivo de este tipo para
 * poder considerarse completo.
 *
 * El original en R2 es obligatorio SIEMPRE: es lo que se descarga, y sin
 * él no se puede prometer una descarga.
 *
 * La copia visual en Cloudflare Images solo aplica a imágenes. Un video
 * o un audio no tienen "variante thumb": exigirles Cloudflare los
 * dejaría colgados en `parcial_r2` para siempre, sin nada que
 * reintentar.
 */
export function destinosRequeridos(tipo: TipoArchivo): { r2: boolean; cloudflare: boolean } {
  return { r2: true, cloudflare: tipo === "imagen" };
}

// ------------------------------------------------------------
// 5. El asset
// ------------------------------------------------------------

/**
 * Una fila de `media_assets`, tal como la declara la migración 0110.
 *
 * Sin campo `provider`: dónde vive el archivo se deriva de `r2_key`,
 * `cf_image_id` y `legacy_url` (ver el encabezado del módulo).
 */
export type MediaAsset = {
  id: string;
  propietario_id: string | null;
  entity_type: EntidadMedia;
  entity_id: string;

  visibilidad: Visibilidad;
  estado: EstadoMedia;

  /**
   * El id en Cloudflare Images (la copia que se MIRA).
   *
   * OJO: existe desde el Direct Creator Upload, con la imagen en
   * BORRADOR y sin un solo byte. No prueba nada por sí solo.
   */
  cf_image_id: string | null;
  /** Cuándo se comprobó CONTRA Cloudflare que la imagen está subida. */
  cf_verificado_en: string | null;

  /**
   * La clave en R2 (el original que se DESCARGA).
   *
   * OJO: se RESERVA antes de subir, para poder firmar la URL de carga.
   * Una fila en `pendiente` ya la tiene y no hay objeto detrás.
   */
  r2_key: string | null;
  /** Cuándo se comprobó CONTRA R2 (HEAD) que el objeto existe. */
  r2_verificado_en: string | null;

  /**
   * La URL de Supabase de toda la vida. No se vacía nunca mientras
   * exista una app publicada que pueda pedirla: es el fallback.
   */
  legacy_url: string | null;

  nombre_original: string | null;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  /** Informativo: sirve para deduplicar y verificar la copia. NO es único. */
  checksum_sha256: string | null;

  posicion: number;
  created_at: string;
  updated_at: string;
  error_en: string | null;
  error_detalle: string | null;
  deleted_at: string | null;
};

/**
 * Lo mínimo que hace falta para saber si un asset está completo.
 *
 * Incluye los DOS sellos: sin ellos no se puede responder la pregunta,
 * solo adivinarla a partir de unas claves que existen desde antes de
 * que exista ningún archivo.
 */
export type AssetVerificable = Pick<
  MediaAsset,
  | "estado"
  | "deleted_at"
  | "mime"
  | "r2_key"
  | "r2_verificado_en"
  | "cf_image_id"
  | "cf_verificado_en"
>;

// ------------------------------------------------------------
// 6. Variantes de Cloudflare Images
// ------------------------------------------------------------

/**
 * Las cuatro variantes YA CREADAS en la cuenta de Cloudflare. Los
 * números están acá porque el frontend necesita saberlos para poner
 * `width`/`height` explícitos y no provocar saltos de maqueta (CLS).
 *
 * `gallery` es "Scale down" y no "Cover": el visor conserva la
 * proporción real de cada foto, así que 1600 es el LADO MAYOR, no un
 * recorte. Por eso su `alto` es el mismo número que su `ancho` — es una
 * caja que contiene, no un marco que recorta.
 */
export const VARIANTES = ["thumb", "card", "gallery", "hero"] as const;

export type Variante = (typeof VARIANTES)[number];

type DefinicionVariante = {
  id: Variante;
  ancho: number;
  alto: number;
  ajuste: "cover" | "scale-down";
  uso: string;
};

export const DEFINICION_VARIANTE: Record<Variante, DefinicionVariante> = {
  thumb: { id: "thumb", ancho: 400, alto: 400, ajuste: "cover", uso: "Cuadrículas y miniaturas." },
  card: { id: "card", ancho: 768, alto: 576, ajuste: "cover", uso: "Tarjetas de directorio." },
  gallery: {
    id: "gallery",
    ancho: 1600,
    alto: 1600,
    ajuste: "scale-down",
    uso: "Visor ampliado; conserva la proporción real.",
  },
  hero: { id: "hero", ancho: 1920, alto: 1080, ajuste: "cover", uso: "Portadas a lo ancho." },
};

// ------------------------------------------------------------
// 7. Guardas de tipo
// ------------------------------------------------------------

/**
 * Todo lo que llega de la base o del navegador pasa por acá antes de
 * tratarse como un valor del dominio. Un valor que el código no conoce
 * NUNCA se asume válido: se rechaza, que es lo que evita que un estado
 * inventado se comporte como `listo`.
 */
function esUnoDe<T extends string>(lista: readonly T[], valor: unknown): valor is T {
  return typeof valor === "string" && (lista as readonly string[]).includes(valor);
}

export const esVisibilidad = (v: unknown): v is Visibilidad => esUnoDe(VISIBILIDADES, v);
export const esEstado = (v: unknown): v is EstadoMedia => esUnoDe(ESTADOS, v);
export const esEntidad = (v: unknown): v is EntidadMedia => esUnoDe(ENTIDADES, v);
export const esVariante = (v: unknown): v is Variante => esUnoDe(VARIANTES, v);

// ------------------------------------------------------------
// 8. Preguntas que se hacen en todos lados
// ------------------------------------------------------------

/** Vivo = no borrado lógicamente. El borrado duro es del worker. */
export function estaVivo(asset: Pick<MediaAsset, "deleted_at">): boolean {
  return asset.deleted_at === null || asset.deleted_at === undefined;
}

/**
 * ── UNA CLAVE NO ES UN ARCHIVO ───────────────────────────────────────
 *
 * Estas dos funciones son la diferencia entre "reservamos un lugar" y
 * "el archivo está ahí", y de ellas depende todo lo demás:
 *
 *   · `r2_key` se calcula ANTES de subir, para poder firmar la URL de
 *     carga. Una fila recién creada ya la tiene.
 *
 *   · `cf_image_id` lo devuelve Cloudflare al pedir un Direct Creator
 *     Upload, o sea cuando la imagen todavía es un BORRADOR y no
 *     recibió un solo byte.
 *
 * Confirmado = la clave Y el sello que se escribe después de comprobar
 * contra el proveedor. Las restricciones de la 0110 exigen lo mismo del
 * lado de la base.
 */
export function r2Confirmado(
  asset: Pick<AssetVerificable, "r2_key" | "r2_verificado_en">,
): boolean {
  return Boolean(asset.r2_key) && Boolean(asset.r2_verificado_en);
}

export function cloudflareConfirmado(
  asset: Pick<AssetVerificable, "cf_image_id" | "cf_verificado_en">,
): boolean {
  return Boolean(asset.cf_image_id) && Boolean(asset.cf_verificado_en);
}

/**
 * Qué destinos le FALTAN a un asset para estar completo, según su tipo.
 *
 * Un MIME que no se reconoce devuelve los dos: no se puede saber qué
 * exigirle, así que no se le da por cumplido nada. Fallar conservador es
 * la regla — un asset mal formado nunca se comporta como completo.
 */
export function faltantes(
  asset: Pick<
    AssetVerificable,
    "mime" | "r2_key" | "r2_verificado_en" | "cf_image_id" | "cf_verificado_en"
  >,
) {
  const tipo = tipoDeMime(asset.mime);
  const requeridos = tipo ? destinosRequeridos(tipo) : { r2: true, cloudflare: true };
  const falta: ("cloudflare" | "r2")[] = [];
  if (requeridos.r2 && !r2Confirmado(asset)) falta.push("r2");
  if (requeridos.cloudflare && !cloudflareConfirmado(asset)) falta.push("cloudflare");
  return falta;
}

/**
 * Listo de verdad.
 *
 * NO alcanza con que la columna diga `listo`: se verifica que estén
 * CONFIRMADOS los destinos que ese tipo exige. Una fila marcada lista a
 * la que le falta el sello de R2 es un registro inconsistente —pasó por
 * un camino que no verificó, o alguien la editó a mano— y tratarla como
 * buena produce una foto rota o una descarga que devuelve 404.
 *
 *   · imagen      → R2 confirmado Y Cloudflare confirmado;
 *   · video/audio → solo R2 confirmado (no tienen copia visual).
 *
 * Que el chequeo viva acá y no en cada pantalla es el punto: hay UNA
 * definición de "listo" en todo el producto.
 */
export function estaListo(asset: AssetVerificable): boolean {
  if (!estaVivo(asset)) return false;
  if (asset.estado !== "listo") return false;
  // Sin MIME reconocible no se puede saber qué destinos exigirle.
  if (tipoDeMime(asset.mime) === null) return false;
  return faltantes(asset).length === 0;
}

/**
 * Una fila que dice `listo` pero no lo está. Se separa de `estaListo`
 * porque el que importa para MOSTRAR es el booleano, y este es para
 * poder registrarlo y arreglarlo.
 */
export function esInconsistente(asset: AssetVerificable): boolean {
  return estaVivo(asset) && asset.estado === "listo" && !estaListo(asset);
}

export function sePuedeReintentar(asset: Pick<MediaAsset, "estado" | "deleted_at">): boolean {
  return estaVivo(asset) && ESTADOS_REINTENTABLES.includes(asset.estado);
}

/**
 * El estado que corresponde según qué destinos se confirmaron y qué
 * tipo de archivo es. Es la ÚNICA función que puede devolver `listo`,
 * para que no haya dos criterios distintos dando vueltas.
 *
 * ── VIDEO Y AUDIO: CLOUDFLARE NO SE MIRA ─────────────────────────────
 *
 * Para los tipos que no llevan copia visual, `destinos.cloudflare` se
 * descarta ENTERO y la función sale antes de llegar a los estados
 * parciales. La versión anterior neutralizaba Cloudflare solo para
 * decidir `listo`, pero después caía en `if (destinos.cloudflare)` sin
 * volver a preguntar si era requerido: un video con `r2: false` y
 * `cloudflare: true` respondía `parcial_cf`, o sea "la copia visual
 * está lista", sobre un archivo que no tiene copia visual y al que le
 * falta lo único que importa. Y `parcial_cf` es reintentable, así que
 * el reintento habría ido a buscar la mitad equivocada.
 *
 * Un `cloudflare: true` sobre un video es un dato imposible; acá se
 * ignora en vez de dejar que decida nada.
 */
export function estadoSegunDestinos(
  destinos: { r2: boolean; cloudflare: boolean },
  tipo: TipoArchivo,
): EstadoMedia {
  const requeridos = destinosRequeridos(tipo);

  // R2-only (video y audio): solo cuenta el original.
  if (!requeridos.cloudflare) return destinos.r2 ? "listo" : "subiendo";

  // Imágenes: los dos destinos, con sus dos estados parciales.
  if (destinos.r2 && destinos.cloudflare) return "listo";
  if (destinos.r2) return "parcial_r2";
  if (destinos.cloudflare) return "parcial_cf";
  return "subiendo";
}
