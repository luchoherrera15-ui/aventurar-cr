import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { sesionDesdeBearer } from "@/lib/supabase/bearer";

/**
 * ¿Quién está viendo esta página? UNA sola vez por render.
 *
 * Problema contado en el código (no medido en producción, hace falta
 * fabricar una cookie de sesión): renderizar /eventos con la sesión
 * abierta disparaba CUATRO `auth.getUser()` distintos para responder la
 * misma pregunta — uno en `proxy.ts`, uno en la página, uno en
 * `negocio-propio.ts` y uno en `acciones-sesion.tsx`. Cada uno construye
 * su propio cliente de Supabase, así que ninguno reusaba el caché del
 * otro. Para alguien con sesión, cada uno de esos es una ida y vuelta a
 * `/auth/v1/user` (144–150 ms medidos contra ese endpoint).
 *
 * `cache()` de React deduplica por render: el primero que pregunta hace
 * el viaje y el resto recibe la misma respuesta. Para un visitante
 * anónimo no cambia nada — `getUser()` sin cookie corta sin salir a la
 * red (verificado en @supabase/auth-js: devuelve AuthSessionMissingError).
 *
 * Todo lo que renderiza en el servidor y necesite saber quién es la
 * persona debería pasar por acá.
 */
export const usuarioActual = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * El perfil de quien mira (nombre, rol, foto), también una sola vez por
 * render. Devuelve null si no hay sesión.
 */
export const perfilActual = cache(
  async (
    columnas = "nombre, rol",
  ): Promise<Record<string, unknown> | null> => {
    const user = await usuarioActual();
    if (!user) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("perfiles")
      .select(columnas)
      .eq("id", user.id)
      .maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
  },
);

/**
 * ¿Es admin quien manda esta petición? Sirve para las rutas de API que
 * atienden al sitio Y al app: el navegador manda cookies y el teléfono
 * manda `Authorization: Bearer`, así que se prueban las dos.
 *
 * El rol se consulta SIEMPRE contra la tabla `perfiles` con la sesión
 * de quien pregunta — nunca se cree lo que venga en el cuerpo ni en un
 * header. Devuelve también el id para poder dejar el gasto a su nombre.
 */
export async function adminDeLaPeticion(
  req: Request,
): Promise<{ ok: boolean; usuarioId: string | null }> {
  const sesionApp = await sesionDesdeBearer(req);
  if (sesionApp) {
    const { data } = await sesionApp.supabase
      .from("perfiles")
      .select("rol")
      .eq("id", sesionApp.usuarioId)
      .single();
    return { ok: data?.rol === "admin", usuarioId: sesionApp.usuarioId };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, usuarioId: null };

  const { data } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  return { ok: data?.rol === "admin", usuarioId: user.id };
}

/**
 * Confirma que quien hace la petición tiene una sesión con rol "admin".
 * Las políticas de seguridad de Supabase ya lo bloquean por su cuenta;
 * esto es una segunda barrera para fallar temprano y con un mensaje claro.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  return { supabase, ok: perfil?.rol === "admin" };
}

/**
 * Confirma acceso al panel de un rancho: el dueño de la publicación o
 * cualquier admin del equipo (que puede entrar a modificarla en su
 * nombre, por ejemplo cuando el proveedor pide ayuda). Las políticas de
 * la base ya permiten ambos casos — esto evita que cada acción repita
 * la misma consulta de "id" o "owner_id".
 */
export async function verificarAccesoRancho(ranchoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, ok: false as const, esAdmin: false };

  const [{ data: rancho }, { data: perfil }] = await Promise.all([
    supabase.from("ranchos").select("owner_id").eq("id", ranchoId).maybeSingle(),
    supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle(),
  ]);

  const esAdmin = perfil?.rol === "admin";
  const ok = !!rancho && (rancho.owner_id === user.id || esAdmin);
  return { supabase, user, ok, esAdmin };
}

/**
 * Acceso OPERATIVO al panel: el dueño, un admin, o un encargado que el
 * dueño sumó al negocio (`rancho_colaboradores`, migración 0116).
 *
 * ── POR QUÉ NO SE LE AGREGÓ EL ENCARGADO A LA FUNCIÓN DE ARRIBA ──────
 *
 * `verificarAccesoRancho` protege 43 acciones repartidas en 11 archivos,
 * y ahí conviven dos cosas muy distintas: mover una cita y cambiar la
 * cuenta bancaria donde entra la plata del negocio.
 *
 * Un `|| esColaborador` en esa función habilitaba las 43 de una vez,
 * incluida `guardarCuentasPagoPropio`. Un encargado habría podido
 * redirigir los cobros. Por eso son DOS funciones y la migración de cada
 * acción es explícita: lo que no se cambió a mano sigue siendo del dueño.
 *
 * La regla, en una línea: **agregar una acción al panel no le da acceso
 * al encargado hasta que alguien lo decida.**
 *
 * ── LO QUE ESTA FUNCIÓN NO CONCEDE ──────────────────────────────────
 *
 * Nada que la 0116 le haya reservado al dueño. Invitar o quitar
 * encargados, transferir el negocio y ver las cédulas de verificación
 * están bloqueados en la BASE, no acá: aunque esta función dijera que
 * sí, la RLS y el trigger `ranchos_proteger_dueno` lo rechazan igual.
 *
 * ── ESTADOS ─────────────────────────────────────────────────────────
 *
 * `rancho_colaboradores` es binaria a propósito: la fila existe y hay
 * acceso, se borra y no lo hay. No existe "invitado pendiente" ni
 * "desactivado" — quitar a alguien es borrar su fila, y el efecto es
 * inmediato.
 *
 * ── FALLA CERRADA ───────────────────────────────────────────────────
 *
 * Si la consulta falla —tabla ausente porque la 0116 no corrió, error de
 * red, RLS negando— se responde que NO. Nunca se concede acceso por no
 * haber podido comprobar lo contrario.
 */
export async function verificarAccesoOperativo(ranchoId: string) {
  const base = await verificarAccesoRancho(ranchoId);

  // Dueño o admin: ya está resuelto, y no hace falta una consulta más.
  if (base.ok || !base.user) return { ...base, esColaborador: false };

  // La consulta va con el cliente DEL USUARIO, no con `service_role`: la
  // política "Ver los colaboradores del negocio" (0116) ya le deja ver
  // su propia fila. Si algún día esa política cambia, esto deja de
  // conceder acceso — que es la dirección segura de fallar.
  const { data, error } = await base.supabase
    .from("rancho_colaboradores")
    .select("usuario_id")
    .eq("rancho_id", ranchoId)
    .eq("usuario_id", base.user.id)
    .maybeSingle();

  const esColaborador = !error && !!data;
  return { ...base, ok: esColaborador, esColaborador };
}
