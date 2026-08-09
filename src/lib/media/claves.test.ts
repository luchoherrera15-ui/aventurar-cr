import { describe, expect, it } from "vitest";
import {
  MAX_CLAVE,
  claveOriginal,
  esClaveSegura,
  extensionDeMime,
  nombreConExtension,
  nuevoAssetId,
  prefijoDeAsset,
  revisarClave,
  sanitizarNombre,
} from "./claves";
import { MIMES_PERMITIDOS } from "./tipos";

const PARTES = {
  propietarioId: "11111111-1111-4111-8111-111111111111",
  entidad: "album" as const,
  entidadId: "22222222-2222-4222-8222-222222222222",
  assetId: "33333333-3333-4333-8333-333333333333",
};

describe("sanitizarNombre — traversal", () => {
  it("se queda solo con el último segmento, con las dos barras", () => {
    expect(sanitizarNombre("../../etc/passwd")).toBe("passwd");
    expect(sanitizarNombre("../../../secreto.jpg")).toBe("secreto.jpg");
    expect(sanitizarNombre("..\\..\\windows\\system32\\cmd.exe")).toBe("cmd.exe");
    expect(sanitizarNombre("/absoluto/foto.png")).toBe("foto.png");
    expect(sanitizarNombre("C:\\Users\\luis\\foto.png")).toBe("foto.png");
  });

  it("un nombre que es puro traversal no deja nada aprovechable", () => {
    expect(sanitizarNombre("..")).toBe("archivo");
    expect(sanitizarNombre("../..")).toBe("archivo");
    expect(sanitizarNombre("./././")).toBe("archivo");
  });

  it("el traversal codificado no se decodifica (queda inerte)", () => {
    // No se hace decodeURIComponent en ningún lado: %2e%2e es texto.
    expect(sanitizarNombre("%2e%2e%2ffoto.jpg")).toBe("2e-2e-2ffoto.jpg");
  });
});

describe("sanitizarNombre — caracteres de control e invisibles", () => {
  it("borra controles C0, incluido el byte nulo", () => {
    expect(sanitizarNombre("foto\u0000.jpg")).toBe("foto.jpg");
    expect(sanitizarNombre("fo\u0009to\u000A.jpg")).toBe("foto.jpg");
    expect(sanitizarNombre("\u001Bfoto.jpg")).toBe("foto.jpg");
  });

  it("borra DEL y los controles C1", () => {
    expect(sanitizarNombre("foto\u007F.jpg")).toBe("foto.jpg");
    expect(sanitizarNombre("foto\u0085.jpg")).toBe("foto.jpg");
  });

  it("borra los overrides de dirección que disfrazan la extensión", () => {
    // El truco clásico: se DIBUJA "fotogpj.exe" al revés.
    expect(sanitizarNombre("foto\u202Egpj.exe")).toBe("fotogpj.exe");
    expect(sanitizarNombre("foto\u2066\u2069.jpg")).toBe("foto.jpg");
  });

  it("borra espacios de ancho cero y el BOM", () => {
    expect(sanitizarNombre("fo\u200Bto\uFEFF.jpg")).toBe("foto.jpg");
  });
});

describe("sanitizarNombre — nombres peligrosos de Windows", () => {
  it("les pone prefijo en vez de rechazar la subida", () => {
    expect(sanitizarNombre("CON.jpg")).toBe("archivo-CON.jpg");
    expect(sanitizarNombre("nul.png")).toBe("archivo-nul.png");
    expect(sanitizarNombre("COM1.jpg")).toBe("archivo-COM1.jpg");
    expect(sanitizarNombre("LPT9.webp")).toBe("archivo-LPT9.webp");
    expect(sanitizarNombre("aux")).toBe("archivo-aux");
  });

  it("no toca un nombre que solo se parece a uno reservado", () => {
    expect(sanitizarNombre("console.jpg")).toBe("console.jpg");
    expect(sanitizarNombre("com10.jpg")).toBe("com10.jpg");
  });
});

describe("sanitizarNombre — nombres normales", () => {
  it("conserva algo legible y transcribe los acentos", () => {
    expect(sanitizarNombre("Cumpleaños de Mamá.JPG")).toBe("Cumpleanos-de-Mama.jpg");
    expect(sanitizarNombre("IMG_1067.jpeg")).toBe("IMG_1067.jpeg");
    expect(sanitizarNombre("mi.foto.final.jpg")).toBe("mi.foto.final.jpg");
  });

  it("no deja el archivo oculto ni con pinta de opción de consola", () => {
    expect(sanitizarNombre(".oculto.jpg")).toBe("oculto.jpg");
    expect(sanitizarNombre("--flag.jpg")).toBe("flag.jpg");
    expect(sanitizarNombre("foto.")).toBe("foto");
  });

  it("recorta lo larguísimo sin perder la extensión", () => {
    const salida = sanitizarNombre("a".repeat(500) + ".jpg");
    expect(salida.endsWith(".jpg")).toBe(true);
    expect(salida.length).toBeLessThanOrEqual(65);
  });

  it("siempre devuelve algo, aunque no quede nada que salvar", () => {
    expect(sanitizarNombre("🎉🎉🎉")).toBe("archivo");
    expect(sanitizarNombre("")).toBe("archivo");
    expect(sanitizarNombre("🎉.jpg")).toBe("archivo.jpg");
    expect(sanitizarNombre(null)).toBe("archivo");
    expect(sanitizarNombre(undefined)).toBe("archivo");
    expect(sanitizarNombre(42)).toBe("archivo");
  });
});

describe("revisarClave", () => {
  it("acepta una clave normal", () => {
    expect(revisarClave("originals/a/album/b/c/foto.jpg")).toEqual({ ok: true });
  });

  it("rechaza traversal en cualquier segmento", () => {
    expect(revisarClave("originals/../secreto")).toEqual({ ok: false, motivo: "traversal" });
    expect(revisarClave("a/./b")).toEqual({ ok: false, motivo: "traversal" });
    expect(revisarClave("a/.../b")).toEqual({ ok: false, motivo: "traversal" });
  });

  it("rechaza absolutas, vacías, dobles barras y controles", () => {
    expect(revisarClave("/originals/a")).toEqual({ ok: false, motivo: "absoluta" });
    expect(revisarClave("")).toEqual({ ok: false, motivo: "vacia" });
    expect(revisarClave("a//b")).toEqual({ ok: false, motivo: "segmento-vacio" });
    expect(revisarClave("a/b\u0000c")).toEqual({ ok: false, motivo: "caracter-no-permitido" });
    expect(revisarClave("a/b c")).toEqual({ ok: false, motivo: "caracter-no-permitido" });
    expect(revisarClave("a\\b")).toEqual({ ok: false, motivo: "caracter-no-permitido" });
  });

  it("rechaza lo que no es texto y lo demasiado largo", () => {
    expect(revisarClave(null).ok).toBe(false);
    expect(revisarClave({}).ok).toBe(false);
    expect(revisarClave("a".repeat(MAX_CLAVE + 1))).toEqual({ ok: false, motivo: "muy-larga" });
  });
});

describe("claveOriginal", () => {
  it("arma la ruta acordada", () => {
    expect(claveOriginal({ ...PARTES, nombre: "Foto Final.JPG" })).toBe(
      `originals/${PARTES.propietarioId}/album/${PARTES.entidadId}/${PARTES.assetId}/Foto-Final.jpg`,
    );
  });

  it("un nombre hostil no puede escaparse de su carpeta", () => {
    const clave = claveOriginal({ ...PARTES, nombre: "../../../../otro/portada.jpg" });
    expect(clave).toContain(`/${PARTES.assetId}/portada.jpg`);
    expect(clave.startsWith("originals/")).toBe(true);
    expect(esClaveSegura(clave)).toBe(true);
    expect(clave.split("/")).toHaveLength(6);
  });

  it("la clave resultante siempre pasa su propia validación", () => {
    for (const nombre of ["..", "🎉", "CON.jpg", "a".repeat(400), "foto\u202Egpj.exe"]) {
      expect(esClaveSegura(claveOriginal({ ...PARTES, nombre }))).toBe(true);
    }
  });

  it("revienta si un identificador trae una barra o un punto solo", () => {
    expect(() => claveOriginal({ ...PARTES, entidadId: "a/b", nombre: "x.jpg" })).toThrow();
    expect(() => claveOriginal({ ...PARTES, propietarioId: "..", nombre: "x.jpg" })).toThrow();
    expect(() => claveOriginal({ ...PARTES, assetId: "", nombre: "x.jpg" })).toThrow();
  });

  it("dos assets nunca comparten clave aunque el nombre sea el mismo", () => {
    const a = claveOriginal({ ...PARTES, assetId: "aaaa", nombre: "foto.jpg" });
    const b = claveOriginal({ ...PARTES, assetId: "bbbb", nombre: "foto.jpg" });
    expect(a).not.toBe(b);
  });
});

describe("prefijoDeAsset", () => {
  it("termina en el id del asset", () => {
    expect(prefijoDeAsset(PARTES)).toBe(
      `originals/${PARTES.propietarioId}/album/${PARTES.entidadId}/${PARTES.assetId}`,
    );
  });

  it("es prefijo de la clave del archivo", () => {
    const clave = claveOriginal({ ...PARTES, nombre: "foto.jpg" });
    expect(clave.startsWith(prefijoDeAsset(PARTES) + "/")).toBe(true);
  });
});

describe("extensión y MIME — las tablas están alineadas", () => {
  it("los DOCE MIME permitidos tienen extensión", () => {
    for (const m of MIMES_PERMITIDOS) {
      expect(extensionDeMime(m), `falta extensión para ${m}`).not.toBe(null);
    }
  });

  it("imágenes", () => {
    expect(extensionDeMime("image/jpeg")).toBe("jpg");
    expect(extensionDeMime("image/png")).toBe("png");
    expect(extensionDeMime("image/webp")).toBe("webp");
    expect(extensionDeMime("image/avif")).toBe("avif");
    expect(extensionDeMime("image/heic")).toBe("heic");
    expect(extensionDeMime("image/heif")).toBe("heif");
  });

  it("video", () => {
    expect(extensionDeMime("video/mp4")).toBe("mp4");
    expect(extensionDeMime("video/webm")).toBe("webm");
    expect(extensionDeMime("video/quicktime")).toBe("mov");
  });

  it("audio, y m4a no se confunde con mp4", () => {
    expect(extensionDeMime("audio/mpeg")).toBe("mp3");
    expect(extensionDeMime("audio/mp4")).toBe("m4a");
    expect(extensionDeMime("audio/ogg")).toBe("ogg");
  });

  it("un MIME que NO está permitido no tiene extensión", () => {
    // GIF estaba en la tabla vieja sin estar en la lista de permitidos.
    expect(extensionDeMime("image/gif")).toBe(null);
    expect(extensionDeMime("image/svg+xml")).toBe(null);
    expect(extensionDeMime("application/zip")).toBe(null);
    expect(extensionDeMime(null)).toBe(null);
  });

  it("tolera el charset pegado y las mayúsculas", () => {
    expect(extensionDeMime("IMAGE/WEBP")).toBe("webp");
    expect(extensionDeMime("image/jpeg; charset=binary")).toBe("jpg");
  });
});

describe("nombreConExtension", () => {
  it("el MIME le gana a una extensión mentirosa", () => {
    // El caso de iPhone: se llama .jpg pero es HEIC.
    expect(nombreConExtension("recuerdo.jpg", "image/heic")).toBe("recuerdo.heic");
  });

  it("corrige también video y audio", () => {
    expect(nombreConExtension("clip.avi", "video/mp4")).toBe("clip.mp4");
    expect(nombreConExtension("cancion.wav", "audio/mpeg")).toBe("cancion.mp3");
    expect(nombreConExtension("nota.mp4", "audio/mp4")).toBe("nota.m4a");
  });

  it("no reescribe cuando ya coincide, ni jpeg por jpg", () => {
    expect(nombreConExtension("foto.jpg", "image/jpeg")).toBe("foto.jpg");
    expect(nombreConExtension("foto.jpeg", "image/jpeg")).toBe("foto.jpeg");
  });

  it("le pone extensión al que no tiene", () => {
    expect(nombreConExtension("IMG_0042", "image/jpeg")).toBe("IMG_0042.jpg");
  });

  it("con un MIME no permitido devuelve el nombre sanitizado tal cual", () => {
    // validarArchivo ya lo rechazó antes; esto nunca debería verlo.
    expect(nombreConExtension("archivo.raro", "application/octet-stream")).toBe("archivo.raro");
  });
});

describe("nuevoAssetId", () => {
  it("da uuids distintos y usables como segmento de clave", () => {
    const a = nuevoAssetId();
    const b = nuevoAssetId();
    expect(a).not.toBe(b);
    expect(esClaveSegura(claveOriginal({ ...PARTES, assetId: a, nombre: "f.jpg" }))).toBe(true);
  });
});
