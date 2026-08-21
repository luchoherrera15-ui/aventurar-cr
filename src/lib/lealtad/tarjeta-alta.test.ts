import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validarTarjetaDeAlta, type TarjetaDeAlta } from "./tarjeta-alta";
import type { ConfigBeneficio } from "./tipos-tarjeta";

/**
 * La tarjeta que viaja con el alta de /lealtad/nuevo se valida acá,
 * con las MISMAS reglas que `crearTarjeta`: tipo contra el paquete
 * elegido, beneficio con su forma real, colores #RRGGBB, icono del
 * catálogo y URLs de NUESTRO storage. Dos puertas al mismo dato con
 * reglas distintas son un agujero — estas pruebas fijan la paridad.
 */

const PROYECTO = "https://bjhprmtobmualefvcmau.supabase.co";
const LOGO_OK = `${PROYECTO}/storage/v1/object/public/comprobantes/logos-negocio/alta-1.png`;
const BANNER_OK = `${PROYECTO}/storage/v1/object/public/comprobantes/banners/alta-1.png`;

const original = process.env.NEXT_PUBLIC_SUPABASE_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = PROYECTO;
});

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = original;
});

const sellos: ConfigBeneficio = {
  tipo: "sellos",
  requeridos: 10,
  recompensa: "Corte gratis",
  inicial: 0,
  repetible: true,
};

function completa(extra: Partial<TarjetaDeAlta> = {}): TarjetaDeAlta {
  return {
    modo: "sellos",
    beneficio: sellos,
    colorFondo: "#0a1226",
    colorSello: "#ee7420",
    iconoSello: "tijera",
    logoUrl: LOGO_OK,
    bannerUrl: BANNER_OK,
    ...extra,
  };
}

describe("validarTarjetaDeAlta — cuándo NO hay tarjeta", () => {
  it("sin objeto no hay tarjeta y no hay error (el payload viejo)", () => {
    expect(validarTarjetaDeAlta(null, "prueba")).toEqual({ ok: true, tarjeta: null });
    expect(validarTarjetaDeAlta(undefined, "prueba")).toEqual({ ok: true, tarjeta: null });
  });

  it("un objeto vacío es lo mismo que no mandar nada", () => {
    expect(validarTarjetaDeAlta({}, "prueba")).toEqual({ ok: true, tarjeta: null });
  });

  it("puros strings vacíos también cuentan como «no vino»", () => {
    const r = validarTarjetaDeAlta(
      { modo: "", colorFondo: "", colorSello: "", iconoSello: "", logoUrl: "", bannerUrl: "" },
      "prueba",
    );
    expect(r).toEqual({ ok: true, tarjeta: null });
  });
});

describe("validarTarjetaDeAlta — el tipo contra el paquete", () => {
  it("rechaza un tipo que no existe", () => {
    const r = validarTarjetaDeAlta({ modo: "loteria" }, "prueba");
    expect(r).toEqual({ ok: false, motivo: "Ese tipo de tarjeta no existe." });
  });

  it("la Prueba no arma cupones, y el mensaje dice qué paquete los abre", () => {
    const r = validarTarjetaDeAlta({ modo: "cupon" }, "prueba");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("Starter");
  });

  it("la membresía se abre recién con Impulso", () => {
    const r = validarTarjetaDeAlta({ modo: "membresia" }, "arranque");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("Impulso");
  });

  it("Impulso trae los ocho: una gift card pasa", () => {
    const r = validarTarjetaDeAlta(
      {
        modo: "giftcard",
        beneficio: { tipo: "giftcard", valor: 10000, moneda: "CRC", canjeParcial: true, transferible: true },
      },
      "impulso",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tarjeta?.modo).toBe("giftcard");
  });
});

describe("validarTarjetaDeAlta — el beneficio", () => {
  it("con modo pero sin beneficio no se puede guardar", () => {
    const r = validarTarjetaDeAlta({ modo: "sellos" }, "prueba");
    expect(r).toEqual({
      ok: false,
      motivo: "La configuración no corresponde a ese tipo de tarjeta.",
    });
  });

  it("el beneficio tiene que ser DEL tipo de la tarjeta", () => {
    const puntos: ConfigBeneficio = {
      tipo: "puntos",
      nombre: "puntos",
      porMoneda: 0,
      porVisita: 1,
      inicial: 0,
      minimoCanje: 5,
      maximo: null,
    };
    const r = validarTarjetaDeAlta({ modo: "sellos", beneficio: puntos }, "prueba");
    expect(r).toEqual({
      ok: false,
      motivo: "La configuración no corresponde a ese tipo de tarjeta.",
    });
  });

  it("un beneficio sin modo tampoco pasa", () => {
    const r = validarTarjetaDeAlta({ beneficio: sellos }, "prueba");
    expect(r).toEqual({
      ok: false,
      motivo: "La configuración no corresponde a ese tipo de tarjeta.",
    });
  });

  it("delega las reglas del negocio en validarBeneficio", () => {
    const rota: ConfigBeneficio = { ...sellos, requeridos: 0 };
    const r = validarTarjetaDeAlta({ modo: "sellos", beneficio: rota }, "prueba");
    expect(r).toEqual({ ok: false, motivo: "Los sellos de la meta van de 1 a 100." });
  });
});

describe("validarTarjetaDeAlta — colores, icono e imágenes", () => {
  it("acepta la tarjeta completa y devuelve los campos limpios", () => {
    const r = validarTarjetaDeAlta(completa(), "prueba");
    expect(r).toEqual({
      ok: true,
      tarjeta: {
        modo: "sellos",
        beneficio: sellos,
        colorFondo: "#0a1226",
        colorSello: "#ee7420",
        iconoSello: "tijera",
        iconoUrl: null,
        logoUrl: LOGO_OK,
        bannerUrl: BANNER_OK,
      },
    });
  });

  it("un color que no es #RRGGBB se rechaza con su mensaje", () => {
    const fondo = validarTarjetaDeAlta(completa({ colorFondo: "navy" }), "prueba");
    expect(fondo).toEqual({ ok: false, motivo: "El color de fondo tiene que ser #RRGGBB." });
    const sello = validarTarjetaDeAlta(completa({ colorSello: "#12345" }), "prueba");
    expect(sello).toEqual({ ok: false, motivo: "El color del acento tiene que ser #RRGGBB." });
  });

  it("un icono fuera del catálogo se rechaza", () => {
    const r = validarTarjetaDeAlta(completa({ iconoSello: "unicornio" }), "prueba");
    expect(r).toEqual({ ok: false, motivo: "Ese icono de sello no existe." });
  });

  it("en un tipo que no es sellos el icono se DESCARTA, no se rechaza", () => {
    const r = validarTarjetaDeAlta(
      {
        modo: "puntos",
        beneficio: {
          tipo: "puntos",
          nombre: "puntos",
          porMoneda: 1,
          porVisita: 0,
          inicial: 0,
          minimoCanje: 10,
          maximo: null,
        },
        iconoSello: "cafe",
      },
      "prueba",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tarjeta?.iconoSello).toBeNull();
  });

  it("sin modo, el icono aplica igual: el programa del alta nace de sellos", () => {
    const r = validarTarjetaDeAlta({ iconoSello: "cafe" }, "prueba");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tarjeta?.iconoSello).toBe("cafe");
  });

  it("una URL ajena en el logo o la banda se rechaza", () => {
    const ajena = "https://malicioso.example.com/storage/v1/object/public/comprobantes/x.png";
    const logo = validarTarjetaDeAlta(completa({ logoUrl: ajena }), "prueba");
    expect(logo).toEqual({ ok: false, motivo: "El logo no se subió bien — probá de nuevo." });
    const banda = validarTarjetaDeAlta(completa({ bannerUrl: ajena }), "prueba");
    expect(banda).toEqual({ ok: false, motivo: "La banda no se subió bien — probá de nuevo." });
  });

  it("solo apariencia, sin tipo: pasa y deja el resto en null", () => {
    const r = validarTarjetaDeAlta({ colorFondo: "#112233" }, "prueba");
    expect(r).toEqual({
      ok: true,
      tarjeta: {
        modo: null,
        beneficio: null,
        colorFondo: "#112233",
        colorSello: null,
        iconoSello: null,
        iconoUrl: null,
        logoUrl: null,
        bannerUrl: null,
      },
    });
  });
});
