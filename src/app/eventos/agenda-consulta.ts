/**
 * ============================================================
 * LA AGENDA POR HORAS DE LOS PROVEEDORES DE EVENTOS
 * ============================================================
 *
 * Todo lo que NO es `categoria === "lugares"` (DJs, animación,
 * pintacaritas, decoración, alimentación, organización, otros) trabaja
 * por HORAS, igual que la vertical de Citas: un DJ hace una fiesta
 * infantil a las 3 p. m. y una boda a las 9 p. m. el mismo sábado, así
 * que una agenda por DÍA le bloquearía la jornada entera por un evento
 * de dos horas.
 *
 * Dos diferencias grandes contra Citas, y son las que justifican este
 * módulo:
 *
 *  1. NO SE RESERVA NADA. Tocar un espacio libre abre el CHAT con la
 *     fecha, la hora y lo que se armó como primer mensaje. Cero holds,
 *     cero depósito, cero comprobante — la negociación sigue en el
 *     chat, que ya es maduro (hilos sin reserva, Realtime, push y
 *     correo) y acepta gente sin cuenta (sesión anónima).
 *  2. La duración NO sale del catálogo. En Citas cada servicio dura lo
 *     que dice `rancho_items.duracion_minutos`; acá sale del COTIZADOR
 *     (`duracionServicio`, en horas), que es lo que la persona arma
 *     ella misma con los steppers.
 *
 * Todo lo de acá es PURO: sin React ni Supabase, para poder probarlo
 * con datos de mentira. El motor de disponibilidad que consume esto es
 * `calcularDisponibilidad` (src/lib/agenda/disponibilidad.ts), que no
 * sabe qué es un vertical y se reusa tal cual.
 */

import { horaAMinutos, horaBonita, minutosAHora, type HorarioSemana } from "@/app/citas/tipos";
import type { RanchoItem } from "@/app/mi-negocio/types";
import {
  duracionServicio,
  type ConfigCobro,
  type LineaCotizacion,
  type SeleccionServicio,
} from "@/lib/cotizador-servicio";
import { fechaLargaCR } from "@/lib/fechas";

/*
 * ⚠️ GEMELO A MANO de `mobile/src/lib/agenda-negocio.ts` (proyecto Expo
 * aparte: no se puede importar, se replica). Los cuatro números de acá
 * abajo son los mismos de allá a propósito — la ventana de horas, el
 * intervalo, el bloque supuesto y la frase de cierre del mensaje. Si
 * uno cambia, cambia en los dos lados o el mismo negocio ofrece horas
 * distintas según por dónde entró el cliente.
 */

/** Primer arranque que se ofrece en la grilla de horas. */
export const PRIMER_ARRANQUE = "08:00";

/**
 * Último arranque. Va más tarde que el 18:00 de una barbería a
 * propósito: un DJ o un animador trabaja de noche y los fines de
 * semana. Y ofrecer de más acá no cuesta nada — tocar una hora NO
 * reserva, solo abre el chat, y el proveedor contesta que no puede.
 */
export const ULTIMO_ARRANQUE = "22:00";

/**
 * Cada cuánto se ofrece un arranque: en punto. Nadie contrata un DJ
 * para las 3 y media, y con media hora la grilla de un día son 28
 * botones en vez de 14.
 */
export const INTERVALO_MINUTOS = 60;

/** Cuántos días adelante muestra la tira de fechas (cuatro semanas). */
export const DIAS_VISIBLES = 28;

/**
 * El bloque que se asume cuando NADA dice cuánto dura el servicio.
 *
 * `duracionServicio` solo sabe contestar en `por_hora` y en
 * `por_evento`/`por_paquete`; para `por_persona`, `por_dia` y
 * `por_unidad` devuelve null — y con razón, porque ahí el precio no se
 * mide en tiempo. Antes de rendirse se mira el catálogo elegido (un
 * paquete con `duracion_horas` sí sabe cuánto dura). Si tampoco hay,
 * se asumen DOS HORAS: el bloque típico de una fiesta infantil, y el
 * mismo default que ya usa la app. Como acá no se aparta nada,
 * equivocarse solo cambia qué arranques se ofrecen y una línea del
 * mensaje —que sale marcada como "aproximada (a confirmar)"
 * justamente para eso.
 */
export const DURACION_SUPUESTA_MINUTOS = 120;

/**
 * El evento del navegador con el que la agenda le pide a `ReservaModal`
 * que se cierre. Va acá (módulo neutral) y no en el modal para no
 * importar un módulo "use client" desde otro lado solo por una cadena.
 *
 * Hace falta porque el panel de chat vive en z-50 y el modal de reserva
 * en z-[100]: sin cerrarlo, el chat que se acaba de abrir queda tapado
 * por el modal que lo abrió.
 */
export const EVENTO_CERRAR_MODAL = "bookea:cerrar-reserva";

const fmtColones = (n: number) => "₡" + Math.round(n).toLocaleString("es-CR");

/** Cuánto dura un ítem del catálogo, si es que lo dice. */
export function minutosDeItem(
  item: Pick<RanchoItem, "duracion_minutos" | "duracion_horas">,
): number | null {
  if (item.duracion_minutos && item.duracion_minutos > 0) return item.duracion_minutos;
  if (item.duracion_horas && item.duracion_horas > 0) {
    return Math.round(item.duracion_horas * 60);
  }
  return null;
}

/**
 * Cuánto dura el evento, en MINUTOS, que es el idioma del motor. El
 * `× 60` es todo el puente entre el cotizador (que habla en horas) y
 * `calcularDisponibilidad`.
 *
 * `supuesta` avisa que el número no lo eligió nadie: lo puso el
 * fallback. La UI y el primer mensaje lo dicen en voz alta en vez de
 * hacerlo pasar por un dato firme.
 */
export function duracionAgenda({
  config,
  seleccion,
  items,
  cantidades,
}: {
  config: ConfigCobro;
  seleccion: SeleccionServicio;
  items: RanchoItem[];
  cantidades: Record<string, number>;
}): { minutos: number; supuesta: boolean } {
  const horas = duracionServicio(config, seleccion);
  if (horas !== null && horas > 0) {
    return { minutos: Math.round(horas * 60), supuesta: false };
  }

  // El catálogo como segunda fuente: si la persona eligió un paquete
  // que declara sus horas, esas mandan. Se toma la MÁS LARGA — con dos
  // paquetes en el pedido, el evento dura lo que dure el más largo.
  const delCatalogo = items
    .filter((i) => (cantidades[i.id] ?? 0) > 0)
    .map(minutosDeItem)
    .filter((m): m is number => m !== null);
  if (delCatalogo.length > 0) {
    return { minutos: Math.max(...delCatalogo), supuesta: false };
  }

  return { minutos: DURACION_SUPUESTA_MINUTOS, supuesta: true };
}

/**
 * El "horario del negocio" que ve el motor, armado para ESTA duración.
 *
 * El motor solo ofrece un arranque si el servicio CABE ENTERO antes del
 * cierre (`t + duración <= fin`). Esa es la regla de una barbería: el
 * corte tiene que terminar antes de bajar la cortina. Un evento no
 * funciona así — el DJ que arranca a las 9 de la noche termina pasada
 * la medianoche, y eso es exactamente lo que se contrató.
 *
 * Por eso el "cierre" que recibe el motor es el ÚLTIMO ARRANQUE MÁS LA
 * DURACIÓN: así la ventana de arranques queda clavada en 06:00–23:00
 * dure el servicio dos horas o seis.
 *
 * El número puede pasar de las 24 horas ("27:00" son las 3 a. m. del
 * día siguiente) y está bien: `horaAMinutos` lo lee como minutos desde
 * la medianoche de ESE día, que es justo lo que significa, y
 * `minutosAHora` solo se le aplica a los arranques, que nunca pasan de
 * las 23:00.
 */
export function horarioDeEventos(duracionMinutos: number): HorarioSemana {
  const dia = {
    abre: PRIMER_ARRANQUE,
    cierra: minutosAHora(horaAMinutos(ULTIMO_ARRANQUE) + Math.max(0, duracionMinutos)),
  };
  // Todos los días abiertos: un proveedor de eventos no tiene horario
  // publicado en ningún lado (la pantalla que guarda `horario_citas`
  // es solo de la vertical Citas), y cerrar días por nuestra cuenta
  // sería inventarle una restricción que él nunca puso.
  return Object.fromEntries(Array.from({ length: 7 }, (_, d) => [String(d), dia]));
}

/** 240 → "4 horas" · 90 → "1 hora 30 min" · 45 → "45 min". */
export function etiquetaDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  const horas = `${h} hora${h === 1 ? "" : "s"}`;
  return m === 0 ? horas : `${horas} ${m} min`;
}

/** A qué hora termina — y si eso ya cae en la madrugada del otro día. */
export function finDeEvento(
  hora: string,
  duracionMinutos: number,
): { hora: string; diaSiguiente: boolean } {
  const total = horaAMinutos(hora) + Math.max(0, duracionMinutos);
  return { hora: minutosAHora(total % 1440), diaSiguiente: total >= 1440 };
}

/** Una línea del pedido del catálogo, ya en el idioma del mensaje. */
export type LineaPedido = {
  nombre: string;
  cantidad: number;
  precio: number | null;
  unidad: string | null;
};

export type DatosPrimerMensaje = {
  /** "YYYY-MM-DD". */
  fecha: string;
  /** "HH:MM". */
  hora: string;
  duracionMinutos: number;
  /** true = la duración la supuso la página, no la eligió la persona. */
  duracionSupuesta: boolean;
  /** Alquiler de varios días: hasta cuándo va. */
  fechaFin?: string | null;
  tipoEvento?: string;
  invitados?: number | null;
  /** Nombre del ítem del catálogo que sustituye la tarifa base (0067). */
  paqueteBase?: string | null;
  /** Elecciones incluidas en la tarifa ("elegí hasta N"): no suman. */
  elecciones?: string[];
  lineasServicio?: LineaCotizacion[];
  pedido?: LineaPedido[];
  /** Alguna línea del pedido no tiene precio publicado. */
  hayACotizar?: boolean;
  notas?: string;
};

/**
 * La línea que cierra SIEMPRE el mensaje. Es la más importante de
 * todas: el proveedor tiene que entender de una que esto NO es una
 * reserva. Por eso se pega después de recortar el cuerpo — si el
 * recorte a 2000 caracteres (el tope de la columna `mensajes.texto`)
 * se la comiera, el mensaje diría justo lo contrario de lo que pasó.
 *
 * Palabra por palabra la misma de `mensajePrimeraConsulta` en la app:
 * el proveedor lee la misma frase venga la consulta de donde venga.
 */
export const CIERRE_CONSULTA =
  "Todavía no hay nada reservado: te escribo para confirmar si tenés esa hora libre.";

/** El tope de la columna `mensajes.texto`. */
const TOPE_MENSAJE = 2000;

/**
 * El primer mensaje del hilo: el resumen de lo que la persona armó en
 * la agenda. Es lo ÚNICO que el proveedor va a leer, así que va en el
 * mismo orden en que se armó (fecha y hora primero, el dinero después)
 * y sin una sola palabra de "reserva".
 *
 * Heredó su forma del armador de resumen del flujo viejo —el que creaba
 * una reserva con depósito, retirado cuando los proveedores de servicio
 * pasaron a agenda por horas—, cambiando el pedido por fecha + hora +
 * servicio + duración. Aquel archivo ya no existe; esta es la única
 * implementación.
 */
export function armarPrimerMensaje(d: DatosPrimerMensaje): string {
  const partes: string[] = [];
  const fin = finDeEvento(d.hora, d.duracionMinutos);
  // fechaLargaCR devuelve "Sábado 21 de..."; acá va en medio de una
  // oración, así que la mayúscula sobra.
  const fechaEnPalabras = fechaLargaCR(d.fecha).toLocaleLowerCase("es-CR");

  // Misma apertura que `mensajePrimeraConsulta` en la app. Ojo:
  // `horaBonita` YA termina en punto ("3:00 p. m."), así que una
  // oración que cierra con una hora no lleva punto propio — si no,
  // sale "a las 3:00 p. m..".
  partes.push(
    `Hola, quiero consultar disponibilidad para el ${fechaEnPalabras} de ` +
      `${horaBonita(d.hora)} a ${horaBonita(fin.hora)}` +
      (fin.diaSiguiente ? " del día siguiente." : ""),
  );
  partes.push(
    `${d.duracionSupuesta ? "Duración aproximada (a confirmar)" : "Duración"}: ` +
      `${etiquetaDuracion(d.duracionMinutos)}.`,
  );
  if (d.fechaFin) {
    partes.push(
      `Alquiler del ${fechaEnPalabras} al ` +
        `${fechaLargaCR(d.fechaFin).toLocaleLowerCase("es-CR")}.`,
    );
  }
  if (d.tipoEvento?.trim()) partes.push(`Tipo de evento: ${d.tipoEvento.trim()}.`);
  if (d.invitados && d.invitados > 0) partes.push(`Invitados: ${d.invitados}.`);
  if (d.paqueteBase) {
    partes.push(`Paquete elegido: ${d.paqueteBase} — sustituye la tarifa base.`);
  }

  const elecciones = (d.elecciones ?? []).map((e) => e.trim()).filter(Boolean);
  if (elecciones.length > 0) {
    partes.push(
      `Elecciones incluidas en la tarifa (sin costo): ${elecciones.join(", ")}.`,
    );
  }

  const lineas = d.lineasServicio ?? [];
  const totalServicio = lineas.reduce((s, l) => s + l.monto, 0);
  if (lineas.length > 0) {
    partes.push(
      "Servicio cotizado:\n" +
        lineas.map((l) => `• ${l.etiqueta}: ${fmtColones(l.monto)}`).join("\n"),
    );
    partes.push(`Estimado del servicio: ${fmtColones(totalServicio)}.`);
  }

  const pedido = (d.pedido ?? []).filter((l) => l.cantidad > 0);
  const totalPedido = pedido.reduce((s, l) => s + (l.precio ?? 0) * l.cantidad, 0);
  if (pedido.length > 0) {
    partes.push(
      "Pedido:\n" +
        pedido
          .map(
            (l) =>
              `• ${l.cantidad}× ${l.nombre}` +
              (l.precio !== null
                ? ` (${fmtColones(l.precio)}${l.unidad ? ` ${l.unidad}` : ""})`
                : " (a cotizar)"),
          )
          .join("\n"),
    );
  }

  const total = totalServicio + totalPedido;
  if (total > 0) {
    const mixto = totalServicio > 0 && totalPedido > 0;
    partes.push(
      `Total estimado${mixto ? " (servicio + pedido)" : ""}: ${fmtColones(total)}` +
        (d.hayACotizar ? " — sin contar lo que se cotiza aparte." : "."),
    );
  }
  if (d.notas?.trim()) partes.push(`Notas: ${d.notas.trim()}`);

  const cuerpo = partes.join("\n").slice(0, TOPE_MENSAJE - CIERRE_CONSULTA.length - 1);
  return `${cuerpo}\n${CIERRE_CONSULTA}`;
}
