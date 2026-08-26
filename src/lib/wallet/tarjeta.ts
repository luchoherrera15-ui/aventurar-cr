/**
 * Arma el `pass.json` de una tarjeta de lealtad a partir de lo que el
 * negocio configuró (migraciones 0060, 0121 y 0122).
 *
 * Es lógica pura: no toca Supabase ni dibuja imágenes. Quien llama le
 * pasa los datos ya leídos, y esto decide qué dice la tarjeta.
 */

import {
  leerBeneficio,
  tipoDe,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { fechaLargaCR } from "@/lib/fechas";
import {
  selloDelPase,
  selloParaGuardar,
  type DibujoDelSello,
  type SelloElegido,
} from "@/lib/lealtad/iconos-sello";
import { configDesdeJson, type ConfigTira } from "@/lib/wallet/layout-tira";

/**
 * Alias histórico de `TipoTarjeta`. El nombre «modo» quedó de cuando
 * eran tres formas de presentar el mismo saldo (0121); hoy son ocho
 * tipos de tarjeta distintos y el catálogo vive en
 * `src/lib/lealtad/tipos-tarjeta.ts`.
 *
 * Se mantiene el alias en vez de renombrar 14 archivos de una sentada,
 * pero es UN solo tipo: no hay dos listas que se puedan separar.
 */
export type ModoPrograma = TipoTarjeta;

/** Lo que la 0121/0122 guardan por negocio. */
export type ConfigPase = {
  modo: ModoPrograma | null;
  pase_color_fondo: string | null;
  pase_color_sello: string | null;
  pase_logo_url: string | null;
  /**
   * La banda de la 0132: `strip.png` en Apple, `heroImage` en Google.
   *
   * OPCIONAL y no obligatorio porque hay pantallas que arman un
   * `ConfigPase` para otra cosa —el póster imprimible, la página
   * pública de la tarjeta— y ahí la banda no pinta nada. El camino que
   * SÍ importa (fila → pase) pasa siempre por `tarjetaDesdeFila`, que
   * la llena, y `banda.test.ts` lo comprueba de punta a punta: el
   * compilador no es la red de seguridad acá, el test sí.
   */
  pase_banner_url?: string | null;
  /**
   * El icono que va dentro de cada sello (0145). `null` = el
   * comportamiento de siempre, que es el LOGO del negocio adentro del
   * círculo.
   *
   * Desde la 0174 también puede valer `'propio'`: el archivo que subió
   * el negocio, que viaja en `pase_sello_icono_url`. Las dos columnas
   * se leen JUNTAS con `selloDeLaConfig` — nunca por separado.
   *
   * Opcional por la misma razón que la banda: hay pantallas que arman
   * un `ConfigPase` para otra cosa, y sobre todo la migración puede no
   * estar pegada —las pega el dueño a mano— y entonces la fila llega
   * sin la columna.
   */
  pase_sello_icono?: SelloElegido | null;
  /** El ícono propio del negocio (0174). Opcional por lo mismo. */
  pase_sello_icono_url?: string | null;
  /**
   * DÓNDE va cada sello dentro de la tira (0212, jsonb).
   *
   * Viaja CRUDO —`unknown`, tal como salió de la base— y no ya validado,
   * a propósito. Es la única forma de que el saneo ocurra en UN solo
   * lugar (`disenoDeLaConfig`, abajo) en vez de repetirse en cada
   * pantalla que arma un `ConfigPase` a mano: la vista previa, el
   * póster, el visor del admin. Un `ConfigTira` acá invitaría a que cada
   * una lo construyera a su manera, y la que se equivoque manda un
   * `NaN` directo al PNG del pase.
   *
   * Opcional por lo mismo que la banda y el ícono: la migración puede no
   * estar pegada y la fila llega sin la columna. `undefined` cae al
   * layout clásico, que es el de todas las tarjetas ya emitidas.
   */
  pase_diseno?: unknown;
};

/** La recompensa activa más barata: es la META de la tarjeta. */
export type MetaRecompensa = { nombre: string; costo_puntos: number } | null;

/**
 * Lo que hace falta para decidir QUÉ DICE la tarjeta.
 *
 * Es menos que `DatosTarjeta` a propósito: el serial y los
 * identificadores de Apple no cambian ni una palabra del texto, y
 * exigirlos obligaba a los demás usos —la vista previa del panel, el
 * objeto de Google— a inventar valores de mentira para poder llamar.
 * Un tipo que pide de más se paga con datos falsos en los llamados.
 */
export type DatosDelTexto = {
  negocioNombre: string;
  /** Saldo actual, derivado de transacciones_puntos. */
  saldo: number;
  meta: MetaRecompensa;
  config: ConfigPase;
  /**
   * La configuración propia del tipo (0135).
   *
   * `null` cuando el programa es anterior a la 0135 o la migración no
   * corrió: la tarjeta se dibuja con lo genérico en vez de quedar en
   * blanco. Pero el campo es OBLIGATORIO, y eso es la mitad del
   * arreglo: era opcional, generar.ts no lo mandaba, y el compilador
   * no tenía cómo avisar que los cinco tipos de la 0135 salían con el
   * texto de degradación en el teléfono del cliente. Ahora quien emite
   * un pase tiene que decir qué beneficio lleva, aunque sea ninguno.
   */
  beneficio: ConfigBeneficio | null;
  /**
   * El programa está PAUSADO: no sella y no canjea.
   *
   * Opcional y falsy por defecto, y eso es la mitad del diseño: un pase
   * de un programa que opera con normalidad tiene que salir BYTE POR
   * BYTE igual que antes de que existiera esta bandera
   * (`pausa.test.ts` lo fija con un digest). Solo cuando llega `true`
   * cambian DOS textos que ya existían —la línea de estado del frente y
   * el campo «Cómo funciona» del reverso—: no se agrega ni se quita un
   * solo campo del pase.
   *
   * Lo que NO cambia estando en pausa, por decisión explícita: el
   * saldo, la tira de sellos y la regalía siguen a la vista. El pase es
   * la tarjeta del CLIENTE con SUS sellos, no la licencia del negocio;
   * vaciarla castigaría a doscientas personas por una factura ajena. Y
   * tampoco hace falta para negar nada: el canje se rechaza contra la
   * BASE (`autorizarCanje`), nunca contra lo que diga el dibujo.
   */
  pausado?: boolean;
  /**
   * EL AVISO ACTIVO (0152), ej. «MIÉRCOLES MATCHAS 2X1».
   *
   * `null`/vacío = sin aviso: el pase sale exactamente igual que
   * siempre, sin este campo. Solo cuando hay texto se agrega un campo
   * nuevo del reverso CON `changeMessage` — es lo que hace que Apple le
   * muestre al cliente un aviso en la pantalla bloqueada cuando el
   * VALOR cambia de un envío al siguiente.
   */
  mensajePromocional?: string | null;
  /**
   * HASTA CUÁNDO LE VALEN LOS SELLOS A ESTE CLIENTE (0180), en ISO y
   * ya calculado en la zona del negocio.
   *
   * `null`/ausente = no vencen, que es el caso de toda tarjeta que no
   * configure la regla y de los siete tipos que no son `sellos`. Ahí
   * el pase sale EXACTAMENTE igual que antes de que esto existiera:
   * ningún campo se agrega ni se mueve.
   *
   * Va en el reverso y no en el frente a propósito. El frente tiene
   * tres ranuras y las tres ya dicen algo que el cliente necesita
   * («5/10», «te faltan 3», la regalía); meter una fecha ahí le
   * quitaría el lugar al progreso, que es lo que hace volver. El
   * reverso es donde se mira cuando se duda, y esta es exactamente una
   * duda.
   *
   * Y SIN `changeMessage`, al revés que el aviso promocional: esta
   * fecha se corre con CADA sello, así que un aviso en la pantalla
   * bloqueada por cada visita sería la versión Wallet del spam de
   * correos que este módulo ya tuvo que apagar una vez.
   */
  sellosVencenEl?: string | null;
};

/** Una ubicación con Geo-Push del negocio (0196): el iPhone muestra
 *  `mensaje` en la pantalla bloqueada al pasar cerca (~100 m). */
export type UbicacionDelPase = {
  latitud: number;
  longitud: number;
  /** El `relevantText` del pase — el texto de la pantalla bloqueada. */
  mensaje: string;
};

export type DatosTarjeta = DatosDelTexto & {
  serialNumber: string;
  passTypeIdentifier: string;
  teamIdentifier: string;
  /** Coordenadas del local. Habilitan el aviso en pantalla bloqueada
   *  cuando el cliente pasa cerca — Apple lo hace nativo. */
  ubicacion?: { latitud: number; longitud: number } | null;
  /** Las ubicaciones que el negocio registró (0196), cada una con su
   *  mensaje propio. Si hay al menos una, MANDAN ellas y `ubicacion`
   *  ni se mira: son la lista curada del dueño. Sin ninguna, el pase
   *  sale exactamente como siempre. Apple acepta 10 por pase. */
  ubicaciones?: readonly UbicacionDelPase[] | null;
  /** Secreto con el que ESTE pase se autentica ante nuestro Web
   *  Service (`pases_wallet.auth_token`). Sin él el pase no se
   *  actualiza solo: el iPhone ni siquiera se registra. */
  authToken?: string | null;
  /** Base del Web Service, sin el `/v1`. Apple se lo agrega. */
  webServiceUrl?: string | null;
};

/**
 * La FILA de `programa_lealtad` (tal cual la devuelve `select *`)
 * traducida a lo que la tarjeta necesita.
 *
 * Existe porque acá fue donde se cortó el cable: Apple y Google
 * casteaban la fila cada uno a su lista de columnas escrita a mano, y
 * ninguna de las dos incluía `beneficio`. La columna llegaba de la
 * base y se perdía en el casteo, así que un cupón del 30% salía como
 * «CUPÓN / Beneficio» en el teléfono. Con la traducción en UN solo
 * lugar, las dos plataformas leen lo mismo y se prueba lo mismo que
 * corre en producción.
 *
 * Toma `Record<string, unknown>` a propósito: la 0135 puede no estar
 * corrida y entonces la fila llega SIN el campo. Leer de más no rompe;
 * pedir la columna por nombre sí. Lo mismo vale para la banda de la
 * 0132: si esa migración no está pegada, `select *` la deja
 * `undefined`, acá se lee como `null`, y el pase sale sin foto en vez
 * de no salir.
 */
export function tarjetaDesdeFila(fila: Record<string, unknown>): {
  config: ConfigPase;
  beneficio: ConfigBeneficio | null;
} {
  const modo = tipoDe(typeof fila.modo === "string" ? fila.modo : null);
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  // Las dos columnas del sello se leen de una: 'propio' sin archivo no
  // significa nada, y un archivo sin 'propio' es un ícono guardado que
  // hoy no está elegido. La regla vive en `iconos-sello.ts`.
  const sello = selloParaGuardar({
    tipo: fila.modo,
    icono: fila.pase_sello_icono,
    url: fila.pase_sello_icono_url,
  });
  return {
    config: {
      modo,
      pase_color_fondo: texto(fila.pase_color_fondo),
      pase_color_sello: texto(fila.pase_color_sello),
      pase_logo_url: texto(fila.pase_logo_url),
      // Acá se cortaba el cable de la banda: el editor la guardaba, la
      // vista previa la dibujaba, y el generador nunca leía la columna.
      // El dueño veía su foto en la pantalla y no en el teléfono.
      pase_banner_url: texto(fila.pase_banner_url),
      // El icono del sello (0145, y el propio de la 0174) pasa por el
      // MISMO filtro que usan el creador y el editor: si no está en el
      // catálogo, o si la tarjeta no es de sellos, no hay icono. Así una
      // fila rara no llega nunca hasta el dibujo.
      pase_sello_icono: sello.icono,
      pase_sello_icono_url: sello.url,
      // Crudo a propósito: lo sanea `disenoDeLaConfig`, en un solo lugar.
      pase_diseno: fila.pase_diseno,
    },
    beneficio: leerBeneficio(fila.beneficio, modo),
  };
}

/**
 * DÓNDE VA CADA SELLO, según la config del pase.
 *
 * El gemelo de `selloDeLaConfig`: la misma pregunta hecha en un solo
 * lugar para el generador (sharp) y para la vista previa (React). Que el
 * dueño diseñe mirando lo que su cliente va a recibir depende de que las
 * dos pantallas lean la columna con ESTA función y no cada una a su modo.
 *
 * `configDesdeJson` acota todos los valores: lo que salga de acá se
 * puede dibujar aunque en la base haya cualquier cosa.
 */
export function disenoDeLaConfig(config: ConfigPase): ConfigTira {
  return configDesdeJson(config.pase_diseno);
}

/**
 * QUÉ LLEVA EL SELLO, según la config del pase.
 *
 * La usan el generador (sharp) y la vista previa (React) para no tener
 * cada uno su lectura de las dos columnas. Que las dos pantallas del
 * negocio y el pase real dibujen lo mismo depende de que esta pregunta
 * se haga en un solo lugar.
 */
export function selloDeLaConfig(config: ConfigPase): DibujoDelSello {
  return selloDelPase({
    tipo: config.modo,
    icono: config.pase_sello_icono,
    url: config.pase_sello_icono_url,
  });
}

/** Navy de Bookea, para el negocio que no eligió colores. */
const FONDO_POR_DEFECTO = "#002472";
const SELLO_POR_DEFECTO = "#F39200";

export function coloresDe(config: ConfigPase) {
  return {
    fondo: config.pase_color_fondo ?? FONDO_POR_DEFECTO,
    sello: config.pase_color_sello ?? SELLO_POR_DEFECTO,
  };
}

/** `#RRGGBB` → `rgb(r, g, b)`, que es lo que pide pass.json. */
export function aRgbCss(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * Cuántos sellos pide la regalía. Sale de la recompensa, NO de una
 * columna propia: si hubiera dos números para lo mismo, el día que el
 * dueño cambie la recompensa la tarjeta seguiría prometiendo la vieja.
 */
export function metaDeSellos(meta: MetaRecompensa): number | null {
  return meta && meta.costo_puntos > 0 ? meta.costo_puntos : null;
}

/**
 * QUÉ LLEVA EL STRIP, que en Apple es UN SOLO archivo.
 *
 * La banda y la tira de sellos no son dos ranuras del pase: las dos son
 * `strip.png`. Quien quiera las dos cosas tiene que ponerlas en la
 * misma imagen —la foto de fondo y los círculos encima—, que es
 * justamente lo que hacen las tarjetas de lealtad de verdad.
 *
 * La decisión vive acá, pura, y no adentro del generador, por dos
 * razones que ya costaron caro en este módulo:
 *
 *   · la vista previa del panel dibuja lo MISMO preguntando a esta
 *     función, así que no puede prometer una banda que el pase no trae;
 *   · se prueba sin sharp, sin red y sin base — los ocho tipos, en
 *     milisegundos (`banda.test.ts`).
 */
export type TiraDelPase =
  /** Círculos que se llenan. Con `banda`, van encima de la foto. */
  | { tipo: "sellos"; total: number; banda: string | null }
  /** La foto ES el strip, sin círculos. */
  | { tipo: "banda"; banda: string }
  /** Sin strip: el pase queda como antes de la 0132. */
  | { tipo: "ninguna" };

export function tiraDelPase(config: ConfigPase, meta: MetaRecompensa): TiraDelPase {
  const banda = config.pase_banner_url ?? null;
  // Sin meta no hay "5 de 10" posible, y una tira de círculos sin total
  // no dice nada: ahí la foto es mejor que un dibujo vacío.
  const total = tipoDe(config.modo) === "sellos" ? metaDeSellos(meta) : null;

  if (total !== null) return { tipo: "sellos", total, banda };
  return banda ? { tipo: "banda", banda } : { tipo: "ninguna" };
}

export type CamposTarjeta = {
  encabezado: { label: string; value: string };
  detalle: { label: string; value: string };
  regalia: { label: string; value: string } | null;
};

// ── EL PROGRAMA EN PAUSA ─────────────────────────────────────────────

/**
 * CÓMO SE LE CUENTA LA PAUSA A UNA PERSONA.
 *
 * Esto lo lee alguien que fue a cortarse el pelo y abrió su Wallet
 * porque el del mostrador no le dio el sello. No sabe —ni tiene por
 * qué— que existe una suscripción, ni una factura, ni Stripe. Así que
 * acá no entra una sola palabra de adentro: se dice qué pasa con SU
 * tarjeta y nada más.
 *
 * Las dos cosas que tiene que entender, en este orden:
 *   1. lo suyo NO se perdió;
 *   2. por ahora no se suma, y esto se va a arreglar.
 *
 * El sustantivo cambia con el tipo de tarjeta porque «tus sellos» en
 * una gift card es sencillamente falso. Es un Record COMPLETO sobre
 * `TipoTarjeta` a propósito: el día que se agregue un noveno tipo, esto
 * no compila hasta que alguien decida cómo se le habla a ese cliente.
 */
const QUE_SE_GUARDA: Record<TipoTarjeta, string> = {
  sellos: "Tus sellos quedan guardados; por ahora no se suman.",
  puntos: "Tus puntos quedan guardados; por ahora no se suman.",
  cashback: "Tu saldo queda guardado; por ahora no se usa.",
  giftcard: "Tu saldo queda guardado; por ahora no se usa.",
  cupon: "Tu tarjeta queda guardada; por ahora no se usa.",
  descuento: "Tu tarjeta queda guardada; por ahora no se usa.",
  membresia: "Tu carnet queda guardado; por ahora no se usa.",
  evento: "Tu entrada queda guardada; por ahora no se usa.",
};

/** La línea de estado del frente cuando el programa está en pausa. */
export function avisoDePausa(tipo: TipoTarjeta): { label: string; value: string } {
  return { label: "EN PAUSA", value: QUE_SE_GUARDA[tipo] };
}

/**
 * El texto largo del reverso. Se comparte con Google (allá va como
 * módulo de texto) para que el iPhone y el Android de dos clientes del
 * mismo negocio digan exactamente lo mismo.
 */
export function textoDePausa(negocioNombre: string, tipo: TipoTarjeta): string {
  const quien = negocioNombre.trim() || "El negocio";
  return (
    `${quien} pausó su programa por un tiempo. Tu tarjeta queda tal cual: ` +
    `no se pierde nada de lo que ya juntaste. Mientras dure la pausa no se suma ` +
    `ni se canjea nada. Cuando el programa vuelva, seguís donde ibas — ` +
    `consultá en el local. (${QUE_SE_GUARDA[tipo]})`
  );
}

/**
 * Qué dice la tarjeta según el modo. Los tres guardan el MISMO dato —
 * un saldo de puntos— y solo cambia cómo se lee: 5 puede ser "5
 * sellos", "₡5" o "5 puntos" según lo que el negocio prometió.
 *
 * En pausa se reemplaza UNA línea —la de estado, la que promete «te
 * faltan 3 sellos»— y se deja todo lo demás intacto. Esa línea es
 * justamente la que estaría mintiendo: no faltan 3 sellos, no se puede
 * sumar ninguno.
 */
export function camposSegunModo(datos: DatosDelTexto): CamposTarjeta {
  const campos = camposDelTipo(datos);
  if (!datos.pausado) return campos;
  return { ...campos, detalle: avisoDePausa(tipoDe(datos.config.modo)) };
}

function camposDelTipo(datos: DatosDelTexto): CamposTarjeta {
  const modo = tipoDe(datos.config.modo);
  const meta = metaDeSellos(datos.meta);

  if (modo === "sellos" && meta !== null) {
    const faltan = Math.max(0, meta - datos.saldo);
    return {
      encabezado: { label: "SELLOS", value: `${Math.min(datos.saldo, meta)}/${meta}` },
      detalle: {
        label: faltan === 0 ? "¡YA LA GANASTE!" : "PARA TU PRÓXIMA REGALÍA",
        value:
          faltan === 0
            ? "Pedila en tu próxima visita"
            : `Te ${faltan === 1 ? "falta" : "faltan"} ${faltan} ${faltan === 1 ? "sello" : "sellos"}`,
      },
      regalia: datos.meta ? { label: "REGALÍA", value: datos.meta.nombre } : null,
    };
  }

  if (modo === "cashback") {
    return {
      encabezado: { label: "SALDO", value: `₡${datos.saldo.toLocaleString("es-CR")}` },
      detalle: { label: "ACUMULADO", value: "Se descuenta en tu próxima compra" },
      regalia: datos.meta ? { label: "CANJEÁ POR", value: datos.meta.nombre } : null,
    };
  }

  // ── Los cinco tipos de la 0135 ────────────────────────────────────
  // Sin esto caerían en la rama genérica de abajo y un cupón mostraría
  // «PUNTOS 0» en el teléfono del cliente: la tarjeta diría algo que
  // no tiene nada que ver con lo que el negocio prometió.
  const b = datos.beneficio;

  if (modo === "cupon" || modo === "descuento") {
    const texto =
      b && (b.tipo === "cupon" || b.tipo === "descuento") ? textoDeBeneficio(b) : "Beneficio";
    return {
      encabezado: { label: modo === "cupon" ? "CUPÓN" : "DESCUENTO", value: texto },
      detalle: { label: "CÓMO SE USA", value: "Presentá esta tarjeta al pagar" },
      regalia: null,
    };
  }

  if (modo === "membresia") {
    const nivel = b?.tipo === "membresia" && b.nivel.trim() ? b.nivel : "Socio";
    return {
      encabezado: { label: "MEMBRESÍA", value: nivel },
      detalle: {
        label: "BENEFICIOS",
        value:
          b?.tipo === "membresia" && b.beneficios.length > 0
            ? b.beneficios.join(" · ")
            : "Presentá tu carnet en cada visita",
      },
      regalia: null,
    };
  }

  if (modo === "giftcard") {
    // El saldo de una gift card es el que QUEDA, y sale del ledger
    // igual que cualquier otro: se carga al emitirla y se descuenta en
    // cada canje. No hay un segundo número que se pueda desincronizar.
    const moneda = b?.tipo === "giftcard" && b.moneda === "USD" ? "$" : "₡";
    return {
      encabezado: {
        label: "SALDO",
        value: `${moneda}${datos.saldo.toLocaleString("es-CR")}`,
      },
      detalle: { label: "GIFT CARD", value: "Se descuenta de tu saldo en cada uso" },
      regalia: null,
    };
  }

  if (modo === "evento") {
    const cuando =
      b?.tipo === "evento" && b.fecha ? `${b.fecha}${b.hora ? ` · ${b.hora}` : ""}` : "Por confirmar";
    return {
      encabezado: { label: "ENTRADA", value: cuando },
      detalle: {
        label: "DÓNDE",
        value: b?.tipo === "evento" && b.ubicacion.trim() ? b.ubicacion : datos.negocioNombre,
      },
      regalia: null,
    };
  }

  // 'puntos', y también 'sellos' sin recompensa configurada: sin meta
  // no hay "5 de 8" posible, así que se muestra el saldo pelado en vez
  // de inventar un total.
  return {
    encabezado: { label: "PUNTOS", value: String(datos.saldo) },
    detalle: meta
      ? { label: "PARA TU PRÓXIMA REGALÍA", value: `Te faltan ${Math.max(0, meta - datos.saldo)}` }
      : { label: "ACUMULADOS", value: "Seguí sumando en cada visita" },
    regalia: datos.meta ? { label: "CANJEÁ POR", value: datos.meta.nombre } : null,
  };
}

/**
 * CÓMO SE LE CUENTA EL VENCIMIENTO A UNA PERSONA (0180).
 *
 * Lo lee alguien que abrió su Wallet en la calle. No sabe que hay una
 * regla configurable ni un barrido nocturno, y no le importa. Dos
 * frases: hasta cuándo, y que volver lo arregla.
 *
 * La segunda frase es la que evita el reclamo en el mostrador. Un pase
 * que solo dice una fecha se lee como una amenaza; uno que dice cómo
 * renovarla se lee como lo que es — una invitación a volver, que es
 * para lo que existe el programa entero.
 *
 * `fechaLargaCR` arma el día en español sin pasar por `Date` con hora
 * (que corre la fecha seis horas en el servidor); el nombre del día
 * sobra acá, así que se recorta.
 */
export function textoDeVencimiento(venceEl: string): string {
  const largo = fechaLargaCR(venceEl);
  const sinDia = largo.slice(largo.indexOf(" ") + 1);
  return (
    `El ${sinDia}, si no volvés antes. ` +
    `Cada visita renueva el plazo: con un sello más, la fecha se corre sola.`
  );
}

/**
 * El pass.json completo.
 *
 * El logo de arriba a la izquierda es del NEGOCIO. La firma de Bookea
 * va en `altText` del código de barras, que Apple dibuja justo debajo
 * del QR: es el único lugar del layout fijo donde cabe sin robarle
 * espacio a la marca del cliente.
 */
export function construirPassJson(datos: DatosTarjeta): Record<string, unknown> {
  const colores = coloresDe(datos.config);
  const campos = camposSegunModo(datos);

  const pass: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: datos.passTypeIdentifier,
    teamIdentifier: datos.teamIdentifier,
    serialNumber: datos.serialNumber,
    organizationName: datos.negocioNombre,
    description: `Tarjeta de lealtad ${datos.negocioNombre}`,
    backgroundColor: aRgbCss(colores.fondo),
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: aRgbCss(colores.sello),
    storeCard: {
      // SIN primaryFields a propósito: Apple los dibuja ENCIMA de la
      // tira de sellos y se montarían sobre los círculos.
      headerFields: [{ key: "saldo", ...campos.encabezado }],
      secondaryFields: [{ key: "detalle", ...campos.detalle }],
      auxiliaryFields: campos.regalia ? [{ key: "regalia", ...campos.regalia }] : [],
      backFields: [
        // El reverso es donde el cliente busca cuando duda, así que en
        // pausa es acá donde va la explicación entera. Se reusa el
        // MISMO campo (`como`) en vez de agregar uno nuevo: el pase
        // conserva su forma exacta y el que ya lo tenía instalado ve
        // cambiar un texto, no aparecer una sección.
        datos.pausado
          ? {
              key: "como",
              label: "Este programa está en pausa",
              value: textoDePausa(datos.negocioNombre, tipoDe(datos.config.modo)),
            }
          : {
              key: "como",
              label: "Cómo funciona",
              value: textoDeAyuda(datos),
            },
        // El aviso de marketing (0152): SOLO si el negocio mandó uno.
        // `changeMessage` es lo que hace aparecer el aviso en la
        // pantalla bloqueada — Apple lo dispara cuando el VALOR de este
        // campo cambia entre una regeneración del pase y la siguiente,
        // así que cada mensaje nuevo (aunque sea sobre el mismo campo)
        // vuelve a avisar. `%@` es el propio texto del mensaje.
        ...(datos.mensajePromocional?.trim()
          ? [
              {
                key: "promo",
                label: "Promoción",
                value: datos.mensajePromocional.trim(),
                changeMessage: "%@",
              },
            ]
          : []),
        // El vencimiento de los sellos (0180): solo si la tarjeta tiene
        // la regla encendida. Va DESPUÉS de la promoción y antes de la
        // firma, que es el orden en que se lee el reverso: qué es, qué
        // hay de nuevo, hasta cuándo, quién lo hace.
        ...(datos.sellosVencenEl
          ? [
              {
                key: "vence",
                label: "Tus sellos vencen",
                value: textoDeVencimiento(datos.sellosVencenEl),
              },
            ]
          : []),
        { key: "bookea", label: "Powered by", value: "Bookea.lat" },
      ],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: datos.serialNumber,
        messageEncoding: "iso-8859-1",
        altText: "Powered by Bookea.lat",
      },
    ],
  };

  // Los DOS juntos o ninguno: Apple exige `webServiceURL` y
  // `authenticationToken` a la vez. Declarar uno solo produce un pase
  // que el iPhone acepta pero nunca registra para actualizaciones, y
  // el síntoma es silencioso — el sello simplemente no se refresca.
  if (datos.webServiceUrl && datos.authToken) {
    pass.webServiceURL = datos.webServiceUrl;
    pass.authenticationToken = datos.authToken;
  }

  // El aviso por cercanía es nativo de Wallet: con la coordenada del
  // local, el iPhone muestra la tarjeta en la pantalla bloqueada
  // cuando el cliente pasa cerca. No necesita servidor ni push.
  //
  // Desde la 0196 hay dos caminos y GANA el registrado: si el negocio
  // cargó sus ubicaciones (cada una con su mensaje propio), van esas.
  // Sin ninguna registrada, queda el camino de siempre — la coordenada
  // del local con el texto genérico, si el plan trae `cercania` — y el
  // pase sale byte por byte igual que hoy. El `slice(0, 10)` es el
  // techo de Apple, remachado acá por si quien llama trajera de más.
  const registradas = (datos.ubicaciones ?? []).slice(0, 10);
  if (registradas.length > 0) {
    pass.locations = registradas.map((u) => ({
      latitude: u.latitud,
      longitude: u.longitud,
      relevantText: u.mensaje,
    }));
  } else if (datos.ubicacion) {
    pass.locations = [
      {
        latitude: datos.ubicacion.latitud,
        longitude: datos.ubicacion.longitud,
        relevantText: `Estás cerca de ${datos.negocioNombre}`,
      },
    ];
  }

  return pass;
}

/** «30% OFF», «₡5.000 de descuento», «Postre gratis». */
function textoDeBeneficio(b: Extract<ConfigBeneficio, { tipo: "cupon" | "descuento" }>): string {
  const v = b.beneficio;
  if (v.forma === "porcentaje") return `${v.valor}% OFF`;
  if (v.forma === "monto") return `₡${v.valor.toLocaleString("es-CR")} de descuento`;
  return `${v.que} gratis`;
}

/**
 * El dorso del pase, que es donde el cliente busca cuando duda.
 *
 * Cubre los ocho tipos por la misma razón que `camposSegunModo`: el
 * texto genérico habla de «sumar puntos y canjearlos», y en un cupón
 * de un solo uso o en una entrada a un evento eso es sencillamente
 * falso. Un dorso que miente es peor que un dorso corto.
 */
function textoDeAyuda(datos: DatosDelTexto): string {
  const modo = tipoDe(datos.config.modo);
  const meta = metaDeSellos(datos.meta);
  const b = datos.beneficio;

  if (modo === "sellos" && meta !== null && datos.meta) {
    return `Presentá esta tarjeta en cada visita. Al completar ${meta} sellos, ${datos.meta.nombre.toLowerCase()}.`;
  }
  if (modo === "cashback") {
    return "Presentá esta tarjeta al pagar. Tu saldo crece con cada compra y se descuenta cuando quieras usarlo.";
  }

  if (modo === "cupon" || modo === "descuento") {
    const esDelTipo = b?.tipo === "cupon" || b?.tipo === "descuento";
    const que = esDelTipo ? textoDeBeneficio(b) : "tu beneficio";
    const minima =
      esDelTipo && b.compraMinima > 0
        ? ` Aplica desde ₡${b.compraMinima.toLocaleString("es-CR")} de compra.`
        : "";
    return `Mostrá esta tarjeta al pagar: ${que}.${minima}`;
  }

  if (modo === "membresia") {
    const nivel = b?.tipo === "membresia" && b.nivel.trim() ? `${b.nivel} ` : "";
    return `Tu membresía ${nivel}vive en este carnet: mostralo en cada visita para que te reconozcan los beneficios.`;
  }

  if (modo === "giftcard") {
    const cargada =
      b?.tipo === "giftcard" && b.valor > 0
        ? ` Se cargó con ${b.moneda === "USD" ? "$" : "₡"}${b.valor.toLocaleString("es-CR")}.`
        : "";
    return `Esta gift card se gasta de a poco: mostrala cada vez que la usés y se descuenta del saldo.${cargada}`;
  }

  if (modo === "evento") {
    const donde = b?.tipo === "evento" && b.ubicacion.trim() ? b.ubicacion : datos.negocioNombre;
    const cuando =
      b?.tipo === "evento" && b.fecha ? `${b.fecha}${b.hora ? ` a las ${b.hora}` : ""}, ` : "";
    return `Tu entrada para ${cuando}${donde}. Mostrá el código en la puerta.`;
  }

  return "Presentá esta tarjeta en cada visita para sumar puntos y canjearlos por recompensas.";
}
