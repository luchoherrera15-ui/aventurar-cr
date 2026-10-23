import { definicionDeActivador } from "./catalogo";
import type { EntradaImpulso } from "./tipos";

/**
 * LOS IMPULSOS PRECONFIGURADOS: siete puntos de partida que el negocio puede revisar, cambiar y activar.
 *
 * NUNCA nacen activos. Crear uno desde una plantilla deja un BORRADOR: el negocio lee el texto,
 * lo ajusta a su voz y recién ahí lo activa. Un mensaje automático que sale a clientes reales sin
 * que su dueño lo haya leído sería una sorpresa fea.
 *
 * El texto cambia según el tipo de tarjeta (un sello no es un punto), por eso cada plantilla es una
 * función del tipo de tarjeta y no un objeto fijo. Los mensajes del Wallet van cortos: el reverso del
 * pase de Apple muestra una línea de hasta 120 caracteres.
 */

export type PlantillaImpulso = {
  id: string;
  nombre: string;
  resumen: string;
  /** Si hoy se puede cumplir. Si no, la pantalla la muestra apagada con el motivo. */
  disponible: boolean;
  motivo?: string;
  /** Lo que se crea, ya adaptado al tipo de tarjeta. */
  entrada: (modo: string) => EntradaImpulso;
};

const HORARIO_INMEDIATO = { modo: "inmediato" as const };
const HORARIO_DE_DIA = { modo: "ventana" as const, desde: "09:00", hasta: "20:00", siguiente_ventana: true };

function base(parcial: Partial<EntradaImpulso> & Pick<EntradaImpulso, "nombre" | "activador" | "titulo" | "cuerpo" | "plantilla">): EntradaImpulso {
  return {
    descripcion: null,
    activador_config: {},
    condiciones: [],
    canal: "wallet",
    retraso_minutos: 0,
    horario: HORARIO_INMEDIATO,
    vigente_desde: null,
    vigente_hasta: null,
    espera_minima_horas: 0,
    ...parcial,
  };
}

const sellos = (modo: string) => modo === "sellos";

export const PLANTILLAS: readonly PlantillaImpulso[] = [
  {
    id: "bienvenida",
    nombre: "Bienvenida",
    resumen: "Un agradecimiento 5 minutos después de que el cliente se inscribe.",
    disponible: definicionDeActivador("inscripcion")?.disponible ?? false,
    entrada: () =>
      base({
        plantilla: "bienvenida",
        nombre: "Bienvenida",
        descripcion: "Le damos las gracias a quien se une a la tarjeta.",
        activador: "inscripcion",
        titulo: "¡Bienvenido a {{nombre_negocio}}!",
        cuerpo: "Hola {{nombre_cliente|}}, gracias por unirte a {{nombre_programa}}. ¡Mostrá tu tarjeta en cada visita!",
        retraso_minutos: 5,
        horario: HORARIO_INMEDIATO,
      }),
  },
  {
    id: "cumpleanos",
    nombre: "Cumpleaños",
    resumen: "Una felicitación el día del cumpleaños, a la hora que elijas.",
    disponible: definicionDeActivador("cumpleanos")?.disponible ?? false,
    motivo: definicionDeActivador("cumpleanos")?.noDisponible,
    entrada: () =>
      base({
        plantilla: "cumpleanos",
        nombre: "Cumpleaños",
        descripcion: "Felicitamos al cliente el día de su cumpleaños.",
        activador: "cumpleanos",
        titulo: "¡Feliz cumpleaños!",
        cuerpo: "{{nombre_cliente|}}, en {{nombre_negocio}} queremos celebrarte. ¡Pasá a visitarnos!",
        horario: { modo: "hora_exacta", hora: "09:00" },
      }),
  },
  {
    id: "primera_visita",
    nombre: "Primera visita",
    resumen: "Un agradecimiento una hora después de la primera visita registrada.",
    disponible: definicionDeActivador("primera_visita")?.disponible ?? false,
    entrada: () =>
      base({
        plantilla: "primera_visita",
        nombre: "Primera visita",
        descripcion: "Le damos las gracias por su primera visita.",
        activador: "primera_visita",
        titulo: "¡Gracias por tu visita!",
        cuerpo: "Gracias por visitar {{nombre_negocio}}. Ya empezaste a sumar en {{nombre_programa}}.",
        retraso_minutos: 60,
        horario: HORARIO_DE_DIA,
      }),
  },
  {
    id: "progreso",
    nombre: "Progreso: te falta poco",
    resumen: "Avisa cuando al cliente le falta poco para su premio.",
    disponible: definicionDeActivador("meta_proxima")?.disponible ?? false,
    entrada: (modo) =>
      base({
        plantilla: "progreso",
        nombre: "Progreso: te falta poco",
        descripcion: "Le recordamos que está cerca de su premio.",
        activador: "meta_proxima",
        activador_config: { faltan: 1 },
        titulo: sellos(modo) ? "¡Te falta solo 1!" : "¡Estás muy cerca!",
        cuerpo: sellos(modo)
          ? "Vas {{sellos_actuales}} de {{meta_sellos}}: en tu próxima visita a {{nombre_negocio}} ganás tu {{nombre_recompensa}}."
          : "Te faltan {{puntos_faltantes}} para tu {{nombre_recompensa}} en {{nombre_negocio}}.",
        horario: HORARIO_INMEDIATO,
      }),
  },
  {
    id: "recompensa",
    nombre: "Recompensa desbloqueada",
    resumen: "Avisa apenas el cliente junta lo necesario para canjear su premio.",
    disponible: definicionDeActivador("recompensa_alcanzada")?.disponible ?? false,
    entrada: () =>
      base({
        plantilla: "recompensa",
        nombre: "Recompensa desbloqueada",
        descripcion: "Le avisamos que ya puede canjear su premio.",
        activador: "recompensa_alcanzada",
        titulo: "¡Premio desbloqueado!",
        cuerpo: "Completaste tu tarjeta: tu {{nombre_recompensa}} te espera en {{nombre_negocio}}.",
        horario: HORARIO_INMEDIATO,
      }),
  },
  {
    id: "recuperacion",
    nombre: "Recuperación de clientes",
    resumen: "Escribe a quien lleva 30 días sin venir, en horario de día, una sola vez.",
    disponible: definicionDeActivador("inactividad")?.disponible ?? false,
    entrada: () =>
      base({
        plantilla: "recuperacion",
        nombre: "Recuperación de clientes",
        descripcion: "Invitamos a volver a quien hace tiempo no viene.",
        activador: "inactividad",
        activador_config: { dias: 30, ventana_dias: 30 },
        titulo: "¡Te extrañamos!",
        cuerpo: "{{nombre_cliente|}}, hace rato no te vemos por {{nombre_negocio}}. ¡Volvé y seguí sumando en tu tarjeta!",
        horario: HORARIO_DE_DIA,
        espera_minima_horas: 720,
      }),
  },
  {
    id: "vencimiento",
    nombre: "Recompensa próxima a vencer",
    resumen: "Avisa antes de que venzan los sellos o el saldo del cliente.",
    disponible: definicionDeActivador("vencimiento_proximo")?.disponible ?? false,
    motivo: definicionDeActivador("vencimiento_proximo")?.noDisponible,
    entrada: () =>
      base({
        plantilla: "vencimiento",
        nombre: "Recompensa próxima a vencer",
        activador: "vencimiento_proximo",
        titulo: "Tu tarjeta está por vencer",
        cuerpo: "No pierdas lo que ya sumaste en {{nombre_negocio}}: pasá a usarlo antes de que venza.",
        horario: HORARIO_DE_DIA,
      }),
  },
];

export function plantillaPorId(id: string): PlantillaImpulso | null {
  return PLANTILLAS.find((p) => p.id === id) ?? null;
}
