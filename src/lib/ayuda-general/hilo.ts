import type { createAdminClient } from "@/lib/supabase/admin";
import type { HiloAyudaGeneral, MensajeAyudaGeneral } from "./tipos";

/**
 * LEER EL HILO DE «HABLÁ CON BOOKEA» (0182).
 *
 * Mismo rol que `@/lib/lealtad/ayuda-hilo.ts`: un módulo neutral (sin
 * "use server", sin "use client") que arma `HiloAyudaGeneral[]` desde
 * las filas crudas de `mensajes_ayuda_general`, para que `acciones.ts`
 * pueda exportar SOLO funciones async (un módulo "use server" que
 * exportara un helper rompería el build en silencio — ya pasó con
 * Finanzas).
 *
 * NO decide permisos: quien llama ya verificó el acceso (sesión
 * comprobada, o token de cookie ya hasheado y comparado). Por eso
 * recibe siempre el cliente de SERVICIO — igual que `ayuda-hilo.ts`,
 * que también lee siempre con la llave de servicio incluso para la
 * bandeja del admin (ver `hilosAbiertosDeAyuda`, llamado con `admin`
 * en `/admin/complementos/page.tsx`).
 *
 * Ningún `select()` de este archivo pide `token_hash`: se listan las
 * columnas a mano, nunca `select("*")`, así el secreto no puede viajar
 * a un tipo devuelto aunque mañana se agregue una columna sensible más.
 */

type Db = NonNullable<ReturnType<typeof createAdminClient>>;

const TOPE_HILOS_AYUDA = 300;

const COLUMNAS =
  "id, hilo_id, visitante_clave, autor_id, de_bookea, texto, nombre, contacto, estado, created_at";

type Fila = {
  id: string;
  hilo_id: string | null;
  visitante_clave: string;
  autor_id: string | null;
  de_bookea: boolean;
  texto: string;
  nombre: string | null;
  contacto: string | null;
  estado: string;
  created_at: string;
};

const FECHA = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Costa_Rica",
});

function mapMensaje(f: Fila): MensajeAyudaGeneral {
  return {
    id: f.id,
    texto: f.texto,
    deBookea: f.de_bookea,
    fecha: FECHA.format(new Date(f.created_at)),
    autorId: f.autor_id,
  };
}

/** Cabeza + sus respuestas, ya ordenadas, en el tipo que consume la UI. */
function armarHilo(cabeza: Fila, filas: Fila[]): HiloAyudaGeneral {
  const delHilo = [cabeza, ...filas.filter((f) => f.hilo_id === cabeza.id)].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  return {
    id: cabeza.id,
    estado: cabeza.estado === "cerrada" ? "cerrada" : "abierta",
    nombre: (cabeza.nombre ?? "").trim() || "Sin nombre",
    contacto: (cabeza.contacto ?? "").trim(),
    mensajes: delHilo.map(mapMensaje),
  };
}

/**
 * El hilo de UN visitante (clave = 'u:<uuid>' o 'a:<hash>'). Si la
 * persona tuvo más de una conversación a lo largo del tiempo (abrió,
 * Bookea la cerró, más adelante escribió por algo distinto), se toma
 * la más RECIENTE — es la que corresponde seguir cuando alguien vuelve
 * a /ayuda; las anteriores quedan en la base como historial, visibles
 * para el admin vía `hilosParaAdmin`.
 */
export async function hiloPorClave(db: Db, clave: string): Promise<HiloAyudaGeneral | null> {
  const { data, error } = await db
    .from("mensajes_ayuda_general")
    .select(COLUMNAS)
    .eq("visitante_clave", clave)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[ayuda-general] no se pudo leer el hilo:", error.message);
    return null;
  }

  const filas = (data ?? []) as Fila[];
  const cabezas = filas
    .filter((f) => f.hilo_id === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const cabeza = cabezas[0];
  return cabeza ? armarHilo(cabeza, filas) : null;
}

/**
 * El hilo de un visitante SIN sesión, a partir del sha-256 de su cookie.
 * `token_hash` se filtra pero nunca se selecciona (ver cabecera).
 */
export async function hiloPorTokenHash(db: Db, hash: string): Promise<HiloAyudaGeneral | null> {
  const { data, error } = await db
    .from("mensajes_ayuda_general")
    .select(COLUMNAS)
    .eq("token_hash", hash)
    .is("hilo_id", null)
    .maybeSingle();

  if (error || !data) return null;
  return hiloPorClave(db, (data as Fila).visitante_clave);
}

/** El último mensaje de un hilo — lo que necesita `mandarMensaje` para devolver algo sin releer el hilo entero. */
export async function ultimoMensajeDelHilo(
  db: Db,
  hiloId: string,
): Promise<MensajeAyudaGeneral | null> {
  const { data, error } = await db
    .from("mensajes_ayuda_general")
    .select(COLUMNAS)
    .eq("hilo_id", hiloId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapMensaje(data as Fila);
}

/**
 * TODOS los hilos (cabezas), para la bandeja del admin. Tope de 300 —
 * mismo criterio de "decirlo en pantalla si corta" que ya usa
 * `/admin/complementos/page.tsx` con sus propios topes.
 *
 * El orden de "sin contestar primero" es de la PANTALLA (se calcula
 * igual que en `ayuda-panel.tsx`: `!mensajes.some(m => m.deBookea)`),
 * no de acá — acá se devuelve por última cabeza creada, más reciente
 * primero, que ya es un orden razonable si nadie reordena encima.
 */
export async function hilosParaAdmin(db: Db): Promise<HiloAyudaGeneral[]> {
  const { data: cabezasData, error: errorCabezas } = await db
    .from("mensajes_ayuda_general")
    .select(COLUMNAS)
    .is("hilo_id", null)
    .order("created_at", { ascending: false })
    .limit(TOPE_HILOS_AYUDA);

  if (errorCabezas) {
    console.warn("[ayuda-general] no se pudo leer la bandeja:", errorCabezas.message);
    return [];
  }

  const cabezas = (cabezasData ?? []) as Fila[];
  if (cabezas.length === 0) return [];

  const { data: respuestasData, error: errorRespuestas } = await db
    .from("mensajes_ayuda_general")
    .select(COLUMNAS)
    .in(
      "hilo_id",
      cabezas.map((c) => c.id),
    )
    .order("created_at", { ascending: true });

  if (errorRespuestas) {
    console.warn("[ayuda-general] no se pudieron leer las respuestas de la bandeja:", errorRespuestas.message);
  }

  const respuestas = (respuestasData ?? []) as Fila[];
  return cabezas.map((c) => armarHilo(c, respuestas));
}
