import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ERRORES,
  codigoDePostgres,
  error,
  exito,
  fallo,
  metodoNoPermitido,
  preflight,
  type CodigoError,
} from "./respuestas";

const ENTORNO = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SITE_URL: "https://bookea.lat",
} as unknown as NodeJS.ProcessEnv;

const ctx = { origen: "https://bookea.lat", entorno: ENTORNO };
const CODIGOS = Object.keys(ERRORES) as CodigoError[];

async function cuerpoDe(res: Response) {
  return (await res.json()) as { ok: boolean; codigo: string; mensaje: string };
}

describe("el catálogo de errores", () => {
  it("cubre todos los estados que el bloque exige", () => {
    const usados = new Set(CODIGOS.map((c) => ERRORES[c].http));
    for (const http of [400, 401, 403, 404, 405, 409, 410, 413, 422, 429, 500, 502, 503]) {
      expect(usados.has(http as never), `falta un código con HTTP ${http}`).toBe(true);
    }
  });

  it("cada mensaje está en español, no está vacío y no trae jerga técnica", () => {
    // Lo que NUNCA puede aparecer en un mensaje que ve una persona.
    const prohibidos = [
      "undefined",
      "null",
      "Error:",
      "supabase",
      "postgres",
      "r2_key",
      "cloudflare",
      "bucket",
      "token",
      "sql",
    ];
    for (const c of CODIGOS) {
      const m = ERRORES[c].mensaje;
      expect(m.length, c).toBeGreaterThan(5);
      for (const p of prohibidos) {
        expect(m.toLowerCase(), `${c} dice "${p}"`).not.toContain(p);
      }
    }
  });

  it("los mensajes no distinguen «no existe» de «no es tuyo»", () => {
    // Distinguirlos le confirmaría a quien prueba uuids cuáles son reales.
    expect(ERRORES["sin-permiso"].mensaje).toBe("No encontramos eso o no es tuyo.");
  });
});

describe("fallo()", () => {
  it("el cuerpo trae solo ok, codigo y mensaje", async () => {
    const { respuesta } = fallo("cupo-agotado", ctx);
    const c = await cuerpoDe(respuesta);
    expect(Object.keys(c).sort()).toEqual(["codigo", "mensaje", "ok"]);
    expect(c.ok).toBe(false);
    expect(respuesta.status).toBe(409);
  });

  it("el detalle técnico se devuelve APARTE y no entra en el cuerpo", async () => {
    const secreto = "r2_key=originals/x/y/z · service_role · 42501";
    const { respuesta, registro } = fallo("fallo-interno", ctx, secreto);
    expect(registro).toBe(secreto);
    expect(await respuesta.text()).not.toContain("originals");
  });

  it("sin registro, `registro` es null", () => {
    expect(fallo("sin-sesion", ctx).registro).toBeNull();
  });

  it("no hay forma de meter texto libre en el cuerpo", () => {
    // `fallo` recibe un CÓDIGO, no un mensaje: el tipo lo impide.
    // @ts-expect-error un mensaje libre no es un código del catálogo
    expect(() => fallo("se filtró la clave AKIA...", ctx)).toThrow();
  });
});

describe("cabeceras", () => {
  it("todas las respuestas son no-store, nosniff y sin referrer", async () => {
    for (const res of [error("sin-sesion", ctx), exito({ a: 1 }, ctx, 201)]) {
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
      expect(res.headers.get("Content-Type")).toContain("application/json");
    }
  });

  it("NUNCA se responde `*`, y siempre va Vary: Origin", () => {
    const propio = error("sin-sesion", ctx);
    expect(propio.headers.get("Access-Control-Allow-Origin")).toBe("https://bookea.lat");
    expect(propio.headers.get("Vary")).toBe("Origin");

    const ajeno = error("sin-sesion", { origen: "https://malicioso.example", entorno: ENTORNO });
    expect(ajeno.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(ajeno.headers.get("Vary")).toBe("Origin");
  });
});

describe("exito()", () => {
  it("201 para lo creado, 200 para lo reutilizado, y siempre ok:true", async () => {
    const creado = exito({ asset_id: "x" }, ctx, 201);
    expect(creado.status).toBe(201);
    expect((await creado.json()).ok).toBe(true);
    expect(exito({}, ctx).status).toBe(200);
  });
});

describe("preflight() y métodos", () => {
  it("204 al origen permitido, 403 al ajeno", () => {
    expect(preflight(ctx).status).toBe(204);
    expect(preflight({ origen: "https://malicioso.example", entorno: ENTORNO }).status).toBe(403);
    expect(preflight({ origen: null, entorno: ENTORNO }).status).toBe(403);
  });

  it("el preflight permitido cachea el resultado un rato", () => {
    expect(preflight(ctx).headers.get("Access-Control-Max-Age")).toBe("600");
  });

  it("405 trae Allow y el mismo cuerpo JSON que el resto", async () => {
    const res = metodoNoPermitido(ctx);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST, OPTIONS");
    expect((await cuerpoDe(res)).codigo).toBe("metodo-no-permitido");
  });
});

describe("codigoDePostgres()", () => {
  it("traduce los errcode que levantan las migraciones", () => {
    expect(codigoDePostgres("42501")).toBe("sin-permiso");
    expect(codigoDePostgres("0A000")).toBe("fuera-de-alcance");
    expect(codigoDePostgres("22023")).toBe("campos-invalidos");
    expect(codigoDePostgres("23503")).toBe("no-existe");
    expect(codigoDePostgres("23514")).toBe("no-existe");
    expect(codigoDePostgres("23505")).toBe("conflicto-solicitud");
  });

  it("lo desconocido, nulo o vacío cae en 500 — nunca en un éxito", () => {
    for (const c of ["XX000", "", null, undefined, "PGRST301"]) {
      expect(codigoDePostgres(c), String(c)).toBe("fallo-interno");
      expect(ERRORES[codigoDePostgres(c)].http).toBe(500);
    }
  });

  it("42501 es 403 y no 404: no se confirma si la entidad existe", () => {
    expect(ERRORES[codigoDePostgres("42501")].http).toBe(403);
  });
});
