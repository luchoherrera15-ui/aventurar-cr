/**
 * Seed del negocio "Invitaciones Digitales — Bookea": el destino del
 * chat cuando alguien pide un paquete de invitaciones desde
 * /invitaciones o /cuenta/invitaciones (server action pedirPaquete).
 *
 * Es un negocio real de la casa, a nombre de la cuenta de Bookea
 * (luchoherrera15@gmail.com): los pedidos le caen a su bandeja de
 * mensajes normal. Si esa cuenta no existe, el seed falla — no la crea.
 *
 * Idempotente: si el slug ya existe, actualiza la fila. El trigger
 * trg_rancho_bloquear_estado no deja cambiar `estado` por UPDATE sin
 * sesión admin, así que si quedó en otro estado se borra y se
 * reinserta ya aprobado.
 *
 * Uso:  node scripts/seed-negocio-invitaciones.mjs
 * Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---------- .env.local (sin dependencias extra) ----------

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function leerEnvLocal() {
  const contenido = readFileSync(path.join(raiz, ".env.local"), "utf8");
  const env = {};
  for (const linea of contenido.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = leerEnvLocal();
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
  process.exit(1);
}

const db = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- La cuenta dueña: Bookea ----------

const CORREO_OWNER = "luchoherrera15@gmail.com";

async function buscarOwner() {
  // Buscar por email paginando el admin API (no hay getUserByEmail).
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers: " + error.message);
    const usuario = data.users.find(
      (u) => (u.email || "").toLowerCase() === CORREO_OWNER,
    );
    if (usuario) return usuario.id;
    if (data.users.length < 200) break;
  }
  throw new Error(
    `La cuenta ${CORREO_OWNER} no existe en este proyecto — el seed no la crea.`,
  );
}

// ---------- El negocio ----------

const unsplash = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;

const SLUG = "bookea-invitaciones";

const NEGOCIO = {
  slug: SLUG,
  nombre: "Invitaciones Digitales — Bookea",
  vertical: "eventos",
  categoria: "otros",
  subcategoria: "invitaciones",
  provincia: "San José",
  canton: "San José",
  descripcion:
    "Tu invitación digital diseñada llave en mano: un link precioso donde tus invitados confirman en un minuto.",
  descripcion_larga:
    "El equipo de Bookea diseña la invitación digital de tu boda, quince años, baby shower o cumpleaños: un link elegante con tu historia, la ubicación con GPS, cuenta regresiva y confirmación de invitados en vivo. Elegí tu paquete, contanos la idea por el chat y te la entregamos lista para compartir por WhatsApp — con álbum digital para que todos suban sus fotos escaneando un QR y resguardo en la nube por 10 años.",
  precio_desde: 44900,
  unidad_precio: "evento",
  foto_url: unsplash("photo-1465495976277-4387d4b0b4c6"),
  fotos: [
    unsplash("photo-1465495976277-4387d4b0b4c6"),
    unsplash("photo-1519741497674-611481863552"),
  ],
  detalles: {
    producto_bookea: "invitaciones_digitales",
    entrega_digital: true,
    diseno_personalizado: true,
    zonas: ["San José", "Alajuela", "Cartago", "Heredia", "Guanacaste", "Puntarenas", "Limón"],
  },
};

// ---------- Upsert ----------

async function sembrar() {
  console.log("Seed negocio INVITACIONES →", URL_SUPABASE);
  const ownerId = await buscarOwner();
  console.log("· Owner:", CORREO_OWNER, "→", ownerId);

  const fila = { ...NEGOCIO, owner_id: ownerId, estado: "aprobado" };

  const { data: existente, error: errSel } = await db
    .from("ranchos")
    .select("id, estado")
    .eq("slug", SLUG)
    .maybeSingle();
  if (errSel) throw new Error(`select ${SLUG}: ${errSel.message}`);

  if (existente && existente.estado !== "aprobado") {
    const { error: errDel } = await db.from("ranchos").delete().eq("id", existente.id);
    if (errDel) throw new Error(`delete ${SLUG}: ${errDel.message}`);
    console.log(`· ${SLUG} estaba '${existente.estado}' — recreado`);
  }

  if (existente && existente.estado === "aprobado") {
    const sinEstado = { ...fila };
    delete sinEstado.estado; // el trigger lo revertiría igual
    const { error: errUpd } = await db
      .from("ranchos")
      .update(sinEstado)
      .eq("id", existente.id);
    if (errUpd) throw new Error(`update ${SLUG}: ${errUpd.message}`);
    console.log(`· actualizado  ${SLUG}`);
  } else {
    const { error: errIns } = await db.from("ranchos").insert(fila);
    if (errIns) throw new Error(`insert ${SLUG}: ${errIns.message}`);
    console.log(`· creado  ${SLUG}`);
  }

  // ---------- Verificación ----------
  const { data: verif, error: errVerif } = await db
    .from("ranchos")
    .select("id, slug, nombre, categoria, vertical, estado, owner_id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (errVerif) throw new Error("verificación: " + errVerif.message);

  const ok =
    verif &&
    verif.estado === "aprobado" &&
    verif.owner_id === ownerId &&
    verif.vertical === "eventos";
  console.log("\n=== Verificación en la base ===");
  if (verif) {
    console.log(
      `  ${ok ? "✓" : "✗"} ${verif.slug} · "${verif.nombre}" · ${verif.estado} · vertical=${verif.vertical} · owner ${verif.owner_id === ownerId ? "correcto" : "AJENO"}`,
    );
  }
  console.log(
    ok
      ? "\nListo: el negocio de invitaciones quedó sembrado y aprobado."
      : "\nOJO: el negocio no quedó como se esperaba — revisá arriba.",
  );
  if (!ok) process.exitCode = 1;
}

sembrar().catch((e) => {
  console.error("\nEl seed falló:", e.message);
  process.exit(1);
});
