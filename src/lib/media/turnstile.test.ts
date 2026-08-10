import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  bypassPermitido,
  turnstileConfigurado,
  verificarTurnstile,
  type DependenciasTurnstile,
} from "./turnstile";
import {
  LIMITES_ANONIMOS,
  MAX_BYTES_ANONIMO,
  TTL_CAPACIDAD_S,
  USOS_ALBUM,
  USOS_COMPROBANTE,
  clavePorCapacidad,
  clavePorEntidad,
  clavePorIp,
  generarTokenCapacidad,
  hashDeToken,
  hashesIguales,
  hmacDeIp,
  ipDeLaPeticion,
} from "./capacidad";

const PROD = { NODE_ENV: "production", TURNSTILE_SECRET_KEY: "s3cr3t" } as unknown as NodeJS.ProcessEnv;

function fetchFalso(o: { json?: unknown; status?: number; noJson?: boolean; lanzar?: Error }) {
  const llamadas: { url: string; body: string }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), body: String(init?.body ?? "") });
    if (o.lanzar) throw o.lanzar;
    return {
      ok: (o.status ?? 200) < 300,
      status: o.status ?? 200,
      json: async () => {
        if (o.noJson) throw new SyntaxError("no json");
        return o.json;
      },
    } as unknown as Response;
  });
  return { fn: fn as unknown as typeof fetch, llamadas };
}

const deps = (o: Partial<DependenciasTurnstile> = {}): DependenciasTurnstile => ({
  entorno: PROD,
  ...o,
});

describe("configuración y bypass", () => {
  it("turnstileConfigurado mira la secret", () => {
    expect(turnstileConfigurado(PROD)).toBe(true);
    expect(turnstileConfigurado({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("el bypass NUNCA aplica en producción, aunque esté puesto", () => {
    const prodConBypass = {
      NODE_ENV: "production",
      MEDIA_TURNSTILE_BYPASS: "1",
    } as unknown as NodeJS.ProcessEnv;
    expect(bypassPermitido(prodConBypass)).toBe(false);
  });

  it("el bypass aplica en desarrollo solo con la variable EXACTA", () => {
    expect(
      bypassPermitido({ NODE_ENV: "development", MEDIA_TURNSTILE_BYPASS: "1" } as never),
    ).toBe(true);
    for (const v of ["true", "yes", "0", ""]) {
      expect(
        bypassPermitido({ NODE_ENV: "development", MEDIA_TURNSTILE_BYPASS: v } as never),
        v,
      ).toBe(false);
    }
  });

  it("en producción sin secret → RECHAZA, no pasa de largo", async () => {
    const { fn, llamadas } = fetchFalso({ json: { success: true } });
    const r = await verificarTurnstile(
      { token: "t" },
      deps({ entorno: { NODE_ENV: "production" } as never, fetch: fn }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("sin-configuracion");
    expect(llamadas).toHaveLength(0);
  });

  it("con bypass de desarrollo no llama a Cloudflare", async () => {
    const { fn, llamadas } = fetchFalso({ json: { success: false } });
    const r = await verificarTurnstile(
      { token: null },
      deps({
        entorno: { NODE_ENV: "development", MEDIA_TURNSTILE_BYPASS: "1" } as never,
        fetch: fn,
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.via).toBe("bypass-desarrollo");
    expect(llamadas).toHaveLength(0);
  });
});

describe("verificarTurnstile", () => {
  it("token válido pasa", async () => {
    const { fn, llamadas } = fetchFalso({ json: { success: true } });
    const r = await verificarTurnstile({ token: "tok" }, deps({ fetch: fn }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.via).toBe("verificado");
    expect(llamadas[0].url).toContain("challenges.cloudflare.com");
    expect(llamadas[0].body).toContain("response=tok");
  });

  it("manda remoteip solo si se le pasa", async () => {
    const a = fetchFalso({ json: { success: true } });
    await verificarTurnstile({ token: "t" }, deps({ fetch: a.fn }));
    expect(a.llamadas[0].body).not.toContain("remoteip");

    const b = fetchFalso({ json: { success: true } });
    await verificarTurnstile({ token: "t", remoteip: "1.2.3.4" }, deps({ fetch: b.fn }));
    expect(b.llamadas[0].body).toContain("remoteip=1.2.3.4");
  });

  it("sin token → rechaza sin llamar", async () => {
    const { fn, llamadas } = fetchFalso({ json: { success: true } });
    for (const t of [null, undefined, "", "   "]) {
      const r = await verificarTurnstile({ token: t }, deps({ fetch: fn }));
      expect(r.ok, String(t)).toBe(false);
      if (!r.ok) expect(r.codigo).toBe("sin-token");
    }
    expect(llamadas).toHaveLength(0);
  });

  it("success:false → rechazado, sin filtrar los error-codes", async () => {
    const { fn } = fetchFalso({
      json: { success: false, "error-codes": ["invalid-input-secret"] },
    });
    const r = await verificarTurnstile({ token: "t" }, deps({ fetch: fn }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.codigo).toBe("rechazado");
      // `invalid-input-secret` habla de NUESTRA config, no de su intento.
      expect(r.mensaje).not.toContain("secret");
      expect(r.mensaje).not.toContain("invalid-input");
    }
  });

  it("timeout se distingue de un fallo cualquiera", async () => {
    const e = new Error("t") as Error & { name: string };
    e.name = "TimeoutError";
    const { fn } = fetchFalso({ lanzar: e });
    const r = await verificarTurnstile({ token: "t" }, deps({ fetch: fn, timeoutMs: 50 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("timeout");
  });

  it("respuesta no JSON o sin `success` → respuesta-invalida", async () => {
    for (const o of [{ noJson: true }, { json: { otra: "cosa" } }, { json: null }]) {
      const { fn } = fetchFalso(o);
      const r = await verificarTurnstile({ token: "t" }, deps({ fetch: fn }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe("respuesta-invalida");
    }
  });

  it("la secret NUNCA aparece en un mensaje de error", async () => {
    const { fn } = fetchFalso({ json: { success: false } });
    const r = await verificarTurnstile({ token: "t" }, deps({ fetch: fn }));
    if (!r.ok) expect(r.mensaje).not.toContain("s3cr3t");
  });
});

describe("capacidad: tokens y hashes", () => {
  it("el token es largo, aleatorio y distinto cada vez", () => {
    const a = generarTokenCapacidad();
    const b = generarTokenCapacidad();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 bytes en base64url
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("el hash es SHA-256 hex y no permite volver al token", () => {
    const t = generarTokenCapacidad();
    const h = hashDeToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(t);
    expect(hashDeToken(t)).toBe(h);
    expect(hashDeToken(generarTokenCapacidad())).not.toBe(h);
  });

  it("hashesIguales compara en tiempo constante y sin reventar", () => {
    const h = hashDeToken("x");
    expect(hashesIguales(h, h)).toBe(true);
    expect(hashesIguales(h, hashDeToken("y"))).toBe(false);
    expect(hashesIguales(h, "corto")).toBe(false);
    expect(hashesIguales("", "")).toBe(true);
  });

  it("los usos y la vida son los acordados", () => {
    expect(USOS_ALBUM).toBe(10);
    expect(USOS_COMPROBANTE).toBe(1);
    expect(TTL_CAPACIDAD_S).toBe(900);
    expect(MAX_BYTES_ANONIMO).toBe(10 * 1024 * 1024);
  });
});

describe("la IP, siempre como HMAC", () => {
  const conSal = { VISITAS_SALT: "sal-de-prueba" } as unknown as NodeJS.ProcessEnv;

  it("devuelve un HMAC hex, nunca la IP", () => {
    const h = hmacDeIp("190.10.20.30", conSal);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("190.10.20.30");
  });

  it("es determinista y distingue IPs", () => {
    expect(hmacDeIp("1.1.1.1", conSal)).toBe(hmacDeIp("1.1.1.1", conSal));
    expect(hmacDeIp("1.1.1.1", conSal)).not.toBe(hmacDeIp("1.1.1.2", conSal));
  });

  it("depende de la sal", () => {
    const otra = { VISITAS_SALT: "otra" } as unknown as NodeJS.ProcessEnv;
    expect(hmacDeIp("1.1.1.1", conSal)).not.toBe(hmacDeIp("1.1.1.1", otra));
  });

  it("MEDIA_IP_SALT pisa a VISITAS_SALT", () => {
    const ambas = { VISITAS_SALT: "a", MEDIA_IP_SALT: "b" } as unknown as NodeJS.ProcessEnv;
    expect(hmacDeIp("1.1.1.1", ambas)).toBe(
      hmacDeIp("1.1.1.1", { MEDIA_IP_SALT: "b" } as never),
    );
  });

  it("SIN sal devuelve null — no cae a texto plano", () => {
    expect(hmacDeIp("1.1.1.1", {} as NodeJS.ProcessEnv)).toBe(null);
    expect(hmacDeIp("1.1.1.1", { VISITAS_SALT: "  " } as never)).toBe(null);
  });

  it("sin IP devuelve null", () => {
    for (const v of [null, undefined, "", "  "]) expect(hmacDeIp(v, conSal)).toBe(null);
  });

  it("ipDeLaPeticion toma la primera de x-forwarded-for", () => {
    const req = new Request("https://bookea.lat/x", {
      headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1, 10.0.0.2" },
    });
    expect(ipDeLaPeticion(req)).toBe("9.9.9.9");
    expect(ipDeLaPeticion(new Request("https://bookea.lat/x"))).toBe(null);
  });
});

describe("claves de rate limiting", () => {
  it("van prefijadas por ámbito y no llevan IP en claro", () => {
    const h = hmacDeIp("1.2.3.4", { VISITAS_SALT: "s" } as never)!;
    const clave = clavePorIp(h, "emision");
    expect(clave.startsWith("ip:emision:")).toBe(true);
    expect(clave).not.toContain("1.2.3.4");
    expect(clavePorCapacidad("abc").startsWith("cap:")).toBe(true);
    expect(clavePorEntidad("album", "x").startsWith("ent:album:")).toBe(true);
  });

  it("dos ámbitos distintos no comparten contador", () => {
    const h = "a".repeat(64);
    expect(clavePorIp(h, "emision")).not.toBe(clavePorIp(h, "reserva"));
  });

  it("los límites son conservadores y están declarados", () => {
    expect(LIMITES_ANONIMOS.emisionPorIp.limite).toBe(20);
    expect(LIMITES_ANONIMOS.emisionPorEntidad.limite).toBe(300);
    expect(LIMITES_ANONIMOS.reservaPorCapacidad.limite).toBe(USOS_ALBUM);
  });
});
