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
};

export type DatosTarjeta = DatosDelTexto & {
  serialNumber: string;
  passTypeIdentifier: string;
  teamIdentifier: string;
  /** Coordenadas del local. Habilitan el aviso en pantalla bloqueada
   *  cuando el cliente pasa cerca — Apple lo hace nativo. */
  ubicacion?: { latitud: number; longitud: number } | null;
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
    },
    beneficio: leerBeneficio(fila.beneficio, modo),
  };
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

/**
 * Qué dice la tarjeta según el modo. Los tres guardan el MISMO dato —
 * un saldo de puntos— y solo cambia cómo se lee: 5 puede ser "5
 * sellos", "₡5" o "5 puntos" según lo que el negocio prometió.
 */
export function camposSegunModo(datos: DatosDelTexto): CamposTarjeta {
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
        {
          key: "como",
          label: "Cómo funciona",
          value: textoDeAyuda(datos),
        },
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
  if (datos.ubicacion) {
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
