/**
 * SIEMBRA: CAFÉ OSCURO.
 *
 * La cafetería del dueño, con su carta completa, en la vertical de
 * restaurantes. Queda pública en /restaurantes/cafeoscuro.
 *
 *   node scripts/seed-cafe-oscuro.mjs           ← siembra o actualiza
 *   node scripts/seed-cafe-oscuro.mjs --borrar  ← la quita entera
 *
 * ------------------------------------------------------------------
 * POR QUÉ ACTUALIZA EN VEZ DE RECREAR
 * ------------------------------------------------------------------
 * El seed de la barbería borra y vuelve a crear el negocio en cada
 * corrida. Acá no: el `id` del rancho es la llave del chat, de las
 * visitas y de la tarjeta de lealtad, así que recrearlo cortaría todo
 * eso cada vez que se ajuste un precio. Si el negocio ya existe se
 * ACTUALIZA en su sitio y solo la carta se rehace completa — que es
 * la forma simple de que quitar un plato de este archivo lo quite de
 * verdad de la base.
 *
 * La excepción es el negocio que quedó en un estado distinto de
 * 'aprobado': el trigger de `ranchos` no deja aprobar por UPDATE sin
 * sesión de admin, así que en ese caso sí hay que recrearlo (el mismo
 * tropiezo que documenta seed-demo-restaurantes.mjs).
 *
 * ------------------------------------------------------------------
 * DE DÓNDE SALE QUE LA PÁGINA SE VEA DISTINTA
 * ------------------------------------------------------------------
 * De `detalles.tema_ficha = "carta"`, no de un `if` por slug en el
 * código. La ficha de /restaurantes/[slug] lee ese campo y arma la
 * versión editorial (serif, una columna, portada a sangre). Cualquier
 * otro local puede pedir lo mismo cambiando su jsonb.
 *
 * ------------------------------------------------------------------
 * ES DATO SEMBRADO Y SE DECLARA
 * ------------------------------------------------------------------
 * `detalles.demo = true` y `detalles.sembrado = "cafe-oscuro"`: el día
 * que haya que limpiar la base o cuadrar ingresos, nadie tiene que
 * adivinar si esta cafetería es un cliente que paga.
 *
 * Los PRECIOS son de mercado costarricense para una cafetería de
 * especialidad (2026), no rellenos: espresso ₡1.500, capuchino
 * ₡2.600, desayuno ₡4.600. El dueño los corrige desde su panel →
 * Catálogo cuando quiera; volver a correr el seed los devuelve a
 * estos.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const CORREO_DUENO = "luchoherrera15@gmail.com";
const NOMBRE = "Café Oscuro";
const SLUG = "cafeoscuro";

// ── El entorno ────────────────────────────────────────────────────
// Rutas desde la raíz del repo y no desde el directorio actual: así el
// seed corre igual desde /scripts que desde la raíz.
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BORRAR = process.argv.includes("--borrar");

/**
 * Las fotos. Son de Unsplash, el mismo host que ya usan los demos de
 * la landing de Lealtad y el único remoto —junto a Supabase y
 * Cloudflare— que `next.config.ts` autoriza para `next/image`. La
 * portada es un interior oscuro a propósito: el nombre del local va
 * encima, en blanco, sobre un velo del 70%.
 */
const PORTADA =
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1600&q=70";
const GALERIA = [
  PORTADA,
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=70",
];

/**
 * El horario, en el formato de `horario_restaurante` que fijó la 0076
 * (el mismo de citas): clave "0" = domingo … "6" = sábado, y null el
 * día que cierra. Una cafetería abre temprano y cierra temprano: el
 * fuerte es el desayuno, no la cena.
 */
const HORARIO = {
  0: { abre: "08:00", cierra: "14:00" },
  1: null,
  2: { abre: "07:00", cierra: "18:00" },
  3: { abre: "07:00", cierra: "18:00" },
  4: { abre: "07:00", cierra: "18:00" },
  5: { abre: "07:00", cierra: "19:00" },
  6: { abre: "08:00", cierra: "19:00" },
};

/**
 * LA CARTA.
 *
 * El orden del archivo ES el orden de la página (`orden` se numera
 * solo más abajo) y `grupo` es lo que la agrupa en secciones. Va de lo
 * que más se pide a lo que menos: primero la barra de espresso, que es
 * el 70% de las órdenes de una mañana, y de último el grano en bolsa,
 * que se lleva quien ya se quedó.
 *
 * `unidad` solo donde de verdad hace falta aclarar qué se lleva uno
 * por ese precio (un chemex es para dos, una bolsa son 340 g).
 */
const CARTA = [
  // ── Espresso ────────────────────────────────────────────────────
  {
    grupo: "Espresso",
    nombre: "Espresso",
    descripcion: "Doble ristretto de la mezcla de la casa: Tarrazú y natural de Pérez Zeledón.",
    precio: 1500,
  },
  {
    grupo: "Espresso",
    nombre: "Espresso doble",
    descripcion: "El mismo, en taza grande, para quien la mañana empezó temprano.",
    precio: 1900,
  },
  {
    grupo: "Espresso",
    nombre: "Americano",
    descripcion: "Espresso alargado con agua caliente. Se sirve sin leche, y sin discusión.",
    precio: 1800,
  },
  {
    grupo: "Espresso",
    nombre: "Cortado",
    descripcion: "Espresso con un dedo de leche vaporizada. En vaso de vidrio.",
    precio: 2100,
  },
  {
    grupo: "Espresso",
    nombre: "Capuchino",
    descripcion: "Un tercio espresso, un tercio leche, un tercio espuma. Como manda.",
    precio: 2600,
  },
  {
    grupo: "Espresso",
    nombre: "Latte",
    descripcion: "Leche entera texturizada sobre doble espresso, con dibujo si sale.",
    precio: 2900,
  },
  {
    grupo: "Espresso",
    nombre: "Flat white",
    descripcion: "Más café y menos espuma que el latte: para el que quiere sentir el grano.",
    precio: 2900,
  },
  {
    grupo: "Espresso",
    nombre: "Mocha",
    descripcion: "Espresso, leche y chocolate semiamargo derretido a mano, no en polvo.",
    precio: 3300,
  },

  // ── Métodos ─────────────────────────────────────────────────────
  {
    grupo: "Métodos",
    nombre: "V60",
    descripcion: "Filtrado a mano, taza por taza. Preguntá cuál grano hay hoy en la barra.",
    precio: 3200,
    unidad: "una taza",
  },
  {
    grupo: "Métodos",
    nombre: "Chemex",
    descripcion: "Doce minutos de goteo lento. Sale limpio, dulce y alcanza para dos.",
    precio: 5400,
    unidad: "para dos",
  },
  {
    grupo: "Métodos",
    nombre: "Prensa francesa",
    descripcion: "Inmersión de cuatro minutos: más cuerpo, más aceites, menos filtro.",
    precio: 3600,
    unidad: "para dos",
  },

  // ── Fríos ───────────────────────────────────────────────────────
  {
    grupo: "Fríos",
    nombre: "Cold brew",
    descripcion: "Dieciocho horas en agua fría. Sin acidez y con el doble de cafeína.",
    precio: 3100,
  },
  {
    grupo: "Fríos",
    nombre: "Latte helado",
    descripcion: "Doble espresso sobre hielo y leche fría, servido en vaso alto.",
    precio: 3200,
  },
  {
    grupo: "Fríos",
    nombre: "Affogato",
    descripcion: "Una bola de helado de vainilla ahogada en espresso recién sacado.",
    precio: 3500,
  },
  {
    grupo: "Fríos",
    nombre: "Tónica de café",
    descripcion: "Cold brew con agua tónica, hielo y una rueda de naranja. Suena raro, funciona.",
    precio: 3700,
  },

  // ── Sin café ────────────────────────────────────────────────────
  {
    grupo: "Sin café",
    nombre: "Chai latte",
    descripcion: "Té negro cocinado con canela, cardamomo y jengibre, colado a la orden.",
    precio: 3100,
  },
  {
    grupo: "Sin café",
    nombre: "Chocolate caliente",
    descripcion: "Cacao de Upala derretido en leche, espeso, sin azúcar agregada.",
    precio: 2900,
  },
  {
    grupo: "Sin café",
    nombre: "Té de la casa",
    descripcion: "Negro, verde o de hierbas del día, en tetera individual.",
    precio: 2200,
  },

  // ── Repostería ──────────────────────────────────────────────────
  {
    grupo: "Repostería",
    nombre: "Croissant de mantequilla",
    descripcion: "Hojaldre de tres días de reposo, horneado a las cinco de la mañana.",
    precio: 1900,
  },
  {
    grupo: "Repostería",
    nombre: "Pain au chocolat",
    descripcion: "El mismo hojaldre, con dos barras de chocolate semiamargo adentro.",
    precio: 2300,
  },
  {
    grupo: "Repostería",
    nombre: "Roll de canela",
    descripcion: "Tibio, con glaseado de queso crema. Se acaban antes de las diez.",
    precio: 2600,
  },
  {
    grupo: "Repostería",
    nombre: "Queque de banano y nuez",
    descripcion: "Con banano bien maduro y nuez tostada. Una rebanada gruesa.",
    precio: 2200,
  },
  {
    grupo: "Repostería",
    nombre: "Brownie de chocolate 70%",
    descripcion: "Denso por dentro, costra fina por fuera. Sin harina.",
    precio: 2500,
  },
  {
    grupo: "Repostería",
    nombre: "Queque de zanahoria",
    descripcion: "Especiado, con betún de queso crema y nuez picada encima.",
    precio: 2900,
  },

  // ── Desayunos ───────────────────────────────────────────────────
  {
    grupo: "Desayunos",
    nombre: "Gallo pinto de la casa",
    descripcion: "Con huevo al gusto, natilla, queso turrialba y plátano maduro.",
    precio: 4600,
  },
  {
    grupo: "Desayunos",
    nombre: "Huevos revueltos con masa madre",
    descripcion: "Tres huevos cremosos sobre dos tostadas de nuestro pan, con mantequilla.",
    precio: 4300,
  },
  {
    grupo: "Desayunos",
    nombre: "Tostada de aguacate",
    descripcion: "Masa madre, aguacate machacado, limón, chile dulce asado y huevo pochado.",
    precio: 4900,
  },
  {
    grupo: "Desayunos",
    nombre: "Granola de la casa",
    descripcion: "Tostada con miel de café, yogurt natural y la fruta de la semana.",
    precio: 3900,
  },
  {
    grupo: "Desayunos",
    nombre: "Tostadas francesas",
    descripcion: "Pan brioche, miel de café y mantequilla batida. Alcanza para compartir.",
    precio: 5200,
  },

  // ── Salados ─────────────────────────────────────────────────────
  {
    grupo: "Salados",
    nombre: "Sándwich de jamón serrano",
    descripcion: "En baguette del día, con queso manchego, tomate seco y rúcula.",
    precio: 5400,
  },
  {
    grupo: "Salados",
    nombre: "Panini de pollo y pesto",
    descripcion: "Pollo asado, pesto de albahaca y mozzarella, prensado hasta que chorree.",
    precio: 5600,
  },
  {
    grupo: "Salados",
    nombre: "Quiche del día",
    descripcion: "Lo que haya salido esa mañana, con ensalada verde y vinagreta de mostaza.",
    precio: 4500,
  },
  {
    grupo: "Salados",
    nombre: "Bagel de salmón ahumado",
    descripcion: "Queso crema con eneldo, alcaparras, cebolla morada y salmón ahumado acá.",
    precio: 6900,
  },

  // ── El grano ────────────────────────────────────────────────────
  {
    grupo: "El grano",
    nombre: "Tarrazú honey",
    descripcion: "Tueste medio, notas de panela y mandarina. Lo molemos como lo necesités.",
    precio: 7800,
    unidad: "bolsa 340 g",
  },
  {
    grupo: "El grano",
    nombre: "Natural de Pérez Zeledón",
    descripcion: "Secado en cereza, tueste oscuro. El que va en la mezcla del espresso.",
    precio: 8400,
    unidad: "bolsa 340 g",
  },
];

/** El negocio, tal como queda en `ranchos`. */
const NEGOCIO = {
  vertical: "restaurantes",
  // De las 18 categorías de la vertical (0076), la que le toca.
  categoria: "cafeteria",
  nombre: NOMBRE,
  slug: SLUG,
  descripcion:
    "Tostador y cafetería en Barrio Escalante. Tostamos cada semana grano de Tarrazú y " +
    "de Pérez Zeledón, y lo servimos en espresso, V60 o chemex.",
  descripcion_larga:
    "Empezamos con un tostador de tres kilos en el fondo del local y la idea de que un " +
    "café oscuro no tiene por qué ser amargo. Compramos el grano directo a fincas de " +
    "Tarrazú y de Pérez Zeledón, lo tostamos los martes y no lo servimos después de tres " +
    "semanas. El pan, la repostería y el pinto salen de la misma cocina, todas las mañanas.",
  provincia: "San José",
  canton: "San José",
  direccion_exacta:
    "Barrio Escalante, calle 33, 100 m norte de la iglesia Santa Teresita, casa esquinera de ladrillo",
  // Barrio Escalante. De acá salen los enlaces a Maps y Waze de la ficha.
  latitud: 9.9337,
  longitud: -84.0641,
  pais: "CR",
  zona_horaria: "America/Costa_Rica",
  estado: "aprobado",
  // Lo más barato de la carta: es lo que promete la tarjeta del directorio.
  precio_desde: 1500,
  contacto_whatsapp: "+506 8363-3805",
  foto_url: PORTADA,
  fotos: GALERIA,
  amenidades: ["wifi_clientes", "parqueo", "pago_tarjeta", "aire_acondicionado"],
  detalles: {
    demo: true,
    sembrado: "cafe-oscuro",
    // El tema editorial de la ficha (ver src/app/restaurantes/tipos.ts).
    tema_ficha: "carta",
    rango_precio: 2,
    // Nadie reserva mesa para un café; para llevar sí se pide todo el día.
    acepta_reserva_mesa: false,
    acepta_pickup: true,
    horario_restaurante: HORARIO,
  },
};

async function main() {
  // ── El dueño ────────────────────────────────────────────────────
  const { data: users, error: errUsers } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (errUsers) throw new Error("listUsers: " + errUsers.message);
  const dueno = users.users.find((u) => (u.email ?? "").toLowerCase() === CORREO_DUENO);
  if (!dueno) throw new Error(`No existe la cuenta ${CORREO_DUENO}.`);

  // ── ¿Ya estaba? ─────────────────────────────────────────────────
  const { data: previo, error: errSel } = await db
    .from("ranchos")
    .select("id, estado")
    .eq("slug", SLUG)
    .maybeSingle();
  if (errSel) throw new Error("buscar el negocio: " + errSel.message);

  if (BORRAR) {
    if (!previo) {
      console.log("No había nada que borrar.");
      return;
    }
    // `on delete cascade` se lleva la carta. Las reservas no cuelgan
    // del rancho por cascada, así que van aparte.
    await db.from("reservas").delete().eq("rancho_id", previo.id);
    const { error } = await db.from("ranchos").delete().eq("id", previo.id);
    if (error) throw new Error("borrar: " + error.message);
    console.log(`🗑  ${NOMBRE} eliminado por completo.`);
    return;
  }

  let ranchoId;
  if (previo && previo.estado !== "aprobado") {
    // El trigger de `ranchos` no deja aprobar por UPDATE sin sesión de
    // admin: la única salida es recrearlo.
    const { error } = await db.from("ranchos").delete().eq("id", previo.id);
    if (error) throw new Error("recrear: " + error.message);
    console.log(`· estaba en '${previo.estado}' — se recrea desde cero`);
  }

  if (previo && previo.estado === "aprobado") {
    // `estado` fuera del update, por lo mismo de arriba.
    const { estado: _estado, ...sinEstado } = NEGOCIO;
    const { error } = await db
      .from("ranchos")
      .update({ ...sinEstado, owner_id: dueno.id })
      .eq("id", previo.id);
    if (error) throw new Error("actualizar el negocio: " + error.message);
    ranchoId = previo.id;
    console.log(`· ${NOMBRE} ya existía — actualizado en su sitio`);
  } else {
    const { data: creado, error } = await db
      .from("ranchos")
      .insert({ ...NEGOCIO, owner_id: dueno.id })
      .select("id")
      .single();
    if (error) throw new Error("crear el negocio: " + error.message);
    ranchoId = creado.id;
    console.log(`· ${NOMBRE} creado`);
  }

  // ── La carta ────────────────────────────────────────────────────
  // Se rehace completa: así, quitar un plato de este archivo lo quita
  // también de la base.
  const { error: errLimpiar } = await db
    .from("rancho_items")
    .delete()
    .eq("rancho_id", ranchoId);
  if (errLimpiar) throw new Error("limpiar la carta: " + errLimpiar.message);

  const { error: errItems } = await db.from("rancho_items").insert(
    CARTA.map((p, i) => ({
      rancho_id: ranchoId,
      grupo: p.grupo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      unidad: p.unidad ?? null,
      // `rancho_items_tipo_check` (0050) solo acepta paquete|producto:
      // un plato es un producto del catálogo.
      tipo: "producto",
      activo: true,
      min_por_reserva: 1,
      // El orden del archivo es el orden de la página.
      orden: i + 1,
    })),
  );
  if (errItems) throw new Error("la carta: " + errItems.message);

  // ── Resumen ─────────────────────────────────────────────────────
  const grupos = [...new Set(CARTA.map((p) => p.grupo))];
  const precios = CARTA.map((p) => p.precio);

  console.log(`\n✅ ${NOMBRE} sembrado`);
  console.log(`   negocio    ${ranchoId}`);
  console.log(`   secciones  ${grupos.length} · ${grupos.join(", ")}`);
  console.log(`   líneas     ${CARTA.length}`);
  console.log(
    `   precios    ₡${Math.min(...precios).toLocaleString("es-CR")} – ₡${Math.max(
      ...precios,
    ).toLocaleString("es-CR")}`,
  );
  console.log(`\n   público    /restaurantes/${SLUG}`);
  console.log(`   panel      /mi-negocio/${ranchoId}`);
}

main().catch((e) => {
  console.error("\n❌", e.message);
  if (/violates check constraint|categoria_check|vertical_check/i.test(e.message)) {
    console.error("\n→ Falta correr la migración 0076_vertical_restaurantes.sql en Supabase.");
  }
  process.exit(1);
});
