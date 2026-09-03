/**
 * ¿PROCEDE ESTE CANJE?
 *
 * El motor que decide, y el único lugar donde se decide. Es lógica
 * pura —sin base, sin reloj, sin sesión— para poder probar cada
 * rechazo contra un caso concreto en vez de esperar a que pase en un
 * mostrador.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO NO PUEDE VIVIR EN EL PASE
 * ------------------------------------------------------------------
 * El pase que el cliente lleva en el teléfono es un DIBUJO: una copia
 * que se actualiza cuando el teléfono quiere, y de la que se puede
 * sacar una captura. Un cupón vencido sigue viéndose igual de lindo en
 * una captura de pantalla del mes pasado.
 *
 * Por eso ninguna regla se comprueba mirando el pase. Se comprueban
 * acá, con el estado real de la base, en el momento del canje.
 *
 * ------------------------------------------------------------------
 * CADA RECHAZO TIENE CÓDIGO Y FRASE
 * ------------------------------------------------------------------
 * El código va a la auditoría —para poder contar después cuántos
 * canjes se cayeron por vencimiento y cuántos por tope— y la frase va
 * a la pantalla del mostrador, donde alguien tiene que explicarle algo
 * a un cliente que está esperando.
 *
 * Un «no se pudo» genérico deja al empleado sin nada que decir.
 */

import { estadoVisible, type FilaPrograma } from "./programas";

export type MotivoRechazo =
  | "programa_no_opera"
  | "fuera_de_vigencia"
  | "dia_no_permitido"
  | "fuera_de_horario"
  | "saldo_insuficiente"
  | "uso_unico_agotado"
  | "tope_cliente"
  | "tope_global";

export type Veredicto =
  | { ok: true }
  | { ok: false; codigo: MotivoRechazo; motivo: string };

/** Las reglas de la 0136, tal como vienen de la fila. */
export type ReglasPrograma = FilaPrograma & {
  uso_unico?: boolean | null;
  max_por_cliente?: number | null;
  max_global?: number | null;
  /** 0 = domingo. Vacío o null = todos los días. */
  dias_permitidos?: number[] | null;
  /** "HH:MM". null = a cualquier hora. */
  hora_desde?: string | null;
  hora_hasta?: string | null;
};

export type ContextoCanje = {
  programa: ReglasPrograma;
  /** Saldo del miembro, derivado del ledger. */
  saldo: number;
  /** Lo que cuesta lo que se quiere canjear. */
  costo: number;
  /** Canjes que ESTE cliente ya hizo en este programa. */
  canjesDelCliente: number;
  /** Canjes de TODOS los clientes en este programa. */
  canjesTotales: number;
  /** Momento actual en hora de Costa Rica: "2026-08-13T14:30". */
  ahoraCR: string;
};

/**
 * El día de la semana de una fecha ISO, sin que la zona horaria lo
 * corra un día.
 *
 * `new Date("2026-08-13")` es medianoche UTC, que en Costa Rica es el
 * 12 a las 6 de la tarde — y el jueves pasaría por miércoles. Tratando
 * la fecha como un día del calendario (Date.UTC sobre sus tres
 * números) el día es el que dice el texto, corra donde corra el
 * servidor.
 */
export function diaDeLaSemana(fechaISO: string): number {
  const [a, m, d] = fechaISO.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * ¿La hora cae dentro de la ventana?
 *
 * Contempla la ventana que CRUZA LA MEDIANOCHE (22:00–02:00), que es
 * la de cualquier bar: sin esto, «de 10 de la noche a 2 de la mañana»
 * no dejaría canjear nunca, porque ninguna hora es a la vez mayor que
 * 22:00 y menor que 02:00.
 */
export function dentroDelHorario(
  hora: string,
  desde: string | null | undefined,
  hasta: string | null | undefined,
): boolean {
  if (!desde && !hasta) return true;
  const h = hora.slice(0, 5);
  const d = desde ? desde.slice(0, 5) : "00:00";
  const t = hasta ? hasta.slice(0, 5) : "23:59";
  return d <= t ? h >= d && h <= t : h >= d || h <= t;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * El veredicto.
 *
 * El ORDEN de las comprobaciones no es casual: se responde primero lo
 * que el cliente no puede cambiar (la tarjeta no está vigente, hoy no
 * es día) y al final lo que sí (le falta saldo). Así la frase que
 * escucha es la más útil: «esta promo era hasta el viernes» sirve más
 * que «te faltan 3 sellos» cuando además está vencida.
 */
export function autorizarCanje(ctx: ContextoCanje): Veredicto {
  const { programa: p, ahoraCR } = ctx;
  const fecha = ahoraCR.slice(0, 10);
  const hora = ahoraCR.slice(11, 16) || "00:00";

  // 1. ¿La tarjeta opera? Cubre borrador, pausada, archivada,
  //    programada y vencida de una sola vez.
  const estado = estadoVisible(p, ahoraCR);
  if (estado !== "activo") {
    if (estado === "vencido") {
      return {
        ok: false,
        codigo: "fuera_de_vigencia",
        motivo: `Esta tarjeta venció el ${p.vigente_hasta ?? "—"}.`,
      };
    }
    if (estado === "programado") {
      return {
        ok: false,
        codigo: "fuera_de_vigencia",
        motivo: `Esta tarjeta empieza a valer el ${p.vigente_desde ?? "—"}.`,
      };
    }
    // La archivada se explica con la salida adelante: acá decía «está
    // archivado y no acepta canjes» (además con el género cambiado), y
    // el empleado no tenía nada útil que decirle al cliente ni al dueño.
    // Es la MISMA frase que devuelve el escáner (operar-core.ts) — dos
    // textos distintos para el mismo problema mandan a dos lugares.
    if (estado === "archivado") {
      return {
        ok: false,
        codigo: "programa_no_opera",
        motivo:
          "Esta tarjeta está archivada — los sellos de tus clientes siguen guardados. " +
          "Restaurala desde el panel, en Tarjetas → Archivadas.",
      };
    }
    return {
      ok: false,
      codigo: "programa_no_opera",
      motivo: `Esta tarjeta está ${estado === "pausado" ? "pausada" : estado} y no acepta canjes.`,
    };
  }

  // 2. ¿Hoy es día? («30% de lunes a jueves»)
  const dias = p.dias_permitidos ?? [];
  if (dias.length > 0 && !dias.includes(diaDeLaSemana(fecha))) {
    const nombres = [...dias].sort().map((d) => DIAS[d]).join(", ");
    return {
      ok: false,
      codigo: "dia_no_permitido",
      motivo: `Este beneficio vale ${nombres}.`,
    };
  }

  // 3. ¿Estamos en hora?
  if (!dentroDelHorario(hora, p.hora_desde, p.hora_hasta)) {
    return {
      ok: false,
      codigo: "fuera_de_horario",
      motivo: `Este beneficio vale de ${p.hora_desde ?? "00:00"} a ${p.hora_hasta ?? "23:59"}.`,
    };
  }

  // 4. ¿Le queda alguno? Uso único primero: es el tope más estricto y
  //    la frase más clara.
  if (p.uso_unico && ctx.canjesDelCliente >= 1) {
    return {
      ok: false,
      codigo: "uso_unico_agotado",
      motivo: "Este beneficio es de un solo uso y ya se usó.",
    };
  }
  const maxCliente = p.max_por_cliente ?? null;
  if (maxCliente !== null && ctx.canjesDelCliente >= maxCliente) {
    return {
      ok: false,
      codigo: "tope_cliente",
      motivo: `Cada cliente puede usarlo ${maxCliente} ${maxCliente === 1 ? "vez" : "veces"}.`,
    };
  }
  const maxGlobal = p.max_global ?? null;
  if (maxGlobal !== null && ctx.canjesTotales >= maxGlobal) {
    return {
      ok: false,
      codigo: "tope_global",
      motivo: "Este beneficio se agotó.",
    };
  }

  // 5. Lo último: el saldo, que es lo único que el cliente puede
  //    resolver volviendo otro día.
  if (ctx.saldo < ctx.costo) {
    const faltan = ctx.costo - ctx.saldo;
    return {
      ok: false,
      codigo: "saldo_insuficiente",
      motivo: `Le faltan ${faltan} para llegar.`,
    };
  }

  return { ok: true };
}

/**
 * La llave de idempotencia de un canje.
 *
 * El problema real: en un mostrador con señal mala, el empleado toca
 * «canjear», no ve respuesta, y toca otra vez. Sin esto son DOS
 * canjes: al cliente se le descuenta doble y el negocio entrega uno.
 *
 * La llave se arma con lo que identifica al INTENTO —quién, qué, y en
 * qué minuto— y no con un azar: dos toques del mismo botón dentro del
 * mismo minuto producen la misma llave, y el segundo choca contra el
 * índice único y no escribe nada.
 *
 * Un minuto es la ventana a propósito: suficiente para cubrir el doble
 * toque y el reintento del navegador, corto para no bloquear al
 * cliente que de verdad canjea dos cafés seguidos.
 */
export function llaveDeCanje(datos: {
  miembroId: string;
  recompensaId: string;
  /** "2026-08-13T14:30" en hora de Costa Rica. */
  ahoraCR: string;
}): string {
  return `${datos.miembroId}:${datos.recompensaId}:${datos.ahoraCR.slice(0, 16)}`;
}
