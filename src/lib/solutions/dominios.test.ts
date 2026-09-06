import { describe, expect, it } from "vitest";
import {
  destinoEnDominioPropio,
  destinoEnLinksy,
  esApex,
  esHostLinksy,
  esHostPropio,
  instruccionesDns,
  normalizarDominio,
  RUTAS_LINKSY,
} from "./dominios";
import { RESERVED_SLUGS } from "@/lib/slug";

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

describe("esHostLinksy", () => {
  it("linksy.lat y su www, con o sin puerto", () => {
    expect(esHostLinksy("linksy.lat")).toBe(true);
    expect(esHostLinksy("www.linksy.lat")).toBe(true);
    expect(esHostLinksy("LINKSY.LAT:443")).toBe(true);
  });
  it("no se confunde con un dominio parecido", () => {
    expect(esHostLinksy("linksy.lat.evil.com")).toBe(false);
    expect(esHostLinksy("milinksy.lat")).toBe(false);
    expect(esHostLinksy("bookea.lat")).toBe(false);
    expect(esHostLinksy("")).toBe(false);
  });
});

describe("linksy.lat es NUESTRO, y por eso nadie lo puede reclamar", () => {
  /**
   * Esta es la prueba del riesgo 1 de la auditoría. `guardarDominio`
   * rechaza todo lo que `esHostPropio` reconozca; si esto se pusiera
   * en false, un negocio cualquiera podría guardar `linksy.lat` como
   * su dominio propio y quedarse con la raíz del producto.
   */
  it("esHostPropio lo reconoce, con www y sin www", () => {
    expect(esHostPropio("linksy.lat", "https://www.bookea.lat")).toBe(true);
    expect(esHostPropio("www.linksy.lat", "https://www.bookea.lat")).toBe(true);
  });
  it("y lo sigue reconociendo aunque NEXT_PUBLIC_SITE_URL esté rota", () => {
    expect(esHostPropio("linksy.lat", "no es una url")).toBe(true);
    expect(esHostPropio("linksy.lat", undefined)).toBe(true);
  });
});

describe("destinoEnLinksy", () => {
  it("la raíz es la landing y el slug es la página del negocio", () => {
    expect(destinoEnLinksy("/")).toEqual({ tipo: "rewrite", pathname: "/linksy" });
    expect(destinoEnLinksy("/pizza-lucia")).toEqual({ tipo: "rewrite", pathname: "/s/pizza-lucia" });
    expect(destinoEnLinksy("/pizza-lucia/")).toEqual({ tipo: "rewrite", pathname: "/s/pizza-lucia" });
    expect(destinoEnLinksy("/pizza-lucia/menu")).toEqual({ tipo: "rewrite", pathname: "/s/pizza-lucia/menu" });
  });

  it("las tres rutas del producto", () => {
    expect(destinoEnLinksy("/crear")).toEqual({ tipo: "rewrite", pathname: "/solutions/crear" });
    expect(destinoEnLinksy("/entrar")).toEqual({ tipo: "login" });
    // Lo que la gente escribe de verdad: mismo destino.
    expect(destinoEnLinksy("/login")).toEqual({ tipo: "login" });
    // Repetir el nombre del producto en su propio dominio no lleva a
    // ningún lado: la landing es la raíz.
    expect(destinoEnLinksy("/linksy")).toEqual({ tipo: "redirect", pathname: "/" });
  });

  it("los archivos de la raíz pasan de largo: un slug nunca lleva punto", () => {
    expect(destinoEnLinksy("/robots.txt")).toEqual({ tipo: "pasar" });
    expect(destinoEnLinksy("/sitemap.xml")).toEqual({ tipo: "pasar" });
    expect(destinoEnLinksy("/favicon.ico")).toEqual({ tipo: "pasar" });
    expect(destinoEnLinksy("/api/visitas")).toEqual({ tipo: "pasar" });
    expect(destinoEnLinksy("/_next/static/x.js")).toEqual({ tipo: "pasar" });
    // Lo que ya viene resuelto a la ruta interna no se vuelve a tocar.
    expect(destinoEnLinksy("/s/pizza-lucia")).toEqual({ tipo: "pasar" });
  });

  it("una dirección mal escrita vuelve a la portada, no a una pared", () => {
    // Mayúsculas y caracteres que un slug no puede tener.
    expect(destinoEnLinksy("/Pizza_Lucia")).toEqual({ tipo: "redirect", pathname: "/" });
    expect(destinoEnLinksy("/a")).toEqual({ tipo: "redirect", pathname: "/" });
    // Una tercera rama bajo un negocio cae en su página, no en la raíz:
    // se pierde la ruta, no el negocio.
    expect(destinoEnLinksy("/pizza-lucia/algo/mas")).toEqual({ tipo: "redirect", pathname: "/pizza-lucia" });
    expect(destinoEnLinksy("/crear/algo")).toEqual({ tipo: "redirect", pathname: "/" });
  });

  it("el resto de Bookea NO se sirve bajo linksy.lat", () => {
    // `lealtad` y `eventos` son slugs válidos por forma, así que caen
    // en /s/… y de ahí en notFound. Lo importante es que NUNCA sirven
    // la sección de Bookea que lleva ese nombre.
    expect(destinoEnLinksy("/lealtad")).toEqual({ tipo: "rewrite", pathname: "/s/lealtad" });
    expect(destinoEnLinksy("/admin")).toEqual({ tipo: "rewrite", pathname: "/s/admin" });
  });
});

describe("las rutas de linksy.lat están reservadas contra las altas", () => {
  /**
   * Si estas dos listas se despegan, un negocio nuevo puede quedarse
   * con `linksy.lat/crear` y tapar el alta del producto. Es el tipo de
   * fallo que no rompe el build ni se ve hasta que pasa.
   */
  it("cada ruta de RUTAS_LINKSY está en RESERVED_SLUGS", () => {
    for (const ruta of RUTAS_LINKSY) {
      expect(RESERVED_SLUGS.has(ruta), `falta "${ruta}" en RESERVED_SLUGS`).toBe(true);
    }
  });
});
