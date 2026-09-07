import { describe, expect, it } from "vitest";
import { eventoDe, resumenGlobal, resumenPorAutomatizacion } from "./datos";
import type { EventoIg } from "./tipos";

function ev(parte: Partial<EventoIg>): EventoIg {
  return eventoDe({
    id: "e",
    negocio_id: "n",
    cuenta_id: "c",
    comentario_id: "1",
    resultado: "enviado",
    dm_enviado: true,
    creado_en: "2026-09-07T10:00:00Z",
    ...parte,
  });
}

describe("las estadísticas", () => {
  const eventos: EventoIg[] = [
    ev({ automatizacion_id: "a", creado_en: "2026-09-07T10:00:00Z" }),
    ev({ automatizacion_id: "a", publica_enviada: true, creado_en: "2026-09-07T11:00:00Z" }),
    ev({ automatizacion_id: "a", resultado: "error", dm_enviado: false, error_codigo: "rate_limit", creado_en: "2026-09-07T09:00:00Z" }),
    ev({ automatizacion_id: "a", resultado: "limite", dm_enviado: false }),
    ev({ automatizacion_id: "b", resultado: "omitido", dm_enviado: false }),
    ev({ automatizacion_id: null, resultado: "sin_coincidencia", dm_enviado: false }),
  ];

  it("por automatización: comentarios, coincidencias, DMs, públicas, errores, tasa y última actividad", () => {
    const m = resumenPorAutomatizacion(eventos);
    expect(m.get("a")).toEqual({ comentarios: 4, coincidencias: 4, dms: 2, publicas: 1, errores: 2, tasaExito: 50, ultimaActividad: "2026-09-07T11:00:00Z" });
    expect(m.get("b")).toEqual({ comentarios: 1, coincidencias: 1, dms: 0, publicas: 0, errores: 0, tasaExito: 0, ultimaActividad: "2026-09-07T10:00:00Z" });
    expect(m.has("null")).toBe(false);
  });

  it("global: cuenta también los que no coincidieron, y la tasa es DMs sobre coincidencias", () => {
    const g = resumenGlobal(eventos);
    expect(g.comentarios).toBe(6);
    expect(g.coincidencias).toBe(5);
    expect(g.dms).toBe(2);
    expect(g.tasaExito).toBe(40);
  });

  it("sin coincidencias la tasa es null, no 0 ni NaN", () => {
    expect(resumenGlobal([ev({ resultado: "sin_coincidencia", dm_enviado: false, automatizacion_id: null })]).tasaExito).toBeNull();
    expect(resumenGlobal([]).tasaExito).toBeNull();
  });

  it("eventoDe sanea: un código de error desconocido cae a null y los booleanos son estrictos", () => {
    const e = eventoDe({ id: 1, negocio_id: "n", cuenta_id: "c", comentario_id: 5, error_codigo: "cualquier_cosa", dm_enviado: "true", creado_en: "x" });
    expect(e.error_codigo).toBeNull();
    expect(e.dm_enviado).toBe(false);
    expect(e.comentario_id).toBe("5");
  });
});
