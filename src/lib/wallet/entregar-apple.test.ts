import { describe, expect, it, vi } from "vitest";

/**
 * EL PASO QUE HACÍA INÚTILES A LOS AVISOS DE APPLE.
 *
 * El protocolo de Apple Wallet tiene DOS pasos, no uno:
 *
 *   1. nosotros empujamos «algo cambió» (un push vacío, sin contenido);
 *   2. el teléfono contesta preguntando «¿CUÁLES de mis pases cambiaron
 *      desde tal momento?» — y esa pregunta se responde filtrando por
 *      `pases_wallet.actualizado_en > passesUpdatedSince`.
 *
 * `actualizado_en` solo se escribía al acreditar un sello. O sea que un
 * cambio de DISEÑO, un aviso de PAUSA y una notificación de MARKETING
 * mandaban el push, el teléfono preguntaba, y la ruta contestaba con
 * toda razón «no cambió nada»: el pase nunca se bajaba y el mensaje no
 * aparecía nunca en el teléfono del cliente.
 *
 * Es el mismo fallo que dejaba mudos los sellos, un escalón más arriba:
 * allá la marca de tiempo llegaba corrupta, acá directamente no se
 * escribía. Los dos se veían igual desde afuera —el push salía «bien»—
 * y por eso ninguno se notó.
 *
 * Esta suite fija el orden, que es la mitad del arreglo: marcar SIEMPRE,
 * marcar ANTES del push, y no empujar si no se pudo marcar.
 */

vi.mock("./apns", () => ({ avisarPaseActualizado: vi.fn() }));

import { avisarPaseActualizado } from "./apns";
import { entregarApple, type PaseParaAvisar } from "./aviso-de-pausa";
import type { Admin } from "./aviso-de-pausa";

const PASES: PaseParaAvisar[] = [
  { id: "pase-1", serialNumber: "SERIAL-1", plataforma: "apple", miembroId: "m1" },
  { id: "pase-2", serialNumber: "SERIAL-2", plataforma: "apple", miembroId: "m2" },
];

/**
 * Una base de mentira que ANOTA el orden de las operaciones. El orden es
 * lo que se prueba: marcar después del push sería tan inútil como no
 * marcar —el teléfono puede preguntar entre medio y llevarse un 204.
 */
function baseFalsa(opciones: {
  errorAlMarcar?: string;
  tokens?: string[];
  errorAlLeerDispositivos?: string;
}) {
  const pasos: string[] = [];
  let marcaEscrita: Record<string, unknown> | null = null;

  const db = {
    from(tabla: string) {
      if (tabla === "pases_wallet") {
        return {
          update(valores: Record<string, unknown>) {
            marcaEscrita = valores;
            return {
              in() {
                pasos.push("marcar");
                return Promise.resolve({
                  error: opciones.errorAlMarcar ? { message: opciones.errorAlMarcar } : null,
                });
              },
            };
          },
        };
      }
      if (tabla === "registros_dispositivo") {
        return {
          select() {
            return {
              in() {
                pasos.push("leer-dispositivos");
                return Promise.resolve({
                  data: (opciones.tokens ?? ["tok-1"]).map((t) => ({ push_token: t })),
                  error: opciones.errorAlLeerDispositivos
                    ? { message: opciones.errorAlLeerDispositivos }
                    : null,
                });
              },
            };
          },
          delete() {
            return { in: () => Promise.resolve({ error: null }) };
          },
        };
      }
      throw new Error(`tabla inesperada: ${tabla}`);
    },
  };

  return { db: db as unknown as Admin, pasos, marca: () => marcaEscrita };
}

describe("entregarApple — marca el pase como cambiado", () => {
  it("escribe `actualizado_en` ANTES de mandar el push (el orden es el arreglo)", async () => {
    vi.mocked(avisarPaseActualizado).mockResolvedValue({ ok: true, enviados: 1, caducados: [] });
    const { db, pasos, marca } = baseFalsa({});

    const res = await entregarApple(db, PASES);

    expect(res.ok).toBe(true);
    // Marcar primero, leer dispositivos después: si el push saliera
    // antes de la marca, el teléfono podría preguntar en el medio.
    expect(pasos).toEqual(["marcar", "leer-dispositivos"]);
    expect(marca()).toHaveProperty("actualizado_en");
    expect(avisarPaseActualizado).toHaveBeenCalledWith(["tok-1"]);
  });

  it("la marca es una fecha válida y actual, no un texto cualquiera", async () => {
    vi.mocked(avisarPaseActualizado).mockResolvedValue({ ok: true, enviados: 1, caducados: [] });
    const antes = Date.now();
    const { db, marca } = baseFalsa({});

    await entregarApple(db, PASES);

    const escrito = (marca() as { actualizado_en: string }).actualizado_en;
    const cuando = new Date(escrito).getTime();
    expect(Number.isNaN(cuando)).toBe(false);
    // Tiene que ser AHORA: una fecha vieja no superaría el
    // `passesUpdatedSince` que trae el teléfono y volveríamos al 204.
    expect(cuando).toBeGreaterThanOrEqual(antes - 1000);
  });

  it("si no se puede marcar, NO manda el push: sería gastarlo para un «no cambió nada»", async () => {
    vi.mocked(avisarPaseActualizado).mockClear();
    const { db, pasos } = baseFalsa({ errorAlMarcar: "columna inexistente" });

    const res = await entregarApple(db, PASES);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toContain("marcar el pase como cambiado");
    expect(pasos).toEqual(["marcar"]);
    expect(avisarPaseActualizado).not.toHaveBeenCalled();
  });

  it("marca incluso cuando no hay ningún teléfono registrado", async () => {
    vi.mocked(avisarPaseActualizado).mockClear();
    const { db, marca } = baseFalsa({ tokens: [] });

    const res = await entregarApple(db, PASES);

    // No hay a quién empujarle, pero el pase SÍ cambió: cuando ese
    // iPhone pregunte por su cuenta —lo hace solo cada tanto— tiene que
    // encontrar el cambio esperándolo. Sin la marca, esa consulta
    // espontánea también se llevaba un 204 para siempre.
    expect(res.ok).toBe(true);
    expect(marca()).toHaveProperty("actualizado_en");
    expect(avisarPaseActualizado).not.toHaveBeenCalled();
  });
});
