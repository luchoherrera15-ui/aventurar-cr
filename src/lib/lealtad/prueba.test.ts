import { describe, expect, it } from "vitest";
import {
  DIAS_AVISO_PREVIO,
  estadoDePrueba,
  esPruebaSinCosto,
  finDePrueba,
  textoRestante,
} from "./prueba";
import { PLANES, PLANES_OFRECIDOS } from "./planes";

const UN_DIA = 24 * 60 * 60 * 1000;

/** Un instante fijo, para que las pruebas no dependan del reloj. */
const ALTA = new Date("2026-08-13T15:30:00.000Z");

describe("finDePrueba", () => {
  it("la prueba de 14 días vence a los 14 días EXACTOS", () => {
    const fin = finDePrueba("prueba", ALTA);
    expect(fin).not.toBeNull();
    expect(new Date(fin!).getTime() - ALTA.getTime()).toBe(14 * UN_DIA);
    // A la misma hora del reloj: quien se dio de alta a las 11 de la
    // noche no pierde ni gana medio día.
    expect(fin).toBe("2026-08-27T15:30:00.000Z");
  });

  it("los paquetes de PAGO no vencen por tiempo", () => {
    // `null` es lo que `tiene_addon()` lee como «sin vencimiento», que
    // es lo correcto para algo que se cobra por mes.
    for (const id of ["arranque", "impulso", "ilimitado"] as const) {
      expect(finDePrueba(id, ALTA), id).toBeNull();
    }
  });

  it("los retirados tampoco vencen: no se les cambia lo que tenían", () => {
    expect(finDePrueba("gratis", ALTA)).toBeNull();
    expect(finDePrueba("basico", ALTA)).toBeNull();
    expect(finDePrueba(null, ALTA)).toBeNull();
    expect(finDePrueba("premium", ALTA)).toBeNull();
  });

  it("el catálogo entero está de acuerdo con esta función", () => {
    for (const id of PLANES_OFRECIDOS) {
      const fin = finDePrueba(id, ALTA);
      if (PLANES[id].diasPrueba > 0) {
        expect(fin, `${id} promete días de prueba y no vence`).not.toBeNull();
      } else {
        expect(fin, `${id} no es una prueba y sin embargo vence`).toBeNull();
      }
    }
  });
});

describe("esPruebaSinCosto", () => {
  it("solo la prueba nace con fecha de corte", () => {
    expect(esPruebaSinCosto("prueba")).toBe(true);
    expect(esPruebaSinCosto("arranque")).toBe(false);
    // El retirado `gratis` cuesta $0 pero NO es una prueba: no se puede
    // elegir, y por eso tampoco entra por acá.
    expect(esPruebaSinCosto("gratis")).toBe(false);
    expect(esPruebaSinCosto(null)).toBe(false);
  });
});

describe("estadoDePrueba: vence cuando corresponde y NI UN DÍA ANTES", () => {
  const vence = finDePrueba("prueba", ALTA)!;

  it("el día del alta quedan 14 días completos", () => {
    const e = estadoDePrueba({ plan: "prueba", venceEn: vence, ahora: ALTA });
    expect(e.esPrueba).toBe(true);
    expect(e.vencida).toBe(false);
    expect(e.diasRestantes).toBe(14);
    expect(e.porVencer).toBe(false);
  });

  it("un minuto ANTES del corte todavía no venció", () => {
    const casi = new Date(new Date(vence).getTime() - 60_000);
    const e = estadoDePrueba({ plan: "prueba", venceEn: vence, ahora: casi });
    expect(e.vencida).toBe(false);
    expect(e.diasRestantes).toBe(0);
    expect(textoRestante(e)).toBe("Tu prueba termina hoy");
  });

  it("en el minuto EXACTO ya venció — igual que `tiene_addon()`", () => {
    // La base corta con `vence_en > now()`: al llegar el instante, la
    // condición es falsa. Si esta función dijera otra cosa, la pantalla
    // y el panel se contradirían justo ese minuto.
    const e = estadoDePrueba({ plan: "prueba", venceEn: vence, ahora: new Date(vence) });
    expect(e.vencida).toBe(true);
    expect(e.diasRestantes).toBe(0);
    expect(textoRestante(e)).toBe("Tu prueba terminó");
  });

  it("un día después sigue vencida (no vuelve a la vida)", () => {
    const despues = new Date(new Date(vence).getTime() + UN_DIA);
    expect(estadoDePrueba({ plan: "prueba", venceEn: vence, ahora: despues }).vencida).toBe(true);
  });

  it("redondea hacia ABAJO: 3 días y medio son «3», nunca «4»", () => {
    const ahora = new Date(new Date(vence).getTime() - 3.5 * UN_DIA);
    const e = estadoDePrueba({ plan: "prueba", venceEn: vence, ahora });
    expect(e.diasRestantes).toBe(3);
    expect(textoRestante(e)).toBe("Te quedan 3 días de prueba");
  });

  it("«porVencer» se enciende justo en la ventana del aviso", () => {
    const enDias = (d: number) =>
      estadoDePrueba({
        plan: "prueba",
        venceEn: vence,
        ahora: new Date(new Date(vence).getTime() - d * UN_DIA),
      });
    expect(enDias(DIAS_AVISO_PREVIO + 1).porVencer).toBe(false);
    expect(enDias(DIAS_AVISO_PREVIO).porVencer).toBe(true);
    expect(enDias(1).porVencer).toBe(true);
    // Vencida ya no es «por vencer»: son dos correos distintos.
    expect(estadoDePrueba({ plan: "prueba", venceEn: vence, ahora: new Date(vence) }).porVencer)
      .toBe(false);
  });
});

describe("nadie se queda cortado por sorpresa", () => {
  it("un negocio en prueba SIN fecha guardada no está vencido", () => {
    // Los que se dieron de alta antes de que esto existiera tienen
    // `vence_en: null`. No están vencidos: están sin corte. Tratarlos
    // como vencidos sería apagarles el programa de un día para otro por
    // un cambio de código — que es exactamente lo que no se hace acá.
    const e = estadoDePrueba({ plan: "prueba", venceEn: null });
    expect(e.esPrueba).toBe(false);
    expect(e.vencida).toBe(false);
    expect(e.diasRestantes).toBeNull();
    expect(textoRestante(e)).toBeNull();
  });

  it("un paquete de PAGO con fecha vieja no se marca como prueba vencida", () => {
    // Un complemento de cortesía con vencimiento (DURACIONES, addons.ts)
    // vence por su cuenta, pero no es una prueba y no debe pintar la
    // pantalla de «se terminaron tus 14 días».
    const e = estadoDePrueba({
      plan: "impulso",
      venceEn: "2020-01-01T00:00:00.000Z",
    });
    expect(e.esPrueba).toBe(false);
    expect(e.vencida).toBe(false);
  });

  it("un plan retirado nunca cae en la cuenta regresiva", () => {
    for (const id of ["gratis", "basico", "empresa"] as const) {
      const e = estadoDePrueba({ plan: id, venceEn: "2020-01-01T00:00:00.000Z" });
      expect(e.esPrueba, id).toBe(false);
      expect(e.vencida, id).toBe(false);
    }
  });

  it("una fecha ilegible no apaga a nadie", () => {
    const e = estadoDePrueba({ plan: "prueba", venceEn: "no-es-una-fecha" });
    expect(e.vencida).toBe(false);
    expect(e.esPrueba).toBe(false);
  });
});

describe("textoRestante", () => {
  it("escribe el singular sin «1 días»", () => {
    const vence = finDePrueba("prueba", ALTA)!;
    const aUnDia = new Date(new Date(vence).getTime() - 1.2 * UN_DIA);
    expect(textoRestante(estadoDePrueba({ plan: "prueba", venceEn: vence, ahora: aUnDia })))
      .toBe("Te queda 1 día de prueba");
  });
});
