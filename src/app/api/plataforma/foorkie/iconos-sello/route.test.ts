import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ICONOS_SELLO, ICONOS_SELLO_ID } from "@/lib/lealtad/iconos-sello";
import { POST } from "./route";

/**
 * POST /api/plataforma/foorkie/iconos-sello — el catálogo del selector de
 * Foorkie: los doce, en orden, con los MISMOS trazos que dibuja el pase, y
 * detrás de la misma firma que las demás rutas de la puerta.
 */

const SECRETO = "secreto-de-prueba-de-la-puerta";

function firmado(texto: string, secreto = SECRETO): Request {
  const t = Date.now();
  const v1 = createHmac("sha256", secreto).update(`${t}.${texto}`).digest("hex");
  return new Request("https://www.bookea.lat/api/plataforma/foorkie/iconos-sello", {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

describe("iconos-sello", () => {
  it("los doce, en el orden del catálogo, con sus trazos y el viewBox 24", async () => {
    const r = await POST(firmado("{}"));
    expect(r.status).toBe(200);
    const c = (await r.json()) as { ok: boolean; viewBox: string; trazo: unknown; iconos: { id: string; nombre: string; trazos: string[]; viewBox: string }[] };
    expect(c.ok).toBe(true);
    expect(c.viewBox).toBe("0 0 24 24");
    expect(c.trazo).toEqual({ grosor: 1.8, puntas: "round", uniones: "round" });
    expect(c.iconos.map((i) => i.id)).toEqual([...ICONOS_SELLO_ID]);
    for (const i of c.iconos) {
      expect(i).toEqual({ id: i.id, nombre: ICONOS_SELLO[i.id as keyof typeof ICONOS_SELLO].nombre, trazos: [...ICONOS_SELLO[i.id as keyof typeof ICONOS_SELLO].trazos], viewBox: "0 0 24 24" });
    }
  });

  it("sin la firma de Foorkie, no", async () => {
    expect((await POST(firmado("{}", "otra-llave"))).status).toBe(401);
  });
});
