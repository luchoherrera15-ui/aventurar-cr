"use client";

import MenuCuenta from "./menu-cuenta";
import { useSesionPublica } from "./use-sesion-publica";
import { cerrarSesionPublica } from "./sesion-publica-actions";

/**
 * Las acciones de sesión del `site-header`, ahora ISLA DE CLIENTE.
 *
 * Era un componente de servidor que llamaba `createClient()` (→
 * `cookies()`) + `auth.getUser()` POR RED + `perfiles` +
 * `tieneNegocioPropio()`, todo encadenado — y ese único árbol volvía
 * dinámicas ~30 páginas públicas y repetía el viaje de auth que el
 * middleware ya había pagado en la misma petición. La historia completa
 * y el porqué del arreglo están en `use-sesion-publica.ts`; la server
 * action de salir vive en `sesion-publica-actions.ts`.
 *
 * `MenuCuenta` ya dibujaba los dos estados (visitante / con sesión), así
 * que el HTML del primer pintado —visitante— es el mismo que el
 * servidor prerenderiza: cero salto de hidratación.
 */
export default function AccionesSesion({
  /** true = los botones toman el círculo navy de la lupa de búsqueda,
   *  para la variante flotante del header (ver site-header.tsx). */
  flotante = false,
}: {
  flotante?: boolean;
} = {}) {
  const sesion = useSesionPublica();

  return (
    <MenuCuenta
      sesionActiva={sesion.sesionActiva}
      nombre={sesion.nombre}
      fotoUrl={sesion.fotoUrl}
      yaPublica={sesion.yaPublica}
      cerrarSesion={cerrarSesionPublica}
      flotante={flotante}
    />
  );
}
