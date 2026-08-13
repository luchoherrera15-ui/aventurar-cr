/**
 * EL CATÁLOGO DE LEALTAD, EN LA FORMA EN QUE SALE A LA CALLE.
 *
 * `planes.ts` es la fuente de verdad, pero es un archivo de PRODUCTO:
 * tiene los paquetes retirados con sus precios de antes, los topes que
 * están declarados pero no se hacen cumplir, y la lista de capacidades
 * que no tienen nada detrás. Nada de eso puede viajar por la red.
 *
 * Este módulo es el filtro: toma `PLANES_VIGENTES` y devuelve
 * exactamente lo que ya está impreso en la landing de /lealtad — ni un
 * campo más. Lo que sale de acá lo puede leer cualquiera sin sesión.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE, Y POR QUÉ SE SIRVE POR HTTP
 * ------------------------------------------------------------------
 * La app móvil es otro proyecto npm: no puede `import` este archivo.
 * Hasta hoy la paridad era a mano —un comentario en
 * `mobile/src/app/lealtad.tsx` lo admitía— y no la había: la app
 * vendía «Gratis, hasta 50 clientes», «₡12 900/mes» y un paquete «Pro»
 * a ₡24 900 que acá está RETIRADO desde la 0141.
 *
 * Copiar el catálogo en el build de la app no arregla eso: los precios
 * cambian más seguido que las versiones de una app, y un cambio de
 * precio quedaría esperando la revisión de la App Store. Servido por
 * HTTP, el precio cambia con un deploy del sitio y la app lo toma
 * sola.
 *
 * ------------------------------------------------------------------
 * LO QUE NO SALE, Y POR QUÉ
 * ------------------------------------------------------------------
 *   · Los paquetes RETIRADOS (`vigente: false`). Nadie los puede
 *     comprar, y publicar el precio de «Pro» ($69) invita a pedirlo.
 *   · Las capacidades de `CAPACIDADES_SIN_PRODUCTO`. Ningún paquete
 *     ofrecido las trae —hay una prueba que lo impide— pero el filtro
 *     se escribe igual: es la última puerta antes de la red, y una
 *     promesa publicada no se puede despublicar de los teléfonos que
 *     ya la bajaron.
 *   · Los topes que NO se hacen cumplir (`notificacionesMes`, `sedes`,
 *     `automatizaciones`). Están en 0 o en 1 justamente porque no hay
 *     producto detrás; mandarlos por la red los convertiría en una
 *     cifra que alguien pinta en una pantalla.
 *
 * Hay una prueba por cada punto de esta lista.
 */

import {
  CAPACIDADES_SIN_PRODUCTO,
  ETIQUETAS_LIMITE,
  PLANES_VIGENTES,
  PLAN_DESTACADO,
  etiquetasDeCapacidades,
  mesesDeAhorroAnual,
  precioDe,
  type DefinicionPlan,
} from "./planes";

/** La versión de la FORMA del cuerpo, no la del catálogo. */
export const VERSION_CATALOGO = 1;

/**
 * Los únicos topes que se publican: los tres que el servidor hace
 * cumplir de verdad (cupo de clientes en la puerta de Wallet, tarjetas
 * en `crear-actions.ts`, equipo en `equipo-actions.ts`).
 *
 * Es una lista y no un `Omit` a propósito: agregar un tope nuevo a
 * `LimitesPlan` NO lo publica solo. Publicarlo es una decisión, y para
 * tomarla hay que poder decir dónde se hace cumplir.
 */
export const TOPES_PUBLICADOS = ["clientesActivos", "programas", "administradores"] as const;
export type TopeId = (typeof TOPES_PUBLICADOS)[number];

export type TopePublico = {
  id: TopeId;
  /** Cómo se le cuenta a un dueño de negocio. */
  etiqueta: string;
  /** null = sin tope. */
  valor: number | null;
  /** El valor ya escrito: «1.150» o «Sin tope». */
  texto: string;
};

export type PlanPublico = {
  id: string;
  nombre: string;
  /** Para quién es, en una línea. */
  descripcion: string;
  /** Ya formateado con su moneda: «$0», «$12». null = a convenir. */
  precio: string | null;
  precioAnual: string | null;
  /** El paquete sin costo. */
  esGratis: boolean;
  /** Días de prueba. 0 = no es una prueba. */
  diasPrueba: number;
  /** El que la grilla marca como «El más popular». */
  destacado: boolean;
  /** La línea chica debajo del precio, ya escrita. */
  notaPrecio: string;
  /** «Hasta 1.150 clientes» / «Clientes ilimitados», ya escrito. */
  etiquetaClientes: string;
  topes: TopePublico[];
  /** Las viñetas del paquete, listas para pintar. */
  incluye: string[];
};

export type CatalogoPublico = {
  version: number;
  /** En qué moneda están los precios de `precio` y `precioAnual`. */
  moneda: "USD";
  /** El `id` del paquete destacado, o null si el destacado se retiró. */
  destacado: string | null;
  planes: PlanPublico[];
  /**
   * Cómo se paga. Va acá y no escrito en la app porque es parte de la
   * oferta: si mañana entra otro medio de pago, la app no puede seguir
   * diciendo que solo hay SINPE.
   *
   * Junta las dos frases que el sitio dice por separado —la del
   * comprobante (landing de /lealtad) y la del tipo de cambio
   * (`seccion-plan.tsx`)— porque quien lee esto en un teléfono
   * necesita las dos a la vez: los precios están en dólares y el
   * depósito se hace en colones.
   */
  notaPago: string;
};

/** El número, como se escribe en Costa Rica: 1.150. */
function conMiles(n: number): string {
  return n.toLocaleString("es-CR");
}

/**
 * La línea chica debajo del precio. Es la MISMA de
 * `src/app/lealtad/paquetes-cliente.tsx`, con una diferencia: los
 * «2 meses gratis» salen de `mesesDeAhorroAnual()` en vez de estar
 * escritos, así que un cambio de precio anual no los deja mintiendo.
 */
function notaPrecioDe(def: DefinicionPlan): string {
  if (def.precioMensual === 0) return `${def.diasPrueba} días, sin tarjeta`;
  const anual = precioDe(def, "año");
  if (anual === null) return "Cotizado a tu medida";
  const meses = mesesDeAhorroAnual(def);
  if (meses <= 0) return `${anual} al año`;
  return `${anual} al año — ${meses} ${meses === 1 ? "mes gratis" : "meses gratis"}`;
}

function topesDe(def: DefinicionPlan): TopePublico[] {
  return TOPES_PUBLICADOS.map((id) => {
    const valor = def.limites[id];
    return {
      id,
      etiqueta: ETIQUETAS_LIMITE[id],
      valor,
      texto: valor === null ? "Sin tope" : conMiles(valor),
    };
  });
}

/**
 * Las viñetas, ya filtradas.
 *
 * `etiquetasDeCapacidades()` hace la sustitución de los tipos de
 * tarjeta (que depende del paquete), así que se recorren las
 * capacidades en paralelo para saber cuál descartar.
 */
function incluyeDe(def: DefinicionPlan): string[] {
  const etiquetas = etiquetasDeCapacidades(def);
  return def.capacidades
    .map((c, i) => ({ c, texto: etiquetas[i] }))
    .filter(({ c }) => !CAPACIDADES_SIN_PRODUCTO.includes(c))
    .map(({ texto }) => texto);
}

function planPublicoDe(def: DefinicionPlan): PlanPublico {
  const clientes = def.limites.clientesActivos;
  return {
    id: def.id,
    nombre: def.nombre,
    descripcion: def.descripcion,
    precio: precioDe(def),
    precioAnual: precioDe(def, "año"),
    esGratis: def.precioMensual === 0,
    diasPrueba: def.diasPrueba,
    destacado: def.id === PLAN_DESTACADO,
    notaPrecio: notaPrecioDe(def),
    etiquetaClientes:
      clientes === null ? "Clientes ilimitados" : `Hasta ${conMiles(clientes)} clientes`,
    topes: topesDe(def),
    incluye: incluyeDe(def),
  };
}

/**
 * El cuerpo que sirve `GET /api/lealtad/planes`.
 *
 * Es una función y no una constante para que las pruebas la puedan
 * llamar sin arrastrar nada de Next, y para que no quede un objeto
 * compartido que alguien pueda mutar por accidente.
 */
export function catalogoPublico(): CatalogoPublico {
  const planes = PLANES_VIGENTES.map(planPublicoDe);
  return {
    version: VERSION_CATALOGO,
    moneda: "USD",
    // Si el destacado se retirara sin actualizar `PLAN_DESTACADO`, acá
    // sale null en vez de nombrar un paquete que no está en la lista.
    destacado: planes.some((p) => p.id === PLAN_DESTACADO) ? PLAN_DESTACADO : null,
    planes,
    notaPago:
      "El pago es por SINPE Móvil o transferencia: adjuntás el comprobante " +
      "con la solicitud y Bookea activa tu programa. Los precios están en " +
      "dólares y el depósito se hace en colones — te confirmamos el monto " +
      "al tipo de cambio del día.",
  };
}
