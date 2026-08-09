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
 * ── POR QUÉ ESTE MÓDULO NO IMPORTA NADA ──────────────────────────────
 *
 * Funciones y tablas puras, cero red, cero SDK, cero `process.env`. Se
 * puede leer desde el servidor, desde el navegador y desde los tests sin
 * arrastrar nada. Los adaptadores que SÍ hablan con Cloudflare y con R2
 * llegan en el bloque siguiente y son solo-servidor.
 *
 * Ojo con la frontera "use client" ↔ servidor: este archivo es NEUTRAL a
 * propósito (sin "use client"), igual que src/lib/business/modulos.ts.
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
 *
 * La 0110 va a declarar esta misma constante como default de columna, y
 * cada camino de subida tiene que decir explícitamente qué visibilidad
 * quiere (ver `visibilidadDeEntidad`).
 */
export const VISIBILIDAD_POR_DEFECTO: Visibilidad = "privada";

/** Etiquetas para el panel del dueño y el admin. */
export const VISIBILIDAD_LABEL: Record<Visibilidad, string> = {
  publica: "Pública",
  compartida: "Con enlace",
  privada: "Privada",
};

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
 * obliga a agregarla acá antes de compilar. Es lo contrario de que se
 * cuele con el valor de otro.
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
// 3. Proveedor y estado
// ------------------------------------------------------------

/**
 * Dónde vive HOY este archivo.
 *
 * `supabase_legacy` no es un estado transitorio ni una vergüenza: es el
 * proveedor de todo lo que ya existe, y va a seguir sirviendo fotos
 * mientras haya una sola app publicada apuntando a esas URLs. Nada lo
 * apura.
 */
export const PROVEEDORES = ["supabase_legacy", "cloudflare", "r2"] as const;

export type Provider = (typeof PROVEEDORES)[number];

/**
 * La máquina de estados de una subida doble (original a R2 + copia
 * visual a Cloudflare Images).
 *
 * Los dos estados PARCIALES existen porque las dos cargas pueden fallar
 * por separado y hay que poder reintentar solo la que falló, sin volver
 * a subir 30 MB al pedo. `listo` exige las DOS verificadas con HEAD: un
 * asset a medias que se marque listo es una foto rota en producción.
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

// ------------------------------------------------------------
// 4. Variantes de Cloudflare Images
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
  /** Para qué se usa, en palabras de la maqueta. */
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
// 5. El asset
// ------------------------------------------------------------

/**
 * Una fila de `media_assets`, tal como la va a declarar la 0110.
 *
 * Los campos anulables lo son de verdad: un asset recién creado no tiene
 * `cf_image_id` todavía, y uno que viene del pasado no tiene `r2_key`
 * pero sí `legacy_url`. El resolver está hecho para eso.
 */
export type MediaAsset = {
  id: string;
  propietario_id: string | null;
  entity_type: EntidadMedia;
  entity_id: string;

  provider: Provider;
  visibilidad: Visibilidad;
  estado: EstadoMedia;

  /** El id en Cloudflare Images (la copia que se MIRA). */
  cf_image_id: string | null;
  /** La clave en R2 (el original que se DESCARGA). */
  r2_key: string | null;
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
  deleted_at: string | null;
  error_detalle: string | null;
};

// ------------------------------------------------------------
// 6. Guardas de tipo
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
export const esProvider = (v: unknown): v is Provider => esUnoDe(PROVEEDORES, v);
export const esEstado = (v: unknown): v is EstadoMedia => esUnoDe(ESTADOS, v);
export const esEntidad = (v: unknown): v is EntidadMedia => esUnoDe(ENTIDADES, v);
export const esVariante = (v: unknown): v is Variante => esUnoDe(VARIANTES, v);

// ------------------------------------------------------------
// 7. Preguntas que se hacen en todos lados
// ------------------------------------------------------------

/** Vivo = no borrado lógicamente. El borrado duro es del worker. */
export function estaVivo(asset: Pick<MediaAsset, "deleted_at">): boolean {
  return asset.deleted_at === null || asset.deleted_at === undefined;
}

/**
 * Listo de verdad: los dos destinos verificados y el asset sin borrar.
 * Un `parcial_*` NO es listo, por más que una de las dos copias sirva.
 */
export function estaListo(asset: Pick<MediaAsset, "estado" | "deleted_at">): boolean {
  return estaVivo(asset) && asset.estado === "listo";
}

export function sePuedeReintentar(asset: Pick<MediaAsset, "estado" | "deleted_at">): boolean {
  return estaVivo(asset) && ESTADOS_REINTENTABLES.includes(asset.estado);
}

/** Qué le falta a un asset para poder marcarse `listo`. */
export function faltantes(
  asset: Pick<MediaAsset, "cf_image_id" | "r2_key">,
): ("cloudflare" | "r2")[] {
  const falta: ("cloudflare" | "r2")[] = [];
  if (!asset.cf_image_id) falta.push("cloudflare");
  if (!asset.r2_key) falta.push("r2");
  return falta;
}

/**
 * El estado que corresponde según qué destinos se confirmaron. Es la
 * ÚNICA función que puede devolver `listo`, para que no haya dos
 * criterios distintos dando vueltas.
 */
export function estadoSegunDestinos(destinos: {
  r2: boolean;
  cloudflare: boolean;
}): EstadoMedia {
  if (destinos.r2 && destinos.cloudflare) return "listo";
  if (destinos.r2) return "parcial_r2";
  if (destinos.cloudflare) return "parcial_cf";
  return "subiendo";
}

/** Ordena una galería: por `posicion` y, a igual posición, por antigüedad. */
export function ordenarAssets<T extends Pick<MediaAsset, "posicion" | "created_at">>(
  assets: readonly T[],
): T[] {
  return [...assets].sort(
    (a, b) => a.posicion - b.posicion || a.created_at.localeCompare(b.created_at),
  );
}
