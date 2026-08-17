import "server-only";

import { cookies, headers } from "next/headers";
import {
  CABECERA_PAIS,
  COOKIE_PAIS,
  paisInicialDelBuscador,
} from "@/lib/pais-preferido";
import type { CodigoPais } from "@/lib/paises";

/**
 * EL PAÍS DEL VISITANTE, LEÍDO DEL REQUEST.
 *
 * La mitad sucia de `@/lib/pais-preferido`: acá se tocan la cookie y la
 * cabecera, allá viven las reglas (y sus pruebas). El `import
 * "server-only"` de arriba no es adorno — si alguien importa esto desde
 * un componente `"use client"`, el build FALLA con un mensaje claro en
 * vez de dar un 500 en runtime, que es como este repo ya se quemó dos
 * veces (Finanzas e IA).
 *
 * ── EL CACHÉ: POR QUÉ ESTO NO LO ROMPE ─────────────────────────────
 * Detectar por IP y servir una página cacheada son incompatibles: la
 * CDN guardaría la primera respuesta y le mostraría Guatemala a un
 * tico. Acá no pasa, y no por suerte: la portada YA ES DINÁMICA desde
 * antes de este cambio. `leerDatosHome()` llama a `createClient()`, que
 * llama a `cookies()` para leer la sesión de Supabase —hacen falta los
 * corazones de favoritos del visitante—, y un solo `cookies()` en el
 * árbol vuelve dinámica la ruta entera: Next responde con
 * `cache-control: private, no-cache, no-store` y la CDN nunca guarda
 * nada (ver el comentario largo de @/lib/supabase/server.ts, con las
 * mediciones).
 *
 * O sea que `headers()` acá NO cambia de categoría a la página: ya
 * estaba en la dinámica. El costo real de leer la cabecera es cero
 * —viene en el request, no hay ni I/O ni red— y por eso se resuelve
 * arriba de todo, antes del `<Suspense>`: el `<select>` sale del
 * servidor con el país correcto ya marcado, sin un parpadeo de "Costa
 * Rica" que se corrige después de hidratar.
 *
 * ⚠️ SI ALGÚN DÍA LA PORTADA SE VUELVE ESTÁTICA (por ejemplo, mudando
 * la vitrina a `createAnonClient` para ganar el HIT de la CDN), esta
 * llamada es lo que la va a seguir manteniendo dinámica. Ahí hay que
 * decidir a conciencia: o se acepta el costo, o el país pasa a
 * decidirse en el cliente después de hidratar (con su parpadeo), o se
 * separa la portada en una cáscara cacheada. Lo que NO se puede hacer
 * es cachear la respuesta con la cabecera adentro.
 */
export async function paisDelVisitante(): Promise<CodigoPais> {
  const [cookieStore, cabeceras] = await Promise.all([cookies(), headers()]);
  return paisInicialDelBuscador({
    elegido: cookieStore.get(COOKIE_PAIS)?.value,
    detectado: cabeceras.get(CABECERA_PAIS),
  });
}
