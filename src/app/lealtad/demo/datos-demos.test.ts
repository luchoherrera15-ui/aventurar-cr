import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEMOS } from "./datos-demos";

/**
 * Cuatro demos apuntaban a `/lealtad/plantillas/franjas/…`, que salió de
 * `public/` el 30 ago 2026 cuando el banco de franjas se mudó a
 * Cloudflare Images: la foto quedó rota en producción y no lo notó ni el
 * build ni ninguna prueba. Esta sí lo nota.
 */
describe("las fotos del catálogo de demos", () => {
  it("son una URL https o un archivo que existe en public/", () => {
    for (const [tipo, demo] of Object.entries(DEMOS)) {
      if (!demo.foto) continue;
      if (demo.foto.startsWith("/")) {
        expect(existsSync(path.join(process.cwd(), "public", demo.foto)), `${tipo}: ${demo.foto}`).toBe(true);
      } else {
        expect(demo.foto, tipo).toMatch(/^https:\/\//);
      }
    }
  });
});
