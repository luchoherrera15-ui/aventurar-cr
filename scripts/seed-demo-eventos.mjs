/**
 * Seed de negocios DEMO para la vertical de EVENTOS.
 *
 * Crea 2 negocios completamente configurados por cada categoría de
 * servicios (alimentación, animación, organización, decoración, otros):
 * modalidad de cobro en `detalles`, catálogo nutrido en `rancho_items`
 * (grupos, paquetes/productos, cupos por día), depósito con SINPE y
 * cupo de eventos por día. Todos con slug "demo-…" (el sitio les pinta
 * el badge Demo) y detalles.demo = true, a nombre de la cuenta
 * negocios.demo@bookea.lat.
 *
 * Idempotente: si el slug ya existe, actualiza la fila y regenera su
 * catálogo (no duplica). Nota: el trigger trg_rancho_bloquear_estado
 * impide cambiar `estado` en UPDATE (is_admin() es false con la service
 * key), así que si una fila demo quedara en otro estado, se borra y se
 * reinserta ya aprobada.
 *
 * Uso:  node scripts/seed-demo-eventos.mjs
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

// ---------- La cuenta dueña de los demos ----------

const CORREO_DEMO = "negocios.demo@bookea.lat";
const PASSWORD_DEMO = "BookeaDemo2026!";

async function asegurarOwner() {
  // Buscar por email paginando el admin API (no hay getUserByEmail).
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers: " + error.message);
    const usuario = data.users.find(
      (u) => (u.email || "").toLowerCase() === CORREO_DEMO,
    );
    if (usuario) return usuario.id;
    if (data.users.length < 200) break;
  }
  console.log(`· La cuenta ${CORREO_DEMO} no existe — creándola…`);
  const { data, error } = await db.auth.admin.createUser({
    email: CORREO_DEMO,
    password: PASSWORD_DEMO,
    email_confirm: true,
    user_metadata: { nombre: "Negocios Demo Bookea" },
  });
  if (error) throw new Error("createUser: " + error.message);
  return data.user.id;
}

// ---------- Helpers para armar el catálogo ----------

/** Ítem del catálogo con defaults sanos. */
function item(grupo, tipo, nombre, precio, unidad, descripcion, extra = {}) {
  return {
    grupo,
    tipo,
    nombre,
    precio,
    unidad,
    descripcion,
    min_por_reserva: 1,
    max_por_reserva: null,
    capacidad_dia: null,
    duracion_horas: null,
    activo: true,
    ...extra,
  };
}

const unsplash = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;

// ---------- Los 10 negocios ----------
//
// Nota de taxonomía: en el código real photo_booth pertenece a
// "organizacion" (src/app/mi-rancho/types.tsx), no a "animacion".
// Por eso animación lleva DJ + animación infantil, y organización
// lleva wedding/event planner + photo booth. El planner cubre también
// eventos corporativos con su grupo de paquetes corporativos.

const NEGOCIOS = [
  // ================= ALIMENTACIÓN =================
  {
    slug: "demo-sabores-del-valle-catering",
    nombre: "Sabores del Valle Catering",
    categoria: "alimentacion",
    subcategoria: "catering",
    provincia: "San José",
    canton: "Santa Ana",
    descripcion:
      "Catering completo por persona: buffet, meseros, vajilla y montaje incluidos.",
    descripcion_larga:
      "Más de 12 años sirviendo bodas, corporativos y fiestas familiares en el Valle Central. Nuestra tarifa por persona incluye buffet de dos platos fuertes a elección, guarniciones, refresco natural, vajilla completa, meseros uniformados y montaje/desmontaje. Hacemos degustación previa para que armés tu menú sin sorpresas, con opciones vegetarianas, veganas y sin gluten.",
    precio_desde: 9500,
    unidad_precio: "persona",
    deposito_reserva: 50000,
    eventos_por_dia: 3,
    contacto_whatsapp: "+506 8811-0101",
    sinpe_numero: "8811-0101",
    sinpe_titular: "Marcela Vindas Rojas",
    foto_url: unsplash("photo-1555244162-803834f70033"),
    fotos: [
      unsplash("photo-1555244162-803834f70033"),
      unsplash("photo-1414235077428-338989a2e8c0"),
    ],
    detalles: {
      demo: true,
      modalidad_cobro: "por_persona",
      tarifa_persona: 9500,
      minimo_personas: 20,
      especialidades:
        "Comida típica, cocina internacional, buffets y estaciones para bodas y corporativos",
      incluye_personal: true,
      incluye_vajilla: true,
      incluye_mobiliario: false,
      incluye_montaje: true,
      hace_degustacion: true,
      dietas: ["vegetariano", "vegano", "sin_gluten"],
      zonas: ["San José", "Heredia", "Alajuela", "Cartago"],
      costo_traslado: 20000,
      anticipacion_dias: 7,
    },
    items: [
      item("Bocas y entradas", "producto", "Ceviche de corvina en vasito", 1500, "por persona", "Corvina fresca con chips de plátano verde."),
      item("Bocas y entradas", "producto", "Empanaditas de queso y frijol", 900, "por persona", "Dos unidades por persona, con natilla casera."),
      item("Bocas y entradas", "producto", "Canapés de pollo y tocineta", 1200, "por persona", "Surtido frío y caliente."),
      item("Bocas y entradas", "producto", "Bocadillos surtidos (docena)", 6500, "por docena", "Mix dulce y salado para la mesa de recepción."),
      item("Bocas y entradas", "producto", "Tabla de quesos y embutidos", 28000, "por unidad", "Para 10-12 personas, con pan artesanal y mermeladas."),
      item("Platos fuertes", "producto", "Pollo en salsa de mostaza y miel", null, "elección del menú", "Incluido en la tarifa por persona."),
      item("Platos fuertes", "producto", "Cerdo BBQ ahumado", null, "elección del menú", "Incluido en la tarifa por persona."),
      item("Platos fuertes", "producto", "Arroz con pollo clásico", null, "elección del menú", "Incluido en la tarifa por persona — el infaltable tico."),
      item("Platos fuertes", "producto", "Casado tico completo", null, "elección del menú", "Incluido en la tarifa por persona."),
      item("Platos fuertes", "producto", "Pasta Alfredo con pollo", null, "elección del menú", "Incluido en la tarifa por persona."),
      item("Platos fuertes", "producto", "Lasaña de carne", null, "elección del menú", "Incluido en la tarifa por persona."),
      item("Platos fuertes", "producto", "Lasaña de vegetales (vegetariana)", null, "elección del menú", "Incluido en la tarifa por persona."),
      item("Platos fuertes", "producto", "Curry de garbanzos (vegano)", null, "elección del menú", "Incluido en la tarifa por persona."),
      item("Platos fuertes", "producto", "Lomito en salsa de hongos", 1800, "por persona (upgrade)", "Upgrade sobre la tarifa base."),
      item("Platos fuertes", "producto", "Costilla en salsa BBQ", 1500, "por persona (upgrade)", "Upgrade sobre la tarifa base."),
      item("Platos fuertes", "producto", "Camarones al ajillo", 2500, "por persona (upgrade)", "Upgrade sobre la tarifa base."),
      item("Estaciones", "paquete", "Estación de café y postres", 85000, "por evento", "Barra de café chorreado con mini postres, 3 horas de servicio.", { capacidad_dia: 2, max_por_reserva: 1, duracion_horas: 3, foto_url: unsplash("photo-1495474472287-4d71bcdd2085") }),
      item("Estaciones", "paquete", "Mesa dulce decorada", 95000, "por evento", "60 porciones entre mini postres, brownies y frutas.", { capacidad_dia: 2, max_por_reserva: 1 }),
      item("Estaciones", "paquete", "Estación de ceviche en vivo", 120000, "por evento", "Cevichero preparando al momento, hasta 80 personas.", { capacidad_dia: 1, max_por_reserva: 1 }),
      item("Postres", "producto", "Tres leches individual", 1200, "por persona", "El clásico, en porción individual."),
      item("Postres", "producto", "Flan de coco", 1000, "por persona", "Receta de la abuela."),
      item("Postres", "producto", "Mini cheesecake de frutos rojos", 1100, "por persona", null),
      item("Postres", "producto", "Queque de la casa (25 porciones)", 25000, "por unidad", "Vainilla, chocolate o zanahoria."),
      item("Bebidas", "producto", "Refresco natural (jarra 2 L)", 3500, "por unidad", "Cas, tamarindo, limón con hierbabuena."),
      item("Bebidas", "producto", "Té frío (jarra 2 L)", 3500, "por unidad", null),
      item("Bebidas", "producto", "Agua embotellada", 700, "por unidad", null),
    ],
  },
  {
    slug: "demo-nube-verde-matcha-coffee-bar",
    nombre: "Nube Verde · Matcha & Coffee Bar",
    categoria: "alimentacion",
    subcategoria: "barra_matcha",
    provincia: "San José",
    canton: "Montes de Oca",
    descripcion:
      "Barra móvil de matcha ceremonial y café de especialidad, con barista incluido.",
    descripcion_larga:
      "Llevamos una barra completa de café de especialidad y matcha ceremonial a tu boda, baby shower o evento corporativo. El paquete base incluye 2 horas de servicio, barista profesional, máquina de espresso, menú impreso y bebidas ilimitadas del menú (estimamos 3 bebidas por persona). Podés extender por hora y sumar leches vegetales, repostería o vasos personalizados con el nombre de tu evento.",
    precio_desde: 160000,
    unidad_precio: "evento",
    deposito_reserva: 30000,
    eventos_por_dia: 2,
    contacto_whatsapp: "+506 8811-0202",
    sinpe_numero: "8811-0202",
    sinpe_titular: "Daniela Chaves Mora",
    foto_url: unsplash("photo-1536256263959-770b48d82b0a"),
    fotos: [
      unsplash("photo-1536256263959-770b48d82b0a"),
      unsplash("photo-1495474472287-4d71bcdd2085"),
    ],
    detalles: {
      demo: true,
      modalidad_cobro: "por_evento",
      tarifa_evento: 160000,
      duracion_horas: 2,
      hora_extra: 45000,
      especialidades:
        "Matcha ceremonial grado A, café de especialidad de Tarrazú, bebidas frías y calientes",
      incluye_personal: true,
      incluye_vajilla: true,
      incluye_montaje: true,
      hace_degustacion: false,
      dietas: ["vegano", "sin_lactosa", "sin_azucar"],
      zonas: ["San José", "Heredia", "Cartago"],
      costo_traslado: 15000,
      anticipacion_dias: 5,
    },
    items: [
      item("Barras", "paquete", "Barra clásica · 2 horas · hasta 50 personas", 160000, "por evento", "Espresso, capuchino, latte y matcha latte ilimitados, barista incluido.", { capacidad_dia: 2, max_por_reserva: 1, duracion_horas: 2, foto_url: unsplash("photo-1495474472287-4d71bcdd2085") }),
      item("Barras", "paquete", "Barra premium · 3 horas · hasta 100 personas", 235000, "por evento", "Todo el menú + bebidas frías, dos baristas y barra iluminada.", { capacidad_dia: 1, max_por_reserva: 1, duracion_horas: 3 }),
      item("Barras", "paquete", "Barra matcha ceremonial · 2 horas", 185000, "por evento", "Matcha batido a mano frente a tus invitados, caliente o frío.", { capacidad_dia: 1, max_por_reserva: 1, duracion_horas: 2 }),
      item("Menú de bebidas", "producto", "Espresso / americano", null, "incluida en la barra", "Café de Tarrazú recién molido."),
      item("Menú de bebidas", "producto", "Capuchino y latte", null, "incluida en la barra", "Con arte latte."),
      item("Menú de bebidas", "producto", "Matcha latte (caliente o frío)", null, "incluida en la barra", "Matcha ceremonial grado A."),
      item("Menú de bebidas", "producto", "Iced vanilla latte", null, "incluida en la barra", null),
      item("Menú de bebidas", "producto", "Chai latte", null, "incluida en la barra", null),
      item("Menú de bebidas", "producto", "Cold brew", null, "incluida en la barra", "12 horas de extracción en frío."),
      item("Menú de bebidas", "producto", "Chocolate caliente artesanal", null, "incluida en la barra", "Con cacao costarricense."),
      item("Extras", "producto", "Leches vegetales (almendra y avena)", 15000, "por evento", "Para todas las bebidas del evento."),
      item("Extras", "producto", "Vasos personalizados (50 unidades)", 25000, "por evento", "Con el nombre y fecha de tu evento."),
      item("Extras", "producto", "Barista adicional", 35000, "por evento", "Recomendado para más de 80 personas."),
      item("Extras", "producto", "Estación de repostería (24 unidades)", 18000, "por evento", "Croissants, galletas y brownies."),
      item("Extras", "producto", "Toppings y siropes premium", 12000, "por evento", "Caramelo salado, lavanda, canela y más."),
    ],
  },

  // ================= ANIMACIÓN =================
  {
    slug: "demo-discomovil-la-central",
    nombre: "Discomóvil La Central",
    categoria: "animacion",
    subcategoria: "dj_discomovil",
    provincia: "Cartago",
    canton: "Cartago",
    descripcion:
      "DJ + sonido profesional en paquete de 4 horas, con upgrades de luces y pantalla.",
    descripcion_larga:
      "Quince años poniendo a bailar bodas, quinces y fiestas de empresa. El paquete base incluye DJ profesional, sonido para hasta 250 personas, micrófono inalámbrico y cabina, durante 4 horas. Podés subirle luces de pista con láser, o irte al montaje premium con pantalla LED, máquina de humo y maestro de ceremonias. Nos reunimos antes del evento para armar el repertorio a tu gusto: cumbia, salsa, merengue, reggaetón y música de plancha garantizada.",
    precio_desde: 180000,
    unidad_precio: "evento",
    deposito_reserva: 40000,
    eventos_por_dia: 2,
    contacto_whatsapp: "+506 8811-0303",
    sinpe_numero: "8811-0303",
    sinpe_titular: "José Pablo Brenes Mata",
    foto_url: unsplash("photo-1470225620780-dba8ba36b745"),
    fotos: [
      unsplash("photo-1470225620780-dba8ba36b745"),
      unsplash("photo-1492684223066-81342ee5ff30"),
    ],
    detalles: {
      demo: true,
      modalidad_cobro: "por_paquete",
      tarifa_evento: 180000,
      duracion_horas: 4,
      hora_extra: 35000,
      integrantes: 2,
      repertorio:
        "Cumbia, salsa, merengue, reggaetón, pop, rock en español y música de plancha",
      equipo: ["sonido", "luces", "microfonos", "cabina", "maquina_humo"],
      requiere_electricidad: true,
      requiere_techo: true,
      espacio_minimo: "3x3 metros para la cabina",
      demo_url: "https://www.instagram.com/discomovillacentral",
      zonas: ["San José", "Cartago", "Heredia"],
      costo_traslado: 20000,
      anticipacion_dias: 10,
    },
    items: [
      item("Montajes", "paquete", "Montaje básico · DJ + sonido · 4 horas", null, "incluido en el paquete base", "DJ, sonido para 250 personas, micrófono y cabina. Es lo que cubre la tarifa base.", { max_por_reserva: 1, duracion_horas: 4, foto_url: unsplash("photo-1470225620780-dba8ba36b745") }),
      item("Montajes", "paquete", "Upgrade de luces · pista + láser", 45000, "por evento", "8 cabezas móviles, láser y luz UV sobre la tarifa base.", { max_por_reserva: 1 }),
      item("Montajes", "paquete", "Upgrade premium · pantalla LED + humo + MC", 95000, "por evento", "Pantalla LED de 2×1.5 m, máquina de humo y maestro de ceremonias.", { max_por_reserva: 1, capacidad_dia: 1 }),
      item("Extras", "producto", "Chispas frías (par de máquinas)", 40000, "por evento", "Para la entrada o el primer baile."),
      item("Extras", "producto", "Máquina de humo bajo (nube)", 35000, "por evento", "El efecto de bailar sobre nubes."),
      item("Extras", "producto", "Karaoke con pantalla", 25000, "por evento", "Catálogo de más de 3.000 canciones."),
      item("Extras", "producto", "Sonido aparte para la ceremonia", 30000, "por evento", "Bocina, micrófono y música ambiente en otra área."),
      item("Extras", "producto", "Micrófono adicional inalámbrico", 8000, "por evento", null),
    ],
  },
  {
    slug: "demo-tico-kids-shows",
    nombre: "Tico Kids · Shows y Animación",
    categoria: "animacion",
    subcategoria: "animacion_infantil",
    provincia: "Alajuela",
    canton: "Alajuela",
    descripcion:
      "Shows infantiles, pintacaritas y mini discoteca: 2 horas de fiesta dirigida.",
    descripcion_larga:
      "Animamos fiestas infantiles con dos animadores profesionales: show de personajes, juegos dirigidos, concursos con premios y mini discoteca con espuma de jabón apta para niños. La tarifa base cubre 2 horas de animación continua con nuestro propio sonido; podés sumar pintacaritas, globoflexia, brincolín o el carrito de algodón de azúcar. Trabajamos con niños de 3 a 10 años y llevamos todo el material.",
    precio_desde: 85000,
    unidad_precio: "evento",
    deposito_reserva: 20000,
    eventos_por_dia: 3,
    contacto_whatsapp: "+506 8811-0404",
    sinpe_numero: "8811-0404",
    sinpe_titular: "Karina Solís Vargas",
    foto_url: unsplash("photo-1464349153735-7db50ed83c84"),
    fotos: [
      unsplash("photo-1464349153735-7db50ed83c84"),
      unsplash("photo-1472653431158-6364773b2a56"),
    ],
    detalles: {
      demo: true,
      modalidad_cobro: "por_evento",
      tarifa_evento: 85000,
      duracion_horas: 2,
      hora_extra: 25000,
      integrantes: 2,
      edades: "De 3 a 10 años",
      repertorio:
        "Show de personajes, juegos dirigidos, mini discoteca kids y concursos con premios",
      equipo: ["sonido", "microfonos"],
      requiere_electricidad: true,
      requiere_techo: false,
      espacio_minimo: "4x4 metros para el show",
      demo_url: "https://www.instagram.com/ticokidscr",
      zonas: ["San José", "Alajuela", "Heredia"],
      costo_traslado: 12000,
      anticipacion_dias: 7,
    },
    items: [
      item("Shows", "paquete", "Show de personajes · 1 hora", 55000, "por evento", "Personaje del tema de la fiesta con coreografías y juegos.", { max_por_reserva: 1, duracion_horas: 1, capacidad_dia: 3 }),
      item("Shows", "paquete", "Show de magia infantil · 45 min", 60000, "por evento", "Magia participativa con paloma y final sorpresa.", { max_por_reserva: 1, capacidad_dia: 2 }),
      item("Shows", "paquete", "Mini discoteca kids · 1 hora", 45000, "por evento", "Luces, humo bajo apto para niños y coreografías.", { max_por_reserva: 1, duracion_horas: 1, capacidad_dia: 2 }),
      item("Complementos", "producto", "Pintacaritas (por hora)", 25000, "por hora", "Diseños de fantasía con pinturas hipoalergénicas."),
      item("Complementos", "producto", "Globoflexia (por hora)", 25000, "por hora", "Figuras de globos para cada niño."),
      item("Complementos", "producto", "Piñata dirigida y juegos", 15000, "por evento", "Coordinamos la piñata para que nadie salga llorando."),
      item("Complementos", "producto", "Brincolín inflable (por día)", 55000, "por día", "3×3 m, incluye traslado y supervisión.", { capacidad_dia: 2 }),
      item("Complementos", "producto", "Carrito de algodón de azúcar (50 porciones)", 40000, "por evento", "Con azúcar de colores.", { capacidad_dia: 1 }),
    ],
  },

  // ================= ORGANIZACIÓN =================
  {
    slug: "demo-eventos-con-alma-planners",
    nombre: "Eventos con Alma · Wedding & Event Planners",
    categoria: "organizacion",
    subcategoria: "wedding_planner",
    provincia: "San José",
    canton: "Escazú",
    descripcion:
      "Coordinación del día B, organización parcial o completa — bodas y corporativos.",
    descripcion_larga:
      "Somos un estudio de planificación de bodas y eventos corporativos. Elegí tu paquete según cuánta ayuda necesitás: coordinación del día B (entramos 6 semanas antes y dirigimos todo el día), organización parcial (los últimos meses: proveedores faltantes, cronograma y montaje) u organización completa de la A a la Z con diseño y control de presupuesto. Para empresas producimos lanzamientos, fiestas de fin de año y team buildings con logística y staff incluidos.",
    precio_desde: 375000,
    unidad_precio: "evento",
    deposito_reserva: 100000,
    eventos_por_dia: 1,
    contacto_whatsapp: "+506 8811-0505",
    sinpe_numero: "8811-0505",
    sinpe_titular: "Adriana Castro León",
    foto_url: unsplash("photo-1519741497674-611481863552"),
    fotos: [
      unsplash("photo-1519741497674-611481863552"),
      unsplash("photo-1465495976277-4387d4b0b4c6"),
    ],
    detalles: {
      demo: true,
      modalidad_cobro: "por_unidad",
      diseno_personalizado: true,
      muestra_previa: true,
      incluye_edicion: false,
      entrega_digital: true,
      portafolio_url: "https://www.instagram.com/eventosconalmacr",
      zonas: ["San José", "Alajuela", "Cartago", "Heredia", "Guanacaste", "Puntarenas", "Limón"],
      anticipacion_dias: 30,
    },
    items: [
      item("Paquetes de boda", "paquete", "Coordinación del día B", 375000, "por evento", "Entramos 6 semanas antes: repaso de contratos, cronograma minuto a minuto, ensayo y dirección completa del día con dos coordinadoras.", { max_por_reserva: 1, capacidad_dia: 1, foto_url: unsplash("photo-1519741497674-611481863552") }),
      item("Paquetes de boda", "paquete", "Organización parcial", 750000, "por evento", "Los últimos 4 meses: cerramos proveedores faltantes, diseño de montaje, seating plan y coordinación del día.", { max_por_reserva: 1, capacidad_dia: 1 }),
      item("Paquetes de boda", "paquete", "Organización completa", 1500000, "por evento", "De la A a la Z: presupuesto, diseño, contratación de todos los proveedores, invitados y dirección del día.", { max_por_reserva: 1, capacidad_dia: 1 }),
      item("Eventos corporativos", "paquete", "Producción de evento corporativo", 650000, "por evento", "Lanzamientos y fiestas de empresa: locación, producción técnica, staff, catering y agenda del evento.", { max_por_reserva: 1, capacidad_dia: 1 }),
      item("Eventos corporativos", "paquete", "Coordinación de actividad de empresa", 350000, "por evento", "Team buildings y celebraciones internas hasta 150 personas.", { max_por_reserva: 1, capacidad_dia: 1 }),
      item("Extras", "producto", "Reunión adicional de seguimiento", 25000, "por unidad", "Presencial o virtual, fuera de las incluidas en tu paquete."),
      item("Extras", "producto", "Coordinación de rehearsal dinner", 90000, "por evento", "La cena de ensayo, resuelta."),
      item("Extras", "producto", "Asistente extra el día del evento", 45000, "por unidad", "Recomendado para más de 200 invitados."),
    ],
  },
  {
    slug: "demo-flash-cabina-photobooth",
    nombre: "Flash Cabina · Photobooth",
    categoria: "organizacion",
    subcategoria: "photo_booth",
    provincia: "Heredia",
    canton: "Heredia",
    descripcion:
      "Photobooth por hora (mínimo 2): props, impresiones ilimitadas y galería digital.",
    descripcion_larga:
      "Cabina de fotos abierta con iluminación profesional, asistente durante todo el servicio, caja de props temáticos, impresiones ilimitadas al momento y galería digital para descargar después del evento. Cobramos por hora con mínimo de 2 horas; también hay paquetes de 3 y 4 horas con mejor precio y una segunda estación para eventos grandes. La plantilla de impresión se personaliza con los nombres y la fecha de tu evento.",
    precio_desde: 45000,
    unidad_precio: "hora",
    deposito_reserva: 25000,
    eventos_por_dia: 2,
    contacto_whatsapp: "+506 8811-0606",
    sinpe_numero: "8811-0606",
    sinpe_titular: "Luis Diego Araya Campos",
    foto_url: unsplash("photo-1526170375885-4d8ecf77b99f"),
    fotos: [
      unsplash("photo-1526170375885-4d8ecf77b99f"),
      unsplash("photo-1514525253161-7a46d19cd819"),
    ],
    detalles: {
      demo: true,
      modalidad_cobro: "por_hora",
      tarifa_hora: 45000,
      horas_minimas: 2,
      diseno_personalizado: true,
      muestra_previa: true,
      incluye_edicion: true,
      entrega_digital: true,
      portafolio_url: "https://www.instagram.com/flashcabinacr",
      zonas: ["San José", "Heredia", "Alajuela", "Cartago"],
      costo_traslado: 15000,
      anticipacion_dias: 5,
    },
    items: [
      item("Paquetes", "paquete", "Cabina · 3 horas", 125000, "por evento", "Asistente, props, impresiones ilimitadas y galería digital. Ahorrás ₡10.000 vs. la tarifa por hora.", { max_por_reserva: 1, duracion_horas: 3, capacidad_dia: 2, foto_url: unsplash("photo-1526170375885-4d8ecf77b99f") }),
      item("Paquetes", "paquete", "Cabina · 4 horas", 160000, "por evento", "El paquete favorito para bodas: cubre cóctel y fiesta.", { max_por_reserva: 1, duracion_horas: 4, capacidad_dia: 2 }),
      item("Paquetes", "paquete", "Segunda estación · 3 horas", 110000, "por evento", "Otra cabina en simultáneo para eventos de más de 150 personas.", { max_por_reserva: 1, duracion_horas: 3, capacidad_dia: 1 }),
      item("Extras", "producto", "Libro de firmas con copia de cada foto", 18000, "por evento", "Tus invitados pegan su foto y te dejan un mensaje."),
      item("Extras", "producto", "Props premium temáticos", 10000, "por evento", "A juego con el tema de tu fiesta."),
      item("Extras", "producto", "Backdrop personalizado con diseño", 25000, "por evento", "Fondo impreso con tu diseño o logo."),
      item("Extras", "producto", "Plantilla de impresión personalizada", 15000, "por evento", "Diseño exclusivo con nombres y fecha."),
      item("Extras", "producto", "Copias impresas adicionales (100)", 20000, "por evento", "Para que cada invitado se lleve la suya."),
      item("Extras", "producto", "GIFs y boomerangs digitales", 15000, "por evento", "Listos para compartir en redes al instante."),
    ],
  },

  // ================= DECORACIÓN =================
  {
    slug: "demo-ambiente-bonito-decoracion",
    nombre: "Ambiente Bonito Decoración",
    categoria: "decoracion",
    subcategoria: "decoracion_eventos",
    provincia: "San José",
    canton: "Curridabat",
    descripcion:
      "Arcos orgánicos, backdrops y montajes temáticos completos con montaje incluido.",
    descripcion_larga:
      "Decoramos cumpleaños, baby showers y bodas íntimas: arcos orgánicos de globos, backdrops con rotulación, montajes temáticos completos y detalles de mesa. Todos los montajes incluyen instalación y desmontaje; elegí del catálogo y armá tu decoración con precios claros. Los diseños se personalizan en colores y tema — mandanos tu inspiración por el chat después de reservar.",
    precio_desde: 85000,
    unidad_precio: "evento",
    deposito_reserva: 25000,
    eventos_por_dia: 3,
    contacto_whatsapp: "+506 8811-0707",
    sinpe_numero: "8811-0707",
    sinpe_titular: "Pamela Quirós Jiménez",
    foto_url: unsplash("photo-1530103862676-de8c9debad1d"),
    fotos: [
      unsplash("photo-1530103862676-de8c9debad1d"),
      unsplash("photo-1478146896981-b80fe463b330"),
    ],
    detalles: {
      demo: true,
      modalidad: "ambos",
      modalidad_cobro: "por_unidad",
      inventario:
        "Arcos orgánicos, backdrops de madera y acrílico, cilindros, faroles, números gigantes y centros de mesa",
      incluye_montaje: true,
      incluye_desmontaje: true,
      deposito_garantia: 20000,
      tiempo_alquiler: "Montaje y desmontaje el mismo día del evento",
      zonas: ["San José", "Heredia", "Cartago"],
      costo_traslado: 18000,
      anticipacion_dias: 10,
    },
    items: [
      item("Arcos y fondos", "paquete", "Arco orgánico de globos (2 m)", 85000, "por evento", "Hasta 4 colores a elección, instalado en sitio.", { capacidad_dia: 3, foto_url: unsplash("photo-1530103862676-de8c9debad1d") }),
      item("Arcos y fondos", "paquete", "Arco + backdrop con rotulación", 125000, "por evento", "Fondo circular o cuadrado con el nombre del festejado.", { capacidad_dia: 2 }),
      item("Arcos y fondos", "paquete", "Backdrop de flores artificiales", 95000, "por evento", "Pared floral de 2×2 m, ideal para fotos.", { capacidad_dia: 2 }),
      item("Arcos y fondos", "paquete", "Túnel de globos para la entrada", 145000, "por evento", "6 metros de globos que reciben a tus invitados.", { capacidad_dia: 1 }),
      item("Montajes completos", "paquete", "Decoración fiesta infantil temática", 185000, "por evento", "Arco, backdrop del tema, mesa del queque decorada y detalles.", { capacidad_dia: 2, max_por_reserva: 1 }),
      item("Montajes completos", "paquete", "Montaje cumpleaños adulto", 155000, "por evento", "Globos metálicos, luces cálidas y mesa principal.", { capacidad_dia: 2, max_por_reserva: 1 }),
      item("Montajes completos", "paquete", "Decoración baby shower", 145000, "por evento", "Arco en tonos pastel, mesa de recuerdos y letrero.", { capacidad_dia: 2, max_por_reserva: 1 }),
      item("Detalles", "producto", "Centro de mesa floral", 8500, "por unidad", "Flores naturales de temporada."),
      item("Detalles", "producto", "Cilindros con luz LED (par)", 12000, "por unidad", null),
      item("Detalles", "producto", "Número gigante iluminado", 18000, "por unidad", "1.2 m de alto, por dígito.", { capacidad_dia: 4 }),
      item("Detalles", "producto", "Bouquet de globos con helio", 9500, "por unidad", "5 globos látex + 1 metálico."),
      item("Detalles", "producto", "Letrero neón (Oh Baby / Happy Birthday)", 22000, "por evento", "Alquiler por el día del evento.", { capacidad_dia: 2 }),
    ],
  },
  {
    slug: "demo-alquileres-el-roble",
    nombre: "Alquileres El Roble",
    categoria: "decoracion",
    subcategoria: "sillas_mesas",
    provincia: "Alajuela",
    canton: "Grecia",
    descripcion:
      "Alquiler de sillas, mesas, toldos y mantelería con transporte y montaje incluidos.",
    descripcion_larga:
      "Todo el mobiliario para tu evento en un solo lugar: 300 sillas, 40 mesas, toldos de varios tamaños, tarimas, pista de baile y mantelería completa. El precio es por unidad por día de evento e incluye transporte, montaje y desmontaje dentro de nuestra zona de cobertura. El catálogo muestra cuántas unidades quedan libres para tu fecha — reservá con seguridad de que el inventario está apartado.",
    precio_desde: 15000,
    unidad_precio: "evento",
    deposito_reserva: 20000,
    eventos_por_dia: 5,
    monto_minimo: 15000,
    contacto_whatsapp: "+506 8811-0808",
    sinpe_numero: "8811-0808",
    sinpe_titular: "Gerardo Alfaro Bolaños",
    foto_url: unsplash("photo-1519167758481-83f550bb49b3"),
    fotos: [
      unsplash("photo-1519167758481-83f550bb49b3"),
      unsplash("photo-1464366400600-7168b8af9bc3"),
    ],
    detalles: {
      demo: true,
      modalidad: "alquiler",
      modalidad_cobro: "por_unidad",
      inventario:
        "300 sillas plegables, 100 sillas Tiffany, 40 mesas redondas, 20 rectangulares, 8 toldos, tarimas y pista de baile",
      minimo_pedido: 10,
      incluye_montaje: true,
      incluye_desmontaje: true,
      deposito_garantia: 30000,
      tiempo_alquiler: "24 horas (fines de semana se coordina la recogida el lunes)",
      zonas: ["Alajuela", "San José", "Heredia"],
      costo_traslado: 15000,
      anticipacion_dias: 3,
    },
    items: [
      item("Sillas y mesas", "producto", "Silla plegable blanca", 800, "por unidad / día", "Con o sin cubresilla.", { min_por_reserva: 10, capacidad_dia: 300 }),
      item("Sillas y mesas", "producto", "Silla Tiffany cristal o dorada", 2000, "por unidad / día", "Para bodas y eventos formales.", { min_por_reserva: 10, capacidad_dia: 100 }),
      item("Sillas y mesas", "producto", "Mesa redonda (8 personas)", 4500, "por unidad / día", null, { capacidad_dia: 40 }),
      item("Sillas y mesas", "producto", "Mesa rectangular (10 personas)", 5000, "por unidad / día", null, { capacidad_dia: 20 }),
      item("Sillas y mesas", "producto", "Mesa cocktail alta", 6000, "por unidad / día", "Con forro y lazo del color que elijás.", { capacidad_dia: 15 }),
      item("Toldos y pisos", "paquete", "Toldo 3×3 m", 35000, "por unidad / día", "Blanco, con instalación incluida.", { capacidad_dia: 4, foto_url: unsplash("photo-1519167758481-83f550bb49b3") }),
      item("Toldos y pisos", "paquete", "Toldo 6×6 m", 65000, "por unidad / día", "Para 60 personas sentadas.", { capacidad_dia: 2 }),
      item("Toldos y pisos", "paquete", "Tarima 2.4×2.4 m", 45000, "por unidad / día", "Modular, altura 40 cm.", { capacidad_dia: 2 }),
      item("Toldos y pisos", "paquete", "Pista de baile 4×4 m", 85000, "por unidad / día", "Piso laminado blanco y negro.", { capacidad_dia: 1, max_por_reserva: 1 }),
      item("Mantelería y vajilla", "producto", "Mantel redondo hasta el piso", 1500, "por unidad / día", "Blanco, marfil o del color de tu evento.", { capacidad_dia: 60 }),
      item("Mantelería y vajilla", "producto", "Cubresilla con lazo", 700, "por unidad / día", null, { min_por_reserva: 10, capacidad_dia: 200 }),
      item("Mantelería y vajilla", "producto", "Set de vajilla completa", 1200, "por persona / día", "Plato, cubiertos y servilleta de tela.", { min_por_reserva: 10, capacidad_dia: 300 }),
      item("Mantelería y vajilla", "producto", "Cristalería (copa agua + vino)", 800, "por persona / día", null, { min_por_reserva: 10, capacidad_dia: 300 }),
    ],
  },

  // ================= OTROS SERVICIOS =================
  {
    slug: "demo-humo-rosa-o-celeste",
    nombre: "Humo Rosa o Celeste · Revelaciones",
    categoria: "otros",
    subcategoria: "revelacion_sexo",
    provincia: "Heredia",
    canton: "Belén",
    descripcion:
      "Revelaciones de sexo llave en mano: cañones de humo, globo gigante y coordinación secreta.",
    descripcion_larga:
      "Organizamos el momento más esperado sin que se filtre el secreto: coordinamos directamente con el doctor o con la persona de confianza, llegamos con todo montado y disparamos la sorpresa. El paquete base incluye 2 cañones de humo gigantes, globo de revelación, música del momento y coordinación completa. Sumale fuegos fríos, varitas de humo para los invitados, video con drone o la mini mesa dulce temática.",
    precio_desde: 65000,
    unidad_precio: "evento",
    deposito_reserva: 20000,
    eventos_por_dia: 3,
    contacto_whatsapp: "+506 8811-0909",
    sinpe_numero: "8811-0909",
    sinpe_titular: "Nazareth Ulate Herrera",
    foto_url: unsplash("photo-1513151233558-d860c5398176"),
    fotos: [
      unsplash("photo-1513151233558-d860c5398176"),
      unsplash("photo-1481162854517-d9e353af153d"),
    ],
    detalles: {
      demo: true,
      modalidad_cobro: "por_paquete",
      tarifa_evento: 65000,
      duracion_horas: 1,
      que_incluye:
        "Coordinación secreta, 2 cañones de humo gigantes, globo de revelación con confeti y música para el momento",
      capacidad_cantidad: "Hasta 3 revelaciones por día",
      zonas: ["San José", "Heredia", "Alajuela", "Cartago"],
      costo_traslado: 10000,
      anticipacion_dias: 5,
    },
    items: [
      item("Upgrades", "paquete", "Fuegos fríos para el momento", 35000, "por evento", "Dos máquinas de chispas frías sincronizadas con la revelación.", { max_por_reserva: 1, capacidad_dia: 2 }),
      item("Upgrades", "paquete", "Globo gigante 4 pies con confeti", 18000, "por evento", "Se revienta y llueve rosa o celeste.", { capacidad_dia: 3 }),
      item("Extras", "producto", "Cañón de humo adicional", 8000, "por unidad", "Biodegradable, humo denso de 30 segundos."),
      item("Extras", "producto", "Cañón de confeti biodegradable", 7500, "por unidad", null),
      item("Extras", "producto", "Kit de 20 varitas de humo para invitados", 25000, "por unidad", "Para que todos disparen a la vez — la foto queda increíble."),
      item("Extras", "producto", "Letras BABY iluminadas", 22000, "por evento", "1 m de alto, alquiler por el evento.", { capacidad_dia: 2 }),
      item("Extras", "producto", "Video del momento con drone", 45000, "por evento", "Clip editado de 60 segundos, entrega en 48 horas."),
      item("Extras", "producto", "Mini mesa dulce temática", 55000, "por evento", "30 porciones en rosa y celeste."),
    ],
  },
  {
    slug: "demo-busetas-la-carreta",
    nombre: "Busetas La Carreta · Transporte de Invitados",
    categoria: "otros",
    subcategoria: "transporte",
    provincia: "San José",
    canton: "Desamparados",
    descripcion:
      "Busetas y autobús con conductor por bloque de 4 horas — nadie maneja después de la fiesta.",
    descripcion_larga:
      "Trasladamos a tus invitados a bodas, despedidas y fiestas de empresa: unidades modernas con aire acondicionado y conductor profesional. Cada unidad se contrata por bloque de 4 horas que incluye conductor, combustible dentro del GAM y el tiempo de espera durante la actividad. Podés sumar horas, un segundo viaje la misma noche o la decoración de la unidad para bodas. Fuera del GAM cotizamos el trayecto por el chat.",
    precio_desde: 85000,
    unidad_precio: "evento",
    deposito_reserva: 25000,
    eventos_por_dia: 2,
    contacto_whatsapp: "+506 8811-1010",
    sinpe_numero: "8811-1010",
    sinpe_titular: "Randall Mora Solano",
    foto_url: unsplash("photo-1449965408869-eaa3f722e40d"),
    fotos: [
      unsplash("photo-1449965408869-eaa3f722e40d"),
      unsplash("photo-1469854523086-cc02fe5d8800"),
    ],
    detalles: {
      demo: true,
      modalidad_cobro: "por_unidad",
      que_incluye:
        "Conductor profesional, combustible dentro del GAM y tiempo de espera durante la actividad",
      capacidad_cantidad: "2 busetas de 15, 1 microbús de 28 y 1 autobús de 42 pasajeros",
      zonas: ["San José", "Alajuela", "Cartago", "Heredia", "Guanacaste", "Puntarenas", "Limón"],
      anticipacion_dias: 3,
    },
    items: [
      item("Unidades (bloque de 4 horas)", "paquete", "Buseta 15 pasajeros", 85000, "por bloque", "Con conductor y esperas incluidas dentro del GAM.", { capacidad_dia: 2, duracion_horas: 4, foto_url: unsplash("photo-1449965408869-eaa3f722e40d") }),
      item("Unidades (bloque de 4 horas)", "paquete", "Microbús 28 pasajeros", 120000, "por bloque", "Aire acondicionado y espacio para equipaje.", { capacidad_dia: 1, duracion_horas: 4 }),
      item("Unidades (bloque de 4 horas)", "paquete", "Autobús 42 pasajeros", 160000, "por bloque", "Para llevar a todos los invitados de una sola vez.", { capacidad_dia: 1, duracion_horas: 4 }),
      item("Extras", "producto", "Hora adicional (por unidad)", 15000, "por hora", null),
      item("Extras", "producto", "Segundo viaje la misma noche", 35000, "por unidad", "Ida al inicio y regreso al cierre de la fiesta."),
      item("Extras", "producto", "Decoración de unidad para bodas", 25000, "por unidad", "Lazos y rotulación de 'Recién casados'."),
      item("Extras", "producto", "Trayecto fuera del GAM", null, "a cotizar", "Contanos la ruta por el chat y te pasamos el precio."),
    ],
  },
];

// ---------- Upsert ----------

async function sembrar() {
  console.log("Seed demo EVENTOS →", URL_SUPABASE);
  const ownerId = await asegurarOwner();
  console.log("· Owner:", CORREO_DEMO, "→", ownerId);

  const resumen = [];

  for (const n of NEGOCIOS) {
    const { items, ...campos } = n;
    const fila = {
      ...campos,
      owner_id: ownerId,
      vertical: "eventos",
      estado: "aprobado",
    };

    // ¿Ya existe este slug?
    const { data: existente, error: errSel } = await db
      .from("ranchos")
      .select("id, estado")
      .eq("slug", n.slug)
      .maybeSingle();
    if (errSel) throw new Error(`select ${n.slug}: ${errSel.message}`);

    let ranchoId;
    if (existente && existente.estado !== "aprobado") {
      // El trigger trg_rancho_bloquear_estado no deja aprobar por UPDATE
      // sin sesión admin: se borra y se reinserta ya aprobado.
      const { error: errDel } = await db.from("ranchos").delete().eq("id", existente.id);
      if (errDel) throw new Error(`delete ${n.slug}: ${errDel.message}`);
      console.log(`· ${n.slug} estaba '${existente.estado}' — recreado`);
    }

    if (existente && existente.estado === "aprobado") {
      const { estado: _estado, ...sinEstado } = fila; // el trigger lo revertiría igual
      const { error: errUpd } = await db
        .from("ranchos")
        .update(sinEstado)
        .eq("id", existente.id);
      if (errUpd) throw new Error(`update ${n.slug}: ${errUpd.message}`);
      ranchoId = existente.id;
    } else {
      const { data: creado, error: errIns } = await db
        .from("ranchos")
        .insert(fila)
        .select("id")
        .single();
      if (errIns) throw new Error(`insert ${n.slug}: ${errIns.message}`);
      ranchoId = creado.id;
    }

    // Catálogo: se regenera completo (idempotente). Las reservas viejas
    // no se rompen: reserva_items guarda snapshot y su FK es set null.
    const { error: errDelItems } = await db
      .from("rancho_items")
      .delete()
      .eq("rancho_id", ranchoId);
    if (errDelItems) throw new Error(`delete items ${n.slug}: ${errDelItems.message}`);

    const filasItems = items.map((it, i) => ({ ...it, rancho_id: ranchoId, orden: i + 1 }));
    const { error: errItems } = await db.from("rancho_items").insert(filasItems);
    if (errItems) throw new Error(`insert items ${n.slug}: ${errItems.message}`);

    const accion = existente ? "actualizado" : "creado";
    console.log(`· ${accion}  ${n.slug}  (${n.categoria}/${n.subcategoria})  — ${items.length} ítems`);
    resumen.push({ slug: n.slug, nombre: n.nombre, categoria: n.categoria, items: items.length });
  }

  // ---------- Verificación ----------
  const slugs = NEGOCIOS.map((n) => n.slug);
  const { data: verif, error: errVerif } = await db
    .from("ranchos")
    .select("id, slug, nombre, categoria, estado, vertical, rancho_items(count)")
    .in("slug", slugs)
    .order("categoria");
  if (errVerif) throw new Error("verificación: " + errVerif.message);

  console.log("\n=== Verificación en la base ===");
  for (const r of verif) {
    const c = Array.isArray(r.rancho_items) ? (r.rancho_items[0]?.count ?? 0) : 0;
    console.log(
      `  ${r.estado === "aprobado" ? "✓" : "✗"} [${r.categoria}] ${r.slug} · "${r.nombre}" · ${r.estado} · vertical=${r.vertical} · ${c} ítems`,
    );
  }
  const ok = verif.length === NEGOCIOS.length && verif.every((r) => r.estado === "aprobado");
  console.log(
    ok
      ? `\nListo: ${verif.length}/${NEGOCIOS.length} negocios demo aprobados con su catálogo.`
      : `\nOJO: quedaron ${verif.length}/${NEGOCIOS.length} y alguno no está aprobado — revisá arriba.`,
  );
  if (!ok) process.exitCode = 1;
}

sembrar().catch((e) => {
  console.error("\nEl seed falló:", e.message);
  process.exit(1);
});
