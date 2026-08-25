import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { sesionDesdeBearer } from "@/lib/supabase/bearer";
import { PERMISOS_NADA } from "@/lib/lealtad/permisos";
import { accesoRanchoCon, resolverAccesoLealtad } from "@/lib/lealtad/acceso";

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

  // El reparto vive en `@/lib/lealtad/acceso`, que lo resuelve para la
  // puerta de cookies y la del app con el MISMO código. Acá solo se
  // resuelve la identidad —la cookie— y se le pasa. Ver ese archivo.
  const { ok, esAdmin } = await accesoRanchoCon(supabase, user.id, ranchoId);
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

/**
 * Acceso al módulo de LEALTAD, con el checklist de la 0127 resuelto.
 *
 * `verificarAccesoOperativo` responde una pregunta binaria: ¿puede
 * entrar? Lealtad necesita cuatro más: ¿puede acreditar, canjear,
 * revertir, ver la auditoría? El dueño y el admin de plataforma pueden
 * todo; un colaborador depende de su rol ('administrador' = todo,
 * 'empleado' = su checklist).
 *
 * `esDueno` distingue al dueño del resto porque la pantalla de Equipo
 * (editar roles) es SOLO suya — la política "El dueño ajusta el rol"
 * (0127) lo repite en la base.
 *
 * Si la 0127 todavía no corrió, las columnas no existen y la consulta
 * falla con "columna ausente": SOLO en ese caso se reintenta a la forma
 * binaria de la 0116, donde el colaborador conserva el acceso total que
 * tenía antes de esa migración. Cualquier OTRO error (timeout, red,
 * RLS) niega — la revisión adversaria encontró que el fallback amplio
 * convertía un error transitorio en elevación de permisos: la primera
 * consulta falla, la segunda acierta, y un empleado con checklist
 * recortado revertía movimientos. En permisos, el empate se pierde.
 */
export async function verificarAccesoLealtad(ranchoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      ok: false as const,
      esAdmin: false,
      esDueno: false,
      esColaborador: false,
      permisos: PERMISOS_NADA,
    };
  }

  // Los siete chequeos de la 0127 viven en `@/lib/lealtad/acceso`, que
  // es también lo que usa la puerta del app. Una sola implementación:
  // el día que cambie el reparto, cambia para las dos a la vez.
  return { supabase, user, ...(await resolverAccesoLealtad(supabase, user.id, ranchoId)) };
}

/**
 * LA MISMA PREGUNTA, PERO PARA LA APP MÓVIL.
 *
 * Vive al lado de `adminDeLaPeticion`, que ya autentica por bearer, y
 * comparte con `verificarAccesoLealtad` el reparto entero — lo único
 * distinto es de dónde sale la identidad.
 *
 * ⚠️ NUNCA se cae a la cookie. Sin `Authorization` devuelve null y el
 * llamador responde 401. Aceptar «bearer o cookie» en un endpoint con
 * `Access-Control-Allow-Origin: *` es la receta del CSRF: un formulario
 * de cualquier sitio podría acreditarle sellos al negocio usando la
 * sesión abierta del dueño. `adminDeLaPeticion` sí acepta las dos porque
 * atiende también al panel web; estas rutas son solo del teléfono.
 */
export async function accesoLealtadDeLaPeticion(req: Request, ranchoId: string) {
  const sesion = await sesionDesdeBearer(req);
  if (!sesion) return null;

  const acceso = await resolverAccesoLealtad(sesion.supabase, sesion.usuarioId, ranchoId);
  return { ...acceso, supabase: sesion.supabase, usuarioId: sesion.usuarioId };
}
