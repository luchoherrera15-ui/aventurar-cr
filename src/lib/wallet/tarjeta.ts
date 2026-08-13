/**
 * Arma el `pass.json` de una tarjeta de lealtad a partir de lo que el
 * negocio configuró (migraciones 0060, 0121 y 0122).
 *
 * Es lógica pura: no toca Supabase ni dibuja imágenes. Quien llama le
 * pasa los datos ya leídos, y esto decide qué dice la tarjeta.
 */

import type { ConfigBeneficio, TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";

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
};

/** La recompensa activa más barata: es la META de la tarjeta. */
export type MetaRecompensa = { nombre: string; costo_puntos: number } | null;

export type DatosTarjeta = {
  negocioNombre: string;
  /** Saldo actual, derivado de transacciones_puntos. */
  saldo: number;
  meta: MetaRecompensa;
  config: ConfigPase;
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
  /**
   * La configuración propia del tipo (0135). Opcional: un programa
   * guardado antes de la 0135 no la tiene, y la tarjeta se sigue
   * dibujando con lo genérico en vez de quedar en blanco.
   */
  beneficio?: ConfigBeneficio | null;
};

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
export function camposSegunModo(datos: DatosTarjeta): CamposTarjeta {
  const modo = datos.config.modo ?? "puntos";
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

function textoDeAyuda(datos: DatosTarjeta): string {
  const modo = datos.config.modo ?? "puntos";
  const meta = metaDeSellos(datos.meta);

  if (modo === "sellos" && meta !== null && datos.meta) {
    return `Presentá esta tarjeta en cada visita. Al completar ${meta} sellos, ${datos.meta.nombre.toLowerCase()}.`;
  }
  if (modo === "cashback") {
    return "Presentá esta tarjeta al pagar. Tu saldo crece con cada compra y se descuenta cuando quieras usarlo.";
  }
  return "Presentá esta tarjeta en cada visita para sumar puntos y canjearlos por recompensas.";
}
