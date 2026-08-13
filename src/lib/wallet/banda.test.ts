import { describe, expect, it } from "vitest";
import { tarjetaDesdeFila, tiraDelPase, type MetaRecompensa } from "./tarjeta";
import { construirObjeto, contenidoDelObjeto } from "./google";
import { TIPOS_TARJETA_ID, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";

/**
 * LA BANDA DEL NEGOCIO, desde la fila hasta el teléfono.
 *
 * El bug que esto congela: el editor de «Tarjeta digital» subía la foto
 * a nuestro storage, la guardaba en `programa_lealtad.pase_banner_url`
 * (0132) y la dibujaba en la vista previa… y el generador del pase
 * NUNCA leía esa columna. Cero referencias en generar.ts, tarjeta.ts y
 * google.ts. El dueño veía su banda en la pantalla, agregaba el pase al
 * Wallet, y en el teléfono no había ninguna foto. La vista previa
 * prometía algo que el pase no cumplía, y no había forma de darse
 * cuenta sin un iPhone en la mano.
 *
 * Por eso acá se arranca de la FILA CRUDA —tal como la devuelve
 * `select *`— y se comprueba lo que llega al pase de las DOS
 * plataformas. Es el mismo criterio de cableado.test.ts: la función
 * pura ya estaba bien; lo que faltaba era el cable.
 */

const BANDA =
  "https://proyecto.supabase.co/storage/v1/object/public/ranchos-fotos/lealtad/bandas/local.jpg";
const LOGO =
  "https://proyecto.supabase.co/storage/v1/object/public/ranchos-fotos/lealtad/logos/marca.png";

/** La recompensa activa más barata, que es lo que fija la meta. */
const META: MetaRecompensa = { nombre: "Un café gratis", costo_puntos: 10 };

/** Una fila de `programa_lealtad` como la entrega `select *`. */
function fila(tipo: TipoTarjeta, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    rancho_id: "22222222-2222-2222-2222-222222222222",
    activo: true,
    nombre: "Tarjeta de Pura Matcha",
    modo: tipo,
    beneficio: null,
    pase_color_fondo: "#2F4230",
    pase_color_sello: "#D9E8C4",
    pase_logo_url: LOGO,
    pase_banner_url: BANDA,
    ...extra,
  };
}

/** Los siete que NO son sellos: para ellos la banda es todo el strip. */
const SIN_SELLOS = TIPOS_TARJETA_ID.filter((t) => t !== "sellos");

/** El mismo camino que hace generar.ts: fila → config → qué se dibuja. */
function tiraDeLaFila(f: Record<string, unknown>, meta: MetaRecompensa = META) {
  return tiraDelPase(tarjetaDesdeFila(f).config, meta);
}

/** El mismo camino que hace google.ts al CREAR el objeto. */
function objetoDeLaFila(f: Record<string, unknown>, meta: MetaRecompensa = META) {
  const { config, beneficio } = tarjetaDesdeFila(f);
  return construirObjeto({
    issuerId: "3388000000023187944",
    ranchoId: "22222222-2222-2222-2222-222222222222",
    miembroId: "33333333-3333-3333-3333-333333333333",
    nombreNegocio: "Pura Matcha",
    nombreCliente: "Luis",
    serial: "PM-0001",
    saldo: 5,
    config,
    meta,
    beneficio,
  });
}

/** El mismo camino que hace google.ts al REFRESCAR (el PATCH). */
function parcheDeLaFila(f: Record<string, unknown>, meta: MetaRecompensa = META) {
  const { config, beneficio } = tarjetaDesdeFila(f);
  return contenidoDelObjeto({ negocioNombre: "Pura Matcha", saldo: 5, config, meta, beneficio });
}

// ── El dato viaja ────────────────────────────────────────────────────

describe("la banda sale de la fila y llega a la config", () => {
  it("la columna de la 0132 se lee, que es justo lo que no pasaba", () => {
    expect(tarjetaDesdeFila(fila("sellos")).config.pase_banner_url).toBe(BANDA);
  });

  it("el logo también, en la misma pasada", () => {
    // El dueño reportó que «la imagen» no aparecía y podían ser las dos.
    expect(tarjetaDesdeFila(fila("sellos")).config.pase_logo_url).toBe(LOGO);
  });

  it("la 0132 sin correr: la fila llega SIN la columna y el pase igual sale", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      const sinColumna = fila(tipo);
      delete sinColumna.pase_banner_url;
      expect(tarjetaDesdeFila(sinColumna).config.pase_banner_url).toBeNull();
      // Y lo que importa: la emisión no depende de la migración.
      expect(() => tiraDeLaFila(sinColumna)).not.toThrow();
    }
  });

  it("una banda vacía o en blanco es NO tener banda", () => {
    for (const vacia of ["", "   ", null]) {
      expect(tarjetaDesdeFila(fila("cupon", { pase_banner_url: vacia })).config.pase_banner_url)
        .toBeNull();
    }
  });

  it("lo que no es texto no se cuela hasta el pase", () => {
    // Un jsonb mal guardado o un número no pueden convertirse en una
    // URL a medias que sharp intente bajar.
    for (const basura of [42, {}, [], true]) {
      expect(tarjetaDesdeFila(fila("cupon", { pase_banner_url: basura })).config.pase_banner_url)
        .toBeNull();
    }
  });
});

// ── La matriz: el strip de Apple es UN SOLO archivo ──────────────────
//
// En Apple la banda y la tira de sellos NO son dos ranuras: las dos son
// `strip.png`. Por eso esto no es una preferencia de diseño sino la
// única forma de darle al negocio las dos cosas.

describe("qué se dibuja en el strip, según el tipo y la banda", () => {
  it("con banda y sellos: los sellos van ENCIMA de la foto", () => {
    expect(tiraDeLaFila(fila("sellos"))).toEqual({
      tipo: "sellos",
      total: 10,
      banda: BANDA,
    });
  });

  it("con banda y cualquier otro tipo: la banda ES el strip", () => {
    for (const tipo of SIN_SELLOS) {
      expect(tiraDeLaFila(fila(tipo))).toEqual({ tipo: "banda", banda: BANDA });
    }
  });

  it("sin banda y sellos: la tira de siempre, sobre el color del negocio", () => {
    expect(tiraDeLaFila(fila("sellos", { pase_banner_url: null }))).toEqual({
      tipo: "sellos",
      total: 10,
      banda: null,
    });
  });

  it("sin banda y otro tipo: no hay strip, como antes de la 0132", () => {
    for (const tipo of SIN_SELLOS) {
      expect(tiraDeLaFila(fila(tipo, { pase_banner_url: null }))).toEqual({ tipo: "ninguna" });
    }
  });

  it("sellos sin recompensa activa: sin meta no hay «5 de 10», queda la banda", () => {
    // Una tira de círculos sin total no dice nada; la foto sí.
    expect(tiraDeLaFila(fila("sellos"), null)).toEqual({ tipo: "banda", banda: BANDA });
  });

  it("sellos sin recompensa y sin banda: no hay nada que dibujar", () => {
    expect(tiraDeLaFila(fila("sellos", { pase_banner_url: null }), null)).toEqual({
      tipo: "ninguna",
    });
  });

  it("un modo que el código no conoce se degrada a puntos y muestra la banda", () => {
    expect(tiraDeLaFila(fila("puntos", { modo: "promo_de_viernes" }))).toEqual({
      tipo: "banda",
      banda: BANDA,
    });
  });

  it("los ocho tipos deciden algo, ninguno se queda sin respuesta", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      expect(["sellos", "banda", "ninguna"]).toContain(tiraDeLaFila(fila(tipo)).tipo);
    }
  });
});

// ── Google: heroImage en los DOS caminos ─────────────────────────────

describe("la banda en Google Wallet", () => {
  it("el objeto que se CREA lleva la banda como heroImage", () => {
    expect(objetoDeLaFila(fila("sellos")).heroImage?.sourceUri.uri).toBe(BANDA);
  });

  it("el PATCH que refresca dice lo MISMO", () => {
    // Si solo uno de los dos caminos la pone, el pase nace con foto y la
    // pierde al primer sello — o al revés. Es el bug que nadie reporta
    // porque aparece después, sin que nadie toque nada.
    for (const tipo of TIPOS_TARJETA_ID) {
      expect(parcheDeLaFila(fila(tipo)).heroImage).toEqual(objetoDeLaFila(fila(tipo)).heroImage);
    }
  });

  it("los ocho tipos llevan su banda, no solo los de sellos", () => {
    for (const tipo of TIPOS_TARJETA_ID) {
      expect(objetoDeLaFila(fila(tipo)).heroImage?.sourceUri.uri).toBe(BANDA);
    }
  });

  it("sin banda no se inventa un heroImage", () => {
    // Google rechaza el objeto entero si se le manda una imagen sin URI.
    expect(objetoDeLaFila(fila("sellos", { pase_banner_url: null })).heroImage).toBeUndefined();
    expect(parcheDeLaFila(fila("cupon", { pase_banner_url: null })).heroImage).toBeUndefined();
  });

  it("la 0132 sin correr: el objeto sale igual, sin foto", () => {
    const sinColumna = fila("giftcard");
    delete sinColumna.pase_banner_url;
    const objeto = objetoDeLaFila(sinColumna);
    expect(objeto.heroImage).toBeUndefined();
    expect(objeto.loyaltyPoints.label).toBe("Saldo");
  });

  it("la banda no le roba el lugar al saldo ni al texto", () => {
    // Agregar la foto no puede cambiar lo que la tarjeta DICE.
    const conFoto = objetoDeLaFila(fila("sellos"));
    const sinFoto = objetoDeLaFila(fila("sellos", { pase_banner_url: null }));
    expect(conFoto.loyaltyPoints).toEqual(sinFoto.loyaltyPoints);
    expect(conFoto.textModulesData).toEqual(sinFoto.textModulesData);
  });
});
