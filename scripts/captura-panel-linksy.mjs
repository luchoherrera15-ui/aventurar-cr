// Captura el panel de Linksy en localhost:3100 CON sesión del dueño,
// fabricando la cookie de Supabase por magic link (ver memoria
// diagnostico-ssr-con-sesion) y manejando Chrome con playwright-core.
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
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] ?? "luchoherrera15@gmail.com";
const negocio = process.argv[3] ?? "b1288b5e-d2d5-48b8-b044-475540af8d11";
const salida = process.argv[4] ?? path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

// ── La sesión ──
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (e1) throw e1;
const anon = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { data: verificado, error: e2 } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (e2) throw e2;
const ref = new URL(URL_SB).hostname.split(".")[0];
const valor = "base64-" + Buffer.from(JSON.stringify(verificado.session)).toString("base64url");
console.log("sesión ok para", email, "· cookie", `sb-${ref}-auth-token`, valor.length, "chars");

const BASE = process.env.BASE ?? "http://localhost:3100";
const HOST = new URL(BASE).hostname;
// ── Chrome por playwright-core (del cache de npx) ──
const require = createRequire(import.meta.url);
const candidatos = fs
  .readdirSync("C:/Users/luis h/AppData/Local/npm-cache/_npx")
  .map((d) => `C:/Users/luis h/AppData/Local/npm-cache/_npx/${d}/node_modules/playwright-core`)
  .filter((d) => fs.existsSync(d));
const { chromium } = require(candidatos[0]);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ancho = Number(process.argv[5] ?? 1600);
const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho < 700 ? 900 : 1000 }, deviceScaleFactor: 1, isMobile: ancho < 700 });
// La cookie entera en un solo trozo (cabe); dominio localhost.
// Supabase SSR parte la cookie en trozos de 3180 chars: .0, .1, …
const TROZO = 3180;
const trozos = [];
for (let i = 0; i * TROZO < valor.length; i++) trozos.push(valor.slice(i * TROZO, (i + 1) * TROZO));
const cookies = trozos.length === 1
  ? [{ name: `sb-${ref}-auth-token`, value: valor }]
  : trozos.map((v, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: v }));
await ctx.addCookies(cookies.map((c) => ({ ...c, url: BASE, httpOnly: false, secure: BASE.startsWith("https"), sameSite: "Lax" })));
console.log("cookies:", cookies.length, "trozo(s)");
const page = await ctx.newPage();
const rutas = (process.argv[6] ? process.argv[6].split(",") : ["inicio","pagina","ventas","instagram","lealtad"]).map((n) => n).length ? [
  ["landing", `/linksy`],
  ["menu", `/solutions/panel/${negocio}?tab=menu`],
  ["inicio", `/solutions/panel/${negocio}?tab=inicio`],
  ["pagina", `/solutions/panel/${negocio}?tab=pagina`],
  ["diseno", `/solutions/panel/${negocio}?tab=diseno`],
  ["enlaces-tab", `/solutions/panel/${negocio}?tab=enlaces`],
  ["ajustes", `/solutions/panel/${negocio}?tab=ajustes`],
  ["plan", `/solutions/panel/${negocio}/plan`],
  ["ventas", `/solutions/panel/${negocio}/restaurante`],
  ["instagram", `/solutions/panel/${negocio}/instagram`],
  ["lealtad", `/solutions/panel/${negocio}/lealtad`],
  ["mesas", `/solutions/panel/${negocio}/mesas?mesas=6`],
  ["lealtad-clientes", `/solutions/panel/${negocio}/lealtad#clientes`],
  ["lealtad-config", `/solutions/panel/${negocio}/lealtad#configuracion`],
  ["efectos", `/solutions/panel/${negocio}?tab=pagina`],
  ["enlaces", `/solutions/panel/${negocio}?tab=pagina`],
  ["marco", `/solutions/panel/${negocio}?tab=pagina`],
].filter(([n]) => !process.argv[6] || process.argv[6].split(",").includes(n)) : [];
for (const [nombre, ruta] of rutas) {
  const r = await page.goto(`${BASE}${ruta}`, { waitUntil: "networkidle", timeout: 120000 });
  if (nombre === "enlaces") { await page.locator("text=Tus enlaces").first().scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -120)); }
  if (nombre === "marco") { await page.locator("text=El marco del encabezado").first().scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -260)); }
  if (nombre === "efectos") { await page.locator("text=Efecto de las tarjetas").first().scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -140)); }
  if (nombre === "landing") console.log("nav:", (await page.locator("nav[aria-label=Principal]").innerText()).replace(/\s+/g, " "));
  await page.waitForTimeout(1200);
  const archivo = path.join(salida, `panel-${nombre}${ancho < 700 ? "-movil" : ""}${HOST === "localhost" ? "" : "-prod"}.png`);
  await page.screenshot({ path: archivo, fullPage: nombre === "inicio" });
  console.log(nombre, r?.status(), page.url(), "→", archivo);
}
await browser.close();
