/**
 * EL MOSTRADOR — qué significa «canjear» en cada una de las ocho
 * tarjetas, y cómo se le dice al empleado.
 *
 * Lógica pura, sin base y sin reloj, para poder probar cada decisión
 * contra un caso concreto en vez de esperar a que pase con un cliente
 * enfrente.
 *
 * ------------------------------------------------------------------
 * EL PROBLEMA QUE ESTE ARCHIVO RESUELVE
 * ------------------------------------------------------------------
 * `sembrarRecompensa` solo sembraba fila en `recompensas` cuando
 * `metaDe(beneficio)` devolvía algo, y `metaDe` solo responde para
 * sellos, puntos y gift card. O sea que CINCO de los ocho tipos —cupón,
 * descuento, membresía, evento y cashback— nacían sin ninguna
 * recompensa, y sin fila en `recompensas` el botón de canje no se puede
 * ni dibujar: `meta` llega null desde el panel.
 *
 * Resultado real, verificado: escanear un cupón de un solo uso le
 * acreditaba 1 punto, cada vez, y la pantalla decía «¡Sello sumado!».
 * La tarjeta que el negocio vendió como «un café gratis» era, en la
 * práctica, un contador que no llevaba a ninguna parte.
 *
 * ------------------------------------------------------------------
 * LA DECISIÓN: DOS FAMILIAS, UN SOLO MECANISMO
 * ------------------------------------------------------------------
 * Canjear significa siempre lo mismo —consumir el beneficio que la
 * tarjeta promete y DEJARLO ESCRITO en `canjes`— y lo que cambia por
 * tipo es cómo se llega a poder consumirlo:
 *
 *   ACUMULATIVAS (sellos, puntos, gift card, cashback)
 *     Se llega juntando. El costo es la meta: 10 sellos, el mínimo de
 *     puntos, el valor de la gift card, el tramo de cashback.
 *
 *   DE PRESENTACIÓN (cupón, descuento, membresía, evento)
 *     No hay nada que juntar: la tarjeta vale desde que el cliente la
 *     tiene. El «saldo» de estas tarjetas ES el derecho a usarla — se
 *     le acredita al presentarla y se consume en el mismo acto, así que
 *     el costo es 1 y el movimiento neto en el ledger es cero.
 *     Quien limita las veces no es el saldo: son las reglas de la 0136
 *     (uso único, máximo por cliente, vigencia, días, horario) y el
 *     `limite_por_cliente` de la propia recompensa.
 *
 * POR QUÉ EL COSTO NO PUEDE SER 0: `recompensas.costo_puntos` tiene
 * `check (costo_puntos > 0)` y `canjes.puntos` también (0060). Un canje
 * que no descuenta nada no se puede representar en esta base sin una
 * migración, y el +1/−1 dice exactamente lo mismo sin pedir una.
 *
 * LO QUE ESTO NO RESUELVE, y que necesita migración: gastar un MONTO
 * VARIABLE (₡3.000 de una gift card de ₡10.000, o el saldo de cashback
 * que haya). `canjear_recompensa` descuenta un costo FIJO. Por eso la
 * gift card se canjea entera y el cashback en tramos.
 */

import { formatearCRC } from "../dinero";
import {
  TIPOS_TARJETA,
  UNIDAD_SALDO,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "./tipos-tarjeta";

/** La MISMA forma de escribir un colón que el resto de la plataforma. */
const colones = formatearCRC;

// ── 1. Lo que devuelve la base, dicho en palabras ──────────────────

/**
 * Los RPC de la 0125 devuelven casi siempre una frase escrita para una
 * persona («La compra mínima para acumular es ₡2.000.»), pero DOS de
 * sus salidas son códigos de máquina: `ya-canjeado` y `ya-otorgado`.
 * Esos dos salían tal cual a la pantalla del mostrador, y el empleado
 * los leía en voz alta delante del cliente.
 */
const FRASES_DE_CODIGO: Record<string, string> = {
  "ya-canjeado":
    "Ese premio ya se entregó hace un momento — no se le cobró dos veces. Si el cliente no lo recibió, buscalo en Actividad.",
  "ya-otorgado": "Ya se le contó hace menos de un minuto. No hace falta repetirlo.",
  "sin-permiso": "No tenés permiso para esta operación — pedíselo al dueño.",
  reglas: "El beneficio no se puede usar ahora mismo.",
  rechazado: "El canje no procedió.",
  error_rpc: "No se pudo completar. Probá de nuevo.",
};

/**
 * Traduce el `motivo` que devuelve un RPC.
 *
 * La regla es simple y no necesita mantenerse: si el texto es UNA sola
 * palabra en minúsculas con guiones —o sea, un identificador— es
 * vocabulario interno y NO se muestra; si tiene espacios, es una frase
 * que alguien escribió para ser leída y pasa tal cual.
 *
 * Así, el día que la base agregue un código nuevo que nadie tradujo, el
 * empleado ve el respaldo en español en vez de `tope-diario-excedido`.
 */
export function traducirMotivo(motivo: string | null | undefined, respaldo: string): string {
  const texto = (motivo ?? "").trim();
  if (!texto) return respaldo;

  const conocido = FRASES_DE_CODIGO[texto];
  if (conocido) return conocido;

  // Identificador: solo letras/números en minúscula, unidos por guiones
  // o guiones bajos. Nada de espacios, nada de mayúsculas, nada de
  // acentos — eso ya sería una frase.
  if (/^[a-z0-9]+([-_][a-z0-9]+)*$/.test(texto)) return respaldo;

  return texto;
}

/**
 * Traduce un error de Postgres.
 *
 * REGLA: nuestros propios mensajes pasan; los de Postgres no.
 *
 * Los `raise exception ... using errcode = '42501'` de las 0129, 0146 y
 * 0148 están escritos para el dueño («Tu programa está en pausa porque
 * el paquete de Lealtad no está al día. Renovalo desde el panel…»), y
 * la 0148 dice expresamente que ese texto es parte del arreglo. Esos
 * salen tal cual.
 *
 * Todo lo demás —«duplicate key value violates unique constraint
 * "transacciones_puntos_referencia_unica"»— es para el que programa, no
 * para el que está atendiendo. Se registra en el servidor y a la
 * pantalla va una frase que dice qué pasó y qué hacer.
 */
export function traducirErrorDeBase(
  error: { code?: string | null; message?: string | null },
  queSeIntentaba: string,
): string {
  const mensaje = (error.message ?? "").trim();

  // 42501 = insufficient_privilege: o es un `raise` nuestro (escrito en
  // español, para el dueño) o es la RLS. En los dos casos el texto
  // nuestro es el mejor que tenemos.
  if (error.code === "42501" && mensaje) return mensaje;

  // PGRST202 = PostgREST no encuentra la función. 42883 = Postgres
  // tampoco. Las dos significan lo mismo: falta la migración.
  if (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /acreditar_lealtad|canjear_recompensa|revertir_movimiento/.test(mensaje)
  ) {
    return "Falta correr la migración 0125 en Supabase — avisale al equipo de Bookea.";
  }

  return `No se pudo ${queSeIntentaba}. Probá de nuevo; si vuelve a fallar, avisale al equipo de Bookea.`;
}

// ── 2. La llave de un intento del mostrador ────────────────────────

/**
 * Un identificador por INTENTO de operación.
 *
 * ------------------------------------------------------------------
 * QUÉ PROBLEMA RESUELVE, Y POR QUÉ NO ALCANZA CON EL RELOJ
 * ------------------------------------------------------------------
 * Las llaves de idempotencia del mostrador llevaban el MINUTO DE
 * CALENDARIO adentro. Eso protege del doble toque solo por casualidad:
 * dos toques a las 14:28:59 y 14:29:01 caen en minutos distintos y
 * pasan los dos, mientras que dos VENTAS DE VERDAD a las 14:28:01 y
 * 14:28:59 se colapsan en una y la segunda no existe.
 *
 * Eso llegó a producción como «no se entregan los sellos»: el ledger
 * tenía dos movimientos, 14:28 y 14:29, después de muchos más escaneos.
 *
 * La llave por intento invierte la lógica: el mostrador la genera UNA
 * vez por operación, la reusa mientras el resultado sea desconocido (se
 * cortó la señal, no llegó la respuesta) y la tira cuando el servidor
 * contesta. Con eso, un reintento nunca suma dos veces y dos ventas
 * seguidas siempre suman dos.
 *
 * No hace falta que sea criptográfica: solo que dos intentos distintos
 * no coincidan. El respaldo existe para el WebView viejo de un teléfono
 * de mostrador, donde `crypto.randomUUID` puede no estar.
 */
export function llaveDeIntento(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ── 3. El monto de la compra ───────────────────────────────────────

/** El tope que ya validaban el escáner y el panel. */
const TOPE_MONTO = 10_000_000;

export type LecturaMonto = { ok: true; monto: number | null } | { ok: false; motivo: string };

/**
 * Lee el monto que el empleado tecleó.
 *
 * ------------------------------------------------------------------
 * EL SILENCIO QUE ESTO TERMINA
 * ------------------------------------------------------------------
 * El escáner hacía `Number.isInteger(montoLimpio) ? montoLimpio : null`.
 * Con `1500.50` eso da `null` — o sea que la compra se registraba como
 * VISITA SIN MONTO y el cliente se quedaba sin los puntos de su compra,
 * sin un solo aviso en pantalla. Lo mismo con cualquier cosa que
 * `Number()` no supiera leer.
 *
 * En colones los decimales son raros, y por eso está bien exigir
 * enteros. Lo que no está bien es tirarlos callado: acá se rechaza Y se
 * dice qué escribir en su lugar.
 */
export function leerMontoColones(texto: string): LecturaMonto {
  // La coma es el separador decimal de acá: quien escribe «1500,50»
  // está diciendo lo mismo que «1500.50», y merece el mismo aviso y no
  // un «no es un número».
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return { ok: true, monto: null };

  const n = Number(limpio);
  if (!Number.isFinite(n)) {
    return { ok: false, motivo: "El monto tiene que ser un número en colones. Ejemplo: 4500." };
  }
  if (n < 0) return { ok: false, motivo: "El monto no puede ser negativo." };
  if (!Number.isInteger(n)) {
    return {
      ok: false,
      motivo: `El monto va en colones enteros, sin céntimos. Escribí ${Math.round(n)} en vez de ${texto.trim()}.`,
    };
  }
  if (n > TOPE_MONTO) {
    return { ok: false, motivo: `Ese monto es demasiado alto (el tope es ${colones(TOPE_MONTO)}).` };
  }
  return { ok: true, monto: n };
}

// ── 4. Cómo se le habla al empleado según la tarjeta ───────────────

export type TextosDelTipo = {
  /** El título en verde cuando la operación entró. */
  titulo: (cliente: string) => string;
  /** El título cuando la referencia del minuto rebotó el repetido. */
  repetido: (cliente: string) => string;
  /** Lo que dice el botón de canje. */
  verboCanje: string;
  /** Lo que dice el botón de acreditar a mano. */
  verboSumar: string;
  /** Si tiene sentido mostrar «lleva N en total». */
  muestraSaldo: boolean;
  /** Cómo se llama el saldo en plural. */
  unidad: string;
};

const TEXTOS: Record<TipoTarjeta, Omit<TextosDelTipo, "muestraSaldo" | "unidad">> = {
  sellos: {
    titulo: (c) => `¡Sello sumado a ${c}!`,
    repetido: (c) => `${c} ya tenía su sello`,
    verboCanje: "Entregar",
    verboSumar: "Sumar sello",
  },
  puntos: {
    titulo: (c) => `¡Puntos sumados a ${c}!`,
    repetido: (c) => `${c} ya tenía sus puntos`,
    verboCanje: "Canjear",
    verboSumar: "Sumar puntos",
  },
  cashback: {
    titulo: (c) => `¡Compra registrada — ${c} sumó cashback!`,
    repetido: (c) => `Esa compra de ${c} ya estaba registrada`,
    verboCanje: "Usar el cashback",
    verboSumar: "Registrar compra",
  },
  giftcard: {
    titulo: (c) => `Gift card de ${c} leída`,
    repetido: (c) => `La gift card de ${c} ya se había leído`,
    verboCanje: "Usar la gift card",
    verboSumar: "Sumar saldo",
  },
  cupon: {
    titulo: (c) => `Cupón de ${c} — vigente`,
    repetido: (c) => `El cupón de ${c} ya se había leído`,
    verboCanje: "Usar el cupón",
    verboSumar: "Registrar visita",
  },
  descuento: {
    titulo: (c) => `Tarjeta de ${c} — descuento vigente`,
    repetido: (c) => `La tarjeta de ${c} ya se había leído`,
    verboCanje: "Aplicar el descuento",
    verboSumar: "Registrar visita",
  },
  membresia: {
    titulo: (c) => `${c} es socio — carnet vigente`,
    repetido: (c) => `El carnet de ${c} ya se había leído`,
    verboCanje: "Usar el beneficio",
    verboSumar: "Registrar visita",
  },
  evento: {
    titulo: (c) => `Entrada de ${c} — válida`,
    repetido: (c) => `La entrada de ${c} ya se había leído`,
    verboCanje: "Registrar el ingreso",
    verboSumar: "Registrar visita",
  },
};

/**
 * Las frases del mostrador para un tipo de tarjeta.
 *
 * `muestraSaldo` sale de `acumula` del catálogo y no de una lista
 * aparte: un cupón no tiene contador que enseñar, y «Lleva 1 en total»
 * debajo de un cupón es ruido que el empleado tiene que descifrar con
 * un cliente esperando.
 */
export function textosDelTipo(tipo: TipoTarjeta): TextosDelTipo {
  return {
    ...TEXTOS[tipo],
    muestraSaldo: TIPOS_TARJETA[tipo].acumula,
    unidad: UNIDAD_SALDO[tipo],
  };
}

// ── 5. Lo que la tarjeta ACUMULA cuando se presenta ────────────────

export type AcumulacionDelBeneficio = {
  /** `programa_lealtad.puntos_por_visita`. */
  porVisita: number;
  /** `programa_lealtad.puntos_por_colon`. */
  porColon: number;
  /** `programa_lealtad.compra_minima`. null = sin mínimo. */
  compraMinima: number | null;
};

/**
 * Si el mostrador tiene que preguntar CUÁNTO se gastó.
 *
 * Solo donde el monto CAMBIA lo que se acredita. En una tarjeta de
 * sellos, un cupón, una membresía o una entrada, el campo es una
 * pregunta sin consecuencia que el empleado tiene que ignorar con un
 * cliente enfrente — y el escáner lo pedía en siete de los ocho tipos,
 * porque preguntaba `modo !== "sellos"`.
 */
export function pideMontoElTipo(tipo: TipoTarjeta): boolean {
  return tipo === "puntos" || tipo === "cashback" || tipo === "giftcard";
}

/**
 * Si el mostrador OFRECE registrar la compra (monto y producto,
 * opcionales) además de los tipos donde el monto cambia lo acreditado.
 *
 * Desde la 0197 la tarjeta de SELLOS también entra: el sello no es el
 * dato principal — la compra que lo genera sí. El campo es opcional a
 * propósito: escanear sin teclear nada sigue sumando su sello igual
 * que siempre; con monto, la venta queda medida (y si la tarjeta tiene
 * la regla «por monto», además decide cuántos sellos entran).
 */
export function registraCompraElTipo(tipo: TipoTarjeta): boolean {
  return tipo === "sellos" || pideMontoElTipo(tipo);
}

// ── 5b. La regla de acumulación de una tarjeta de sellos (0197) ────

export type ReglaDeSellos = { por: "compra" } | { por: "monto"; montoPorSello: number };

/**
 * Qué regla de sellos tiene esta tarjeta.
 *
 * Ausente, mal guardada o sin monto válido → "compra", que es el
 * comportamiento de siempre: una config vieja o rota NUNCA puede dejar
 * a un cliente sin su sello.
 */
export function reglaDeSellos(config: ConfigBeneficio | null): ReglaDeSellos {
  if (
    config?.tipo === "sellos" &&
    config.sellosPor === "monto" &&
    typeof config.montoPorSello === "number" &&
    Number.isFinite(config.montoPorSello) &&
    config.montoPorSello >= 1
  ) {
    return { por: "monto", montoPorSello: Math.round(config.montoPorSello) };
  }
  return { por: "compra" };
}

/**
 * CUÁNTOS SELLOS otorga una compra. La función que el servidor usa —
 * nunca el navegador: el cliente manda el hecho (gastó tanto), no los
 * sellos.
 *
 *   · regla "monto" y la compra TRAE monto → floor(monto / montoPorSello)
 *     (₡4.500 → 1, ₡9.000 → 2, ₡22.500 → 5 con montoPorSello 4500 —
 *     y ₡4.000 → 0: una compra que no llega, no suma);
 *   · regla "compra", o compra sin monto → 1, como siempre.
 */
export function sellosPorCompra(config: ConfigBeneficio | null, monto: number | null): number {
  const regla = reglaDeSellos(config);
  if (regla.por === "monto" && monto !== null && Number.isFinite(monto) && monto >= 0) {
    return Math.floor(monto / regla.montoPorSello);
  }
  return 1;
}

/**
 * LAS DOS COLUMNAS QUE EL MOTOR LEE, derivadas del beneficio.
 *
 * `acreditar_lealtad` (0125) calcula
 * `puntos_por_visita + floor(puntos_por_colon × monto)` y NO mira el
 * jsonb del beneficio. O sea que estas dos columnas son lo único que
 * decide cuánto recibe el cliente: si no salen del beneficio, la
 * tarjeta promete una cosa y acredita otra.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTABA MAL, Y ERA PLATA
 * ------------------------------------------------------------------
 * La creación derivaba `porVisita: 1, porColon: 0` para todo lo que no
 * fuera «puntos». Con eso:
 *
 *   · CASHBACK: una tarjeta que el asistente le confirma al dueño como
 *     «5% de vuelta» acreditaba UN punto por visita y CERO por ciento
 *     de la compra. El cliente no recibía su devolución, nunca.
 *   · GIFT CARD: una tarjeta de ₡10.000 sumaba 1 por visita, así que
 *     para «llenarla» hacían falta diez mil visitas.
 *
 * Acá se deriva una sola vez para los ocho tipos, y la creación y el
 * editor escriben lo mismo: dos derivaciones para las mismas dos
 * columnas se separan el día que alguien toca una.
 */
export function acumulacionDe(config: ConfigBeneficio): AcumulacionDelBeneficio {
  switch (config.tipo) {
    case "puntos":
      return {
        porVisita: config.porVisita,
        porColon: config.porMoneda,
        compraMinima: null,
      };

    case "cashback":
      // El saldo de una tarjeta de cashback ES plata: el 5% de una
      // compra de ₡10.000 son ₡500, o sea `floor(0.05 × 10000)`. Nada
      // por visita — sin compra no hay nada que devolver, y el RPC lo
      // dice con todas sus letras («Esta operación no genera puntos»).
      return {
        porVisita: 0,
        porColon: config.porcentaje / 100,
        compraMinima: config.compraMinima > 0 ? Math.round(config.compraMinima) : null,
      };

    case "giftcard":
      // Un colón cargado es un colón de saldo. Así el mostrador carga la
      // tarjeta escribiendo el monto (₡10.000 → ₡10.000 de saldo) en vez
      // de sumarle 1 por visita, que era lo que hacía.
      return { porVisita: 0, porColon: 1, compraMinima: null };

    // Sellos y las cuatro de presentación: UNO por visita.
    //
    // En sellos es literalmente el sello. En cupón, descuento,
    // membresía y evento es el DERECHO DE USO que entra al presentar la
    // tarjeta y que el canje consume en el mismo acto (ver arriba): por
    // eso su recompensa cuesta 1 y el movimiento neto es cero.
    default:
      return { porVisita: 1, porColon: 0, compraMinima: null };
  }
}

// ── 6. La recompensa con la que nace cada tarjeta ──────────────────

/** Los valores que acepta `recompensas.tipo` (CHECK de la 0125). */
export type TipoRecompensa =
  | "producto"
  | "servicio"
  | "descuento_porcentaje"
  | "descuento_fijo"
  | "personalizada";

export type RecompensaInicial = {
  nombre: string;
  /** Siempre ≥ 1: `recompensas.costo_puntos` tiene `check (> 0)`. */
  costo: number;
  tipo: TipoRecompensa;
  /** Solo para los descuentos; null en el resto (lo exige el CHECK). */
  valor: number | null;
  /** Lo que el empleado tiene que hacer al entregarlo. */
  instrucciones: string;
  /** Veces que un mismo cliente lo puede usar. null = sin tope. */
  limitePorCliente: number | null;
  /** Cuántos hay en total. null = sin tope. */
  stockTotal: number | null;
  /** Meses de vida de la recompensa desde hoy. null = no vence sola. */
  vigenciaMeses: number | null;
};

/** El tramo en que se usa el cashback acumulado. */
export const TRAMO_CASHBACK = 1000;

const TOPE_DESCUENTO_FIJO = 10_000_000; // el CHECK de la 0125
const TOPE_STOCK = 1_000_000;
const TOPE_LIMITE_CLIENTE = 10_000;

function acotar(n: number | null, min: number, max: number): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const entero = Math.round(n);
  return entero < min ? min : entero > max ? max : entero;
}

function recortar(texto: string, largo: number): string {
  // `[ \t\n\r]` y no `\s`: `\s` también come el espacio fino que `es-CR`
  // usa como separador de miles, y «₡5 000» se volvería «₡5 000» con
  // otro espacio — el mismo texto escrito de dos formas distintas en la
  // misma pantalla.
  const limpio = texto.trim().replace(/[ \t\n\r]+/g, " ");
  return limpio.length <= largo ? limpio : limpio.slice(0, largo - 1).trimEnd() + "…";
}

/**
 * Con qué recompensa nace una tarjeta, según su beneficio.
 *
 * Devuelve null SOLO cuando el beneficio no alcanza para nombrar nada
 * (una tarjeta de sellos sin texto de recompensa, por ejemplo). En
 * todos los demás casos hay algo canjeable — que es justo lo que le
 * faltaba a cinco de los ocho tipos.
 */
export function recompensaInicial(config: ConfigBeneficio): RecompensaInicial | null {
  switch (config.tipo) {
    case "sellos": {
      const nombre = config.recompensa.trim();
      if (!nombre) return null;
      return {
        nombre: recortar(nombre, 120),
        costo: Math.max(1, Math.round(config.requeridos)),
        tipo: "producto",
        valor: null,
        instrucciones: config.repetible
          ? `Entregá ${nombre} y la tarjeta arranca otra vuelta desde cero.`
          : `Entregá ${nombre}. Esta tarjeta es de una sola vuelta.`,
        // `repetible` estaba en la config y no lo miraba nadie: una
        // tarjeta de una sola vuelta se podía canjear infinitas veces.
        limitePorCliente: config.repetible ? null : 1,
        stockTotal: null,
        vigenciaMeses: null,
      };
    }

    case "puntos": {
      const unidad = config.nombre.trim() || "puntos";
      return {
        nombre: "Tu regalía",
        costo: Math.max(1, Math.round(config.minimoCanje)),
        tipo: "personalizada",
        valor: null,
        instrucciones: `Entregá la regalía y anotá el descuento de ${unidad} en la caja.`,
        limitePorCliente: null,
        stockTotal: null,
        vigenciaMeses: null,
      };
    }

    case "giftcard": {
      const monto =
        config.moneda === "USD"
          ? `$${Math.round(config.valor).toLocaleString("en-US")}`
          : colones(config.valor);
      return {
        nombre: recortar(`Gift card de ${monto}`, 120),
        costo: Math.max(1, Math.round(config.valor)),
        tipo: "personalizada",
        valor: null,
        // El canje parcial NO existe todavía (haría falta un RPC que
        // descuente un monto libre bajo lock). Decirlo acá es mejor que
        // dejar que el empleado lo descubra con el cliente enfrente.
        instrucciones: `Cobrá hasta ${monto} contra esta gift card y registrala como usada. Se usa de una sola vez, por el total.`,
        limitePorCliente: 1,
        stockTotal: null,
        vigenciaMeses: null,
      };
    }

    case "cashback": {
      // El cashback acumula colones, y `canjear_recompensa` descuenta un
      // costo FIJO: por eso se usa en tramos. ₡1.000 es el tramo que un
      // 5% de devolución alcanza en una compra normal — y el dueño lo
      // puede cambiar desde Recompensas cuando quiera.
      return {
        nombre: `${colones(TRAMO_CASHBACK)} de tu cashback`,
        costo: TRAMO_CASHBACK,
        tipo: "descuento_fijo",
        valor: TRAMO_CASHBACK,
        instrucciones: `Descontale ${colones(TRAMO_CASHBACK)} de la cuenta y registralo como cashback usado.`,
        limitePorCliente: null,
        stockTotal: null,
        vigenciaMeses: null,
      };
    }

    case "cupon":
    case "descuento": {
      const b = config.beneficio;
      const nombre =
        b.forma === "porcentaje"
          ? `${b.valor}% de descuento`
          : b.forma === "monto"
            ? `${colones(b.valor)} de descuento`
            : `${b.que.trim()} gratis`;
      if (b.forma === "gratis" && !b.que.trim()) return null;

      const condiciones: string[] = [];
      if (config.compraMinima > 0) condiciones.push(`aplica desde ${colones(config.compraMinima)} de compra`);
      if (config.descuentoMaximo !== null) condiciones.push(`con tope de ${colones(config.descuentoMaximo)}`);

      const esPorcentaje = b.forma === "porcentaje";
      const esFijoValido = b.forma === "monto" && b.valor > 0 && b.valor <= TOPE_DESCUENTO_FIJO;

      return {
        nombre: recortar(nombre, 120),
        // Uno: la tarjeta ya vale por sí misma. El derecho de uso entra
        // al presentarla y se consume en el acto.
        costo: 1,
        tipo: esPorcentaje ? "descuento_porcentaje" : esFijoValido ? "descuento_fijo" : "producto",
        valor: esPorcentaje ? b.valor : esFijoValido ? b.valor : null,
        instrucciones: recortar(
          `Aplicá ${nombre}${condiciones.length ? ` — ${condiciones.join(", ")}` : ""} y marcá el cupón como usado.`,
          500,
        ),
        // `usosPorCliente` también estaba en la config sin que lo mirara
        // nadie.
        limitePorCliente: acotar(config.usosPorCliente, 1, TOPE_LIMITE_CLIENTE),
        stockTotal: null,
        vigenciaMeses: null,
      };
    }

    case "membresia": {
      const nivel = config.nivel.trim();
      if (!nivel) return null;
      const lista = config.beneficios.map((x) => x.trim()).filter(Boolean);
      return {
        nombre: recortar(`Beneficio de socio ${nivel}`, 120),
        costo: 1,
        tipo: "servicio",
        valor: null,
        instrucciones: recortar(
          lista.length
            ? `Dale el beneficio de socio ${nivel}: ${lista.join(", ")}.`
            : `Dale el beneficio de socio ${nivel} y registralo.`,
          500,
        ),
        // Un socio usa sus beneficios todas las veces que quiera
        // mientras la membresía esté vigente: el tope es la VIGENCIA, y
        // eso es lo que dice `vigenciaMeses`.
        limitePorCliente: null,
        stockTotal: null,
        vigenciaMeses: Math.max(1, Math.round(config.vigenciaMeses)),
      };
    }

    case "evento": {
      const donde = config.ubicacion.trim();
      const cuando = [config.fecha, config.hora].filter(Boolean).join(" ");
      return {
        nombre: "Ingreso al evento",
        costo: 1,
        tipo: "servicio",
        valor: null,
        instrucciones: recortar(
          `Dejalo pasar y marcá la entrada como usada${cuando ? `. ${cuando}` : ""}${donde ? ` · ${donde}` : ""}.`,
          500,
        ),
        // Una entrada es de una persona y de una vez.
        limitePorCliente: 1,
        // Y la capacidad del evento deja de ser decorativa: el RPC
        // cuenta los canjes no anulados contra este tope bajo lock, así
        // que no entra nadie de más aunque dos puertas marquen a la vez.
        stockTotal: acotar(config.capacidad, 1, TOPE_STOCK),
        vigenciaMeses: null,
      };
    }
  }
}
