import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseEnMemoria, type Fila } from "@/lib/lealtad/impulsos/db-memoria";
import { MOTIVOS } from "@/lib/lealtad/impulsos/motivos";
import { PLANTILLAS } from "@/lib/lealtad/impulsos/preconfigurados";

/**
 * POST /api/plataforma/foorkie/impulsos (+ historial, guardar, estado, duplicar, eliminar, plantilla, reintentar),
 * de punta a punta: la firma de verdad, la puerta de la caja de verdad (`abrirLaCaja`), la guardia de la marca de
 * verdad (`localDeFoorkieDeLaTarjeta`) y el servicio de verdad, contra una base en memoria que aplica los filtros.
 *
 * Lo que se fija:
 *   · firma mala → 401; tarjeta no vinculada → 403 `no_vinculado`; vinculada SIN la marca `lealtad_por_foorkie`
 *     (Pura Matcha) → 403 `no_es_de_foorkie` y NO se lee ni se escribe nada de los impulsos;
 *   · una tarjeta o un impulso de OTRO negocio se rechaza y no se toca;
 *   · guardar inválido → 422 con `problemas`; activar valida todo; eliminar con historial archiva;
 *   · quien actúa (`creado_por`) es el dueño del negocio;
 *   · sin la migración 0254 → 503 `sin_migracion`, nunca un 500 crudo;
 *   · NINGUNA respuesta de las rutas dice «Bookea» (el catálogo, los motivos, los problemas, el historial).
 */

let base: BaseEnMemoria;

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => base.cliente }));
vi.mock("@/lib/lealtad/identidades-db", () => ({
  identidadesDeMiembros: async (_db: unknown, miembros: { id: string }[]) =>
    new Map(miembros.map((m) => [m.id, { nombre: "Ana Lucía Pérez", correo: null }])),
}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (ruta: string) => revalidatePath(ruta) }));

import { POST as leer } from "./route";
import { POST as historial } from "./historial/route";
import { POST as guardar } from "./guardar/route";
import { POST as estado } from "./estado/route";
import { POST as duplicar } from "./duplicar/route";
import { POST as eliminar } from "./eliminar/route";
import { POST as plantilla } from "./plantilla/route";
import { POST as reintentar } from "./reintentar/route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const RANCHO = id(1);
const PROGRAMA = id(2);
const DUENO = id(5);
// Pura Matcha: un negocio de Bookea vinculado a un local de Foorkie, pero SIN la marca de Foorkie Lealtad.
const RANCHO_MATCHA = id(7);
const PROGRAMA_MATCHA = id(8);
// Otro negocio cualquiera, sin vínculo con Foorkie.
const RANCHO_AJENO = id(3);
const PROGRAMA_AJENO = id(4);

const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };
const bienvenida = PLANTILLAS.find((p) => p.id === "bienvenida")!.entrada("sellos");

const RUTAS = {
  impulsos: { ruta: "impulsos", POST: leer },
  historial: { ruta: "impulsos/historial", POST: historial },
  guardar: { ruta: "impulsos/guardar", POST: guardar },
  estado: { ruta: "impulsos/estado", POST: estado },
  duplicar: { ruta: "impulsos/duplicar", POST: duplicar },
  eliminar: { ruta: "impulsos/eliminar", POST: eliminar },
  plantilla: { ruta: "impulsos/plantilla", POST: plantilla },
  reintentar: { ruta: "impulsos/reintentar", POST: reintentar },
} as const;
type NombreDeRuta = keyof typeof RUTAS;

/** Un cuerpo válido para cada ruta, sobre la tarjeta que se le diga. */
function cuerpoValido(ruta: NombreDeRuta, v: { rancho_id: string; programa_id: string }): Record<string, unknown> {
  switch (ruta) {
    case "impulsos":
    case "historial":
      return { ...v };
    case "guardar":
      return { ...v, impulso_id: null, impulso: bienvenida };
    case "estado":
      return { ...v, impulso_id: id(101), estado: "activo" };
    case "duplicar":
    case "eliminar":
      return { ...v, impulso_id: id(101) };
    case "plantilla":
      return { ...v, plantilla_id: "bienvenida" };
    case "reintentar":
      return { ...v, tarea_id: id(301) };
  }
}

function firmado(ruta: string, cuerpo: Record<string, unknown>, firmaMala = false): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", firmaMala ? "otro-secreto" : SECRETO).update(`${t}.${texto}`).digest("hex");
  return new Request(`https://www.bookea.lat/api/plataforma/foorkie/${ruta}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

type Respuesta = { status: number; cuerpo: Record<string, unknown>; texto: string };

async function llamar(ruta: NombreDeRuta, cuerpo: Record<string, unknown>, firmaMala = false): Promise<Respuesta> {
  const r = await RUTAS[ruta].POST(firmado(RUTAS[ruta].ruta, cuerpo, firmaMala));
  const texto = await r.text();
  return { status: r.status, cuerpo: JSON.parse(texto) as Record<string, unknown>, texto };
}

function impulso(n: number, extra: Fila = {}, programa = PROGRAMA, rancho = RANCHO): Fila {
  return {
    id: id(100 + n),
    rancho_id: rancho,
    programa_id: programa,
    ...structuredClone(bienvenida),
    estado: "borrador",
    version: 1,
    activado_en: null,
    ultimo_escaneo_en: null,
    creado_por: null,
    created_at: `2026-10-0${n}T10:00:00.000Z`,
    updated_at: `2026-10-0${n}T10:00:00.000Z`,
    ...extra,
  };
}

function tarea(n: number, impulsoId: string, estadoTarea: string, extra: Fila = {}): Fila {
  return {
    id: id(300 + n),
    impulso_id: impulsoId,
    rancho_id: RANCHO,
    programa_id: PROGRAMA,
    miembro_id: "m-ana",
    canal: "wallet",
    estado: estadoTarea,
    ejecutar_en: `2026-10-${String(10 + n).padStart(2, "0")}T12:00:00.000Z`,
    enviada_en: null,
    intentos: 0,
    motivo: null,
    detalle: null,
    mensaje_titulo: "¡Hola!",
    mensaje_cuerpo: "Gracias",
    created_at: `2026-10-15T12:0${n}:00.000Z`,
    ...extra,
  };
}

const tabla = (nombre: string) => base.filas(nombre);
const fila = (nombre: string, idFila: string) => base.filas(nombre).find((f) => f.id === idFila);

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  revalidatePath.mockClear();
  const programa = (idP: string, idR: string): Fila => ({
    id: idP,
    rancho_id: idR,
    nombre: "Tarjeta de sellos",
    modo: "sellos",
    estado: "activo",
    activo: true,
    vigente_desde: null,
    vigente_hasta: null,
    cuenta_id: null,
  });
  base = new BaseEnMemoria({
    foorkie_restaurantes: [
      { id: "local-1", slug: "donde-george", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: true, activo: true, estado_publicacion: "aprobado", created_at: "2026-01-01T00:00:00Z" },
      { id: "local-2", slug: "pura-matcha", bookea_rancho_id: RANCHO_MATCHA, bookea_programa_id: PROGRAMA_MATCHA, lealtad_por_foorkie: false, activo: true, estado_publicacion: "aprobado", created_at: "2026-01-01T00:00:00Z" },
    ],
    ranchos: [
      { id: RANCHO, owner_id: DUENO, nombre: "Donde George", zona_horaria: "America/Costa_Rica" },
      { id: RANCHO_MATCHA, owner_id: id(9), nombre: "Pura Matcha", zona_horaria: "America/Costa_Rica" },
      { id: RANCHO_AJENO, owner_id: id(6), nombre: "Otro negocio", zona_horaria: "America/Costa_Rica" },
    ],
    programa_lealtad: [programa(PROGRAMA, RANCHO), programa(PROGRAMA_MATCHA, RANCHO_MATCHA), programa(PROGRAMA_AJENO, RANCHO_AJENO)],
    recompensas: [
      { id: id(10), programa_id: PROGRAMA, nombre: "Café gratis", costo_puntos: 5, activo: true },
      { id: id(11), programa_id: PROGRAMA_MATCHA, nombre: "Matcha gratis", costo_puntos: 8, activo: true },
    ],
    impulsos_lealtad: [],
    impulsos_tareas: [],
    miembros: [{ id: "m-ana", programa_id: PROGRAMA, persona_id: null, cliente_id: null }],
  });
});

// ════════════════════════════════════════════════════════════════════
//  LA PUERTA
// ════════════════════════════════════════════════════════════════════

describe("la puerta", () => {
  it.each(Object.keys(RUTAS) as NombreDeRuta[])("%s: una firma mala es 401 y no se toca nada", async (ruta) => {
    const r = await llamar(ruta, cuerpoValido(ruta, vinculo), true);
    expect(r).toMatchObject({ status: 401, cuerpo: { ok: false, codigo: "firma" } });
    expect(base.anotaciones).toEqual([]);
  });

  it.each(Object.keys(RUTAS) as NombreDeRuta[])("%s: sin la llave de la conexión es 503 no_configurado", async (ruta) => {
    vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", "");
    try {
      const r = await llamar(ruta, cuerpoValido(ruta, vinculo));
      expect(r).toMatchObject({ status: 503, cuerpo: { ok: false, codigo: "no_configurado" } });
      expect(base.anotaciones).toEqual([]);
    } finally {
      vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO);
    }
  });

  it("un cuerpo que no es JSON de objeto: 400 y nada más", async () => {
    const texto = "esto no es json";
    const t = Date.now();
    const v1 = createHmac("sha256", SECRETO).update(`${t}.${texto}`).digest("hex");
    const peticion = new Request("https://www.bookea.lat/api/plataforma/foorkie/impulsos", {
      method: "POST",
      headers: { "x-foorkie-firma": `t=${t},v1=${v1}` },
      body: texto,
    });
    expect((await leer(peticion)).status).toBe(400);
    expect(base.anotaciones).toEqual([]);
  });

  it("`guardar` acepta un impulso grande (más de 4.000 caracteres); las demás rutas no", async () => {
    const grande = { ...bienvenida, descripcion: "d".repeat(240), condiciones: Array.from({ length: 12 }, () => ({ campo: "visitas", op: "gte", valor: 1 })), relleno: "x".repeat(5000) };
    expect(JSON.stringify({ ...vinculo, impulso: grande }).length).toBeGreaterThan(4000);
    expect((await llamar("guardar", { ...vinculo, impulso_id: null, impulso: grande })).status).toBe(200);
    const enorme = { ...vinculo, impulso_id: null, impulso: { ...bienvenida, relleno: "x".repeat(20_000) } };
    expect((await llamar("guardar", enorme)).status).toBe(413);
    expect((await llamar("duplicar", { ...cuerpoValido("duplicar", vinculo), relleno: "x".repeat(5000) })).status).toBe(413);
  });
});

describe("el cuerpo mal armado es 400 `datos` y no toca la base", () => {
  const casos: [string, NombreDeRuta, Record<string, unknown>][] = [
    ["sin negocio ni tarjeta", "impulsos", {}],
    ["negocio que no es un uuid", "impulsos", { rancho_id: "uno", programa_id: PROGRAMA }],
    ["historial: estado que no existe", "historial", { ...vinculo, estado: "rarísimo" }],
    ["historial: impulso_id que no es un uuid", "historial", { ...vinculo, impulso_id: "x" }],
    ["historial: página que no es un número", "historial", { ...vinculo, pagina: "dos" }],
    ["guardar: sin impulso", "guardar", { ...vinculo, impulso_id: null }],
    ["guardar: impulso que no es un objeto", "guardar", { ...vinculo, impulso_id: null, impulso: "hola" }],
    ["guardar: impulso que es una lista", "guardar", { ...vinculo, impulso_id: null, impulso: [1] }],
    ["guardar: impulso_id que no es un uuid", "guardar", { ...vinculo, impulso_id: "x", impulso: bienvenida }],
    ["estado: sin impulso", "estado", { ...vinculo, estado: "activo" }],
    ["estado: estado que no existe", "estado", { ...vinculo, impulso_id: id(101), estado: "volando" }],
    ["estado: sin estado", "estado", { ...vinculo, impulso_id: id(101) }],
    ["duplicar: sin impulso", "duplicar", { ...vinculo }],
    ["eliminar: impulso_id que no es un uuid", "eliminar", { ...vinculo, impulso_id: "x" }],
    ["plantilla: sin plantilla_id", "plantilla", { ...vinculo }],
    ["plantilla: plantilla_id que no es texto", "plantilla", { ...vinculo, plantilla_id: 5 }],
    ["reintentar: tarea_id que no es un uuid", "reintentar", { ...vinculo, tarea_id: "x" }],
    ["reintentar: confirmar_riesgo que no es booleano", "reintentar", { ...vinculo, tarea_id: id(301), confirmar_riesgo: "sí" }],
  ];
  it.each(casos)("%s", async (_nombre, ruta, cuerpo) => {
    const r = await llamar(ruta, cuerpo);
    expect(r).toMatchObject({ status: 400, cuerpo: { ok: false, codigo: "datos", motivo: expect.any(String) } });
    expect(base.anotaciones).toEqual([]);
  });
});

describe("el vínculo: una tarjeta que no es de ese negocio, o que no está en Foorkie", () => {
  it.each(Object.keys(RUTAS) as NombreDeRuta[])("%s: la tarjeta de OTRO negocio con mi negocio es 403 no_vinculado", async (ruta) => {
    const r = await llamar(ruta, cuerpoValido(ruta, { rancho_id: RANCHO, programa_id: PROGRAMA_AJENO }));
    expect(r).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_vinculado" } });
    expect(base.tocoImpulsos()).toEqual([]);
    expect(base.escrituras()).toEqual([]);
  });

  it.each(Object.keys(RUTAS) as NombreDeRuta[])("%s: un negocio que Foorkie no tiene vinculado es 403 no_vinculado", async (ruta) => {
    const r = await llamar(ruta, cuerpoValido(ruta, { rancho_id: RANCHO_AJENO, programa_id: PROGRAMA_AJENO }));
    expect(r).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_vinculado" } });
    expect(base.tocoImpulsos()).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
//  LA GUARDIA DE LA MARCA
// ════════════════════════════════════════════════════════════════════

describe("sin la marca de Foorkie (Pura Matcha): 403 y nada más", () => {
  const matcha = { rancho_id: RANCHO_MATCHA, programa_id: PROGRAMA_MATCHA };

  it.each(Object.keys(RUTAS) as NombreDeRuta[])("%s", async (ruta) => {
    // Con impulsos y mensajes de Pura Matcha ya en la base: tampoco se leen ni se tocan.
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo" }, PROGRAMA_MATCHA, RANCHO_MATCHA));
    tabla("impulsos_tareas").push(tarea(1, id(101), "fallida", { programa_id: PROGRAMA_MATCHA, rancho_id: RANCHO_MATCHA }));
    const antes = structuredClone(base.tablas);

    const cuerpo = cuerpoValido(ruta, matcha);
    const r = await llamar(ruta, cuerpo);
    expect(r).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_es_de_foorkie", motivo: expect.any(String) } });
    expect(r.texto).not.toMatch(/bookea/i);
    // Ni una consulta a las tablas de los impulsos, ni una sola escritura, y las filas quedan como estaban.
    expect(base.tocoImpulsos()).toEqual([]);
    expect(base.escrituras()).toEqual([]);
    expect(base.tablas).toEqual(antes);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("si quitan la marca a la tarjeta de Foorkie, deja de contestar", async () => {
    tabla("foorkie_restaurantes")[0].lealtad_por_foorkie = false;
    expect(await llamar("impulsos", vinculo)).toMatchObject({ status: 403, cuerpo: { codigo: "no_es_de_foorkie" } });
    expect(base.tocoImpulsos()).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
//  impulsos (lee)
// ════════════════════════════════════════════════════════════════════

describe("impulsos", () => {
  it("la tarjeta, los impulsos con su conteo, las plantillas y el catálogo", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo", activado_en: "2026-10-02T00:00:00Z" }), impulso(2));
    tabla("impulsos_tareas").push(tarea(1, id(101), "enviada", { enviada_en: "2026-10-12T12:00:00.000Z" }), tarea(2, id(101), "fallida"));
    const r = await llamar("impulsos", vinculo);
    expect(r.status).toBe(200);
    const c = r.cuerpo as {
      ok: boolean;
      contexto: Record<string, unknown>;
      impulsos: Fila[];
      plantillas: Fila[];
      catalogo: { activadores: Fila[]; canales: Fila[]; condiciones: Fila[]; etiquetasOp: Fila; variables: Fila[]; topes: Fila };
    };
    expect(c.ok).toBe(true);
    // Sin `esFoorkie` ni `correoConfigurado`: acá siempre es de Foorkie.
    expect(c.contexto).toEqual({
      programaId: PROGRAMA,
      nombrePrograma: "Tarjeta de sellos",
      nombreNegocio: "Donde George",
      modo: "sellos",
      zona: "America/Costa_Rica",
      hoy: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      tieneRecompensa: true,
      recompensa: "Café gratis",
      meta: 5,
      tarjetaOpera: true,
    });
    expect(c.impulsos.map((i) => i.id)).toEqual([id(102), id(101)]);
    expect(c.impulsos[1]).toMatchObject({
      id: id(101),
      estado: "activo",
      nombre: "Bienvenida",
      activador: "inscripcion",
      canal: "wallet",
      conteo: { enviada: 1, fallida: 1, programada: 0 },
      ultimoEnvio: "2026-10-12T12:00:00.000Z",
    });
    expect(c.impulsos[0]).toMatchObject({ ultimoEnvio: null, conteo: { enviada: 0 } });
    expect(c.plantillas.map((p) => p.id)).toEqual(PLANTILLAS.map((p) => p.id));
    expect(c.plantillas.find((p) => p.id === "cumpleanos")).toMatchObject({ disponible: false, motivo: expect.stringMatching(/Foorkie Lealtad/) });
    expect(c.catalogo.activadores).toHaveLength(13);
    expect(c.catalogo.canales.map((x) => [x.id, x.disponible])).toEqual([
      ["wallet", true],
      ["correo", false],
      ["sms", false],
      ["whatsapp", false],
      ["push_web", false],
    ]);
    expect(c.catalogo.topes).toEqual({ maxImpulsosPorTarjeta: 40, topeDiarioPorCliente: 3, maxCondiciones: 12, nombreMax: 80, descripcionMax: 240, tituloMax: 60, cuerpoMax: 600 });
    expect(c.catalogo.variables.find((v) => v.id === "nombre_negocio")?.ejemplo).toBe("Donde George");
    expect(c.catalogo.condiciones.find((x) => x.id === "saldo")?.etiqueta).toBe("Sellos actuales");
  });

  it("solo lee, y la respuesta no se guarda en caché", async () => {
    tabla("impulsos_lealtad").push(impulso(1));
    const r = await RUTAS.impulsos.POST(firmado("impulsos", vinculo));
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(base.escrituras()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("solo ve los impulsos de SU tarjeta", async () => {
    tabla("impulsos_lealtad").push(impulso(1), impulso(2, {}, PROGRAMA_AJENO, RANCHO_AJENO), impulso(3, {}, PROGRAMA_MATCHA, RANCHO_MATCHA));
    const r = await llamar("impulsos", vinculo);
    expect((r.cuerpo.impulsos as Fila[]).map((i) => i.id)).toEqual([id(101)]);
  });

  it("el catálogo se adapta al tipo de tarjeta", async () => {
    tabla("programa_lealtad")[0].modo = "cashback";
    const r = await llamar("impulsos", vinculo);
    const c = r.cuerpo.catalogo as { condiciones: Fila[]; variables: Fila[]; activadores: Fila[] };
    expect(c.condiciones.find((x) => x.id === "saldo")?.etiqueta).toBe("Saldo de cashback");
    expect(c.variables.map((v) => v.id)).toContain("puntos_disponibles");
    expect(c.activadores.find((a) => a.id === "sello_registrado")?.aplica).toBe(false);
  });

  it("sin la migración 0254: 503 sin_migracion", async () => {
    base.errores.impulsos_lealtad = { code: "42P01", message: 'relation "public.impulsos_lealtad" does not exist' };
    const r = await llamar("impulsos", vinculo);
    expect(r).toMatchObject({ status: 503, cuerpo: { ok: false, codigo: "sin_migracion", motivo: expect.any(String) } });
    expect(r.texto).not.toMatch(/bookea|relation|supabase/i);
  });

  it("si la base no contesta al leer la tarjeta (ya pasada la puerta): 500 error_base, no una excepción", async () => {
    // La puerta lee `rancho_id` de la tarjeta; el servicio lee el nombre, el tipo y el estado. Se rompe solo lo segundo.
    base.errores.programa_lealtad = (pedido) => (pedido.columnas.includes("nombre") ? { code: "XX000", message: "conexión caída en 10.0.0.7" } : null);
    for (const ruta of Object.keys(RUTAS) as NombreDeRuta[]) {
      const r = await llamar(ruta, cuerpoValido(ruta, vinculo));
      expect(r).toMatchObject({ status: 500, cuerpo: { ok: false, codigo: "error_base", motivo: expect.any(String) } });
      expect(r.texto).not.toMatch(/10\.0\.0\.7|conexión caída/);
    }
    expect(base.escrituras()).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
//  historial (lee)
// ════════════════════════════════════════════════════════════════════

describe("impulsos/historial", () => {
  it("las filas con el motivo en la voz de Foorkie, de a 25, y filtra", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo" }), impulso(2, { estado: "activo" }));
    tabla("impulsos_tareas").push(
      tarea(1, id(101), "omitida", { motivo: "sin_canal_individual" }),
      tarea(2, id(101), "omitida", { motivo: "correo_lo_manda_foorkie" }),
      tarea(3, id(102), "fallida", { motivo: "resultado_incierto" }),
      tarea(4, id(102), "enviada", { enviada_en: "2026-10-14T12:00:00.000Z" }),
    );
    const r = await llamar("historial", vinculo);
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ ok: true, total: 4, pagina: 0, porPagina: 25 });
    const filas = r.cuerpo.filas as Fila[];
    expect(filas.map((f) => f.id)).toEqual([id(304), id(303), id(302), id(301)]);
    expect(filas.find((f) => f.id === id(301))).toMatchObject({
      impulsoId: id(101),
      impulsoNombre: "Bienvenida",
      cliente: "Ana",
      canal: "wallet",
      estado: "omitida",
      motivo: "sin_canal_individual",
      motivoTexto: "Solo tiene Apple Wallet y no se pudo avisar a su iPhone.",
      reintentable: false,
    });
    expect(filas.find((f) => f.id === id(302))?.motivoTexto).toBe("Los correos de los impulsos todavía no salen desde Foorkie Lealtad.");
    expect(filas.find((f) => f.id === id(303))).toMatchObject({ reintentable: true, reintentoConRiesgo: true, motivoTexto: MOTIVOS.resultado_incierto });

    const fallidas = await llamar("historial", { ...vinculo, estado: "fallida" });
    expect((fallidas.cuerpo.filas as Fila[]).map((f) => f.id)).toEqual([id(303)]);
    const deUno = await llamar("historial", { ...vinculo, impulso_id: id(101) });
    expect(deUno.cuerpo.total).toBe(2);
    const otraPagina = await llamar("historial", { ...vinculo, pagina: 3 });
    expect(otraPagina.cuerpo).toMatchObject({ ok: true, filas: [], total: 4, pagina: 3 });
    expect(base.escrituras()).toEqual([]);
  });

  it("no mezcla los mensajes de otras tarjetas", async () => {
    tabla("impulsos_lealtad").push(impulso(1));
    tabla("impulsos_tareas").push(tarea(1, id(101), "enviada"), tarea(2, id(101), "enviada", { programa_id: PROGRAMA_AJENO, rancho_id: RANCHO_AJENO }));
    const r = await llamar("historial", vinculo);
    expect((r.cuerpo.filas as Fila[]).map((f) => f.id)).toEqual([id(301)]);
  });

  it("sin la migración: 503 sin_migracion", async () => {
    base.errores.impulsos_tareas = { code: "42P01", message: 'relation "impulsos_tareas" does not exist' };
    expect(await llamar("historial", vinculo)).toMatchObject({ status: 503, cuerpo: { codigo: "sin_migracion" } });
  });
});

// ════════════════════════════════════════════════════════════════════
//  guardar
// ════════════════════════════════════════════════════════════════════

describe("impulsos/guardar", () => {
  it("crea un BORRADOR a nombre del dueño, con la tarjeta del servidor", async () => {
    const r = await llamar("guardar", {
      ...vinculo,
      impulso_id: null,
      impulso: { ...bienvenida, rancho_id: RANCHO_AJENO, programa_id: PROGRAMA_AJENO, estado: "activo", version: 50, creado_por: "intruso" },
    });
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, id: expect.any(String), avisos: [] } });
    const nuevo = tabla("impulsos_lealtad")[0];
    expect(nuevo).toMatchObject({ id: r.cuerpo.id, rancho_id: RANCHO, programa_id: PROGRAMA, estado: "borrador", creado_por: DUENO, nombre: "Bienvenida", canal: "wallet", version: 1 });
    expect(nuevo.activado_en).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith(`/lealtad/panel/${RANCHO}`);
  });

  it("`impulso_id` ausente también es uno nuevo", async () => {
    expect((await llamar("guardar", { ...vinculo, impulso: bienvenida })).status).toBe(200);
    expect(tabla("impulsos_lealtad")).toHaveLength(1);
  });

  it("un impulso inválido: 422 validacion con los problemas, en la voz de Foorkie, y no se escribe", async () => {
    const r = await llamar("guardar", { ...vinculo, impulso_id: null, impulso: { ...bienvenida, nombre: "x", titulo: "", canal: "correo", activador: "nivel_alcanzado" } });
    expect(r.status).toBe(422);
    expect(r.cuerpo).toMatchObject({ ok: false, codigo: "validacion", motivo: "Revisá los datos marcados antes de guardar." });
    const problemas = r.cuerpo.problemas as { campo: string; mensaje: string }[];
    expect(problemas.map((p) => p.campo).sort()).toEqual(["activador", "canal", "nombre", "titulo"]);
    expect(problemas.find((p) => p.campo === "activador")?.mensaje).toBe("Las tarjetas de Foorkie Lealtad no tienen niveles de cliente, así que no hay un nivel que alcanzar.");
    expect(problemas.find((p) => p.campo === "canal")?.mensaje).toMatch(/todavía no salen desde Foorkie Lealtad/);
    expect(r.texto).not.toMatch(/bookea/i);
    expect(tabla("impulsos_lealtad")).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un borrador a medias se guarda; el aviso de las variables sin alternativo viaja en `avisos`", async () => {
    const r = await llamar("guardar", { ...vinculo, impulso_id: null, impulso: { ...bienvenida, titulo: "Hola {{nombre_cliente}}" } });
    expect(r.status).toBe(200);
    expect((r.cuerpo.avisos as string[]).join(" ")).toMatch(/nombre_cliente/);
  });

  it("edita uno existente: sube la versión", async () => {
    tabla("impulsos_lealtad").push(impulso(1));
    const r = await llamar("guardar", { ...vinculo, impulso_id: id(101), impulso: { ...bienvenida, titulo: "Otro título" } });
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, id: id(101) } });
    expect(fila("impulsos_lealtad", id(101))).toMatchObject({ version: 2, titulo: "Otro título", estado: "borrador" });
  });

  it("uno archivado no se edita: 409 no_editable", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "archivado" }));
    expect(await llamar("guardar", { ...vinculo, impulso_id: id(101), impulso: bienvenida })).toMatchObject({ status: 409, cuerpo: { codigo: "no_editable" } });
  });

  it("uno ACTIVO no puede quedar inválido: 409 no_editable con los problemas, y no se toca", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo", activado_en: "2026-10-01T00:00:00Z" }));
    const r = await llamar("guardar", { ...vinculo, impulso_id: id(101), impulso: { ...bienvenida, cuerpo: "Hola {{variable_inexistente}}" } });
    expect(r).toMatchObject({ status: 409, cuerpo: { ok: false, codigo: "no_editable", problemas: [{ campo: "cuerpo" }] } });
    expect(fila("impulsos_lealtad", id(101))?.version).toBe(1);
  });

  it("el impulso de OTRA tarjeta se trata como inexistente: 404 sin_impulso", async () => {
    tabla("impulsos_lealtad").push(impulso(1, {}, PROGRAMA_AJENO, RANCHO_AJENO));
    const r = await llamar("guardar", { ...vinculo, impulso_id: id(101), impulso: { ...bienvenida, titulo: "Robado" } });
    expect(r).toMatchObject({ status: 404, cuerpo: { codigo: "sin_impulso" } });
    expect(fila("impulsos_lealtad", id(101))).toMatchObject({ titulo: bienvenida.titulo, version: 1 });
  });

  it("el tope de 40: 409 limite", async () => {
    for (let n = 0; n < 40; n++) tabla("impulsos_lealtad").push(impulso(1, { id: id(500 + n) }));
    const r = await llamar("guardar", { ...vinculo, impulso_id: null, impulso: bienvenida });
    expect(r).toMatchObject({ status: 409, cuerpo: { codigo: "limite", motivo: expect.stringMatching(/hasta 40 impulsos/) } });
    expect(tabla("impulsos_lealtad")).toHaveLength(40);
  });

  it("sin la migración 0254: 503 sin_migracion al crear y al editar, nunca un 500 crudo", async () => {
    base.errores.impulsos_lealtad = { code: "42P01", message: 'relation "impulsos_lealtad" does not exist' };
    for (const impulso_id of [null, id(101)]) {
      const r = await llamar("guardar", { ...vinculo, impulso_id, impulso: bienvenida });
      expect(r).toMatchObject({ status: 503, cuerpo: { ok: false, codigo: "sin_migracion" } });
      expect(r.texto).not.toMatch(/bookea|relation/i);
    }
  });

  it("un error cualquiera de la base al escribir: 500 error_base", async () => {
    base.errores["impulsos_lealtad:insert"] = { code: "XX000", message: "se cayó" };
    expect(await llamar("guardar", { ...vinculo, impulso_id: null, impulso: bienvenida })).toMatchObject({ status: 500, cuerpo: { codigo: "error_base" } });
  });
});

// ════════════════════════════════════════════════════════════════════
//  estado
// ════════════════════════════════════════════════════════════════════

describe("impulsos/estado", () => {
  it("activar vuelve a validar todo y sella `activado_en`", async () => {
    tabla("impulsos_lealtad").push(impulso(1));
    const antes = Date.now();
    const r = await llamar("estado", { ...vinculo, impulso_id: id(101), estado: "activo" });
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, estado: "activo", avisos: [] } });
    const f = fila("impulsos_lealtad", id(101))!;
    expect(f.estado).toBe("activo");
    expect(new Date(String(f.activado_en)).getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(revalidatePath).toHaveBeenCalledWith(`/lealtad/panel/${RANCHO}`);
  });

  it("no se activa un borrador que no pasa la validación: 422 con los problemas", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { cuerpo: "Hola {{inventada}}", activador: "meta_proxima" }));
    tabla("recompensas").splice(0, 1);
    const r = await llamar("estado", { ...vinculo, impulso_id: id(101), estado: "activo" });
    expect(r).toMatchObject({ status: 422, cuerpo: { ok: false, codigo: "validacion", motivo: "Todavía no se puede activar. Revisá lo marcado." } });
    const problemas = r.cuerpo.problemas as { campo: string; mensaje: string }[];
    expect(problemas.map((p) => p.campo).sort()).toEqual(["activador", "cuerpo"]);
    expect(problemas.find((p) => p.campo === "activador")?.mensaje).toMatch(/Creala primero en Premios\.$/);
    expect(r.texto).not.toMatch(/bookea/i);
    expect(fila("impulsos_lealtad", id(101))?.estado).toBe("borrador");
  });

  it("no se activa uno cuyo disparador está apagado", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { activador: "cumpleanos" }));
    expect(await llamar("estado", { ...vinculo, impulso_id: id(101), estado: "activo" })).toMatchObject({ status: 422, cuerpo: { codigo: "validacion" } });
  });

  it("pausar cancela lo que todavía no salió", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    tabla("impulsos_tareas").push(tarea(1, id(101), "programada"), tarea(2, id(101), "enviada"));
    expect(await llamar("estado", { ...vinculo, impulso_id: id(101), estado: "pausado" })).toMatchObject({ status: 200, cuerpo: { estado: "pausado" } });
    expect(tabla("impulsos_tareas").map((t) => [t.estado, t.motivo])).toEqual([
      ["cancelada", "impulso_pausado"],
      ["enviada", null],
    ]);
  });

  it("uno archivado no se reactiva: 409 estado_invalido; sí vuelve a borrador", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "archivado" }));
    expect(await llamar("estado", { ...vinculo, impulso_id: id(101), estado: "activo" })).toMatchObject({ status: 409, cuerpo: { codigo: "estado_invalido" } });
    expect(await llamar("estado", { ...vinculo, impulso_id: id(101), estado: "borrador" })).toMatchObject({ status: 200, cuerpo: { estado: "borrador" } });
  });

  it("un impulso que no existe, o de otra tarjeta: 404 sin_impulso", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo" }, PROGRAMA_AJENO, RANCHO_AJENO));
    expect(await llamar("estado", { ...vinculo, impulso_id: id(101), estado: "pausado" })).toMatchObject({ status: 404, cuerpo: { codigo: "sin_impulso" } });
    expect(await llamar("estado", { ...vinculo, impulso_id: id(777), estado: "pausado" })).toMatchObject({ status: 404, cuerpo: { codigo: "sin_impulso" } });
    expect(fila("impulsos_lealtad", id(101))?.estado).toBe("activo");
  });
});

// ════════════════════════════════════════════════════════════════════
//  duplicar, eliminar, plantilla, reintentar
// ════════════════════════════════════════════════════════════════════

describe("impulsos/duplicar", () => {
  it("una copia en borrador a nombre del dueño", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    const r = await llamar("duplicar", { ...vinculo, impulso_id: id(101) });
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, id: expect.any(String) } });
    expect(fila("impulsos_lealtad", String(r.cuerpo.id))).toMatchObject({ estado: "borrador", nombre: "Copia de Bienvenida", creado_por: DUENO, programa_id: PROGRAMA });
    expect(fila("impulsos_lealtad", id(101))?.estado).toBe("activo");
  });

  it("de otra tarjeta: 404; con el tope lleno: 409", async () => {
    tabla("impulsos_lealtad").push(impulso(1, {}, PROGRAMA_AJENO, RANCHO_AJENO));
    expect(await llamar("duplicar", { ...vinculo, impulso_id: id(101) })).toMatchObject({ status: 404, cuerpo: { codigo: "sin_impulso" } });
    for (let n = 0; n < 40; n++) tabla("impulsos_lealtad").push(impulso(2, { id: id(500 + n) }));
    expect(await llamar("duplicar", { ...vinculo, impulso_id: id(500) })).toMatchObject({ status: 409, cuerpo: { codigo: "limite" } });
  });
});

describe("impulsos/eliminar", () => {
  it("con historial se ARCHIVA y los mensajes quedan", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    tabla("impulsos_tareas").push(tarea(1, id(101), "enviada"), tarea(2, id(101), "programada"));
    const r = await llamar("eliminar", { ...vinculo, impulso_id: id(101) });
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, resultado: "archivado" } });
    expect(fila("impulsos_lealtad", id(101))?.estado).toBe("archivado");
    expect(tabla("impulsos_tareas").map((t) => t.estado)).toEqual(["enviada", "cancelada"]);
    expect(base.pedidos("impulsos_lealtad", "delete")).toEqual([]);
  });

  it("sin historial se borra del todo", async () => {
    tabla("impulsos_lealtad").push(impulso(1));
    expect(await llamar("eliminar", { ...vinculo, impulso_id: id(101) })).toMatchObject({ status: 200, cuerpo: { resultado: "eliminado" } });
    expect(tabla("impulsos_lealtad")).toEqual([]);
  });

  it("uno de otra tarjeta o negocio no se borra: 404 sin_impulso", async () => {
    tabla("impulsos_lealtad").push(impulso(1, {}, PROGRAMA_AJENO, RANCHO_AJENO), impulso(2, {}, PROGRAMA_MATCHA, RANCHO_MATCHA));
    expect(await llamar("eliminar", { ...vinculo, impulso_id: id(101) })).toMatchObject({ status: 404, cuerpo: { codigo: "sin_impulso" } });
    expect(await llamar("eliminar", { ...vinculo, impulso_id: id(102) })).toMatchObject({ status: 404, cuerpo: { codigo: "sin_impulso" } });
    expect(tabla("impulsos_lealtad")).toHaveLength(2);
  });
});

describe("impulsos/plantilla", () => {
  it("nace BORRADOR, adaptado al tipo de tarjeta, a nombre del dueño", async () => {
    const r = await llamar("plantilla", { ...vinculo, plantilla_id: "progreso" });
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, id: expect.any(String) } });
    expect(fila("impulsos_lealtad", String(r.cuerpo.id))).toMatchObject({ estado: "borrador", plantilla: "progreso", activador: "meta_proxima", creado_por: DUENO, titulo: "¡Te falta solo 1!" });
  });

  it("una apagada: 409 plantilla_no_disponible, con el porqué en la voz de Foorkie", async () => {
    const r = await llamar("plantilla", { ...vinculo, plantilla_id: "cumpleanos" });
    expect(r).toMatchObject({ status: 409, cuerpo: { ok: false, codigo: "plantilla_no_disponible" } });
    expect(r.cuerpo.motivo).toMatch(/Campaña de cumpleaños de Foorkie Lealtad/);
    expect(r.texto).not.toMatch(/bookea/i);
    expect(tabla("impulsos_lealtad")).toEqual([]);
  });

  it("una que no existe: 404 plantilla_no_existe; con el tope lleno: 409 limite", async () => {
    expect(await llamar("plantilla", { ...vinculo, plantilla_id: "no_existe" })).toMatchObject({ status: 404, cuerpo: { codigo: "plantilla_no_existe" } });
    for (let n = 0; n < 40; n++) tabla("impulsos_lealtad").push(impulso(1, { id: id(500 + n) }));
    expect(await llamar("plantilla", { ...vinculo, plantilla_id: "bienvenida" })).toMatchObject({ status: 409, cuerpo: { codigo: "limite" } });
  });
});

describe("impulsos/reintentar", () => {
  const preparar = (motivo: string | null, estadoImpulso = "activo", estadoTarea = "fallida") => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: estadoImpulso }));
    tabla("impulsos_tareas").push(tarea(1, id(101), estadoTarea, { motivo, intentos: 3, detalle: "x" }));
  };

  it("una fallida vuelve a la cola", async () => {
    preparar("error_proveedor");
    expect(await llamar("reintentar", cuerpoValido("reintentar", vinculo))).toEqual({ status: 200, cuerpo: { ok: true }, texto: '{"ok":true}' });
    expect(fila("impulsos_tareas", id(301))).toMatchObject({ estado: "programada", intentos: 0, motivo: null, detalle: null });
    expect(revalidatePath).toHaveBeenCalledWith(`/lealtad/panel/${RANCHO}`);
  });

  it("resultado incierto sin confirmar: 409 riesgo_de_duplicado; confirmado, sale", async () => {
    preparar("resultado_incierto");
    const sin = await llamar("reintentar", { ...cuerpoValido("reintentar", vinculo), confirmar_riesgo: false });
    expect(sin).toMatchObject({ status: 409, cuerpo: { codigo: "riesgo_de_duplicado", motivo: expect.stringMatching(/dos veces/) } });
    expect(fila("impulsos_tareas", id(301))?.estado).toBe("fallida");
    expect(await llamar("reintentar", { ...cuerpoValido("reintentar", vinculo), confirmar_riesgo: true })).toMatchObject({ status: 200, cuerpo: { ok: true } });
    expect(fila("impulsos_tareas", id(301))?.estado).toBe("programada");
  });

  it("una que no falló, o con el impulso pausado: 409 tarea_no_reintentable", async () => {
    preparar(null, "activo", "enviada");
    expect(await llamar("reintentar", cuerpoValido("reintentar", vinculo))).toMatchObject({ status: 409, cuerpo: { codigo: "tarea_no_reintentable" } });
    base.tablas.impulsos_lealtad = [];
    base.tablas.impulsos_tareas = [];
    preparar("error_proveedor", "pausado");
    expect(await llamar("reintentar", cuerpoValido("reintentar", vinculo))).toMatchObject({ status: 409, cuerpo: { codigo: "tarea_no_reintentable" } });
  });

  it("un mensaje de otra tarjeta no se toca", async () => {
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    tabla("impulsos_tareas").push(tarea(1, id(101), "fallida", { programa_id: PROGRAMA_AJENO, rancho_id: RANCHO_AJENO }));
    expect(await llamar("reintentar", cuerpoValido("reintentar", vinculo))).toMatchObject({ status: 409, cuerpo: { codigo: "tarea_no_reintentable" } });
    expect(fila("impulsos_tareas", id(301))?.estado).toBe("fallida");
  });
});

// ════════════════════════════════════════════════════════════════════
//  La voz
// ════════════════════════════════════════════════════════════════════

describe("ninguna respuesta dice «Bookea»", () => {
  it("ni el catálogo, ni los motivos del historial, ni las plantillas, ni los problemas, ni un solo `motivo`", async () => {
    // Un historial con TODOS los motivos que el motor sabe dar.
    tabla("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    Object.keys(MOTIVOS).forEach((motivo, n) => tabla("impulsos_tareas").push(tarea(n, id(101), "omitida", { motivo, ejecutar_en: `2026-10-${String(1 + (n % 28)).padStart(2, "0")}T00:00:00.000Z` })));
    const textos: string[] = [];

    const lectura = await llamar("impulsos", vinculo);
    textos.push(lectura.texto);
    for (let pagina = 0; pagina < 3; pagina++) textos.push((await llamar("historial", { ...vinculo, pagina })).texto);
    const filas = (await llamar("historial", { ...vinculo, pagina: 0 })).cuerpo.filas as Fila[];
    expect(filas.length).toBeGreaterThan(10);

    // Todas las ramas de fallo que dan un `motivo` o unos `problemas`.
    textos.push(
      (await llamar("guardar", { ...vinculo, impulso_id: null, impulso: { ...bienvenida, activador: "cumpleanos", canal: "sms", nombre: "" } })).texto,
      (await llamar("guardar", { ...vinculo, impulso_id: null, impulso: { ...bienvenida, activador: "vencimiento_proximo", canal: "whatsapp" } })).texto,
      (await llamar("guardar", { ...vinculo, impulso_id: null, impulso: { ...bienvenida, activador: "pase_google", canal: "push_web" } })).texto,
      (await llamar("guardar", { ...vinculo, impulso_id: null, impulso: { ...bienvenida, canal: "correo" } })).texto,
      (await llamar("plantilla", { ...vinculo, plantilla_id: "cumpleanos" })).texto,
      (await llamar("plantilla", { ...vinculo, plantilla_id: "vencimiento" })).texto,
      (await llamar("plantilla", { ...vinculo, plantilla_id: "no_existe" })).texto,
      (await llamar("estado", { ...vinculo, impulso_id: id(777), estado: "activo" })).texto,
      (await llamar("reintentar", cuerpoValido("reintentar", vinculo))).texto,
    );
    base.errores.impulsos_lealtad = { code: "42P01", message: 'relation "impulsos_lealtad" does not exist' };
    textos.push((await llamar("impulsos", vinculo)).texto);

    expect(textos.length).toBeGreaterThan(10);
    for (const t of textos) expect(t).not.toMatch(/bookea/i);
  });
});
