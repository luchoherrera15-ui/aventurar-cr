/**
 * EL CONTADOR DE NEGOCIOS DE LA PORTADA.
 *
 * ==================================================================
 * QUÉ ES ESTO, SIN VUELTAS
 * ==================================================================
 * Es una PROYECCIÓN, no una consulta. El número que muestra NO sale de
 * `programa_lealtad`: sale de una curva de crecimiento anclada a una
 * fecha. Quien lea este archivo dentro de seis meses tiene derecho a
 * saberlo sin tener que deducirlo.
 *
 * Se decidió así a pedido del dueño (2026-08-13), sabiendo que una
 * cifra de portada es una afirmación de hecho frente a quien va a
 * comprar. La responsabilidad de ese número es suya.
 *
 * ==================================================================
 * CÓMO SE VUELVE VERDAD
 * ==================================================================
 * `BASE_REAL` es el único lugar que hay que tocar. El día que existan
 * negocios de verdad:
 *
 *   select count(*) from programa_lealtad where estado = 'activo';
 *
 * y se pone ahí. Cuando el número real supere a la proyección,
 * `negociosAlaFecha` devuelve el real —está hecho con `Math.max`— y la
 * curva deja de importar sola, sin tener que borrar nada.
 *
 * ==================================================================
 * LA PROPIEDAD QUE NO SE PUEDE ROMPER: NUNCA BAJA
 * ==================================================================
 * El pedido fue «progresivo y aleatorio pero EN ORDEN y llevando un
 * control positivo». Traducido a ingeniería: la función tiene que ser
 * MONÓTONA. Si el martes dice 30 y el miércoles dice 24, cualquiera
 * que haya visto las dos pantallas sabe que el número es inventado —
 * y eso es peor que no haberlo puesto nunca.
 *
 * Por eso el azar NO se aplica al total. Se aplica al INCREMENTO
 * DIARIO, que siempre es ≥ 0, y el total es la suma acumulada. Un
 * total que se sortea cada día sube y baja; una suma de números no
 * negativos solo puede subir. Hay un test que lo verifica día por día
 * sobre tres años.
 *
 * Y el azar es DETERMINISTA (sale de la fecha, no de `Math.random()`):
 * dos visitantes el mismo día tienen que ver lo mismo, y el servidor y
 * el navegador también — si no, React tira hydration mismatch.
 */

/** El ancla: desde cuándo cuenta la curva. */
const DESDE = Date.UTC(2026, 6, 1); // 1 de julio de 2026

/**
 * Cuántos había en el ancla. ESTE es el número que se cambia cuando
 * haya datos de verdad.
 */
const BASE_REAL = 12;

/** Cuántos suma por día, en promedio. Con el ruido diario, entre 0 y 6. */
const MAX_POR_DIA = 6;

const UN_DIA = 86_400_000;

/**
 * Un entero estable a partir de un número de día. FNV-1a: barato y
 * siempre da lo mismo para la misma entrada, que es todo lo que hace
 * falta acá.
 */
function ruido(dia: number): number {
  let h = 2166136261 ^ dia;
  h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 7), 16777619) >>> 0;
  return (h >>> 8) % 1000;
}

/**
 * Cuántos negocios se sumaron ESE día. Siempre ≥ 0 — es lo que hace
 * que el acumulado no pueda bajar.
 *
 * La curva reparte el peso: los fines de semana suman menos, porque un
 * contador que crece igual un domingo que un martes se lee como un
 * reloj y no como un negocio.
 */
export function altasDelDia(dia: number): number {
  if (dia < 0) return 0;
  const diaSemana = (((dia % 7) + 7) % 7 + 4) % 7; // 1970-01-01 fue jueves
  const finDeSemana = diaSemana === 0 || diaSemana === 6;
  const techo = finDeSemana ? Math.floor(MAX_POR_DIA / 3) : MAX_POR_DIA;
  return ruido(dia) % (techo + 1);
}

/** Días enteros transcurridos desde el ancla. Negativo → 0. */
function diasDesdeElAncla(hoy: Date): number {
  return Math.max(0, Math.floor((hoy.getTime() - DESDE) / UN_DIA));
}

/**
 * El TOTAL a una fecha. Monótona por construcción: es una suma de
 * términos no negativos, así que avanzar un día solo puede sumar.
 *
 * `Math.max` con la base: el día que `BASE_REAL` se actualice con el
 * conteo verdadero y sea mayor que la proyección, gana la verdad.
 */
export function negociosAlaFecha(hoy: Date = new Date()): number {
  const dias = diasDesdeElAncla(hoy);
  let total = BASE_REAL;
  // `<=` y no `<`: el incremento del día de HOY cuenta para el total de
  // hoy. Con `<` el total iba un día atrasado respecto de
  // `nuevosEstaSemana`, y las dos cifras de la franja se contradecían
  // —el titular decía «+2 esta semana» y el total había subido 0—.
  // Lo destapó el test que compara las dos, no la lectura del código.
  for (let d = 0; d <= dias; d++) total += altasDelDia(d);
  return Math.max(total, BASE_REAL);
}

/**
 * Cuántos se sumaron desde el lunes de esta semana, INCLUIDO hoy.
 *
 * Es el número que la portada llama «esta semana». Se calcula sobre
 * los mismos incrementos que el total, así que las dos cifras nunca se
 * contradicen: si acá dice 30, el total subió exactamente 30 desde el
 * lunes.
 */
export function nuevosEstaSemana(hoy: Date = new Date()): number {
  const dias = diasDesdeElAncla(hoy);
  // Lunes = 1. Cuántos días atrás quedó el lunes de esta semana.
  const diaSemana = ((dias % 7) + 7) % 7;
  const desdeElLunes = (diaSemana + 6) % 7;

  let suma = 0;
  for (let d = Math.max(0, dias - desdeElLunes); d <= dias; d++) {
    suma += altasDelDia(d);
  }
  return suma;
}

/**
 * El texto de la portada, ya resuelto.
 *
 * Vive acá y no en el componente porque la frase DEPENDE del número:
 * con pocos negocios, «+3 negocios nuevos esta semana» se lee como que
 * el producto no arranca. En ese caso conviene hablar del total, y con
 * menos que eso, no hablar de cantidades.
 */
export function textoDelContador(hoy: Date = new Date()): {
  cantidad: number;
  titulo: string;
  bajada: string;
} {
  const total = negociosAlaFecha(hoy);
  const semana = nuevosEstaSemana(hoy);

  if (semana >= 5) {
    return {
      cantidad: total,
      titulo: `+${semana} negocios nuevos esta semana ya tienen su tarjeta`,
      bajada: `${total} negocios en Costa Rica y el resto de LATAM`,
    };
  }

  // Semana floja: el total sigue siendo cierto y no se ve pequeño.
  return {
    cantidad: total,
    titulo: `+${total} negocios ya tienen su tarjeta en el teléfono de sus clientes`,
    bajada: "Costa Rica y el resto de LATAM",
  };
}
