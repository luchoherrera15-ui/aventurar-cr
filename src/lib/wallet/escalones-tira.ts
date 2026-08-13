/**
 * LA ESCALERA DE DEGRADACIÓN DE LA TIRA (`strip.png`).
 *
 * ------------------------------------------------------------------
 * EL BUG QUE ESTO EXISTE PARA EVITAR
 * ------------------------------------------------------------------
 * La tira se dibuja con imágenes que sube el dueño, y sharp puede
 * fallar con cualquiera de ellas. El caso real: un logo BLANCO SOBRE
 * TRANSPARENTE —lo normal en una marca hecha para fondo oscuro, y el
 * fondo del pase es navy— que al comprimirse se aplastó contra un fondo
 * blanco. Blanco sobre blanco: `sharp(...).trim()` responde «Image is
 * entirely blank» y revienta.
 *
 * La escalera vieja tenía dos escalones —sellos sobre la banda, sellos
 * sobre el color— y los DOS pasaban el mismo logo. O sea que reintentaba
 * cambiando lo único que no era el problema, fallaba otra vez, y el pase
 * salía SIN `strip.png`: sin sellos, sin banda, sin nada. El cliente
 * abría su tarjeta y no veía cuántos sellos llevaba.
 *
 * Por eso el último escalón saca el logo de la ecuación: unos círculos
 * del color del negocio se entienden perfecto; una tira que no existe,
 * no.
 *
 * ------------------------------------------------------------------
 * EL ORDEN ES «LO QUE MENOS SE NOTA PRIMERO»
 * ------------------------------------------------------------------
 *   1. sellos con el logo, sobre la banda   (todo lo que el dueño puso)
 *   2. sellos con el logo, sobre el color   (se pierde la foto)
 *   3. sellos sin el logo                   (se pierde el logo)
 *   4. nada                                 (no debería pasar nunca)
 *
 * Vive aparte de `generar.ts` para poder probarse sin sharp, sin base y
 * sin certificados: la escalera es una decisión, no un dibujo.
 */

/** Con qué se intenta dibujar la tira en este escalón. */
export type EscalonTira = {
  /** ¿Va la foto del negocio de fondo? */
  banda: boolean;
  /** ¿Va el logo del negocio dentro de cada sello? */
  logo: boolean;
};

/**
 * Los escalones a probar, según lo que el negocio tenga cargado.
 *
 * Nunca se ofrece un escalón imposible (banda sin foto, logo sin logo)
 * ni se repite uno: sin foto ni logo hay un solo intento posible.
 */
export function escalonesDeLaTira({
  hayBanda,
  hayLogo,
}: {
  hayBanda: boolean;
  hayLogo: boolean;
}): EscalonTira[] {
  const escalones: EscalonTira[] = [];
  if (hayBanda) escalones.push({ banda: true, logo: hayLogo });
  escalones.push({ banda: false, logo: hayLogo });
  // El escalón que faltaba: sin el logo, que es justo la pieza que falla.
  if (hayLogo) escalones.push({ banda: false, logo: false });
  return escalones;
}

/** Cómo se cuenta en los logs qué se estaba intentando. */
export function describirEscalon(escalon: EscalonTira): string {
  if (escalon.banda && escalon.logo) return "los sellos con el logo, sobre la banda";
  if (escalon.banda) return "los sellos sobre la banda";
  if (escalon.logo) return "los sellos con el logo, sobre el color";
  return "los sellos sin el logo";
}

/**
 * Baja la escalera hasta que un escalón salga bien.
 *
 * Devuelve null solo si fallaron TODOS. El error de cada intento se
 * entrega a `alFallar` en vez de tragarse: «no se ve mi banda» sin
 * rastro es un misterio y con rastro es un ticket.
 */
export async function primeroQueSalga<T>(
  escalones: readonly EscalonTira[],
  intentar: (escalon: EscalonTira) => Promise<T>,
  alFallar?: (escalon: EscalonTira, error: unknown) => void,
): Promise<T | null> {
  for (const escalon of escalones) {
    try {
      return await intentar(escalon);
    } catch (error) {
      alFallar?.(escalon, error);
    }
  }
  return null;
}
