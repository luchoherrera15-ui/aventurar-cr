import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tieneNegocioPropio } from "@/lib/negocio-propio";
import MenuCuentaPortada from "./menu-cuenta-portada";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS ACCIONES DEL HEADER DE LA PORTADA, SEGÚN HAYA SESIÓN O NO
 * ════════════════════════════════════════════════════════════════════
 *
 * Sin sesión:  «Iniciar sesión» + «Publicá tu negocio» (lo de siempre).
 * Con sesión:  el nombre de la persona con su menú + «Publicá tu
 *              negocio» (o «Mi negocio», si ya publicó uno).
 *
 * Componente de SERVIDOR: la sesión se lee acá y baja resuelta. El
 * desplegable, que sí necesita estado, vive aparte en
 * `menu-cuenta-portada.tsx`.
 *
 * ── EL HEADER DEJA DE SER ESTÁTICO, Y ES A PROPÓSITO ────────────────
 *
 * `HeaderSimple` era un componente sin datos. Al leer la cookie de
 * sesión, la portada ya no puede servir una única versión cacheada para
 * todo el mundo — y no debería: un header cacheado con el nombre de
 * alguien adentro es exactamente cómo se le muestra la sesión de una
 * persona a otra. La portada ya era dinámica desde que lee `?rubro=`
 * (ver `src/app/page.tsx`), así que esto no agrega un costo nuevo.
 */

/**
 * Cerrar sesión y volver a la portada.
 *
 * ⚠️ A `/` y NO a `/eventos`, que es a donde manda `acciones-sesion.tsx`.
 * Desde ago 2026 `/` es la portada y `/eventos` es el directorio que se
 * está desmontando: mandar ahí al salir dejaría a la persona en una
 * página que está por dejar de existir.
 */
async function cerrarSesionPortada() {
  "use server";
  const supabase = await createClient();
  // `scope: "local"` — cierra ESTA sesión y nada más.
  //
  // ⚠️ EL DEFAULT DE SUPABASE ES GLOBAL. `signOut()` a secas es
  // `signOut({ scope: "global" })` (auth-js, GoTrueClient), y eso REVOCA
  // los refresh tokens de TODOS los aparatos: quien cerraba sesión acá
  // quedaba también deslogueado del teléfono, sin ninguna pista de por
  // qué. Un botón que dice «cerrar sesión» cierra la de acá.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export default async function AccionesPortada() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <Link
          href="/cuenta"
          className="hidden whitespace-nowrap px-2 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:text-[color:var(--navy)] sm:block"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/publicar"
          className="presionable hidden items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-colors sm:inline-flex"
          style={{ background: "var(--orange)" }}
        >
          Publicá tu negocio
          <span aria-hidden>→</span>
        </Link>
      </>
    );
  }

  /**
   * El nombre y la foto, con el MISMO orden de preferencia que
   * `acciones-sesion.tsx` — si acá cayera distinto, el header de la
   * portada y el del resto del sitio llamarían a la misma persona de dos
   * formas en la misma visita.
   *
   * `perfiles.nombre` primero (lo escribe el trigger o el callback de
   * Google); la metadata después. La foto solo existe si entraron con
   * Google. Se piden en paralelo: son dos consultas independientes y la
   * portada es la URL más visitada del sitio.
   */
  const [{ data: perfil }, yaPublica] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    tieneNegocioPropio(),
  ]);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nombre =
    [perfil?.nombre, meta.nombre, meta.full_name, meta.name].find(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    ) ?? null;
  const fotoUrl =
    [meta.avatar_url, meta.picture].find(
      (v): v is string => typeof v === "string" && v.startsWith("https://"),
    ) ?? null;

  return (
    <>
      <MenuCuentaPortada
        nombre={nombre}
        fotoUrl={fotoUrl}
        yaPublica={yaPublica}
        cerrarSesion={cerrarSesionPortada}
      />
      {/* Quien ya publicó no necesita que le ofrezcan publicar: el botón
          naranja lo lleva a administrar lo que tiene. */}
      <Link
        href={yaPublica ? "/mi-negocio" : "/publicar"}
        className="presionable hidden items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-colors sm:inline-flex"
        style={{ background: "var(--orange)" }}
      >
        {yaPublica ? "Mi negocio" : "Publicá tu negocio"}
        <span aria-hidden>→</span>
      </Link>
    </>
  );
}
