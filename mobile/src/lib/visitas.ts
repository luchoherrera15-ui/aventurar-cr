import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { sha256Hex } from "@/lib/sha256";

/**
 * "12 personas visitaron este sitio hoy" — la prueba social de la
 * página de un negocio, con números REALES (tabla `visitas_pagina`,
 * migración 0107). Acá no se infla ni se inventa nada.
 *
 * LA REGLA DE LOS 3, que es la que evita que juegue en contra: un
 * número bajo vende MENOS que ningún número. Nadie quiere leer "1
 * persona visitó este sitio hoy".
 *   · 3 o más visitas hoy      → "N personas visitaron este sitio hoy"
 *   · si no, 3 o más esta semana → "…esta semana"
 *   · si no                    → no se muestra nada.
 *
 * QUIÉN ES "UNA PERSONA" EN LA APP. La web arma la huella en su
 * servidor con la IP, el navegador, el día y una sal secreta. Un
 * teléfono no tiene servidor propio, así que acá la identidad es un
 * token al azar que se guarda UNA vez en el almacenamiento de la app —
 * el mismo trato que `src/app/a/[slug]/identidad.ts` en la web. De ese
 * token no viaja nunca el valor en claro: a la base solo va el
 * SHA-256, y como al hash se le suma el DÍA, la huella cambia sola
 * cada medianoche y no se puede seguir a nadie de un día para el otro.
 *
 * POR QUÉ NO HAY SAL SECRETA ACÁ: una sal en el bundle de una app no
 * es secreta — cualquiera la extrae del .apk. La protección real es
 * otra: el token es aleatorio por instalación y no se deriva de nada
 * de la persona (ni IP, ni id, ni correo), así que no hay nada que
 * "adivinar" hasheando. La constante `DOMINIO` no es una sal: solo
 * separa este hash de cualquier otro uso futuro del mismo token.
 *
 * SI LA 0107 NO ESTÁ CORRIDA todavía, las funciones no existen: cada
 * llamada devuelve error, se traga en silencio y la tarjeta no
 * aparece. Nada revienta.
 */

/** El token vive aparte del `device_id` de `device.ts` a propósito: ese
 *  se guarda en claro en `reservas.creado_por_ip` y lo ve el negocio.
 *  Este no sale nunca del teléfono. */
const CLAVE_TOKEN = "bookea:visitas_token";

/** Separa este hash de cualquier otro uso del token. No es un secreto. */
const DOMINIO = "bookea:visita";

/** Menos de esto no se muestra. Ver "la regla de los 3" arriba. */
export const MINIMO_VISITAS = 3;

export type ResumenVisitas = { hoy: number; semana: number };

/** Lo que termina en la tarjeta: el número aparte, para resaltarlo. */
export type AvisoVisitas = { numero: number; texto: string };

/**
 * "YYYY-MM-DD" del día EN COSTA RICA, que es el día con el que la base
 * guarda la fila. Se calcula con el desfase fijo de UTC−6 en vez de
 * `Intl`: Costa Rica no mueve el reloj desde 1992, y así el día no
 * depende ni de la zona horaria del teléfono (un turista) ni de qué
 * tanto ICU trajo Hermes en esta plataforma.
 */
function diaCostaRica(): string {
  return new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);
}

/** El token de esta instalación; se crea la primera vez que hace falta. */
async function tokenDelDispositivo(): Promise<string | null> {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_TOKEN);
    if (guardado) return guardado;
    const nuevo = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(CLAVE_TOKEN, nuevo);
    return nuevo;
  } catch {
    // Sin almacenamiento no hay forma de contar una persona sin
    // contarla de nuevo en cada apertura: mejor no contarla.
    return null;
  }
}

/**
 * La huella que viaja a la base: 64 caracteres hexadecimales y nada
 * más. El SHA-256 ya mide exactamente 64, el recorte es el mismo
 * cinturón que se puso la función `registrar_visita` (`left(…, 64)`).
 */
async function huellaDeHoy(): Promise<string | null> {
  const token = await tokenDelDispositivo();
  if (!token) return null;
  return sha256Hex(`${DOMINIO}|${token}|${diaCostaRica()}`).slice(0, 64);
}

/**
 * Anota que este dispositivo abrió la página del negocio. Entrar diez
 * veces el mismo día cuenta UNA: la llave primaria de la tabla hace el
 * trabajo, acá no hay nada que revisar.
 */
export async function registrarVisita(ranchoId: string): Promise<void> {
  if (!ranchoId) return;
  try {
    const visitante = await huellaDeHoy();
    if (!visitante) return;
    // El error se ignora a propósito: si la 0107 todavía no está
    // corrida, la función no existe (PGRST202) y no pasa nada. Contar
    // una visita jamás puede tumbar la pantalla del negocio.
    await supabase.rpc("registrar_visita", {
      p_rancho: ranchoId,
      p_visitante: visitante,
    });
  } catch {
    // Sin red, sin base, sin nada: la página se ve igual.
  }
}

/**
 * Los dos conteos del negocio. Es la ÚNICA lectura posible: las filas
 * sueltas de `visitas_pagina` no las lee nadie (RLS sin policies),
 * porque serían un registro de quién entró a qué.
 */
export async function leerVisitas(ranchoId: string): Promise<ResumenVisitas | null> {
  if (!ranchoId) return null;
  try {
    const { data, error } = await supabase.rpc("visitas_pagina_resumen", {
      p_rancho: ranchoId,
    });
    if (error) return null;
    // La función devuelve una tabla: PostgREST manda un arreglo de filas.
    const fila: unknown = Array.isArray(data) ? data[0] : data;
    if (!fila || typeof fila !== "object") return null;
    const crudo = fila as { hoy?: unknown; semana?: unknown };
    const hoy = Number(crudo.hoy);
    const semana = Number(crudo.semana);
    if (!Number.isFinite(hoy) || !Number.isFinite(semana)) return null;
    return { hoy: Math.trunc(hoy), semana: Math.trunc(semana) };
  } catch {
    return null;
  }
}

/**
 * La regla de los 3 hecha texto. Devuelve `null` cuando el número no
 * alcanza — y entonces no se muestra NADA, que es mejor que mostrar
 * poco.
 *
 * Siempre da plural porque el mínimo es 3; si algún día bajara, la
 * frase habría que declinarla.
 */
export function describirVisitas(resumen: ResumenVisitas | null): AvisoVisitas | null {
  if (!resumen) return null;
  if (resumen.hoy >= MINIMO_VISITAS) {
    return { numero: resumen.hoy, texto: "personas visitaron este sitio hoy" };
  }
  if (resumen.semana >= MINIMO_VISITAS) {
    return { numero: resumen.semana, texto: "personas visitaron este sitio esta semana" };
  }
  return null;
}
