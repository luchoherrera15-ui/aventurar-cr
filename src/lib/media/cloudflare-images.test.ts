import { describe, expect, it, vi } from "vitest";

/**
 * `server-only` LANZA al importarse fuera del bundler de Next (su
 * `index.js` no hace otra cosa). Se reemplaza por un módulo vacío, que
 * es lo que Next entrega del lado del servidor.
 *
 * El `import "server-only"` NO se quita del módulo de producción: es la
 * barrera que hace fallar el build si alguien lo importa desde cliente.
 */
vi.mock("server-only", () => ({}));

import {
  EXPIRACION_FIRMA_MAX_S,
  EXPIRACION_FIRMA_MIN_S,
  EXPIRACION_SUBIDA_MAX_S,
  EXPIRACION_SUBIDA_MIN_S,
  borrarImagen,
  cloudflareConfigurado,
  confirmarImagen,
  configuracionCF,
  detalleImagen,
  esConfirmada,
  importarDesdeUrl,
  firmarUrl,
  medidasDeVariante,
  solicitarSubidaDirecta,
  urlDeVariante,
  urlSegunVisibilidad,
  type DependenciasCF,
} from "./cloudflare-images";
import { VARIANTES } from "./tipos";

/**
 * NINGUNA prueba de este archivo hace una petición real: `fetch` se
 * inyecta siempre. Si alguna vez una prueba tocara la red, fallaría en
 * CI sin conexión y —peor— podría crear imágenes de verdad en la cuenta.
 */

const ENTORNO_COMPLETO = {
  CLOUDFLARE_ACCOUNT_ID: "cuenta-de-prueba",
  CLOUDFLARE_IMAGES_ACCOUNT_HASH: "hash-de-prueba",
  CLOUDFLARE_IMAGES_API_TOKEN: "token-secreto-de-prueba",
  CLOUDFLARE_IMAGES_DELIVERY_URL: "https://imagedelivery.net/hash-de-prueba",
  CLOUDFLARE_IMAGES_SIGNING_KEY: "llave-secreta-de-firma",
} as unknown as NodeJS.ProcessEnv;

const DELIVERY = "https://imagedelivery.net/hash-de-prueba";
const AHORA = Date.parse("2026-08-10T12:00:00Z");

/** Un `fetch` de mentira que responde lo que se le diga. */
function fetchFalso(opciones: {
  status?: number;
  json?: unknown;
  cuerpoNoJson?: boolean;
  lanzar?: Error;
}) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    if (opciones.lanzar) throw opciones.lanzar;
    return {
      ok: (opciones.status ?? 200) >= 200 && (opciones.status ?? 200) < 300,
      status: opciones.status ?? 200,
      json: async () => {
        if (opciones.cuerpoNoJson) throw new SyntaxError("Unexpected token < in JSON");
        return opciones.json;
      },
    } as unknown as Response;
  });
  return { fn: fn as unknown as typeof fetch, llamadas };
}

function deps(over: Partial<DependenciasCF> = {}): DependenciasCF {
  return { entorno: ENTORNO_COMPLETO, ...over };
}

const SOBRE_OK = (result: unknown) => ({ success: true, errors: [], result });

// ------------------------------------------------------------

describe("configuración del entorno", () => {
  it("importar el módulo NO exige credenciales", () => {
    expect(typeof configuracionCF).toBe("function");
  });

  it("con las cinco variables devuelve la configuración", () => {
    const r = configuracionCF(ENTORNO_COMPLETO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.accountHash).toBe("hash-de-prueba");
    expect(cloudflareConfigurado(ENTORNO_COMPLETO)).toBe(true);
  });

  it("con el entorno vacío falla y nombra las que faltan", () => {
    const r = configuracionCF({} as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("config-incompleta");
      expect(r.error.mensaje).toContain("CLOUDFLARE_IMAGES_API_TOKEN");
    }
    expect(cloudflareConfigurado({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("el error NUNCA trae el valor del token ni de la llave", () => {
    const r = configuracionCF({
      ...ENTORNO_COMPLETO,
      CLOUDFLARE_ACCOUNT_ID: "",
    } as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.mensaje).not.toContain("token-secreto-de-prueba");
      expect(r.error.mensaje).not.toContain("llave-secreta-de-firma");
    }
  });

  it("le quita la barra final a la URL de entrega", () => {
    const r = configuracionCF({
      ...ENTORNO_COMPLETO,
      CLOUDFLARE_IMAGES_DELIVERY_URL: `${DELIVERY}/`,
    } as NodeJS.ProcessEnv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.deliveryUrl).toBe(DELIVERY);
  });

  it("una operación con entorno incompleto no llama a fetch", async () => {
    const { fn, llamadas } = fetchFalso({ json: SOBRE_OK({}) });
    const r = await solicitarSubidaDirecta(
      { requiereFirma: false },
      { entorno: {} as NodeJS.ProcessEnv, fetch: fn },
    );
    expect(r.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });
});

describe("solicitarSubidaDirecta", () => {
  it("devuelve el id BORRADOR y la uploadURL", async () => {
    const { fn, llamadas } = fetchFalso({
      json: SOBRE_OK({ id: "img-abc", uploadURL: "https://upload.example/one-shot" }),
    });
    const r = await solicitarSubidaDirecta({ requiereFirma: true }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.idBorrador).toBe("img-abc");
      expect(r.valor.uploadURL).toBe("https://upload.example/one-shot");
      expect(r.valor.requiereFirma).toBe(true);
    }
    expect(llamadas[0].url).toContain("/images/v2/direct_upload");
  });

  it("el nombre del campo dice BORRADOR, no 'imagen subida'", async () => {
    // La API devuelve un id antes de recibir un byte. Que el tipo se
    // llame `idBorrador` es lo que impide tratarlo como confirmación.
    const { fn } = fetchFalso({ json: SOBRE_OK({ id: "x", uploadURL: "https://u" }) });
    const r = await solicitarSubidaDirecta({ requiereFirma: false }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.valor)).toContain("idBorrador");
  });

  it("manda el token en la cabecera Authorization", async () => {
    const { fn, llamadas } = fetchFalso({ json: SOBRE_OK({ id: "x", uploadURL: "https://u" }) });
    await solicitarSubidaDirecta({ requiereFirma: false }, deps({ fetch: fn }));
    const headers = llamadas[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-secreto-de-prueba");
  });

  it("RECHAZA un id propio junto con requireSignedURLs", async () => {
    // Cloudflare no admite esa combinación: los custom ID son
    // adivinables y la firma dejaría de significar algo.
    const { fn, llamadas } = fetchFalso({ json: SOBRE_OK({}) });
    const r = await solicitarSubidaDirecta(
      { requiereFirma: true, idPersonalizado: "album-1-foto-1" },
      deps({ fetch: fn }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("custom-id-con-firma");
    expect(llamadas).toHaveLength(0);
  });

  it("permite un id propio cuando NO se exige firma", async () => {
    const { fn } = fetchFalso({ json: SOBRE_OK({ id: "mio", uploadURL: "https://u" }) });
    const r = await solicitarSubidaDirecta(
      { requiereFirma: false, idPersonalizado: "mio" },
      deps({ fetch: fn }),
    );
    expect(r.ok).toBe(true);
  });

  it("valida los límites de expiración", async () => {
    const { fn } = fetchFalso({ json: SOBRE_OK({}) });
    for (const seg of [EXPIRACION_SUBIDA_MIN_S - 1, EXPIRACION_SUBIDA_MAX_S + 1, 0.5]) {
      const r = await solicitarSubidaDirecta(
        { requiereFirma: false, expiraEnSegundos: seg },
        deps({ fetch: fn }),
      );
      expect(r.ok, String(seg)).toBe(false);
      if (!r.ok) expect(r.error.codigo).toBe("expiracion-invalida");
    }
  });

  it("si la respuesta no trae id y uploadURL, falla", async () => {
    const { fn } = fetchFalso({ json: SOBRE_OK({ id: "solo-id" }) });
    const r = await solicitarSubidaDirecta({ requiereFirma: false }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("respuesta-invalida");
  });
});

describe("importarDesdeUrl — el camino del piloto 3.1A", () => {
  const URL_R2 = "https://cuenta.r2.cloudflarestorage.com/obj?X-Amz-Signature=abc";

  it("importa y devuelve id + fecha de subida en UN solo paso", async () => {
    const { fn, llamadas } = fetchFalso({
      json: SOBRE_OK({
        id: "img-importada",
        uploaded: "2026-08-10T12:00:00.000Z",
        requireSignedURLs: false,
        variants: [`${DELIVERY}/img-importada/card`],
      }),
    });
    const r = await importarDesdeUrl({ url: URL_R2, requiereFirma: false }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.id).toBe("img-importada");
      // No hay estado borrador en este flujo: se confirma de una.
      expect(r.valor.subidaEn).toBe("2026-08-10T12:00:00.000Z");
    }
    expect(llamadas[0].url).toContain("/images/v1");
    expect(llamadas[0].init.method).toBe("POST");
  });

  it("manda la URL en el campo `url` y respeta requireSignedURLs", async () => {
    const { fn, llamadas } = fetchFalso({
      json: SOBRE_OK({ id: "x", uploaded: "2026-08-10T12:00:00.000Z" }),
    });
    await importarDesdeUrl({ url: URL_R2, requiereFirma: true }, deps({ fetch: fn }));
    const cuerpo = llamadas[0].init.body as FormData;
    expect(cuerpo.get("url")).toBe(URL_R2);
    expect(cuerpo.get("requireSignedURLs")).toBe("true");
  });

  it("SIN `uploaded` válido NO se da por importada", async () => {
    // Es el único camino que habilita escribir cf_verificado_en: si
    // Cloudflare no dice cuándo se subió, no se afirma que esté lista.
    for (const uploaded of [undefined, "", "no-es-fecha", null]) {
      const { fn } = fetchFalso({ json: SOBRE_OK({ id: "x", uploaded }) });
      const r = await importarDesdeUrl({ url: URL_R2, requiereFirma: false }, deps({ fetch: fn }));
      expect(r.ok, String(uploaded)).toBe(false);
      if (!r.ok) expect(r.error.codigo).toBe("respuesta-invalida");
    }
  });

  it("rechaza una URL que no es https, sin llamar a la API", async () => {
    const { fn, llamadas } = fetchFalso({ json: SOBRE_OK({}) });
    for (const url of ["", "http://inseguro/x", "ftp://x", "no-es-url"]) {
      const r = await importarDesdeUrl({ url, requiereFirma: false }, deps({ fetch: fn }));
      expect(r.ok, url).toBe(false);
    }
    expect(llamadas).toHaveLength(0);
  });

  it("un fallo de Cloudflare se reporta sin filtrar la URL firmada", async () => {
    const { fn } = fetchFalso({
      status: 415,
      json: { success: false, errors: [{ code: 5443, message: "Unsupported image" }] },
    });
    const r = await importarDesdeUrl({ url: URL_R2, requiereFirma: false }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.mensaje).toContain("5443");
      expect(r.error.mensaje).not.toContain("X-Amz-Signature");
      expect(r.error.mensaje).not.toContain("token-secreto-de-prueba");
    }
  });
});

describe("respuestas que no salen bien", () => {
  it("HTTP fallido se reporta con su código y el resumen de errores", async () => {
    const { fn } = fetchFalso({
      status: 401,
      json: { success: false, errors: [{ code: 10000, message: "Authentication error" }] },
    });
    const r = await detalleImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("http-fallido");
      expect(r.error.mensaje).toContain("401");
      expect(r.error.mensaje).toContain("Authentication error");
      expect(r.error.mensaje).not.toContain("token-secreto-de-prueba");
    }
  });

  it("un cuerpo que no es JSON no explota", async () => {
    // Un 502 de un proxy devuelve HTML, no JSON.
    const { fn } = fetchFalso({ status: 502, cuerpoNoJson: true });
    const r = await detalleImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("respuesta-no-json");
      expect(r.error.mensaje).toContain("502");
    }
  });

  it("un JSON sin la forma de sobre se rechaza", async () => {
    const { fn } = fetchFalso({ json: { cualquier: "cosa" } });
    const r = await detalleImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("respuesta-invalida");
  });

  it("success:false con HTTP 200 también es un fallo", async () => {
    const { fn } = fetchFalso({
      status: 200,
      json: { success: false, errors: [{ code: 5455, message: "Not found" }] },
    });
    const r = await detalleImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("fallo-proveedor");
      expect(r.error.mensaje).toContain("5455");
    }
  });

  it("un timeout se distingue de un fallo cualquiera", async () => {
    const e = new Error("tardó") as Error & { name: string };
    e.name = "TimeoutError";
    const { fn } = fetchFalso({ lanzar: e });
    const r = await detalleImagen({ id: "img-abc" }, deps({ fetch: fn, timeoutMs: 50 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("timeout");
      expect(r.error.mensaje).toContain("50");
    }
  });

  it("un error de red se reporta sin volcar el mensaje original", async () => {
    const { fn } = fetchFalso({ lanzar: new Error("connect ECONNREFUSED 10.0.0.1:443") });
    const r = await detalleImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("fallo-proveedor");
      expect(r.error.mensaje).not.toContain("10.0.0.1");
    }
  });
});

describe("esConfirmada — la regla, sin pasar por la red", () => {
  it("marcada borrador nunca está confirmada, tenga o no fecha", () => {
    expect(esConfirmada({ marcadoBorrador: true, subidaEn: null })).toBe(false);
    expect(esConfirmada({ marcadoBorrador: true, subidaEn: "2026-08-10T12:00:00Z" })).toBe(false);
  });

  it("sin marca de borrador y con fecha, confirmada", () => {
    expect(esConfirmada({ marcadoBorrador: false, subidaEn: "2026-08-10T12:00:00Z" })).toBe(true);
  });

  it("sin marca de borrador pero SIN fecha, no se adivina", () => {
    expect(esConfirmada({ marcadoBorrador: false, subidaEn: null })).toBe(false);
  });
});

describe("detalleImagen y confirmarImagen — borrador vs subida", () => {
  it("1. draft:true → NO confirmada (está esperando el archivo)", async () => {
    const { fn } = fetchFalso({
      json: SOBRE_OK({ id: "img-abc", draft: true, requireSignedURLs: true, variants: [] }),
    });
    const r = await confirmarImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.confirmada).toBe(false);
      expect(r.valor.detalle.marcadoBorrador).toBe(true);
    }
  });

  it("2. draft AUSENTE + uploaded válido → CONFIRMADA", async () => {
    // Es el caso real: Cloudflare BORRA el campo `draft` al completarse
    // la subida. Exigir `draft === false` —como hacía la versión
    // anterior— habría dejado a toda imagen subida como borrador para
    // siempre, y ningún asset habría llegado nunca a `listo`.
    const { fn } = fetchFalso({
      json: SOBRE_OK({
        id: "img-abc",
        requireSignedURLs: true,
        uploaded: "2026-08-10T12:00:00Z",
        variants: [`${DELIVERY}/img-abc/card`],
      }),
    });
    const r = await confirmarImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.confirmada).toBe(true);
      expect(r.valor.detalle.marcadoBorrador).toBe(false);
      expect(r.valor.detalle.subidaEn).toBe("2026-08-10T12:00:00Z");
      expect(r.valor.detalle.variantes).toHaveLength(1);
    }
  });

  it("3. draft AUSENTE + uploaded ausente → NO confirmada (conservador)", async () => {
    // Respuesta incompleta: no se adivina. Mejor un reintento que un
    // asset marcado listo sin copia visual.
    const { fn } = fetchFalso({ json: SOBRE_OK({ id: "img-abc", requireSignedURLs: true }) });
    const r = await confirmarImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.confirmada).toBe(false);
      expect(r.valor.detalle.subidaEn).toBe(null);
    }
  });

  it("3.b un uploaded vacío o impresentable tampoco cuenta como fecha", async () => {
    for (const uploaded of ["", "   ", "no-es-fecha", null, 12345]) {
      const { fn } = fetchFalso({ json: SOBRE_OK({ id: "img-abc", uploaded }) });
      const r = await confirmarImagen({ id: "img-abc" }, deps({ fetch: fn }));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.valor.confirmada, String(uploaded)).toBe(false);
    }
  });

  it("4. draft:false + uploaded válido → se tolera", async () => {
    const { fn } = fetchFalso({
      json: SOBRE_OK({ id: "img-abc", draft: false, uploaded: "2026-08-10T12:00:00Z" }),
    });
    const r = await confirmarImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.confirmada).toBe(true);
  });

  it("4.b draft:false SIN uploaded NO alcanza: manda la fecha, no el flag", async () => {
    const { fn } = fetchFalso({ json: SOBRE_OK({ id: "img-abc", draft: false }) });
    const r = await confirmarImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.confirmada).toBe(false);
  });

  it("5. la respuesta documentada de Cloudflare, tal cual", async () => {
    // Forma real de GET /images/v1/{id} para una imagen ya subida.
    const { fn } = fetchFalso({
      json: {
        success: true,
        errors: [],
        messages: [],
        result: {
          id: "107b9558-dd06-4bbd-5fef-9c2c16bb7900",
          filename: "logo.png",
          uploaded: "2022-01-31T16:39:28.458Z",
          requireSignedURLs: true,
          variants: [
            "https://imagedelivery.net/hash-de-prueba/107b9558-dd06-4bbd-5fef-9c2c16bb7900/thumb",
            "https://imagedelivery.net/hash-de-prueba/107b9558-dd06-4bbd-5fef-9c2c16bb7900/card",
          ],
          meta: { key: "value" },
        },
      },
    });
    const r = await confirmarImagen(
      { id: "107b9558-dd06-4bbd-5fef-9c2c16bb7900" },
      deps({ fetch: fn }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.confirmada).toBe(true);
      expect(r.valor.detalle.marcadoBorrador).toBe(false);
      expect(r.valor.detalle.requiereFirma).toBe(true);
      expect(r.valor.detalle.variantes).toHaveLength(2);
      expect(r.valor.detalle.subidaEn).toBe("2022-01-31T16:39:28.458Z");
    }
  });

  it("rechaza un id con caracteres raros sin llamar a la API", async () => {
    const { fn, llamadas } = fetchFalso({ json: SOBRE_OK({}) });
    for (const id of ["", "../otro", "a/b", "a b"]) {
      const r = await detalleImagen({ id }, deps({ fetch: fn }));
      expect(r.ok, id).toBe(false);
      if (!r.ok) expect(r.error.codigo).toBe("id-invalido");
    }
    expect(llamadas).toHaveLength(0);
  });
});

describe("borrarImagen", () => {
  it("borra por id", async () => {
    const { fn, llamadas } = fetchFalso({ json: SOBRE_OK({}) });
    const r = await borrarImagen({ id: "img-abc" }, deps({ fetch: fn }));
    expect(r).toEqual({ ok: true, valor: { id: "img-abc" } });
    expect(llamadas[0].init.method).toBe("DELETE");
  });

  it("no borra con un id inválido", async () => {
    const { fn, llamadas } = fetchFalso({ json: SOBRE_OK({}) });
    const r = await borrarImagen({ id: "../todo" }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });
});

describe("urlDeVariante", () => {
  it("arma la URL de las cuatro variantes", () => {
    for (const v of VARIANTES) {
      const r = urlDeVariante({ deliveryUrl: DELIVERY, imageId: "img-abc", variante: v });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.valor).toBe(`${DELIVERY}/img-abc/${v}`);
    }
  });

  it("una barra final no produce doble barra", () => {
    const r = urlDeVariante({
      deliveryUrl: `${DELIVERY}/`,
      imageId: "img-abc",
      variante: "card",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBe(`${DELIVERY}/img-abc/card`);
  });

  it("rechaza una variante que no existe en la cuenta", () => {
    const r = urlDeVariante({
      deliveryUrl: DELIVERY,
      imageId: "img-abc",
      variante: "gigante" as never,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("variante-invalida");
  });

  it("no toca process.env: recibe la base por parámetro", () => {
    const r = urlDeVariante({ deliveryUrl: "https://otra.base", imageId: "x", variante: "thumb" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.startsWith("https://otra.base/")).toBe(true);
  });

  it("las medidas de cada variante son las de la cuenta", () => {
    expect(medidasDeVariante("thumb")).toMatchObject({ ancho: 400, alto: 400, ajuste: "cover" });
    expect(medidasDeVariante("card")).toMatchObject({ ancho: 768, alto: 576 });
    expect(medidasDeVariante("gallery")).toMatchObject({ ancho: 1600, ajuste: "scale-down" });
    expect(medidasDeVariante("hero")).toMatchObject({ ancho: 1920, alto: 1080 });
  });
});

describe("firmarUrl", () => {
  const URL_BASE = `${DELIVERY}/img-abc/gallery`;

  it("agrega exp y sig", () => {
    const r = firmarUrl({ url: URL_BASE, signingKey: "k", ahoraMs: AHORA });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const u = new URL(r.valor);
      expect(u.searchParams.get("exp")).toBe(String(Math.floor(AHORA / 1000) + 900));
      expect(u.searchParams.get("sig")).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("la firma depende de la llave", () => {
    const a = firmarUrl({ url: URL_BASE, signingKey: "llave-a", ahoraMs: AHORA });
    const b = firmarUrl({ url: URL_BASE, signingKey: "llave-b", ahoraMs: AHORA });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.valor).not.toBe(b.valor);
  });

  it("la firma depende de la variante y del id", () => {
    const a = firmarUrl({ url: `${DELIVERY}/img-1/card`, signingKey: "k", ahoraMs: AHORA });
    const b = firmarUrl({ url: `${DELIVERY}/img-1/hero`, signingKey: "k", ahoraMs: AHORA });
    const c = firmarUrl({ url: `${DELIVERY}/img-2/card`, signingKey: "k", ahoraMs: AHORA });
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (a.ok && b.ok && c.ok) {
      expect(new URL(a.valor).searchParams.get("sig")).not.toBe(
        new URL(b.valor).searchParams.get("sig"),
      );
      expect(new URL(a.valor).searchParams.get("sig")).not.toBe(
        new URL(c.valor).searchParams.get("sig"),
      );
    }
  });

  it("la firma depende del vencimiento", () => {
    const a = firmarUrl({ url: URL_BASE, signingKey: "k", ahoraMs: AHORA });
    const b = firmarUrl({ url: URL_BASE, signingKey: "k", ahoraMs: AHORA + 60_000 });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.valor).not.toBe(b.valor);
  });

  it("es determinista con la misma entrada", () => {
    const a = firmarUrl({ url: URL_BASE, signingKey: "k", ahoraMs: AHORA });
    const b = firmarUrl({ url: URL_BASE, signingKey: "k", ahoraMs: AHORA });
    expect(a.ok && b.ok && a.ok === b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.valor).toBe(b.valor);
  });

  it("respeta los límites de expiración", () => {
    for (const seg of [EXPIRACION_FIRMA_MIN_S - 1, EXPIRACION_FIRMA_MAX_S + 1, 1.5]) {
      const r = firmarUrl({ url: URL_BASE, signingKey: "k", expiraEnSegundos: seg, ahoraMs: AHORA });
      expect(r.ok, String(seg)).toBe(false);
      if (!r.ok) expect(r.error.codigo).toBe("expiracion-invalida");
    }
  });

  it("sin llave no firma", () => {
    const r = firmarUrl({ url: URL_BASE, signingKey: "", ahoraMs: AHORA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("config-incompleta");
  });

  it("una URL inválida no firma", () => {
    const r = firmarUrl({ url: "no-es-una-url", signingKey: "k", ahoraMs: AHORA });
    expect(r.ok).toBe(false);
  });

  it("la URL firmada NO contiene la llave", () => {
    const r = firmarUrl({ url: URL_BASE, signingKey: "llave-secreta-de-firma", ahoraMs: AHORA });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).not.toContain("llave-secreta-de-firma");
  });
});

describe("urlSegunVisibilidad — olvidarse de firmar no es posible", () => {
  const base = { deliveryUrl: DELIVERY, imageId: "img-abc", variante: "card" as const };

  it("publica: entrega DIRECTA, sin token", () => {
    const r = urlSegunVisibilidad({ ...base, visibilidad: "publica" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor).toBe(`${DELIVERY}/img-abc/card`);
      expect(r.valor).not.toContain("sig=");
    }
  });

  it("publica no necesita la llave", () => {
    const r = urlSegunVisibilidad({ ...base, visibilidad: "publica", signingKey: undefined });
    expect(r.ok).toBe(true);
  });

  it("compartida: SIEMPRE firmada", () => {
    const r = urlSegunVisibilidad({
      ...base,
      visibilidad: "compartida",
      signingKey: "k",
      ahoraMs: AHORA,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor).toContain("sig=");
      expect(r.valor).toContain("exp=");
    }
  });

  it("privada: SIEMPRE firmada", () => {
    const r = urlSegunVisibilidad({
      ...base,
      visibilidad: "privada",
      signingKey: "k",
      ahoraMs: AHORA,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toContain("sig=");
  });

  it("compartida SIN llave falla en vez de devolver una URL desnuda", () => {
    // Devolver la URL sin firma daría 401 en el borde y parecería un
    // bug de Cloudflare. Mejor fallar acá, con el motivo.
    const r = urlSegunVisibilidad({ ...base, visibilidad: "compartida" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("config-incompleta");
  });

  it("privada SIN llave tampoco", () => {
    const r = urlSegunVisibilidad({ ...base, visibilidad: "privada" });
    expect(r.ok).toBe(false);
  });

  it("una variante inválida se rechaza antes de firmar", () => {
    const r = urlSegunVisibilidad({
      ...base,
      variante: "enorme" as never,
      visibilidad: "privada",
      signingKey: "k",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("variante-invalida");
  });
});
