import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RolColaborador } from "./tipos";

/**
 * EL PORTÓN DEL PANEL DE SOLUTIONS.
 *
 * Copia el PATRÓN de resolverAccesoLealtad (src/lib/lealtad/acceso.ts)
 * sin importarlo: Solutions no depende de ranchos, y ese resolver mira
 * `ranchos.owner_id` y `rancho_colaboradores`. Este mira
 * `solutions_negocios` y `solutions_colaboradores`.
 *
 * Reglas, en orden:
 *   1. Sin sesión → nadie.
 *   2. Admin de Bookea (perfiles.rol = 'admin') → todo, como dueño.
 *   3. Dueño (owner_id) → todo.
 *   4. Colaborador con fila y usuario vinculado → según su rol:
 *      'admin' edita todo, 'equipo' solo atiende comandas.
 *   5. Colaborador invitado por correo y todavía SIN usuario_id: si el
 *      correo de la sesión coincide, se vincula acá mismo (la primera
 *      vez que entra) y pasa. Así la invitación funciona sin que el
 *      dueño tenga que saber el id de nadie.
 *   6. Cualquier error NIEGA. En permisos, el empate lo pierde el
 *      permiso.
 */

export type AccesoSolutions =
  | { ok: false; user: null }
  | { ok: false; user: { id: string; email: string | null }; motivo: string }
  | {
      ok: true;
      user: { id: string; email: string | null };
      esDueno: boolean;
      esAdmin: boolean;
      rol: RolColaborador;
      /** Puede editar página, links, menú, mesas y equipo. */
      puedeEditar: boolean;
    };

export async function verificarAccesoSolutions(negocioId: string): Promise<AccesoSolutions> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, user: null };

  const yo = { id: user.id, email: user.email ?? null };
  const admin = createAdminClient();
  if (!admin) return { ok: false, user: yo, motivo: "Falta la llave de servicio." };

  const { data: negocio, error } = await admin
    .from("solutions_negocios")
    .select("id, owner_id")
    .eq("id", negocioId)
    .maybeSingle();
  if (error || !negocio) return { ok: false, user: yo, motivo: "Ese negocio no existe." };

  // Admin de Bookea: mismo criterio que el resto del sitio (perfiles.rol).
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const esAdmin = perfil?.rol === "admin";
  if (esAdmin || negocio.owner_id === user.id) {
    return {
      ok: true,
      user: yo,
      esDueno: negocio.owner_id === user.id,
      esAdmin,
      rol: "admin",
      puedeEditar: true,
    };
  }

  // Colaborador vinculado.
  const { data: fila } = await admin
    .from("solutions_colaboradores")
    .select("rol, usuario_id, correo")
    .eq("negocio_id", negocioId)
    .or(`usuario_id.eq.${user.id},correo.eq.${(user.email ?? "").toLowerCase()}`)
    .maybeSingle();
  if (!fila) return { ok: false, user: yo, motivo: "No sos parte del equipo de este negocio." };

  // Invitación por correo aún sin usuario: se vincula ahora.
  if (!fila.usuario_id && user.email && fila.correo === user.email.toLowerCase()) {
    await admin
      .from("solutions_colaboradores")
      .update({ usuario_id: user.id })
      .eq("negocio_id", negocioId)
      .eq("correo", fila.correo);
  }

  const rol: RolColaborador = fila.rol === "admin" ? "admin" : "equipo";
  return { ok: true, user: yo, esDueno: false, esAdmin: false, rol, puedeEditar: rol === "admin" };
}

/** Los negocios de Solutions a los que esta cuenta puede entrar. */
export async function negociosDeLaCuenta(): Promise<
  { id: string; nombre: string; slug: string; publicado: boolean; esDueno: boolean }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const admin = createAdminClient();
  if (!admin) return [];

  const [{ data: propios }, { data: colab }] = await Promise.all([
    admin
      .from("solutions_negocios")
      .select("id, nombre, slug, publicado")
      .eq("owner_id", user.id)
      .order("creado_en", { ascending: true }),
    admin
      .from("solutions_colaboradores")
      .select("negocio_id")
      .or(`usuario_id.eq.${user.id},correo.eq.${(user.email ?? "").toLowerCase()}`),
  ]);

  const lista = (propios ?? []).map((n) => ({
    id: n.id as string,
    nombre: n.nombre as string,
    slug: n.slug as string,
    publicado: n.publicado === true,
    esDueno: true,
  }));

  const idsColab = (colab ?? []).map((c) => c.negocio_id as string).filter((id) => !lista.some((n) => n.id === id));
  if (idsColab.length > 0) {
    const { data: ajenos } = await admin
      .from("solutions_negocios")
      .select("id, nombre, slug, publicado")
      .in("id", idsColab);
    for (const n of ajenos ?? []) {
      lista.push({
        id: n.id as string,
        nombre: n.nombre as string,
        slug: n.slug as string,
        publicado: n.publicado === true,
        esDueno: false,
      });
    }
  }
  return lista;
}
