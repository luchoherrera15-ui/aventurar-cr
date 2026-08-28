"use server";

import { requireAdmin, verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { cargarLealtad } from "@/app/lealtad/panel/[id]/datos-lealtad";

/**
 * VER CLIENTES de un negocio, desde /admin/complementos — SOLO LECTURA.
 *
 * El pedido del dueño fue explícito: "poder darle click y ver cuántos
 * usuarios tiene inscritos y demás". Esto NO es el mostrador operativo
 * del negocio (`atencion-manual.tsx`/`ListaClientes`, con botones para
 * acreditar/canjear/revertir) — es Bookea mirando de afuera. Apretar
 * esos botones por error sobre un negocio ajeno sería el peor bug
 * posible acá, así que esta pantalla ni los importa: arma su propia
 * ficha de solo lectura reusando `cargarLealtad()` como fuente de
 * datos, nada más.
 *
 * ── DOS CAPAS DE PERMISO, NO UNA ────────────────────────────────────
 *
 * A diferencia de "Ver pase" (que solo previsualiza el DISEÑO de una
 * tarjeta), acá se leen nombre, correo y teléfono de personas reales.
 * Por eso:
 *   1. `requireAdmin()` primero — barato, falla temprano si ni siquiera
 *      es admin de plataforma, antes de tocar el rancho.
 *   2. `verificarAccesoLealtad(ranchoId)` después — el MISMO camino que
 *      ya deja entrar a un admin al panel del propio negocio (no se
 *      inventa un tercer mecanismo de permiso), y de paso confirma que
 *      el rancho existe.
 */

/** Cliente inscrito, tal como lo ve un admin de plataforma. */
export type ClienteDeAdmin = {
  miembroId: string;
  nombre: string;
  /** true = ese "nombre" no es un nombre real (correo, teléfono, o la
   *  explicación de la ficha vacía) — mismo criterio que `FichaMiembro`. */
  sinNombre: boolean;
  contacto: string[];
  saldo: number;
  /** Lleva la tarjeta agregada al Wallet del teléfono. */
  conPase: boolean;
  /** ISO de alta como miembro. null si no se pudo resolver. */
  altaEn: string | null;
};

export type ResultadoVerClientes =
  | { ok: true; clientes: ClienteDeAdmin[]; total: number; truncado: boolean }
  | { ok: false; motivo: string };

/**
 * Techo de filas que se traen a pantalla completa. Calibrado contra el
 * plan "Ilimitado" (arriba del tope de "Impulso", que corta en 100) sin
 * llegar a forzar traer miles de fichas por un click. El CONTEO nunca
 * se recorta — solo la lista que se pinta — para que esta pantalla
 * jamás diga menos clientes de los que el negocio realmente tiene.
 */
const TOPE_CLIENTES_VISTA = 300;

export async function verClientesDeNegocio(ranchoId: string): Promise<ResultadoVerClientes> {
  const { ok: esAdmin } = await requireAdmin();
  if (!esAdmin) {
    return { ok: false, motivo: "No tenés permiso para ver los clientes de este negocio." };
  }

  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.ok) {
    return {
      ok: false,
      motivo: "Ese negocio no existe, o no se pudo confirmar el acceso a su lealtad.",
    };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: FALTA_SERVICE_KEY };

  // Mismo campo de agrupación que ya usa `page.tsx` para armar
  // "tarjetasPorRancho": `rancho_id`, no `cuenta_id`.
  const { data: programas, error: errorProgramas } = await admin
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", ranchoId);

  if (errorProgramas) {
    return { ok: false, motivo: "No se pudieron leer las tarjetas de este negocio." };
  }

  const idsProgramas = (programas ?? []).map((p) => p.id as string);
  if (idsProgramas.length === 0) {
    return {
      ok: false,
      motivo: "Este negocio no tiene ningún programa de lealtad — no hay clientes que mostrar.",
    };
  }

  // Un negocio puede tener varias tarjetas (0134): se reusa
  // `cargarLealtad()` una vez por programa, en paralelo — no una
  // consulta nueva paralela a la que ya arma el panel del propio
  // negocio. `meta: null` a propósito: acá solo hace falta la ficha,
  // no el resumen de "cuánto le falta" del mostrador operativo.
  const resultados = await Promise.all(idsProgramas.map((id) => cargarLealtad(id, null)));
  const fichasCrudas = resultados.flatMap((r) => r?.fichas ?? []);

  // ── DEDUPLICAR POR PERSONA Y FILTRAR ACTIVAS — el MISMO criterio
  //    que ya usa la columna "Clientes" que abre este modal
  //    (`clientes-por-negocio.ts`, "personas distintas, no se cuenta
  //    dos veces a la misma señora que tiene dos tarjetas del mismo
  //    local"), no uno inventado acá. Sin esto, un negocio con varias
  //    tarjetas mostraba gente duplicada y de baja como si fueran
  //    clientes activos, y el total del modal no coincidía con el
  //    número que el admin acababa de clickear. `persona_id` es la
  //    llave — NO `clienteId` (0138): mucha gente se afilia sin tener
  //    cuenta de Bookea, y ahí `clienteId` da null para dos personas
  //    distintas por igual.
  const idsTodos = fichasCrudas.map((f) => f.miembroId);
  const respaldoPorMiembro = new Map<string, { personaId: string | null; estado: string | null }>();
  if (idsTodos.length > 0) {
    const { data: miembrosRes } = await admin
      .from("miembros")
      .select("id, persona_id, estado")
      .in("id", idsTodos);
    for (const m of miembrosRes ?? []) {
      respaldoPorMiembro.set(m.id as string, {
        personaId: (m.persona_id as string | null) ?? null,
        estado: (m.estado as string | null) ?? null,
      });
    }
  }

  const porPersona = new Map<string, (typeof fichasCrudas)[number]>();
  for (const f of fichasCrudas) {
    const respaldo = respaldoPorMiembro.get(f.miembroId);
    // Si la columna `estado` no existe o vino null, se cuenta la
    // fila — quedarse corto sería mostrar menos clientes de los que
    // el negocio tiene de verdad. Mismo criterio que `contarAMano`.
    if (respaldo?.estado && respaldo.estado !== "activa") continue;
    const llave = respaldo?.personaId ?? f.miembroId;
    // Entre dos tarjetas de la MISMA persona, se queda con la de
    // mayor saldo — es el dato más informativo para el admin, no un
    // criterio arbitrario de "cuál llegó primero".
    const existente = porPersona.get(llave);
    if (!existente || f.saldo > existente.saldo) porPersona.set(llave, f);
  }
  const fichas = [...porPersona.values()];

  const total = fichas.length;
  const truncado = total > TOPE_CLIENTES_VISTA;
  const aMostrar = fichas.slice(0, TOPE_CLIENTES_VISTA);

  // Solo para las filas que se van a mostrar: la fecha de alta como
  // miembro. No se pide para las que el tope ya descartó — pedirle
  // `created_at` a potencialmente miles de filas por un click sería
  // exactamente el tipo de consulta que el tope existe para evitar.
  const idsAMostrar = aMostrar.map((f) => f.miembroId);
  const altaPorMiembro = new Map<string, string | null>();
  if (idsAMostrar.length > 0) {
    const { data: miembrosRes } = await admin
      .from("miembros")
      .select("id, created_at")
      .in("id", idsAMostrar);
    for (const m of miembrosRes ?? []) {
      altaPorMiembro.set(m.id as string, (m.created_at as string | null) ?? null);
    }
  }

  const clientes: ClienteDeAdmin[] = aMostrar
    .map((f) => ({
      miembroId: f.miembroId,
      nombre: f.nombre,
      sinNombre: f.sinNombre,
      contacto: f.contacto,
      saldo: f.saldo,
      conPase: f.conPase,
      altaEn: altaPorMiembro.get(f.miembroId) ?? null,
    }))
    // El más nuevo primero; empate por nombre. Distinto a día de
    // `fichasDeMiembros` (quién necesita atención) a propósito: la
    // pregunta típica del admin acá es "¿está entrando gente nueva a
    // este negocio?", no "a quién atender ahora".
    .sort((a, b) => {
      if (a.altaEn && b.altaEn && a.altaEn !== b.altaEn) return b.altaEn.localeCompare(a.altaEn);
      if (a.altaEn && !b.altaEn) return -1;
      if (!a.altaEn && b.altaEn) return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });

  return { ok: true, clientes, total, truncado };
}
