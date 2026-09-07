import { describe, expect, it } from "vitest";
import { firmarEstado, nuevoNonce, urlAutorizacion, verificarEstado, VIDA_ESTADO_MS } from "./oauth";

const SECRETO = "app-secret-de-prueba";
const DATOS = { negocioId: "neg-1", usuarioId: "user-1", nonce: "n0nce" };

describe("el state de OAuth", () => {
  it("firma y verifica, y devuelve el contexto", () => {
    const t0 = 1_700_000_000_000;
    const token = firmarEstado(DATOS, SECRETO, t0);
    const v = verificarEstado(token, SECRETO, t0 + 1000);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.estado.negocioId).toBe("neg-1");
      expect(v.estado.usuarioId).toBe("user-1");
      expect(v.estado.nonce).toBe("n0nce");
      expect(v.estado.exp).toBe(t0 + VIDA_ESTADO_MS);
    }
  });

  it("un payload manipulado no pasa (cambiar el negocio)", () => {
    const token = firmarEstado(DATOS, SECRETO);
    const [payload, firma] = token.split(".");
    const abierto = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    abierto.negocioId = "neg-ajeno";
    const alterado = Buffer.from(JSON.stringify(abierto)).toString("base64url");
    expect(verificarEstado(`${alterado}.${firma}`, SECRETO)).toEqual({ ok: false, motivo: "firma inválida" });
  });

  it("otra app (otro secreto) no puede fabricarlo", () => {
    const token = firmarEstado(DATOS, "otro-secreto");
    expect(verificarEstado(token, SECRETO).ok).toBe(false);
  });

  it("vence a los 10 minutos", () => {
    const t0 = 1_700_000_000_000;
    const token = firmarEstado(DATOS, SECRETO, t0);
    expect(verificarEstado(token, SECRETO, t0 + VIDA_ESTADO_MS - 1).ok).toBe(true);
    expect(verificarEstado(token, SECRETO, t0 + VIDA_ESTADO_MS)).toEqual({ ok: false, motivo: "state vencido" });
  });

  it("basura, vacío o sin firma: rechazo sin lanzar", () => {
    expect(verificarEstado("", SECRETO).ok).toBe(false);
    expect(verificarEstado(null, SECRETO).ok).toBe(false);
    expect(verificarEstado("solo-una-parte", SECRETO).ok).toBe(false);
    expect(verificarEstado("a.b.c", SECRETO).ok).toBe(false);
  });

  it("cada nonce es distinto", () => {
    expect(nuevoNonce()).not.toBe(nuevoNonce());
    expect(nuevoNonce().length).toBeGreaterThan(10);
  });

  it("la URL de autorización lleva exactamente los tres permisos vigentes", () => {
    const u = new URL(urlAutorizacion({ appId: "123", redirectUri: "https://www.bookea.lat/api/instagram/callback", state: "s" }));
    expect(u.origin + u.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(u.searchParams.get("client_id")).toBe("123");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("state")).toBe("s");
    expect(u.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages");
  });
});
