import "server-only";

import { cookies } from "next/headers";
import { generarTokenCapacidad } from "@/lib/media/capacidad";

/**
 * LA IDENTIDAD DE QUIEN NO TIENE SESIÓN — «Hablá con Bookea» (0182).
 *
 * Un token propio de la app, NUNCA una sesión anónima de Supabase (ver
 * la cabecera de 0182 y `acciones.ts` para el porqué). Vive en una
 * cookie httpOnly: el navegador la manda solo, el JS del cliente nunca
 * la lee ni la puede leer, así que no hay "guardarla" que hacer.
 *
 * `generarTokenCapacidad` se REUSA de `@/lib/media/capacidad` en vez de
 * reimplementarse: pese al nombre, es un generador genérico de 256 bits
 * sin estructura (`randomBytes(32).toString("base64url")`), nada
 * específico de media. El hash del token (lo único que se guarda en la
 * base) se reusa igual, directo de `@/lib/media/capacidad` en
 * `acciones.ts` — no hace falta re-exportarlo acá.
 */

export const COOKIE_AYUDA = "bk_ayuda";

/** 180 días: mismo criterio que la cookie de persona de lealtad (`NOMBRE_COOKIE_PERSONA`). */
const DIAS_COOKIE_AYUDA = 180;

export function generarToken(): string {
  return generarTokenCapacidad();
}

export async function leerTokenCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_AYUDA)?.value ?? null;
}

/**
 * httpOnly + sameSite lax + secure en producción: el mismo trío que ya
 * usa `NOMBRE_COOKIE_PERSONA` en `src/app/tarjeta/[slug]/actions.ts`.
 * Secreto de conveniencia (no repetir nombre+contacto), nunca de
 * autoridad — la RLS y las políticas nunca confían en la cookie sola,
 * siempre en el hash del token comparado en el servidor.
 */
export async function escribirTokenCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_AYUDA, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS_COOKIE_AYUDA * 24 * 60 * 60,
  });
}
