"use client";

import { createClient } from "@/lib/supabase/client";
import { limpiarSesionPublica, useSesionPublica } from "@/lib/sesion-publica";
import MenuCuenta from "./menu-cuenta";

/**
 * El menú de cuenta del header. Antes era un componente de servidor que
 * consultaba la sesión (un viaje a Supabase) en CADA página; ahora la
 * sesión se resuelve en el navegador con el caché compartido de
 * sesion-publica.ts — mismo dato que usan los corazones de favoritos —
 * y las páginas públicas pueden servirse pre-generadas.
 */
export default function AccionesSesion() {
  const sesion = useSesionPublica();

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    limpiarSesionPublica();
    // Recarga completa: limpia cualquier dato de sesión que haya
    // quedado pintado y deja al visitante en el directorio.
    window.location.assign("/eventos");
  }

  return (
    <MenuCuenta
      sesionActiva={sesion.sesionActiva}
      nombre={sesion.nombre}
      fotoUrl={sesion.fotoUrl}
      yaPublica={sesion.yaPublica}
      cerrarSesion={cerrarSesion}
    />
  );
}
