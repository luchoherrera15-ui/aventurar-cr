import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// La resolución de identidad tiene su propia suite (identidad-miembro);
// acá importa QUÉ sale de ella hacia Foorkie: nombre de pila y correo
// enmascarado, nunca el correo entero ni el teléfono.
vi.mock("@/lib/lealtad/identidades-db", () => ({
  miembrosConIdentidad: async (_db: unknown, filtro: { ids?: string[] }) =>
    (filtro.ids ?? []).map((id) => ({ id, cliente_id: null, persona_id: `p-${id}`, estado: "activa", created_at: "" })),
  identidadesDeMiembros: async (_db: unknown, miembros: { id: string }[]) =>
    new Map(miembros.map((m) => [m.id, IDENTIDADES[m.id] ?? { nombre: null, correo: null, telefono: null }])),
}));

import {
  armarClienteDeLaCaja,
  canalParaFoorkie,
  codigoDeRechazo,
  cortarPagina,
  detalleDelMovimiento,
  enmascararCorreo,
  historialDeLaCaja,
  leerCodigoEscaneado,
  leerOperador,
  leerPedidoAcreditar,
  leerPedidoBuscar,
  leerPedidoCanjear,
  leerPedidoHistorial,
  miembroPorCodigo,
  nombreDePila,
  PERMISOS_CAJA,
  productoDeLaCaja,
  recompensasParaCaja,
  tipoDelMovimiento,
} from "./foorkie-caja";

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const INTENTO = "44444444-4444-4444-8444-444444444444";
const RECOMPENSA = "55555555-5555-4555-8555-555555555555";
const SERIAL = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

const IDENTIDADES: Record<string, { nombre: string | null; correo: string | null; telefono: string | null }> = {
  "m-ana": { nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: "88887777" },
  "m-sin-nombre": { nombre: null, correo: "beto@correo.cr", telefono: "70112233" },
};

const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

// ── Lo que manda Foorkie ────────────────────────────────────────────

describe("leer lo que manda la caja (foorkie-caja)", () => {
  it("buscar: el código o el correo, exactamente uno", () => {
    expect(leerPedidoBuscar({ ...vinculo, codigo: SERIAL })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, codigo: SERIAL, correo: null },
    });
    expect(leerPedidoBuscar({ ...vinculo, correo: " Luis@Gmail.com " })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, codigo: null, correo: "luis@gmail.com" },
    });
    // Vacío es lo mismo que no mandarlo.
    expect(leerPedidoBuscar({ ...vinculo, codigo: "  ", correo: "luis@gmail.com" })).toMatchObject({ ok: true });
    expect(leerPedidoBuscar({ ...vinculo, codigo: SERIAL, correo: "luis@gmail.com" })).toMatchObject({ ok: false });
    expect(leerPedidoBuscar({ ...vinculo })).toMatchObject({ ok: false });
    expect(leerPedidoBuscar({ ...vinculo, codigo: "x".repeat(501) })).toMatchObject({ ok: false });
    expect(leerPedidoBuscar({ ...vinculo, codigo: 12345 })).toMatchObject({ ok: false });
    expect(leerPedidoBuscar({ ...vinculo, correo: "luis" })).toMatchObject({ ok: false });
    expect(leerPedidoBuscar({ rancho_id: "no-es-uuid", programa_id: PROGRAMA, codigo: SERIAL })).toMatchObject({ ok: false });
  });

  it("los ids llegan en minúscula: viajan adentro de la llave de idempotencia", () => {
    const r = leerPedidoAcreditar({
      rancho_id: RANCHO.toUpperCase(),
      programa_id: PROGRAMA,
      miembro_id: MIEMBRO.toUpperCase(),
      monto: 4500,
      intento_id: INTENTO.toUpperCase(),
    });
    expect(r).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO, monto: 4500, intentoId: INTENTO, operador: null },
    });
  });

  it("acreditar: monto número o null; el intento es obligatorio", () => {
    const base = { ...vinculo, miembro_id: MIEMBRO, intento_id: INTENTO };
    expect(leerPedidoAcreditar({ ...base, monto: null })).toMatchObject({ ok: true, valor: { monto: null } });
    expect(leerPedidoAcreditar({ ...base })).toMatchObject({ ok: true, valor: { monto: null } });
    // Los decimales los rechaza el núcleo con su frase (`monto_invalido`), no la puerta.
    expect(leerPedidoAcreditar({ ...base, monto: 4500.5 })).toMatchObject({ ok: true, valor: { monto: 4500.5 } });
    expect(leerPedidoAcreditar({ ...base, monto: "4500" })).toMatchObject({ ok: false });
    expect(leerPedidoAcreditar({ ...base, intento_id: undefined })).toMatchObject({ ok: false });
    expect(leerPedidoAcreditar({ ...base, intento_id: "corto" })).toMatchObject({ ok: false });
    expect(leerPedidoAcreditar({ ...base, miembro_id: undefined })).toMatchObject({ ok: false });
    expect(leerPedidoAcreditar({ ...base, operador: "  Ana \n López " })).toMatchObject({ ok: true, valor: { operador: "Ana López" } });
  });

  it("canjear: cliente, premio e intento", () => {
    const base = { ...vinculo, miembro_id: MIEMBRO, recompensa_id: RECOMPENSA, intento_id: INTENTO };
    expect(leerPedidoCanjear(base)).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, miembroId: MIEMBRO, recompensaId: RECOMPENSA, intentoId: INTENTO },
    });
    expect(leerPedidoCanjear({ ...base, recompensa_id: undefined })).toMatchObject({ ok: false });
    expect(leerPedidoCanjear({ ...base, intento_id: undefined })).toMatchObject({ ok: false });
  });

  it("historial: 30 por defecto, de 1 a 100, y «antes» con la fecha exacta de la base", () => {
    expect(leerPedidoHistorial({ ...vinculo })).toMatchObject({ ok: true, valor: { limite: 30, antes: null } });
    expect(leerPedidoHistorial({ ...vinculo, limite: 0 })).toMatchObject({ ok: true, valor: { limite: 1 } });
    expect(leerPedidoHistorial({ ...vinculo, limite: 500 })).toMatchObject({ ok: true, valor: { limite: 100 } });
    expect(leerPedidoHistorial({ ...vinculo, limite: 12.7 })).toMatchObject({ ok: true, valor: { limite: 12 } });
    expect(leerPedidoHistorial({ ...vinculo, limite: "10" })).toMatchObject({ ok: false });
    const deLaBase = "2026-10-01T15:04:05.123456+00:00";
    expect(leerPedidoHistorial({ ...vinculo, antes: deLaBase })).toMatchObject({ ok: true, valor: { antes: deLaBase } });
    expect(leerPedidoHistorial({ ...vinculo, antes: "2026-10-01T15:04:05.123Z" })).toMatchObject({ ok: true });
    expect(leerPedidoHistorial({ ...vinculo, antes: "ayer" })).toMatchObject({ ok: false });
    expect(leerPedidoHistorial({ ...vinculo, antes: "2026-10-01" })).toMatchObject({ ok: false });
  });

  it("quien operó queda como concepto de la compra, en una línea y con tope", () => {
    expect(productoDeLaCaja(leerOperador("  Ana \t López "))).toBe("Caja Foorkie · Ana López");
    expect(productoDeLaCaja(null)).toBe("Caja Foorkie");
    expect(leerOperador("x".repeat(100))).toHaveLength(80);
    expect(leerOperador(42)).toBeNull();
    expect(leerOperador("   ")).toBeNull();
  });

  it("la caja suma y canjea; nunca revierte ni audita", () => {
    expect(PERMISOS_CAJA).toEqual({ acreditar: true, canjear: true, revertir: false, auditoria: false });
  });

  it("el código de un rechazo es un identificador; la frase del RPC queda solo en el motivo", () => {
    expect(codigoDeRechazo("monto_invalido")).toBe("monto_invalido");
    expect(codigoDeRechazo("ya-canjeado")).toBe("ya-canjeado");
    expect(codigoDeRechazo("Este cliente ya llegó a su tope de hoy.")).toBe("rechazado");
    expect(codigoDeRechazo(undefined)).toBe("rechazado");
  });
});

// ── El código que leyó la cámara ────────────────────────────────────

describe("leerCodigoEscaneado — del texto crudo al serial del pase", () => {
  it("el serial pelado, aunque venga con espacios, salto de línea o en mayúsculas", () => {
    expect(leerCodigoEscaneado(`  ${SERIAL}\n`)).toEqual([SERIAL]);
    expect(leerCodigoEscaneado(SERIAL.toUpperCase())).toEqual([SERIAL]);
  });

  it("con prefijo de lector, con otro separador, sin guiones o adentro de un link", () => {
    expect(leerCodigoEscaneado(`]Q1${SERIAL}`)).toEqual([SERIAL]);
    expect(leerCodigoEscaneado(SERIAL.replace(/-/g, "'"))).toEqual([SERIAL]);
    expect(leerCodigoEscaneado(SERIAL.replace(/-/g, ""))).toEqual([SERIAL, SERIAL.replace(/-/g, "")]);
    expect(leerCodigoEscaneado(`https://bookea.lat/x?serial=${SERIAL}`)).toEqual([SERIAL]);
  });

  it("un serial viejo que no es uuid se busca tal cual; lo que no puede ser serial, no", () => {
    expect(leerCodigoEscaneado("SERIAL-001")).toEqual(["SERIAL-001"]);
    expect(leerCodigoEscaneado("hola, (mundo)")).toEqual([]);
    expect(leerCodigoEscaneado("")).toEqual([]);
    expect(leerCodigoEscaneado(" \n ")).toEqual([]);
    expect(leerCodigoEscaneado("a".repeat(501))).toEqual([]);
  });

  it("tres candidatos como mucho", () => {
    const varios = [SERIAL, MIEMBRO, PROGRAMA, RANCHO].join(" ");
    expect(leerCodigoEscaneado(varios)).toEqual([SERIAL, MIEMBRO, PROGRAMA]);
  });
});

// ── Lo que sale de una persona ──────────────────────────────────────

describe("lo que sale de una persona hacia Foorkie", () => {
  it("el correo, enmascarado", () => {
    expect(enmascararCorreo("luis@gmail.com")).toBe("l***@gmail.com");
    expect(enmascararCorreo("  Luis.Herrera@Gmail.COM ")).toBe("l***@gmail.com");
    expect(enmascararCorreo("a@b.co")).toBe("a***@b.co");
    expect(enmascararCorreo("sin-arroba")).toBeNull();
    expect(enmascararCorreo("@gmail.com")).toBeNull();
    expect(enmascararCorreo("x@")).toBeNull();
    expect(enmascararCorreo(null)).toBeNull();
  });

  it("el nombre de pila, o «Cliente»; nunca un correo o un teléfono metidos en el nombre", () => {
    expect(nombreDePila("María José Pérez")).toBe("María");
    expect(nombreDePila("  ana  ")).toBe("ana");
    expect(nombreDePila(null)).toBe("Cliente");
    expect(nombreDePila("   ")).toBe("Cliente");
    expect(nombreDePila("melissa@gmail.com")).toBe("Cliente");
    expect(nombreDePila("8888-7777")).toBe("Cliente");
  });
});

// ── Buscar ──────────────────────────────────────────────────────────

describe("armarClienteDeLaCaja — la tarjeta del cliente, como la ve la caja", () => {
  const sellos = { id: PROGRAMA, rancho_id: RANCHO, nombre: "Tarjeta", modo: "sellos", estado: "activo", activo: true };

  it("premios del más barato al más caro, con «¿le alcanza?»", () => {
    expect(
      recompensasParaCaja(
        [
          { id: "b", nombre: "Postre", costo_puntos: 10 },
          { id: "a", nombre: "Café", costo_puntos: 5 },
          { id: "c", nombre: "Roto", costo_puntos: 0 },
        ],
        7,
      ),
    ).toEqual([
      { id: "a", nombre: "Café", costo: 5, alcanza: true },
      { id: "b", nombre: "Postre", costo: 10, alcanza: false },
    ]);
  });

  it("sellos: «5 de 10» y el mismo texto que el pase", () => {
    const c = armarClienteDeLaCaja({
      miembroId: MIEMBRO,
      estadoMiembro: "activa",
      quien: { nombre: "Ana", correo: "a***@gmail.com" },
      fila: sellos,
      negocio: "Pura Prueba",
      saldo: 5,
      recompensas: [{ id: RECOMPENSA, nombre: "Un matcha gratis", costo_puntos: 10 }],
    });
    expect(c).toMatchObject({
      miembro_id: MIEMBRO,
      nombre: "Ana",
      correo: "a***@gmail.com",
      tipo: "sellos",
      saldo: 5,
      pausada: false,
      progreso: { actual: 5, total: 10 },
      recompensas: [{ id: RECOMPENSA, nombre: "Un matcha gratis", costo: 10, alcanza: false }],
    });
    expect(c.textos.encabezado).toEqual({ label: "SELLOS", value: "5/10" });
  });

  it("un cliente suspendido por el negocio se muestra en pausa", () => {
    const c = armarClienteDeLaCaja({
      miembroId: MIEMBRO,
      estadoMiembro: "pausada",
      quien: { nombre: "Cliente", correo: null },
      fila: sellos,
      negocio: "Pura Prueba",
      saldo: 0,
      recompensas: [],
    });
    expect(c.pausada).toBe(true);
    expect(c.recompensas).toEqual([]);
  });

  it("cashback: sin progreso de sellos", () => {
    const c = armarClienteDeLaCaja({
      miembroId: MIEMBRO,
      estadoMiembro: "activa",
      quien: { nombre: "Ana", correo: null },
      fila: { ...sellos, modo: "cashback", beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null } },
      negocio: "Donde Prueba",
      saldo: 1250,
      recompensas: [],
    });
    expect(c.tipo).toBe("cashback");
    expect(c.progreso).toBeNull();
    expect(c.textos.encabezado.label).toBe("SALDO");
  });
});

// ── El historial ────────────────────────────────────────────────────

describe("el historial: tipo, canal, detalle y páginas", () => {
  it("tipo de movimiento", () => {
    expect(tipoDelMovimiento({ tipo: "ganado", reversion_de: null })).toBe("acredito");
    expect(tipoDelMovimiento({ tipo: "canjeado", reversion_de: null })).toBe("canjeo");
    expect(tipoDelMovimiento({ tipo: "ajuste", reversion_de: "tx-1" })).toBe("reverso");
    expect(tipoDelMovimiento({ tipo: "ajuste", reversion_de: null })).toBe("ajuste");
  });

  it("canal: la misma tabla de prefijos que la Actividad de Bookea", () => {
    const canal = (referencia: string | null, extra: { llave_id?: string; usuario_id?: string } = {}) =>
      canalParaFoorkie({ referencia, llave_id: extra.llave_id ?? null, usuario_id: extra.usuario_id ?? null });
    expect(canal(`foorkie:${MIEMBRO}`)).toBe("pedido");
    expect(canal(`mostrador:${MIEMBRO}:${INTENTO}`)).toBe("caja");
    expect(canal(`escaneo:${SERIAL}:${INTENTO}`)).toBe("escaneo");
    expect(canal(`panel:${MIEMBRO}:visita:2026-10-01T14:28`)).toBe("panel");
    // El canje de una caja lleva el intento; el del panel web, el minuto.
    expect(canal(`canje:${MIEMBRO}:${RECOMPENSA}:${INTENTO}`)).toBe("caja");
    expect(canal(`canje:${MIEMBRO}:${RECOMPENSA}:2026-10-01T14:28`)).toBe("panel");
    // Una reversión no lleva referencia, pero sí a la persona que la hizo en el panel.
    expect(canal(null, { usuario_id: "u-1" })).toBe("panel");
    expect(canal(null)).toBe("otro");
    expect(canal("api:factura-1")).toBe("otro");
    expect(canal("cita:reserva-7")).toBe("otro");
    expect(canal("venc:2026-08-01")).toBe("otro");
    // La llave de la API gana sobre cualquier referencia.
    expect(canal(`mostrador:${MIEMBRO}:${INTENTO}`, { llave_id: "llave-1" })).toBe("otro");
  });

  it("detalle: el concepto de la compra, el premio o el motivo", () => {
    expect(detalleDelMovimiento({ tipo: "acredito", producto: "Pedido en línea #A1B2C3", motivo: "Compra en línea (Foorkie)" })).toBe(
      "Pedido en línea #A1B2C3",
    );
    expect(detalleDelMovimiento({ tipo: "acredito", producto: null, motivo: "Compra (mostrador)" })).toBe("Compra (mostrador)");
    expect(detalleDelMovimiento({ tipo: "canjeo", producto: null, motivo: "Canje: Café gratis" })).toBe("Café gratis");
    expect(detalleDelMovimiento({ tipo: "reverso", producto: null, motivo: "Reversión" })).toBe("Reversión");
    expect(detalleDelMovimiento({ tipo: "ajuste", producto: null, motivo: "Pedido por juan.perez@gmail.com" })).toBe(
      "Pedido por j***@gmail.com",
    );
    expect(detalleDelMovimiento({ tipo: "ajuste", producto: null, motivo: "  " })).toBeNull();
    const largo = detalleDelMovimiento({ tipo: "ajuste", producto: null, motivo: "x".repeat(300) });
    expect(largo).toHaveLength(140);
    expect(largo?.endsWith("…")).toBe(true);
  });

  it("páginas: `siguiente` es la fecha de la última fila; sin más filas, null", () => {
    const filas = (fechas: string[]) => fechas.map((created_at, i) => ({ id: `t${i}`, created_at }));
    expect(cortarPagina(filas(["5", "4", "3"]), 5)).toEqual({ pagina: filas(["5", "4", "3"]), siguiente: null });
    expect(cortarPagina(filas(["6", "5", "4", "3", "2", "1"]), 5)).toEqual({
      pagina: filas(["6", "5", "4", "3", "2"]),
      siguiente: "2",
    });
  });

  it("páginas: un mismo instante no se parte entre dos páginas", () => {
    const filas = ["6", "5", "4", "3", "2", "2"].map((created_at, i) => ({ id: `t${i}`, created_at }));
    const { pagina, siguiente } = cortarPagina(filas, 5);
    expect(pagina.map((f) => f.created_at)).toEqual(["6", "5", "4", "3"]);
    expect(siguiente).toBe("3");
    // Una página entera en el mismo instante (no pasa en la práctica): se entrega igual.
    const iguales = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, created_at: "7" }));
    expect(cortarPagina(iguales, 5)).toEqual({ pagina: iguales.slice(0, 5), siguiente: "7" });
  });
});

// ── Con una base de mentira: qué se le pide y qué se devuelve ───────

type Consulta = { tabla: string; filtros: unknown[][] };

/**
 * Un query-builder falso: cada método anota lo que se le pidió y
 * encadena; al final resuelve con lo que diga `responder` para esa
 * consulta. Lo justo para lo que usa `foorkie-caja.ts`.
 */
function baseFalsa(responder: (c: Consulta) => { data: unknown; error: unknown }) {
  const consultas: Consulta[] = [];
  const db = {
    from(tabla: string) {
      const c: Consulta = { tabla, filtros: [] };
      consultas.push(c);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "lt", "order", "limit", "maybeSingle"]) {
        b[m] = (...args: unknown[]) => {
          c.filtros.push([m, ...args]);
          return b;
        };
      }
      b.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => responder(c))
          .then(ok, mal);
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, consultas };
}

const filtro = (c: Consulta, metodo: string, columna: string) => c.filtros.find((f) => f[0] === metodo && f[1] === columna)?.[2];

describe("miembroPorCodigo — pase → miembro → la tarjeta de Foorkie", () => {
  function escenario(miembro: { programa_id: string; estado?: string } | null, ranchoDeLaOtra = RANCHO) {
    return baseFalsa((c) => {
      if (c.tabla === "pases_wallet") {
        const seriales = filtro(c, "in", "serial_number") as string[];
        return { data: seriales.includes(SERIAL) ? [{ miembro_id: MIEMBRO }] : [], error: null };
      }
      if (c.tabla === "miembros") {
        return { data: miembro ? { id: MIEMBRO, persona_id: null, cliente_id: null, estado: "activa", ...miembro } : null, error: null };
      }
      if (c.tabla === "programa_lealtad") return { data: { rancho_id: ranchoDeLaOtra }, error: null };
      return { data: null, error: null };
    });
  }

  it("lo que no puede ser una tarjeta no llega a la base", async () => {
    const { db, consultas } = escenario({ programa_id: PROGRAMA });
    expect(await miembroPorCodigo(db, RANCHO, PROGRAMA, "hola, (mundo)")).toMatchObject({ ok: false, codigo: "no_encontrado" });
    expect(consultas).toHaveLength(0);
  });

  it("encuentra al miembro aunque la cámara lea el serial en mayúsculas", async () => {
    const { db, consultas } = escenario({ programa_id: PROGRAMA });
    const r = await miembroPorCodigo(db, RANCHO, PROGRAMA, `${SERIAL.toUpperCase()}\r\n`);
    expect(r).toMatchObject({ ok: true, miembro: { id: MIEMBRO, programa_id: PROGRAMA } });
    expect(filtro(consultas[0], "in", "serial_number")).toEqual([SERIAL]);
  });

  it("un serial que no existe", async () => {
    const { db } = escenario({ programa_id: PROGRAMA });
    expect(await miembroPorCodigo(db, RANCHO, PROGRAMA, MIEMBRO)).toMatchObject({ ok: false, codigo: "no_encontrado" });
  });

  it("otra tarjeta del mismo negocio, u otro negocio: tarjeta_ajena", async () => {
    const otra = "66666666-6666-4666-8666-666666666666";
    const mismo = await miembroPorCodigo(escenario({ programa_id: otra }).db, RANCHO, PROGRAMA, SERIAL);
    expect(mismo).toMatchObject({ ok: false, codigo: "tarjeta_ajena" });
    expect(mismo.ok ? "" : mismo.motivo).toMatch(/otra tarjeta de lealtad de este negocio/);
    const ajeno = await miembroPorCodigo(escenario({ programa_id: otra }, "otro-rancho").db, RANCHO, PROGRAMA, SERIAL);
    expect(ajeno).toMatchObject({ ok: false, codigo: "tarjeta_ajena", motivo: "Esa tarjeta es de otro negocio." });
  });

  it("una membresía dada de baja no se atiende", async () => {
    const r = await miembroPorCodigo(escenario({ programa_id: PROGRAMA, estado: "cancelada" }).db, RANCHO, PROGRAMA, SERIAL);
    expect(r).toMatchObject({ ok: false, codigo: "no_encontrado" });
  });

  it("si la base falla no se dice «no existe»", async () => {
    const { db } = baseFalsa(() => ({ data: null, error: { message: "caída" } }));
    expect(await miembroPorCodigo(db, RANCHO, PROGRAMA, SERIAL)).toMatchObject({ ok: false, codigo: "error_base" });
  });
});

describe("historialDeLaCaja — el ledger de ESTA tarjeta", () => {
  const fila = (id: string, extra: Record<string, unknown>) => ({
    id,
    miembro_id: "m-ana",
    tipo: "ganado",
    puntos: 1,
    motivo: "Compra (mostrador)",
    referencia: null,
    reversion_de: null,
    usuario_id: "u-1",
    llave_id: null,
    ...extra,
  });

  it("filtra por la tarjeta, pagina por fecha y arma cada movimiento sin datos de contacto", async () => {
    let pedidasAlLedger = 0;
    const { db, consultas } = baseFalsa((c) => {
      if (c.tabla === "transacciones_puntos") {
        pedidasAlLedger += 1;
        // Base sin la 0178: el primer intento (con `llave_id`) falla y se repite sin ella.
        if (String(c.filtros[0][1]).includes("llave_id")) return { data: null, error: { message: "column llave_id does not exist" } };
        return {
          data: [
            fila("t1", {
              referencia: `mostrador:m-ana:${INTENTO}`,
              puntos: 450,
              created_at: "2026-10-01T15:00:00.000003+00:00",
            }),
            fila("t2", {
              miembro_id: "m-sin-nombre",
              tipo: "canjeado",
              puntos: -10,
              motivo: "Canje: Café gratis",
              referencia: `canje:m-sin-nombre:${RECOMPENSA}:${INTENTO}`,
              created_at: "2026-10-01T14:00:00.000002+00:00",
            }),
            fila("t3", { referencia: "foorkie:pedido-1", usuario_id: null, created_at: "2026-10-01T13:00:00.000001+00:00" }),
          ],
          error: null,
        };
      }
      if (c.tabla === "lealtad_transacciones") {
        return {
          data: [
            { referencia: `mostrador:m-ana:${INTENTO}`, producto: "Caja Foorkie · Ana" },
            { referencia: "foorkie:pedido-1", producto: "Pedido en línea #A1B2C3" },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const r = await historialDeLaCaja(db, { ranchoId: RANCHO, programaId: PROGRAMA, limite: 2, antes: "2026-10-02T00:00:00.5+00:00" });
    expect(pedidasAlLedger).toBe(2);
    const ledger = consultas.filter((c) => c.tabla === "transacciones_puntos")[1];
    expect(filtro(ledger, "eq", "miembros.programa_id")).toBe(PROGRAMA);
    expect(filtro(ledger, "lt", "created_at")).toBe("2026-10-02T00:00:00.5+00:00");
    expect(ledger.filtros).toContainEqual(["limit", 3]);
    expect(String(ledger.filtros[0][1])).toContain("miembros!inner(programa_id)");

    // Se pidieron 3, se muestran 2: el cursor es la fecha EXACTA de la segunda.
    expect(r?.siguiente).toBe("2026-10-01T14:00:00.000002+00:00");
    expect(r?.movimientos).toEqual([
      {
        id: "t1",
        fecha: "2026-10-01T15:00:00.000Z",
        tipo: "acredito",
        puntos: 450,
        cliente: "Ana",
        correo: "a***@gmail.com",
        canal: "caja",
        detalle: "Caja Foorkie · Ana",
      },
      {
        id: "t2",
        fecha: "2026-10-01T14:00:00.000Z",
        tipo: "canjeo",
        puntos: -10,
        cliente: "Cliente",
        correo: "b***@correo.cr",
        canal: "caja",
        detalle: "Café gratis",
      },
    ]);
    // Solo se buscó el concepto de las compras de la página.
    const ventas = consultas.find((c) => c.tabla === "lealtad_transacciones");
    expect(filtro(ventas as Consulta, "in", "referencia")).toEqual([`mostrador:m-ana:${INTENTO}`]);
    // Ni el teléfono ni el correo completo salen, en ningún campo.
    expect(JSON.stringify(r)).not.toMatch(/88887777|70112233|ana\.solis@|beto@/);
  });

  it("sin movimientos: lista vacía y sin cursor; si la base no contesta, null", async () => {
    const vacia = baseFalsa(() => ({ data: [], error: null }));
    expect(await historialDeLaCaja(vacia.db, { ranchoId: RANCHO, programaId: PROGRAMA, limite: 30, antes: null })).toEqual({
      movimientos: [],
      siguiente: null,
    });
    expect(vacia.consultas.filter((c) => c.tabla === "transacciones_puntos")[0].filtros.some((f) => f[0] === "lt")).toBe(false);
    const rota = baseFalsa(() => ({ data: null, error: { message: "caída" } }));
    expect(await historialDeLaCaja(rota.db, { ranchoId: RANCHO, programaId: PROGRAMA, limite: 30, antes: null })).toBeNull();
  });
});
