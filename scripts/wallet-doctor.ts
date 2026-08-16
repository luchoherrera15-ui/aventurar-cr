#!/usr/bin/env -S npx tsx
/**
 * `npm run wallet:doctor -- --offline`
 * `npm run wallet:doctor -- --remote`
 *
 * Diagnóstico de la configuración de Wallet (Apple + Google), FASE 1 de
 * la reconstrucción (docs/wallet-v2/auditoria-inicial.md). Reemplaza al
 * chequeo parcial de `lealtad-secciones.tsx` (revisaba 3 de 5 variables
 * de Apple y ninguna de Google) y al script suelto `tmp-diag-apns.mjs`
 * (que abría una conexión real a Apple con un token hardcodeado).
 *
 * --offline: solo formatos, certificados, correspondencias, rutas de
 *   archivo y presencia de variables. CERO llamadas de red, CERO
 *   escritura. Seguro de correr en cualquier momento, contra cualquier
 *   .env.local.
 *
 * --remote: además, hace llamadas de SOLO LECTURA reales — a Google
 *   Wallet (listar clases del issuer, para confirmar autorización) y al
 *   propio Web Service público de Apple (para confirmar que la URL
 *   responde). Nunca crea, registra ni modifica nada real.
 *
 * REGLA DE SEGURIDAD: este script nunca imprime el valor de una
 * variable de entorno, un certificado o una llave — ni siquiera
 * parcialmente, ni codificado. Solo nombres, presencia, formato,
 * longitudes y huellas SHA-256 truncadas.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validarApple } from "../src/lib/wallet/config/apple";
import { validarGoogleOffline, validarGoogleRemoto } from "../src/lib/wallet/config/google";
import { presenciaEnEntorno } from "../src/lib/wallet/config/inventario";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

function cargarDotEnvLocal() {
  const ruta = join(RAIZ, ".env.local");
  if (!existsSync(ruta)) return;
  const contenido = readFileSync(ruta, "utf8");
  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const igual = limpia.indexOf("=");
    if (igual === -1) continue;
    const nombre = limpia.slice(0, igual).trim();
    let valor = limpia.slice(igual + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!(nombre in process.env)) process.env[nombre] = valor;
  }
}

const modo = process.argv.includes("--remote") ? "remote" : process.argv.includes("--offline") ? "offline" : null;
if (!modo) {
  console.error("Uso: npm run wallet:doctor -- --offline   (o --remote)");
  process.exit(2);
}

cargarDotEnvLocal();

const OK = "✅";
const ERROR = "❌";
const AVISO = "⚠️ ";
const NV = "◌ ";

let huboError = false;
const accionesHumanas: string[] = [];
const advertencias: string[] = [];

function linea(icono: string, texto: string) {
  console.log(`${icono} ${texto}`);
}

console.log(`\n=== wallet:doctor — modo ${modo === "offline" ? "OFFLINE (sin red)" : "REMOTE (con llamadas de solo lectura)"} ===\n`);

// ── 1. Inventario de presencia ──────────────────────────────────────
console.log("--- Variables de entorno ---");
for (const p of presenciaEnEntorno()) {
  if (p.presente) {
    linea(OK, `${p.variable}: presente`);
  } else if (p.obligatoria) {
    linea(ERROR, `${p.variable}: FALTA`);
    huboError = true;
  } else {
    // Fase 2C: opcional (ej. APPLE_PASS_AUTH_SECRET_V1) — su ausencia
    // es un estado válido (fallback a legacy), no un error. Se informa
    // igual, para que "informa claramente si falta" no dependa de leer
    // el código — pero sin tumbar el resultado del doctor.
    linea(NV, `${p.variable}: no configurada (opcional — ver docs/wallet-v2/fase-2c-resultado.md §5)`);
  }
}
console.log();

// ── 2. Apple ─────────────────────────────────────────────────────────
console.log("--- Apple Wallet ---");
const apple = validarApple();
linea(apple.estado === "ok" ? OK : ERROR, `Apple credentials: ${apple.estado === "ok" ? "OK" : apple.estado.toUpperCase()}`);
for (const v of apple.variables) {
  if (v.presente && !v.formatoOk) linea(ERROR, `  ${v.nombre}: ${v.motivoError}`);
}
if (apple.profundidad) {
  const p = apple.profundidad;
  linea(p.certificadoVsLlave.ok ? OK : ERROR, `Certificate/key match: ${p.certificadoVsLlave.ok ? "coinciden" : p.certificadoVsLlave.motivo}`);
  linea(
    p.certificadoVsPassTypeId.ok === true ? OK : p.certificadoVsPassTypeId.ok === "no_verificable" ? NV : ERROR,
    `Pass Type ID match: ${p.certificadoVsPassTypeId.ok === true ? "coincide" : p.certificadoVsPassTypeId.ok === "no_verificable" ? "no verificable desde el certificado" : p.certificadoVsPassTypeId.motivo}`,
  );
  linea(
    p.certificadoVsTeamId.ok === true ? OK : p.certificadoVsTeamId.ok === "no_verificable" ? NV : ERROR,
    `Team ID match: ${p.certificadoVsTeamId.ok === true ? "coincide" : p.certificadoVsTeamId.ok === "no_verificable" ? "no verificable desde el certificado" : p.certificadoVsTeamId.motivo}`,
  );
  linea(p.cadenaCertificadoWwdr.ok ? OK : ERROR, `Certificate chain (WWDR): ${p.cadenaCertificadoWwdr.ok ? "válida" : p.cadenaCertificadoWwdr.motivo}`);
  linea(p.vigencia.ok ? OK : ERROR, `Certificate expiration: vence ${p.vigencia.venceEl ?? "?"}${p.vigencia.ok ? "" : ` — ${p.vigencia.motivo}`}`);
  linea(p.firmaDePrueba.ok ? OK : ERROR, `Firma de prueba: ${p.firmaDePrueba.ok ? "la mecánica de firma no lanzó" : p.firmaDePrueba.motivo}`);
  console.log(`   huella certificado: ${p.huellaCertificadoSha256}   huella llave: ${p.huellaLlaveSha256}`);
  console.log(`   emisor: ${p.emisorCertificado ?? "?"}`);
}
if (apple.estado !== "ok") huboError = true;
accionesHumanas.push(...apple.accionesHumanas);

const passTypeId = process.env.APPLE_PASS_TYPE_ID?.trim();
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat").replace(/^https:\/\/bookea\.lat(?=\/|$)/, "https://www.bookea.lat");
const webServiceUrl = `${siteUrl}/api/wallet`;
linea(OK, `Web Service URL: ${webServiceUrl}`);
if (webServiceUrl.includes("//api") === false && webServiceUrl.match(/([^:])\/\//)) {
  advertencias.push(`webServiceURL parece tener una barra doble: ${webServiceUrl}`);
}
console.log();

// ── 3. Google ────────────────────────────────────────────────────────
console.log("--- Google Wallet ---");
const google = validarGoogleOffline();
linea(google.estado === "ok" ? OK : ERROR, `Google credentials: ${google.estado === "ok" ? "OK" : google.estado.toUpperCase()}`);
for (const v of google.variables) {
  if (v.presente && !v.formatoOk) linea(ERROR, `  ${v.nombre}: ${v.motivoError}`);
}
if (google.cuentaDeServicio) {
  const c = google.cuentaDeServicio;
  console.log(`   project_id: ${c.projectId ?? "?"}`);
  console.log(`   client_email: ${c.clientEmail ?? "?"}`);
  linea(c.clientEmailPareceValido ? OK : AVISO, `client_email con forma de cuenta de servicio: ${c.clientEmailPareceValido ? "sí" : "no"}`);
  linea(c.privateKeyEsPemValido ? OK : ERROR, `private_key con forma de PEM válido: ${c.privateKeyEsPemValido ? "sí" : "no"}`);
}
if (google.estado !== "ok") huboError = true;
accionesHumanas.push(...google.accionesHumanas);
console.log();

// ── 4. Esquema de base de datos y rutas requeridas (offline: solo archivos) ──
console.log("--- Esquema y rutas ---");
const RUTAS_REQUERIDAS = [
  "src/app/api/wallet/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts",
  "src/app/api/wallet/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts",
  "src/app/api/wallet/v1/passes/[passTypeId]/[serial]/route.ts",
  "src/app/api/wallet/v1/log/route.ts",
  "src/app/api/pases/[ranchoId]/route.ts",
  "src/app/api/pases-google/[ranchoId]/route.ts",
];
for (const ruta of RUTAS_REQUERIDAS) {
  const existe = existsSync(join(RAIZ, ruta));
  linea(existe ? OK : ERROR, `Ruta: ${ruta}`);
  if (!existe) huboError = true;
}
const MIGRACIONES_ESPERADAS = ["0060_lealtad_wallet", "0138_personas_identidad_raiz"];
for (const prefijo of MIGRACIONES_ESPERADAS) {
  const existe = existsSync(join(RAIZ, "supabase", "migrations")) &&
    readFileSyncSeguro(join(RAIZ, "supabase", "migrations")).some((f) => f.startsWith(prefijo));
  linea(existe ? OK : AVISO, `Migración esperada presente en el repo: ${prefijo}*.sql`);
}
console.log();

function readFileSyncSeguro(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

// ── 5. Modo remoto ───────────────────────────────────────────────────
async function correrRemoto() {
  console.log("--- Comprobaciones remotas (solo lectura) ---");

  // Google: autenticación real + autorización del Issuer.
  if (google.estado === "ok") {
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!.trim();
    const b64 = process.env.GOOGLE_WALLET_SA_KEY_B64!;
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as { client_email: string; private_key: string };
    const remoto = await validarGoogleRemoto({ issuerId, clientEmail: json.client_email, privateKey: json.private_key });
    linea(remoto.autenticacion.ok ? OK : ERROR, `Google auth: ${remoto.autenticacion.ok ? "OK" : `HTTP ${remoto.autenticacion.status}`}`);
    linea(
      remoto.autorizacionIssuer.ok === true ? OK : remoto.autorizacionIssuer.ok === "no_verificable" ? NV : ERROR,
      `Issuer authorization: ${remoto.autorizacionIssuer.ok === true ? "autorizada" : remoto.autorizacionIssuer.ok === "no_verificable" ? "no verificable" : `HTTP ${remoto.autorizacionIssuer.status}`}`,
    );
    if (!remoto.autenticacion.ok || remoto.autorizacionIssuer.ok !== true) huboError = true;
    accionesHumanas.push(...remoto.accionesHumanas);
  } else {
    linea(NV, "Google auth: omitido (las credenciales offline ya fallaron)");
  }

  // Apple: la URL pública del Web Service responde (sin registrar nada:
  // GET a "seriales modificados" con un deviceId/serial inexistentes,
  // que Apple define como NO autenticado y que responde 204 sin tocar
  // ninguna fila real).
  try {
    const url = `${webServiceUrl}/v1/devices/wallet-doctor-check/registrations/${encodeURIComponent(passTypeId ?? "pass.doctor.check")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const ok = res.status === 204 || res.status === 200;
    linea(ok ? OK : ERROR, `Web Service URL publicly reachable: HTTP ${res.status} en ${url}`);
    if (!ok) huboError = true;
  } catch (e) {
    linea(ERROR, `Web Service URL publicly reachable: no se pudo conectar (${(e as Error).message})`);
    huboError = true;
  }
  console.log();
}

async function main() {
  if (modo === "remote") await correrRemoto();

  console.log("--- Warnings ---");
  if (advertencias.length === 0) console.log("(ninguno)");
  for (const a of advertencias) console.log(`⚠️  ${a}`);
  console.log();

  console.log("--- Acciones humanas pendientes ---");
  if (accionesHumanas.length === 0) console.log("(ninguna)");
  for (const a of [...new Set(accionesHumanas)]) console.log(`👉 ${a}`);
  console.log();

  console.log(`=== Resultado: ${huboError ? "ERROR — hay al menos un chequeo en rojo" : "OK"} ===\n`);
  process.exit(huboError ? 1 : 0);
}

main().catch((e) => {
  console.error("wallet:doctor terminó con una excepción no manejada:", (e as Error).message);
  process.exit(1);
});
