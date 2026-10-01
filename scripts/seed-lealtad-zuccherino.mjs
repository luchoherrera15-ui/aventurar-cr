/**
 * SIEMBRA: la TARJETA DE LEALTAD de Zuccherino (cliente real, 1 oct 2026).
 *
 *   node scripts/seed-lealtad-zuccherino.mjs
 *
 * El negocio y su programa ya existían (alta del 24 sep). Esto solo
 * cambia el DISEÑO y suma al equipo:
 *
 *   · fondo celeste de la marca (#92d1da) y etiquetas en teal profundo
 *     (#0e5560): las etiquetas salen del color del sello. Los valores y
 *     el nombre van en la tinta oscura que `tintaSobre` le da a un fondo
 *     claro (#15383d), y el logo es la «Z» repintada en esa tinta.
 *   · sello = el vaso de Zuccherino (zuccherino/sello-vaso.png): fondo
 *     transparente y cuatro píxeles blancos en las esquinas para que el
 *     `trim()` de `recortarBordes` no le quite el aire y el borde del
 *     vaso no choque con la máscara redonda.
 *   · banda = los postres (zuccherino/banda-postres.jpg), recorte 3:1.
 *   · 6 sellos en UNA fila, al tamaño máximo (pedido del dueño: más
 *     grandes aunque tapen la foto). Premio: una bebida.
 *   · equipo: grupoguevara25@gmail.com como administrador. Si no tiene
 *     cuenta se le crea (correo confirmado, sin contraseña): entra con
 *     Google y Supabase enlaza la identidad por el correo.
 *
 * Idempotente: el programa se actualiza en su sitio (su id es la llave
 * de los pases ya emitidos) y las imágenes se suben con upsert.
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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const RANCHO_ID = "01f358cb-5a88-4644-b7a8-84cdda49ebed";
const ADMINS = ["grupoguevara25@gmail.com"];
const BUCKET = "ranchos-fotos";
const SELLO = "lealtad/zuccherino-sello-vaso-v1.png";
const BANDA = "lealtad/zuccherino-banda-postres-v1.jpg";
// La «Z» en la tinta oscura del pase (tintaSobre("#92d1da") = #15383d):
// la blanca original se perdía sobre el celeste y en el ícono, que va
// sobre blanco. La blanca sigue en zuccherino-logo-blanco.png.
const LOGO = "lealtad/zuccherino-logo-oscuro-v1.png";

/** Lo que pidió el dueño el 1 oct: 6 sellos y una bebida de tres. */
const PREMIO = {
  nombre: "Una bebida",
  descripcion: "Americano, capuchino o limonada.",
  sellos: 6,
};

const salir = (msg) => {
  console.error(msg);
  process.exit(1);
};

// ── 1. El negocio y su programa ─────────────────────────────────────
const { data: negocio } = await db
  .from("ranchos")
  .select("id, nombre, owner_id")
  .eq("id", RANCHO_ID)
  .maybeSingle();
if (!negocio || negocio.nombre !== "Zuccherino") salir("No encontré a Zuccherino.");

const { data: programa } = await db
  .from("programa_lealtad")
  .select("id")
  .eq("rancho_id", RANCHO_ID)
  .eq("modo", "sellos")
  .maybeSingle();
if (!programa) salir("Zuccherino no tiene programa de sellos.");

// ── 2. Las imágenes ─────────────────────────────────────────────────
const subir = async (ruta, archivo, tipo) => {
  const { error } = await db.storage
    .from(BUCKET)
    .upload(ruta, fs.readFileSync(archivo), { contentType: tipo, upsert: true });
  if (error) salir(`No se pudo subir ${ruta}: ${error.message}`);
  return db.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
};
const urlSello = await subir(SELLO, "zuccherino/sello-vaso.png", "image/png");
const urlBanda = await subir(BANDA, "zuccherino/banda-postres.jpg", "image/jpeg");
const urlLogo = await subir(LOGO, "zuccherino/logo-oscuro.png", "image/png");
console.log("Imágenes arriba.");

// ── 3. El diseño ────────────────────────────────────────────────────
const { error: eProg } = await db
  .from("programa_lealtad")
  .update({
    pase_color_fondo: "#92d1da",
    pase_color_sello: "#0e5560",
    pase_sello_icono: "propio",
    pase_sello_icono_url: urlSello,
    pase_banner_url: urlBanda,
    pase_logo_url: urlLogo,
    // Escala 2 es el tope de `disenoDeLaConfig`; con una fila manda el
    // ancho, así que los 6 sellos salen del mayor tamaño que cabe.
    pase_diseno: {
      filas: 1,
      escalaSello: 2,
      alineacionH: "centro",
      alineacionV: "centro",
      margenY: 0.07,
      fondo: { forma: "plano" },
    },
    pase_texto_reverso:
      "Sumá un sello por cada compra. Al llegar a 6, te llevás una bebida: americano, capuchino o limonada.",
    beneficio: {
      tipo: "sellos",
      inicial: 0,
      repetible: true,
      sellosPor: "compra",
      recompensa: PREMIO.nombre,
      requeridos: PREMIO.sellos,
      montoPorSello: null,
    },
  })
  .eq("id", programa.id);
if (eProg) salir("No se pudo guardar el diseño: " + eProg.message);

// La meta de la tarjeta sale de la recompensa activa más barata, así que
// se edita LA recompensa que ya existe (una sola) en vez de sumar otra.
const { data: premios } = await db
  .from("recompensas")
  .select("id")
  .eq("programa_id", programa.id);
if ((premios ?? []).length !== 1) salir("Esperaba exactamente una recompensa; revisá a mano.");
const { error: ePremio } = await db
  .from("recompensas")
  .update({
    nombre: PREMIO.nombre,
    descripcion: PREMIO.descripcion,
    costo_puntos: PREMIO.sellos,
    activo: true,
    tipo: "producto",
    instrucciones: "Entregá un americano, capuchino o limonada y la tarjeta arranca otra vuelta desde cero.",
  })
  .eq("id", premios[0].id);
if (ePremio) salir("No se pudo guardar el premio: " + ePremio.message);
console.log("Diseño y premio guardados.");

// ── 4. El equipo ────────────────────────────────────────────────────
const usuarios = [];
for (let page = 1; page <= 20; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) salir("No se pudo listar usuarios: " + error.message);
  usuarios.push(...data.users);
  if (data.users.length < 1000) break;
}

for (const correo of ADMINS) {
  let u = usuarios.find((x) => (x.email ?? "").toLowerCase() === correo);
  if (!u) {
    const { data, error } = await db.auth.admin.createUser({ email: correo, email_confirm: true });
    if (error) salir(`No se pudo crear la cuenta de ${correo}: ${error.message}`);
    u = data.user;
    console.log(`Cuenta creada: ${correo}`);
  }
  if (u.id === negocio.owner_id) {
    console.log(`${correo} ya es el dueño.`);
    continue;
  }
  const { error } = await db.from("rancho_colaboradores").upsert(
    {
      rancho_id: RANCHO_ID,
      usuario_id: u.id,
      invitado_por: negocio.owner_id,
      rol: "administrador",
      permisos_lealtad: { acreditar: true, canjear: true, revertir: true, auditoria: true },
    },
    { onConflict: "rancho_id,usuario_id" },
  );
  if (error) salir(`No se pudo sumar a ${correo}: ${error.message}`);
  console.log(`${correo} es administrador de Zuccherino.`);
}

const { count } = await db
  .from("miembros")
  .select("id", { count: "exact", head: true })
  .eq("programa_id", programa.id);
console.log(`\nMiembros con tarjeta: ${count ?? 0}`);
console.log(`Panel: https://bookea.lat/lealtad/panel/${RANCHO_ID}`);
