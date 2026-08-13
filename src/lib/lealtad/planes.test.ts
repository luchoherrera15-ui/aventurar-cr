import { describe, expect, it } from "vitest";
import {
  definicionDe,
  esPlan,
  estadoDelLimite,
  PLANES,
  PLANES_ID,
  puede,
  type Capacidad,
} from "./planes";

describe("esPlan", () => {
  it("acepta los tres y rechaza cualquier otra cosa", () => {
    for (const p of PLANES_ID) expect(esPlan(p)).toBe(true);
    expect(esPlan(null)).toBe(false);
    expect(esPlan("premium")).toBe(false);
    // Los nombres que se barajaron y quedaron fuera no valen: si
    // alguno hubiera llegado a la base, el check de la 0124 lo habría
    // rechazado.
    expect(esPlan("semilla")).toBe(false);
    expect(esPlan("cosecha")).toBe(false);
    expect(esPlan("elite")).toBe(false);
  });
});

describe("los planes crecen", () => {
  it("cada plan incluye todo lo del anterior", () => {
    // Se escriben completos en vez de heredar, así que un olvido al
    // agregar una capacidad nueva se ve acá y no en producción.
    for (let i = 1; i < PLANES_ID.length; i++) {
      const menor = PLANES[PLANES_ID[i - 1]].capacidades;
      const mayor = PLANES[PLANES_ID[i]].capacidades;
      for (const cap of menor) expect(mayor).toContain(cap);
    }
  });

  it("el tope de miembros sube con el plan", () => {
    expect(PLANES.basico.limiteMiembros).toBe(500);
    expect(PLANES.estandar.limiteMiembros).toBe(2500);
    expect(PLANES.enterprise.limiteMiembros).toBe(5000);
    for (let i = 1; i < PLANES_ID.length; i++) {
      expect(PLANES[PLANES_ID[i - 1]].limiteMiembros!).toBeLessThan(
        PLANES[PLANES_ID[i]].limiteMiembros!,
      );
    }
  });
});

describe("puede", () => {
  it("Básico tiene tarjeta pero no lo que se cobra aparte", () => {
    expect(puede("basico", "wallet")).toBe(true);
    expect(puede("basico", "notificaciones")).toBe(false);
    expect(puede("basico", "cercania")).toBe(false);
    expect(puede("basico", "segmentacion")).toBe(false);
    expect(puede("basico", "niveles")).toBe(false);
  });

  it("Estándar suma notificaciones, referidos y segmentación", () => {
    expect(puede("estandar", "notificaciones")).toBe(true);
    expect(puede("estandar", "referidos")).toBe(true);
    expect(puede("estandar", "segmentacion")).toBe(true);
    // La cercanía se reserva para el plan alto: es la que más devuelve
    // gente al local.
    expect(puede("estandar", "cercania")).toBe(false);
  });

  it("Enterprise trae la cercanía, los niveles y la API", () => {
    expect(puede("enterprise", "cercania")).toBe(true);
    expect(puede("enterprise", "niveles")).toBe(true);
    expect(puede("enterprise", "api")).toBe(true);
    expect(puede("enterprise", "prepago")).toBe(true);
  });

  it("sin plan no puede nada", () => {
    for (const cap of PLANES.enterprise.capacidades) {
      expect(puede(null, cap)).toBe(false);
    }
  });

  it("un complemento regalado abre una capacidad sin subir de plan", () => {
    expect(puede("basico", "cercania")).toBe(false);
    expect(puede("basico", "cercania", ["pases_cercania"])).toBe(true);
  });

  it("un complemento de otra cosa no abre la capacidad pedida", () => {
    expect(puede("basico", "cercania", ["pases_niveles", "agenda_ia"])).toBe(false);
  });

  it("un complemento NO puede quitar lo que el plan incluye", () => {
    // Apagar un add-on por error no debe degradar a quien pagó el plan.
    expect(puede("enterprise", "cercania", [])).toBe(true);
  });

  it("un plan inventado no concede nada", () => {
    expect(puede("premium", "wallet" as Capacidad)).toBe(false);
  });
});

describe("estadoDelLimite", () => {
  it("cuenta lo que queda", () => {
    const e = estadoDelLimite("basico", 120);
    expect(e).toMatchObject({ limite: 500, disponibles: 380, lleno: false, cerca: false });
  });

  it("avisa ANTES de toparse, al 90%", () => {
    expect(estadoDelLimite("basico", 449).cerca).toBe(false);
    expect(estadoDelLimite("basico", 450).cerca).toBe(true);
    // Enterarse cuando ya no entra nadie es enterarse tarde.
    expect(estadoDelLimite("basico", 450).lleno).toBe(false);
  });

  it("marca lleno justo en el tope, no después", () => {
    expect(estadoDelLimite("estandar", 2499).lleno).toBe(false);
    expect(estadoDelLimite("estandar", 2500).lleno).toBe(true);
  });

  it("pasado el tope no muestra disponibles negativos", () => {
    const e = estadoDelLimite("basico", 800);
    expect(e.disponibles).toBe(0);
    expect(e.lleno).toBe(true);
  });

  it("sin plan no hay tope declarado", () => {
    expect(estadoDelLimite(null, 10).limite).toBeNull();
  });
});

describe("definicionDe", () => {
  it("devuelve null para lo que no es plan", () => {
    expect(definicionDe(null)).toBeNull();
    // "gratis" ERA el ejemplo de plan inexistente… hasta que se volvió
    // un plan real (0131). El impostor de turno es otro.
    expect(definicionDe("premium")).toBeNull();
    expect(definicionDe("gratis")?.limiteMiembros).toBe(5);
    expect(definicionDe("gratis")?.precioMensual).toBe(0);
    expect(definicionDe("enterprise")?.nombre).toBe("Enterprise");
  });
});
