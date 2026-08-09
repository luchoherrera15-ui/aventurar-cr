import { describe, expect, it } from "vitest";
import {
  contarPorOrigen,
  legacyYaNoSeUsa,
  necesitaMigracion,
  resolverOriginal,
  resolverVisual,
  rutaCloudflare,
  urlVisual,
} from "./resolver";
import type { EstadoMedia, MediaAsset, Provider, Visibilidad } from "./tipos";

const DELIVERY = "https://imagedelivery.net/hash-de-cuenta";
const LEGACY = "https://proyecto.supabase.co/storage/v1/object/public/albumes/a/1.jpg";

type Visual = Parameters<typeof resolverVisual>[0];

function asset(over: Partial<MediaAsset> = {}): Visual {
  return {
    estado: "listo" as EstadoMedia,
    deleted_at: null,
    visibilidad: "publica" as Visibilidad,
    cf_image_id: "cf-123",
    legacy_url: LEGACY,
    ...over,
  };
}

describe("orden de resolución", () => {
  it("1. si está listo en Cloudflare, usa Cloudflare", () => {
    expect(resolverVisual(asset(), "card", { deliveryUrl: DELIVERY })).toEqual({
      tipo: "cloudflare",
      url: `${DELIVERY}/cf-123/card`,
    });
  });

  it("2. si todavía no está migrado, usa la URL de Supabase", () => {
    const r = resolverVisual(
      asset({ estado: "pendiente", cf_image_id: null }),
      "card",
      { deliveryUrl: DELIVERY },
    );
    expect(r).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("3. si la migración FALLÓ, la foto se sigue viendo por legacy", () => {
    // El caso que no puede romperse: una migración a medias no deja a
    // nadie sin foto.
    const r = resolverVisual(asset({ estado: "error", cf_image_id: null }), "card", {
      deliveryUrl: DELIVERY,
    });
    expect(r).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("4. sin ningún origen, avisa en vez de inventar una URL", () => {
    const r = resolverVisual(asset({ cf_image_id: null, legacy_url: null }), "card", {
      deliveryUrl: DELIVERY,
    });
    expect(r).toEqual({ tipo: "sin-imagen", motivo: "sin-origen" });
  });

  it("borrada no se muestra aunque los archivos existan", () => {
    const r = resolverVisual(asset({ deleted_at: "2026-01-01T00:00:00Z" }), "card", {
      deliveryUrl: DELIVERY,
    });
    expect(r).toEqual({ tipo: "sin-imagen", motivo: "borrada" });
  });
});

describe("un asset parcial NO se sirve por Cloudflare", () => {
  it("parcial_cf tiene imagen pero no original: cae a legacy", () => {
    // Servirlo prometería una descarga del original que no existe.
    const r = resolverVisual(asset({ estado: "parcial_cf" }), "card", { deliveryUrl: DELIVERY });
    expect(r).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("parcial_r2 tampoco", () => {
    const r = resolverVisual(asset({ estado: "parcial_r2" }), "card", { deliveryUrl: DELIVERY });
    expect(r.tipo).toBe("legacy");
  });
});

describe("sin deliveryUrl configurada, todo cae a legacy", () => {
  it("es el comportamiento correcto: nada se rompe si falta la variable", () => {
    expect(resolverVisual(asset(), "card", {})).toEqual({ tipo: "legacy", url: LEGACY });
    expect(resolverVisual(asset(), "card", { deliveryUrl: null })).toEqual({
      tipo: "legacy",
      url: LEGACY,
    });
  });
});

describe("visibilidad y firma", () => {
  it("pública se sirve directo, sin token", () => {
    const r = resolverVisual(asset({ visibilidad: "publica" }), "hero", {
      deliveryUrl: DELIVERY,
    });
    expect(r).toEqual({ tipo: "cloudflare", url: `${DELIVERY}/cf-123/hero` });
  });

  it("compartida en Cloudflare EXIGE firma; sin firmante lo dice", () => {
    const r = resolverVisual(asset({ visibilidad: "compartida" }), "gallery", {
      deliveryUrl: DELIVERY,
    });
    expect(r).toEqual({ tipo: "requiere-firma", ruta: "cf-123/gallery", variante: "gallery" });
  });

  it("compartida con firmante devuelve la URL firmada", () => {
    const r = resolverVisual(asset({ visibilidad: "compartida" }), "gallery", {
      deliveryUrl: DELIVERY,
      firmar: (ruta, variante) => `${DELIVERY}/${ruta}?sig=abc&v=${variante}`,
    });
    expect(r).toEqual({ tipo: "cloudflare", url: `${DELIVERY}/cf-123/gallery?sig=abc&v=gallery` });
  });

  it("privada NUNCA cae a legacy: sería exponer un bucket privado", () => {
    const r = resolverVisual(
      asset({ visibilidad: "privada", estado: "pendiente", cf_image_id: null }),
      "card",
      { deliveryUrl: DELIVERY },
    );
    expect(r).toEqual({ tipo: "sin-imagen", motivo: "sin-firmante" });
  });

  it("compartida SÍ cae a legacy mientras el bucket del álbum sea público (0068)", () => {
    const r = resolverVisual(
      asset({ visibilidad: "compartida", estado: "pendiente", cf_image_id: null }),
      "card",
      { deliveryUrl: DELIVERY },
    );
    expect(r).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("y deja de caer cuando el álbum pase a ser privado de verdad", () => {
    const r = resolverVisual(
      asset({ visibilidad: "compartida", estado: "pendiente", cf_image_id: null }),
      "card",
      { deliveryUrl: DELIVERY, legacyCompartidaEsPublica: false },
    );
    expect(r).toEqual({ tipo: "sin-imagen", motivo: "sin-firmante" });
  });
});

describe("urlVisual (la versión cómoda)", () => {
  it("devuelve el string cuando hay algo que mostrar", () => {
    expect(urlVisual(asset(), "thumb", { deliveryUrl: DELIVERY })).toBe(`${DELIVERY}/cf-123/thumb`);
  });

  it("devuelve null cuando hace falta una firma que no se puede hacer", () => {
    expect(urlVisual(asset({ visibilidad: "compartida" }), "thumb", { deliveryUrl: DELIVERY })).toBe(
      null,
    );
  });
});

describe("rutaCloudflare y la barra final", () => {
  it("arma {imageId}/{variante}", () => {
    expect(rutaCloudflare("abc", "thumb")).toBe("abc/thumb");
  });

  it("una deliveryUrl con barra final no produce una doble barra", () => {
    const r = resolverVisual(asset(), "card", { deliveryUrl: `${DELIVERY}/` });
    expect(r).toEqual({ tipo: "cloudflare", url: `${DELIVERY}/cf-123/card` });
  });
});

describe("resolverOriginal (la descarga)", () => {
  it("prefiere R2 y devuelve la CLAVE, nunca una URL", () => {
    const r = resolverOriginal({
      estado: "listo",
      deleted_at: null,
      r2_key: "originals/a/album/b/c/foto.jpg",
      legacy_url: LEGACY,
    });
    expect(r).toEqual({ tipo: "r2", clave: "originals/a/album/b/c/foto.jpg" });
  });

  it("un parcial_r2 SÍ sirve para descargar: el original ya está arriba", () => {
    const r = resolverOriginal({
      estado: "parcial_r2",
      deleted_at: null,
      r2_key: "originals/x",
      legacy_url: null,
    });
    expect(r).toEqual({ tipo: "r2", clave: "originals/x" });
  });

  it("sin R2 todavía, se baja de Supabase", () => {
    const r = resolverOriginal({
      estado: "pendiente",
      deleted_at: null,
      r2_key: null,
      legacy_url: LEGACY,
    });
    expect(r).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("borrada no se descarga", () => {
    const r = resolverOriginal({
      estado: "listo",
      deleted_at: "2026-01-01T00:00:00Z",
      r2_key: "originals/x",
      legacy_url: null,
    });
    expect(r).toEqual({ tipo: "sin-original", motivo: "borrada" });
  });
});

describe("preguntas de mantenimiento", () => {
  it("necesitaMigracion solo se apaga con cloudflare + listo", () => {
    const base = { deleted_at: null };
    expect(
      necesitaMigracion({ ...base, provider: "supabase_legacy" as Provider, estado: "listo" }),
    ).toBe(true);
    expect(
      necesitaMigracion({ ...base, provider: "cloudflare" as Provider, estado: "parcial_cf" }),
    ).toBe(true);
    expect(necesitaMigracion({ ...base, provider: "cloudflare" as Provider, estado: "listo" })).toBe(
      false,
    );
  });

  it("legacyYaNoSeUsa exige las DOS copias", () => {
    expect(
      legacyYaNoSeUsa({ estado: "listo", deleted_at: null, cf_image_id: "a", r2_key: "b" }),
    ).toBe(true);
    expect(
      legacyYaNoSeUsa({ estado: "listo", deleted_at: null, cf_image_id: "a", r2_key: null }),
    ).toBe(false);
  });

  it("contarPorOrigen mide el avance de la migración", () => {
    const cuenta = contarPorOrigen(
      [
        asset(),
        asset(),
        asset({ estado: "pendiente", cf_image_id: null }),
        asset({ visibilidad: "compartida" }),
        asset({ cf_image_id: null, legacy_url: null }),
      ],
      "card",
      { deliveryUrl: DELIVERY },
    );
    expect(cuenta).toEqual({
      cloudflare: 2,
      legacy: 1,
      "requiere-firma": 1,
      "sin-imagen": 1,
    });
  });
});
