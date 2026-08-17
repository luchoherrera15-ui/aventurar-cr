import { esRefValido } from "./ref";

/**
 * LA VALIDACIÓN DE LO QUE VIENE DE AFUERA.
 *
 * Todo lo que entra por la API es hostil hasta que se demuestre lo
 * contrario. Acá no hay librería de esquemas y no hace falta: son tres
 * campos, y escribirlos a mano hace que cada regla tenga su motivo
 * escrito al lado en vez de esconderse detrás de un `.min(1)`.
 *
 * Lógica pura, sin base y sin red: cada rechazo se prueba contra un
 * caso concreto.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTA CAPA *NO* ACEPTA, Y ES LO MÁS IMPORTANTE DE ELLA
 * ------------------------------------------------------------------
 * · No acepta `miembro_id`. Un solo camino de identidad es un solo
 *   camino que auditar, y el uuid real no sale ni entra.
 * · No acepta `motivo`. Es texto libre de un tercero cayendo en una
 *   tabla que no tiene datos personales; el servidor escribe siempre su
 *   propia frase.
 * · No acepta `usuario_id`, ni `puntos`, ni `saldo`: los puntos los
 *   calcula el programa con SUS reglas, no el que llama.
 * · `POST /acreditaciones` NO acepta `serial`. La operación va por
 *   `ref`; el serial solo consulta. De esa asimetría sale que una base
 *   de refs robada permita fraude de sellos contra el negocio que
 *   consintió, pero NO leer el saldo ni las iniciales de nadie.
 */

/** Un cuerpo más grande que esto ni se parsea. */
export const LIMITE_CUERPO_BYTES = 4096;

export type FalloEntrada = { campo: string; motivo: string };
export type Validado<T> = { ok: true; datos: T } | { ok: false; fallo: FalloEntrada };

/** Los tres campos que `POST /acreditaciones` recibe. Exactamente tres. */
export type EntradaAcreditacion = {
  ref: string;
  /** Colones enteros. null = visita sin monto (una tarjeta de sellos pura). */
  monto: number | null;
  referencia: string;
};

/** Tope de la referencia: el `check` de `transacciones_puntos` es 100 y le sumamos el prefijo `api:`. */
const LARGO_REFERENCIA = 96;

/** Diez millones de colones en una sola compra ya es un error de digitación. */
const MONTO_MAXIMO = 10_000_000;

export function validarAcreditacion(cuerpo: unknown): Validado<EntradaAcreditacion> {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return { ok: false, fallo: { campo: "cuerpo", motivo: "Se esperaba un objeto JSON." } };
  }
  const bruto = cuerpo as Record<string, unknown>;

  // Un campo de más no se ignora: se rechaza. Si el POS manda
  // `miembro_id` o `motivo`, quiero que se entere hoy y no el día que
  // alguien decida "aprovechar" que llegaban.
  const permitidos = new Set(["ref", "monto", "referencia"]);
  const sobrante = Object.keys(bruto).find((k) => !permitidos.has(k));
  if (sobrante) {
    return {
      ok: false,
      fallo: {
        campo: sobrante,
        motivo: `Este endpoint solo acepta ref, monto y referencia. Sobra: ${sobrante}.`,
      },
    };
  }

  if (!esRefValido(bruto.ref)) {
    return {
      ok: false,
      fallo: { campo: "ref", motivo: "Falta `ref`, o no tiene la forma mb_XXXXXXXXXXXXXXXX." },
    };
  }

  // El monto es OPCIONAL, pero si viene tiene que ser un entero de
  // colones. `null` y ausente significan lo mismo: visita sin monto.
  let monto: number | null = null;
  if (bruto.monto !== undefined && bruto.monto !== null) {
    if (typeof bruto.monto !== "number" || !Number.isFinite(bruto.monto)) {
      return { ok: false, fallo: { campo: "monto", motivo: "`monto` tiene que ser un número." } };
    }
    if (!Number.isInteger(bruto.monto)) {
      return {
        ok: false,
        fallo: { campo: "monto", motivo: "`monto` va en colones enteros, sin decimales." },
      };
    }
    if (bruto.monto < 0 || bruto.monto > MONTO_MAXIMO) {
      return {
        ok: false,
        fallo: { campo: "monto", motivo: `\`monto\` va entre 0 y ${MONTO_MAXIMO}.` },
      };
    }
    monto = bruto.monto;
  }

  // OBLIGATORIA, aunque el RPC la acepte nula. Sin idempotencia
  // obligatoria, el "falla cerrado" del rate limit obligaría al POS a
  // elegir entre perder el sello o duplicarlo.
  if (typeof bruto.referencia !== "string") {
    return {
      ok: false,
      fallo: {
        campo: "referencia",
        motivo:
          "`referencia` es obligatoria: es la llave de idempotencia (por ejemplo el número de tiquete).",
      },
    };
  }
  const referencia = bruto.referencia.trim();
  if (referencia.length < 3 || referencia.length > LARGO_REFERENCIA) {
    return {
      ok: false,
      fallo: {
        campo: "referencia",
        motivo: `\`referencia\` va entre 3 y ${LARGO_REFERENCIA} caracteres.`,
      },
    };
  }
  // Sin caracteres de control: van a parar a una tabla y a una pantalla.
  if (!/^[\x20-\x7E]+$/.test(referencia)) {
    return {
      ok: false,
      fallo: {
        campo: "referencia",
        motivo: "`referencia` solo admite caracteres imprimibles ASCII.",
      },
    };
  }

  return { ok: true, datos: { ref: bruto.ref, monto, referencia } };
}

/**
 * La referencia se guarda PREFIJADA.
 *
 * Sin el prefijo, un POS que use "0001" chocaría con la referencia
 * "0001" que el panel escribió a mano, y el segundo movimiento se
 * perdería en silencio creyéndose un duplicado. El prefijo también
 * hace obvio en el libro mayor qué entró por API.
 */
export function referenciaGuardada(referencia: string): string {
  return `api:${referencia}`;
}

/** Por cuál de los dos identificadores llegó la consulta de saldo. */
export type ConsultaDeSaldo =
  | { tipo: "serial"; valor: string }
  | { tipo: "ref"; valor: string };

/**
 * `GET /saldo` acepta `serial` O `ref`. Exactamente uno.
 *
 * · `serial` es el QR del pase que el cliente enseña: la única forma de
 *   conocer una tarjeta por primera vez.
 * · `ref` es el seudónimo que el POS guardó de esa primera vez, para
 *   volver a consultar sin pedirle el teléfono al cliente otra vez.
 *
 * LOS DOS A LA VEZ SE RECHAZAN, no se prioriza uno. Aceptar ambos y
 * quedarse con el primero convierte un error del integrador —mandar un
 * serial y un ref que no son de la misma persona— en una respuesta
 * plausible sobre la persona equivocada, y el cajero no tiene forma de
 * notarlo. Un 400 lo obliga a arreglar su código hoy.
 *
 * Los seriales de este repo son hex/uuid-ish; se validan por forma y
 * por largo, no por su contenido, y se rechaza cualquier cosa con
 * espacios o con caracteres que no pertenecen a un identificador.
 */
export function validarConsultaDeSaldo(
  serial: string | null | undefined,
  ref: string | null | undefined,
): Validado<ConsultaDeSaldo> {
  const haySerial = typeof serial === "string" && serial.trim() !== "";
  const hayRef = typeof ref === "string" && ref.trim() !== "";

  if (haySerial && hayRef) {
    return {
      ok: false,
      fallo: {
        campo: "ref",
        motivo: "Mandá `serial` o `ref`, no los dos: no hay forma de saber cuál de los dos manda.",
      },
    };
  }

  if (hayRef) {
    const limpio = (ref as string).trim();
    if (!esRefValido(limpio)) {
      return {
        ok: false,
        fallo: { campo: "ref", motivo: "`ref` no tiene la forma mb_XXXXXXXXXXXXXXXX." },
      };
    }
    return { ok: true, datos: { tipo: "ref", valor: limpio } };
  }

  if (!haySerial) {
    return {
      ok: false,
      fallo: {
        campo: "serial",
        motivo:
          "Falta `serial` (el código de la tarjeta presentada) o `ref` (el que guardaste de esa tarjeta).",
      },
    };
  }

  const limpio = (serial as string).trim();
  if (!/^[A-Za-z0-9._-]{8,80}$/.test(limpio)) {
    return { ok: false, fallo: { campo: "serial", motivo: "`serial` no tiene una forma válida." } };
  }
  return { ok: true, datos: { tipo: "serial", valor: limpio } };
}

/**
 * Lee el cuerpo con TECHO DE TAMAÑO.
 *
 * `request.json()` sobre 40 MB de basura es 40 MB de memoria en un
 * proceso que cobra por milisegundo. Se corta antes de parsear.
 */
export async function leerCuerpoJson(pedido: Request): Promise<Validado<unknown>> {
  const largo = pedido.headers.get("content-length");
  if (largo && Number(largo) > LIMITE_CUERPO_BYTES) {
    return { ok: false, fallo: { campo: "cuerpo", motivo: "El cuerpo no puede pasar de 4 KB." } };
  }
  let texto: string;
  try {
    texto = await pedido.text();
  } catch {
    return { ok: false, fallo: { campo: "cuerpo", motivo: "No se pudo leer el cuerpo." } };
  }
  if (texto.length > LIMITE_CUERPO_BYTES) {
    return { ok: false, fallo: { campo: "cuerpo", motivo: "El cuerpo no puede pasar de 4 KB." } };
  }
  try {
    return { ok: true, datos: JSON.parse(texto) as unknown };
  } catch {
    return { ok: false, fallo: { campo: "cuerpo", motivo: "El cuerpo no es JSON válido." } };
  }
}
