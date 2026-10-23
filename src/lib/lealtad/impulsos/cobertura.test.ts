import { describe, expect, it } from "vitest";
import { hayImpulsoQueReemplazaAlHito, impulsoReemplazaAlHito } from "./cobertura";
import { normalizarEntrada, validarImpulso } from "./validacion";
import { PLANTILLAS } from "./preconfigurados";
import type { SupabaseClient } from "@supabase/supabase-js";

const activo = (activador: string, canal = "correo", config = {}) => ({ activador, activador_config: config, canal, estado: "activo" });

describe("impulsoReemplazaAlHito", () => {
  it("cada correo antiguo tiene su equivalente", () => {
    expect(impulsoReemplazaAlHito(activo("primera_visita"), "bienvenida")).toBe(true);
    expect(impulsoReemplazaAlHito(activo("recompensa_alcanzada"), "premio")).toBe(true);
    expect(impulsoReemplazaAlHito(activo("meta_proxima"), "falta_uno")).toBe(true);
    expect(impulsoReemplazaAlHito(activo("meta_proxima", "correo", { faltan: 1 }), "falta_uno")).toBe(true);
  });

  it("«faltan 2» no reemplaza al correo de «te falta 1»: el cliente se quedaría sin ese aviso", () => {
    expect(impulsoReemplazaAlHito(activo("meta_proxima", "correo", { faltan: 2 }), "falta_uno")).toBe(false);
  });

  it("solo reemplaza un impulso ACTIVO y POR CORREO", () => {
    expect(impulsoReemplazaAlHito({ ...activo("primera_visita"), estado: "pausado" }, "bienvenida")).toBe(false);
    expect(impulsoReemplazaAlHito({ ...activo("primera_visita"), estado: "borrador" }, "bienvenida")).toBe(false);
    expect(impulsoReemplazaAlHito(activo("primera_visita", "wallet"), "bienvenida")).toBe(false);
  });

  it("un disparador distinto no reemplaza nada", () => {
    expect(impulsoReemplazaAlHito(activo("inscripcion"), "bienvenida")).toBe(false);
    expect(impulsoReemplazaAlHito(activo("sello_registrado"), "falta_uno")).toBe(false);
  });
});

describe("hayImpulsoQueReemplazaAlHito", () => {
  function dbCon(resultado: { data: unknown; error: unknown } | "lanza") {
    // select().eq().eq().eq() → el último eq devuelve la promesa
    let n = 0;
    const encadenado: Record<string, unknown> = {
      select: () => encadenado,
      eq: () => {
        n += 1;
        if (n < 3) return encadenado;
        return resultado === "lanza" ? Promise.reject(new Error("boom")) : Promise.resolve(resultado);
      },
    };
    return { from: () => encadenado } as unknown as SupabaseClient;
  }

  it("true cuando hay uno activo que cubre el hito", async () => {
    const db = dbCon({ data: [activo("recompensa_alcanzada")], error: null });
    expect(await hayImpulsoQueReemplazaAlHito(db, "p", "premio")).toBe(true);
  });

  it("false cuando no hay ninguno que lo cubra", async () => {
    const db = dbCon({ data: [activo("inscripcion")], error: null });
    expect(await hayImpulsoQueReemplazaAlHito(db, "p", "premio")).toBe(false);
  });

  it("ante un error de la base (o tabla inexistente) responde que no: el correo de siempre sale", async () => {
    expect(await hayImpulsoQueReemplazaAlHito(dbCon({ data: null, error: { code: "42P01" } }), "p", "premio")).toBe(false);
    expect(await hayImpulsoQueReemplazaAlHito(dbCon("lanza"), "p", "premio")).toBe(false);
  });
});

describe("el aviso en el editor", () => {
  const ctx = { modo: "sellos", esFoorkie: false, tieneRecompensa: true, hoy: "2026-10-21" };
  const base = PLANTILLAS.find((p) => p.id === "primera_visita")!.entrada("sellos");

  it("avisa cuando un correo toma el relevo del correo antiguo", () => {
    const r = validarImpulso(normalizarEntrada({ ...base, canal: "correo" }), ctx);
    expect(r.avisos.some((a) => /reemplaza al correo automático/.test(a))).toBe(true);
  });

  it("no avisa por Wallet ni en una tarjeta de Foorkie", () => {
    expect(validarImpulso(normalizarEntrada({ ...base, canal: "wallet" }), ctx).avisos.some((a) => /reemplaza/.test(a))).toBe(false);
    expect(validarImpulso(normalizarEntrada({ ...base, canal: "correo" }), { ...ctx, esFoorkie: true }).avisos.some((a) => /reemplaza/.test(a))).toBe(false);
  });
});
