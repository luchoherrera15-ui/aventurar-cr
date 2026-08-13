import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * ============================================================
 * EL CATÁLOGO DE LEALTAD — SE BAJA, NO SE ESCRIBE
 * ============================================================
 *
 * Los paquetes de Bookea Lealtad viven en UN solo archivo, y ese
 * archivo está del otro lado: `src/lib/lealtad/planes.ts` de la web.
 * Como son dos proyectos npm distintos no se puede importar, así que
 * la web lo publica por HTTP —`GET /api/lealtad/planes`— y acá se baja.
 *
 * ------------------------------------------------------------------
 * POR QUÉ POR RED Y NO COPIADO EN EL BUILD
 * ------------------------------------------------------------------
 * Porque ya se probó copiarlo y salió mal. Hasta hoy la pantalla
 * `app/lealtad.tsx` tenía los precios escritos a mano, con un
 * comentario que decía «si cambian los planes en la web, cambiarlos
 * acá». No se cambiaron: la app ofrecía un plan gratis PERMANENTE de
 * 50 clientes (son 25, y son 14 días), «Lealtad» a ₡12 900 (es
 * Arranque, $12) y un paquete «Pro» a ₡24 900 que la web RETIRÓ.
 *
 * Y hay una razón más dura que el descuido: un precio escrito en el
 * bundle solo cambia con una versión nueva de la app, o sea pasando
 * por la revisión de la App Store. Bajado, cambia con un deploy del
 * sitio y los teléfonos lo toman solos.
 *
 * ------------------------------------------------------------------
 * TRES FUENTES, EN ESTE ORDEN
 * ------------------------------------------------------------------
 *   1. LA RED — lo que dice el sitio ahora mismo.
 *   2. LO GUARDADO — la última bajada buena, en AsyncStorage. Es un
 *      catálogo REAL que estuvo vigente; con el avión en modo avión
 *      es lo correcto para mostrar.
 *   3. EL RESPALDO — la foto de abajo, que viaja en el bundle. Es la
 *      única que puede estar vieja sin que nadie se entere, así que
 *      cuando se usa la pantalla lo DICE (ver `origen`).
 *
 * Nunca hay pantalla en blanco y nunca hay un precio inventado.
 */

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * Igual que en `lib/notificaciones.ts`: sin corte, un teléfono en una
 * red mala se queda colgado del `fetch` para siempre.
 */
const TIMEOUT_MS = 8000;

/**
 * La llave lleva la versión de la FORMA. Si algún día el cuerpo cambia
 * de forma, la llave cambia de nombre y ningún teléfono le pasa a la
 * app nueva un objeto viejo con otra estructura.
 */
const LLAVE_CACHE = "catalogo_lealtad_v1";

// ── La forma del cuerpo ───────────────────────────────────────────
// ESPEJO EXACTO de `src/lib/lealtad/catalogo-publico.ts` de la web.
// Hay una prueba allá (`catalogo-publico.test.ts`) que corre sobre el
// cuerpo real el mismo guardián que está más abajo: si alguien le
// cambia el nombre a un campo, esa prueba se cae antes de desplegar.

export type TopeLealtad = {
  id: string;
  /** Cómo se le cuenta a un dueño de negocio: «Clientes activos». */
  etiqueta: string;
  /** null = sin tope. */
  valor: number | null;
  /** El valor ya escrito: «1 150» o «Sin tope». */
  texto: string;
};

export type PlanLealtad = {
  id: string;
  nombre: string;
  descripcion: string;
  /** Ya formateado con su moneda: «$0», «$12». null = a convenir. */
  precio: string | null;
  precioAnual: string | null;
  esGratis: boolean;
  diasPrueba: number;
  destacado: boolean;
  /** La línea chica debajo del precio, ya escrita. */
  notaPrecio: string;
  /** «Hasta 200 clientes» / «Clientes ilimitados». */
  etiquetaClientes: string;
  topes: TopeLealtad[];
  /** Las viñetas del paquete. */
  incluye: string[];
};

export type CatalogoLealtad = {
  version: number;
  moneda: string;
  destacado: string | null;
  planes: PlanLealtad[];
  /** Cómo se paga, tal como lo dice la landing. */
  notaPago: string;
};

/** De dónde salió lo que se está mostrando. */
export type OrigenCatalogo = "red" | "guardado" | "respaldo";

export type CatalogoConOrigen = {
  catalogo: CatalogoLealtad;
  origen: OrigenCatalogo;
};

// ── El guardián ───────────────────────────────────────────────────

function esTope(dato: unknown): dato is TopeLealtad {
  if (typeof dato !== "object" || dato === null) return false;
  const t = dato as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.etiqueta === "string" &&
    (typeof t.valor === "number" || t.valor === null) &&
    typeof t.texto === "string"
  );
}

function esPlan(dato: unknown): dato is PlanLealtad {
  if (typeof dato !== "object" || dato === null) return false;
  const p = dato as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.nombre === "string" &&
    typeof p.descripcion === "string" &&
    (typeof p.precio === "string" || p.precio === null) &&
    (typeof p.precioAnual === "string" || p.precioAnual === null) &&
    typeof p.esGratis === "boolean" &&
    typeof p.diasPrueba === "number" &&
    typeof p.destacado === "boolean" &&
    typeof p.notaPrecio === "string" &&
    typeof p.etiquetaClientes === "string" &&
    Array.isArray(p.incluye) &&
    p.incluye.every((i) => typeof i === "string") &&
    Array.isArray(p.topes) &&
    p.topes.every(esTope)
  );
}

/**
 * ¿Esto que bajó de la red es un catálogo?
 *
 * Se comprueba entero y no «confiando en que el servidor manda bien»
 * por dos razones: un JSON de la red es dato ajeno (puede venir un
 * error de Vercel, o una página de portal de wifi con status 200), y
 * porque el proyecto prohíbe `any` — sin guardián no hay forma de
 * pasar de `unknown` al tipo sin mentirle al compilador.
 *
 * `planes` vacío se rechaza a propósito: una lista sin paquetes
 * pintaría una sección de precios en blanco, y eso se ve como una app
 * rota, no como un catálogo vacío.
 */
export function esCatalogoLealtad(dato: unknown): dato is CatalogoLealtad {
  if (typeof dato !== "object" || dato === null) return false;
  const c = dato as Record<string, unknown>;
  return (
    typeof c.version === "number" &&
    typeof c.moneda === "string" &&
    typeof c.notaPago === "string" &&
    (typeof c.destacado === "string" || c.destacado === null) &&
    Array.isArray(c.planes) &&
    c.planes.length > 0 &&
    c.planes.every(esPlan)
  );
}

// ── El respaldo del bundle ────────────────────────────────────────

/**
 * FOTO DEL CATÁLOGO AL 2026-08-13, tomada de
 * `GET https://bookea.lat/api/lealtad/planes`.
 *
 * Es el ÚLTIMO recurso: solo se ve en el primer arranque de una
 * instalación nueva que además no tenga red. En cuanto haya una
 * bajada buena, esta copia no se vuelve a mirar.
 *
 * ⚠️ ES LA ÚNICA PARTE DE ESTE ARCHIVO QUE PUEDE QUEDAR VIEJA. Por eso
 * la pantalla avisa cuando está mostrando esto (`origen === "respaldo"`)
 * en vez de hacerlo pasar por el precio de hoy. No hace falta correr a
 * actualizarla con cada cambio de precio —para eso está el endpoint—;
 * lo que sí conviene es refrescarla cuando se publique una versión.
 *
 * Para regenerarla:
 *   curl -s https://bookea.lat/api/lealtad/planes
 */
export const CATALOGO_RESPALDO: CatalogoLealtad = {
  version: 1,
  moneda: "USD",
  destacado: "impulso",
  planes: [
    {
      id: "prueba",
      nombre: "Prueba",
      descripcion: "14 días para armar tu primera tarjeta, sin tarjeta de crédito.",
      precio: "$0",
      precioAnual: null,
      esGratis: true,
      diasPrueba: 14,
      destacado: false,
      notaPrecio: "14 días, sin tarjeta",
      etiquetaClientes: "Hasta 25 clientes",
      topes: [
        { id: "clientesActivos", etiqueta: "Clientes activos", valor: 25, texto: "25" },
        { id: "programas", etiqueta: "Tarjetas", valor: 1, texto: "1" },
        { id: "administradores", etiqueta: "Gente del equipo", valor: 1, texto: "1" },
      ],
      incluye: [
        "Pases en Apple Wallet y Google Wallet",
        "Tarjetas de sellos y puntos",
        "Tu color, tu logo y tus textos en la tarjeta",
        "Reglas, límites y vencimientos",
        "Póster con tu QR, listo para imprimir",
        "Modo mostrador para sellar y canjear",
        "Tu equipo, con permisos por persona",
        "Métricas: altas, activos, sellos y canjes",
      ],
    },
    {
      id: "arranque",
      nombre: "Arranque",
      descripcion: "Para el local que pone su primera tarjeta a rodar.",
      precio: "$12",
      precioAnual: "$120",
      esGratis: false,
      diasPrueba: 0,
      destacado: false,
      notaPrecio: "$120 al año — 2 meses gratis",
      etiquetaClientes: "Hasta 200 clientes",
      topes: [
        { id: "clientesActivos", etiqueta: "Clientes activos", valor: 200, texto: "200" },
        { id: "programas", etiqueta: "Tarjetas", valor: 2, texto: "2" },
        { id: "administradores", etiqueta: "Gente del equipo", valor: 3, texto: "3" },
      ],
      incluye: [
        "Pases en Apple Wallet y Google Wallet",
        "5 tipos de tarjeta: sellos, puntos, cashback, cupón y descuento",
        "Tu color, tu logo y tus textos en la tarjeta",
        "Reglas, límites y vencimientos",
        "Póster con tu QR, listo para imprimir",
        "Modo mostrador para sellar y canjear",
        "Tu equipo, con permisos por persona",
        "Métricas: altas, activos, sellos y canjes",
      ],
    },
    {
      id: "impulso",
      nombre: "Impulso",
      descripcion: "Para el que ya tiene clientela y quiere hacerla volver.",
      precio: "$42",
      precioAnual: "$420",
      esGratis: false,
      diasPrueba: 0,
      destacado: true,
      notaPrecio: "$420 al año — 2 meses gratis",
      // El separador de miles de es-CR es un espacio duro (U+00A0), no
      // un punto: así lo escribe el sitio y así se copia.
      etiquetaClientes: "Hasta 1 150 clientes",
      topes: [
        { id: "clientesActivos", etiqueta: "Clientes activos", valor: 1150, texto: "1 150" },
        { id: "programas", etiqueta: "Tarjetas", valor: 5, texto: "5" },
        { id: "administradores", etiqueta: "Gente del equipo", valor: 10, texto: "10" },
      ],
      incluye: [
        "Pases en Apple Wallet y Google Wallet",
        "Los 8 tipos de tarjeta",
        "Tu color, tu logo y tus textos en la tarjeta",
        "Reglas, límites y vencimientos",
        "Póster con tu QR, listo para imprimir",
        "Modo mostrador para sellar y canjear",
        "Tu equipo, con permisos por persona",
        "Métricas: altas, activos, sellos y canjes",
      ],
    },
    {
      id: "ilimitado",
      nombre: "Ilimitado",
      descripcion: "Sin techo de clientes ni de tarjetas, y el diseño lo hacemos nosotros.",
      precio: "$89",
      precioAnual: "$890",
      esGratis: false,
      diasPrueba: 0,
      destacado: false,
      notaPrecio: "$890 al año — 2 meses gratis",
      etiquetaClientes: "Clientes ilimitados",
      topes: [
        { id: "clientesActivos", etiqueta: "Clientes activos", valor: null, texto: "Sin tope" },
        { id: "programas", etiqueta: "Tarjetas", valor: null, texto: "Sin tope" },
        { id: "administradores", etiqueta: "Gente del equipo", valor: null, texto: "Sin tope" },
      ],
      incluye: [
        "Pases en Apple Wallet y Google Wallet",
        "Los 8 tipos de tarjeta",
        "Tu color, tu logo y tus textos en la tarjeta",
        "Reglas, límites y vencimientos",
        "Póster con tu QR, listo para imprimir",
        "Modo mostrador para sellar y canjear",
        "Tu equipo, con permisos por persona",
        "Métricas: altas, activos, sellos y canjes",
        "El pase aparece solo cerca de tu local (en iPhone)",
        "Te diseñamos la tarjeta a mano",
      ],
    },
  ],
  notaPago:
    "El pago es por SINPE Móvil o transferencia: adjuntás el comprobante " +
    "con la solicitud y Bookea activa tu programa. Los precios están en " +
    "dólares y el depósito se hace en colones — te confirmamos el monto " +
    "al tipo de cambio del día.",
};

// ── Las tres puertas ──────────────────────────────────────────────

/**
 * Lo que se puede pintar YA, sin esperar la red: la última bajada
 * buena o, si nunca hubo ninguna, el respaldo del bundle.
 */
export async function catalogoInicial(): Promise<CatalogoConOrigen> {
  try {
    const crudo = await AsyncStorage.getItem(LLAVE_CACHE);
    if (crudo) {
      const dato: unknown = JSON.parse(crudo);
      if (esCatalogoLealtad(dato)) return { catalogo: dato, origen: "guardado" };
      // Guardado pero ilegible (forma vieja, escritura a medias): se
      // barre, si no se reintenta parsear la misma basura por siempre.
      await AsyncStorage.removeItem(LLAVE_CACHE);
    }
  } catch {
    // Sin almacenamiento no pasa nada: se cae al respaldo.
  }
  return { catalogo: CATALOGO_RESPALDO, origen: "respaldo" };
}

/**
 * El catálogo de verdad, del sitio. Devuelve null si no se pudo —
 * nunca tira: quedarse sin red no es un error de la app, y la
 * pantalla ya tiene algo que mostrar.
 */
export async function refrescarCatalogo(): Promise<CatalogoLealtad | null> {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SITIO_URL}/api/lealtad/planes`, {
      signal: corte.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const dato: unknown = await res.json();
    if (!esCatalogoLealtad(dato)) return null;
    // Se guarda lo VALIDADO, no lo crudo: así nunca queda en el
    // teléfono un cuerpo que no pasa el guardián.
    await AsyncStorage.setItem(LLAVE_CACHE, JSON.stringify(dato)).catch(() => {});
    return dato;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}
