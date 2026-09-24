import { afterEach, describe, expect, it } from "vitest";
import { urlLinksy } from "./dominios";

const original = process.env.NEXT_PUBLIC_LINKSY_URL;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_LINKSY_URL;
  else process.env.NEXT_PUBLIC_LINKSY_URL = original;
});

describe("urlLinksy", () => {
  it("sin la variable, la portada servida desde bookea.lat", () => {
    delete process.env.NEXT_PUBLIC_LINKSY_URL;
    expect(urlLinksy()).toBe("/solutions");
  });

  it("con la variable, la raíz de linksy.lat (sin barras dobles)", () => {
    process.env.NEXT_PUBLIC_LINKSY_URL = "https://linksy.lat/";
    expect(urlLinksy()).toBe("https://linksy.lat/");
    process.env.NEXT_PUBLIC_LINKSY_URL = "  https://linksy.lat  ";
    expect(urlLinksy()).toBe("https://linksy.lat/");
  });

  it("una variable vacía cuenta como ausente", () => {
    process.env.NEXT_PUBLIC_LINKSY_URL = "   ";
    expect(urlLinksy()).toBe("/solutions");
  });
});
