import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * DE QUIÉN ES EL PASE, Y QUÉ SE LE DICE CUANDO NO SE PUEDE ENTREGAR.
 *
 * Vive aparte de `generar.ts` y `google.ts` porque lo comparten los
 * dos, y porque las rutas que atienden al navegador necesitan el código
 * de fallo sin arrastrar node-forge ni sharp para leerlo. El bloque de
 * afiliación ya estuvo copiado literal en los dos archivos una vez —con
 * el mismo bug del cupo en ambos (ver `cupo.ts`)—; esta vez está en un
 * solo lugar desde el principio.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * POR QUÉ EL FALLO TRAE UN CÓDIGO Y NO SOLO UN TEXTO.
 *
 * El botón del pase es un `<a href>`: el navegador NAVEGA. Cuando el
 * generador devolvía `{ok:false, motivo}` y la ruta lo empaquetaba en
 * un `NextResponse.json(..., {status:409})`, el cliente parado en la
 * barbería se quedaba mirando una pantalla blanca con
 *
 *     {"error":"El programa de este negocio está lleno por ahora..."}
 *
 * y eso pasaba con el cliente 201, con el certificado vencido, con el
 * programa pausado y con el servidor sin credenciales. El código es lo
 * que le permite a la ruta llevarlo de vuelta a la página de la tarjeta
 * con una pantalla de verdad. El `motivo` sigue ahí, en español, para
 * los llamadores que no son un navegador (el refresco de Wallet, el
 * trabajo por tandas, los logs).
 */
export type CodigoFalloPase =
  /** El servidor no tiene el certificado, o venció. */
  | "sin_credenciales"
  | "sin_conexion"
  | "negocio_desconocido"
  | "sin_programa"
  | "pausado"
  | "lleno"
  | "cancelada"
  /** Ni cookie de persona ni sesión: no sabemos de quién es la tarjeta. */
  | "sin_identidad"
  | "error";

export const CODIGOS_FALLO_PASE: readonly CodigoFalloPase[] = [
  "sin_credenciales",
  "sin_conexion",
  "negocio_desconocido",
  "sin_programa",
  "pausado",
  "lleno",
  "cancelada",
  "sin_identidad",
  "error",
];

/** ¿Este texto suelto (un `?problema=` de la URL) es un código nuestro? */
export function esCodigoDeFallo(valor: string | null | undefined): valor is CodigoFalloPase {
  return typeof valor === "string" && (CODIGOS_FALLO_PASE as readonly string[]).includes(valor);
}

/**
 * QUIÉN ES EL DUEÑO DEL PASE.
 *
 * Desde la 0138 la identidad raíz es la PERSONA, no la cuenta: alguien
 * que escaneó el póster y dejó su WhatsApp y su correo tiene tarjeta,
 * saldo y pase sin haber abierto sesión en Bookea nunca. `clienteId`
 * bajó a costura opcional, para quien además tenga cuenta.
 *
 * Se aceptan los dos y se prefiere la persona: una membresía puede
 * tener `cliente_id` en null (alta por QR) o `persona_id` en null (base
 * sin la 0138), y buscar por la que hay es lo que evita afiliar dos
 * veces al mismo humano.
 */
export type IdentidadDelPase = {
  /** La persona (0138). Es la llave desde que existe. */
  personaId?: string | null;
  /** Su cuenta de Bookea, si tiene. Ya verificada por quien llama. */
  clienteId?: string | null;
};

/** Lo que hace falta saber del miembro para seguir armando el pase. */
export type MiembroDelPase = { id: string; estado: string; cliente_id?: string | null };

/**
 * La membresía de quien pide, buscada por persona y por cuenta.
 *
 * Los dos caminos, en ese orden, y no uno solo:
 *   · por PERSONA encuentra al que se afilió por el póster sin cuenta
 *     —su fila tiene `cliente_id` en null— y también al que después
 *     abrió cuenta, porque la persona es la misma;
 *   · por CUENTA cubre las membresías de una base donde la 0138 todavía
 *     no corrió y `persona_id` ni siquiera existe como columna.
 *
 * Nunca lanza: si la columna no está, PostgREST devuelve error, se
 * ignora y se sigue por el otro camino.
 */
export async function buscarMiembroDelPase(
  db: Admin,
  programaId: string,
  quien: IdentidadDelPase,
): Promise<MiembroDelPase | null> {
  for (const [columna, valor] of [
    ["persona_id", quien.personaId],
    ["cliente_id", quien.clienteId],
  ] as const) {
    if (!valor) continue;
    const { data, error } = await db
      .from("miembros")
      .select("id, estado, cliente_id")
      .eq("programa_id", programaId)
      .eq(columna, valor)
      .maybeSingle();
    if (error || !data) continue;
    return data as MiembroDelPase;
  }
  return null;
}

/**
 * Lo que se inserta al afiliar. `persona_id` SOLO si lo hay: en una
 * base sin la 0138 la columna no existe y nombrarla haría fallar el
 * insert entero, dejando sin tarjeta a todo el mundo.
 */
export function filaDeAfiliacion(programaId: string, quien: IdentidadDelPase) {
  return {
    programa_id: programaId,
    ...(quien.personaId ? { persona_id: quien.personaId } : {}),
    cliente_id: quien.clienteId ?? null,
    estado: "activa",
  };
}
