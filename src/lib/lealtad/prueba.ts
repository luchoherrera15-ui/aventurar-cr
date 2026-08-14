import { definicionDe, esPlanSinCosto } from "./planes";

/**
 * LA PRUEBA DE 14 DÍAS, CON FINAL.
 *
 * ------------------------------------------------------------------
 * QUÉ ESTABA MAL
 * ------------------------------------------------------------------
 * El catálogo decía `diasPrueba: 14`, la landing lo pintaba, el wizard
 * lo prometía… y nada en el código lo hacía cumplir. `diasPrueba` solo
 * se leía para ESCRIBIR el texto «14 días, sin tarjeta». El alta
 * automática (`crearGratisAlInstante`) guardaba el complemento con
 * `vence_en: null`, y `null` en `tiene_addon()` significa
 * «para siempre». Un negocio en prueba operaba gratis, sin límite de
 * tiempo, hasta que alguien lo notara a mano.
 *
 * ------------------------------------------------------------------
 * DÓNDE VIVE EL FINAL: EN LA BASE, NO EN UN CRON
 * ------------------------------------------------------------------
 * El corte se escribe UNA vez, al crear, en `addons_negocio.vence_en`.
 * De ahí en adelante lo hace cumplir `tiene_addon()` (0077), que ya
 * sabía vencer desde siempre:
 *
 *     and (a.vence_en is null or a.vence_en > now())
 *
 * Esa es la propiedad que importa: **la prueba se acaba sola aunque no
 * corra ni un solo proceso nuestro**. No hay trabajo periódico que
 * pueda caerse en silencio y dejar a cien negocios operando gratis; si
 * el servidor entero se apaga un mes, al volver las pruebas vencidas
 * están vencidas. Un cron que APAGA es una pieza que puede fallar
 * abierta; una fecha que la base compara es una pieza que no puede.
 *
 * Lo único que sí necesita correr es el AVISO PREVIO —un correo de
 * cortesía— y por eso se cuelga del cron diario que ya existe
 * (`/api/recordatorios`) en vez de estrenar uno: ver
 * ./avisos-prueba.ts. Si ese aviso no sale, el negocio se entera igual
 * al entrar al panel, y nadie opera gratis de más.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO SE USA `cuentas.prueba_hasta` (0134)
 * ------------------------------------------------------------------
 * Porque sería una SEGUNDA fecha de corte que nadie hace cumplir, y
 * dos fechas para lo mismo se desincronizan. La única que gobierna el
 * módulo es `addons_negocio.vence_en`, porque es la que lee
 * `tiene_addon()`, que es por donde pasa el panel entero.
 *
 * Y además hoy es inalcanzable: las filas de `cuentas` salen del
 * backfill de la 0134 y NADA en el código crea una nueva, así que un
 * negocio dado de alta hoy —justo el que estrena la prueba— no tiene
 * fila donde escribir `prueba_hasta`. El día que algo cree cuentas de
 * verdad, esa columna puede pasar a ser el espejo declarativo del
 * corte; hasta entonces, escribirla sería inventar un dato que nadie
 * lee.
 */

/** Un día, en milisegundos. */
const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * Cuántos días antes del corte se le avisa al negocio.
 *
 * Tres y no uno: cambiar de paquete implica hacer un SINPE y esperar
 * que alguien de Bookea lo confirme. Avisar la víspera es avisar tarde.
 */
export const DIAS_AVISO_PREVIO = 3;

/**
 * Cuándo se le acaba la prueba a este paquete, contando desde `desde`.
 *
 * `null` = el paquete NO es una prueba y no vence por tiempo (los tres
 * de pago, y también los retirados). Ese null es el que se escribe en
 * `addons_negocio.vence_en` y significa «sin vencimiento», que es
 * justo lo correcto para un paquete pago.
 *
 * Se suman milisegundos y no «meses de calendario» a propósito: Costa
 * Rica no tiene horario de verano, así que 14 × 24 h son exactamente
 * 14 días y el corte cae a la misma hora del reloj en que se dio de
 * alta. Nadie pierde ni gana medio día por haberse registrado a las
 * 11 de la noche.
 */
export function finDePrueba(plan: string | null, desde: Date = new Date()): string | null {
  const dias = definicionDe(plan)?.diasPrueba ?? 0;
  if (dias <= 0) return null;
  return new Date(desde.getTime() + dias * UN_DIA).toISOString();
}

/**
 * ¿El alta de este paquete tiene que nacer con fecha de corte?
 *
 * Es la comprobación que evita el caso absurdo: un paquete que se
 * contrata sin pagar y que NO vence. Si alguna vez el catálogo tuviera
 * uno así, esto lo delata (y hay una prueba que lo frena).
 */
export function esPruebaSinCosto(plan: string | null): boolean {
  return esPlanSinCosto(plan) && (definicionDe(plan)?.diasPrueba ?? 0) > 0;
}

export type EstadoPrueba = {
  /** El paquete es una prueba Y tiene fecha de corte escrita. */
  esPrueba: boolean;
  /** Ya pasó la fecha: el complemento está muerto. */
  vencida: boolean;
  /**
   * Días ENTEROS que faltan. 0 = se termina hoy mismo.
   * null = no es una prueba (no hay cuenta regresiva que mostrar).
   */
  diasRestantes: number | null;
  /** Entró en la ventana del aviso previo (y todavía no venció). */
  porVencer: boolean;
  /** El corte, tal cual está guardado. null = no vence. */
  venceEn: string | null;
};

/**
 * En qué punto de su prueba está un negocio.
 *
 * Recibe el plan Y la fecha guardada porque las dos cosas pueden
 * discrepar y la que manda es la GUARDADA: un negocio dado de alta
 * antes de que esto existiera tiene `plan_lealtad: 'prueba'` con
 * `vence_en: null`, y ese no está «vencido» — está sin corte. Tratarlo
 * como vencido sería apagarle el programa de un día para otro por un
 * cambio de código, que es exactamente lo que el repo no hace.
 *
 * `diasRestantes` se redondea hacia ABAJO: mientras falten 3 días y
 * medio dice «3», nunca «4». Prometer de más en una cuenta regresiva
 * es la forma barata de que alguien se quede afuera creyendo que le
 * quedaba un día.
 */
export function estadoDePrueba(d: {
  plan: string | null;
  venceEn: string | null;
  ahora?: Date;
}): EstadoPrueba {
  const ahora = d.ahora ?? new Date();
  const esPaqueteDePrueba = (definicionDe(d.plan)?.diasPrueba ?? 0) > 0;

  if (!esPaqueteDePrueba || !d.venceEn) {
    return {
      esPrueba: false,
      vencida: false,
      diasRestantes: null,
      porVencer: false,
      venceEn: d.venceEn,
    };
  }

  const fin = new Date(d.venceEn).getTime();
  // Una fecha ilegible no puede convertirse en «vencido»: sin dato
  // confiable, el negocio sigue trabajando y alguien lo mira a mano.
  if (Number.isNaN(fin)) {
    return {
      esPrueba: false,
      vencida: false,
      diasRestantes: null,
      porVencer: false,
      venceEn: d.venceEn,
    };
  }

  const faltan = fin - ahora.getTime();
  // `<= 0` y no `< 0`: al llegar el minuto exacto ya venció, igual que
  // hace `tiene_addon()` con su `vence_en > now()`. Las dos puertas
  // tienen que contestar lo mismo o la pantalla diría una cosa y el
  // panel haría otra.
  const vencida = faltan <= 0;
  const diasRestantes = vencida ? 0 : Math.floor(faltan / UN_DIA);

  return {
    esPrueba: true,
    vencida,
    diasRestantes,
    porVencer: !vencida && diasRestantes <= DIAS_AVISO_PREVIO,
    venceEn: d.venceEn,
  };
}

/**
 * Cómo se le dice al dueño cuánto le queda. Sale de UNA función para
 * que el panel y el correo nunca cuenten distinto.
 */
export function textoRestante(estado: EstadoPrueba): string | null {
  if (!estado.esPrueba) return null;
  if (estado.vencida) return "Tu prueba terminó";
  if (estado.diasRestantes === 0) return "Tu prueba termina hoy";
  if (estado.diasRestantes === 1) return "Te queda 1 día de prueba";
  return `Te quedan ${estado.diasRestantes} días de prueba`;
}
