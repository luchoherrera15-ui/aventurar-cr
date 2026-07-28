/**
 * Mismo esquema que /web (src/app/mi-rancho/types.tsx y
 * src/app/eventos-salon/types.ts) — se repiten acá los tipos y
 * constantes que la app necesita en vez de importarlos cruzando de
 * /web a /mobile porque son dos proyectos npm independientes (Next.js
 * vs Expo, cada uno con su propio bundler y árbol de node_modules).
 *
 * Esta copia se mantiene EN PARIDAD con la de /web a propósito (misma
 * lista de cantones, misma taxonomía de subcategorías) — si se agrega
 * o cambia algo de un lado, hacer el mismo cambio del otro.
 */

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

// Subcategorías por categoría. El id es lo que se guarda en la columna
// `subcategoria` de la tabla ranchos.
export const SUBCATEGORIAS: Record<Categoria, { id: string; label: string }[]> = {
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

export const SUBCATEGORIAS_TODAS = CATEGORIAS.flatMap((c) => SUBCATEGORIAS[c].map((s) => s.id));

export const SUBCATEGORIA_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS.flatMap((c) => SUBCATEGORIAS[c].map((s) => [s.id, s.label])),
);

/** A qué categoría general pertenece una subcategoría. */
export const CATEGORIA_DE_SUBCATEGORIA: Record<string, Categoria> = Object.fromEntries(
  CATEGORIAS.flatMap((c) => SUBCATEGORIAS[c].map((s) => [s.id, c])),
);

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
 * número que el dueño fija, sin depender de invitados. Espejo de
 * src/app/mi-rancho/types.tsx en /web.
 */
export const MODALIDADES_PRECIO_LUGAR = ["rango_personas", "hora", "fijo"] as const;
export type ModalidadPrecioLugar = (typeof MODALIDADES_PRECIO_LUGAR)[number];

export type HorarioBloqueConfig = {
  id: string;
  etiqueta: string;
  desde: string;
  hasta: string;
};

/** Pasa "19:30" a "7:30 p.m." para mostrarlo en la app. */
export function formatearHora(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const sufijo = h < 12 ? "a.m." : "p.m.";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

export function etiquetaHorario(bloque: HorarioBloqueConfig) {
  const rango = `${formatearHora(bloque.desde)} – ${formatearHora(bloque.hasta)}`;
  return bloque.etiqueta ? `${bloque.etiqueta} (${rango})` : rango;
}

export type Rancho = {
  id: string;
  nombre: string;
  descripcion: string | null;
  descripcion_larga: string | null;
  categoria: Categoria;
  subcategoria: string | null;
  terminos: string[];
  monto_minimo: number | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  sitio_web: string | null;
  latitud: number | null;
  longitud: number | null;
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
  foto_presentacion: string | null;
  /** Posición entre los destacados de la portada (null = no destacado). */
  destacado_orden?: number | null;
  deposito_reserva: number;
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
  estado: EstadoRancho;
  created_at: string;
  slug: string | null;
};

export type PrecioTier = {
  min_invitados: number;
  max_invitados: number;
  precio: number;
};

export type ServicioAdicional = {
  id: string;
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
};

export type DiaDisponibilidad = {
  confirmada: boolean;
  pendientes: number;
  temporales: number;
};

export type PromocionDia = {
  dias_semana: number[];
  porcentaje_descuento: number;
  etiqueta: string;
  activo: boolean;
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

export type TipoSeccionHome = "categoria" | "ubicacion" | "manual";

export type HomeSeccion = {
  id: string;
  tipo: TipoSeccionHome;
  titulo: string;
  subtitulo: string | null;
  categoria: Categoria | null;
  subcategoria: string | null;
  provincia: Provincia | null;
  canton: string | null;
  rancho_ids: string[] | null;
  orden: number;
  activo: boolean;
  created_at: string;
};

export function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

/**
 * Amenidades agrupadas como en el panel del dueño y el portal web
 * (espejo de AMENIDADES_GRUPOS en src/app/mi-rancho/types.tsx) — así
 * la sección "Amenidades del lugar" se ve igual en la app y el sitio.
 */
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

/** Etiquetas legibles de las amenidades (mismos ids que /web). */
export const AMENIDAD_LABEL: Record<string, string> = Object.fromEntries(
  AMENIDADES_GRUPOS.flatMap((g) => g.items.map((i) => [i.id, i.label])),
);

/** Mismos términos por defecto que /web (mi-rancho/types.tsx). */
export function terminosPorDefecto(
  depositoReserva: number,
  montoMinimo: number | null,
): string[] {
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

/** Links de "Cómo llegar" — mismos helpers que /web, sin API key. */
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

// Tope de fotos por negocio — el mismo que usa el sitio web (FOTOS_MAX
// en src/app/mi-rancho/types.tsx). Si se cambia, cambiarlo en ambos.
export const FOTOS_MAX = 8;
