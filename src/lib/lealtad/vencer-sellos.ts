import { createAdminClient } from "@/lib/supabase/admin";
import { fechaISOEnZona } from "@/lib/fechas";
import {
  fechaDeCorte,
  motivoDeCorte,
  referenciaDeCorte,
  reglaDeFila,
  veredicto,
  type ReglaSellos,
  type Veredicto,
} from "./vencimiento-sellos";

/**
 * EL BARRIDO QUE REINICIA LOS SELLOS VENCIDOS (0180).
 *
 * La decisión de a quién le toca es pura y vive en
 * `vencimiento-sellos.ts`. Acá está lo que hace falta para llevarla a
 * cabo sin romper nada: el ledger, el pase del teléfono y el correo.
 *
 * ------------------------------------------------------------------
 * LAS TRES COSAS QUE NO SE NEGOCIAN
 * ------------------------------------------------------------------
 *
 * 1. EL PASE SE ACTUALIZA. Si los sellos se reinician y el teléfono
 *    sigue diciendo «5 de 10», el cliente llega al mostrador con una
 *    tarjeta que miente y el que queda mal es el negocio. Actualizar
 *    el pase de Apple son DOS mitades y este repo ya rompió las dos
 *    por separado: marcar `pases_wallet.actualizado_en` (sin eso el
 *    push llega, el teléfono pregunta «¿qué cambió?» y se lleva un
 *    204) y mandar el aviso. Acá van juntas, en `reiniciar`, y
 *    `vencer-sellos.test.ts` falla si alguien saltea una.
 *
 * 2. IDEMPOTENCIA EN LA BASE, no en un `if`. El movimiento del ledger
 *    lleva una referencia determinista (`venc:<fecha de corte>`) y el
 *    índice único `(miembro_id, referencia)` de la 0060 rechaza el
 *    segundo intento. El correo lleva su propia fila reclamada en
 *    `avisos_vencimiento_sellos`, con `unique (miembro_id, vence_el)`.
 *    Dos corridas simultáneas no restan dos veces ni mandan dos
 *    correos, y no porque este archivo pregunte antes.
 *
 * 3. NADA RETROACTIVO. Está resuelto una capa más abajo
 *    (`fechaDeCorte` no deja que el reloj arranque antes de que la
 *    regla se encienda), pero es la propiedad que más importa de todo
 *    esto y por eso se nombra también acá.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL REINICIO ES UN MOVIMIENTO Y NO UN `UPDATE`
 * ------------------------------------------------------------------
 * Porque no hay número que poner en cero: el saldo ES la suma del
 * ledger. Un `update` tendría que inventar una columna, y esa columna
 * sería la primera cosa del módulo que puede contradecir al ledger. Un
 * movimiento negativo con su motivo deja el saldo en 0 Y deja escrito
 * por qué, que es lo que hace falta cuando el cliente pregunta en el
 * mostrador.
 *
 * NUNCA lanza: es un cron. Lo peor que puede hacer es morirse callado.
 */

/** El cliente de servicio. Igual que en `aviso-de-pausa.ts`. */
export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Un miembro con lo que hace falta para juzgarlo. */
export type MiembroConSellos = {
  id: string;
  /** Suma del ledger. */
  saldo: number;
  /** ISO del último movimiento, o null si nunca se movió. */
  ultimoMovimiento: string | null;
  /** `pases_wallet.saldo_cache` del pase de Apple, si tiene uno. */
  saldoCache: number | null;
};

/**
 * LO QUE EL BARRIDO HACE CON EL MUNDO, en una interfaz.
 *
 * No es ceremonia: es lo que permite probar la regla «el pase se
 * actualiza siempre» sin una base de datos ni un iPhone. La
 * implementación real está más abajo (`accionesReales`) y es la única
 * que toca Supabase.
 */
export type AccionesVencimiento = {
  /**
   * El movimiento en el ledger. `duplicado` = otra corrida ya lo hizo
   * (el índice único contestó 23505), que NO es un error.
   */
  registrarReinicio(a: {
    miembroId: string;
    /** Positivo: cuántos sellos se le quitan. */
    sellos: number;
    motivo: string;
    referencia: string;
  }): Promise<{ ok: true } | { ok: false; duplicado: boolean; motivo: string }>;
  /** El espejo del saldo + `actualizado_en`. La mitad que Apple necesita. */
  marcarPase(a: { miembroId: string; saldo: number }): Promise<boolean>;
  /** El push a Apple / el PATCH a Google. La otra mitad. */
  avisarPase(miembroId: string): Promise<void>;
  /** Reclama el aviso. false = ya lo mandó otra corrida (o ya se mandó). */
  reclamarAviso(a: { miembroId: string; venceEl: string; saldo: number }): Promise<boolean>;
  /** El correo, uno solo. Nunca lanza. */
  enviarAviso(a: { miembroId: string; venceEl: string; saldo: number }): Promise<void>;
};

/** Qué terminó pasando con un miembro. */
export type ResultadoMiembro =
  | "nada"
  | "reiniciado"
  | "reinicio-repetido"
  | "avisado"
  | "aviso-repetido"
  | "pase-realineado"
  | "pase-fallido"
  | "fallo";

/**
 * UN MIEMBRO, de punta a punta.
 *
 * Exportada y sin base de datos adentro: es la función que las pruebas
 * miran para comprobar que el pase nunca se queda atrás.
 */
export async function atenderMiembro({
  miembro,
  regla,
  hoy,
  zona,
  acciones,
}: {
  miembro: MiembroConSellos;
  regla: ReglaSellos;
  /** Hoy, en la zona del NEGOCIO. */
  hoy: string;
  zona: string | null | undefined;
  acciones: AccionesVencimiento;
}): Promise<ResultadoMiembro> {
  const venceEl = fechaDeCorte({
    regla,
    ultimoMovimiento: miembro.ultimoMovimiento,
    zona,
  });
  const que: Veredicto = veredicto({ venceEl, hoy, saldo: miembro.saldo });

  if (que === "sin-regla" || que === "vigente") {
    // Aunque no le toque nada, el espejo puede haber quedado torcido
    // (una corrida anterior movió el ledger y no llegó a marcar el
    // pase). Realinearlo es barato y es la red que evita que un pase
    // se quede mintiendo para siempre.
    return (await realinearSiHaceFalta(miembro, acciones)) ? "pase-realineado" : "nada";
  }

  if (que === "por-vencer") {
    if (!venceEl) return "nada";
    // Se RECLAMA antes de mandar: un «¿ya se avisó? entonces no
    // aviso» tiene una ventana por la que pasan dos corridas y el
    // cliente recibe el correo dos veces.
    const mio = await acciones.reclamarAviso({
      miembroId: miembro.id,
      venceEl,
      saldo: miembro.saldo,
    });
    if (!mio) return "aviso-repetido";
    await acciones.enviarAviso({ miembroId: miembro.id, venceEl, saldo: miembro.saldo });
    return "avisado";
  }

  // ── Vencido: se reinicia ──────────────────────────────────────────
  if (!venceEl || regla.meses === null) return "nada";

  const res = await acciones.registrarReinicio({
    miembroId: miembro.id,
    sellos: miembro.saldo,
    motivo: motivoDeCorte(regla.meses),
    referencia: referenciaDeCorte(venceEl),
  });

  if (!res.ok && !res.duplicado) {
    console.error(`[vencimiento] No se pudo reiniciar a ${miembro.id}: ${res.motivo}`);
    return "fallo";
  }

  // ── Y EL TELÉFONO, SIEMPRE ────────────────────────────────────────
  // También cuando el insert vino `duplicado`: el ledger ya estaba en
  // cero, pero puede que la corrida que lo escribió se haya caído
  // JUSTO antes de tocar el pase. Marcar de nuevo no cuesta nada y es
  // lo único que cura ese caso.
  const marcado = await acciones.marcarPase({ miembroId: miembro.id, saldo: 0 });
  if (!marcado) {
    // No se avisa: empujar sin haber marcado gasta un push para que el
    // teléfono pregunte y se lleve un «no cambió nada». Se grita,
    // porque el ledger ya se movió y el pase quedó atrás.
    console.error(
      `[vencimiento] Los sellos de ${miembro.id} se reiniciaron pero su pase NO se pudo ` +
        `marcar como cambiado: el teléfono va a seguir mostrando el saldo viejo hasta la ` +
        `próxima corrida.`,
    );
    return "pase-fallido";
  }
  await acciones.avisarPase(miembro.id);

  return res.ok ? "reiniciado" : "reinicio-repetido";
}

/**
 * El espejo contra el ledger. Solo cuando el pase EXISTE y difiere:
 * marcar pases que no están o que ya coinciden sería empujar a Apple
 * todos los días por nada.
 */
async function realinearSiHaceFalta(
  miembro: MiembroConSellos,
  acciones: AccionesVencimiento,
): Promise<boolean> {
  if (miembro.saldoCache === null || miembro.saldoCache === miembro.saldo) return false;
  const marcado = await acciones.marcarPase({ miembroId: miembro.id, saldo: miembro.saldo });
  if (!marcado) return false;
  await acciones.avisarPase(miembro.id);
  return true;
}

// ── La corrida completa ──────────────────────────────────────────────

export type ResumenVencimiento = {
  /** Tarjetas de sellos con la regla encendida. */
  programas: number;
  /** Miembros mirados. */
  mirados: number;
  reiniciados: number;
  avisados: number;
  realineados: number;
  fallidos: number;
  nota?: string;
};

export type OpcionesVencimiento = {
  db?: Admin | null;
  ahora?: Date;
  acciones?: AccionesVencimiento;
};

/** «Esa columna no existe» — o sea, falta pegar la 0180. */
function faltaLaColumna(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    /column .* does not exist|could not find the .* column|relation .* does not exist/i.test(
      error.message ?? "",
    )
  );
}

/**
 * Una corrida: reinicia lo vencido y avisa lo que está por vencer.
 *
 * NUNCA lanza. Contesta 200 con una nota aunque no haya podido hacer
 * nada (sin llave de servicio, sin la 0180): un cron que devuelve error
 * todos los días por una migración que falta se vuelve ruido que nadie
 * mira, y el motivo viaja igual en la respuesta y en el log.
 */
export async function vencerSellosDelDia(
  opciones: OpcionesVencimiento = {},
): Promise<ResumenVencimiento> {
  const resumen: ResumenVencimiento = {
    programas: 0,
    mirados: 0,
    reiniciados: 0,
    avisados: 0,
    realineados: 0,
    fallidos: 0,
  };
  try {
    return await correr(opciones, resumen);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "Falló el barrido de vencimiento de sellos.";
    console.error("[vencimiento] La corrida se cayó:", e);
    return { ...resumen, nota: motivo };
  }
}

async function correr(
  opciones: OpcionesVencimiento,
  resumen: ResumenVencimiento,
): Promise<ResumenVencimiento> {
  // `"db" in opciones` y no `??`: mandar `db: null` a propósito
  // significa «no hay base», y con `??` se caería igual al cliente
  // real — que en una prueba sería una llamada de red de verdad.
  const db = "db" in opciones ? opciones.db : createAdminClient();
  if (!db) {
    return { ...resumen, nota: "No hay conexión de servicio (falta la llave de servicio)." };
  }

  const acciones = opciones.acciones ?? accionesReales(db);
  const ahora = opciones.ahora ?? new Date();

  // `select *` y no una lista de columnas: la 0180 la pega el dueño a
  // mano, y pedir `sellos_vencen_meses` por nombre haría fallar la
  // consulta ENTERA mientras no esté corrida — con el síntoma «no hay
  // programas», que manda a mirar justo donde no está el problema.
  const { data: filas, error } = await db.from("programa_lealtad").select("*");
  if (error) {
    return { ...resumen, nota: `No se pudieron leer las tarjetas: ${error.message}` };
  }

  const conRegla = ((filas ?? []) as Record<string, unknown>[])
    .map((fila) => ({ fila, regla: reglaDeFila(fila) }))
    .filter((x) => x.regla.meses !== null);
  resumen.programas = conRegla.length;
  if (conRegla.length === 0) return resumen;

  // La zona de cada negocio, de una sola consulta: «se venció» se
  // calcula en la hora del LOCAL, y hay negocios en ocho países.
  const ranchoIds = [
    ...new Set(
      conRegla
        .map((x) => x.fila.rancho_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const { data: ranchos } = await db
    .from("ranchos")
    .select("id, zona_horaria")
    .in("id", ranchoIds);
  const zonas = new Map<string, string | null>(
    (ranchos ?? []).map((r) => [r.id as string, (r.zona_horaria as string | null) ?? null]),
  );

  for (const { fila, regla } of conRegla) {
    const programaId = typeof fila.id === "string" ? fila.id : null;
    if (!programaId) continue;
    const zona = zonas.get(typeof fila.rancho_id === "string" ? fila.rancho_id : "") ?? null;
    const hoy = fechaISOEnZona(ahora, zona);

    const miembros = await miembrosDelPrograma(db, programaId);
    if (miembros === null) {
      resumen.nota = "No se pudieron leer los miembros de alguna tarjeta.";
      continue;
    }

    for (const miembro of miembros) {
      resumen.mirados++;
      const res = await atenderMiembro({ miembro, regla, hoy, zona, acciones });
      if (res === "reiniciado" || res === "reinicio-repetido") resumen.reiniciados++;
      else if (res === "avisado") resumen.avisados++;
      else if (res === "pase-realineado") resumen.realineados++;
      else if (res === "fallo" || res === "pase-fallido") resumen.fallidos++;
    }
  }

  return resumen;
}

/**
 * Los miembros de una tarjeta con su saldo, su último movimiento y el
 * espejo de su pase. null = no se pudo leer.
 *
 * El saldo se suma acá y no con una consulta por miembro: un programa
 * de mil clientes serían mil viajes a la base todos los días. El
 * ledger de una tarjeta de sellos es corto por naturaleza (un
 * movimiento por visita) y entra de una.
 */
async function miembrosDelPrograma(
  db: Admin,
  programaId: string,
): Promise<MiembroConSellos[] | null> {
  const { data: filas, error } = await db
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId);
  if (error) return null;

  const ids = (filas ?? [])
    .map((f) => f.id)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return [];

  const { data: movimientos, error: errorLedger } = await db
    .from("transacciones_puntos")
    .select("miembro_id, puntos, created_at")
    .in("miembro_id", ids);
  if (errorLedger) return null;

  const saldo = new Map<string, number>();
  const ultimo = new Map<string, string>();
  for (const m of movimientos ?? []) {
    const id = m.miembro_id as string;
    saldo.set(id, (saldo.get(id) ?? 0) + Number(m.puntos));
    const cuando = String(m.created_at);
    const previo = ultimo.get(id);
    if (!previo || cuando > previo) ultimo.set(id, cuando);
  }

  // El espejo del pase de Apple, para poder detectar el desalineado.
  // Un fallo acá NO frena el barrido: sin espejo simplemente no se
  // realinea nada, que es el comportamiento de antes de la 0180.
  const { data: pases } = await db
    .from("pases_wallet")
    .select("miembro_id, saldo_cache")
    .eq("plataforma", "apple")
    .eq("activo", true)
    .in("miembro_id", ids);
  const espejo = new Map<string, number>(
    (pases ?? []).map((p) => [p.miembro_id as string, Number(p.saldo_cache)]),
  );

  return ids.map((id) => ({
    id,
    saldo: saldo.get(id) ?? 0,
    ultimoMovimiento: ultimo.get(id) ?? null,
    saldoCache: espejo.has(id) ? (espejo.get(id) as number) : null,
  }));
}

/** Lo único de este archivo que toca Supabase, Apple y el correo. */
export function accionesReales(db: Admin): AccionesVencimiento {
  return {
    async registrarReinicio({ miembroId, sellos, motivo, referencia }) {
      const { error } = await db.from("transacciones_puntos").insert({
        miembro_id: miembroId,
        // 'ajuste' y no 'canjeado': el cliente no canjeó nada. El
        // CHECK de la 0060 solo exige que un ajuste sea distinto de
        // cero, y así el movimiento se lee por lo que es en la ficha.
        tipo: "ajuste",
        puntos: -Math.abs(sellos),
        motivo: motivo.slice(0, 200),
        referencia,
      });
      if (!error) return { ok: true };
      // 23505 = el índice único (miembro_id, referencia): este
      // vencimiento ya se aplicó. No es un error, es la idempotencia.
      return { ok: false, duplicado: error.code === "23505", motivo: error.message };
    },

    async marcarPase({ miembroId, saldo }) {
      // Las DOS columnas en el mismo update, y `actualizado_en` es la
      // que importa: sin ella el push llega, el iPhone pregunta «¿qué
      // cambió desde tal momento?» y la ruta le contesta 204. Solo
      // Apple — el espejo de Google lo escribe `google.ts`, y solo si
      // el PATCH entró de verdad (misma regla que `motor.ts`).
      const { error } = await db
        .from("pases_wallet")
        .update({ saldo_cache: saldo, actualizado_en: new Date().toISOString() })
        .eq("miembro_id", miembroId)
        .eq("plataforma", "apple");
      if (error) {
        console.error("[vencimiento] No se pudo marcar el pase:", error.message);
        return false;
      }
      return true;
    },

    async avisarPase(miembroId) {
      try {
        const { avisarCambioDePase } = await import("@/lib/wallet/servicio");
        await avisarCambioDePase(miembroId);
      } catch (e) {
        // El ledger ya se movió y el pase ya quedó marcado: el
        // teléfono lo va a buscar solo. Un push que no sale no puede
        // tumbar el barrido.
        console.warn("[vencimiento] No salió el aviso de pase actualizado:", e);
      }
    },

    async reclamarAviso({ miembroId, venceEl, saldo }) {
      const { error } = await db
        .from("avisos_vencimiento_sellos")
        .insert({ miembro_id: miembroId, vence_el: venceEl, saldo });
      if (!error) return true;
      if (error.code === "23505") return false; // ya se avisó: es la garantía
      if (faltaLaColumna(error)) {
        // Sin la tabla no hay forma de mandar UN solo correo, y mandar
        // sin idempotencia sería avisarle al mismo cliente todos los
        // días de la ventana. Se prefiere no avisar.
        console.error(
          "[vencimiento] No se avisó a nadie: falta pegar la migración 0180 " +
            "(avisos_vencimiento_sellos).",
        );
        return false;
      }
      console.error("[vencimiento] No se pudo reclamar el aviso:", error.message);
      return false;
    },

    async enviarAviso({ miembroId, venceEl, saldo }) {
      try {
        const { avisarSellosPorVencer } = await import("@/lib/correo/sellos-por-vencer");
        await avisarSellosPorVencer({ miembroId, venceEl, saldo });
      } catch (e) {
        console.warn("[vencimiento] No salió el correo de sellos por vencer:", e);
      }
    },
  };
}
