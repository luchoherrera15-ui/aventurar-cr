import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * FASE 2C, SECCIÓN 2 — PRUEBA REAL (NO DE CÓDIGO) DE LA PROTECCIÓN DE 0165.
 *
 * La lectura del código no cuenta como prueba (regla explícita de esta
 * fase). Este archivo crea usuarios locales reales, obtiene JWT reales
 * vía `signInWithPassword` (el mismo mecanismo que usa la app en
 * producción — nada de fabricar tokens a mano) y golpea PostgREST con
 * cada rol: dueño de la cuenta A, empleado con permiso de lealtad pero
 * SIN ser dueño, dueño de una cuenta B ajena, un usuario autenticado sin
 * ninguna relación, una sesión anónima y el service_role.
 *
 * Corre con: npx supabase db reset && npm run test:wallet-v2-local
 */

const SUPABASE_URL_LOCAL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
// Mismo tipo de credencial pública fija del CLI local que SERVICE_ROLE_KEY_LOCAL
// arriba (issuer "supabase-demo") — no es secreta, es la que imprime
// `npx supabase status` en cualquier máquina que corra el stack local.
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

const PASSWORD = "Test1234!Fase2C";

/** Crea un usuario real con contraseña conocida y devuelve un cliente YA logueado con su JWT real. */
async function usuarioConSesionReal(prefijo: string): Promise<{ userId: string; cliente: SupabaseClient }> {
  const email = `${prefijo}-${randomUUID().slice(0, 8)}@bookea.lat`;
  const { data: creado, error: e1 } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (e1) throw e1;
  const cliente = createClient(SUPABASE_URL_LOCAL, ANON_KEY_LOCAL, { auth: { persistSession: false } });
  const { data: sesion, error: e2 } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  expect(sesion.session?.access_token).toBeTruthy();
  return { userId: creado.user!.id, cliente };
}

async function crearDuenoConProgramaReal(prefijoCrudo: string) {
  // cuentas.slug exige minúsculas (CHECK de 0134) y la RPC copia el
  // slug del rancho — mismo cuidado que crearDuenoYRancho() en
  // wallet-v2.test.ts.
  const prefijo = prefijoCrudo.toLowerCase();
  const ownerId = randomUUID();
  const ranchoId = randomUUID();
  const email = `${prefijo}-${ownerId.slice(0, 8)}@bookea.lat`;
  await db.auth.admin.createUser({ id: ownerId, email, password: PASSWORD, email_confirm: true });
  await db.from("ranchos").insert({
    id: ranchoId,
    owner_id: ownerId,
    nombre: `Negocio ${prefijo}`,
    slug: `negocio-${prefijo}-${ranchoId.slice(0, 8)}`,
    estado: "aprobado",
    categoria: "otros",
  });
  const { data: alta, error } = await db.rpc("alta_cuenta_lealtad", {
    p_owner_id: ownerId,
    p_rancho_id: ranchoId,
    p_limite_programas: 5,
    p_programa: { nombre: `Programa ${prefijo}` },
  });
  if (error) throw error;

  const cliente = createClient(SUPABASE_URL_LOCAL, ANON_KEY_LOCAL, { auth: { persistSession: false } });
  const { data: sesion, error: e2 } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  expect(sesion.session?.access_token).toBeTruthy();

  return { ownerId, ranchoId, programaId: alta.programa_id as string, cuentaId: alta.cuenta_id as string, cliente };
}

async function limpiar(ranchoId: string, ownerId: string) {
  // Fase 2C: miembros_programa_id_fkey es RESTRICT, no CASCADE — ver
  // 0160 §4 y el mismo comentario en wallet-v2.test.ts.
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

describe("0165 — protección real de columnas internas de programa_lealtad, con sesiones JWT reales", () => {
  it("dueño real (JWT real): UPDATE directo a diseno_version/cuenta_id_confirmada NO se persiste (trigger revierte en silencio)", async () => {
    const a = await crearDuenoConProgramaReal("propietarioA");
    try {
      const { data: antes } = await db.from("programa_lealtad").select("diseno_version, cuenta_id_confirmada").eq("id", a.programaId).single();

      const upd = await a.cliente
        .from("programa_lealtad")
        .update({ diseno_version: 999, cuenta_id_confirmada: true })
        .eq("id", a.programaId)
        .select("diseno_version, cuenta_id_confirmada");

      // RLS SÍ deja pasar el UPDATE (es dueño de su propio rancho) — el
      // trigger revierte el VALOR, no rechaza la operación. Por eso acá
      // NO se espera un error: se espera que la fila devuelta ya venga
      // con el valor viejo, silenciosamente restaurado por el trigger.
      expect(upd.error).toBeNull();
      expect(upd.data).toHaveLength(1);
      expect(upd.data![0].diseno_version).toBe(antes!.diseno_version);
      expect(upd.data![0].cuenta_id_confirmada).toBe(antes!.cuenta_id_confirmada);

      const { data: despues } = await db.from("programa_lealtad").select("diseno_version, cuenta_id_confirmada").eq("id", a.programaId).single();
      expect(despues!.diseno_version).toBe(antes!.diseno_version);
      expect(despues!.cuenta_id_confirmada).toBe(antes!.cuenta_id_confirmada);
    } finally {
      await limpiar(a.ranchoId, a.ownerId);
    }
  });

  it("dueño real: sí puede actualizar una columna normal (nombre) en la misma llamada — confirma que el trigger NO bloquea todo el UPDATE", async () => {
    const a = await crearDuenoConProgramaReal("propietarioNombre");
    try {
      const nuevoNombre = "Programa renombrado por el dueño";
      const upd = await a.cliente.from("programa_lealtad").update({ nombre: nuevoNombre }).eq("id", a.programaId).select("nombre");
      expect(upd.error).toBeNull();
      expect(upd.data![0].nombre).toBe(nuevoNombre);
    } finally {
      await limpiar(a.ranchoId, a.ownerId);
    }
  });

  it("empleado con permiso de lealtad (JWT real, NO dueño): el UPDATE no toca ninguna fila — RLS lo bloquea antes de llegar al trigger", async () => {
    const a = await crearDuenoConProgramaReal("propietarioB1");
    const empleado = await usuarioConSesionReal("empleadoA");
    try {
      await db.from("rancho_colaboradores").insert({
        rancho_id: a.ranchoId,
        usuario_id: empleado.userId,
        rol: "empleado",
        permisos_lealtad: { acreditar: true, canjear: true },
      });

      const upd = await empleado.cliente
        .from("programa_lealtad")
        .update({ diseno_version: 999 })
        .eq("id", a.programaId)
        .select("id");

      // PostgREST no devuelve error cuando RLS filtra todas las filas
      // del UPDATE — devuelve éxito con 0 filas. Por eso la prueba real
      // es el largo del array devuelto, no `error`.
      expect(upd.error).toBeNull();
      expect(upd.data).toHaveLength(0);

      const { data: intacto } = await db.from("programa_lealtad").select("diseno_version").eq("id", a.programaId).single();
      expect(intacto!.diseno_version).toBe(1);
    } finally {
      await db.from("rancho_colaboradores").delete().eq("usuario_id", empleado.userId);
      await db.auth.admin.deleteUser(empleado.userId).catch(() => {});
      await limpiar(a.ranchoId, a.ownerId);
    }
  });

  it("dueño de OTRA cuenta (JWT real): el UPDATE al programa ajeno no toca ninguna fila", async () => {
    const a = await crearDuenoConProgramaReal("propietarioC1");
    const b = await crearDuenoConProgramaReal("propietarioC2");
    try {
      const upd = await b.cliente.from("programa_lealtad").update({ diseno_version: 999 }).eq("id", a.programaId).select("id");
      expect(upd.error).toBeNull();
      expect(upd.data).toHaveLength(0);

      const { data: intacto } = await db.from("programa_lealtad").select("diseno_version").eq("id", a.programaId).single();
      expect(intacto!.diseno_version).toBe(1);
    } finally {
      await limpiar(a.ranchoId, a.ownerId);
      await limpiar(b.ranchoId, b.ownerId);
    }
  });

  it("usuario autenticado sin ninguna relación: el UPDATE no toca ninguna fila", async () => {
    const a = await crearDuenoConProgramaReal("propietarioD1");
    const ajeno = await usuarioConSesionReal("ajeno");
    try {
      const upd = await ajeno.cliente.from("programa_lealtad").update({ diseno_version: 999 }).eq("id", a.programaId).select("id");
      expect(upd.error).toBeNull();
      expect(upd.data).toHaveLength(0);
    } finally {
      await db.auth.admin.deleteUser(ajeno.userId).catch(() => {});
      await limpiar(a.ranchoId, a.ownerId);
    }
  });

  it("sesión anónima: el UPDATE se rechaza de plano (permission denied) — anon no tiene GRANT de escritura en la tabla", async () => {
    const a = await crearDuenoConProgramaReal("propietarioE1");
    try {
      const upd = await anon.from("programa_lealtad").update({ diseno_version: 999 }).eq("id", a.programaId).select("id");
      expect(upd.error).not.toBeNull();
      expect(upd.error!.code).toBe("42501");
    } finally {
      await limpiar(a.ranchoId, a.ownerId);
    }
  });

  it("sesión anónima: SÍ puede leer un programa activo (política pública), pero nunca escribirlo", async () => {
    const a = await crearDuenoConProgramaReal("propietarioF1");
    try {
      await db.from("programa_lealtad").update({ activo: true }).eq("id", a.programaId);
      const sel = await anon.from("programa_lealtad").select("id, nombre").eq("id", a.programaId).single();
      expect(sel.error).toBeNull();
      expect(sel.data!.id).toBe(a.programaId);
    } finally {
      await limpiar(a.ranchoId, a.ownerId);
    }
  });

  it("service_role: SÍ puede escribir diseno_version/cuenta_id_confirmada directamente — el trigger solo frena a authenticated que no es admin", async () => {
    const a = await crearDuenoConProgramaReal("propietarioG1");
    try {
      const upd = await db.from("programa_lealtad").update({ diseno_version: 7, cuenta_id_confirmada: true }).eq("id", a.programaId).select("diseno_version, cuenta_id_confirmada");
      expect(upd.error).toBeNull();
      expect(upd.data![0].diseno_version).toBe(7);
      expect(upd.data![0].cuenta_id_confirmada).toBe(true);
    } finally {
      await limpiar(a.ranchoId, a.ownerId);
    }
  });

  it("regresión del hallazgo de Fase 2C: un INSERT directo del dueño con diseno_version/cuenta_id_confirmada arbitrarios se fuerza al default real", async () => {
    // La primera versión de 0165 protegía solo UPDATE (`before update
    // of ...`) — se probó con sesión real que un INSERT directo por
    // REST sí lograba fijar estas columnas al alta (ver
    // fase-2c-resultado.md §2). Se corrigió el trigger para cubrir
    // también INSERT; esta prueba falla si esa cobertura se retira.
    const ownerId = randomUUID();
    const ranchoId = randomUUID();
    const email = `insertgap-${ownerId.slice(0, 8)}@bookea.lat`;
    await db.auth.admin.createUser({ id: ownerId, email, password: PASSWORD, email_confirm: true });
    await db.from("ranchos").insert({
      id: ranchoId,
      owner_id: ownerId,
      nombre: "Negocio insert-gap",
      slug: `negocio-insertgap-${ranchoId.slice(0, 8)}`,
      estado: "aprobado",
      categoria: "otros",
    });
    const cliente = createClient(SUPABASE_URL_LOCAL, ANON_KEY_LOCAL, { auth: { persistSession: false } });
    await cliente.auth.signInWithPassword({ email, password: PASSWORD });

    try {
      const ins = await cliente
        .from("programa_lealtad")
        .insert({ rancho_id: ranchoId, nombre: "Programa insertado directo", diseno_version: 999, cuenta_id_confirmada: true })
        .select("id, diseno_version, cuenta_id_confirmada");

      expect(ins.error).toBeNull();
      expect(ins.data).toHaveLength(1);
      // Con el trigger corregido: se fuerza al default real (1 / false),
      // sin importar lo que haya mandado el cliente en el INSERT.
      expect(ins.data![0].diseno_version).toBe(1);
      expect(ins.data![0].cuenta_id_confirmada).toBe(false);
    } finally {
      await limpiar(ranchoId, ownerId);
    }
  });

  it("RPC no autorizada: authenticated no puede ejecutar alta_cuenta_lealtad directamente (EXECUTE es solo de service_role)", async () => {
    const u = await usuarioConSesionReal("rpcNoAutorizada");
    try {
      const { error } = await u.cliente.rpc("alta_cuenta_lealtad", {
        p_owner_id: u.userId,
        p_rancho_id: randomUUID(),
        p_limite_programas: 1,
        p_programa: { nombre: "No debería crearse" },
      });
      expect(error).not.toBeNull();
      expect(error!.code).toBe("42501");
    } finally {
      await db.auth.admin.deleteUser(u.userId).catch(() => {});
    }
  });

  it("RPC no autorizada: authenticated no puede ejecutar canjear_recompensa directamente", async () => {
    const u = await usuarioConSesionReal("rpcCanjeNoAutorizada");
    try {
      const { error } = await u.cliente.rpc("canjear_recompensa", {
        p_miembro_id: randomUUID(),
        p_recompensa_id: randomUUID(),
        p_usuario_id: u.userId,
        p_referencia: "intento-no-autorizado",
      });
      expect(error).not.toBeNull();
      expect(error!.code).toBe("42501");
    } finally {
      await db.auth.admin.deleteUser(u.userId).catch(() => {});
    }
  });
});
