import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * FASE 2C, SECCIÓN 3 — COMPORTAMIENTO DEL LEDGER ANTE DELETE/CASCADE.
 *
 * El trigger de inmutabilidad de 0160 (Fase 2B) demostró que un DELETE
 * en cascada hacia transacciones_puntos siempre falla — pero eso salió
 * a la luz de casualidad, limpiando fixtures de prueba, no de una
 * prueba deliberada. Este archivo prueba, a propósito, exactamente los
 * 6 escenarios que pide la Fase 2C: borrar un movimiento, borrar un
 * miembro con movimientos, archivar un miembro, borrar un programa con
 * ledger, pseudonimizar una persona sin destruir su historial, y
 * limpiar fixtures de prueba (sin ningún mecanismo de bypass — ver el
 * último test).
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

async function crearDuenoConProgramaYMiembro(prefijoCrudo: string, opts: { conLedger: boolean }) {
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
  // correo NO puede derivarse solo del prefijo: como los fixtures con
  // ledger quedan inertes a propósito (RESTRICT, ver más abajo), un
  // correo determinístico chocaría con la corrida anterior que dejó el
  // mismo prefijo vivo. randomUUID() lo hace único entre corridas
  // también, no solo dentro de una.
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

  if (opts.conLedger) {
    await db.rpc("acreditar_lealtad", {
      p_miembro_id: miembro!.id,
      p_monto: null,
      p_referencia: "seed-" + randomUUID(),
      p_usuario_id: null,
      p_motivo: "seed para prueba de delete",
    });
  }

  return { ownerId, ranchoId, programaId: alta.programa_id as string, personaId: persona!.id as string, miembroId: miembro!.id as string };
}

describe("1. Borrar un movimiento directamente", () => {
  it("se rechaza siempre — trigger de inmutabilidad, ya endurecido en Fase 2B", async () => {
    const f = await crearDuenoConProgramaYMiembro("delMov", { conLedger: true });
    const { data: tx } = await db.from("transacciones_puntos").select("id").eq("miembro_id", f.miembroId).single();
    const del = await db.from("transacciones_puntos").delete().eq("id", tx!.id);
    expect(del.error).not.toBeNull();
    expect(del.error!.message).toMatch(/inmutable/);
  });
});

describe("2. Borrar un miembro con movimientos", () => {
  it("se rechaza con RESTRICT (antes: CASCADE que reventaba dos niveles más abajo)", async () => {
    const f = await crearDuenoConProgramaYMiembro("delMiembroConLedger", { conLedger: true });
    const del = await db.from("miembros").delete().eq("id", f.miembroId);
    expect(del.error).not.toBeNull();
    // Código real de Postgres para violación de FK RESTRICT: 23503.
    expect(del.error!.code).toBe("23503");

    const { data: sigueVivo } = await db.from("miembros").select("id").eq("id", f.miembroId).maybeSingle();
    expect(sigueVivo).not.toBeNull();
  });

  it("un miembro SIN movimientos sí se puede borrar directo (RESTRICT no bloquea lo que no tiene historial)", async () => {
    const f = await crearDuenoConProgramaYMiembro("delMiembroSinLedger", { conLedger: false });
    const del = await db.from("miembros").delete().eq("id", f.miembroId);
    expect(del.error).toBeNull();
    const { data: yaNoEsta } = await db.from("miembros").select("id").eq("id", f.miembroId).maybeSingle();
    expect(yaNoEsta).toBeNull();
  });
});

describe("3. Archivar un miembro (alternativa preferida al borrado físico)", () => {
  it("cambiar estado a 'cancelada' funciona limpio, con o sin ledger", async () => {
    const f = await crearDuenoConProgramaYMiembro("archivar", { conLedger: true });
    const upd = await db.from("miembros").update({ estado: "cancelada" }).eq("id", f.miembroId).select("estado");
    expect(upd.error).toBeNull();
    expect(upd.data![0].estado).toBe("cancelada");

    // El ledger sigue intacto y consultable — archivar no lo toca.
    const { data: ledger } = await db.from("transacciones_puntos").select("id").eq("miembro_id", f.miembroId);
    expect(ledger!.length).toBeGreaterThan(0);
  });
});

describe("4. Borrar un programa con ledger (o con miembros, tengan o no ledger)", () => {
  it("se rechaza con RESTRICT si tiene un miembro con movimientos", async () => {
    const f = await crearDuenoConProgramaYMiembro("delProgramaConLedger", { conLedger: true });
    const del = await db.from("programa_lealtad").delete().eq("id", f.programaId);
    expect(del.error).not.toBeNull();
    expect(del.error!.code).toBe("23503");
  });

  it("se rechaza con RESTRICT aunque el único miembro NO tenga ledger — antes esto SÍ cascadeaba", async () => {
    const f = await crearDuenoConProgramaYMiembro("delProgramaSinLedger", { conLedger: false });
    const del = await db.from("programa_lealtad").delete().eq("id", f.programaId);
    expect(del.error).not.toBeNull();
    expect(del.error!.code).toBe("23503");

    const { data: sigueVivo } = await db.from("programa_lealtad").select("id").eq("id", f.programaId).maybeSingle();
    expect(sigueVivo).not.toBeNull();
  });

  it("SÍ se puede borrar un programa sin ningún miembro", async () => {
    const ownerId = randomUUID();
    const ranchoId = randomUUID();
    const prefijo = "delprogramavacio";
    await db.auth.admin.createUser({ id: ownerId, email: `${prefijo}-${ownerId.slice(0, 8)}@bookea.lat`, email_confirm: true });
    await db.from("ranchos").insert({
      id: ranchoId,
      owner_id: ownerId,
      nombre: "Negocio sin miembros",
      slug: `negocio-${prefijo}-${ranchoId.slice(0, 8)}`,
      estado: "aprobado",
      categoria: "otros",
    });
    const { data: alta } = await db.rpc("alta_cuenta_lealtad", {
      p_owner_id: ownerId,
      p_rancho_id: ranchoId,
      p_limite_programas: 1,
      p_programa: { nombre: "Programa vacío" },
    });
    const del = await db.from("programa_lealtad").delete().eq("id", alta.programa_id);
    expect(del.error).toBeNull();
    await db.from("cuentas").delete().eq("rancho_id", ranchoId);
    await db.from("ranchos").delete().eq("id", ranchoId);
    await db.auth.admin.deleteUser(ownerId).catch(() => {});
  });
});

describe("5. Pseudonimizar los datos personales de un miembro sin destruir su historial", () => {
  it("HALLAZGO REAL: anular teléfono Y correo a la vez se rechaza — personas exige al menos un identificador", async () => {
    // No es un bug de esta fase: personas_algun_identificador (CHECK
    // preexistente) exige telefono IS NOT NULL OR correo IS NOT NULL OR
    // cliente_id IS NOT NULL — confirmado contra el esquema real, no
    // asumido. Significa que "pseudonimizar" una persona SIN cuenta
    // (cliente_id null, el caso típico de alta por QR en mostrador) no
    // puede ser un simple `UPDATE ... SET telefono = NULL, correo =
    // NULL`; necesita un valor placeholder — ver el siguiente test.
    const f = await crearDuenoConProgramaYMiembro("pseudoRechazo", { conLedger: true });
    const upd = await db.from("personas").update({ telefono: null, correo: null }).eq("id", f.personaId);
    expect(upd.error).not.toBeNull();
    expect(upd.error!.code).toBe("23514");
  });

  it("pseudonimización real: reemplazar teléfono/correo por un placeholder no identificable no toca miembros ni el ledger", async () => {
    const f = await crearDuenoConProgramaYMiembro("pseudoPlaceholder", { conLedger: true });

    // Placeholder que satisface los CHECK (formato de 8 dígitos para
    // telefono, forma de correo válida) pero no es un dato personal
    // real ni reversible a uno — telefonoUnico() ya genera algo con
    // forma de teléfono que NO es el teléfono real de nadie.
    const marcador = randomUUID();
    const upd = await db
      .from("personas")
      .update({ telefono: telefonoUnico(), correo: `eliminado-${marcador}@eliminado.invalid` })
      .eq("id", f.personaId)
      .select("telefono, correo");
    expect(upd.error).toBeNull();
    expect(upd.data![0].correo).toContain("eliminado");

    // El miembro y su ledger siguen intactos y enlazados — la solicitud
    // de privacidad no exige, ni debería exigir, borrar el historial.
    const { data: miembro } = await db.from("miembros").select("id, persona_id, estado").eq("id", f.miembroId).single();
    expect(miembro!.persona_id).toBe(f.personaId);
    const { data: ledger } = await db.from("transacciones_puntos").select("id").eq("miembro_id", f.miembroId);
    expect(ledger!.length).toBeGreaterThan(0);
  });

  it("persona CON cuenta (cliente_id): teléfono y correo SÍ se pueden anular a NULL, cliente_id solo ya satisface el CHECK", async () => {
    // HALLAZGO REAL (no de lectura de código): 0138 crea automáticamente
    // una fila en `personas` para TODO auth.users nuevo (trigger
    // on_auth_user_persona → resolver_persona), con cliente_id ya
    // enlazado — y `personas_cuenta_idx` es único por cliente_id. Fijar
    // a mano el cliente_id de un usuario nuevo en una persona YA
    // existente choca contra esa fila autocreada. La prueba real usa
    // la persona que el propio trigger crea, en vez de pelear contra
    // él — es también el camino real que sigue la aplicación.
    const ownerId = randomUUID();
    const ranchoId = randomUUID();
    const prefijo = "pseudoconcuenta";
    await db.auth.admin.createUser({ id: ownerId, email: `${prefijo}-${ownerId.slice(0, 8)}@bookea.lat`, email_confirm: true });
    await db.from("ranchos").insert({
      id: ranchoId,
      owner_id: ownerId,
      nombre: "Negocio pseudoConCuenta",
      slug: `negocio-${prefijo}-${ranchoId.slice(0, 8)}`,
      estado: "aprobado",
      categoria: "otros",
    });
    const { data: alta, error: errorAlta } = await db.rpc("alta_cuenta_lealtad", {
      p_owner_id: ownerId,
      p_rancho_id: ranchoId,
      p_limite_programas: 1,
      p_programa: { nombre: "Programa" },
    });
    if (errorAlta) throw errorAlta;

    const clienteId = randomUUID();
    await db.auth.admin.createUser({ id: clienteId, email: `cliente-real-${clienteId.slice(0, 8)}@bookea.lat`, email_confirm: true });
    const { data: personaAuto, error: errorPersonaAuto } = await db.from("personas").select("id").eq("cliente_id", clienteId).single();
    if (errorPersonaAuto) throw errorPersonaAuto;

    const { data: miembro, error: errorMiembro } = await db
      .from("miembros")
      .insert({ programa_id: alta.programa_id, persona_id: personaAuto!.id, estado: "activa" })
      .select("id")
      .single();
    if (errorMiembro) throw errorMiembro;
    await db.rpc("acreditar_lealtad", {
      p_miembro_id: miembro!.id,
      p_monto: null,
      p_referencia: "seed-" + randomUUID(),
      p_usuario_id: null,
      p_motivo: "seed",
    });

    const upd = await db.from("personas").update({ telefono: null, correo: null }).eq("id", personaAuto!.id).select("telefono, correo, cliente_id");
    expect(upd.error).toBeNull();
    expect(upd.data![0].telefono).toBeNull();
    expect(upd.data![0].correo).toBeNull();
    expect(upd.data![0].cliente_id).toBe(clienteId);

    const { data: ledger } = await db.from("transacciones_puntos").select("id").eq("miembro_id", miembro!.id);
    expect(ledger!.length).toBeGreaterThan(0);

    await db.auth.admin.deleteUser(clienteId).catch(() => {});
    // El programa/rancho de este test tienen un miembro con ledger:
    // quedan inertes a propósito, mismo comportamiento documentado en
    // el resto de este archivo.
  });
});

describe("6. Eliminar fixtures de prueba — sin ningún mecanismo de bypass", () => {
  it("NO existe una función de purga que desactive el trigger de inmutabilidad — decisión explícita de esta fase", async () => {
    // No se prueba una función porque, a propósito, no se construyó
    // ninguna: el mismo trigger que 0160 blindó contra service_role no
    // se reabre "solo para pruebas" — reabrirlo sería reintroducir,
    // en un archivo de test, el bypass que esa migración existe para
    // impedir en producción. El mecanismo real de limpieza profunda
    // sigue siendo `npx supabase db reset` (documentado desde Fase 2B
    // en wallet-v2.test.ts). Esta prueba confirma, contra el esquema
    // real, que la función simplemente no existe.
    const llamada = await db.rpc("purgar_ledger_de_prueba" as never, {} as never);
    expect(llamada.error).not.toBeNull();
    expect(llamada.error!.message).toMatch(/Could not find the function|schema cache/i);
  });
});
