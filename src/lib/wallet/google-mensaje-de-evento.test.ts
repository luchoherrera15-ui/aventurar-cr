import { generateKeyPairSync } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL MENSAJE DE UN MOVIMIENTO, DE PUNTA A PUNTA CONTRA UN GOOGLE FALSO.
 *
 * Lo que se fija: qué se le pide a Google y en qué orden (leer el objeto,
 * podar si hace falta, agregar el mensaje), que respete el tope del día,
 * que si Google igual dice «cuota» se reintente sin notificación, y que
 * nada de esto lance.
 */

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from() {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: estado.conPase ? { serial_number: "s-1" } : null, error: null }),
      };
      return q;
    },
  }),
}));

import { avisarEventoGoogle, idDeObjeto } from "./google";

const ISSUER = "3388000000023187944";
const MIEMBRO = "6b50a99c-1111-2222-3333-444455556666";
const AHORA = Date.parse("2026-10-01T20:00:00Z");
const OBJETO = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${idDeObjeto(ISSUER, MIEMBRO)}`;
const AVISO = { evento: "sumar" as const, texto: "¡Gracias por preferirnos!", encabezado: "Foorkie" };

const estado = {
  conPase: true,
  /** Lo que devuelve el GET del objeto: sus mensajes, o un status de error. */
  objeto: { status: 200, messages: [] as unknown[] },
  /** Lo que contesta cada `addMessage`, en orden. */
  respuestasAgregar: [] as { status: number; json?: unknown }[],
  pedidos: [] as { metodo: string; url: string; cuerpo: unknown }[],
};

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const respuesta = (status: number, json: unknown) =>
  new Response(json === undefined ? null : JSON.stringify(json), { status, headers: { "content-type": "application/json" } });

beforeAll(() => {
  vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", ISSUER);
  vi.stubEnv(
    "GOOGLE_WALLET_SA_KEY_B64",
    Buffer.from(JSON.stringify({ client_email: "sa@p.iam.gserviceaccount.com", private_key: privateKey })).toString("base64"),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? "GET";
      if (url.startsWith("https://oauth2.googleapis.com/token")) return respuesta(200, { access_token: "tok", expires_in: 3600 });
      const cuerpo = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      estado.pedidos.push({ metodo, url, cuerpo });
      if (metodo === "GET" && url === OBJETO) {
        return estado.objeto.status === 200
          ? respuesta(200, { id: "obj", messages: estado.objeto.messages })
          : respuesta(estado.objeto.status, { error: { message: "no" } });
      }
      if (metodo === "PATCH" && url === OBJETO) return respuesta(200, {});
      if (metodo === "POST" && url === `${OBJETO}/addMessage`) {
        const r = estado.respuestasAgregar.shift() ?? { status: 200, json: {} };
        return respuesta(r.status, r.json ?? {});
      }
      return respuesta(500, { error: "inesperado" });
    }),
  );
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  estado.conPase = true;
  estado.objeto = { status: 200, messages: [] };
  estado.respuestasAgregar = [];
  estado.pedidos = [];
});

afterEach(() => vi.restoreAllMocks());

const agregados = () => estado.pedidos.filter((p) => p.metodo === "POST");
const mensajeAgregado = (i = 0) => (agregados()[i]?.cuerpo as { message: Record<string, unknown> }).message;

describe("avisarEventoGoogle — el mensaje del restaurante en el pase de Google", () => {
  it("lee el objeto y agrega el mensaje CON notificación, con la hora en el id", async () => {
    expect(await avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA })).toEqual({ ok: true, tipo: "TEXT_AND_NOTIFY" });
    expect(estado.pedidos.map((p) => p.metodo)).toEqual(["GET", "POST"]);
    expect(mensajeAgregado()).toEqual({
      header: "Foorkie",
      body: "¡Gracias por preferirnos!",
      id: `evento-sumar-${AHORA}`,
      messageType: "TEXT_AND_NOTIFY",
    });
  });

  it("con 2 avisos en el día, el mensaje entra igual pero SIN notificación", async () => {
    estado.objeto.messages = [
      { id: `evento-sumar-${AHORA - 3_600_000}`, messageType: "TEXT_AND_NOTIFY" },
      { id: "promo-2026-10-01T15:00", messageType: "TEXT_AND_NOTIFY" },
    ];
    expect(await avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA })).toEqual({ ok: true, tipo: "TEXT" });
    expect(mensajeAgregado().messageType).toBe("TEXT");
  });

  it("los nuestros de más de un día se podan ANTES de agregar; lo del restaurante queda", async () => {
    const viejo = { id: `evento-sumar-${AHORA - 30 * 3_600_000}`, messageType: "TEXT_AND_NOTIFY", body: "x" };
    const promo = { id: "promo-2026-09-01T10:00", messageType: "TEXT_AND_NOTIFY", body: "2x1" };
    estado.objeto.messages = [viejo, promo];
    await avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA });
    expect(estado.pedidos.map((p) => p.metodo)).toEqual(["GET", "PATCH", "POST"]);
    expect(estado.pedidos[1].cuerpo).toEqual({ messages: [promo] });
  });

  it("si Google igual dice que se llegó al tope, se reintenta SIN notificación", async () => {
    estado.respuestasAgregar = [{ status: 429, json: { error: { message: "QuotaExceededException" } } }, { status: 200 }];
    expect(await avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA })).toEqual({ ok: true, tipo: "TEXT" });
    expect(agregados().map((p) => (p.cuerpo as { message: { messageType: string } }).message.messageType)).toEqual([
      "TEXT_AND_NOTIFY",
      "TEXT",
    ]);
  });

  it("sin poder leer el objeto, intenta con notificación (Google es el que pone el tope)", async () => {
    estado.objeto = { status: 503, messages: [] };
    expect(await avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA })).toEqual({ ok: true, tipo: "TEXT_AND_NOTIFY" });
  });

  it("sin pase de Android, o con un objeto que nunca se creó: no hay a quién, y no es un error", async () => {
    estado.conPase = false;
    expect(await avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA })).toEqual({ ok: true, tipo: null });
    expect(estado.pedidos).toHaveLength(0);
    estado.conPase = true;
    estado.objeto = { status: 404, messages: [] };
    expect(await avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA })).toEqual({ ok: true, tipo: null });
    expect(agregados()).toHaveLength(0);
  });

  it("si Google rechaza, devuelve el motivo y no lanza", async () => {
    estado.respuestasAgregar = [{ status: 500, json: { error: "caído" } }];
    expect(await avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA })).toEqual({
      ok: false,
      motivo: "Google respondió 500 al agregar el mensaje.",
    });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("se cortó la red"));
    await expect(avisarEventoGoogle(MIEMBRO, AVISO, { ahora: AHORA })).resolves.toMatchObject({ ok: false });
  });
});
