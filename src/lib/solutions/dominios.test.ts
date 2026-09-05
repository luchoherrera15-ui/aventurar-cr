import { describe, expect, it } from "vitest";
import { destinoEnDominioPropio, esApex, esHostPropio, instruccionesDns, normalizarDominio } from "./dominios";

describe("normalizarDominio", () => {
  it("limpia esquema, ruta, puerto, punto final y mayúsculas", () => {
    expect(normalizarDominio("  HTTPS://Menu.CasaNostra.com/algo?x=1 ")).toBe("menu.casanostra.com");
    expect(normalizarDominio("casanostra.com.")).toBe("casanostra.com");
    expect(normalizarDominio("casanostra.com:443")).toBe("casanostra.com");
  });
  it("rechaza lo que no es un dominio", () => {
    expect(normalizarDominio("casanostra")).toBeNull();
    expect(normalizarDominio("casa nostra.com")).toBeNull();
    expect(normalizarDominio("-mal.com")).toBeNull();
    expect(normalizarDominio("")).toBeNull();
  });
});

describe("esHostPropio", () => {
  it("bookea, localhost y vercel.app son nuestros; el resto no", () => {
    expect(esHostPropio("bookea.lat", "https://www.bookea.lat")).toBe(true);
    expect(esHostPropio("www.bookea.lat", "https://www.bookea.lat")).toBe(true);
    expect(esHostPropio("localhost:3100", "https://www.bookea.lat")).toBe(true);
    expect(esHostPropio("aventurar-cr-git-x.vercel.app", "https://www.bookea.lat")).toBe(true);
    expect(esHostPropio("casanostra.com", "https://www.bookea.lat")).toBe(false);
  });
  it("un NEXT_PUBLIC_SITE_URL roto no vuelve ajeno a ningún host nuestro", () => {
    expect(esHostPropio("bookea.lat", "no es una url")).toBe(true);
    expect(esHostPropio("casanostra.com", "no es una url")).toBe(false);
  });
});

describe("esApex / instruccionesDns", () => {
  it("dominio pelado: registro A y el www por CNAME", () => {
    expect(esApex("casanostra.com")).toBe(true);
    expect(instruccionesDns("casanostra.com")).toEqual([
      { tipo: "A", nombre: "@", valor: "76.76.21.21" },
      { tipo: "CNAME", nombre: "www", valor: "cname.vercel-dns.com" },
    ]);
  });
  it("subdominio: un solo CNAME con el nombre del subdominio", () => {
    expect(esApex("menu.casanostra.com")).toBe(false);
    expect(instruccionesDns("menu.casanostra.com")).toEqual([{ tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" }]);
  });
  it("entiende los .co.cr: tienda.co.cr es apex, menu.tienda.co.cr no", () => {
    expect(esApex("tienda.co.cr")).toBe(true);
    expect(instruccionesDns("menu.tienda.co.cr")).toEqual([{ tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" }]);
  });
});

describe("destinoEnDominioPropio", () => {
  it("la raíz es la página y /menu es el menú", () => {
    expect(destinoEnDominioPropio("/", "casa")).toEqual({ tipo: "rewrite", pathname: "/s/casa" });
    expect(destinoEnDominioPropio("/menu", "casa")).toEqual({ tipo: "rewrite", pathname: "/s/casa/menu" });
    expect(destinoEnDominioPropio("/menu/", "casa")).toEqual({ tipo: "rewrite", pathname: "/s/casa/menu" });
  });
  it("lo que ya viene como /s/<slug> pasa, y el resto del sitio vuelve a la raíz", () => {
    expect(destinoEnDominioPropio("/s/casa/menu", "casa")).toEqual({ tipo: "pasar" });
    expect(destinoEnDominioPropio("/api/x", "casa")).toEqual({ tipo: "pasar" });
    expect(destinoEnDominioPropio("/lealtad", "casa")).toEqual({ tipo: "redirect", pathname: "/" });
    expect(destinoEnDominioPropio("/s/otro", "casa")).toEqual({ tipo: "redirect", pathname: "/" });
  });
});
