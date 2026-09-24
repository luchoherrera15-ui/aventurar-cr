/**
 * QA de CELEBRAR con sesión del dueño y capturas por CDP (el screenshot
 * normal de Playwright se cuelga esperando `document.fonts`).
 *
 *   node scripts/celebrar-qa.mjs <archivo-de-pasos.mjs> [ancho=1500]
 *
 * El archivo de pasos exporta `default async (page, capturar) => {…}`:
 * `capturar("nombre")` guarda nombre.jpg en el scratchpad indicado por
 * la variable de entorno SALIDA (o en ./qa). La sesión se fabrica como en
 * captura-panel-linksy.mjs (magic link → verifyOtp → cookie).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const raiz = "c:/Users/luis h/aventurar-cr";
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim()];
    }),
);
const BASE = process.env.BASE ?? "http://localhost:3100";
const salida = process.env.SALIDA ?? path.join(raiz, "qa");
fs.mkdirSync(salida, { recursive: true });
const pasos = process.argv[2];
const ancho = Number(process.argv[3] ?? 1500);
if (!pasos) {
  console.error("Uso: node scripts/celebrar-qa.mjs <pasos.mjs> [ancho]");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.CORREO ?? "luchoherrera15@gmail.com" });
if (e1) throw e1;
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: verificado, error: e2 } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (e2) throw e2;
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const valor = "base64-" + Buffer.from(JSON.stringify(verificado.session)).toString("base64url");
const TROZO = 3180;
const trozos = [];
for (let i = 0; i * TROZO < valor.length; i++) trozos.push(valor.slice(i * TROZO, (i + 1) * TROZO));
const cookies = trozos.length === 1 ? [{ name: `sb-${ref}-auth-token`, value: valor }] : trozos.map((v, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: v }));

const require = createRequire(import.meta.url);
const candidatos = fs
  .readdirSync("C:/Users/luis h/AppData/Local/npm-cache/_npx")
  .map((d) => `C:/Users/luis h/AppData/Local/npm-cache/_npx/${d}/node_modules/playwright-core`)
  .filter((d) => fs.existsSync(d));
const { chromium } = require(candidatos[0]);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho < 700 ? 844 : 940 }, deviceScaleFactor: 1, isMobile: ancho < 700 });
await ctx.addCookies(cookies.map((c) => ({ ...c, url: BASE, httpOnly: false, secure: BASE.startsWith("https"), sameSite: "Lax" })));
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept(process.env.RESPUESTA_DIALOGO ?? ""));
await page.route("**/google.com/maps**", (r) => r.abort());
const cdp = await ctx.newCDPSession(page);
const capturar = async (nombre) => {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 74 });
  const f = path.join(salida, `${nombre}.jpg`);
  fs.writeFileSync(f, Buffer.from(data, "base64"));
  console.log("→", f);
};

try {
  const mod = await import(path.resolve(pasos).replace(/^([A-Za-z]:)/, "file:///$1"));
  const resultado = await mod.default(page, capturar, BASE);
  if (resultado !== undefined) console.log(JSON.stringify(resultado, null, 2));
} catch (e) {
  console.error("FALLÓ:", e?.message ?? e);
  await capturar("error");
  process.exitCode = 1;
} finally {
  await browser.close();
}
