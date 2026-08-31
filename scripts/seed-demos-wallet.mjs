/**
 * LOS OCHO NEGOCIOS DE DEMOSTRACIÓN DE LA LANDING.
 *
 *   node scripts/seed-demos-wallet.mjs             ← solo mira
 *   node scripts/seed-demos-wallet.mjs --montar    ← los crea
 *   node scripts/seed-demos-wallet.mjs --desmontar ← los apaga
 *
 * ------------------------------------------------------------------
 * PARA QUÉ
 * ------------------------------------------------------------------
 * Pedido del dueño (31 ago 2026): que en «Elegí qué guardan en el
 * teléfono» cada pestaña tenga sus botones de Apple y Google Wallet, y
 * que lleven al MISMO formulario que llena un cliente al afiliarse,
 * para que quien mira la landing se pueda bajar un pase de verdad.
 *
 * Ese formulario es `/tarjeta/<slug>`, y resuelve contra un negocio
 * REAL de la base. O sea que para que los ocho botones anden tiene que
 * existir un negocio por tipo de tarjeta. Eso hace este script.
 *
 * ------------------------------------------------------------------
 * LA TABLA NO VIVE ACÁ
 * ------------------------------------------------------------------
 * Sale de `src/lib/lealtad/demos-wallet.json`, que es también lo que
 * lee la landing para armar los enlaces. Una sola fuente: si el slug se
 * escribiera en dos lados, el día que cambie uno el botón queda
 * apuntando a un negocio que no existe.
 *
 * ------------------------------------------------------------------
 * NO PUEDE TOCAR UN NEGOCIO DE VERDAD
 * ------------------------------------------------------------------
 * Todo lo que hace filtra por `slug` con prefijo `demo-`, y hay una
 * guarda explícita que aborta si un slug de la tabla no lo lleva.
 * `--desmontar` apaga el complemento y el programa, pero NO borra el
 * negocio: si alguien ya se afilió, su pase y su ledger cuelgan de ahí
 * y borrarlo los arrastraría.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const MONTAR = process.argv.includes("--montar");
const DESMONTAR = process.argv.includes("--desmontar");

const { negocios: DEMOS } = JSON.parse(
  fs.readFileSync("src/lib/lealtad/demos-wallet.json", "utf8"),
);

// ── La guarda ──────────────────────────────────────────────────────
// Sin esto, un slug mal escrito en el JSON haría que este script
// escriba encima del negocio de un cliente.
for (const d of DEMOS) {
  if (!d.slug.startsWith("demo-")) {
    console.error(`ABORTA: el slug «${d.slug}» no empieza con "demo-".`);
    process.exit(1);
  }
}

/**
 * Cómo acumula cada tipo. Es la misma tabla que `acumulacionDe()` en
 * src/lib/lealtad/mostrador.ts — se replica porque un `.mjs` no puede
 * importar el `.ts`, y son las DOS columnas que el motor
 * `acreditar_lealtad` de verdad mira: sin ellas, un cashback acredita
 * 1 punto por visita y 0 % de la compra.
 */
function acumulacion(config) {
  switch (config.tipo) {
    case "puntos":
      return { porVisita: config.porVisita, porColon: config.porMoneda, compraMinima: null };
    case "cashback":
      return {
        porVisita: 0,
        porColon: config.porcentaje / 100,
        compraMinima: config.compraMinima > 0 ? Math.round(config.compraMinima) : null,
      };
    case "giftcard":
      return { porVisita: 0, porColon: 1, compraMinima: null };
    default:
      // sellos, cupón, descuento, membresía y evento: uno por visita.
      return { porVisita: 1, porColon: 0, compraMinima: null };
  }
}

// ── Quién es el dueño de las demos ─────────────────────────────────
// `lealtad.demo@bookea.lat`, la cuenta de demostración que YA es dueña
// de las demos del catálogo de rubros (Tostaduría Media Luna, Studio
// Aura Nails y compañía). NO la cuenta del dueño de Bookea: así los
// negocios de mentira quedan todos juntos y separados de los de
// verdad, y su panel se puede abrir sin un cliente real al lado.
const CORREO_DEMO = "lealtad.demo@bookea.lat";
const { data: perfilDemo } = await db
  .from("perfiles")
  .select("id")
  .eq("email", CORREO_DEMO)
  .maybeSingle();

const OWNER = perfilDemo?.id ?? null;
if (!OWNER && MONTAR) {
  console.error(`No existe la cuenta de demostración ${CORREO_DEMO}.`);
  process.exit(1);
}

// ── Mirar qué hay ──────────────────────────────────────────────────
const slugs = DEMOS.map((d) => d.slug);
const { data: existentes } = await db
  .from("ranchos")
  .select("id, nombre, slug, plan_lealtad")
  .in("slug", slugs);

const porSlug = new Map((existentes ?? []).map((r) => [r.slug, r]));

console.log(`\nLos ocho negocios de demostración (${slugs.length} en la tabla):\n`);
for (const d of DEMOS) {
  const r = porSlug.get(d.slug);
  console.log(`  ${r ? "✓" : "·"} ${d.tipo.padEnd(10)} ${d.nombre.padEnd(22)} /tarjeta/${d.slug}`);
}

if (!MONTAR && !DESMONTAR) {
  console.log("\n(solo mirando — usá --montar para crearlos)\n");
  process.exit(0);
}

// ── Desmontar ──────────────────────────────────────────────────────
if (DESMONTAR) {
  for (const d of DEMOS) {
    const r = porSlug.get(d.slug);
    if (!r) continue;
    await db.from("addons_negocio").update({ activo: false }).eq("rancho_id", r.id).eq("addon", "lealtad");
    await db.from("programa_lealtad").update({ activo: false, estado: "pausado" }).eq("rancho_id", r.id);
    console.log(`  apagado ${d.nombre}`);
  }
  console.log("\nDemos apagadas. Los negocios y sus miembros se quedan.\n");
  process.exit(0);
}

// ── Montar ─────────────────────────────────────────────────────────
for (const d of DEMOS) {
  let rancho = porSlug.get(d.slug);

  if (!rancho) {
    const { data, error } = await db
      .from("ranchos")
      .insert({
        owner_id: OWNER,
        nombre: d.nombre,
        slug: d.slug,
        vertical: "citas",
        categoria: "otros",
        estado: "pendiente",
        // Fuera del directorio público: es una demo de Lealtad, no un
        // proveedor que se ofreció al marketplace.
        en_marketplace: false,
        lealtad_aprobado_en: new Date().toISOString(),
        lealtad_aprobado_por: null,
        plan_lealtad: "impulso",
      })
      .select("id, slug")
      .single();
    if (error) {
      console.error(`  ✗ ${d.nombre}: ${error.message}`);
      continue;
    }
    rancho = data;
  }

  const acumula = acumulacion(d.config);

  const { data: prevPrograma } = await db
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", rancho.id)
    .limit(1)
    .maybeSingle();

  const campos = {
    rancho_id: rancho.id,
    nombre: `Tarjeta de ${d.nombre}`,
    modo: d.tipo,
    beneficio: d.config,
    puntos_por_visita: acumula.porVisita,
    puntos_por_colon: acumula.porColon,
    compra_minima: acumula.compraMinima,
    activo: true,
    estado: "activo",
    pase_color_fondo: d.color,
    pase_color_sello: d.acento,
  };

  const { error: eProg } = prevPrograma
    ? await db.from("programa_lealtad").update(campos).eq("id", prevPrograma.id)
    : await db.from("programa_lealtad").insert(campos);

  if (eProg) {
    console.error(`  ✗ programa de ${d.nombre}: ${eProg.message}`);
    continue;
  }

  // El complemento de lealtad encendido: sin esto el negocio existe
  // pero su tarjeta no opera.
  await db
    .from("addons_negocio")
    .upsert({ rancho_id: rancho.id, addon: "lealtad", activo: true }, { onConflict: "rancho_id,addon" });

  console.log(`  ✓ ${d.nombre.padEnd(22)} /tarjeta/${d.slug}`);
}

console.log("\nListo. Probá cualquiera en /lealtad, sección «Elegí qué guardan en el teléfono».\n");
