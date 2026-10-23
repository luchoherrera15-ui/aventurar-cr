/**
 * LOS TIPOS DE LOS IMPULSOS AUTOMÁTICOS.
 *
 * Un impulso es una regla del negocio: «cuando pase X, esperá Y y mandale Z
 * a ese cliente». Este archivo no hace nada: solo dice cómo se llaman las
 * cosas, para que el motor, las acciones del servidor y la pantalla hablen
 * el mismo idioma. Va sin imports de servidor a propósito: lo usa también
 * el navegador (la vista previa y la validación en vivo).
 */

export const ESTADOS_IMPULSO = ["borrador", "activo", "pausado", "archivado"] as const;
export type EstadoImpulso = (typeof ESTADOS_IMPULSO)[number];

/**
 * El camino de un mensaje:
 *   programada  espera su hora (o está lista para que la tome un worker)
 *   pendiente   falló y espera su reintento
 *   procesando  un worker la tiene tomada
 *   enviada     el PROVEEDOR la aceptó (Resend, APNs, Google). No quiere decir que se vio.
 *   entregada   solo si el proveedor confirmó la entrega (hoy ningún canal lo confirma)
 *   omitida     se decidió no mandarla, con su motivo
 *   fallida     se agotaron los reintentos, o el resultado quedó incierto
 *   cancelada   el impulso se pausó o se borró antes de que saliera
 */
export const ESTADOS_TAREA = [
  "programada",
  "pendiente",
  "procesando",
  "enviada",
  "entregada",
  "omitida",
  "fallida",
  "cancelada",
] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

/** Los estados en los que una tarea todavía puede salir. */
export const ESTADOS_TAREA_ABIERTOS: readonly EstadoTarea[] = ["programada", "pendiente"];

export type IdCanal = "wallet" | "correo" | "sms" | "whatsapp" | "push_web";

export type IdActivador =
  | "inscripcion"
  | "pase_apple"
  | "pase_google"
  | "primera_visita"
  | "sello_registrado"
  | "puntos_acumulados"
  | "meta_proxima"
  | "recompensa_alcanzada"
  | "canje_realizado"
  | "inactividad"
  | "cumpleanos"
  | "vencimiento_proximo"
  | "nivel_alcanzado";

/** Parámetros propios de cada activador. Todo opcional: cada uno usa lo suyo. */
export type ConfigActivador = {
  /** inactividad: días sin venir para considerarlo. */
  dias?: number;
  /** inactividad: hasta cuántos días después de ese umbral se le sigue escribiendo. */
  ventana_dias?: number;
  /** meta_proxima: cuántos sellos/puntos le faltan. */
  faltan?: number;
  /** sello_registrado: solo al llegar a estos sellos (vacío = en cada sello). */
  sellos?: number[];
};

export type CampoCondicion =
  | "visitas"
  | "saldo"
  | "canjes"
  | "dias_sin_actividad"
  | "antiguedad_dias"
  | "cliente"
  | "recompensa_disponible"
  | "tiene_pase";

export type OpCondicion = "gte" | "lte" | "eq" | "es";

export type Condicion = {
  campo: CampoCondicion;
  op: OpCondicion;
  valor: number | boolean | string;
};

export type ModoHorario = "inmediato" | "hora_exacta" | "ventana";

/**
 * Cuándo puede salir el mensaje, siempre en la zona horaria del NEGOCIO.
 *   inmediato    apenas pase el retraso. Sin restricciones.
 *   hora_exacta  a esa hora (la próxima vez que sea esa hora), en los días permitidos.
 *   ventana      entre `desde` y `hasta`, en los días permitidos. Si cae afuera,
 *                `siguiente_ventana` decide: esperar a la próxima o no mandarlo.
 */
export type Horario = {
  modo: ModoHorario;
  /** HH:MM (24 h). Para hora_exacta. */
  hora?: string;
  /** HH:MM. Para ventana. */
  desde?: string;
  hasta?: string;
  /** 0 = domingo … 6 = sábado. Vacío o ausente = todos. */
  dias?: number[];
  siguiente_ventana?: boolean;
};

export type Impulso = {
  id: string;
  rancho_id: string;
  programa_id: string;
  nombre: string;
  descripcion: string | null;
  activador: string;
  activador_config: ConfigActivador;
  condiciones: Condicion[];
  canal: string;
  titulo: string;
  cuerpo: string;
  retraso_minutos: number;
  horario: Horario;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  espera_minima_horas: number;
  estado: EstadoImpulso;
  plantilla: string | null;
  version: number;
  activado_en: string | null;
  ultimo_escaneo_en: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Lo que el negocio escribe: todo lo editable de un impulso, nada más. */
export type EntradaImpulso = Pick<
  Impulso,
  | "nombre"
  | "descripcion"
  | "activador"
  | "activador_config"
  | "condiciones"
  | "canal"
  | "titulo"
  | "cuerpo"
  | "retraso_minutos"
  | "horario"
  | "vigente_desde"
  | "vigente_hasta"
  | "espera_minima_horas"
  | "plantilla"
>;

export type EventoImpulso = {
  id: string;
  rancho_id: string;
  programa_id: string;
  miembro_id: string;
  tipo: "inscripcion" | "pase_apple" | "ledger_ganado" | "ledger_canjeado" | string;
  clave: string;
  ocurrido_en: string;
  datos: Record<string, unknown>;
  intentos: number;
};

export type Tarea = {
  id: string;
  impulso_id: string;
  rancho_id: string;
  programa_id: string;
  miembro_id: string;
  evento_id: string | null;
  clave: string;
  canal: string;
  ejecutar_en: string;
  estado: EstadoTarea;
  intentos: number;
  proximo_intento_en: string | null;
  reclamada_en: string | null;
  envio_iniciado_en: string | null;
  enviada_en: string | null;
  entregada_en: string | null;
  motivo: string | null;
  detalle: string | null;
  mensaje_titulo: string | null;
  mensaje_cuerpo: string | null;
  version_impulso: number | null;
  created_at: string;
  updated_at: string;
};

/**
 * Lo que se sabe de UN cliente en el momento de decidir si se le escribe y de
 * armar el mensaje. Todo sale de datos reales (ledger, pases, miembros): lo
 * que no se puede saber no está acá.
 */
export type ContextoCliente = {
  /** Nombre de pila, o null si no se conoce. */
  nombre: string | null;
  nombreNegocio: string;
  nombrePrograma: string;
  modo: string;
  /** Sellos, puntos o colones de cashback (la suma del ledger). */
  saldo: number;
  /** Lo que cuesta la recompensa activa más barata; null = la tarjeta no tiene. */
  meta: number | null;
  recompensa: string | null;
  /** Veces que vino (sellos/puntos ganados que NO son el regalo de bienvenida). */
  visitas: number;
  canjes: number;
  /** AAAA-MM-DD en la zona del negocio; null = nunca vino. */
  ultimaActividad: string | null;
  diasSinActividad: number | null;
  /** Días desde que se inscribió. */
  antiguedadDias: number;
  plataformas: ReadonlyArray<"apple" | "google">;
};

/** Lo que se sabe de la tarjeta y del negocio, igual para todos sus clientes. */
export type InfoPrograma = {
  programaId: string;
  ranchoId: string;
  nombrePrograma: string;
  nombreNegocio: string;
  modo: string;
  /** Zona horaria del negocio (`ranchos.zona_horaria`). */
  zona: string;
  /** true = la tarjeta puede acumular y canjear ahora (activa y vigente). */
  opera: boolean;
  /** true = tarjeta de Foorkie: los correos los manda Foorkie, y Apple sí muestra el mensaje por cliente. */
  esFoorkie: boolean;
  meta: number | null;
  recompensa: string | null;
  cuentaId: string | null;
};
