/**
 * EMPUJAR A GOOGLE LA CLASE DE CADA NEGOCIO CON PASES.
 *
 *   node scripts/refrescar-clases-google.mjs          (muestra qué haría)
 *   node scripts/refrescar-clases-google.mjs --hacelo (lo hace)
 *
 * ── PARA QUÉ EXISTE ─────────────────────────────────────────────────
 * En Google, el nombre que sale arriba de la tarjeta, el logo y el
 * color de fondo NO viven en el pase de cada cliente: viven en la
 * CLASE, que es una sola por negocio. Y la clase solo se escribía al
 * emitir el pase de alguien NUEVO.
 *
 * O sea que cuando se arregló que la tarjeta dijera el nombre del
 * negocio en vez de "Bookea", los Android de los clientes que YA
 * tenían el pase se iban a quedar con lo viejo hasta que se afiliara
 * alguien más. En un negocio que ya tiene a toda su clientela adentro,
 * eso es nunca.
 *
 * Un PATCH de la clase arregla de una sola vez TODAS las tarjetas de
 * ese negocio: Google las vuelve a dibujar en los teléfonos solo.
 *
 * ── POR QUÉ NO PIDE PERMISO PARA LEER Y SÍ PARA ESCRIBIR ────────────
 * Sin `--hacelo` no toca nada: lista los negocios y muestra qué le
 * mandaría a Google. Escribir en la cuenta de emisor cambia lo que ve
 * gente real en su teléfono, y eso no se hace por accidente al probar
 * un comando.
 *
 * Es el espejo de `refrescarClaseGoogle()` (src/lib/wallet/google.ts).
 * Se duplica la firma del JWT acá porque un script .mjs no puede
 * importar TypeScript con alias `@/`.
 */
import { createClient } from "@supabase/supabase-js";
import { createSign } from "node:crypto";
import fs from "node:fs";

const HACELO = process.argv.includes("--hacelo");
const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const SITIO = env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat";
const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
const saB64 = env.GOOGLE_WALLET_SA_KEY_B64 || env.GOOGLE_WALLET_SA_KEY_B;

if (!issuerId || !saB64) {
  console.error("Faltan GOOGLE_WALLET_ISSUER_ID o GOOGLE_WALLET_SA_KEY_B64 en .env.local");
  process.exit(1);
}

const sa = JSON.parse(Buffer.from(saB64, "base64").toString("utf8"));

const base64url = (b) => Buffer.from(b).toString("base64url");

function firmar(payload) {
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(JSON.stringify(payload));
  const firma = createSign("RSA-SHA256")
    .update(`${cabecera}.${cuerpo}`)
    .sign(sa.private_key)
    .toString("base64url");
  return `${cabecera}.${cuerpo}.${firma}`;
}

async function tokenDeAcceso() {
  const ahora = Math.floor(Date.now() / 1000);
  const jwt = firmar({
    iss: sa.client_email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Google no dio token: ${JSON.stringify(json)}`);
  return json.access_token;
}

/** El MISMO armado que `construirClase()` en src/lib/wallet/google.ts. */
function construirClase({ ranchoId, nombreNegocio, colorFondo, logoUrl }) {
  const fondo = /^#[0-9a-fA-F]{6}$/.test(colorFondo ?? "") ? colorFondo : "#10203a";
  const params = new URLSearchParams({ nombre: nombreNegocio });
  params.set("color", fondo);
  const logo = logoUrl || `${SITIO}/api/pases-google/logo?${params.toString()}`;
  return {
    // El MISMO id que arma `idDeClase()` en src/lib/wallet/google.ts:
    // el prefijo `negocio_` y los guiones del uuid quitados. Escribirlo
    // "a lo obvio" (`issuerId.ranchoId`) apunta a una clase que no
    // existe y Google contesta 404 — pasó al primer intento.
    id: `${issuerId}.negocio_${ranchoId.replace(/-/g, "")}`,
    issuerName: nombreNegocio,
    programName: nombreNegocio,
    programLogo: {
      sourceUri: { uri: logo },
      contentDescription: { defaultValue: { language: "es", value: `Logo de ${nombreNegocio}` } },
    },
    hexBackgroundColor: fondo,
    countryCode: "CR",
    reviewStatus: "UNDER_REVIEW",
  };
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Solo los negocios que TIENEN pases emitidos: refrescar la clase de un
// negocio sin un solo pase no arregla nada y gasta una llamada.
//
// El negocio queda a dos saltos del pase: `pases_wallet` guarda a qué
// MIEMBRO pertenece, el miembro a qué PROGRAMA, y el programa a qué
// negocio. No hay atajo — `pases_wallet` no tiene `rancho_id`.
const { data: pases, error: ePases } = await db
  .from("pases_wallet")
  .select("miembro_id, plataforma");
if (ePases) {
  console.error("No se pudieron leer los pases:", ePases.message);
  process.exit(1);
}

const deGoogle = (pases ?? []).filter((p) => p.plataforma === "google");
console.log(`${pases?.length ?? 0} pase(s) en total, ${deGoogle.length} de Google.`);

const { data: miembros, error: eMiembros } = await db
  .from("miembros")
  .select("id, programa_id")
  .in("id", deGoogle.map((p) => p.miembro_id));
if (eMiembros) {
  console.error("No se pudieron leer los miembros:", eMiembros.message);
  process.exit(1);
}

const { data: programas, error: eProgramas } = await db
  .from("programa_lealtad")
  .select("id, rancho_id")
  .in("id", [...new Set((miembros ?? []).map((m) => m.programa_id))]);
if (eProgramas) {
  console.error("No se pudieron leer los programas:", eProgramas.message);
  process.exit(1);
}

const conPases = [...new Set((programas ?? []).map((p) => p.rancho_id).filter(Boolean))];

if (conPases.length === 0) {
  console.log("No hay ningún pase emitido todavía. Nada que refrescar.");
  process.exit(0);
}

console.log(`${conPases.length} negocio(s) con pases emitidos.\n`);

const token = HACELO ? await tokenDeAcceso() : null;
let listos = 0;
const fallas = [];

for (const ranchoId of conPases) {
  const { data: negocio } = await db
    .from("ranchos")
    .select("nombre")
    .eq("id", ranchoId)
    .maybeSingle();
  if (!negocio) {
    fallas.push(`${ranchoId}: el negocio ya no existe`);
    continue;
  }

  const { data: programas } = await db
    .from("programa_lealtad")
    .select("pase_color_fondo, pase_logo_url, activo")
    .eq("rancho_id", ranchoId);
  const prog = (programas ?? []).find((p) => p.activo) ?? (programas ?? [])[0] ?? {};

  const clase = construirClase({
    ranchoId,
    nombreNegocio: (negocio.nombre ?? "").trim(),
    colorFondo: prog.pase_color_fondo,
    logoUrl: prog.pase_logo_url,
  });

  if (!HACELO) {
    console.log(`  ${negocio.nombre}`);
    console.log(`     issuerName: "${clase.issuerName}"   (antes: "Bookea")`);
    console.log(`     logo:       ${clase.programLogo.sourceUri.uri.slice(0, 96)}`);
    continue;
  }

  const res = await fetch(`${API}/loyaltyClass/${clase.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(clase),
  });
  if (res.status >= 300) {
    const cuerpo = await res.text();
    fallas.push(`${negocio.nombre}: Google respondió ${res.status} — ${cuerpo.slice(0, 200)}`);
  } else {
    listos++;
    console.log(`  ok  ${negocio.nombre}`);
  }
}

if (!HACELO) {
  console.log("\nEsto fue solo una vista previa. Para hacerlo de verdad:");
  console.log("  node scripts/refrescar-clases-google.mjs --hacelo");
} else {
  console.log(`\n${listos} clase(s) actualizada(s), ${fallas.length} con problemas.`);
  for (const f of fallas) console.log(`  · ${f}`);
  if (fallas.length > 0) process.exit(1);
}
