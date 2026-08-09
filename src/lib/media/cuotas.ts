/**
 * BOOKEA MEDIA — los límites, en un solo lugar.
 *
 * Solo lo APROBADO. Los planes comerciales (cuántos álbumes, cuántos GB
 * por cuenta, cuántos ZIP) NO están definidos todavía y se van a
 * diseñar con datos reales de Bookea; inventarlos acá sería fijar
 * política de producto desde un archivo de utilidades. Cuando existan,
 * entran con sus números y sus tests.
 *
 * ── LOS DOS LÍMITES DEL ÁLBUM, QUE NO SON EL MISMO ───────────────────
 *
 *   COMERCIAL (160)  lo que se le vende a un cliente y lo que se valida
 *                    al SUBIR.
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

import { MAX_BYTES_IMAGEN, tipoDeMime, type TipoArchivo } from "./tipos";

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
export function estadoAlbum(actuales: number, limite = LIMITE_COMERCIAL_ALBUM): EstadoAlbum {
  if (actuales >= LIMITE_TECNICO_ALBUM) return "lleno-tecnico";
  if (actuales >= limite) return "lleno-comercial";
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
  return Number.isInteger(actuales) && actuales >= 0 && actuales <= LIMITE_TECNICO_ALBUM;
}

export type MotivoRechazo =
  | "album-lleno"
  | "tope-tecnico"
  | "tanda-muy-grande"
  | "cantidad-invalida"
  | "limite-invalido";

export type ResultadoCupo = {
  ok: boolean;
  /**
   * Cuántas fotos SÍ podrían entrar ahora mismo. Con `ok: false` es
   * información para que la pantalla ofrezca reducir la selección, NO
   * un permiso para subir esas y descartar el resto en silencio.
   */
  permitidas: number;
  motivo?: MotivoRechazo;
  /** Texto listo para mostrar, en español de Costa Rica. */
  mensaje?: string;
};

/** Un entero de verdad: descarta NaN, Infinity y los decimales. */
function esEnteroFinito(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Number.isInteger(n);
}

/**
 * ¿Caben estas fotos en este álbum?
 *
 * ── POR QUÉ NUNCA SUBE UNA PARTE SIN PREGUNTAR ───────────────────────
 *
 * La versión anterior devolvía `ok: true` con menos fotos de las
 * pedidas cuando no cabían todas. Eso significa que alguien elige 10
 * fotos, toca "Subir", y se suben 3 sin que nadie le diga cuáles ni por
 * qué — en un álbum de recuerdos, donde cada foto es de una persona
 * distinta. Ahora eso es `ok: false` con `permitidas` para que la
 * pantalla lo ofrezca y la persona decida.
 *
 * El otro bug que arregla: el tope por tanda se revisaba ANTES que el
 * cupo, así que con 159 fotos y una selección de 50 respondía
 * "permitidas: 10" cuando quedaba UN lugar. Ahora los dos topes se
 * combinan antes de contestar.
 */
export function puedeAgregarFotos(params: {
  actuales: number;
  aAgregar: number;
  /** El cupo comercial que aplica; por defecto, 160. */
  limitePlan?: number;
}): ResultadoCupo {
  const { actuales, aAgregar } = params;
  const limite = params.limitePlan ?? LIMITE_COMERCIAL_ALBUM;

  if (!esEnteroFinito(actuales) || actuales < 0) {
    return { ok: false, permitidas: 0, motivo: "cantidad-invalida" };
  }
  if (!esEnteroFinito(aAgregar) || aAgregar <= 0) {
    return { ok: false, permitidas: 0, motivo: "cantidad-invalida" };
  }
  if (!esEnteroFinito(limite) || limite <= 0 || limite > LIMITE_TECNICO_ALBUM) {
    return { ok: false, permitidas: 0, motivo: "limite-invalido" };
  }

  const lugar = Math.max(0, limite - actuales);

  if (lugar === 0) {
    const porTecnico = actuales >= LIMITE_TECNICO_ALBUM;
    return {
      ok: false,
      permitidas: 0,
      motivo: porTecnico ? "tope-tecnico" : "album-lleno",
      mensaje: porTecnico
        ? "Este álbum llegó a su tope técnico y no acepta más fotos."
        : `El álbum llegó a su tope de ${limite} fotos. ¡Gracias por tanto recuerdo!`,
    };
  }

  // Los DOS topes a la vez: lo que queda en el álbum y lo que entra en
  // una tanda. El más chico manda.
  const cabenAhora = Math.min(lugar, MAX_POR_TANDA);

  if (aAgregar > cabenAhora) {
    // Cuál de los dos topes mordió primero, para el mensaje.
    const mandaElCupo = lugar < MAX_POR_TANDA;
    return {
      ok: false,
      permitidas: cabenAhora,
      motivo: mandaElCupo ? "album-lleno" : "tanda-muy-grande",
      mensaje: mandaElCupo
        ? `Solo queda${cabenAhora === 1 ? "" : "n"} ${cabenAhora} lugar${cabenAhora === 1 ? "" : "es"} en el álbum. Elegí ${cabenAhora} foto${cabenAhora === 1 ? "" : "s"} y volvé a intentar.`
        : `Máximo ${MAX_POR_TANDA} fotos por tanda. Elegí ${MAX_POR_TANDA} y subí el resto en otra tanda.`,
    };
  }

  return { ok: true, permitidas: aAgregar };
}

// ------------------------------------------------------------
// 2. Archivos
// ------------------------------------------------------------

/**
 * Tope por archivo, por tipo.
 *
 * El de imagen NO es un número elegido: es el tope de Cloudflare
 * Images. Ver `MAX_BYTES_IMAGEN` en tipos.ts para por qué una imagen
 * más grande se rechaza en vez de guardarse solo en R2.
 */
export const MAX_BYTES: Record<TipoArchivo, number> = {
  imagen: MAX_BYTES_IMAGEN,
  video: 100 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
};

export type ArchivoInvalido = "mime-no-permitido" | "muy-pesado" | "vacio" | "tamano-invalido";

export type ResultadoArchivo =
  | { ok: true; tipo: TipoArchivo }
  | { ok: false; motivo: ArchivoInvalido; mensaje: string };

/**
 * La validación que corre en el SERVIDOR antes de firmar nada.
 *
 * El navegador ya filtra, pero eso es comodidad: quien pide una URL
 * prefirmada puede saltarse la pantalla entera. Este es el control que
 * cuenta.
 *
 * OJO: valida lo DECLARADO (MIME y tamaño que dice el cliente). No
 * prueba qué hay adentro del archivo — eso es la confirmación por magic
 * bytes del bloque 3. Ver la nota en `tipos.ts`.
 */
export function validarArchivo(params: { mime: unknown; bytes: unknown }): ResultadoArchivo {
  const { mime, bytes } = params;

  const tipo = tipoDeMime(mime);
  if (tipo === null) {
    return {
      ok: false,
      motivo: "mime-no-permitido",
      mensaje: "Ese tipo de archivo no se puede subir. Probá con una foto JPG, PNG o WebP.",
    };
  }
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return {
      ok: false,
      motivo: "tamano-invalido",
      mensaje: "No se pudo leer el tamaño del archivo.",
    };
  }
  if (bytes === 0) {
    return { ok: false, motivo: "vacio", mensaje: "Ese archivo está vacío." };
  }
  if (bytes > MAX_BYTES[tipo]) {
    const mb = Math.round(MAX_BYTES[tipo] / 1024 / 1024);
    return {
      ok: false,
      motivo: "muy-pesado",
      mensaje:
        tipo === "imagen"
          ? `Esa foto pesa más de ${mb} MB. Probá con una más liviana o bajale la resolución.`
          : `Ese archivo pesa más de ${mb} MB. Probá con uno más liviano.`,
    };
  }

  return { ok: true, tipo };
}
