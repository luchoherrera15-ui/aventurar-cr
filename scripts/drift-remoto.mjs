/**
 * DRIFT REMOTO vs LOCAL — Fase 2C, sección 7.
 *
 * Compara, en modo exclusivamente de lectura, el estado real del
 * Supabase remoto contra las migraciones locales (0156-0165, todavía no
 * aplicadas) y el resto del esquema relevante a Wallet V2. No imprime
 * PII ni secretos — solo metadata de esquema.
 *
 * Uso: node scripts/drift-remoto.mjs
 */

import { consultaSoloLectura } from "./inspeccionar-remoto.mjs";

const TABLAS = [
  "ranchos",
  "cuentas",
  "cuentas_equipo",
  "rancho_colaboradores",
  "programa_lealtad",
  "personas",
  "personas_negocio",
  "miembros",
  "pases_wallet",
  "registros_dispositivo",
  "transacciones_puntos",
  "recompensas",
  "canjes",
  "intentos_canje",
  "wallet_sincronizaciones",
  "wallet_sync_pendiente",
];

// Este repo NO usa `supabase db push` ni la tabla de control estándar
// del CLI (`supabase_migrations.schema_migrations` — confirmado que NO
// existe en remoto, ver hallazgo en fase-2c-resultado.md §7). El dueño
// pega cada migración a mano en el SQL Editor; el propio repo ya tiene
// su mecanismo de verificación por objeto testigo (`estado-migraciones.mjs`)
// en vez de una tabla de control. Se sigue el mismo patrón acá para las
// migraciones 0156-0165: cada una se confirma por un objeto real que
// solo existiría si esa migración concreta ya corrió.
const TESTIGOS_WALLET_V2 = [
  ["0156", "función", "alta_cuenta_lealtad"],
  ["0157", "vista", "wallet_v2_backfill_pendientes"],
  ["0158", "función", "programa_lealtad_verificar_ownership"],
  ["0159", "columna:miembros", "saldo_cache"],
  ["0160", "función", "transacciones_puntos_inmutable"],
  ["0161", "tabla", "wallet_sincronizaciones"],
  ["0162", "función", "wallet_encolar_sincronizacion"],
  ["0163", "columna:pases_wallet", "auth_token_version"],
  ["0165", "función", "programa_lealtad_proteger_columnas_sistema"],
];

async function main() {
  const salida = {};

  // 1. Historial de migraciones remoto — por objeto testigo, no por
  // tabla de control (ver nota arriba).
  const testigos = {};
  for (const [mig, tipo, nombre] of TESTIGOS_WALLET_V2) {
    let existe;
    if (tipo === "función") {
      const r = await consultaSoloLectura(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${nombre}';`,
      );
      existe = r.length > 0;
    } else if (tipo === "vista") {
      const r = await consultaSoloLectura(
        `SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='${nombre}';`,
      );
      existe = r.length > 0;
    } else if (tipo === "tabla") {
      const r = await consultaSoloLectura(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${nombre}';`,
      );
      existe = r.length > 0;
    } else if (tipo.startsWith("columna:")) {
      const tabla = tipo.split(":")[1];
      const r = await consultaSoloLectura(
        `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${tabla}' AND column_name='${nombre}';`,
      );
      existe = r.length > 0;
    }
    testigos[mig] = { tipo, nombre, existe_en_remoto: existe };
  }
  salida.migraciones_wallet_v2_por_testigo = testigos;
  salida.nota_control_migraciones =
    "supabase_migrations.schema_migrations NO existe en remoto — este proyecto no usa `supabase db push`; el estado se confirma por objeto testigo (mismo patrón que scripts/estado-migraciones.mjs).";

  // 2. ¿Cuáles de las tablas de interés existen ya en remoto?
  const existentes = await consultaSoloLectura(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY(ARRAY[${TABLAS.map((t) => `'${t}'`).join(",")}]);`,
  );
  const tablasExistentes = existentes.map((r) => r.table_name);
  salida.tablas = { existentes: tablasExistentes, no_existen_todavia: TABLAS.filter((t) => !tablasExistentes.includes(t)) };

  // 3. Columnas de cada tabla existente (nombre, tipo, default, nullable).
  salida.columnas = {};
  for (const t of tablasExistentes) {
    const cols = await consultaSoloLectura(
      `SELECT column_name, data_type, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${t}'
       ORDER BY ordinal_position;`,
    );
    salida.columnas[t] = cols;
  }

  // 4. Constraints (incluye CHECK, FK con su ON DELETE, UNIQUE, PK).
  salida.constraints = {};
  for (const t of tablasExistentes) {
    const cons = await consultaSoloLectura(
      `SELECT
         con.conname AS nombre,
         con.contype AS tipo,
         pg_get_constraintdef(con.oid) AS definicion
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
       WHERE nsp.nspname = 'public' AND rel.relname = '${t}'
       ORDER BY con.conname;`,
    );
    salida.constraints[t] = cons;
  }

  // 5. Índices.
  salida.indices = {};
  for (const t of tablasExistentes) {
    const idx = await consultaSoloLectura(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='${t}' ORDER BY indexname;`,
    );
    salida.indices[t] = idx;
  }

  // 6. RLS habilitada + policies.
  salida.rls = {};
  for (const t of tablasExistentes) {
    const rls = await consultaSoloLectura(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='${t}' AND relnamespace = 'public'::regnamespace;`,
    );
    const policies = await consultaSoloLectura(
      `SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr,
              (SELECT array_agg(rolname) FROM unnest(polroles) AS r(oid) JOIN pg_roles ON pg_roles.oid = r.oid) AS roles
       FROM pg_policy WHERE polrelid = 'public.${t}'::regclass ORDER BY polname;`,
    );
    salida.rls[t] = { habilitada: rls[0] ?? null, policies };
  }

  // 7. Triggers.
  salida.triggers = {};
  for (const t of tablasExistentes) {
    const trg = await consultaSoloLectura(
      `SELECT tgname, pg_get_triggerdef(oid) AS definicion
       FROM pg_trigger WHERE tgrelid = 'public.${t}'::regclass AND NOT tgisinternal ORDER BY tgname;`,
    );
    salida.triggers[t] = trg;
  }

  // 8. Grants (solo para authenticated/anon/service_role).
  salida.grants = {};
  for (const t of tablasExistentes) {
    const g = await consultaSoloLectura(
      `SELECT grantee, privilege_type FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='${t}'
       AND grantee IN ('authenticated','anon','service_role')
       ORDER BY grantee, privilege_type;`,
    );
    salida.grants[t] = g;
  }

  // 9. Funciones relacionadas a Wallet V2 (por nombre).
  const FUNCIONES = [
    "alta_cuenta_lealtad",
    "canjear_recompensa",
    "acreditar_lealtad",
    "revertir_movimiento",
    "wallet_encolar_sincronizacion",
    "programa_lealtad_verificar_ownership",
    "programa_lealtad_proteger_columnas_sistema",
    "transacciones_puntos_inmutable",
  ];
  const funcs = await consultaSoloLectura(
    `SELECT p.proname AS nombre, pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef AS security_definer, p.proconfig AS config
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname = ANY(ARRAY[${FUNCIONES.map((f) => `'${f}'`).join(",")}])
     ORDER BY p.proname;`,
  );
  salida.funciones = funcs;

  console.log(JSON.stringify(salida, null, 2));
}

main().catch((e) => {
  console.error("drift-remoto.mjs falló:", e.message);
  process.exit(1);
});
