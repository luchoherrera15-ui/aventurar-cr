/**
 * CON QUÉ ESTADO NACE UNA TARJETA RECIÉN CREADA.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO MERECE UN ARCHIVO Y UNA PRUEBA
 * ------------------------------------------------------------------
 * Nacía en `borrador` con `activo: false`, con un argumento razonable:
 * «publicar es una decisión aparte; una tarjeta que se activa sola
 * empieza a emitir pases antes de que nadie la mire dos veces».
 *
 * El problema es que el asistente que la crea dice lo contrario CUATRO
 * veces: el último paso se llama «Revisar — una última mirada antes de
 * publicar», el botón dice «Publicar tarjeta», mientras guarda dice
 * «Publicando…» y la pantalla final dice «quedó publicada».
 *
 * Una interfaz que promete publicar y guarda un borrador no falla:
 * MIENTE. Y falló en silencio, del peor modo posible:
 *
 *   · La tarjeta no emitía un solo pase. El dueño reportó «la imagen no
 *     se ve en el pase» cuando lo que no existía era el pase.
 *   · Al intentar de nuevo, el límite de tarjetas del paquete lo
 *     rebotaba, porque ese borrador que ninguna pantalla mostraba ya
 *     ocupaba el cupo.
 *   · Verificado contra producción: un programa en `borrador`,
 *     `activo: false`, 0 miembros, 0 pases — y su imagen SÍ subida.
 *
 * La cautela sigue siendo válida, pero la cumple el paso de Revisar del
 * asistente, no un estado escondido. Un botón que promete publicar,
 * publica.
 *
 * Las dos columnas van juntas y por eso salen de UNA función: `activo`
 * es de la 0060 y `estado` de la 0125, y describen lo mismo. Ponerlas
 * a mano en cada insert es la forma de que un día digan cosas
 * distintas — y un programa `estado:'activo'` con `activo:false` no
 * acumula ni canjea, mientras toda la interfaz lo pinta encendido.
 */
export type EstadoDeTarjeta = { activo: boolean; estado: string };

/** Publicada y operando: es lo que el botón del asistente promete. */
export function estadoAlCrear(): EstadoDeTarjeta {
  return { activo: true, estado: "activo" };
}

/**
 * ¿Este par dice una sola cosa?
 *
 * `activo` es el booleano viejo (0060) y `estado` el vocabulario nuevo
 * (0125). El motor que autoriza un canje mira los dos, así que un par
 * incoherente es una tarjeta que la interfaz muestra encendida y que no
 * funciona. Existe para probarlo, no para decidir en caliente.
 */
export function esCoherente({ activo, estado }: EstadoDeTarjeta): boolean {
  return activo === (estado === "activo");
}
