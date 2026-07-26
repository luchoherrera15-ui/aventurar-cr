import {
  IconBalloon,
  IconClipboard,
  IconHeadphones,
  IconHouse,
  IconSparkles,
  IconUtensils,
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

export const CATEGORIA_ICONO: Record<Categoria, React.ReactNode> = {
  lugares: <IconHouse />,
  alimentacion: <IconUtensils />,
  animacion: <IconHeadphones />,
  organizacion: <IconClipboard />,
  decoracion: <IconBalloon />,
  otros: <IconSparkles />,
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
 * Los dos primeros hablan del depósito y del monto mínimo, así que se
 * arman con los números de cada negocio.
 */
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
    "El número de cédula se pide únicamente para identificar a quien reserva en caso de daños o problemas durante el evento (Ley 8968 de protección de datos). Solo lo ve el anfitrión del lugar reservado y el equipo de Aventurea CR — nunca se hace público.",
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

export type Rancho = {
  id: string;
  owner_id: string;
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
  amenidades: string[];
  provincia: Provincia | null;
  canton: string | null;
  direccion_exacta: string | null;
  capacidad_min: number | null;
  capacidad_max: number | null;
  precio_desde: number | null;
  contacto_whatsapp: string | null;
  foto_url: string | null;
  deposito_reserva: number;
  tarifa_diciembre_por_persona: number | null;
  fotos: string[];
  estado: EstadoRancho;
  created_at: string;
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
