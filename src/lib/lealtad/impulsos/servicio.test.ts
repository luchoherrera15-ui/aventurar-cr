import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOTIVOS } from "./motivos";
import { BaseEnMemoria, type Fila } from "./db-memoria";
import { PLANTILLAS } from "./preconfigurados";
import {
  faltaLaMigracion,
  POR_PAGINA,
  servicioCambiarEstado,
  servicioCrearDesdePlantilla,
  servicioDatos,
  servicioDuplicar,
  servicioEliminar,
  servicioGuardar,
  servicioHistorial,
  servicioReintentar,
  type ContextoDelServicio,
} from "./servicio";

/**
 * El servicio de impulsos contra una base en memoria: lo que NO depende de quién lo llame.
 *
 * Las acciones del panel de Bookea (`impulsos-actions.test.ts`) prueban su puerta —acceso y revalidación— y las rutas
 * de Foorkie (`/api/plataforma/foorkie/impulsos/route.test.ts`) la suya —firma, vínculo y marca—. Acá se prueba lo de
 * en medio: a qué tarjeta e impulso se puede llegar, qué se escribe, con qué códigos se falla y en qué voz se habla.
 */

vi.mock("@/lib/lealtad/identidades-db", () => ({
  identidadesDeMiembros: async (_db: unknown, miembros: { id: string }[]) =>
    new Map(miembros.map((m) => [m.id, { nombre: m.id === "m-ana" ? "ANA LUCÍA PÉREZ" : null, correo: null }])),
}));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const RANCHO = id(1);
const PROGRAMA = id(2);
const OTRO_RANCHO = id(3);
const OTRA_TARJETA = id(4);
const DUENO = id(5);

const FOORKIE: ContextoDelServicio = { ranchoId: RANCHO, programaId: PROGRAMA, actorId: DUENO, voz: "foorkie" };
const BOOKEA: ContextoDelServicio = { ranchoId: RANCHO, programaId: PROGRAMA, actorId: DUENO };

const bienvenida = PLANTILLAS.find((p) => p.id === "bienvenida")!.entrada("sellos");

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

function tarea(n: number, impulsoId: string, estado: string, extra: Fila = {}): Fila {
  return {
    id: id(300 + n),
    impulso_id: impulsoId,
    rancho_id: RANCHO,
    programa_id: PROGRAMA,
    miembro_id: "m-ana",
    canal: "wallet",
    estado,
    ejecutar_en: `2026-10-${String(10 + (n % 15)).padStart(2, "0")}T12:00:00.000Z`,
    enviada_en: null,
    intentos: 0,
    motivo: null,
    detalle: null,
    mensaje_titulo: "¡Hola!",
    mensaje_cuerpo: "Gracias",
    created_at: `2026-10-15T12:${String(n % 60).padStart(2, "0")}:00.000Z`,
    ...extra,
  };
}

let db: BaseEnMemoria;

beforeEach(() => {
  db = new BaseEnMemoria({
    foorkie_restaurantes: [
      { id: "local-1", slug: "donde-george", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: true, activo: true, estado_publicacion: "aprobado", created_at: "2026-01-01T00:00:00Z" },
    ],
    ranchos: [
      { id: RANCHO, owner_id: DUENO, nombre: "Donde George", zona_horaria: "America/Costa_Rica" },
      { id: OTRO_RANCHO, owner_id: id(6), nombre: "Otro negocio", zona_horaria: "America/Costa_Rica" },
    ],
    programa_lealtad: [
      { id: PROGRAMA, rancho_id: RANCHO, nombre: "Tarjeta de sellos", modo: "sellos", estado: "activo", activo: true, vigente_desde: null, vigente_hasta: null, cuenta_id: null },
      { id: OTRA_TARJETA, rancho_id: OTRO_RANCHO, nombre: "Otra tarjeta", modo: "sellos", estado: "activo", activo: true, vigente_desde: null, vigente_hasta: null, cuenta_id: null },
    ],
    recompensas: [{ id: id(10), programa_id: PROGRAMA, nombre: "Café gratis", costo_puntos: 5, activo: true }],
    impulsos_lealtad: [],
    impulsos_tareas: [],
    miembros: [{ id: "m-ana", programa_id: PROGRAMA, persona_id: null, cliente_id: null }],
  });
});

const dbDe = () => db.cliente;
const filasDe = (tabla: string) => db.filas(tabla);
const unico = (tabla: string, idFila: string) => db.filas(tabla).find((f) => f.id === idFila);

describe("a qué tarjeta se puede llegar", () => {
  it("una tarjeta de OTRO negocio es «sin_tarjeta» y no se toca nada de los impulsos", async () => {
    const ajena: ContextoDelServicio = { ...FOORKIE, programaId: OTRA_TARJETA };
    const resultados = [
      await servicioDatos(dbDe(), ajena),
      await servicioHistorial(dbDe(), ajena),
      await servicioGuardar(dbDe(), ajena, null, bienvenida),
      await servicioCambiarEstado(dbDe(), ajena, id(101), "activo"),
      await servicioDuplicar(dbDe(), ajena, id(101)),
      await servicioEliminar(dbDe(), ajena, id(101)),
      await servicioCrearDesdePlantilla(dbDe(), ajena, "bienvenida"),
      await servicioReintentar(dbDe(), ajena, id(301)),
    ];
    for (const r of resultados) expect(r).toMatchObject({ ok: false, codigo: "sin_tarjeta", motivo: "Esa tarjeta no es de este negocio." });
    expect(db.tocoImpulsos()).toEqual([]);
  });

  it("una tarjeta que no existe tampoco", async () => {
    expect(await servicioDatos(dbDe(), { ...FOORKIE, programaId: id(99) })).toMatchObject({ ok: false, codigo: "sin_tarjeta" });
  });

  it("un impulso de OTRA tarjeta se trata como inexistente, aunque el id sea válido", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }, OTRA_TARJETA, OTRO_RANCHO));
    const ajeno = id(101);
    for (const r of [
      await servicioGuardar(dbDe(), FOORKIE, ajeno, bienvenida),
      await servicioCambiarEstado(dbDe(), FOORKIE, ajeno, "pausado"),
      await servicioDuplicar(dbDe(), FOORKIE, ajeno),
      await servicioEliminar(dbDe(), FOORKIE, ajeno),
    ]) {
      expect(r).toMatchObject({ ok: false, codigo: "sin_impulso", motivo: "Ese impulso no existe en esta tarjeta." });
    }
    expect(unico("impulsos_lealtad", ajeno)).toMatchObject({ estado: "activo", version: 1 });
    expect(db.escrituras()).toEqual([]);
  });

  it("un mensaje de OTRA tarjeta no se reintenta", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    filasDe("impulsos_tareas").push(tarea(1, id(101), "fallida", { programa_id: OTRA_TARJETA, rancho_id: OTRO_RANCHO }));
    expect(await servicioReintentar(dbDe(), FOORKIE, id(301))).toMatchObject({ ok: false, codigo: "tarea_no_reintentable" });
    expect(unico("impulsos_tareas", id(301))?.estado).toBe("fallida");
  });
});

describe("servicioDatos", () => {
  it("la tarjeta, sus impulsos del más nuevo al más viejo y el conteo de cada uno", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }), impulso(2));
    filasDe("impulsos_tareas").push(
      tarea(1, id(101), "enviada", { enviada_en: "2026-10-12T12:00:00.000Z" }),
      tarea(2, id(101), "enviada", { enviada_en: "2026-10-14T12:00:00.000Z" }),
      tarea(3, id(101), "fallida"),
      tarea(4, id(101), "omitida"),
    );
    const r = await servicioDatos(dbDe(), FOORKIE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.info).toMatchObject({ programaId: PROGRAMA, ranchoId: RANCHO, nombreNegocio: "Donde George", modo: "sellos", meta: 5, recompensa: "Café gratis", esFoorkie: true, opera: true });
    expect(r.datos.impulsos.map((i) => i.id)).toEqual([id(102), id(101)]);
    const primero = r.datos.impulsos[1];
    expect(primero.conteo).toEqual({ programada: 0, pendiente: 0, procesando: 0, enviada: 2, entregada: 0, omitida: 1, fallida: 1, cancelada: 0 });
    expect(primero.ultimoEnvio).toBe("2026-10-14T12:00:00.000Z");
    expect(r.datos.impulsos[0].ultimoEnvio).toBeNull();
    expect(r.datos.impulsos[0].conteo.enviada).toBe(0);
  });

  it("solo lee: no escribe nada", async () => {
    filasDe("impulsos_lealtad").push(impulso(1));
    await servicioDatos(dbDe(), FOORKIE);
    expect(db.escrituras()).toEqual([]);
  });

  it("las plantillas apagadas explican su porqué en la voz que toca", async () => {
    const deFoorkie = await servicioDatos(dbDe(), FOORKIE);
    const deBookea = await servicioDatos(dbDe(), BOOKEA);
    if (!deFoorkie.ok || !deBookea.ok) throw new Error("tenían que salir bien");
    const cumple = (r: typeof deFoorkie.datos) => r.plantillas.find((p) => p.id === "cumpleanos")!;
    expect(cumple(deFoorkie.datos)).toMatchObject({ disponible: false, motivo: expect.stringMatching(/Campaña de cumpleaños de Foorkie Lealtad/) });
    expect(cumple(deBookea.datos)).toMatchObject({ disponible: false, motivo: expect.stringMatching(/^Bookea todavía no guarda/) });
    expect(deFoorkie.datos.plantillas.find((p) => p.id === "bienvenida")).toEqual({
      id: "bienvenida",
      nombre: "Bienvenida",
      resumen: "Un agradecimiento 5 minutos después de que el cliente se inscribe.",
      disponible: true,
    });
    expect(JSON.stringify(deFoorkie.datos.plantillas)).not.toMatch(/bookea/i);
  });

  it("sin la migración: «sin_migracion», en la voz que toca, nunca un error crudo", async () => {
    db.errores.impulsos_lealtad = { code: "42P01", message: 'relation "impulsos_lealtad" does not exist' };
    const deFoorkie = await servicioDatos(dbDe(), FOORKIE);
    expect(deFoorkie).toMatchObject({ ok: false, codigo: "sin_migracion", motivo: expect.stringMatching(/migración 0254/) });
    expect(JSON.stringify(deFoorkie)).not.toMatch(/bookea|supabase|relation/i);
    expect(await servicioDatos(dbDe(), BOOKEA)).toMatchObject({
      ok: false,
      codigo: "sin_migracion",
      motivo: "Falta correr la migración 0254 en Supabase: todavía no existen las tablas de los impulsos automáticos.",
    });
  });

  it("otro error de la base: «error_base» con lo que pasó", async () => {
    db.errores.impulsos_lealtad = { code: "XX000", message: "se cayó" };
    expect(await servicioDatos(dbDe(), FOORKIE)).toMatchObject({ ok: false, codigo: "error_base", motivo: "No se pudieron leer los impulsos: se cayó" });
  });
});

describe("faltaLaMigracion", () => {
  it("la tabla que no existe sí; un CHECK que nombra la tabla no", () => {
    expect(faltaLaMigracion({ code: "42P01", message: "x" })).toBe(true);
    expect(faltaLaMigracion({ code: "PGRST205", message: "x" })).toBe(true);
    expect(faltaLaMigracion({ message: "Could not find the table 'public.impulsos_tareas' in the schema cache" })).toBe(true);
    expect(faltaLaMigracion({ message: 'relation "impulsos_eventos" does not exist' })).toBe(true);
    expect(faltaLaMigracion({ code: "23514", message: 'new row for relation "impulsos_lealtad" violates check constraint "impulsos_lealtad_nombre_check"' })).toBe(false);
    expect(faltaLaMigracion({ code: "XX000", message: "se cayó" })).toBe(false);
    expect(faltaLaMigracion(null)).toBe(false);
  });
});

describe("servicioHistorial", () => {
  it("de a 25, del más nuevo al más viejo, con el total", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    for (let n = 0; n < 30; n++) filasDe("impulsos_tareas").push(tarea(n, id(101), "enviada"));
    const p0 = await servicioHistorial(dbDe(), FOORKIE, {});
    const p1 = await servicioHistorial(dbDe(), FOORKIE, { pagina: 1 });
    if (!p0.ok || !p1.ok) throw new Error("tenían que salir bien");
    expect(POR_PAGINA).toBe(25);
    expect(p0.datos).toMatchObject({ total: 30, pagina: 0, porPagina: 25 });
    expect(p0.datos.filas).toHaveLength(25);
    expect(p1.datos.filas).toHaveLength(5);
    expect(p1.datos).toMatchObject({ total: 30, pagina: 1 });
    const fechas = p0.datos.filas.map((f) => f.ejecutarEn);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });

  it("filtra por estado y por impulso; ignora lo que no entiende", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }), impulso(2, { estado: "activo" }));
    filasDe("impulsos_tareas").push(tarea(1, id(101), "enviada"), tarea(2, id(101), "fallida"), tarea(3, id(102), "fallida"));
    const fallidas = await servicioHistorial(dbDe(), FOORKIE, { estado: "fallida" });
    const deUno = await servicioHistorial(dbDe(), FOORKIE, { estado: "fallida", impulsoId: id(101) });
    const todas = await servicioHistorial(dbDe(), FOORKIE, { estado: "todos", impulsoId: "no-es-un-uuid" });
    if (!fallidas.ok || !deUno.ok || !todas.ok) throw new Error("tenían que salir bien");
    expect(fallidas.datos.total).toBe(2);
    expect(deUno.datos.filas.map((f) => f.id)).toEqual([id(302)]);
    expect(todas.datos.total).toBe(3);
  });

  it("cada fila: el cliente por su nombre de pila, el impulso por su nombre y si se puede reintentar", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    filasDe("impulsos_tareas").push(
      tarea(1, id(101), "fallida", { motivo: "error_proveedor" }),
      tarea(2, id(101), "fallida", { motivo: "resultado_incierto", miembro_id: "m-otro" }),
      tarea(3, id(999), "enviada"),
    );
    const r = await servicioHistorial(dbDe(), FOORKIE, {});
    if (!r.ok) throw new Error("tenía que salir bien");
    const por = (n: number) => r.datos.filas.find((f) => f.id === id(300 + n))!;
    expect(por(1)).toMatchObject({ cliente: "Ana", impulsoNombre: "Bienvenida", reintentable: true, reintentoConRiesgo: false, canal: "wallet", titulo: "¡Hola!", cuerpo: "Gracias" });
    expect(por(2)).toMatchObject({ cliente: "Cliente", reintentable: true, reintentoConRiesgo: true });
    expect(por(3)).toMatchObject({ impulsoNombre: "Impulso eliminado", reintentable: false, reintentoConRiesgo: false });
  });

  it("el motivo sale en la voz que toca", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    filasDe("impulsos_tareas").push(
      tarea(1, id(101), "omitida", { motivo: "sin_canal_individual" }),
      tarea(2, id(101), "omitida", { motivo: "correo_lo_manda_foorkie" }),
      tarea(3, id(101), "omitida", { motivo: "sin_pase" }),
    );
    const deFoorkie = await servicioHistorial(dbDe(), FOORKIE, {});
    const deBookea = await servicioHistorial(dbDe(), BOOKEA, {});
    if (!deFoorkie.ok || !deBookea.ok) throw new Error("tenían que salir bien");
    const texto = (r: typeof deFoorkie, n: number) => r.datos.filas.find((f) => f.id === id(300 + n))!.motivoTexto;
    expect(texto(deFoorkie, 1)).toBe("Solo tiene Apple Wallet y no se pudo avisar a su iPhone.");
    expect(texto(deFoorkie, 2)).toBe("Los correos de los impulsos todavía no salen desde Foorkie Lealtad.");
    expect(texto(deFoorkie, 3)).toBe(MOTIVOS.sin_pase);
    expect(texto(deBookea, 1)).toBe(MOTIVOS.sin_canal_individual);
    expect(JSON.stringify(deFoorkie.datos)).not.toMatch(/bookea/i);
  });
});

describe("servicioGuardar", () => {
  it("nace como borrador con el negocio, la tarjeta y quien actúa del SERVIDOR", async () => {
    const r = await servicioGuardar(dbDe(), FOORKIE, null, {
      ...bienvenida,
      rancho_id: OTRO_RANCHO,
      programa_id: OTRA_TARJETA,
      estado: "activo",
      activado_en: "2020-01-01",
      version: 99,
      creado_por: "intruso",
    });
    expect(r).toMatchObject({ ok: true, datos: { avisos: [] } });
    const fila = filasDe("impulsos_lealtad")[0];
    expect(fila).toMatchObject({ rancho_id: RANCHO, programa_id: PROGRAMA, estado: "borrador", creado_por: DUENO, version: 1, activado_en: null, nombre: "Bienvenida" });
    expect(r.ok && r.datos.id).toBe(fila.id);
  });

  it("un impulso inválido no se guarda: «validacion» con los problemas, en la voz de Foorkie", async () => {
    const r = await servicioGuardar(dbDe(), FOORKIE, null, { ...bienvenida, nombre: "x", canal: "correo", activador: "cumpleanos" });
    expect(r).toMatchObject({ ok: false, codigo: "validacion", motivo: "Revisá los datos marcados antes de guardar." });
    if (r.ok) return;
    expect(r.problemas?.map((p) => p.campo).sort()).toEqual(["activador", "canal", "nombre"]);
    expect(JSON.stringify(r)).not.toMatch(/bookea/i);
    expect(filasDe("impulsos_lealtad")).toHaveLength(0);
  });

  it("un borrador a medias SÍ se guarda (falta la recompensa, sobra una variable): solo bloquea activar", async () => {
    db.tablas.recompensas = [];
    const r = await servicioGuardar(dbDe(), FOORKIE, null, { ...bienvenida, activador: "recompensa_alcanzada", cuerpo: "Hola {{inventada}}" });
    expect(r).toMatchObject({ ok: true });
    expect(filasDe("impulsos_lealtad")).toHaveLength(1);
  });

  it("no pasa de 40 impulsos por tarjeta (los archivados no cuentan)", async () => {
    for (let n = 0; n < 40; n++) filasDe("impulsos_lealtad").push(impulso(1, { id: id(500 + n), estado: n < 35 ? "pausado" : "borrador" }));
    expect(await servicioGuardar(dbDe(), FOORKIE, null, bienvenida)).toMatchObject({
      ok: false,
      codigo: "limite",
      motivo: "Una tarjeta puede tener hasta 40 impulsos. Archivá o eliminá alguno para crear otro.",
    });
    filasDe("impulsos_lealtad")[0].estado = "archivado";
    expect(await servicioGuardar(dbDe(), FOORKIE, null, bienvenida)).toMatchObject({ ok: true });
  });

  it("editar sube la versión; cambiar qué lo dispara cancela lo que esperaba (y solo eso)", async () => {
    filasDe("impulsos_lealtad").push(impulso(1));
    filasDe("impulsos_tareas").push(tarea(1, id(101), "programada"), tarea(2, id(101), "pendiente"), tarea(3, id(101), "enviada"), tarea(4, id(101), "procesando"));
    expect(await servicioGuardar(dbDe(), FOORKIE, id(101), { ...bienvenida, titulo: "Otro título" })).toMatchObject({ ok: true });
    expect(unico("impulsos_lealtad", id(101))).toMatchObject({ version: 2, titulo: "Otro título" });
    expect(filasDe("impulsos_tareas").map((t) => t.estado)).toEqual(["programada", "pendiente", "enviada", "procesando"]);

    expect(await servicioGuardar(dbDe(), FOORKIE, id(101), { ...bienvenida, activador: "primera_visita" })).toMatchObject({ ok: true });
    expect(unico("impulsos_lealtad", id(101))).toMatchObject({ version: 3, activador: "primera_visita" });
    expect(filasDe("impulsos_tareas").map((t) => [t.estado, t.motivo])).toEqual([
      ["cancelada", "impulso_editado"],
      ["cancelada", "impulso_editado"],
      ["enviada", null],
      ["procesando", null],
    ]);
  });

  it("uno archivado no se edita: «no_editable»", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "archivado" }));
    expect(await servicioGuardar(dbDe(), FOORKIE, id(101), bienvenida)).toMatchObject({ ok: false, codigo: "no_editable", motivo: expect.stringMatching(/archivado/) });
  });

  it("uno ACTIVO no puede quedar inválido: «no_editable» con los problemas, y no se toca", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo", activado_en: "2026-10-01T00:00:00Z" }));
    const r = await servicioGuardar(dbDe(), FOORKIE, id(101), { ...bienvenida, cuerpo: "Hola {{variable_inexistente}}" });
    expect(r).toMatchObject({ ok: false, codigo: "no_editable", motivo: expect.stringMatching(/está activo/), problemas: [{ campo: "cuerpo" }] });
    expect(unico("impulsos_lealtad", id(101))?.version).toBe(1);
  });

  it("sin la migración: «sin_migracion» al crear y al editar", async () => {
    db.errores.impulsos_lealtad = { code: "42P01", message: 'relation "impulsos_lealtad" does not exist' };
    expect(await servicioGuardar(dbDe(), FOORKIE, null, bienvenida)).toMatchObject({ ok: false, codigo: "sin_migracion" });
    expect(await servicioGuardar(dbDe(), FOORKIE, id(101), bienvenida)).toMatchObject({ ok: false, codigo: "sin_migracion" });
  });
});

describe("servicioCambiarEstado", () => {
  it("activar vuelve a validar TODO y sella el momento", async () => {
    filasDe("impulsos_lealtad").push(impulso(1));
    const antes = Date.now();
    const r = await servicioCambiarEstado(dbDe(), FOORKIE, id(101), "activo");
    expect(r).toMatchObject({ ok: true, datos: { estado: "activo", avisos: [] } });
    const fila = unico("impulsos_lealtad", id(101))!;
    expect(fila.estado).toBe("activo");
    expect(new Date(String(fila.activado_en)).getTime()).toBeGreaterThanOrEqual(antes - 1000);
  });

  it("no se activa un borrador a medias: «validacion» con los problemas de ACTIVAR", async () => {
    db.tablas.recompensas = [];
    filasDe("impulsos_lealtad").push(impulso(1, { activador: "recompensa_alcanzada", cuerpo: "Hola {{inventada}}" }));
    const r = await servicioCambiarEstado(dbDe(), FOORKIE, id(101), "activo");
    expect(r).toMatchObject({ ok: false, codigo: "validacion", motivo: "Todavía no se puede activar. Revisá lo marcado." });
    if (r.ok) return;
    expect(r.problemas?.map((p) => p.campo).sort()).toEqual(["activador", "cuerpo"]);
    expect(r.problemas?.find((p) => p.campo === "activador")?.mensaje).toBe("Esta tarjeta todavía no tiene una recompensa activa. Creala primero en Premios.");
    expect(unico("impulsos_lealtad", id(101))?.estado).toBe("borrador");
  });

  it("pausar, archivar y volver a borrador cancelan lo que no salió, con su motivo", async () => {
    for (const [nuevo, motivo] of [
      ["pausado", "impulso_pausado"],
      ["archivado", "impulso_eliminado"],
      ["borrador", "impulso_pausado"],
    ] as const) {
      db.tablas.impulsos_lealtad = [impulso(1, { estado: "activo" })];
      db.tablas.impulsos_tareas = [tarea(1, id(101), "programada"), tarea(2, id(101), "enviada"), tarea(3, id(101), "pendiente")];
      expect(await servicioCambiarEstado(dbDe(), FOORKIE, id(101), nuevo)).toMatchObject({ ok: true, datos: { estado: nuevo } });
      expect(unico("impulsos_lealtad", id(101))?.estado).toBe(nuevo);
      expect(filasDe("impulsos_tareas").map((t) => [t.estado, t.motivo])).toEqual([
        ["cancelada", motivo],
        ["enviada", null],
        ["cancelada", motivo],
      ]);
    }
  });

  it("uno archivado solo vuelve a borrador: «estado_invalido»", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "archivado" }));
    for (const nuevo of ["activo", "pausado"] as const) {
      expect(await servicioCambiarEstado(dbDe(), FOORKIE, id(101), nuevo)).toMatchObject({ ok: false, codigo: "estado_invalido" });
    }
    expect(unico("impulsos_lealtad", id(101))?.estado).toBe("archivado");
    expect(await servicioCambiarEstado(dbDe(), FOORKIE, id(101), "borrador")).toMatchObject({ ok: true });
  });

  it("pedir el estado que ya tiene no escribe nada", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    expect(await servicioCambiarEstado(dbDe(), FOORKIE, id(101), "activo")).toMatchObject({ ok: true, datos: { estado: "activo", avisos: [] } });
    expect(db.escrituras()).toEqual([]);
  });

  it("un impulso que no existe: «sin_impulso»", async () => {
    expect(await servicioCambiarEstado(dbDe(), FOORKIE, id(777), "activo")).toMatchObject({ ok: false, codigo: "sin_impulso" });
  });
});

describe("servicioDuplicar y servicioCrearDesdePlantilla", () => {
  it("duplicar crea un borrador «Copia de…» a nombre de quien actúa", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo", activado_en: "2026-10-01T00:00:00Z" }));
    const r = await servicioDuplicar(dbDe(), FOORKIE, id(101));
    expect(r).toMatchObject({ ok: true });
    const copia = filasDe("impulsos_lealtad").find((f) => f.id !== id(101))!;
    expect(copia).toMatchObject({ estado: "borrador", nombre: "Copia de Bienvenida", creado_por: DUENO, rancho_id: RANCHO, programa_id: PROGRAMA, version: 1, activado_en: null });
  });

  it("duplicar y crear respetan el tope de 40", async () => {
    for (let n = 0; n < 40; n++) filasDe("impulsos_lealtad").push(impulso(1, { id: id(500 + n) }));
    expect(await servicioDuplicar(dbDe(), FOORKIE, id(500))).toMatchObject({ ok: false, codigo: "limite", motivo: expect.stringMatching(/para duplicar otro\.$/) });
    expect(await servicioCrearDesdePlantilla(dbDe(), FOORKIE, "bienvenida")).toMatchObject({ ok: false, codigo: "limite", motivo: expect.stringMatching(/para crear otro\.$/) });
    expect(filasDe("impulsos_lealtad")).toHaveLength(40);
  });

  it("una plantilla nace BORRADOR, adaptada al tipo de tarjeta y con su id", async () => {
    const r = await servicioCrearDesdePlantilla(dbDe(), FOORKIE, "progreso");
    expect(r).toMatchObject({ ok: true });
    expect(filasDe("impulsos_lealtad")[0]).toMatchObject({ estado: "borrador", plantilla: "progreso", activador: "meta_proxima", creado_por: DUENO, titulo: "¡Te falta solo 1!" });
  });

  it("una plantilla apagada: «plantilla_no_disponible» con el porqué en la voz de Foorkie", async () => {
    for (const plantilla of ["cumpleanos", "vencimiento"]) {
      const r = await servicioCrearDesdePlantilla(dbDe(), FOORKIE, plantilla);
      expect(r).toMatchObject({ ok: false, codigo: "plantilla_no_disponible" });
      expect(JSON.stringify(r)).not.toMatch(/bookea/i);
    }
    expect(await servicioCrearDesdePlantilla(dbDe(), BOOKEA, "cumpleanos")).toMatchObject({ ok: false, motivo: expect.stringMatching(/^Bookea/) });
    expect(filasDe("impulsos_lealtad")).toHaveLength(0);
  });

  it("una plantilla que no existe: «plantilla_no_existe»", async () => {
    expect(await servicioCrearDesdePlantilla(dbDe(), FOORKIE, "no_existe")).toMatchObject({ ok: false, codigo: "plantilla_no_existe", motivo: "Esa plantilla no existe." });
  });
});

describe("servicioEliminar", () => {
  it("sin historial se borra del todo", async () => {
    filasDe("impulsos_lealtad").push(impulso(1));
    expect(await servicioEliminar(dbDe(), FOORKIE, id(101))).toMatchObject({ ok: true, datos: { resultado: "eliminado" } });
    expect(filasDe("impulsos_lealtad")).toEqual([]);
  });

  it("con mensajes ya enviados (o fallidos, o a medio enviar) se ARCHIVA: el historial queda", async () => {
    for (const estado of ["enviada", "entregada", "fallida", "procesando"]) {
      db.tablas.impulsos_lealtad = [impulso(1, { estado: "activo" })];
      db.tablas.impulsos_tareas = [tarea(1, id(101), estado)];
      expect(await servicioEliminar(dbDe(), FOORKIE, id(101))).toMatchObject({ ok: true, datos: { resultado: "archivado" } });
      expect(unico("impulsos_lealtad", id(101))?.estado).toBe("archivado");
      expect(filasDe("impulsos_tareas")).toHaveLength(1);
    }
  });

  it("lo que esperaba salir se cancela, y las omitidas o canceladas no cuentan como historial", async () => {
    filasDe("impulsos_lealtad").push(impulso(1, { estado: "activo" }));
    filasDe("impulsos_tareas").push(tarea(1, id(101), "programada"), tarea(2, id(101), "omitida"));
    expect(await servicioEliminar(dbDe(), FOORKIE, id(101))).toMatchObject({ ok: true, datos: { resultado: "eliminado" } });
    expect(db.pedidos("impulsos_tareas", "update")).toHaveLength(1);
  });
});

describe("servicioReintentar", () => {
  const preparar = (estadoTarea: string, motivo: string | null, estadoImpulso = "activo") => {
    db.tablas.impulsos_lealtad = [impulso(1, { estado: estadoImpulso })];
    db.tablas.impulsos_tareas = [tarea(1, id(101), estadoTarea, { motivo, intentos: 3, detalle: "x", envio_iniciado_en: "2026-10-15T00:00:00Z" })];
  };

  it("una fallida vuelve a la cola, como nueva", async () => {
    preparar("fallida", "error_proveedor");
    expect(await servicioReintentar(dbDe(), FOORKIE, id(301))).toEqual({ ok: true, datos: null });
    expect(unico("impulsos_tareas", id(301))).toMatchObject({ estado: "programada", intentos: 0, motivo: null, detalle: null, envio_iniciado_en: null, proximo_intento_en: null });
  });

  it("solo se reintentan las que fallaron", async () => {
    preparar("enviada", null);
    expect(await servicioReintentar(dbDe(), FOORKIE, id(301))).toMatchObject({ ok: false, codigo: "tarea_no_reintentable", motivo: "Solo se pueden reintentar los mensajes que fallaron." });
    expect(unico("impulsos_tareas", id(301))?.estado).toBe("enviada");
  });

  it("un resultado incierto exige confirmar el riesgo", async () => {
    preparar("fallida", "resultado_incierto");
    expect(await servicioReintentar(dbDe(), FOORKIE, id(301))).toMatchObject({ ok: false, codigo: "riesgo_de_duplicado", motivo: expect.stringMatching(/dos veces/) });
    expect(unico("impulsos_tareas", id(301))?.estado).toBe("fallida");
    expect(await servicioReintentar(dbDe(), FOORKIE, id(301), true)).toMatchObject({ ok: true });
    expect(unico("impulsos_tareas", id(301))?.estado).toBe("programada");
  });

  it("si el impulso ya no está activo, no se reintenta", async () => {
    preparar("fallida", "error_proveedor", "pausado");
    expect(await servicioReintentar(dbDe(), FOORKIE, id(301))).toMatchObject({ ok: false, codigo: "tarea_no_reintentable", motivo: expect.stringMatching(/activalo primero/) });
  });

  it("un mensaje que no existe", async () => {
    preparar("fallida", null);
    expect(await servicioReintentar(dbDe(), FOORKIE, id(999))).toMatchObject({ ok: false, codigo: "tarea_no_reintentable", motivo: "Ese mensaje no existe en esta tarjeta." });
  });
});
