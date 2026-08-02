/**
 * Quién es "yo" en un álbum donde nadie tiene cuenta.
 *
 * Los invitados suben fotos sin registrarse, así que la única identidad
 * posible es una marca que se queda en SU navegador: un token al azar
 * que se guarda una vez y se reusa en todos los álbumes.
 *
 * De ese token la base solo ve el SHA-256 (`album_foto_llaves`, 0089).
 * El token en claro no sale de este dispositivo salvo en el momento de
 * pedir un borrado, y quien lo tenga puede borrar sus fotos: es
 * exactamente el mismo trato que una llave de casa.
 *
 * La contra, que hay que decirla: si el invitado limpia el navegador o
 * cambia de teléfono, pierde el botón sobre sus propias fotos y tiene
 * que pedirle al dueño del álbum. Es el precio de no pedir cuenta.
 *
 * Todo acá adentro toca `localStorage`, así que solo corre en el
 * navegador — las funciones devuelven valores neutros en el servidor.
 */

const CLAVE_TOKEN = "bookea_album_token";
const PREFIJO_MIAS = "bookea_album_mias_";

/** Se dispara al subir, para que la grilla muestre el botón de una. */
export const EVENTO_FOTOS_MIAS = "bookea:fotos-mias";

function hayNavegador() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** El token de este navegador; lo crea la primera vez que hace falta. */
export function tokenDelNavegador(): string {
  if (!hayNavegador()) return "";
  try {
    const guardado = localStorage.getItem(CLAVE_TOKEN);
    if (guardado) return guardado;
    // randomUUID pide contexto seguro (https), que es donde vive el
    // sitio. El respaldo es para un http:// de desarrollo.
    const nuevo =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLAVE_TOKEN, nuevo);
    return nuevo;
  } catch {
    // Modo incógnito con almacenamiento bloqueado: se sube igual, solo
    // que sin poder borrar después.
    return "";
  }
}

/** El SHA-256 en hexadecimal, que es lo único que viaja a la base. */
export async function hashDelToken(token: string): Promise<string | null> {
  if (!token || typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const datos = new TextEncoder().encode(token);
    const buffer = await crypto.subtle.digest("SHA-256", datos);
    return [...new Uint8Array(buffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/** Los ids de las fotos que subió este navegador en un álbum. */
export function misFotos(albumId: string): string[] {
  if (!hayNavegador()) return [];
  try {
    const crudo = localStorage.getItem(PREFIJO_MIAS + albumId);
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Anota una foto recién subida como propia y avisa a la grilla. */
export function recordarFotoPropia(albumId: string, fotoId: string) {
  if (!hayNavegador()) return;
  try {
    const lista = [...new Set([...misFotos(albumId), fotoId])];
    localStorage.setItem(PREFIJO_MIAS + albumId, JSON.stringify(lista));
    window.dispatchEvent(new CustomEvent(EVENTO_FOTOS_MIAS, { detail: albumId }));
  } catch {
    // Sin almacenamiento no se recuerda; la foto igual quedó subida.
  }
}

/** Saca una foto de la lista propia (se borró). */
export function olvidarFotoPropia(albumId: string, fotoId: string) {
  if (!hayNavegador()) return;
  try {
    const lista = misFotos(albumId).filter((id) => id !== fotoId);
    localStorage.setItem(PREFIJO_MIAS + albumId, JSON.stringify(lista));
    window.dispatchEvent(new CustomEvent(EVENTO_FOTOS_MIAS, { detail: albumId }));
  } catch {
    // Nada que hacer: la foto ya no está en el álbum igual.
  }
}
