"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Sesión y favoritos resueltos EN EL NAVEGADOR, para las páginas
 * públicas pre-generadas (ISR): el HTML llega igual para todo el mundo
 * y estos hooks pintan encima lo personal (corazones de favoritos,
 * avatar del menú) apenas carga la página.
 *
 * La carga se hace UNA vez por pestaña y se comparte entre todos los
 * componentes que la pidan (caché a nivel de módulo): cien cards en el
 * directorio = una sola consulta de favoritos, no cien.
 */

export type SesionPublica = {
  sesionActiva: boolean;
  nombre: string | null;
  fotoUrl: string | null;
  /** Ya tiene un negocio publicado (el header cambia "Publicá" → panel). */
  yaPublica: boolean;
  favoritosIds: Set<string>;
};

const VACIA: SesionPublica = {
  sesionActiva: false,
  nombre: null,
  fotoUrl: null,
  yaPublica: false,
  favoritosIds: new Set(),
};

let cache: SesionPublica | null = null;
let promesa: Promise<SesionPublica> | null = null;
const suscriptores = new Set<(s: SesionPublica) => void>();

function avisar(s: SesionPublica) {
  cache = s;
  suscriptores.forEach((fn) => fn(s));
}

async function cargar(): Promise<SesionPublica> {
  const supabase = createClient();
  // getSession lee del storage local — no hay viaje de red para saber
  // si hay sesión; los viajes solo se pagan cuando SÍ la hay.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return VACIA;

  const [{ data: perfil }, { count }, { data: favData }] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    supabase.from("ranchos").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase.from("favoritos").select("rancho_id").eq("cliente_id", user.id),
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

  return {
    sesionActiva: true,
    nombre,
    fotoUrl,
    yaPublica: (count ?? 0) > 0,
    favoritosIds: new Set((favData ?? []).map((f) => f.rancho_id as string)),
  };
}

/**
 * Mantiene el caché al día cuando el usuario marca/desmarca un corazón,
 * para que al navegar a otra página el estado no vuelva viejo.
 */
export function registrarCambioFavorito(ranchoId: string, activo: boolean) {
  if (!cache) return;
  const ids = new Set(cache.favoritosIds);
  if (activo) ids.add(ranchoId);
  else ids.delete(ranchoId);
  avisar({ ...cache, favoritosIds: ids });
}

/** Borra el caché (después de cerrar sesión). */
export function limpiarSesionPublica() {
  promesa = null;
  avisar(VACIA);
}

export function useSesionPublica(): SesionPublica {
  const [estado, setEstado] = useState<SesionPublica>(cache ?? VACIA);

  useEffect(() => {
    suscriptores.add(setEstado);
    if (!promesa) promesa = cargar();
    promesa.then((s) => {
      // El primero en resolver publica; los que llegan tarde se ponen
      // al día con el caché (que puede traer toggles posteriores).
      if (!cache) avisar(s);
      else setEstado(cache);
    });
    return () => {
      suscriptores.delete(setEstado);
    };
  }, []);

  return estado;
}
