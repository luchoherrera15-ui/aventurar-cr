import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * FASE 2C, SECCIÓN 11 — LA TABLA DE SINCRONIZACIÓN, SIN WORKER TODAVÍA.
 *
 * El fan-out básico y la idempotencia por evento ya se probaron en
 * Fase 2B (`wallet-v2.test.ts`, describe "Migración D"). Este archivo
 * agrega lo que falta: estados independientes por plataforma, jobs
 * distintos por transacción distinta, comportamiento tras un éxito, y
 * el patrón de reclamo (`SELECT ... FOR UPDATE SKIP LOCKED`) que
 * cualquier worker futuro tendría que usar — probado como SQL directo
 * contra el Postgres local, NO como una función nueva del esquema: no
 * se implementa el worker en esta fase, solo se prueba que la TABLA lo
 * soporta.
 *
 * Corre con: npx supabase db reset && npm run test:wallet-v2-local
 */

const execFileAsync = promisify(execFile);

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

async function crearMiembroConDosPases(prefijoCrudo: string) {
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
  const { data: pases, error: errorPases } = await db
    .from("pases_wallet")
    .insert([
      { miembro_id: miembro!.id, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true },
      { miembro_id: miembro!.id, plataforma: "google", serial_number: randomUUID(), auth_token: randomUUID(), activo: true },
    ])
    .select("id, plataforma");
  if (errorPases) throw errorPases;

  return { ownerId, ranchoId, programaId: alta.programa_id as string, miembroId: miembro!.id as string, pases: pases! };
}

describe("Estados independientes por plataforma (fan-out parcial)", () => {
  it("Apple puede fallar mientras Google tiene éxito, y viceversa — sin efecto cruzado", async () => {
    const f = await crearMiembroConDosPases("fanoutParcial");
    const evento = randomUUID();
    const correlationId = randomUUID();
    const { data: encoladas } = await db.rpc("wallet_encolar_sincronizacion", {
      p_miembro_id: f.miembroId,
      p_operacion: "saldo",
      p_idempotency_key: evento,
      p_correlation_id: correlationId,
    });
    expect(encoladas).toBe(2);

    const paseApple = f.pases.find((p) => p.plataforma === "apple")!;
    const paseGoogle = f.pases.find((p) => p.plataforma === "google")!;

    await db
      .from("wallet_sincronizaciones")
      .update({ estado: "dead", fallido_permanente_en: new Date().toISOString(), error: "simulado: Apple rechazó el push" })
      .eq("pase_id", paseApple.id)
      .eq("correlation_id", correlationId);
    await db
      .from("wallet_sincronizaciones")
      .update({ estado: "succeeded", exitoso_en: new Date().toISOString() })
      .eq("pase_id", paseGoogle.id)
      .eq("correlation_id", correlationId);

    const { data: filas } = await db.from("wallet_sincronizaciones").select("plataforma, estado").eq("correlation_id", correlationId);
    const porPlataforma = Object.fromEntries(filas!.map((f2) => [f2.plataforma, f2.estado]));
    expect(porPlataforma.apple).toBe("dead");
    expect(porPlataforma.google).toBe("succeeded");
  });
});

describe("Un job por transacción real, no por miembro", () => {
  it("dos movimientos distintos del mismo miembro generan jobs con correlation_id distintos, ambos activos", async () => {
    const f = await crearMiembroConDosPases("dosTransacciones");
    const r1 = await db.rpc("wallet_encolar_sincronizacion", {
      p_miembro_id: f.miembroId,
      p_operacion: "saldo",
      p_idempotency_key: "tx:" + randomUUID(),
      p_correlation_id: randomUUID(),
    });
    const r2 = await db.rpc("wallet_encolar_sincronizacion", {
      p_miembro_id: f.miembroId,
      p_operacion: "saldo",
      p_idempotency_key: "tx:" + randomUUID(),
      p_correlation_id: randomUUID(),
    });
    expect(r1.data).toBe(2);
    expect(r2.data).toBe(2);

    const { count } = await db.from("wallet_sincronizaciones").select("id", { count: "exact", head: true }).eq("miembro_id", f.miembroId);
    expect(count).toBe(4);
  });

  it("reintento con la MISMA idempotency_key mientras el job sigue activo: no duplica (reconfirmación de Fase 2B)", async () => {
    const f = await crearMiembroConDosPases("mismaKeyActiva");
    const key = "tx:" + randomUUID();
    const r1 = await db.rpc("wallet_encolar_sincronizacion", { p_miembro_id: f.miembroId, p_operacion: "saldo", p_idempotency_key: key, p_correlation_id: randomUUID() });
    const r2 = await db.rpc("wallet_encolar_sincronizacion", { p_miembro_id: f.miembroId, p_operacion: "saldo", p_idempotency_key: key, p_correlation_id: randomUUID() });
    expect(r1.data).toBe(2);
    expect(r2.data).toBe(0);
  });

  it("HALLAZGO / nota de diseño: reencolar la MISMA idempotency_key DESPUÉS de 'succeeded' sí crea una fila nueva", async () => {
    // El índice único parcial solo cubre estado IN
    // ('pending','processing','retryable') — una vez 'succeeded', la
    // fila deja de contar para la deduplicación. Esto es una decisión
    // de diseño razonable para un futuro flujo de "reforzar sync"
    // (volver a empujar aunque ya haya funcionado), pero no está
    // documentado como intencional en ningún lado — se deja registrado
    // acá para que Fase 3 (cuando se construya el worker real) lo
    // decida con el dato en la mano, no lo descubra por accidente.
    const f = await crearMiembroConDosPases("reencolarDespuesDeExito");
    const key = "tx:" + randomUUID();
    await db.rpc("wallet_encolar_sincronizacion", { p_miembro_id: f.miembroId, p_operacion: "saldo", p_idempotency_key: key, p_correlation_id: randomUUID() });
    await db.from("wallet_sincronizaciones").update({ estado: "succeeded", exitoso_en: new Date().toISOString() }).eq("miembro_id", f.miembroId);

    const r2 = await db.rpc("wallet_encolar_sincronizacion", { p_miembro_id: f.miembroId, p_operacion: "saldo", p_idempotency_key: key, p_correlation_id: randomUUID() });
    expect(r2.data).toBe(2); // documentando el comportamiento real, no el ideal

    const { count } = await db.from("wallet_sincronizaciones").select("id", { count: "exact", head: true }).eq("miembro_id", f.miembroId);
    expect(count).toBe(4);
  });
});

// SQL crudo contra el Postgres LOCAL — nunca remoto (ver encabezado).
// Simula el patrón de reclamo que un worker futuro tendría que usar;
// no crea ninguna función nueva en el esquema.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Devuelve el UUID reclamado, o "" si no reclamó ninguna fila. psql
 * imprime el resultado de RETURNING y, en una línea aparte, un tag de
 * comando ("UPDATE 1"/"UPDATE 0") — se extrae solo el UUID, si hay
 * alguno, para no depender del formato exacto de esa segunda línea. */
// Filtrado por miembro_id: no por realismo del worker (uno real
// reclamaría de TODA la tabla) sino para que cada prueba de este
// archivo sea independiente de lo que hayan dejado las anteriores en
// la misma corrida — la tabla no se limpia entre `it()`, a propósito
// (mismo criterio que el resto de esta suite).
async function reclamarUnaFila(worker: string, miembroId: string): Promise<string> {
  const { stdout } = await execFileAsync("docker", [
    "exec",
    "-i",
    "supabase_db_aventurar-cr",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-t",
    "-A",
    "-c",
    RECLAMAR_UNA_FILA(worker, miembroId),
  ]);
  return stdout.match(UUID_RE)?.[0] ?? "";
}

const RECLAMAR_UNA_FILA = (worker: string, miembroId: string) => `
  UPDATE wallet_sincronizaciones
  SET estado = 'processing', bloqueado_en = now(), bloqueado_por = '${worker}'
  WHERE id = (
    SELECT id FROM wallet_sincronizaciones
    WHERE estado IN ('pending', 'retryable') AND proximo_intento_en <= now() AND bloqueado_en IS NULL
      AND miembro_id = '${miembroId}'
    ORDER BY proximo_intento_en
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING id;
`;

describe("Patrón de reclamo (SKIP LOCKED) — la tabla lo soporta, sin implementar el worker", () => {
  it("Worker A y Worker B reclamando EN PARALELO nunca procesan la misma fila", async () => {
    const f = await crearMiembroConDosPases("reclamoConcurrente");
    await db.rpc("wallet_encolar_sincronizacion", { p_miembro_id: f.miembroId, p_operacion: "saldo", p_idempotency_key: "tx:" + randomUUID(), p_correlation_id: randomUUID() });
    // Exactamente 2 filas reclamables (Apple + Google) — 2 workers, 1 cada uno.
    const [idA, idB] = await Promise.all([reclamarUnaFila("worker-a", f.miembroId), reclamarUnaFila("worker-b", f.miembroId)]);
    expect(idA).not.toBe("");
    expect(idB).not.toBe("");
    expect(idA).not.toBe(idB);

    const { data: filas } = await db.from("wallet_sincronizaciones").select("id, bloqueado_por, estado").eq("miembro_id", f.miembroId);
    expect(filas).toHaveLength(2);
    for (const fila of filas!) {
      expect(fila.estado).toBe("processing");
      expect(["worker-a", "worker-b"]).toContain(fila.bloqueado_por);
    }
  }, 20_000);

  it("una tercera reclamación cuando ya no quedan filas libres no reclama nada", async () => {
    const f = await crearMiembroConDosPases("sinFilasLibres");
    await db.rpc("wallet_encolar_sincronizacion", { p_miembro_id: f.miembroId, p_operacion: "saldo", p_idempotency_key: "tx:" + randomUUID(), p_correlation_id: randomUUID() });
    await reclamarUnaFila("worker-1", f.miembroId);
    await reclamarUnaFila("worker-2", f.miembroId);
    const tercero = await reclamarUnaFila("worker-3", f.miembroId);
    expect(tercero).toBe("");
  }, 20_000);
});

describe("HALLAZGO / gap real: todavía no existe recuperación de lease expirado", () => {
  it("una fila 'processing' con bloqueado_en viejo (worker caído) NO es reclamable por el patrón actual", async () => {
    // No es un bug de esta fase — es, a propósito, lo que falta
    // construir cuando exista el worker real (Fase 3/4). Se deja
    // probado y documentado para que no se asuma que ya funciona.
    const f = await crearMiembroConDosPases("leaseExpirado");
    await db.rpc("wallet_encolar_sincronizacion", { p_miembro_id: f.miembroId, p_operacion: "saldo", p_idempotency_key: "tx:" + randomUUID(), p_correlation_id: randomUUID() });

    // Este fixture trae 2 filas (Apple + Google) — se reclaman las DOS
    // primero, para que no quede ninguna genuinamente libre por otro
    // motivo que no sea el que se está probando acá.
    await reclamarUnaFila("worker-que-se-cayo", f.miembroId);
    await reclamarUnaFila("worker-ok", f.miembroId);

    // El primer worker "se cae" sin terminar — su fila queda en
    // 'processing', con bloqueado_en de hace 2 horas.
    await db
      .from("wallet_sincronizaciones")
      .update({ bloqueado_en: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() })
      .eq("miembro_id", f.miembroId)
      .eq("bloqueado_por", "worker-que-se-cayo");

    // El patrón de reclamo de HOY (pending/retryable, bloqueado_en IS
    // NULL) no la ve — sigue "tomada" para siempre hasta que algo la
    // reponga a mano. Ese "algo" (un sweep por antigüedad de
    // bloqueado_en) todavía no existe en ningún lado del esquema.
    const nadaReclamable = await reclamarUnaFila("worker-nuevo", f.miembroId);
    expect(nadaReclamable).toBe("");

    const { data: fila } = await db
      .from("wallet_sincronizaciones")
      .select("estado, bloqueado_por")
      .eq("miembro_id", f.miembroId)
      .eq("bloqueado_por", "worker-que-se-cayo")
      .single();
    expect(fila!.estado).toBe("processing");
  }, 20_000);
});
