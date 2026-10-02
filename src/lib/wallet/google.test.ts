import { generateKeyPairSync, createVerify } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  AVISOS_DE_EVENTO_POR_DIA,
  claseDeLaTarjeta,
  construirClase,
  construirObjeto,
  credencialesGoogleDelEntorno,
  esTopeDeGoogle,
  firmarJwt,
  idDeClase,
  idDeObjeto,
  MAX_MENSAJES_GOOGLE,
  momentoDelMensaje,
  planDelAvisoGoogle,
  TOPE_GOOGLE_AVISOS_POR_DIA,
} from "./google";

/**
 * La parte pura de Google Wallet: ids, recursos y el JWT. Nada de red —
 * la firma se verifica con la llave pública del par generado acá.
 */

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const ISSUER = "3388000000023187944";
const RANCHO = "53000540-8fee-4872-bbeb-940b77366c39";
const MIEMBRO = "6b50a99c-1111-2222-3333-444455556666";

describe("ids deterministas", () => {
  it("solo usa caracteres que Google acepta y saca los guiones del uuid", () => {
    const clase = idDeClase(ISSUER, RANCHO);
    const objeto = idDeObjeto(ISSUER, MIEMBRO);
    expect(clase).toBe(`${ISSUER}.negocio_53000540${"8fee4872bbeb940b77366c39"}`);
    expect(objeto).toMatch(/^\d+\.miembro_[0-9a-f]{32}$/);
    // El charset permitido por la API: letras, números, punto, _ y -.
    expect(clase).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("el mismo miembro SIEMPRE produce el mismo objeto (sin tabla de mapeo)", () => {
    expect(idDeObjeto(ISSUER, MIEMBRO)).toBe(idDeObjeto(ISSUER, MIEMBRO));
  });
});

/**
 * LA CLASE DE CADA TARJETA — lo que protege los pases de Android que ya
 * están repartidos.
 *
 * En Google, el nombre que sale arriba, el logo y el color de fondo NO
 * viven en el objeto del cliente: viven en la CLASE, que hasta la
 * segunda tarjeta era una sola por negocio. Si la tarjeta nueva
 * escribiera en esa clase, todos los pases de Android de la primera
 * cambiarían de nombre y de color de golpe — Pura Matcha tiene cuatro.
 *
 * Por eso la regla es por ANTIGÜEDAD y no por «cuál emite hoy»: la
 * fecha de creación no cambia nunca, así que la respuesta es la misma
 * con la original activa, pausada, vencida o archivada.
 */
describe("claseDeLaTarjeta — la original conserva la clase legada", () => {
  const VIEJA = { id: "prog-vieja", created_at: "2026-08-17T21:07:42Z", activo: true };
  const NUEVA = { id: "prog-nueva", created_at: "2026-08-20T21:43:08Z", activo: true };
  // A propósito con el uuid de la NUEVA ordenando antes que el de la
  // vieja: es la forma exacta que tiene Pura Matcha en producción y la
  // que rompía el desempate viejo.
  const FILAS = [NUEVA, VIEJA];

  it("la más vieja no estrena clase: se queda con `negocio_<rancho>`", () => {
    expect(claseDeLaTarjeta(FILAS, "prog-vieja")).toBeNull();
    expect(idDeClase(ISSUER, RANCHO, claseDeLaTarjeta(FILAS, "prog-vieja"))).toBe(
      idDeClase(ISSUER, RANCHO),
    );
  });

  it("cualquier otra estrena la suya, distinta de la legada", () => {
    expect(claseDeLaTarjeta(FILAS, "prog-nueva")).toBe("prog-nueva");
    expect(idDeClase(ISSUER, RANCHO, claseDeLaTarjeta(FILAS, "prog-nueva"))).not.toBe(
      idDeClase(ISSUER, RANCHO),
    );
  });

  it("PAUSAR la original no le pasa su clase a la segunda", () => {
    // El caso que hace falta clavar: con la original pausada, «la que
    // emite» pasa a ser la segunda. Si la regla mirara eso, refrescar
    // el diseño le estamparía el nombre y el color de la segunda a los
    // pases de Android de la primera.
    const pausada = [{ ...NUEVA }, { ...VIEJA, activo: false, estado: "pausado" }];
    expect(claseDeLaTarjeta(pausada, "prog-vieja")).toBeNull();
    expect(claseDeLaTarjeta(pausada, "prog-nueva")).toBe("prog-nueva");
  });

  it("con UNA sola tarjeta nada cambia: sigue la clase de siempre", () => {
    expect(claseDeLaTarjeta([VIEJA], "prog-vieja")).toBeNull();
  });
});

describe("firmarJwt", () => {
  it("produce un RS256 verificable con la llave pública", () => {
    const jwt = firmarJwt({ iss: "prueba@sa.iam", aud: "google" }, privateKey);
    const [cabecera, cuerpo, firma] = jwt.split(".");

    expect(JSON.parse(Buffer.from(cabecera, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(cuerpo, "base64url").toString()).aud).toBe("google");

    const verificador = createVerify("RSA-SHA256");
    verificador.update(`${cabecera}.${cuerpo}`);
    expect(verificador.verify(publicKey, Buffer.from(firma, "base64url"))).toBe(true);
  });

  it("una firma alterada NO verifica", () => {
    const jwt = firmarJwt({ iss: "x" }, privateKey);
    const [cabecera, cuerpo, firma] = jwt.split(".");
    const rota = Buffer.from(firma, "base64url");
    rota[0] ^= 0xff;
    const verificador = createVerify("RSA-SHA256");
    verificador.update(`${cabecera}.${cuerpo}`);
    expect(verificador.verify(publicKey, rota)).toBe(false);
  });
});

describe("construirClase / construirObjeto", () => {
  const config = {
    modo: "sellos" as const,
    pase_color_fondo: "#9ebdff",
    pase_color_sello: "#f57600",
    pase_logo_url: null,
  };

  it("la clase lleva el nombre del negocio, su color y un logo SIEMPRE", () => {
    const clase = construirClase({
      issuerId: ISSUER,
      ranchoId: RANCHO,
      nombreNegocio: "Rancho Las Torres",
      config,
    });
    expect(clase.programName).toBe("Rancho Las Torres");
    expect(clase.hexBackgroundColor).toBe("#9ebdff");
    // Sin logo configurado cae al de Bookea: programLogo es obligatorio
    // en la API y una clase sin logo se rechaza entera.
    expect(clase.programLogo.sourceUri.uri).toMatch(/^https:\/\//);
    expect(clase.id).toBe(idDeClase(ISSUER, RANCHO));
  });

  it("el objeto lleva el saldo, el QR con el SERIAL y la meta '5 de 10'", () => {
    const objeto = construirObjeto({
      issuerId: ISSUER,
      ranchoId: RANCHO,
      miembroId: MIEMBRO,
      nombreNegocio: "Rancho Las Torres",
      nombreCliente: "Luis",
      serial: "serial-del-escaner",
      saldo: 5,
      config,
      meta: { nombre: "Tu bebida favorita gratis", costo_puntos: 10 },
      beneficio: null,
    });
    expect(objeto.classId).toBe(idDeClase(ISSUER, RANCHO));
    expect(objeto.loyaltyPoints).toEqual({ label: "Sellos", balance: { int: 5 } });
    // El QR es el MISMO serial de pases_wallet: lo que lee el escáner
    // del mostrador, idéntico a Apple.
    expect(objeto.barcode).toMatchObject({ type: "QR_CODE", value: "serial-del-escaner" });
    expect(objeto.textModulesData?.[0].body).toContain("5 de 10");
  });

  it("el saldo mostrado en la meta se recorta al total (12 de 10 no existe)", () => {
    const objeto = construirObjeto({
      issuerId: ISSUER,
      ranchoId: RANCHO,
      miembroId: MIEMBRO,
      nombreNegocio: "Rancho Las Torres",
      nombreCliente: "Luis",
      serial: "s",
      saldo: 12,
      config,
      meta: { nombre: "Café", costo_puntos: 10 },
      beneficio: null,
    });
    expect(objeto.textModulesData?.[0].body).toContain("10 de 10");
  });

  it("en modo puntos la etiqueta cambia y sin meta no hay módulo de texto", () => {
    const objeto = construirObjeto({
      issuerId: ISSUER,
      ranchoId: RANCHO,
      miembroId: MIEMBRO,
      nombreNegocio: "Rancho Las Torres",
      nombreCliente: "Luis",
      serial: "s",
      saldo: 240,
      config: { ...config, modo: "puntos" },
      meta: null,
      beneficio: null,
    });
    expect(objeto.loyaltyPoints.label).toBe("Puntos");
    expect(objeto.textModulesData).toBeUndefined();
  });
});

describe("credencialesGoogleDelEntorno", () => {
  const originales = { ...process.env };
  afterEach(() => {
    process.env.GOOGLE_WALLET_ISSUER_ID = originales.GOOGLE_WALLET_ISSUER_ID;
    process.env.GOOGLE_WALLET_SA_KEY_B64 = originales.GOOGLE_WALLET_SA_KEY_B64;
  });

  it("sin variables devuelve null (todo apagado, sin botón)", () => {
    delete process.env.GOOGLE_WALLET_ISSUER_ID;
    delete process.env.GOOGLE_WALLET_SA_KEY_B64;
    expect(credencialesGoogleDelEntorno()).toBeNull();
  });

  it("con un base64 que no es JSON devuelve null en vez de reventar", () => {
    process.env.GOOGLE_WALLET_ISSUER_ID = ISSUER;
    process.env.GOOGLE_WALLET_SA_KEY_B64 = Buffer.from("no soy json").toString("base64");
    expect(credencialesGoogleDelEntorno()).toBeNull();
  });

  it("con el JSON de una cuenta de servicio arma las credenciales", () => {
    process.env.GOOGLE_WALLET_ISSUER_ID = ISSUER;
    process.env.GOOGLE_WALLET_SA_KEY_B64 = Buffer.from(
      JSON.stringify({ client_email: "sa@p.iam.gserviceaccount.com", private_key: privateKey }),
    ).toString("base64");
    const cred = credencialesGoogleDelEntorno();
    expect(cred?.issuerId).toBe(ISSUER);
    expect(cred?.clientEmail).toBe("sa@p.iam.gserviceaccount.com");
  });
});

/**
 * EL MENSAJE DE UN MOVIMIENTO (tarjetas de Foorkie) Y EL TOPE DE GOOGLE.
 *
 * Google acepta 3 mensajes CON notificación por pase en 24 horas; el
 * cuarto rebota. Los movimientos usan 2 y dejan uno para el aviso que el
 * restaurante manda a todos. La cuenta sale del propio objeto: cada
 * mensaje nuestro lleva su hora en el id.
 */
describe("el tope de Google para los mensajes de un movimiento", () => {
  const AHORA = Date.parse("2026-10-01T20:00:00Z");
  const HORA = 60 * 60 * 1000;
  const evento = (horasAtras: number, extra: Record<string, unknown> = {}) => ({
    id: `evento-sumar-${AHORA - horasAtras * HORA}`,
    header: "Foorkie",
    body: "¡Gracias por preferirnos!",
    messageType: "TEXT_AND_NOTIFY",
    ...extra,
  });
  const promo = (iso: string, extra: Record<string, unknown> = {}) => ({
    id: `promo-${iso}`,
    header: "Foorkie",
    body: "MIÉRCOLES 2X1",
    messageType: "TEXT_AND_NOTIFY",
    ...extra,
  });

  it("los números del tope: 3 de Google, 2 para los movimientos, 10 mensajes por pase", () => {
    expect(TOPE_GOOGLE_AVISOS_POR_DIA).toBe(3);
    expect(AVISOS_DE_EVENTO_POR_DIA).toBe(2);
    expect(MAX_MENSAJES_GOOGLE).toBe(10);
  });

  it("la hora de cada mensaje sale de su id (o de su displayInterval)", () => {
    expect(momentoDelMensaje(evento(1))).toBe(AHORA - HORA);
    expect(momentoDelMensaje(promo("2026-10-01T14:05"))).toBe(Date.parse("2026-10-01T14:05:00Z"));
    expect(momentoDelMensaje({ id: "otro", displayInterval: { start: { date: "2026-10-01T10:00:00Z" } } })).toBe(
      Date.parse("2026-10-01T10:00:00Z"),
    );
    expect(momentoDelMensaje({ id: "sin-hora" })).toBeNull();
    expect(momentoDelMensaje(null)).toBeNull();
  });

  it("sin mensajes de hoy: con notificación y sin tocar el objeto", () => {
    expect(planDelAvisoGoogle([], AHORA)).toEqual({ tipo: "TEXT_AND_NOTIFY", recientes: 0, quedan: null });
    expect(planDelAvisoGoogle([evento(1)], AHORA)).toMatchObject({ tipo: "TEXT_AND_NOTIFY", recientes: 1, quedan: null });
  });

  it("con 2 avisos en el día —de cualquier origen— el tercero va SIN notificación", () => {
    expect(planDelAvisoGoogle([evento(3), evento(1)], AHORA)).toMatchObject({ tipo: "TEXT", recientes: 2 });
    // La promo del restaurante también cuenta: el tope de Google es por pase.
    expect(planDelAvisoGoogle([promo("2026-10-01T18:00"), evento(1)], AHORA)).toMatchObject({ tipo: "TEXT", recientes: 2 });
  });

  it("lo que ya no cuenta: más de un día, los que se mandaron sin notificación, los sin hora", () => {
    const plan = planDelAvisoGoogle(
      [evento(30), evento(2, { messageType: "TEXT" }), promo("2026-09-29T10:00"), { id: "ajeno", body: "x" }],
      AHORA,
    );
    expect(plan.tipo).toBe("TEXT_AND_NOTIFY");
    expect(plan.recientes).toBe(0);
  });

  it("un mensaje sin tipo cuenta como notificación: ante la duda se avisa de menos", () => {
    expect(
      planDelAvisoGoogle([evento(1, { messageType: undefined }), evento(2, { messageType: undefined })], AHORA).tipo,
    ).toBe("TEXT");
  });

  it("se podan los nuestros de más de un día; los avisos del restaurante no se tocan", () => {
    const viejo = evento(30);
    const deHoy = evento(1);
    const promoVieja = promo("2026-09-01T10:00");
    const plan = planDelAvisoGoogle([viejo, promoVieja, deHoy], AHORA);
    expect(plan.quedan).toEqual([promoVieja, deHoy]);
  });

  it("con los 10 lugares llenos, se va el nuestro más viejo para hacerle lugar al nuevo", () => {
    const promos = Array.from({ length: 8 }, (_, i) => promo(`2026-09-0${i + 1}T10:00`));
    const masViejo = evento(5);
    const masNuevo = evento(1);
    const plan = planDelAvisoGoogle([masNuevo, ...promos, masViejo], AHORA);
    expect(plan.quedan).toHaveLength(MAX_MENSAJES_GOOGLE - 1);
    expect(plan.quedan).not.toContainEqual(masViejo);
    expect(plan.quedan).toContainEqual(masNuevo);
  });

  it("si los 10 son del restaurante, no se borra ninguno suyo", () => {
    const promos = Array.from({ length: 10 }, (_, i) => promo(`2026-09-${String(i + 10)}T10:00`));
    expect(planDelAvisoGoogle(promos, AHORA).quedan).toBeNull();
  });

  it("esTopeDeGoogle: el 429 o un rechazo que nombra la cuota", () => {
    expect(esTopeDeGoogle({ status: 429, json: null })).toBe(true);
    expect(
      esTopeDeGoogle({ status: 400, json: { error: { message: "QuotaExceededException: too many notifications" } } }),
    ).toBe(true);
    expect(esTopeDeGoogle({ status: 400, json: { error: { message: "Invalid message" } } })).toBe(false);
    expect(esTopeDeGoogle({ status: 200, json: { quota: "nada" } })).toBe(false);
  });
});
