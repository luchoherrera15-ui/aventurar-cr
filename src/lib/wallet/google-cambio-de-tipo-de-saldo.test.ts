import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * UN PASE QUE NACIÓ CON EL SALDO ENTERO Y AHORA EL SALDO VA COMO TEXTO.
 * CONTRA UN GOOGLE FALSO.
 *
 * El 22 nov 2026 Tostado pasó a puntos con decimales y el saldo del pase
 * dejó de ser `{ int }` para ser `{ string: "20.35" }`. Los pases que ya
 * existían respondían 400 «More than one type of loyalty point balances
 * cannot be set» al PATCH y el teléfono se quedaba con el saldo viejo.
 * Lo que se fija: en ese caso (y solo en ese) se lee el objeto y se guarda
 * entero con PUT, con el saldo nuevo y sin el viejo, conservando el resto;
 * cualquier otra respuesta se devuelve tal cual y no se toca nada más.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));

import { credencialesGoogleDelEntorno, parchearObjetoDeGoogle } from "./google";

const ISSUER = "3388000000023187944";
const RUTA = "/loyaltyObject/3388000000023187944.miembro-1";
const DOS_TIPOS = {
  error: { code: 400, message: "More than one type of loyalty point balances cannot be set", errors: [] },
};

type Pedido = { metodo: string; url: string; cuerpo: Record<string, unknown> | null };
type Contestacion = { status: number; json: unknown };

const estado = {
  /** Lo que contesta Google a cada método, en orden. */
  respuestas: {} as Record<string, Contestacion[]>,
  pedidos: [] as Pedido[],
};

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const LLAVE_B64 = Buffer.from(JSON.stringify({ client_email: "sa@p.iam.gserviceaccount.com", private_key: privateKey })).toString("base64");

const respuesta = (status: number, json: unknown) =>
  new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) return respuesta(200, { access_token: "tok", expires_in: 3600 });
      const metodo = init?.method ?? "GET";
      estado.pedidos.push({ metodo, url, cuerpo: typeof init?.body === "string" ? JSON.parse(init.body) : null });
      const siguiente = estado.respuestas[metodo]?.shift();
      return siguiente ? respuesta(siguiente.status, siguiente.json) : respuesta(500, { error: "sin guion para " + metodo });
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
  estado.respuestas = {};
  estado.pedidos = [];
});

const PARCHE = {
  loyaltyPoints: { label: "Puntos", balance: { string: "20.35" } },
  textModulesData: [{ id: "meta", header: "Próxima recompensa", body: "Café del día 8 oz" }],
};

const OBJETO_VIEJO = {
  id: `${ISSUER}.miembro-1`,
  classId: `${ISSUER}.clase-1`,
  state: "ACTIVE",
  accountId: "miembro-1",
  accountName: "Luz",
  barcode: { type: "QR_CODE", value: "serial-1" },
  loyaltyPoints: { label: "Puntos", balance: { int: 15 } },
  messages: [{ id: "m1", header: "Tostado", body: "Hola" }],
  hasUsers: true,
};

function cred() {
  const c = credencialesGoogleDelEntorno();
  if (!c) throw new Error("faltan las credenciales de prueba");
  return c;
}

describe("parchearObjetoDeGoogle", () => {
  it("si el PATCH entra, es lo único que se manda", async () => {
    estado.respuestas.PATCH = [{ status: 200, json: { id: "obj" } }];
    const r = await parchearObjetoDeGoogle(cred(), RUTA, PARCHE);
    expect(r).toMatchObject({ status: 200, metodo: "PATCH" });
    expect(estado.pedidos.map((p) => p.metodo)).toEqual(["PATCH"]);
  });

  it("con el 400 de los dos tipos de saldo lee el objeto y lo guarda entero con el saldo nuevo y sin el viejo", async () => {
    estado.respuestas.PATCH = [{ status: 400, json: DOS_TIPOS }];
    estado.respuestas.GET = [{ status: 200, json: OBJETO_VIEJO }];
    estado.respuestas.PUT = [{ status: 200, json: { id: "obj" } }];

    const r = await parchearObjetoDeGoogle(cred(), RUTA, PARCHE);

    expect(r).toMatchObject({ status: 200, metodo: "PUT" });
    expect(estado.pedidos.map((p) => p.metodo)).toEqual(["PATCH", "GET", "PUT"]);
    const put = estado.pedidos[2];
    expect(put.url.endsWith(RUTA)).toBe(true);
    // El saldo es solo el nuevo: ni rastro del entero.
    expect(put.cuerpo?.loyaltyPoints).toEqual({ label: "Puntos", balance: { string: "20.35" } });
    // Lo demás del objeto se conserva tal cual estaba.
    expect(put.cuerpo).toMatchObject({
      id: OBJETO_VIEJO.id,
      classId: OBJETO_VIEJO.classId,
      state: "ACTIVE",
      accountName: "Luz",
      barcode: OBJETO_VIEJO.barcode,
      messages: OBJETO_VIEJO.messages,
    });
    // Y lo que traía el parche entra.
    expect(put.cuerpo?.textModulesData).toEqual(PARCHE.textModulesData);
  });

  it("funciona igual al revés: un objeto con saldo en texto que vuelve a entero", async () => {
    estado.respuestas.PATCH = [{ status: 400, json: DOS_TIPOS }];
    estado.respuestas.GET = [{ status: 200, json: { ...OBJETO_VIEJO, loyaltyPoints: { label: "Puntos", balance: { string: "4.75" } } } }];
    estado.respuestas.PUT = [{ status: 200, json: {} }];

    await parchearObjetoDeGoogle(cred(), RUTA, { loyaltyPoints: { label: "Puntos", balance: { int: 5 } } });

    expect(estado.pedidos[2].cuerpo?.loyaltyPoints).toEqual({ label: "Puntos", balance: { int: 5 } });
  });

  it("si el PUT falla, devuelve ese fallo marcado como PUT", async () => {
    estado.respuestas.PATCH = [{ status: 400, json: DOS_TIPOS }];
    estado.respuestas.GET = [{ status: 200, json: OBJETO_VIEJO }];
    estado.respuestas.PUT = [{ status: 403, json: { error: { message: "no" } } }];

    const r = await parchearObjetoDeGoogle(cred(), RUTA, PARCHE);

    expect(r).toMatchObject({ status: 403, metodo: "PUT" });
  });

  it("si no se puede leer el objeto, devuelve el 400 original y no guarda nada", async () => {
    estado.respuestas.PATCH = [{ status: 400, json: DOS_TIPOS }];
    estado.respuestas.GET = [{ status: 404, json: { error: {} } }];

    const r = await parchearObjetoDeGoogle(cred(), RUTA, PARCHE);

    expect(r).toMatchObject({ status: 400, metodo: "PATCH" });
    expect(estado.pedidos.map((p) => p.metodo)).toEqual(["PATCH", "GET"]);
  });

  it("otro 400, un 404 o un 500 se devuelven tal cual, sin leer ni guardar nada", async () => {
    for (const status of [400, 404, 500]) {
      estado.pedidos = [];
      estado.respuestas.PATCH = [{ status, json: { error: { message: "otra cosa" } } }];
      const r = await parchearObjetoDeGoogle(cred(), RUTA, PARCHE);
      expect(r).toMatchObject({ status, metodo: "PATCH" });
      expect(estado.pedidos.map((p) => p.metodo)).toEqual(["PATCH"]);
    }
  });
});
