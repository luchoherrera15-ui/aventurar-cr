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
 *   Prueba $0         5         1      3       1  — (no vence)
 *   Arranque $12    200         2      5       3  —
 *   Impulso $42   1.150         5      8      10  —
 *   Ilimitado $89     ∞         ∞      8       ∞  cercanía + diseño
 *
 * (La fila de Prueba decía «25 · 2 tipos · 14 días» y las tres cifras
 * estaban vencidas: el dueño la bajó a 5 clientes y le quitó el
 * vencimiento, y los tipos son tres. Las de verdad están abajo, en las
 * definiciones, y hay pruebas sobre cada una.)
 *
 * Todo lo demás —wallet, personalización, reglas y vencimientos,
 * póster y QR, modo mostrador, equipo con permisos, analítica y poder
 * mandar notificaciones— va en LOS CUATRO: es la base del producto, no
 * un escalón. Lo que SÍ escalona es el CUPO de notificaciones (1/1/20/50,
 * 0183) y, desde Impulso, la proyección de crecimiento sobre esa
 * analítica (`proyeccion_metricas`).
 *
 * Lo que se reparte es lo que el código SABE hacer cumplir: el cupo de
 * clientes (las dos puertas de Wallet, vía `personasActivasDe`), las
 * tarjetas (`crear-actions.ts`), los tipos (`crear-actions.ts` y
 * `pases-actions.ts`), el equipo (`equipo-actions.ts`), las
 * notificaciones (`enviarNotificacionPromocional`, 0183) y `cercania`
 * (`generar.ts`). Un escalón que no se hace cumplir es decoración, y
 * este archivo ya vivió esa etapa una vez.
 *
 * Prueba se queda aunque los tres de pago sean el producto: el alta
 * automática de `/lealtad/nuevo` se dispara con `precioMensual === 0`.
 * Un catálogo sin ningún plan a $0 apaga ese camino y manda a todo el
 * mundo al flujo manual con comprobante.
 *
 * ------------------------------------------------------------------
 * DOS LISTAS, Y LA DIFERENCIA IMPORTA (aunque hoy digan lo mismo)
 * ------------------------------------------------------------------
 * `PLANES_OFRECIDOS` es lo que se VENDE hoy. `PLANES_ID` es todo lo
 * que la base puede tener GUARDADO, o sea lo ofrecido MÁS lo retirado.
 *
 * HOY NO HAY NINGÚN RETIRADO y por eso las dos listas coinciden. Eso es
 * un estado, no una simplificación: la separación se queda entera
 * porque es la que hace que retirar un paquete mañana no le rompa el
 * programa a quien lo tiene puesto.
 *
 * La regla, que no cambia: un id que alguna fila TENGA GUARDADO no se
 * borra de acá nunca. Sacarlo haría que `definicionDe()` devolviera
 * null para esa cuenta, y con plan null TODOS los topes quedan en null
 * —o sea ilimitado y gratis—. Retirar mal un paquete no lo apaga: lo
 * vuelve infinito. Retirar bien es `vigente: false` y moverlo a
 * `PLANES_RETIRADOS`, que es justo para lo que esa lista existe.
 *
 * ------------------------------------------------------------------
 * POR QUÉ SE PUDIERON BORRAR LOS OCHO VIEJOS
 * ------------------------------------------------------------------
 * Había ocho paquetes retirados arrastrados de tres catálogos
 * anteriores ('esencial', 'crece', 'pro', 'empresa', 'gratis',
 * 'basico', 'estandar', 'enterprise'). Se borraron el 2026-08-17
 * DESPUÉS de comprobar en producción que las cuatro columnas que
 * guardan un plan —`ranchos.plan_lealtad`, `cuentas.plan`,
 * `solicitudes_lealtad.plan` y `suscripciones.plan`— no tenían UNA
 * SOLA fila con ninguno de esos ocho valores. Rancho Las Torres, que
 * era el caso que los sostenía con «Básico», dejó el módulo.
 *
 * Esa comprobación es la condición, no un trámite: mientras exista una
 * fila con un id, ese id se queda acá aunque nadie lo venda.
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
 * resolviendo para quien los tiene.
 *
 * ------------------------------------------------------------------
 * ESTÁ VACÍA, Y NO ES LO MISMO QUE NO EXISTIR
 * ------------------------------------------------------------------
 * Hoy no hay ninguno: los ocho que había se borraron cuando se
 * comprobó que ninguna fila de la base los tenía (ver la cabecera). La
 * lista se queda porque es LA MITAD DEL MECANISMO de retiro, y el
 * mecanismo sigue siendo la política correcta.
 *
 * Retirar un paquete, el día que toque, son tres movimientos y nada
 * más:
 *
 *   1. sacar su id de `PLANES_OFRECIDOS` y ponerlo acá — así sigue
 *      siendo un valor que la base puede tener guardado y
 *      `definicionDe()` lo sigue resolviendo;
 *   2. ponerle `vigente: false` a su definición — con eso
 *      `esPlanOfrecido()` cierra la puerta sola y deja de aparecer en
 *      toda grilla y en el catálogo público;
 *   3. dejarle los topes que tenía: bajárselos a quien ya pagó por un
 *      cambio de catálogo es quitarle lo comprado.
 *
 * Lo que NO hay que hacer nunca es borrarle la definición mientras una
 * fila lo tenga puesto. Eso no lo apaga: lo vuelve ilimitado y gratis.
 */
export const PLANES_RETIRADOS = [] as const;

/**
 * Todo lo que la base puede tener GUARDADO en una columna de plan.
 *
 * OJO: mover un id de una lista a la otra no cambia esta —los CHECK de
 * la base siguen aceptando lo mismo— pero AGREGAR o QUITAR un id acá
 * pide tocar las CUATRO restricciones de la base a la vez
 * (`ranchos.plan_lealtad`, `solicitudes_lealtad.plan`, `cuentas.plan`
 * y `suscripciones.plan`). La 0131 lo hizo para 'gratis', la 0133 para
 * el catálogo anterior, la 0141 para 'arranque', 'impulso' e
 * 'ilimitado', la 0143 para `suscripciones` y la 0179 las dejó en los
 * cuatro de hoy.
 *
 * `checks-de-planes.test.ts` compara esta lista contra los `.sql` de
 * verdad, en las dos direcciones, para que no se pueda olvidar.
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
 * producto detrás.
 *
 * ------------------------------------------------------------------
 * POR QUÉ LAS DE ABAJO SIGUEN DECLARADAS SI NADIE LAS USA
 * ------------------------------------------------------------------
 * Existían porque los paquetes RETIRADOS las nombraban. Esos paquetes
 * ya no están, y sin embargo estas doce se quedan: son la lista de lo
 * que NO SE PUEDE VENDER, y para que `CAPACIDADES_SIN_PRODUCTO` sea
 * una lista de verdad —recorrible por una prueba, y no un comentario—
 * el tipo tiene que poder NOMBRARLAS. ("notificaciones" se mudó arriba
 * en 2026-08: dejó de ser una de estas doce — ver la nota de cabecera.)
 *
 * Se ganó algo en el camino: hoy ningún paquete las usa, así que
 * `CAPACIDADES_SIN_PRODUCTO` describe exactamente lo mismo que este
 * bloque de abajo, y el filtro de `catalogo-publico.ts` no tiene nada
 * que sacar. Esa es la señal de que el catálogo está limpio, no de que
 * la lista sobre.
 *
 * ------------------------------------------------------------------
 * 2026-08 — "notificaciones" SE MUDÓ ARRIBA
 * ------------------------------------------------------------------
 * Vivía en este bloque con el comentario "SIN PRODUCTO: el push de
 * Wallet es silencioso, no hay pantalla ni acción para redactar y
 * enviar nada". Ya no es cierto: `enviarNotificacionPromocional`
 * (marketing-actions.ts) + `marketing-mensaje.tsx` mandan el mensaje de
 * verdad, con cupo real contado en `notificaciones_promocionales`
 * (0183). Por eso ahora son doce las que quedan sin producto, no trece.
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
  /** Métricas del programa: altas, activos, sellos y canjes de los
   *  últimos 30 días contra los 30 anteriores. Las CUATRO cifras van en
   *  los cuatro paquetes — lo que se reparte por escalón es la card de
   *  proyección, ver `proyeccion_metricas`. (metricas.tsx) */
  | "analitica"
  /** Notificación real al pase del cliente ("MIÉRCOLES MATCHAS 2X1"),
   *  con cupo por mes según el paquete (1/1/20/50).
   *  (`enviarNotificacionPromocional` en marketing-actions.ts, contra
   *  `notificaciones_promocionales`, 0183). Va en los CUATRO —lo que
   *  cambia por paquete es el número, no si se puede mandar algo, ver
   *  `LimitesPlan.notificacionesMes`. */
  | "notificaciones"
  /** La card "A este ritmo → Proyección" de `metricas.tsx`
   *  (`ritmoSemanal`/`proyeccion30`): cuántos clientes nuevos hace falta
   *  por semana para llegar a una meta en 30 días. Va SOLO en Impulso e
   *  Ilimitado — no confundir con `analitica`, que son las cuatro
   *  cifras básicas y esas sí van en los cuatro paquetes. */
  | "proyeccion_metricas"
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
  // NINGÚN paquete las usa, y ese es el punto: no hay tabla, ni
  // endpoint, ni pantalla que las cumpla, y venderlas sería cobrar por
  // algo que no se puede entregar. Auditado antes de la 0141.
  //
  // Se quedan declaradas para que `CAPACIDADES_SIN_PRODUCTO` las pueda
  // enumerar y las pruebas las puedan buscar en lo que sale a la calle.
  // Sacar una de acá es decir «esto se construyó», y hay que probarlo.
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
 *
 * Que hoy ningún paquete nombre ninguna de las doce no la vuelve
 * decorativa: es la lista que hace que agregarla siga siendo un error
 * atrapado por la suite, y el filtro de `catalogo-publico.ts` la vuelve
 * a aplicar en la última puerta antes de la red.
 */
export const CAPACIDADES_SIN_PRODUCTO: readonly Capacidad[] = [
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
 * CUATRO de los seis: `clientesActivos`, `programas` y `administradores`
 * (desde el reparto de la 0142) y `notificacionesMes` (desde la 0183,
 * contra `notificaciones_promocionales`). Los otros dos se dejan
 * escritos porque el tipo los pide, pero están puestos en el valor que
 * NO promete nada (ver cada campo).
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
   * SE EXIGE, por NEGOCIO y por mes calendario (no por tarjeta — la
   * misma lección de `clientesActivos`: un negocio de Impulso con 5
   * tarjetas mandaría 5×20=100 mensajes si se contara por tarjeta, no
   * 20; ver `cupo-notificaciones.ts`).
   *
   * Lo hace cumplir `enviarNotificacionPromocional`
   * (marketing-actions.ts) contra la tabla `notificaciones_promocionales`
   * (0183), ANTES de llamar a `enviarMensajePromocional`. `null` no es
   * un valor de este catálogo: los cuatro paquetes venden un número —
   * Prueba y Starter 1, Impulso 20, Ilimitado 50.
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
   * Un paquete que se RETIRE se queda con los tipos que tenía —o con
   * `null` si los tenía todos—: no se le quita lo comprado a nadie por
   * un cambio de catálogo.
   */
  tipos: readonly TipoTarjeta[] | null;
  /** Días de prueba sin tarjeta. 0 = no es una prueba. */
  diasPrueba: number;
  /** false = retirado: resuelve para quien lo tiene, no se ofrece. */
  vigente: boolean;
};

/**
 * Lo que trae CUALQUIER paquete del catálogo de hoy, incluida la
 * prueba.
 *
 * Son nueve, y las nueve existen: hay un archivo, una tabla o una
 * pantalla detrás de cada una. Lo que se cobra es la ESCALA —cuánta
 * gente entra, o cuántas notificaciones por mes— no desbloquear una
 * funcionalidad que ya está escrita.
 *
 * Que la lista sea generosa es a propósito y no un descuido: si el
 * negocio de $12 y el de $89 corren el mismo código, el catálogo tiene
 * que decirlo. La alternativa —repartir estas nueve en escalones— sería
 * inventar candados que el código no tiene, y el cliente de $12 los
 * descubriría abiertos el primer día.
 *
 * ------------------------------------------------------------------
 * POR QUÉ LAS NUEVE VAN EN LOS CUATRO PAQUETES
 * ------------------------------------------------------------------
 * Porque las nueve son la BASE DEL PRODUCTO: el negocio de $12 y el de
 * $89 corren el mismo código, y el catálogo tiene que decirlo.
 *
 * El catálogo anterior fingía lo contrario: «Crece» ($27) sumaba
 * cuatro capacidades sobre «Esencial» ($9) —segmentación, campañas,
 * analítica avanzada, webhooks— y las cuatro tenían cero código. Quien
 * pagaba el triple recibía exactamente lo mismo. Repetir ese reparto
 * con nombres nuevos habría repetido el problema.
 *
 * Lo que SÍ escalona el reparto de la 0142 (y de la 0183) son los
 * números —clientes, tarjetas, tipos, equipo, notificaciones— más tres
 * capacidades reales que no van en los cuatro:
 *
 *   · `proyeccion_metricas` — la card "A este ritmo → Proyección" de
 *     `metricas.tsx`. Va desde Impulso: las cuatro cifras básicas
 *     (`analitica`) se quedan en los cuatro, pero la proyección es del
 *     escalón de arriba;
 *   · `cercania` — `generar.ts` la consulta con `puede()`. Va SOLO en
 *     Ilimitado, y se sigue regalando con el complemento suelto
 *     `pases_cercania` (0123) para quien ya lo compró: un paquete nuevo
 *     no le quita lo pagado a nadie;
 *   · `diseno_a_medida` — el camino «personalizado» de la 0130. También
 *     SOLO en Ilimitado.
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
  "notificaciones",
];

/**
 * Cada plan INCLUYE lo del anterior. Se escriben completos igual, en
 * vez de heredar en cadena: una lista explícita se lee de un vistazo y
 * no obliga a seguir tres saltos para saber qué trae el de arriba.
 *
 * Son CUATRO y nada más: acá abajo vivían ocho paquetes retirados de
 * catálogos anteriores, y se fueron el día que la base dejó de tener
 * una sola fila con esos ids (ver la cabecera). El día que se retire
 * uno de estos cuatro, su definición se queda en este objeto con
 * `vigente: false` — lo que se retira es la VENTA, no la definición.
 */
export const PLANES: Record<PlanId, DefinicionPlan> = {
  prueba: {
    id: "prueba",
    nombre: "Prueba",
    descripcion: "Armá tu primera tarjeta y probala con clientes reales, sin tarjeta de crédito.",
    // ⚠️ ESTE CERO SOSTIENE EL ALTA AUTOMÁTICA.
    // `/lealtad/nuevo/actions.ts` decide con `precioMensual === 0` si
    // el negocio se crea al instante o si cae al camino manual con
    // comprobante. Si algún día el catálogo se queda sin ningún plan a
    // $0, `crearGratisAlInstante` deja de dispararse y TODO el mundo
    // termina esperando a que una persona revise un depósito.
    precioMensual: 0,
    precioAnual: null,
    limites: {
      // CINCO, y es el número que el dueño fijó: la Prueba alcanza para
      // ver el producto funcionando con clientes de verdad, no para
      // operar gratis. Estuvo en 25 y con eso una barbería chica podía
      // quedarse ahí sin pagar nunca.
      //
      // El tope NO es decorativo: lo hacen cumplir las tres puertas por
      // las que entra un cliente —el pase de Apple (generar.ts), el de
      // Google (google.ts) y el alta por QR sin cuenta (personas.ts)—,
      // las tres contra `personasActivasDe`, que cuenta PERSONAS de la
      // cuenta y no filas por tarjeta. Con el conteo viejo, cada tarjeta
      // nueva regalaba un cupo entero.
      clientesActivos: 5,
      // UN programa, y es la regla del dueño: «si el plan es gratis
      // todo es automático, y solo permite crear UN pase». No se
      // cumple con un `if` en una pantalla — se cumple con este 1, que
      // `crear-actions.ts` hace valer. Hay una prueba que impide que
      // un plan sin costo quede con programas ilimitados.
      programas: 1,
      // UNA notificación por mes calendario, y es del NEGOCIO, no de la
      // tarjeta (ver `LimitesPlan.notificacionesMes`). Mismo número que
      // Starter: el paquete gratis alcanza para probar el botón, no
      // para operar una campaña.
      notificacionesMes: 1,
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
    // ── CERO: EL PAQUETE GRATIS NO VENCE ────────────────────────────
    // Decisión del dueño. Estuvo en 14 y el corte lo hacía cumplir la
    // BASE, no un proceso nuestro: `finDePrueba()` escribía la fecha en
    // `addons_negocio.vence_en` al dar de alta, y `tiene_addon()` (0077)
    // la comparaba con `now()`.
    //
    // Con 0, `finDePrueba()` devuelve null y `null` en esa columna
    // significa «para siempre», así que las altas NUEVAS nacen sin
    // corte sin tocar nada más.
    //
    // ⚠️ LOS QUE YA ESTÁN NO SE ARREGLAN SOLOS: tienen la fecha escrita
    // en su fila de `addons_negocio` y la base la va a seguir haciendo
    // cumplir. Hay que limpiarla a mano — el SQL está en
    // docs/pegar-quitar-vencimiento-prueba.sql.
    diasPrueba: 0,
    vigente: true,
  },
  arranque: {
    // ⚠️ EL `id` SIGUE SIENDO "arranque" Y NO SE TOCA, aunque el nombre
    // visible ahora sea otro. Ese id está GUARDADO en la base
    // (`ranchos.plan_lealtad`, `cuentas.plan`, `solicitudes_lealtad.plan`)
    // y los tres tienen un CHECK que lo acepta. Renombrarlo dejaría a
    // los negocios que ya lo pagaron con un plan que el catálogo no
    // reconoce — y con plan desconocido TODOS los topes quedan en null,
    // o sea ilimitado y gratis. Lo que se muestra es `nombre`; lo que
    // se guarda es `id`, y son dos cosas distintas a propósito.
    id: "arranque",
    nombre: "Starter",
    descripcion: "Para el local que pone su primera tarjeta a rodar.",
    precioMensual: 12,
    // ── EL ANUAL ES 20% MENOS QUE PAGAR MES A MES ──────────────────
    // 12 × 12 = 144, menos 20% = 115,20 → se cobra 115.
    //
    // EL REDONDEO VA SIEMPRE HACIA ABAJO, y no es capricho: redondear
    // hacia arriba dejaría el descuento real por debajo del 20% que la
    // página promete. Anunciar 20% y cobrar 19,8% es exactamente la
    // clase de detalle que un cliente comprueba con la calculadora.
    // Así queda en 20,1%: se promete 20 y se da un poco más.
    //
    // Antes era «dos meses de regalo» (×10), que daba 16,7%.
    precioAnual: 115,
    limites: {
      clientesActivos: 100,
      // DOS tarjetas. Antes iba en 1, y no por tacañería: el cupo de
      // clientes se contaba POR PROGRAMA, así que un segundo programa
      // duplicaba en silencio los 100 que se cobran. Con el conteo por
      // cuenta de la 0142 eso ya no pasa —los 100 son 100 sumando las
      // dos— y el escalón puede ser lo que el dueño aprobó.
      programas: 2,
      // Mismo número que Prueba: un local recién arrancando manda un
      // aviso puntual, no una campaña seguida. El salto real está en
      // Impulso (20).
      notificacionesMes: 1,
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
    // 42 × 12 = 504, menos 20% = 403,20 → 400 (20,6%). Ver la nota del
    // redondeo en el paquete Arranque: siempre hacia abajo.
    precioAnual: 400,
    limites: {
      clientesActivos: 1_000,
      programas: 5,
      // VEINTE, el salto grande del catálogo: de un aviso puntual a
      // poder correr una campaña seguida en el mes.
      notificacionesMes: 20,
      administradores: 10,
      sedes: 1,
      automatizaciones: 0,
    },
    // `INCLUIDO_SIEMPRE` más la proyección de crecimiento: es el
    // primer paquete que la trae (ver `proyeccion_metricas`).
    capacidades: [...INCLUIDO_SIEMPRE, "proyeccion_metricas"],
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
    // 89 × 12 = 1068, menos 20% = 854,40 → 850 (20,4%). Mismo redondeo
    // hacia abajo que los otros dos.
    precioAnual: 850,
    limites: {
      clientesActivos: null,
      programas: null,
      // CINCUENTA. No es `null` (ilimitado de verdad) a propósito: un
      // negocio que manda más de 50 avisos promocionales al mes le está
      // llenando el pase de spam a su propio cliente, y eso no es un
      // límite técnico que valga la pena regalar.
      notificacionesMes: 50,
      administradores: null,
      sedes: 1,
      automatizaciones: 0,
    },
    // `INCLUIDO_SIEMPRE` más `proyeccion_metricas` (que ya trae Impulso,
    // ver ese objeto) más las dos capacidades reales que quedaban sin
    // repartir. `cercania` se sigue vendiendo suelta como complemento
    // (0123) para quien ya la compró: `puede()` acepta las dos puertas,
    // así que subirla al paquete no le apaga el aviso a nadie.
    capacidades: [...INCLUIDO_SIEMPRE, "proyeccion_metricas", "cercania", "diseno_a_medida"],
    tipos: null,
    diasPrueba: 0,
    vigente: true,
  },
};

/**
 * Las definiciones que se ofrecen, en orden.
 *
 * Es el FILTRO por el que pasa todo lo que se muestra y todo lo que se
 * publica, y por eso no se borra aunque hoy no filtre nada: el día que
 * un paquete se retire, esta lista es la que hace que deje de aparecer
 * sin tener que buscar dónde más se pintaba.
 */
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
  // NEUTRA A PROPÓSITO, mismo criterio que `tipos_de_tarjeta`: el
  // número real (1/1/20/50) depende del paquete, así que un texto fijo
  // acá sería mentira en Prueba o verdad a medias en Ilimitado. La
  // viñeta que sí dice CUÁNTAS la arma `etiquetaNotificacionesDe()`, y
  // `etiquetasDeCapacidades()` la mete en el lugar de esta.
  notificaciones: "Notificaciones al pase del cliente",
  // NO se escribe "...a 30 días": `catalogo-publico.test.ts` ya vigila
  // que ningún texto público contenga el substring "0 días" —quedó de
  // cuando `notaPrecioDe` podía anunciar «0 días, sin tarjeta» como si
  // el paquete gratis ya hubiera vencido— y "a 30 días" lo dispara
  // igual (es substring de "30 días"), aunque acá no tenga nada que ver
  // con un vencimiento. Se esquiva con otra redacción, no tocando esa
  // guardia.
  proyeccion_metricas: "Proyección de crecimiento mensual",
  // El «(en iPhone)» no es letra chica: `google.ts` no escribe
  // ubicaciones en el objeto, así que en Android el aviso no sale.
  // Prometerlo entero sería vender medio producto.
  cercania: "El pase aparece solo cerca de tu local (en iPhone)",
  diseno_a_medida: "Te diseñamos la tarjeta a mano",

  // ── Las que NO se pueden vender ──────────────────────────────────
  // Ningún paquete las trae y nadie las puede comprar. La etiqueta se
  // escribe igual porque `Record<Capacidad, string>` la exige, y porque
  // es lo que las pruebas buscan en el cuerpo que sale a la calle: sin
  // texto que buscar, «esto no se promete» no se podría comprobar.
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
 * `catalogo-publico.ts` la usa para los TRES topes que publica
 * (`TOPES_PUBLICADOS`). `notificacionesMes` no está entre esos tres a
 * propósito —no se agregó con la 0183, ver el comentario de
 * `TOPES_PUBLICADOS` en ese archivo—: su número real viaja como
 * CAPACIDAD (`etiquetaNotificacionesDe`), no por acá. Existen igual
 * para que agregar un tope NUEVO obligue a pensar cómo se le cuenta a
 * un dueño de negocio.
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
 * `esPlan` contesta «¿la base puede tener esto GUARDADO?», e incluye
 * los retirados — tiene que incluirlos, o las cuentas que ya los tienen
 * se quedarían sin plan. Esta contesta otra cosa: «¿alguien puede PEDIR
 * esto ahora?».
 *
 * Validar un alta con `esPlan` fue un agujero real, y caro. El
 * formulario solo ofrece los vigentes, pero una petición armada a mano
 * con el id de un paquete RETIRADO pasaba la validación — y los
 * retirados van sin topes a propósito (a quien ya lo tenía no se le
 * quita nada). O sea que ELEGIR un paquete retirado regalaba tarjetas
 * ilimitadas, equipo ilimitado y los ocho tipos de tarjeta sin pagar un
 * colón. El descuido más caro de este archivo salía de confundir «lo
 * que la base acepta» con «lo que se vende».
 *
 * Que hoy no haya ningún retirado no cierra ese agujero: lo deja sin
 * munición. La puerta se queda puesta, porque el primer paquete que se
 * retire vuelve a cargarla.
 *
 * Lo que esta función NO toca: `definicionDe`, `puede`,
 * `estadoDelLimite` y `tiposDelPlan` siguen resolviendo con `esPlan`, o
 * sea que un negocio con un paquete retirado sigue funcionando
 * exactamente igual. Lo único que se corta es elegir uno NUEVO.
 *
 * Se decide con `vigente` y no con `PLANES_OFRECIDOS.includes` para que
 * haya UNA sola verdad: el día que un paquete se retire alcanza con
 * poner `vigente: false` y esta puerta se cierra sola. (Hay una prueba
 * que exige que las dos listas digan lo mismo, y otra que comprueba el
 * cierre con un paquete retirado inventado.)
 */
export function esPlanOfrecido(valor: string | null): valor is PlanId {
  return esPlan(valor) && PLANES[valor].vigente;
}

/**
 * ¿Este paquete se contrata SIN PAGAR nada?
 *
 * Es la pregunta que decide si un alta salta el depósito y se crea al
 * instante, así que tiene que ser más estricta que «precioMensual === 0»:
 * pregunta primero si el paquete SE OFRECE. Hubo un paquete retirado
 * que también costaba $0 y venía sin topes, y con la comparación suelta
 * el camino automático le creaba a cualquiera un negocio ilimitado y
 * gratis. La comparación suelta vuelve a ser peligrosa en cuanto se
 * retire un paquete sin costo, así que el orden de las dos preguntas se
 * queda como está.
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
 * CUÁNTO SE AHORRA PAGANDO EL AÑO, en porcentaje entero.
 *
 * Reemplaza a «2 meses gratis» como la forma de anunciar el anual, y no
 * es cambio de gusto: desde que el anual es 20% menos, «2 meses» dice
 * MENOS de lo que se da (el ahorro real son 2,4 meses) y además ya no
 * describe la regla — la regla es un porcentaje, no una cantidad de
 * meses regalados.
 *
 * REDONDEA HACIA ABAJO, a propósito. Si un paquete quedara en 20,6%,
 * anunciar «21%» sería prometer más de lo que el precio cumple. Con
 * `Math.floor` el número que se muestra siempre se queda corto o
 * exacto: se promete 20 y se da 20,6.
 */
export function descuentoAnualPct(def: DefinicionPlan): number {
  if (!def.precioMensual || !def.precioAnual) return 0;
  const completo = def.precioMensual * 12;
  return Math.floor(((completo - def.precioAnual) / completo) * 100);
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
 * Cómo se le cuenta a un dueño de negocio cuántas notificaciones trae
 * su paquete. Mismo criterio que `etiquetaTiposDe`: se calcula desde
 * `LimitesPlan.notificacionesMes` en vez de escribirse a mano, porque
 * una frase aparte se desincroniza el día que cambie el número — y ese
 * número es la promesa central que pidió el dueño para esta pantalla.
 */
export function etiquetaNotificacionesDe(def: DefinicionPlan): string {
  const n = def.limites.notificacionesMes;
  if (n === null) return "Notificaciones ilimitadas al pase del cliente";
  return `${n} notificaci${n === 1 ? "ón" : "ones"} al mes`;
}

/**
 * Las viñetas de un paquete, listas para pintar.
 *
 * Es `ETIQUETAS_CAPACIDAD` con DOS sustituciones: la de los tipos y la
 * de las notificaciones, que dependen del paquete. Existe para que
 * ninguna pantalla tenga que acordarse de esas excepciones — las
 * olvidan todas menos la última que se tocó.
 */
export function etiquetasDeCapacidades(def: DefinicionPlan): string[] {
  return def.capacidades.map((c) =>
    c === "tipos_de_tarjeta"
      ? etiquetaTiposDe(def)
      : c === "notificaciones"
        ? etiquetaNotificacionesDe(def)
        : ETIQUETAS_CAPACIDAD[c],
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
