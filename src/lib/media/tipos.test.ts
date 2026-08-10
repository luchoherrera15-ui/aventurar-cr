import { describe, expect, it } from "vitest";
import {
  ENTIDADES,
  ENTREGA,
  MAX_BYTES_IMAGEN,
  MIMES_PERMITIDOS,
  VISIBILIDADES,
  VISIBILIDAD_POR_DEFECTO,
  cloudflareConfirmado,
  destinosRequeridos,
  r2Confirmado,
  esEntidad,
  esEstado,
  esInconsistente,
  esMimePermitido,
  esVariante,
  esVisibilidad,
  estaListo,
  estaVivo,
  estadoSegunDestinos,
  faltantes,
  sePuedeReintentar,
  tipoDeMime,
  visibilidadDeEntidad,
  type AssetVerificable,
  type EntidadMedia,
} from "./tipos";

const SELLO = "2026-08-10T12:00:00Z";

/** Una imagen completa y sana, para variar solo lo que cada test mira. */
function imagen(over: Partial<AssetVerificable> = {}): AssetVerificable {
  return {
    estado: "listo",
    deleted_at: null,
    mime: "image/jpeg",
    r2_key: "originals/a/album/b/c/foto.jpg",
    r2_verificado_en: SELLO,
    cf_image_id: "cf-123",
    cf_verificado_en: SELLO,
    ...over,
  };
}

describe("visibilidad", () => {
  it("tiene los tres niveles y no dos", () => {
    expect(VISIBILIDADES).toEqual(["publica", "compartida", "privada"]);
  });

  it("el default es el más restrictivo", () => {
    // Si esto alguna vez pasa a 'publica', cualquier fila insertada por
    // un camino nuevo se publica sola. Que el test lo grite.
    expect(VISIBILIDAD_POR_DEFECTO).toBe("privada");
  });

  it("solo lo público se entrega directo", () => {
    expect(ENTREGA.publica).toBe("directa");
    expect(ENTREGA.compartida).toBe("firmada");
    expect(ENTREGA.privada).toBe("firmada");
  });

  it("le asigna a cada producto la visibilidad que le toca", () => {
    expect(visibilidadDeEntidad("rancho")).toBe("publica");
    expect(visibilidadDeEntidad("rancho_item")).toBe("publica");
    expect(visibilidadDeEntidad("equipo")).toBe("publica");
    expect(visibilidadDeEntidad("invitacion")).toBe("publica");
    // El QR de la mesa, no una cuenta.
    expect(visibilidadDeEntidad("album")).toBe("compartida");
    expect(visibilidadDeEntidad("comprobante")).toBe("privada");
    expect(visibilidadDeEntidad("verificacion")).toBe("privada");
  });

  it("ninguna entidad se queda sin visibilidad declarada", () => {
    for (const e of ENTIDADES) {
      expect(esVisibilidad(visibilidadDeEntidad(e as EntidadMedia))).toBe(true);
    }
  });
});

describe("guardas de tipo", () => {
  it("acepta lo conocido y rechaza lo inventado", () => {
    expect(esVisibilidad("compartida")).toBe(true);
    expect(esVisibilidad("publico")).toBe(false);
    expect(esEstado("parcial_r2")).toBe(true);
    expect(esEstado("casi")).toBe(false);
    expect(esEntidad("album")).toBe(true);
    expect(esEntidad("albumes")).toBe(false);
    expect(esVariante("gallery")).toBe(true);
    expect(esVariante("grande")).toBe(false);
  });

  it("no se cae con null, undefined ni objetos", () => {
    for (const v of [null, undefined, 0, {}, [], true]) {
      expect(esVisibilidad(v)).toBe(false);
      expect(esEstado(v)).toBe(false);
      expect(esVariante(v)).toBe(false);
    }
  });
});

describe("MIME", () => {
  it("clasifica los tres tipos", () => {
    expect(tipoDeMime("image/jpeg")).toBe("imagen");
    expect(tipoDeMime("image/heic")).toBe("imagen");
    expect(tipoDeMime("video/quicktime")).toBe("video");
    expect(tipoDeMime("audio/mpeg")).toBe("audio");
  });

  it("rechaza lo que no es media, incluido SVG", () => {
    // SVG es vectorial y puede traer <script>: no entra.
    for (const m of ["application/zip", "text/html", "image/svg+xml", "image/gif", ""]) {
      expect(esMimePermitido(m)).toBe(false);
    }
  });

  it("tolera el charset pegado y las mayúsculas", () => {
    expect(tipoDeMime("IMAGE/JPEG; charset=binary")).toBe("imagen");
  });

  it("no se cae con basura", () => {
    for (const m of [null, undefined, 42, {}]) expect(esMimePermitido(m)).toBe(false);
  });

  it("los doce MIME permitidos se clasifican todos", () => {
    for (const m of MIMES_PERMITIDOS) expect(tipoDeMime(m)).not.toBe(null);
    expect(MIMES_PERMITIDOS).toHaveLength(12);
  });
});

describe("destinos obligatorios por tipo", () => {
  it("la imagen necesita R2 y Cloudflare", () => {
    expect(destinosRequeridos("imagen")).toEqual({ r2: true, cloudflare: true });
  });

  it("video y audio son R2-only: no tienen copia visual", () => {
    expect(destinosRequeridos("video")).toEqual({ r2: true, cloudflare: false });
    expect(destinosRequeridos("audio")).toEqual({ r2: true, cloudflare: false });
  });

  it("el tope de imagen es el de Cloudflare Images", () => {
    expect(MAX_BYTES_IMAGEN).toBe(10 * 1024 * 1024);
  });
});

describe("estaListo — no alcanza con que la columna diga listo", () => {
  it("una imagen con las dos copias está lista", () => {
    expect(estaListo(imagen())).toBe(true);
  });

  it("imagen en estado listo SIN r2_key no está lista", () => {
    // Prometería una descarga que no existe.
    const a = imagen({ r2_key: null });
    expect(estaListo(a)).toBe(false);
    expect(esInconsistente(a)).toBe(true);
    expect(faltantes(a)).toEqual(["r2"]);
  });

  it("imagen en estado listo SIN cf_image_id no está lista", () => {
    const a = imagen({ cf_image_id: null });
    expect(estaListo(a)).toBe(false);
    expect(esInconsistente(a)).toBe(true);
    expect(faltantes(a)).toEqual(["cloudflare"]);
  });

  it("un video confirmado SOLO en R2 sí está listo", () => {
    const v = imagen({ mime: "video/mp4", cf_image_id: null, cf_verificado_en: null });
    expect(estaListo(v)).toBe(true);
    expect(faltantes(v)).toEqual([]);
    expect(esInconsistente(v)).toBe(false);
  });

  it("un audio confirmado SOLO en R2 sí está listo", () => {
    const a = imagen({ mime: "audio/mpeg", cf_image_id: null, cf_verificado_en: null });
    expect(estaListo(a)).toBe(true);
    expect(faltantes(a)).toEqual([]);
  });

  it("un video sin r2_key NO está listo: no hay qué descargar", () => {
    const v = imagen({
      mime: "video/mp4",
      r2_key: null,
      r2_verificado_en: null,
      cf_image_id: null,
      cf_verificado_en: null,
    });
    expect(estaListo(v)).toBe(false);
    expect(faltantes(v)).toEqual(["r2"]);
  });

  it("registro inconsistente: MIME nulo o desconocido nunca está listo", () => {
    expect(estaListo(imagen({ mime: null }))).toBe(false);
    expect(estaListo(imagen({ mime: "application/zip" }))).toBe(false);
    // Sin saber el tipo no se puede saber qué exigir: se piden los dos.
    expect(
      faltantes({
        mime: null,
        r2_key: null,
        r2_verificado_en: null,
        cf_image_id: null,
        cf_verificado_en: null,
      }),
    ).toEqual(["r2", "cloudflare"]);
  });

  it("un parcial NO es listo, aunque una copia sirva", () => {
    expect(estaListo(imagen({ estado: "parcial_cf" }))).toBe(false);
    expect(estaListo(imagen({ estado: "parcial_r2" }))).toBe(false);
    // Y no es "inconsistente": es un estado legítimo a mitad de camino.
    expect(esInconsistente(imagen({ estado: "parcial_r2" }))).toBe(false);
  });

  it("una r2_key RESERVADA sin sello no cuenta como confirmada", () => {
    // El caso que motiva las dos columnas: la clave se calcula antes de
    // subir, así que existe desde que la fila nace.
    const a = imagen({ r2_verificado_en: null });
    expect(r2Confirmado(a)).toBe(false);
    expect(estaListo(a)).toBe(false);
    expect(faltantes(a)).toEqual(["r2"]);
    expect(esInconsistente(a)).toBe(true);
  });

  it("un cf_image_id BORRADOR sin sello no cuenta como confirmado", () => {
    // Direct Creator Upload devuelve el id antes de recibir un byte.
    const a = imagen({ cf_verificado_en: null });
    expect(cloudflareConfirmado(a)).toBe(false);
    expect(estaListo(a)).toBe(false);
    expect(faltantes(a)).toEqual(["cloudflare"]);
  });

  it("un asset pendiente con las DOS reservas y ningún sello no está listo", () => {
    const a = imagen({ estado: "pendiente", r2_verificado_en: null, cf_verificado_en: null });
    expect(estaListo(a)).toBe(false);
    expect(faltantes(a)).toEqual(["r2", "cloudflare"]);
    // No es "inconsistente": es un estado legítimo a mitad de camino.
    expect(esInconsistente(a)).toBe(false);
  });

  it("un sello sin su clave tampoco alcanza", () => {
    expect(r2Confirmado({ r2_key: null, r2_verificado_en: SELLO })).toBe(false);
    expect(cloudflareConfirmado({ cf_image_id: null, cf_verificado_en: SELLO })).toBe(false);
  });

  it("borrado lógico deja de estar vivo y de estar listo", () => {
    expect(estaVivo({ deleted_at: null })).toBe(true);
    expect(estaVivo({ deleted_at: "2026-01-01T00:00:00Z" })).toBe(false);
    expect(estaListo(imagen({ deleted_at: "2026-01-01T00:00:00Z" }))).toBe(false);
  });
});

describe("reintentos", () => {
  it("solo se reintenta lo que puede avanzar", () => {
    expect(sePuedeReintentar({ estado: "parcial_r2", deleted_at: null })).toBe(true);
    expect(sePuedeReintentar({ estado: "error", deleted_at: null })).toBe(true);
    expect(sePuedeReintentar({ estado: "listo", deleted_at: null })).toBe(false);
    expect(sePuedeReintentar({ estado: "error", deleted_at: "2026-01-01T00:00:00Z" })).toBe(false);
  });
});

describe("estadoSegunDestinos — la subida doble", () => {
  it("una imagen solo llega a listo con los DOS destinos", () => {
    expect(estadoSegunDestinos({ r2: true, cloudflare: true }, "imagen")).toBe("listo");
    expect(estadoSegunDestinos({ r2: true, cloudflare: false }, "imagen")).toBe("parcial_r2");
    expect(estadoSegunDestinos({ r2: false, cloudflare: true }, "imagen")).toBe("parcial_cf");
    expect(estadoSegunDestinos({ r2: false, cloudflare: false }, "imagen")).toBe("subiendo");
  });

  it("un video llega a listo solo con R2", () => {
    expect(estadoSegunDestinos({ r2: true, cloudflare: false }, "video")).toBe("listo");
    expect(estadoSegunDestinos({ r2: false, cloudflare: false }, "video")).toBe("subiendo");
  });

  it("un audio llega a listo solo con R2", () => {
    expect(estadoSegunDestinos({ r2: true, cloudflare: false }, "audio")).toBe("listo");
    expect(estadoSegunDestinos({ r2: false, cloudflare: false }, "audio")).toBe("subiendo");
  });

  it("VIDEO sin R2 pero con cloudflare true → subiendo, NUNCA parcial_cf", () => {
    // `parcial_cf` diría "la copia visual está lista" sobre un archivo
    // que no tiene copia visual, y encima es reintentable: el reintento
    // habría ido a buscar la mitad equivocada.
    expect(estadoSegunDestinos({ r2: false, cloudflare: true }, "video")).toBe("subiendo");
  });

  it("AUDIO sin R2 pero con cloudflare true → subiendo, NUNCA parcial_cf", () => {
    expect(estadoSegunDestinos({ r2: false, cloudflare: true }, "audio")).toBe("subiendo");
  });

  it("en video y audio, cloudflare no cambia nada: solo manda R2", () => {
    for (const tipo of ["video", "audio"] as const) {
      for (const cloudflare of [true, false]) {
        expect(estadoSegunDestinos({ r2: true, cloudflare }, tipo)).toBe("listo");
        expect(estadoSegunDestinos({ r2: false, cloudflare }, tipo)).toBe("subiendo");
      }
    }
  });

  it("y una imagen conserva sus dos estados parciales", () => {
    // El caso que NO se puede perder al arreglar lo de arriba.
    expect(estadoSegunDestinos({ r2: false, cloudflare: true }, "imagen")).toBe("parcial_cf");
    expect(estadoSegunDestinos({ r2: true, cloudflare: false }, "imagen")).toBe("parcial_r2");
  });
});
