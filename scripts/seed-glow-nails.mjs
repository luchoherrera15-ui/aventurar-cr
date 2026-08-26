/**
 * ════════════════════════════════════════════════════════════════════
 *  GLOW NAILS STUDIO — un negocio REAL, no una demo
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): sembrar Glow Nails Studio a nombre de
 * luchoherrera15@gmail.com, «luego lo moveremos a otra cuenta cuando
 * los dueños se registren».
 *
 * ── EN QUÉ SE DIFERENCIA DE `seed-demo-citas.mjs` ───────────────────
 *
 * Ese script siembra negocios de MENTIRA: slug `demo-…`, cuenta
 * `citas.demo@bookea.lat` y `detalles.demo = true`, que es lo que hace
 * que el sitio les pinte el badge «Demo».
 *
 * Éste NO. Glow Nails es un negocio de verdad, con sus precios de
 * verdad y sus fotos de verdad, que va a atender clientas de verdad.
 * Por eso:
 *
 *   · el slug es `glow-nails-studio`, sin prefijo;
 *   · `detalles.demo` NO se escribe;
 *   · el dueño es una cuenta REAL que ya existe. Si no existiera, este
 *     script FALLA en vez de crearla — crear una cuenta con una
 *     contraseña inventada para un negocio real es dejar una puerta
 *     abierta que nadie va a recordar cerrar.
 *
 * ── LAS FOTOS SE SUBEN, NO SE ENLAZAN ───────────────────────────────
 *
 * Las de la demo son URLs de Unsplash. Éstas son archivos del local que
 * mandó el dueño y viven en `locales/uñas/`. Se suben a
 * `ranchos-fotos`, el mismo bucket que usa el panel cuando el negocio
 * sube una foto — así el día que ellos entren a editar, sus fotos ya
 * están donde el panel las espera.
 *
 * ── EL TRASPASO DE CUENTA, QUE ES EL PLAN ───────────────────────────
 *
 * Cuando los dueños se registren, el traspaso es cambiar `owner_id`.
 * Las fotos NO hay que moverlas: viven en el bucket bajo la ruta del
 * rancho, no la del usuario.
 *
 * Idempotente: si el slug ya existe, actualiza; el equipo y el catálogo
 * se regeneran completos.
 *
 * Uso:  node scripts/seed-glow-nails.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const db = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORREO_DUENO = "luchoherrera15@gmail.com";
const SLUG = "glow-nails-studio";
const BUCKET = "ranchos-fotos";
const CARPETA_FOTOS = path.join(raiz, "locales", "uñas");

/**
 * El dueño TIENE que existir. Ver la cabecera: crear una cuenta con
 * contraseña inventada para un negocio real deja una puerta abierta.
 */
async function buscarDueno() {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers: " + error.message);
    const usuario = data.users.find(
      (u) => (u.email || "").toLowerCase() === CORREO_DUENO,
    );
    if (usuario) return usuario.id;
    if (data.users.length < 200) break;
  }
  throw new Error(
    `La cuenta ${CORREO_DUENO} no existe en este proyecto. Este script NO la crea a propósito.`,
  );
}

/**
 * Sube una foto del local y devuelve su URL pública.
 *
 * `upsert: true` para que volver a correr el script no acumule copias
 * con nombres nuevos. La ruta lleva el slug del negocio: cuando el
 * negocio cambie de dueño, las fotos no hay que moverlas.
 */
async function subirFoto(archivo, destino) {
  const bytes = readFileSync(path.join(CARPETA_FOTOS, archivo));
  const ruta = `${SLUG}/${destino}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`subir ${archivo}: ${error.message}`);
  const { data } = db.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}

/** Servicio del catálogo, con los defaults que pide la vertical citas. */
function servicio(grupo, nombre, precio, duracionMinutos, bufferMin, descripcion) {
  return {
    grupo,
    tipo: "producto",
    nombre,
    precio,
    unidad: null,
    descripcion,
    duracion_minutos: duracionMinutos,
    buffer_min: bufferMin,
    min_por_reserva: 1,
    max_por_reserva: null,
    capacidad_dia: null,
    duracion_horas: null,
    activo: true,
  };
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL CATÁLOGO, TAL CUAL LO MANDÓ EL DUEÑO
 * ════════════════════════════════════════════════════════════════════
 *
 * Los doce servicios y los doce precios salen de la lista de precios de
 * Glow Nails (`uñasglownailscatalogo.jpeg`), leída del propio archivo.
 * Los precios NO se redondearon ni se «ajustaron»: son los que el
 * negocio cobra.
 *
 * ── LAS DURACIONES SÍ SON UNA ESTIMACIÓN, Y HAY QUE DECIRLO ─────────
 *
 * La lista trae PRECIOS, no tiempos. Pero la vertical de citas necesita
 * una duración para poder ofrecer horas: sin ella no hay agenda.
 * Los minutos de acá abajo son estimaciones de oficio para un salón de
 * uñas, puestas para que el negocio arranque reservable — y son lo
 * primero que los dueños van a querer ajustar cuando entren.
 *
 * ── LOS TRES «POR UÑA» NO SON CITAS, Y POR ESO VAN APARTE ───────────
 *
 * «Uña Gel X» (₡1.500) y «Uña Semipermanente» (₡1.000) son el precio de
 * UNA uña suelta — una reparación, no un servicio de una hora. Van en
 * su propio grupo con duración corta para que nadie reserve una cita de
 * hora y media para arreglarse una uña.
 */
const SERVICIOS = [
  // ── Manos ─────────────────────────────────────────────────────────
  servicio("Manos", "Esmaltado regular", 5000, 30, 5,
    "Esmaltado tradicional, sin manicura."),
  servicio("Manos", "Esmaltado semipermanente", 9000, 45, 10,
    "Esmaltado en gel de larga duración, sin manicura."),
  servicio("Manos", "Manicura con esmaltado regular", 12000, 60, 10,
    "Limado, cutícula y esmaltado tradicional."),
  servicio("Manos", "Manicura semipermanente", 15000, 75, 10,
    "Manicura completa con esmaltado en gel de larga duración."),
  servicio("Manos", "Rubber", 14000, 75, 10,
    "Base rubber para dar resistencia y estructura a la uña natural."),
  servicio("Manos", "Gel X", 17500, 90, 15,
    "Extensión completa con sistema Gel X, moldeada a la medida."),

  // ── Pies ──────────────────────────────────────────────────────────
  servicio("Pies", "Pedicura con esmaltado regular", 12000, 60, 15,
    "Pedicura completa con esmaltado tradicional."),
  servicio("Pies", "Pedicura semipermanente", 15000, 75, 15,
    "Pedicura completa con esmaltado en gel de larga duración."),

  // ── Por uña ───────────────────────────────────────────────────────
  servicio("Por uña", "Uña Gel X (una)", 1500, 20, 5,
    "Reparación o colocación de una sola uña en Gel X."),
  servicio("Por uña", "Uña semipermanente (una)", 1000, 15, 5,
    "Reparación o esmaltado de una sola uña."),

  // ── Retiros ───────────────────────────────────────────────────────
  // El 50 % de descuento al combinarlo con otro servicio está en la
  // descripción y no como un precio distinto: el catálogo guarda UN
  // precio por servicio, y un segundo precio «con descuento» sería un
  // servicio fantasma que nadie sabría cuándo reservar.
  servicio("Retiros", "Retiro de semipermanente", 3000, 20, 5,
    "Retiro seguro sin dañar la uña natural. 50 % de descuento si te hacés otro servicio el mismo día."),
  servicio("Retiros", "Retiro de resina o Gel X", 5000, 30, 5,
    "Retiro seguro de resina o Gel X. 50 % de descuento si te hacés otro servicio el mismo día."),
];

/** Horario: lunes a sábado, cerrado domingo. Trabajan con cita previa. */
const HORARIO = {
  "0": null,
  "1": { abre: "09:00", cierra: "18:00" },
  "2": { abre: "09:00", cierra: "18:00" },
  "3": { abre: "09:00", cierra: "18:00" },
  "4": { abre: "09:00", cierra: "18:00" },
  "5": { abre: "09:00", cierra: "18:00" },
  "6": { abre: "09:00", cierra: "16:00" },
};

async function sembrar() {
  console.log("Seed GLOW NAILS STUDIO →", URL_SUPABASE);

  const ownerId = await buscarDueno();
  console.log("· Dueño:", CORREO_DUENO, "→", ownerId);

  // ── Las fotos, primero: la fila las necesita ──────────────────────
  console.log("· Subiendo las fotos del local…");
  const portada = await subirFoto("primerimagen portada.jpeg", "portada.jpg");
  const galeria2 = await subirFoto("WhatsApp Image 2026-08-26 at 9.59.24 AM.jpeg", "local-1.jpg");
  const galeria3 = await subirFoto("WhatsApp Image 2026-08-26 at 9.59.25 AM.jpeg", "local-2.jpg");
  const fotoEstilista = await subirFoto("estilista.jpeg", "estilista.jpg");
  // ⚠️ LA LISTA DE PRECIOS NO SE SUBE, Y ES A PROPÓSITO.
  //
  // Estuvo un rato en la galería y el dueño lo corrigió: ese cartel
  // es MATERIAL DE ORIGEN —de ahí salieron los doce servicios y sus
  // precios— no una foto del local. En la galería competía con las
  // fotos del trabajo y, peor, duplicaba una información que ya vive
  // en el catálogo: el día que suban un precio, el cartel seguiría
  // mostrando el viejo y la ficha diría dos cosas distintas.
  console.log("  ✓ 4 fotos subidas");

  const precioDesde = Math.min(...SERVICIOS.map((s) => s.precio));

  const fila = {
    owner_id: ownerId,
    vertical: "citas",
    // ⚠️ NACE SIN RECLAMAR, Y ESO ES LO QUE LA TARJETA DICE.
    //
    // Lo sembramos nosotros con información pública real: los datos son
    // ciertos, pero adentro no hay nadie de este negocio mirando las
    // reservas. La tarjeta muestra «Info pública» en vez de
    // «Verificado» (migración 0216).
    //
    // Se escribe ACÁ y no se deja al default: el default de la columna
    // es `true` porque el camino normal es un dueño publicando lo suyo.
    // Un seed es la excepción y tiene que decirlo, o al re-correrlo el
    // negocio volvería a nacer como «Verificado» — prometiendo algo que
    // nadie comprobó.
    //
    // Cuando el dueño real lo reclame, un admin lo pasa a `true`.
    reclamado: false,
    estado: "aprobado",
    slug: SLUG,
    nombre: "Glow Nails Studio",
    categoria: "unas",
    // San Antonio de Belén: el cantón es Belén, provincia Heredia.
    provincia: "Heredia",
    canton: "Belén",
    descripcion:
      "Manicura, pedicura, Gel X y rubber — trabajamos con cita previa y materiales esterilizados.",
    descripcion_larga:
      "En Glow Nails Studio cuidamos cada detalle: instrumental esterilizado por clienta, esmaltado semipermanente de larga duración y extensiones en Gel X moldeadas a la medida. Hacemos manicura y pedicura clásica o semipermanente, base rubber para dar estructura a la uña natural, y retiro seguro de resina o Gel X. Trabajamos con cita previa. Aceptamos efectivo, transferencia bancaria y SINPE Móvil.",
    contacto_whatsapp: "+506 7049-7598",
    // ⚠️ ACÁ NO SE INVENTA NADA, Y ESTO ES LA CORRECCIÓN DE HABERLO HECHO.
    //
    // Había puesto wifi, aire acondicionado y pago con tarjeta. Las tres
    // las puse yo porque «suenan» a salón de belleza — ninguna venía en
    // el material que mandó el negocio.
    //
    // Y «pago con tarjeta» era directamente FALSA: la lista de precios
    // dice EFECTIVO, TRANSFERENCIA y SINPE MÓVIL. No tarjeta.
    //
    // Eso es lo que hace grave inventar una amenidad: no es un adorno de
    // más, es una promesa que el negocio nunca hizo y que se la van a
    // reclamar EN EL MOSTRADOR, con la clienta ya sentada y el trabajo
    // hecho. El costo del invento lo paga alguien que no lo cometió.
    //
    // Se sacaron las dos que pidió el dueño el 26 ago 2026.
    //
    // ⚠️ `wifi_clientes` SIGUE ACÁ Y TAMPOCO ESTÁ VERIFICADA — es del
    // mismo invento, solo que no la nombró. Se deja porque pidió dos y
    // no tres, y borrarle una tercera sin avisar es decidir por él.
    // Queda escrito para que se confirme o se caiga.
    amenidades: ["wifi_clientes"],
    // La que el dueño marcó como PRIMERA: es la que se ve en el
    // directorio y encabeza la ficha.
    foto_url: portada,
    // Solo fotos del local y del trabajo. La lista de precios no va
    // acá: los precios los muestra el catálogo, que es el que se
    // edita. Ver arriba.
    fotos: [portada, galeria2, galeria3],
    precio_desde: precioDesde,
    // Sin `demo: true`: este negocio es real. Ver la cabecera.
    detalles: { horario_citas: HORARIO },
  };

  const { data: existente, error: errSel } = await db
    .from("ranchos")
    .select("id, estado")
    .eq("slug", SLUG)
    .maybeSingle();
  if (errSel) throw new Error(`select ${SLUG}: ${errSel.message}`);

  let ranchoId;
  if (existente && existente.estado !== "aprobado") {
    // El trigger `trg_rancho_bloquear_estado` no deja aprobar por
    // UPDATE sin sesión admin: se recrea, igual que el seed de demos.
    const { error: errDel } = await db.from("ranchos").delete().eq("id", existente.id);
    if (errDel) throw new Error(`delete ${SLUG}: ${errDel.message}`);
    console.log(`· ${SLUG} estaba '${existente.estado}' — recreado`);
  }

  if (existente && existente.estado === "aprobado") {
    const { estado: _estado, ...sinEstado } = fila;
    const { error } = await db.from("ranchos").update(sinEstado).eq("id", existente.id);
    if (error) throw new Error(`update ${SLUG}: ${error.message}`);
    ranchoId = existente.id;
    console.log("· Actualizado:", SLUG);
  } else {
    const { data, error } = await db.from("ranchos").insert(fila).select("id").single();
    if (error) throw new Error(`insert ${SLUG}: ${error.message}`);
    ranchoId = data.id;
    console.log("· Creado:", SLUG);
  }

  // ── El equipo ─────────────────────────────────────────────────────
  // Se regenera completo: sus horarios propios caen por cascada.
  const { error: errDelEquipo } = await db.from("equipo_rancho").delete().eq("rancho_id", ranchoId);
  if (errDelEquipo) throw new Error(`delete equipo: ${errDelEquipo.message}`);

  const { error: errEquipo } = await db.from("equipo_rancho").insert([
    {
      rancho_id: ranchoId,
      nombre: "Mariana",
      rol: "Estilista",
      foto_url: fotoEstilista,
      activo: true,
    },
  ]);
  if (errEquipo) throw new Error(`insert equipo: ${errEquipo.message}`);
  console.log("· Equipo: 1 estilista");

  // ── El catálogo ───────────────────────────────────────────────────
  const { error: errDelItems } = await db.from("rancho_items").delete().eq("rancho_id", ranchoId);
  if (errDelItems) throw new Error(`delete items: ${errDelItems.message}`);

  const { error: errItems } = await db
    .from("rancho_items")
    .insert(SERVICIOS.map((s, i) => ({ ...s, rancho_id: ranchoId, orden: i })));
  if (errItems) throw new Error(`insert items: ${errItems.message}`);
  console.log(`· Catálogo: ${SERVICIOS.length} servicios`);

  // ── Comprobación ──────────────────────────────────────────────────
  const { data: verif } = await db
    .from("ranchos")
    .select("slug, nombre, estado, vertical, categoria, precio_desde, rancho_items(count), equipo_rancho(count)")
    .eq("id", ranchoId)
    .single();

  const items = verif?.rancho_items?.[0]?.count ?? 0;
  const equipo = verif?.equipo_rancho?.[0]?.count ?? 0;
  console.log("");
  console.log(`  ${verif?.estado === "aprobado" ? "✓" : "✗"} ${verif?.nombre}`);
  console.log(`    ${URL_SUPABASE.replace(/\/$/, "")} · /${verif?.slug}`);
  console.log(`    ${verif?.vertical}/${verif?.categoria} · ${verif?.estado}`);
  console.log(`    ${items} servicios · ${equipo} del equipo · desde ₡${verif?.precio_desde?.toLocaleString("es-CR")}`);
}

sembrar().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
