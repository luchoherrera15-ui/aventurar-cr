import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearRepoSupabase } from "./repositorio";
import { MAX_INTENTOS_DE_EVENTO } from "./motor";

/**
 * Un cliente de Supabase de mentira que ANOTA qué se le pidió y contesta lo que la prueba le diga.
 * Prueba lo que el repositorio es: un adaptador. Qué tabla toca, con qué filtros, y qué hace con un error
 * (tiene que LANZAR: un error callado acá se vería como «no había nada que mandar»).
 */
type Respuesta = { data: unknown; error: { code?: string; message: string } | null };
type Llamada = { tabla: string; ops: [string, unknown[]][] };

function falso(respuestas: Record<string, Respuesta | ((l: Llamada) => Respuesta)> = {}) {
  const llamadas: Llamada[] = [];
  const responder = (l: Llamada): Respuesta => {
    const operacion = l.ops.find(([n]) => n === "update" || n === "insert")?.[0];
    const propia = operacion ? respuestas[`${l.tabla}:${operacion}`] : undefined;
    const r = propia ?? respuestas[l.tabla] ?? { data: [], error: null };
    return typeof r === "function" ? r(l) : r;
  };
  const db = {
    from(tabla: string) {
      const llamada: Llamada = { tabla, ops: [] };
      llamadas.push(llamada);
      const b: unknown = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") return (resolver: (r: Respuesta) => unknown) => resolver(responder(llamada));
            return (...args: unknown[]) => {
              llamada.ops.push([String(prop), args]);
              return b;
            };
          },
        },
      );
      return b;
    },
    rpc(nombre: string, args: unknown) {
      llamadas.push({ tabla: `rpc:${nombre}`, ops: [["args", [args]]] });
      const r = respuestas[`rpc:${nombre}`] ?? { data: [], error: null };
      return Promise.resolve(typeof r === "function" ? r({ tabla: `rpc:${nombre}`, ops: [] }) : r);
    },
  };
  return { db: db as unknown as SupabaseClient, llamadas };
}

const op = (l: Llamada, nombre: string) => l.ops.filter(([n]) => n === nombre).map(([, a]) => a);

describe("eventosPendientes", () => {
  it("lee solo los sin procesar, en orden de llegada", async () => {
    const { db, llamadas } = falso({ impulsos_eventos: { data: [{ id: "e1" }], error: null } });
    const r = await crearRepoSupabase(db).eventosPendientes(50);
    expect(r).toEqual([{ id: "e1" }]);
    expect(llamadas[0].tabla).toBe("impulsos_eventos");
    expect(op(llamadas[0], "is")).toEqual([["procesado_en", null]]);
    expect(op(llamadas[0], "limit")).toEqual([[50]]);
  });

  it("un error de la base LANZA (no se confunde con «no hay nada»)", async () => {
    const { db } = falso({ impulsos_eventos: { data: null, error: { message: "la base no contesta" } } });
    await expect(crearRepoSupabase(db).eventosPendientes(10)).rejects.toThrow(/eventos: la base no contesta/);
  });
});

describe("cerrarEvento", () => {
  it("sin error, lo marca procesado", async () => {
    const { db, llamadas } = falso();
    await crearRepoSupabase(db).cerrarEvento("e1");
    const u = op(llamadas[0], "update")[0][0] as Record<string, unknown>;
    expect(typeof u.procesado_en).toBe("string");
  });

  it("con error, suma un intento y lo deja pendiente hasta el tope", async () => {
    const { db, llamadas } = falso({ "impulsos_eventos": { data: { intentos: 1 }, error: null } });
    await crearRepoSupabase(db).cerrarEvento("e1", { error: "falló" });
    const u = op(llamadas[1], "update")[0][0] as Record<string, unknown>;
    expect(u.intentos).toBe(2);
    expect(u.error).toBe("falló");
    expect(u).not.toHaveProperty("procesado_en");
  });

  it("al llegar al tope de intentos lo da por perdido, para que un hecho roto no atasque la cola", async () => {
    const { db, llamadas } = falso({ impulsos_eventos: { data: { intentos: MAX_INTENTOS_DE_EVENTO - 1 }, error: null } });
    await crearRepoSupabase(db).cerrarEvento("e1", { error: "falló otra vez" });
    const u = op(llamadas[1], "update")[0][0] as Record<string, unknown>;
    expect(u.intentos).toBe(MAX_INTENTOS_DE_EVENTO);
    expect(typeof u.procesado_en).toBe("string");
  });

  it("recorta el texto del error (la columna admite 300)", async () => {
    const { db, llamadas } = falso({ impulsos_eventos: { data: { intentos: 0 }, error: null } });
    await crearRepoSupabase(db).cerrarEvento("e1", { error: "x".repeat(900) });
    const u = op(llamadas[1], "update")[0][0] as { error: string };
    expect(u.error).toHaveLength(300);
  });
});

describe("crearTarea", () => {
  const tarea = {
    impulso_id: "i",
    rancho_id: "r",
    programa_id: "p",
    miembro_id: "m",
    evento_id: "e",
    clave: "ledger_ganado:tx:1",
    canal: "wallet",
    ejecutar_en: "2026-10-21T15:05:00.000Z",
    estado: "programada" as const,
    version_impulso: 3,
  };

  it("crea la tarea", async () => {
    const { db, llamadas } = falso({ "impulsos_tareas:insert": { data: null, error: null } });
    expect(await crearRepoSupabase(db).crearTarea(tarea)).toBe("creada");
    const fila = op(llamadas[0], "insert")[0][0] as Record<string, unknown>;
    expect(fila).toMatchObject({ impulso_id: "i", clave: "ledger_ganado:tx:1", estado: "programada", motivo: null, detalle: null });
  });

  it("«ya existe» (23505) es la garantía antiduplicados, no un error", async () => {
    const { db } = falso({ "impulsos_tareas:insert": { data: null, error: { code: "23505", message: "duplicate key" } } });
    expect(await crearRepoSupabase(db).crearTarea(tarea)).toBe("duplicada");
  });

  it("cualquier otro error LANZA", async () => {
    const { db } = falso({ "impulsos_tareas:insert": { data: null, error: { code: "23503", message: "violates foreign key" } } });
    await expect(crearRepoSupabase(db).crearTarea(tarea)).rejects.toThrow(/crear tarea/);
  });
});

describe("la cola", () => {
  it("reclamarTareas llama a la función de la base con el límite y la hora", async () => {
    const { db, llamadas } = falso({ "rpc:impulsos_reclamar_tareas": { data: [{ id: "t1" }], error: null } });
    const ahora = new Date("2026-10-21T15:00:00Z");
    const r = await crearRepoSupabase(db).reclamarTareas(20, ahora);
    expect(r).toEqual([{ id: "t1" }]);
    expect(llamadas[0].tabla).toBe("rpc:impulsos_reclamar_tareas");
    expect(op(llamadas[0], "args")[0][0]).toEqual({ p_limite: 20, p_ahora: "2026-10-21T15:00:00.000Z" });
  });

  it("reclamarTareas lanza si la función falla", async () => {
    const { db } = falso({ "rpc:impulsos_reclamar_tareas": { data: null, error: { message: "no existe" } } });
    await expect(crearRepoSupabase(db).reclamarTareas(5, new Date())).rejects.toThrow(/reclamar tareas/);
  });

  it("actualizarTarea escribe los cambios y marca cuándo", async () => {
    const { db, llamadas } = falso();
    await crearRepoSupabase(db).actualizarTarea("t1", { estado: "enviada", enviada_en: "2026-10-21T15:00:00Z" });
    const u = op(llamadas[0], "update")[0][0] as Record<string, unknown>;
    expect(u).toMatchObject({ estado: "enviada", enviada_en: "2026-10-21T15:00:00Z" });
    expect(typeof u.updated_at).toBe("string");
    expect(op(llamadas[0], "eq")).toEqual([["id", "t1"]]);
  });

  it("enviosDelCliente cuenta solo lo que salió de verdad", async () => {
    const { db, llamadas } = falso({ impulsos_tareas: { data: [{ impulso_id: "i", enviada_en: "2026-10-21T10:00:00Z" }], error: null } });
    const r = await crearRepoSupabase(db).enviosDelCliente("m", new Date("2026-10-20T15:00:00Z"));
    expect(r).toHaveLength(1);
    expect(op(llamadas[0], "eq")).toEqual([
      ["miembro_id", "m"],
      ["estado", "enviada"],
    ]);
  });
});

describe("los barridos por tiempo", () => {
  it("revisa solo los impulsos de inactividad que llevan más de ~55 min sin escanearse", async () => {
    const { db, llamadas } = falso({ impulsos_lealtad: { data: [], error: null } });
    await crearRepoSupabase(db).impulsosParaEscanear(new Date("2026-10-21T15:00:00Z"));
    expect(op(llamadas[0], "in")).toEqual([["activador", ["inactividad"]]]);
    const [filtro] = op(llamadas[0], "or")[0] as [string];
    expect(filtro).toContain("ultimo_escaneo_en.is.null");
    expect(filtro).toContain("ultimo_escaneo_en.lt.2026-10-21T14:05:00.000Z");
  });

  it("inactivos pasa los parámetros a la función de la base y devuelve fechas AAAA-MM-DD", async () => {
    const { db, llamadas } = falso({
      "rpc:impulsos_inactivos": { data: [{ miembro_id: "m1", ultima_actividad: "2026-09-15T00:00:00+00:00" }], error: null },
    });
    const r = await crearRepoSupabase(db).inactivos("p", "2026-10-21", "America/Costa_Rica", 30, 37, 100);
    expect(r).toEqual([{ miembroId: "m1", ultima: "2026-09-15" }]);
    expect(op(llamadas[0], "args")[0][0]).toEqual({
      p_programa: "p",
      p_hoy: "2026-10-21",
      p_zona: "America/Costa_Rica",
      p_dias_min: 30,
      p_dias_max: 37,
      p_limite: 100,
    });
  });
});
