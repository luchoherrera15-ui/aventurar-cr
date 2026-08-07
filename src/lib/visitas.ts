import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { hoyISOCR } from "@/lib/fechas";

/**
 * Prueba social real de la página de un negocio: "12 personas visitaron
 * este sitio hoy". Todo lo que se muestra sale de la tabla
 * `visitas_pagina` (migración 0107) y NUNCA se infla ni se inventa.
 *
 * Dos cosas delicadas viven acá:
 *
 * 1. EL HASH DEL VISITANTE. Lo arma el servidor con la IP, el navegador,
 *    el día y una sal secreta. La IP en claro no se guarda ni viaja al
 *    cliente, y como el día entra en el hash, el mismo aparato cambia de
 *    identidad cada medianoche: no se puede seguir a nadie entre días.
 *
 * 2. LA BASE PUEDE NO TENER LA MIGRACIÓN. La 0107 la pega el dueño a
 *    mano. Mientras no esté, las funciones no existen: acá eso se
 *    reconoce y se devuelve null — la tarjeta simplemente no aparece y
 *    la página del negocio carga igual que siempre.
 */

/** Lo que devuelve `visitas_pagina_resumen`. */
export type ResumenVisitas = { hoy: number; semana: number };

/** Lo que se muestra, ya decidido: cuántos y de qué período. */
export type FraseVisitas = { numero: number; periodo: "hoy" | "semana" };

/**
 * El piso. Un número bajo vende MENOS que ningún número: nadie quiere
 * leer "1 persona visitó este sitio hoy". Debajo de esto no se muestra
 * nada.
 */
export const MINIMO_VISITAS = 3;

/**
 * Sal por defecto, documentada a propósito: sin `VISITAS_SALT` el
 * contador sigue funcionando (mejor eso que tumbar la página), pero el
 * hash deja de ser secreto. En producción la variable va sí o sí.
 */
const SAL_POR_DEFECTO = "bookea-visitas-sin-sal-configurada";

let yaSeAvisoFaltaSal = false;

function salVisitas(): string {
  const sal = process.env.VISITAS_SALT?.trim();
  if (sal) return sal;
  if (!yaSeAvisoFaltaSal) {
    yaSeAvisoFaltaSal = true;
    console.warn(
      "[visitas] Falta VISITAS_SALT: el contador usa la sal por defecto, que es pública. Configurala en el entorno (sin NEXT_PUBLIC_).",
    );
  }
  return SAL_POR_DEFECTO;
}

/**
 * La primera IP de `x-forwarded-for` (la del visitante; las que siguen
 * son las de los proxys). Nunca sale de acá: solo entra al hash.
 */
export function ipDeCabeceras(cabeceras: Headers): string {
  const reenviada = cabeceras.get("x-forwarded-for") ?? "";
  const primera = reenviada.split(",")[0]?.trim();
  if (primera) return primera;
  return cabeceras.get("x-real-ip")?.trim() || "sin-ip";
}

/**
 * El identificador diario de un visitante: sha-256 de IP + navegador +
 * día + sal, en hexadecimal. sha-256 ya mide 64 caracteres; el slice
 * queda de contrato explícito con la columna.
 */
export function hashVisitante(
  ip: string,
  userAgent: string,
  dia: string,
): string {
  return createHash("sha256")
    .update(`${salVisitas()}|${dia}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 64);
}

/** El hash de quien está haciendo ESTE pedido, con el día de hoy en CR. */
export function hashDelPedido(cabeceras: Headers): string {
  return hashVisitante(
    ipDeCabeceras(cabeceras),
    cabeceras.get("user-agent") ?? "sin-navegador",
    hoyISOCR(),
  );
}

/**
 * ¿El error es "esa función no existe"? Pasa mientras la base no tenga
 * corrida la 0107. Igual que con las columnas (ver `esColumnaInexistente`
 * en precios.ts), vienen por dos caminos: el 42883 de Postgres y el
 * PGRST202 de PostgREST, que ni siquiera llega a la base. Se mira
 * primero el texto y el código queda de respaldo.
 */
export function esFuncionInexistente(error: {
  code?: string;
  message?: string;
}): boolean {
  const mensaje = (error.message ?? "").toLowerCase();
  if (
    mensaje.includes("does not exist") ||
    mensaje.includes("could not find the function") ||
    mensaje.includes("schema cache")
  ) {
    return true;
  }
  // 42883: función inexistente. 42P01: la tabla tampoco está.
  return error.code === "42883" || error.code === "PGRST202" || error.code === "42P01";
}

/**
 * La regla del dueño, en un solo lugar (pura, para poder probarla):
 *
 * - 3 o más visitas hoy → "N personas visitaron este sitio hoy".
 * - si no, pero la semana llega a 3 → "... esta semana".
 * - si no → nada. Nunca se infla ni se inventa un número.
 */
export function fraseVisitas(resumen: ResumenVisitas | null): FraseVisitas | null {
  if (!resumen) return null;
  const hoy = Number.isFinite(resumen.hoy) ? Math.trunc(resumen.hoy) : 0;
  const semana = Number.isFinite(resumen.semana) ? Math.trunc(resumen.semana) : 0;
  if (hoy >= MINIMO_VISITAS) return { numero: hoy, periodo: "hoy" };
  if (semana >= MINIMO_VISITAS) return { numero: semana, periodo: "semana" };
  return null;
}

/** El texto tal cual se lee en la tarjeta. */
export function textoVisitas({ periodo }: FraseVisitas): string {
  return periodo === "hoy"
    ? "visitaron este sitio hoy"
    : "visitaron este sitio esta semana";
}

/**
 * Los números de un negocio. La tabla no la lee nadie directo (tiene RLS
 * sin policies): la única puerta es `visitas_pagina_resumen`, que
 * devuelve conteos y nada más.
 *
 * Devuelve null ante CUALQUIER problema —base sin migrar, red caída, lo
 * que sea—. Un contador nunca puede tumbar la página de un negocio.
 */
export async function leerResumenVisitas(
  ranchoId: string,
): Promise<ResumenVisitas | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("visitas_pagina_resumen", {
      p_rancho: ranchoId,
    });
    if (error) {
      // Sin la 0107 esto es lo esperado: ni un ruido en los logs.
      if (!esFuncionInexistente(error)) {
        console.warn("[visitas] no se pudo leer el resumen:", error.message);
      }
      return null;
    }
    // `returns table (...)` llega como arreglo de una fila.
    const fila = (Array.isArray(data) ? data[0] : data) as
      | { hoy?: number; semana?: number }
      | null
      | undefined;
    if (!fila) return null;
    return { hoy: Number(fila.hoy ?? 0), semana: Number(fila.semana ?? 0) };
  } catch {
    return null;
  }
}
