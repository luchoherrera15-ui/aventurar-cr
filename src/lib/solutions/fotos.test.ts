import { describe, expect, it } from "vitest";
import { conVariante, esUrlDeCloudflare, urlDeEntrega } from "./fotos";

const BASE = "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g";

describe("las fotos de Cloudflare", () => {
  it("reconoce una URL de entrega de nuestra cuenta", () => {
    expect(esUrlDeCloudflare(`${BASE}/2cdc28f0-017a-49c4-9ed7-87056c83901d/gallery`, BASE)).toBe(true);
    expect(esUrlDeCloudflare(`${BASE}/2cdc28f0-017a-49c4-9ed7-87056c83901d/gallery`)).toBe(true);
  });
  it("rechaza otro hash, otro host, http o una ruta rara", () => {
    expect(esUrlDeCloudflare("https://imagedelivery.net/otrohash1234/2cdc28f0-017a-49c4/gallery", BASE)).toBe(false);
    expect(esUrlDeCloudflare("https://evil.com/X6xhTJPyvf9Jhtws4_jH8g/id12345678/gallery", BASE)).toBe(false);
    expect(esUrlDeCloudflare(`http://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/id12345678/gallery`)).toBe(false);
    expect(esUrlDeCloudflare(`${BASE}/id12345678`)).toBe(false);
    expect(esUrlDeCloudflare("")).toBe(false);
  });
  it("cambia la variante y deja en paz lo que no es de Cloudflare", () => {
    const url = `${BASE}/2cdc28f0-017a-49c4-9ed7-87056c83901d/gallery`;
    expect(conVariante(url, "thumb")).toBe(`${BASE}/2cdc28f0-017a-49c4-9ed7-87056c83901d/thumb`);
    const supa = "https://x.supabase.co/storage/v1/object/public/solutions-fotos/a/b.jpg";
    expect(conVariante(supa, "thumb")).toBe(supa);
    expect(conVariante(null, "thumb")).toBeNull();
  });
  it("arma la URL canónica", () => {
    expect(urlDeEntrega(`${BASE}/`, "abc123456789")).toBe(`${BASE}/abc123456789/gallery`);
  });
});
