import { tintaSobre } from "@/lib/colores-imagen";
import { ICONOS_SELLO, imagenDentroDelSello, type DibujoDelSello } from "@/lib/lealtad/iconos-sello";
import { tipoDe, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { MARCA_BOOKEA, type MarcaDelPase } from "@/lib/plataforma/foorkie-marca";
import { paradasDelFondo, type Parada } from "@/lib/wallet/fondo-tira";
import { contenidoDelObjeto } from "@/lib/wallet/google";
import { layoutDeLaTira, TIRA_ALTO, TIRA_ANCHO, type ConfigTira, type PosicionSello } from "@/lib/wallet/layout-tira";
import {
  camposSegunModo,
  coloresDe,
  disenoDeLaConfig,
  selloDeLaConfig,
  tarjetaDesdeFila,
  tiraDelPase,
  type CamposTarjeta,
  type MetaRecompensa,
} from "@/lib/wallet/tarjeta";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA VISTA DEL PASE PARA FOORKIE — lo que el teléfono dibuja, resuelto
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (2 oct 2026): «la imagen del card de Pura Matcha no
 * sincroniza realmente lo que se ve en el teléfono de los clientes: en la
 * página se ve distinta». Foorkie dibujaba la tarjeta con lo poco que le
 * daba la API (`diseno`: dos colores, logo y banda) y le faltaba todo lo
 * demás que pinta el pase: la geometría de los sellos (0212), el dibujo o
 * el ícono propio de cada sello (0145/0174), el degradado de la franja, la
 * foto con su velo, el color de las etiquetas (`labelColor`), la tinta
 * del texto sobre fondos claros, lo que Google pone en su tarjeta…
 *
 * Es la misma historia de `datos-vista-pase.ts` («los previews de las
 * tarjetas nunca se parecen a cómo son realmente», 1 sep 2026), del otro
 * lado de la puerta. Y el mismo remedio: NADA se decide acá. Cada pieza
 * sale de la función que usa el generador del pase:
 *
 *   · los colores, de `coloresDe` + `tintaSobre` (`foregroundColor`) y el
 *     color del sello como `labelColor`, igual que `construirPassJson`;
 *   · los tres renglones del frente, de `camposSegunModo`;
 *   · qué lleva la franja, de `tiraDelPase`; dónde va cada sello, de
 *     `layoutDeLaTira` con la config de `disenoDeLaConfig`; el degradado,
 *     de `paradasDelFondo` (las mismas paradas que recibe sharp);
 *   · qué va adentro de cada sello, de `selloDeLaConfig` +
 *     `imagenDentroDelSello` (con los trazos del catálogo si es un dibujo);
 *   · lo de Android, de `contenidoDelObjeto` (el mismo objeto que se le
 *     manda a Google) y del respaldo de `programLogo` (la inicial);
 *   · y lo que va bajo el QR, de la marca de la tarjeta (`foorkie-marca`).
 *
 * Es SERIALIZABLE y viaja tal cual en `programa` y `tarjetas` (campo
 * nuevo y opcional: quien no lo lee sigue igual). Las imágenes van como
 * URLs absolutas https —las que baja el generador—; lo que no lo sea no
 * sale.
 *
 * Lo que NO puede llevar: el recorte de bordes del logo (`recortarBordes`
 * lo hace sharp al armar el pase) y el layout final, que lo resuelven
 * Apple y Google. Por eso del otro lado sigue siendo «vista aproximada».
 *
 * Pura y sin servidor: la llaman `programaParaFoorkie` y `armarTarjeta`
 * con la fila ya leída.
 */

/** Sube cuando cambia la FORMA del objeto (no su contenido). */
export const VERSION_VISTA = 1 as const;

/** Lo que va adentro de cada sello, como lo decide `selloDeLaConfig`. */
export type SelloVista =
  /** El de siempre: el LOGO adentro (si hay; si no, el disco liso del color del sello). */
  | { clase: "logo" }
  /** Uno de los doce dibujos, con sus trazos (viewBox 24, trazo 1,8 redondeado). */
  | { clase: "icono"; icono: string; trazos: string[] }
  /** El ícono que subió el negocio (0174). */
  | { clase: "propio"; url: string };

export type TiraVista =
  /** Sin franja: el pase queda sin `strip.png`. */
  | { tipo: "ninguna" }
  /** La foto ES la franja, sin sellos. */
  | { tipo: "banda"; banda: string }
  | {
      tipo: "sellos";
      total: number;
      /** Los sellos ganados: `min(saldo, total)`, como `dibujarTiraDeSellos`. */
      logrados: number;
      /**
       * La foto de fondo. Se dibuja SOLO con el fondo plano (con degradado
       * manda el degradado, la misma regla que sharp) y con el velo encima.
       */
      banda: string | null;
      /** La opacidad del velo negro entre la foto y los sellos (`VELO_SOBRE_LA_BANDA`). */
      velo: number;
      /** Dónde y de qué tamaño van los sellos (0212) y el fondo de la franja, ya saneados. */
      diseno: ConfigTira;
      /** Las paradas del degradado con el color de esta tarjeta; null = color plano. */
      degradado: Parada[] | null;
      /** `layoutDeLaTira`: posiciones en el espacio de Apple (375 × 123 puntos). */
      layout: { ancho: number; alto: number; diametro: number; posiciones: PosicionSello[] };
      sello: SelloVista;
      /** La imagen que de verdad va adentro del sello (`imagenDentroDelSello`): el logo, el ícono propio o ninguna. */
      imagen: string | null;
    };

export type VistaParaFoorkie = {
  version: typeof VERSION_VISTA;
  /** `organizationName`: el nombre del negocio (logo de Apple, encabezado de Google). */
  negocio: string;
  /** El nombre tal como entra en el `logo.png` (sin emojis: `nombreParaLogo`). */
  nombreLogo: string;
  modo: TipoTarjeta;
  /** El saldo con el que están escritos los textos y pintados los sellos. */
  saldo: number;
  pausada: boolean;
  /**
   * Los colores del `pass.json`: `backgroundColor`, `foregroundColor`
   * (blanco salvo sobre fondos claros) y `labelColor` (el color del sello),
   * más el color de los sellos de la franja.
   */
  colores: { fondo: string; tinta: string; etiqueta: string; sello: string };
  /**
   * El logo de arriba a la izquierda (`logo.png`): la imagen de la tarjeta, o
   * null — y entonces Apple dibuja SOLO el nombre (Montserrat Light) y Google
   * la inicial sobre el color de la tarjeta.
   */
  logo: string | null;
  /** Los tres renglones del frente: `headerFields`, `secondaryFields` y `auxiliaryFields`. */
  textos: CamposTarjeta;
  /** La meta que lee el pase: la recompensa activa más barata. */
  meta: MetaRecompensa;
  tira: TiraVista;
  /** Lo que muestra la tarjeta de Google Wallet (clase + objeto). */
  google: {
    /** `programLogo`: el de la tarjeta, o null = la inicial blanca sobre el fondo (`/api/pases-google/logo`). */
    logo: string | null;
    inicial: string;
    /** `loyaltyPoints`: la etiqueta y el número grande. */
    saldo: { etiqueta: string; valor: string };
    /** `heroImage`: la banda, en cualquier tipo de tarjeta. */
    banda: string | null;
  };
  /** De quién es el pase y lo que Apple dibuja bajo el QR (`altText`). */
  marca: MarcaDelPase["marca"];
  pie: string;
};

/** El velo de `imagenes.ts` (`VELO_SOBRE_LA_BANDA`): entre la foto y los sellos. */
const VELO = 0.42;

/** Solo URLs absolutas https: es lo único que el generador puede bajar con certeza y Foorkie dibujar. */
export function soloHttps(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > 600 || !/^https:\/\/[^\s"'<>]+$/i.test(t)) return null;
  try {
    return new URL(t).protocol === "https:" ? t : null;
  } catch {
    return null;
  }
}

/**
 * El nombre como entra en el logo: el MISMO filtro que `nombreParaLogo` de
 * `imagenes.ts` (sin emojis ni espacios dobles). Copiado y no importado
 * porque ese archivo carga `sharp`, y esta vista viaja en rutas que no
 * dibujan nada; `foorkie-vista.test.ts` fija que digan lo mismo.
 */
export function nombreDelLogo(nombre: string): string {
  return nombre
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La inicial del logo de respaldo de Google: la MISMA que dibuja
 * `/api/pases-google/logo` (la primera letra en mayúscula; «B» sin nombre).
 * Copiada por lo mismo: esa ruta corre en el edge y no la exporta.
 */
export function inicialDeGoogle(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio === "") return "B";
  return [...limpio][0].toUpperCase();
}

/** El sello de la config, con los trazos del catálogo si es uno de los doce. */
function selloVista(sello: DibujoDelSello): SelloVista {
  if (sello.clase === "icono") return { clase: "icono", icono: sello.icono, trazos: [...ICONOS_SELLO[sello.icono].trazos] };
  if (sello.clase === "propio") {
    const url = soloHttps(sello.url);
    return url ? { clase: "propio", url } : { clase: "logo" };
  }
  return { clase: "logo" };
}

/**
 * LA VISTA DE UNA TARJETA con este saldo: lo que el `pass.json` y el
 * `strip.png` van a decir y a dibujar, pieza por pieza. `marca` ausente =
 * la de Bookea (lo que dice el pase sin local de Foorkie).
 */
export function vistaParaFoorkie(d: {
  fila: Record<string, unknown>;
  negocio: string;
  saldo: number;
  meta: MetaRecompensa;
  pausada: boolean;
  marca?: MarcaDelPase | null;
}): VistaParaFoorkie {
  const { config: leida, beneficio } = tarjetaDesdeFila(d.fila);
  // Las imágenes, ya filtradas: lo que se decide abajo no puede apuntar a
  // una URL que la vista no lleva.
  const logo = soloHttps(leida.pase_logo_url);
  const banda = soloHttps(leida.pase_banner_url);
  const config = { ...leida, pase_logo_url: logo, pase_banner_url: banda };
  const modo = tipoDe(config.modo);
  const colores = coloresDe(config);
  const saldo = Number.isFinite(d.saldo) ? d.saldo : 0;
  const marca = d.marca ?? MARCA_BOOKEA;

  const textos = camposSegunModo({ negocioNombre: d.negocio, saldo, meta: d.meta, config, beneficio, pausado: d.pausada });

  const t = tiraDelPase(config, d.meta);
  let tira: TiraVista;
  if (t.tipo === "sellos") {
    const diseno = disenoDeLaConfig(config);
    const layout = layoutDeLaTira(t.total, diseno, TIRA_ANCHO, TIRA_ALTO);
    const dibujo = selloDeLaConfig(config);
    const sello = selloVista(dibujo);
    const cual = imagenDentroDelSello({ sello: dibujo, hayLogo: !!logo });
    tira = {
      tipo: "sellos",
      total: t.total,
      logrados: Math.max(0, Math.min(saldo, t.total)),
      banda: t.banda,
      velo: VELO,
      diseno,
      degradado: paradasDelFondo(diseno.fondo, colores.fondo),
      layout: { ancho: layout.ancho, alto: layout.alto, diametro: layout.diametro, posiciones: layout.posiciones },
      sello,
      imagen: cual === "propio" ? (sello.clase === "propio" ? sello.url : null) : cual === "logo" ? logo : null,
    };
  } else {
    tira = t.tipo === "banda" ? { tipo: "banda", banda: t.banda } : { tipo: "ninguna" };
  }

  // Android: el MISMO objeto que se le manda a Google (sin la pausa: ahí
  // va como módulo aparte y no cambia el número grande).
  const objeto = contenidoDelObjeto({ negocioNombre: d.negocio, saldo, config, meta: d.meta, beneficio });
  const balance = objeto.loyaltyPoints.balance;

  return {
    version: VERSION_VISTA,
    negocio: d.negocio,
    nombreLogo: nombreDelLogo(d.negocio) || d.negocio,
    modo,
    saldo,
    pausada: d.pausada,
    colores: { fondo: colores.fondo, tinta: tintaSobre(colores.fondo), etiqueta: colores.sello, sello: colores.sello },
    logo,
    textos,
    meta: d.meta,
    tira,
    google: {
      logo,
      inicial: inicialDeGoogle(d.negocio),
      saldo: { etiqueta: objeto.loyaltyPoints.label, valor: "int" in balance ? String(balance.int) : balance.string },
      banda: objeto.heroImage ? banda : null,
    },
    marca: marca.marca,
    pie: marca.altText,
  };
}
