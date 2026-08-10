import { describe, expect, it } from "vitest";
import {
  ENTIDADES_3_1A,
  LIMITE_POR_ENTIDAD,
  MIMES_3_1A,
  PENDIENTES_FUERA_DE_3_1A,
  esEntidadPiloto,
  esMimePiloto,
  limiteDe,
  mimesPendientes,
  revisarAlcance,
} from "./alcance";
import { ENTIDADES, MIMES_PERMITIDOS } from "./tipos";

describe("el alcance del piloto", () => {
  it("son tres entidades y seis MIME", () => {
    expect(ENTIDADES_3_1A).toEqual(["rancho", "rancho_item", "equipo"]);
    expect(MIMES_3_1A).toHaveLength(6);
    expect(MIMES_3_1A.every((m) => m.startsWith("image/"))).toBe(true);
  });

  it("los límites son 8 / 1 / 1", () => {
    expect(LIMITE_POR_ENTIDAD).toEqual({ rancho: 8, rancho_item: 1, equipo: 1 });
    expect(limiteDe("rancho")).toBe(8);
    expect(limiteDe("equipo")).toBe(1);
  });

  it("el piloto es un SUBCONJUNTO de lo que el sistema conoce", () => {
    for (const e of ENTIDADES_3_1A) expect(ENTIDADES).toContain(e);
    for (const m of MIMES_3_1A) expect(MIMES_PERMITIDOS).toContain(m);
  });

  it("cada entidad fuera del piloto tiene su razón escrita", () => {
    const fuera = ENTIDADES.filter((e) => !esEntidadPiloto(e));
    expect(fuera.sort()).toEqual(["album", "comprobante", "invitacion", "verificacion"]);
    for (const e of fuera) {
      expect(PENDIENTES_FUERA_DE_3_1A[e as keyof typeof PENDIENTES_FUERA_DE_3_1A].length)
        .toBeGreaterThan(10);
    }
  });

  it("los 6 MIME pendientes son los de video y audio", () => {
    expect(mimesPendientes()).toHaveLength(6);
    expect(mimesPendientes().every((m) => !esMimePiloto(m))).toBe(true);
  });
});

describe("revisarAlcance — 400 y 422 no son lo mismo", () => {
  it("lo habilitado pasa", () => {
    const r = revisarAlcance("rancho", "image/jpeg");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entidad).toBe("rancho");
  });

  it("tolera el charset pegado al MIME", () => {
    const r = revisarAlcance("equipo", "image/PNG; charset=binary");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mime).toBe("image/png");
  });

  it("entidad que NO existe → 400", () => {
    for (const e of ["ranchos", "", null, 42, "Rancho"]) {
      const r = revisarAlcance(e, "image/jpeg");
      expect(r.ok, String(e)).toBe(false);
      if (!r.ok) {
        expect(r.http).toBe(400);
        expect(r.motivo).toBe("entidad-desconocida");
      }
    }
  });

  it("entidad que existe pero NO está habilitada → 422", () => {
    for (const e of ["album", "invitacion", "comprobante", "verificacion"]) {
      const r = revisarAlcance(e, "image/jpeg");
      expect(r.ok, e).toBe(false);
      if (!r.ok) {
        expect(r.http).toBe(422);
        expect(r.motivo).toBe("entidad-no-habilitada");
      }
    }
  });

  it("MIME que NO existe → 400", () => {
    const r = revisarAlcance("rancho", "application/zip");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.http).toBe(400);
      expect(r.motivo).toBe("mime-desconocido");
    }
  });

  it("MIME que existe pero NO está habilitado → 422", () => {
    for (const m of mimesPendientes()) {
      const r = revisarAlcance("rancho", m);
      expect(r.ok, m).toBe(false);
      if (!r.ok) {
        expect(r.http).toBe(422);
        expect(r.motivo).toBe("mime-no-habilitado");
      }
    }
  });

  it("la entidad se revisa ANTES que el MIME", () => {
    // Con los dos mal, manda el de la entidad: es el error más de fondo.
    const r = revisarAlcance("album", "video/mp4");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("entidad-no-habilitada");
  });

  it("ningún mensaje filtra detalles internos", () => {
    for (const [e, m] of [
      ["album", "image/jpeg"],
      ["rancho", "video/mp4"],
      ["nada", "image/jpeg"],
    ] as const) {
      const r = revisarAlcance(e, m);
      if (!r.ok) {
        expect(r.mensaje).not.toContain("media_assets");
        expect(r.mensaje).not.toContain("r2");
        expect(r.mensaje.length).toBeLessThan(80);
      }
    }
  });
});
