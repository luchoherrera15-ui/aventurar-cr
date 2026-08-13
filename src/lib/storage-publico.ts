/**
 * ¿Esta URL es de NUESTRO storage público?
 *
 * La pregunta la hacen las server actions que reciben una URL subida
 * por el navegador (logo del pase, comprobante del depósito): aceptar
 * cualquier URL dejaría a un tercero haciendo que la tarjeta de un
 * negocio sirva una imagen suya.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO SE COMPARA CON `startsWith`
 * ------------------------------------------------------------------
 * Así estaba, y rompió el creador de tarjetas en producción: todo
 * logo daba «El logo no se subió bien».
 *
 *     const prefijo = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/…`;
 *     url.startsWith(prefijo)   // ← frágil
 *
 * El prefijo se arma pegando strings, pero la URL del cliente la arma
 * `supabase-js`, que NORMALIZA lo que le pasan. Alcanza con que la
 * variable de entorno traiga un carácter de más para que los dos
 * dejen de coincidir, y son tres formas distintas de romperse:
 *
 *   · barra final  — supabase-js hace `replace(/\/$/, '')`; el
 *     template no, y queda `…co//storage/…` contra `…co/storage/…`;
 *   · espacios o \n — este repo YA los sufrió en Vercel con esta
 *     misma variable (ver a/[slug]/page.tsx, que por eso hace .trim());
 *   · variable ausente en el servidor — el prefijo arranca con el
 *     texto "undefined" y NADA valida jamás.
 *
 * Los tres fallan en silencio, del lado del servidor, y se ven como
 * "no se subió bien" — que manda a mirar justo donde no está el bug.
 *
 * Comparar estructuralmente los cierra de una: se normaliza, se parsea
 * con `URL`, y se comparan host y ruta. Un carácter de más en la
 * variable ya no cambia el veredicto.
 */

/** Quita espacios, saltos de línea y barras finales. */
function normalizarBase(valor: string | undefined): string {
  return (valor ?? "").trim().replace(/\/+$/, "");
}

/**
 * El host de nuestro proyecto de Supabase, si se puede saber.
 * null = la variable no está o no se puede parsear.
 */
function hostDeSupabase(): string | null {
  const base = normalizarBase(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!base) return null;
  try {
    return new URL(base).host.toLowerCase();
  } catch {
    return null;
  }
}

export function esUrlDeNuestroStorage(url: string, bucket: string): boolean {
  const limpia = (url ?? "").trim();
  if (!limpia) return false;

  let parsed: URL;
  try {
    parsed = new URL(limpia);
  } catch {
    return false;
  }

  // Solo https: una URL http:// serviría el logo por un canal que el
  // navegador va a bloquear dentro de una página segura.
  if (parsed.protocol !== "https:") return false;

  // La ruta tiene que ser la del objeto público de ESE bucket.
  const rutaEsperada = `/storage/v1/object/public/${bucket}/`;
  if (!parsed.pathname.startsWith(rutaEsperada)) return false;
  // …y apuntar a un objeto, no quedarse en la carpeta.
  if (parsed.pathname.length <= rutaEsperada.length) return false;

  const host = parsed.host.toLowerCase();
  const nuestro = hostDeSupabase();

  // Con la variable sana, la comparación es exacta.
  if (nuestro) return host === nuestro;

  // Sin ella (mal configurada en el servidor) NO se aprueba cualquier
  // cosa: se exige que al menos sea un host de Supabase. Es más
  // flojo que comparar el proyecto, pero sigue cerrándole la puerta a
  // un dominio ajeno — y, sobre todo, no rompe el alta de un negocio
  // por un problema de configuración que el usuario no puede resolver.
  return host.endsWith(".supabase.co") || host.endsWith(".supabase.in");
}
