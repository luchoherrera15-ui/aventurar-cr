import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  autenticarMedia,
  cabecerasCors,
  origenPermitido,
  origenesPermitidos,
  type DependenciasAuth,
} from "./autenticacion";

const PROD = { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://bookea.lat" } as unknown as NodeJS.ProcessEnv;
const DEV = { NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: "https://bookea.lat" } as unknown as NodeJS.ProcessEnv;

const USUARIO = "11111111-1111-4111-8111-111111111111";

/** Un `sesionDesdeBearer` de mentira. */
const bearerOk = vi.fn(async () => ({
  supabase: {} as never,
  usuarioId: USUARIO,
  correo: null,
  token: "t",
}));
const bearerNulo = vi.fn(async () => null);

/** Un cliente de cookies de mentira. */
const cookiesCon = (user: { id: string } | null) =>
  vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user } }) } })) as never;

function pedido(headers: Record<string, string> = {}): Request {
  return new Request("https://bookea.lat/api/media/sesion", { method: "POST", headers });
}

function deps(over: Partial<DependenciasAuth> = {}): DependenciasAuth {
  return {
    entorno: DEV,
    desdeBearer: bearerNulo as never,
    desdeCookies: cookiesCon(null),
    ...over,
  };
}

describe("orígenes permitidos", () => {
  it("en producción NO incluye localhost", () => {
    const lista = origenesPermitidos(PROD);
    expect(lista).toContain("https://bookea.lat");
    expect(lista).toContain("https://www.bookea.lat");
    expect(lista.some((o) => o.includes("localhost"))).toBe(false);
  });

  it("fuera de producción sí incluye localhost", () => {
    const lista = origenesPermitidos(DEV);
    expect(lista).toContain("http://localhost:3000");
    expect(lista).toContain("http://localhost:8081");
  });

  it("MEDIA_ALLOWED_ORIGINS manda sobre el default", () => {
    const lista = origenesPermitidos({
      NODE_ENV: "production",
      MEDIA_ALLOWED_ORIGINS: "https://a.test, https://b.test",
    } as unknown as NodeJS.ProcessEnv);
    expect(lista).toEqual(["https://a.test", "https://b.test"]);
  });

  it("rechaza orígenes ajenos y variantes engañosas", () => {
    for (const o of [
      "https://bookea.lat.malo.com",
      "http://bookea.lat",
      "https://evil.test",
      null,
      "",
    ]) {
      expect(origenPermitido(o, PROD), String(o)).toBe(false);
    }
    expect(origenPermitido("https://bookea.lat", PROD)).toBe(true);
    expect(origenPermitido("https://bookea.lat/", PROD)).toBe(true);
  });
});

describe("cabeceras CORS", () => {
  it("NUNCA usa '*'", () => {
    const c = cabecerasCors("https://bookea.lat", PROD);
    expect(c["Access-Control-Allow-Origin"]).toBe("https://bookea.lat");
    expect(Object.values(c)).not.toContain("*");
  });

  it("siempre lleva Vary: Origin", () => {
    expect(cabecerasCors("https://bookea.lat", PROD).Vary).toBe("Origin");
    expect(cabecerasCors(null, PROD).Vary).toBe("Origin");
  });

  it("un origen no permitido no recibe Allow-Origin ni credenciales", () => {
    const c = cabecerasCors("https://evil.test", PROD);
    expect(c["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(c["Access-Control-Allow-Credentials"]).toBeUndefined();
  });
});

describe("autenticarMedia", () => {
  it("bearer válido entra, sin necesitar Origin", async () => {
    const r = await autenticarMedia(
      pedido({ authorization: "Bearer abc" }),
      deps({ desdeBearer: bearerOk as never }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.actor.usuarioId).toBe(USUARIO);
      expect(r.actor.via).toBe("bearer");
    }
  });

  it("bearer INVÁLIDO → 401 y NO cae a la cookie", async () => {
    // La cookie es válida; igual se rechaza. Sin esto, un token vencido
    // dejaría pasar la petición con la sesión del navegador.
    const cookies = cookiesCon({ id: USUARIO });
    const r = await autenticarMedia(
      pedido({ authorization: "Bearer vencido", origin: "http://localhost:3000" }),
      deps({ desdeBearer: bearerNulo as never, desdeCookies: cookies }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("bearer-invalido");
      expect(r.http).toBe(401);
    }
    expect(cookies).not.toHaveBeenCalled();
  });

  it("bearer válido + cookies: gana el bearer", async () => {
    const cookies = cookiesCon({ id: "otro" });
    const r = await autenticarMedia(
      pedido({ authorization: "Bearer abc", origin: "http://localhost:3000" }),
      deps({ desdeBearer: bearerOk as never, desdeCookies: cookies }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.actor.usuarioId).toBe(USUARIO);
    expect(cookies).not.toHaveBeenCalled();
  });

  it("cookies con Origin permitido entra", async () => {
    const r = await autenticarMedia(
      pedido({ origin: "http://localhost:3000" }),
      deps({ desdeCookies: cookiesCon({ id: USUARIO }) }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.actor.via).toBe("cookie");
  });

  it("cookies SIN Origin → 403 (CSRF)", async () => {
    const cookies = cookiesCon({ id: USUARIO });
    const r = await autenticarMedia(pedido(), deps({ desdeCookies: cookies }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("origen-ausente");
      expect(r.http).toBe(403);
    }
    // Ni siquiera se consulta la sesión.
    expect(cookies).not.toHaveBeenCalled();
  });

  it("cookies con Origin AJENO → 403", async () => {
    const r = await autenticarMedia(
      pedido({ origin: "https://evil.test" }),
      deps({ desdeCookies: cookiesCon({ id: USUARIO }) }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("origen-no-permitido");
  });

  it("sin credencial alguna → 401", async () => {
    const r = await autenticarMedia(
      pedido({ origin: "http://localhost:3000" }),
      deps({ desdeCookies: cookiesCon(null) }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("sin-credencial");
      expect(r.http).toBe(401);
    }
  });

  it("en producción sin orígenes configurados → 503, falla CERRADA", async () => {
    const r = await autenticarMedia(
      pedido({ origin: "https://bookea.lat" }),
      deps({
        entorno: {
          NODE_ENV: "production",
          MEDIA_ALLOWED_ORIGINS: "",
          NEXT_PUBLIC_SITE_URL: "",
        } as unknown as NodeJS.ProcessEnv,
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("sin-configuracion");
      expect(r.http).toBe(503);
    }
  });

  it("ningún mensaje revela detalles internos", async () => {
    for (const req of [pedido(), pedido({ origin: "https://evil.test" })]) {
      const r = await autenticarMedia(req, deps());
      if (!r.ok) {
        expect(r.mensaje).not.toContain("supabase");
        expect(r.mensaje).not.toContain("bearer");
        expect(r.mensaje.length).toBeLessThan(70);
      }
    }
  });
});
