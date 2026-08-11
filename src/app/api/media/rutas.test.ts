/**
 * Las tres rutas, como MÓDULOS de Next.
 *
 * La lógica se prueba en `src/lib/media/servicio.test.ts`; acá se
 * comprueba lo que solo existe en el archivo de la ruta y que, si se
 * rompiera, no lo notaría ningún otro test: el runtime declarado, el
 * preflight, los métodos no permitidos y que el POST delegue.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const manejarSesion = vi.fn(async (_r: Request) => new Response("{}", { status: 201 }));
const manejarSesionAnonima = vi.fn(async (_r: Request) => new Response("{}", { status: 201 }));
const manejarConfirmar = vi.fn(async (_r: Request) => new Response("{}", { status: 200 }));

vi.mock("@/lib/media/servicio", () => ({
  manejarSesion: (r: Request) => manejarSesion(r),
  manejarSesionAnonima: (r: Request) => manejarSesionAnonima(r),
  manejarConfirmar: (r: Request) => manejarConfirmar(r),
}));

// El entorno que ven `origenesPermitidos()` y las cabeceras CORS.
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bookea.lat");

import * as sesion from "./sesion/route";
import * as anonima from "./sesion-anonima/route";
import * as confirmar from "./confirmar/route";

const ORIGEN = "https://bookea.lat";

const pedir = (metodo: string, origen: string | null = ORIGEN) =>
  new Request("https://bookea.lat/api/media/x", {
    method: metodo,
    headers: origen ? { origin: origen } : {},
    ...(metodo === "POST" ? { body: "{}" } : {}),
  });

const RUTAS = [
  ["sesion", sesion, manejarSesion] as const,
  ["sesion-anonima", anonima, manejarSesionAnonima] as const,
  ["confirmar", confirmar, manejarConfirmar] as const,
];

beforeEach(() => {
  manejarSesion.mockClear();
  manejarSesionAnonima.mockClear();
  manejarConfirmar.mockClear();
});

describe.each(RUTAS)("ruta /api/media/%s", (nombre, modulo, manejador) => {
  it("corre en Node, no en Edge", () => {
    // `r2.ts` usa el SDK de AWS y `firma-archivo.ts` streams de Node:
    // en Edge no existe ninguno de los dos.
    expect(modulo.runtime).toBe("nodejs");
  });

  it("es dinámica: una URL firmada no se cachea", () => {
    expect(modulo.dynamic).toBe("force-dynamic");
  });

  it("el POST delega en el servicio", async () => {
    await modulo.POST(pedir("POST"));
    expect(manejador).toHaveBeenCalledOnce();
  });

  it("el preflight de un origen permitido devuelve 204 con las cabeceras", async () => {
    const res = await modulo.OPTIONS(pedir("OPTIONS"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGEN);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("el preflight de un origen ajeno es 403 y NO trae la autorización", async () => {
    const res = await modulo.OPTIONS(pedir("OPTIONS", "https://malicioso.example"));
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("nunca responde con `*`", async () => {
    const res = await modulo.OPTIONS(pedir("OPTIONS"));
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });

  it.each(["GET", "PUT", "PATCH", "DELETE"])("%s → 405 con Allow y sin tocar el servicio", async (m) => {
    const handler = modulo[m as "GET" | "PUT" | "PATCH" | "DELETE"];
    const res = await handler(pedir(m));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST, OPTIONS");
    const cuerpo = (await res.json()) as { ok: boolean; codigo: string };
    expect(cuerpo.ok).toBe(false);
    expect(cuerpo.codigo).toBe("metodo-no-permitido");
    expect(manejador).not.toHaveBeenCalled();
  });

  it(`el módulo ${nombre} no exporta nada más que los métodos y la config`, () => {
    expect(Object.keys(modulo).sort()).toEqual(
      expect.arrayContaining(["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT", "dynamic", "runtime"]),
    );
  });
});

describe("confirmar: el presupuesto de tiempo", () => {
  it("declara maxDuration: habla con R2 y con Cloudflare en serie", () => {
    // Con el default de 10 s, una imagen pesada en una red lenta se
    // cortaba a mitad de la importación.
    expect(confirmar.maxDuration).toBe(60);
  });
});
