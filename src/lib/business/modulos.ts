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
export const GRUPOS = [
  "agenda",
  "gestion",
  "clinica",
  "fitness",
  "finanzas",
  "crecimiento",
  "config",
] as const;

export type GrupoId = (typeof GRUPOS)[number];

export const GRUPO_LABEL: Record<GrupoId, string> = {
  agenda: "Agenda",
  gestion: "Gestión",
  clinica: "Clínico",
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
   * ¿Ya tiene pantalla? Los de las fases siguientes se declaran igual
   * para que el panel los muestre como "próximamente" en vez de
   * aparecer de la nada — pero no se pueden encender hasta que exista
   * qué encender.
   *
   * DECLARAR ≠ CONSTRUIR. Que un tipo liste `expediente` significa
   * "un consultorio trabaja con expedientes", no "hay una pantalla de
   * expedientes". La diferencia la hace `resolverModulos`, que borra
   * todo lo que tenga `disponible: false` ANTES de devolver el
   * conjunto: el menú se arma de ese conjunto, así que un módulo sin
   * pantalla no puede producir un ítem que lleve a un 404 — ni por
   * default, ni por una fila escrita a mano en `modulos_negocio`.
   *
   * Se eligió declararlos (y no esperar a que existan) por dos razones
   * concretas:
   *   1. Es la lista la que define la IDENTIDAD del tipo. Si un
   *      consultorio no declara nada clínico hasta la fase que lo
   *      construya, hoy es indistinguible de una barbería, que es
   *      justo el problema que hay que resolver.
   *   2. La pantalla de módulos ya sabe pintarlas apagadas con
   *      "próximamente" (modulos-panel.tsx), y `guardarModulos` ya se
   *      niega a guardarlas. El andamiaje existe; lo que faltaba era
   *      usarlo.
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
    id: "fichas",
    nombre: "Fichas técnicas",
    resumen: "La ficha de cada cliente: fórmulas, alergias y el antes y después.",
    grupo: "gestion",
    disponible: false,
  },
  {
    id: "inventario",
    nombre: "Inventario",
    resumen: "Producto y consumibles: cuánto queda, qué se gasta y qué vence.",
    grupo: "gestion",
    disponible: false,
  },

  // --- Clínico ---
  // Grupo aparte y no dentro de Gestión a propósito: son datos de
  // salud. Separarlos desde el catálogo deja el permiso, la auditoría y
  // la retención como una decisión de un solo bloque el día que se
  // construyan, en vez de repartida entre las secciones de siempre.
  {
    id: "expediente",
    nombre: "Expediente",
    resumen: "El historial de cada paciente: antecedentes, notas y adjuntos.",
    grupo: "clinica",
    disponible: false,
  },
  {
    id: "formularios",
    nombre: "Formularios",
    resumen: "Consentimientos, escalas y cuestionarios que el paciente llena.",
    grupo: "clinica",
    disponible: false,
  },
  {
    id: "teleconsulta",
    nombre: "Teleconsulta",
    resumen: "La consulta por video, con su recordatorio y su cobro.",
    grupo: "clinica",
    disponible: false,
  },
  {
    id: "recetas",
    nombre: "Recetas",
    resumen: "Prescripciones con dosis y plantillas, y el registro de lo emitido.",
    grupo: "clinica",
    disponible: false,
  },
  {
    id: "laboratorio",
    nombre: "Laboratorio",
    resumen: "Órdenes y resultados de laboratorio e imágenes, y quién los leyó.",
    grupo: "clinica",
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
    id: "comisiones",
    nombre: "Comisiones",
    resumen: "Cuánto le toca a cada quien del equipo, sacado de la agenda.",
    grupo: "finanzas",
    disponible: false,
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

/**
 * El piso: lo que TODO negocio tiene, sea lo que sea. Quien reserva
 * tiene agenda, quien reserva tiene un cliente del otro lado, todo el
 * mundo cobra y todo el mundo quiere saber cómo le fue.
 *
 * `servicios` y `equipo` quedan afuera a propósito: un lugar de eventos
 * no tiene catálogo (cobra por fecha) y un profesional independiente no
 * tiene a quién asignarle nada. Es lo mínimo común, no lo habitual.
 */
export const MODULOS_BASE = [
  "agenda",
  "clientes",
  "pagos",
  "reportes",
] as const satisfies readonly ModuloId[];

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
 *
 * Esta lista es la RESPUESTA a "¿qué clase de negocio sos?": es de acá
 * de donde salen el menú, el vocabulario y las herramientas que el
 * panel ofrece. Por eso incluye módulos que todavía no tienen pantalla
 * — `disponible: false` los deja fuera del conjunto activo (ver
 * `resolverModulos`), así que suman identidad sin poder romper nada.
 * Agregar uno de esos a un tipo NO le cambia el panel a ningún negocio
 * vivo: lo único que cambia es que aparece como "próximamente" en
 * Configuración → Módulos.
 */
export const TIPOS_NEGOCIO = [
  // --- Belleza y bienestar (vertical citas) ---
  // Los cinco comparten el motor (agenda por horas, servicios, equipo)
  // y se separan por lo que de verdad los distingue: la barbería vive
  // de la silla y la comisión; el salón y el spa, de la cabina, la
  // ficha con la fórmula y el paquete prepagado; las uñas, del
  // producto que vence; los masajes, de la contraindicación y el bono.
  {
    id: "barberia",
    label: "Barbería",
    familia: "belleza",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "servicios",
      "equipo",
      // La silla ES la capacidad de una barbería: dos barberos libres y
      // una sola silla no son dos espacios.
      "recursos",
      // Lo que se gasta por servicio (ceras, navajas, toallas). Sin
      // lotes ni vencimientos: acá el consumible se acaba, no caduca.
      "inventario",
      "pagos",
      // El barbero cobra porcentaje, y hoy esa liquidación se hace en
      // papel. Es el reclamo más repetido del rubro.
      "comisiones",
      "reportes",
      "marketing",
    ],
  },
  {
    id: "salon_belleza",
    label: "Salón de belleza",
    familia: "belleza",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "servicios",
      "equipo",
      // La fórmula del color y la alergia al tinte: sin la ficha, el
      // retoque de dentro de seis semanas se adivina.
      "fichas",
      "recursos",
      // Acá el producto SÍ vence y se compra por lote.
      "inventario",
      // Paquetes sí (el bono de diez secados), membresías no: el salón
      // vende visitas prepagadas, no un plan mensual. Eso es del spa.
      "paquetes",
      "pagos",
      "comisiones",
      "reportes",
      "marketing",
    ],
  },
  {
    id: "unas",
    label: "Uñas",
    familia: "belleza",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "servicios",
      "equipo",
      // El diseño anterior y la reacción al acrílico.
      "fichas",
      "inventario",
      "paquetes",
      "pagos",
      "comisiones",
      "reportes",
      "marketing",
      // Sin `recursos`: cada técnica trabaja en su propia mesa, así que
      // la capacidad ya la da el equipo y una lista de mesas sería una
      // pantalla que no decide nada.
    ],
  },
  {
    id: "spa",
    label: "Spa y bienestar",
    familia: "belleza",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "servicios",
      "equipo",
      "fichas",
      // La cabina es el cuello de botella del spa: se puede reservar
      // doble a la misma hora si nadie la controla.
      "recursos",
      "inventario",
      "paquetes",
      "membresias",
      "pagos",
      "comisiones",
      "reportes",
      "marketing",
    ],
  },
  {
    id: "masajes",
    label: "Masajes",
    familia: "belleza",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "servicios",
      "equipo",
      // Contraindicaciones y zonas a evitar: es una ficha de salud
      // ligera, no un expediente clínico.
      "fichas",
      "recursos",
      "paquetes",
      "membresias",
      "pagos",
      "comisiones",
      "reportes",
      "marketing",
      // Sin `inventario`: el aceite no se administra por lote ni se
      // revende; no hay stock que gestionar.
    ],
  },

  // --- Salud y profesionales independientes (vertical citas) ---
  // La frontera entre los dos NO es el tamaño, es qué se hace en la
  // consulta. `consultorio` es el médico/odontológico: prescribe y
  // pide exámenes. `profesional` es quien atiende solo y no receta —
  // psicología, nutrición, terapia, y también el no-clínico.
  //
  // Ninguno de sus módulos clínicos existe todavía, y eso es a
  // propósito: guardar datos de salud tiene consecuencias legales
  // (consentimiento, retención, quién puede leer qué) que se deciden
  // cuando se construyan. Declararlos acá define la identidad del
  // panel; no habilita ni guarda nada.
  {
    id: "consultorio",
    label: "Consultorio",
    familia: "salud",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "servicios",
      "equipo",
      "expediente",
      "formularios",
      "teleconsulta",
      "recetas",
      "laboratorio",
      "pagos",
      "reportes",
      // Sin `marketing`: hacerle campañas de re-enganche a un paciente
      // por su diagnóstico es exactamente lo que no queremos empujar.
      // La misma razón vale para `comisiones`: pagarle al médico por
      // volumen de consulta es una decisión del negocio, no un default
      // que Bookea deba sugerir.
    ],
  },
  {
    id: "profesional",
    label: "Profesional independiente",
    familia: "salud",
    verticales: ["citas"],
    modulos: [
      "agenda",
      "clientes",
      "servicios",
      "expediente",
      "formularios",
      // La sesión virtual es la mitad de la agenda de un psicólogo o un
      // nutricionista; en un consultorio médico es la excepción.
      "teleconsulta",
      "pagos",
      "reportes",
      // Sin `equipo`: atiende solo — es lo que ya lo distinguía.
      // Sin `recetas` ni `laboratorio`: no prescribe.
    ],
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
  // Con `equipo`: un proveedor de eventos trabaja por horas igual que
  // una barbería (ver `usaAgendaPorHoras`), y sin el equipo no puede
  // decir quién atiende cada cosa ni qué horario tiene cada quien —
  // que es justo lo que hace falta para agendar dos fiestas el mismo
  // día. Es el único default que cambió desde la Fase 1.
  {
    id: "eventos_proveedor",
    label: "Proveedor de eventos",
    familia: "eventos",
    verticales: ["eventos"],
    modulos: ["agenda", "clientes", "servicios", "equipo", "pagos", "reportes"],
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

/**
 * ¿Este negocio agenda POR HORAS y POR SERVICIOS (como una barbería), o
 * por FECHA ENTERA (como un rancho de fiestas)?
 *
 * La misma pregunta la hacen seis lugares del panel del dueño: si el
 * catálogo pide duración en minutos y limpieza después, si hay horario
 * semanal, colaboradores y bloqueos, y si existe la pantalla de agenda
 * del día. Cada uno la contestaba con `vertical === 'citas'`, y eso
 * dejaba afuera a los proveedores de eventos: un DJ hace una fiesta
 * infantil a las 3 p.m. y una boda a las 9 p.m. el mismo día — necesita
 * exactamente lo mismo que una barbería.
 *
 * La frontera es LA MISMA que separa `eventos_lugar` de
 * `eventos_proveedor` acá arriba, y por eso se deriva de ahí en vez de
 * repetir `categoria !== 'lugares'` seis veces: un lugar se alquila por
 * fecha completa, con depósito y calendario por día, y esa es su forma
 * de trabajar — no una limitación que haya que emparejar.
 *
 * No mira `tipo_negocio` a propósito: cómo se agenda lo decide dónde se
 * publica el negocio, y un lugar sigue siendo un lugar aunque elija
 * otro tipo de panel. Hospedajes y Restaurantes quedan afuera también a
 * propósito — no es que la regla no les calce, es que su panel todavía
 * no se diseñó, y cambiárselo de rebote desde acá sería una decisión de
 * producto escondida adentro de un helper.
 */
export function usaAgendaPorHoras(
  vertical: string | null | undefined,
  categoria: string | null | undefined,
): boolean {
  const donde = vertical ?? "eventos";
  if (donde === "citas") return true;
  if (donde !== "eventos") return false;
  return tipoNegocioEfectivo(donde, categoria, null) === "eventos_proveedor";
}

/** Los módulos encendidos si el negocio no opinó nada. */
export function modulosPorDefecto(tipo: TipoNegocioId): ModuloId[] {
  return [...definicionTipo(tipo).modulos];
}

/**
 * Lo que este tipo de negocio VA A TENER pero todavía no se puede
 * abrir. Es el complemento exacto de `resolverModulos`: lo que el tipo
 * declara menos lo que ya tiene pantalla.
 *
 * Existe para que la única forma de enseñar un módulo sin construir sea
 * ésta — una lista que se pinta apagada y no lleva a ningún lado.
 * Cualquier pantalla que quiera decir "esto viene en camino" pregunta
 * acá; ninguna arma links con esto.
 */
export function modulosProximamente(tipo: TipoNegocioId): ModuloId[] {
  return modulosPorDefecto(tipo).filter((id) => !definicionModulo(id).disponible);
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
