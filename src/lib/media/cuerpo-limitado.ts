/**
 * BOOKEA MEDIA — leer el cuerpo de un request con un tope DURO.
 *
 * ── POR QUÉ NO ALCANZA CON `Content-Length` ──────────────────────────
 *
 * Es la cabecera que declara el cliente. Puede faltar (un cuerpo con
 * `Transfer-Encoding: chunked` no la trae) y puede mentir: nada obliga a
 * que coincida con lo que después se manda. Confiar en ella para decidir
 * si se lee es leer igual lo que venga.
 *
 * Acá se lee POR TROZOS y se corta en cuanto lo acumulado pasa el tope.
 * `await request.json()` haría lo contrario: se traga el cuerpo entero
 * antes de que nadie pueda opinar.
 *
 * Módulo neutral: sin red, sin secretos. Se usa desde los Route
 * Handlers, que son servidor, pero no depende de nada de servidor.
 */

/**
 * 8 KiB. Los cuerpos de `/api/media/*` son un puñado de UUID, un MIME y
 * un nombre de archivo de 300 caracteres como mucho: no llegan a 1 KiB.
 * El resto es margen para no romper por una cabecera larga.
 */
export const MAX_BYTES_CUERPO = 8 * 1024;

export type ErrorCuerpo =
  | { codigo: "vacio"; http: 400 }
  | { codigo: "muy-grande"; http: 413 }
  | { codigo: "ilegible"; http: 400 }
  | { codigo: "json-invalido"; http: 400 };

export type ResultadoCuerpo<T> = { ok: true; valor: T } | { ok: false; error: ErrorCuerpo };

/**
 * Lee hasta `tope` bytes del cuerpo y aborta si se pasa.
 *
 * Devuelve texto, no JSON: parsear es el paso siguiente y separado, para
 * que un cuerpo enorme se rechace ANTES de intentar interpretarlo.
 */
export async function leerCuerpoLimitado(
  request: Request,
  tope: number = MAX_BYTES_CUERPO,
): Promise<ResultadoCuerpo<string>> {
  const cuerpo = request.body;
  if (!cuerpo) return { ok: false, error: { codigo: "vacio", http: 400 } };

  const lector = cuerpo.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (!value) continue;
      total += value.length;
      if (total > tope) {
        // Se corta la lectura: no se sigue recibiendo un cuerpo que ya
        // se sabe que va a rechazarse.
        await lector.cancel().catch(() => {});
        return { ok: false, error: { codigo: "muy-grande", http: 413 } };
      }
      partes.push(value);
    }
  } catch {
    return { ok: false, error: { codigo: "ilegible", http: 400 } };
  }

  if (total === 0) return { ok: false, error: { codigo: "vacio", http: 400 } };

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const p of partes) {
    bytes.set(p, offset);
    offset += p.length;
  }

  try {
    return { ok: true, valor: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: { codigo: "ilegible", http: 400 } };
  }
}

/**
 * Lo mismo, pero devolviendo el objeto ya parseado.
 *
 * El tipo de salida es `Record<string, unknown>` y no un genérico
 * cómodo: lo que llega de la red no tiene tipo hasta que alguien lo
 * valida, y prometer `T` acá sería una mentira que el resto del código
 * se creería.
 */
export async function leerJsonLimitado(
  request: Request,
  tope: number = MAX_BYTES_CUERPO,
): Promise<ResultadoCuerpo<Record<string, unknown>>> {
  const texto = await leerCuerpoLimitado(request, tope);
  if (!texto.ok) return texto;

  let dato: unknown;
  try {
    dato = JSON.parse(texto.valor);
  } catch {
    return { ok: false, error: { codigo: "json-invalido", http: 400 } };
  }

  // Un array o un número son JSON válido pero no un cuerpo utilizable.
  if (typeof dato !== "object" || dato === null || Array.isArray(dato)) {
    return { ok: false, error: { codigo: "json-invalido", http: 400 } };
  }
  return { ok: true, valor: dato as Record<string, unknown> };
}

/** Un uuid, o null. Para no repetir el regex en cada endpoint. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidDe(valor: unknown): string | null {
  return typeof valor === "string" && UUID.test(valor) ? valor : null;
}

/** Un entero dentro de un rango, o null. */
export function enteroDe(valor: unknown, min: number, max: number): number | null {
  if (typeof valor !== "number" || !Number.isFinite(valor) || !Number.isInteger(valor)) return null;
  return valor >= min && valor <= max ? valor : null;
}

/** Un texto no vacío y acotado, ya recortado. */
export function textoDe(valor: unknown, maximo: number): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 && limpio.length <= maximo ? limpio : null;
}
