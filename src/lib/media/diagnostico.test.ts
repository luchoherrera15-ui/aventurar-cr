import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { diagnosticarMedia, type DependenciasDiagnostico } from "./diagnostico";

const COMPLETO = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://bookea.lat",
  R2_ACCESS_KEY_ID: "id",
  R2_SECRET_ACCESS_KEY: "secreto-de-r2",
  R2_ENDPOINT: "https://x.r2.cloudflarestorage.com",
  R2_REGION: "auto",
  R2_BUCKET_ORIGINALS: "bookea-originals",
  CLOUDFLARE_ACCOUNT_ID: "cuenta",
  CLOUDFLARE_IMAGES_ACCOUNT_HASH: "hash",
  CLOUDFLARE_IMAGES_API_TOKEN: "token-de-images",
  CLOUDFLARE_IMAGES_DELIVERY_URL: "https://imagedelivery.net/hash",
  CLOUDFLARE_IMAGES_SIGNING_KEY: "llave-de-firma",
  TURNSTILE_SECRET_KEY: "secreto-turnstile",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
  // Valores distintivos a propósito: la prueba de "no se filtra nada"
  // busca estas cadenas en la salida, así que no pueden ser palabras
  // cortas que aparezcan dentro de un texto normal. Con "sal" a secas
  // daba un falso positivo contra "revisala" y "Sal para el HMAC".
  VISITAS_SALT: "sal-secreta-zzz",
} as unknown as NodeJS.ProcessEnv;

/** Un cliente S3 falso: responde al HEAD y al GetBucketCors. */
function clienteR2Falso(o: {
  cors?: { AllowedHeaders?: string[]; AllowedMethods?: string[]; AllowedOrigins?: string[] }[];
  headError?: { name: string; http?: number };
  corsLanza?: boolean;
}) {
  return {
    send: async (cmd: unknown) => {
      const nombre = cmd?.constructor?.name ?? "";
      if (nombre.includes("HeadObject")) {
        const e = new Error("x") as Error & { $metadata?: { httpStatusCode?: number } };
        e.name = o.headError?.name ?? "NotFound";
        e.$metadata = { httpStatusCode: o.headError?.http ?? 404 };
        throw e;
      }
      if (nombre.includes("GetBucketCors")) {
        if (o.corsLanza) throw new Error("sin permiso");
        return { CORSRules: o.cors ?? [] };
      }
      return {};
    },
  } as unknown as NonNullable<DependenciasDiagnostico["clienteR2"]>;
}

const CORS_BUENA = [
  {
    AllowedHeaders: ["content-type", "if-none-match"],
    AllowedMethods: ["PUT", "GET", "HEAD"],
    AllowedOrigins: ["https://bookea.lat", "https://www.bookea.lat"],
  },
];

function fetchImages(o: { ok?: boolean; status?: number; variantes?: string[]; success?: boolean }) {
  return (async () =>
    ({
      ok: o.ok ?? true,
      status: o.status ?? 200,
      json: async () => ({
        success: o.success ?? true,
        result: {
          variants: Object.fromEntries((o.variantes ?? ["thumb", "card", "gallery", "hero"]).map((v) => [v, {}])),
        },
      }),
    }) as unknown as Response) as unknown as typeof fetch;
}

const buscar = (chequeos: { que: string; estado: string; detalle: string }[], parte: string) =>
  chequeos.find((c) => c.que.includes(parte));

describe("diagnóstico: todo bien", () => {
  it("con la configuración completa y la CORS correcta, queda listo", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ cors: CORS_BUENA }),
      fetch: fetchImages({}),
    });
    expect(r.fallas, JSON.stringify(r.chequeos.filter((c) => c.estado === "falla"))).toBe(0);
    expect(r.listo).toBe(true);
  });
});

describe("diagnóstico: la CORS, que es lo que rompe en silencio", () => {
  it("sin `if-none-match` avisa que TODAS las subidas van a fallar", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({
        cors: [{ AllowedHeaders: ["content-type"], AllowedMethods: ["PUT"], AllowedOrigins: ["https://bookea.lat"] }],
      }),
      fetch: fetchImages({}),
    });
    const c = buscar(r.chequeos, "if-none-match");
    expect(c?.estado).toBe("falla");
    expect(c?.detalle).toContain("TODAS las subidas fallan");
    expect(r.listo).toBe(false);
  });

  it("un `*` en AllowedHeaders cuenta como permitida", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({
        cors: [{ AllowedHeaders: ["*"], AllowedMethods: ["PUT"], AllowedOrigins: ["*"] }],
      }),
      fetch: fetchImages({}),
    });
    expect(buscar(r.chequeos, "if-none-match")?.estado).toBe("ok");
  });

  it("sin PUT no se puede subir", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({
        cors: [{ AllowedHeaders: ["if-none-match"], AllowedMethods: ["GET"], AllowedOrigins: ["https://bookea.lat"] }],
      }),
      fetch: fetchImages({}),
    });
    expect(buscar(r.chequeos, "PUT")?.estado).toBe("falla");
  });

  it("un bucket sin ninguna regla es una falla, no un aviso", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ cors: [] }),
      fetch: fetchImages({}),
    });
    expect(buscar(r.chequeos, "R2 · CORS")?.estado).toBe("falla");
  });

  it("un origen de la app que falta en el bucket se avisa por su nombre", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({
        cors: [
          {
            AllowedHeaders: ["if-none-match"],
            AllowedMethods: ["PUT"],
            AllowedOrigins: ["https://bookea.lat"],
          },
        ],
      }),
      fetch: fetchImages({}),
    });
    const c = buscar(r.chequeos, "orígenes");
    expect(c?.estado).toBe("aviso");
    expect(c?.detalle).toContain("www.bookea.lat");
  });

  it("si no se puede leer la CORS, avisa en vez de dar por buena", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ corsLanza: true }),
      fetch: fetchImages({}),
    });
    expect(buscar(r.chequeos, "R2 · CORS")?.estado).toBe("aviso");
  });
});

describe("diagnóstico: credenciales", () => {
  it("un 404 en el HEAD es la señal BUENA: llegamos y autenticamos", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ cors: CORS_BUENA, headError: { name: "NotFound", http: 404 } }),
      fetch: fetchImages({}),
    });
    expect(buscar(r.chequeos, "R2 · credenciales")?.estado).toBe("ok");
  });

  it("un 403 se traduce a algo accionable", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ cors: CORS_BUENA, headError: { name: "AccessDenied", http: 403 } }),
      fetch: fetchImages({}),
    });
    const c = buscar(r.chequeos, "R2 · credenciales");
    expect(c?.estado).toBe("falla");
    expect(c?.detalle).toContain("Access Key");
  });

  it("faltando variables de R2 se nombran, sin sus valores", async () => {
    const sinR2 = { ...COMPLETO, R2_SECRET_ACCESS_KEY: "" } as NodeJS.ProcessEnv;
    const r = await diagnosticarMedia({ entorno: sinR2, fetch: fetchImages({}) });
    const c = buscar(r.chequeos, "R2 · variables");
    expect(c?.estado).toBe("falla");
    expect(c?.detalle).toContain("R2_SECRET_ACCESS_KEY");
  });
});

describe("diagnóstico: Cloudflare Images", () => {
  it("detecta una variante que falta, por nombre", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ cors: CORS_BUENA }),
      fetch: fetchImages({ variantes: ["thumb", "card"] }),
    });
    const c = buscar(r.chequeos, "variantes");
    expect(c?.estado).toBe("falla");
    expect(c?.detalle).toContain("gallery");
    expect(c?.detalle).toContain("hero");
  });

  it("un token sin permiso se traduce a qué permiso falta", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ cors: CORS_BUENA }),
      fetch: fetchImages({ ok: false, status: 403, success: false }),
    });
    const c = buscar(r.chequeos, "Images · token");
    expect(c?.estado).toBe("falla");
    expect(c?.detalle).toContain("Cloudflare Images: Edit");
  });
});

describe("diagnóstico: Turnstile y entorno", () => {
  it("sin la secret avisa que se van a RECHAZAR las subidas anónimas", async () => {
    const sinT = { ...COMPLETO, TURNSTILE_SECRET_KEY: "" } as NodeJS.ProcessEnv;
    const r = await diagnosticarMedia({
      entorno: sinT,
      clienteR2: clienteR2Falso({ cors: CORS_BUENA }),
      fetch: fetchImages({}),
    });
    const c = buscar(r.chequeos, "Turnstile · secret");
    expect(c?.estado).toBe("falla");
    expect(c?.detalle).toContain("RECHAZAR");
  });

  it("sin sal es aviso y no falla: el límite por capacidad sigue", async () => {
    const sinSal = { ...COMPLETO, VISITAS_SALT: "", MEDIA_IP_SALT: "" } as NodeJS.ProcessEnv;
    const r = await diagnosticarMedia({
      entorno: sinSal,
      clienteR2: clienteR2Falso({ cors: CORS_BUENA }),
      fetch: fetchImages({}),
    });
    expect(buscar(r.chequeos, "Sal para el HMAC")?.estado).toBe("aviso");
  });
});

describe("el diagnóstico NO filtra credenciales", () => {
  it("ningún valor secreto aparece en la salida, ni cuando todo falla", async () => {
    const casos = [
      { entorno: COMPLETO, clienteR2: clienteR2Falso({ cors: CORS_BUENA }), fetch: fetchImages({}) },
      { entorno: COMPLETO, clienteR2: clienteR2Falso({ corsLanza: true }), fetch: fetchImages({ ok: false, status: 403, success: false }) },
      {
        entorno: COMPLETO,
        clienteR2: clienteR2Falso({ cors: CORS_BUENA, headError: { name: "AccessDenied", http: 403 } }),
        fetch: fetchImages({ variantes: [] }),
      },
    ];

    for (const caso of casos) {
      const r = await diagnosticarMedia(caso);
      const texto = JSON.stringify(r);
      for (const secreto of [
        "secreto-de-r2",
        "token-de-images",
        "llave-de-firma",
        "secreto-turnstile",
        "sal-secreta-zzz",
      ]) {
        expect(texto, `se filtró "${secreto}"`).not.toContain(secreto);
      }
    }
  });
});

// ============================================================
// El plan B de CORS: el preflight real
// ============================================================

/** Un fetch que responde al preflight OPTIONS con las cabeceras dadas. */
function fetchPreflight(cabeceras: Record<string, string> | null) {
  return (async () =>
    ({
      ok: true,
      status: cabeceras ? 200 : 403,
      headers: new Headers(cabeceras ?? {}),
      json: async () => ({ success: true, result: { variants: {} } }),
    }) as unknown as Response) as unknown as typeof fetch;
}

describe("CORS por preflight, cuando el token no puede leer la política", () => {
  it("si el preflight devuelve if-none-match, da OK y lo dice", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ corsLanza: true }),
      fetch: fetchPreflight({
        "access-control-allow-origin": "https://bookea.lat",
        "access-control-allow-headers": "content-type, if-none-match",
        "access-control-allow-methods": "PUT, GET, HEAD",
      }),
    });
    const c = buscar(r.chequeos, "if-none-match");
    expect(c?.estado).toBe("ok");
    expect(c?.detalle).toContain("preflight real");
  });

  it("si NO la devuelve, es falla y no un aviso: rompe todas las subidas", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ corsLanza: true }),
      fetch: fetchPreflight({
        "access-control-allow-origin": "https://bookea.lat",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "PUT",
      }),
    });
    const c = buscar(r.chequeos, "if-none-match");
    expect(c?.estado).toBe("falla");
    expect(c?.detalle).toContain("TODAS las subidas fallan");
  });

  it("si el bucket rechaza el origen, lo dice por su nombre", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ corsLanza: true }),
      fetch: fetchPreflight(null),
    });
    const c = buscar(r.chequeos, "R2 · CORS");
    expect(c?.estado).toBe("falla");
    expect(c?.detalle).toContain("bookea.lat");
  });

  it("sin PUT en el preflight tampoco se puede subir", async () => {
    const r = await diagnosticarMedia({
      entorno: COMPLETO,
      clienteR2: clienteR2Falso({ corsLanza: true }),
      fetch: fetchPreflight({
        "access-control-allow-origin": "https://bookea.lat",
        "access-control-allow-headers": "if-none-match",
        "access-control-allow-methods": "GET, HEAD",
      }),
    });
    expect(buscar(r.chequeos, "PUT")?.estado).toBe("falla");
  });
});
