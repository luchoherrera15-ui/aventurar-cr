import { supabase } from "./supabase";

/**
 * BOOKEA BUSINESS en el app — espejo de src/lib/business/modulos.ts de
 * /web (misma base de Supabase, misma lógica pura). Si cambiás algo
 * acá, cambialo también allá: son gemelos a mano porque el app no puede
 * importar código del proyecto Next.
 *
 * Dos ejes que no son lo mismo:
 *   `ranchos.vertical`      el MARKETPLACE — en qué directorio te encuentran.
 *   `ranchos.tipo_negocio`  la OPERACIÓN — qué administra el dueño.
 *
 * Un gimnasio se publica en el directorio de Citas (se reserva por
 * hora) pero su panel es otro: membresías, clases y check-in en vez de
 * agenda por profesional.
 *
 * Cómo se resuelve qué ve un negocio:
 *   tipo    = ranchos.tipo_negocio ?? derivado de (vertical, categoria)
 *   activos = módulos por defecto del tipo ± las filas de modulos_negocio
 *
 * `modulos_negocio` guarda SOLO LAS DIFERENCIAS: sin filas, manda el tipo.
 */

export const MODULOS = [
  "agenda",
  "clientes",
  "servicios",
  "equipo",
  "recursos",
  "pagos",
  "reportes",
  "membresias",
  "clases",
  "paquetes",
  "checkin",
  "marketing",
] as const;

export type ModuloId = (typeof MODULOS)[number];

/** Los que todavía no tienen pantalla: nunca quedan activos. */
const SIN_PANTALLA: readonly ModuloId[] = [
  "recursos",
  "membresias",
  "clases",
  "paquetes",
  "checkin",
  "marketing",
];

export type TipoNegocioId =
  | "barberia"
  | "salon_belleza"
  | "unas"
  | "spa"
  | "masajes"
  | "consultorio"
  | "profesional"
  | "gimnasio"
  | "crossfit"
  | "pilates"
  | "yoga"
  | "academia"
  | "entrenador"
  | "eventos_lugar"
  | "eventos_proveedor"
  | "hospedaje"
  | "restaurante"
  | "otro";

const SERVICIOS_CON_EQUIPO: ModuloId[] = [
  "agenda",
  "clientes",
  "servicios",
  "equipo",
  "pagos",
  "reportes",
];

/** Los módulos por defecto de cada tipo (idénticos a los de /web). */
const POR_DEFECTO: Record<TipoNegocioId, ModuloId[]> = {
  barberia: SERVICIOS_CON_EQUIPO,
  salon_belleza: SERVICIOS_CON_EQUIPO,
  unas: SERVICIOS_CON_EQUIPO,
  spa: SERVICIOS_CON_EQUIPO,
  masajes: SERVICIOS_CON_EQUIPO,
  consultorio: SERVICIOS_CON_EQUIPO,
  profesional: ["agenda", "clientes", "servicios", "pagos", "reportes"],
  gimnasio: [
    "agenda",
    "clientes",
    "equipo",
    "membresias",
    "clases",
    "checkin",
    "pagos",
    "reportes",
  ],
  crossfit: [
    "agenda",
    "clientes",
    "equipo",
    "clases",
    "membresias",
    "paquetes",
    "checkin",
    "pagos",
    "reportes",
  ],
  pilates: [
    "agenda",
    "clientes",
    "equipo",
    "clases",
    "membresias",
    "paquetes",
    "recursos",
    "checkin",
    "pagos",
    "reportes",
  ],
  yoga: [
    "agenda",
    "clientes",
    "equipo",
    "clases",
    "membresias",
    "paquetes",
    "checkin",
    "pagos",
    "reportes",
  ],
  entrenador: ["agenda", "clientes", "servicios", "paquetes", "membresias", "pagos", "reportes"],
  academia: [
    "agenda",
    "clientes",
    "equipo",
    "clases",
    "membresias",
    "paquetes",
    "pagos",
    "reportes",
  ],
  // Sin `servicios`: Lugares tiene su propio sistema de precios y su
  // panel nunca mostró el catálogo.
  eventos_lugar: ["agenda", "clientes", "pagos", "reportes"],
  eventos_proveedor: ["agenda", "clientes", "servicios", "pagos", "reportes"],
  hospedaje: ["agenda", "clientes", "servicios", "pagos", "reportes"],
  restaurante: ["agenda", "clientes", "servicios", "equipo", "recursos", "pagos", "reportes"],
  otro: ["agenda", "clientes", "servicios", "pagos", "reportes"],
};

export const TIPO_NEGOCIO_LABEL: Record<TipoNegocioId, string> = {
  barberia: "Barbería",
  salon_belleza: "Salón de belleza",
  unas: "Uñas",
  spa: "Spa y bienestar",
  masajes: "Masajes",
  consultorio: "Consultorio",
  profesional: "Profesional independiente",
  gimnasio: "Gimnasio",
  crossfit: "CrossFit / funcional",
  pilates: "Pilates",
  yoga: "Yoga",
  academia: "Academia",
  entrenador: "Entrenador personal",
  eventos_lugar: "Salón o lugar para eventos",
  eventos_proveedor: "Proveedor de eventos",
  hospedaje: "Hospedaje",
  restaurante: "Restaurante",
  otro: "Otro",
};

export function esTipoNegocio(valor: string): valor is TipoNegocioId {
  return valor in POR_DEFECTO;
}

/**
 * Con `tipo_negocio` en null (todo negocio anterior a la 0108) el tipo
 * se adivina de la categoría del marketplace — por eso la columna es
 * anulable y nadie tuvo que correr un update masivo.
 */
export function tipoNegocioEfectivo(
  vertical: string | null | undefined,
  categoria: string | null | undefined,
  tipoGuardado: string | null | undefined,
): TipoNegocioId {
  if (tipoGuardado && esTipoNegocio(tipoGuardado)) return tipoGuardado;

  switch (vertical ?? "eventos") {
    case "citas":
      switch (categoria) {
        case "barberia":
          return "barberia";
        case "belleza":
          return "salon_belleza";
        case "unas":
          return "unas";
        case "spa":
          return "spa";
        case "consultorio":
          return "consultorio";
        default:
          return "otro";
      }
    case "hospedajes":
      return "hospedaje";
    case "restaurantes":
      return "restaurante";
    default:
      return categoria === "lugares" ? "eventos_lugar" : "eventos_proveedor";
  }
}

export function resolverModulos(
  tipo: TipoNegocioId,
  overrides: Record<string, boolean> = {},
): Set<ModuloId> {
  const activos = new Set<ModuloId>(POR_DEFECTO[tipo]);
  for (const [modulo, activo] of Object.entries(overrides)) {
    if (!(MODULOS as readonly string[]).includes(modulo)) continue;
    if (activo) activos.add(modulo as ModuloId);
    else activos.delete(modulo as ModuloId);
  }
  for (const id of SIN_PANTALLA) activos.delete(id);
  return activos;
}

export type ContextoNegocio = { tipo: TipoNegocioId; modulos: Set<ModuloId> };

/**
 * El contexto de un negocio, leído de la base. Tolera que la 0108
 * todavía no se haya pegado (las migraciones las corre el dueño a mano
 * en el SQL Editor): sin la tabla ni la columna, el negocio resuelve
 * los defaults de su tipo — o sea, se comporta como siempre.
 */
export async function cargarContextoNegocio(negocioId: string): Promise<ContextoNegocio> {
  const [negocioRes, modulosRes] = await Promise.all([
    supabase.from("ranchos").select("vertical, categoria").eq("id", negocioId).maybeSingle(),
    supabase.from("modulos_negocio").select("modulo, activo").eq("rancho_id", negocioId),
  ]);

  // `tipo_negocio` se pide aparte para que un esquema viejo (sin la
  // columna) no tumbe la consulta entera: sin ella, se deriva.
  const { data: conTipo } = await supabase
    .from("ranchos")
    .select("tipo_negocio")
    .eq("id", negocioId)
    .maybeSingle();

  const overrides: Record<string, boolean> = {};
  for (const fila of (modulosRes.data ?? []) as { modulo: string; activo: boolean }[]) {
    overrides[fila.modulo] = fila.activo;
  }

  const tipo = tipoNegocioEfectivo(
    negocioRes.data?.vertical as string | null,
    negocioRes.data?.categoria as string | null,
    (conTipo as { tipo_negocio?: string | null } | null)?.tipo_negocio ?? null,
  );

  return { tipo, modulos: resolverModulos(tipo, overrides) };
}
