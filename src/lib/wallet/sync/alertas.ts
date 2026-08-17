import { motivoSeguro } from "./adaptador-apple";
import type { EstadoPresencia } from "../config/inventario";

/**
 * ETAPA 17 (Wallet V2) — alertas del worker de sincronización.
 *
 * TODO ACÁ ES PURO: cada función recibe estado YA CONSULTADO (números,
 * booleanos, fechas — nunca un cliente de base ni un `fetch`) y
 * devuelve un `Alerta | null`, o una lista. Ninguna función de este
 * archivo abre una conexión, hace una llamada de red, ni manda nada a
 * nadie — "implementar alertas" en esta etapa es decidir CUÁNDO algo
 * amerita un aviso y CÓMO describirlo sin secretos, no repartirlo.
 *
 * ------------------------------------------------------------------
 * CÓMO SE ENCADENARÍA CON ENTREGA REAL (sin wirearlo — fuera de
 * alcance de esta etapa)
 * ------------------------------------------------------------------
 * Este repo YA tiene un mecanismo de aviso a administradores:
 * `avisarAAdministradores({ subject, html })` (`src/lib/correo/
 * administradores.ts`), que junta los correos de `perfiles.rol =
 * 'admin'` + `BOOKEA_CORREO_PEDIDOS` y manda por Resend
 * (`src/lib/email.ts`) — el mismo camino que ya usan los avisos de
 * pedidos de invitación y de mensajes. El plan natural para un futuro
 * cron de "wallet:alertas" sería:
 *
 *   1. Consultar el estado real (contar retryable/dead en
 *      wallet_sincronizaciones, leer wallet_v2_diagnostico_sincronizacion
 *      de 0168, correr `validarApple()`/`presenciaEnEntorno()`, etc.)
 *   2. Armar `EstadoParaAlertasWalletV2` con esos números.
 *   3. Llamar `evaluarAlertasWalletV2(estado)` (acá abajo) — puro,
 *      sin red.
 *   4. Si `alertas.length > 0`, armar UN `subject`/`html` (agrupando
 *      por severidad) y llamar `avisarAAdministradores({...})` —
 *      recién ahí sale algo por la red. Ningún paso de acá adentro lo
 *      hace.
 *
 * Nada de eso se construye en esta etapa: ni el cron, ni el paso 4.
 *
 * ------------------------------------------------------------------
 * "NUNCA UN SECRETO EN LA SALIDA" — cómo se sostiene, no solo se dice
 * ------------------------------------------------------------------
 * Ninguna función de acá abajo acepta un push_token, un auth_token, un
 * certificado o una llave como parámetro — no hay from donde sacar un
 * secreto para filtrar. El único lugar donde entra texto libre que
 * podría, en teoría, traer algo pegado (el motivo de un error de
 * Google, o de una excepción) se pasa por `motivoSeguro()` (el mismo
 * helper de `adaptador-apple.ts`, reusado acá tal cual — nunca
 * reimplementado) antes de entrar al `mensaje`/`contexto` de la
 * alerta. Los llamadores ya deberían pasar texto sanitizado
 * (`clasificarMotivoGoogle`/`sanitizarMotivo` en adaptador-google.ts,
 * `motivoSeguro` en adaptador-apple.ts) — esto es la MISMA defensa en
 * profundidad que ya se aplicó en la vista de diagnóstico (0168): no
 * confiar en que el único camino de hoy sea el único de mañana.
 */

// ── El contrato compartido ──────────────────────────────────────────

export type SeveridadAlerta = "info" | "advertencia" | "critica";

export type TipoAlerta =
  | "jobs_retryable_acumulados"
  | "jobs_dead"
  | "apns_rechazados"
  | "google_auth_error"
  | "certificado_proximo_a_vencer"
  | "secreto_hmac_faltante"
  | "registro_apple_sin_actividad"
  | "version_pase_divergente"
  | "payload_google_divergente";

/**
 * Una alerta ya evaluada, lista para agruparse en un aviso. `contexto`
 * es SIEMPRE JSON-serializable y SIEMPRE libre de secretos — son los
 * mismos números/fechas que entraron a la función, no una copia del
 * estado interno.
 */
export interface Alerta {
  tipo: TipoAlerta;
  severidad: SeveridadAlerta;
  mensaje: string;
  contexto: Record<string, unknown>;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function diasEntre(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / MS_POR_DIA);
}

// ── 1. Jobs retryable acumulados ────────────────────────────────────

/**
 * Un lote lleno (`LOTE_MAXIMO` en worker.ts) de trabajos esperando
 * reintento es la señal de que el worker no está dando abasto (o algo
 * está fallando en cadena) — no una fila puntual reintentando, que es
 * el funcionamiento normal del backoff.
 */
export const UMBRAL_JOBS_RETRYABLE_ACUMULADOS = 20;

export function chequearJobsRetryablesAcumulados(
  cantidad: number,
  umbral: number = UMBRAL_JOBS_RETRYABLE_ACUMULADOS,
): Alerta | null {
  if (cantidad < umbral) return null;
  return {
    tipo: "jobs_retryable_acumulados",
    severidad: "advertencia",
    mensaje: `${cantidad} trabajos de sincronización están en 'retryable' (umbral: ${umbral}) — el worker no está drenando la cola al ritmo esperado.`,
    contexto: { cantidad, umbral },
  };
}

// ── 2. Jobs dead ─────────────────────────────────────────────────────

/**
 * `dead` es un fallo PERMANENTE — worker.ts ya decidió que reintentar
 * no lo va a arreglar solo (credenciales ausentes, pase/trabajo mal
 * enrutado, o `max_intentos` agotado). Cualquier fila así es, por
 * definición, un pase que dejó de recibir sus actualizaciones sin que
 * nada automático lo vuelva a intentar — el umbral por defecto es 1:
 * no hay una cantidad "normal" de trabajos muertos.
 */
export const UMBRAL_JOBS_DEAD = 1;

export function chequearJobsMuertos(cantidad: number, umbral: number = UMBRAL_JOBS_DEAD): Alerta | null {
  if (cantidad < umbral) return null;
  return {
    tipo: "jobs_dead",
    severidad: "critica",
    mensaje: `${cantidad} trabajo(s) de sincronización quedaron 'dead' (fallo permanente) — ese/esos pase(s) no se van a actualizar solos.`,
    contexto: { cantidad, umbral },
  };
}

// ── 3. APNs rechazados (tasa sobre una ventana) ─────────────────────

/**
 * Con pocas muestras, una tasa alta no dice nada (1 de 1 = 100%, y es
 * ruido). `muestraMinima` evita alertar sobre eso — solo se evalúa la
 * tasa cuando hubo al menos esa cantidad de intentos en la ventana.
 */
export const UMBRAL_TASA_APNS_RECHAZADOS = 0.2; // 20%
export const MUESTRA_MINIMA_APNS = 5;

export function chequearApnsRechazados(
  estado: { intentos: number; rechazados: number; ventanaMinutos: number },
  opts: { umbralTasa?: number; muestraMinima?: number } = {},
): Alerta | null {
  const umbralTasa = opts.umbralTasa ?? UMBRAL_TASA_APNS_RECHAZADOS;
  const muestraMinima = opts.muestraMinima ?? MUESTRA_MINIMA_APNS;
  if (estado.intentos < muestraMinima) return null;

  const tasa = estado.rechazados / estado.intentos;
  if (tasa < umbralTasa) return null;

  return {
    tipo: "apns_rechazados",
    severidad: "critica",
    mensaje: `APNs rechazó ${estado.rechazados} de ${estado.intentos} envíos en los últimos ${estado.ventanaMinutos} minutos (${Math.round(tasa * 100)}%, umbral ${Math.round(umbralTasa * 100)}%) — revisar certificado/credenciales de Apple.`,
    contexto: { ...estado, tasa, umbralTasa },
  };
}

// ── 4. Google auth error (cualquiera) ───────────────────────────────

/**
 * Un 401 de Google (`clasificarMotivoGoogle`, adaptador-google.ts) ya
 * se clasifica `dead` en el worker — pero además de que el trabajo
 * puntual muera, un 401 dice algo sobre la CONFIGURACIÓN completa
 * (credencial revocada, Issuer mal autorizado): amerita un aviso
 * aparte, no solo el conteo genérico de `jobs_dead`. "any" (spec): un
 * solo 401 ya alerta, sin umbral.
 */
export function chequearGoogleAuthError(estado: { hubo401: boolean; detalle?: string }): Alerta | null {
  if (!estado.hubo401) return null;
  const detalleSeguro = estado.detalle ? motivoSeguro(estado.detalle) : null;
  return {
    tipo: "google_auth_error",
    severidad: "critica",
    mensaje: `Google Wallet rechazó la credencial (401)${detalleSeguro ? `: ${detalleSeguro}` : "."} — revisar GOOGLE_WALLET_SA_KEY_B64 / autorización del Issuer.`,
    contexto: detalleSeguro ? { detalle: detalleSeguro } : {},
  };
}

// ── 5. Certificado de Apple próximo a vencer ────────────────────────

/**
 * REUSA, no reimplementa: el parseo real del certificado (PEM,
 * `node-forge`, `cert.validity.notAfter`) ya vive en
 * `validarApple()`/`certificadoVigente()` (src/lib/wallet/config/
 * apple.ts, src/lib/wallet/firma.ts) y en `scripts/wallet-doctor.ts`
 * (que imprime `venceEl` con esa misma fecha). Esta función NUNCA
 * toca un PEM ni `node-forge` — recibe `venceEl` YA CALCULADO (por
 * ejemplo `validarApple().profundidad?.vigencia.venceEl`) y solo hace
 * la aritmética de "¿cuántos días faltan?, ¿es esto un problema?".
 */
export const UMBRAL_DIAS_CERTIFICADO_PROXIMO_A_VENCER = 30;

export function chequearCertificadoProximoAVencer(
  estado: { venceEl: string | null },
  umbralDias: number = UMBRAL_DIAS_CERTIFICADO_PROXIMO_A_VENCER,
  ahora: Date = new Date(),
): Alerta | null {
  if (!estado.venceEl) return null; // sin dato: no es "sin vencer", es "no verificable" — no se inventa una alerta
  const vence = new Date(estado.venceEl);
  if (Number.isNaN(vence.getTime())) return null;

  const dias = diasEntre(ahora, vence);
  if (dias < 0) {
    return {
      tipo: "certificado_proximo_a_vencer",
      severidad: "critica",
      mensaje: `El certificado de Apple Wallet YA VENCIÓ (${estado.venceEl}) — los pases de Apple van a dejar de firmarse.`,
      contexto: { venceEl: estado.venceEl, diasRestantes: dias },
    };
  }
  if (dias > umbralDias) return null;

  return {
    tipo: "certificado_proximo_a_vencer",
    severidad: "advertencia",
    mensaje: `El certificado de Apple Wallet vence en ${dias} día(s) (${estado.venceEl}, umbral ${umbralDias}) — renovarlo en el portal de Apple Developer.`,
    contexto: { venceEl: estado.venceEl, diasRestantes: dias, umbralDias },
  };
}

// ── 6. Secreto HMAC faltante ─────────────────────────────────────────

const VARIABLE_HMAC = "APPLE_PASS_AUTH_SECRET_V1";

/**
 * `APPLE_PASS_AUTH_SECRET_V1` es, a propósito, OPCIONAL en el
 * inventario (`presenciaEnEntorno()`, src/lib/wallet/config/
 * inventario.ts — Fase 2C): su ausencia es un estado VÁLIDO mientras
 * ningún pase use `auth_token_version >= 1` (el 100% de los pases
 * hoy son legacy, versión 0, con su token guardado en claro). Alertar
 * cada vez que falta, sin condición, sería ruido permanente en
 * cualquier entorno que todavía no migró ningún pase a HMAC.
 *
 * La alerta real es más angosta: falta el secreto Y YA HAY pases que
 * lo necesitan (`auth_token_version >= 1`) — ESE es el estado
 * genuinamente roto (esos pases no pueden autenticar su próxima
 * consulta al Web Service sin el secreto para recalcular su token).
 * `hayPasesConVersionHmac` es la única pieza que esta función no
 * puede resolver sola (necesita una consulta a `pases_wallet`); todo
 * lo demás sale de `presenciaEnEntorno()`, reusada tal cual.
 */
export function chequearSecretoHmacFaltante(
  estadosPresencia: EstadoPresencia[],
  hayPasesConVersionHmac: boolean,
): Alerta | null {
  const entrada = estadosPresencia.find((e) => e.variable === VARIABLE_HMAC);
  const falta = !entrada || !entrada.presente;
  if (!falta || !hayPasesConVersionHmac) return null;

  return {
    tipo: "secreto_hmac_faltante",
    severidad: "critica",
    mensaje: `${VARIABLE_HMAC} no está configurada, pero ya existen pases de Apple con auth_token_version >= 1 que dependen de ella — esos pases no van a poder autenticar su próxima consulta al Web Service.`,
    contexto: { variable: VARIABLE_HMAC, hayPasesConVersionHmac },
  };
}

// ── 7. Registro Apple sin actividad ─────────────────────────────────

/**
 * "Registrado" pero "mudo": hay un `registros_dispositivo` para este
 * pase, pero ni una (re)registración reciente ni una descarga
 * confirmada del .pkpass (`pases_wallet.ultima_descarga_en`, 0151) en
 * los últimos `umbralDias`. Ninguna de las dos señales por sí sola es
 * concluyente (un dueño puede no cambiar el pase en semanas y es
 * normal) — se usa la MÁS RECIENTE de las dos como "última señal de
 * vida" antes de decidir.
 */
export const UMBRAL_DIAS_REGISTRO_APPLE_SIN_ACTIVIDAD = 30;

export function chequearRegistroAppleSinActividad(
  estado: {
    dispositivosRegistrados: number;
    dispositivoUltimoRegistroEn: string | null;
    paseUltimaDescargaEn: string | null;
  },
  umbralDias: number = UMBRAL_DIAS_REGISTRO_APPLE_SIN_ACTIVIDAD,
  ahora: Date = new Date(),
): Alerta | null {
  if (estado.dispositivosRegistrados <= 0) return null; // nada registrado: no aplica esta alerta

  const candidatas = [estado.dispositivoUltimoRegistroEn, estado.paseUltimaDescargaEn]
    .filter((f): f is string => !!f)
    .map((f) => new Date(f).getTime())
    .filter((t) => !Number.isNaN(t));

  // Registrado pero SIN ninguna fecha de actividad utilizable: la
  // señal más conservadora es "sin actividad desde siempre".
  const ultimaActividad = candidatas.length > 0 ? new Date(Math.max(...candidatas)) : null;
  const dias = ultimaActividad ? diasEntre(ultimaActividad, ahora) : Number.POSITIVE_INFINITY;

  if (dias < umbralDias) return null;

  return {
    tipo: "registro_apple_sin_actividad",
    severidad: "advertencia",
    mensaje: `Hay ${estado.dispositivosRegistrados} dispositivo(s) Apple registrado(s) sin actividad confirmada en ${Number.isFinite(dias) ? `${dias} día(s)` : "ningún momento registrado"} (umbral ${umbralDias}) — puede ser un push que dejó de llegar.`,
    contexto: {
      dispositivosRegistrados: estado.dispositivosRegistrados,
      ultimaActividadEn: ultimaActividad?.toISOString() ?? null,
      diasSinActividad: Number.isFinite(dias) ? dias : null,
      umbralDias,
    },
  };
}

// ── 8. Pase con versión local distinta de la entregada ──────────────

/**
 * `pases_wallet.update_tag` (versión LOCAL actual) vs.
 * `version_local_esperada` del último job `succeeded` de ese pase (la
 * versión REALMENTE confirmada como entregada — ver la nota de
 * "versión entregada" en 0168, `wallet_v2_diagnostico_sincronizacion`,
 * que es de donde sale este número en la práctica). Si no coinciden,
 * el pase cambió de nuevo DESPUÉS del último envío confirmado y ese
 * cambio todavía no salió (o el intento que lo llevaba sigue
 * pending/retryable/dead).
 */
export function chequearVersionPaseDivergente(estado: {
  paseId: string;
  updateTagActual: number;
  versionUltimoJobExitoso: number | null;
}): Alerta | null {
  if (estado.versionUltimoJobExitoso === null) return null; // todavía ningún envío confirmado: no es divergencia, es "recién nace"
  if (estado.updateTagActual === estado.versionUltimoJobExitoso) return null;

  return {
    tipo: "version_pase_divergente",
    severidad: "advertencia",
    mensaje: `El pase ${estado.paseId} está en la versión local ${estado.updateTagActual}, pero la última entrega confirmada fue la versión ${estado.versionUltimoJobExitoso} — hay un cambio todavía no confirmado como entregado.`,
    contexto: {
      paseId: estado.paseId,
      updateTagActual: estado.updateTagActual,
      versionUltimoJobExitoso: estado.versionUltimoJobExitoso,
    },
  };
}

// ── 9. Payload de Google local distinto del remoto ──────────────────

/**
 * `pases_wallet.google_ultimo_payload_hash` (agregado en 0165) existe
 * en el ESQUEMA, pero ningún código de `src/` lo escribe todavía
 * (confirmado: cero referencias a esa columna fuera de la migración
 * que la crea) — así que hoy no hay ni un hash local que comparar ni
 * un mecanismo para traer el hash remoto. Esta función queda lista
 * para el día en que ambos existan: recibe los dos hashes YA
 * CALCULADOS (nunca calcula nada acá — ni JSON canónico ni SHA-256) y
 * solo compara. Con cualquiera de los dos ausentes, no hay base para
 * alertar (no es lo mismo "no sabemos" que "no coincide").
 */
export function chequearPayloadGoogleDivergente(estado: {
  paseId: string;
  hashLocal: string | null;
  hashRemoto: string | null;
}): Alerta | null {
  if (!estado.hashLocal || !estado.hashRemoto) return null;
  if (estado.hashLocal === estado.hashRemoto) return null;

  return {
    tipo: "payload_google_divergente",
    severidad: "advertencia",
    mensaje: `El pase de Google ${estado.paseId} tiene un payload local distinto del último confirmado por Google — puede haber un cambio que no llegó, o un PATCH que otro proceso pisó.`,
    contexto: { paseId: estado.paseId },
  };
}

// ── El agregador — para el futuro cron, sin mandar nada ─────────────

/** Todo el estado ya consultado que necesitan las 9 comprobaciones. Cada campo es opcional: falta uno, esa comprobación se salta (no revienta). */
export interface EstadoParaAlertasWalletV2 {
  jobsRetryablesAcumulados?: number;
  jobsMuertos?: number;
  apns?: { intentos: number; rechazados: number; ventanaMinutos: number };
  googleAuthError?: { hubo401: boolean; detalle?: string };
  certificadoApple?: { venceEl: string | null };
  presenciaEntorno?: EstadoPresencia[];
  hayPasesConVersionHmac?: boolean;
  registrosAppleSinActividad?: Array<{
    dispositivosRegistrados: number;
    dispositivoUltimoRegistroEn: string | null;
    paseUltimaDescargaEn: string | null;
  }>;
  pasesConVersionDivergente?: Array<{ paseId: string; updateTagActual: number; versionUltimoJobExitoso: number | null }>;
  pasesGoogleConPayloadDivergente?: Array<{ paseId: string; hashLocal: string | null; hashRemoto: string | null }>;
}

/**
 * Corre las 9 comprobaciones sobre un estado ya consultado y devuelve
 * SOLO las que dispararon. Sigue siendo pura — no manda nada, no lee
 * nada; es la función que un futuro cron llamaría justo antes del
 * paso 4 descrito en el comentario de cabecera (armar `subject`/`html`
 * y llamar `avisarAAdministradores`).
 */
export function evaluarAlertasWalletV2(estado: EstadoParaAlertasWalletV2, ahora: Date = new Date()): Alerta[] {
  const alertas: Alerta[] = [];

  if (estado.jobsRetryablesAcumulados !== undefined) {
    const a = chequearJobsRetryablesAcumulados(estado.jobsRetryablesAcumulados);
    if (a) alertas.push(a);
  }
  if (estado.jobsMuertos !== undefined) {
    const a = chequearJobsMuertos(estado.jobsMuertos);
    if (a) alertas.push(a);
  }
  if (estado.apns) {
    const a = chequearApnsRechazados(estado.apns);
    if (a) alertas.push(a);
  }
  if (estado.googleAuthError) {
    const a = chequearGoogleAuthError(estado.googleAuthError);
    if (a) alertas.push(a);
  }
  if (estado.certificadoApple) {
    const a = chequearCertificadoProximoAVencer(estado.certificadoApple, undefined, ahora);
    if (a) alertas.push(a);
  }
  if (estado.presenciaEntorno) {
    const a = chequearSecretoHmacFaltante(estado.presenciaEntorno, estado.hayPasesConVersionHmac ?? false);
    if (a) alertas.push(a);
  }
  for (const registro of estado.registrosAppleSinActividad ?? []) {
    const a = chequearRegistroAppleSinActividad(registro, undefined, ahora);
    if (a) alertas.push(a);
  }
  for (const pase of estado.pasesConVersionDivergente ?? []) {
    const a = chequearVersionPaseDivergente(pase);
    if (a) alertas.push(a);
  }
  for (const pase of estado.pasesGoogleConPayloadDivergente ?? []) {
    const a = chequearPayloadGoogleDivergente(pase);
    if (a) alertas.push(a);
  }

  return alertas;
}
