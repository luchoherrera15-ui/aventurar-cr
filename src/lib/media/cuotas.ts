/**
 * BOOKEA MEDIA — los límites, en un solo lugar.
 *
 * Todo esto ya existía repartido y en desacuerdo consigo mismo: el
 * álbum decía 500 en la página (`MAX_FOTOS_ALBUM`) y 500 en la política
 * de la base (0068), la zona de subida de invitaciones tenía sus propios
 * topes por tipo, y la compresión definía otros. Acá se juntan para que
 * cambiar un número sea cambiarlo una vez.
 *
 * ── LOS DOS LÍMITES DEL ÁLBUM, QUE NO SON EL MISMO ───────────────────
 *
 *   COMERCIAL (160)  lo que se le vende a un cliente y lo que se valida
 *                    al SUBIR. Es de producto: se puede mover por plan.
 *
 *   TECNICO (500)    lo que aguanta la infraestructura y lo que impone
 *                    la RLS de 0068. Es un techo duro.
 *
 * Que sean dos números y no uno es lo que permite que el álbum que hoy
 * tiene 164 fotos en producción SIGA SIENDO VÁLIDO. Un límite único de
 * 160 lo dejaría en un estado imposible: por encima del máximo, sin
 * haber hecho nada malo. Acá ese álbum está completo —no acepta fotos
 * nuevas— pero es perfectamente legal, se ve entero y se descarga
 * entero.
 *
 * La regla, en una línea: **el límite comercial se aplica a lo que
 * ENTRA, nunca a lo que YA ESTÁ.**
 *
 * Módulo puro: sin red, sin base, sin `process.env`.
 */

// ------------------------------------------------------------
// 1. Álbumes
// ------------------------------------------------------------

/** Lo que se le promete a un cliente y lo que se valida al subir. */
export const LIMITE_COMERCIAL_ALBUM = 160;

/** El techo duro de la infraestructura y de la RLS (0068). */
export const LIMITE_TECNICO_ALBUM = 500;

/** Cuántas fotos se aceptan de un solo golpe. */
export const MAX_POR_TANDA = 10;

/** Cuántas subidas viajan a la vez (pedido explícito: no más de 3). */
export const MAX_SUBIDAS_SIMULTANEAS = 3;

/** Cuántas fotos se piden en la primera pantalla del álbum. */
export const PAGINA_ALBUM = 20;

export type EstadoAlbum = "con-lugar" | "lleno-comercial" | "lleno-tecnico";

/**
 * En qué situación está un álbum según cuántas fotos tiene.
 *
 * `lleno-comercial` NO es un error: es un álbum sano que llegó a su
 * cupo. El de 164 fotos cae acá, igual que uno de exactamente 160.
 */
export function estadoAlbum(actuales: number, limitePlan = LIMITE_COMERCIAL_ALBUM): EstadoAlbum {
  if (actuales >= LIMITE_TECNICO_ALBUM) return "lleno-tecnico";
  if (actuales >= limitePlan) return "lleno-comercial";
  return "con-lugar";
}

/**
 * Un álbum es válido mientras no pase el techo TÉCNICO. Pasar el límite
 * comercial no lo invalida: solo lo deja sin cupo.
 *
 * Existe como función propia y no como comparación suelta para que
 * quede escrito, y para que nadie "arregle" el álbum de 164 borrándole
 * cuatro fotos a un cliente.
 */
export function albumEsValido(actuales: number): boolean {
  return actuales <= LIMITE_TECNICO_ALBUM;
}

export type MotivoRechazo =
  | "album-lleno"
  | "tope-tecnico"
  | "tanda-muy-grande"
  | "cantidad-invalida";

export type ResultadoCupo = {
  ok: boolean;
  /** Cuántas de las pedidas entran. Puede ser menos que las pedidas. */
  permitidas: number;
  motivo?: MotivoRechazo;
  /** Texto listo para mostrar, en español de Costa Rica. */
  mensaje?: string;
};

/**
 * ¿Caben estas fotos en este álbum?
 *
 * Devuelve cuántas entran y no solo un sí/no: si alguien elige 10 fotos
 * y quedan 3 lugares, subir 3 es mejor que rechazar las 10 — y eso lo
 * decide quien llama, con este número en la mano.
 */
export function puedeAgregarFotos(params: {
  actuales: number;
  aAgregar: number;
  /** El cupo del plan del cliente; por defecto el comercial. */
  limitePlan?: number;
}): ResultadoCupo {
  const { actuales, aAgregar } = params;
  const limitePlan = params.limitePlan ?? LIMITE_COMERCIAL_ALBUM;

  if (!Number.isInteger(aAgregar) || aAgregar <= 0 || !Number.isInteger(actuales) || actuales < 0) {
    return { ok: false, permitidas: 0, motivo: "cantidad-invalida" };
  }

  if (aAgregar > MAX_POR_TANDA) {
    return {
      ok: false,
      permitidas: MAX_POR_TANDA,
      motivo: "tanda-muy-grande",
      mensaje: `Máximo ${MAX_POR_TANDA} fotos por tanda — se toman las primeras ${MAX_POR_TANDA}.`,
    };
  }

  // El techo técnico manda sobre el comercial: aunque un plan diga 800,
  // la base no acepta más de 500.
  const tope = Math.min(limitePlan, LIMITE_TECNICO_ALBUM);
  const lugar = Math.max(0, tope - actuales);

  if (lugar === 0) {
    const porTecnico = actuales >= LIMITE_TECNICO_ALBUM;
    return {
      ok: false,
      permitidas: 0,
      motivo: porTecnico ? "tope-tecnico" : "album-lleno",
      mensaje: porTecnico
        ? "Este álbum llegó a su tope técnico y no acepta más fotos."
        : `El álbum llegó a su tope de ${tope} fotos. ¡Gracias por tanto recuerdo!`,
    };
  }

  if (aAgregar > lugar) {
    return {
      ok: true,
      permitidas: lugar,
      motivo: "album-lleno",
      mensaje: `Solo quedan ${lugar} lugar${lugar === 1 ? "" : "es"} en el álbum — se suben ${lugar}.`,
    };
  }

  return { ok: true, permitidas: aAgregar };
}

// ------------------------------------------------------------
// 2. Archivos
// ------------------------------------------------------------

/**
 * Los MIME que se aceptan como foto.
 *
 * HEIC y HEIF están en la lista A PROPÓSITO y con una advertencia: hoy
 * el compresor del navegador (canvas) NO los puede decodificar fuera de
 * Safari, y el álbum termina descartando la foto en silencio. La
 * apuesta es que Cloudflare Images los decodifique del lado del
 * servidor — pero eso está SIN PROBAR con archivos reales de iPhone.
 * Hasta que la prueba exista, quien acepte HEIC tiene que mandar el
 * original a R2 y tolerar que la copia visual falle.
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

export type TipoArchivo = "imagen" | "video" | "audio";

/** Tope por archivo, por tipo. */
export const MAX_BYTES: Record<TipoArchivo, number> = {
  // 25 MB cubre un HEIC de iPhone 15 en máxima calidad con margen.
  imagen: 25 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
};

/**
 * El tope de Cloudflare Images por archivo. Un original más grande
 * igual va a R2 (la descarga se conserva intacta); lo que no se puede
 * es mandarlo tal cual a Cloudflare.
 */
export const MAX_BYTES_CLOUDFLARE = 10 * 1024 * 1024;

function normalizarMime(mime: string): string {
  return mime.toLowerCase().split(";")[0].trim();
}

export function tipoDeMime(mime: string): TipoArchivo | null {
  const m = normalizarMime(mime);
  if ((MIMES_IMAGEN as readonly string[]).includes(m)) return "imagen";
  if ((MIMES_VIDEO as readonly string[]).includes(m)) return "video";
  if ((MIMES_AUDIO as readonly string[]).includes(m)) return "audio";
  return null;
}

export function esMimePermitido(mime: unknown): boolean {
  return typeof mime === "string" && tipoDeMime(mime) !== null;
}

/** ¿Hay que mandarlo a Cloudflare Images o solo a R2? */
export function admiteCopiaVisual(mime: string, bytes: number): boolean {
  return tipoDeMime(mime) === "imagen" && bytes <= MAX_BYTES_CLOUDFLARE;
}

export type ArchivoInvalido = "mime-no-permitido" | "muy-pesado" | "vacio" | "tamano-invalido";

export type ResultadoArchivo =
  | { ok: true; tipo: TipoArchivo; copiaVisual: boolean }
  | { ok: false; motivo: ArchivoInvalido; mensaje: string };

/**
 * La validación que corre en el SERVIDOR antes de firmar nada.
 *
 * El navegador ya filtra, pero eso es comodidad: quien pide una URL
 * prefirmada puede saltarse la pantalla entera. Este es el control que
 * cuenta.
 */
export function validarArchivo(params: { mime: unknown; bytes: unknown }): ResultadoArchivo {
  const { mime, bytes } = params;

  if (typeof mime !== "string" || !esMimePermitido(mime)) {
    return {
      ok: false,
      motivo: "mime-no-permitido",
      mensaje: "Ese tipo de archivo no se puede subir. Probá con una foto JPG, PNG o WebP.",
    };
  }
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return { ok: false, motivo: "tamano-invalido", mensaje: "No se pudo leer el tamaño del archivo." };
  }
  if (bytes === 0) {
    return { ok: false, motivo: "vacio", mensaje: "Ese archivo está vacío." };
  }

  const tipo = tipoDeMime(mime) as TipoArchivo;
  if (bytes > MAX_BYTES[tipo]) {
    const mb = Math.round(MAX_BYTES[tipo] / 1024 / 1024);
    return {
      ok: false,
      motivo: "muy-pesado",
      mensaje: `Ese archivo pesa más de ${mb} MB. Probá con uno más liviano.`,
    };
  }

  return { ok: true, tipo, copiaVisual: admiteCopiaVisual(mime, bytes) };
}

// ------------------------------------------------------------
// 3. Cuotas por cuenta y por negocio
// ------------------------------------------------------------

export type Plan = "gratis" | "basico" | "pro";

export type LimitesPlan = {
  /** Fotos por álbum. Nunca puede pasar `LIMITE_TECNICO_ALBUM`. */
  fotosPorAlbum: number;
  /** Cuántos álbumes puede tener abiertos la cuenta. */
  albumesPorCuenta: number;
  /** Fotos en la galería de UN negocio. */
  fotosPorNegocio: number;
  /** Almacenamiento total de la cuenta, en bytes. */
  bytesPorCuenta: number;
  /** ZIP vigentes a la vez; el más viejo se descarta. */
  zipsVigentes: number;
};

export const LIMITES_PLAN: Record<Plan, LimitesPlan> = {
  gratis: {
    fotosPorAlbum: LIMITE_COMERCIAL_ALBUM,
    albumesPorCuenta: 1,
    fotosPorNegocio: 20,
    bytesPorCuenta: 2 * 1024 * 1024 * 1024,
    zipsVigentes: 1,
  },
  basico: {
    fotosPorAlbum: LIMITE_COMERCIAL_ALBUM,
    albumesPorCuenta: 5,
    fotosPorNegocio: 40,
    bytesPorCuenta: 10 * 1024 * 1024 * 1024,
    zipsVigentes: 3,
  },
  pro: {
    fotosPorAlbum: LIMITE_TECNICO_ALBUM,
    albumesPorCuenta: 25,
    fotosPorNegocio: 80,
    bytesPorCuenta: 50 * 1024 * 1024 * 1024,
    zipsVigentes: 10,
  },
};

export function limitesDe(plan: unknown): LimitesPlan {
  // Un plan que el código no conoce se trata como el más chico, no como
  // el más grande: si mañana aparece "enterprise" y nadie lo declaró
  // acá, que falte cupo es un aviso; que sobre, un agujero.
  return typeof plan === "string" && plan in LIMITES_PLAN
    ? LIMITES_PLAN[plan as Plan]
    : LIMITES_PLAN.gratis;
}

/** ¿Entra un archivo más en la cuota de almacenamiento de la cuenta? */
export function cabeEnCuota(params: {
  usados: number;
  aAgregar: number;
  plan?: Plan;
}): { ok: boolean; disponibles: number; mensaje?: string } {
  const limite = limitesDe(params.plan).bytesPorCuenta;
  const disponibles = Math.max(0, limite - params.usados);
  if (params.aAgregar > disponibles) {
    return {
      ok: false,
      disponibles,
      mensaje: "Se acabó el espacio de la cuenta. Liberá archivos o pasate a un plan más grande.",
    };
  }
  return { ok: true, disponibles };
}

// ------------------------------------------------------------
// 4. ZIP
// ------------------------------------------------------------

/** Cuánto vive un ZIP generado antes de que se pueda borrar. */
export const HORAS_VIGENCIA_ZIP = 48;

/**
 * La firma del contenido de un álbum. Si cambia, el ZIP guardado ya no
 * corresponde y hay que regenerarlo.
 *
 * Incluye el ORDEN a propósito: reordenar fotos cambia el ZIP (los
 * nombres van numerados), así que un ZIP viejo entregaría los archivos
 * con la numeración equivocada.
 */
export function firmaDeAlbum(fotoIds: readonly string[]): string {
  return `${fotoIds.length}:${fotoIds.join(",")}`;
}

export function zipSigueValido(params: {
  firmaGuardada: string | null;
  fotoIdsActuales: readonly string[];
  generadoEn: Date | null;
  ahora: Date;
}): boolean {
  const { firmaGuardada, fotoIdsActuales, generadoEn, ahora } = params;
  if (!firmaGuardada || !generadoEn) return false;
  if (firmaGuardada !== firmaDeAlbum(fotoIdsActuales)) return false;
  const horas = (ahora.getTime() - generadoEn.getTime()) / 3_600_000;
  return horas >= 0 && horas < HORAS_VIGENCIA_ZIP;
}
