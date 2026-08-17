import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * FASE 3/4 — EL NÚCLEO DEL WORKER (`src/lib/wallet/sync/worker.ts`),
 * CONTRA EL POSTGRES LOCAL REAL.
 *
 * `wallet-v2-cola-sincronizacion.test.ts` (Fase 2C) probó el patrón
 * `FOR UPDATE SKIP LOCKED` con SQL crudo vía `docker exec ... psql` —
 * un atajo que demuestra que la TABLA lo soporta, sin implementar
 * ningún worker. Este archivo prueba el WORKER de verdad: las mismas
 * funciones que corren en producción (`reclamarLote`,
 * `barrerLeaseExpirada`, `marcarResultado`, `calcularBackoffSeg`,
 * `ejecutarCicloDeSincronizacion`), importadas de `src/lib/wallet/sync/
 * worker.ts` — nada reimplementado acá.
 *
 * NUNCA toca Apple ni Google: los adaptadores reales
 * (`sincronizarPaseApple`/`sincronizarPaseGoogle`) jamás se importan en
 * este archivo. Donde el worker necesita despachar a un adaptador
 * (`ejecutarCicloDeSincronizacion`), se le inyecta un adaptador de
 * prueba puro por `opts.adaptadores` — la superficie que `worker.ts`
 * expone exactamente para esto.
 *
 * `createAdminClient()` (que todas las funciones del worker llaman
 * internamente, igual que los dos adaptadores) lee
 * `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` de
 * `process.env` en cada invocación — no al importar el módulo — así
 * que alcanza con pisar esas dos variables una vez, en `beforeAll`,
 * apuntándolas al Supabase local, para que el worker completo hable
 * con la misma base que este archivo usa para armar los fixtures y
 * verificar el resultado.
 *
 * Corre con: npx supabase start && npm run test:wallet-v2-local
 * (o, para correr SOLO este archivo:
 * npx vitest run --config vitest.integration.config.ts
 * supabase/tests-integracion/wallet-v2-worker-sincronizacion.test.ts)
 */

const SUPABASE_URL_LOCAL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL_LOCAL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY_LOCAL;

// Import DESPUÉS de fijar las variables de entorno de arriba: los
// imports de ESM se resuelven antes de que corra el resto del archivo,
// pero `createAdminClient()` recién lee `process.env` cuando el worker
// la LLAMA (dentro de cada `it`), no cuando este módulo se importa —
// así que el orden entre el import y las dos líneas de arriba no
// importa en la práctica. Se escriben en este orden de todos modos
// porque es el que se lee más claro.
import {
  barrerLeaseExpirada,
  calcularBackoffSeg,
  ejecutarCicloDeSincronizacion,
  LEASE_MINUTOS,
  LOTE_MAXIMO,
  marcarResultado,
  reclamarLote,
} from "@/lib/wallet/sync/worker";
import type { ResultadoSync, TrabajoSync } from "@/lib/wallet/sync/tipos";

const db = createClient(SUPABASE_URL_LOCAL, SERVICE_ROLE_KEY_LOCAL, { auth: { persistSession: false } });

beforeAll(async () => {
  const { error } = await db.from("ranchos").select("id").limit(1);
  if (error) {
    throw new Error(
      "No se pudo conectar al Supabase local (127.0.0.1:54321). Corré `npx supabase start` antes de estas pruebas.\n" +
        error.message,
    );
  }
});

// ── Fixtures — mismo patrón que wallet-v2-cola-sincronizacion.test.ts ──

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

/** Encola un trabajo por cada pase activo del miembro (fan-out real de wallet_encolar_sincronizacion). */
async function encolar(miembroId: string): Promise<number> {
  const { data, error } = await db.rpc("wallet_encolar_sincronizacion", {
    p_miembro_id: miembroId,
    p_operacion: "saldo",
    p_idempotency_key: `tx:${randomUUID()}`,
    p_correlation_id: randomUUID(),
  });
  if (error) throw error;
  return data as number;
}

/**
 * Deja la cola sin nada `pending`/`retryable` ANTES de cada prueba.
 *
 * A diferencia del helper crudo de `wallet-v2-cola-sincronizacion.test.ts`
 * (que filtra por `miembro_id` en el propio SQL), `reclamarLote` —tal
 * como corre en producción— NO filtra por miembro: reclama de TODA la
 * tabla, porque un worker real tiene que barrer los trabajos de
 * cualquier negocio. Eso significa que cualquier fila `pending`/
 * `retryable` que haya quedado de otra corrida (este archivo no limpia
 * entre pruebas, y la base local puede traer datos de sesiones
 * anteriores) es una candidata real para el `reclamarLote` de la
 * PRÓXIMA prueba y rompería un conteo exacto. Se drena reclamando todo
 * lo que haya y marcándolo `cancelled` (estado terminal, fuera del
 * `WHERE` de reclamo) — así cada prueba arranca de una cola realmente
 * vacía sin necesitar un `supabase db reset` entre cada una.
 */
async function drenarCola(): Promise<void> {
  // También hay que reponer `processing` con lease VIEJO (de sesiones
  // anteriores en esta misma base local) — si no, sobreviviría al
  // drenaje y, más tarde, un `barrerLeaseExpirada()` DENTRO de una
  // prueba lo repondría a mitad de camino, compitiendo por
  // `ORDER BY proximo_intento_en` con las filas que esa prueba sí
  // controla.
  await barrerLeaseExpirada();
  for (;;) {
    const lote = await reclamarLote(LOTE_MAXIMO, "drenaje-de-prueba");
    if (lote.length === 0) break;
    const { error } = await db
      .from("wallet_sincronizaciones")
      .update({ estado: "cancelled", bloqueado_en: null, bloqueado_por: null })
      .in(
        "id",
        lote.map((t) => t.id),
      );
    if (error) throw error;
  }
}

beforeEach(async () => {
  await drenarCola();
});

// ── Adaptadores de prueba: NUNCA tocan red real ─────────────────────

function adaptadorFijo(resultado: ResultadoSync) {
  return async (_job: TrabajoSync): Promise<ResultadoSync> => resultado;
}

describe("reclamarLote()", () => {
  it("reclama exactamente la cantidad pedida, ni más ni menos", async () => {
    const f = await crearMiembroConDosPases("reclamaExacto");
    // 3 encolados × 2 pases (apple + google) = 6 filas pending.
    for (let i = 0; i < 3; i++) await encolar(f.miembroId);

    const workerId = `test-worker-${randomUUID()}`;
    const primerLote = await reclamarLote(4, workerId);
    expect(primerLote).toHaveLength(4);
    expect(new Set(primerLote.map((t) => t.id)).size).toBe(4); // sin repetidos

    const segundoLote = await reclamarLote(10, `${workerId}-2`);
    expect(segundoLote).toHaveLength(2); // solo quedaban 2 de las 6

    const tercerLote = await reclamarLote(5, `${workerId}-3`);
    expect(tercerLote).toHaveLength(0); // no queda nada pending/retryable
  });

  it("clampa a LOTE_MAXIMO aunque se pida más", async () => {
    const f = await crearMiembroConDosPases("clampLoteMaximo");
    // LOTE_MAXIMO (20) + 2 filas de sobra: 11 encolados × 2 pases = 22.
    for (let i = 0; i < 11; i++) await encolar(f.miembroId);

    const lote = await reclamarLote(LOTE_MAXIMO + 50, `test-worker-${randomUUID()}`);
    expect(lote).toHaveLength(LOTE_MAXIMO);
  });

  it("no double-claim: dos reclamos en paralelo nunca devuelven la misma fila", async () => {
    const f = await crearMiembroConDosPases("noDoubleClaim");
    await encolar(f.miembroId); // 2 filas: apple + google

    const [a, b] = await Promise.all([
      reclamarLote(1, "worker-a"),
      reclamarLote(1, "worker-b"),
    ]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].id).not.toBe(b[0].id);

    const { data: filas } = await db
      .from("wallet_sincronizaciones")
      .select("id, estado, bloqueado_por")
      .eq("miembro_id", f.miembroId);
    expect(filas).toHaveLength(2);
    for (const fila of filas!) {
      expect(fila.estado).toBe("processing");
      expect(["worker-a", "worker-b"]).toContain(fila.bloqueado_por);
    }
  }, 20_000);

  it("una fila succeeded no se vuelve a reclamar (idempotencia estructural)", async () => {
    const f = await crearMiembroConDosPases("succeededNoSeReclama");
    await encolar(f.miembroId); // 2 filas
    const workerId = `test-worker-${randomUUID()}`;
    const lote = await reclamarLote(2, workerId);
    expect(lote).toHaveLength(2);

    for (const job of lote) await marcarResultado(job, { ok: true });

    // Invocar el ciclo de nuevo sobre el mismo trabajo no lo reprocesa:
    // ya no está en pending/retryable.
    const segundoIntento = await reclamarLote(10, `${workerId}-2`);
    expect(segundoIntento.map((t) => t.id)).not.toEqual(expect.arrayContaining(lote.map((t) => t.id)));

    const { data: filas } = await db
      .from("wallet_sincronizaciones")
      .select("estado")
      .eq("miembro_id", f.miembroId);
    for (const fila of filas!) expect(fila.estado).toBe("succeeded");
  });
});

describe("barrerLeaseExpirada()", () => {
  it("recupera una fila 'processing' con lease vencido y la deja retryable, reclamable de nuevo", async () => {
    const f = await crearMiembroConDosPases("leaseExpirado");
    await encolar(f.miembroId); // 2 filas
    const lote = await reclamarLote(2, "worker-que-se-cae");
    expect(lote).toHaveLength(2);

    // Simula que el worker se cayó hace más tiempo que LEASE_MINUTOS.
    const bloqueadoHaceRato = new Date(Date.now() - (LEASE_MINUTOS + 5) * 60 * 1000).toISOString();
    await db
      .from("wallet_sincronizaciones")
      .update({ bloqueado_en: bloqueadoHaceRato })
      .in(
        "id",
        lote.map((t) => t.id),
      );

    const repuestas = await barrerLeaseExpirada();
    expect(repuestas).toBeGreaterThanOrEqual(2);

    const { data: filas } = await db
      .from("wallet_sincronizaciones")
      .select("id, estado, bloqueado_en, bloqueado_por")
      .in(
        "id",
        lote.map((t) => t.id),
      );
    for (const fila of filas!) {
      expect(fila.estado).toBe("retryable");
      expect(fila.bloqueado_en).toBeNull();
      expect(fila.bloqueado_por).toBeNull();
    }

    // Y ahora sí es reclamable de nuevo.
    const reclamoDeNuevo = await reclamarLote(2, "worker-nuevo");
    expect(reclamoDeNuevo.map((t) => t.id).sort()).toEqual(lote.map((t) => t.id).sort());
  });

  it("una fila 'processing' con lease TODAVÍA vigente no se toca", async () => {
    const f = await crearMiembroConDosPases("leaseVigente");
    await encolar(f.miembroId);
    const lote = await reclamarLote(2, "worker-activo");
    expect(lote).toHaveLength(2);

    await barrerLeaseExpirada(); // no debería tocar nada de acá: bloqueado_en es "ahora"

    const { data: filas } = await db
      .from("wallet_sincronizaciones")
      .select("estado, bloqueado_por")
      .in(
        "id",
        lote.map((t) => t.id),
      );
    for (const fila of filas!) {
      expect(fila.estado).toBe("processing");
      expect(fila.bloqueado_por).toBe("worker-activo");
    }
  });
});

describe("marcarResultado() — succeeded / retryable / dead", () => {
  it("ok:true → succeeded, con exitoso_en y sin lease", async () => {
    const f = await crearMiembroConDosPases("marcarSucceeded");
    await encolar(f.miembroId);
    const [job] = await reclamarLote(1, "worker-1");

    await marcarResultado(job, { ok: true, respuestaRemota: { nota: "ok" } });

    const { data: fila } = await db.from("wallet_sincronizaciones").select("*").eq("id", job.id).single();
    expect(fila!.estado).toBe("succeeded");
    expect(fila!.exitoso_en).not.toBeNull();
    expect(fila!.bloqueado_en).toBeNull();
    expect(fila!.bloqueado_por).toBeNull();
    expect(fila!.respuesta_remota).toEqual({ nota: "ok" });
  });

  it("falla reintentable con intentos disponibles → retryable, con backoff y error", async () => {
    const f = await crearMiembroConDosPases("marcarRetryable");
    await encolar(f.miembroId);
    const [job] = await reclamarLote(1, "worker-1");
    expect(job.intentos).toBe(0);

    const antes = Date.now();
    await marcarResultado(job, { ok: false, reintentable: true, motivo: "simulado: red caída" });

    const { data: fila } = await db.from("wallet_sincronizaciones").select("*").eq("id", job.id).single();
    expect(fila!.estado).toBe("retryable");
    expect(fila!.intentos).toBe(1);
    expect(fila!.error).toBe("simulado: red caída");
    expect(fila!.bloqueado_en).toBeNull();
    expect(new Date(fila!.proximo_intento_en).getTime()).toBeGreaterThan(antes);
  });

  it("agota max_intentos → dead, aunque el motivo sea reintentable", async () => {
    const f = await crearMiembroConDosPases("marcarDeadPorAgotamiento");
    await encolar(f.miembroId);
    const [job] = await reclamarLote(1, "worker-1");

    // Fuerza max_intentos = 1: el próximo fallo YA agota el presupuesto.
    await db.from("wallet_sincronizaciones").update({ max_intentos: 1 }).eq("id", job.id);
    const jobConTope: TrabajoSync = { ...job, maxIntentos: 1 };

    await marcarResultado(jobConTope, { ok: false, reintentable: true, motivo: "simulado: sigue fallando" });

    const { data: fila } = await db.from("wallet_sincronizaciones").select("*").eq("id", job.id).single();
    expect(fila!.estado).toBe("dead");
    expect(fila!.intentos).toBe(1);
    expect(fila!.fallido_permanente_en).not.toBeNull();
    expect(fila!.error).toBe("simulado: sigue fallando");
  });

  it("falla no-reintentable → dead de inmediato, sin importar cuántos intentos queden", async () => {
    const f = await crearMiembroConDosPases("marcarDeadPermanente");
    await encolar(f.miembroId);
    const [job] = await reclamarLote(1, "worker-1");
    expect(job.maxIntentos).toBeGreaterThan(1); // default de la tabla: 8

    await marcarResultado(job, { ok: false, reintentable: false, motivo: "simulado: credenciales ausentes" });

    const { data: fila } = await db.from("wallet_sincronizaciones").select("*").eq("id", job.id).single();
    expect(fila!.estado).toBe("dead");
    expect(fila!.fallido_permanente_en).not.toBeNull();
  });

  it("es idempotente: marcar el mismo resultado dos veces no rompe ni acumula", async () => {
    const f = await crearMiembroConDosPases("marcarIdempotente");
    await encolar(f.miembroId);
    const [job] = await reclamarLote(1, "worker-1");

    await marcarResultado(job, { ok: true });
    await marcarResultado(job, { ok: true }); // segunda vez, mismo job "viejo"

    const { data: fila } = await db.from("wallet_sincronizaciones").select("estado").eq("id", job.id).single();
    expect(fila!.estado).toBe("succeeded");
  });
});

describe("calcularBackoffSeg() — exponencial con equal jitter, backoff crece entre reintentos", () => {
  it("intentos=1 cae en [base/2, base]", () => {
    for (let i = 0; i < 20; i++) {
      const v = calcularBackoffSeg(1);
      expect(v).toBeGreaterThanOrEqual(15);
      expect(v).toBeLessThanOrEqual(30);
    }
  });

  it("crece con cada intento: el PISO de intentos=3 ya supera el TECHO de intentos=1", () => {
    // Rangos: intentos=1 → [15,30], intentos=2 → [30,60], intentos=3 →
    // [60,120]. No solo son no decrecientes: dos intentos de distancia
    // ya no se solapan, así que la comparación es determinística, sin
    // depender de qué haya salido el jitter esa vez.
    for (let i = 0; i < 20; i++) {
      expect(calcularBackoffSeg(3)).toBeGreaterThan(calcularBackoffSeg(1));
    }
  });

  it("nunca pasa el techo (BACKOFF_TOPE_SEG) aunque intentos sea grande", () => {
    for (let i = 0; i < 10; i++) {
      expect(calcularBackoffSeg(20)).toBeLessThanOrEqual(3600);
    }
  });
});

describe("ejecutarCicloDeSincronizacion() — el ciclo completo, con adaptadores inyectados", () => {
  it("barre, reclama, despacha por plataforma y marca el resultado — nunca llama a un adaptador real", async () => {
    const f = await crearMiembroConDosPases("cicloCompleto");
    await encolar(f.miembroId); // 2 filas: 1 apple, 1 google

    let llamadasApple = 0;
    let llamadasGoogle = 0;
    const resumen = await ejecutarCicloDeSincronizacion({
      loteMax: 10,
      workerId: `ciclo-test-${randomUUID()}`,
      adaptadores: {
        apple: async (job) => {
          llamadasApple += 1;
          expect(job.plataforma).toBe("apple");
          return { ok: true };
        },
        google: async (job) => {
          llamadasGoogle += 1;
          expect(job.plataforma).toBe("google");
          return { ok: false, reintentable: true, motivo: "simulado: 5xx de Google" };
        },
      },
    });

    expect(llamadasApple).toBe(1);
    expect(llamadasGoogle).toBe(1);
    expect(resumen.reclamados).toBe(2);
    expect(resumen.exitosos).toBe(1);
    expect(resumen.reintentados).toBe(1);
    expect(resumen.muertos).toBe(0);

    const { data: filas } = await db
      .from("wallet_sincronizaciones")
      .select("plataforma, estado")
      .eq("miembro_id", f.miembroId);
    const porPlataforma = Object.fromEntries(filas!.map((r) => [r.plataforma, r.estado]));
    expect(porPlataforma.apple).toBe("succeeded");
    expect(porPlataforma.google).toBe("retryable");
  });

  it("una excepción sin atrapar del adaptador no tumba el ciclo: el trabajo queda retryable", async () => {
    const f = await crearMiembroConDosPases("cicloExcepcionAdaptador");
    await encolar(f.miembroId);

    const resumen = await ejecutarCicloDeSincronizacion({
      loteMax: 10,
      adaptadores: {
        apple: adaptadorFijo({ ok: true }),
        google: async () => {
          throw new Error("boom: el adaptador de Google reventó sin atrapar nada");
        },
      },
    });

    expect(resumen.reclamados).toBe(2);
    expect(resumen.exitosos).toBe(1); // apple
    expect(resumen.reintentados).toBe(1); // google, convertido a retryable por el ciclo

    const { data: filaGoogle } = await db
      .from("wallet_sincronizaciones")
      .select("estado, error")
      .eq("miembro_id", f.miembroId)
      .eq("plataforma", "google")
      .single();
    expect(filaGoogle!.estado).toBe("retryable");
    expect(filaGoogle!.error).toContain("boom");
  });

  it("invocar el ciclo dos veces seguidas sobre la misma cola no reprocesa lo ya succeeded", async () => {
    const f = await crearMiembroConDosPases("cicloDosVeces");
    await encolar(f.miembroId);

    const primero = await ejecutarCicloDeSincronizacion({
      loteMax: 10,
      adaptadores: { apple: adaptadorFijo({ ok: true }), google: adaptadorFijo({ ok: true }) },
    });
    expect(primero.reclamados).toBe(2);
    expect(primero.exitosos).toBe(2);

    let segundasLlamadas = 0;
    const segundo = await ejecutarCicloDeSincronizacion({
      loteMax: 10,
      adaptadores: {
        apple: async (_job) => {
          segundasLlamadas += 1;
          return { ok: true };
        },
        google: async (_job) => {
          segundasLlamadas += 1;
          return { ok: true };
        },
      },
    });
    expect(segundo.reclamados).toBe(0);
    expect(segundasLlamadas).toBe(0);
  });
});
