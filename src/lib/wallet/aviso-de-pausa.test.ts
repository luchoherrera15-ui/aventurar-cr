import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL TRABAJO POR TANDAS, contra una base de mentira.
 *
 * Lo que se prueba acá son las tres promesas que hacen que esto se
 * pueda soltar sobre 1.150 pases sin mirarlo:
 *
 *   · va por TANDAS, con pausa entre ellas;
 *   · es REANUDABLE — se corta en el 400 y la corrida siguiente sigue
 *     en el 401;
 *   · es IDEMPOTENTE — correrlo dos veces no manda el aviso dos veces.
 *
 * Y la cuarta, que es la que convierte el corte en algo reversible: la
 * VUELTA. Un negocio que renovó tiene que ver a sus clientes volver al
 * texto normal.
 *
 * Apple y Google están mockeados porque acá no se prueba la red: se
 * prueba que el recorrido llame lo que tiene que llamar, cuántas veces,
 * y qué escribe cuando la llamada falla.
 */

vi.mock("./firma", () => ({ credencialesDelEntorno: vi.fn() }));
vi.mock("./apns", () => ({ avisarPaseActualizado: vi.fn() }));
vi.mock("./google", () => ({
  credencialesGoogleDelEntorno: vi.fn(),
  refrescarPaseGoogleDeMiembro: vi.fn(),
}));

import { avisarPaseActualizado } from "./apns";
import { credencialesDelEntorno } from "./firma";
import { credencialesGoogleDelEntorno, refrescarPaseGoogleDeMiembro } from "./google";
import {
  direccionDelPase,
  enGrupos,
  sincronizarAvisoDePausa,
  type OpcionesPausa,
} from "./aviso-de-pausa";

// ── La base de mentira ───────────────────────────────────────────────

type Fila = Record<string, unknown>;
type Filtro = { tipo: "eq" | "in"; campo: string; valor: unknown };
type ErrorFalso = { code?: string; message: string } | null;
type Respuesta = { data: Fila[] | null; error: ErrorFalso };

type Tablas = {
  programa_lealtad: Fila[];
  pases_wallet: Fila[];
  registros_dispositivo: Fila[];
};

class Consulta implements PromiseLike<Respuesta> {
  private filtros: Filtro[] = [];
  private limite: number | null = null;
  private devolver = false;

  constructor(
    private readonly fake: BaseFalsa,
    private readonly tabla: keyof Tablas,
    private readonly modo: "select" | "update" | "delete",
    private readonly cambio: Fila = {},
  ) {}

  eq(campo: string, valor: unknown): this {
    this.filtros.push({ tipo: "eq", campo, valor });
    return this;
  }
  in(campo: string, valor: unknown[]): this {
    this.filtros.push({ tipo: "in", campo, valor });
    return this;
  }
  order(): this {
    return this;
  }
  limit(n: number): this {
    this.limite = n;
    return this;
  }
  select(): this {
    this.devolver = true;
    return this;
  }

  then<A, B = never>(
    ok?: ((v: Respuesta) => A | PromiseLike<A>) | null,
    fallo?: ((r: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.correr()).then(ok, fallo);
  }

  private correr(): Respuesta {
    const forzado = this.fake.errores.get(`${this.tabla}:${this.modo}`);
    if (forzado) return { data: null, error: forzado };

    this.fake.bitacora.push(`${this.modo} ${this.tabla}`);

    const todas = this.fake.tablas[this.tabla];
    let elegidas = todas.filter((f) => this.filtros.every((x) => coincide(f, x)));

    if (this.modo === "select") {
      elegidas = [...elegidas].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      if (this.limite !== null) elegidas = elegidas.slice(0, this.limite);
      return { data: elegidas.map((f) => ({ ...f })), error: null };
    }

    if (this.modo === "update") {
      for (const f of elegidas) Object.assign(f, this.cambio);
      return { data: this.devolver ? elegidas.map((f) => ({ id: f.id })) : null, error: null };
    }

    this.fake.tablas[this.tabla] = todas.filter((f) => !elegidas.includes(f));
    return { data: null, error: null };
  }
}

/**
 * El campo `miembros.programa_id` del embed se resuelve contra la misma
 * fila: en el fake, el pase lleva su `programa_id` al lado.
 */
function coincide(fila: Fila, filtro: Filtro): boolean {
  const campo = filtro.campo.includes(".")
    ? (filtro.campo.split(".").pop() as string)
    : filtro.campo;
  const valor = fila[campo];
  if (filtro.tipo === "eq") return valor === filtro.valor;
  return (filtro.valor as unknown[]).includes(valor);
}

class BaseFalsa {
  readonly bitacora: string[] = [];
  readonly errores = new Map<string, { code?: string; message: string }>();

  constructor(readonly tablas: Tablas) {}

  from(tabla: keyof Tablas) {
    return {
      select: () => new Consulta(this, tabla, "select"),
      update: (cambio: Fila) => new Consulta(this, tabla, "update", cambio),
      delete: () => new Consulta(this, tabla, "delete"),
    };
  }
}

// ── Los datos de siempre ─────────────────────────────────────────────

const PROGRAMA_PAUSADO = "aaaaaaaa-0000-0000-0000-000000000001";
const PROGRAMA_ACTIVO = "aaaaaaaa-0000-0000-0000-000000000002";
const PROGRAMA_ARCHIVADO = "aaaaaaaa-0000-0000-0000-000000000003";

function programas(): Fila[] {
  return [
    { id: PROGRAMA_PAUSADO, estado: "pausado", activo: false, pausado_por_cobro: true },
    { id: PROGRAMA_ACTIVO, estado: "activo", activo: true },
    { id: PROGRAMA_ARCHIVADO, estado: "archivado", activo: false },
  ];
}

function pase(n: number, programaId: string, extra: Fila = {}): Fila {
  return {
    id: `pase-${String(n).padStart(3, "0")}`,
    serial_number: `serial-${n}`,
    plataforma: n % 2 === 0 ? "google" : "apple",
    miembro_id: `miembro-${n}`,
    programa_id: programaId,
    activo: true,
    pase_en_pausa: false,
    pausa_avisada_en: null,
    pausa_error: null,
    ...extra,
  };
}

function armar(pases: Fila[]): BaseFalsa {
  return new BaseFalsa({
    programa_lealtad: programas(),
    pases_wallet: pases,
    registros_dispositivo: pases.map((p) => ({
      serial_number: p.serial_number,
      push_token: `token-${p.serial_number}`,
    })),
  });
}

const dormires: number[] = [];
function correr(fake: BaseFalsa, extra: Partial<OpcionesPausa> = {}) {
  return sincronizarAvisoDePausa({
    db: fake as unknown as OpcionesPausa["db"],
    tamanoTanda: 2,
    pausaMs: 5,
    dormir: async (ms) => {
      dormires.push(ms);
    },
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dormires.length = 0;
  vi.mocked(credencialesDelEntorno).mockReturnValue({
    certificado: "",
    llave: "",
    wwdr: "",
    passTypeIdentifier: "pass.lat.bookea.afiliacion",
    teamIdentifier: "425GBKXN83",
  });
  vi.mocked(credencialesGoogleDelEntorno).mockReturnValue({
    issuerId: "3388000000023187944",
    clientEmail: "sa@p.iam.gserviceaccount.com",
    privateKey: "k",
  });
  vi.mocked(avisarPaseActualizado).mockResolvedValue({ ok: true, enviados: 1, caducados: [] });
  vi.mocked(refrescarPaseGoogleDeMiembro).mockResolvedValue({ ok: true });
});

// ── LA DECISIÓN, PURA ────────────────────────────────────────────────

describe("direccionDelPase", () => {
  it("pausado sin aviso se avisa; con aviso ya está", () => {
    expect(direccionDelPase(false, "pausado")).toBe("avisar");
    expect(direccionDelPase(true, "pausado")).toBe("nada");
  });

  it("operando con aviso se restaura; sin aviso ya está", () => {
    expect(direccionDelPase(true, "activo")).toBe("restaurar");
    expect(direccionDelPase(false, "activo")).toBe("nada");
  });

  it("lo que no vuelve solo no se toca", () => {
    for (const estado of ["borrador", "programado", "vencido", "archivado"] as const) {
      expect(direccionDelPase(false, estado)).toBe("nada");
      expect(direccionDelPase(true, estado)).toBe("nada");
    }
  });
});

describe("enGrupos", () => {
  it("parte la lista sin perder ni repetir", () => {
    expect(enGrupos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(enGrupos([], 2)).toEqual([]);
    expect(enGrupos([1, 2], 9)).toEqual([[1, 2]]);
  });
});

// ── LA IDA ───────────────────────────────────────────────────────────

describe("le pone el aviso a los pases de un programa pausado", () => {
  it("los marca a todos y va por tandas, con pausa entre ellas", async () => {
    const pases = [1, 2, 3, 4, 5].map((n) => pase(n, PROGRAMA_PAUSADO));
    const fake = armar(pases);

    const r = await correr(fake);

    expect(r.programasEnPausa).toBe(1);
    expect(r.avisados).toBe(5);
    expect(r.fallidos).toBe(0);
    expect(pases.every((p) => p.pase_en_pausa === true)).toBe(true);
    expect(pases.every((p) => p.pausa_avisada_en !== null)).toBe(true);
    // 5 pases en tandas de 2 = 3 tandas, o sea 2 respiros entre medio
    // (después de la última no se duerme si no queda nada).
    expect(dormires.length).toBeGreaterThanOrEqual(2);
    expect(dormires.every((ms) => ms === 5)).toBe(true);
  });

  it("Apple viaja por TANDA (una conexión), Google de a uno", async () => {
    const pases = [1, 3, 5].map((n) => pase(n, PROGRAMA_PAUSADO)); // los impares son apple
    await correr(armar(pases), { tamanoTanda: 3 });

    expect(vi.mocked(avisarPaseActualizado)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(avisarPaseActualizado).mock.calls[0][0]).toHaveLength(3);
    expect(vi.mocked(refrescarPaseGoogleDeMiembro)).not.toHaveBeenCalled();
  });

  it("NO toca los pases de un programa archivado ni los de uno activo", async () => {
    const deArchivado = pase(7, PROGRAMA_ARCHIVADO);
    const deActivo = pase(8, PROGRAMA_ACTIVO);
    const fake = armar([pase(1, PROGRAMA_PAUSADO), deArchivado, deActivo]);

    const r = await correr(fake);

    expect(r.avisados).toBe(1);
    expect(deArchivado.pase_en_pausa).toBe(false);
    expect(deActivo.pase_en_pausa).toBe(false);
  });

  it("no toca un pase heredado de una fusión (activo = false)", async () => {
    const viejo = pase(9, PROGRAMA_PAUSADO, { activo: false });
    const fake = armar([viejo]);
    const r = await correr(fake);
    expect(r.avisados).toBe(0);
    expect(viejo.pase_en_pausa).toBe(false);
  });
});

// ── IDEMPOTENCIA ─────────────────────────────────────────────────────

describe("correrlo dos veces no avisa dos veces", () => {
  it("la segunda corrida no manda un solo push", async () => {
    const fake = armar([1, 2, 3].map((n) => pase(n, PROGRAMA_PAUSADO)));

    const primera = await correr(fake);
    const pushDeLaPrimera = vi.mocked(avisarPaseActualizado).mock.calls.length;
    const patchDeLaPrimera = vi.mocked(refrescarPaseGoogleDeMiembro).mock.calls.length;

    const segunda = await correr(fake);

    expect(primera.avisados).toBe(3);
    expect(segunda.avisados).toBe(0);
    expect(vi.mocked(avisarPaseActualizado).mock.calls.length).toBe(pushDeLaPrimera);
    expect(vi.mocked(refrescarPaseGoogleDeMiembro).mock.calls.length).toBe(patchDeLaPrimera);
  });
});

// ── REANUDABLE ───────────────────────────────────────────────────────

describe("si se corta a la mitad, la corrida siguiente sigue donde quedó", () => {
  it("con presupuesto de 2 sobre 5 pases hacen falta tres corridas", async () => {
    const pases = [1, 2, 3, 4, 5].map((n) => pase(n, PROGRAMA_PAUSADO));
    const fake = armar(pases);

    const a = await correr(fake, { maxPorCorrida: 2 });
    expect(a.avisados).toBe(2);
    expect(a.quedaTrabajo).toBe(true);

    const b = await correr(fake, { maxPorCorrida: 2 });
    expect(b.avisados).toBe(2);

    const c = await correr(fake, { maxPorCorrida: 2 });
    expect(c.avisados).toBe(1);
    expect(c.quedaTrabajo).toBe(false);

    // Ninguno se avisó dos veces y ninguno se quedó sin avisar.
    expect(pases.filter((p) => p.pase_en_pausa === true)).toHaveLength(5);
  });
});

// ── LA VUELTA ────────────────────────────────────────────────────────

describe("cuando el negocio renueva, el pase vuelve a su texto normal", () => {
  it("le saca el aviso a los pases de un programa que volvió a operar", async () => {
    const pases = [1, 2, 3].map((n) => pase(n, PROGRAMA_ACTIVO, { pase_en_pausa: true }));
    const fake = armar(pases);

    const r = await correr(fake);

    expect(r.restaurados).toBe(3);
    expect(pases.every((p) => p.pase_en_pausa === false)).toBe(true);
  });

  it("la ida y la vuelta cierran sobre la misma base", async () => {
    const pases = [1, 2, 3].map((n) => pase(n, PROGRAMA_PAUSADO));
    const fake = armar(pases);

    await correr(fake);
    expect(pases.every((p) => p.pase_en_pausa === true)).toBe(true);

    // El negocio renueva: el webhook reactiva el programa (0146).
    fake.tablas.programa_lealtad[0].estado = "activo";
    fake.tablas.programa_lealtad[0].activo = true;

    const vuelta = await correr(fake);
    expect(vuelta.restaurados).toBe(3);
    expect(pases.every((p) => p.pase_en_pausa === false)).toBe(true);
    expect(pases.every((p) => p.pausa_error === null)).toBe(true);
  });

  it("un pase que quedó en pausa con el programa ARCHIVADO no se restaura", async () => {
    const congelado = pase(1, PROGRAMA_ARCHIVADO, { pase_en_pausa: true });
    const fake = armar([congelado]);
    const r = await correr(fake);
    expect(r.restaurados).toBe(0);
    expect(congelado.pase_en_pausa).toBe(true);
  });
});

// ── LO QUE FALLA DEJA RASTRO ─────────────────────────────────────────

describe("cuando Apple o Google no contestan", () => {
  it("el pase vuelve a su bandera y el motivo queda escrito en la fila", async () => {
    vi.mocked(avisarPaseActualizado).mockResolvedValue({
      ok: false,
      motivo: "El certificado del pase venció el 3 de marzo.",
    });
    const apple = pase(1, PROGRAMA_PAUSADO); // impar = apple
    const google = pase(2, PROGRAMA_PAUSADO);
    const fake = armar([apple, google]);

    const r = await correr(fake, { tamanoTanda: 2 });

    expect(r.avisados).toBe(1);
    expect(r.fallidos).toBe(1);
    // El que falló vuelve a estar pendiente: la corrida siguiente lo
    // reintenta sola.
    expect(apple.pase_en_pausa).toBe(false);
    expect(apple.pausa_error).toBe("El certificado del pase venció el 3 de marzo.");
    expect(google.pase_en_pausa).toBe(true);
    expect(google.pausa_error).toBeNull();
  });

  it("no se queda dando vueltas sobre el mismo pase que falla siempre", async () => {
    vi.mocked(avisarPaseActualizado).mockResolvedValue({ ok: false, motivo: "APNs no responde." });
    vi.mocked(refrescarPaseGoogleDeMiembro).mockResolvedValue({ ok: false, motivo: "Google 503." });
    const fake = armar([1, 2, 3, 4].map((n) => pase(n, PROGRAMA_PAUSADO)));

    const r = await correr(fake, { tamanoTanda: 2 });

    // Con todo fallando, se corta después de la primera tanda del grupo
    // en vez de reintentar los mismos hasta agotar el presupuesto.
    expect(r.fallidos).toBe(2);
    expect(vi.mocked(avisarPaseActualizado)).toHaveBeenCalledTimes(1);
  });

  it("el motivo se escribe UNA vez por motivo, no una por pase", async () => {
    vi.mocked(avisarPaseActualizado).mockResolvedValue({ ok: false, motivo: "APNs no responde." });
    const fake = armar([1, 3].map((n) => pase(n, PROGRAMA_PAUSADO))); // los dos apple
    await correr(fake, { tamanoTanda: 2 });
    const devoluciones = fake.bitacora.filter((b) => b === "update pases_wallet");
    // 1 reclamo + 1 marca de `actualizado_en` + 1 devolución agrupada
    // por motivo. Eran 2 antes de que `entregarApple` marcara el pase
    // como cambiado — sin esa marca el push llegaba y la ruta contestaba
    // «no cambió nada» (ver entregar-apple.test.ts).
    //
    // Lo que esta prueba cuida sigue intacto: son DOS pases de Apple
    // fallando con el MISMO motivo, así que escribir «una por pase»
    // daría 4, no 3. El número sube con la marca, pero el agrupado por
    // motivo se sigue verificando igual.
    expect(devoluciones).toHaveLength(3);
  });
});

// ── LO QUE NO ESTÁ CONFIGURADO NO REVIENTA ───────────────────────────

describe("un servidor a medio configurar", () => {
  it("sin certificados de Apple, solo atiende Google y lo dice", async () => {
    vi.mocked(credencialesDelEntorno).mockReturnValue(null);
    const apple = pase(1, PROGRAMA_PAUSADO);
    const google = pase(2, PROGRAMA_PAUSADO);
    const fake = armar([apple, google]);

    const r = await correr(fake);

    expect(r.plataformas).toEqual(["google"]);
    expect(r.avisados).toBe(1);
    expect(google.pase_en_pausa).toBe(true);
    // El de Apple queda intacto, esperando a que pongan el certificado.
    expect(apple.pase_en_pausa).toBe(false);
    expect(vi.mocked(avisarPaseActualizado)).not.toHaveBeenCalled();
  });

  it("sin llaves de ninguna de las dos no toca la base y no revienta", async () => {
    vi.mocked(credencialesDelEntorno).mockReturnValue(null);
    vi.mocked(credencialesGoogleDelEntorno).mockReturnValue(null);
    const fake = armar([pase(1, PROGRAMA_PAUSADO)]);

    const r = await correr(fake);

    expect(r.plataformas).toEqual([]);
    expect(r.avisados).toBe(0);
    expect(r.nota).toContain("Ni Apple ni Google");
    expect(fake.bitacora).toHaveLength(0);
  });

  it("sin la migración 0147 no avisa nada y lo deja escrito", async () => {
    const fake = armar([pase(1, PROGRAMA_PAUSADO)]);
    fake.errores.set("pases_wallet:select", {
      code: "42703",
      message: 'column pases_wallet.pase_en_pausa does not exist',
    });

    const r = await correr(fake);

    expect(r.avisados).toBe(0);
    expect(r.nota).toContain("0147");
  });

  it("sin conexión de servicio contesta en vez de tirar", async () => {
    const r = await sincronizarAvisoDePausa({ db: null });
    expect(r.avisados).toBe(0);
    expect(r.nota).toContain("llave de servicio");
  });
});
