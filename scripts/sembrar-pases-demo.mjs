/**
 * SIEMBRA: LOS CUATRO PROGRAMAS DEMO DE /demo.
 *
 *   node scripts/sembrar-pases-demo.mjs           ← siembra o actualiza
 *   node scripts/sembrar-pases-demo.mjs --borrar  ← los quita
 *
 * ------------------------------------------------------------------
 * PARA QUÉ EXISTE
 * ------------------------------------------------------------------
 * La página /demo muestra cuatro pases de lujo dentro de un teléfono y,
 * al lado de cada uno, un QR. Ese QR NO puede ser un dibujo: apunta a
 * `/tarjeta/{slug}`, la misma puerta pública por la que un cliente de un
 * negocio de verdad agrega su tarjeta al Wallet. Para que abra algo,
 * los cuatro programas tienen que EXISTIR en la base — y eso es lo
 * único que hace este archivo.
 *
 * Si nunca se corre, /demo no queda rota: la página le pregunta a la
 * base si el programa está emitiendo (`src/app/demo/estado-tarjetas.ts`)
 * y, si no lo está, manda el QR a /lealtad/crear rotulado «pase de
 * ejemplo». O sea: correr esto MEJORA la demo, no la desbloquea.
 *
 * ------------------------------------------------------------------
 * LOS CUATRO NEGOCIOS SON FICTICIOS, Y NO SALEN AL DIRECTORIO
 * ------------------------------------------------------------------
 * Nacen en estado 'pendiente' y con `en_marketplace = false`, que es
 * exactamente como nace un cliente "solo lealtad" de verdad
 * (`src/app/lealtad/nuevo/actions.ts`): un negocio de Lealtad no se
 * ofreció como proveedor del marketplace y no tiene ficha que mostrar.
 * Con eso, ninguno de los cuatro aparece en /eventos ni en ninguna
 * búsqueda pública, pero su /tarjeta/{slug} sí funciona — esa ruta lee
 * con la llave de servicio justamente porque los negocios de Lealtad
 * viven fuera del directorio.
 *
 * QUÉ LOS MARCA COMO DEMO. Dos cosas, las dos internas:
 *   · `ranchos.detalles.demo = true` — la convención que ya usan los
 *     demás sembrados de prueba del repo, y la que mira una limpieza.
 *   · `programa_lealtad.nombre = "[DEMO] …"` — visible SOLO en el panel
 *     del negocio.
 *
 * Lo que NO se toca es `ranchos.nombre`: ese string es el que el cliente
 * lee en la pantalla de la tarjeta Y en el pase de su teléfono
 * (`organizationName` del pass.json). Un «[DEMO]» ahí le arruinaría el
 * pase a la persona a la que se le está vendiendo el producto, que es
 * justo lo contrario de lo que esta demo busca.
 *
 * ------------------------------------------------------------------
 * IDEMPOTENTE
 * ------------------------------------------------------------------
 * Se puede correr las veces que haga falta. Los negocios se buscan por
 * `slug` y los programas por `rancho_id`: si ya existen se ACTUALIZAN en
 * su sitio y nunca se recrean — el `id` del programa es la llave de los
 * pases que ya estén en el teléfono de alguien, y borrarlo dejaría esos
 * pases mudos.
 *
 * El `estado` no viaja en los UPDATE a propósito: el trigger
 * `trg_rancho_bloquear_estado` (0008) lo revertiría igual sin sesión
 * admin, y mandarlo daría la falsa impresión de que se está cambiando.
 *
 * ------------------------------------------------------------------
 * ⚠️ ESPEJO DE `src/app/demo/datos-pases.ts`
 * ------------------------------------------------------------------
 * Un `.mjs` no puede importar TypeScript, así que `slug`, `regalia`,
 * `meta`, `colorFondo` y `colorSello` están repetidos en los dos
 * archivos. Si cambia uno, hay que cambiar el otro y volver a correr
 * este script: si no, el QR lleva a una tarjeta que promete una regalía
 * distinta de la que se ve dibujada al lado.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ── Las llaves, del .env.local ──────────────────────────────────────

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

const BORRAR = process.argv.includes("--borrar");

// ── La cuenta dueña ─────────────────────────────────────────────────
// Mismo criterio que el resto de las cuentas *.demo@bookea.lat del
// repo: una sola cuenta técnica es dueña de los cuatro negocios demo.

const CORREO_DEMO = "lealtad.demo@bookea.lat";
const PASSWORD_DEMO = "Bookea-demo-2026!";

// ── LOS CUATRO ──────────────────────────────────────────────────────
// `vertical` decide en qué familia del panel cae el negocio. Los cuatro
// son operación de mostrador, así que van como 'citas' salvo la
// cafetería, que es 'restaurantes' — es lo que `crearGratisAlInstante`
// haría con el mismo dato.

const PASES = [
  {
    slug: "demo-cafeteria",
    nombre: "Tostaduría Media Luna",
    vertical: "restaurantes",
    descripcion: "Cafetería de especialidad — negocio de demostración de Bookea Lealtad.",
    regalia: "El café número 10 va por la casa",
    detalleRegalia: "Un sello por cada café; a los 10 sellos, el siguiente lo invita la casa.",
    meta: 10,
    colorFondo: "#24120B",
    colorSello: "#E3B04B",
    icono: "cafe",
  },
  {
    slug: "demo-belleza",
    nombre: "Studio Aura Nails",
    vertical: "citas",
    descripcion: "Sala de belleza y uñas — negocio de demostración de Bookea Lealtad.",
    regalia: "Manicure en gel de cortesía",
    detalleRegalia: "Un sello por servicio; al llegar a 10, la manicure en gel va de cortesía.",
    meta: 10,
    colorFondo: "#4A0E39",
    colorSello: "#FF4F97",
    icono: "unas",
  },
  {
    slug: "demo-lavacar",
    nombre: "Aqua Detail",
    vertical: "citas",
    descripcion: "Lavacar y estética automotriz — negocio de demostración de Bookea Lealtad.",
    regalia: "Lavado premium con cera de gratis",
    detalleRegalia: "10 lavados sellados y el siguiente es premium con cera, cortesía de la casa.",
    meta: 10,
    colorFondo: "#07425F",
    colorSello: "#7FF2D8",
    icono: "auto",
  },
  {
    slug: "demo-courier",
    nombre: "Ruta Express CR",
    vertical: "citas",
    descripcion: "Mensajería y paquetería — negocio de demostración de Bookea Lealtad.",
    regalia: "1 envío nacional gratis",
    detalleRegalia: "Un sello por cada envío pagado. Al décimo, el envío corre por cuenta de la casa.",
    meta: 10,
    colorFondo: "#0B1526",
    colorSello: "#F7A827",
    icono: "regalo",
  },
];

/**
 * Las columnas de `ranchos` que dependen de una migración que puede no
 * estar pegada en este entorno. Si el INSERT rebota nombrando una de
 * ellas, se quita y se reintenta: vale más un negocio demo sin
 * `plan_lealtad` que un seed que no corre.
 *
 * `en_marketplace` está a propósito PRIMERA en la lista de las que se
 * intentan y ÚLTIMA en soltarse: es la que mantiene los cuatro fuera
 * del directorio público.
 */
const COLUMNAS_OPCIONALES = [
  "plan_lealtad",
  "lealtad_aprobado_en",
  "lealtad_aprobado_por",
  "tipo_negocio",
  "en_marketplace",
];

const MODULOS_OPERATIVOS = ["agenda", "servicios", "equipo", "recursos", "pagos"];

async function asegurarOwner() {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers: " + error.message);
    const usuario = data.users.find((u) => (u.email || "").toLowerCase() === CORREO_DEMO);
    if (usuario) return usuario.id;
    if (data.users.length < 200) break;
  }
  console.log(`· La cuenta ${CORREO_DEMO} no existe — creándola…`);
  const { data, error } = await db.auth.admin.createUser({
    email: CORREO_DEMO,
    password: PASSWORD_DEMO,
    email_confirm: true,
    user_metadata: { nombre: "Lealtad Demo Bookea" },
  });
  if (error) throw new Error("createUser: " + error.message);
  return data.user.id;
}

/** INSERT tolerante: suelta columnas opcionales que la base no tenga. */
async function insertarNegocio(fila) {
  const intento = { ...fila };
  for (let i = 0; i <= COLUMNAS_OPCIONALES.length; i++) {
    const { data, error } = await db.from("ranchos").insert(intento).select("id, slug").single();
    if (!error) return data;

    const faltante = COLUMNAS_OPCIONALES.find(
      (c) => c in intento && error.message.includes(c),
    );
    if (!faltante) throw new Error(`insert ${fila.slug}: ${error.message}`);
    console.log(`  · la base no tiene la columna "${faltante}" — se sigue sin ella`);
    delete intento[faltante];
  }
  throw new Error(`insert ${fila.slug}: no se pudo ni soltando las columnas opcionales`);
}

async function apagarModulos(ranchoId) {
  const { error } = await db.from("modulos_negocio").upsert(
    MODULOS_OPERATIVOS.map((modulo) => ({ rancho_id: ranchoId, modulo, activo: false })),
    { onConflict: "rancho_id,modulo" },
  );
  if (error) console.warn(`  · no se pudieron apagar los módulos: ${error.message}`);
}

async function encenderAddon(ranchoId, nombre) {
  const { error } = await db.from("addons_negocio").upsert(
    {
      rancho_id: ranchoId,
      addon: "lealtad",
      activo: true,
      // Sin vencimiento: es utilería de demostración, no una prueba que
      // haya que cortarle a nadie.
      vence_en: null,
      activado_en: new Date().toISOString(),
      notas: `Pase demo de /demo — ${nombre} (negocio ficticio)`,
    },
    { onConflict: "rancho_id,addon" },
  );
  if (error) console.warn(`  · no se pudo encender el add-on de lealtad: ${error.message}`);
}

/** El programa y su regalía. Nunca recrea: actualiza en su sitio. */
async function sembrarPrograma(ranchoId, pase) {
  const programa = {
    nombre: `[DEMO] ${pase.nombre}`,
    modo: "sellos",
    puntos_por_visita: 1,
    puntos_por_colon: 0,
    activo: true,
    estado: "activo",
    pase_color_fondo: pase.colorFondo,
    pase_color_sello: pase.colorSello,
    // El icono adentro del sello (0145). Si la columna no existe se
    // vuelve a intentar sin ella.
    pase_sello_icono: pase.icono,
    beneficio: {
      tipo: "sellos",
      requeridos: pase.meta,
      recompensa: pase.regalia,
      inicial: 0,
      repetible: true,
      sellosPor: "compra",
      montoPorSello: null,
    },
  };

  const { data: existente } = await db
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", ranchoId)
    .limit(1)
    .maybeSingle();

  let programaId;
  if (existente) {
    programaId = existente.id;
    await actualizarPrograma(programaId, programa);
    console.log("  · programa actualizado (mismo id: los pases ya emitidos siguen valiendo)");
  } else {
    const conNegocio = { rancho_id: ranchoId, ...programa };
    programaId = await insertarPrograma(conNegocio);
    console.log("  · programa creado");
  }

  // La regalía: es de donde sale la META de la tarjeta (`metaDeSellos`),
  // no de una columna del programa.
  const recompensa = {
    nombre: pase.regalia,
    descripcion: pase.detalleRegalia,
    costo_puntos: pase.meta,
    orden: 0,
    activo: true,
  };
  const { data: premio } = await db
    .from("recompensas")
    .select("id")
    .eq("programa_id", programaId)
    .eq("nombre", recompensa.nombre)
    .maybeSingle();

  if (premio) {
    const { error } = await db.from("recompensas").update(recompensa).eq("id", premio.id);
    if (error) throw new Error(`recompensa ${pase.slug}: ${error.message}`);
    console.log("  · regalía actualizada");
  } else {
    const { error } = await db
      .from("recompensas")
      .insert({ programa_id: programaId, ...recompensa });
    if (error) throw new Error(`recompensa ${pase.slug}: ${error.message}`);
    console.log("  · regalía creada");
  }

  return programaId;
}

/**
 * Las columnas del programa que dependen de una migración posterior a
 * la 0060 y que este entorno puede no tener: si rebotan, se sueltan.
 */
const COLUMNAS_PROGRAMA_OPCIONALES = ["pase_sello_icono", "beneficio", "estado"];

async function insertarPrograma(fila) {
  const intento = { ...fila };
  for (let i = 0; i <= COLUMNAS_PROGRAMA_OPCIONALES.length; i++) {
    const { data, error } = await db
      .from("programa_lealtad")
      .insert(intento)
      .select("id")
      .single();
    if (!error) return data.id;
    const faltante = COLUMNAS_PROGRAMA_OPCIONALES.find(
      (c) => c in intento && error.message.includes(c),
    );
    if (!faltante) throw new Error(`programa: ${error.message}`);
    console.log(`  · la base no tiene la columna "${faltante}" — se sigue sin ella`);
    delete intento[faltante];
  }
  throw new Error("programa: no se pudo ni soltando las columnas opcionales");
}

async function actualizarPrograma(programaId, fila) {
  const intento = { ...fila };
  for (let i = 0; i <= COLUMNAS_PROGRAMA_OPCIONALES.length; i++) {
    const { error } = await db.from("programa_lealtad").update(intento).eq("id", programaId);
    if (!error) return;
    const faltante = COLUMNAS_PROGRAMA_OPCIONALES.find(
      (c) => c in intento && error.message.includes(c),
    );
    if (!faltante) throw new Error(`programa: ${error.message}`);
    console.log(`  · la base no tiene la columna "${faltante}" — se sigue sin ella`);
    delete intento[faltante];
  }
  throw new Error("programa: no se pudo ni soltando las columnas opcionales");
}

// ── BORRAR ──────────────────────────────────────────────────────────

async function borrarTodo() {
  console.log("Borrando los negocios demo de /demo →", URL_SUPABASE);
  for (const pase of PASES) {
    const { data: negocio } = await db
      .from("ranchos")
      .select("id, nombre")
      .eq("slug", pase.slug)
      .maybeSingle();
    if (!negocio) {
      console.log(`· ${pase.slug} — no existía`);
      continue;
    }
    // `programa_lealtad` y `recompensas` caen en cascada (0060).
    const { error } = await db.from("ranchos").delete().eq("id", negocio.id);
    if (error) {
      console.error(`· ${pase.slug} — no se pudo borrar: ${error.message}`);
      continue;
    }
    console.log(`· ${pase.slug} — borrado (${negocio.nombre})`);
  }
  console.log("\nListo. En /demo los cuatro QR vuelven solos a «pase de ejemplo».");
}

// ── SEMBRAR ─────────────────────────────────────────────────────────

async function sembrar() {
  console.log("Seed PASES DEMO →", URL_SUPABASE);
  const ownerId = await asegurarOwner();
  console.log("· Owner:", CORREO_DEMO, "→", ownerId);

  for (const pase of PASES) {
    console.log(`\n· ${pase.nombre}  (/tarjeta/${pase.slug})`);

    const { data: existente, error: errSel } = await db
      .from("ranchos")
      .select("id, estado")
      .eq("slug", pase.slug)
      .maybeSingle();
    if (errSel) throw new Error(`select ${pase.slug}: ${errSel.message}`);

    const comunes = {
      nombre: pase.nombre,
      slug: pase.slug,
      vertical: pase.vertical,
      categoria: "otros",
      provincia: "San José",
      canton: "San José",
      descripcion: pase.descripcion,
      // La marca de "esto es sembrado": interna, nunca en el nombre que
      // el cliente lee en su pase.
      detalles: { demo: true, producto_bookea: "lealtad_demo" },
      // Fuera del directorio público: un cliente de Lealtad no se
      // ofreció como proveedor del marketplace.
      en_marketplace: false,
      plan_lealtad: "prueba",
    };

    let ranchoId;
    if (existente) {
      // Sin `estado`: el trigger lo revertiría igual y mandarlo daría la
      // falsa impresión de que se está cambiando.
      const { error } = await db.from("ranchos").update(comunes).eq("id", existente.id);
      if (error) throw new Error(`update ${pase.slug}: ${error.message}`);
      ranchoId = existente.id;
      console.log(`  · negocio actualizado (estado '${existente.estado}')`);
      if (existente.estado === "aprobado") {
        console.warn(
          "  ⚠ este negocio quedó APROBADO en algún momento: sale en el directorio público.",
        );
        console.warn(
          "    Bajalo a 'pendiente' desde el admin, o borralo con --borrar y volvé a sembrar.",
        );
      }
    } else {
      const creado = await insertarNegocio({
        ...comunes,
        owner_id: ownerId,
        // PENDIENTE, y es la línea que mantiene los cuatro demo fuera
        // del directorio del marketplace.
        estado: "pendiente",
        lealtad_aprobado_en: new Date().toISOString(),
        lealtad_aprobado_por: null,
      });
      ranchoId = creado.id;
      console.log("  · negocio creado en estado 'pendiente' (fuera del directorio)");
    }

    await apagarModulos(ranchoId);
    await encenderAddon(ranchoId, pase.nombre);
    await sembrarPrograma(ranchoId, pase);
  }

  console.log("\n──────────────────────────────────────────────────────");
  console.log("Listo. Los cuatro QR de /demo ya abren tarjetas de verdad:");
  for (const pase of PASES) {
    console.log(`  https://www.bookea.lat/tarjeta/${pase.slug}   → ${pase.nombre}`);
  }
  console.log("\nRecordá que los cuatro negocios son FICTICIOS y viven en");
  console.log("estado 'pendiente': no salen en ningún directorio público.");
}

try {
  if (BORRAR) await borrarTodo();
  else await sembrar();
} catch (e) {
  console.error("\n✗", e instanceof Error ? e.message : e);
  process.exit(1);
}
