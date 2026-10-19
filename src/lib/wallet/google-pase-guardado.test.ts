import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ¿EL PASE DE GOOGLE ESTÁ GUARDADO? CONTRA UN GOOGLE FALSO.
 *
 * Para la ficha del cliente de Foorkie (`clientes/detalle`). Lo que se
 * fija: que solo se hace un GET del objeto (nada se crea ni se parcha),
 * que se usa el id guardado (`objeto_externo`) si lo hay, cómo se lee
 * `hasUsers` y que todo lo que no es una respuesta clara (404, error,
 * tardanza, sin credenciales) es «no se sabe», sin lanzar nunca.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));

import { idDeObjeto, paseGoogleGuardado } from "./google";

const ISSUER = "3388000000023187944";
const MIEMBRO = "6b50a99c-1111-2222-3333-444455556666";
const API = "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/";

const estado = {
  /** Lo que contesta el GET del objeto. `colgar` = nunca contesta. */
  respuesta: { status: 200, json: { id: "obj", hasUsers: true } as unknown, colgar: false },
  pedidos: [] as { metodo: string; url: string }[],
};

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const LLAVE_B64 = Buffer.from(JSON.stringify({ client_email: "sa@p.iam.gserviceaccount.com", private_key: privateKey })).toString("base64");

const respuesta = (status: number, json: unknown) =>
  new Response(json === undefined ? null : JSON.stringify(json), { status, headers: { "content-type": "application/json" } });

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) return respuesta(200, { access_token: "tok", expires_in: 3600 });
      estado.pedidos.push({ metodo: init?.method ?? "GET", url });
      if (estado.respuesta.colgar) return new Promise<Response>(() => {});
      return respuesta(estado.respuesta.status, estado.respuesta.json);
    }),
  );
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", ISSUER);
  vi.stubEnv("GOOGLE_WALLET_SA_KEY_B64", LLAVE_B64);
  estado.respuesta = { status: 200, json: { id: "obj", hasUsers: true }, colgar: false };
  estado.pedidos = [];
});

describe("paseGoogleGuardado", () => {
  it("hasUsers: true → guardado, con un solo GET del objeto del miembro", async () => {
    expect(await paseGoogleGuardado(MIEMBRO, null)).toBe(true);
    expect(estado.pedidos).toEqual([{ metodo: "GET", url: `${API}${idDeObjeto(ISSUER, MIEMBRO)}` }]);
  });

  it("usa el id guardado al crearlo (objeto_externo) si lo hay", async () => {
    await paseGoogleGuardado(MIEMBRO, `${ISSUER}.miembro_viejo`);
    expect(estado.pedidos).toEqual([{ metodo: "GET", url: `${API}${ISSUER}.miembro_viejo` }]);
  });

  it("hasUsers: false, o el campo ausente (Google omite los false) → no guardado", async () => {
    estado.respuesta.json = { id: "obj", hasUsers: false };
    expect(await paseGoogleGuardado(MIEMBRO, null)).toBe(false);
    estado.respuesta.json = { id: "obj" };
    expect(await paseGoogleGuardado(MIEMBRO, null)).toBe(false);
  });

  it("404, error de Google o una respuesta sin cuerpo → no se sabe", async () => {
    estado.respuesta = { status: 404, json: { error: { message: "no existe" } }, colgar: false };
    expect(await paseGoogleGuardado(MIEMBRO, null)).toBeNull();
    estado.respuesta = { status: 500, json: { error: "ups" }, colgar: false };
    expect(await paseGoogleGuardado(MIEMBRO, null)).toBeNull();
    estado.respuesta = { status: 200, json: undefined, colgar: false };
    expect(await paseGoogleGuardado(MIEMBRO, null)).toBeNull();
  });

  it("si Google no contesta a tiempo → no se sabe, sin esperar de más", async () => {
    estado.respuesta.colgar = true;
    const antes = Date.now();
    expect(await paseGoogleGuardado(MIEMBRO, null, 50)).toBeNull();
    expect(Date.now() - antes).toBeLessThan(1_000);
  });

  it("sin credenciales de Google → no se sabe, y no se llama a nadie", async () => {
    vi.stubEnv("GOOGLE_WALLET_SA_KEY_B64", "");
    expect(await paseGoogleGuardado(MIEMBRO, null)).toBeNull();
    expect(estado.pedidos).toEqual([]);
  });

  it("si fetch lanza → no se sabe, sin lanzar", async () => {
    const fetchReal = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) return respuesta(200, { access_token: "tok", expires_in: 3600 });
      throw new Error("sin red");
    }));
    try {
      expect(await paseGoogleGuardado(MIEMBRO, null)).toBeNull();
    } finally {
      vi.stubGlobal("fetch", fetchReal);
    }
  });
});
