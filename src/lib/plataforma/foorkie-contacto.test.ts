import { describe, expect, it, vi } from "vitest";

/**
 * El contacto completo de los clientes que aceptaron que el negocio los
 * contacte (13 oct 2026). Las reglas puras, sin base: quién aceptó (la
 * misma cuenta que `persona_acepta`, 0138), qué sale de cada cliente y la
 * forma del pedido. `clientes/contacto/route.test.ts` las prueba de punta
 * a punta con la puerta firmada.
 */

vi.mock("@/lib/lealtad/identidades-db", () => ({ miembrosConIdentidad: vi.fn(async () => []), identidadesDeMiembros: vi.fn(async () => new Map()) }));
vi.mock("@/lib/lealtad/plan-del-negocio", () => ({ planDelNegocio: vi.fn(async () => "arranque") }));
vi.mock("@/lib/wallet/mensaje-promocional", () => ({ enviarMensajePromocional: vi.fn() }));
vi.mock("@/lib/wallet/aviso-de-pausa", () => ({ plataformasConfiguradas: vi.fn(() => ["apple", "google"]) }));
vi.mock("@/lib/wallet/aviso-de-diseno", () => ({ avisarCambioDeDiseno: vi.fn() }));
vi.mock("@/lib/wallet/google", () => ({ refrescarClaseGoogle: vi.fn() }));

import {
  aceptaContacto,
  armarContacto,
  CONTACTOS_MAXIMO,
  correoLimpio,
  filaDeConsentimiento,
  leerPedidoContacto,
  nombreCompleto,
  telefonoEnDigitos,
  type FilaDeConsentimiento,
  type NegocioDelPermiso,
} from "./foorkie-contacto";

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const CUENTA = "99999999-9999-4999-8999-999999999999";
const OTRO_RANCHO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEGOCIO: NegocioDelPermiso = { ranchoId: RANCHO, cuentaId: null };

let n = 0;
function fila(extra: Partial<FilaDeConsentimiento> & Pick<FilaDeConsentimiento, "estado" | "created_at">): FilaDeConsentimiento {
  n += 1;
  return { id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, persona_id: "p1", ambito: "negocio", canal: "correo", cuenta_id: null, rancho_id: RANCHO, ...extra };
}

describe("aceptaContacto: la misma cuenta que persona_acepta", () => {
  it("la última fila del negocio manda: aceptado → sí, revocado → no", () => {
    const acepto = fila({ estado: "aceptado", created_at: "2026-08-01T10:00:00+00:00" });
    expect(aceptaContacto([acepto], "p1", "correo", NEGOCIO)).toBe(true);
    const revoco = fila({ estado: "revocado", created_at: "2026-09-01T10:00:00+00:00" });
    expect(aceptaContacto([acepto, revoco], "p1", "correo", NEGOCIO)).toBe(false);
    // El orden de la lista no importa: manda la fecha.
    expect(aceptaContacto([revoco, acepto], "p1", "correo", NEGOCIO)).toBe(false);
    // Revocó y volvió a aceptar.
    const volvio = fila({ estado: "aceptado", created_at: "2026-09-02T10:00:00+00:00" });
    expect(aceptaContacto([revoco, acepto, volvio], "p1", "correo", NEGOCIO)).toBe(true);
  });

  it("sin filas no hay permiso: el silencio no es un sí", () => {
    expect(aceptaContacto([], "p1", "correo", NEGOCIO)).toBe(false);
    expect(aceptaContacto([], "p1", "whatsapp", NEGOCIO)).toBe(false);
  });

  it("cada canal por separado", () => {
    const filas = [
      fila({ canal: "correo", estado: "aceptado", created_at: "2026-08-01T10:00:00+00:00" }),
      fila({ canal: "whatsapp", estado: "revocado", created_at: "2026-08-01T10:00:00+00:00" }),
    ];
    expect(aceptaContacto(filas, "p1", "correo", NEGOCIO)).toBe(true);
    expect(aceptaContacto(filas, "p1", "whatsapp", NEGOCIO)).toBe(false);
  });

  it("solo cuentan las filas de ESTA persona y de ESTE negocio", () => {
    const deOtra = fila({ persona_id: "p2", estado: "aceptado", created_at: "2026-08-01T10:00:00+00:00" });
    const deOtroNegocio = fila({ rancho_id: OTRO_RANCHO, estado: "aceptado", created_at: "2026-08-01T10:00:00+00:00" });
    expect(aceptaContacto([deOtra, deOtroNegocio], "p1", "correo", NEGOCIO)).toBe(false);
    // Una fila de otro negocio, más nueva, no le quita el permiso de este.
    const aceptoAca = fila({ estado: "aceptado", created_at: "2026-08-01T10:00:00+00:00" });
    const revocoAlla = fila({ rancho_id: OTRO_RANCHO, estado: "revocado", created_at: "2026-09-01T10:00:00+00:00" });
    expect(aceptaContacto([aceptoAca, revocoAlla], "p1", "correo", NEGOCIO)).toBe(true);
  });

  it("el negocio también se reconoce por su cuenta", () => {
    const porCuenta = fila({ rancho_id: null, cuenta_id: CUENTA, estado: "aceptado", created_at: "2026-08-01T10:00:00+00:00" });
    expect(aceptaContacto([porCuenta], "p1", "correo", NEGOCIO)).toBe(false);
    expect(aceptaContacto([porCuenta], "p1", "correo", { ranchoId: RANCHO, cuentaId: CUENTA })).toBe(true);
  });

  it("si se bajó de toda la plataforma, no hay permiso aunque el negocio diga que sí", () => {
    const negocio = fila({ estado: "aceptado", created_at: "2026-08-01T10:00:00+00:00" });
    const baja = fila({ ambito: "bookea", rancho_id: null, estado: "revocado", created_at: "2026-09-01T10:00:00+00:00" });
    expect(aceptaContacto([negocio, baja], "p1", "correo", NEGOCIO)).toBe(false);
    // Una fila de plataforma aceptada no reemplaza el permiso del negocio...
    const plataformaSi = fila({ ambito: "bookea", rancho_id: null, estado: "aceptado", created_at: "2026-09-01T10:00:00+00:00" });
    expect(aceptaContacto([plataformaSi], "p1", "correo", NEGOCIO)).toBe(false);
    // ...ni le quita nada si vino después de una baja vieja.
    const bajaVieja = fila({ ambito: "bookea", rancho_id: null, estado: "revocado", created_at: "2026-07-01T10:00:00+00:00" });
    expect(aceptaContacto([negocio, bajaVieja, plataformaSi], "p1", "correo", NEGOCIO)).toBe(true);
  });

  it("dos filas en el mismo instante: desempata el id mayor, como la base", () => {
    const mismoInstante = "2026-09-01T10:00:00.123456+00:00";
    const a = { ...fila({ estado: "aceptado", created_at: mismoInstante }), id: "00000000-0000-4000-8000-0000000000aa" };
    const r = { ...fila({ estado: "revocado", created_at: mismoInstante }), id: "00000000-0000-4000-8000-0000000000bb" };
    expect(aceptaContacto([a, r], "p1", "correo", NEGOCIO)).toBe(false);
    expect(aceptaContacto([r, a], "p1", "correo", NEGOCIO)).toBe(false);
    const rBaja = { ...r, id: "00000000-0000-4000-8000-000000000001" };
    expect(aceptaContacto([a, rBaja], "p1", "correo", NEGOCIO)).toBe(true);
  });

  it("los microsegundos de la base se comparan enteros", () => {
    const antes = fila({ estado: "revocado", created_at: "2026-09-01T10:00:00.000100+00:00" });
    const despues = fila({ estado: "aceptado", created_at: "2026-09-01T10:00:00.000200+00:00" });
    expect(aceptaContacto([antes, despues], "p1", "correo", NEGOCIO)).toBe(true);
  });

  it("la fila de la base: solo con la forma que esperamos", () => {
    expect(filaDeConsentimiento(null)).toBeNull();
    expect(filaDeConsentimiento({ id: "x" })).toBeNull();
    expect(
      filaDeConsentimiento({ id: "i", persona_id: "p", ambito: "negocio", canal: "correo", estado: "aceptado", created_at: "2026-09-01T10:00:00+00:00", rancho_id: RANCHO, cuenta_id: null }),
    ).toMatchObject({ id: "i", persona_id: "p", rancho_id: RANCHO, cuenta_id: null });
  });
});

describe("armarContacto: solo sale el dato del canal que aceptó", () => {
  const identidad = { nombre: "Ana María Solís", correo: "Ana.Solis@Gmail.com", telefono: "+506 8888-7777" };

  it("aceptó los dos canales: nombre, correo y teléfono completos", () => {
    expect(armarContacto("m1", identidad, { correo: true, whatsapp: true })).toEqual({
      miembro_id: "m1",
      nombre: "Ana María Solís",
      correo: "ana.solis@gmail.com",
      telefono: "50688887777",
      acepta: { correo: true, whatsapp: true },
    });
  });

  it("aceptó solo el correo: el teléfono no sale", () => {
    expect(armarContacto("m1", identidad, { correo: true, whatsapp: false })).toMatchObject({ nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: null });
  });

  it("aceptó solo el WhatsApp: el correo no sale", () => {
    expect(armarContacto("m1", identidad, { correo: false, whatsapp: true })).toMatchObject({ correo: null, telefono: "50688887777" });
  });

  it("no aceptó nada: ni nombre ni contacto, aunque los tengamos", () => {
    const c = armarContacto("m1", identidad, { correo: false, whatsapp: false });
    expect(c).toEqual({ miembro_id: "m1", nombre: null, correo: null, telefono: null, acepta: { correo: false, whatsapp: false } });
    expect(JSON.stringify(c)).not.toMatch(/ana|solis|8888/i);
  });

  it("aceptó pero no dejó el dato: acepta sí, dato null", () => {
    expect(armarContacto("m1", { nombre: "Beto", correo: null, telefono: null }, { correo: true, whatsapp: true })).toEqual({
      miembro_id: "m1",
      nombre: "Beto",
      correo: null,
      telefono: null,
      acepta: { correo: true, whatsapp: true },
    });
    expect(armarContacto("m1", undefined, { correo: true, whatsapp: true })).toMatchObject({ nombre: null, correo: null, telefono: null });
  });

  it("el nombre no es la puerta de un contacto: se sacan las palabras que parecen correo o teléfono", () => {
    expect(nombreCompleto("Ana beto@correo.cr")).toBe("Ana");
    expect(nombreCompleto("88887777")).toBeNull();
    expect(nombreCompleto("  María   José  ")).toBe("María José");
    expect(nombreCompleto(null)).toBeNull();
    expect(nombreCompleto("x".repeat(200))).toHaveLength(80);
  });

  it("el teléfono son solo dígitos y tiene que parecer uno; el correo, un correo", () => {
    expect(telefonoEnDigitos("8888-7777")).toBe("88887777");
    expect(telefonoEnDigitos("123")).toBeNull();
    expect(telefonoEnDigitos("1".repeat(16))).toBeNull();
    expect(telefonoEnDigitos(null)).toBeNull();
    expect(correoLimpio(" Beto@Correo.CR ")).toBe("beto@correo.cr");
    expect(correoLimpio("sin-arroba")).toBeNull();
    expect(correoLimpio("a b@c.cr")).toBeNull();
  });
});

describe("leerPedidoContacto: la forma del pedido", () => {
  const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };
  const A = "33333333-3333-4333-8333-333333333333";
  const B = "44444444-4444-4444-8444-444444444444";

  it("una lista de uuid, sin repetidos y en minúscula", () => {
    const r = leerPedidoContacto({ ...vinculo, miembro_ids: [A, B.toUpperCase(), A] });
    expect(r).toEqual({ ok: true, valor: { ranchoId: RANCHO, programaId: PROGRAMA, miembroIds: [A, B] } });
  });

  it("rechaza lo que no se entiende", () => {
    expect(leerPedidoContacto({ ...vinculo })).toMatchObject({ ok: false });
    expect(leerPedidoContacto({ ...vinculo, miembro_ids: [] })).toMatchObject({ ok: false });
    expect(leerPedidoContacto({ ...vinculo, miembro_ids: "x" })).toMatchObject({ ok: false });
    expect(leerPedidoContacto({ ...vinculo, miembro_ids: [A, "no-es-uuid"] })).toMatchObject({ ok: false });
    expect(leerPedidoContacto({ miembro_ids: [A] })).toMatchObject({ ok: false });
    const muchos = Array.from({ length: CONTACTOS_MAXIMO + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(leerPedidoContacto({ ...vinculo, miembro_ids: muchos })).toMatchObject({ ok: false });
    expect(leerPedidoContacto({ ...vinculo, miembro_ids: muchos.slice(0, CONTACTOS_MAXIMO) })).toMatchObject({ ok: true });
  });
});
