/**
 * QUÉ SE PUEDE CAMBIAR DE UNA TARJETA QUE YA EXISTE — Y QUÉ NO.
 *
 * ------------------------------------------------------------------
 * POR QUÉ HACE FALTA DECIDIRLO EN UN SOLO LUGAR
 * ------------------------------------------------------------------
 * El asistente de creación promete «podés cambiar todo después». Casi
 * todo se puede: el nombre, los colores, el icono, el beneficio, las
 * reglas, las recompensas. Una sola cosa no, y es la que más daño
 * hace: EL TIPO.
 *
 * El saldo de un miembro es un número pelado en el ledger. Lo que ese
 * número SIGNIFICA lo pone el tipo de la tarjeta: en sellos, 7 son
 * siete visitas; en gift card, 7 son siete colones; en cashback, siete
 * colones devueltos. Cambiar el tipo con gente adentro no migra nada
 * —no hay nada que migrar— sino que RE-INTERPRETA lo que ya está
 * escrito: el cliente que juntó 7 sellos abre el teléfono y ve ₡7 de
 * saldo.
 *
 * Por eso el candado no es «por las dudas»: es la única regla del
 * módulo que no se puede deshacer con otro guardado.
 *
 * ------------------------------------------------------------------
 * ESTO NO AUTORIZA NADA
 * ------------------------------------------------------------------
 * Es lógica pura para que la PANTALLA pueda decir de antemano qué se
 * puede y qué no —en vez de dejar que el dueño lo descubra con un
 * error— y para que el SERVIDOR lo vuelva a comprobar con exactamente
 * el mismo criterio. Dos criterios distintos serían un candado que se
 * abre por un lado.
 */

import type { EstadoPrograma } from "./reglas";
import { TIPOS_TARJETA, UNIDAD_SALDO, type TipoTarjeta } from "./tipos-tarjeta";

export type Veredicto = { puede: true } | { puede: false; motivo: string };

export type SituacionTarjeta = {
  /** Clientes que YA tienen esta tarjeta. El candado cuelga de acá. */
  miembros: number;
  /** El estado del ciclo de vida (0125), ya resuelto. */
  estado: EstadoPrograma;
  /** El tipo de hoy. */
  tipo: TipoTarjeta;
};

/**
 * ¿Se puede tocar esta tarjeta?
 *
 * Archivada es NO, y no es rigidez: archivar es la salida que libera
 * el cupo del paquete y congela el historial. Una tarjeta archivada no
 * emite pases, así que editarla no cambia nada de lo que el cliente
 * ve — solo produce la sensación de haber arreglado algo.
 */
export function puedeEditarse(s: SituacionTarjeta): Veredicto {
  if (s.estado === "archivado") {
    return {
      puede: false,
      motivo:
        "Esta tarjeta está archivada: no emite pases y su historial no se toca. " +
        "Restaurala desde Tarjetas —queda en Pausado, con los sellos de todos intactos— " +
        "y de ahí la editás y la activás.",
    };
  }
  return { puede: true };
}

/**
 * ¿Se puede cambiar el TIPO?
 *
 * Solo mientras no haya nadie adentro. Con un solo miembro ya hay un
 * saldo escrito, y el saldo no se puede reinterpretar sin mentirle a
 * quien lo ganó.
 */
export function puedeCambiarTipo(s: SituacionTarjeta): Veredicto {
  const noEditable = puedeEditarse(s);
  if (!noEditable.puede) return noEditable;

  if (s.miembros > 0) {
    const unidad = TIPOS_TARJETA[s.tipo].acumula ? UNIDAD_SALDO[s.tipo] : "usos";
    return {
      puede: false,
      motivo:
        `Ya hay ${s.miembros} ${s.miembros === 1 ? "cliente" : "clientes"} con esta tarjeta. ` +
        `Cambiar el tipo no convierte sus ${unidad}: los deja significando otra cosa. ` +
        `Si necesitás otra clase de programa, creá una tarjeta nueva y archivá esta.`,
    };
  }
  return { puede: true };
}

/**
 * El aviso de mover la META con gente adentro.
 *
 * No bloquea —bajar la meta de 10 a 8 es una promoción legítima, y
 * subirla también es decisión del negocio— pero se dice ANTES, porque
 * las dos direcciones tienen una consecuencia que no se ve:
 *
 *   · bajar la meta REGALA la regalía a quien ya pasó el número nuevo;
 *   · subirla se la SACA a quien ya la tenía completa.
 *
 * Devuelve null cuando no hay nada que avisar: sin miembros, o sin
 * cambio.
 */
export function avisoDeMeta({
  miembros,
  anterior,
  nueva,
  tipo,
}: {
  miembros: number;
  anterior: number | null;
  nueva: number | null;
  tipo: TipoTarjeta;
}): string | null {
  if (miembros <= 0) return null;
  if (anterior === null || nueva === null) return null;
  if (anterior === nueva) return null;

  const unidad = UNIDAD_SALDO[tipo];
  const quienes = `${miembros} ${miembros === 1 ? "cliente" : "clientes"}`;

  if (nueva < anterior) {
    return (
      `Vas a bajar la meta de ${anterior} a ${nueva} ${unidad}. ` +
      `Los ${quienes} que ya tenés pasan a estar más cerca, y el que ya llegó a ${nueva} ` +
      `se gana la regalía en su próxima visita.`
    );
  }
  return (
    `Vas a subir la meta de ${anterior} a ${nueva} ${unidad}. ` +
    `A los ${quienes} que ya tenés les va a faltar más — y al que ya la tenía completa ` +
    `se le aleja la regalía que creía ganada.`
  );
}

/**
 * ¿Esta tarjeta promete algo que sale de una RECOMPENSA?
 *
 * Solo sellos y puntos. En esos dos el saldo no significa nada por sí
 * solo: «7» no es un premio, el premio es la recompensa que se canjea
 * con esos 7. En los otros seis el beneficio viaja DENTRO de la
 * tarjeta —el cupón es el descuento, la membresía es el carnet, el
 * evento es la entrada— o el saldo ya es plata (gift card, cashback).
 *
 * De acá sale una regla que estaba rompiendo el producto: reactivar un
 * programa exigía «al menos una recompensa activa», y esos seis tipos
 * NUNCA tienen una sembrada. El dueño que pausaba su cupón recibía una
 * instrucción que no podía obedecer y su tarjeta quedaba en pausa para
 * siempre.
 */
export function pideRecompensa(tipo: TipoTarjeta): boolean {
  return tipo === "sellos" || tipo === "puntos";
}
