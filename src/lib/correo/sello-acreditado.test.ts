import { describe, expect, it } from "vitest";
import { hitoDelSaldo } from "./sello-acreditado";

/**
 * La regla completa de cuándo un sello amerita correo — y sobre todo,
 * cuándo NO. La versión anterior mandaba un correo por CADA sello (3 en
 * un día para el mismo cliente, según el buzón real del dueño); esta
 * suite fija que eso no pueda volver.
 */
describe("hitoDelSaldo — meta de 10 con premio", () => {
  const meta = 10;
  const premio = "Corte gratis";

  it("el primer sello es bienvenida", () => {
    expect(hitoDelSaldo(1, meta, premio)).toEqual({ tipo: "bienvenida" });
  });

  it.each([2, 3, 4, 5, 6, 7, 8])("el sello intermedio %i NO manda correo", (saldo) => {
    expect(hitoDelSaldo(saldo, meta, premio)).toBeNull();
  });

  it("el penúltimo (9/10) avisa que falta uno", () => {
    expect(hitoDelSaldo(9, meta, premio)).toEqual({ tipo: "falta_uno", premio });
  });

  it("la meta exacta (10/10) desbloquea el premio", () => {
    expect(hitoDelSaldo(10, meta, premio)).toEqual({ tipo: "premio", premio });
  });

  it("pasarse de la meta sin canjear (11/10, 12/10) NO repite el correo del premio", () => {
    expect(hitoDelSaldo(11, meta, premio)).toBeNull();
    expect(hitoDelSaldo(12, meta, premio)).toBeNull();
  });
});

describe("hitoDelSaldo — metas chicas (un mismo saldo calza en dos hitos)", () => {
  it("meta 2: el sello 1 es penúltimo, no bienvenida — gana el más cercano a la plata", () => {
    expect(hitoDelSaldo(1, 2, "Premio")).toEqual({ tipo: "falta_uno", premio: "Premio" });
  });

  it("meta 1: el sello 1 ya es el premio", () => {
    expect(hitoDelSaldo(1, 1, "Premio")).toEqual({ tipo: "premio", premio: "Premio" });
  });
});

describe("hitoDelSaldo — programa sin recompensa activa", () => {
  it("solo cabe la bienvenida del primer sello", () => {
    expect(hitoDelSaldo(1, null, null)).toEqual({ tipo: "bienvenida" });
    expect(hitoDelSaldo(2, null, null)).toBeNull();
    expect(hitoDelSaldo(9, null, null)).toBeNull();
  });

  it("una meta sin nombre de premio no dispara hitos de premio", () => {
    // recompensa borrada a medias o sin nombre: mejor callar que mandar
    // un correo prometiendo un premio que no se puede nombrar.
    expect(hitoDelSaldo(10, 10, null)).toBeNull();
    expect(hitoDelSaldo(9, 10, "")).toBeNull();
  });
});

describe("hitoDelSaldo — valores raros no revientan ni spamean", () => {
  it("saldo 0 (una reversa dejó la tarjeta en cero) no manda nada", () => {
    expect(hitoDelSaldo(0, 10, "Premio")).toBeNull();
  });

  it("meta 0 o negativa se ignora", () => {
    expect(hitoDelSaldo(1, 0, "Premio")).toEqual({ tipo: "bienvenida" });
    expect(hitoDelSaldo(1, -5, "Premio")).toEqual({ tipo: "bienvenida" });
  });
});
