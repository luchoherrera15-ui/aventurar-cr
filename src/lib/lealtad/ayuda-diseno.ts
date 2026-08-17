import { ICONOS_SELLO, SELLO_PROPIO, esIconoSello, type SelloElegido } from "./iconos-sello";
import { paletaDeLosColores } from "./paletas";
import { TIPOS_TARJETA, type TipoTarjeta } from "./tipos-tarjeta";

/**
 * ============================================================
 * «NO ME GUSTA CÓMO ME ESTÁ QUEDANDO» — el contexto del pedido
 * ============================================================
 *
 * El dueño de una barbería está armando su tarjeta, no le sale como
 * quiere y toca «Que me ayuden con el diseño». Este archivo arma lo
 * PRIMERO que el equipo va a leer.
 *
 * ------------------------------------------------------------
 * POR QUÉ ES UNA FUNCIÓN PURA Y NO TEXTO ARMADO EN EL COMPONENTE
 * ------------------------------------------------------------
 * Porque es lo único que decide si esto sirve. Un pedido que llega
 * diciendo «quiero algo más elegante» y nada más obliga a gastar la
 * primera respuesta —y un día entero de ida y vuelta— en averiguar qué
 * estaba mirando: qué negocio, qué tarjeta, qué tipo, qué colores.
 *
 * Armado a mano dentro del JSX no se puede probar, y el día que alguien
 * toque el creador el resumen se queda viejo en silencio. Acá se prueba
 * caso por caso (ayuda-diseno.test.ts).
 *
 * Misma forma que `armarPrimerMensaje` (src/app/eventos/agenda-consulta.ts),
 * que hace exactamente esto para la agenda de eventos.
 *
 * ------------------------------------------------------------
 * DE DÓNDE SALE CADA DATO (y por qué importa)
 * ------------------------------------------------------------
 * Lo VISUAL —tipo, colores, icono, si subió logo o banda— sale de la
 * PANTALLA, no de la base: en el creador todavía no hay ninguna fila
 * guardada, y en el editor el dueño puede estar mirando cambios que no
 * guardó. Se pide ayuda por lo que se está viendo.
 *
 * La IDENTIDAD —el nombre del negocio y el de la tarjeta— la pone el
 * SERVIDOR, buscándola por el id. Es lo que el admin usa para saber a
 * quién le contesta, y un dato así no puede venir del navegador.
 */

/** El tope de la columna `ayuda_diseno.contexto` (0149). */
export const TOPE_CONTEXTO = 2000;

/**
 * La línea que cierra SIEMPRE el resumen, y la más importante de todas.
 *
 * Sin ella, un admin apurado lee «tipo sellos, café tostado, sin logo»
 * y puede creer que está viendo una tarjeta ya cambiada, o peor, que
 * tocando algo del panel se aplica lo que el dueño pidió. Esto no
 * cambia ni un pixel de nada: es una conversación.
 *
 * Se pega DESPUÉS de recortar el cuerpo —igual que `CIERRE_CONSULTA` en
 * la agenda de eventos— porque si el recorte a `TOPE_CONTEXTO` se la
 * comiera, el resumen diría justo lo contrario de lo que pasó.
 */
export const CIERRE_AYUDA =
  "Esto NO cambia la tarjeta: es un pedido de ayuda. Lo que se acuerde acá lo aplica después el equipo o el dueño desde su panel.";

export type ContextoDiseno = {
  /** El negocio que pide. Lo pone el servidor. */
  negocioNombre: string;
  /**
   * La tarjeta sobre la que se pide ayuda. Lo pone el servidor.
   * `null` = todavía NO existe: viene del creador, sin publicar.
   */
  tarjetaNombre: string | null;
  /** Lo que el dueño tiene elegido EN PANTALLA: */
  tipo: TipoTarjeta;
  colorFondo: string;
  colorSello: string;
  /**
   * El dibujo del sello (0145). null = va el logo del negocio adentro;
   * 'propio' = subió su propio ícono (0174).
   */
  iconoSello: SelloElegido | null;
  tieneLogo: boolean;
  tieneBanda: boolean;
};

function limpio(texto: string, tope: number): string {
  return texto.trim().replace(/\s+/g, " ").slice(0, tope);
}

/**
 * El resumen que el equipo lee antes de contestar.
 *
 * Va en el mismo orden en que el dueño armó la tarjeta —quién es,
 * cuál tarjeta, qué tipo, cómo se ve— para que se pueda leer de
 * corrido mientras se abre el panel de ese negocio.
 */
export function armarContextoDeDiseno(c: ContextoDiseno): string {
  const partes: string[] = [];

  partes.push(`Negocio: ${limpio(c.negocioNombre, 80) || "(sin nombre)"}`);

  // Que la tarjeta NO exista todavía es la mitad de la información: le
  // dice al equipo que no hay nada que abrir en el panel y que lo que
  // se acuerde lo va a publicar el dueño desde el creador.
  const tarjeta = c.tarjetaNombre === null ? "" : limpio(c.tarjetaNombre, 80);
  partes.push(
    tarjeta
      ? `Tarjeta: «${tarjeta}» (ya publicada)`
      : "Tarjeta: todavía NO existe — la está armando en el creador",
  );

  partes.push(`Tipo: ${TIPOS_TARJETA[c.tipo].nombre}`);

  // Si los dos colores son los de una plantilla, se nombra: «Café
  // tostado» le dice al equipo mucho más que dos hexadecimales, y sobre
  // todo le dice que el dueño NO tocó las ruedas. Que los haya elegido
  // a mano es justamente el caso donde suelen quedar ilegibles.
  const paleta = paletaDeLosColores(c.colorFondo, c.colorSello);
  partes.push(
    `Colores: fondo ${c.colorFondo} · acento ${c.colorSello}` +
      (paleta ? ` — plantilla «${paleta.nombre}»` : " — elegidos a mano"),
  );

  // El icono solo existe en sellos: es el único tipo con círculos que
  // llenar. Ponerlo en una gift card sería inventar un dato.
  if (c.tipo === "sellos") {
    // El ícono propio se nombra COMO TAL: es el caso donde el equipo
    // más suele tener algo que decir (una foto metida en un círculo de
    // 30 píxeles), y confundirlo con «el logo del negocio» mandaría a
    // mirar justo el archivo equivocado.
    const dibujo = esIconoSello(c.iconoSello)
      ? ICONOS_SELLO[c.iconoSello].nombre
      : c.iconoSello === SELLO_PROPIO
        ? "un ícono propio que subió el negocio"
        : "el logo del negocio";
    partes.push(`Icono del sello: ${dibujo}`);
  }

  // Sin logo la tarjeta escribe el nombre, y sin banda el pase queda
  // liso: las dos ausencias son la causa más común de un «no me gusta
  // cómo queda» que en realidad es «me falta subir algo».
  partes.push(
    `Imágenes: logo ${c.tieneLogo ? "sí" : "no"} · banda ${c.tieneBanda ? "sí" : "no"}`,
  );

  const cuerpo = partes.join("\n").slice(0, TOPE_CONTEXTO - CIERRE_AYUDA.length - 1);
  return `${cuerpo}\n${CIERRE_AYUDA}`;
}

/**
 * EL OTRO ORIGEN: «Crear personalizado» del alta (/lealtad/nuevo).
 *
 * Ese camino ya existía y se conserva tal cual — quien todavía no tiene
 * negocio no puede tener un hilo, porque no hay `rancho_id` del que
 * colgarlo. Lo que faltaba era la costura: al aprobar el alta, el
 * negocio nace y la descripción que la persona escribió quedaba
 * enterrada en una fila de `solicitudes_lealtad` ya atendida, sin
 * ninguna pantalla donde seguir hablando de eso.
 *
 * Con esto, aprobar abre el hilo con lo que ya había escrito: el equipo
 * le contesta ahí y el dueño lo encuentra en el mismo bloque del
 * creador. Un pedido, una conversación.
 *
 * NO se arma con `armarContextoDeDiseno`: en un alta no hay tipo, ni
 * colores, ni icono. Inventarle valores para llenar el formato sería
 * mostrarle al equipo una tarjeta que nadie eligió.
 */
export function contextoDelAlta(negocioNombre: string): string {
  const cuerpo = [
    `Negocio: ${limpio(negocioNombre, 80) || "(sin nombre)"}`,
    "Tarjeta: todavía NO existe — al dar de alta el negocio eligió «Crear personalizado»,",
    "o sea que nunca pasó por el creador y no hay tipo ni colores elegidos.",
    "Abajo va, textual, lo que escribió al pedirlo.",
  ]
    .join("\n")
    .slice(0, TOPE_CONTEXTO - CIERRE_AYUDA.length - 1);
  return `${cuerpo}\n${CIERRE_AYUDA}`;
}
