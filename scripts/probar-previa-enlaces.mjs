// Comprueba que la previa del teléfono siga los cambios de «Tus enlaces»
// sin guardar: quita la primera card y verifica que desaparezca del
// teléfono. Misma sesión que captura-panel-linksy.mjs.
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
const email = process.argv[2] ?? "luchoherrera15@gmail.com";
const negocio = process.argv[3] ?? "b1288b5e-d2d5-48b8-b044-475540af8d11";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: v, error } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (error) throw error;
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const valor = "base64-" + Buffer.from(JSON.stringify(v.session)).toString("base64url");
const trozos = [];
for (let i = 0; i * 3180 < valor.length; i++) trozos.push(valor.slice(i * 3180, (i + 1) * 3180));

const require = createRequire(import.meta.url);
const dir = fs
  .readdirSync("C:/Users/luis h/AppData/Local/npm-cache/_npx")
  .map((d) => `C:/Users/luis h/AppData/Local/npm-cache/_npx/${d}/node_modules/playwright-core`)
  .find((d) => fs.existsSync(d));
const { chromium } = require(dir);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies(trozos.map((t, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: t, url: "http://localhost:3100" })));
const page = await ctx.newPage();
await page.goto(`http://localhost:3100/solutions/panel/${negocio}?tab=pagina`, { waitUntil: "networkidle", timeout: 120000 });

// La primera fila de «Tus enlaces» y su texto.
const primera = page.locator("#enlaces li").first();
const texto = (await primera.locator("input[id^=link-etiqueta-]").inputValue()).trim();
const previa = page.locator("aside").last();
const antes = (await previa.textContent())?.includes(texto);
await primera.getByRole("button", { name: "Quitar" }).click();
await page.waitForTimeout(400);
const despues = (await previa.textContent())?.includes(texto);
console.log(`card «${texto}» · en la previa antes: ${antes} · después de quitarla: ${despues}`);
await browser.close();
if (!antes || despues) process.exit(1);
