import type { CampoCondicion, IdActivador, IdCanal, OpCondicion } from "./tipos";

/**
 * EL CATÁLOGO DE LOS IMPULSOS: qué puede disparar uno, por dónde puede salir
 * y con qué se puede filtrar.
 *
 * ── POR QUÉ VIVE EN CÓDIGO Y NO EN LA BASE ─────────────────────────
 * Un activador nuevo es una función nueva del motor, no una fila: no tiene
 * sentido que la base lo acepte si el código no sabe correrlo. Por eso la
 * tabla solo exige la FORMA del texto y este archivo es la lista de lo que
 * existe. Sumar un activador = una entrada acá + su regla en `motor.ts`,
 * sin migración.
 *
 * ── LO QUE NO ESTÁ DISPONIBLE SE DECLARA, NO SE FINGE ───────────────
 * Cada entrada que hoy no se puede cumplir con datos reales lleva
 * `disponible: false` y un `noDisponible` que explica por qué y qué
 * falta. La pantalla las muestra aparte, apagadas, con esa explicación:
 * ofrecer «cumpleaños» sin tener la fecha de nacimiento de nadie sería
 * prometer un mensaje que nunca sale.
 */

/** Los tipos de tarjeta en los que el ledger cuenta sellos, puntos o colones. */
export const MODOS_CON_SALDO = ["sellos", "puntos", "cashback"] as const;

export type GrupoActivador = "alta" | "actividad" | "progreso" | "tiempo";

export type ParametroActivador = {
  campo: "dias" | "ventana_dias" | "faltan";
  etiqueta: string;
  ayuda: string;
  min: number;
  max: number;
  defecto: number;
  unidad: string;
};

export type DefinicionActivador = {
  id: IdActivador;
  etiqueta: string;
  descripcion: string;
  grupo: GrupoActivador;
  disponible: boolean;
  /** Por qué no está disponible y qué falta. Solo si `disponible` es false. */
  noDisponible?: string;
  /** Tipos de tarjeta en los que tiene sentido. "todos" = cualquiera. */
  modos: "todos" | readonly string[];
  /** 'evento' = lo dispara algo que pasó; 'tiempo' = lo detecta un barrido periódico. */
  fuente: "evento" | "tiempo";
  /** Necesita que la tarjeta tenga una recompensa activa (una meta). */
  requiereRecompensa?: boolean;
  parametros?: readonly ParametroActivador[];
  /** Una aclaración honesta sobre qué tan fiable es la señal. */
  nota?: string;
};

export const ACTIVADORES: readonly DefinicionActivador[] = [
  {
    id: "inscripcion",
    etiqueta: "Se inscribe un cliente",
    descripcion: "Apenas alguien se une a la tarjeta, por el QR, el mostrador o el enlace.",
    grupo: "alta",
    disponible: true,
    modos: "todos",
    fuente: "evento",
    nota: "Es la señal más segura: queda registrada en el momento exacto de la inscripción.",
  },
  {
    id: "pase_apple",
    etiqueta: "Agrega la tarjeta a Apple Wallet",
    descripcion: "Cuando el cliente guarda la tarjeta en el Wallet de su iPhone.",
    grupo: "alta",
    disponible: true,
    modos: "todos",
    fuente: "evento",
    nota: "Confirmado: el iPhone avisa a Bookea cuando se guarda el pase. Se dispara una sola vez por cliente.",
  },
  {
    id: "pase_google",
    etiqueta: "Agrega la tarjeta a Google Wallet",
    descripcion: "Cuando el cliente guarda la tarjeta en Google Wallet.",
    grupo: "alta",
    disponible: false,
    noDisponible:
      "Google Wallet no avisa cuando alguien guarda la tarjeta, así que no se puede confirmar. " +
      "Para clientes con Android usá «Se inscribe un cliente», que sí queda registrado.",
    modos: "todos",
    fuente: "evento",
  },
  {
    id: "primera_visita",
    etiqueta: "Registra su primera visita",
    descripcion: "La primera vez que recibe un sello o puntos por una visita o compra de verdad.",
    grupo: "actividad",
    disponible: true,
    modos: MODOS_CON_SALDO,
    fuente: "evento",
    nota: "El sello de regalo de bienvenida no cuenta como visita.",
  },
  {
    id: "sello_registrado",
    etiqueta: "Recibe un sello",
    descripcion: "Cada vez que el cliente suma un sello, o solo al llegar a ciertos sellos.",
    grupo: "actividad",
    disponible: true,
    modos: ["sellos"],
    fuente: "evento",
    nota: "Para no saturar, conviene elegir los sellos que importan (por ejemplo el 3 y el 5).",
  },
  {
    id: "puntos_acumulados",
    etiqueta: "Acumula puntos o cashback",
    descripcion: "Cada vez que el cliente suma puntos o cashback por una compra.",
    grupo: "actividad",
    disponible: true,
    modos: ["puntos", "cashback"],
    fuente: "evento",
  },
  {
    id: "meta_proxima",
    etiqueta: "Está cerca de su premio",
    descripcion: "Cuando le faltan pocos sellos o puntos para llegar a la recompensa.",
    grupo: "progreso",
    disponible: true,
    modos: MODOS_CON_SALDO,
    fuente: "evento",
    requiereRecompensa: true,
    parametros: [
      {
        campo: "faltan",
        etiqueta: "Cuando le falten",
        ayuda: "Cuántos sellos o puntos le faltan para el premio.",
        min: 1,
        max: 50,
        defecto: 1,
        unidad: "para el premio",
      },
    ],
    nota: "Si el cliente suma otro sello antes de que salga el mensaje, ya no se envía (quedaría desactualizado).",
  },
  {
    id: "recompensa_alcanzada",
    etiqueta: "Llega a su premio",
    descripcion: "Cuando el cliente junta lo necesario para canjear su recompensa.",
    grupo: "progreso",
    disponible: true,
    modos: MODOS_CON_SALDO,
    fuente: "evento",
    requiereRecompensa: true,
    nota: "Si el cliente ya lo canjeó antes de que salga el mensaje, no se envía.",
  },
  {
    id: "canje_realizado",
    etiqueta: "Canjea un premio",
    descripcion: "Cuando el cliente canjea una recompensa en el mostrador.",
    grupo: "progreso",
    disponible: true,
    modos: MODOS_CON_SALDO,
    fuente: "evento",
  },
  {
    id: "inactividad",
    etiqueta: "Lleva días sin venir",
    descripcion: "Cuando pasan varios días desde la última visita o canje del cliente.",
    grupo: "tiempo",
    disponible: true,
    modos: MODOS_CON_SALDO,
    fuente: "tiempo",
    parametros: [
      {
        campo: "dias",
        etiqueta: "Días sin venir",
        ayuda: "Se le escribe cuando cumple estos días sin actividad.",
        min: 1,
        max: 365,
        defecto: 30,
        unidad: "días",
      },
      {
        campo: "ventana_dias",
        etiqueta: "Seguir intentando hasta",
        ayuda:
          "Pasados estos días más, se da por perdido y no se le escribe. Evita que, al activar el impulso, " +
          "le lleguen mensajes a quienes se fueron hace un año.",
        min: 1,
        max: 365,
        defecto: 30,
        unidad: "días más",
      },
    ],
    nota: "Quien nunca vino no cuenta: no «dejó de venir», nunca empezó. Se revisa una vez por hora.",
  },
  {
    id: "cumpleanos",
    etiqueta: "Es su cumpleaños",
    descripcion: "El día del cumpleaños del cliente, a la hora que elijas.",
    grupo: "tiempo",
    disponible: false,
    noDisponible:
      "Bookea todavía no guarda la fecha de cumpleaños de los clientes (el formulario de inscripción no la pide). " +
      "Para activarlo hace falta capturar ese dato, con su consentimiento y su aviso de privacidad.",
    modos: "todos",
    fuente: "tiempo",
  },
  {
    id: "vencimiento_proximo",
    etiqueta: "Sus sellos o saldo están por vencer",
    descripcion: "Unos días antes de que venzan los sellos o el saldo del cliente.",
    grupo: "tiempo",
    disponible: false,
    noDisponible:
      "Bookea ya avisa solo antes de que venzan los sellos o el saldo (Reglas → Vencimiento). " +
      "Se deja ahí para no mandarle dos veces el mismo mensaje.",
    modos: "todos",
    fuente: "tiempo",
  },
  {
    id: "nivel_alcanzado",
    etiqueta: "Sube de nivel",
    descripcion: "Cuando el cliente pasa a un nivel superior (Plata, Oro…).",
    grupo: "progreso",
    disponible: false,
    noDisponible: "Las tarjetas de Bookea no tienen niveles de cliente, así que no hay un nivel que alcanzar.",
    modos: "todos",
    fuente: "evento",
  },
];

const ACTIVADORES_POR_ID = new Map<string, DefinicionActivador>(ACTIVADORES.map((a) => [a.id, a]));

export function definicionDeActivador(id: string): DefinicionActivador | null {
  return ACTIVADORES_POR_ID.get(id) ?? null;
}

/** ¿Este activador tiene sentido en este tipo de tarjeta? */
export function activadorAplicaAlModo(def: DefinicionActivador, modo: string): boolean {
  return def.modos === "todos" || def.modos.includes(modo);
}

/** Los activadores que se pueden elegir para una tarjeta de este tipo, y los que no (con su motivo). */
export function activadoresParaModo(modo: string): {
  disponibles: DefinicionActivador[];
  noDisponibles: DefinicionActivador[];
} {
  const disponibles: DefinicionActivador[] = [];
  const noDisponibles: DefinicionActivador[] = [];
  for (const a of ACTIVADORES) {
    if (!a.disponible) noDisponibles.push(a);
    else if (activadorAplicaAlModo(a, modo)) disponibles.push(a);
  }
  return { disponibles, noDisponibles };
}

// ═══════════════════════════════════════════════════════════════════
//  CANALES
// ═══════════════════════════════════════════════════════════════════

export type DefinicionCanal = {
  id: IdCanal;
  etiqueta: string;
  descripcion: string;
  disponible: boolean;
  /** Qué integración falta. Solo si `disponible` es false. */
  falta?: string;
  /** Largo máximo del título y del cuerpo en este canal. */
  tituloMax: number;
  cuerpoMax: number;
  /** El mensaje se escribe en una sola línea (el reverso del pase de Apple no admite más). */
  unaLinea: boolean;
  /** Pide el consentimiento del cliente para este canal (`persona_acepta`). */
  requiereConsentimiento: boolean;
  /** Lo que conviene saber antes de elegirlo. */
  limites: readonly string[];
};

export const CANALES: readonly DefinicionCanal[] = [
  {
    id: "wallet",
    etiqueta: "Tarjeta en el Wallet",
    descripcion: "Un aviso en la tarjeta que el cliente tiene en su teléfono.",
    disponible: true,
    tituloMax: 40,
    cuerpoMax: 120,
    unaLinea: true,
    requiereConsentimiento: false,
    limites: [
      "Llega solo a quien tiene la tarjeta guardada en el Wallet.",
      "Google Wallet: llega en todas las tarjetas. Google limita las notificaciones que suenan a unas pocas por día y por tarjeta; pasado el tope el mensaje entra igual, sin sonido.",
      "Apple Wallet: el mensaje individual solo se muestra en las tarjetas de Foorkie. En una tarjeta propia de Bookea el aviso a un solo cliente no es posible en iPhone.",
      "Ni Apple ni Google confirman que el cliente lo vio: «enviado» quiere decir que el proveedor lo aceptó.",
    ],
  },
  {
    id: "correo",
    etiqueta: "Correo electrónico",
    descripcion: "Un correo a la dirección del cliente, con enlace para darse de baja.",
    disponible: true,
    tituloMax: 80,
    cuerpoMax: 600,
    unaLinea: false,
    requiereConsentimiento: true,
    limites: [
      "Solo se envía a quien aceptó recibir correos de este negocio. Sin ese permiso, el mensaje se omite.",
      "Las tarjetas de Foorkie no envían correos desde acá: los manda Foorkie.",
      "Los correos que rebotan o se marcan como spam se suprimen automáticamente.",
    ],
  },
  {
    id: "sms",
    etiqueta: "SMS",
    descripcion: "Un mensaje de texto al celular del cliente.",
    disponible: false,
    falta: "No hay un proveedor de SMS integrado (por ejemplo Twilio) ni el permiso de los clientes para este canal.",
    tituloMax: 0,
    cuerpoMax: 160,
    unaLinea: true,
    requiereConsentimiento: true,
    limites: [],
  },
  {
    id: "whatsapp",
    etiqueta: "WhatsApp",
    descripcion: "Un mensaje de WhatsApp al celular del cliente.",
    disponible: false,
    falta:
      "No hay integración con la API de WhatsApp Business (cuenta verificada, número y plantillas aprobadas por Meta). " +
      "Los enlaces wa.me que existen en el sitio abren un chat a mano, no envían mensajes.",
    tituloMax: 0,
    cuerpoMax: 1000,
    unaLinea: false,
    requiereConsentimiento: true,
    limites: [],
  },
  {
    id: "push_web",
    etiqueta: "Notificación web",
    descripcion: "Una notificación en el navegador del cliente.",
    disponible: false,
    falta: "Bookea no tiene notificaciones web push: no hay service worker ni claves VAPID.",
    tituloMax: 0,
    cuerpoMax: 200,
    unaLinea: true,
    requiereConsentimiento: true,
    limites: [],
  },
];

const CANALES_POR_ID = new Map<string, DefinicionCanal>(CANALES.map((c) => [c.id, c]));

export function definicionDeCanal(id: string): DefinicionCanal | null {
  return CANALES_POR_ID.get(id) ?? null;
}

// ═══════════════════════════════════════════════════════════════════
//  CONDICIONES
// ═══════════════════════════════════════════════════════════════════

export type TipoCondicion = "numero" | "booleano" | "opciones";

export type DefinicionCondicion = {
  id: CampoCondicion;
  /** La etiqueta puede depender del tipo de tarjeta («Sellos actuales» / «Puntos» / «Saldo»). */
  etiqueta: (modo: string) => string;
  ayuda: string;
  tipo: TipoCondicion;
  ops: readonly OpCondicion[];
  min?: number;
  max?: number;
  opciones?: readonly { valor: string; etiqueta: string }[];
  modos: "todos" | readonly string[];
};

/**
 * Solo lo que se puede calcular con datos que Bookea SÍ tiene. Quedan afuera a propósito:
 * el nivel del cliente (no existen niveles), el gasto total y el ticket promedio (el monto de la
 * compra es opcional en el mostrador, así que el número mentiría) y la cercanía de un cliente
 * (la ubicación es del negocio, no de la persona).
 */
export const CONDICIONES: readonly DefinicionCondicion[] = [
  {
    id: "visitas",
    etiqueta: () => "Número de visitas",
    ayuda: "Cuántas veces vino (sin contar el sello de regalo de bienvenida).",
    tipo: "numero",
    ops: ["gte", "lte", "eq"],
    min: 0,
    max: 100000,
    modos: MODOS_CON_SALDO,
  },
  {
    id: "saldo",
    etiqueta: (modo) =>
      modo === "sellos" ? "Sellos actuales" : modo === "puntos" ? "Puntos disponibles" : "Saldo de cashback",
    ayuda: "Lo que el cliente tiene acumulado ahora mismo.",
    tipo: "numero",
    ops: ["gte", "lte", "eq"],
    min: 0,
    max: 10_000_000,
    modos: MODOS_CON_SALDO,
  },
  {
    id: "canjes",
    etiqueta: () => "Premios canjeados",
    ayuda: "Cuántas recompensas canjeó en total.",
    tipo: "numero",
    ops: ["gte", "lte", "eq"],
    min: 0,
    max: 100000,
    modos: MODOS_CON_SALDO,
  },
  {
    id: "dias_sin_actividad",
    etiqueta: () => "Días sin venir",
    ayuda: "Días desde su última visita o canje. Quien nunca vino no cumple esta condición.",
    tipo: "numero",
    ops: ["gte", "lte"],
    min: 0,
    max: 3650,
    modos: MODOS_CON_SALDO,
  },
  {
    id: "antiguedad_dias",
    etiqueta: () => "Días desde que se inscribió",
    ayuda: "La antigüedad del cliente en la tarjeta.",
    tipo: "numero",
    ops: ["gte", "lte"],
    min: 0,
    max: 3650,
    modos: "todos",
  },
  {
    id: "cliente",
    etiqueta: () => "Tipo de cliente",
    ayuda: "Nuevo: hasta una visita. Recurrente: dos o más.",
    tipo: "opciones",
    ops: ["es"],
    opciones: [
      { valor: "nuevo", etiqueta: "Cliente nuevo" },
      { valor: "recurrente", etiqueta: "Cliente recurrente" },
    ],
    modos: MODOS_CON_SALDO,
  },
  {
    id: "recompensa_disponible",
    etiqueta: () => "Tiene un premio listo para canjear",
    ayuda: "Su saldo alcanza para la recompensa más barata.",
    tipo: "booleano",
    ops: ["es"],
    modos: MODOS_CON_SALDO,
  },
  {
    id: "tiene_pase",
    etiqueta: () => "Tiene la tarjeta en el Wallet",
    ayuda: "Guardó la tarjeta en Apple Wallet o Google Wallet.",
    tipo: "booleano",
    ops: ["es"],
    modos: "todos",
  },
];

const CONDICIONES_POR_ID = new Map<string, DefinicionCondicion>(CONDICIONES.map((c) => [c.id, c]));

export function definicionDeCondicion(id: string): DefinicionCondicion | null {
  return CONDICIONES_POR_ID.get(id) ?? null;
}

export function condicionesParaModo(modo: string): DefinicionCondicion[] {
  return CONDICIONES.filter((c) => c.modos === "todos" || c.modos.includes(modo));
}

export const ETIQUETA_OP: Record<OpCondicion, string> = {
  gte: "es al menos",
  lte: "es como máximo",
  eq: "es exactamente",
  es: "es",
};

// ═══════════════════════════════════════════════════════════════════
//  TOPES DEL MOTOR
// ═══════════════════════════════════════════════════════════════════

/** Veces que se intenta mandar una tarea antes de darla por fallida. */
export const MAX_INTENTOS = 3;
/** Minutos de espera antes del reintento número N (1-based): 5 y 30. */
export const ESPERA_REINTENTO_MIN: readonly number[] = [5, 30];
/** Una tarea que lleva más de esto esperando su hora ya no tiene sentido mandarla. */
export const TOLERANCIA_RETRASO_HORAS = 24;
/** Máximo de mensajes de impulsos que un mismo cliente recibe en 24 horas, sumando todos los impulsos. */
export const TOPE_DIARIO_POR_CLIENTE = 3;
/** Cuántos impulsos (sin contar los archivados) puede tener una tarjeta. */
export const MAX_IMPULSOS_POR_TARJETA = 40;
