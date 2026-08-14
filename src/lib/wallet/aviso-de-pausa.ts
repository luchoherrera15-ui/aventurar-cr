import { createAdminClient } from "@/lib/supabase/admin";
import { minutoISOCR } from "@/lib/fechas";
import { estadoVisible, type EstadoVisible } from "@/lib/lealtad/programas";
import { avisarPaseActualizado } from "./apns";
import { credencialesDelEntorno } from "./firma";
import { credencialesGoogleDelEntorno, refrescarPaseGoogleDeMiembro } from "./google";
import { resumenDeFila } from "./programa-principal";

/**
 * EL AVISO DE LA PAUSA, EN EL TELÉFONO DEL CLIENTE.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO NO VIVE ADENTRO DEL WEBHOOK DE STRIPE
 * ------------------------------------------------------------------
 * Porque lo tumbaría. Cambiar el texto de un pase cuesta UNA llamada de
 * red por pase: a Apple un push vacío (y el teléfono vuelve a pedir el
 * pase), a Google un PATCH del objeto. Apagar un negocio de 1.150
 * miembros son 1.150 llamadas mientras Stripe espera respuesta — el
 * webhook se cae por tiempo, Stripe lo reintenta, y el reintento vuelve
 * a intentar las 1.150. El corte en sí (`pausarProgramasEn`, 0146) es
 * UN update de una fila y por eso sí puede vivir ahí; esto no.
 *
 * Así que el webhook pausa el programa —instantáneo, y con eso el
 * mostrador ya deja de sellar y de canjear— y el aviso a los teléfonos
 * lo empuja este trabajo, por tandas, desde el mismo cron de GitHub
 * Actions que ya usa el recordatorio horario.
 *
 * ------------------------------------------------------------------
 * LAS TRES PROPIEDADES, Y DE DÓNDE SALE CADA UNA
 * ------------------------------------------------------------------
 *
 * 1. REANUDABLE. No hay cursor ni estado de corrida: la pregunta que se
 *    hace cada tanda es «¿qué pase tiene todavía el texto que no le
 *    corresponde?». Si la corrida se corta en el pase 400, la siguiente
 *    hace la misma pregunta y le contestan 750. Un cursor guardado se
 *    puede desincronizar; esta pregunta no.
 *
 * 2. IDEMPOTENTE. La bandera `pases_wallet.pase_en_pausa` (0147) se
 *    RECLAMA con un update condicional ANTES de mandar nada —el patrón
 *    de siempre en este repo (0047, `llaveDeCanje` en 0137, el aviso
 *    previo de la 0146)—. Dos corridas simultáneas se reparten los
 *    pases sin que ninguno reciba el aviso dos veces, porque el update
 *    condicional lo resuelve Postgres con un lock de fila y no tiene la
 *    ventana que tiene un «¿ya se avisó? entonces no aviso».
 *
 * 3. CON RASTRO. Lo que falla vuelve a `pase_en_pausa` como estaba (o
 *    sea, se reintenta solo en la corrida siguiente) y deja el motivo
 *    en `pausa_error`. «¿Por qué este pase no se actualizó?» se
 *    contesta con un select, no leyendo logs de hace tres días.
 *
 * ------------------------------------------------------------------
 * VA EN LAS DOS DIRECCIONES, Y ESO NO ES SIMETRÍA DECORATIVA
 * ------------------------------------------------------------------
 * Si la vuelta no funcionara, el corte sería una trampa: un negocio que
 * renovó y está pagando, con doscientos clientes mirando «en pausa»
 * para siempre. La misma bandera y el mismo recorrido sirven para las
 * dos, con el destino invertido.
 */

export type Plataforma = "apple" | "google";

/** Qué le corresponde a un pase, mirando lo que muestra y lo que es. */
export type Direccion = "avisar" | "restaurar" | "nada";

/**
 * LA DECISIÓN, PURA.
 *
 * `paseEnPausa` es lo que ESTE pase muestra hoy; `estado` es lo que el
 * programa es de verdad.
 *
 * Los cuatro estados que no son ni `activo` ni `pausado` no se tocan, y
 * es a propósito:
 *
 *   · `borrador` y `programado` — todavía no emitieron nada;
 *   · `vencido` — la promoción se terminó por su propia fecha, que es
 *     algo que el cliente ya sabía al recibirla; decirle «en pausa»
 *     sería prometerle una vuelta que nadie planeó;
 *   · `archivado` — el negocio la cerró para siempre. Un pase que quedó
 *     con el aviso de pausa y después archivaron se queda con el aviso,
 *     que es lo más cerca de la verdad que hay: eso no vuelve.
 */
export function direccionDelPase(paseEnPausa: boolean, estado: EstadoVisible): Direccion {
  if (estado === "pausado") return paseEnPausa ? "nada" : "avisar";
  if (estado === "activo") return paseEnPausa ? "restaurar" : "nada";
  return "nada";
}

/**
 * Parte una lista en grupos.
 *
 * Existe por los ids de programa que van en el `in (…)` de la consulta:
 * PostgREST los manda en la URL, y una lista de trescientos uuid la
 * revienta. Con grupos de cincuenta, la consulta más larga son ~1,8 KB.
 */
export function enGrupos<T>(lista: readonly T[], tamano: number): T[][] {
  if (tamano < 1) return lista.length > 0 ? [[...lista]] : [];
  const grupos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) grupos.push(lista.slice(i, i + tamano));
  return grupos;
}

/** Las plataformas que este servidor PUEDE avisar ahora mismo. */
export function plataformasConfiguradas(): Plataforma[] {
  const lista: Plataforma[] = [];
  // Las dos leen variables de entorno y devuelven null en vez de tirar
  // (`firma.ts`, `google.ts`). Un servidor sin certificados no revienta
  // el cron: se salta esa plataforma entera y lo dice en el resumen.
  if (credencialesDelEntorno()) lista.push("apple");
  if (credencialesGoogleDelEntorno()) lista.push("google");
  return lista;
}

// ── Cuánto trabajo por corrida ───────────────────────────────────────
// Los números salen de dos límites reales:
//
//   · el techo de la función en Vercel (60 s acá): 8 tandas de 25 con
//     1,5 s de pausa entre ellas son ~12 s de espera más lo que tarde
//     la red, que deja margen de sobra;
//   · el ritmo de Apple y Google. Los 25 pases de Apple de una tanda
//     viajan por UNA sola conexión HTTP/2 (`avisarPaseActualizado`
//     reusa la conexión para todos los tokens), y Google va de a uno
//     porque cada objeto es un PATCH distinto.
//
// Con el cron cada 10 minutos son 1.200 pases por hora: el negocio más
// grande de hoy (1.150 miembros) queda avisado entero en una hora.

/** Pases por tanda. */
export const TAMANO_TANDA = 25;
/** La respiración entre tandas, para no golpear a Apple ni a Google. */
export const PAUSA_ENTRE_TANDAS_MS = 1_500;
/** Techo por corrida. Lo que sobre lo toma la corrida siguiente. */
export const MAX_POR_CORRIDA = 200;
/** Cuántos ids de programa entran en un `in (…)`. */
export const PROGRAMAS_POR_CONSULTA = 50;

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type ResumenPausa = {
  /** Programas encontrados en pausa. */
  programasEnPausa: number;
  /** Programas operando (los que pueden necesitar la vuelta). */
  programasOperando: number;
  /** Pases que pasaron a mostrar el aviso. */
  avisados: number;
  /** Pases que volvieron al texto normal. */
  restaurados: number;
  /** Pases que no se pudieron actualizar. El motivo queda en la fila. */
  fallidos: number;
  /** Las plataformas que este servidor pudo atender. */
  plataformas: Plataforma[];
  /** true = se agotó el presupuesto de la corrida y quedó trabajo. */
  quedaTrabajo: boolean;
  /** Cuando algo impidió trabajar (sin llaves, sin la 0147, sin base). */
  nota?: string;
};

export type OpcionesPausa = {
  db?: Admin | null;
  ahora?: Date;
  maxPorCorrida?: number;
  tamanoTanda?: number;
  pausaMs?: number;
  /** Inyectable para las pruebas: por defecto duerme de verdad. */
  dormir?: (ms: number) => Promise<void>;
};

const dormirDeVerdad = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms));

/** «Esa columna no existe» — o sea, falta correr la 0147. */
function faltaLaColumna(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(error.message ?? "")
  );
}

/**
 * Una corrida completa: avisa lo que haya que avisar y restaura lo que
 * haya que restaurar, hasta agotar el presupuesto.
 *
 * NUNCA lanza. Es un cron: lo peor que puede hacer es morirse callado y
 * dejar a los clientes con un texto que miente.
 */
export async function sincronizarAvisoDePausa(
  opciones: OpcionesPausa = {},
): Promise<ResumenPausa> {
  const resumen: ResumenPausa = {
    programasEnPausa: 0,
    programasOperando: 0,
    avisados: 0,
    restaurados: 0,
    fallidos: 0,
    plataformas: [],
    quedaTrabajo: false,
  };

  try {
    return await correr(opciones, resumen);
  } catch (e) {
    // La promesa del encabezado, cumplida acá: lo que no se previó sale
    // como una nota y no como un 500 que solo dice «error». Lo que ya
    // se avisó quedó marcado en la base, así que la corrida siguiente
    // sigue desde ahí.
    const motivo = e instanceof Error ? e.message : "Falló el barrido de pases en pausa.";
    console.error("[pausa-pase] La corrida se cayó:", e);
    return { ...resumen, nota: motivo };
  }
}

async function correr(opciones: OpcionesPausa, resumen: ResumenPausa): Promise<ResumenPausa> {
  // `"db" in opciones` y no `??`: mandar `db: null` a propósito
  // significa «no hay base», y con `??` se caería igual al cliente real
  // — que en una prueba sería una llamada de red de verdad.
  const db = "db" in opciones ? opciones.db : createAdminClient();
  if (!db) return { ...resumen, nota: "No hay conexión de servicio (falta la llave de servicio)." };

  // ── Sin llaves no se avisa, pero tampoco se revienta ───────────────
  // Un servidor sin los certificados de Apple ni la cuenta de servicio
  // de Google no tiene forma de tocar ningún pase. Se dice y se sale en
  // verde: el día que las variables estén, la corrida siguiente hace
  // todo el trabajo acumulado, porque la pregunta no depende del
  // tiempo.
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

  // ── Los programas, clasificados con la MISMA regla de siempre ──────
  // `select *` y no una lista de columnas: `estado` (0125) y las
  // vigencias (0136) pueden no existir, y pedirlas por nombre haría
  // fallar la consulta entera. `estadoVisible` ya sabe derivar el
  // estado del booleano `activo` de la 0060.
  const { data: filas, error } = await db.from("programa_lealtad").select("*");
  if (error) {
    return { ...resumen, nota: `No se pudieron leer los programas: ${error.message}` };
  }

  const ahora = opciones.ahora ?? new Date();
  const ahoraCR = minutoISOCR(ahora);
  const enPausa: string[] = [];
  const operando: string[] = [];
  for (const fila of (filas ?? []) as Record<string, unknown>[]) {
    const resumida = resumenDeFila(fila);
    if (!resumida.id) continue;
    const estado = estadoVisible(resumida, ahoraCR);
    if (estado === "pausado") enPausa.push(resumida.id);
    else if (estado === "activo") operando.push(resumida.id);
  }
  resumen.programasEnPausa = enPausa.length;
  resumen.programasOperando = operando.length;

  const presupuesto = { queda: opciones.maxPorCorrida ?? MAX_POR_CORRIDA };
  const comun = {
    db,
    plataformas,
    presupuesto,
    ahoraISO: ahora.toISOString(),
    tamanoTanda: opciones.tamanoTanda ?? TAMANO_TANDA,
    pausaMs: opciones.pausaMs ?? PAUSA_ENTRE_TANDAS_MS,
    dormir: opciones.dormir ?? dormirDeVerdad,
    resumen,
    fallados: new Set<string>(),
  };

  // Primero la IDA y después la VUELTA, y ese orden importa cuando el
  // presupuesto no alcanza para las dos: un cliente que ve «en pausa»
  // de más entiende mal por un rato; uno que sella sin que le sumen se
  // va con la sensación de que el negocio lo estafó.
  await recorrer({ ...comun, programas: enPausa, destino: true });
  await recorrer({ ...comun, programas: operando, destino: false });

  resumen.quedaTrabajo = presupuesto.queda <= 0;
  return resumen;
}

type Recorrido = {
  db: Admin;
  programas: string[];
  /** true = ponerle el aviso; false = sacárselo. */
  destino: boolean;
  plataformas: Plataforma[];
  presupuesto: { queda: number };
  ahoraISO: string;
  tamanoTanda: number;
  pausaMs: number;
  dormir: (ms: number) => Promise<void>;
  resumen: ResumenPausa;
  /**
   * Los que ya fallaron EN ESTA corrida. Como el fallo devuelve la
   * bandera, la consulta siguiente los volvería a traer y se
   * reintentarían dentro del mismo minuto — dos veces el mismo error y
   * el mismo pase contado dos veces en el resumen. Se reintentan en la
   * corrida siguiente, diez minutos después, cuando Apple o Google
   * quizá ya estén contestando.
   */
  fallados: Set<string>;
};

/** Un pase, con lo mínimo para avisarle. */
type PaseParaAvisar = {
  id: string;
  serialNumber: string;
  plataforma: Plataforma;
  miembroId: string;
};

async function recorrer(r: Recorrido): Promise<void> {
  if (r.programas.length === 0) return;

  for (const grupo of enGrupos(r.programas, PROGRAMAS_POR_CONSULTA)) {
    while (r.presupuesto.queda > 0) {
      const cuantos = Math.min(r.tamanoTanda, r.presupuesto.queda);

      // LA PREGUNTA ENTERA: pases vigentes, de una plataforma que este
      // servidor puede atender, de estos programas, cuya bandera
      // todavía no coincide con lo que corresponde. `!inner` hace que
      // el filtro sobre `miembros` recorte las filas de verdad y no
      // solo la representación.
      const { data, error } = await r.db
        .from("pases_wallet")
        .select("id, serial_number, plataforma, miembro_id, miembros!inner(programa_id)")
        .eq("activo", true)
        .eq("pase_en_pausa", !r.destino)
        .in("plataforma", r.plataformas)
        .in("miembros.programa_id", grupo)
        // LO QUE NUNCA FALLÓ VA PRIMERO. Un pase roto —un objeto de
        // Google que no existe, un teléfono con un token imposible— con
        // un id bajo se llevaría el principio de todas las tandas y
        // taparía a los 1.149 que sí se pueden avisar. Con esto se va
        // al final de la fila solo.
        .order("pausa_error", { ascending: true, nullsFirst: true })
        // Y desempate estable: sin él, dos tandas seguidas podrían
        // traer las mismas filas y la corrida no avanzaría nunca.
        .order("id", { ascending: true })
        .limit(cuantos);

      if (error) {
        if (faltaLaColumna(error)) {
          // Sin la bandera no hay idempotencia posible, y avisar sin
          // idempotencia es mandarle a la misma persona el mismo aviso
          // cada diez minutos para siempre. Se prefiere no avisar.
          console.error(
            "[pausa-pase] No se avisó ningún pase: falta correr la migración 0147 " +
              "(pases_wallet.pase_en_pausa).",
          );
          r.resumen.nota =
            "Falta correr la migración 0147 (pases_wallet.pase_en_pausa): no se avisó nada.";
          r.presupuesto.queda = 0;
          return;
        }
        console.error("[pausa-pase] No se pudieron leer los pases:", error.message);
        r.resumen.nota = `No se pudieron leer los pases: ${error.message}`;
        return;
      }

      const traidos = leerPases(data ?? []);
      if (traidos.length === 0) break; // este grupo de programas ya está al día

      // ANTI-VUELTAS: lo que ya falló en esta corrida no se reintenta
      // acá. Si la tanda entera era eso, no queda nada por hacer en
      // este grupo.
      const tanda = traidos.filter((p) => !r.fallados.has(p.id));
      if (tanda.length === 0) break;

      const hechos = await procesarTanda(r, tanda);
      r.presupuesto.queda -= tanda.length;

      // Y si NINGUNO entró, algo de afuera está caído: se corta el
      // grupo en vez de gastarle el presupuesto entero a un error que
      // se va a repetir igual.
      if (hechos === 0) break;

      if (r.presupuesto.queda > 0 && r.pausaMs > 0) await r.dormir(r.pausaMs);
    }
  }
}

/** La fila cruda de Supabase → lo que este módulo necesita. */
function leerPases(filas: unknown[]): PaseParaAvisar[] {
  const pases: PaseParaAvisar[] = [];
  for (const cruda of filas) {
    if (typeof cruda !== "object" || cruda === null) continue;
    const f = cruda as Record<string, unknown>;
    const plataforma = f.plataforma;
    if (
      typeof f.id !== "string" ||
      typeof f.serial_number !== "string" ||
      typeof f.miembro_id !== "string" ||
      (plataforma !== "apple" && plataforma !== "google")
    ) {
      continue;
    }
    pases.push({
      id: f.id,
      serialNumber: f.serial_number,
      plataforma,
      miembroId: f.miembro_id,
    });
  }
  return pases;
}

/**
 * Una tanda: se RECLAMA, se entrega, y lo que falló se devuelve.
 *
 * Devuelve cuántos quedaron efectivamente con el texto nuevo.
 */
async function procesarTanda(r: Recorrido, tanda: PaseParaAvisar[]): Promise<number> {
  // ── 1. El reclamo, ANTES de mandar nada ────────────────────────────
  // Un «leo y después escribo» tiene una ventana por la que pasan dos
  // corridas simultáneas, y el cliente recibe el mismo aviso dos veces.
  // El update condicional no la tiene.
  const { data: ganadas, error } = await r.db
    .from("pases_wallet")
    .update({ pase_en_pausa: r.destino, pausa_avisada_en: r.ahoraISO, pausa_error: null })
    .in(
      "id",
      tanda.map((p) => p.id),
    )
    .eq("pase_en_pausa", !r.destino)
    .select("id");

  if (error) {
    console.error("[pausa-pase] No se pudo reclamar la tanda:", error.message);
    r.resumen.nota = `No se pudo reclamar la tanda: ${error.message}`;
    return 0;
  }

  const reclamados = new Set((ganadas ?? []).map((g) => g.id as string));
  const propios = tanda.filter((p) => reclamados.has(p.id));
  if (propios.length === 0) return 0; // se los llevó otra corrida

  // ── 2. La entrega ──────────────────────────────────────────────────
  const fallidos: { id: string; motivo: string }[] = [];

  const deApple = propios.filter((p) => p.plataforma === "apple");
  if (deApple.length > 0) {
    const res = await entregarApple(r.db, deApple);
    if (!res.ok) {
      for (const p of deApple) fallidos.push({ id: p.id, motivo: res.motivo });
    }
  }

  for (const p of propios.filter((q) => q.plataforma === "google")) {
    // Uno por uno: cada objeto de Google es un PATCH distinto. Nunca
    // lanza, así que un pase roto no se lleva puesta la tanda.
    const res = await refrescarPaseGoogleDeMiembro(p.miembroId);
    if (!res.ok) fallidos.push({ id: p.id, motivo: res.motivo });
  }

  // ── 3. Lo que falló vuelve, con el motivo escrito ──────────────────
  if (fallidos.length > 0) {
    for (const f of fallidos) r.fallados.add(f.id);
    await devolver(r, fallidos);
  }

  const entraron = propios.length - fallidos.length;
  if (r.destino) r.resumen.avisados += entraron;
  else r.resumen.restaurados += entraron;
  r.resumen.fallidos += fallidos.length;

  console.log(
    `[pausa-pase] Tanda ${r.destino ? "de aviso" : "de vuelta"}: ` +
      `${entraron} de ${propios.length} (${fallidos.length} con problema).`,
  );

  return entraron;
}

/**
 * Devuelve la bandera y deja el motivo en la fila.
 *
 * Se agrupa por motivo porque una tanda puede fallar por dos razones
 * distintas —Apple no contesta y un objeto de Google no existe— y un
 * update por pase serían veinticinco escrituras para escribir el mismo
 * texto.
 */
async function devolver(r: Recorrido, fallidos: { id: string; motivo: string }[]): Promise<void> {
  const porMotivo = new Map<string, string[]>();
  for (const f of fallidos) {
    const clave = f.motivo.slice(0, 400);
    const ids = porMotivo.get(clave);
    if (ids) ids.push(f.id);
    else porMotivo.set(clave, [f.id]);
  }

  for (const [motivo, ids] of porMotivo) {
    const { error } = await r.db
      .from("pases_wallet")
      .update({ pase_en_pausa: !r.destino, pausa_error: motivo })
      .in("id", ids);
    if (error) {
      // Peor caso: el pase queda marcado como avisado sin estarlo. Se
      // grita, porque desde acá ya no se arregla solo.
      console.error(
        `[pausa-pase] ${ids.length} pase(s) quedaron marcados sin haberse avisado ` +
          `(no se pudo devolver la bandera): ${error.message}`,
      );
    }
  }
}

/**
 * Apple: UN push vacío por teléfono, y el teléfono vuelve a pedir el
 * pase a /api/wallet/v1/passes/… — que lo regenera con el texto nuevo
 * (`generarPaseDeLealtad` sabe emitir un programa pausado).
 *
 * Los tokens de la tanda entera van en UNA llamada a propósito:
 * `avisarPaseActualizado` abre una sola conexión HTTP/2 y la reusa para
 * todos. Veinticinco conexiones para veinticinco pases sería trabajo
 * regalado.
 */
async function entregarApple(
  db: Admin,
  pases: PaseParaAvisar[],
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data: registros, error } = await db
    .from("registros_dispositivo")
    .select("push_token")
    .in(
      "serial_number",
      pases.map((p) => p.serialNumber),
    );

  if (error) {
    return { ok: false, motivo: `No se pudieron leer los dispositivos: ${error.message}` };
  }

  const tokens = [...new Set((registros ?? []).map((x) => x.push_token as string))];
  // Un pase sin ningún teléfono registrado NO es un fallo: no hay a
  // quién avisarle. El texto nuevo le llega igual la próxima vez que
  // ese iPhone pregunte por su cuenta, que es lo que hace solo.
  if (tokens.length === 0) return { ok: true };

  const res = await avisarPaseActualizado(tokens);
  if (!res.ok) return { ok: false, motivo: res.motivo };

  // Un 410 es un teléfono que borró el pase. Dejarlo en la tabla hace
  // que cada corrida futura le insista en vano.
  if (res.caducados.length > 0) {
    await db.from("registros_dispositivo").delete().in("push_token", res.caducados);
  }
  return { ok: true };
}
