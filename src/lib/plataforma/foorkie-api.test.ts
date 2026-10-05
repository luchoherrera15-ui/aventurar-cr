import { describe, expect, it } from "vitest";
import {
  armarTarjeta,
  beneficioEditado,
  cambioElBeneficio,
  catalogoDeIconos,
  disenoGuardadoDeFila,
  firmarLinkPase,
  leerEdicionDeFoorkie,
  leerIconoSello,
  leerLinkPase,
  leerTira,
  leerUrlDeIcono,
  linksDelMiembro,
  selloEditado,
  tiraParaGuardar,
  VIDA_LINK_PASE_MS,
} from "./foorkie-api";
import { marcaDelPase } from "./foorkie-marca";
import { CONFIG_CLASICA } from "@/lib/wallet/layout-tira";
import { ICONOS_SELLO, ICONOS_SELLO_ID } from "@/lib/lealtad/iconos-sello";

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

  it("trae la vista del pase con el saldo de ESTE cliente y lo que su marca dice bajo el QR", () => {
    const fila = { id: "p1", rancho_id: "r1", nombre: "Tarjeta", modo: "sellos", estado: "activo", activo: true, pase_sello_icono: "cafe" };
    const meta = { nombre: "Un matcha gratis", costo_puntos: 10 };
    const deBookea = armarTarjeta({ miembroId: MIEMBRO, fila, negocio: "Pura Prueba", saldo: 7, meta, links });
    expect(deBookea.vista.saldo).toBe(7);
    expect(deBookea.vista.textos).toEqual(deBookea.textos);
    expect(deBookea.vista.tira).toMatchObject({ tipo: "sellos", total: 10, logrados: 7, sello: { clase: "icono", icono: "cafe" } });
    expect(deBookea.vista.pie).toBe("Powered by Bookea.lat");
    const deFoorkie = armarTarjeta({ miembroId: MIEMBRO, fila, negocio: "Pura Prueba", saldo: 7, meta, links, marca: marcaDelPase({ slug: "pura" }) });
    expect(deFoorkie.vista).toMatchObject({ marca: "foorkie", pie: "Foorkie Lealtad" });
  });
});

describe("editar la tarjeta desde Foorkie (foorkie-api)", () => {
  it("lee colores (en mayúscula), imágenes y beneficio; lo que no viene no se toca", () => {
    const r = leerEdicionDeFoorkie({
      colorFondo: "#1b2a6b",
      logoUrl: "https://x.supabase.co/storage/v1/object/public/foorkie_media/u/logo.png",
      bannerUrl: null,
      beneficio: { tipo: "cashback", porcentaje: 7.456 },
    });
    expect(r).toEqual({
      ok: true,
      edicion: {
        colorFondo: "#1B2A6B",
        logoUrl: "https://x.supabase.co/storage/v1/object/public/foorkie_media/u/logo.png",
        bannerUrl: null,
        beneficio: { tipo: "cashback", porcentaje: 7.46 },
      },
    });
    expect(r.ok && "colorSello" in r.edicion).toBe(false);
  });

  it("rechaza colores mal escritos, tipos que no se editan y pedidos vacíos", () => {
    expect(leerEdicionDeFoorkie({ colorSello: "rojo" })).toMatchObject({ ok: false });
    expect(leerEdicionDeFoorkie({ beneficio: { tipo: "giftcard", valor: 5000 } })).toMatchObject({ ok: false });
    expect(leerEdicionDeFoorkie({ beneficio: { tipo: "sellos", requeridos: "10" } })).toMatchObject({ ok: false });
    expect(leerEdicionDeFoorkie({})).toMatchObject({ ok: false });
    expect(leerEdicionDeFoorkie(null)).toMatchObject({ ok: false });
    expect(leerEdicionDeFoorkie([])).toMatchObject({ ok: false });
  });

  it("cashback: cambia el % y conserva la compra mínima y el tope", () => {
    const actual = { tipo: "cashback" as const, porcentaje: 5, compraMinima: 3000, topePorCompra: 2000 };
    const r = beneficioEditado(actual, "cashback", { tipo: "cashback", porcentaje: 8 });
    expect(r).toEqual({ ok: true, beneficio: { tipo: "cashback", porcentaje: 8, compraMinima: 3000, topePorCompra: 2000 } });
    expect(beneficioEditado(actual, "cashback", { tipo: "cashback", porcentaje: 0 })).toEqual({
      ok: false,
      motivo: "El cashback va de 1 a 100 por ciento.",
    });
  });

  it("sellos: cambia meta y regalía, conserva el resto y respeta las reglas de Bookea", () => {
    const actual = {
      tipo: "sellos" as const,
      requeridos: 10,
      recompensa: "Café",
      inicial: 2,
      repetible: true,
      sellosPor: "compra" as const,
      montoPorSello: null,
    };
    expect(beneficioEditado(actual, "sellos", { tipo: "sellos", requeridos: 8, recompensa: "Postre" })).toEqual({
      ok: true,
      beneficio: { ...actual, requeridos: 8, recompensa: "Postre" },
    });
    expect(beneficioEditado(actual, "sellos", { tipo: "sellos", requeridos: 20, recompensa: "Postre" })).toEqual({
      ok: false,
      motivo: "Los sellos de la meta van de 1 a 15.",
    });
    // Los 2 sellos de regalo tienen que quedar por debajo de la meta.
    expect(beneficioEditado(actual, "sellos", { tipo: "sellos", requeridos: 2, recompensa: "Postre" })).toMatchObject({ ok: false });
    expect(beneficioEditado(actual, "sellos", { tipo: "sellos", requeridos: 8, recompensa: "  " })).toMatchObject({ ok: false });
  });

  it("el tipo no se cambia desde Foorkie; sin config guardada arranca de la de fábrica", () => {
    expect(beneficioEditado(null, "sellos", { tipo: "cashback", porcentaje: 5 })).toMatchObject({ ok: false });
    expect(beneficioEditado(null, "cashback", { tipo: "cashback", porcentaje: 6 })).toEqual({
      ok: true,
      beneficio: { tipo: "cashback", porcentaje: 6, compraMinima: 0, topePorCompra: null },
    });
  });

  it("cambioElBeneficio mira solo lo que Foorkie edita", () => {
    const cb = { tipo: "cashback" as const, porcentaje: 5, compraMinima: 0, topePorCompra: null };
    expect(cambioElBeneficio(cb, { ...cb })).toBe(false);
    expect(cambioElBeneficio(cb, { ...cb, porcentaje: 6 })).toBe(true);
    expect(cambioElBeneficio(null, cb)).toBe(true);
    const se = { tipo: "sellos" as const, requeridos: 10, recompensa: "Café", inicial: 0, repetible: true };
    expect(cambioElBeneficio(se, { ...se, recompensa: "Café " })).toBe(false);
    expect(cambioElBeneficio(se, { ...se, requeridos: 9 })).toBe(true);
  });
});

describe("el sello y la tira desde Foorkie (foorkie-api, oct 2026)", () => {
  const PROPIO = "https://x.supabase.co/storage/v1/object/public/comprobantes/logos-negocio/foorkie-icono-1.png";

  it("leerEdicionDeFoorkie lee el ícono, su archivo y la tira (saneada); solo eso también es un cambio", () => {
    const r = leerEdicionDeFoorkie({ iconoSello: " cafe ", iconoUrl: "", diseno: { filas: 3, escalaSello: 9 } });
    expect(r).toEqual({
      ok: true,
      edicion: { iconoSello: "cafe", iconoUrl: null, diseno: { ...CONFIG_CLASICA, filas: 3, escalaSello: 2 } },
    });
    expect(leerEdicionDeFoorkie({ diseno: null })).toEqual({ ok: true, edicion: { diseno: null } });
    expect(leerEdicionDeFoorkie({ iconoSello: null })).toEqual({ ok: true, edicion: { iconoSello: null } });
    expect(leerEdicionDeFoorkie({ iconoSello: "propio", iconoUrl: PROPIO })).toEqual({ ok: true, edicion: { iconoSello: "propio", iconoUrl: PROPIO } });
  });

  it("rechaza con el texto del panel de Bookea lo que no se puede leer", () => {
    expect(leerEdicionDeFoorkie({ iconoSello: "pizza" })).toEqual({ ok: false, motivo: "Ese icono de sello no existe." });
    expect(leerEdicionDeFoorkie({ iconoSello: 3 })).toEqual({ ok: false, motivo: "Ese icono de sello no existe." });
    expect(leerEdicionDeFoorkie({ iconoUrl: "x".repeat(601) })).toEqual({ ok: false, motivo: "El ícono no se subió bien — probá de nuevo." });
    expect(leerEdicionDeFoorkie({ diseno: "auto" })).toEqual({ ok: false, motivo: "El diseño de la tira no vino bien armado." });
    expect(leerEdicionDeFoorkie({ diseno: [] })).toEqual({ ok: false, motivo: "El diseño de la tira no vino bien armado." });
    expect(leerIconoSello(undefined)).toEqual({ ok: true, valor: undefined });
    expect(leerUrlDeIcono(undefined)).toEqual({ ok: true, valor: undefined });
    expect(leerTira(undefined)).toEqual({ ok: true, valor: undefined });
  });

  it("selloEditado: lo que no vino sale de lo guardado; 'propio' sin archivo no; el archivo sobrevive a elegir otro", () => {
    expect(selloEditado({ actual: { icono: null, url: null }, icono: "cafe" })).toEqual({ ok: true, icono: "cafe", url: null });
    expect(selloEditado({ actual: { icono: "cafe", url: PROPIO }, icono: "propio" })).toEqual({ ok: true, icono: "propio", url: PROPIO });
    expect(selloEditado({ actual: { icono: "propio", url: PROPIO }, icono: null })).toEqual({ ok: true, icono: null, url: PROPIO });
    expect(selloEditado({ actual: { icono: "propio", url: PROPIO }, url: null })).toEqual({ ok: false, motivo: "Subí tu ícono antes de elegirlo como sello." });
    expect(selloEditado({ actual: { icono: null, url: null }, icono: "propio" })).toMatchObject({ ok: false });
    expect(selloEditado({ actual: { icono: "propio", url: PROPIO }, icono: "regalo", url: null })).toEqual({ ok: true, icono: "regalo", url: null });
  });

  it("tiraParaGuardar: `{}` para la clásica, la config si no, y nada si dibuja lo mismo", () => {
    const propia = { ...CONFIG_CLASICA, filas: 2 as const, alineacionV: "abajo" as const };
    expect(tiraParaGuardar({}, propia)).toEqual({ cambia: true, valor: propia });
    expect(tiraParaGuardar(propia, null)).toEqual({ cambia: true, valor: {} });
    expect(tiraParaGuardar({ filas: 2, alineacionV: "abajo" }, propia)).toEqual({ cambia: false });
    expect(tiraParaGuardar({}, CONFIG_CLASICA)).toEqual({ cambia: false });
    expect(tiraParaGuardar(null, null)).toEqual({ cambia: false });
    const conFondo = { ...CONFIG_CLASICA, fondo: { forma: "cascada" as const, acento: "#aabbcc", acento2: null } };
    expect(tiraParaGuardar({ fondo: { forma: "cascada", acento: "#AABBCC" } }, conFondo)).toEqual({ cambia: false });
    expect(tiraParaGuardar({ fondo: { forma: "cascada", acento: "#AABBCC" } }, { ...conFondo, fondo: { ...conFondo.fondo, acento2: "#000000" } })).toMatchObject({ cambia: true });
  });

  it("disenoGuardadoDeFila: los cuatro de siempre + el sello y la tira; fuera de sellos, sin ícono", () => {
    const fila = {
      modo: "sellos",
      pase_color_fondo: "#38571A",
      pase_color_sello: null,
      pase_logo_url: null,
      pase_banner_url: null,
      pase_sello_icono: "cafe",
      pase_sello_icono_url: PROPIO,
      pase_diseno: { filas: 1 },
    };
    expect(disenoGuardadoDeFila(fila)).toEqual({
      colorFondo: "#38571A",
      colorSello: "#F39200",
      logoUrl: null,
      bannerUrl: null,
      iconoSello: "cafe",
      iconoUrl: PROPIO,
      tira: { ...CONFIG_CLASICA, filas: 1 },
    });
    expect(disenoGuardadoDeFila({ ...fila, modo: "cashback" })).toMatchObject({ iconoSello: null, iconoUrl: null });
    expect(disenoGuardadoDeFila({ modo: "sellos" })).toMatchObject({ iconoSello: null, iconoUrl: null, tira: CONFIG_CLASICA });
  });

  it("el catálogo para el selector: los doce, con los trazos del pase", () => {
    const c = catalogoDeIconos();
    expect(c.iconos.map((i) => i.id)).toEqual([...ICONOS_SELLO_ID]);
    expect(c.iconos[0]).toEqual({ id: "cafe", nombre: "Café", trazos: [...ICONOS_SELLO.cafe.trazos], viewBox: "0 0 24 24" });
  });
});
