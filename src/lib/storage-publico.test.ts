import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { esUrlDeNuestroStorage } from "./storage-publico";

/**
 * El caso que rompió el creador de tarjetas en producción («El logo no
 * se subió bien») está acá abajo, en «tolera una variable sucia»: la
 * URL era correcta y la validación la rechazaba igual.
 */

const PROYECTO = "https://bjhprmtobmualefvcmau.supabase.co";
const OBJETO = `${PROYECTO}/storage/v1/object/public/comprobantes/logos-negocio/alta-1.png`;

const original = process.env.NEXT_PUBLIC_SUPABASE_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = PROYECTO;
});

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = original;
});

describe("esUrlDeNuestroStorage", () => {
  it("acepta un objeto público de nuestro bucket", () => {
    expect(esUrlDeNuestroStorage(OBJETO, "comprobantes")).toBe(true);
  });

  it("rechaza otro bucket", () => {
    expect(esUrlDeNuestroStorage(OBJETO, "albumes")).toBe(false);
  });

  it("rechaza un host ajeno", () => {
    const ajena =
      "https://malicioso.example.com/storage/v1/object/public/comprobantes/x.png";
    expect(esUrlDeNuestroStorage(ajena, "comprobantes")).toBe(false);
  });

  it("rechaza una ruta que no es del objeto público", () => {
    const firmada = `${PROYECTO}/storage/v1/object/sign/comprobantes/x.png`;
    expect(esUrlDeNuestroStorage(firmada, "comprobantes")).toBe(false);
  });

  it("rechaza la carpeta sin objeto", () => {
    const carpeta = `${PROYECTO}/storage/v1/object/public/comprobantes/`;
    expect(esUrlDeNuestroStorage(carpeta, "comprobantes")).toBe(false);
  });

  it("rechaza http y basura", () => {
    expect(esUrlDeNuestroStorage(OBJETO.replace("https:", "http:"), "comprobantes")).toBe(
      false,
    );
    expect(esUrlDeNuestroStorage("no es una url", "comprobantes")).toBe(false);
    expect(esUrlDeNuestroStorage("", "comprobantes")).toBe(false);
  });

  // ── El bug de producción ──────────────────────────────────────────
  // supabase-js normaliza lo que le pasan; el `${env}/storage/…` que
  // había antes, no. Cada una de estas variables sucias rechazaba
  // TODOS los logos, y el dueño veía "El logo no se subió bien".
  it("tolera una variable sucia (barra final, espacios, salto de línea)", () => {
    for (const sucia of [
      `${PROYECTO}/`,
      `${PROYECTO}//`,
      ` ${PROYECTO} `,
      `${PROYECTO}\n`,
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = sucia;
      expect(esUrlDeNuestroStorage(OBJETO, "comprobantes")).toBe(true);
    }
  });

  it("sin la variable, sigue exigiendo que sea un host de Supabase", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(esUrlDeNuestroStorage(OBJETO, "comprobantes")).toBe(true);
    expect(
      esUrlDeNuestroStorage(
        "https://malicioso.example.com/storage/v1/object/public/comprobantes/x.png",
        "comprobantes",
      ),
    ).toBe(false);
  });
});
