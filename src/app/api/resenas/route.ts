import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS RESEÑAS DE UN NEGOCIO, CON EL NOMBRE DE QUIEN LAS ESCRIBIÓ
 * ════════════════════════════════════════════════════════════════════
 *
 * La app móvil mostraba las reseñas SIN nombre. No era un descuido de la
 * pantalla: es que no puede resolverlo. Comprobado contra producción con
 * la anon key —la misma que usa el teléfono—:
 *
 *   · `resenas`  → se lee bien (son públicas).
 *   · `perfiles` → «permission denied for table perfiles».
 *
 * O sea que el teléfono tiene el `cliente_id` de cada reseña y ninguna
 * forma de convertirlo en un nombre. La web sí lo hace, pero porque
 * corre en el servidor con la llave de servicio (ver
 * `citas/[slug]/page.tsx`, que hace exactamente esta consulta de dos
 * pasos).
 *
 * ── POR QUÉ ESTE ENDPOINT RECIBE UN NEGOCIO Y NO UNA LISTA DE IDS ───
 *
 * Lo obvio sería `?ids=uuid,uuid` y devolver `{id: nombre}`. Eso sería
 * un traductor público de id de usuario a nombre real: cualquiera podría
 * ir pasándole ids y armarse un padrón. No hay ninguna razón para
 * ofrecer eso.
 *
 * Pidiendo el NEGOCIO, lo que sale es exactamente lo que ya es público
 * en la ficha de ese negocio —sus reseñas, con el nombre de quien las
 * firmó— y nada más. No se puede preguntar por una persona.
 *
 * ── LO QUE NO DEVUELVE ──────────────────────────────────────────────
 *
 * Ni `cliente_id`, ni correo, ni teléfono, ni `reserva_id`. Solo lo que
 * se pinta: estrellas, comentario, fecha y nombre. Lo que no viaja no se
 * puede filtrar.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cuántas se devuelven. Las mismas seis que muestra la ficha web. */
const TOPE = 6;

type ResenaFila = {
  id: string;
  cliente_id: string | null;
  calificacion: number;
  comentario: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ranchoId = (url.searchParams.get("ranchoId") ?? "").trim();

  if (!UUID.test(ranchoId)) {
    return Response.json({ ok: false, motivo: "Negocio inválido." }, { status: 400 });
  }

  const db = createAdminClient();
  if (!db) {
    return Response.json({ ok: false, motivo: "No hay conexión." }, { status: 503 });
  }

  const { data, error } = await db
    .from("resenas")
    .select("id, cliente_id, calificacion, comentario, created_at")
    .eq("rancho_id", ranchoId)
    .order("created_at", { ascending: false })
    .limit(TOPE);

  if (error) {
    return Response.json({ ok: false, motivo: "No se pudieron leer." }, { status: 503 });
  }

  const filas = (data ?? []) as ResenaFila[];

  // Los nombres, en UNA consulta y no una por reseña. Mismo patrón de
  // dos pasos que usa la ficha web: primero las reseñas, después los
  // perfiles de los `cliente_id` que salieron.
  const ids = [...new Set(filas.map((r) => r.cliente_id).filter((v): v is string => !!v))];
  const { data: perfiles } =
    ids.length > 0 ? await db.from("perfiles").select("id, nombre").in("id", ids) : { data: [] };

  const nombrePor = new Map(
    ((perfiles ?? []) as { id: string; nombre: string | null }[]).map((p) => [p.id, p.nombre]),
  );

  return Response.json({
    ok: true,
    resenas: filas.map((r) => ({
      id: r.id,
      calificacion: r.calificacion,
      comentario: r.comentario,
      fecha: r.created_at,
      // «Cliente» y no el correo ni un id cuando el perfil no tiene
      // nombre: quien se afilió por el QR sin cuenta (0138) no tiene
      // fila en `perfiles`, y mostrar un uuid delante de una reseña de
      // cinco estrellas se lee como un error del sistema.
      autor: (nombrePor.get(r.cliente_id ?? "") ?? "").trim() || "Cliente",
    })),
  });
}
