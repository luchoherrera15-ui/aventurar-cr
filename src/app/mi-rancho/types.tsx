import {
  IconBalloon,
  IconCelebrate,
  IconChair,
  IconHeadphones,
  IconHouse,
  IconSparkles,
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

export const CATEGORIAS = [
  "salon",
  "mobiliario",
  "dj",
  "animador",
  "revelacion_sexo",
  "otro",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  salon: "Salones y lugares",
  mobiliario: "Alquiler de mobiliario",
  dj: "DJs",
  animador: "Animadores",
  revelacion_sexo: "Revelaciones de sexo",
  otro: "Otros servicios",
};

export const CATEGORIA_ICONO: Record<Categoria, React.ReactNode> = {
  salon: <IconHouse />,
  mobiliario: <IconChair />,
  dj: <IconHeadphones />,
  animador: <IconCelebrate />,
  revelacion_sexo: <IconBalloon />,
  otro: <IconSparkles />,
};

// Fondo para cuando el negocio todavía no subió su foto principal.
export const CATEGORIA_GRADIENTE: Record<Categoria, string> = {
  salon: "linear-gradient(160deg, #201512 0%, #2e1f14 45%, #1c1712 100%)",
  mobiliario: "linear-gradient(160deg, #101c22 0%, #16302d 45%, #2a2c22 100%)",
  dj: "linear-gradient(160deg, #17122a 0%, #241a3d 45%, #12101c 100%)",
  animador: "linear-gradient(160deg, #2a1420 0%, #3d1f2b 45%, #1c1216 100%)",
  revelacion_sexo: "linear-gradient(160deg, #1a1f2e 0%, #2d2440 45%, #16121c 100%)",
  otro: "linear-gradient(160deg, #1a1a1a 0%, #2a2a2a 45%, #141414 100%)",
};

// Recomendación de tamaño para la foto principal (relación 4:3, buena
// para que se vea bien tanto en la card como de fondo con texto encima).
export const FOTO_ANCHO_MIN = 1200;
export const FOTO_ALTO_MIN = 900;

// Subtipos de lugar — solo aplican a la categoría "salon", para poder
// filtrar el directorio como un directorio de salones de verdad.
export const TIPOS_LUGAR = [
  "sala_eventos",
  "rancho_fiestas",
  "lugar_fiestas_infantiles",
  "finca_fiestas",
  "hotel_eventos",
  "restaurante",
  "parque_piscina",
  "centro_negocios",
] as const;

export type TipoLugar = (typeof TIPOS_LUGAR)[number];

export const TIPO_LUGAR_LABEL: Record<TipoLugar, string> = {
  sala_eventos: "Salas de eventos",
  rancho_fiestas: "Ranchos para fiestas",
  lugar_fiestas_infantiles: "Lugares para fiestas infantiles",
  finca_fiestas: "Fincas para fiestas",
  hotel_eventos: "Hoteles para eventos",
  restaurante: "Restaurantes",
  parque_piscina: "Parques y piscinas",
  centro_negocios: "Centros de negocios",
};

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
  tipo_lugar: TipoLugar | null;
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
