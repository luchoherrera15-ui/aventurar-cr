/**
 * ════════════════════════════════════════════════════════════════════
 *  SUBE LAS FRANJAS DE PLANTILLA A CLOUDFLARE IMAGES
 * ════════════════════════════════════════════════════════════════════
 *
 * Por qué (30 ago 2026): las ~24 franjas de
 * `public/lealtad/plantillas/franjas/` pesaban ~5 MB —el 75 % de todo
 * `public/` una vez eliminado FOOD— y se clonaban y subían al CDN en
 * CADA despliegue.
 *
 * ── POR QUÉ ES SEGURO MOVERLAS ─────────────────────────────────────
 * Son SOLO VISTA PREVIA. `configurador-lealtad.tsx` lo dice explícito:
 * un id de `PLANTILLAS_FRANJA` «NUNCA viaja al servidor», y al crear el
 * pase `bannerUrl` se manda solo cuando la franja es PROPIA (subida por
 * el negocio a nuestro Storage). O sea: ninguna franja del banco entra
 * jamás al .pkpass, así que servirlas desde otro dominio no toca la
 * generación del pase.
 *
 * ── IDEMPOTENTE ────────────────────────────────────────────────────
 * El id es la ruta (`lealtad/franjas/<archivo>`); repetirlo devuelve
 * «ya existe» y se cuenta como éxito. Correrlo dos veces no duplica.
 *
 * Uso:
 *   node scripts/subir-franjas-a-cloudflare.mjs
 *   node scripts/subir-franjas-a-cloudflare.mjs --listar
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const SOLO_LISTAR = process.argv.includes("--listar");
const CONCURRENCIA = 5;
const REINTENTOS = 3;

function entorno() {
  const archivo = path.join(RAIZ, ".env.local");
  if (!existsSync(archivo)) throw new Error("No encuentro .env.local");
  const env = {};
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  const faltan = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_IMAGES_API_TOKEN"].filter((v) => !env[v]);
  if (faltan.length) throw new Error(`Faltan variables: ${faltan.join(", ")}`);
  return env;
}

function franjas() {
  return execSync("git ls-files public/lealtad/plantillas/franjas", {
    cwd: RAIZ,
    encoding: "utf8",
  })
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.endsWith(".jpg"));
}

/** `public/lealtad/plantillas/franjas/cafe-2.jpg` → `lealtad/franjas/cafe-2` */
const idDe = (ruta) => "lealtad/franjas/" + path.basename(ruta, ".jpg");

async function subir(env, ruta) {
  const id = idDe(ruta);
  const bytes = readFileSync(path.join(RAIZ, ruta));
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: "image/jpeg" }), path.basename(ruta));
    fd.append("id", id);
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_API_TOKEN}` },
          body: fd,
        },
      );
      const json = await res.json().catch(() => ({}));
      if (json.success) return { id, estado: "subida" };
      const textos = (json.errors || []).map((e) => e.message).join(" ");
      if (res.status === 409 || /exist/i.test(textos)) return { id, estado: "ya-estaba" };
      if (intento === REINTENTOS) return { id, estado: "error", detalle: textos || res.status };
    } catch (e) {
      if (intento === REINTENTOS) return { id, estado: "error", detalle: String(e).slice(0, 120) };
    }
    await new Promise((r) => setTimeout(r, 400 * intento));
  }
  return { id, estado: "error", detalle: "sin intentos" };
}

const lista = franjas();
const peso = lista.reduce((s, f) => s + readFileSync(path.join(RAIZ, f)).length, 0);
console.log(`${lista.length} franjas · ${(peso / 1048576).toFixed(2)} MB`);

if (SOLO_LISTAR) {
  for (const f of lista) console.log(`  ${f}  →  ${idDe(f)}`);
} else {
  const env = entorno();
  const cola = [...lista];
  const res = [];
  await Promise.all(
    Array.from({ length: CONCURRENCIA }, async () => {
      while (cola.length) {
        const f = cola.shift();
        res.push(await subir(env, f));
      }
    }),
  );
  const ok = res.filter((r) => r.estado !== "error").length;
  const errores = res.filter((r) => r.estado === "error");
  console.log(`\nlistas: ${ok}/${lista.length}`);
  for (const e of errores) console.log(`  ✗ ${e.id}: ${e.detalle}`);
  if (errores.length) process.exitCode = 1;
}
