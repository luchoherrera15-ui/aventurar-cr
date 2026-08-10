import { describe, expect, it } from "vitest";
import {
  necesitaMigracion,
  resolverOriginal,
  resolverVisual,
  rutaCloudflare,
  urlVisual,
} from "./resolver";
import type { AssetVerificable, MediaAsset, Visibilidad } from "./tipos";

const DELIVERY = "https://imagedelivery.net/hash-de-cuenta";
const LEGACY = "https://proyecto.supabase.co/storage/v1/object/public/albumes/a/1.jpg";
const R2 = "originals/a/album/b/c/foto.jpg";
const SELLO = "2026-08-10T12:00:00Z";

type Visual = AssetVerificable & Pick<MediaAsset, "visibilidad" | "legacy_url">;

function asset(over: Partial<Visual> = {}): Visual {
  return {
    estado: "listo",
    deleted_at: null,
    mime: "image/jpeg",
    r2_key: R2,
    r2_verificado_en: SELLO,
    cf_image_id: "cf-123",
    cf_verificado_en: SELLO,
    visibilidad: "publica" as Visibilidad,
    legacy_url: LEGACY,
    ...over,
  };
}

describe("orden de resolución", () => {
  it("1. si está listo y verificado, usa Cloudflare", () => {
    expect(resolverVisual(asset(), "card", { deliveryUrl: DELIVERY })).toEqual({
      tipo: "cloudflare",
      url: `${DELIVERY}/cf-123/card`,
    });
  });

  it("2. si todavía no está migrado, usa la URL de Supabase", () => {
    const r = resolverVisual(asset({ estado: "pendiente", cf_image_id: null }), "card", {
      deliveryUrl: DELIVERY,
    });
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

describe("una fila inconsistente no se sirve por Cloudflare", () => {
  it("marcada listo pero sin r2_key: cae a legacy", () => {
    // Servirla prometería una descarga del original que no existe.
    const r = resolverVisual(asset({ r2_key: null }), "card", { deliveryUrl: DELIVERY });
    expect(r).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("un parcial tampoco", () => {
    expect(resolverVisual(asset({ estado: "parcial_cf" }), "card", { deliveryUrl: DELIVERY })).toEqual(
      { tipo: "legacy", url: LEGACY },
    );
    expect(resolverVisual(asset({ estado: "parcial_r2" }), "card", { deliveryUrl: DELIVERY }).tipo).toBe(
      "legacy",
    );
  });
});

describe("video y audio no tienen copia visual", () => {
  const video = asset({ mime: "video/mp4", cf_image_id: null, cf_verificado_en: null });

  it("un video LISTO (solo R2) no recibe una URL de variante de Cloudflare", () => {
    // `estaListo` es true —un video no necesita Cloudflare— pero armar
    // `.../cf-xxx/card` para un mp4 sería prometer una miniatura que no
    // existe. Cae al legacy, que es el archivo de verdad.
    expect(resolverVisual(video, "card", { deliveryUrl: DELIVERY })).toEqual({
      tipo: "legacy",
      url: LEGACY,
    });
  });

  it("un audio LISTO tampoco", () => {
    const audio = asset({ mime: "audio/mpeg", cf_image_id: null, cf_verificado_en: null });
    expect(resolverVisual(audio, "thumb", { deliveryUrl: DELIVERY }).tipo).toBe("legacy");
  });

  it("pero su ORIGINAL sí se descarga: el sello de R2 está", () => {
    expect(
      resolverOriginal({
        deleted_at: null,
        r2_key: R2,
        r2_verificado_en: SELLO,
        legacy_url: null,
      }),
    ).toEqual({ tipo: "r2", clave: R2 });
  });

  it("y no necesitan migración por no tener Cloudflare", () => {
    expect(necesitaMigracion(video)).toBe(false);
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
    expect(resolverVisual(asset({ visibilidad: "publica" }), "hero", { deliveryUrl: DELIVERY })).toEqual(
      { tipo: "cloudflare", url: `${DELIVERY}/cf-123/hero` },
    );
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
      { deliveryUrl: DELIVERY, tokenDeAlbumValidado: true },
    );
    expect(r).toEqual({ tipo: "sin-imagen", motivo: "sin-firmante" });
  });
});

describe("fallback del álbum compartido — el default es CERRADO", () => {
  const albumSinMigrar = asset({
    visibilidad: "compartida",
    estado: "pendiente",
    cf_image_id: null,
  });

  it("sin validar el token del álbum, NO se sirve el legacy", () => {
    // El caso que importa: una ruta nueva que se olvida de validar el
    // QR no filtra las fotos de un álbum ajeno.
    expect(resolverVisual(albumSinMigrar, "card", { deliveryUrl: DELIVERY })).toEqual({
      tipo: "sin-imagen",
      motivo: "sin-firmante",
    });
  });

  it("pasar el flag en false es lo mismo que no pasarlo", () => {
    expect(
      resolverVisual(albumSinMigrar, "card", {
        deliveryUrl: DELIVERY,
        tokenDeAlbumValidado: false,
      }),
    ).toEqual({ tipo: "sin-imagen", motivo: "sin-firmante" });
  });

  it("solo con el token YA validado se sirve el legacy público (0068)", () => {
    expect(
      resolverVisual(albumSinMigrar, "card", {
        deliveryUrl: DELIVERY,
        tokenDeAlbumValidado: true,
      }),
    ).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("un valor que no sea exactamente true no abre la puerta", () => {
    const opciones = { deliveryUrl: DELIVERY, tokenDeAlbumValidado: undefined };
    expect(resolverVisual(albumSinMigrar, "card", opciones).tipo).toBe("sin-imagen");
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
    expect(resolverVisual(asset(), "card", { deliveryUrl: `${DELIVERY}/` })).toEqual({
      tipo: "cloudflare",
      url: `${DELIVERY}/cf-123/card`,
    });
  });
});

describe("resolverOriginal — manda el SELLO, no el estado", () => {
  it("con clave y sello devuelve la CLAVE de R2, nunca una URL", () => {
    expect(
      resolverOriginal({ deleted_at: null, r2_key: R2, r2_verificado_en: SELLO, legacy_url: LEGACY }),
    ).toEqual({ tipo: "r2", clave: R2 });
  });

  it("r2_key RESERVADA sin sello NO se descarga de R2", () => {
    // La clave se calcula al firmar la subida, o sea ANTES de que el
    // objeto exista. Firmar una descarga contra ella da 404.
    expect(
      resolverOriginal({ deleted_at: null, r2_key: R2, r2_verificado_en: null, legacy_url: LEGACY }),
    ).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("un sello sin clave tampoco alcanza", () => {
    expect(
      resolverOriginal({ deleted_at: null, r2_key: null, r2_verificado_en: SELLO, legacy_url: LEGACY }),
    ).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("sin confirmar y sin legacy, no hay descarga", () => {
    expect(
      resolverOriginal({ deleted_at: null, r2_key: R2, r2_verificado_en: null, legacy_url: null }),
    ).toEqual({ tipo: "sin-original", motivo: "sin-origen" });
  });

  it("sin R2 todavía, se baja de Supabase", () => {
    expect(
      resolverOriginal({ deleted_at: null, r2_key: null, r2_verificado_en: null, legacy_url: LEGACY }),
    ).toEqual({ tipo: "legacy", url: LEGACY });
  });

  it("borrada no se descarga", () => {
    expect(
      resolverOriginal({
        deleted_at: "2026-01-01T00:00:00Z",
        r2_key: R2,
        r2_verificado_en: SELLO,
        legacy_url: null,
      }),
    ).toEqual({ tipo: "sin-original", motivo: "borrada" });
  });
});

describe("necesitaMigracion — derivada, sin campo provider", () => {
  it("una imagen completa ya no necesita nada", () => {
    expect(necesitaMigracion(asset())).toBe(false);
  });

  it("le falta migrar mientras no esté completa", () => {
    expect(necesitaMigracion(asset({ estado: "pendiente" }))).toBe(true);
    expect(necesitaMigracion(asset({ estado: "parcial_cf" }))).toBe(true);
    // Marcada listo pero sin original: hay que volver a intentarlo.
    expect(necesitaMigracion(asset({ r2_key: null }))).toBe(true);
  });

  it("un video con su original en R2 ya está migrado", () => {
    expect(necesitaMigracion(asset({ mime: "video/mp4", cf_image_id: null }))).toBe(false);
  });

  it("lo borrado no se migra", () => {
    expect(necesitaMigracion(asset({ estado: "pendiente", deleted_at: "2026-01-01T00:00:00Z" }))).toBe(
      false,
    );
  });
});
