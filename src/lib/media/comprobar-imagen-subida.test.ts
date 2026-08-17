import { describe, expect, it } from "vitest";
import {
  bytesDelRango,
  comprobarImagenSubida,
  tipoPorFirma,
} from "./comprobar-imagen-subida";

/**
 * La comprobación del archivo DEL LADO DEL SERVIDOR.
 *
 * Todo lo que hace el navegador al subir —el `accept="image/*"`, el
 * `type.startsWith("image/")`, el tope de 2 MB— corre en la máquina de
 * quien sube. Un `curl` contra la API de storage se los salta los tres.
 * Lo que se prueba acá es lo que queda cuando no se le cree a nadie.
 */

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
/** «PK\x03\x04»: un ZIP con nombre de .png es el caso clásico. */
const ZIP = [0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0];
/** Un RIFF que NO es WebP: un WAV. Las cuatro primeras letras engañan. */
const WAV = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45];

function respuesta(
  bytes: number[],
  { total, estado = 206 }: { total?: number; estado?: number } = {},
): Response {
  const cabeceras = new Headers();
  if (total !== undefined) {
    cabeceras.set("content-range", `bytes 0-${bytes.length - 1}/${total}`);
  }
  return new Response(new Uint8Array(bytes), { status: estado, headers: cabeceras });
}

const URL_OK =
  "https://proyecto.supabase.co/storage/v1/object/public/ranchos-fotos/lealtad/iconos/u/1.png";

const MAX = 2 * 1024 * 1024;

describe("el tipo REAL sale de los primeros bytes", () => {
  it("reconoce PNG, JPEG y WebP", () => {
    expect(tipoPorFirma(new Uint8Array(PNG))).toBe("image/png");
    expect(tipoPorFirma(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(tipoPorFirma(new Uint8Array(WEBP))).toBe("image/webp");
  });

  it("un ZIP renombrado no es una imagen, aunque la URL diga .png", () => {
    expect(tipoPorFirma(new Uint8Array(ZIP))).toBeNull();
  });

  it("un RIFF que no es WebP tampoco pasa", () => {
    // Las cuatro primeras letras de un WAV son idénticas a las de un
    // WebP: mirar solo esas dejaría entrar audio.
    expect(tipoPorFirma(new Uint8Array(WAV))).toBeNull();
  });

  it("un archivo cortado a los tres bytes no rompe nada", () => {
    expect(tipoPorFirma(new Uint8Array([0x89, 0x50, 0x4e]))).toBeNull();
    expect(tipoPorFirma(new Uint8Array([]))).toBeNull();
  });
});

describe("el tamaño sale de content-range, no de quien subió", () => {
  it("lee el total del final de la cabecera", () => {
    expect(bytesDelRango("bytes 0-31/48210")).toBe(48210);
    expect(bytesDelRango("bytes 0-31/*")).toBeNull();
    expect(bytesDelRango(null)).toBeNull();
    expect(bytesDelRango("cualquier cosa")).toBeNull();
  });
});

describe("comprobarImagenSubida", () => {
  it("acepta un PNG de tamaño normal", async () => {
    const res = await comprobarImagenSubida(URL_OK, {
      maxBytes: MAX,
      traer: async () => respuesta(PNG, { total: 40_000 }),
    });
    expect(res).toEqual({ ok: true, tipo: "image/png", bytes: 40_000 });
  });

  it("rechaza lo que pesa de más, aunque sea una imagen de verdad", async () => {
    const res = await comprobarImagenSubida(URL_OK, {
      maxBytes: MAX,
      traer: async () => respuesta(PNG, { total: MAX + 1 }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toContain("2 MB");
  });

  it("rechaza lo que no es una imagen", async () => {
    const res = await comprobarImagenSubida(URL_OK, {
      maxBytes: MAX,
      traer: async () => respuesta(ZIP, { total: 900 }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toContain("PNG");
  });

  it("sin content-range, el largo del cuerpo también cuenta", async () => {
    // Un servidor puede ignorar el Range y mandar el archivo entero.
    const gordo = [...PNG, ...new Array(200).fill(0)];
    const res = await comprobarImagenSubida(URL_OK, {
      maxBytes: 100,
      traer: async () => respuesta(gordo, { estado: 200 }),
    });
    expect(res.ok).toBe(false);
  });

  it("un 404 no se toma por bueno", async () => {
    const res = await comprobarImagenSubida(URL_OK, {
      maxBytes: MAX,
      traer: async () => new Response("", { status: 404 }),
    });
    expect(res.ok).toBe(false);
  });

  it("un fallo de red no lanza: contesta que se pruebe de nuevo", async () => {
    const res = await comprobarImagenSubida(URL_OK, {
      maxBytes: MAX,
      traer: async () => {
        throw new Error("ECONNRESET");
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toContain("de nuevo");
  });

  it("pide solo un pedazo: no se baja la imagen entera para mirarla", async () => {
    let cabeceras: HeadersInit | undefined;
    await comprobarImagenSubida(URL_OK, {
      maxBytes: MAX,
      traer: async (_url, init) => {
        cabeceras = init?.headers;
        return respuesta(PNG, { total: 40_000 });
      },
    });
    expect(JSON.stringify(cabeceras)).toContain("bytes=0-");
  });
});
