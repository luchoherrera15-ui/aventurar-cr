/**
 * BOOKEA MEDIA — la firma REAL de un archivo subido.
 *
 * ⚠️  MÓDULO EXCLUSIVO DE SERVIDOR (`import "server-only"`, abajo).
 *
 * ── QUÉ PROBLEMA RESUELVE ────────────────────────────────────────────
 *
 * Nada de lo que sabemos de un archivo subido viene del archivo:
 *
 *   · la extensión la eligió quien subió;
 *   · el nombre, también;
 *   · el `Content-Type` lo declaró el navegador;
 *   · y el `Content-Type` que guarda R2 es EL MISMO que se firmó en la
 *     URL de carga — o sea, el dato que se quería comprobar.
 *
 * Por eso `verificarMetadatosOriginal()` (r2.ts) no alcanza: compara el
 * tamaño y un tipo declarado contra otro tipo declarado. Este módulo
 * abre el archivo y mira los primeros bytes.
 *
 * ── LO QUE ESTO **NO** DEMUESTRA ─────────────────────────────────────
 *
 * Hay que leer esta lista antes de usar el resultado para nada:
 *
 *   1. La firma es EVIDENCIA DE FORMATO, no validación del archivo. Que
 *      los primeros bytes digan JPEG no dice nada de los últimos.
 *   2. NO demuestra integridad: un JPEG truncado a la mitad tiene la
 *      misma cabecera que uno entero.
 *   3. NO descarta contenido POLYGLOT — un archivo válido como JPEG y
 *      como otra cosa a la vez.
 *   4. NO demuestra que un contenedor MP4/WebM/MOV tenga pista de video:
 *      eso exige llegar a `moov → trak → hdlr`, que puede estar al FINAL
 *      del archivo. Por eso esos tres siempre dan `inconcluso`.
 *   5. NO calcula SHA-256 ni ningún checksum.
 *   6. `file-type` hace detección de MEJOR ESFUERZO. No es un validador.
 *
 * ⛔ Un veredicto que NO sea `compatible` NO autoriza a escribir
 *    `r2_verificado_en`. Y `compatible` tampoco alcanza por sí solo:
 *    es condición necesaria, no suficiente — hace falta además la
 *    comprobación de metadatos.
 */

// La barrera. Primero que todo.
import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { revisarClave } from "./claves";
import { prepararClienteR2, type DependenciasR2 } from "./r2";
import { esMimePermitido, type MimePermitido } from "./tipos";

// ------------------------------------------------------------
// Cuánto se lee
// ------------------------------------------------------------

/**
 * El tope de la MUESTRA que se baja de R2: 64 KiB.
 *
 * Es una constante nuestra y una decisión de coste, NO un mínimo
 * requerido por nadie ni una garantía de que alcance. `file-type`
 * muestrea 4100 bytes por defecto, que le sobra para las firmas cortas;
 * 64 KiB da margen para cabeceras que empiezan más adentro (un ID3v2
 * grande antes del primer frame MP3, un `ftyp` precedido de otras cajas)
 * sin acercarse a descargar el archivo.
 *
 * Un archivo con metadatos ENORMES —una carátula de varios MB en el ID3,
 * por ejemplo— puede tener su firma fuera de estos 64 KiB. Ese caso
 * termina en `desconocido` o `inconcluso`, nunca en un falso
 * `compatible`.
 */
export const MAX_BYTES_MUESTRA = 65_536;

/** El header exacto que se le pide a R2. */
export const RANGO_MUESTRA = `bytes=0-${MAX_BYTES_MUESTRA - 1}`;

// ------------------------------------------------------------
// Resultado
// ------------------------------------------------------------

/**
 *   compatible   la firma detectada corresponde al MIME declarado;
 *   incompatible se detectó OTRO tipo — el archivo miente;
 *   inconcluso   el contenedor se reconoce pero la muestra no permite
 *                demostrar el subtipo (video vs audio, sobre todo);
 *   desconocido  `file-type` no reconoció ningún formato.
 */
export type Veredicto = "compatible" | "incompatible" | "inconcluso" | "desconocido";

export type CodigoErrorFirma =
  | "solo-servidor"
  | "config-incompleta"
  | "clave-invalida"
  | "mime-no-permitido"
  | "sin-cuerpo"
  | "cuerpo-ilegible"
  | "archivo-vacio"
  | "lectura-excesiva"
  | "fallo-deteccion"
  | "no-existe"
  | "fallo-proveedor";

export type ErrorFirma = {
  codigo: CodigoErrorFirma;
  /** Apto para un log: sin credenciales, sin URLs, sin bucket, sin clave. */
  mensaje: string;
};

export type ResultadoFirma<T> = { ok: true; valor: T } | { ok: false; error: ErrorFirma };

/** Lo que traen las cuatro variantes por igual. */
type CamposComunes = {
  mimeDeclarado: MimePermitido;
  /** Lo que detectó `file-type`, EXACTO. Nunca se maquilla. */
  mimeDetectado: string | null;
  extensionDetectada: string | null;
  bytesLeidos: number;
  /** Por qué ese veredicto, en una frase, para el log y el panel. */
  motivo: string;
  /**
   * Si se aplicó una equivalencia de familia (APNG dentro de PNG,
   * `audio/ogg; codecs=opus` dentro de `audio/ogg`, `audio/x-m4a` dentro
   * de `audio/mp4`). Se informa SIEMPRE: no se oculta que el tipo exacto
   * detectado era otro.
   */
  equivalencia: string | null;
  /**
   * `true` cuando la detección es especialmente frágil (MP3). Sigue sin
   * demostrar integridad, igual que el resto.
   */
  mejorEsfuerzo: boolean;
};

/**
 * ── POR QUÉ CUATRO TIPOS Y NO UNO CON `veredicto: Veredicto` ─────────
 *
 * La versión anterior tenía un solo objeto con `veredicto: Veredicto` y
 * `bloqueaSello: boolean`, y eso deja el tipo más flojo que la regla:
 * `{ veredicto: "incompatible", bloqueaSello: false }` compilaba
 * perfectamente. Es decir, el tipo permitía construir exactamente el
 * estado que este módulo existe para impedir — un archivo que miente
 * pero no bloquea el sello.
 *
 * Con cuatro variantes, `bloqueaSello` es un literal atado al veredicto
 * y esa combinación **no se puede escribir**: no compila. La regla deja
 * de ser una convención que hay que recordar y pasa a ser algo que
 * TypeScript verifica en cada construcción.
 *
 * ⚠️  `bloqueaSello: false` NO autoriza a escribir `r2_verificado_en`.
 *     Solo dice que ESTA comprobación de firma no lo bloquea. La API de
 *     confirmación va a exigir además los metadatos válidos
 *     (`verificarMetadatosOriginal`), y para los contenedores ambiguos,
 *     un parser de pistas que todavía no existe.
 */
export type AnalisisCompatible = CamposComunes & {
  veredicto: "compatible";
  bloqueaSello: false;
};

export type AnalisisIncompatible = CamposComunes & {
  veredicto: "incompatible";
  bloqueaSello: true;
};

export type AnalisisInconcluso = CamposComunes & {
  veredicto: "inconcluso";
  bloqueaSello: true;
};

export type AnalisisDesconocido = CamposComunes & {
  veredicto: "desconocido";
  bloqueaSello: true;
};

export type AnalisisFirma =
  | AnalisisCompatible
  | AnalisisIncompatible
  | AnalisisInconcluso
  | AnalisisDesconocido;

/**
 * El análisis antes de saber cuántos bytes se leyeron (lo que devuelve
 * `compararFirma`, que es pura).
 *
 * `T extends unknown ?` no es ruido: hace que el `Omit` se DISTRIBUYA
 * sobre las cuatro variantes. Un `Omit<AnalisisFirma, "bytesLeidos">` a
 * secas colapsa la unión en un solo objeto y se pierde justamente la
 * discriminación que se acaba de ganar.
 */
type SinBytes<T> = T extends unknown ? Omit<T, "bytesLeidos"> : never;

export type AnalisisSinBytes = SinBytes<AnalisisFirma>;

const fallo = (codigo: CodigoErrorFirma, mensaje: string): { ok: false; error: ErrorFirma } => ({
  ok: false,
  error: { codigo, mensaje },
});

// ------------------------------------------------------------
// La tabla de compatibilidad
// ------------------------------------------------------------

/**
 * Qué detecciones acepta cada MIME declarado.
 *
 * Los valores salen de LEER `node_modules/file-type/core.js` en la
 * versión instalada (21.3.4), no de la documentación ni de memoria. Si
 * la versión cambia, hay que releer esas ramas: las marcas `ftyp` y los
 * códecs Ogg se mapean ahí, en un `switch`.
 */
type Regla = {
  /** Detecciones que valen como `compatible`. */
  exactas: readonly string[];
  /**
   * Detecciones de la misma familia que se aceptan, con el nombre de la
   * equivalencia que se va a informar.
   */
  equivalentes?: Readonly<Record<string, string>>;
  /**
   * Detecciones que NO alcanzan para demostrar el subtipo. Dan
   * `inconcluso`, no `incompatible`: el archivo puede ser correcto, pero
   * la muestra no lo prueba.
   */
  inconclusas?: readonly string[];
  mejorEsfuerzo?: boolean;
  /** Por qué es ambiguo, para el motivo del resultado. */
  notaAmbiguedad?: string;
};

const REGLAS: Readonly<Record<MimePermitido, Regla>> = {
  // ── Imágenes con firma limpia ──
  "image/jpeg": { exactas: ["image/jpeg"] },
  "image/png": {
    exactas: ["image/png"],
    // Un PNG animado ES un PNG: misma firma de 8 bytes, más una caja
    // `acTL`. Rechazarlo sería rechazar un archivo legítimo.
    equivalentes: { "image/apng": "PNG animado (APNG)" },
  },
  "image/webp": { exactas: ["image/webp"] },
  "image/avif": { exactas: ["image/avif"] },

  // ── ISO-BMFF de imagen ──
  //
  // Verificado en core.js: heic/heix → image/heic · hevc/hevx →
  // image/heic-sequence · mif1 → image/heif · msf1 → image/heif-sequence.
  //
  // Las variantes `-sequence` NO se aceptan como equivalentes, y es a
  // propósito aunque sean de la misma familia:
  //
  //   · son MIME distintos, y no están en `MIMES_PERMITIDOS`;
  //   · la restricción `mime` de la 0110 no los admite, así que la base
  //     no puede guardar su tipo real;
  //   · aceptarlos obligaría a guardar un MIME declarado que NO coincide
  //     con el detectado — exactamente la mentira que este módulo existe
  //     para detectar;
  //   · Cloudflare Images no fue probado con secuencias.
  //
  // Al no figurar acá, caen en `incompatible` y bloquean el sello. Si
  // algún día se quieren aceptar, el camino es agregarlos a
  // `MIMES_PERMITIDOS` y a la migración, no meterlos por la ventana.
  "image/heic": { exactas: ["image/heic"] },
  "image/heif": { exactas: ["image/heif"] },

  // ── Audio ──
  "audio/ogg": {
    // core.js devuelve el códec pegado al MIME cuando lo reconoce.
    exactas: ["audio/ogg", "audio/ogg; codecs=opus"],
    // `application/ogg` es el contenedor Ogg sin códec reconocido: no
    // se puede afirmar que sea audio. Y `video/ogg` (Theora) es
    // directamente otro tipo → cae en incompatible por no estar acá.
    inconclusas: ["application/ogg"],
    notaAmbiguedad: "es un contenedor Ogg sin códec de audio reconocible",
  },
  "audio/mpeg": {
    exactas: ["audio/mpeg"],
    mejorEsfuerzo: true,
  },
  "audio/mp4": {
    // M4B → audio/mp4 · M4A → audio/x-m4a (verificado en core.js).
    exactas: ["audio/mp4"],
    equivalentes: { "audio/x-m4a": "marca M4A (file-type lo llama audio/x-m4a)" },
    // Un M4A hecho con ffmpeg suele traer marca `isom`/`mp42`, que cae
    // en el default `video/mp4`. NO es una mentira del archivo: es que
    // el contenedor no distingue. Inconcluso, no incompatible.
    inconclusas: ["video/mp4"],
    notaAmbiguedad:
      "el contenedor ISO-BMFF genérico no distingue audio de video sin leer las pistas",
  },

  // ── Contenedores de video: SIEMPRE inconclusos ──
  // Reconocer el contenedor no demuestra que haya una pista de video.
  // Eso exige `moov → trak → hdlr`, que puede estar al final del
  // archivo y fuera de cualquier muestra.
  "video/mp4": {
    exactas: [],
    inconclusas: ["video/mp4"],
    notaAmbiguedad: "el contenedor MP4 no demuestra que exista una pista de video",
  },
  "video/webm": {
    exactas: [],
    inconclusas: ["video/webm"],
    notaAmbiguedad: "el DocType WebM no demuestra que exista una pista de video",
  },
  "video/quicktime": {
    exactas: [],
    inconclusas: ["video/quicktime"],
    notaAmbiguedad: "la marca QuickTime no demuestra que exista una pista de video",
  },
};

/**
 * Compara lo declarado con lo detectado. Pura: sin red, sin R2.
 *
 * Se exporta para poder probar los doce MIME sin montar nada, y porque
 * la tabla de arriba es la parte que hay que poder auditar de un
 * vistazo.
 */
export function compararFirma(
  mimeDeclarado: MimePermitido,
  detectado: { mime: string; ext: string } | undefined,
): AnalisisSinBytes {
  const regla = REGLAS[mimeDeclarado];

  // Los campos comunes se repiten en cada rama a propósito, en vez de
  // armarse una vez y esparcirse: así cada variante se construye
  // ENTERA y TypeScript comprueba estructuralmente que `veredicto` y
  // `bloqueaSello` van juntos. Con un `...base` compartido, el literal
  // de `bloqueaSello` se ensancha a `boolean` y se pierde el chequeo.
  const comunes = {
    mimeDeclarado,
    mimeDetectado: detectado?.mime ?? null,
    extensionDetectada: detectado?.ext ?? null,
    mejorEsfuerzo: regla.mejorEsfuerzo === true,
  };

  if (!detectado) {
    return {
      ...comunes,
      veredicto: "desconocido",
      bloqueaSello: true,
      equivalencia: null,
      motivo: "No se reconoció ninguna firma de formato en la muestra leída.",
    };
  }

  if (regla.exactas.includes(detectado.mime)) {
    return {
      ...comunes,
      veredicto: "compatible",
      bloqueaSello: false,
      equivalencia: null,
      motivo: regla.mejorEsfuerzo
        ? `La firma coincide con ${mimeDeclarado}, con detección de mejor esfuerzo.`
        : `La firma coincide con ${mimeDeclarado}.`,
    };
  }

  const equivalencia = regla.equivalentes?.[detectado.mime];
  if (equivalencia) {
    return {
      ...comunes,
      veredicto: "compatible",
      bloqueaSello: false,
      equivalencia,
      // El MIME exacto va en `mimeDetectado` y la equivalencia acá: en
      // ningún caso se muestra como si hubiera dado el tipo declarado.
      motivo: `Se detectó ${detectado.mime}, aceptado como ${mimeDeclarado}: ${equivalencia}.`,
    };
  }

  if (regla.inconclusas?.includes(detectado.mime)) {
    return {
      ...comunes,
      veredicto: "inconcluso",
      bloqueaSello: true,
      equivalencia: null,
      motivo: `Se detectó ${detectado.mime}, pero ${regla.notaAmbiguedad ?? "la muestra no permite demostrar el subtipo"}.`,
    };
  }

  return {
    ...comunes,
    veredicto: "incompatible",
    bloqueaSello: true,
    equivalencia: null,
    motivo: `Se declaró ${mimeDeclarado} y la firma es ${detectado.mime}.`,
  };
}

/**
 * Le agrega los bytes leídos conservando la variante.
 *
 * El `switch` con las cuatro ramas idénticas parece repetición inútil y
 * no lo es: dentro de cada `case`, `a` está ESTRECHADO a una variante
 * concreta, así que `{ ...a, bytesLeidos }` produce esa misma variante.
 * Un solo `return { ...a, bytesLeidos }` fuera del switch obligaría a
 * una conversión forzada, que es justo lo que hay que evitar acá.
 */
function conBytes(a: AnalisisSinBytes, bytesLeidos: number): AnalisisFirma {
  switch (a.veredicto) {
    case "compatible":
      return { ...a, bytesLeidos };
    case "incompatible":
      return { ...a, bytesLeidos };
    case "inconcluso":
      return { ...a, bytesLeidos };
    case "desconocido":
      return { ...a, bytesLeidos };
  }
}

// ------------------------------------------------------------
// Lectura acotada del cuerpo
// ------------------------------------------------------------

/** Lo mínimo que este módulo necesita de un cuerpo de respuesta. */
type CuerpoLegible = AsyncIterable<Uint8Array | Buffer>;

function esAsyncIterable(v: unknown): v is CuerpoLegible {
  return (
    typeof v === "object" &&
    v !== null &&
    Symbol.asyncIterator in (v as Record<symbol, unknown>) &&
    typeof (v as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function"
  );
}

/**
 * Acumula el cuerpo con un tope DURO.
 *
 * Se itera por trozos en vez de usar `transformToByteArray()` a
 * propósito: ese helper se traga todo lo que venga. Acá, en cuanto lo
 * acumulado pasa el tope se corta y se falla — que es lo que protege de
 * un origen que ignore el `Range` y empiece a mandar el archivo entero.
 */
async function leerConTope(
  cuerpo: CuerpoLegible,
  tope: number,
): Promise<ResultadoFirma<Uint8Array>> {
  const partes: Uint8Array[] = [];
  let total = 0;

  try {
    for await (const trozo of cuerpo) {
      const bytes =
        trozo instanceof Uint8Array ? trozo : new Uint8Array(trozo as ArrayLike<number>);
      total += bytes.length;
      if (total > tope) {
        return fallo(
          "lectura-excesiva",
          `El origen entregó más de ${tope} bytes pese al rango pedido; se cortó la lectura.`,
        );
      }
      partes.push(bytes);
    }
  } catch {
    return fallo("cuerpo-ilegible", "Se cortó la lectura de la muestra.");
  }

  if (total === 0) return fallo("archivo-vacio", "El objeto no tiene contenido.");

  const salida = new Uint8Array(total);
  let offset = 0;
  for (const p of partes) {
    salida.set(p, offset);
    offset += p.length;
  }
  return { ok: true, valor: salida };
}

/** Igual que en r2.ts: del error del SDK solo salen nombre y HTTP. */
function sanitizarError(e: unknown): ErrorFirma {
  const nombre =
    typeof e === "object" && e !== null && "name" in e && typeof e.name === "string"
      ? e.name
      : "ErrorDesconocido";

  let http: number | undefined;
  if (typeof e === "object" && e !== null && "$metadata" in e) {
    const meta = (e as { $metadata?: { httpStatusCode?: number } }).$metadata;
    if (typeof meta?.httpStatusCode === "number") http = meta.httpStatusCode;
  }

  if (nombre === "NotFound" || nombre === "NoSuchKey" || http === 404) {
    return { codigo: "no-existe", mensaje: "El objeto no existe en R2." };
  }
  return {
    codigo: "fallo-proveedor",
    mensaje: `R2 respondió con un error (${nombre}${http ? `, HTTP ${http}` : ""}).`,
  };
}

// ------------------------------------------------------------
// La operación
// ------------------------------------------------------------

/** El detector; inyectable para poder probar sus fallos. */
export type Detector = (
  bytes: Uint8Array,
) => Promise<{ mime: string; ext: string } | undefined>;

export type DependenciasFirma = Pick<DependenciasR2, "cliente" | "entorno"> & {
  detectar?: Detector;
};

const detectorPorDefecto: Detector = async (bytes) => {
  const r = await fileTypeFromBuffer(bytes);
  return r ? { mime: r.mime, ext: r.ext } : undefined;
};

/**
 * Lee una muestra acotada del objeto y compara su firma real contra el
 * MIME declarado.
 *
 * Nunca descarga el archivo completo: pide un `Range` explícito y, si
 * el origen lo ignora, corta al pasar `MAX_BYTES_MUESTRA`.
 *
 * ⛔ Leer el bloque de limitaciones del encabezado antes de usar el
 *    resultado para autorizar nada.
 */
export async function analizarFirmaEnR2(
  params: { clave: string; mimeDeclarado: string },
  deps: DependenciasFirma = {},
): Promise<ResultadoFirma<AnalisisFirma>> {
  const revision = revisarClave(params.clave);
  if (!revision.ok) {
    return fallo("clave-invalida", `La clave de R2 no es válida (${revision.motivo}).`);
  }
  if (!esMimePermitido(params.mimeDeclarado)) {
    return fallo("mime-no-permitido", "Ese MIME no está en la lista de permitidos.");
  }
  const mimeDeclarado = params.mimeDeclarado
    .toLowerCase()
    .split(";")[0]
    .trim() as MimePermitido;

  const listo = prepararClienteR2(deps);
  if (!listo.ok) {
    // Se traduce el error de r2.ts a los códigos de este módulo sin
    // arrastrar detalles del bucket ni del endpoint.
    const codigo: CodigoErrorFirma =
      listo.error.codigo === "solo-servidor" ? "solo-servidor" : "config-incompleta";
    return fallo(codigo, listo.error.mensaje);
  }

  let respuesta;
  try {
    respuesta = await listo.valor.cliente.send(
      new GetObjectCommand({
        Bucket: listo.valor.config.bucket,
        Key: params.clave,
        Range: RANGO_MUESTRA,
      }),
    );
  } catch (e) {
    return { ok: false, error: sanitizarError(e) };
  }

  const cuerpo: unknown = respuesta?.Body;
  if (cuerpo === undefined || cuerpo === null) {
    return fallo("sin-cuerpo", "R2 respondió sin cuerpo.");
  }
  if (!esAsyncIterable(cuerpo)) {
    return fallo("cuerpo-ilegible", "El cuerpo de R2 no se puede leer por trozos.");
  }

  const muestra = await leerConTope(cuerpo, MAX_BYTES_MUESTRA);
  if (!muestra.ok) return muestra;

  const detectar = deps.detectar ?? detectorPorDefecto;
  let detectado: { mime: string; ext: string } | undefined;
  try {
    detectado = await detectar(muestra.valor);
  } catch {
    // Un detector que revienta no puede tumbar la confirmación entera
    // ni, peor, dejar pasar el archivo.
    return fallo("fallo-deteccion", "No se pudo analizar la firma del archivo.");
  }

  return {
    ok: true,
    valor: conBytes(compararFirma(mimeDeclarado, detectado), muestra.valor.length),
  };
}
