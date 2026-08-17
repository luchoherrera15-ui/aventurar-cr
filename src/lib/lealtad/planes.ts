/**
 * Los planes del MÓDULO DE LEALTAD.
 *
 * Son planes del producto Lealtad y de nadie más: no reemplazan ni se
 * mezclan con los planes generales de Bookea (marketplace, invitaciones).
 * Un negocio puede pagar Lealtad sin tener nada más, y al revés.
 *
 * Viven acá y no en la base a propósito: son producto, o sea iguales
 * para todos los clientes. Una tabla editable sugeriría que cada
 * cuenta puede tener su propia definición de "Impulso", y abriría la
 * puerta a cambiarle el tope a cien cuentas de un tecleo.
 *
 * Lógica pura, sin Supabase: se puede testear entera.
 *
 * ------------------------------------------------------------------
 * EL CATÁLOGO DE HOY (0141 + el reparto de la 0142)
 * ------------------------------------------------------------------
 *              clientes  tarjetas  tipos  equipo  extras
 *   Prueba $0        25         1      2       1  — (14 días)
 *   Arranque $12    200         2      5       3  —
 *   Impulso $42   1.150         5      8      10  —
 *   Ilimitado $89     ∞         ∞      8       ∞  cercanía + diseño
 *
 * Todo lo demás —wallet, personalización, reglas y vencimientos,
 * póster y QR, modo mostrador, equipo con permisos y analítica— va en
 * LOS CUATRO: es la base del producto, no un escalón.
 *
 * Lo que se reparte es lo que el código SABE hacer cumplir: el cupo de
 * clientes (las dos puertas de Wallet, vía `personasActivasDe`), las
 * tarjetas (`crear-actions.ts`), los tipos (`crear-actions.ts` y
 * `pases-actions.ts`), el equipo (`equipo-actions.ts`) y `cercania`
 * (`generar.ts`). Un escalón que no se hace cumplir es decoración, y
 * este archivo ya vivió esa etapa una vez.
 *
 * Prueba se queda aunque los tres de pago sean el producto: el alta
 * automática de `/lealtad/nuevo` se dispara con `precioMensual === 0`.
 * Un catálogo sin ningún plan a $0 apaga ese camino y manda a todo el
 * mundo al flujo manual con comprobante.
 *
 * ------------------------------------------------------------------
 * DOS LISTAS, Y LA DIFERENCIA IMPORTA
 * ------------------------------------------------------------------
 * `PLANES_OFRECIDOS` es lo que se VENDE hoy. `PLANES_ID` es todo lo
 * que la base puede tener GUARDADO, e incluye los planes retirados.
 *
 * Los retirados no se borran: hay negocios con esos valores (Rancho
 * Las Torres tiene «Básico») y el CHECK de la base los acepta. Sacarlos
 * de acá haría que `definicionDe('basico')` devolviera null y esas
 * cuentas se quedarían sin plan, sin topes y sin capacidades —
 * degradadas de un día para otro por un cambio de catálogo. Y con plan
 * null TODOS los topes quedan en null, o sea ilimitado: retirar mal un
 * plan no lo apaga, lo vuelve gratis e infinito.
 *
 * ------------------------------------------------------------------
 * LO QUE SE PROMETE TIENE QUE EXISTIR
 * ------------------------------------------------------------------
 * Las capacidades de este archivo son las viñetas que ve quien está
 * por pagar. Antes de la 0141 se vendían campañas, automatizaciones,
 * sedes, webhooks, API, exportación y POS: una auditoría del código
 * confirmó que ninguna de esas tiene tabla, endpoint ni pantalla. Se
 * sacaron de lo que se ofrece (siguen en `CAPACIDADES_SIN_PRODUCTO`,
 * con una prueba que impide volver a venderlas).
 */

import { TIPOS_TARJETA, TIPOS_TARJETA_ID, type TipoTarjeta } from "./tipos-tarjeta";

/** Lo que se ofrece hoy, de menor a mayor. */
export const PLANES_OFRECIDOS = ["prueba", "arranque", "impulso", "ilimitado"] as const;

/**
 * Planes de etapas anteriores: ya no se venden, pero siguen
 * resolviendo para quien los tiene. NUNCA se quitan mientras exista
 * una fila con ese valor.
 *
 * Los cuatro primeros son de la etapa 0124/0131; los cinco últimos, del
 * catálogo 0133 que la 0141 reemplazó por los tres paquetes de hoy.
 */
export const PLANES_RETIRADOS = [
  "gratis",
  "basico",
  "estandar",
  "enterprise",
  "esencial",
  "crece",
  "pro",
  "empresa",
] as const;

/**
 * OJO: agregar un plan acá pide también ampliar los CHECK de la base
 * (`ranchos.plan_lealtad`, `solicitudes_lealtad.plan` y `cuentas.plan`)
 * — la 0131 lo hizo para 'gratis', la 0133 para el catálogo anterior y
 * la 0141 para 'arranque', 'impulso' e 'ilimitado'.
 */
export const PLANES_ID = [...PLANES_OFRECIDOS, ...PLANES_RETIRADOS] as const;
export type PlanId = (typeof PLANES_ID)[number];

/**
 * Cada llave es una capacidad que se puede pedir con `puede()`.
 *
 * Los nombres describen lo que el NEGOCIO puede hacer, no la
 * implementación: cuando cambie cómo se dibuja el póster, el nombre
 * sigue sirviendo.
 *
 * ------------------------------------------------------------------
 * LA REGLA DE ESTA LISTA: SI NO EXISTE, NO SE LISTA
 * ------------------------------------------------------------------
 * Estas etiquetas son las viñetas que ve quien está por pagar —en la
 * landing, en /lealtad/planes, en el wizard de alta y en «Tu plan
 * actual»—. O sea que cada una es una PROMESA DE VENTA, no una nota
 * interna.
 *
 * Por eso la lista está partida en dos: arriba lo que un negocio puede
 * usar hoy, abajo lo que quedó de catálogos anteriores y NO tiene
 * producto detrás. Las de abajo siguen existiendo como tipo porque hay
 * paquetes RETIRADOS que las nombran y esos no se tocan — pero ningún
 * paquete que se ofrezca puede volver a usarlas. Hay una prueba que lo
 * hace cumplir.
 */
export type Capacidad =
  // ── Lo que existe de verdad ─────────────────────────────────────
  /** Tarjeta en Apple/Google Wallet con la marca del negocio.
   *  (src/lib/wallet: generar, google, firma, empaquetar) */
  | "wallet"
  /** Poder armar tarjetas de más de un tipo (0135). CUÁLES trae cada
   *  paquete lo dice `DefinicionPlan.tipos`, no esta capacidad: los
   *  cuatro pueden crear tarjetas, pero la Prueba solo sellos, puntos
   *  y cashback.
   *  El reparto lo hace cumplir el servidor en `crear-actions.ts`. */
  | "tipos_de_tarjeta"
  /** Reglas activables y vencimientos: desde cuándo vale, hasta
   *  cuándo, cuántas veces por día. (0136 + el paso «Reglas» del
   *  creador) */
  | "reglas_y_vencimientos"
  /** El dueño edita su propia tarjeta: color, logo, tipo de código,
   *  textos. (0122 + creador-tarjeta.tsx + seccion-tarjeta-digital) */
  | "personalizacion_tarjeta"
  /** Póster imprimible con el QR de afiliación, para pegar en la caja.
   *  (0132 + /lealtad/panel/[id]/poster) */
  | "poster_qr"
  /** Modo mostrador: la pantalla de acreditar y canjear pensada para
   *  el celular de quien atiende. (modo-mostrador.tsx) */
  | "modo_mostrador"
  /** El equipo con permisos finos por persona: acreditar, canjear,
   *  revertir, auditoría. (0127 permisos_lealtad + 0134
   *  cuentas_equipo) */
  | "equipo_con_permisos"
  /** Métricas del programa: altas por semana, activos, sellos y
   *  canjes de 30 días contra los 30 anteriores, ritmo y proyección.
   *  (metricas.tsx) */
  | "analitica"
  /** Que el pase aparezca solo en la pantalla bloqueada cuando el
   *  cliente pasa cerca del local. Es nativo de Wallet y lo enciende
   *  `generar.ts` con `puede()`.
   *
   *  Va SOLO en Ilimitado — y se sigue regalando con el complemento
   *  suelto `pases_cercania` (0123), que es como se vendía hasta hoy:
   *  meterla en un paquete no le puede quitar lo comprado a quien ya
   *  pagó el complemento. `puede()` acepta las dos puertas.
   *
   *  SOLO EN iPHONE, y la etiqueta lo dice: `google.ts` no escribe
   *  `locations` en el objeto, así que en Android el aviso no sale. */
  | "cercania"
  /** El equipo de Bookea diseña la tarjeta a mano, en vez de salir de
   *  la plantilla del creador. Es la única capacidad de SERVICIO que se
   *  lista, y se lista porque tiene camino en el producto: la 0130 le
   *  da su propio flujo (`solicitudes_lealtad.personalizado` + el
   *  mensaje con el diseño soñado), el wizard su propia salida, y
   *  /admin/complementos su propia bandeja. */
  | "diseno_a_medida"

  // ── Heredadas: SIN PRODUCTO DETRÁS ──────────────────────────────
  // Viven acá para que los paquetes RETIRADOS sigan resolviendo tal
  // cual estaban. Ningún paquete ofrecido las puede usar: no hay tabla,
  // ni endpoint, ni pantalla que las cumpla, y venderlas sería cobrar
  // por algo que no se puede entregar. Auditado antes de la 0141.
  /** SIN PRODUCTO. El push de Wallet existe pero es SILENCIOSO: sirve
   *  para refrescar el pase, no para que el negocio mande un mensaje.
   *  No hay pantalla ni acción para redactar y enviar nada. */
  | "notificaciones"
  /** SIN PRODUCTO. No hay cohortes ni rendimiento por programa. */
  | "analitica_avanzada"
  /** SIN PRODUCTO. No hay segmentos de lealtad (lo de `crm-citas.ts`
   *  es del módulo de Citas y no toca los pases). */
  | "segmentacion"
  /** SIN PRODUCTO. Cero código y cero tablas. */
  | "campanas_programadas"
  /** SIN PRODUCTO. No hay webhooks salientes. */
  | "webhooks"
  /** SIN PRODUCTO. No hay API para el negocio. */
  | "api"
  /** SIN PRODUCTO. No hay exportación de datos del programa. */
  | "exportacion"
  /** SIN PRODUCTO. No hay integración con ningún punto de venta. */
  | "pos"
  /** SIN PRODUCTO como escalón de plan: los permisos por colaborador
   *  existen (ver `equipo_con_permisos`) pero los tiene TODO el mundo,
   *  así que cobrarlos aparte sería un escalón inventado. */
  | "roles_avanzados"
  /** SIN PRODUCTO. No existe multi-marca ni franquicias. */
  | "franquicias"
  /** SIN PRODUCTO. No hay acuerdo de nivel de servicio escrito. */
  | "sla"
  /** SIN PRODUCTO. El pase siempre apunta a `${SITIO_URL}/api/wallet`,
   *  el póster lleva marca Bookea y el correo sale de la infra
   *  compartida: no hay dominio propio ni remitente configurable. */
  | "marca_blanca"
  /** SIN PRODUCTO como viñeta vendible. Que el equipo atienda bien no
   *  es una función del plan, y escribirlo como si lo fuera convierte
   *  una cortesía en una obligación contractual sin nada que la
   *  sostenga. El acompañamiento que SÍ tiene forma de producto se
   *  vende como `diseno_a_medida`. */
  | "soporte_dedicado";

/**
 * Las capacidades que NINGÚN paquete ofrecido puede prometer, porque no
 * hay nada que las cumpla.
 *
 * Se declara como dato y no como comentario para que una prueba la
 * pueda recorrer: el día que alguien agregue `webhooks` al paquete de
 * $89 porque «suena bien», la suite lo frena antes que el cliente.
 *
 * Sacar algo de esta lista es la señal de que se construyó: ese día se
 * mueve para arriba en `Capacidad` y recién ahí se puede vender.
 */
export const CAPACIDADES_SIN_PRODUCTO: readonly Capacidad[] = [
  "notificaciones",
  "analitica_avanzada",
  "segmentacion",
  "campanas_programadas",
  "webhooks",
  "api",
  "exportacion",
  "pos",
  "roles_avanzados",
  "franquicias",
  "sla",
  "marca_blanca",
  "soporte_dedicado",
];

/**
 * Los topes del plan. `null` = sin tope.
 *
 * Se guardan como números y no como texto porque el servidor los HACE
 * CUMPLIR: son la diferencia entre un tope real y uno decorativo.
 *
 * ------------------------------------------------------------------
 * CUÁLES SE EXIGEN DE VERDAD, HOY
 * ------------------------------------------------------------------
 * TRES de los seis: `clientesActivos`, `programas` y `administradores`
 * (este último desde el reparto de la 0142). Los otros tres se dejan
 * escritos porque el tipo los pide y porque los paquetes retirados los
 * usan, pero están puestos en el valor que NO promete nada (ver cada
 * campo).
 */
export type LimitesPlan = {
  /**
   * Personas con al menos un pase VIGENTE en el periodo.
   *
   * SE EXIGE, en la puerta de Wallet: `src/lib/wallet/generar.ts`
   * (Apple) y `src/lib/wallet/google.ts` (Google) preguntan antes de
   * insertar en `miembros` y devuelven «el programa está lleno».
   *
   * SE CUENTA POR CUENTA, no por tarjeta (0142). Antes se contaba por
   * `programa_id`, y eso hacía que cada tarjeta nueva regalara un cupo
   * entero: un paquete de 200 con dos tarjetas afiliaba 400. Por eso
   * los paquetes de pago iban con UNA tarjeta — un candado puesto para
   * tapar ese agujero. Con el conteo arreglado (`personasActivasDe`,
   * src/lib/lealtad/cupo.ts) el escalón de tarjetas ya no toca el cupo,
   * y por eso Arranque puede tener 2 e Impulso 5 sin regalar nada.
   *
   * La definición importa y es deliberada:
   *   · varias tarjetas de la misma persona = UN cliente;
   *   · Apple Wallet y Google Wallet del mismo pase NO duplican;
   *   · las membresías pausadas y canceladas NO ocupan lugar;
   *   · los contactos del CRM son ilimitados — esto cuenta PASES, no
   *     agenda de contactos.
   */
  clientesActivos: number | null;
  /**
   * Programas (tarjetas) publicables a la vez.
   *
   * SE EXIGE en `crear-actions.ts`: cuenta los no archivados de la
   * cuenta y rebota con un mensaje que dice qué hacer.
   */
  programas: number | null;
  /**
   * TOPE DECLARADO, SIN PRODUCTO DETRÁS. No hay forma de que un
   * negocio mande una notificación: el push de Wallet es silencioso y
   * solo refresca el pase. Va en 0 en todo el catálogo de hoy —
   * inventar una bolsa de 1.000 envíos sería vender un envío que nadie
   * puede hacer. El día que exista el envío, acá van los números.
   */
  notificacionesMes: number | null;
  /**
   * Personas del equipo con acceso al panel de Lealtad — los «PINs de
   * staff» del competidor. INCLUYE AL DUEÑO: por eso la Prueba va en 1
   * (el dueño y nadie más) y no en 0.
   *
   * SE EXIGE desde el reparto de la 0142, en `equipo-actions.ts`
   * (`invitarAlEquipo`): cuenta los colaboradores del negocio, le suma
   * el dueño y rebota con un mensaje que dice qué hacer. Estuvo
   * declarado y sin exigir desde la 0133, que es exactamente lo que
   * este archivo se pasó una etapa entera limpiando; ahora que el
   * paquete lo VENDE (1 / 3 / 10 / sin tope), tenía que ser real.
   *
   * Nunca quita a nadie que ya esté: bajar de paquete no expulsa
   * colaboradores, solo frena las invitaciones nuevas.
   */
  administradores: number | null;
  /**
   * TOPE DECLARADO, SIN MODELO DE DATOS. No existe tabla de sedes ni
   * sucursales en ninguna de las migraciones. Va en 1 —que es lo que
   * hoy es cada negocio— en vez de escalar 1/3/10: un escalón de
   * sucursales sobre algo que no existe es la promesa más cara de
   * todas.
   */
  sedes: number | null;
  /**
   * TOPE DECLARADO, SIN PRODUCTO DETRÁS. Cero código y cero tablas.
   * Va en 0 en todo el catálogo de hoy.
   */
  automatizaciones: number | null;
};

export type DefinicionPlan = {
  id: PlanId;
  nombre: string;
  /** Para quién es, en una línea. */
  descripcion: string;
  /** Dólares por mes. null = precio a convenir. */
  precioMensual: number | null;
  /** Dólares por año. null = no se vende anual (o es a convenir). */
  precioAnual: number | null;
  limites: LimitesPlan;
  capacidades: readonly Capacidad[];
  /**
   * Qué CLASES de tarjeta trae el paquete. `null` = las ocho.
   *
   * Es una lista y no un número a propósito: el escalón no es «cuántos
   * tipos» sino CUÁLES, y un número obligaría a decidir el orden en la
   * pantalla —que es donde se desincronizaría—. `crear-actions.ts` lo
   * hace cumplir en el servidor; el selector del creador muestra los
   * que no entran BLOQUEADOS, con el paquete que los abre, porque
   * esconderlos hace que el dueño no sepa que existen.
   *
   * Los paquetes RETIRADOS van en `null`: tenían los ocho y no se le
   * quita lo comprado a nadie por un cambio de catálogo.
   */
  tipos: readonly TipoTarjeta[] | null;
  /** Días de prueba sin tarjeta. 0 = no es una prueba. */
  diasPrueba: number;
  /** false = retirado: resuelve para quien lo tiene, no se ofrece. */
  vigente: boolean;
};

/** Todo ilimitado — se repite en Empresa y en los planes retirados. */
const SIN_TOPES: LimitesPlan = {
  clientesActivos: null,
  programas: null,
  notificacionesMes: null,
  administradores: null,
  sedes: null,
  automatizaciones: null,
};

/**
 * Lo que traen los paquetes RETIRADOS. Congelada tal cual estaba.
 *
 * No se toca ni para sacarle `notificaciones` —que no existe— porque
 * un paquete retirado es historia: describe lo que se le vendió a
 * alguien, y reescribirlo cambia el registro de lo que esa persona
 * compró. Lo que sí se puede hacer es no volver a venderlo, y eso ya
 * está hecho: ningún paquete ofrecido usa esta lista.
 */
const BASE_RETIRADOS: readonly Capacidad[] = [
  "wallet",
  "tipos_de_tarjeta",
  "reglas_y_vencimientos",
  "notificaciones",
  "analitica",
];

/**
 * Lo que trae CUALQUIER paquete del catálogo de hoy, incluida la
 * prueba.
 *
 * Son ocho, y las ocho existen: hay un archivo, una tabla o una
 * pantalla detrás de cada una. Lo que se cobra es la ESCALA —cuánta
 * gente entra— no desbloquear una funcionalidad que ya está escrita.
 *
 * Que la lista sea generosa es a propósito y no un descuido: si el
 * negocio de $12 y el de $89 corren el mismo código, el catálogo tiene
 * que decirlo. La alternativa —repartir estas ocho en escalones— sería
 * inventar candados que el código no tiene, y el cliente de $12 los
 * descubriría abiertos el primer día.
 *
 * ------------------------------------------------------------------
 * POR QUÉ LAS OCHO VAN EN LOS CUATRO PAQUETES
 * ------------------------------------------------------------------
 * Porque las ocho son la BASE DEL PRODUCTO: el negocio de $12 y el de
 * $89 corren el mismo código, y el catálogo tiene que decirlo.
 *
 * El catálogo anterior fingía lo contrario: «Crece» ($27) sumaba
 * cuatro capacidades sobre «Esencial» ($9) —segmentación, campañas,
 * analítica avanzada, webhooks— y las cuatro tenían cero código. Quien
 * pagaba el triple recibía exactamente lo mismo. Repetir ese reparto
 * con nombres nuevos habría repetido el problema.
 *
 * Lo que SÍ escalona el reparto de la 0142 son los números —clientes,
 * tarjetas, tipos, equipo— más las dos capacidades reales que sobraban,
 * y las dos van juntas en el paquete de arriba:
 *
 *   · `cercania` — `generar.ts` la consulta con `puede()`. Se sigue
 *     regalando con el complemento suelto `pases_cercania` (0123) para
 *     quien ya lo compró: un paquete nuevo no le quita lo pagado a
 *     nadie;
 *   · `diseno_a_medida` — el camino «personalizado» de la 0130.
 *
 * Lo que no se puede es agregar algo de `CAPACIDADES_SIN_PRODUCTO`:
 * hay una prueba que lo frena.
 */
const INCLUIDO_SIEMPRE: readonly Capacidad[] = [
  "wallet",
  "tipos_de_tarjeta",
  "personalizacion_tarjeta",
  "reglas_y_vencimientos",
  "poster_qr",
  "modo_mostrador",
  "equipo_con_permisos",
  "analitica",
];

/**
 * Cada plan INCLUYE lo del anterior. Se escriben completos igual, en
 * vez de heredar en cadena: una lista explícita se lee de un vistazo y
 * no obliga a seguir tres saltos para saber si Pro trae webhooks.
 */
export const PLANES: Record<PlanId, DefinicionPlan> = {
  prueba: {
    id: "prueba",
    nombre: "Prueba",
    descripcion: "14 días para armar tu primera tarjeta, sin tarjeta de crédito.",
    // ⚠️ ESTE CERO SOSTIENE EL ALTA AUTOMÁTICA.
    // `/lealtad/nuevo/actions.ts` decide con `precioMensual === 0` si
    // el negocio se crea al instante o si cae al camino manual con
    // comprobante. Si algún día el catálogo se queda sin ningún plan a
    // $0, `crearGratisAlInstante` deja de dispararse y TODO el mundo
    // termina esperando a que una persona revise un depósito.
    precioMensual: 0,
    precioAnual: null,
    limites: {
      clientesActivos: 25,
      // UN programa, y es la regla del dueño: «si el plan es gratis
      // todo es automático, y solo permite crear UN pase». No se
      // cumple con un `if` en una pantalla — se cumple con este 1, que
      // `crear-actions.ts` hace valer. Hay una prueba que impide que
      // un plan sin costo quede con programas ilimitados.
      programas: 1,
      notificacionesMes: 0,
      // El dueño y nadie más: `administradores` cuenta al dueño.
      administradores: 1,
      sedes: 1,
      automatizaciones: 0,
    },
    capacidades: INCLUIDO_SIEMPRE,
    // Los tres tipos con los que se entiende el producto en cinco
    // minutos, y los que más se usan en el país: sellos y puntos para
    // fidelizar, cashback para devolver plata. Los otros cinco se
    // muestran bloqueados en el creador, no escondidos: enterarse de
    // que existen es parte de la razón para pagar.
    tipos: ["sellos", "puntos", "cashback"],
    diasPrueba: 14,
    vigente: true,
  },
  arranque: {
    id: "arranque",
    nombre: "Arranque",
    descripcion: "Para el local que pone su primera tarjeta a rodar.",
    precioMensual: 12,
    // Dos meses de regalo: 12 × 12 = 144, y el anual sale 120.
    precioAnual: 120,
    limites: {
      clientesActivos: 200,
      // DOS tarjetas. Antes iba en 1, y no por tacañería: el cupo de
      // clientes se contaba POR PROGRAMA, así que un segundo programa
      // duplicaba en silencio los 200 que se cobran. Con el conteo por
      // cuenta de la 0142 eso ya no pasa —los 200 son 200 sumando las
      // dos— y el escalón puede ser lo que el dueño aprobó.
      programas: 2,
      notificacionesMes: 0,
      administradores: 3,
      sedes: 1,
      automatizaciones: 0,
    },
    capacidades: INCLUIDO_SIEMPRE,
    // Los tres de la Prueba más los dos que un local de barrio pide
    // primero: un cupón puntual y un descuento.
    tipos: ["sellos", "puntos", "cashback", "cupon", "descuento"],
    diasPrueba: 0,
    vigente: true,
  },
  impulso: {
    id: "impulso",
    nombre: "Impulso",
    descripcion: "Para el que ya tiene clientela y quiere hacerla volver.",
    precioMensual: 42,
    precioAnual: 420,
    limites: {
      clientesActivos: 1_150,
      programas: 5,
      notificacionesMes: 0,
      administradores: 10,
      sedes: 1,
      automatizaciones: 0,
    },
    capacidades: INCLUIDO_SIEMPRE,
    // Los ocho: membresía, gift card y evento entran acá.
    tipos: null,
    diasPrueba: 0,
    vigente: true,
  },
  ilimitado: {
    id: "ilimitado",
    nombre: "Ilimitado",
    descripcion: "Sin techo de clientes ni de tarjetas, y el diseño lo hacemos nosotros.",
    precioMensual: 89,
    precioAnual: 890,
    limites: {
      clientesActivos: null,
      programas: null,
      notificacionesMes: 0,
      administradores: null,
      sedes: 1,
      automatizaciones: 0,
    },
    // Las dos capacidades reales que quedaban sin repartir. `cercania`
    // se sigue vendiendo suelta como complemento (0123) para quien ya
    // la compró: `puede()` acepta las dos puertas, así que subirla al
    // paquete no le apaga el aviso a nadie.
    capacidades: [...INCLUIDO_SIEMPRE, "cercania", "diseno_a_medida"],
    tipos: null,
    diasPrueba: 0,
    vigente: true,
  },

  // ── Retirados ─────────────────────────────────────────────────────
  // Existen para que las cuentas que ya los tienen sigan funcionando.
  // Sin topes: bajarle el tope a alguien que ya pagó por un cambio de
  // catálogo sería quitarle lo comprado.
  //
  // Y sin tocarles las capacidades tampoco, aunque varias de esas
  // viñetas no tengan producto: lo que se les vendió es lo que dice
  // acá, y reescribirlo borra el registro de la venta. Lo que se
  // arregla hacia adelante es no volver a ofrecerlas.
  //
  // `tipos: null` en los ocho: tenían los ocho tipos de tarjeta desde
  // la 0135 y el reparto de la 0142 no se los quita. Un negocio que
  // hoy corre con «Básico» no se puede quedar sin poder editar su
  // tarjeta de gift card por un cambio de catálogo.
  esencial: {
    id: "esencial",
    nombre: "Esencial",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: 9,
    precioAnual: 90,
    limites: SIN_TOPES,
    capacidades: BASE_RETIRADOS,
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
  crece: {
    id: "crece",
    nombre: "Crece",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: 27,
    precioAnual: 270,
    limites: SIN_TOPES,
    capacidades: [
      ...BASE_RETIRADOS,
      "segmentacion",
      "campanas_programadas",
      "analitica_avanzada",
      "webhooks",
    ],
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: 69,
    precioAnual: 690,
    limites: SIN_TOPES,
    capacidades: [
      ...BASE_RETIRADOS,
      "segmentacion",
      "campanas_programadas",
      "analitica_avanzada",
      "webhooks",
      "api",
      "exportacion",
      "pos",
      "roles_avanzados",
      "cercania",
    ],
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
  empresa: {
    id: "empresa",
    nombre: "Empresa",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    // A convenir: era el tramo que se cotizaba caso por caso. Sin
    // cifra, /admin/finanzas no le inventa un monto esperado — que es
    // lo correcto para un precio negociado.
    precioMensual: null,
    precioAnual: null,
    limites: SIN_TOPES,
    capacidades: [
      ...BASE_RETIRADOS,
      "segmentacion",
      "campanas_programadas",
      "analitica_avanzada",
      "webhooks",
      "api",
      "exportacion",
      "pos",
      "roles_avanzados",
      "franquicias",
      "sla",
      "marca_blanca",
      "soporte_dedicado",
      "cercania",
    ],
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: 0,
    precioAnual: null,
    limites: { ...SIN_TOPES, clientesActivos: 5 },
    capacidades: BASE_RETIRADOS,
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
  basico: {
    id: "basico",
    nombre: "Básico",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: null,
    precioAnual: null,
    limites: SIN_TOPES,
    capacidades: BASE_RETIRADOS,
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
  estandar: {
    id: "estandar",
    nombre: "Estándar",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: null,
    precioAnual: null,
    limites: SIN_TOPES,
    capacidades: [...BASE_RETIRADOS, "segmentacion", "analitica_avanzada"],
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
  enterprise: {
    id: "enterprise",
    nombre: "Enterprise",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: null,
    precioAnual: null,
    limites: SIN_TOPES,
    capacidades: [
      ...BASE_RETIRADOS,
      "segmentacion",
      "campanas_programadas",
      "analitica_avanzada",
      "webhooks",
      "api",
      "exportacion",
      "pos",
      "roles_avanzados",
    ],
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
};

/** Las definiciones que se ofrecen, en orden. */
export const PLANES_VIGENTES: readonly DefinicionPlan[] = PLANES_OFRECIDOS.map(
  (id) => PLANES[id],
);

/**
 * El paquete que se marca como «Más popular» en la grilla.
 *
 * El del medio, y no el más caro: trae los OCHO tipos de tarjeta y el
 * salto de cupo más grande del catálogo (200 → 1.150).
 */
export const PLAN_DESTACADO: PlanId = "impulso";

/**
 * Cómo se le cuenta cada capacidad a un dueño de negocio. Vive junto a
 * las capacidades para que agregar una NUEVA obligue a pensar su
 * etiqueta (TypeScript exige la llave) — una capacidad sin nombre
 * visible no se puede vender.
 */
export const ETIQUETAS_CAPACIDAD: Record<Capacidad, string> = {
  // ── Del catálogo de hoy ──────────────────────────────────────────
  wallet: "Pases en Apple Wallet y Google Wallet",
  // NEUTRA A PROPÓSITO. Desde el reparto de la 0142 cada paquete trae
  // un juego distinto de tipos, así que «Los ocho tipos de tarjeta»
  // sería mentira en la Prueba y en Arranque. La viñeta que sí dice
  // cuáles la arma `etiquetaTiposDe()`, y `etiquetasDeCapacidades()`
  // la mete en el lugar de esta.
  tipos_de_tarjeta: "Tipos de tarjeta según tu paquete",
  personalizacion_tarjeta: "Tu color, tu logo y tus textos en la tarjeta",
  reglas_y_vencimientos: "Reglas, límites y vencimientos",
  poster_qr: "Póster con tu QR, listo para imprimir",
  modo_mostrador: "Modo mostrador para sellar y canjear",
  equipo_con_permisos: "Tu equipo, con permisos por persona",
  analitica: "Métricas: altas, activos, sellos y canjes",
  // El «(en iPhone)» no es letra chica: `google.ts` no escribe
  // ubicaciones en el objeto, así que en Android el aviso no sale.
  // Prometerlo entero sería vender medio producto.
  cercania: "El pase aparece solo cerca de tu local (en iPhone)",
  diseno_a_medida: "Te diseñamos la tarjeta a mano",

  // ── Solo en paquetes retirados ───────────────────────────────────
  // Nadie las puede comprar hoy. Se conservan para que «Tu plan
  // actual» siga pudiendo escribir lo que en su momento se vendió.
  notificaciones: "Notificaciones al pase del cliente",
  analitica_avanzada: "Analítica avanzada",
  segmentacion: "Segmentación de clientes",
  campanas_programadas: "Campañas programadas",
  webhooks: "Webhooks",
  api: "Acceso por API",
  exportacion: "Exportación de datos",
  pos: "Integración con tu punto de venta",
  roles_avanzados: "Roles y permisos avanzados",
  franquicias: "Franquicias y multi-marca",
  sla: "Acuerdo de nivel de servicio",
  marca_blanca: "Marca blanca",
  soporte_dedicado: "Soporte dedicado",
};

/**
 * Cómo se le cuenta cada tope. Mismo criterio que las capacidades.
 *
 * Hoy ninguna pantalla las usa —la UI solo pinta `clientesActivos` con
 * su propio texto— y está bien que así sea mientras cuatro de los seis
 * topes no se hagan cumplir. Existen para que agregar un tope NUEVO
 * obligue a pensar cómo se le cuenta a un dueño de negocio.
 */
export const ETIQUETAS_LIMITE: Record<keyof LimitesPlan, string> = {
  clientesActivos: "Clientes activos",
  programas: "Tarjetas",
  notificacionesMes: "Notificaciones por mes",
  administradores: "Gente del equipo",
  sedes: "Sedes",
  automatizaciones: "Automatizaciones",
};

export function esPlan(valor: string | null): valor is PlanId {
  return valor !== null && (PLANES_ID as readonly string[]).includes(valor);
}

/**
 * ¿Este paquete se puede ELEGIR hoy?
 *
 * ------------------------------------------------------------------
 * LA DIFERENCIA CON `esPlan` NO ES COSMÉTICA: ES LA PUERTA
 * ------------------------------------------------------------------
 * `esPlan` contesta «¿la base puede tener esto GUARDADO?», y por eso
 * incluye los retirados — tiene que incluirlos, o las cuentas que ya
 * los tienen se quedarían sin plan. Esta contesta otra cosa: «¿alguien
 * puede PEDIR esto ahora?».
 *
 * Validar un alta con `esPlan` fue un agujero real. El formulario solo
 * ofrece los cuatro vigentes, pero una petición armada a mano con
 * `plan: "gratis"` pasaba la validación, y `gratis` lleva `SIN_TOPES` a
 * propósito (a quien ya lo tenía no se le quita nada). O sea que ELEGIR
 * un paquete retirado regalaba tarjetas ilimitadas, equipo ilimitado y
 * los ocho tipos —incluidos los que solo trae el de $42— sin pagar un
 * colón. El descuido más caro de este archivo salía de confundir «lo
 * que la base acepta» con «lo que se vende».
 *
 * Lo que esta función NO toca: `definicionDe`, `puede`,
 * `estadoDelLimite` y `tiposDelPlan` siguen resolviendo con `esPlan`, o
 * sea que un negocio con «Básico» sigue funcionando exactamente igual.
 * Lo único que se corta es elegir uno NUEVO.
 *
 * Se decide con `vigente` y no con `PLANES_OFRECIDOS.includes` para que
 * haya UNA sola verdad: el día que un paquete se retire alcanza con
 * poner `vigente: false` y esta puerta se cierra sola. (Hay una prueba
 * que exige que las dos listas digan lo mismo.)
 */
export function esPlanOfrecido(valor: string | null): valor is PlanId {
  return esPlan(valor) && PLANES[valor].vigente;
}

/**
 * ¿Este paquete se contrata SIN PAGAR nada?
 *
 * Es la pregunta que decide si un alta salta el depósito y se crea al
 * instante, así que tiene que ser más estricta que «precioMensual === 0»:
 * el paquete RETIRADO `gratis` también cuesta $0, y con esa comparación
 * suelta el camino automático le creaba a cualquiera un negocio con
 * `plan_lealtad: 'gratis'`, o sea sin un solo tope.
 *
 * Hoy el único que contesta que sí es `prueba` — y por eso VENCE
 * (ver `finDePrueba` en ./prueba.ts). Un plan sin costo que no vence no
 * es una prueba: es un regalo permanente.
 */
export function esPlanSinCosto(plan: string | null): boolean {
  return esPlanOfrecido(plan) && PLANES[plan].precioMensual === 0;
}

export function definicionDe(plan: string | null): DefinicionPlan | null {
  return esPlan(plan) ? PLANES[plan] : null;
}

/**
 * El precio, escrito para mostrar. Sale UNA sola función para que
 * ninguna pantalla decida por su cuenta cómo se escribe un monto.
 *
 * Los planes de Lealtad están en DÓLARES por decisión del dueño
 * (2026-08-12). El depósito se sigue haciendo por SINPE en colones: el
 * monto exacto lo confirma Bookea al tipo de cambio del día, y por eso
 * no se convierte acá — inventar un tipo de cambio en el código sería
 * cobrar mal.
 *
 * null = "a convenir": el que llama decide cómo lo dice.
 */
export function precioDe(def: DefinicionPlan, periodo: "mes" | "año" = "mes"): string | null {
  const monto = periodo === "año" ? def.precioAnual : def.precioMensual;
  if (monto === null) return null;
  if (monto === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    // Los precios son enteros ($12, $42, $89): pedir dos decimales
    // pintaría "$12.00", que se lee como un formulario y no un precio.
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(monto);
}

/**
 * Cuánto se ahorra pagando por año, en meses. El copy dice «Ahorrá 2
 * meses» y ese 2 sale de acá, no de un texto escrito a mano que se
 * desincroniza el día que cambie un precio.
 */
export function mesesDeAhorroAnual(def: DefinicionPlan): number {
  if (!def.precioMensual || !def.precioAnual) return 0;
  const ahorro = def.precioMensual * 12 - def.precioAnual;
  return Math.round(ahorro / def.precioMensual);
}

/**
 * ¿Esta cuenta puede usar esta capacidad?
 *
 * La trae el plan O la regala un complemento suelto. Nunca al revés:
 * un complemento no puede QUITAR algo que el plan incluye, porque
 * quitar no es lo que un complemento hace — y si pudiera, apagar un
 * add-on por error degradaría a un cliente que pagó el plan alto.
 */
export function puede(
  plan: string | null,
  capacidad: Capacidad,
  addonsRegalados: readonly string[] = [],
): boolean {
  const def = definicionDe(plan);
  if (def?.capacidades.includes(capacidad)) return true;
  // Convención: el complemento que regala una capacidad se llama
  // `pases_<capacidad>` (ej. `pases_cercania`, 0123).
  return addonsRegalados.includes(`pases_${capacidad}`);
}

// ── Los tipos de tarjeta que trae cada paquete ────────────────────

/**
 * Qué clases de tarjeta puede armar esta cuenta.
 *
 * SIN PLAN devuelve los ocho, y es deliberado: es la misma doctrina que
 * `estadoDelLimite` —sin definición no hay tope declarado— y sobre todo
 * es lo que evita que un negocio sin paquete asignado se quede sin
 * poder tocar la tarjeta que ya tiene. Bloquear con plan desconocido
 * castiga al que no hizo nada.
 */
export function tiposDelPlan(plan: string | null): readonly TipoTarjeta[] {
  const def = definicionDe(plan);
  if (!def) return TIPOS_TARJETA_ID;
  return def.tipos ?? TIPOS_TARJETA_ID;
}

/** ¿Este paquete arma tarjetas de este tipo? Lo pregunta el servidor. */
export function planIncluyeTipo(plan: string | null, tipo: TipoTarjeta): boolean {
  return tiposDelPlan(plan).includes(tipo);
}

/**
 * El paquete MÁS BARATO que trae ese tipo, para poder decir «esto se
 * desbloquea con Impulso» en vez de un «no podés» a secas.
 *
 * Recorre `PLANES_OFRECIDOS`, que está de menor a mayor.
 */
export function planQueDesbloquea(tipo: TipoTarjeta): DefinicionPlan | null {
  for (const id of PLANES_OFRECIDOS) {
    if (planIncluyeTipo(id, tipo)) return PLANES[id];
  }
  return null;
}

/** «sellos, puntos y cashback» — con la «y» donde va. */
function enLista(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/**
 * Cómo se le cuenta a un dueño de negocio qué tipos trae su paquete.
 *
 * Se calcula y no se escribe a mano porque el reparto está en
 * `DefinicionPlan.tipos`: una frase escrita aparte se desincroniza el
 * día que se mueva un tipo de escalón, y esa frase es una promesa de
 * venta.
 */
export function etiquetaTiposDe(def: DefinicionPlan): string {
  if (def.tipos === null) return `Los ${TIPOS_TARJETA_ID.length} tipos de tarjeta`;
  const nombres = def.tipos.map((t) => TIPOS_TARJETA[t].nombre.toLowerCase());
  if (def.tipos.length <= 2) return `Tarjetas de ${enLista(nombres)}`;
  return `${def.tipos.length} tipos de tarjeta: ${enLista(nombres)}`;
}

/**
 * Las viñetas de un paquete, listas para pintar.
 *
 * Es `ETIQUETAS_CAPACIDAD` con UNA sustitución: la de los tipos, que
 * depende del paquete. Existe para que ninguna pantalla tenga que
 * acordarse de esa excepción — la olvidan todas menos la última que se
 * tocó.
 */
export function etiquetasDeCapacidades(def: DefinicionPlan): string[] {
  return def.capacidades.map((c) =>
    c === "tipos_de_tarjeta" ? etiquetaTiposDe(def) : ETIQUETAS_CAPACIDAD[c],
  );
}

export type EstadoLimite = {
  usado: number;
  limite: number | null;
  /** Cuántos caben todavía. null = sin tope. */
  disponibles: number | null;
  /** Ya no entran más. */
  lleno: boolean;
  /** Pasó el 80%: hay que avisar antes de que se tope. */
  cerca: boolean;
  /** 0..100. 0 cuando no hay tope. */
  porcentaje: number;
};

/**
 * Cómo va la cuenta contra un tope de su plan.
 *
 * El tope NO se guarda en la fila de la cuenta: sale de la definición
 * del plan, y lo usado se cuenta. Guardarlo crearía un número que hay
 * que actualizar en cada cambio de plan y que se desincroniza.
 *
 * El aviso salta al 80% —no al 95%— porque enterarse cuando ya casi no
 * entra nadie no deja tiempo de decidir nada.
 */
export function estadoDelLimite(
  plan: string | null,
  cual: keyof LimitesPlan,
  usado: number,
): EstadoLimite {
  const limite = definicionDe(plan)?.limites[cual] ?? null;

  if (limite === null) {
    return { usado, limite: null, disponibles: null, lleno: false, cerca: false, porcentaje: 0 };
  }

  return {
    usado,
    limite,
    disponibles: Math.max(0, limite - usado),
    lleno: usado >= limite,
    cerca: usado >= limite * 0.8,
    porcentaje: Math.min(100, Math.round((usado / limite) * 100)),
  };
}
