import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * ETAPA 9 (Wallet V2) — `wallet_v2_diagnostico_sincronizacion` (0168).
 *
 * Prueba dos cosas, ninguna de las cuales se puede confirmar solo
 * leyendo el SQL:
 *
 *   1. La cadena completa se arma de verdad contra fixtures reales:
 *      movimiento (transacciones_puntos) -> fila de sync
 *      (wallet_sincronizaciones) -> pase (pases_wallet, update_tag,
 *      última descarga) -> dispositivos (registros_dispositivo, solo
 *      conteo/fecha), todo unido por correlation_id/pase_id.
 *   2. La vista NUNCA devuelve `push_token` ni `auth_token` — se
 *      comprueba que la COLUMNA no existe en la fila (`in` sobre las
 *      claves del objeto), no solo que venga en null: si algún día
 *      alguien agrega `select *` o nombra esas columnas por error, un
 *      `toBeNull()` seguiría pasando y no detectaría el problema.
 *
 * Corre con: npx supabase db reset && npm run test:wallet-v2-local
 */

const SUPABASE_URL_LOCAL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
// Mismo tipo de credencial pública fija del CLI local que SERVICE_ROLE_KEY_LOCAL
// (issuer "supabase-demo") — no es secreta, es la que imprime `npx supabase
// status` en cualquier máquina que corra el stack local (ver
// wallet-v2-rls-sesiones-reales.test.ts, mismo valor).
const ANON_KEY_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const db = createClient(SUPABASE_URL_LOCAL, SERVICE_ROLE_KEY_LOCAL, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL_LOCAL, ANON_KEY_LOCAL, { auth: { persistSession: false } });

beforeAll(async () => {
  const { error } = await db.from("ranchos").select("id").limit(1);
  if (error) {
    throw new Error(
      "No se pudo conectar al Supabase local (127.0.0.1:54321). Corré `npx supabase start` antes de estas pruebas.\n" +
        error.message,
    );
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
    .select("id, plataforma, serial_number");
  if (errorPases) throw errorPases;

  const paseApple = pases!.find((p) => p.plataforma === "apple")!;
  const paseGoogle = pases!.find((p) => p.plataforma === "google")!;

  return {
    ownerId,
    ranchoId,
    programaId: alta.programa_id as string,
    miembroId: miembro!.id as string,
    paseAppleId: paseApple.id as string,
    paseAppleSerial: paseApple.serial_number as string,
    paseGoogleId: paseGoogle.id as string,
  };
}

async function filasDelJob(miembroId: string, plataforma: "apple" | "google") {
  const { data, error } = await db
    .from("wallet_v2_diagnostico_sincronizacion")
    .select("*")
    .eq("miembro_id", miembroId)
    .eq("plataforma", plataforma)
    .order("job_creado_en", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

describe("wallet_v2_diagnostico_sincronizacion — cadena completa con fixtures reales", () => {
  it("une movimiento -> fila de sync -> pase -> dispositivos por correlation_id/pase_id", async () => {
    const f = await crearMiembroConDosPases("diagCadenaCompleta");

    // Un teléfono se registra para el pase de Apple (la única señal
    // real de "dispositivo registrado" que existe hoy).
    const { error: errorRegistro } = await db.from("registros_dispositivo").insert({
      device_library_id: `device-${randomUUID()}`,
      push_token: `push-token-de-mentira-${randomUUID()}`,
      pass_type_id: "pass.lat.bookea.afiliacion",
      serial_number: f.paseAppleSerial,
    });
    if (errorRegistro) throw errorRegistro;

    // Simula que ese mismo teléfono YA vino a buscar el .pkpass una vez
    // (0151) — antes de que exista ningún movimiento todavía.
    const descargaSimulada = new Date(Date.now() - 60_000).toISOString();
    await db.from("pases_wallet").update({ ultima_descarga_en: descargaSimulada }).eq("id", f.paseAppleId);

    // El movimiento real: acreditar_lealtad escribe la fila del ledger
    // Y encola una fila de sync por pase activo (fan-out), las dos con
    // el MISMO correlation_id — esto es lo que la vista tiene que unir.
    const referencia = `diag-${randomUUID()}`;
    const { data: resultado, error: errorAcreditar } = await db.rpc("acreditar_lealtad", {
      p_miembro_id: f.miembroId,
      p_monto: null,
      p_referencia: referencia,
      p_usuario_id: null,
      p_motivo: "Prueba de diagnóstico",
    });
    if (errorAcreditar) throw errorAcreditar;
    expect(resultado.otorgado).toBe(true);

    const { data: tx, error: errorTx } = await db
      .from("transacciones_puntos")
      .select("id, correlation_id, puntos, saldo_posterior")
      .eq("miembro_id", f.miembroId)
      .eq("referencia", referencia)
      .single();
    if (errorTx) throw errorTx;

    const filaApple = await filasDelJob(f.miembroId, "apple");
    const filaGoogle = await filasDelJob(f.miembroId, "google");

    // ── el eslabón "movimiento" ──────────────────────────────────
    expect(filaApple.correlation_id).toBe(tx!.correlation_id);
    expect(filaGoogle.correlation_id).toBe(tx!.correlation_id);
    expect(filaApple.transaccion_id).toBe(tx!.id);
    expect(filaApple.transaccion_tipo).toBe("ganado");
    expect(filaApple.transaccion_puntos).toBe(tx!.puntos);
    expect(filaApple.transaccion_saldo).toBe(tx!.saldo_posterior);
    // Las dos filas (apple y google) del mismo fan-out apuntan al MISMO
    // movimiento — un solo "Saldo"/"Transacción" para las dos.
    expect(filaGoogle.transaccion_id).toBe(tx!.id);

    // ── el eslabón "worker / fila de sync" ───────────────────────
    expect(filaApple.job_estado).toBe("pending"); // nadie corrió el worker en esta prueba
    expect(filaApple.intentos).toBe(0);
    expect(filaApple.error_sanitizado).toBeNull();

    // ── el eslabón "pase" (update_tag, versión perseguida) ───────
    expect(filaApple.pase_update_tag).toBe(1); // primer movimiento de este pase
    expect(filaApple.job_version_local_esperada).toBe(1); // wallet_encolar_sincronizacion guardó el mismo tag
    expect(filaGoogle.pase_update_tag).toBe(1);

    // ── el eslabón "descarga del pkpass" — SOLO Apple lo tiene ────
    expect(filaApple.pase_ultimo_pkpass_entregado_en).not.toBeNull();
    expect(new Date(filaApple.pase_ultimo_pkpass_entregado_en as string).toISOString()).toBe(descargaSimulada);
    expect(filaGoogle.pase_ultimo_pkpass_entregado_en).toBeNull(); // nunca se simuló una descarga de Google

    // ── el eslabón "dispositivos registrados" — SOLO Apple ────────
    expect(filaApple.dispositivos_registrados).toBe(1);
    expect(filaApple.dispositivo_ultima_consulta_en).not.toBeNull();
    expect(filaGoogle.dispositivos_registrados).toBe(0);
    expect(filaGoogle.dispositivo_ultima_consulta_en).toBeNull();
  });

  it("un job sin ninguna transacción que comparta su correlation_id no rompe el join: queda con NULLs, no con error", async () => {
    const f = await crearMiembroConDosPases("diagSinTransaccion");
    // Encola directo, sin pasar por ninguna RPC de movimiento — no hay
    // ninguna fila de transacciones_puntos con ese correlation_id.
    const correlationId = randomUUID();
    const { data: encoladas, error: errorEncolar } = await db.rpc("wallet_encolar_sincronizacion", {
      p_miembro_id: f.miembroId,
      p_operacion: "diseno",
      p_idempotency_key: `diseno:${randomUUID()}`,
      p_correlation_id: correlationId,
    });
    if (errorEncolar) throw errorEncolar;
    expect(encoladas).toBe(2);

    const filaApple = await filasDelJob(f.miembroId, "apple");
    expect(filaApple.correlation_id).toBe(correlationId);
    expect(filaApple.transaccion_id).toBeNull();
    expect(filaApple.transaccion_tipo).toBeNull();
    expect(filaApple.transaccion_saldo).toBeNull();
    // El resto de la cadena (pase, dispositivos) sigue completo aunque
    // no haya movimiento — el LEFT JOIN no descarta la fila del job.
    expect(filaApple.pase_id).toBe(f.paseAppleId);
  });

  it("sanea el error incluso en el camino que NINGÚN adaptador sanitiza (defensa en profundidad de la vista)", async () => {
    const f = await crearMiembroConDosPases("diagErrorSaneado");
    await db.rpc("wallet_encolar_sincronizacion", {
      p_miembro_id: f.miembroId,
      p_operacion: "saldo",
      p_idempotency_key: `tx:${randomUUID()}`,
      p_correlation_id: randomUUID(),
    });

    const { data: filaCruda } = await db
      .from("wallet_sincronizaciones")
      .select("id")
      .eq("miembro_id", f.miembroId)
      .eq("plataforma", "apple")
      .single();

    // Simula EXACTAMENTE el camino sin sanear que documenta 0168: una
    // excepción sin atrapar del adaptador, cuyo e.message crudo
    // `ejecutarCicloDeSincronizacion` (worker.ts) escribe TAL CUAL en
    // `error` — sin pasar por motivoSeguro()/sanitizarMotivo(). Una
    // corrida de 40 caracteres alfanuméricos con pinta de secreto.
    const secretoDeMentira = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCD"; // 41 chars
    const errorCrudo = `TypeError: no se pudo conectar (token=${secretoDeMentira})`;
    await db.from("wallet_sincronizaciones").update({ error: errorCrudo, estado: "retryable", intentos: 1 }).eq("id", filaCruda!.id);

    // La tabla CRUDA todavía tiene el secreto — confirma que el fixture
    // de verdad reproduce el camino sin sanear (si esto fallara, la
    // prueba de abajo no probaría nada real).
    const { data: crudaVerificada } = await db.from("wallet_sincronizaciones").select("error").eq("id", filaCruda!.id).single();
    expect(crudaVerificada!.error).toContain(secretoDeMentira);

    const { data: filaVista, error: errorVista } = await db
      .from("wallet_v2_diagnostico_sincronizacion")
      .select("error_sanitizado")
      .eq("job_id", filaCruda!.id)
      .single();
    if (errorVista) throw errorVista;

    expect(filaVista!.error_sanitizado).not.toContain(secretoDeMentira);
    expect(filaVista!.error_sanitizado).toContain("[omitido]");
  });

  it("NUNCA devuelve push_token ni auth_token como columna — ni siquiera nombrados, no solo en null", async () => {
    const f = await crearMiembroConDosPases("diagSinTokens");
    await db.from("registros_dispositivo").insert({
      device_library_id: `device-${randomUUID()}`,
      push_token: `push-token-real-de-mentira-${randomUUID()}`,
      pass_type_id: "pass.lat.bookea.afiliacion",
      serial_number: f.paseAppleSerial,
    });
    await db.rpc("wallet_encolar_sincronizacion", {
      p_miembro_id: f.miembroId,
      p_operacion: "saldo",
      p_idempotency_key: `tx:${randomUUID()}`,
      p_correlation_id: randomUUID(),
    });

    const { data: filas, error } = await db.from("wallet_v2_diagnostico_sincronizacion").select("*").eq("miembro_id", f.miembroId);
    if (error) throw error;
    expect(filas!.length).toBeGreaterThan(0);

    for (const fila of filas!) {
      const claves = Object.keys(fila);
      expect(claves).not.toContain("push_token");
      expect(claves).not.toContain("auth_token");
      // Tampoco ningún valor de la fila debería contener el push_token
      // que sí insertamos arriba — cinturón y tirantes.
      expect(JSON.stringify(fila)).not.toContain("push-token-real-de-mentira");
    }
  });

  it("RLS: ni anon ni authenticated pueden leerla — solo service_role (mismo patrón que 0159)", async () => {
    const { error: errorAnon } = await anon.from("wallet_v2_diagnostico_sincronizacion").select("*").limit(1);
    expect(errorAnon).not.toBeNull();
  });
});
