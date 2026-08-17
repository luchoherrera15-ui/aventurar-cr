/**
 * QUÉ AVISOS DEL TABLERO CERRÓ QUIEN MIRA.
 *
 * ------------------------------------------------------------------
 * POR QUÉ UNA COOKIE Y NO LA BASE
 * ------------------------------------------------------------------
 * Cerrar un aviso no cambia NADA del programa: los pasos siguen
 * pendientes, el cupo sigue donde está y la casilla se marca sola
 * cuando la señal real de la base cambia. Es una preferencia de quien
 * mira, no un hecho del negocio — y guardar preferencias de pantalla en
 * la base tiene dos costos que acá no se pagan: una migración con RLS
 * para algo que nadie audita, y —peor— un alcance equivocado: si el
 * dato viviera en la fila del negocio, el colaborador que cierra el
 * aviso en el mostrador se lo esconde también al dueño.
 *
 * ------------------------------------------------------------------
 * POR QUÉ COOKIE Y NO localStorage
 * ------------------------------------------------------------------
 * Las dos persisten y las dos son por navegador. La diferencia es
 * CUÁNDO se sabe: `localStorage` recién se puede leer después de
 * hidratar, así que el aviso cerrado se pinta un cuadro y desaparece —
 * justo el parpadeo que hace sentir que la X no sirvió. La cookie la
 * lee el servidor, que entonces no dibuja el aviso: se entra al tablero
 * y punto, que es lo que se pidió.
 *
 * No lleva nada sensible (ids de negocio que quien mira ya ve en la
 * URL) y no autoriza nada: si alguien la edita a mano, lo único que
 * consigue es esconderse un aviso a sí mismo.
 *
 * ------------------------------------------------------------------
 * EL FORMATO
 * ------------------------------------------------------------------
 * `negocio.aviso!negocio.aviso` — separadores de UN carácter, los dos
 * válidos en el valor de una cookie sin escapar (RFC 6265), y ninguno
 * de los dos aparece en un uuid ni en una clave de aviso. Guardar JSON
 * obligaría a codificar la cookie entera para algo que es una lista de
 * pares.
 *
 * Lógica pura, sin `document` ni `next/headers`: la escriben el
 * navegador y la lee el servidor, así que las dos puntas necesitan
 * exactamente las mismas reglas.
 */

export const COOKIE_AVISOS = "bookea_lealtad_avisos";

/** Un año: cerrar un aviso es una decisión, no una sesión. */
export const VIDA_COOKIE_AVISOS = 60 * 60 * 24 * 365;

const SEP_REGISTRO = "!";
const SEP_CAMPO = ".";

/**
 * Cuántos pares se conservan. La cookie viaja en CADA request del
 * dominio, así que crecer sin techo es un impuesto permanente sobre
 * todo el sitio. Se podan los más viejos: 60 pares son ~2 KB en el peor
 * caso y alcanzan para muchos más negocios de los que nadie administra.
 */
const MAX_PARES = 60;

/** Ni el id del negocio ni la clave del aviso llevan separadores. */
const VALIDO = /^[A-Za-z0-9_-]+$/;

export type AvisoOculto = { negocio: string; aviso: string };

/** Los pares que trae la cookie, descartando lo que no tenga forma. */
export function leerAvisosOcultos(crudo: string | null | undefined): AvisoOculto[] {
  if (!crudo) return [];
  const vistos = new Set<string>();
  const pares: AvisoOculto[] = [];

  for (const registro of crudo.split(SEP_REGISTRO)) {
    const [negocio, aviso, ...sobra] = registro.split(SEP_CAMPO);
    // Una cookie la escribe el navegador y se puede editar a mano: lo
    // que no tenga forma de par se tira en vez de terminar en una
    // clave con la que después no coincide nada.
    if (sobra.length || !negocio || !aviso) continue;
    if (!VALIDO.test(negocio) || !VALIDO.test(aviso)) continue;
    const llave = `${negocio}${SEP_CAMPO}${aviso}`;
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    pares.push({ negocio, aviso });
  }

  return pares;
}

/** El valor de la cookie para una lista de pares, ya podada. */
export function escribirAvisosOcultos(pares: AvisoOculto[]): string {
  return pares
    .slice(-MAX_PARES)
    .map((p) => `${p.negocio}${SEP_CAMPO}${p.aviso}`)
    .join(SEP_REGISTRO);
}

/** Las claves cerradas de UN negocio. */
export function avisosOcultosDe(crudo: string | null | undefined, negocio: string): string[] {
  return leerAvisosOcultos(crudo)
    .filter((p) => p.negocio === negocio)
    .map((p) => p.aviso);
}

/** La cookie con un aviso más cerrado. Idempotente. */
export function conAvisoCerrado(
  crudo: string | null | undefined,
  negocio: string,
  aviso: string,
): string {
  const pares = leerAvisosOcultos(crudo);
  if (pares.some((p) => p.negocio === negocio && p.aviso === aviso)) {
    return escribirAvisosOcultos(pares);
  }
  return escribirAvisosOcultos([...pares, { negocio, aviso }]);
}

/**
 * La cookie sin ningún aviso cerrado DE ESE NEGOCIO — lo que hace
 * «volver a mostrarlos». Los otros negocios de la cuenta no se tocan:
 * quien reabre los avisos de una barbería no está pidiendo que le
 * vuelvan los de su restaurante.
 */
export function sinAvisosCerrados(crudo: string | null | undefined, negocio: string): string {
  return escribirAvisosOcultos(leerAvisosOcultos(crudo).filter((p) => p.negocio !== negocio));
}
