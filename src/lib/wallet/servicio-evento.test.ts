import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL AVISO DEL MOVIMIENTO CON EL MENSAJE DEL RESTAURANTE
 * (`avisarCambioDePase(miembro, evento)`).
 *
 * Lo que se fija es el ORDEN y que nada frene nada:
 *
 *   · el mensaje de Apple se deja escrito ANTES del push (si no, el
 *     iPhone baja el pase sin él);
 *   · el de Google sale DESPUÉS del refresco del saldo;
 *   · si la tarjeta no es de Foorkie (la pregunta contesta null), es el
 *     aviso de siempre y nada más;
 *   · si preparar el mensaje revienta, o Google lo rechaza, el push y el
 *     refresco salen igual y la función no lanza.
 */

const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const GRACIAS = { evento: "sumar", texto: "¡Gracias por preferirnos!", encabezado: "Foorkie" };

const estado = {
  pases: [] as { serial_number: string; plataforma: string }[],
  pasos: [] as string[],
  mensaje: GRACIAS as typeof GRACIAS | null,
  prepararRevienta: false,
  googleRevienta: false,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(tabla: string) {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        delete: () => q,
        then: (ok: (r: unknown) => unknown) =>
          Promise.resolve(
            tabla === "pases_wallet"
              ? { data: estado.pases, error: null }
              : tabla === "registros_dispositivo"
                ? { data: [{ push_token: "tok-1", device_library_id: "d-1" }], error: null }
                : { data: [], error: null },
          ).then(ok),
      };
      return q;
    },
  }),
}));

vi.mock("./apns", () => ({
  avisarPaseActualizado: vi.fn(async (tokens: string[]) => {
    estado.pasos.push(`apple:push:${tokens.join(",")}`);
    return { ok: true, enviados: tokens.length, caducados: [] };
  }),
}));

vi.mock("./google", () => ({
  refrescarPaseGoogleDeMiembro: vi.fn(async () => {
    estado.pasos.push("google:refresco");
    return { ok: true };
  }),
  avisarEventoGoogle: vi.fn(async (_id: string, m: { texto: string }) => {
    if (estado.googleRevienta) throw new Error("Google caído");
    estado.pasos.push(`google:mensaje:${m.texto}`);
    return { ok: true, tipo: "TEXT_AND_NOTIFY" };
  }),
}));

vi.mock("@/lib/plataforma/foorkie-mensajes", () => ({
  prepararMensajeDelEvento: vi.fn(async () => {
    if (estado.prepararRevienta) throw new Error("la base no contesta");
    estado.pasos.push("preparar");
    return estado.mensaje;
  }),
}));

import { prepararMensajeDelEvento } from "@/lib/plataforma/foorkie-mensajes";
import { avisarEventoGoogle } from "./google";
import { avisarCambioDePase } from "./servicio";

const APPLE = { serial_number: "s-apple", plataforma: "apple" };
const GOOGLE = { serial_number: "s-google", plataforma: "google" };

beforeEach(() => {
  estado.pases = [APPLE, GOOGLE];
  estado.pasos = [];
  estado.mensaje = GRACIAS;
  estado.prepararRevienta = false;
  estado.googleRevienta = false;
  vi.mocked(prepararMensajeDelEvento).mockClear();
  vi.mocked(avisarEventoGoogle).mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("avisarCambioDePase con evento", () => {
  it("se prepara (y se escribe el de Apple) ANTES del push; el de Google sale DESPUÉS del refresco", async () => {
    await avisarCambioDePase(MIEMBRO, "sumar");
    expect(estado.pasos).toEqual([
      "preparar",
      "apple:push:tok-1",
      "google:refresco",
      "google:mensaje:¡Gracias por preferirnos!",
    ]);
    expect(vi.mocked(prepararMensajeDelEvento).mock.calls[0].slice(1)).toEqual([MIEMBRO, "sumar", { apple: true }]);
    expect(avisarEventoGoogle).toHaveBeenCalledWith(MIEMBRO, GRACIAS);
  });

  it("una tarjeta que no es de Foorkie (la pregunta contesta null): el aviso de siempre, nada más", async () => {
    estado.mensaje = null;
    await avisarCambioDePase(MIEMBRO, "canjear");
    expect(estado.pasos).toEqual(["preparar", "apple:push:tok-1", "google:refresco"]);
    expect(avisarEventoGoogle).not.toHaveBeenCalled();
  });

  it("sin evento (un reintento, el vencimiento de los sellos) ni se pregunta: lo de siempre", async () => {
    await avisarCambioDePase(MIEMBRO);
    expect(prepararMensajeDelEvento).not.toHaveBeenCalled();
    expect(estado.pasos).toEqual(["apple:push:tok-1", "google:refresco"]);
  });

  it("sin ningún pase no hay a quién mandarle nada: ni se pregunta", async () => {
    estado.pases = [];
    await avisarCambioDePase(MIEMBRO, "sumar");
    expect(prepararMensajeDelEvento).not.toHaveBeenCalled();
    expect(avisarEventoGoogle).not.toHaveBeenCalled();
  });

  it("solo con Android: se prepara sin escribir para Apple, y sale por Google", async () => {
    estado.pases = [GOOGLE];
    await avisarCambioDePase(MIEMBRO, "quitar");
    expect(vi.mocked(prepararMensajeDelEvento).mock.calls[0].slice(1)).toEqual([MIEMBRO, "quitar", { apple: false }]);
    expect(avisarEventoGoogle).toHaveBeenCalledTimes(1);
  });

  it("si preparar el mensaje revienta, el push y el refresco salen igual y no lanza", async () => {
    estado.prepararRevienta = true;
    await expect(avisarCambioDePase(MIEMBRO, "sumar")).resolves.toBeUndefined();
    expect(estado.pasos).toEqual(["apple:push:tok-1", "google:refresco"]);
    expect(avisarEventoGoogle).not.toHaveBeenCalled();
  });

  it("si el mensaje de Google revienta, tampoco lanza: el saldo ya se avisó", async () => {
    estado.googleRevienta = true;
    await expect(avisarCambioDePase(MIEMBRO, "sumar")).resolves.toBeUndefined();
    expect(estado.pasos).toEqual(["preparar", "apple:push:tok-1", "google:refresco"]);
  });
});
