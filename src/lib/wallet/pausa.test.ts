import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  avisoDePausa,
  camposSegunModo,
  construirPassJson,
  tarjetaDesdeFila,
  textoDePausa,
  type MetaRecompensa,
} from "./tarjeta";
import { construirObjeto, contenidoDelObjeto } from "./google";
import { TIPOS_TARJETA_ID, type ConfigBeneficio, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";

/**
 * EL PASE CUANDO EL PROGRAMA SE APAGA — y, sobre todo, cuando NO se
 * apaga.
 *
 * La mitad de este archivo son digests. No es paranoia de test: la
 * bandera `pausado` la mira el generador de TODOS los pases, y un
 * descuido acá le cambiaría la tarjeta a los clientes de los negocios
 * que están pagando al día. Los ocho digests se capturaron con el
 * código ANTES de que existiera la pausa; si alguno se mueve, algo que
 * no debía cambiar cambió.
 */

const BENEFICIOS: Record<TipoTarjeta, ConfigBeneficio> = {
  sellos: { tipo: "sellos", requeridos: 10, recompensa: "Un café gratis", inicial: 0, repetible: true },
  puntos: {
    tipo: "puntos",
    nombre: "estrellas",
    porMoneda: 0.01,
    porVisita: 1,
    inicial: 0,
    minimoCanje: 100,
    maximo: null,
  },
  cupon: {
    tipo: "cupon",
    beneficio: { forma: "porcentaje", valor: 30 },
    compraMinima: 0,
    descuentoMaximo: null,
    usosPorCliente: 1,
  },
  descuento: {
    tipo: "descuento",
    beneficio: { forma: "monto", valor: 5000 },
    compraMinima: 15000,
    descuentoMaximo: null,
    usosPorCliente: 3,
  },
  membresia: {
    tipo: "membresia",
    nivel: "Gold",
    beneficios: ["10% siempre", "Prioridad de horario"],
    vigenciaMeses: 12,
    renovacionAutomatica: false,
  },
  giftcard: { tipo: "giftcard", valor: 25000, moneda: "CRC", canjeParcial: true, transferible: true },
  evento: {
    tipo: "evento",
    fecha: "2026-09-01",
    hora: "19:00",
    ubicacion: "Rancho Las Torres",
    capacidad: 120,
  },
  cashback: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null },
};

const META: MetaRecompensa = { nombre: "Tu bebida favorita gratis", costo_puntos: 10 };

/**
 * LOS BYTES DE ANTES.
 *
 * `apple` es el SHA-256 del archivo `pass.json` tal cual lo escribe
 * `generar.ts` —`JSON.stringify(passJson, null, 2)` en utf8—, o sea el
 * archivo exacto que viaja adentro del .pkpass. `google` es el del
 * LoyaltyObject serializado.
 *
 * Se comparan los dos y no solo Apple porque el corte toca las dos
 * plataformas, y porque un cambio en `camposSegunModo` se filtra a
 * Google por abajo (el objeto se arma con la misma función).
 */
const BYTES_DE_ANTES: Record<TipoTarjeta, { apple: string; google: string }> = {
  sellos: {
    apple: "4d0564a58835d508b2d7afec821edde6fbfc98aaf7410c5b923056fed84ec979",
    google: "d0d755ee3e611d34ac0ce43a301b56a8892181636cfdc1a4c3c636dbd7aab888",
  },
  puntos: {
    apple: "da13217711d3ec0ca196d0ba87681260ef8ea3a176530a72bbec93398e5e6a7b",
    google: "44a8c6d0ba4bfec502ea0e4389fe3ca7fab928adcda0842ed33affda8043cb74",
  },
  cupon: {
    apple: "d89ae2be0b91104800bebd4d58b13d8fc602ba68fa5d7f72f7d49e6bd706df35",
    google: "400b95d1b1d5541b6799c4f9494c0f10387d215ff830483715a11ed0e3938a34",
  },
  descuento: {
    apple: "f2c087f9d4bb60e26e652b6ca411f5417c7ef9fcff3bac8a379a951f2bb61775",
    google: "28c97396e5585157da8426ce7ce56b095a4b1014ac921538f75bd82eda68f5bd",
  },
  membresia: {
    apple: "6ad81082ab3f48a9b29165e5fd68419b18c20b060760186fd99047056418e0da",
    google: "b4a613b70c16c5230a7bb71597ca129405c7c0be0640ed62593acad49024db53",
  },
  giftcard: {
    apple: "3bf37486e30bcc52da97df35ee97b5fb977744ab101005ca77871da8ce47c9c2",
    google: "34e1eb41369d80467763ffb5432a2b5bc3a60ac6827d4b0427f23e51daf617f2",
  },
  evento: {
    apple: "e1eb507c4dac5304f1c548134b8ea157cefdc5404bf559ec552e1278662c722c",
    google: "4f8ca4041c4deec9247f22e2b45ce455dcfb1758c932610e8ea630b4278575c7",
  },
  cashback: {
    apple: "899952ea483babce8420c5093c69c4faec0712c8d6e0d7cfb87bb62a48e1ced8",
    google: "2c26464bf6388759e79cc48ed288f03a94fe240f22686c4328a98d5c3d90c834",
  },
};

/** Una fila de `programa_lealtad` como la entrega `select *`. */
function fila(tipo: TipoTarjeta): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    rancho_id: "22222222-2222-2222-2222-222222222222",
    nombre: "Pura Matcha",
    modo: tipo,
    estado: "activo",
    activo: true,
    beneficio: BENEFICIOS[tipo],
    pase_color_fondo: "#2F4230",
    pase_color_sello: "#D9E8C4",
    pase_logo_url: null,
    pase_banner_url: "https://cdn.bookea.lat/banda.jpg",
    pase_sello_icono: null,
  };
}

/** Los mismos bytes que `generar.ts` mete en el .pkpass. */
function bytesDelPase(tipo: TipoTarjeta, pausado?: boolean): Buffer {
  const { config, beneficio } = tarjetaDesdeFila(fila(tipo));
  const passJson = construirPassJson({
    negocioNombre: "Pura Matcha",
    saldo: 5,
    meta: META,
    config,
    beneficio,
    ...(pausado === undefined ? {} : { pausado }),
    serialNumber: "PM-0001",
    passTypeIdentifier: "pass.lat.bookea.afiliacion",
    teamIdentifier: "425GBKXN83",
    ubicacion: { latitud: 9.93, longitud: -84.08 },
    authToken: "tok",
    webServiceUrl: "https://www.bookea.lat/api/wallet",
  });
  return Buffer.from(JSON.stringify(passJson, null, 2), "utf8");
}

function objetoGoogle(tipo: TipoTarjeta) {
  const { config, beneficio } = tarjetaDesdeFila(fila(tipo));
  return construirObjeto({
    issuerId: "3388000000023187944",
    ranchoId: "22222222-2222-2222-2222-222222222222",
    miembroId: "33333333-3333-3333-3333-333333333333",
    nombreNegocio: "Pura Matcha",
    nombreCliente: "Luis",
    serial: "PM-0001",
    saldo: 5,
    config,
    meta: META,
    beneficio,
  });
}

const sha = (v: Buffer | string) => createHash("sha256").update(v).digest("hex");

// ── LO QUE NO PUEDE CAMBIAR ──────────────────────────────────────────

describe("un programa que opera sale EXACTAMENTE igual que antes de la pausa", () => {
  for (const tipo of TIPOS_TARJETA_ID) {
    it(`${tipo}: el pass.json de Apple, byte por byte`, () => {
      expect(sha(bytesDelPase(tipo))).toBe(BYTES_DE_ANTES[tipo].apple);
    });

    it(`${tipo}: el LoyaltyObject de Google, byte por byte`, () => {
      expect(sha(JSON.stringify(objetoGoogle(tipo)))).toBe(BYTES_DE_ANTES[tipo].google);
    });
  }

  it("`pausado: false` explícito produce los MISMOS bytes que no mandarlo", () => {
    // Es la vuelta: el pase de un negocio que renovó tiene que volver a
    // ser el de siempre, no «parecido al de siempre».
    for (const tipo of TIPOS_TARJETA_ID) {
      expect(sha(bytesDelPase(tipo, false))).toBe(BYTES_DE_ANTES[tipo].apple);
    }
  });

  it("la ida y la vuelta cierran: pausar y despausar devuelve el pase original", () => {
    const original = bytesDelPase("sellos");
    const enPausa = bytesDelPase("sellos", true);
    const devuelto = bytesDelPase("sellos", false);
    expect(enPausa.equals(original)).toBe(false);
    expect(devuelto.equals(original)).toBe(true);
  });
});

// ── LO QUE SÍ CAMBIA, Y SOLO ESO ─────────────────────────────────────

describe("el pase de un programa en pausa", () => {
  it("no agrega ni quita un solo campo: cambian DOS textos", () => {
    type Pase = {
      storeCard: {
        headerFields: { key: string; label: string; value: string }[];
        secondaryFields: { key: string; label: string; value: string }[];
        auxiliaryFields: { key: string }[];
        backFields: { key: string; label: string; value: string }[];
      };
    };
    const normal = JSON.parse(bytesDelPase("sellos").toString()) as Pase;
    const pausa = JSON.parse(bytesDelPase("sellos", true).toString()) as Pase;

    const llaves = (p: Pase) => ({
      header: p.storeCard.headerFields.map((f) => f.key),
      secondary: p.storeCard.secondaryFields.map((f) => f.key),
      auxiliary: p.storeCard.auxiliaryFields.map((f) => f.key),
      back: p.storeCard.backFields.map((f) => f.key),
    });
    expect(llaves(pausa)).toEqual(llaves(normal));
  });

  it("LOS SELLOS SIGUEN A LA VISTA: el encabezado no se toca", () => {
    type Pase = { storeCard: { headerFields: { label: string; value: string }[] } };
    const normal = JSON.parse(bytesDelPase("sellos").toString()) as Pase;
    const pausa = JSON.parse(bytesDelPase("sellos", true).toString()) as Pase;
    expect(pausa.storeCard.headerFields).toEqual(normal.storeCard.headerFields);
    expect(pausa.storeCard.headerFields[0].value).toBe("5/10");
  });

  it("la línea de estado deja de prometer sellos que no se pueden dar", () => {
    const c = camposSegunModo({
      negocioNombre: "Pura Matcha",
      saldo: 5,
      meta: META,
      config: { modo: "sellos", pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
      beneficio: null,
      pausado: true,
    });
    expect(c.detalle.label).toBe("EN PAUSA");
    expect(c.detalle.value).toContain("Tus sellos quedan guardados");
    // La regalía sigue nombrada: la promesa no desapareció, está en
    // pausa.
    expect(c.regalia?.value).toBe("Tu bebida favorita gratis");
  });

  it("el reverso explica que no se pierde nada y que el negocio vuelve", () => {
    type Pase = { storeCard: { backFields: { key: string; label: string; value: string }[] } };
    const pausa = JSON.parse(bytesDelPase("sellos", true).toString()) as Pase;
    const reverso = pausa.storeCard.backFields[0];
    expect(reverso.key).toBe("como");
    expect(reverso.label).toBe("Este programa está en pausa");
    expect(reverso.value).toContain("Pura Matcha");
    expect(reverso.value).toContain("no se pierde nada");
    expect(reverso.value).toContain("Cuando el programa vuelva");
  });

  it("le habla a cada tipo con su propio sustantivo (una gift card no tiene sellos)", () => {
    expect(avisoDePausa("sellos").value).toContain("sellos");
    expect(avisoDePausa("puntos").value).toContain("puntos");
    expect(avisoDePausa("giftcard").value).toContain("saldo");
    expect(avisoDePausa("cashback").value).toContain("saldo");
    expect(avisoDePausa("membresia").value).toContain("carnet");
    expect(avisoDePausa("evento").value).toContain("entrada");
    expect(avisoDePausa("cupon").value).toContain("tarjeta");
    expect(avisoDePausa("descuento").value).toContain("tarjeta");
  });

  it("NO usa una sola palabra de adentro: esto lo lee quien fue a cortarse el pelo", () => {
    // La lista es la del vocabulario que se cuela solo cuando el que
    // escribe está pensando en el sistema y no en la persona.
    const prohibidas = [
      "suscripción",
      "suscripcion",
      "stripe",
      "past_due",
      "unpaid",
      "factura",
      "pago",
      "cobro",
      "moros",
      "plan",
      "cancelad",
      "vencid",
      "webhook",
      "deuda",
      "cuota",
    ];
    const textos = [
      ...TIPOS_TARJETA_ID.map((t) => avisoDePausa(t).value),
      ...TIPOS_TARJETA_ID.map((t) => textoDePausa("Pura Matcha", t)),
      avisoDePausa("sellos").label,
    ];
    for (const texto of textos) {
      const bajo = texto.toLocaleLowerCase("es-CR");
      const coladas = prohibidas.filter((p) => bajo.includes(p));
      expect(coladas, `se coló vocabulario interno en «${texto}»`).toEqual([]);
    }
  });

  it("un negocio sin nombre no produce un texto que empiece con espacio", () => {
    expect(textoDePausa("   ", "sellos")).toMatch(/^El negocio pausó/);
  });
});

// ── GOOGLE ───────────────────────────────────────────────────────────

describe("el objeto de Google en pausa", () => {
  const config = {
    modo: "sellos" as const,
    pase_color_fondo: "#2F4230",
    pase_color_sello: "#D9E8C4",
    pase_logo_url: null,
  };

  const contenido = (pausado?: boolean) =>
    contenidoDelObjeto({
      negocioNombre: "Pura Matcha",
      saldo: 5,
      config,
      meta: META,
      beneficio: null,
      ...(pausado === undefined ? {} : { pausado }),
    });

  it("pone la pausa PRIMERO y no borra el «5 de 10»", () => {
    const modulos = contenido(true).textModulesData ?? [];
    expect(modulos[0].id).toBe("pausa");
    expect(modulos[0].header).toBe("Programa en pausa");
    expect(modulos[1].body).toContain("5 de 10");
  });

  it("el saldo se sigue viendo: la pausa no vacía la tarjeta", () => {
    expect(contenido(true).loyaltyPoints).toEqual({ label: "Sellos", balance: { int: 5 } });
  });

  it("la VUELTA manda el array aunque quede vacío, o el módulo no se borraría nunca", () => {
    // Es el detalle que convierte el corte en una trampa: el PATCH de
    // Google no toca lo que el cuerpo no nombra, así que un pase que se
    // avisó y después se despausó se quedaría diciendo «en pausa».
    const sinMeta = contenidoDelObjeto({
      negocioNombre: "Pura Matcha",
      saldo: 5,
      config,
      meta: null,
      beneficio: null,
      pausado: false,
    });
    expect(sinMeta.textModulesData).toEqual([]);
  });

  it("sin preguntar por la pausa, el objeto es el de siempre (campo ausente)", () => {
    const sinMeta = contenidoDelObjeto({
      negocioNombre: "Pura Matcha",
      saldo: 5,
      config,
      meta: null,
      beneficio: null,
    });
    expect(sinMeta.textModulesData).toBeUndefined();
  });

  it("`pausado: false` con módulos deja el contenido idéntico al de siempre", () => {
    expect(JSON.stringify(contenido(false))).toBe(JSON.stringify(contenido()));
  });
});
