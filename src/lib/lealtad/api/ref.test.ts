import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PATRON_REF, esRefValido, pepperDeBytea, refDeMiembro } from "./ref";

/**
 * El `ref` es lo que hace que la base robada a un integrador no sirva
 * en ningún otro lado, y que «Romper la correlación» sea un botón y no
 * una migración de emergencia. Estas tres propiedades son eso.
 */

const MIEMBRO = "9f1c8a4e-1234-4a4a-9c9c-0f0f0f0f0f0f";
const OTRO = "1a2b3c4d-1234-4a4a-9c9c-0f0f0f0f0f0f";

const PEPPER_A = randomBytes(32);
const PEPPER_B = randomBytes(32);

describe("refDeMiembro", () => {
  it("tiene la forma que el `check` de la base exige", () => {
    expect(refDeMiembro(MIEMBRO, PEPPER_A)).toMatch(PATRON_REF);
  });

  it("es determinístico: la tabla de refs es un índice, no un secreto nuevo", () => {
    expect(refDeMiembro(MIEMBRO, PEPPER_A)).toBe(refDeMiembro(MIEMBRO, PEPPER_A));
  });

  it("NO contiene el uuid del miembro", () => {
    const ref = refDeMiembro(MIEMBRO, PEPPER_A);
    expect(ref).not.toContain("9f1c");
    expect(ref).not.toContain(MIEMBRO.replaceAll("-", "").slice(0, 6).toUpperCase());
  });

  it("con OTRO pepper da OTRO ref — la base robada no sirve contra otra llave", () => {
    expect(refDeMiembro(MIEMBRO, PEPPER_A)).not.toBe(refDeMiembro(MIEMBRO, PEPPER_B));
  });

  it("rotar el pepper invalida el ref viejo — eso es «Romper la correlación»", () => {
    const antes = refDeMiembro(MIEMBRO, PEPPER_A);
    const despues = refDeMiembro(MIEMBRO, randomBytes(32));
    expect(despues).not.toBe(antes);
  });

  it("dos miembros distintos no comparten ref", () => {
    expect(refDeMiembro(MIEMBRO, PEPPER_A)).not.toBe(refDeMiembro(OTRO, PEPPER_A));
  });

  it("no choca en volumen", () => {
    const vistos = new Set(
      Array.from({ length: 2000 }, (_, i) => refDeMiembro(`miembro-${i}`, PEPPER_A)),
    );
    expect(vistos.size).toBe(2000);
  });

  it("no usa letras ambiguas: nadie tiene que decidir si es un 1 o una l", () => {
    for (let i = 0; i < 500; i++) {
      const cuerpo = refDeMiembro(`m-${i}`, PEPPER_A).slice(3);
      expect(cuerpo).not.toMatch(/[ILOU]/);
    }
  });
});

describe("esRefValido", () => {
  it("acepta el que genera esta misma función", () => {
    expect(esRefValido(refDeMiembro(MIEMBRO, PEPPER_A))).toBe(true);
  });

  it.each([
    ["nulo", null],
    ["número", 12345],
    ["objeto", {}],
    ["uuid pelado", MIEMBRO],
    ["sin prefijo", "7Q2KX9FJ4M8NBVDA"],
    ["minúsculas", "mb_7q2kx9fj4m8nbvda"],
    ["corto", "mb_7Q2KX9"],
    ["largo", "mb_7Q2KX9FJ4M8NBVDAX"],
    ["con comodín de LIKE", "mb_%%%%%%%%%%%%%%%%"],
  ])("rechaza: %s", (_caso, valor) => {
    expect(esRefValido(valor)).toBe(false);
  });
});

describe("pepperDeBytea", () => {
  it("lee el formato hex de Postgres", () => {
    const bytes = randomBytes(32);
    expect(pepperDeBytea(`\\x${bytes.toString("hex")}`)?.equals(bytes)).toBe(true);
  });

  it("tolera el hex sin el prefijo", () => {
    const bytes = randomBytes(32);
    expect(pepperDeBytea(bytes.toString("hex"))?.equals(bytes)).toBe(true);
  });

  it.each([
    ["nulo", null],
    ["vacío", ""],
    ["corto", "\\xdeadbeef"],
    ["no-hex", `\\x${"z".repeat(64)}`],
    ["objeto", { data: [1, 2, 3] }],
  ])("devuelve null ante un pepper %s — sin pepper no se calcula ninguno", (_caso, valor) => {
    expect(pepperDeBytea(valor)).toBeNull();
  });
});
