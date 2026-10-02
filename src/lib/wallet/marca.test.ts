import { describe, expect, it } from "vitest";
import { construirPassJson, type DatosTarjeta } from "./tarjeta";
import { construirObjeto, contenidoDelObjeto } from "./google";
import { MARCA_BOOKEA, marcaDelPase } from "@/lib/plataforma/foorkie-marca";

/**
 * LA MARCA EN EL PASE DE VERDAD — el pass.json de Apple y el objeto de
 * Google, armados por las MISMAS funciones que corren en producción.
 *
 * Lo que cuidan estas pruebas:
 *   · que un negocio de Bookea siga saliendo byte por byte igual (además
 *     de los digests de `pausa.test.ts`);
 *   · que una tarjeta de un local de Foorkie no diga «Bookea» en ningún
 *     lugar que vea el cliente, y que sus links lleven a Foorkie.
 */

const FOORKIE = marcaDelPase({ slug: "pura-matcha" });

function datos(extra: Partial<DatosTarjeta> = {}): DatosTarjeta {
  return {
    negocioNombre: "Pura Matcha",
    saldo: 5,
    meta: { nombre: "Un matcha gratis", costo_puntos: 10 },
    config: { modo: "sellos", pase_color_fondo: "#38571A", pase_color_sello: "#D9E8C4", pase_logo_url: null },
    beneficio: null,
    serialNumber: "PM-0001",
    passTypeIdentifier: "pass.lat.bookea.afiliacion",
    teamIdentifier: "425GBKXN83",
    authToken: "token",
    webServiceUrl: "https://www.bookea.lat/api/wallet",
    ...extra,
  };
}

type Campo = { key: string; label: string; value: string; attributedValue?: string };
type PassJson = { storeCard: { backFields: Campo[] }; barcodes: { altText: string }[] };

describe("pase de Apple — la firma", () => {
  it("sin marca es EXACTAMENTE el pase de Bookea de siempre", () => {
    const sinMarca = JSON.stringify(construirPassJson(datos()));
    const conBookea = JSON.stringify(construirPassJson(datos({ marca: MARCA_BOOKEA })));
    expect(conBookea).toBe(sinMarca);
    const p = construirPassJson(datos()) as unknown as PassJson;
    expect(p.storeCard.backFields.at(-1)).toEqual({ key: "bookea", label: "Powered by", value: "Bookea.lat" });
    expect(p.barcodes[0].altText).toBe("Powered by Bookea.lat");
    expect(p.storeCard.backFields.some((c) => c.attributedValue)).toBe(false);
  });

  it("una tarjeta de Foorkie firma «Powered by Foorkie» y dice «Foorkie Lealtad» bajo el QR", () => {
    const p = construirPassJson(datos({ marca: FOORKIE })) as unknown as PassJson;
    expect(p.storeCard.backFields.at(-1)).toEqual({ key: "foorkie", label: "Powered by", value: "Foorkie" });
    expect(p.barcodes[0].altText).toBe("Foorkie Lealtad");
  });

  it("lo que ve el cliente no dice Bookea en ningún lado (la cañería —serial, web service— no se ve)", () => {
    const p = construirPassJson(datos({ marca: FOORKIE, mensajePromocional: "2x1 los miércoles" })) as unknown as PassJson & {
      organizationName: string;
      description: string;
    };
    const visible = JSON.stringify({
      storeCard: p.storeCard,
      barcodes: p.barcodes,
      organizationName: p.organizationName,
      description: p.description,
    });
    expect(visible).not.toMatch(/bookea/i);
  });

  it("el reverso lleva los links a Foorkie, tocables, antes de la firma", () => {
    const p = construirPassJson(datos({ marca: FOORKIE })) as unknown as PassJson;
    const reverso = p.storeCard.backFields;
    const unirse = reverso.find((c) => c.key === "foorkie_unirse");
    expect(unirse).toEqual({
      key: "foorkie_unirse",
      label: "Invitá a alguien a esta tarjeta",
      value: "https://www.foorkie.app/lealtad/pura-matcha",
      attributedValue: '<a href="https://www.foorkie.app/lealtad/pura-matcha">foorkie.app/lealtad/pura-matcha</a>',
    });
    const urls = reverso.filter((c) => c.attributedValue).map((c) => c.value);
    expect(urls).toEqual([
      "https://www.foorkie.app/lealtad/pura-matcha",
      "https://www.foorkie.tech/cuenta",
      "https://www.foorkie.tech/soporte",
      "https://www.foorkie.tech/terminos",
      "https://www.foorkie.tech/privacidad",
    ]);
    // El orden del reverso: qué es, los links, quién lo hace.
    expect(reverso[0].key).toBe("como");
    expect(reverso.at(-1)?.key).toBe("foorkie");
    // Apple exige claves únicas en todo el pase.
    const claves = reverso.map((c) => c.key);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("en pausa conserva la firma y los links: solo cambia la explicación", () => {
    const p = construirPassJson(datos({ marca: FOORKIE, pausado: true })) as unknown as PassJson;
    expect(p.storeCard.backFields[0].label).toBe("Este programa está en pausa");
    expect(p.storeCard.backFields.at(-1)?.value).toBe("Foorkie");
    expect(p.storeCard.backFields.filter((c) => c.attributedValue)).toHaveLength(5);
  });
});

describe("pase de Google — los links van en el OBJETO de cada cliente", () => {
  const base = {
    negocioNombre: "Pura Matcha",
    saldo: 5,
    config: { modo: "sellos" as const, pase_color_fondo: "#38571A", pase_color_sello: "#D9E8C4", pase_logo_url: null },
    meta: { nombre: "Un matcha gratis", costo_puntos: 10 },
    beneficio: null,
  };

  it("Bookea: el objeto de siempre, sin un campo de más", () => {
    const sinMarca = contenidoDelObjeto(base);
    expect(contenidoDelObjeto({ ...base, marca: MARCA_BOOKEA })).toEqual(sinMarca);
    expect("linksModuleData" in sinMarca).toBe(false);
    // El refresco (pausado explícito) tampoco suma links.
    expect("linksModuleData" in contenidoDelObjeto({ ...base, pausado: false })).toBe(false);
  });

  it("Foorkie: el módulo de links con las cinco direcciones de Foorkie", () => {
    const c = contenidoDelObjeto({ ...base, marca: FOORKIE, pausado: false });
    expect(c.linksModuleData?.uris).toEqual([
      { id: "foorkie_unirse", uri: "https://www.foorkie.app/lealtad/pura-matcha", description: "Invitá a alguien a esta tarjeta" },
      { id: "foorkie_cuenta", uri: "https://www.foorkie.tech/cuenta", description: "Tus tarjetas en Foorkie" },
      { id: "foorkie_soporte", uri: "https://www.foorkie.tech/soporte", description: "Soporte" },
      { id: "foorkie_terminos", uri: "https://www.foorkie.tech/terminos", description: "Términos y condiciones" },
      { id: "foorkie_privacidad", uri: "https://www.foorkie.tech/privacidad", description: "Política de privacidad" },
    ]);
    expect(JSON.stringify(c)).not.toMatch(/bookea/i);
  });

  it("al crear el objeto la marca también llega", () => {
    const objeto = construirObjeto({
      issuerId: "3388000000022",
      ranchoId: "11111111-1111-4111-8111-111111111111",
      miembroId: "44444444-4444-4444-8444-444444444444",
      nombreNegocio: "Pura Matcha",
      nombreCliente: "Ana",
      serial: "serial",
      saldo: 5,
      config: base.config,
      meta: base.meta,
      beneficio: null,
      marca: FOORKIE,
    });
    expect(objeto.linksModuleData?.uris).toHaveLength(5);
  });
});
