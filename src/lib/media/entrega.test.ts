import { describe, expect, it } from "vitest";
import { VARIANTE_CANONICA, urlDeEntrega } from "./entrega";

const BASE = "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g";

describe("urlDeEntrega", () => {
  it("arma la URL canónica con la variante que no recorta", () => {
    expect(VARIANTE_CANONICA).toBe("gallery");
    expect(urlDeEntrega(`${BASE}/`, "abc123456789")).toBe(`${BASE}/abc123456789/gallery`);
  });

  it("no duplica barras ni arrastra espacios de la variable de entorno", () => {
    expect(urlDeEntrega(`  ${BASE}//  `, "abc123456789")).toBe(`${BASE}/abc123456789/gallery`);
    expect(urlDeEntrega(BASE, "abc123456789")).toBe(`${BASE}/abc123456789/gallery`);
  });
});
