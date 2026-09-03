import type { EstadoVisible } from "./programas";
import { TIPOS_TARJETA, type TipoTarjeta } from "./tipos-tarjeta";

/**
 * EN QUÉ MOMENTO ESTÁ EL PROGRAMA, que es lo que decide qué pinta la
 * pantalla de Inicio.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO ALCANZA CON "¿HAY DATOS O NO?"
 * ------------------------------------------------------------------
 * Inicio era un folleto fijo: decía lo mismo el día 1 y el día 400.
 * Al volverlo tablero aparece el problema opuesto — un negocio recién
 * creado vería cuatro métricas en cero, que no informan nada y encima
 * desmoralizan.
 *
 * Entre "no hay nada" y "está andando" hay tres situaciones REALES y
 * cada una se arregla con una acción distinta:
 *
 *   · la tarjeta existe pero está en borrador → no emite pases;
 *   · emite pases pero no tiene recompensa   → no promete nada;
 *   · promete algo pero nadie se afilió      → falta repartir el QR.
 *
 * Un solo mensaje genérico para las tres deja a la persona sabiendo
 * que algo falta y sin saber qué hacer.
 *
 * ------------------------------------------------------------------
 * EL ORDEN DE LAS PREGUNTAS ES LA LÓGICA
 * ------------------------------------------------------------------
 * Se pregunta de adentro hacia afuera: primero si la tarjeta existe,
 * después si funciona, después si promete, y de último si alguien la
 * tiene. Al revés, una tarjeta en borrador diría «nadie se afilió» —
 * cierto y completamente inútil, porque nadie PUEDE afiliarse.
 *
 * Lógica pura, sin Supabase: se puede testear entera.
 */

export type MomentoInicio =
  /** El negocio no tiene ninguna tarjeta viva. */
  | "sin-tarjeta"
  /** Tiene tarjeta, pero ninguna está emitiendo pases ahora mismo. */
  | "sin-publicar"
  /** Emite pases y acumula saldo, pero no hay recompensa que ganar. */
  | "sin-meta"
  /** Todo listo y nadie afiliado todavía. */
  | "sin-clientes"
  /** Hay programa y hay gente: el tablero muestra números. */
  | "en-marcha";

export function momentoDeInicio(datos: {
  /** Tarjetas que NO están archivadas: las archivadas no cuentan como
   *  algo que el negocio tenga — para volver a emitir hay que crear. */
  vivas: number;
  /** De esas, cuántas emiten pases ahora (activas y en vigencia). */
  operan: number;
  /** El tipo de la tarjeta principal, del catálogo de ocho. */
  tipo: TipoTarjeta;
  /** Hay una recompensa activa que marque la meta del pase. */
  tieneMeta: boolean;
  miembros: number;
}): MomentoInicio {
  if (datos.vivas === 0) return "sin-tarjeta";
  if (datos.operan === 0) return "sin-publicar";
  // La meta solo la pide lo que ACUMULA. Un cupón, un evento o una
  // membresía llevan su beneficio adentro: exigirles una recompensa
  // los dejaría eternamente "incompletos" sin que falte nada.
  if (TIPOS_TARJETA[datos.tipo].acumula && !datos.tieneMeta) return "sin-meta";
  if (datos.miembros === 0) return "sin-clientes";
  return "en-marcha";
}

/**
 * Qué le pasa a una tarjeta que no está emitiendo pases, y qué hacer.
 *
 * Un Record y no un `if` encadenado: agregar un estado visible obliga
 * a escribirle su consejo (TypeScript exige la llave). Un estado sin
 * consejo es justo el «algo falta» mudo que esta pantalla existe para
 * evitar.
 *
 * `activo` y `archivado` no se muestran nunca desde acá —el primero
 * porque entonces sí opera, el segundo porque una archivada no cuenta
 * como tarjeta viva— pero se escriben igual: el día que alguien los
 * use, el texto ya está y es cierto.
 */
export type ConsejoTarjeta = {
  titulo: string;
  consejo: string;
  /** A dónde lleva el botón. La pantalla resuelve el enlace. */
  ir: "tarjeta" | "programas" | "crear";
  boton: string;
};

export const CONSEJO_TARJETA: Record<EstadoVisible, ConsejoTarjeta> = {
  borrador: {
    titulo: "Tu tarjeta está en borrador",
    consejo:
      "Un borrador no emite pases: aunque compartás el link, tus clientes no la pueden agregar. Abrí «Tarjeta digital», marcá «Programa activo» y guardá.",
    ir: "tarjeta",
    boton: "Publicar mi tarjeta",
  },
  pausado: {
    titulo: "Tu tarjeta está pausada",
    consejo:
      "Nadie pierde lo que lleva juntado, pero mientras esté pausada no se suma nada ni se canjea nada. Reanudala cuando quieras.",
    ir: "tarjeta",
    boton: "Reanudar la tarjeta",
  },
  programado: {
    titulo: "Tu tarjeta todavía no arranca",
    consejo:
      "Está lista y esperando su fecha de inicio. Ese día empieza a emitir pases sola, sin que tengás que tocar nada.",
    ir: "programas",
    boton: "Ver la fecha",
  },
  vencido: {
    titulo: "Tu tarjeta venció",
    consejo:
      "Pasó su fecha de vigencia: dejó de emitir pases y los canjes se rechazan. El historial queda; para volver a emitir, armá una nueva.",
    ir: "crear",
    boton: "Crear otra tarjeta",
  },
  archivado: {
    titulo: "Tu tarjeta está archivada",
    consejo:
      "No emite pases ni acepta el escáner, pero nada se borró: los sellos de tus clientes siguen guardados. Restaurala desde Tarjetas —queda en Pausado y de ahí la activás— o creá otra.",
    ir: "programas",
    boton: "Ver mis tarjetas",
  },
  activo: {
    titulo: "Tu tarjeta está activa",
    consejo: "Está emitiendo pases con normalidad.",
    ir: "programas",
    boton: "Ver mis tarjetas",
  },
};
