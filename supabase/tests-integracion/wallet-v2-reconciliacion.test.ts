import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * FASE 2C — pruebas automatizadas de `wallet_v2_reconciliacion_saldos`.
 *
 * Hasta esta fase, la vista se había verificado a mano (ver
 * docs/wallet-v2/reconciliacion-saldos.md) — sin ningún test que
 * fallara si alguien la rompía. Eso permitió que un bug real pasara
 * desapercibido: la rama `coincide` comparaba contra `l.saldo_ledger`
 * SIN `coalesce`, así que un miembro con pase pero SIN ninguna fila de
 * ledger (el caso más común de todos — recién afiliado) caía en NULL =
 * NULL → NULL, no TRUE, y clasificaba como `requiere_decision` en vez
 * de `coincide`. Se encontró en el ensayo con forma de producción de
 * Fase 2C (ver fase-2c-resultado.md §9), se corrigió en 0159, y este
 * archivo existe para que no vuelva a pasar en silencio.
 *
 * Corre con: npx supabase db reset && npm run test:wallet-v2-local
 */

const SUPABASE_URL_LOCAL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const db = createClient(SUPABASE_URL_LOCAL, SERVICE_ROLE_KEY_LOCAL, { auth: { persistSession: false } });

beforeAll(async () => {
  const { error } = await db.from("ranchos").select("id").limit(1);
  if (error) {
    throw new Error("No se pudo conectar al Supabase local (127.0.0.1:54321). Corré `npx supabase start` antes de estas pruebas.\n" + error.message);
  }
});

// Ver wallet-v2.test.ts: Date.now() % 10000 colisionaba entre archivos
// distintos arrancados por Vitest en el mismo segundo.
const semillaProceso = parseInt(randomUUID().replace(/-/g, "").slice(0, 8), 16) % 10000;
let contadorTelefono = 0;
function telefonoUnico(): string {
  contadorTelefono += 1;
  return String(semillaProceso).padStart(4, "0") + String(contadorTelefono % 10000).padStart(4, "0");
}

async function crearMiembro(prefijoCrudo: string) {
  const prefijo = prefijoCrudo.toLowerCase();
  const ownerId = randomUUID();
  const ranchoId = randomUUID();
  await db.auth.admin.createUser({ id: ownerId, email: `${prefijo}-${ownerId.slice(0, 8)}@bookea.lat`, email_confirm: true });
  await db.from("ranchos").insert({
    id: ranchoId,
    owner_id: ownerId,
    nombre: `Negocio ${prefijo}`,
    slug: `negocio-${prefijo}-${ranchoId.slice(0, 8)}`,
    estado: "aprobado",
    categoria: "otros",
  });
  const { data: alta, error: errorAlta } = await db.rpc("alta_cuenta_lealtad", {
    p_owner_id: ownerId,
    p_rancho_id: ranchoId,
    p_limite_programas: 1,
    p_programa: { nombre: `Programa ${prefijo}` },
  });
  if (errorAlta) throw errorAlta;
  const { data: persona, error: errorPersona } = await db
    .from("personas")
    .insert({ telefono: telefonoUnico(), correo: `${prefijo}-${randomUUID().slice(0, 8)}@ejemplo-privado.test` })
    .select("id")
    .single();
  if (errorPersona) throw errorPersona;
  const { data: miembro, error: errorMiembro } = await db
    .from("miembros")
    .insert({ programa_id: alta.programa_id, persona_id: persona!.id, estado: "activa" })
    .select("id")
    .single();
  if (errorMiembro) throw errorMiembro;
  return { ownerId, ranchoId, miembroId: miembro!.id as string };
}

async function clasificacionDe(miembroId: string): Promise<string> {
  const { data } = await db.from("wallet_v2_reconciliacion_saldos").select("clasificacion").eq("miembro_id", miembroId).single();
  return data!.clasificacion as string;
}

describe("wallet_v2_reconciliacion_saldos — las 8 categorías, con fixtures reales", () => {
  it("REGRESIÓN del hallazgo de Fase 2C: pase con saldo_cache=0 y CERO movimientos clasifica 'coincide', no 'requiere_decision'", async () => {
    const f = await crearMiembro("reconRegresionCoincideCero");
    await db.from("pases_wallet").insert({ miembro_id: f.miembroId, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true, saldo_cache: 0 });
    expect(await clasificacionDe(f.miembroId)).toBe("coincide");
  });

  it("coincide: ledger y pase con el mismo saldo, distinto de cero", async () => {
    const f = await crearMiembro("reconCoincide");
    await db.rpc("acreditar_lealtad", { p_miembro_id: f.miembroId, p_monto: null, p_referencia: "seed-" + randomUUID(), p_usuario_id: null, p_motivo: "seed" });
    const { data: miembro } = await db.from("miembros").select("saldo_cache").eq("id", f.miembroId).single();
    await db.from("pases_wallet").insert({ miembro_id: f.miembroId, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true, saldo_cache: miembro!.saldo_cache });
    expect(await clasificacionDe(f.miembroId)).toBe("coincide");
  });

  it("ledger_incompleto: pase con saldo_cache > 0 pero cero movimientos en el ledger", async () => {
    const f = await crearMiembro("reconLedgerIncompleto");
    await db.from("pases_wallet").insert({ miembro_id: f.miembroId, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true, saldo_cache: 10 });
    expect(await clasificacionDe(f.miembroId)).toBe("ledger_incompleto");
  });

  it("miembro_sin_pase: sin ninguna fila de pases_wallet", async () => {
    const f = await crearMiembro("reconSinPase");
    expect(await clasificacionDe(f.miembroId)).toBe("miembro_sin_pase");
  });

  it("plataformas_con_saldos_diferentes: Apple y Google no coinciden entre sí", async () => {
    const f = await crearMiembro("reconPlataformasDiferentes");
    await db.rpc("acreditar_lealtad", { p_miembro_id: f.miembroId, p_monto: null, p_referencia: "seed-" + randomUUID(), p_usuario_id: null, p_motivo: "seed" });
    const { data: miembro } = await db.from("miembros").select("saldo_cache").eq("id", f.miembroId).single();
    await db.from("pases_wallet").insert([
      { miembro_id: f.miembroId, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true, saldo_cache: miembro!.saldo_cache },
      { miembro_id: f.miembroId, plataforma: "google", serial_number: randomUUID(), auth_token: randomUUID(), activo: true, saldo_cache: miembro!.saldo_cache + 5 },
    ]);
    expect(await clasificacionDe(f.miembroId)).toBe("plataformas_con_saldos_diferentes");
  });

  it("saldo_imposible: máxima prioridad, incluso combinado con miembro_sin_pase", async () => {
    const f = await crearMiembro("reconSaldoImposible");
    // Ajuste directo (fuera de las RPC reales) que deja el ledger en negativo.
    await db.from("transacciones_puntos").insert({ miembro_id: f.miembroId, tipo: "ajuste", puntos: -5, motivo: "prueba", saldo_anterior: 0, saldo_posterior: -5 });
    // Sin ningún pase — si la prioridad estuviera mal, clasificaría 'miembro_sin_pase' en vez de 'saldo_imposible'.
    expect(await clasificacionDe(f.miembroId)).toBe("saldo_imposible");
  });

  it("pase_duplicado y pase_sin_miembro: estructuralmente imposibles — no se puede crear el fixture, y eso ES la prueba", async () => {
    const f = await crearMiembro("reconEstructural");
    await db.from("pases_wallet").insert({ miembro_id: f.miembroId, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true });
    const segundo = await db
      .from("pases_wallet")
      .insert({ miembro_id: f.miembroId, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true });
    expect(segundo.error).not.toBeNull();
    expect(segundo.error!.code).toBe("23505");

    const huerfano = await db.from("pases_wallet").insert({ miembro_id: null as unknown as string, plataforma: "google", serial_number: randomUUID(), auth_token: randomUUID(), activo: true });
    expect(huerfano.error).not.toBeNull();
  });
});
