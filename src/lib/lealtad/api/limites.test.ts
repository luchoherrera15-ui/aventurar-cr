import { describe, expect, it } from "vitest";
import {
  LIMITES,
  cabecerasDeLimite,
  inicioDeVentana,
  limiteEfectivo,
  restante,
  segundosParaReinicio,
} from "./limites";

/**
 * El cálculo de la ventana tiene que dar EXACTAMENTE lo mismo que
 * `floor(extract(epoch from now()) / ventana) * ventana` de la 0177. Si
 * las dos cuentas se separan, las cabeceras le mienten al integrador
 * sobre cuándo puede volver a intentar, y el que confía en el
 * `Retry-After` se queda esperando de más o choca de nuevo.
 */

// 2026-08-17 14:30:47 UTC
const AHORA = Date.UTC(2026, 7, 17, 14, 30, 47);

describe("inicioDeVentana — truncamiento, igual que en SQL", () => {
  it("trunca al minuto", () => {
    const inicio = inicioDeVentana(AHORA, 60);
    expect(inicio).toBe(Math.floor(AHORA / 1000 / 60) * 60);
    expect(inicio % 60).toBe(0);
  });

  it("trunca a la hora", () => {
    expect(inicioDeVentana(AHORA, 3600) % 3600).toBe(0);
  });

  it("dos momentos del mismo minuto caen en la misma ventana", () => {
    expect(inicioDeVentana(AHORA, 60)).toBe(inicioDeVentana(AHORA + 12_000, 60));
  });

  it("cruzar el minuto abre ventana nueva", () => {
    expect(inicioDeVentana(AHORA, 60)).not.toBe(inicioDeVentana(AHORA + 60_000, 60));
  });

  it("los milisegundos no corren la ventana", () => {
    expect(inicioDeVentana(AHORA + 999, 60)).toBe(inicioDeVentana(AHORA, 60));
  });
});

describe("segundosParaReinicio", () => {
  it("dice cuánto falta para la próxima ventana", () => {
    // 14:30:47 → faltan 13 s para 14:31:00.
    expect(segundosParaReinicio(AHORA, 60)).toBe(13);
  });

  it("nunca devuelve 0 — un `Retry-After: 0` es un reintento inmediato", () => {
    const justoAntes = (inicioDeVentana(AHORA, 60) + 60) * 1000 - 1;
    expect(segundosParaReinicio(justoAntes, 60)).toBeGreaterThanOrEqual(1);
  });

  it("en la ventana de una hora también", () => {
    expect(segundosParaReinicio(AHORA, 3600)).toBe(3600 - (30 * 60 + 47));
  });
});

describe("restante", () => {
  it("cuenta lo que queda", () => {
    expect(restante(60, 1)).toBe(59);
    expect(restante(60, 60)).toBe(0);
  });

  it("nunca es negativo: un «-7» no le dice nada a nadie", () => {
    expect(restante(60, 90)).toBe(0);
    expect(restante(60, -3)).toBe(60);
  });
});

describe("cabecerasDeLimite", () => {
  it("trae límite, restante y el segundo exacto del reinicio", () => {
    const c = cabecerasDeLimite(LIMITES.llave, 5, AHORA);
    expect(c["X-RateLimit-Limite"]).toBe("60");
    expect(c["X-RateLimit-Restante"]).toBe("55");
    expect(Number(c["X-RateLimit-Reinicio"])).toBe(inicioDeVentana(AHORA, 60) + 60);
  });

  it("agotado el presupuesto, el restante es 0", () => {
    expect(cabecerasDeLimite(LIMITES.saldo, 99, AHORA)["X-RateLimit-Restante"]).toBe("0");
  });
});

describe("la tabla de límites", () => {
  it("escribir cuesta más que leer, y el saldo cuesta más que todo", () => {
    expect(LIMITES.llavew.limite).toBeLessThan(LIMITES.llave.limite);
    // /saldo es el único que devuelve algo derivado de una persona.
    expect(LIMITES.saldo.limite).toBeLessThan(LIMITES.llavew.limite);
  });

  it("el techo del negocio es más alto que el de una llave sola", () => {
    // Existe para que un integrador con tres llaves no ahogue al mismo
    // negocio por la puerta de atrás.
    expect(LIMITES.rancho.limite).toBeGreaterThan(LIMITES.llaveh.limite);
    expect(LIMITES.rancho.ventanaSegundos).toBe(LIMITES.llaveh.ventanaSegundos);
  });

  it("ningún ámbito tiene ventana o límite absurdos", () => {
    for (const regla of Object.values(LIMITES)) {
      expect(regla.limite).toBeGreaterThan(0);
      expect(regla.ventanaSegundos).toBeGreaterThan(0);
    }
  });
});

describe("limiteEfectivo — lo que la base configura, dentro de un rango", () => {
  it("sin valor configurado, manda la regla base", () => {
    expect(limiteEfectivo(LIMITES.llave, null).limite).toBe(60);
  });

  it("respeta un valor razonable", () => {
    expect(limiteEfectivo(LIMITES.llave, 120).limite).toBe(120);
  });

  it("no deja que un valor absurdo de la base abra la llave del todo", () => {
    expect(limiteEfectivo(LIMITES.llave, 999_999).limite).toBe(600);
    expect(limiteEfectivo(LIMITES.llave, 0).limite).toBe(1);
    expect(limiteEfectivo(LIMITES.llave, -5).limite).toBe(1);
  });

  it("un NaN no se cuela como límite", () => {
    expect(limiteEfectivo(LIMITES.llave, Number.NaN).limite).toBe(60);
  });
});
