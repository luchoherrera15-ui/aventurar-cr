"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA SESIÓN DE LOS HEADERS PÚBLICOS SE RESUELVE EN EL NAVEGADOR
 * ════════════════════════════════════════════════════════════════════
 *
 * Antes cada header la resolvía en el SERVIDOR: `acciones-sesion.tsx`
 * y `acciones-portada.tsx` llamaban a `createClient()` de
 * @/lib/supabase/server —que hace `await cookies()`— y `site-header`
 * además llamaba a `tieneNegocioPropio()`. Un solo `cookies()` en el
 * árbol vuelve DINÁMICA la ruta entera, así que /terminos, /politicas,
 * /privacidad, /negocios y compañía —texto fijo— se renderizaban en el
 * servidor EN CADA visita, con `Cache-Control: private, no-store`: ni
 * CDN ni navegador podían cachear nada.
 *
 * La prueba de que el arreglo funciona ya vivía en este repo: /lealtad
 * hizo exactamente esta mudanza (nav-lealtad.tsx) y quedó 34 horas
 * servida del borde de Vercel (`X-Vercel-Cache: HIT, Age: 124261`),
 * pasando por el MISMO proxy que las demás.
 *
 * Este hook es esa mudanza, compartida: el cliente de Supabase DEL
 * NAVEGADOR lee el token de sus propias cookies y las consultas que
 * dependen del usuario (nombre en `perfiles`, si ya publicó un negocio)
 * van EN PARALELO — donde antes eran 3-4 viajes encadenados que
 * bloqueaban el TTFB de ~30 páginas.
 *
 * ── EL PRECIO, REAL PERO CHICO ──────────────────────────────────────
 * Un instante de «Iniciar sesión» antes de aparecer el nombre, solo
 * visible para quien tiene sesión. A cambio el HTML sale del CDN.
 *
 * ── SIN CACHÉ DE MÓDULO, Y ES A PROPÓSITO ───────────────────────────
 * Cachear la promesa a nivel de módulo sobreviviría a las navegaciones
 * suaves del router: después de cerrar sesión (server action + redirect)
 * el header nuevo leería el estado viejo y seguiría saludando por
 * nombre. Cada montaje lee de cero; son consultas chicas, después del
 * primer pintado, y siempre dicen la verdad.
 */

export type SesionPublica = {
  /** true mientras el navegador todavía no miró el token guardado. */
  cargando: boolean;
  sesionActiva: boolean;
  nombre: string | null;
  fotoUrl: string | null;
  /** Ya tiene un negocio (propio o donde colabora): se le ofrece su panel. */
  yaPublica: boolean;
};

const SIN_SESION: SesionPublica = {
  cargando: false,
  sesionActiva: false,
  nombre: null,
  fotoUrl: null,
  yaPublica: false,
};

async function leerSesionPublica(): Promise<SesionPublica> {
  const supabase = createClient();
  // En el navegador esto resuelve contra el token que ya está guardado
  // — el mismo criterio que usa nav-lealtad.tsx.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SIN_SESION;

  // Todo lo que depende del usuario, EN PARALELO: el nombre visible y
  // las dos cuentas de `tieneNegocioPropio()` (propios + donde
  // colabora, 0116) no dependen entre sí. En el servidor esto eran
  // viajes encadenados.
  const [perfilR, propiosR, colaboradosR] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    supabase
      .from("ranchos")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("rancho_colaboradores")
      .select("rancho_id", { count: "exact", head: true })
      .eq("usuario_id", user.id),
  ]);

  // El MISMO orden de preferencia que tenían los dos headers en el
  // servidor: `perfiles.nombre` primero (lo escribe el trigger o el
  // callback de Google), la metadata del proveedor después. La foto
  // solo existe si entraron con Google.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nombre =
    [perfilR.data?.nombre, meta.nombre, meta.full_name, meta.name].find(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    ) ?? null;
  const fotoUrl =
    [meta.avatar_url, meta.picture].find(
      (v): v is string => typeof v === "string" && v.startsWith("https://"),
    ) ?? null;

  // Ante un error se responde que no, igual que negocio-propio.ts:
  // ofrecer «Publicá tu negocio» de más es inofensivo; mandar a
  // /mi-negocio a alguien sin nada lo deja en una pantalla vacía.
  const yaPublica =
    (!propiosR.error && (propiosR.count ?? 0) > 0) ||
    (!colaboradosR.error && (colaboradosR.count ?? 0) > 0);

  return {
    cargando: false,
    sesionActiva: true,
    nombre: nombre?.trim() ?? null,
    fotoUrl,
    yaPublica,
  };
}

export function useSesionPublica(): SesionPublica {
  const [sesion, setSesion] = useState<SesionPublica>({
    ...SIN_SESION,
    cargando: true,
  });

  useEffect(() => {
    let vivo = true;
    void leerSesionPublica()
      // Sin sesión legible se queda el estado de visitante: es la
      // esquina de un header, no vale tirar la página por ella.
      .catch(() => SIN_SESION)
      .then((s) => {
        if (vivo) setSesion(s);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return sesion;
}
