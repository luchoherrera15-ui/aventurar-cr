import { describe, expect, it } from "vitest";
import { tarjetaDesdeFila, tiraDelPase, type MetaRecompensa } from "./tarjeta";
import { construirObjeto, contenidoDelObjeto } from "./google";
import {
  describirEscalon,
  escalonesDeLaTira,
  primeroQueSalga,
  type EscalonTira,
} from "./escalones-tira";
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

describe("el icono del sello sale de la fila y llega a la config (0145)", () => {
  it("la columna se lee, igual que la banda y el logo", () => {
    const f = fila("sellos", { pase_sello_icono: "cafe" });
    expect(tarjetaDesdeFila(f).config.pase_sello_icono).toBe("cafe");
  });

  it("la 0145 sin correr: la fila llega sin la columna y el pase sale como hoy", () => {
    // Es el caso de TODO lo que hay en producción mientras el dueño no
    // pegue la migración. Sin icono, el sello es el logo de siempre.
    for (const tipo of TIPOS_TARJETA_ID) {
      const sinColumna = fila(tipo);
      expect(tarjetaDesdeFila(sinColumna).config.pase_sello_icono).toBeNull();
      expect(() => tiraDeLaFila(sinColumna)).not.toThrow();
    }
  });

  it("un icono que no está en el catálogo no llega al dibujo", () => {
    for (const basura of ["pizza", "", "  ", "CAFE", 42, {}, [], true, null]) {
      expect(tarjetaDesdeFila(fila("sellos", { pase_sello_icono: basura })).config.pase_sello_icono)
        .toBeNull();
    }
  });

  it("una tarjeta que no es de sellos nunca lleva icono", () => {
    // Aunque la columna traiga uno: cambiar el tipo de la tarjeta no
    // puede dejar un dibujo colgado esperando círculos que no existen.
    for (const tipo of SIN_SELLOS) {
      expect(tarjetaDesdeFila(fila(tipo, { pase_sello_icono: "cafe" })).config.pase_sello_icono)
        .toBeNull();
    }
  });

  it("no le cambia nada al pase de Google", () => {
    // Android no dibuja la tira: el icono viaja en la config y ahí se
    // queda. Lo que este test cuida es que no la ROMPA.
    const conIcono = objetoDeLaFila(fila("sellos", { pase_sello_icono: "cafe" }));
    const sinIcono = objetoDeLaFila(fila("sellos"));
    expect(conIcono).toEqual(sinIcono);
    expect(parcheDeLaFila(fila("sellos", { pase_sello_icono: "cafe" })))
      .toEqual(parcheDeLaFila(fila("sellos")));
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

// ── Cuando dibujar la tira FALLA ─────────────────────────────────────
//
// Lo de arriba decide QUÉ se dibuja. Esto decide qué pasa cuando sharp
// no puede dibujarlo, que es el bug que dejó pases sin `strip.png`:
// la escalera reintentaba quitando la banda y volvía a pasar el MISMO
// logo —blanco sobre blanco después de comprimirse contra un fondo
// blanco—, así que fallaba dos veces por la misma causa y el cliente
// abría su tarjeta sin sellos, sin banda y sin nada.

describe("la escalera de degradación de la tira", () => {
  it("con banda y logo son tres escalones, y el último no lleva logo", () => {
    expect(escalonesDeLaTira({ hayBanda: true, hayLogo: true })).toEqual([
      { banda: true, logo: true },
      { banda: false, logo: true },
      { banda: false, logo: false },
    ]);
  });

  it("sin logo no se inventa un escalón «sin logo» repetido", () => {
    expect(escalonesDeLaTira({ hayBanda: true, hayLogo: false })).toEqual([
      { banda: true, logo: false },
      { banda: false, logo: false },
    ]);
  });

  it("sin banda se arranca por el color", () => {
    expect(escalonesDeLaTira({ hayBanda: false, hayLogo: true })).toEqual([
      { banda: false, logo: true },
      { banda: false, logo: false },
    ]);
  });

  it("sin nada, un solo intento posible", () => {
    expect(escalonesDeLaTira({ hayBanda: false, hayLogo: false })).toEqual([
      { banda: false, logo: false },
    ]);
  });

  it("nunca ofrece un escalón imposible", () => {
    for (const hayBanda of [true, false]) {
      for (const hayLogo of [true, false]) {
        for (const e of escalonesDeLaTira({ hayBanda, hayLogo })) {
          expect(e.banda && !hayBanda).toBe(false);
          expect(e.logo && !hayLogo).toBe(false);
        }
      }
    }
  });

  it("cada escalón se cuenta distinto en los logs", () => {
    const dichos = escalonesDeLaTira({ hayBanda: true, hayLogo: true }).map(describirEscalon);
    expect(new Set(dichos).size).toBe(3);
  });
});

describe("bajar la escalera hasta que algo salga", () => {
  /** Un dibujante de mentira: falla según lo que traiga el escalón. */
  function dibujante(falla: (e: EscalonTira) => boolean) {
    const intentos: EscalonTira[] = [];
    const dibujar = async (e: EscalonTira) => {
      intentos.push(e);
      if (falla(e)) throw new Error("Image is entirely blank");
      return { "strip.png": `banda=${e.banda} logo=${e.logo}` };
    };
    return { intentos, dibujar };
  }

  it("si el primero sale, no se prueba nada más", async () => {
    const { intentos, dibujar } = dibujante(() => false);
    const salida = await primeroQueSalga(
      escalonesDeLaTira({ hayBanda: true, hayLogo: true }),
      dibujar,
    );
    expect(salida).toEqual({ "strip.png": "banda=true logo=true" });
    expect(intentos).toHaveLength(1);
  });

  it("EL BUG: con el logo reventado, la tira igual sale — sin logo", async () => {
    // Un logo blanco sobre transparente aplastado contra blanco hace que
    // `trim()` responda «Image is entirely blank». Falla con banda y
    // falla sin banda, porque el problema nunca fue la banda.
    const { intentos, dibujar } = dibujante((e) => e.logo);
    const salida = await primeroQueSalga(
      escalonesDeLaTira({ hayBanda: true, hayLogo: true }),
      dibujar,
    );
    expect(intentos).toHaveLength(3);
    expect(intentos[2]).toEqual({ banda: false, logo: false });
    // Lo que importa: HAY strip. Antes acá se devolvía {} y el pase
    // llegaba al teléfono sin la tira entera.
    expect(salida).toEqual({ "strip.png": "banda=false logo=false" });
  });

  it("sin banda y con el logo reventado, también termina en sellos pelados", async () => {
    const { intentos, dibujar } = dibujante((e) => e.logo);
    const salida = await primeroQueSalga(
      escalonesDeLaTira({ hayBanda: false, hayLogo: true }),
      dibujar,
    );
    expect(intentos).toHaveLength(2);
    expect(salida).toEqual({ "strip.png": "banda=false logo=false" });
  });

  it("si solo falla la banda, se conserva el logo en los sellos", async () => {
    const { dibujar } = dibujante((e) => e.banda);
    const salida = await primeroQueSalga(
      escalonesDeLaTira({ hayBanda: true, hayLogo: true }),
      dibujar,
    );
    expect(salida).toEqual({ "strip.png": "banda=false logo=true" });
  });

  it("si falla TODO, null — y quien llama se queda sin strip, no sin pase", async () => {
    const { intentos, dibujar } = dibujante(() => true);
    const salida = await primeroQueSalga(
      escalonesDeLaTira({ hayBanda: true, hayLogo: true }),
      dibujar,
    );
    expect(intentos).toHaveLength(3);
    expect(salida).toBeNull();
  });

  it("cada fallo se cuenta con el escalón que lo produjo", async () => {
    const vistos: string[] = [];
    const { dibujar } = dibujante((e) => e.logo);
    await primeroQueSalga(escalonesDeLaTira({ hayBanda: true, hayLogo: true }), dibujar, (e, err) =>
      vistos.push(`${describirEscalon(e)}: ${(err as Error).message}`),
    );
    expect(vistos).toEqual([
      "los sellos con el logo, sobre la banda: Image is entirely blank",
      "los sellos con el logo, sobre el color: Image is entirely blank",
    ]);
  });
});
