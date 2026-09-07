import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigMeta } from "./config";
import { clasificarErrorMeta, enviarRespuestaPrivada, perfilInstagram, publicacionesInstagram, redactar, responderComentario, tokenLargo } from "./meta";

const CFG: ConfigMeta = {
  appId: "123",
  appSecret: "secreto-app",
  igAppId: "ig-456",
  igAppSecret: "secreto-ig",
  redirectUri: "https://www.bookea.lat/api/instagram/callback",
  version: "v25.0",
  verifyToken: "vt",
  claveTokens: "x",
};

function respuesta(status: number, cuerpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("clasificarErrorMeta — los códigos de Graph traducidos", () => {
  const casos: [number, unknown, string, boolean][] = [
    [400, { error: { code: 190, message: "Error validating access token: Session has expired" } }, "token_vencido", false],
    [403, { error: { code: 10, message: "(#10) Application does not have permission" } }, "permisos", false],
    [403, { error: { code: 200, message: "Permissions error" } }, "permisos", false],
    [400, { error: { code: 4, message: "Application request limit reached" } }, "rate_limit", true],
    [400, { error: { code: 80002, message: "There have been too many calls" } }, "rate_limit", true],
    [429, {}, "rate_limit", true],
    [400, { error: { code: 10, error_subcode: 2534022, message: "outside of allowed window" } }, "dm_rechazado", false],
    [400, { error: { code: 551, message: "This person isn't available right now" } }, "dm_rechazado", false],
    [400, { error: { code: 100, message: "Unsupported post request. Object with ID does not exist" } }, "no_procesable", false],
    [500, null, "api_no_disponible", true],
    [400, { error: { code: 2, message: "An unexpected error has occurred" } }, "api_no_disponible", true],
    [400, { error: { code: 999, message: "algo" } }, "desconocido", false],
  ];
  for (const [status, cuerpo, esperado, transitorio] of casos) {
    it(`${status} / ${JSON.stringify(cuerpo)?.slice(0, 40)} → ${esperado}`, () => {
      const e = clasificarErrorMeta(status, cuerpo);
      expect(e.codigo).toBe(esperado);
      expect(e.transitorio).toBe(transitorio);
    });
  }
  it("el mensaje nunca lleva un token", () => {
    const e = clasificarErrorMeta(400, { error: { code: 190, message: "bad access_token=IGQVJabcdefghijklmnopqrstuvwxyz0123456789 and IGQVJZZZZZZZZZZZZZZZZZZZZZZZ" } });
    expect(e.mensaje).not.toContain("IGQVJ");
    expect(redactar("client_secret=abc&x=1")).toBe("client_secret=[oculto]&x=1");
  });
});

describe("enviarRespuestaPrivada", () => {
  it("POST /<IG_ID>/messages con recipient.comment_id, el token en la cabecera y NUNCA en la URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(200, { recipient_id: "555", message_id: "m_1" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await enviarRespuestaPrivada(CFG, "17841400000000001", "TOKEN-SECRETO", "17900000000000001", "Hola 👋\n\nhttps://linksy.lat/x");
    expect(r).toEqual({ ok: true, data: { recipient_id: "555", message_id: "m_1" } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.instagram.com/v25.0/17841400000000001/messages");
    expect(url).not.toContain("TOKEN-SECRETO");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN-SECRETO");
    expect(JSON.parse(String(init.body))).toEqual({ recipient: { comment_id: "17900000000000001" }, message: { text: "Hola 👋\n\nhttps://linksy.lat/x" } });
  });
  it("un 190 vuelve como token_vencido, sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(400, { error: { code: 190, message: "expired" } })));
    const r = await enviarRespuestaPrivada(CFG, "1", "t", "c", "x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("token_vencido");
  });
  it("sin red: api_no_disponible y transitorio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const r = await enviarRespuestaPrivada(CFG, "1", "t", "c", "x");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("api_no_disponible");
      expect(r.error.transitorio).toBe(true);
    }
  });
});

describe("las otras llamadas documentadas", () => {
  it("responderComentario: POST /<COMMENT_ID>/replies?message=…", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(200, { id: "r_1" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await responderComentario(CFG, "179", "t", "¡Te escribimos por DM!");
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const u = new URL(url);
    expect(u.pathname).toBe("/v25.0/179/replies");
    expect(u.searchParams.get("message")).toBe("¡Te escribimos por DM!");
    expect(init.method).toBe("POST");
  });
  it("perfilInstagram pide los campos que decide la compatibilidad", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(200, { id: "1", user_id: "1", username: "cafe", account_type: "BUSINESS" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await perfilInstagram(CFG, "t");
    expect(r.ok && r.data.account_type).toBe("BUSINESS");
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get("fields")).toContain("account_type");
  });
  it("publicacionesInstagram normaliza la lista y descarta lo que no tiene id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(200, { data: [{ id: "m1", caption: "Hola", media_type: "IMAGE", media_url: "https://x/1.jpg", timestamp: "2026-09-01T00:00:00+0000" }, { caption: "sin id" }] })));
    const r = await publicacionesInstagram(CFG, "1", "t");
    expect(r.ok && r.data).toEqual([{ id: "m1", caption: "Hola", media_type: "IMAGE", media_product_type: null, media_url: "https://x/1.jpg", thumbnail_url: null, permalink: null, timestamp: "2026-09-01T00:00:00+0000" }]);
  });
  it("tokenLargo va SIN versión y con grant_type=ig_exchange_token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(200, { access_token: "LARGO", token_type: "bearer", expires_in: 5184000 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await tokenLargo(CFG, "CORTO");
    expect(r.ok && r.data.expires_in).toBe(5184000);
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.host + u.pathname).toBe("graph.instagram.com/access_token");
    expect(u.searchParams.get("grant_type")).toBe("ig_exchange_token");
  });
});
