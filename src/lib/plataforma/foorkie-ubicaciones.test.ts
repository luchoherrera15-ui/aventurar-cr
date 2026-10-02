import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claveDeUbicacion,
  filaDeUbicacion,
  guardarUbicacionesDeLaTarjeta,
  leerUbicaciones,
  MAX_UBICACIONES,
  planDeReemplazo,
  redondear,
  ubicacionesDeLaTarjeta,
  type FilaDeUbicacion,
  type UbicacionDeFoorkie,
} from "./foorkie-ubicaciones";

/**
 * LAS UBICACIONES DE UNA TARJETA DE FOORKIE (el aviso por cercanía).
 *
 * Se fija: la forma de lo que manda Foorkie (lo que no cumple rebota con
 * su motivo), que guardar escribe SOLO la diferencia y en un orden que no
 * deja al negocio a medias (ni pasado del techo de 10 de Apple), y LA
 * GUARDIA: con la marca `lealtad_por_foorkie` sí; vinculada sin la marca
 * —como Pura Matcha— nunca; y si el negocio tiene otra tarjeta que no es
 * de Foorkie, tampoco se escribe (las ubicaciones son de todo el negocio).
 */

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const OTRA_TARJETA = "33333333-3333-4333-8333-333333333333";
const vinculo = { ranchoId: RANCHO, programaId: PROGRAMA };

const ubicacion = (n: number, extra: Partial<UbicacionDeFoorkie> = {}): UbicacionDeFoorkie => ({
  latitud: redondear(9.9 + n / 1000),
  longitud: redondear(-84.1 - n / 1000),
  mensaje: `Estás cerca de Sucursal ${n} · mostrá tu tarjeta`,
  nombre: `Sucursal ${n}`,
  ...extra,
});

// ── Lo que manda Foorkie ────────────────────────────────────────────

describe("leerUbicaciones — la forma de `ubicaciones`", () => {
  it("una lista vacía vale: el negocio queda sin ubicaciones", () => {
    expect(leerUbicaciones([])).toEqual({ ok: true, valor: [] });
  });

  it("coordenadas con 6 decimales, el mensaje en una línea y sin nombre, el mensaje", () => {
    expect(
      leerUbicaciones([{ latitud: 9.93333349, longitud: -84.08333351, mensaje: "  Estás cerca de\nDonde George  " }]),
    ).toEqual({
      ok: true,
      valor: [{ latitud: 9.933333, longitud: -84.083334, mensaje: "Estás cerca de Donde George", nombre: "Estás cerca de Donde George" }],
    });
  });

  it("el nombre, si viene, también en una línea; vacío o null = el mensaje", () => {
    expect(leerUbicaciones([{ latitud: 1, longitud: 2, mensaje: "Hola de nuevo", nombre: " Local\tCentro " }])).toMatchObject({
      ok: true,
      valor: [{ nombre: "Local Centro" }],
    });
    expect(leerUbicaciones([{ latitud: 1, longitud: 2, mensaje: "Hola de nuevo", nombre: "  " }])).toMatchObject({
      ok: true,
      valor: [{ nombre: "Hola de nuevo" }],
    });
    expect(leerUbicaciones([{ latitud: 1, longitud: 2, mensaje: "Hola de nuevo", nombre: null }])).toMatchObject({
      ok: true,
      valor: [{ nombre: "Hola de nuevo" }],
    });
  });

  it("los bordes del planeta valen; afuera, no (con el número de la ubicación en el motivo)", () => {
    expect(
      leerUbicaciones([
        { latitud: -90, longitud: -180, mensaje: "Polo sur" },
        { latitud: 90, longitud: 180, mensaje: "Polo norte" },
      ]),
    ).toMatchObject({ ok: true });
    expect(leerUbicaciones([ubicacion(1), { latitud: 90.5, longitud: 0, mensaje: "Afuera" }])).toEqual({
      ok: false,
      motivo: "La latitud de la ubicación 2 tiene que ser un número entre -90 y 90.",
    });
    expect(leerUbicaciones([{ latitud: 0, longitud: -181, mensaje: "Afuera" }])).toEqual({
      ok: false,
      motivo: "La longitud de la ubicación 1 tiene que ser un número entre -180 y 180.",
    });
  });

  it("una coordenada tiene que ser un número de verdad: ni texto, ni NaN, ni infinito", () => {
    for (const latitud of ["9.93", Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(leerUbicaciones([{ latitud, longitud: -84, mensaje: "Hola de nuevo" }])).toMatchObject({ ok: false });
    }
  });

  it("el mensaje: de 3 a 80 caracteres, contados después de limpiar", () => {
    expect(leerUbicaciones([{ latitud: 1, longitud: 1, mensaje: "x".repeat(80) }])).toMatchObject({ ok: true });
    expect(leerUbicaciones([{ latitud: 1, longitud: 1, mensaje: "x".repeat(81) }])).toEqual({
      ok: false,
      motivo: "El mensaje de la ubicación 1 puede tener hasta 80 caracteres: en la pantalla bloqueada no entra más.",
    });
    expect(leerUbicaciones([{ latitud: 1, longitud: 1, mensaje: " \n ok " }])).toEqual({
      ok: false,
      motivo: "Escribí el mensaje de la ubicación 1 (de 3 a 80 caracteres).",
    });
    expect(leerUbicaciones([{ latitud: 1, longitud: 1 }])).toMatchObject({ ok: false });
  });

  it("el nombre: texto de hasta 80", () => {
    expect(leerUbicaciones([{ latitud: 1, longitud: 1, mensaje: "Hola de nuevo", nombre: "n".repeat(81) }])).toEqual({
      ok: false,
      motivo: "El nombre de la ubicación 1 puede tener hasta 80 caracteres.",
    });
    expect(leerUbicaciones([{ latitud: 1, longitud: 1, mensaje: "Hola de nuevo", nombre: 7 }])).toMatchObject({ ok: false });
  });

  it("hasta 10 (el techo de Apple), y una lista de verdad", () => {
    const diez = Array.from({ length: MAX_UBICACIONES }, (_, i) => ubicacion(i));
    expect(leerUbicaciones(diez)).toMatchObject({ ok: true });
    expect(leerUbicaciones([...diez, ubicacion(10)])).toEqual({
      ok: false,
      motivo: "Apple Wallet acepta 10 ubicaciones por tarjeta como máximo.",
    });
    expect(leerUbicaciones({ latitud: 1, longitud: 1, mensaje: "Hola de nuevo" })).toMatchObject({ ok: false });
    expect(leerUbicaciones(undefined)).toMatchObject({ ok: false });
    expect(leerUbicaciones(["no"])).toMatchObject({ ok: false });
  });

  it("una repetida va una sola vez (no gasta un lugar de los 10)", () => {
    const r = leerUbicaciones([ubicacion(1), { ...ubicacion(1), latitud: ubicacion(1).latitud + 1e-8 }, ubicacion(2)]);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.valor.map((u) => u.nombre)).toEqual(["Sucursal 1", "Sucursal 2"]);
  });
});

describe("redondear y filaDeUbicacion — lo guardado", () => {
  it("seis decimales, sin −0", () => {
    expect(redondear(9.1234564)).toBe(9.123456);
    expect(redondear(-84.1234566)).toBe(-84.123457);
    expect(Object.is(redondear(-0.0000001), 0)).toBe(true);
  });

  it("una fila de la base: los numeric pueden venir como texto; sin nombre, el mensaje", () => {
    expect(filaDeUbicacion({ id: "u1", nombre: "", latitud: "9.93", longitud: "-84.08", mensaje: " Hola " })).toEqual({
      id: "u1",
      latitud: 9.93,
      longitud: -84.08,
      mensaje: "Hola",
      nombre: "Hola",
    });
    expect(filaDeUbicacion({ id: "u1", latitud: "x", longitud: 1, mensaje: "Hola" })).toBeNull();
    expect(filaDeUbicacion({ id: "u1", latitud: 1, longitud: 1, mensaje: "  " })).toBeNull();
    expect(filaDeUbicacion(null)).toBeNull();
  });
});

describe("planDeReemplazo — solo la diferencia", () => {
  const fila = (id: string, u: UbicacionDeFoorkie): FilaDeUbicacion => ({ id, ...u });

  it("lo mismo: nada que hacer", () => {
    const p = planDeReemplazo([fila("a", ubicacion(1)), fila("b", ubicacion(2))], [ubicacion(2), ubicacion(1)]);
    expect(p).toEqual({ borrar: [], insertar: [], insertarPrimero: true });
  });

  it("lo que ya está igual se queda, sobra lo que se borra y falta lo que se inserta", () => {
    const p = planDeReemplazo([fila("a", ubicacion(1)), fila("b", ubicacion(2))], [ubicacion(2), ubicacion(3)]);
    expect(p.borrar.map((f) => f.id)).toEqual(["a"]);
    expect(p.insertar).toEqual([ubicacion(3)]);
    expect(p.insertarPrimero).toBe(true);
  });

  it("cambiar solo el nombre o el mensaje es otra ubicación", () => {
    const p = planDeReemplazo([fila("a", ubicacion(1))], [ubicacion(1, { nombre: "Otro nombre" })]);
    expect(p.borrar.map((f) => f.id)).toEqual(["a"]);
    expect(p.insertar).toHaveLength(1);
  });

  it("una repetida en la base se borra: queda cada una una vez", () => {
    const p = planDeReemplazo([fila("a", ubicacion(1)), fila("b", ubicacion(1))], [ubicacion(1)]);
    expect(p.borrar.map((f) => f.id)).toEqual(["b"]);
    expect(p.insertar).toEqual([]);
  });

  it("si no entran juntas bajo el techo de 10, primero se borra", () => {
    const viejas = Array.from({ length: 10 }, (_, i) => fila(`v${i}`, ubicacion(i)));
    const nuevas = Array.from({ length: 3 }, (_, i) => ubicacion(20 + i));
    expect(planDeReemplazo(viejas, nuevas).insertarPrimero).toBe(false);
    expect(planDeReemplazo(viejas.slice(0, 7), nuevas).insertarPrimero).toBe(true);
  });

  it("la clave no depende del ruido de los decimales", () => {
    expect(claveDeUbicacion(ubicacion(1))).toBe(claveDeUbicacion({ ...ubicacion(1), latitud: ubicacion(1).latitud + 1e-9 }));
  });
});

// ── La base ─────────────────────────────────────────────────────────

type Fila = Record<string, unknown>;
type ErrorDeBase = { message: string; code?: string };
type Op = "select" | "insert" | "delete";
type Escritura = { tabla: string; op: Op; filas: Fila[] };

/**
 * Una base que APLICA los filtros (`eq`, `in`), el orden y las
 * escrituras a sus filas, y que remacha el techo de la 0196 como el
 * trigger: más de 10 ubicaciones en un negocio, error. `errores` por
 * tabla, o por tabla y operación («lealtad_ubicaciones:insert»); con
 * `veces`, solo las primeras N veces.
 */
function baseFalsa(tablas: Record<string, Fila[]>, errores: Record<string, ErrorDeBase & { veces?: number }> = {}) {
  const escrituras: Escritura[] = [];
  let reloj = 0;
  let siguienteId = 0;
  const db = {
    from(tabla: string) {
      let op: Op = "select";
      let valores: Fila[] = [];
      const filtros: [string, "eq" | "in", unknown][] = [];
      const orden: string[] = [];
      let unico = false;
      let limite: number | null = null;
      const pasa = (f: Fila) =>
        filtros.every(([col, tipo, v]) => (tipo === "eq" ? f[col] === v : (v as unknown[]).includes(f[col])));
      const resolver = () => {
        const clave = errores[`${tabla}:${op}`] ? `${tabla}:${op}` : errores[tabla] ? tabla : null;
        if (clave) {
          const e = errores[clave];
          if (e.veces === undefined || e.veces > 0) {
            if (e.veces !== undefined) e.veces -= 1;
            return { data: null, error: { message: e.message, code: e.code } };
          }
        }
        const lista = (tablas[tabla] ??= []);
        if (op === "insert") {
          if (tabla === "lealtad_ubicaciones") {
            const porNegocio = (r: unknown) => lista.filter((f) => f.rancho_id === r).length;
            const nuevas = valores.reduce<Record<string, number>>((m, v) => {
              m[String(v.rancho_id)] = (m[String(v.rancho_id)] ?? 0) + 1;
              return m;
            }, {});
            if (Object.entries(nuevas).some(([r, n]) => porNegocio(r) + n > 10)) {
              return { data: null, error: { message: "Apple Wallet acepta 10 ubicaciones por pase como máximo.", code: "23514" } };
            }
          }
          const filas = valores.map((v) => ({
            id: `u${++siguienteId}`,
            created_at: new Date(Date.UTC(2026, 9, 2, 12, 0, ++reloj)).toISOString(),
            ...v,
          }));
          lista.push(...filas);
          escrituras.push({ tabla, op, filas });
          return { data: null, error: null };
        }
        if (op === "delete") {
          const borradas = lista.filter(pasa);
          tablas[tabla] = lista.filter((f) => !pasa(f));
          escrituras.push({ tabla, op, filas: borradas });
          return { data: null, error: null };
        }
        let vistas = lista.filter(pasa);
        for (const col of [...orden].reverse()) {
          vistas = [...vistas].sort((a, b) => String(a[col]).localeCompare(String(b[col])));
        }
        if (limite !== null) vistas = vistas.slice(0, limite);
        const copias = vistas.map((f) => ({ ...f }));
        return { data: unico ? (copias[0] ?? null) : copias, error: null };
      };
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.insert = (v: Fila | Fila[]) => {
        op = "insert";
        valores = Array.isArray(v) ? v : [v];
        return b;
      };
      b.delete = () => {
        op = "delete";
        return b;
      };
      b.eq = (col: string, v: unknown) => {
        filtros.push([col, "eq", v]);
        return b;
      };
      b.in = (col: string, v: unknown[]) => {
        filtros.push([col, "in", v]);
        return b;
      };
      b.order = (col: string) => {
        orden.push(col);
        return b;
      };
      b.limit = (n: number) => {
        limite = n;
        return b;
      };
      b.maybeSingle = () => {
        unico = true;
        return b;
      };
      b.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve().then(resolver).then(ok, mal);
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, tablas, escrituras };
}

/** Un local de Foorkie con esta tarjeta; `marca` = `lealtad_por_foorkie`. */
const local = (slug: string, programa: string, marca: boolean): Fila => ({
  id: `local-${slug}`,
  slug,
  activo: true,
  estado_publicacion: "aprobado",
  created_at: "2026-09-01T10:00:00Z",
  bookea_rancho_id: RANCHO,
  bookea_programa_id: programa,
  lealtad_por_foorkie: marca,
});

/** La fila que hay en la base, como la dejó el insert. */
const guardada = (id: string, u: UbicacionDeFoorkie, segundo: number): Fila => ({
  id,
  rancho_id: RANCHO,
  created_at: new Date(Date.UTC(2026, 9, 1, 12, 0, segundo)).toISOString(),
  ...u,
});

function escenario(
  opciones: {
    marca?: boolean;
    otraTarjeta?: "de_foorkie" | "de_bookea" | null;
    guardadas?: UbicacionDeFoorkie[];
    errores?: Record<string, ErrorDeBase & { veces?: number }>;
  } = {},
) {
  const { marca = true, otraTarjeta = null, guardadas = [], errores = {} } = opciones;
  const programas: Fila[] = [{ id: PROGRAMA, rancho_id: RANCHO }];
  const locales = [local("donde-george", PROGRAMA, marca)];
  if (otraTarjeta) {
    programas.push({ id: OTRA_TARJETA, rancho_id: RANCHO });
    if (otraTarjeta === "de_foorkie") locales.push(local("donde-george-patio", OTRA_TARJETA, true));
  }
  return baseFalsa(
    {
      programa_lealtad: programas,
      foorkie_restaurantes: locales,
      lealtad_ubicaciones: guardadas.map((u, i) => guardada(`g${i}`, u, i)),
    },
    errores,
  );
}

const lasDelNegocio = (tablas: Record<string, Fila[]>) =>
  tablas.lealtad_ubicaciones
    .filter((f) => f.rancho_id === RANCHO)
    .map((f) => f.nombre)
    .sort();

describe("ubicacionesDeLaTarjeta — leer", () => {
  it("las del negocio, en el orden en que se registraron, sin el id de Bookea", async () => {
    const { db } = escenario({ guardadas: [ubicacion(1), ubicacion(2)] });
    expect(await ubicacionesDeLaTarjeta(db, vinculo)).toEqual({ ok: true, ubicaciones: [ubicacion(1), ubicacion(2)] });
  });

  it("vinculada SIN la marca (como Pura Matcha): 403 y no se lee la tabla", async () => {
    const { db } = escenario({ marca: false, guardadas: [ubicacion(1)] });
    expect(await ubicacionesDeLaTarjeta(db, vinculo)).toMatchObject({ ok: false, codigo: "no_es_de_foorkie", status: 403 });
  });

  it("sin la 0196: 503 sin_migracion; con la base caída: 500", async () => {
    const sinTabla = escenario({
      errores: { lealtad_ubicaciones: { message: 'relation "public.lealtad_ubicaciones" does not exist' } },
    });
    expect(await ubicacionesDeLaTarjeta(sinTabla.db, vinculo)).toMatchObject({ ok: false, codigo: "sin_migracion", status: 503 });
    const caida = escenario({ errores: { lealtad_ubicaciones: { message: "timeout" } } });
    expect(await ubicacionesDeLaTarjeta(caida.db, vinculo)).toMatchObject({ ok: false, codigo: "error_base", status: 500 });
  });
});

describe("guardarUbicacionesDeLaTarjeta — reemplazar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("escribe solo la diferencia y deja exactamente la lista pedida; refresca todas las tarjetas del negocio", async () => {
    const { db, tablas, escrituras } = escenario({ otraTarjeta: "de_foorkie", guardadas: [ubicacion(1), ubicacion(2)] });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [ubicacion(2), ubicacion(3)] });
    expect(r).toEqual({ ok: true, cambio: true, ubicaciones: [ubicacion(2), ubicacion(3)], refrescar: [PROGRAMA, OTRA_TARJETA] });
    // La 2 no se tocó: un insert (la 3) y un delete (la 1), en ese orden.
    expect(escrituras.map((e) => [e.op, e.filas.map((f) => f.nombre)])).toEqual([
      ["insert", ["Sucursal 3"]],
      ["delete", ["Sucursal 1"]],
    ]);
    expect(lasDelNegocio(tablas)).toEqual(["Sucursal 2", "Sucursal 3"]);
  });

  it("lo mismo dos veces: no escribe nada ni refresca ningún pase", async () => {
    const { db, escrituras } = escenario({ guardadas: [ubicacion(1)] });
    expect(await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [ubicacion(1)] })).toEqual({
      ok: true,
      cambio: false,
      ubicaciones: [ubicacion(1)],
      refrescar: [],
    });
    expect(escrituras).toHaveLength(0);
  });

  it("una lista vacía deja al negocio sin ubicaciones", async () => {
    const { db, tablas } = escenario({ guardadas: [ubicacion(1), ubicacion(2)] });
    expect(await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [] })).toEqual({
      ok: true,
      cambio: true,
      ubicaciones: [],
      refrescar: [PROGRAMA],
    });
    expect(tablas.lealtad_ubicaciones).toEqual([]);
  });

  it("10 por 10 nuevas: primero borra (el techo de Apple no deja tener 20) y queda la lista nueva", async () => {
    const viejas = Array.from({ length: 10 }, (_, i) => ubicacion(i));
    const nuevas = Array.from({ length: 10 }, (_, i) => ubicacion(100 + i));
    const { db, tablas, escrituras } = escenario({ guardadas: viejas });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: nuevas });
    expect(r).toMatchObject({ ok: true, cambio: true, ubicaciones: nuevas });
    expect(escrituras.map((e) => e.op)).toEqual(["delete", "insert"]);
    expect(lasDelNegocio(tablas)).toEqual(nuevas.map((u) => u.nombre).sort());
  });

  it("si borró y lo nuevo no entró, devuelve las que estaban: el negocio no queda sin aviso", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const viejas = Array.from({ length: 10 }, (_, i) => ubicacion(i));
    const { db, tablas } = escenario({
      guardadas: viejas,
      errores: { "lealtad_ubicaciones:insert": { message: "se cortó la conexión", veces: 1 } },
    });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [ubicacion(50)] });
    expect(r).toMatchObject({ ok: false, codigo: "rechazado", status: 400, refrescar: [] });
    expect(lasDelNegocio(tablas)).toEqual(viejas.map((u) => u.nombre).sort());
  });

  it("y si ni eso se pudo, avisa a los pases igual (lo que llevan ya cambió)", async () => {
    const viejas = Array.from({ length: 10 }, (_, i) => ubicacion(i));
    const { db } = escenario({
      guardadas: viejas,
      errores: { "lealtad_ubicaciones:insert": { message: "se cortó la conexión" } },
    });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [ubicacion(50)] });
    expect(r).toMatchObject({ ok: false, codigo: "rechazado", refrescar: [PROGRAMA] });
  });

  it("si el insert falla cuando iba primero, no cambió nada y no se refresca nada", async () => {
    const { db, tablas, escrituras } = escenario({
      guardadas: [ubicacion(1)],
      errores: { "lealtad_ubicaciones:insert": { message: "se cortó la conexión" } },
    });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [ubicacion(2)] });
    expect(r).toMatchObject({ ok: false, codigo: "rechazado", refrescar: [] });
    expect(escrituras).toHaveLength(0);
    expect(lasDelNegocio(tablas)).toEqual(["Sucursal 1"]);
  });

  it("si entraron las nuevas pero no salieron las viejas: lo dice, refresca, y reintentar lo termina", async () => {
    const { db, tablas } = escenario({
      guardadas: [ubicacion(1)],
      errores: { "lealtad_ubicaciones:delete": { message: "se cortó la conexión", veces: 1 } },
    });
    const pedido = { ...vinculo, ubicaciones: [ubicacion(2)] };
    expect(await guardarUbicacionesDeLaTarjeta(db, pedido)).toMatchObject({
      ok: false,
      motivo: "Guardamos las ubicaciones nuevas pero no pudimos sacar las viejas. Probá de nuevo.",
      refrescar: [PROGRAMA],
    });
    expect(lasDelNegocio(tablas)).toEqual(["Sucursal 1", "Sucursal 2"]);
    expect(await guardarUbicacionesDeLaTarjeta(db, pedido)).toMatchObject({ ok: true, cambio: true, ubicaciones: [ubicacion(2)] });
    expect(lasDelNegocio(tablas)).toEqual(["Sucursal 2"]);
  });

  it("vinculada SIN la marca (Pura Matcha): 403 y su negocio no se toca", async () => {
    const { db, tablas, escrituras } = escenario({ marca: false, guardadas: [ubicacion(1)] });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [] });
    expect(r).toMatchObject({ ok: false, codigo: "no_es_de_foorkie", status: 403, refrescar: [] });
    expect(escrituras).toHaveLength(0);
    expect(lasDelNegocio(tablas)).toEqual(["Sucursal 1"]);
  });

  it("si el negocio tiene otra tarjeta que no es de Foorkie: 409 negocio_compartido, sin escribir", async () => {
    const { db, escrituras } = escenario({ otraTarjeta: "de_bookea" });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [ubicacion(1)] });
    expect(r).toMatchObject({ ok: false, codigo: "negocio_compartido", status: 409, refrescar: [] });
    expect(escrituras).toHaveLength(0);
  });

  it("si no se puede saber de quién son las tarjetas del negocio, no se escribe", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, escrituras } = escenario({ errores: { programa_lealtad: { message: "timeout" } } });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [ubicacion(1)] });
    expect(r).toMatchObject({ ok: false, codigo: "error_base", status: 500 });
    expect(escrituras).toHaveLength(0);
  });

  it("sin la 0196: 503 sin_migracion, sin intentar escribir", async () => {
    const { db, escrituras } = escenario({
      errores: { lealtad_ubicaciones: { message: "Could not find the table 'public.lealtad_ubicaciones' in the schema cache" } },
    });
    const r = await guardarUbicacionesDeLaTarjeta(db, { ...vinculo, ubicaciones: [ubicacion(1)] });
    expect(r).toMatchObject({ ok: false, codigo: "sin_migracion", status: 503, refrescar: [] });
    expect(escrituras).toHaveLength(0);
  });
});
