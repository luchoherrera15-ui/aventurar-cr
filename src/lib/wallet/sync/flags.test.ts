import { afterEach, describe, expect, it } from "vitest";
import {
  cuentasPilotoWalletV2,
  esCuentaPilotoWalletV2,
  walletV2AppleHabilitado,
  walletV2GoogleHabilitado,
  walletV2Habilitado,
  walletV2HabilitadoPara,
  walletV2SyncHabilitado,
} from "./flags";

const NOMBRES = [
  "WALLET_V2_ENABLED",
  "WALLET_V2_APPLE_ENABLED",
  "WALLET_V2_GOOGLE_ENABLED",
  "WALLET_V2_SYNC_ENABLED",
  "WALLET_V2_CUENTAS_PILOTO",
] as const;

const originales = Object.fromEntries(NOMBRES.map((n) => [n, process.env[n]])) as Record<
  (typeof NOMBRES)[number],
  string | undefined
>;

afterEach(() => {
  for (const n of NOMBRES) {
    if (originales[n] === undefined) delete process.env[n];
    else process.env[n] = originales[n];
  }
});

describe("interruptores booleanos: default OFF", () => {
  it("sin ninguna variable, las cuatro banderas simples dan false", () => {
    delete process.env.WALLET_V2_ENABLED;
    delete process.env.WALLET_V2_APPLE_ENABLED;
    delete process.env.WALLET_V2_GOOGLE_ENABLED;
    delete process.env.WALLET_V2_SYNC_ENABLED;
    expect(walletV2Habilitado()).toBe(false);
    expect(walletV2AppleHabilitado()).toBe(false);
    expect(walletV2GoogleHabilitado()).toBe(false);
    expect(walletV2SyncHabilitado()).toBe(false);
  });

  it("cualquier valor que no sea el string 'true' se lee como apagado", () => {
    process.env.WALLET_V2_ENABLED = "1";
    process.env.WALLET_V2_APPLE_ENABLED = "TRUE";
    process.env.WALLET_V2_GOOGLE_ENABLED = "yes";
    process.env.WALLET_V2_SYNC_ENABLED = "";
    expect(walletV2Habilitado()).toBe(false);
    expect(walletV2AppleHabilitado()).toBe(false);
    expect(walletV2GoogleHabilitado()).toBe(false);
    expect(walletV2SyncHabilitado()).toBe(false);
  });

  it("con 'true' cada bandera se prende de forma independiente", () => {
    process.env.WALLET_V2_ENABLED = "true";
    expect(walletV2Habilitado()).toBe(true);
    expect(walletV2AppleHabilitado()).toBe(false);
    expect(walletV2GoogleHabilitado()).toBe(false);
    expect(walletV2SyncHabilitado()).toBe(false);
  });

  it("Apple y Google se prenden por separado, sin arrastrarse entre sí", () => {
    process.env.WALLET_V2_APPLE_ENABLED = "true";
    expect(walletV2AppleHabilitado()).toBe(true);
    expect(walletV2GoogleHabilitado()).toBe(false);

    delete process.env.WALLET_V2_APPLE_ENABLED;
    process.env.WALLET_V2_GOOGLE_ENABLED = "true";
    expect(walletV2AppleHabilitado()).toBe(false);
    expect(walletV2GoogleHabilitado()).toBe(true);
  });

  it("el worker de sync es independiente del interruptor general", () => {
    process.env.WALLET_V2_ENABLED = "true";
    expect(walletV2SyncHabilitado()).toBe(false);

    delete process.env.WALLET_V2_ENABLED;
    process.env.WALLET_V2_SYNC_ENABLED = "true";
    expect(walletV2SyncHabilitado()).toBe(true);
    expect(walletV2Habilitado()).toBe(false);
  });
});

describe("cuentasPilotoWalletV2: misma forma que ASISTENTE_IA_SLUGS", () => {
  it("sin variable, lista vacía", () => {
    delete process.env.WALLET_V2_CUENTAS_PILOTO;
    expect(cuentasPilotoWalletV2()).toEqual([]);
  });

  it("separa por coma y recorta espacios", () => {
    process.env.WALLET_V2_CUENTAS_PILOTO = " cuenta-a , cuenta-b ,cuenta-c";
    expect(cuentasPilotoWalletV2()).toEqual(["cuenta-a", "cuenta-b", "cuenta-c"]);
  });

  it("descarta segmentos vacíos (coma colgada, doble coma)", () => {
    process.env.WALLET_V2_CUENTAS_PILOTO = "cuenta-a,,cuenta-b,";
    expect(cuentasPilotoWalletV2()).toEqual(["cuenta-a", "cuenta-b"]);
  });
});

describe("esCuentaPilotoWalletV2", () => {
  it("cuenta listada da true", () => {
    process.env.WALLET_V2_CUENTAS_PILOTO = "cuenta-piloto";
    expect(esCuentaPilotoWalletV2("cuenta-piloto")).toBe(true);
  });

  it("cuenta no listada da false", () => {
    process.env.WALLET_V2_CUENTAS_PILOTO = "cuenta-piloto";
    expect(esCuentaPilotoWalletV2("otra-cuenta")).toBe(false);
  });

  it("null, undefined o vacío dan false sin reventar, incluso con la lista vacía", () => {
    delete process.env.WALLET_V2_CUENTAS_PILOTO;
    expect(esCuentaPilotoWalletV2(null)).toBe(false);
    expect(esCuentaPilotoWalletV2(undefined)).toBe(false);
    expect(esCuentaPilotoWalletV2("")).toBe(false);
  });
});

describe("walletV2HabilitadoPara: la pregunta compuesta", () => {
  it("general apagado y cuenta fuera del piloto → false", () => {
    delete process.env.WALLET_V2_ENABLED;
    process.env.WALLET_V2_CUENTAS_PILOTO = "cuenta-piloto";
    expect(walletV2HabilitadoPara("cuenta-cualquiera")).toBe(false);
  });

  it("general apagado pero cuenta EN el piloto → true (la puerta de entrada anticipada)", () => {
    delete process.env.WALLET_V2_ENABLED;
    process.env.WALLET_V2_CUENTAS_PILOTO = "cuenta-piloto";
    expect(walletV2HabilitadoPara("cuenta-piloto")).toBe(true);
  });

  it("general prendido → true para cualquier cuenta, esté o no en el piloto", () => {
    process.env.WALLET_V2_ENABLED = "true";
    delete process.env.WALLET_V2_CUENTAS_PILOTO;
    expect(walletV2HabilitadoPara("cuenta-que-sea")).toBe(true);
    expect(walletV2HabilitadoPara(null)).toBe(true);
  });

  it("general apagado y sin cuentaId (null) → false, nunca revienta", () => {
    delete process.env.WALLET_V2_ENABLED;
    process.env.WALLET_V2_CUENTAS_PILOTO = "cuenta-piloto";
    expect(walletV2HabilitadoPara(null)).toBe(false);
    expect(walletV2HabilitadoPara(undefined)).toBe(false);
  });
});
