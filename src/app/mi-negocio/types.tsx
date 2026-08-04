import {
  IconBalloons,
  IconCloche,
  IconDisco,
  IconPlannerCheck,
  IconRancho,
  IconWand,
} from "@/components/icons";

export const PROVINCIAS = [
  "San José",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Guanacaste",
  "Puntarenas",
  "Limón",
] as const;

export type Provincia = (typeof PROVINCIAS)[number];

/**
 * Los 84 cantones del país, agrupados por provincia. Sirven para el
 * buscador por zona y para que el cantón entre normalizado (en la base
 * la columna sigue siendo texto libre, porque las publicaciones viejas
 * tienen lo que el dueño escribió a mano).
 */
export const CANTONES: Record<Provincia, string[]> = {
  "San José": [
    "San José", "Escazú", "Desamparados", "Puriscal", "Tarrazú", "Aserrí",
    "Mora", "Goicoechea", "Santa Ana", "Alajuelita", "Vázquez de Coronado",
    "Acosta", "Tibás", "Moravia", "Montes de Oca", "Turrubares", "Dota",
    "Curridabat", "Pérez Zeledón", "León Cortés Castro",
  ],
  Alajuela: [
    "Alajuela", "San Ramón", "Grecia", "San Mateo", "Atenas", "Naranjo",
    "Palmares", "Poás", "Orotina", "San Carlos", "Zarcero", "Sarchí",
    "Upala", "Los Chiles", "Guatuso", "Río Cuarto",
  ],
  Cartago: [
    "Cartago", "Paraíso", "La Unión", "Jiménez", "Turrialba", "Alvarado",
    "Oreamuno", "El Guarco",
  ],
  Heredia: [
    "Heredia", "Barva", "Santo Domingo", "Santa Bárbara", "San Rafael",
    "San Isidro", "Belén", "Flores", "San Pablo", "Sarapiquí",
  ],
  Guanacaste: [
    "Liberia", "Nicoya", "Santa Cruz", "Bagaces", "Carrillo", "Cañas",
    "Abangares", "Tilarán", "Nandayure", "La Cruz", "Hojancha",
  ],
  Puntarenas: [
    "Puntarenas", "Esparza", "Buenos Aires", "Montes de Oro", "Osa",
    "Quepos", "Golfito", "Coto Brus", "Parrita", "Corredores", "Garabito",
    "Monteverde", "Puerto Jiménez",
  ],
  "Limón": [
    "Limón", "Pococí", "Siquirres", "Talamanca", "Matina", "Guácimo",
  ],
};

/**
 * Links de "Cómo llegar". Ni Google Maps ni Waze piden API key para
 * esto: alcanza con una URL pública. Si hay coordenadas se usan, y si
 * no, se manda la dirección escrita como texto de búsqueda.
 */
export function linkGoogleMaps(
  lat: number | null,
  lng: number | null,
  direccion: string,
): string | null {
  if (lat !== null && lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (!direccion.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

export function linkWaze(
  lat: number | null,
  lng: number | null,
  direccion: string,
): string | null {
  if (lat !== null && lng !== null) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  if (!direccion.trim()) return null;
  return `https://waze.com/ul?q=${encodeURIComponent(direccion)}&navigate=yes`;
}

export type EstadoRancho = "pendiente" | "aprobado" | "rechazado";

// Taxonomía de dos niveles: la categoría general es la que se ve en la
// barra de navegación, y dentro de cada una están las subcategorías
// concretas que elige el proveedor al registrarse.
export const CATEGORIAS = [
  "lugares",
  "alimentacion",
  "animacion",
  "organizacion",
  "decoracion",
  "otros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  lugares: "Lugares",
  alimentacion: "Alimentación",
  animacion: "Animación",
  organizacion: "Organización",
  decoracion: "Decoración",
  otros: "Otros servicios",
};

// Dibujos propios: el rancho, la campana de catering, la bola disco…
// dan más identidad que los genéricos (casa, tenedor, clipboard) que
// se usaban antes.
export const CATEGORIA_ICONO: Record<Categoria, React.ReactNode> = {
  lugares: <IconRancho />,
  alimentacion: <IconCloche />,
  animacion: <IconDisco />,
  organizacion: <IconPlannerCheck />,
  decoracion: <IconBalloons />,
  otros: <IconWand />,
};

// Fondo para cuando el negocio todavía no subió su foto principal.
export const CATEGORIA_GRADIENTE: Record<Categoria, string> = {
  lugares: "linear-gradient(160deg, #201512 0%, #2e1f14 45%, #1c1712 100%)",
  alimentacion: "linear-gradient(160deg, #2a1c10 0%, #3d2b16 45%, #1c1610 100%)",
  animacion: "linear-gradient(160deg, #17122a 0%, #241a3d 45%, #12101c 100%)",
  organizacion: "linear-gradient(160deg, #101c22 0%, #16302d 45%, #2a2c22 100%)",
  decoracion: "linear-gradient(160deg, #2a1420 0%, #3d1f2b 45%, #1c1216 100%)",
  otros: "linear-gradient(160deg, #1a1a1a 0%, #2a2a2a 45%, #141414 100%)",
};

export const UNIDADES_PRECIO = ["evento", "persona", "hora", "bloque_horas"] as const;
export type UnidadPrecio = (typeof UNIDADES_PRECIO)[number];

export const UNIDAD_PRECIO_LABEL: Record<UnidadPrecio, string> = {
  evento: "por evento",
  persona: "por persona",
  hora: "por hora",
  bloque_horas: "por bloque",
};

/**
 * Cómo cobra un LUGAR por su fecha (distinto de UnidadPrecio, que es
 * para el "desde ₡X" de las demás categorías): "rango_personas" son
 * los tramos de precio_tiers de siempre; "hora" y "fijo" son un solo
 * número que el dueño fija, sin depender de invitados.
 */
export const MODALIDADES_PRECIO_LUGAR = ["rango_personas", "hora", "fijo"] as const;
export type ModalidadPrecioLugar = (typeof MODALIDADES_PRECIO_LUGAR)[number];

export const MODALIDAD_PRECIO_LUGAR_LABEL: Record<ModalidadPrecioLugar, string> = {
  rango_personas: "Por rangos de invitados",
  hora: "Por hora",
  fijo: "Precio fijo del evento",
};

// Subcategorías por categoría. El id es lo que se guarda en la columna
// `subcategoria` de la tabla ranchos.
export const SUBCATEGORIAS: Record<
  Categoria,
  { id: string; label: string }[]
> = {
  lugares: [
    { id: "sala_eventos", label: "Salas de eventos" },
    { id: "rancho_fiestas", label: "Ranchos para fiestas" },
    { id: "lugar_fiestas_infantiles", label: "Lugares para fiestas infantiles" },
    { id: "finca_fiestas", label: "Fincas para fiestas" },
    { id: "hotel_eventos", label: "Hoteles para eventos" },
    { id: "restaurante", label: "Restaurantes" },
    { id: "parque_piscina", label: "Parques y piscinas" },
    { id: "centro_negocios", label: "Centros de negocios" },
  ],
  alimentacion: [
    { id: "catering", label: "Catering service" },
    { id: "queques", label: "Queques" },
    { id: "catering_infantil", label: "Catering infantil" },
    { id: "bebidas_domicilio", label: "Bebidas a domicilio" },
    { id: "mesas_dulces", label: "Mesas de dulces" },
    { id: "food_trucks", label: "Food trucks" },
    { id: "comidas_domicilio", label: "Comidas a domicilio" },
    { id: "parrillada", label: "Parrillada" },
    { id: "bartender", label: "Bartenders" },
    { id: "barra_cocteles", label: "Barra de cócteles" },
    { id: "barra_cafe", label: "Coffee bar" },
    { id: "barra_matcha", label: "Matcha bar" },
    { id: "barra_cerveza", label: "Barra de cerveza" },
    { id: "barra_jugos", label: "Barra de jugos y smoothies" },
    { id: "barra_helados", label: "Barra de helados" },
    { id: "barra_snacks", label: "Barra de snacks" },
  ],
  animacion: [
    { id: "dj_discomovil", label: "DJ y discomóvil" },
    { id: "luces_sonido", label: "Alquiler de luces y sonido" },
    { id: "grupos_musicales", label: "Grupos musicales" },
    { id: "fiestas_neon", label: "Fiestas neón" },
    { id: "animadores", label: "Animadores de eventos" },
    { id: "maestros_ceremonias", label: "Maestros de ceremonias" },
    { id: "mariachis", label: "Mariachis" },
    { id: "payasos_pintacaritas", label: "Payasos y pintacaritas" },
    { id: "magos", label: "Magos y shows de magia" },
    { id: "inflables", label: "Alquiler de inflables" },
    { id: "animacion_infantil", label: "Shows y animación infantil" },
    { id: "polvora", label: "Juegos de pólvora" },
  ],
  organizacion: [
    { id: "articulos_fiesta", label: "Artículos de fiesta" },
    { id: "invitaciones", label: "Invitaciones" },
    { id: "fotografos", label: "Fotógrafos" },
    { id: "photo_booth", label: "Photo booth" },
    { id: "edecanes", label: "Edecanes" },
    { id: "wedding_planner", label: "Wedding planner" },
    { id: "produccion_audiovisual", label: "Producción audiovisual" },
    { id: "agencias_btl", label: "Agencias BTL" },
    { id: "organizacion_eventos", label: "Organización de eventos" },
    { id: "articulos_promocionales", label: "Artículos promocionales" },
  ],
  decoracion: [
    { id: "decoracion_eventos", label: "Decoración para eventos" },
    { id: "decoracion_infantil", label: "Decoración de fiestas infantiles" },
    { id: "floristerias", label: "Floristerías" },
    { id: "toldos", label: "Alquiler de toldos" },
    { id: "tarimas", label: "Tarimas para eventos" },
    { id: "exhibidores_stands", label: "Exhibidores y stands" },
    { id: "graderias", label: "Graderías" },
    { id: "sillas_mesas", label: "Alquiler de sillas y mesas" },
    { id: "manteles", label: "Alquiler de manteles" },
    { id: "equipo_eventos", label: "Alquiler de equipo para eventos" },
  ],
  otros: [
    { id: "revelacion_sexo", label: "Revelaciones de sexo" },
    { id: "transporte", label: "Transporte para eventos" },
    { id: "seguridad", label: "Seguridad para eventos" },
    { id: "banos_portatiles", label: "Baños portátiles" },
    { id: "planta_electrica", label: "Plantas eléctricas" },
    { id: "otro", label: "Otro servicio" },
  ],
};

/**
 * Equivalencias de la taxonomía vieja (una sola categoría por negocio)
 * a la nueva de dos niveles.
 *
 * La migración 0018 remapea la tabla, pero esto se usa al leer para que
 * una fila que todavía no se migró no rompa la página: sin esto, una
 * categoría desconocida deja el nombre y el ícono en blanco y un lugar
 * se muestra como si fuera un servicio móvil (sin calendario).
 */
const CATEGORIAS_LEGADAS: Record<string, Categoria> = {
  salon: "lugares",
  dj: "animacion",
  animador: "animacion",
  mobiliario: "decoracion",
  revelacion_sexo: "otros",
  otro: "otros",
};

// Exclusiva de la vertical EVENTOS: solo conoce las 6 categorías de
// CATEGORIAS de acá arriba. No usar para normalizar `categoria` de
// cualquier fila de `ranchos` en general — una categoría de Citas
// (unas, belleza, barbería...) cae acá en "otros" y pisa el dato real
// si el resultado se vuelve a guardar (ya pasó en producción, ver
// supabase/migrations/0058_categorias_citas.sql). Para código que no
// sabe de antemano que el rancho es de Eventos, usar
// src/lib/categorias-vertical.ts en su lugar.
export function normalizarCategoria(valor: string | null | undefined): Categoria {
  if (valor && (CATEGORIAS as readonly string[]).includes(valor)) {
    return valor as Categoria;
  }
  return CATEGORIAS_LEGADAS[valor ?? ""] ?? "otros";
}

export const SUBCATEGORIAS_TODAS = CATEGORIAS.flatMap((c) =>
  SUBCATEGORIAS[c].map((s) => s.id),
);

export const SUBCATEGORIA_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS.flatMap((c) => SUBCATEGORIAS[c].map((s) => [s.id, s.label])),
);

/** A qué categoría general pertenece una subcategoría. */
export const CATEGORIA_DE_SUBCATEGORIA: Record<string, Categoria> =
  Object.fromEntries(
    CATEGORIAS.flatMap((c) => SUBCATEGORIAS[c].map((s) => [s.id, c])),
  );

/**
 * Los lugares físicos son la única categoría con reserva de fecha en
 * línea (calendario, depósito y amenidades). El resto se contrata por
 * WhatsApp desde su portal.
 */
export const CATEGORIA_CON_CALENDARIO: Categoria = "lugares";

// Recomendación de tamaño para la foto principal (relación 4:3, buena
// para que se vea bien tanto en la card como de fondo con texto encima).
export const FOTO_ANCHO_MIN = 1200;
export const FOTO_ALTO_MIN = 900;

/**
 * Términos que trae la plataforma por defecto. Cada proveedor los puede
 * editar, borrar o reemplazar desde su panel: estos son solo el punto de
 * partida para que nadie publique sin condiciones.
 *
 * El texto cambia según `vertical`: Citas se agenda por horario (no-show,
 * anticipación de cancelación, tardanza) en vez de por evento con
 * instalaciones e invitados. Hospedajes y Restaurantes todavía no tienen
 * su propio set — caen al de Eventos (mismo comportamiento de siempre)
 * hasta que se les escriba el suyo.
 *
 * El primero (y el del monto mínimo, cuando aplica) hablan del depósito,
 * así que se arman con los números de cada negocio.
 */
export function terminosPorDefecto(
  depositoReserva: number,
  montoMinimo: number | null,
  vertical: string = "eventos",
): string[] {
  if (vertical === "citas") {
    const base = [
      `El depósito para agendar la cita es de ₡${Number(depositoReserva || 0).toLocaleString("es-CR")}. Si el comprobante muestra un monto menor, la cita no queda confirmada y el depósito no se reembolsa.`,
      "El depósito no se reembolsa si el cliente no llega a la hora acordada.",
      "Las cancelaciones con menos de 24 horas de anticipación pierden el depósito, igual que un no presentarse. Avisar con más tiempo evita esta condición.",
      "Llegar tarde a la cita puede acortar el tiempo del servicio o requerir reagendarla, según la disponibilidad del negocio.",
      "El número de cédula se pide únicamente para identificar a quien reserva en caso de algún inconveniente durante la cita (Ley 8968 de protección de datos). Solo lo ve el negocio y el equipo de Bookea — nunca se hace público.",
    ];

    if (montoMinimo && montoMinimo > 0) {
      base.splice(
        1,
        0,
        `El monto mínimo de contratación es de ₡${Number(montoMinimo).toLocaleString("es-CR")}. Por debajo de ese monto no se toman reservas.`,
      );
    }

    return base;
  }

  const base = [
    `El depósito de reserva es de ₡${Number(depositoReserva || 0).toLocaleString("es-CR")}. Si el comprobante muestra un monto menor, la reserva no será válida y el dinero no se reembolsa.`,
    "El depósito de reserva no es reembolsable en caso de cancelación por parte del cliente.",
    "El tipo de evento debe coincidir exactamente con el indicado al reservar; si no coincide, el anfitrión puede cancelar la reserva sin devolución del depósito.",
    "Subir el comprobante no confirma la fecha por sí solo — la reserva queda en aprobación hasta que el anfitrión la revise y confirme.",
    "Cualquier daño a las instalaciones o al mobiliario durante el evento es responsabilidad de quien hizo la reserva.",
    "El número de cédula se pide únicamente para identificar a quien reserva en caso de daños o problemas durante el evento (Ley 8968 de protección de datos). Solo lo ve el anfitrión del lugar reservado y el equipo de Bookea — nunca se hace público.",
  ];

  if (montoMinimo && montoMinimo > 0) {
    base.splice(
      1,
      0,
      `El monto mínimo de contratación es de ₡${Number(montoMinimo).toLocaleString("es-CR")}. Por debajo de ese monto no se toman reservas.`,
    );
  }

  return base;
}

// Cuántos términos puede tener como máximo un proveedor, para que la
// pantalla de reserva no se vuelva ilegible.
export const TERMINOS_MAX = 15;

// Cuántas fotos de galería puede subir cada negocio. Las primeras
// FOTOS_DESTACADAS se muestran grandes en el portal; el resto va en
// la galería secundaria.
export const FOTOS_MAX = 8;
export const FOTOS_DESTACADAS = 4;

// Amenidades de un lugar físico (salones, ranchos, fincas, hoteles).
// Los servicios móviles (DJ, catering, mobiliario) tendrán su propio
// set de características más adelante.
export const AMENIDADES_GRUPOS: {
  titulo: string;
  items: { id: string; label: string }[];
}[] = [
  {
    titulo: "Espacios",
    items: [
      { id: "piscina", label: "Piscina" },
      { id: "piscina_ninos", label: "Piscina para niños" },
      { id: "rancho_techado", label: "Rancho techado" },
      { id: "salon_cerrado", label: "Salón cerrado" },
      { id: "zona_verde", label: "Zona verde / jardín" },
      { id: "cancha_futbol", label: "Cancha de fútbol" },
      { id: "cancha_multiuso", label: "Cancha multiuso" },
      { id: "juegos_infantiles", label: "Área de juegos infantiles" },
      { id: "terraza_mirador", label: "Terraza o mirador" },
      { id: "rio_quebrada", label: "Río o quebrada" },
    ],
  },
  {
    titulo: "Cocina y comida",
    items: [
      { id: "parrilla", label: "Parrilla / BBQ" },
      { id: "cocina_equipada", label: "Cocina equipada" },
      { id: "horno_lena", label: "Horno de leña" },
      { id: "refrigeradora", label: "Refrigeradora / congelador" },
      { id: "comedor_techado", label: "Comedor techado" },
      { id: "bar_barra", label: "Bar / barra" },
      { id: "catering_externo", label: "Se permite catering externo" },
    ],
  },
  {
    titulo: "Servicios",
    items: [
      { id: "parqueo", label: "Parqueo privado" },
      { id: "parqueo_buses", label: "Parqueo para buses" },
      { id: "banos_completos", label: "Baños completos" },
      { id: "duchas_vestidores", label: "Duchas / vestidores" },
      { id: "wifi", label: "Wifi" },
      { id: "planta_electrica", label: "Planta eléctrica" },
      { id: "sonido_incluido", label: "Sonido incluido" },
      { id: "iluminacion", label: "Iluminación de ambiente" },
      { id: "proyector", label: "Proyector / pantalla" },
      { id: "aire_acondicionado", label: "Aire acondicionado" },
      { id: "seguridad", label: "Seguridad / vigilancia" },
      { id: "limpieza", label: "Personal de limpieza" },
    ],
  },
  {
    titulo: "Hospedaje",
    items: [
      { id: "chalets", label: "Chalets / cabinas" },
      { id: "habitaciones", label: "Habitaciones" },
      { id: "camping", label: "Zona de camping" },
    ],
  },
  {
    titulo: "Accesibilidad y reglas",
    items: [
      { id: "acceso_silla_ruedas", label: "Acceso para silla de ruedas" },
      { id: "mascotas", label: "Se permiten mascotas" },
      { id: "apto_ninos", label: "Apto para niños" },
    ],
  },
];

export const AMENIDADES = AMENIDADES_GRUPOS.flatMap((g) =>
  g.items.map((i) => i.id),
);

export const AMENIDAD_LABEL: Record<string, string> = Object.fromEntries(
  AMENIDADES_GRUPOS.flatMap((g) => g.items.map((i) => [i.id, i.label])),
);

/**
 * Un bloque de alquiler tal como lo define el propietario.
 *
 * No hay bloques "de la plataforma": cada negocio arma los suyos. Un
 * salón puede alquilar por bloques de 6 horas, otro por día completo y
 * otro por hora. Lista vacía = no maneja bloques y al reservar no se
 * pregunta el horario.
 */
export type HorarioBloqueConfig = {
  id: string;
  /** Cómo lo llama el dueño: "Mañana", "Día completo", "Turno noche". */
  etiqueta: string;
  /** Formato 24h "HH:MM". */
  desde: string;
  hasta: string;
};

export const HORARIOS_MAX = 6;

/** Pasa "19:30" a "7:30 p.m." para mostrarlo en la página pública. */
export function formatearHora(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const sufijo = h < 12 ? "a.m." : "p.m.";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** Cuántas horas dura el bloque; cruza medianoche si hace falta. */
export function duracionHoras(desde: string, hasta: string) {
  const [hd, md] = desde.split(":").map(Number);
  const [hh, mh] = hasta.split(":").map(Number);
  if ([hd, md, hh, mh].some((n) => !Number.isFinite(n))) return null;
  let minutos = hh * 60 + mh - (hd * 60 + md);
  if (minutos <= 0) minutos += 24 * 60;
  return Math.round((minutos / 60) * 10) / 10;
}

/**
 * El texto que ve el cliente y que queda guardado en la reserva.
 * Se guarda ya armado para que la reserva se siga leyendo igual
 * aunque el dueño después edite o borre ese bloque.
 */
export function etiquetaHorario(bloque: HorarioBloqueConfig) {
  const rango = `${formatearHora(bloque.desde)} – ${formatearHora(bloque.hasta)}`;
  return bloque.etiqueta ? `${bloque.etiqueta} (${rango})` : rango;
}

/** Reservas viejas guardaron un código fijo en vez del texto del bloque. */
const HORARIOS_LEGADOS: Record<string, string> = {
  manana_tarde: "Mañana y tarde (7:00 a.m. – 1:00 p.m.)",
  tarde_noche: "Tarde y noche (6:00 p.m. – 12:00 medianoche)",
};

export function mostrarHorarioReserva(valor: string | null | undefined) {
  if (!valor) return "—";
  return HORARIOS_LEGADOS[valor] ?? valor;
}

export type Rancho = {
  id: string;
  owner_id: string;
  nombre: string;
  descripcion: string | null;
  descripcion_larga: string | null;
  // La columna real de `ranchos` admite las ~30 categorías repartidas
  // entre las 4 verticales (eventos/citas/hospedajes/restaurantes), no
  // solo las 6 de Eventos que describe `Categoria` — ver
  // src/lib/categorias-vertical.ts para leer/validar esto según
  // `vertical`. Donde el código ya está garantizado a vertical Eventos,
  // usar `as Categoria` puntual en vez de ensanchar los mapas de acá.
  categoria: string;
  subcategoria: string | null;
  terminos: string[];
  monto_minimo: number | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  sitio_web: string | null;
  latitud: number | null;
  longitud: number | null;
  mapa_url: string | null;
  amenidades: string[];
  detalles: Record<string, unknown>;
  provincia: Provincia | null;
  canton: string | null;
  direccion_exacta: string | null;
  capacidad_min: number | null;
  capacidad_max: number | null;
  precio_desde: number | null;
  unidad_precio: UnidadPrecio;
  contacto_whatsapp: string | null;
  foto_url: string | null;
  /** Cuál de sus fotos va grande en la sección de presentación. */
  foto_presentacion: string | null;
  /** Posición entre los destacados de la portada (null = no destacado). */
  destacado_orden?: number | null;
  deposito_reserva: number;
  /** Cuántos eventos atiende por día (0049). null = sin tope; los
   *  Lugares quedan en 1 — el salón se alquila entero. */
  eventos_por_dia?: number | null;
  /** Zona IANA del negocio (0062) — 'America/Costa_Rica' por defecto. */
  zona_horaria?: string | null;
  sinpe_numero: string | null;
  sinpe_titular: string | null;
  cuenta_banco: string | null;
  cuenta_numero: string | null;
  cuenta_titular: string | null;
  cuenta_tipo: string | null;
  horarios_bloques: HorarioBloqueConfig[];
  tarifa_diciembre_por_persona: number | null;
  /** Solo aplica a Lugares — cómo se calcula la cotización al reservar. */
  modalidad_precio_lugar: ModalidadPrecioLugar;
  precio_hora_lugar: number | null;
  precio_fijo_lugar: number | null;
  fotos: string[];
  /** Qué vertical del marketplace es (0055): eventos es el default. */
  vertical?: "eventos" | "citas" | "hospedajes";
  estado: EstadoRancho;
  created_at: string;
  slug: string | null;
};

export type PrecioTier = {
  id: string;
  rancho_id: string | null;
  min_invitados: number;
  max_invitados: number;
  precio: number;
};

export type ServicioAdicional = {
  id: string;
  rancho_id: string | null;
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
  activo: boolean;
};

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const DIAS_SEMANA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export type CodigoDescuento = {
  id: string;
  rancho_id: string;
  codigo: string;
  tipo: "porcentaje" | "monto_fijo";
  valor: number;
  activo: boolean;
  usos_maximos: number | null;
  usos_actuales: number;
  valido_hasta: string | null;
  created_at: string;
};

export type PromocionDia = {
  id: string;
  rancho_id: string;
  dias_semana: number[];
  porcentaje_descuento: number;
  etiqueta: string;
  activo: boolean;
  created_at: string;
};

export type Favorito = {
  cliente_id: string;
  rancho_id: string;
  created_at: string;
};

export type Resena = {
  id: string;
  rancho_id: string;
  cliente_id: string;
  reserva_id: string;
  calificacion: number;
  comentario: string | null;
  created_at: string;
};

/** Vista `calificaciones_rancho`: promedio + cantidad, una fila por rancho. */
export type CalificacionRancho = {
  rancho_id: string;
  promedio: number;
  total: number;
};

export type Mensaje = {
  id: string;
  conversacion_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

/** Un ítem del catálogo de un negocio: plato del menú, paquete, producto. */
export type RanchoItem = {
  id: string;
  rancho_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  unidad: string | null;
  activo: boolean;
  orden: number;
  /** Foto del paquete/producto (bucket ranchos-fotos). */
  foto_url: string | null;
  /** Cuántas horas incluye ("Estación 1 · 5 horas"). null = no aplica. */
  duracion_horas: number | null;
  /** Duración en minutos ("Corte · 45 min") — la usa la vertical de Citas. */
  duracion_minutos: number | null;
  /** Sección del catálogo ("Estaciones", "Extras", "Bebidas"...). */
  grupo: string | null;
  /** 'paquete' = tarjeta grande con foto; 'producto' = fila con contador. */
  tipo: "paquete" | "producto";
  min_por_reserva: number;
  max_por_reserva: number | null;
  /** Cuántas unidades puede atender por día. null = sin límite. */
  capacidad_dia: number | null;
  /** true = al elegirlo, su precio SUSTITUYE la tarifa por evento o
   *  paquete del cotizador (0067). Opcional: tolera bases sin migrar. */
  es_paquete_base?: boolean | null;
  /** Minutos de limpieza/preparación después de la cita (0061). */
  buffer_min?: number | null;
  created_at: string;
};

/** Cómo se llama el catálogo según el rubro — "Menú" para comida, etc. */
export const CATALOGO_LABEL: Record<Categoria, string> = {
  lugares: "Servicios adicionales",
  alimentacion: "Menú",
  animacion: "Paquetes",
  organizacion: "Paquetes",
  decoracion: "Catálogo",
  otros: "Catálogo",
};

/** Snapshot del pedido armado al reservar (columna reservas.detalle_pedido). */
export type DetallePedido = {
  items: {
    item_id: string;
    nombre: string;
    precio: number | null;
    unidad: string | null;
    cantidad: number;
  }[];
  total_estimado: number | null;
};

