import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * PRUEBAS DE INTEGRACIÓN DE WALLET V2 — CONTRA POSTGRES LOCAL REAL.
 *
 * No corren con `npm test` (que no depende de ningún servicio
 * externo, a propósito). Corren con:
 *
 *   npx supabase start   (una vez, deja un Postgres local en :54322)
 *   npm run test:wallet-v2-local
 *
 * Las credenciales de acá son las demo públicas y fijas que el CLI de
 * Supabase genera para CUALQUIER proyecto local sin personalizar
 * (issuer "supabase-demo") — no son secretas, no sirven para nada
 * fuera de `127.0.0.1:54321`, y son las mismas que imprime
 * `npx supabase status` en cualquier máquina.
 *
 * Estas pruebas EXISTEN porque el enunciado de la Fase 2B pide
 * concurrencia real (dos/diez solicitudes simultáneas, locks
 * `pg_advisory_xact_lock`, constraints únicos) — eso no se puede
 * mockear: hay que golpear un Postgres de verdad.
 */

const SUPABASE_URL_LOCAL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const db = createClient(SUPABASE_URL_LOCAL, SERVICE_ROLE_KEY_LOCAL, { auth: { persistSession: false } });

/**
 * Confirma que el Postgres local está arriba antes de correr nada —
 * si no, un mensaje claro en vez de 50 timeouts.
 *
 * NO intenta barrer datos de corridas anteriores. Se probó, y no se
 * puede: en cuanto un miembro de prueba tiene una fila en el ledger
 * (`transacciones_puntos`), el trigger de inmutabilidad (Migración C)
 * bloquea el DELETE en cascada que intentaría borrarla — el MISMO
 * trigger que estas pruebas verifican que funcione. Es la prueba más
 * convincente de que el trigger es real: ni siquiera el propio
 * cleanup de pruebas puede saltárselo.
 *
 * En vez de pelear contra eso, `telefonoUnico()` (abajo) genera
 * identidad con entropía suficiente para que una corrida nueva NUNCA
 * choque con lo que dejó una corrida vieja — el negocio de prueba
 * anterior queda ahí, inerte, en la base local (nunca en producción:
 * este archivo no corre contra nada que no sea 127.0.0.1). Para
 * empezar de cero de verdad: `npx supabase db reset`.
 */
beforeAll(async () => {
  const { error } = await db.from("ranchos").select("id").limit(1);
  if (error) {
    throw new Error(
      "No se pudo conectar al Supabase local (127.0.0.1:54321). Corré `npx supabase start` antes de estas pruebas.\n" +
        error.message,
    );
  }
});

/** Crea un dueño + rancho de prueba, listos para usar. Cada test los borra al final. */
async function crearDuenoYRancho(prefijoCrudo: string) {
  // cuentas.slug exige minúsculas (CHECK de 0134) y el slug de la
  // cuenta se copia del de `ranchos` dentro de la RPC — un prefijo con
  // mayúscula acá rompía silenciosamente esa copia. Se normaliza acá,
  // una vez, para que a nadie que agregue un test nuevo le pase lo
  // mismo.
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
  return { ownerId, ranchoId };
}

// personas.telefono exige exactamente 8 dígitos (CHECK real de la
// base). Como esta suite NO borra los datos de corridas anteriores
// (ver el comentario de beforeAll — el trigger de inmutabilidad del
// ledger lo impide, a propósito), el teléfono tiene que ser único
// entre TODAS las corridas que hayan pasado por esta base local, no
// solo dentro de una. Un contador que reinicia en 0 en cada proceso
// nuevo chocaba con exactamente esto — ya pasó una vez armando esta
// misma suite. Semilla de 4 dígitos del reloj (cambia entre
// corridas) + contador de 4 dígitos (nunca se repite DENTRO de una
// corrida) — 8 dígitos exactos, sin coordinarse con nada más.
// Fase 2C: Date.now() % 10000 colisionaba entre ARCHIVOS distintos de
// esta misma suite cuando Vitest los arrancaba dentro del mismo
// segundo (varios archivos nuevos se agregaron en Fase 2C) — cada
// archivo recalculaba el mismo módulo % 10000 y arrancaba su contador
// en 1, produciendo el MISMO teléfono. randomUUID() por archivo tiene
// entropía real, no depende de en qué milisegundo arrancó cada uno.
const semillaProceso = parseInt(randomUUID().replace(/-/g, "").slice(0, 8), 16) % 10000;
let contadorTelefono = 0;
function telefonoUnico(): string {
  contadorTelefono += 1;
  return String(semillaProceso).padStart(4, "0") + String(contadorTelefono % 10000).padStart(4, "0");
}

async function limpiarNegocio(ranchoId: string, ownerId: string) {
  // Fase 2C: miembros_programa_id_fkey pasó de CASCADE a RESTRICT (ver
  // 0160 §4) — un miembro sin ledger/canjes se puede borrar directo,
  // pero ya no cae solo al borrar programa_lealtad. Miembros CON
  // historial siguen sin poder limpiarse (por diseño, ver el comentario
  // de arriba sobre el trigger de inmutabilidad) — ahí este delete
  // falla en silencio y el negocio de prueba queda inerte, igual que
  // documentaba este archivo antes de la Fase 2C.
  const { data: programas } = await db.from("programa_lealtad").select("id").eq("rancho_id", ranchoId);
  const programaIds = (programas ?? []).map((p) => p.id as string);
  if (programaIds.length > 0) {
    await db.from("miembros").delete().in("programa_id", programaIds);
  }
  await db.from("cuentas").delete().eq("rancho_id", ranchoId);
  await db.from("programa_lealtad").delete().eq("rancho_id", ranchoId);
  await db.from("ranchos").delete().eq("id", ranchoId);
  await db.auth.admin.deleteUser(ownerId).catch(() => {});
}

describe("Migración A — alta_cuenta_lealtad", () => {
  it("crea cuenta + equipo + programa en una sola llamada", async () => {
    const { ownerId, ranchoId } = await crearDuenoYRancho("altaA");
    try {
      const { data, error } = await db.rpc("alta_cuenta_lealtad", {
        p_owner_id: ownerId,
        p_rancho_id: ranchoId,
        p_limite_programas: 1,
        p_programa: { nombre: "Programa de prueba", modo: "sellos", plan: "prueba" },
      });
      expect(error).toBeNull();
      expect(data.ok).toBe(true);
      expect(data.cuenta_creada).toBe(true);
      expect(data.programa_creado).toBe(true);

      const { data: equipo } = await db.from("cuentas_equipo").select("rol").eq("cuenta_id", data.cuenta_id);
      expect(equipo).toHaveLength(1);
      expect(equipo![0].rol).toBe("propietario");
    } finally {
      await limpiarNegocio(ranchoId, ownerId);
    }
  });

  it("una segunda llamada reutiliza la cuenta y respeta el límite de programas del plan", async () => {
    const { ownerId, ranchoId } = await crearDuenoYRancho("altaB");
    try {
      const primera = await db.rpc("alta_cuenta_lealtad", {
        p_owner_id: ownerId,
        p_rancho_id: ranchoId,
        p_limite_programas: 1,
        p_programa: { nombre: "Uno" },
      });
      const segunda = await db.rpc("alta_cuenta_lealtad", {
        p_owner_id: ownerId,
        p_rancho_id: ranchoId,
        p_limite_programas: 1,
        p_programa: { nombre: "Dos" },
      });
      expect(segunda.data.ok).toBe(false);
      expect(segunda.data.motivo).toBe("limite_de_programas_alcanzado");
      expect(segunda.data.cuenta_id).toBe(primera.data.cuenta_id);

      const { count } = await db.from("cuentas").select("id", { count: "exact", head: true }).eq("rancho_id", ranchoId);
      expect(count).toBe(1);
    } finally {
      await limpiarNegocio(ranchoId, ownerId);
    }
  });

  it("10 llamadas CONCURRENTES para el mismo negocio nuevo crean UNA sola cuenta", async () => {
    const { ownerId, ranchoId } = await crearDuenoYRancho("altaConc");
    try {
      const llamadas = Array.from({ length: 10 }, () =>
        db.rpc("alta_cuenta_lealtad", {
          p_owner_id: ownerId,
          p_rancho_id: ranchoId,
          p_limite_programas: 1,
          p_programa: { nombre: "Concurrente" },
        }),
      );
      const resultados = await Promise.all(llamadas);
      const exitosas = resultados.filter((r) => r.data?.ok === true);
      expect(exitosas).toHaveLength(1);

      const { count: cuentas } = await db.from("cuentas").select("id", { count: "exact", head: true }).eq("rancho_id", ranchoId);
      const { count: programas } = await db
        .from("programa_lealtad")
        .select("id", { count: "exact", head: true })
        .eq("rancho_id", ranchoId);
      expect(cuentas).toBe(1);
      expect(programas).toBe(1);
    } finally {
      await limpiarNegocio(ranchoId, ownerId);
    }
  }, 20_000);
});

describe("Migración A — trigger de ownership", () => {
  it("rechaza que un programa quede con rancho_id y cuenta_id de dueños distintos", async () => {
    const { ownerId, ranchoId } = await crearDuenoYRancho("owner1");
    const ajeno = await crearDuenoYRancho("owner2");
    try {
      const { data: alta } = await db.rpc("alta_cuenta_lealtad", {
        p_owner_id: ownerId,
        p_rancho_id: ranchoId,
        p_limite_programas: 1,
        p_programa: { nombre: "Programa" },
      });
      const { data: cuentaAjena } = await db
        .from("cuentas")
        .insert({ nombre: "Cuenta ajena", slug: `ajena-${randomUUID().slice(0, 8)}`, owner_id: ajeno.ownerId })
        .select("id")
        .single();

      const { error } = await db.from("programa_lealtad").update({ cuenta_id: cuentaAjena!.id }).eq("id", alta.programa_id);
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/dueños distintos/);

      await db.from("cuentas").delete().eq("id", cuentaAjena!.id);
    } finally {
      await limpiarNegocio(ranchoId, ownerId);
      await limpiarNegocio(ajeno.ranchoId, ajeno.ownerId);
    }
  });
});

describe("Migración C — inmutabilidad del ledger", () => {
  it("UPDATE y DELETE sobre transacciones_puntos se rechazan siempre, incluso para el rol de servicio", async () => {
    const { ownerId, ranchoId } = await crearDuenoYRancho("ledger");
    try {
      const { data: alta } = await db.rpc("alta_cuenta_lealtad", {
        p_owner_id: ownerId,
        p_rancho_id: ranchoId,
        p_limite_programas: 1,
        p_programa: { nombre: "Programa" },
      });
      const { data: persona } = await db.from("personas").insert({ telefono: telefonoUnico() }).select("id").single();
      const { data: miembro } = await db
        .from("miembros")
        .insert({ programa_id: alta.programa_id, persona_id: persona!.id, estado: "activa" })
        .select("id")
        .single();
      await db.rpc("acreditar_lealtad", {
        p_miembro_id: miembro!.id,
        p_monto: null,
        p_referencia: "visita-ledger-1",
        p_usuario_id: null,
        p_motivo: "prueba",
      });

      const { data: tx } = await db.from("transacciones_puntos").select("id").eq("miembro_id", miembro!.id).single();

      const update = await db.from("transacciones_puntos").update({ puntos: 999 }).eq("id", tx!.id);
      expect(update.error).not.toBeNull();
      expect(update.error!.message).toMatch(/inmutable/);

      const del = await db.from("transacciones_puntos").delete().eq("id", tx!.id);
      expect(del.error).not.toBeNull();
      expect(del.error!.message).toMatch(/inmutable/);
    } finally {
      await limpiarNegocio(ranchoId, ownerId);
    }
  });
});

describe("Migración C — concurrencia de canjear_recompensa", () => {
  async function fixtureDeCanje(opts: { usoUnico?: boolean; saldoInicial: number; costo: number }) {
    const { ownerId, ranchoId } = await crearDuenoYRancho("canje");
    const { data: alta } = await db.rpc("alta_cuenta_lealtad", {
      p_owner_id: ownerId,
      p_rancho_id: ranchoId,
      p_limite_programas: 1,
      p_programa: { nombre: "Programa canje", estado: "activo", activo: true },
    });
    if (opts.usoUnico) {
      await db.from("programa_lealtad").update({ uso_unico: true }).eq("id", alta.programa_id);
    }
    const { data: rec } = await db
      .from("recompensas")
      .insert({ programa_id: alta.programa_id, nombre: "Premio", costo_puntos: opts.costo, activo: true })
      .select("id")
      .single();
    const { data: persona } = await db.from("personas").insert({ telefono: telefonoUnico() }).select("id").single();
    const { data: miembro } = await db
      .from("miembros")
      .insert({ programa_id: alta.programa_id, persona_id: persona!.id, estado: "activa" })
      .select("id")
      .single();
    if (opts.saldoInicial > 0) {
      await db.rpc("acreditar_lealtad", {
        p_miembro_id: miembro!.id,
        p_monto: null,
        p_referencia: "seed-" + randomUUID(),
        p_usuario_id: null,
        p_motivo: "seed",
      });
      // acreditar_lealtad da puntos_por_visita (1) por llamada — acreditamos las veces que hagan falta.
      for (let i = 1; i < opts.saldoInicial; i++) {
        await db.rpc("acreditar_lealtad", {
          p_miembro_id: miembro!.id,
          p_monto: null,
          p_referencia: "seed-" + randomUUID(),
          p_usuario_id: null,
          p_motivo: "seed",
        });
      }
    }
    return { ownerId, ranchoId, programaId: alta.programa_id, recompensaId: rec!.id, miembroId: miembro!.id };
  }

  it("una tarjeta de uso único: 10 canjes concurrentes conceden como máximo 1", async () => {
    const f = await fixtureDeCanje({ usoUnico: true, saldoInicial: 100, costo: 10 });
    try {
      const llamadas = Array.from({ length: 10 }, (_, i) =>
        db.rpc("canjear_recompensa", {
          p_miembro_id: f.miembroId,
          p_recompensa_id: f.recompensaId,
          p_usuario_id: null,
          p_referencia: `uso-unico-${i}`,
        }),
      );
      const resultados = await Promise.all(llamadas);
      const exitosos = resultados.filter((r) => r.data?.ok === true);
      expect(exitosos).toHaveLength(1);

      const { count } = await db
        .from("canjes")
        .select("id", { count: "exact", head: true })
        .eq("miembro_id", f.miembroId)
        .eq("estado", "entregado");
      expect(count).toBe(1);
    } finally {
      await limpiarNegocio(f.ranchoId, f.ownerId);
    }
  }, 20_000);

  it("misma idempotency key, 5 llamadas concurrentes: solo una cobra, el saldo baja una sola vez", async () => {
    const f = await fixtureDeCanje({ saldoInicial: 100, costo: 10 });
    try {
      const llamadas = Array.from({ length: 5 }, () =>
        db.rpc("canjear_recompensa", {
          p_miembro_id: f.miembroId,
          p_recompensa_id: f.recompensaId,
          p_usuario_id: null,
          p_referencia: "misma-key-concurrente",
        }),
      );
      const resultados = await Promise.all(llamadas);
      expect(resultados.filter((r) => r.data?.ok === true)).toHaveLength(1);
      expect(resultados.filter((r) => r.data?.motivo === "ya-canjeado")).toHaveLength(4);

      const { data: ledger } = await db.from("transacciones_puntos").select("puntos").eq("miembro_id", f.miembroId);
      const saldo = ledger!.reduce((s, r) => s + (r.puntos as number), 0);
      expect(saldo).toBe(90);
    } finally {
      await limpiarNegocio(f.ranchoId, f.ownerId);
    }
  }, 20_000);

  it("rechaza el canje si el saldo es insuficiente", async () => {
    const f = await fixtureDeCanje({ saldoInicial: 5, costo: 10 });
    try {
      const { data } = await db.rpc("canjear_recompensa", {
        p_miembro_id: f.miembroId,
        p_recompensa_id: f.recompensaId,
        p_usuario_id: null,
        p_referencia: "sin-saldo",
      });
      expect(data.ok).toBe(false);
      expect(data.motivo).toMatch(/Saldo insuficiente/);
    } finally {
      await limpiarNegocio(f.ranchoId, f.ownerId);
    }
  });

  it("revertir_movimiento repone el saldo y anula el canje", async () => {
    const f = await fixtureDeCanje({ saldoInicial: 20, costo: 10 });
    try {
      const canje = await db.rpc("canjear_recompensa", {
        p_miembro_id: f.miembroId,
        p_recompensa_id: f.recompensaId,
        p_usuario_id: null,
        p_referencia: "para-revertir",
      });
      expect(canje.data.ok).toBe(true);

      const { data: tx } = await db
        .from("transacciones_puntos")
        .select("id")
        .eq("miembro_id", f.miembroId)
        .eq("tipo", "canjeado")
        .single();

      const reversa = await db.rpc("revertir_movimiento", { p_transaccion_id: tx!.id, p_usuario_id: null, p_motivo: "prueba" });
      expect(reversa.data.ok).toBe(true);
      expect(reversa.data.saldo).toBe(20);

      const { data: canjeFila } = await db.from("canjes").select("estado").eq("miembro_id", f.miembroId).single();
      expect(canjeFila!.estado).toBe("anulado");
    } finally {
      await limpiarNegocio(f.ranchoId, f.ownerId);
    }
  });
});

describe("Migración D — wallet_encolar_sincronizacion", () => {
  it("hace fan-out: un miembro con pase Apple y Google encola 2 filas independientes", async () => {
    const { ownerId, ranchoId } = await crearDuenoYRancho("sync");
    try {
      const { data: alta } = await db.rpc("alta_cuenta_lealtad", {
        p_owner_id: ownerId,
        p_rancho_id: ranchoId,
        p_limite_programas: 1,
        p_programa: { nombre: "Programa sync" },
      });
      const { data: persona } = await db.from("personas").insert({ telefono: telefonoUnico() }).select("id").single();
      const { data: miembro } = await db
        .from("miembros")
        .insert({ programa_id: alta.programa_id, persona_id: persona!.id, estado: "activa" })
        .select("id")
        .single();
      await db.from("pases_wallet").insert([
        { miembro_id: miembro!.id, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true },
        { miembro_id: miembro!.id, plataforma: "google", serial_number: randomUUID(), auth_token: randomUUID(), activo: true },
      ]);

      const evento = randomUUID();
      const { data: encoladas } = await db.rpc("wallet_encolar_sincronizacion", {
        p_miembro_id: miembro!.id,
        p_operacion: "saldo",
        p_idempotency_key: evento,
        p_correlation_id: randomUUID(),
      });
      expect(encoladas).toBe(2);

      const { data: filas } = await db.from("wallet_sincronizaciones").select("plataforma, estado").eq("miembro_id", miembro!.id);
      expect(filas).toHaveLength(2);
      expect(filas!.map((f) => f.plataforma).sort()).toEqual(["apple", "google"]);

      // Reencolar el MISMO evento no debe duplicar.
      const { data: segundaVez } = await db.rpc("wallet_encolar_sincronizacion", {
        p_miembro_id: miembro!.id,
        p_operacion: "saldo",
        p_idempotency_key: evento,
        p_correlation_id: randomUUID(),
      });
      expect(segundaVez).toBe(0);
      const { count } = await db.from("wallet_sincronizaciones").select("id", { count: "exact", head: true }).eq("miembro_id", miembro!.id);
      expect(count).toBe(2);
    } finally {
      await limpiarNegocio(ranchoId, ownerId);
    }
  });
});

describe("Migración E — update_tag monotónico", () => {
  it("sube de a 1 en cada sincronización encolada, sin repetirse", async () => {
    const { ownerId, ranchoId } = await crearDuenoYRancho("tag");
    try {
      const { data: alta } = await db.rpc("alta_cuenta_lealtad", {
        p_owner_id: ownerId,
        p_rancho_id: ranchoId,
        p_limite_programas: 1,
        p_programa: { nombre: "Programa tag" },
      });
      const { data: persona } = await db.from("personas").insert({ telefono: telefonoUnico() }).select("id").single();
      const { data: miembro } = await db
        .from("miembros")
        .insert({ programa_id: alta.programa_id, persona_id: persona!.id, estado: "activa" })
        .select("id")
        .single();
      const { data: pase } = await db
        .from("pases_wallet")
        .insert({ miembro_id: miembro!.id, plataforma: "apple", serial_number: randomUUID(), auth_token: randomUUID(), activo: true })
        .select("id")
        .single();

      for (let i = 0; i < 5; i++) {
        await db.rpc("wallet_encolar_sincronizacion", {
          p_miembro_id: miembro!.id,
          p_operacion: "saldo",
          p_idempotency_key: randomUUID(),
          p_correlation_id: randomUUID(),
        });
      }

      const { data: paseFinal } = await db.from("pases_wallet").select("update_tag").eq("id", pase!.id).single();
      expect(paseFinal!.update_tag).toBe(5);

      const { data: tags } = await db.from("wallet_sincronizaciones").select("version_local_esperada").eq("pase_id", pase!.id);
      const distintos = new Set(tags!.map((t) => t.version_local_esperada));
      expect(distintos.size).toBe(5);
    } finally {
      await limpiarNegocio(ranchoId, ownerId);
    }
  });
});

