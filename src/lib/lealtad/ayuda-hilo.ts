import type { createAdminClient } from "@/lib/supabase/admin";
import { contextoDelAlta } from "./ayuda-diseno";

/**
 * LEER EL HILO DE AYUDA DE DISEÑO (0149).
 *
 * Vive acá y no en el archivo de server actions porque lo llaman TRES
 * lados distintos: la pantalla del creador, la del editor y la bandeja
 * del admin. Un módulo `"use server"` solo puede exportar funciones
 * async —y exportar helpers desde uno rompe el build en silencio, que
 * es lo que ya pasó con Finanzas—, así que la lectura va en un módulo
 * neutral que recibe el cliente ya armado.
 *
 * NO decide permisos: quien llama ya verificó el acceso al negocio. Lo
 * único que hace acá adentro es filtrar SIEMPRE por `rancho_id`, para
 * que un id de hilo ajeno no devuelva nada aunque alguien lo escriba.
 */

type Db = NonNullable<ReturnType<typeof createAdminClient>>;

export type EstadoAyuda = "abierta" | "atendida" | "cerrada";

export type MensajeAyuda = {
  id: string;
  texto: string;
  /** El resumen automático. Solo lo trae el primer mensaje del hilo. */
  contexto: string | null;
  /** true = lo escribió el equipo de Bookea. */
  deBookea: boolean;
  autor: string;
  /** Ya formateada en hora de Costa Rica. */
  fecha: string;
};

export type HiloAyuda = {
  id: string;
  estado: EstadoAyuda;
  /** La tarjeta sobre la que se pidió. null = todavía no existía. */
  programaId: string | null;
  mensajes: MensajeAyuda[];
};

const FECHA = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Costa_Rica",
});

type Fila = {
  id: string;
  hilo_id: string | null;
  rancho_id: string;
  programa_id: string | null;
  autor_id: string;
  texto: string;
  contexto: string | null;
  estado: string;
  created_at: string;
};

function estadoDe(valor: string): EstadoAyuda {
  return valor === "atendida" || valor === "cerrada" ? valor : "abierta";
}

/**
 * Quién escribió cada mensaje: el nombre, y si es del equipo.
 *
 * «Del equipo» se pregunta por `perfiles.rol = 'admin'` y NO por «no es
 * el dueño»: un colaborador del negocio también escribe, y pintarlo
 * como si fuera Bookea le haría creer al dueño que ya le contestamos.
 */
async function quienEscribe(
  db: Db,
  ids: string[],
): Promise<Map<string, { nombre: string; admin: boolean }>> {
  if (ids.length === 0) return new Map();
  const { data } = await db.from("perfiles").select("id, nombre, rol").in("id", ids);
  return new Map(
    ((data ?? []) as { id: string; nombre: string | null; rol: string | null }[]).map((p) => [
      p.id,
      { nombre: (p.nombre ?? "").trim() || "Sin nombre", admin: p.rol === "admin" },
    ]),
  );
}

function armarHilos(
  filas: Fila[],
  quien: Map<string, { nombre: string; admin: boolean }>,
): HiloAyuda[] {
  const cabezas = filas.filter((f) => f.hilo_id === null);
  return cabezas.map((cabeza) => {
    const delHilo = [cabeza, ...filas.filter((f) => f.hilo_id === cabeza.id)].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    return {
      id: cabeza.id,
      estado: estadoDe(cabeza.estado),
      programaId: cabeza.programa_id,
      mensajes: delHilo.map((f) => {
        const autor = quien.get(f.autor_id);
        return {
          id: f.id,
          texto: f.texto,
          contexto: f.contexto,
          deBookea: autor?.admin === true,
          autor: autor?.admin ? "Bookea" : (autor?.nombre ?? "El negocio"),
          fecha: FECHA.format(new Date(f.created_at)),
        };
      }),
    };
  });
}

/**
 * Los hilos de ayuda de UN negocio, del más nuevo al más viejo.
 *
 * Devuelve `[]` —y no revienta— si la 0149 todavía no está pegada: el
 * botón sigue en pantalla y es la server action la que explica qué
 * falta. Una pantalla en blanco no le dice nada a nadie.
 */
export async function hilosDeAyuda(db: Db, ranchoId: string): Promise<HiloAyuda[]> {
  const { data, error } = await db
    .from("ayuda_diseno")
    .select("*")
    .eq("rancho_id", ranchoId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[ayuda-diseno] no se pudo leer el hilo:", error.message);
    return [];
  }

  const filas = (data ?? []) as Fila[];
  const quien = await quienEscribe(db, [...new Set(filas.map((f) => f.autor_id))]);
  return armarHilos(filas, quien);
}

/** El hilo que está esperando respuesta, si lo hay. */
export async function hiloAbiertoDeAyuda(
  db: Db,
  ranchoId: string,
): Promise<HiloAyuda | null> {
  const todos = await hilosDeAyuda(db, ranchoId);
  return todos.find((h) => h.estado !== "cerrada") ?? null;
}

/**
 * TODOS los hilos que el equipo tiene sin cerrar, de todos los
 * negocios: es lo que se pinta en /admin/complementos.
 *
 * El nombre del negocio no viene de acá —lo resuelve la página, que ya
 * trajo la lista de ranchos entera— para no repetir una consulta que ya
 * está hecha.
 */
export async function hilosAbiertosDeAyuda(db: Db): Promise<(HiloAyuda & { ranchoId: string })[]> {
  const { data, error } = await db
    .from("ayuda_diseno")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[ayuda-diseno] no se pudo leer la bandeja:", error.message);
    return [];
  }

  const filas = (data ?? []) as Fila[];
  const quien = await quienEscribe(db, [...new Set(filas.map((f) => f.autor_id))]);
  const porRancho = new Map(filas.filter((f) => f.hilo_id === null).map((f) => [f.id, f.rancho_id]));

  return armarHilos(filas, quien)
    .filter((h) => h.estado !== "cerrada")
    .map((h) => ({ ...h, ranchoId: porRancho.get(h.id) ?? "" }));
}

/**
 * LA COSTURA CON EL «CREAR PERSONALIZADO» DEL ALTA (/lealtad/nuevo).
 *
 * Ese camino ya cubría el caso de quien todavía NO tiene negocio: no se
 * duplica. Lo que le faltaba era continuación — al aprobar el alta, lo
 * que la persona escribió quedaba enterrado en una fila de
 * `solicitudes_lealtad` ya atendida, y el equipo no tenía dónde
 * contestarle ni ella dónde leer la respuesta.
 *
 * Acá el pedido se convierte en el primer mensaje de su hilo, así que
 * la conversación sigue en el mismo bloque del creador que usa todo el
 * mundo. Un pedido, una conversación.
 *
 * Va con la LLAVE DE SERVICIO y firma con el `solicitante_id`: no es un
 * mensaje que escriba el admin, es el que la persona ya escribió. Es el
 * mismo patrón del asistente (`asistente-ia.ts`), que también publica
 * en nombre de otro.
 *
 * Nunca lanza y nunca es fatal: si falla, el alta ya quedó aprobada y
 * la descripción sigue en la solicitud. Perder el negocio por esto
 * sería mucho peor.
 */
export async function abrirHiloDeAyudaDesdeAlta(
  db: Db,
  datos: { ranchoId: string; solicitanteId: string; negocioNombre: string; pedido: string },
): Promise<void> {
  const texto = datos.pedido.trim().slice(0, 2000);
  if (texto.length < 1) return;

  const { error } = await db.from("ayuda_diseno").insert({
    hilo_id: null,
    rancho_id: datos.ranchoId,
    programa_id: null,
    autor_id: datos.solicitanteId,
    texto,
    contexto: contextoDelAlta(datos.negocioNombre),
    estado: "abierta",
  });

  // 23505 = ya hay un hilo abierto para ese negocio. Aprobar dos veces
  // no puede abrir dos conversaciones sobre lo mismo.
  if (error && error.code !== "23505") {
    console.warn("[ayuda-diseno] no se pudo abrir el hilo del alta:", error.message);
  }
}
