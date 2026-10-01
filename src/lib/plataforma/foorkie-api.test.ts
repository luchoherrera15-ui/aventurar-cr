import { describe, expect, it } from "vitest";
import { armarTarjeta, firmarLinkPase, leerLinkPase, linksDelMiembro, VIDA_LINK_PASE_MS } from "./foorkie-api";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const MIEMBRO = "0b6c0b8e-4f1e-4d5a-9a43-2b1f3c4d5e6f";

describe("links al Wallet (foorkie-api)", () => {
  it("un link firmado se lee de vuelta con su miembro y billetera", () => {
    const ahora = 1_800_000_000_000;
    const token = firmarLinkPase({ m: MIEMBRO, w: "apple", e: ahora + 60_000 }, SECRETO);
    expect(leerLinkPase(token, SECRETO, ahora)).toEqual({ m: MIEMBRO, w: "apple", e: ahora + 60_000 });
  });

  it("vencido, con otra llave o tocado, no vale", () => {
    const ahora = 1_800_000_000_000;
    const token = firmarLinkPase({ m: MIEMBRO, w: "google", e: ahora + 60_000 }, SECRETO);
    expect(leerLinkPase(token, SECRETO, ahora + 61_000)).toBeNull();
    expect(leerLinkPase(token, "otra-llave", ahora)).toBeNull();
    const [datos, firma] = token.split(".");
    const otro = Buffer.from(JSON.stringify({ m: MIEMBRO, w: "apple", e: ahora + 60_000 })).toString("base64url");
    expect(leerLinkPase(`${otro}.${firma}`, SECRETO, ahora)).toBeNull();
    expect(leerLinkPase(`${datos}.`, SECRETO, ahora)).toBeNull();
    expect(leerLinkPase("basura", SECRETO, ahora)).toBeNull();
    expect(leerLinkPase("", SECRETO, ahora)).toBeNull();
  });

  it("un miembro que no es uuid o una billetera rara no pasan aunque la firma sea buena", () => {
    const ahora = 1_800_000_000_000;
    const raro = firmarLinkPase({ m: "no-es-uuid", w: "apple", e: ahora + 60_000 }, SECRETO);
    expect(leerLinkPase(raro, SECRETO, ahora)).toBeNull();
  });

  it("los dos links del miembro vencen a los 30 minutos y apuntan a la ruta del pase", () => {
    const ahora = 1_800_000_000_000;
    const l = linksDelMiembro("https://www.bookea.lat/", MIEMBRO, SECRETO, ahora);
    expect(l.apple.startsWith("https://www.bookea.lat/api/plataforma/foorkie/pase?t=")).toBe(true);
    expect(l.google.startsWith("https://www.bookea.lat/api/plataforma/foorkie/pase?t=")).toBe(true);
    expect(l.vence).toBe(new Date(ahora + VIDA_LINK_PASE_MS).toISOString());
    const t = decodeURIComponent(l.google.split("t=")[1]);
    expect(leerLinkPase(t, SECRETO, ahora)?.w).toBe("google");
  });
});

describe("armarTarjeta (foorkie-api)", () => {
  const links = { apple: "a", google: "g", vence: "v" };

  it("sellos: «5 de 10» y el texto del pase", () => {
    const t = armarTarjeta({
      miembroId: MIEMBRO,
      fila: { id: "p1", rancho_id: "r1", nombre: "Tarjeta", modo: "sellos", estado: "activo", activo: true },
      negocio: "Pura Prueba",
      saldo: 5,
      meta: { nombre: "Un matcha gratis", costo_puntos: 10 },
      links,
    });
    expect(t.modo).toBe("sellos");
    expect(t.progreso).toEqual({ actual: 5, total: 10 });
    expect(t.textos.encabezado).toEqual({ label: "SELLOS", value: "5/10" });
    expect(t.textos.detalle.value).toBe("Te faltan 5 sellos");
    expect(t.diseno.colorFondo).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("cashback: saldo en colones y sin progreso de sellos", () => {
    const t = armarTarjeta({
      miembroId: MIEMBRO,
      fila: {
        id: "p2",
        rancho_id: "r2",
        nombre: "Cashback",
        modo: "cashback",
        estado: "activo",
        activo: true,
        beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null },
        pase_color_fondo: "#1B2A6B",
        pase_color_sello: "#FCB700",
      },
      negocio: "Donde Prueba",
      saldo: 1250,
      meta: null,
      links,
    });
    expect(t.modo).toBe("cashback");
    expect(t.progreso).toBeNull();
    expect(t.textos.encabezado.label).toBe("SALDO");
    expect(t.diseno).toMatchObject({ colorFondo: "#1B2A6B", colorSello: "#FCB700" });
    expect(t.wallet).toBe(links);
  });
});
