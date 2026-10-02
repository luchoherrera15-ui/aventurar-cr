import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// La resolución de identidad tiene su propia suite; acá importa QUÉ sale
// hacia Foorkie: nombre de pila y contactos enmascarados.
vi.mock("@/lib/lealtad/identidades-db", () => ({
  miembrosConIdentidad: vi.fn(async () => []),
  identidadesDeMiembros: vi.fn(async (_db: unknown, miembros: { id: string }[]) =>
    new Map(miembros.map((m) => [m.id, IDENTIDADES[m.id] ?? { nombre: null, correo: null, telefono: null }])),
  ),
}));
vi.mock("@/lib/lealtad/plan-del-negocio", () => ({ planDelNegocio: vi.fn(async () => "arranque") }));
vi.mock("@/lib/lealtad/cupo-notificaciones", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lealtad/cupo-notificaciones")>()),
  reservarCupoNotificacion: vi.fn(),
  liberarCupoNotificacion: vi.fn(async () => undefined),
}));
vi.mock("@/lib/wallet/mensaje-promocional", () => ({ enviarMensajePromocional: vi.fn() }));
vi.mock("@/lib/wallet/aviso-de-pausa", () => ({ plataformasConfiguradas: vi.fn(() => ["apple", "google"]) }));
vi.mock("@/lib/wallet/aviso-de-diseno", () => ({ avisarCambioDeDiseno: vi.fn() }));
vi.mock("@/lib/wallet/google", () => ({ refrescarClaseGoogle: vi.fn() }));

import { identidadesDeMiembros } from "@/lib/lealtad/identidades-db";
import { liberarCupoNotificacion, reservarCupoNotificacion } from "@/lib/lealtad/cupo-notificaciones";
import { enviarMensajePromocional } from "@/lib/wallet/mensaje-promocional";
import { plataformasConfiguradas } from "@/lib/wallet/aviso-de-pausa";
import {
  agregadosPorMiembro,
  armarClienteDelPanel,
  borrarRecompensaDeFoorkie,
  clientesDeLaTarjeta,
  coincideConLaBusqueda,
  dibujaLaMeta,
  enmascararTelefono,
  entradaDeRecompensa,
  esAnterior,
  firmaDeLaMeta,
  guardarRecompensaDeFoorkie,
  leerPedidoBorrarRecompensa,
  leerPedidoClientes,
  leerPedidoGuardarMensajes,
  leerPedidoGuardarRecompensa,
  leerPedidoMensaje,
  leerPedidoMensajes,
  mandarMensajeDeFoorkie,
  microsDe,
  motivoSinCupo,
  nombreBuscable,
  ordenarRecompensas,
  quitaLaUltimaActiva,
  recompensaDelPanel,
  recompensasDeLaTarjeta,
  type PedidoGuardarRecompensa,
} from "./foorkie-panel";

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const INTENTO = "44444444-4444-4444-8444-444444444444";
const RECOMPENSA = "55555555-5555-4555-8555-555555555555";
const OTRA = "66666666-6666-4666-8666-666666666666";

const IDENTIDADES: Record<string, { nombre: string | null; correo: string | null; telefono: string | null }> = {
  "m-ana": { nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: "+506 8888-7777" },
  "m-beto": { nombre: null, correo: "beto@correo.cr", telefono: "70112233" },
  "m-jose": { nombre: "José Hernández", correo: "jose@hotmail.com", telefono: null },
};

const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

// ── Una base de mentira: qué se le pide y qué se devuelve ───────────

type Consulta = {
  tabla: string;
  op: "select" | "update" | "insert" | "delete";
  valores: unknown;
  filtros: unknown[][];
};
type Respuesta = { data?: unknown; error?: unknown; count?: number | null };

function baseFalsa(responder: (c: Consulta) => Respuesta) {
  const consultas: Consulta[] = [];
  const db = {
    from(tabla: string) {
      const c: Consulta = { tabla, op: "select", valores: null, filtros: [] };
      let operacion: Consulta["op"] | null = null;
      consultas.push(c);
      const b: Record<string, unknown> = {};
      for (const op of ["update", "insert", "delete"] as const) {
        b[op] = (valores?: unknown) => {
          operacion = op;
          c.op = op;
          c.valores = valores ?? null;
          return b;
        };
      }
      for (const m of ["select", "eq", "in", "lt", "order", "limit", "range", "maybeSingle", "single"]) {
        b[m] = (...args: unknown[]) => {
          if (m === "select" && operacion === null) c.op = "select";
          c.filtros.push([m, ...args]);
          return b;
        };
      }
      b.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            const r = responder(c);
            return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
          })
          .then(ok, mal);
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, consultas };
}

const filtro = (c: Consulta, metodo: string, columna?: string) =>
  c.filtros.find((f) => f[0] === metodo && (columna === undefined || f[1] === columna));

// ════════════════════════════════════════════════════════════════════

describe("leer lo que manda el panel de Foorkie", () => {
  it("clientes: por defecto 50, sin búsqueda ni cursor, en el orden de siempre y sin resumen", () => {
    expect(leerPedidoClientes({ ...vinculo })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, buscar: null, limite: 50, antes: null, orden: null, desde: 0, resumen: false },
    });
  });

  it("clientes: el límite se acota a 1..100 y tiene que ser un número", () => {
    expect(leerPedidoClientes({ ...vinculo, limite: 0 })).toMatchObject({ ok: true, valor: { limite: 1 } });
    expect(leerPedidoClientes({ ...vinculo, limite: 500 })).toMatchObject({ ok: true, valor: { limite: 100 } });
    expect(leerPedidoClientes({ ...vinculo, limite: 7.9 })).toMatchObject({ ok: true, valor: { limite: 7 } });
    expect(leerPedidoClientes({ ...vinculo, limite: "20" })).toMatchObject({ ok: false });
  });

  it("clientes: la búsqueda es un nombre (sin tildes) o un correo desde el principio", () => {
    expect(leerPedidoClientes({ ...vinculo, buscar: "  Hernández " })).toMatchObject({
      ok: true,
      valor: { buscar: { por: "nombre", texto: "hernandez" } },
    });
    expect(leerPedidoClientes({ ...vinculo, buscar: "Ana@Gmail" })).toMatchObject({
      ok: true,
      valor: { buscar: { por: "correo", texto: "ana@gmail" } },
    });
    // Vacío es lo mismo que no mandarla.
    expect(leerPedidoClientes({ ...vinculo, buscar: "   " })).toMatchObject({ ok: true, valor: { buscar: null } });
    expect(leerPedidoClientes({ ...vinculo, buscar: "a" })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, buscar: "@gmail.com" })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, buscar: "x".repeat(81) })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ ...vinculo, buscar: 12 })).toMatchObject({ ok: false });
  });

  it("clientes: «antes» es la fecha ISO de «siguiente», tal cual", () => {
    const antes = "2026-10-01T15:00:00.000003+00:00";
    expect(leerPedidoClientes({ ...vinculo, antes })).toMatchObject({ ok: true, valor: { antes } });
    expect(leerPedidoClientes({ ...vinculo, antes: "ayer" })).toMatchObject({ ok: false });
    expect(leerPedidoClientes({ rancho_id: "x", programa_id: PROGRAMA })).toMatchObject({ ok: false });
  });

  it("guardar recompensa: lo que no viene queda `undefined` (se conserva al editar)", () => {
    expect(leerPedidoGuardarRecompensa({ ...vinculo, nombre: "Café", costo: 10, activo: true })).toEqual({
      ok: true,
      valor: {
        ranchoId: RANCHO,
        programaId: PROGRAMA,
        recompensaId: null,
        nombre: "Café",
        descripcion: undefined,
        costo: 10,
        activo: true,
        tipo: undefined,
        valor: undefined,
      },
    });
    const editar = leerPedidoGuardarRecompensa({
      ...vinculo,
      recompensa_id: RECOMPENSA.toUpperCase(),
      nombre: "Postre",
      descripcion: null,
      costo: 8,
      activo: false,
      tipo: null,
      valor: null,
    });
    expect(editar).toMatchObject({
      ok: true,
      valor: { recompensaId: RECOMPENSA, descripcion: null, tipo: null, valor: null, activo: false },
    });
  });

  it("guardar recompensa: la forma de cada campo", () => {
    const base = { ...vinculo, nombre: "Café", costo: 10, activo: true };
    expect(leerPedidoGuardarRecompensa({ ...base, recompensa_id: "no" })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarRecompensa({ ...base, nombre: undefined })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarRecompensa({ ...base, costo: "10" })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarRecompensa({ ...base, activo: "si" })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarRecompensa({ ...base, tipo: "regalo" })).toMatchObject({
      ok: false,
      motivo: "Ese tipo de recompensa no existe.",
    });
    expect(leerPedidoGuardarRecompensa({ ...base, valor: "10" })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarRecompensa({ ...base, descripcion: 3 })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarRecompensa({ ...base, tipo: "descuento_porcentaje", valor: 15 })).toMatchObject({
      ok: true,
      valor: { tipo: "descuento_porcentaje", valor: 15 },
    });
  });

  it("borrar recompensa: hace falta el id", () => {
    expect(leerPedidoBorrarRecompensa({ ...vinculo })).toMatchObject({ ok: false });
    expect(leerPedidoBorrarRecompensa({ ...vinculo, recompensa_id: RECOMPENSA })).toMatchObject({
      ok: true,
      valor: { recompensaId: RECOMPENSA },
    });
  });

  it("mensaje: de 3 a 120 caracteres, en una línea, con su intento", () => {
    expect(leerPedidoMensaje({ ...vinculo, texto: "MIÉRCOLES 2X1" })).toMatchObject({ ok: false });
    expect(leerPedidoMensaje({ ...vinculo, texto: "  Miércoles\n\t matchas  2x1 ", intento_id: INTENTO })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, texto: "Miércoles matchas 2x1", intentoId: INTENTO },
    });
    expect(leerPedidoMensaje({ ...vinculo, texto: " ab ", intento_id: INTENTO })).toMatchObject({ ok: false });
    expect(leerPedidoMensaje({ ...vinculo, texto: "x".repeat(120), intento_id: INTENTO })).toMatchObject({ ok: true });
    expect(leerPedidoMensaje({ ...vinculo, texto: "x".repeat(121), intento_id: INTENTO })).toMatchObject({ ok: false });
    expect(leerPedidoMensaje({ ...vinculo, texto: 5, intento_id: INTENTO })).toMatchObject({ ok: false });
  });

  it("mensajes automáticos: leer pide solo la tarjeta; guardar, la tarjeta y lo que cambia", () => {
    expect(leerPedidoMensajes({ ...vinculo })).toEqual({ ok: true, valor: { ranchoId: RANCHO, programaId: PROGRAMA } });
    expect(leerPedidoMensajes({ rancho_id: RANCHO })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarMensajes({ ...vinculo, mensajes: { canjear: { activo: false, texto: " ¡Que\nlo disfrutes! " } } })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, cambios: { canjear: { activo: false, texto: "¡Que lo disfrutes!" } } },
    });
    expect(leerPedidoGuardarMensajes({ ...vinculo })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarMensajes({ ...vinculo, mensajes: { sumar: { texto: "no" } } })).toMatchObject({ ok: false });
    expect(leerPedidoGuardarMensajes({ programa_id: PROGRAMA, mensajes: { sumar: { activo: true } } })).toMatchObject({ ok: false });
  });
});

describe("lo que sale de una persona", () => {
  it("el teléfono, enmascarado", () => {
    expect(enmascararTelefono("88887777")).toBe("****-7777");
    expect(enmascararTelefono("+506 8888-7777")).toBe("****-7777");
    expect(enmascararTelefono("123")).toBeNull();
    expect(enmascararTelefono(null)).toBeNull();
  });

  it("por el nombre no se busca un correo ni un teléfono que hayan quedado ahí", () => {
    expect(nombreBuscable("Ána María 88887777 ana@x.com")).toBe("ana maria");
    const ana = IDENTIDADES["m-ana"];
    expect(coincideConLaBusqueda({ por: "nombre", texto: "maria" }, ana)).toBe(true);
    expect(coincideConLaBusqueda({ por: "nombre", texto: "solis" }, ana)).toBe(true);
    expect(coincideConLaBusqueda({ por: "nombre", texto: "gmail" }, ana)).toBe(false);
    expect(coincideConLaBusqueda({ por: "nombre", texto: "ana" }, { nombre: "ana@x.com", correo: null })).toBe(false);
    expect(coincideConLaBusqueda({ por: "nombre", texto: "ana" }, undefined)).toBe(false);
  });

  it("el correo se busca desde el principio, nunca por un pedazo del medio", () => {
    const ana = IDENTIDADES["m-ana"];
    expect(coincideConLaBusqueda({ por: "correo", texto: "ana.solis@" }, ana)).toBe(true);
    expect(coincideConLaBusqueda({ por: "correo", texto: "ana.solis@gmail.com" }, ana)).toBe(true);
    expect(coincideConLaBusqueda({ por: "correo", texto: "solis@" }, ana)).toBe(false);
  });

  it("las fechas se comparan con microsegundos", () => {
    expect(microsDe("2026-10-01T15:00:00.000003+00:00")).toBe(Date.parse("2026-10-01T15:00:00Z") * 1000 + 3);
    expect(microsDe("2026-10-01T15:00:00Z")).toBe(microsDe("2026-10-01T15:00:00+00"));
    expect(esAnterior("2026-10-01T15:00:00.000002+00:00", "2026-10-01T15:00:00.000003+00:00")).toBe(true);
    expect(esAnterior("2026-10-01T15:00:00.000003+00:00", "2026-10-01T15:00:00.000003+00:00")).toBe(false);
    expect(esAnterior("2026-10-01T09:00:00-06:00", "2026-10-01T15:00:00.000001Z")).toBe(true);
  });

  it("saldo = todo el ledger; actividad = lo último que sumó o canjeó (no un ajuste)", () => {
    const a = agregadosPorMiembro([
      { id: "t1", miembro_id: "m-ana", puntos: 5, tipo: "ganado", reversion_de: null, created_at: "2026-09-01T10:00:00+00:00" },
      { id: "t2", miembro_id: "m-ana", puntos: -3, tipo: "canjeado", reversion_de: null, created_at: "2026-09-20T10:00:00+00:00" },
      { id: "t3", miembro_id: "m-ana", puntos: -1, tipo: "ajuste", reversion_de: null, created_at: "2026-09-30T10:00:00+00:00" },
      { id: "t4", miembro_id: "m-beto", puntos: 2, tipo: "ajuste", reversion_de: null, created_at: "2026-09-30T10:00:00+00:00" },
    ]);
    expect(a.get("m-ana")).toMatchObject({ saldo: 1, ultima: "2026-09-20T10:00:00+00:00" });
    expect(a.get("m-beto")).toMatchObject({ saldo: 2, ultima: null });
  });

  it("un cliente, como lo ve Foorkie: nunca un contacto completo", () => {
    const c = armarClienteDelPanel(
      { id: "m-ana", cliente_id: null, persona_id: "p", estado: "pausada", created_at: "2026-08-01T12:00:00.123456+00:00" },
      IDENTIDADES["m-ana"],
      { saldo: 7, acumulado: 17, visitas: 12, canjes: 1, ultimoCanje: "2026-09-02T10:00:00+00:00", ultima: "2026-09-20T10:00:00+00:00" },
    );
    expect(c).toEqual({
      miembro_id: "m-ana",
      nombre: "Ana",
      correo: "a***@gmail.com",
      telefono: "****-7777",
      saldo: 7,
      acumulado: 17,
      visitas: 12,
      canjes: 1,
      ultimo_canje: "2026-09-02T10:00:00.000Z",
      desde: "2026-08-01T12:00:00.123Z",
      ultima_actividad: "2026-09-20T10:00:00.000Z",
      estado: "pausada",
    });
    expect(armarClienteDelPanel({ id: "m-x", cliente_id: null, persona_id: null, estado: "activa", created_at: "2026-08-01T12:00:00Z" }, undefined, undefined)).toMatchObject({
      nombre: "Cliente",
      correo: null,
      telefono: null,
      saldo: 0,
      acumulado: 0,
      visitas: 0,
      canjes: 0,
      ultimo_canje: null,
      ultima_actividad: null,
    });
    // Sin `orden` no hay posición; con `orden`, la que se le dé.
    expect(c).not.toHaveProperty("posicion");
    expect(
      armarClienteDelPanel({ id: "m-x", cliente_id: null, persona_id: null, estado: "activa", created_at: "2026-08-01T12:00:00Z" }, undefined, undefined, 3),
    ).toMatchObject({ posicion: 3 });
  });
});

describe("las regalías", () => {
  const fila = (id: string, costo: number, activo = true, extra: Record<string, unknown> = {}) => ({
    id,
    programa_id: PROGRAMA,
    nombre: `Regalía ${costo}`,
    descripcion: null,
    costo_puntos: costo,
    activo,
    tipo: "producto",
    valor: null,
    stock_total: null,
    limite_por_cliente: null,
    sku: null,
    instrucciones: null,
    ...extra,
  });

  it("como las ve Foorkie, de la más barata a la más cara", () => {
    const lista = [
      fila("b", 10),
      fila("a", 5, false, { descripcion: "  ", tipo: "descuento_porcentaje", valor: "15" }),
      fila("c", 10, true, { nombre: "Agua", tipo: "inventado" }),
    ]
      .map(recompensaDelPanel)
      .filter((r) => r !== null);
    expect(ordenarRecompensas(lista).map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(lista[1]).toEqual({
      id: "a",
      nombre: "Regalía 5",
      descripcion: null,
      costo: 5,
      activo: false,
      tipo: "descuento_porcentaje",
      valor: 15,
    });
    expect(recompensaDelPanel({ ...fila("c", 3), tipo: "inventado" })?.tipo).toBeNull();
    expect(recompensaDelPanel({ nombre: "sin id" })).toBeNull();
  });

  it("al editar se conserva lo que Foorkie no edita (stock, tope, SKU, instrucciones)", () => {
    const previa = fila(RECOMPENSA, 10, true, {
      descripcion: "La de siempre",
      tipo: "descuento_porcentaje",
      valor: 20,
      stock_total: 50,
      limite_por_cliente: 2,
      sku: "CAFE-01",
      instrucciones: "Aplicar en caja",
    });
    const p: PedidoGuardarRecompensa = {
      ranchoId: RANCHO,
      programaId: PROGRAMA,
      recompensaId: RECOMPENSA,
      nombre: "Café grande",
      descripcion: undefined,
      costo: 12,
      activo: true,
      tipo: undefined,
      valor: undefined,
    };
    expect(entradaDeRecompensa(p, previa)).toEqual({
      nombre: "Café grande",
      descripcion: "La de siempre",
      costoPuntos: 12,
      activo: true,
      tipo: "descuento_porcentaje",
      valor: 20,
      stockTotal: 50,
      limitePorCliente: 2,
      sku: "CAFE-01",
      instrucciones: "Aplicar en caja",
    });
    // Cambia el tipo sin valor nuevo: el 20 (que era %) no pasa a ser ₡20.
    expect(entradaDeRecompensa({ ...p, tipo: "descuento_fijo" }, previa)).toMatchObject({ tipo: "descuento_fijo", valor: null });
    // null borra la descripción.
    expect(entradaDeRecompensa({ ...p, descripcion: null }, previa).descripcion).toBe("");
    // Nueva: todo vacío.
    expect(entradaDeRecompensa({ ...p, recompensaId: null }, null)).toMatchObject({
      descripcion: "",
      tipo: null,
      valor: null,
      stockTotal: null,
      limitePorCliente: null,
      sku: "",
      instrucciones: "",
    });
  });

  it("la meta es la activa más barata (costo y nombre); las apagadas no cuentan", () => {
    const filas = [fila("a", 10), fila("b", 5, false), fila("c", 20)];
    const firma = firmaDeLaMeta(filas);
    expect(firma).toBe(JSON.stringify([10, ["Regalía 10"]]));
    expect(firmaDeLaMeta([...filas.slice(0, 2), { ...filas[2], costo_puntos: 25 }])).toBe(firma);
    expect(firmaDeLaMeta([{ ...filas[0], nombre: "Café" }, filas[1], filas[2]])).not.toBe(firma);
    expect(firmaDeLaMeta([filas[0], { ...filas[1], activo: true }, filas[2]])).not.toBe(firma);
    expect(firmaDeLaMeta([fila("b", 5, false)])).toBeNull();
  });

  it("la meta se dibuja en sellos, puntos y cashback; no en los que llevan el beneficio adentro", () => {
    expect(["sellos", "puntos", "cashback"].every((t) => dibujaLaMeta(t as "sellos"))).toBe(true);
    expect(["cupon", "descuento", "membresia", "giftcard", "evento"].some((t) => dibujaLaMeta(t as "cupon"))).toBe(false);
  });

  it("una tarjeta ACTIVA de sellos o puntos no se queda sin regalía activa", () => {
    expect(quitaLaUltimaActiva({ tipo: "sellos", estado: "activo", activasAntes: 1, activasDespues: 0 })).toBe(true);
    expect(quitaLaUltimaActiva({ tipo: "puntos", estado: "activo", activasAntes: 1, activasDespues: 0 })).toBe(true);
    expect(quitaLaUltimaActiva({ tipo: "sellos", estado: "pausado", activasAntes: 1, activasDespues: 0 })).toBe(false);
    expect(quitaLaUltimaActiva({ tipo: "cashback", estado: "activo", activasAntes: 1, activasDespues: 0 })).toBe(false);
    expect(quitaLaUltimaActiva({ tipo: "sellos", estado: "activo", activasAntes: 2, activasDespues: 1 })).toBe(false);
    expect(quitaLaUltimaActiva({ tipo: "sellos", estado: "activo", activasAntes: 0, activasDespues: 0 })).toBe(false);
  });
});

describe("el aviso sin cupo dice lo mismo que el botón de Bookea", () => {
  it("singular y plural, con el día en que se abre", () => {
    const ahora = new Date("2026-10-15T18:00:00Z");
    expect(motivoSinCupo(1, ahora)).toBe("Ya usaste tu 1 notificación de este mes — vuelve a abrirse el 1 de noviembre.");
    expect(motivoSinCupo(25, ahora)).toBe("Ya usaste tus 25 notificaciones de este mes — vuelven a abrirse el 1 de noviembre.");
  });
});

// ════════════════════════════════════════════════════════════════════

describe("clientesDeLaTarjeta", () => {
  const miembro = (id: string, created_at: string, estado = "activa") => ({
    id,
    cliente_id: null,
    persona_id: `p-${id}`,
    estado,
    created_at,
  });

  // Con llaves: lo que devuelve `beforeEach` vitest lo corre como limpieza, y `mockClear` devuelve el mock.
  beforeEach(() => {
    vi.mocked(identidadesDeMiembros).mockClear();
  });

  it("sin búsqueda: la base arma la página y el conteo; saldo y actividad salen del ledger", async () => {
    const { db, consultas } = baseFalsa((c) => {
      if (c.tabla === "miembros" && filtro(c, "select")?.[2]) return { count: 3 };
      if (c.tabla === "miembros") {
        return {
          data: [
            miembro("m-ana", "2026-09-03T10:00:00.000003+00:00", "pausada"),
            miembro("m-beto", "2026-09-02T10:00:00.000002+00:00"),
            miembro("m-jose", "2026-09-01T10:00:00.000001+00:00"),
          ],
        };
      }
      if (c.tabla === "transacciones_puntos") {
        return {
          data: [
            { id: "t1", miembro_id: "m-ana", puntos: 4, tipo: "ganado", created_at: "2026-09-10T10:00:00+00:00" },
            { id: "t2", miembro_id: "m-ana", puntos: 2, tipo: "ganado", created_at: "2026-09-12T10:00:00+00:00" },
          ],
        };
      }
      return {};
    });

    const r = await clientesDeLaTarjeta(db, {
      ranchoId: RANCHO,
      programaId: PROGRAMA,
      buscar: null,
      limite: 2,
      antes: "2026-09-30T00:00:00Z",
      orden: null,
      desde: 0,
      resumen: false,
    });

    const deMiembros = consultas.filter((c) => c.tabla === "miembros");
    expect(deMiembros).toHaveLength(2);
    const conteo = deMiembros.find((c) => filtro(c, "select")?.[2]) as Consulta;
    const pagina = deMiembros.find((c) => !filtro(c, "select")?.[2]) as Consulta;
    expect(filtro(conteo, "select")?.[2]).toEqual({ count: "exact", head: true });
    expect(filtro(conteo, "eq", "programa_id")?.[2]).toBe(PROGRAMA);
    expect(filtro(conteo, "in", "estado")?.[2]).toEqual(["activa", "pausada"]);
    expect(filtro(pagina, "lt", "created_at")?.[2]).toBe("2026-09-30T00:00:00Z");
    expect(filtro(pagina, "limit")?.[1]).toBe(3);
    const ledger = consultas.find((c) => c.tabla === "transacciones_puntos") as Consulta;
    expect(filtro(ledger, "in", "miembro_id")?.[2]).toEqual(["m-ana", "m-beto"]);
    expect(filtro(ledger, "range")).toEqual(["range", 0, 999]);

    expect(r).toEqual({
      total: 3,
      siguiente: "2026-09-02T10:00:00.000002+00:00",
      siguienteDesde: null,
      resumen: null,
      clientes: [
        {
          miembro_id: "m-ana",
          nombre: "Ana",
          correo: "a***@gmail.com",
          telefono: "****-7777",
          saldo: 6,
          acumulado: 6,
          visitas: 2,
          canjes: 0,
          ultimo_canje: null,
          desde: "2026-09-03T10:00:00.000Z",
          ultima_actividad: "2026-09-12T10:00:00.000Z",
          estado: "pausada",
        },
        {
          miembro_id: "m-beto",
          nombre: "Cliente",
          correo: "b***@correo.cr",
          telefono: "****-2233",
          saldo: 0,
          acumulado: 0,
          visitas: 0,
          canjes: 0,
          ultimo_canje: null,
          desde: "2026-09-02T10:00:00.000Z",
          ultima_actividad: null,
          estado: "activa",
        },
      ],
    });
    // Para contar lo que se revirtió, el ledger se pide con `reversion_de`.
    expect(String(filtro(ledger, "select")?.[1])).toContain("reversion_de");
    // Solo se resolvió quién es la gente de la página, no la de toda la tarjeta.
    expect(vi.mocked(identidadesDeMiembros).mock.calls[0][1].map((m) => m.id)).toEqual(["m-ana", "m-beto"]);
    expect(JSON.stringify(r)).not.toMatch(/ana\.solis@|beto@|8888-7777|70112233|Solís/);
  });

  it("con búsqueda: filtra por quién es cada uno, cuenta todos y respeta el cursor", async () => {
    const { db, consultas } = baseFalsa((c) => {
      if (c.tabla === "miembros") {
        return {
          data: [
            miembro("m-jose", "2026-09-03T10:00:00.000003+00:00"),
            miembro("m-ana", "2026-09-02T10:00:00.000002+00:00"),
            miembro("m-beto", "2026-09-01T10:00:00.000001+00:00"),
          ],
        };
      }
      return { data: [] };
    });
    const pedir = (buscar: { por: "nombre" | "correo"; texto: string }, antes: string | null = null) =>
      clientesDeLaTarjeta(db, { ranchoId: RANCHO, programaId: PROGRAMA, buscar, limite: 10, antes, orden: null, desde: 0, resumen: false });

    const porNombre = await pedir({ por: "nombre", texto: "hernandez" });
    expect(porNombre?.total).toBe(1);
    expect(porNombre?.clientes.map((c) => c.nombre)).toEqual(["José"]);
    // Todos los miembros, por páginas del tamaño del `max_rows` de PostgREST.
    expect(filtro(consultas[0], "range")).toEqual(["range", 0, 999]);
    expect(filtro(consultas[0], "lt", "created_at")).toBeUndefined();

    const porCorreo = await pedir({ por: "correo", texto: "beto@" });
    expect(porCorreo?.clientes.map((c) => c.miembro_id)).toEqual(["m-beto"]);

    // Sin tildes y en cualquier parte del nombre; Beto, sin nombre, no sale por su correo.
    expect((await pedir({ por: "nombre", texto: "ana" }))?.clientes.map((c) => c.miembro_id)).toEqual(["m-ana"]);
    expect((await pedir({ por: "nombre", texto: "beto" }))?.total).toBe(0);
    // «e» solo está en «José Hernández»: con su propio cursor no queda nadie después.
    const conCursor = await pedir({ por: "nombre", texto: "e" }, "2026-09-03T10:00:00.000003+00:00");
    expect(conCursor?.total).toBe(1);
    expect(conCursor?.clientes).toEqual([]);
    expect(conCursor?.siguiente).toBeNull();
  });

  it("si la base no contesta, null (nunca una lista inventada)", async () => {
    const pedido = { ranchoId: RANCHO, programaId: PROGRAMA, buscar: null, limite: 50, antes: null, orden: null, desde: 0, resumen: false };
    const rota = baseFalsa(() => ({ error: { message: "caída" } }));
    expect(await clientesDeLaTarjeta(rota.db, pedido)).toBeNull();
    const sinLedger = baseFalsa((c) =>
      c.tabla === "transacciones_puntos"
        ? { error: { message: "caída" } }
        : c.tabla === "miembros" && filtro(c, "select")?.[2]
          ? { count: 1 }
          : { data: [miembro("m-ana", "2026-09-01T10:00:00+00:00")] },
    );
    expect(await clientesDeLaTarjeta(sinLedger.db, pedido)).toBeNull();
  });
});

describe("recompensas: leer, guardar y borrar", () => {
  const regalia = (id: string, costo: number, activo = true, extra: Record<string, unknown> = {}) => ({
    id,
    programa_id: PROGRAMA,
    nombre: `Regalía ${costo}`,
    descripcion: null,
    costo_puntos: costo,
    activo,
    tipo: null,
    valor: null,
    stock_total: null,
    limite_por_cliente: null,
    sku: null,
    instrucciones: null,
    ...extra,
  });

  function escenario(opciones: {
    modo?: string;
    estado?: string;
    regalias: Record<string, unknown>[];
    escribir?: (c: Consulta) => Respuesta;
  }) {
    return baseFalsa((c) => {
      if (c.tabla === "programa_lealtad") {
        return { data: { id: PROGRAMA, rancho_id: RANCHO, modo: opciones.modo ?? "sellos", estado: opciones.estado ?? "activo", activo: true } };
      }
      if (c.tabla === "recompensas" && c.op === "select") return { data: opciones.regalias };
      if (c.tabla === "recompensas") {
        if (opciones.escribir) return opciones.escribir(c);
        return { data: { ...(c.valores as object), id: c.op === "insert" ? "nueva" : RECOMPENSA, programa_id: PROGRAMA } };
      }
      return {};
    });
  }

  const pedido = (extra: Partial<PedidoGuardarRecompensa> = {}): PedidoGuardarRecompensa => ({
    ranchoId: RANCHO,
    programaId: PROGRAMA,
    recompensaId: null,
    nombre: "Postre",
    descripcion: undefined,
    costo: 8,
    activo: true,
    tipo: undefined,
    valor: undefined,
    ...extra,
  });

  it("la lista: activas y apagadas, ordenadas; si la base falla, null", async () => {
    const { db } = escenario({ regalias: [regalia("b", 20), regalia("a", 10, false)] });
    expect((await recompensasDeLaTarjeta(db, PROGRAMA))?.map((r) => [r.id, r.costo, r.activo])).toEqual([
      ["a", 10, false],
      ["b", 20, true],
    ]);
    expect(await recompensasDeLaTarjeta(baseFalsa(() => ({ error: { message: "x" } })).db, PROGRAMA)).toBeNull();
  });

  it("crear: se inserta en ESTA tarjeta, entera; si pasa a ser la meta de los sellos, hay que avisar", async () => {
    const { db, consultas } = escenario({ regalias: [regalia(RECOMPENSA, 10)] });
    const r = await guardarRecompensaDeFoorkie(db, pedido());
    const insert = consultas.find((c) => c.op === "insert") as Consulta;
    expect(insert.valores).toEqual({
      programa_id: PROGRAMA,
      nombre: "Postre",
      descripcion: null,
      costo_puntos: 8,
      activo: true,
      tipo: null,
      valor: null,
      stock_total: null,
      limite_por_cliente: null,
      sku: null,
      instrucciones: null,
    });
    expect(r).toEqual({
      ok: true,
      metaCambio: true,
      recompensa: { id: "nueva", nombre: "Postre", descripcion: null, costo: 8, activo: true, tipo: null, valor: null },
    });
  });

  it("editar una que no es la meta no le avisa a nadie; en un cupón tampoco", async () => {
    const cara = regalia(OTRA, 30);
    const { db } = escenario({ regalias: [regalia(RECOMPENSA, 10), cara] });
    const r = await guardarRecompensaDeFoorkie(db, pedido({ recompensaId: OTRA, nombre: "Almuerzo", costo: 40 }));
    expect(r).toMatchObject({ ok: true, metaCambio: false });

    const cupon = escenario({ modo: "cupon", regalias: [regalia(RECOMPENSA, 10)] });
    expect(await guardarRecompensaDeFoorkie(cupon.db, pedido({ recompensaId: RECOMPENSA, costo: 5 }))).toMatchObject({
      ok: true,
      metaCambio: false,
    });
  });

  it("editar conserva el stock, el SKU y las instrucciones, y escribe solo en esta tarjeta", async () => {
    const previa = regalia(RECOMPENSA, 10, true, { sku: "CAFE-01", stock_total: 50, instrucciones: "En caja" });
    const { db, consultas } = escenario({ regalias: [previa] });
    const r = await guardarRecompensaDeFoorkie(db, pedido({ recompensaId: RECOMPENSA, nombre: "Café", costo: 10 }));
    const update = consultas.find((c) => c.op === "update") as Consulta;
    expect(update.valores).toMatchObject({ nombre: "Café", sku: "CAFE-01", stock_total: 50, instrucciones: "En caja" });
    expect(filtro(update, "eq", "id")?.[2]).toBe(RECOMPENSA);
    expect(filtro(update, "eq", "programa_id")?.[2]).toBe(PROGRAMA);
    // Mismo costo, otro nombre: el pase dice el nombre de la regalía, así que se avisa.
    expect(r).toMatchObject({ ok: true, metaCambio: true });
  });

  it("los rechazos: de otra tarjeta, reglas de Bookea, la última activa y la base", async () => {
    const { db, consultas } = escenario({ regalias: [regalia(RECOMPENSA, 10)] });
    expect(await guardarRecompensaDeFoorkie(db, pedido({ recompensaId: OTRA }))).toMatchObject({
      ok: false,
      codigo: "recompensa_ajena",
      status: 404,
    });
    expect(await guardarRecompensaDeFoorkie(db, pedido({ costo: 0 }))).toMatchObject({
      ok: false,
      codigo: "datos",
      motivo: "La recompensa tiene que costar al menos 1.",
    });
    expect(await guardarRecompensaDeFoorkie(db, pedido({ tipo: "descuento_porcentaje", valor: 150 }))).toMatchObject({
      ok: false,
      codigo: "datos",
      motivo: "El descuento porcentual va de 1 a 100.",
    });
    expect(await guardarRecompensaDeFoorkie(db, pedido({ recompensaId: RECOMPENSA, costo: 10, activo: false }))).toMatchObject({
      ok: false,
      codigo: "ultima_recompensa",
      status: 409,
    });
    expect(consultas.some((c) => c.op !== "select")).toBe(false);

    // Pausada, sí se puede apagar la última.
    const pausada = escenario({ estado: "pausado", regalias: [regalia(RECOMPENSA, 10)] });
    expect(await guardarRecompensaDeFoorkie(pausada.db, pedido({ recompensaId: RECOMPENSA, activo: false }))).toMatchObject({ ok: true });

    const rota = escenario({
      regalias: [],
      escribir: () => ({ error: { code: "23514", message: 'violates check constraint "recompensas_detalle_check"' } }),
    });
    expect(await guardarRecompensaDeFoorkie(rota.db, pedido())).toMatchObject({
      ok: false,
      codigo: "rechazado",
      motivo: expect.stringContaining("fuera de rango"),
    });
  });

  it("borrar: lo que no está en la tarjeta no se toca; la última activa no; con canjes, se apaga", async () => {
    const a = escenario({ regalias: [regalia(RECOMPENSA, 10), regalia(OTRA, 20)] });
    expect(await borrarRecompensaDeFoorkie(a.db, { ranchoId: RANCHO, programaId: PROGRAMA, recompensaId: "77777777-7777-4777-8777-777777777777" })).toEqual({
      ok: true,
      borrada: false,
      metaCambio: false,
    });
    expect(a.consultas.some((c) => c.op === "delete")).toBe(false);

    const r = await borrarRecompensaDeFoorkie(a.db, { ranchoId: RANCHO, programaId: PROGRAMA, recompensaId: RECOMPENSA });
    expect(r).toEqual({ ok: true, borrada: true, metaCambio: true });
    const borrado = a.consultas.find((c) => c.op === "delete") as Consulta;
    expect(filtro(borrado, "eq", "id")?.[2]).toBe(RECOMPENSA);
    expect(filtro(borrado, "eq", "programa_id")?.[2]).toBe(PROGRAMA);

    const sola = escenario({ regalias: [regalia(RECOMPENSA, 10), regalia(OTRA, 20, false)] });
    expect(await borrarRecompensaDeFoorkie(sola.db, { ranchoId: RANCHO, programaId: PROGRAMA, recompensaId: RECOMPENSA })).toMatchObject({
      ok: false,
      codigo: "ultima_recompensa",
      status: 409,
    });

    const canjeada = escenario({
      regalias: [regalia(RECOMPENSA, 10), regalia(OTRA, 20)],
      escribir: () => ({ error: { code: "23503", message: "violates foreign key constraint" } }),
    });
    expect(await borrarRecompensaDeFoorkie(canjeada.db, { ranchoId: RANCHO, programaId: PROGRAMA, recompensaId: OTRA })).toMatchObject({
      ok: false,
      codigo: "con_canjes",
      status: 409,
    });
  });
});

describe("mandarMensajeDeFoorkie — el aviso, una sola vez por intento", () => {
  const pedido = { ranchoId: RANCHO, programaId: PROGRAMA, texto: "Miércoles 2x1", intentoId: INTENTO };

  beforeEach(() => {
    vi.mocked(reservarCupoNotificacion).mockReset();
    vi.mocked(liberarCupoNotificacion).mockClear();
    vi.mocked(enviarMensajePromocional).mockReset();
    vi.mocked(plataformasConfiguradas).mockReturnValue(["apple", "google"]);
  });

  function escenario(opciones: { registrado?: { rancho_id: string } | null; candado?: Respuesta; apple?: number } = {}) {
    let registrado = opciones.registrado ?? null;
    return baseFalsa((c) => {
      if (c.tabla === "notificaciones_promocionales" && c.op === "select") return { data: registrado };
      if (c.tabla === "notificaciones_promocionales") {
        const r = opciones.candado ?? {};
        if (!r.error) registrado = { rancho_id: RANCHO };
        return r;
      }
      if (c.tabla === "pases_wallet") return { count: opciones.apple ?? 0 };
      return {};
    });
  }

  it("con cupo: la reserva del paquete se queda con el intento como id y sale el aviso", async () => {
    vi.mocked(reservarCupoNotificacion).mockResolvedValue({ reservado: true, id: "reserva-1", limite: 25 });
    vi.mocked(enviarMensajePromocional).mockResolvedValue({
      ok: true,
      guardado: true,
      googleEnviados: 2,
      googleFallidos: 1,
      apple: { avisados: 1, fallidos: 0 },
    });
    const { db, consultas } = escenario({ apple: 3 });

    expect(await mandarMensajeDeFoorkie(db, pedido)).toEqual({ ok: true, enviados: 5, yaEstaba: false });
    expect(vi.mocked(reservarCupoNotificacion).mock.calls[0].slice(1)).toEqual([RANCHO, PROGRAMA, "arranque"]);
    const candado = consultas.find((c) => c.op === "update") as Consulta;
    expect(candado.valores).toEqual({ id: INTENTO });
    expect(filtro(candado, "eq", "id")?.[2]).toBe("reserva-1");
    expect(vi.mocked(enviarMensajePromocional)).toHaveBeenCalledWith(PROGRAMA, "Miércoles 2x1");
    const pases = consultas.find((c) => c.tabla === "pases_wallet") as Consulta;
    expect(filtro(pases, "eq", "miembros.programa_id")?.[2]).toBe(PROGRAMA);
    expect(filtro(pases, "eq", "plataforma")?.[2]).toBe("apple");
  });

  it("sin tope en el paquete: la fila del intento se inserta acá", async () => {
    vi.mocked(reservarCupoNotificacion).mockResolvedValue({ reservado: true, id: null, limite: null });
    vi.mocked(enviarMensajePromocional).mockResolvedValue({ ok: true, guardado: true, googleEnviados: 4, googleFallidos: 0, apple: null });
    const { db, consultas } = escenario({ apple: 7 });
    // `apple: null` = por Apple no salió nada (no había pases que marcar).
    expect(await mandarMensajeDeFoorkie(db, pedido)).toEqual({ ok: true, enviados: 4, yaEstaba: false });
    expect((consultas.find((c) => c.op === "insert") as Consulta).valores).toEqual({
      id: INTENTO,
      rancho_id: RANCHO,
      programa_id: PROGRAMA,
    });
  });

  it("un reintento del mismo intento no manda nada de nuevo", async () => {
    const { db } = escenario({ registrado: { rancho_id: RANCHO } });
    expect(await mandarMensajeDeFoorkie(db, pedido)).toEqual({ ok: true, enviados: 0, yaEstaba: true });
    expect(reservarCupoNotificacion).not.toHaveBeenCalled();
    expect(enviarMensajePromocional).not.toHaveBeenCalled();

    const ajeno = escenario({ registrado: { rancho_id: "otro" } });
    expect(await mandarMensajeDeFoorkie(ajeno.db, pedido)).toMatchObject({ ok: false, codigo: "datos", status: 400 });
  });

  it("dos envíos simultáneos del mismo intento: el segundo choca contra la llave y devuelve su reserva", async () => {
    vi.mocked(reservarCupoNotificacion).mockResolvedValue({ reservado: true, id: "reserva-2", limite: 25 });
    // Al empezar, nadie había anotado este intento; cuando choca, el otro envío ya dejó su fila.
    let primera = true;
    const conOtro = baseFalsa((c) => {
      if (c.tabla === "notificaciones_promocionales" && c.op === "select") {
        const r = primera ? null : { rancho_id: RANCHO };
        primera = false;
        return { data: r };
      }
      if (c.tabla === "notificaciones_promocionales") return { error: { code: "23505", message: "duplicate key" } };
      return {};
    });
    expect(await mandarMensajeDeFoorkie(conOtro.db, pedido)).toEqual({ ok: true, enviados: 0, yaEstaba: true });
    expect(liberarCupoNotificacion).toHaveBeenCalledWith(conOtro.db, "reserva-2");
    expect(enviarMensajePromocional).not.toHaveBeenCalled();
  });

  it("sin cupo: la frase de Bookea, sin mandar nada", async () => {
    vi.mocked(reservarCupoNotificacion).mockResolvedValue({ reservado: false, id: null, limite: 1 });
    const { db } = escenario();
    const r = await mandarMensajeDeFoorkie(db, pedido, new Date("2026-10-15T18:00:00Z"));
    expect(r).toEqual({
      ok: false,
      codigo: "sin_cupo",
      motivo: "Ya usaste tu 1 notificación de este mes — vuelve a abrirse el 1 de noviembre.",
      status: 409,
    });
    expect(enviarMensajePromocional).not.toHaveBeenCalled();
  });

  it("si el envío falla, se libera el cupo del intento y se puede reintentar", async () => {
    vi.mocked(reservarCupoNotificacion).mockResolvedValue({ reservado: true, id: "reserva-3", limite: 25 });
    vi.mocked(enviarMensajePromocional).mockResolvedValue({ ok: false, motivo: "No se pudo guardar el mensaje: x" });
    const { db } = escenario();
    expect(await mandarMensajeDeFoorkie(db, pedido)).toMatchObject({ ok: false, codigo: "no_enviado", status: 500 });
    expect(liberarCupoNotificacion).toHaveBeenCalledWith(db, INTENTO);
  });

  it("sin Apple configurado, los pases de Apple no se cuentan como enviados", async () => {
    vi.mocked(plataformasConfiguradas).mockReturnValue(["google"]);
    vi.mocked(reservarCupoNotificacion).mockResolvedValue({ reservado: true, id: "reserva-4", limite: 25 });
    vi.mocked(enviarMensajePromocional).mockResolvedValue({
      ok: true,
      guardado: true,
      googleEnviados: 3,
      googleFallidos: 0,
      apple: { avisados: 0, fallidos: 0 },
    });
    const { db, consultas } = escenario({ apple: 9 });
    expect(await mandarMensajeDeFoorkie(db, pedido)).toEqual({ ok: true, enviados: 3, yaEstaba: false });
    expect(consultas.some((c) => c.tabla === "pases_wallet")).toBe(false);
  });
});
