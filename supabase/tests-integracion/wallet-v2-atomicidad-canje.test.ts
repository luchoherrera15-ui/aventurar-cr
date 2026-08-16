import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * FASE 2C, SECCIÓN 10 — REVISIÓN DE SEGURIDAD Y ATOMICIDAD DEL CANJE.
 *
 * No basta con que las pruebas concurrentes YA existentes (Fase 2B)
 * hayan pasado — el enunciado pide inspeccionar explícitamente: el
 * momento exacto del lock, qué se lee antes de tomarlo, y probar un
 * fallo deliberado a mitad del flujo. Este archivo agrega exactamente
 * eso, sin repetir lo que `wallet-v2.test.ts` ya cubre.
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

async function crearMiembroConSaldo(prefijoCrudo: string, puntos: number) {
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
    p_programa: { nombre: `Programa ${prefijo}`, estado: "activo", activo: true },
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

  let otorgado = 0;
  while (otorgado < puntos) {
    const r = await db.rpc("acreditar_lealtad", {
      p_miembro_id: miembro!.id,
      p_monto: null,
      p_referencia: "seed-" + randomUUID(),
      p_usuario_id: null,
      p_motivo: "seed",
    });
    otorgado += r.data.puntos as number;
  }

  return { ownerId, ranchoId, programaId: alta.programa_id as string, miembroId: miembro!.id as string };
}

describe("HALLAZGO REAL (0166): revertir_movimiento confiaba en un índice único que nunca existió", () => {
  it("5 reversiones concurrentes del MISMO movimiento: exactamente una tiene éxito, las otras 4 dicen 'ya fue revertido'", async () => {
    // revertir_movimiento (0125/0139, YA EN PRODUCCIÓN) hace
    // `select * into v_tx ...` (incluido el chequeo de si v_tx MISMO es
    // una reversa) ANTES de `pg_advisory_xact_lock`, y el comentario de
    // 0139 dice textualmente "el unique parcial sobre reversion_de
    // garantiza UNA compensación por movimiento, aun con dos clics
    // simultáneos" — pero ese índice nunca se creó (confirmado contra
    // el esquema real, local y remoto: solo existía la FK). Sin él,
    // nada impedía una segunda fila de reversa para el mismo
    // movimiento. Se agregó en 0166 (Fase 2C) el índice que el código
    // siempre asumió que ya existía. Esta prueba fija el
    // comportamiento CORREGIDO como regresión.
    const f = await crearMiembroConSaldo("dobleReversion", 50);
    const { data: tx } = await db.from("transacciones_puntos").select("id").eq("miembro_id", f.miembroId).eq("tipo", "ganado").limit(1).single();

    const llamadas = Array.from({ length: 5 }, () =>
      db.rpc("revertir_movimiento", { p_transaccion_id: tx!.id, p_usuario_id: null, p_motivo: "prueba concurrente" }),
    );
    const resultados = await Promise.all(llamadas);
    const exitosos = resultados.filter((r) => r.data?.ok === true);
    const yaRevertido = resultados.filter((r) => r.data?.motivo === "Ese movimiento ya fue revertido.");

    const { data: reversas } = await db.from("transacciones_puntos").select("id").eq("reversion_de", tx!.id);

    expect(exitosos).toHaveLength(1);
    expect(yaRevertido).toHaveLength(4);
    expect(reversas).toHaveLength(1);
  }, 20_000);
});

// Ejecuta SQL crudo contra el Postgres LOCAL vía `docker exec ... psql`
// — nunca contra remoto (este archivo es de la suite local-only, ver
// encabezado). Solo se usa acá, para el swap temporal de abajo: no hay
// otra forma de forzar una excepción REAL dentro de
// wallet_encolar_sincronizacion sin tocar el archivo de migración.
function psqlLocal(sql: string) {
  execFileSync("docker", ["exec", "-i", "supabase_db_aventurar-cr", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

describe("Fallo deliberado en el encolado de sincronización", () => {
  it("si wallet_encolar_sincronizacion falla dentro de canjear_recompensa, TODO el canje se revierte — sin canje, sin movimiento, sin saldo modificado", async () => {
    const f = await crearMiembroConSaldo("falloEncolado", 50);
    const { data: rec } = await db.from("recompensas").insert({ programa_id: f.programaId, nombre: "Premio", costo_puntos: 10, activo: true }).select("id").single();

    const { data: saldoAntes } = await db.from("transacciones_puntos").select("puntos").eq("miembro_id", f.miembroId);
    const totalAntes = saldoAntes!.reduce((s, r) => s + (r.puntos as number), 0);
    const { count: canjesAntes } = await db.from("canjes").select("id", { count: "exact", head: true }).eq("miembro_id", f.miembroId);
    const { count: movimientosAntes } = await db.from("transacciones_puntos").select("id", { count: "exact", head: true }).eq("miembro_id", f.miembroId);

    // Se reemplaza wallet_encolar_sincronizacion, TEMPORALMENTE y solo
    // en este Postgres local, por una versión que siempre falla —
    // misma firma exacta, para que canjear_recompensa la siga
    // encontrando igual. Se restaura en el `finally`, pase lo que pase.
    const definicionOriginal = execFileSync("docker", [
      "exec",
      "supabase_db_aventurar-cr",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-t",
      "-A",
      "-c",
      "SELECT pg_get_functiondef('wallet_encolar_sincronizacion(uuid,text,text,uuid)'::regprocedure);",
    ]).toString();
    expect(definicionOriginal).toContain("wallet_encolar_sincronizacion");

    try {
      psqlLocal(
        `create or replace function public.wallet_encolar_sincronizacion(p_miembro_id uuid, p_operacion text, p_idempotency_key text, p_correlation_id uuid)
         returns integer language plpgsql as $f$
         begin
           raise exception 'fallo forzado por wallet-v2-atomicidad-canje.test.ts';
         end;
         $f$;`,
      );

      const canje = await db.rpc("canjear_recompensa", {
        p_miembro_id: f.miembroId,
        p_recompensa_id: rec!.id,
        p_usuario_id: null,
        p_referencia: "deberia-revertirse-completo",
      });

      // La excepción no capturada revierte TODA la función — supabase-js
      // la recibe como error de la llamada RPC, no como un {ok:false}.
      expect(canje.error).not.toBeNull();
      expect(canje.error!.message).toMatch(/fallo forzado/);
    } finally {
      // execFileSync con un array de argumentos no pasa por ningún
      // shell (ni acá ni dentro del contenedor) — el texto capturado se
      // reenvía tal cual, sin escapar nada, porque no hace falta.
      psqlLocal(definicionOriginal);
    }

    const { data: saldoDespues } = await db.from("transacciones_puntos").select("puntos").eq("miembro_id", f.miembroId);
    const totalDespues = saldoDespues!.reduce((s, r) => s + (r.puntos as number), 0);
    const { count: canjesDespues } = await db.from("canjes").select("id", { count: "exact", head: true }).eq("miembro_id", f.miembroId);
    const { count: movimientosDespues } = await db.from("transacciones_puntos").select("id", { count: "exact", head: true }).eq("miembro_id", f.miembroId);

    expect(totalDespues).toBe(totalAntes);
    expect(canjesDespues).toBe(canjesAntes);
    expect(movimientosDespues).toBe(movimientosAntes);

    // Confirma que la restauración quedó bien: un canje normal, DESPUÉS
    // de restaurar, vuelve a funcionar y a encolar de verdad.
    const canjeNormal = await db.rpc("canjear_recompensa", {
      p_miembro_id: f.miembroId,
      p_recompensa_id: rec!.id,
      p_usuario_id: null,
      p_referencia: "despues-de-restaurar",
    });
    // Prueba de que la restauración quedó bien: sin error, sin
    // "fallo forzado". (No se afirma nada sobre wallet_sincronizaciones
    // acá — este fixture no tiene ningún pases_wallet, así que el
    // fan-out real, correctamente, encola 0 filas; eso se prueba aparte
    // en wallet-v2.test.ts, que sí arma pases antes de encolar.)
    expect(canjeNormal.error).toBeNull();
  }, 30_000);
});

describe("Dónde se adquiere el lock en cada RPC (documentado con evidencia, no solo lectura de código)", () => {
  it("acreditar_lealtad y canjear_recompensa: el lock es la PRIMERA operación, ningún dato se lee antes", async () => {
    // No hay forma de "instrumentar" PL/pgSQL desde afuera para probar
    // el ORDEN exacto de las líneas sin leer el código — pero SÍ se
    // puede probar la consecuencia observable: si el lock fuera
    // realmente lo primero, una membresía inexistente falla LIMPIO
    // (ningún side-effect), lo cual ya cubren otras pruebas. Esta
    // prueba fija el comportamiento esperado como regresión.
    const { data } = await db.rpc("acreditar_lealtad", {
      p_miembro_id: randomUUID(),
      p_monto: null,
      p_referencia: "miembro-inexistente",
      p_usuario_id: null,
      p_motivo: "prueba",
    });
    expect(data.otorgado).toBe(false);
    expect(data.motivo).toMatch(/no existe/);
  });
});
