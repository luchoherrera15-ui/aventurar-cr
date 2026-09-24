import { describe, expect, it } from "vitest";
import {
  destinoEnDominioPropio,
  destinoEnLinksy,
  esApex,
  esHostLinksy,
  esHostPropio,
  instruccionesDns,
  normalizarDominio,
  PREFIJOS_BOOKEA,
  RUTAS_LINKSY,
  urlBookea,
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
  it("linksy.lat y celebrar.lat también son nuestros: ningún negocio puede reclamarlos", () => {
    expect(esHostPropio("linksy.lat", "https://www.bookea.lat")).toBe(true);
    expect(esHostPropio("celebrar.lat", "https://www.bookea.lat")).toBe(true);
    expect(esHostPropio("www.celebrar.lat", "https://www.bookea.lat")).toBe(true);
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
    expect(destinoEnLinksy("/")).toEqual({ tipo: "rewrite", pathname: "/solutions" });
    expect(destinoEnLinksy("/pizza-lucia")).toEqual({ tipo: "rewrite", pathname: "/s/pizza-lucia" });
    expect(destinoEnLinksy("/pizza-lucia/")).toEqual({ tipo: "rewrite", pathname: "/s/pizza-lucia" });
    expect(destinoEnLinksy("/pizza-lucia/menu")).toEqual({ tipo: "rewrite", pathname: "/s/pizza-lucia/menu" });
  });

  it("el alta y el login van a bookea.lat, donde vive la sesión", () => {
    expect(destinoEnLinksy("/crear")).toEqual({ tipo: "bookea", pathname: "/solutions/crear" });
    expect(destinoEnLinksy("/entrar")).toEqual({ tipo: "bookea", pathname: "/solutions/login" });
    // Lo que la gente escribe de verdad: mismo destino.
    expect(destinoEnLinksy("/login")).toEqual({ tipo: "bookea", pathname: "/solutions/login" });
    // Repetir el nombre del producto en su propio dominio no lleva a
    // ningún lado: la landing es la raíz.
    expect(destinoEnLinksy("/linksy")).toEqual({ tipo: "redirect", pathname: "/" });
  });

  /**
   * LA REGRESIÓN DEL ESTRENO (7 sep 2026). Los links de la landing y las
   * redirecciones del alta son relativos al mundo de Bookea; pedidos en
   * linksy.lat caían en un slug inexistente o en un 404.
   */
  it("todo el mundo con sesión de Bookea se manda allá con su ruta intacta", () => {
    expect(destinoEnLinksy("/solutions/crear")).toEqual({ tipo: "bookea", pathname: "/solutions/crear" });
    expect(destinoEnLinksy("/solutions/panel/abc")).toEqual({ tipo: "bookea", pathname: "/solutions/panel/abc" });
    expect(destinoEnLinksy("/cuenta")).toEqual({ tipo: "bookea", pathname: "/cuenta" });
    expect(destinoEnLinksy("/linksy/login")).toEqual({ tipo: "bookea", pathname: "/linksy/login" });
    expect(destinoEnLinksy("/lealtad/panel")).toEqual({ tipo: "bookea", pathname: "/lealtad/panel" });
    expect(destinoEnLinksy("/auth/callback")).toEqual({ tipo: "bookea", pathname: "/auth/callback" });
  });

  it("urlBookea arma la absoluta con el sitio del entorno, o bookea.lat por defecto", () => {
    expect(urlBookea("/solutions/crear")).toMatch(/^https:\/\/[^/]+\/solutions\/crear$/);
    expect(urlBookea("cuenta")).toMatch(/\/cuenta$/);
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
    // Cualquier cosa bajo /crear es el alta: se manda a bookea.lat.
    expect(destinoEnLinksy("/crear/algo")).toEqual({ tipo: "bookea", pathname: "/solutions/crear" });
  });

  it("el resto de Bookea NO se sirve bajo linksy.lat: se manda a bookea.lat o cae en un slug", () => {
    // Lo que es del mundo con sesión va a bookea.lat con su ruta.
    expect(destinoEnLinksy("/lealtad")).toEqual({ tipo: "bookea", pathname: "/lealtad" });
    expect(destinoEnLinksy("/admin")).toEqual({ tipo: "bookea", pathname: "/admin" });
    // Una sección pública de Bookea que no está en la lista (`eventos`)
    // es un slug válido por forma: cae en /s/… y de ahí en notFound.
    // Lo importante es que NUNCA sirve la sección de Bookea bajo el
    // dominio de Linksy.
    expect(destinoEnLinksy("/eventos")).toEqual({ tipo: "rewrite", pathname: "/s/eventos" });
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
  it("cada prefijo de Bookea también: un negocio llamado «cuenta» taparía el login", () => {
    for (const p of PREFIJOS_BOOKEA) {
      expect(RESERVED_SLUGS.has(p), `falta "${p}" en RESERVED_SLUGS`).toBe(true);
    }
  });
});
