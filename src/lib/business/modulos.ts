/**
 * BOOKEA BUSINESS — el motor de módulos.
 *
 * Dos ejes que NO son lo mismo y que conviene no volver a mezclar:
 *
 *   `ranchos.vertical`      el MARKETPLACE — en qué directorio público
 *                           te encuentra el cliente.
 *   `ranchos.tipo_negocio`  la OPERACIÓN — qué administra el dueño.
 *
 * Un gimnasio se publica en el directorio de Citas (se reserva por
 * hora, igual que una barbería) pero su panel es otro: membresías,
 * clases y check-in en vez de agenda por profesional. Antes de esto el
 * panel se decidía con `vertical === 'citas' ? A : B`, que aguantaba
 * dos casos y ninguno más.
 *
 * Cómo se resuelve qué ve un negocio:
 *
 *   tipo    = ranchos.tipo_negocio  ??  derivado de (vertical, categoria)
 *   activos = módulos por defecto del tipo  ±  las filas de modulos_negocio
 *
 * `modulos_negocio` guarda SOLO LAS DIFERENCIAS: sin filas, el negocio
 * se comporta exactamente como su tipo manda, y cambiar un default acá
 * alcanza a todos los que no opinaron.
 *
 * Módulo ≠ complemento de pago. Lo cobrable vive en `addons_negocio`
 * (src/lib/addons.ts): a mano siempre gratis, con IA se cobra. Acá solo
 * se decide qué áreas usa el negocio.
 *
 * Módulo NEUTRAL a propósito (sin "use client"): lo leen la página del
 * panel en el servidor y el formulario de módulos en el navegador.
 */

// ------------------------------------------------------------
// Los módulos
// ------------------------------------------------------------

/** Los bloques del menú lateral, en el orden en que se muestran. */
export const GRUPOS = ["agenda", "gestion", "fitness", "finanzas", "crecimiento", "config"] as const;

export type GrupoId = (typeof GRUPOS)[number];

export const GRUPO_LABEL: Record<GrupoId, string> = {
  agenda: "Agenda",
  gestion: "Gestión",
  fitness: "Fitness",
  finanzas: "Finanzas",
  crecimiento: "Crecimiento",
  config: "Configuración",
};

type DefinicionModulo = {
  id: string;
  nombre: string;
  /** Qué hace, en palabras del dueño. */
  resumen: string;
  grupo: GrupoId;
  /**
   * ¿Ya tiene pantalla? Los de las fases 2-6 se declaran igual para que
   * el panel los muestre como "próximamente" en vez de aparecer de la
   * nada — pero no se pueden encender hasta que exista qué encender.
   */
  disponible: boolean;
};

export const MODULOS = [
  {
    id: "agenda",
    nombre: "Agenda",
    resumen: "Las reservas por hora: quién viene, con quién y a qué hora.",
    grupo: "agenda",
    disponible: true,
  },
  {
    id: "clientes",
    nombre: "Clientes",
    resumen: "Quién viene, quién dejó de venir y a quién le podés escribir.",
    grupo: "gestion",
    disponible: true,
  },
  {
    id: "servicios",
    nombre: "Servicios",
    resumen: "Tu catálogo con precio y duración — lo que el cliente elige.",
    grupo: "gestion",
    disponible: true,
  },
  {
    id: "equipo",
    nombre: "Equipo",
    resumen: "Las personas que atienden, con su horario y sus servicios.",
    grupo: "gestion",
    disponible: true,
  },
  {
    id: "recursos",
    nombre: "Recursos",
    resumen: "Cabinas, sillones, salas o canchas que una reserva ocupa.",
    grupo: "gestion",
    disponible: false,
  },
  {
    id: "pagos",
    nombre: "Pagos",
    resumen: "Lo que entró, lo que falta cobrar y tus gastos.",
    grupo: "finanzas",
    disponible: true,
  },
  {
    id: "reportes",
    nombre: "Reportes",
    resumen: "Cómo va el negocio: asistencia, ingresos y horas pico.",
    grupo: "finanzas",
    disponible: true,
  },
  {
    id: "membresias",
    nombre: "Membresías",
    resumen: "Planes mensuales o por cantidad de clases, con vencimiento.",
    grupo: "fitness",
    disponible: false,
  },
  {
    id: "clases",
    nombre: "Clases",
    resumen: "Clases grupales con cupo, instructor y lista de espera.",
    grupo: "fitness",
    disponible: false,
  },
  {
    id: "paquetes",
    nombre: "Paquetes",
    resumen: "Bonos de sesiones (10, 20…) que el cliente va consumiendo.",
    grupo: "fitness",
    disponible: false,
  },
  {
    id: "checkin",
    nombre: "Check-in",
    resumen: "Entrada con código QR y el historial de quién vino.",
    grupo: "fitness",
    disponible: false,
  },
  {
    id: "marketing",
    nombre: "Marketing",
    resumen: "Promociones y campañas de re-enganche a tus clientes.",
    grupo: "crecimiento",
    disponible: false,
  },
] as const satisfies readonly DefinicionModulo[];

export type ModuloId = (typeof MODULOS)[number]["id"];

const IDS_MODULO = MODULOS.map((m) => m.id) as readonly string[];

export function esModulo(valor: string): valor is ModuloId {
  return IDS_MODULO.includes(valor);
}

export function definicionModulo(id: ModuloId): (typeof MODULOS)[number] {
  return MODULOS.find((m) => m.id === id) as (typeof MODULOS)[number];
}

// ------------------------------------------------------------
// Los tipos de negocio
// ------------------------------------------------------------

/** Las familias del selector "¿qué tipo de negocio administrás?". */
export const FAMILIAS = [
  "belleza",
  "fitness",
  "salud",
  "academia",
  "eventos",
  "otro",
] as const;

export type FamiliaId = (typeof FAMILIAS)[number];

export const FAMILIA_LABEL: Record<FamiliaId, string> = {
  belleza: "Belleza y bienestar",
  fitness: "Fitness y gimnasios",
  salud: "Salud y profesionales",
  academia: "Academias y clases",
  eventos: "Eventos, hospedaje y restaurantes",
  otro: "Otro",
};

type DefinicionTipo = {
  id: string;
  label: string;
  familia: FamiliaId;
  /** En qué verticales se ofrece este tipo al elegirlo. */
  verticales: readonly string[];
  /** Los módulos encendidos si el negocio no opina nada. */
  modulos: readonly ModuloId[];
};

/**
 * Los defaults están calibrados para que TODO negocio que ya existe vea
 * exactamente el mismo panel que veía antes de esta fase (lo cubre
 * modulos.test.ts). Cuando llegue una pantalla nueva, se agrega el
 * módulo al tipo que la necesita y aparece sola en su menú.
 */
export const TIPOS_NEGOCIO = [
  // --- Belleza y bienestar (vertical citas) ---
  {
    id: "barberia",
    label: "Barbería",
    familia: "belleza",
    verticales: ["citas"],
    modulos: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
  },
  {
    id: "salon_belleza",
    label: "Salón de belleza",
    familia: "belleza",
    verticales: ["citas"],
    modulos: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
  },
  {
    id: "unas",
    label: "Uñas",
    familia: "belleza",
    verticales: ["citas"],
    modulos: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
  },
  {
    id: "spa",
    label: "Spa y bienestar",
    familia: "belleza",
    verticales: ["citas"],
    modulos: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
  },
  {
    id: "masajes",
    label: "Masajes",
    familia: "belleza",
    verticales: ["citas"],
    modulos: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
  },

  // --- Salud y profesionales independientes (vertical citas) ---
  {
    id: "consultorio",
    label: "Consultorio",
    familia: "salud",
    verticales: ["citas"],
    modulos: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
  },
  {
    id: "profesional",
    label: "Profesional independiente",
    familia: "salud",
    verticales: ["citas"],
    modulos: ["agenda", "clientes", "servicios", "pagos", "reportes"],
  },

  // --- Fitness y estudios (vertical citas) ---
  // Todos conservan `agenda`: aunque su día gire alrededor de las
  // clases, siguen agendando la evaluación inicial y la sesión
  // personalizada — y hasta la Fase 4 la agenda es su única pantalla
  // operativa.
  {
    id: "gimnasio",
    label: "Gimnasio",
    familia: "fitness",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "equipo",
      "membresias",
      "clases",
      "checkin",
      "pagos",
      "reportes",
    ],
  },
  {
    id: "crossfit",
    label: "CrossFit / funcional",
    familia: "fitness",
    verticales: ["citas"],
    modulos: [
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
  },
  {
    id: "pilates",
    label: "Pilates",
    familia: "fitness",
    verticales: ["citas"],
    modulos: [
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
  },
  {
    id: "yoga",
    label: "Yoga",
    familia: "fitness",
    verticales: ["citas"],
    modulos: [
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
  },
  {
    id: "entrenador",
    label: "Entrenador personal",
    familia: "fitness",
    verticales: ["citas"],
    modulos: ["agenda", "clientes", "servicios", "paquetes", "membresias", "pagos", "reportes"],
  },
  {
    id: "academia",
    label: "Academia",
    familia: "academia",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "equipo",
      "clases",
      "membresias",
      "paquetes",
      "pagos",
      "reportes",
    ],
  },

  // --- Las verticales que ya existían ---
  // Sin `servicios`: Lugares tiene su propio sistema de precios y
  // tarifas por persona, y su panel nunca mostró el catálogo.
  {
    id: "eventos_lugar",
    label: "Salón o lugar para eventos",
    familia: "eventos",
    verticales: ["eventos"],
    modulos: ["agenda", "clientes", "pagos", "reportes"],
  },
  {
    id: "eventos_proveedor",
    label: "Proveedor de eventos",
    familia: "eventos",
    verticales: ["eventos"],
    modulos: ["agenda", "clientes", "servicios", "pagos", "reportes"],
  },
  {
    id: "hospedaje",
    label: "Hospedaje",
    familia: "eventos",
    verticales: ["hospedajes"],
    modulos: ["agenda", "clientes", "servicios", "pagos", "reportes"],
  },
  {
    id: "restaurante",
    label: "Restaurante",
    familia: "eventos",
    verticales: ["restaurantes"],
    modulos: ["agenda", "clientes", "servicios", "equipo", "recursos", "pagos", "reportes"],
  },

  {
    id: "otro",
    label: "Otro",
    familia: "otro",
    verticales: ["citas", "eventos", "hospedajes", "restaurantes"],
    modulos: ["agenda", "clientes", "servicios", "pagos", "reportes"],
  },
] as const satisfies readonly DefinicionTipo[];

export type TipoNegocioId = (typeof TIPOS_NEGOCIO)[number]["id"];

const IDS_TIPO = TIPOS_NEGOCIO.map((t) => t.id) as readonly string[];

export function esTipoNegocio(valor: string): valor is TipoNegocioId {
  return IDS_TIPO.includes(valor);
}

export function definicionTipo(id: TipoNegocioId): (typeof TIPOS_NEGOCIO)[number] {
  return TIPOS_NEGOCIO.find((t) => t.id === id) as (typeof TIPOS_NEGOCIO)[number];
}

/** Los tipos que se le ofrecen a un negocio de esta vertical. */
export function tiposDeVertical(vertical: string): (typeof TIPOS_NEGOCIO)[number][] {
  return TIPOS_NEGOCIO.filter((t) => (t.verticales as readonly string[]).includes(vertical));
}

// ------------------------------------------------------------
// Derivación y resolución
// ------------------------------------------------------------

/**
 * Cuando `tipo_negocio` está en null (que es TODO negocio que existía
 * antes de la 0108), se adivina de la categoría del marketplace. Por eso
 * la columna es anulable: nadie tuvo que correr un update masivo, y la
 * barbería que ya estaba publicada como `categoria='barberia'` se
 * comporta como tipo `barberia` desde el primer render.
 *
 * `gimnasio`, `pilates` y compañía NUNCA salen de acá: hoy no existe
 * una categoría pública para ellos, así que un estudio se publica en
 * 'otros' y elige su tipo en el panel. Eso es a propósito — meter
 * categorías nuevas al directorio es una decisión de producto aparte.
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
    case "eventos":
    default:
      return categoria === "lugares" ? "eventos_lugar" : "eventos_proveedor";
  }
}

/** Los módulos encendidos si el negocio no opinó nada. */
export function modulosPorDefecto(tipo: TipoNegocioId): ModuloId[] {
  return [...definicionTipo(tipo).modulos];
}

/**
 * Los módulos activos de un negocio: el default de su tipo, corregido
 * por las filas de `modulos_negocio` (que guardan solo las diferencias).
 *
 * Un módulo que todavía no tiene pantalla (`disponible: false`) nunca
 * queda activo, aunque alguien haya escrito la fila a mano: prometer
 * una sección que no existe es peor que no ofrecerla.
 */
export function resolverModulos({
  tipo,
  overrides = {},
}: {
  tipo: TipoNegocioId;
  /** modulo → activo, tal como viene de `modulos_negocio`. */
  overrides?: Record<string, boolean>;
}): Set<ModuloId> {
  const activos = new Set<ModuloId>(modulosPorDefecto(tipo));

  for (const [modulo, activo] of Object.entries(overrides)) {
    if (!esModulo(modulo)) continue;
    if (activo) activos.add(modulo);
    else activos.delete(modulo);
  }

  for (const id of [...activos]) {
    if (!definicionModulo(id).disponible) activos.delete(id);
  }

  return activos;
}
