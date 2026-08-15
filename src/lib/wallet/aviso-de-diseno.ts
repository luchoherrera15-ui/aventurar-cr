import { createAdminClient } from "@/lib/supabase/admin";
import { refrescarPaseGoogleDeMiembro } from "./google";
import {
  enGrupos,
  entregarApple,
  leerPases,
  plataformasConfiguradas,
  MAX_POR_CORRIDA,
  PAUSA_ENTRE_TANDAS_MS,
  TAMANO_TANDA,
  type Admin,
  type PaseParaAvisar,
  type Plataforma,
} from "./aviso-de-pausa";

/**
 * EL AVISO DE QUE LA TARJETA CAMBIÓ, en el teléfono del cliente.
 *
 * ------------------------------------------------------------------
 * EL SÍNTOMA, TAL COMO LO CONTÓ EL DUEÑO
 * ------------------------------------------------------------------
 * «Cuando se hacen cambios en las tarjetas, los cambios no llegan al
 * teléfono.» Es la MITAD del reporte que quedaba sin resolver: acreditar
 * un sello sí avisa (`avisarCambioDePase` corre por `after()` desde el
 * escáner, el mostrador manual, el canje, la reversión y las citas — ver
 * a64faac). Lo que nunca avisaba era editar el DISEÑO o las REGLAS desde
 * `/lealtad/panel/[id]/editar/[programaId]`: `guardarPrograma` y
 * `guardarBeneficio` (pases-actions.ts) escriben `programa_lealtad` y
 * responden «Guardado» sin tocar un solo pase ya instalado.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO ES UN LOOP DENTRO DEL GUARDADO
 * ------------------------------------------------------------------
 * Mismo motivo que la 0147 (`aviso-de-pausa.ts`): avisarle a un pase
 * cuesta una llamada a Apple o a Google, y un programa de 1.150 pases
 * son 1.150 llamadas — demasiado para que el dueño se quede mirando la
 * pantalla del editor esperando el «Guardado».
 *
 * La diferencia con la pausa es QUIÉN dispara el trabajo. La pausa nace
 * de un cron que revisa el estado del programa cada diez minutos; un
 * cambio de diseño nace de un click del dueño, que sí espera ALGO de
 * vuelta — típicamente quiere ver su propio pase de prueba actualizado
 * ya. Por eso acá hay DOS disparadores para el MISMO trabajo:
 *
 *   1. El guardado (`marcarDisenoPendiente`) enciende la bandera para
 *      TODOS los pases del programa con una sola sentencia — rápido sin
 *      importar si son 3 o 3.000 — y dispara UNA corrida inmediata por
 *      `after()` (después de responder, sin bloquear el guardado) que
 *      atiende hasta `TAMANO_TANDA` pases ya mismo.
 *   2. El cron de `/api/lealtad/pases-en-pausa` (que desde el 0150
 *      también llama a `sincronizarAvisoDeDiseno`) recoge lo que la
 *      corrida inmediata no alcanzó a hacer, cada diez minutos, hasta
 *      que no quede ningún pase con la bandera encendida.
 *
 * Las tres propiedades de la 0147 siguen valiendo acá, con el MISMO
 * mecanismo (reclamo por update condicional sobre una bandera booleana):
 * reanudable, idempotente, con rastro en `diseno_error`.
 */

export type ResumenDiseno = {
  /** Pases que recibieron el cambio de diseño. */
  avisados: number;
  /** Pases que no se pudieron actualizar. El motivo queda en la fila. */
  fallidos: number;
  /** Las plataformas que este servidor pudo atender. */
  plataformas: Plataforma[];
  /** true = se agotó el presupuesto de la corrida y quedó trabajo. */
  quedaTrabajo: boolean;
  /** Cuando algo impidió trabajar (sin llaves, sin la 0150, sin base). */
  nota?: string;
};

export type OpcionesDiseno = {
  db?: Admin | null;
  ahora?: Date;
  maxPorCorrida?: number;
  tamanoTanda?: number;
  pausaMs?: number;
  /** Inyectable para las pruebas: por defecto duerme de verdad. */
  dormir?: (ms: number) => Promise<void>;
};

const dormirDeVerdad = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms));

/** Cuántos ids de miembro entran en un `in (…)` al marcar la bandera. */
export const MIEMBROS_POR_CONSULTA = 200;

/** «Esa columna no existe» — o sea, falta correr la 0150. */
function faltaLaColumna(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(error.message ?? "")
  );
}

export type ResultadoMarcado = { ok: true; marcados: number } | { ok: false; motivo: string };

/**
 * ENCIENDE `diseno_pendiente` para todos los pases activos de un
 * programa. La llama `guardarPrograma`/`guardarBeneficio` después de
 * guardar el diseño o las reglas — con la llave de servicio, porque
 * `pases_wallet` no le da UPDATE a nadie que no sea el servidor (0060).
 *
 * Es una operación de METADATA (sin red a Apple ni a Google), así que
 * corre entera aunque el programa tenga miles de miembros: lo único que
 * se trocea es el `in (…)` para no mandar una URL kilométrica, el mismo
 * cuidado que `PROGRAMAS_POR_CONSULTA` en `aviso-de-pausa.ts`.
 *
 * Nunca lanza: un guardado de diseño que SÍ entró a `programa_lealtad`
 * no puede fallar completo porque esto no pudo marcar una bandera.
 */
export async function marcarDisenoPendiente(
  db: Admin,
  programaId: string,
): Promise<ResultadoMarcado> {
  try {
    const { data: miembros, error: errorMiembros } = await db
      .from("miembros")
      .select("id")
      .eq("programa_id", programaId);
    if (errorMiembros) {
      return { ok: false, motivo: `No se pudieron leer los miembros: ${errorMiembros.message}` };
    }

    const ids = ((miembros ?? []) as { id: string }[]).map((m) => m.id);
    if (ids.length === 0) return { ok: true, marcados: 0 };

    let marcados = 0;
    for (const grupo of enGrupos(ids, MIEMBROS_POR_CONSULTA)) {
      const { data, error } = await db
        .from("pases_wallet")
        .update({ diseno_pendiente: true, diseno_error: null })
        .in("miembro_id", grupo)
        .eq("activo", true)
        .select("id");

      if (error) {
        if (faltaLaColumna(error)) {
          // Sin la 0150 no hay dónde marcar nada. El diseño ya quedó
          // guardado en `programa_lealtad`; el aviso a los teléfonos
          // simplemente no puede prometerse todavía.
          return {
            ok: false,
            motivo: "Falta correr la migración 0150 (pases_wallet.diseno_pendiente).",
          };
        }
        return { ok: false, motivo: `No se pudo marcar la tanda: ${error.message}` };
      }
      marcados += (data ?? []).length;
    }

    return { ok: true, marcados };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "No se pudo marcar el diseño pendiente.";
    console.error("[diseno-pase] marcarDisenoPendiente se cayó:", e);
    return { ok: false, motivo };
  }
}

/**
 * Una corrida completa: entrega el cambio de diseño a lo que tenga la
 * bandera encendida, hasta agotar el presupuesto. NUNCA lanza — la
 * llama tanto el cron (con calma) como el propio guardado (por
 * `after()`, apenas se respondió al dueño), y ninguno de los dos puede
 * caerse porque a Apple o a Google no les gustó algo.
 */
export async function sincronizarAvisoDeDiseno(
  opciones: OpcionesDiseno = {},
): Promise<ResumenDiseno> {
  const resumen: ResumenDiseno = {
    avisados: 0,
    fallidos: 0,
    plataformas: [],
    quedaTrabajo: false,
  };

  try {
    return await correr(opciones, resumen);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "Falló el barrido de diseño pendiente.";
    console.error("[diseno-pase] La corrida se cayó:", e);
    return { ...resumen, nota: motivo };
  }
}

async function correr(opciones: OpcionesDiseno, resumen: ResumenDiseno): Promise<ResumenDiseno> {
  const db = "db" in opciones ? opciones.db : createAdminClient();
  if (!db) return { ...resumen, nota: "No hay conexión de servicio (falta la llave de servicio)." };

  const plataformas = plataformasConfiguradas();
  resumen.plataformas = plataformas;
  if (plataformas.length === 0) {
    return {
      ...resumen,
      nota:
        "Ni Apple ni Google están configurados en este servidor: no hay a quién avisarle. " +
        "Faltan APPLE_PASS_* o GOOGLE_WALLET_*.",
    };
  }

  const presupuesto = { queda: opciones.maxPorCorrida ?? MAX_POR_CORRIDA };
  const tamanoTanda = opciones.tamanoTanda ?? TAMANO_TANDA;
  const pausaMs = opciones.pausaMs ?? PAUSA_ENTRE_TANDAS_MS;
  const dormir = opciones.dormir ?? dormirDeVerdad;
  const ahoraISO = (opciones.ahora ?? new Date()).toISOString();
  const fallados = new Set<string>();

  while (presupuesto.queda > 0) {
    const cuantos = Math.min(tamanoTanda, presupuesto.queda);

    // LA PREGUNTA ENTERA: pases vigentes, de una plataforma que este
    // servidor puede atender, con la bandera de diseño encendida.
    const { data, error } = await db
      .from("pases_wallet")
      .select("id, serial_number, plataforma, miembro_id")
      .eq("activo", true)
      .eq("diseno_pendiente", true)
      .in("plataforma", plataformas)
      // Lo que nunca falló va primero — mismo criterio que la 0147: un
      // pase roto con un id bajo no puede tapar a los que sí se pueden
      // avisar.
      .order("diseno_error", { ascending: true, nullsFirst: true })
      .order("id", { ascending: true })
      .limit(cuantos);

    if (error) {
      if (faltaLaColumna(error)) {
        console.error(
          "[diseno-pase] No se avisó ningún pase: falta correr la migración 0150 " +
            "(pases_wallet.diseno_pendiente).",
        );
        return {
          ...resumen,
          nota: "Falta correr la migración 0150 (pases_wallet.diseno_pendiente): no se avisó nada.",
        };
      }
      return { ...resumen, nota: `No se pudieron leer los pases: ${error.message}` };
    }

    const traidos = leerPases(data ?? []);
    if (traidos.length === 0) break; // no queda nada pendiente

    const tanda = traidos.filter((p) => !fallados.has(p.id));
    if (tanda.length === 0) break;

    const hechos = await procesarTanda(db, tanda, ahoraISO, fallados, resumen);
    presupuesto.queda -= tanda.length;

    if (hechos === 0) break; // algo de afuera está caído; no insistir con el presupuesto entero

    if (presupuesto.queda > 0 && pausaMs > 0) await dormir(pausaMs);
  }

  resumen.quedaTrabajo = presupuesto.queda <= 0;
  return resumen;
}

/**
 * Una tanda: se RECLAMA (apaga `diseno_pendiente` con update
 * condicional, ANTES de mandar nada — el mismo candado contra dos
 * corridas simultáneas que usa la 0147), se entrega, y lo que falló
 * vuelve a encender la bandera con el motivo escrito.
 *
 * Devuelve cuántos quedaron con el diseño nuevo de verdad.
 */
async function procesarTanda(
  db: Admin,
  tanda: PaseParaAvisar[],
  ahoraISO: string,
  fallados: Set<string>,
  resumen: ResumenDiseno,
): Promise<number> {
  const { data: ganadas, error } = await db
    .from("pases_wallet")
    .update({ diseno_pendiente: false, diseno_avisado_en: ahoraISO, diseno_error: null })
    .in(
      "id",
      tanda.map((p) => p.id),
    )
    .eq("diseno_pendiente", true)
    .select("id");

  if (error) {
    resumen.nota = `No se pudo reclamar la tanda: ${error.message}`;
    return 0;
  }

  const reclamados = new Set((ganadas ?? []).map((g) => g.id as string));
  const propios = tanda.filter((p) => reclamados.has(p.id));
  if (propios.length === 0) return 0; // se los llevó otra corrida

  const fallidos: { id: string; motivo: string }[] = [];

  const deApple = propios.filter((p) => p.plataforma === "apple");
  if (deApple.length > 0) {
    const res = await entregarApple(db, deApple);
    if (!res.ok) {
      for (const p of deApple) fallidos.push({ id: p.id, motivo: res.motivo });
    }
  }

  for (const p of propios.filter((q) => q.plataforma === "google")) {
    const res = await refrescarPaseGoogleDeMiembro(p.miembroId);
    if (!res.ok) fallidos.push({ id: p.id, motivo: res.motivo });
  }

  if (fallidos.length > 0) {
    for (const f of fallidos) fallados.add(f.id);
    await devolver(db, fallidos);
  }

  const entraron = propios.length - fallidos.length;
  resumen.avisados += entraron;
  resumen.fallidos += fallidos.length;

  console.log(
    `[diseno-pase] Tanda: ${entraron} de ${propios.length} (${fallidos.length} con problema).`,
  );

  return entraron;
}

/** Agrupa por motivo para no hacer un update por pase — pura y testeable. */
export function agruparPorMotivo(
  fallidos: readonly { id: string; motivo: string }[],
): Map<string, string[]> {
  const porMotivo = new Map<string, string[]>();
  for (const f of fallidos) {
    const clave = f.motivo.slice(0, 400);
    const ids = porMotivo.get(clave);
    if (ids) ids.push(f.id);
    else porMotivo.set(clave, [f.id]);
  }
  return porMotivo;
}

/** Vuelve a encender la bandera y deja el motivo en la fila. */
async function devolver(db: Admin, fallidos: { id: string; motivo: string }[]): Promise<void> {
  for (const [motivo, ids] of agruparPorMotivo(fallidos)) {
    const { error } = await db
      .from("pases_wallet")
      .update({ diseno_pendiente: true, diseno_error: motivo })
      .in("id", ids);
    if (error) {
      console.error(
        `[diseno-pase] ${ids.length} pase(s) quedaron marcados sin haberse avisado ` +
          `(no se pudo devolver la bandera): ${error.message}`,
      );
    }
  }
}

/**
 * LA PUERTA DE ENTRADA DESDE EL EDITOR.
 *
 * Marca el programa entero como pendiente y dispara UNA corrida
 * inmediata (hasta `TAMANO_TANDA` pases) para que el dueño, que
 * probablemente tiene su propio pase de prueba instalado, lo vea
 * cambiar sin esperar los diez minutos del cron. El resto —si el
 * programa tiene más pases que una tanda— lo recoge el cron.
 *
 * Se llama SIEMPRE desde `after()` (Next.js): nunca debe demorar la
 * respuesta «Guardado» que el dueño está esperando en pantalla.
 */
/**
 * Devuelve el resumen real (avisados/fallidos) en vez de `void` — antes
 * se perdía acá mismo y la UI del mensaje promocional (marketing-mensaje.tsx)
 * terminaba mostrando "ya salió" de forma incondicional, sin importar si
 * Apple estaba mal configurado o si `entregarApple` había fallado.
 * `null` = no se intentó nada (sin llaves, sin pases instalados, o el
 * marcado falló) — la UI lo trata como "no hay nada que reportar de Apple".
 */
export async function avisarCambioDeDiseno(programaId: string): Promise<ResumenDiseno | null> {
  const db = createAdminClient();
  if (!db) return null;

  const marcado = await marcarDisenoPendiente(db, programaId);
  if (!marcado.ok) {
    console.warn(`[diseno-pase] No se pudo marcar el programa ${programaId}: ${marcado.motivo}`);
    return null;
  }
  if (marcado.marcados === 0) return null; // sin pases instalados, nada que avisar

  const resumen = await sincronizarAvisoDeDiseno({ db, maxPorCorrida: TAMANO_TANDA * 2 });
  if (resumen.nota) console.warn(`[diseno-pase] ${resumen.nota}`);
  return resumen;
}
