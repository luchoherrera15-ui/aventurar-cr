import { describe, expect, it } from "vitest";
import {
  conPrefijo,
  destinoDentroDeCelebrar,
  destinoEnCelebrar,
  esHostCelebrar,
  esRutaDeCelebrar,
  hayDominioPropio,
  prefijoParaHost,
  sinPrefijo,
  sitioCelebrar,
  urlPublicaCelebrar,
} from "./dominios";
import { esSlugDeCelebracionValido, PREFIJO_CELEBRAR, RUTA, SEGMENTOS_SISTEMA } from "./rutas";
import { RESERVED_SLUGS } from "@/lib/slug";

describe("esHostCelebrar", () => {
  it("reconoce el dominio propio con y sin www, con puerto y en mayúsculas", () => {
    expect(esHostCelebrar("celebrar.lat")).toBe(true);
    expect(esHostCelebrar("www.celebrar.lat")).toBe(true);
    expect(esHostCelebrar("CELEBRAR.LAT:443")).toBe(true);
  });
  it("no confunde a Bookea, Linksy, localhost ni subdominios ajenos", () => {
    expect(esHostCelebrar("bookea.lat")).toBe(false);
    expect(esHostCelebrar("www.bookea.lat")).toBe(false);
    expect(esHostCelebrar("linksy.lat")).toBe(false);
    expect(esHostCelebrar("localhost:3100")).toBe(false);
    expect(esHostCelebrar("app.celebrar.lat")).toBe(false);
    expect(esHostCelebrar("celebrar.lat.evil.com")).toBe(false);
    expect(esHostCelebrar(null)).toBe(false);
  });
});

describe("prefijo por host", () => {
  it("en el dominio propio no hay prefijo; en Bookea es /celebrar", () => {
    expect(prefijoParaHost("celebrar.lat")).toBe("");
    expect(prefijoParaHost("www.bookea.lat")).toBe(PREFIJO_CELEBRAR);
    expect(prefijoParaHost("localhost:3100")).toBe(PREFIJO_CELEBRAR);
  });
  it("conPrefijo arma rutas navegables en los dos mundos", () => {
    expect(conPrefijo("/", "/celebrar")).toBe("/celebrar");
    expect(conPrefijo("/", "")).toBe("/");
    expect(conPrefijo("/app", "/celebrar")).toBe("/celebrar/app");
    expect(conPrefijo("/app", "")).toBe("/app");
    expect(conPrefijo("app", "/celebrar")).toBe("/celebrar/app");
    expect(conPrefijo("/#precios", "/celebrar")).toBe("/celebrar#precios");
    expect(conPrefijo("/#precios", "")).toBe("/#precios");
  });
  it("sinPrefijo deja la ruta comparable entre hosts", () => {
    expect(sinPrefijo("/celebrar")).toBe("/");
    expect(sinPrefijo("/celebrar/")).toBe("/");
    expect(sinPrefijo("/celebrar/app/creditos")).toBe("/app/creditos");
    expect(sinPrefijo("/app/creditos")).toBe("/app/creditos");
    expect(sinPrefijo("/celebrarx")).toBe("/celebrarx");
  });
  it("esRutaDeCelebrar no se deja engañar por prefijos parecidos", () => {
    expect(esRutaDeCelebrar("/celebrar")).toBe(true);
    expect(esRutaDeCelebrar("/celebrar/app")).toBe(true);
    expect(esRutaDeCelebrar("/celebraciones")).toBe(false);
    expect(esRutaDeCelebrar("/cuenta")).toBe(false);
  });
});

describe("destinoEnCelebrar (peticiones que llegan por celebrar.lat)", () => {
  it("la raíz es la portada", () => {
    expect(destinoEnCelebrar("/")).toEqual({ tipo: "rewrite", pathname: "/celebrar" });
    expect(destinoEnCelebrar("")).toEqual({ tipo: "rewrite", pathname: "/celebrar" });
  });
  it("las rutas del producto se sirven con el prefijo, invisible para el navegador", () => {
    expect(destinoEnCelebrar("/app")).toEqual({ tipo: "rewrite", pathname: "/celebrar/app" });
    expect(destinoEnCelebrar("/app/creditos/")).toEqual({
      tipo: "rewrite",
      pathname: "/celebrar/app/creditos",
    });
    expect(destinoEnCelebrar("/entrar")).toEqual({ tipo: "rewrite", pathname: "/celebrar/entrar" });
    expect(destinoEnCelebrar("/maria-y-juan")).toEqual({
      tipo: "rewrite",
      pathname: "/celebrar/maria-y-juan",
    });
  });
  it("el aterrizaje del login vive dentro del producto", () => {
    expect(destinoEnCelebrar("/auth/callback")).toEqual({
      tipo: "rewrite",
      pathname: "/celebrar/auth/callback",
    });
  });
  it("bajo el dominio propio la URL canónica no lleva el prefijo", () => {
    expect(destinoEnCelebrar("/celebrar")).toEqual({ tipo: "redirect", pathname: "/" });
    expect(destinoEnCelebrar("/celebrar/app")).toEqual({ tipo: "redirect", pathname: "/app" });
  });
  it("deja pasar la API, los assets y los archivos con extensión", () => {
    expect(destinoEnCelebrar("/api/celebrar/rsvp")).toEqual({ tipo: "pasar" });
    expect(destinoEnCelebrar("/_next/static/x.js")).toEqual({ tipo: "pasar" });
    expect(destinoEnCelebrar("/robots.txt")).toEqual({ tipo: "pasar" });
    expect(destinoEnCelebrar("/favicon.ico")).toEqual({ tipo: "pasar" });
  });
  it("Bookea no se sirve bajo celebrar.lat: cae en el 404 del producto", () => {
    // `/mi-negocio` se reescribe a `/celebrar/mi-negocio`, que no existe.
    expect(destinoEnCelebrar("/mi-negocio")).toEqual({
      tipo: "rewrite",
      pathname: "/celebrar/mi-negocio",
    });
  });
});

describe("la URL pública y el interruptor del estreno", () => {
  it("sin la variable, todo cuelga de Bookea con el prefijo", () => {
    expect(sitioCelebrar("")).toBe("https://www.bookea.lat/celebrar");
    expect(sitioCelebrar(undefined)).toBe("https://www.bookea.lat/celebrar");
    expect(hayDominioPropio("")).toBe(false);
    expect(urlPublicaCelebrar("/", "")).toBe("https://www.bookea.lat/celebrar");
    expect(urlPublicaCelebrar("/maria-y-juan", "")).toBe(
      "https://www.bookea.lat/celebrar/maria-y-juan",
    );
    expect(urlPublicaCelebrar("/#precios", "")).toBe("https://www.bookea.lat/celebrar#precios");
  });
  it("con la variable, el dominio propio manda (y se tolera la barra final)", () => {
    expect(sitioCelebrar("https://celebrar.lat/")).toBe("https://celebrar.lat");
    expect(hayDominioPropio("https://celebrar.lat")).toBe(true);
    expect(urlPublicaCelebrar("/", "https://celebrar.lat")).toBe("https://celebrar.lat");
    expect(urlPublicaCelebrar("/maria-y-juan", "https://celebrar.lat")).toBe(
      "https://celebrar.lat/maria-y-juan",
    );
    expect(urlPublicaCelebrar("app", "https://celebrar.lat")).toBe("https://celebrar.lat/app");
  });
});

describe("destinoDentroDeCelebrar (el ?next del login)", () => {
  const ORIGEN = "https://www.bookea.lat";
  it("en Bookea solo acepta rutas que arranquen con /celebrar", () => {
    expect(destinoDentroDeCelebrar("/celebrar/app/creditos", "/celebrar", ORIGEN)).toBe(
      "/celebrar/app/creditos",
    );
    expect(destinoDentroDeCelebrar("/cuenta", "/celebrar", ORIGEN)).toBe("/celebrar/app");
    expect(destinoDentroDeCelebrar("/celebraciones", "/celebrar", ORIGEN)).toBe("/celebrar/app");
  });
  it("en celebrar.lat cualquier ruta interna es del producto", () => {
    expect(destinoDentroDeCelebrar("/app/creditos", "", "https://celebrar.lat")).toBe(
      "/app/creditos",
    );
    expect(destinoDentroDeCelebrar(null, "", "https://celebrar.lat")).toBe("/app");
  });
  it("cierra el open redirect y el bucle al propio login", () => {
    expect(destinoDentroDeCelebrar("//evil.com", "/celebrar", ORIGEN)).toBe("/celebrar/app");
    expect(destinoDentroDeCelebrar("https://evil.com/celebrar", "/celebrar", ORIGEN)).toBe(
      "/celebrar/app",
    );
    expect(destinoDentroDeCelebrar("/celebrar/entrar", "/celebrar", ORIGEN)).toBe("/celebrar/app");
    expect(destinoDentroDeCelebrar("/entrar/recuperar", "", "https://celebrar.lat")).toBe("/app");
    expect(destinoDentroDeCelebrar("", "/celebrar", ORIGEN)).toBe("/celebrar/app");
  });
});

describe("slugs de celebración vs. rutas del sistema", () => {
  it("cada ruta del producto tiene su primer segmento reservado", () => {
    for (const ruta of Object.values(RUTA)) {
      const primero = ruta.replace(/^\/#?/, "").split("/")[0];
      if (!primero) continue;
      expect(SEGMENTOS_SISTEMA.has(primero), `falta reservar «${primero}» (de ${ruta})`).toBe(
        true,
      );
    }
  });
  it("un slug de sistema nunca es un slug de celebración válido", () => {
    expect(esSlugDeCelebracionValido("maria-y-juan")).toBe(true);
    expect(esSlugDeCelebracionValido("xv-de-valeria-2027")).toBe(true);
    expect(esSlugDeCelebracionValido("app")).toBe(false);
    expect(esSlugDeCelebracionValido("admin")).toBe(false);
    expect(esSlugDeCelebracionValido("Maria")).toBe(false);
    expect(esSlugDeCelebracionValido("ab")).toBe(false);
    expect(esSlugDeCelebracionValido("-mal")).toBe(false);
  });
  it("Bookea reserva «celebrar» para que ningún negocio lo reclame como su ficha", () => {
    expect(RESERVED_SLUGS.has("celebrar")).toBe(true);
  });
});
