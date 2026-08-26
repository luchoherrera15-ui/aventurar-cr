/**
 * ════════════════════════════════════════════════════════════════════
 *  DÓNDE VA CADA SELLO — un solo cálculo, dos rasterizadores
 * ════════════════════════════════════════════════════════════════════
 *
 * ⚠️ ESTE MÓDULO EXISTE PARA ARREGLAR UNA DUPLICACIÓN REAL.
 *
 * La tira de sellos se dibujaba DOS VECES, con dos algoritmos
 * distintos:
 *
 *   · el PNG del pase — `imagenes.ts`, una grilla calculada a mano con
 *     `left`/`top` en píxeles;
 *   · la vista previa — `vista-pase.tsx`, un `flex flex-wrap` con
 *     `gap-1.5`, sellos de 20px fijos y un tope de 20 dibujados.
 *
 * O sea que el dueño diseñaba mirando una cosa y su cliente recibía
 * otra. Y cada opción nueva de diseño costaba implementarla dos veces,
 * con dos resultados que nadie garantizaba iguales.
 *
 * Acá vive el cálculo, UNA vez. El servidor lo usa para componer el
 * PNG con sharp; la vista previa lo usa para posicionar `<span>` en
 * porcentaje. Un solo layout, dos formas de pintarlo.
 *
 * ── SIN `sharp`, A PROPÓSITO ────────────────────────────────────────
 * Este archivo no importa nada: es aritmética pura. Así se puede
 * probar sin levantar sharp y lo puede importar un componente de
 * cliente. Es el mismo criterio con el que `escalones-tira.ts` vive
 * aparte de `generar.ts`.
 *
 * ── LOS VALORES POR DEFECTO REPRODUCEN EL LAYOUT DE HOY ─────────────
 * Exactamente, al píxel. `CONFIG_CLASICA` es el algoritmo que estaba
 * escrito a mano en `imagenes.ts`, y los tests de imágenes lo
 * comprueban: ninguna tarjeta ya emitida cambia de aspecto por este
 * refactor.
 */

/** Medidas de Apple para el strip de un storeCard, en puntos. */
export const TIRA_ANCHO = 375;
export const TIRA_ALTO = 123;

/** Dónde se apoya cada sello dentro de la celda que le toca. */
export type AlineacionH = "izquierda" | "centro" | "derecha";
export type AlineacionV = "arriba" | "centro" | "abajo";

export type ConfigTira = {
  /**
   * Cuántas filas. `"auto"` es la regla de siempre: dos filas a partir
   * de siete sellos, una hasta seis.
   */
  filas: "auto" | 1 | 2 | 3;
  /**
   * Multiplica el diámetro que sale del reparto. 1 = como siempre.
   *
   * ⚠️ NO agranda sin límite: el diámetro se calcula para que entre en
   * su celda, y este factor se aplica DESPUÉS con un tope. Sin ese tope
   * un valor alto haría que los sellos se pisen entre sí y se salgan de
   * la tira — y en el pase eso no se ve hasta que llega al teléfono.
   */
  escalaSello: number;
  alineacionH: AlineacionH;
  alineacionV: AlineacionV;
  /**
   * Margen vertical, como fracción del alto. 0.07 es el de siempre.
   *
   * ⚠️ EL MARGEN HORIZONTAL NO SE CONFIGURA, Y NO ES UN OLVIDO. Está
   * fijo en 7 % porque iOS RECORTA la tira según el ancho del teléfono:
   * lo que se dibuja cerca del borde puede no verse en una pantalla
   * angosta. Es un riesgo de producción documentado en `imagenes.ts`, y
   * dejarlo configurable sería ofrecerle al dueño una opción que le
   * rompe la tarjeta en los teléfonos que no tiene a mano para probar.
   */
  margenY: number;
};

/** El layout que estaba escrito a mano en `imagenes.ts`. */
export const CONFIG_CLASICA: ConfigTira = {
  filas: "auto",
  escalaSello: 1,
  alineacionH: "centro",
  alineacionV: "centro",
  margenY: 0.07,
};

/**
 * ════════════════════════════════════════════════════════════════════
 *  LO QUE VIENE DE LA BASE NO SE USA TAL CUAL
 * ════════════════════════════════════════════════════════════════════
 *
 * `programa_lealtad.pase_diseno` es una columna `jsonb` (0212), y su
 * único CHECK es que sea un objeto. Adentro puede haber cualquier cosa:
 * una fila vieja, un valor guardado por una versión anterior del panel,
 * o algo escrito a mano en el SQL Editor.
 *
 * Esta función lo convierte en una `ConfigTira` válida, campo por
 * campo, cayendo al clásico en cada uno que no reconozca. NO es
 * paranoia: lo que salga de acá va DIRECTO a dibujar el pase que
 * termina en el teléfono de un cliente, y un `NaN` en la escala produce
 * un PNG en blanco — que Apple rechaza sin decir por qué.
 *
 * Un campo mal guardado degrada ese campo solo. No tumba la tarjeta ni
 * arrastra a los demás.
 */
export function configDesdeJson(valor: unknown): ConfigTira {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return CONFIG_CLASICA;
  }
  const d = valor as Record<string, unknown>;

  const filas =
    d.filas === 1 || d.filas === 2 || d.filas === 3 || d.filas === "auto"
      ? (d.filas as ConfigTira["filas"])
      : CONFIG_CLASICA.filas;

  // Acotada acá ADEMÁS del tope de `layoutDeLaTira`: ese tope evita que
  // los sellos se pisen, éste evita que un `Infinity` o un `NaN`
  // guardado llegue siquiera a la aritmética.
  const escalaSello =
    typeof d.escalaSello === "number" && Number.isFinite(d.escalaSello)
      ? Math.min(2, Math.max(0.4, d.escalaSello))
      : CONFIG_CLASICA.escalaSello;

  const alineacionH =
    d.alineacionH === "izquierda" || d.alineacionH === "centro" || d.alineacionH === "derecha"
      ? d.alineacionH
      : CONFIG_CLASICA.alineacionH;

  const alineacionV =
    d.alineacionV === "arriba" || d.alineacionV === "centro" || d.alineacionV === "abajo"
      ? d.alineacionV
      : CONFIG_CLASICA.alineacionV;

  // Techo en 0,25: más margen que eso deja la tira casi vacía y los
  // sellos apretados en el centro, que no es una decisión de diseño
  // sino una tarjeta rota.
  const margenY =
    typeof d.margenY === "number" && Number.isFinite(d.margenY)
      ? Math.min(0.25, Math.max(0, d.margenY))
      : CONFIG_CLASICA.margenY;

  return { filas, escalaSello, alineacionH, alineacionV, margenY };
}

/**
 * ¿Es el layout de siempre?
 *
 * Sirve para NO escribir lo que no hace falta: una tarjeta que nadie
 * acomodó tiene que poder guardarse sin tocar la columna, porque `{}` y
 * el clásico son la misma tarjeta. La usa el alta pública para no
 * disparar un UPDATE que no cambia ningún píxel, y la pantalla de
 * diseño para saber si «volver al clásico» tiene algo que deshacer.
 *
 * Campo por campo y no `JSON.stringify`: el orden de las claves de un
 * objeto guardado no es asunto de nadie, y comparar serializado haría
 * que un `{escalaSello, filas}` y un `{filas, escalaSello}` idénticos
 * se leyeran como distintos.
 */
export function esClasica(config: ConfigTira): boolean {
  return (
    config.filas === CONFIG_CLASICA.filas &&
    config.escalaSello === CONFIG_CLASICA.escalaSello &&
    config.alineacionH === CONFIG_CLASICA.alineacionH &&
    config.alineacionV === CONFIG_CLASICA.alineacionV &&
    config.margenY === CONFIG_CLASICA.margenY
  );
}

/** El margen horizontal, fijo. Ver el aviso de `margenY`. */
const MARGEN_X = 0.07;

/** Diámetro mínimo: menos que esto no se distingue un sello de un punto. */
const DIAMETRO_MINIMO = 8;

/**
 * Cuánto puede crecer un sello respecto de su celda antes de pisar al
 * de al lado. 1 = ocupa la celda entera y los sellos se tocan.
 */
const TOPE_CRECIMIENTO = 1;

export type PosicionSello = {
  /** Esquina superior izquierda, en las mismas unidades que `ancho`. */
  x: number;
  y: number;
};

export type LayoutTira = {
  ancho: number;
  alto: number;
  diametro: number;
  filas: number;
  porFila: number;
  posiciones: PosicionSello[];
};

/** Qué fracción de la celda sobrante va ANTES del sello. */
function factorH(a: AlineacionH): number {
  if (a === "izquierda") return 0;
  if (a === "derecha") return 1;
  return 0.5;
}

function factorV(a: AlineacionV): number {
  if (a === "arriba") return 0;
  if (a === "abajo") return 1;
  return 0.5;
}

/**
 * El layout completo de una tira.
 *
 * `ancho`/`alto` llegan por parámetro y no se asumen: el servidor pasa
 * `375 × escala` (Apple pide tres escalas) y la vista previa pasa
 * `375 × 123` para después convertir a porcentaje. La aritmética es la
 * misma; lo único que cambia es la unidad.
 */
export function layoutDeLaTira(
  total: number,
  config: ConfigTira = CONFIG_CLASICA,
  ancho: number = TIRA_ANCHO,
  alto: number = TIRA_ALTO,
): LayoutTira {
  // Un total de cero o negativo no es un caso de diseño, es un dato
  // roto. Se devuelve una tira vacía en vez de dividir por cero.
  const cuantos = Math.max(0, Math.floor(total));
  if (cuantos === 0) {
    return { ancho, alto, diametro: DIAMETRO_MINIMO, filas: 1, porFila: 0, posiciones: [] };
  }

  const filas =
    config.filas === "auto" ? (cuantos > 6 ? 2 : 1) : Math.max(1, config.filas);
  const porFila = Math.ceil(cuantos / filas);

  const margenX = ancho * MARGEN_X;
  const margenY = alto * config.margenY;
  const utilX = ancho - margenX * 2;
  const utilY = alto - margenY * 2;

  const pasoX = utilX / porFila;
  const pasoY = utilY / filas;

  /**
   * El diámetro base: el mayor círculo que entra en su celda dejando
   * aire. Los factores 0,88 y 0,9 son los de siempre — el ancho aprieta
   * más que el alto porque en una fila de diez el margen entre sellos
   * se nota, y el vertical no.
   */
  const base = Math.min(pasoX * 0.88, pasoY * 0.9);

  /**
   * La escala del dueño, con tope. `TOPE_CRECIMIENTO` impide que un
   * valor alto haga que los sellos se pisen o se salgan de la tira: en
   * el pase eso no se ve hasta que llega al teléfono del cliente.
   */
  const conEscala = base * Math.max(0.1, config.escalaSello);
  const techo = Math.min(pasoX, pasoY) * TOPE_CRECIMIENTO;
  const diametro = Math.max(DIAMETRO_MINIMO, Math.round(Math.min(conEscala, techo)));

  const fh = factorH(config.alineacionH);
  const fv = factorV(config.alineacionV);

  const posiciones: PosicionSello[] = [];
  for (let i = 0; i < cuantos; i++) {
    const fila = Math.floor(i / porFila);
    const col = i % porFila;
    posiciones.push({
      x: Math.round(margenX + pasoX * col + (pasoX - diametro) * fh),
      y: Math.round(margenY + pasoY * fila + (pasoY - diametro) * fv),
    });
  }

  return { ancho, alto, diametro, filas, porFila, posiciones };
}
