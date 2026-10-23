import { describe, expect, it } from "vitest";
import { armarContextoCliente, resumirLedger, type FilaLedger } from "./contexto";
import { claveDeInactividad, claveDeTarea, dispara, esSelloDeBienvenida, type SnapshotDelEvento } from "./eventos";
import type { EventoImpulso, InfoPrograma } from "./tipos";

const CR = "America/Costa_Rica";
let n = 0;
const fila = (extra: Partial<FilaLedger> & { tipo: string; puntos: number; created_at: string }): FilaLedger => ({
  id: `f${++n}`,
  referencia: null,
  reversion_de: null,
  ...extra,
});

describe("resumirLedger", () => {
  it("un cliente sin movimientos", () => {
    expect(resumirLedger([], CR)).toEqual({ saldo: 0, visitas: 0, canjes: 0, ultimaActividad: null });
  });

  it("el saldo es la suma de todo; las visitas, solo lo que hizo el cliente", () => {
    const r = resumirLedger(
      [
        fila({ tipo: "ganado", puntos: 1, created_at: "2026-10-01T15:00:00Z", referencia: "bienvenida:m1" }),
        fila({ tipo: "ganado", puntos: 1, created_at: "2026-10-05T15:00:00Z" }),
        fila({ tipo: "ganado", puntos: 1, created_at: "2026-10-10T15:00:00Z" }),
      ],
      CR,
    );
    expect(r.saldo).toBe(3);
    expect(r.visitas).toBe(2); // el sello de regalo no es una visita
    expect(r.ultimaActividad).toBe("2026-10-10");
  });

  it("el sello de bienvenida solo no cuenta como actividad (quien solo recibió el regalo nunca «vino»)", () => {
    const r = resumirLedger([fila({ tipo: "ganado", puntos: 1, created_at: "2026-10-01T15:00:00Z", referencia: "bienvenida:m1" })], CR);
    expect(r.visitas).toBe(0);
    expect(r.ultimaActividad).toBeNull();
  });

  it("una reversión anula el movimiento original: ni cuenta como visita ni como última actividad", () => {
    const original = fila({ tipo: "ganado", puntos: 1, created_at: "2026-10-12T15:00:00Z" });
    const r = resumirLedger(
      [
        fila({ tipo: "ganado", puntos: 1, created_at: "2026-10-05T15:00:00Z" }),
        original,
        fila({ tipo: "ajuste", puntos: -1, created_at: "2026-10-13T15:00:00Z", reversion_de: original.id }),
      ],
      CR,
    );
    expect(r.saldo).toBe(1);
    expect(r.visitas).toBe(1);
    expect(r.ultimaActividad).toBe("2026-10-05");
  });

  it("un canje cuenta como actividad y como canje", () => {
    const r = resumirLedger(
      [
        fila({ tipo: "ganado", puntos: 5, created_at: "2026-10-01T15:00:00Z" }),
        fila({ tipo: "canjeado", puntos: -5, created_at: "2026-10-15T15:00:00Z" }),
      ],
      CR,
    );
    expect(r.canjes).toBe(1);
    expect(r.saldo).toBe(0);
    expect(r.ultimaActividad).toBe("2026-10-15");
  });

  it("el día es el de la zona del negocio, no el de UTC", () => {
    // 03:00 UTC del 21 = 21:00 del 20 en Costa Rica
    const r = resumirLedger([fila({ tipo: "ganado", puntos: 1, created_at: "2026-10-21T03:00:00Z" })], CR);
    expect(r.ultimaActividad).toBe("2026-10-20");
  });

  it("una fila con datos raros no rompe el resumen", () => {
    const r = resumirLedger([fila({ tipo: "ganado", puntos: Number.NaN, created_at: "no-es-fecha" })], CR);
    expect(r.saldo).toBe(0);
  });
});

describe("armarContextoCliente", () => {
  const info: InfoPrograma = {
    programaId: "p",
    ranchoId: "r",
    nombrePrograma: "Sellos",
    nombreNegocio: "Café",
    modo: "sellos",
    zona: CR,
    opera: true,
    esFoorkie: false,
    meta: 5,
    recompensa: "Café gratis",
    cuentaId: null,
  };
  const ledger = { saldo: 3, visitas: 3, canjes: 0, ultimaActividad: "2026-10-01" };

  it("cuenta los días sin venir y la antigüedad en la zona del negocio", () => {
    // 15:00 UTC del 21 = 09:00 del 21 en CR
    const c = armarContextoCliente(info, { nombreCompleto: "MARÍA LÓPEZ", creadoEn: "2026-09-01T15:00:00Z", plataformas: ["google", "apple"] }, ledger, new Date("2026-10-21T15:00:00Z"));
    expect(c.nombre).toBe("María");
    expect(c.diasSinActividad).toBe(20);
    expect(c.antiguedadDias).toBe(50);
    expect(c.plataformas).toEqual(["google", "apple"]);
    expect(c.meta).toBe(5);
  });

  it("quien nunca vino no tiene «días sin venir»", () => {
    const c = armarContextoCliente(info, { nombreCompleto: null, creadoEn: "2026-10-20T15:00:00Z", plataformas: [] }, { saldo: 0, visitas: 0, canjes: 0, ultimaActividad: null }, new Date("2026-10-21T15:00:00Z"));
    expect(c.diasSinActividad).toBeNull();
    expect(c.nombre).toBeNull();
  });

  it("descarta plataformas que no existen", () => {
    const c = armarContextoCliente(info, { nombreCompleto: "Ana", creadoEn: "2026-10-20T15:00:00Z", plataformas: ["huawei", "apple"] }, ledger, new Date("2026-10-21T15:00:00Z"));
    expect(c.plataformas).toEqual(["apple"]);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  QUÉ HECHO DISPARA QUÉ IMPULSO
// ═══════════════════════════════════════════════════════════════════

const ev = (extra: Partial<EventoImpulso> = {}): EventoImpulso => ({
  id: "e1",
  rancho_id: "r",
  programa_id: "p",
  miembro_id: "m",
  tipo: "ledger_ganado",
  clave: "tx:1",
  ocurrido_en: "2026-10-21T15:00:00Z",
  datos: {},
  intentos: 0,
  ...extra,
});
const snap = (extra: Partial<SnapshotDelEvento> = {}): SnapshotDelEvento => ({ modo: "sellos", meta: 5, visitasHastaElHecho: 3, ...extra });
const imp = (activador: string, activador_config = {}, activado_en: string | null = null) => ({ activador, activador_config, activado_en });

describe("dispara", () => {
  it("recompensa_alcanzada solo al CRUZAR la meta (no en cada sello de más)", () => {
    const i = imp("recompensa_alcanzada");
    expect(dispara(i, ev({ datos: { saldo_anterior: 4, saldo_posterior: 5 } }), snap())).toBe(true);
    expect(dispara(i, ev({ datos: { saldo_anterior: 5, saldo_posterior: 6 } }), snap())).toBe(false);
    expect(dispara(i, ev({ datos: { saldo_anterior: 3, saldo_posterior: 4 } }), snap())).toBe(false);
  });

  it("recompensa_alcanzada sin el saldo anterior no arriesga (no sabe si ya la había cruzado)", () => {
    expect(dispara(imp("recompensa_alcanzada"), ev({ datos: { saldo_posterior: 5 } }), snap())).toBe(false);
  });

  it("meta_proxima con «faltan 2»", () => {
    const i = imp("meta_proxima", { faltan: 2 });
    expect(dispara(i, ev({ datos: { saldo_anterior: 2, saldo_posterior: 3 } }), snap())).toBe(true);
    expect(dispara(i, ev({ datos: { saldo_anterior: 3, saldo_posterior: 4 } }), snap())).toBe(false);
  });

  it("sin recompensa configurada no hay «cerca» ni «alcanzó»", () => {
    const datos = { saldo_anterior: 3, saldo_posterior: 4 };
    expect(dispara(imp("meta_proxima"), ev({ datos }), snap({ meta: null }))).toBe(false);
    expect(dispara(imp("recompensa_alcanzada"), ev({ datos }), snap({ meta: null }))).toBe(false);
  });

  it("el sello de regalo de bienvenida no es una visita ni un «recibe un sello»", () => {
    const datos = { saldo_anterior: 0, saldo_posterior: 1, referencia: "bienvenida:m" };
    expect(esSelloDeBienvenida(ev({ datos }))).toBe(true);
    expect(dispara(imp("primera_visita"), ev({ datos }), snap({ visitasHastaElHecho: 0 }))).toBe(false);
    expect(dispara(imp("sello_registrado"), ev({ datos }), snap())).toBe(false);
  });

  it("primera_visita solo si es la visita número uno", () => {
    expect(dispara(imp("primera_visita"), ev(), snap({ visitasHastaElHecho: 1 }))).toBe(true);
    expect(dispara(imp("primera_visita"), ev(), snap({ visitasHastaElHecho: 2 }))).toBe(false);
  });

  it("sello_registrado: en cada sello, o solo en los elegidos", () => {
    const datos = { saldo_anterior: 2, saldo_posterior: 3 };
    expect(dispara(imp("sello_registrado"), ev({ datos }), snap())).toBe(true);
    expect(dispara(imp("sello_registrado", { sellos: [3, 5] }), ev({ datos }), snap())).toBe(true);
    expect(dispara(imp("sello_registrado", { sellos: [4] }), ev({ datos }), snap())).toBe(false);
  });

  it("los activadores respetan el tipo de tarjeta", () => {
    expect(dispara(imp("sello_registrado"), ev(), snap({ modo: "puntos" }))).toBe(false);
    expect(dispara(imp("puntos_acumulados"), ev(), snap({ modo: "sellos" }))).toBe(false);
    expect(dispara(imp("puntos_acumulados"), ev(), snap({ modo: "cashback" }))).toBe(true);
  });

  it("cada tipo de hecho dispara solo lo suyo", () => {
    expect(dispara(imp("inscripcion"), ev({ tipo: "inscripcion" }), snap())).toBe(true);
    expect(dispara(imp("inscripcion"), ev({ tipo: "ledger_ganado" }), snap())).toBe(false);
    expect(dispara(imp("pase_apple"), ev({ tipo: "pase_apple" }), snap())).toBe(true);
    expect(dispara(imp("canje_realizado"), ev({ tipo: "ledger_canjeado" }), snap())).toBe(true);
    expect(dispara(imp("canje_realizado"), ev({ tipo: "ledger_ganado" }), snap())).toBe(false);
  });

  it("activadores que no se pueden cumplir hoy nunca disparan", () => {
    for (const id of ["cumpleanos", "pase_google", "vencimiento_proximo", "nivel_alcanzado", "no_existe"]) {
      expect(dispara(imp(id), ev({ tipo: "inscripcion" }), snap())).toBe(false);
    }
  });

  it("nada retroactivo: un impulso activado después del hecho no lo toma", () => {
    expect(dispara(imp("inscripcion", {}, "2026-10-22T00:00:00Z"), ev({ tipo: "inscripcion" }), snap())).toBe(false);
    expect(dispara(imp("inscripcion", {}, "2026-10-21T00:00:00Z"), ev({ tipo: "inscripcion" }), snap())).toBe(true);
  });
});

describe("claves", () => {
  it("la clave de una tarea y la de una ausencia", () => {
    expect(claveDeTarea({ tipo: "ledger_ganado", clave: "tx:9" })).toBe("ledger_ganado:tx:9");
    expect(claveDeInactividad("m1", "2026-09-15")).toBe("inactivo:m1:2026-09-15");
  });
});
