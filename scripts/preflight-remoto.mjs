/**
 * PREFLIGHT DE DATOS REMOTOS — Fase 2C, sección 8.
 *
 * Conteos y relaciones de solo lectura contra el Supabase remoto, antes
 * de proponer aplicar 0156-0165. Nunca imprime PII (nombres, correos,
 * teléfonos, tokens, push tokens, seriales completos) — para conflictos
 * usa IDs truncados a 8 caracteres, suficiente para correlacionar filas
 * entre consultas de esta misma corrida sin poder reconstruir un UUID
 * real ni buscarlo en la base.
 *
 * Uso: node scripts/preflight-remoto.mjs
 */

import { consultaSoloLectura } from "./inspeccionar-remoto.mjs";

function truncar(uuid) {
  return typeof uuid === "string" ? uuid.slice(0, 8) : uuid;
}

async function contar(sql) {
  const r = await consultaSoloLectura(sql);
  return Number(r[0].n);
}

async function main() {
  const salida = {};

  salida.cuentas = await contar("SELECT count(*) AS n FROM cuentas;");
  salida.programas = await contar("SELECT count(*) AS n FROM programa_lealtad;");
  salida.programas_cuenta_id_null = await contar("SELECT count(*) AS n FROM programa_lealtad WHERE cuenta_id IS NULL;");
  salida.programas_cuenta_id_presente = await contar("SELECT count(*) AS n FROM programa_lealtad WHERE cuenta_id IS NOT NULL;");
  salida.miembros = await contar("SELECT count(*) AS n FROM miembros;");

  salida.pases_por_plataforma = await consultaSoloLectura(
    "SELECT plataforma, count(*) AS n FROM pases_wallet GROUP BY plataforma ORDER BY plataforma;",
  );

  const miembrosConMasDeUnPase = await consultaSoloLectura(
    `SELECT plataforma, count(*) AS filas_con_mas_de_uno FROM (
       SELECT miembro_id, plataforma, count(*) AS c
       FROM pases_wallet GROUP BY miembro_id, plataforma HAVING count(*) > 1
     ) x GROUP BY plataforma ORDER BY plataforma;`,
  );
  salida.miembros_con_mas_de_un_pase_por_plataforma = miembrosConMasDeUnPase;

  // Estos dos son estructuralmente imposibles hoy (FK NOT NULL) — se
  // dejan igual para no asumir sin comprobar.
  salida.pases_sin_miembro = await contar(
    "SELECT count(*) AS n FROM pases_wallet WHERE miembro_id IS NULL;",
  );
  salida.miembros_sin_programa = await contar(
    "SELECT count(*) AS n FROM miembros WHERE programa_id IS NULL;",
  );
  salida.movimientos_sin_miembro = await contar(
    "SELECT count(*) AS n FROM transacciones_puntos WHERE miembro_id IS NULL;",
  );

  // Saldos divergentes: para cada miembro, saldo recalculado desde el
  // ledger vs. el saldo_cache que hoy vive en CADA fila de pases_wallet
  // (todavía no existe miembros.saldo_cache — 0159 sin aplicar).
  const divergentes = await consultaSoloLectura(
    `WITH ledger AS (
       SELECT miembro_id, coalesce(sum(puntos), 0) AS saldo_real
       FROM transacciones_puntos GROUP BY miembro_id
     )
     SELECT pw.miembro_id, pw.plataforma, pw.saldo_cache, l.saldo_real
     FROM pases_wallet pw
     JOIN ledger l ON l.miembro_id = pw.miembro_id
     WHERE pw.saldo_cache IS DISTINCT FROM l.saldo_real;`,
  );
  salida.saldos_divergentes = divergentes.map((d) => ({
    miembro_id: truncar(d.miembro_id),
    plataforma: d.plataforma,
    saldo_cache: d.saldo_cache,
    saldo_real_del_ledger: d.saldo_real,
  }));

  salida.canjes = await contar("SELECT count(*) AS n FROM canjes;");
  salida.intentos_canje = await contar("SELECT count(*) AS n FROM intentos_canje;");
  salida.registros_apple = await contar("SELECT count(*) AS n FROM registros_dispositivo;");

  // "Duplicados": más de un device_library_id activo apuntando al mismo
  // serial_number no es un bug (un mismo pase en dos iPhones es normal)
  // — lo que sí es señal real es un registro cuyo serial_number no
  // corresponde a NINGÚN pase existente (huérfano, candidato a limpieza).
  salida.registros_apple_huerfanos = await contar(
    `SELECT count(*) AS n FROM registros_dispositivo rd
     WHERE NOT EXISTS (SELECT 1 FROM pases_wallet pw WHERE pw.serial_number = rd.serial_number);`,
  );
  salida.registros_apple_dispositivos_por_serial_mas_de_uno = await contar(
    `SELECT count(*) AS n FROM (
       SELECT serial_number, count(*) AS c FROM registros_dispositivo GROUP BY serial_number HAVING count(*) > 1
     ) x;`,
  );

  // Programas con más de una cuenta candidata por rancho_id (ambigüedad
  // para el backfill de 0157). cuentas.rancho_id es UNIQUE por diseño —
  // se comprueba en vez de asumir.
  const ambiguos = await consultaSoloLectura(
    `SELECT pl.id AS programa_id, pl.rancho_id, count(c.id) AS cuentas_candidatas
     FROM programa_lealtad pl
     JOIN cuentas c ON c.rancho_id = pl.rancho_id
     GROUP BY pl.id, pl.rancho_id
     HAVING count(c.id) > 1;`,
  );
  salida.programas_con_dos_posibles_cuentas = ambiguos.map((a) => ({
    programa_id: truncar(a.programa_id),
    rancho_id: truncar(a.rancho_id),
    cuentas_candidatas: Number(a.cuentas_candidatas),
  }));

  // Colaboradores (rancho_colaboradores, legacy) cuyo rancho todavía no
  // tiene una cuenta enlazable — mide el tamaño real del gap que 0158
  // tiene que cubrir con el fallback de equipo canónico.
  salida.colaboradores_total = await contar("SELECT count(*) AS n FROM rancho_colaboradores;");
  salida.colaboradores_sin_cuenta_enlazable = await contar(
    `SELECT count(*) AS n FROM rancho_colaboradores rcol
     WHERE NOT EXISTS (SELECT 1 FROM cuentas c WHERE c.rancho_id = rcol.rancho_id);`,
  );
  salida.cuentas_equipo_total = await contar("SELECT count(*) AS n FROM cuentas_equipo;");

  // Conflictos de ownership: cuenta.owner_id distinto del owner_id del
  // rancho que dice representar.
  const conflictosOwnership = await consultaSoloLectura(
    `SELECT c.id AS cuenta_id, r.id AS rancho_id
     FROM cuentas c
     JOIN ranchos r ON r.id = c.rancho_id
     WHERE c.owner_id IS DISTINCT FROM r.owner_id;`,
  );
  salida.conflictos_ownership = conflictosOwnership.map((c) => ({
    cuenta_id: truncar(c.cuenta_id),
    rancho_id: truncar(c.rancho_id),
  }));

  console.log(JSON.stringify(salida, null, 2));
}

main().catch((e) => {
  console.error("preflight-remoto.mjs falló:", e.message);
  process.exit(1);
});
