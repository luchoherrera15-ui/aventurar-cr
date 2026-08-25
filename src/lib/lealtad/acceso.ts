import type { SupabaseClient } from "@supabase/supabase-js";
import { permisosDeFila, PERMISOS_TODO, PERMISOS_NADA, type PermisosLealtad } from "./permisos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA ÚNICA IMPLEMENTACIÓN DE LOS PERMISOS DE LEALTAD
 * ════════════════════════════════════════════════════════════════════
 *
 * Hasta acá el reparto de permisos vivía dentro de `src/lib/auth.ts`,
 * mezclado con la lectura de la cookie. Eso alcanzaba mientras el único
 * cliente era el navegador. Con la app móvil hay una segunda puerta —
 * `Authorization: Bearer` — y la pregunta «¿esta persona puede acreditar
 * en este negocio?» tiene que contestarse EXACTAMENTE igual por las dos.
 *
 * ── POR QUÉ NO SE COPIA, SE PARAMETRIZA ─────────────────────────────
 *
 * El precedente ya está en producción y es la razón de que este archivo
 * exista: `src/app/api/citas/[id]/asistencia/route.ts` es una ruta
 * bearer que ESCRIBE el ledger de lealtad, y autoriza con un reparto
 * reimplementado a mano que se quedó en la forma binaria de la 0116 —
 * sin el checklist de la 0127. O sea: por esa puerta, un colaborador con
 * `acreditar: false` acredita igual.
 *
 * Copiar `verificarAccesoLealtad` para el app habría repetido ese error
 * con una variante más. Peor todavía: copiarla verbatim arrastra
 * `verificarAccesoRancho`, que resuelve la identidad POR COOKIE. En un
 * route handler eso significa que sin cookie todo el mundo recibe
 * `PERMISOS_NADA`, y CON cookie los dos lados hablan de personas
 * distintas — el teléfono manda el token de Ana y la cookie del
 * navegador dice Beto.
 *
 * Por eso las dos funciones de acá reciben el cliente y el `usuarioId`
 * POR PARÁMETRO: **una sola fuente de identidad por invocación**. La
 * puerta de cookies le pasa el cliente SSR y el usuario de la cookie; la
 * puerta bearer le pasa el cliente anónimo con el token del teléfono y
 * el usuario de ese token. Nunca las dos mezcladas.
 *
 * `src/lib/auth.ts` queda como cáscara: mismas firmas, mismos retornos,
 * cero llamadores tocados (son 43 acciones en 11 archivos).
 */

/**
 * El cliente DE QUIEN PREGUNTA, con su RLS viva.
 *
 * La marca de tipo no cambia nada en tiempo de ejecución: está para que
 * el llamador tenga que detenerse un segundo antes de pasar un
 * `createAdminClient()`. Con la llave de servicio la lógica de abajo no
 * se rompe —las tres consultas filtran por identidad igual— pero se
 * pierden dos cosas: la segunda opinión de la base, y el `!!rancho`
 * deja de esconder los ranchos que la RLS no deja ver. El chequeo
 * pasaría a depender solo de este código, que es exactamente lo que no
 * se quiere en la función que decide quién mueve saldo.
 */
export type ClienteDelUsuario = SupabaseClient & { readonly __delUsuario?: true };

export type AccesoRancho = { ok: boolean; esAdmin: boolean };

/**
 * `verificarAccesoRancho` sin cookies: el dueño de la publicación o
 * cualquier admin de plataforma.
 *
 * El `ok` exige `!!rancho` INCLUSO para el admin, y no es un detalle: un
 * rancho que no existe —o que la RLS esconde— no se administra. Las
 * rutas bearer de citas perdieron esa comprobación al reimplementarla.
 */
export async function accesoRanchoCon(
  supabase: ClienteDelUsuario,
  usuarioId: string,
  ranchoId: string,
): Promise<AccesoRancho> {
  const [{ data: rancho }, { data: perfil }] = await Promise.all([
    supabase.from("ranchos").select("owner_id").eq("id", ranchoId).maybeSingle(),
    supabase.from("perfiles").select("rol").eq("id", usuarioId).maybeSingle(),
  ]);

  const esAdmin = perfil?.rol === "admin";
  return { ok: !!rancho && (rancho.owner_id === usuarioId || esAdmin), esAdmin };
}

export type AccesoLealtad = {
  ok: boolean;
  esAdmin: boolean;
  esDueno: boolean;
  esColaborador: boolean;
  permisos: PermisosLealtad;
};

/**
 * El checklist de la 0127 resuelto, con los SIETE chequeos que tenía la
 * versión de cookies. Están numerados porque cada uno se ganó su lugar y
 * `acceso.test.ts` tiene un caso por cada uno:
 *
 *   1. `ok` exige `!!rancho`, también para el admin (ver arriba).
 *   2. Sin usuario no se llega acá: lo corta el llamante, que es quien
 *      sabe de dónde sale la identidad.
 *   3. Dueño o admin → TODO. `esDueno = !esAdmin` porque la pantalla de
 *      Equipo es solo del dueño, y la política «El dueño ajusta el rol»
 *      (0127) lo repite en la base.
 *   4. Colaborador sin fila → NADA, y `ok` sigue en false.
 *   5. Colaborador con fila → su checklist, vía `permisosDeFila`.
 *   6. Un error que NO sea «columna ausente» NIEGA, no reintenta. El
 *      fallback amplio convertía un timeout en elevación de permisos:
 *      la primera consulta falla, la segunda acierta, y un empleado con
 *      checklist recortado terminaba revirtiendo movimientos. En
 *      permisos, el empate lo pierde el permiso.
 *   7. SOLO con columna ausente (42703 / PGRST204 / el mensaje) se cae a
 *      la forma binaria de la 0116, donde el colaborador conserva el
 *      acceso total que tenía antes de esa migración.
 */
export async function resolverAccesoLealtad(
  supabase: ClienteDelUsuario,
  usuarioId: string,
  ranchoId: string,
): Promise<AccesoLealtad> {
  const base = await accesoRanchoCon(supabase, usuarioId, ranchoId);

  if (base.ok) {
    return { ...base, esDueno: !base.esAdmin, esColaborador: false, permisos: PERMISOS_TODO };
  }

  const { data, error } = await supabase
    .from("rancho_colaboradores")
    .select("rol, permisos_lealtad")
    .eq("rancho_id", ranchoId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (!error) {
    if (!data) {
      return { ...base, esDueno: false, esColaborador: false, permisos: PERMISOS_NADA };
    }
    return {
      ...base,
      ok: true,
      esDueno: false,
      esColaborador: true,
      permisos: permisosDeFila(data.rol as string | null, data.permisos_lealtad),
    };
  }

  // ¿El error es «esas columnas no existen» (0127 sin correr)?
  // 42703 = undefined_column en Postgres; PGRST204 = PostgREST sin la
  // columna en su caché de esquema. Todo lo demás NIEGA.
  const columnaAusente =
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (/rol|permisos_lealtad/.test(error.message) && /column|columna/i.test(error.message));

  if (!columnaAusente) {
    return { ...base, esDueno: false, esColaborador: false, permisos: PERMISOS_NADA };
  }

  const { data: fila, error: error2 } = await supabase
    .from("rancho_colaboradores")
    .select("usuario_id")
    .eq("rancho_id", ranchoId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  const esColaborador = !error2 && !!fila;
  return {
    ...base,
    ok: esColaborador,
    esDueno: false,
    esColaborador,
    permisos: esColaborador ? PERMISOS_TODO : PERMISOS_NADA,
  };
}
