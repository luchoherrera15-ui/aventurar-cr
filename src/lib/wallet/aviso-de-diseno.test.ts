import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL AVISO DE QUE LA TARJETA CAMBIÓ, contra una base de mentira.
 *
 * Mismo criterio que `aviso-de-pausa.test.ts`, aplicado al otro
 * disparador que faltaba: el dueño edita el diseño o las reglas desde
 * `/lealtad/panel/[id]/editar/[programaId]` y eso tiene que llegar a
 * los pases YA instalados sin trabar el guardado.
 *
 *   · `marcarDisenoPendiente` enciende la bandera de todos los pases
 *     ACTIVOS de un programa con una sola pasada — es la puerta que
 *     llaman `guardarPrograma`/`guardarBeneficio`.
 *   · `sincronizarAvisoDeDiseno` es el trabajo por tandas que la
 *     apaga de a uno, reanudable e idempotente — el mismo mecanismo de
 *     reclamo con update condicional que ya prueba `aviso-de-pausa`.
 *
 * Apple y Google están mockeados: acá no se prueba la red, se prueba
 * que el recorrido llame lo que corresponde, cuántas veces, y qué
 * escribe cuando algo falla.
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
  agruparPorMotivo,
  marcarDisenoPendiente,
  sincronizarAvisoDeDiseno,
  type OpcionesDiseno,
} from "./aviso-de-diseno";
import type { Admin } from "./aviso-de-pausa";

// ── La base de mentira (mismo harness que aviso-de-pausa.test.ts) ────

type Fila = Record<string, unknown>;
type Filtro = { tipo: "eq" | "in"; campo: string; valor: unknown };
type ErrorFalso = { code?: string; message: string } | null;
type Respuesta = { data: Fila[] | null; error: ErrorFalso };

type Tablas = {
  miembros: Fila[];
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

function coincide(fila: Fila, filtro: Filtro): boolean {
  const valor = fila[filtro.campo];
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

const PROGRAMA = "aaaaaaaa-0000-0000-0000-000000000001";
const OTRO_PROGRAMA = "aaaaaaaa-0000-0000-0000-000000000002";

function miembro(n: number, programaId: string): Fila {
  return { id: `miembro-${n}`, programa_id: programaId };
}

function pase(n: number, miembroId: string, extra: Fila = {}): Fila {
  return {
    id: `pase-${String(n).padStart(3, "0")}`,
    serial_number: `serial-${n}`,
    plataforma: n % 2 === 0 ? "google" : "apple",
    miembro_id: miembroId,
    activo: true,
    diseno_pendiente: false,
    diseno_avisado_en: null,
    diseno_error: null,
    ...extra,
  };
}

function armar(miembros: Fila[], pases: Fila[]): BaseFalsa {
  return new BaseFalsa({
    miembros,
    pases_wallet: pases,
    registros_dispositivo: pases.map((p) => ({
      serial_number: p.serial_number,
      push_token: `token-${p.serial_number}`,
    })),
  });
}

const dormires: number[] = [];
function correr(fake: BaseFalsa, extra: Partial<OpcionesDiseno> = {}) {
  return sincronizarAvisoDeDiseno({
    db: fake as unknown as OpcionesDiseno["db"],
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

// ── LA FUNCIÓN PURA ────────────────────────────────────────────────────

describe("agruparPorMotivo", () => {
  it("junta los ids que fallaron por el mismo motivo", () => {
    const grupos = agruparPorMotivo([
      { id: "a", motivo: "APNs no responde." },
      { id: "b", motivo: "Google 503." },
      { id: "c", motivo: "APNs no responde." },
    ]);
    expect(grupos.get("APNs no responde.")).toEqual(["a", "c"]);
    expect(grupos.get("Google 503.")).toEqual(["b"]);
  });

  it("con la lista vacía no arma ningún grupo", () => {
    expect(agruparPorMotivo([])).toEqual(new Map());
  });

  it("recorta un motivo larguísimo para no fabricar un grupo por byte de más", () => {
    const largo = "x".repeat(500);
    const grupos = agruparPorMotivo([{ id: "a", motivo: largo }]);
    expect([...grupos.keys()][0]).toHaveLength(400);
  });
});

// ── marcarDisenoPendiente: LA PUERTA DEL GUARDADO ──────────────────────

describe("marcarDisenoPendiente", () => {
  it("enciende la bandera de todos los pases activos del programa", async () => {
    const miembros = [miembro(1, PROGRAMA), miembro(2, PROGRAMA)];
    const pases = [pase(1, "miembro-1"), pase(2, "miembro-2")];
    const fake = armar(miembros, pases);

    const r = await marcarDisenoPendiente(fake as unknown as Admin, PROGRAMA);

    expect(r).toEqual({ ok: true, marcados: 2 });
    expect(pases.every((p) => p.diseno_pendiente === true)).toBe(true);
  });

  it("no toca pases de OTRO programa ni pases inactivos", async () => {
    const miembros = [miembro(1, PROGRAMA), miembro(2, OTRO_PROGRAMA)];
    const inactivo = pase(3, "miembro-1", { activo: false });
    const ajeno = pase(4, "miembro-2");
    const fake = armar(miembros, [inactivo, ajeno]);

    const r = await marcarDisenoPendiente(fake as unknown as Admin, PROGRAMA);

    expect(r).toEqual({ ok: true, marcados: 0 });
    expect(inactivo.diseno_pendiente).toBe(false);
    expect(ajeno.diseno_pendiente).toBe(false);
  });

  it("un programa recién creado, sin miembros todavía, no falla", async () => {
    const fake = armar([], []);
    const r = await marcarDisenoPendiente(fake as unknown as Admin, PROGRAMA);
    expect(r).toEqual({ ok: true, marcados: 0 });
  });

  it("limpia el error viejo al volver a marcar", async () => {
    const miembros = [miembro(1, PROGRAMA)];
    const pases = [pase(1, "miembro-1", { diseno_error: "APNs no responde." })];
    const fake = armar(miembros, pases);

    await marcarDisenoPendiente(fake as unknown as Admin, PROGRAMA);

    expect(pases[0].diseno_error).toBeNull();
  });

  it("sin la migración 0150 no revienta: lo dice", async () => {
    const miembros = [miembro(1, PROGRAMA)];
    const fake = armar(miembros, [pase(1, "miembro-1")]);
    fake.errores.set("pases_wallet:update", {
      code: "42703",
      message: "column pases_wallet.diseno_pendiente does not exist",
    });

    const r = await marcarDisenoPendiente(fake as unknown as Admin, PROGRAMA);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("0150");
  });
});

// ── sincronizarAvisoDeDiseno: EL TRABAJO POR TANDAS ────────────────────

describe("entrega el cambio de diseño a los pases pendientes", () => {
  it("los marca a todos y va por tandas, con pausa entre ellas", async () => {
    const pases = [1, 2, 3, 4, 5].map((n) => pase(n, `m${n}`, { diseno_pendiente: true }));
    const fake = armar([], pases);

    const r = await correr(fake);

    expect(r.avisados).toBe(5);
    expect(r.fallidos).toBe(0);
    expect(pases.every((p) => p.diseno_pendiente === false)).toBe(true);
    expect(pases.every((p) => p.diseno_avisado_en !== null)).toBe(true);
    expect(dormires.length).toBeGreaterThanOrEqual(2);
    expect(dormires.every((ms) => ms === 5)).toBe(true);
  });

  it("Apple viaja por TANDA (una conexión), Google de a uno", async () => {
    const pases = [1, 3, 5].map((n) => pase(n, `m${n}`, { diseno_pendiente: true })); // impares = apple
    await correr(armar([], pases), { tamanoTanda: 3 });

    expect(vi.mocked(avisarPaseActualizado)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(avisarPaseActualizado).mock.calls[0][0]).toHaveLength(3);
    expect(vi.mocked(refrescarPaseGoogleDeMiembro)).not.toHaveBeenCalled();
  });

  it("no toca un pase sin la bandera encendida ni uno inactivo", async () => {
    const alDia = pase(1, "m1", { diseno_pendiente: false });
    const inactivo = pase(2, "m2", { diseno_pendiente: true, activo: false });
    const fake = armar([], [alDia, inactivo]);

    const r = await correr(fake);

    expect(r.avisados).toBe(0);
    expect(alDia.diseno_pendiente).toBe(false);
    expect(inactivo.diseno_pendiente).toBe(true);
  });
});

describe("correrlo dos veces no avisa dos veces", () => {
  it("la segunda corrida no manda un solo push", async () => {
    const fake = armar([], [1, 2, 3].map((n) => pase(n, `m${n}`, { diseno_pendiente: true })));

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

describe("si se corta a la mitad, la corrida siguiente sigue donde quedó", () => {
  it("con presupuesto de 2 sobre 5 pases hacen falta tres corridas", async () => {
    const pases = [1, 2, 3, 4, 5].map((n) => pase(n, `m${n}`, { diseno_pendiente: true }));
    const fake = armar([], pases);

    const a = await correr(fake, { maxPorCorrida: 2 });
    expect(a.avisados).toBe(2);
    expect(a.quedaTrabajo).toBe(true);

    const b = await correr(fake, { maxPorCorrida: 2 });
    expect(b.avisados).toBe(2);

    const c = await correr(fake, { maxPorCorrida: 2 });
    expect(c.avisados).toBe(1);
    expect(c.quedaTrabajo).toBe(false);

    expect(pases.every((p) => p.diseno_pendiente === false)).toBe(true);
  });
});

describe("cuando Apple o Google no contestan", () => {
  it("el pase vuelve a la bandera encendida y el motivo queda escrito", async () => {
    vi.mocked(avisarPaseActualizado).mockResolvedValue({
      ok: false,
      motivo: "El certificado del pase venció el 3 de marzo.",
    });
    const apple = pase(1, "m1", { diseno_pendiente: true }); // impar = apple
    const google = pase(2, "m2", { diseno_pendiente: true });
    const fake = armar([], [apple, google]);

    const r = await correr(fake, { tamanoTanda: 2 });

    expect(r.avisados).toBe(1);
    expect(r.fallidos).toBe(1);
    expect(apple.diseno_pendiente).toBe(true);
    expect(apple.diseno_error).toBe("El certificado del pase venció el 3 de marzo.");
    expect(google.diseno_pendiente).toBe(false);
    expect(google.diseno_error).toBeNull();
  });

  it("no se queda dando vueltas sobre el mismo pase que falla siempre", async () => {
    vi.mocked(avisarPaseActualizado).mockResolvedValue({ ok: false, motivo: "APNs no responde." });
    vi.mocked(refrescarPaseGoogleDeMiembro).mockResolvedValue({ ok: false, motivo: "Google 503." });
    const fake = armar([], [1, 2, 3, 4].map((n) => pase(n, `m${n}`, { diseno_pendiente: true })));

    const r = await correr(fake, { tamanoTanda: 2 });

    expect(r.fallidos).toBe(2);
    expect(vi.mocked(avisarPaseActualizado)).toHaveBeenCalledTimes(1);
  });
});

describe("un servidor a medio configurar", () => {
  it("sin certificados de Apple, solo atiende Google y lo dice", async () => {
    vi.mocked(credencialesDelEntorno).mockReturnValue(null);
    const apple = pase(1, "m1", { diseno_pendiente: true });
    const google = pase(2, "m2", { diseno_pendiente: true });
    const fake = armar([], [apple, google]);

    const r = await correr(fake);

    expect(r.plataformas).toEqual(["google"]);
    expect(r.avisados).toBe(1);
    expect(google.diseno_pendiente).toBe(false);
    expect(apple.diseno_pendiente).toBe(true);
    expect(vi.mocked(avisarPaseActualizado)).not.toHaveBeenCalled();
  });

  it("sin llaves de ninguna de las dos no toca la base y no revienta", async () => {
    vi.mocked(credencialesDelEntorno).mockReturnValue(null);
    vi.mocked(credencialesGoogleDelEntorno).mockReturnValue(null);
    const fake = armar([], [pase(1, "m1", { diseno_pendiente: true })]);

    const r = await correr(fake);

    expect(r.plataformas).toEqual([]);
    expect(r.avisados).toBe(0);
    expect(r.nota).toContain("Ni Apple ni Google");
    expect(fake.bitacora).toHaveLength(0);
  });

  it("sin la migración 0150 no avisa nada y lo deja escrito", async () => {
    const fake = armar([], [pase(1, "m1", { diseno_pendiente: true })]);
    fake.errores.set("pases_wallet:select", {
      code: "42703",
      message: "column pases_wallet.diseno_pendiente does not exist",
    });

    const r = await correr(fake);

    expect(r.avisados).toBe(0);
    expect(r.nota).toContain("0150");
  });

  it("sin conexión de servicio contesta en vez de tirar", async () => {
    const r = await sincronizarAvisoDeDiseno({ db: null });
    expect(r.avisados).toBe(0);
    expect(r.nota).toContain("llave de servicio");
  });
});
