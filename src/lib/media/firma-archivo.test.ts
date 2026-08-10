import { describe, expect, expectTypeOf, it, vi } from "vitest";

// `server-only` lanza fuera del bundler de Next (ver r2.test.ts).
vi.mock("server-only", () => ({}));

import {
  MAX_BYTES_MUESTRA,
  RANGO_MUESTRA,
  analizarFirmaEnR2,
  compararFirma,
  type AnalisisCompatible,
  type AnalisisDesconocido,
  type AnalisisFirma,
  type AnalisisInconcluso,
  type AnalisisIncompatible,
  type DependenciasFirma,
} from "./firma-archivo";
import { MIMES_PERMITIDOS, type MimePermitido } from "./tipos";

/**
 * NINGUNA prueba toca la red.
 *
 * La tabla de compatibilidad se prueba con BYTES REALES pasados por el
 * `file-type` de verdad — no con un detector simulado. Es a propósito:
 * un mock del detector probaría que mi tabla coincide con lo que yo creo
 * que devuelve la librería, que es exactamente el error que se quiere
 * evitar. Con bytes reales, si `file-type` cambia de comportamiento al
 * subir de versión, estos tests fallan.
 *
 * El detector SÍ se simula para el único caso que no se puede provocar
 * con bytes: que reviente.
 */

const ENTORNO = {
  R2_ACCESS_KEY_ID: "id-de-prueba",
  R2_SECRET_ACCESS_KEY: "secreto-de-prueba",
  R2_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com",
  R2_REGION: "auto",
  R2_BUCKET_ORIGINALS: "originales",
} as unknown as NodeJS.ProcessEnv;

const CLAVE = "originals/usuario/album/entidad/asset/archivo.bin";

// ------------------------------------------------------------
// Fixtures de bytes
// ------------------------------------------------------------

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Una caja `ftyp` de ISO-BMFF con la marca mayor indicada. */
function ftyp(marca: string): Uint8Array {
  const m = marca.padEnd(4, " ").slice(0, 4);
  return new Uint8Array([
    0x00, 0x00, 0x00, 0x20, // tamaño de la caja
    ...ascii("ftyp"),
    ...ascii(m), // marca mayor
    0x00, 0x00, 0x00, 0x00, // versión menor
    ...ascii(m), // marcas compatibles
    ...new Array(12).fill(0x00),
  ]);
}

/**
 * Una página Ogg mínima: 27 bytes de cabecera + 1 de tabla de
 * segmentos = 28, y el identificador del códec justo después (que es
 * donde file-type lo busca: `ignore(28)` y luego 8 bytes).
 */
function ogg(codec: number[]): Uint8Array {
  const cabecera = [
    ...ascii("OggS"),
    0x00, // versión
    0x02, // tipo de página
    ...new Array(8).fill(0x00), // granule
    ...new Array(4).fill(0x01), // serial
    ...new Array(4).fill(0x00), // secuencia
    ...new Array(4).fill(0x00), // checksum
    0x01, // segmentos
    0x1e, // tabla de segmentos
  ];
  return new Uint8Array([...cabecera, ...codec, ...new Array(24).fill(0x00)]);
}

/** Un chunk PNG con su longitud, tipo, datos y un CRC de relleno. */
function chunkPng(tipo: string, datos: number[]): number[] {
  const n = datos.length;
  return [
    (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff,
    ...ascii(tipo),
    ...datos,
    0x00, 0x00, 0x00, 0x00, // CRC de relleno; file-type no lo valida
  ];
}

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = chunkPng("IHDR", new Array(13).fill(0x01));

const png = () => new Uint8Array([...FIRMA_PNG, ...IHDR, ...chunkPng("IDAT", [0x00])]);
/** APNG = PNG con una caja `acTL` ANTES del primer `IDAT`. */
const apng = () =>
  new Uint8Array([
    ...FIRMA_PNG,
    ...IHDR,
    ...chunkPng("acTL", new Array(8).fill(0x00)),
    ...chunkPng("IDAT", [0x00]),
  ]);

const FIXTURES = {
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xdb, ...new Array(28).fill(0x00)]),
  png: png(),
  apng: apng(),
  webp: new Uint8Array([
    ...ascii("RIFF"), 0x24, 0x00, 0x00, 0x00, ...ascii("WEBP"), ...ascii("VP8 "),
    ...new Array(16).fill(0x00),
  ]),
  avif: ftyp("avif"),
  heic: ftyp("heic"),
  heicSecuencia: ftyp("hevc"),
  heif: ftyp("mif1"),
  heifSecuencia: ftyp("msf1"),
  mp4: ftyp("isom"),
  quicktime: ftyp("qt"),
  m4a: ftyp("M4A"),
  m4b: ftyp("M4B"),
  webm: new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23,
    0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04,
    0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, ...ascii("webm"),
    ...new Array(16).fill(0x00),
  ]),
  oggOpus: ogg(ascii("OpusHead")),
  oggVorbis: ogg([0x01, ...ascii("vorbis")]),
  oggTheora: ogg([0x80, ...ascii("theora")]),
  oggDesconocido: ogg(ascii("XXXXXXXX")),
  mp3: new Uint8Array([0xff, 0xfb, 0x90, 0x00, ...new Array(28).fill(0x00)]),
  basura: new Uint8Array(new Array(64).fill(0x7a)),
};

// ------------------------------------------------------------
// Cliente R2 simulado
// ------------------------------------------------------------

async function* enTrozos(bytes: Uint8Array, tamano = 16) {
  for (let i = 0; i < bytes.length; i += tamano) yield bytes.slice(i, i + tamano);
}

/** Registra los comandos recibidos y devuelve el cuerpo indicado. */
function clienteFalso(cuerpo: unknown | (() => never)) {
  const comandos: { Key?: string; Range?: string; Bucket?: string }[] = [];
  const cliente = {
    send: vi.fn(async (comando: { input?: Record<string, string> }) => {
      comandos.push((comando.input ?? {}) as { Key?: string; Range?: string });
      if (typeof cuerpo === "function") return (cuerpo as () => never)();
      return { Body: cuerpo };
    }),
  };
  return { cliente, comandos };
}

function deps(cliente: unknown, over: Partial<DependenciasFirma> = {}): DependenciasFirma {
  return { entorno: ENTORNO, cliente: cliente as never, ...over };
}

/** Analiza un fixture como si estuviera en R2. */
async function analizar(bytes: Uint8Array, mimeDeclarado: string) {
  const { cliente } = clienteFalso(enTrozos(bytes));
  return analizarFirmaEnR2({ clave: CLAVE, mimeDeclarado }, deps(cliente));
}

// ============================================================
// 1. Los doce MIME, contra bytes reales
// ============================================================

describe("los 12 MIME declarados — detección con bytes reales", () => {
  it("image/jpeg → compatible", async () => {
    const r = await analizar(FIXTURES.jpeg, "image/jpeg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("image/jpeg");
      expect(r.valor.bloqueaSello).toBe(false);
    }
  });

  it("image/png → compatible", async () => {
    const r = await analizar(FIXTURES.png, "image/png");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("image/png");
      expect(r.valor.equivalencia).toBe(null);
    }
  });

  it("image/webp → compatible", async () => {
    const r = await analizar(FIXTURES.webp, "image/webp");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.veredicto).toBe("compatible");
  });

  it("image/avif → compatible", async () => {
    const r = await analizar(FIXTURES.avif, "image/avif");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("image/avif");
    }
  });

  it("image/heic → compatible", async () => {
    const r = await analizar(FIXTURES.heic, "image/heic");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("image/heic");
    }
  });

  it("image/heif → compatible (marca mif1)", async () => {
    const r = await analizar(FIXTURES.heif, "image/heif");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("image/heif");
    }
  });

  it("audio/ogg con Vorbis → compatible", async () => {
    const r = await analizar(FIXTURES.oggVorbis, "audio/ogg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("audio/ogg");
    }
  });

  it("audio/mpeg → compatible, marcado MEJOR ESFUERZO", async () => {
    const r = await analizar(FIXTURES.mp3, "audio/mpeg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("audio/mpeg");
      expect(r.valor.mejorEsfuerzo).toBe(true);
      expect(r.valor.motivo).toContain("mejor esfuerzo");
    }
  });

  it("audio/mp4 con marca M4B → compatible", async () => {
    const r = await analizar(FIXTURES.m4b, "audio/mp4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("audio/mp4");
    }
  });

  it("video/mp4 → INCONCLUSO (el contenedor no prueba pista de video)", async () => {
    const r = await analizar(FIXTURES.mp4, "video/mp4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("inconcluso");
      expect(r.valor.mimeDetectado).toBe("video/mp4");
      expect(r.valor.bloqueaSello).toBe(true);
      expect(r.valor.motivo).toContain("pista de video");
    }
  });

  it("video/webm → INCONCLUSO (el DocType no prueba pista de video)", async () => {
    const r = await analizar(FIXTURES.webm, "video/webm");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("inconcluso");
      expect(r.valor.mimeDetectado).toBe("video/webm");
      expect(r.valor.bloqueaSello).toBe(true);
    }
  });

  it("video/quicktime → INCONCLUSO (la marca no prueba pista de video)", async () => {
    const r = await analizar(FIXTURES.quicktime, "video/quicktime");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("inconcluso");
      expect(r.valor.mimeDetectado).toBe("video/quicktime");
      expect(r.valor.bloqueaSello).toBe(true);
    }
  });

  it("ninguno de los 12 queda sin regla", () => {
    for (const m of MIMES_PERMITIDOS) {
      const r = compararFirma(m, undefined);
      expect(r.veredicto, m).toBe("desconocido");
    }
    expect(MIMES_PERMITIDOS).toHaveLength(12);
  });
});

// ============================================================
// 2. Equivalencias de familia — informadas, nunca ocultadas
// ============================================================

describe("equivalencias de familia", () => {
  it("APNG declarado como PNG → compatible, informando el MIME exacto", async () => {
    const r = await analizar(FIXTURES.apng, "image/png");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      // No se maquilla: se dice que era APNG.
      expect(r.valor.mimeDetectado).toBe("image/apng");
      expect(r.valor.equivalencia).toContain("APNG");
      expect(r.valor.motivo).toContain("image/apng");
    }
  });

  it("Opus en Ogg declarado como audio/ogg → compatible", async () => {
    const r = await analizar(FIXTURES.oggOpus, "audio/ogg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("audio/ogg; codecs=opus");
    }
  });

  it("M4A específico declarado como audio/mp4 → compatible con equivalencia", async () => {
    const r = await analizar(FIXTURES.m4a, "audio/mp4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("compatible");
      expect(r.valor.mimeDetectado).toBe("audio/x-m4a");
      expect(r.valor.equivalencia).toContain("M4A");
    }
  });
});

// ============================================================
// 3. Incompatibles e inconclusos
// ============================================================

describe("incompatibles", () => {
  it("Theora en Ogg declarado como audio/ogg → INCOMPATIBLE", async () => {
    const r = await analizar(FIXTURES.oggTheora, "audio/ogg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("incompatible");
      expect(r.valor.mimeDetectado).toBe("video/ogg");
      expect(r.valor.bloqueaSello).toBe(true);
    }
  });

  it("un PNG declarado como JPEG → INCOMPATIBLE", async () => {
    const r = await analizar(FIXTURES.png, "image/jpeg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("incompatible");
      expect(r.valor.motivo).toContain("image/png");
    }
  });

  it("un AVIF declarado como HEIC → INCOMPATIBLE (no son la misma familia)", async () => {
    const r = await analizar(FIXTURES.avif, "image/heic");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.veredicto).toBe("incompatible");
  });

  it("un WebP declarado como AVIF → INCOMPATIBLE", async () => {
    const r = await analizar(FIXTURES.webp, "image/avif");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.veredicto).toBe("incompatible");
  });

  it("secuencia HEIC declarada como image/heic → INCOMPATIBLE", async () => {
    // `image/heic-sequence` es OTRO MIME: no está en MIMES_PERMITIDOS y
    // la 0110 no lo admite. Aceptarlo obligaría a guardar un MIME
    // declarado que no coincide con el detectado.
    const r = await analizar(FIXTURES.heicSecuencia, "image/heic");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("incompatible");
      expect(r.valor.mimeDetectado).toBe("image/heic-sequence");
      expect(r.valor.bloqueaSello).toBe(true);
      expect(r.valor.equivalencia).toBe(null);
    }
  });

  it("secuencia HEIF declarada como image/heif → INCOMPATIBLE", async () => {
    const r = await analizar(FIXTURES.heifSecuencia, "image/heif");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("incompatible");
      expect(r.valor.mimeDetectado).toBe("image/heif-sequence");
      expect(r.valor.bloqueaSello).toBe(true);
      expect(r.valor.equivalencia).toBe(null);
    }
  });

  it("las secuencias tampoco pasan bajo el MIME de la otra familia", async () => {
    for (const [bytes, mime] of [
      [FIXTURES.heicSecuencia, "image/heif"],
      [FIXTURES.heifSecuencia, "image/heic"],
    ] as const) {
      const r = await analizar(bytes, mime);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.valor.veredicto, mime).toBe("incompatible");
    }
  });
});

describe("inconclusos", () => {
  it("MP4 genérico declarado como audio/mp4 → INCONCLUSO, no incompatible", async () => {
    // Un M4A de ffmpeg trae marca `isom`. El archivo puede ser correcto;
    // lo que no se puede es demostrarlo con la muestra.
    const r = await analizar(FIXTURES.mp4, "audio/mp4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("inconcluso");
      expect(r.valor.mimeDetectado).toBe("video/mp4");
      expect(r.valor.motivo).toContain("no distingue audio de video");
    }
  });

  it("Ogg sin códec reconocible declarado como audio/ogg → INCONCLUSO", async () => {
    const r = await analizar(FIXTURES.oggDesconocido, "audio/ogg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("inconcluso");
      expect(r.valor.mimeDetectado).toBe("application/ogg");
    }
  });

  it("TODO inconcluso bloquea el sello", async () => {
    for (const [bytes, mime] of [
      [FIXTURES.mp4, "video/mp4"],
      [FIXTURES.webm, "video/webm"],
      [FIXTURES.quicktime, "video/quicktime"],
      [FIXTURES.mp4, "audio/mp4"],
    ] as const) {
      const r = await analizar(bytes, mime);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.valor.veredicto, mime).toBe("inconcluso");
        expect(r.valor.bloqueaSello, mime).toBe(true);
      }
    }
  });
});

describe("desconocido", () => {
  it("bytes sin firma reconocible → DESCONOCIDO", async () => {
    const r = await analizar(FIXTURES.basura, "image/jpeg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.veredicto).toBe("desconocido");
      expect(r.valor.mimeDetectado).toBe(null);
      expect(r.valor.bloqueaSello).toBe(true);
    }
  });
});

// ============================================================
// 4. compararFirma — la tabla, sin I/O
// ============================================================

describe("compararFirma (pura)", () => {
  it("solo 'compatible' desbloquea el sello", () => {
    const casos: [MimePermitido, string | undefined, string][] = [
      ["image/jpeg", "image/jpeg", "compatible"],
      ["image/jpeg", "image/png", "incompatible"],
      ["image/jpeg", undefined, "desconocido"],
      ["video/mp4", "video/mp4", "inconcluso"],
    ];
    for (const [declarado, detectado, esperado] of casos) {
      const r = compararFirma(declarado, detectado ? { mime: detectado, ext: "x" } : undefined);
      expect(r.veredicto).toBe(esperado);
      expect(r.bloqueaSello).toBe(esperado !== "compatible");
    }
  });

  it("ningún MIME de video puede dar 'compatible', con la detección que sea", () => {
    for (const mime of ["video/mp4", "video/webm", "video/quicktime"] as const) {
      for (const detectado of ["video/mp4", "video/webm", "video/quicktime", "image/jpeg"]) {
        const r = compararFirma(mime, { mime: detectado, ext: "x" });
        expect(r.veredicto, `${mime} vs ${detectado}`).not.toBe("compatible");
      }
    }
  });
});

// ============================================================
// 4.b El TIPO impide las combinaciones imposibles
// ============================================================

describe("AnalisisFirma es una unión discriminada real", () => {
  it("estrechar por veredicto produce el literal correcto de bloqueaSello", () => {
    const r = compararFirma("image/jpeg", { mime: "image/jpeg", ext: "jpg" });

    if (r.veredicto === "compatible") {
      expectTypeOf(r.bloqueaSello).toEqualTypeOf<false>();
      expectTypeOf(r.equivalencia).toEqualTypeOf<string | null>();
    } else if (r.veredicto === "incompatible") {
      expectTypeOf(r.bloqueaSello).toEqualTypeOf<true>();
    } else if (r.veredicto === "inconcluso") {
      expectTypeOf(r.bloqueaSello).toEqualTypeOf<true>();
    } else {
      expectTypeOf(r.veredicto).toEqualTypeOf<"desconocido">();
      expectTypeOf(r.bloqueaSello).toEqualTypeOf<true>();
    }
  });

  it("compatible SIEMPRE tiene bloqueaSello false", () => {
    expectTypeOf<AnalisisCompatible["bloqueaSello"]>().toEqualTypeOf<false>();
    expectTypeOf<AnalisisCompatible["veredicto"]>().toEqualTypeOf<"compatible">();
  });

  it("cualquier otro veredicto SIEMPRE tiene bloqueaSello true", () => {
    expectTypeOf<AnalisisIncompatible["bloqueaSello"]>().toEqualTypeOf<true>();
    expectTypeOf<AnalisisInconcluso["bloqueaSello"]>().toEqualTypeOf<true>();
    expectTypeOf<AnalisisDesconocido["bloqueaSello"]>().toEqualTypeOf<true>();
  });

  it("NO existe una ruta que construya incompatible + bloqueaSello false", () => {
    // Objetos COMPLETOS con solo el literal cambiado: si se escribieran
    // como `{veredicto, bloqueaSello}` a secas, no extenderían la unión
    // por campos faltantes y el test pasaría sin probar nada.
    type IncompatibleQueNoBloquea = Omit<AnalisisIncompatible, "bloqueaSello"> & {
      bloqueaSello: false;
    };
    type InconclusoQueNoBloquea = Omit<AnalisisInconcluso, "bloqueaSello"> & {
      bloqueaSello: false;
    };
    type DesconocidoQueNoBloquea = Omit<AnalisisDesconocido, "bloqueaSello"> & {
      bloqueaSello: false;
    };
    type CompatibleQueBloquea = Omit<AnalisisCompatible, "bloqueaSello"> & {
      bloqueaSello: true;
    };

    // Si alguien aflojara el tipo a `bloqueaSello: boolean`, estas
    // cuatro empezarían a extender la unión y `tsc` fallaría acá.
    expectTypeOf<IncompatibleQueNoBloquea>().not.toExtend<AnalisisFirma>();
    expectTypeOf<InconclusoQueNoBloquea>().not.toExtend<AnalisisFirma>();
    expectTypeOf<DesconocidoQueNoBloquea>().not.toExtend<AnalisisFirma>();
    expectTypeOf<CompatibleQueBloquea>().not.toExtend<AnalisisFirma>();

    // Y las cuatro correctas sí extienden.
    expectTypeOf<AnalisisCompatible>().toExtend<AnalisisFirma>();
    expectTypeOf<AnalisisIncompatible>().toExtend<AnalisisFirma>();
    expectTypeOf<AnalisisInconcluso>().toExtend<AnalisisFirma>();
    expectTypeOf<AnalisisDesconocido>().toExtend<AnalisisFirma>();
  });

  it("la unión tiene exactamente las cuatro variantes", () => {
    expectTypeOf<AnalisisFirma["veredicto"]>().toEqualTypeOf<
      "compatible" | "incompatible" | "inconcluso" | "desconocido"
    >();
  });

  it("y en tiempo de ejecución la regla se cumple en las 12 declaraciones", async () => {
    // El tipo lo garantiza en compilación; esto lo confirma sobre los
    // resultados que de verdad produce el módulo.
    for (const mime of MIMES_PERMITIDOS) {
      for (const detectado of [
        undefined,
        { mime: "image/jpeg", ext: "jpg" },
        { mime: "video/mp4", ext: "mp4" },
        { mime: mime as string, ext: "x" },
      ]) {
        const r = compararFirma(mime, detectado);
        expect(r.bloqueaSello, `${mime} / ${detectado?.mime}`).toBe(
          r.veredicto !== "compatible",
        );
      }
    }
  });
});

// ============================================================
// 5. Lectura desde R2: rango, tope y errores
// ============================================================

describe("lectura acotada", () => {
  it("pide el rango EXACTO bytes=0-65535 y nunca el objeto completo", async () => {
    const { cliente, comandos } = clienteFalso(enTrozos(FIXTURES.jpeg));
    await analizarFirmaEnR2({ clave: CLAVE, mimeDeclarado: "image/jpeg" }, deps(cliente));
    expect(comandos).toHaveLength(1);
    expect(comandos[0].Range).toBe("bytes=0-65535");
    expect(RANGO_MUESTRA).toBe("bytes=0-65535");
    expect(MAX_BYTES_MUESTRA).toBe(65_536);
    // Sin `Range`, la petición bajaría el archivo entero.
    expect(comandos[0].Range).toBeDefined();
  });

  it("informa cuántos bytes leyó", async () => {
    const r = await analizar(FIXTURES.jpeg, "image/jpeg");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.bytesLeidos).toBe(FIXTURES.jpeg.length);
  });

  it("corta y RECHAZA si el origen entrega más de 65 536 bytes", async () => {
    // Un origen que ignora el Range. `transformToByteArray()` se lo
    // habría tragado entero; la lectura por trozos lo corta.
    const gigante = new Uint8Array(MAX_BYTES_MUESTRA + 1024).fill(0xff);
    gigante.set([0xff, 0xd8, 0xff, 0xdb], 0);
    const { cliente } = clienteFalso(enTrozos(gigante, 8192));
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("lectura-excesiva");
      expect(r.error.mensaje).toContain("65536");
    }
  });

  it("justo 65 536 bytes SÍ se acepta", async () => {
    const alLimite = new Uint8Array(MAX_BYTES_MUESTRA);
    alLimite.set([0xff, 0xd8, 0xff, 0xdb], 0);
    const { cliente } = clienteFalso(enTrozos(alLimite, 8192));
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.bytesLeidos).toBe(MAX_BYTES_MUESTRA);
  });

  it("archivo vacío → rechazado", async () => {
    const { cliente } = clienteFalso(enTrozos(new Uint8Array(0)));
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("archivo-vacio");
  });

  it("Body ausente → rechazado", async () => {
    const cliente = { send: vi.fn(async () => ({})) };
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("sin-cuerpo");
  });

  it("Body que no se puede iterar → rechazado", async () => {
    const { cliente } = clienteFalso({ no: "iterable" });
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("cuerpo-ilegible");
  });

  it("un stream que se corta a mitad → rechazado, no truncado en silencio", async () => {
    async function* roto() {
      yield new Uint8Array([0xff, 0xd8]);
      throw new Error("se cortó la conexión");
    }
    const { cliente } = clienteFalso(roto());
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("cuerpo-ilegible");
  });

  it("un archivo TRUNCADO a 2 bytes no se detecta como JPEG", async () => {
    const r = await analizar(new Uint8Array([0xff, 0xd8]), "image/jpeg");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.veredicto).toBe("desconocido");
  });
});

// ============================================================
// 6. Errores sanitizados y validación de entrada
// ============================================================

describe("errores sanitizados", () => {
  it("una excepción del SDK no filtra credenciales ni URLs", async () => {
    const { cliente } = clienteFalso(() => {
      const e = new Error(
        "denied https://cuenta.r2.cloudflarestorage.com/x?X-Amz-Credential=SECRETO123",
      ) as Error & { name: string; $metadata: { httpStatusCode: number } };
      e.name = "AccessDenied";
      e.$metadata = { httpStatusCode: 403 };
      throw e;
    });
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("fallo-proveedor");
      expect(r.error.mensaje).toContain("AccessDenied");
      expect(r.error.mensaje).not.toContain("SECRETO123");
      expect(r.error.mensaje).not.toContain("cloudflarestorage");
    }
  });

  it("un objeto inexistente da 'no-existe'", async () => {
    const { cliente } = clienteFalso(() => {
      const e = new Error("nada") as Error & { name: string };
      e.name = "NoSuchKey";
      throw e;
    });
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("no-existe");
  });

  it("ningún error menciona el bucket ni la clave", async () => {
    const { cliente } = clienteFalso(() => {
      const e = new Error("x") as Error & { name: string };
      e.name = "InternalError";
      throw e;
    });
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.mensaje).not.toContain("originales");
      expect(r.error.mensaje).not.toContain(CLAVE);
    }
  });

  it("un detector que LANZA no deja pasar el archivo", async () => {
    const { cliente } = clienteFalso(enTrozos(FIXTURES.jpeg));
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      deps(cliente, {
        detectar: async () => {
          throw new Error("el parser explotó");
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("fallo-deteccion");
      expect(r.error.mensaje).not.toContain("explotó");
    }
  });
});

describe("validación de entrada", () => {
  it("una clave insegura se rechaza sin llamar a R2", async () => {
    const { cliente, comandos } = clienteFalso(enTrozos(FIXTURES.jpeg));
    const r = await analizarFirmaEnR2(
      { clave: "../../otro.jpg", mimeDeclarado: "image/jpeg" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("clave-invalida");
    expect(comandos).toHaveLength(0);
  });

  it("un MIME fuera de la lista permitida se rechaza sin llamar a R2", async () => {
    const { cliente, comandos } = clienteFalso(enTrozos(FIXTURES.jpeg));
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "application/zip" },
      deps(cliente),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("mime-no-permitido");
    expect(comandos).toHaveLength(0);
  });

  it("con el entorno incompleto no se llama a R2", async () => {
    const { cliente, comandos } = clienteFalso(enTrozos(FIXTURES.jpeg));
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg" },
      { entorno: {} as NodeJS.ProcessEnv, cliente: cliente as never },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("config-incompleta");
    expect(comandos).toHaveLength(0);
  });

  it("tolera el charset pegado al MIME declarado", async () => {
    const { cliente } = clienteFalso(enTrozos(FIXTURES.jpeg));
    const r = await analizarFirmaEnR2(
      { clave: CLAVE, mimeDeclarado: "image/jpeg; charset=binary" },
      deps(cliente),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.veredicto).toBe("compatible");
  });
});
