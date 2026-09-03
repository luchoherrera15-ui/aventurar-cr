"use client";

import Link from "next/link";
import MenuCuentaPortada from "./menu-cuenta-portada";
import { useSesionPublica } from "../use-sesion-publica";
import { cerrarSesionPublica } from "../sesion-publica-actions";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS ACCIONES DEL HEADER DE LA PORTADA, SEGÚN HAYA SESIÓN O NO
 * ════════════════════════════════════════════════════════════════════
 *
 * Sin sesión:  «Iniciar sesión» + «Publicá tu negocio» (lo de siempre).
 * Con sesión:  el nombre de la persona con su menú + «Publicá tu
 *              negocio» (o «Mi negocio», si ya publicó uno).
 *
 * Era un componente de SERVIDOR que leía la sesión con `cookies()` — y
 * ese único await volvía dinámica CUALQUIER página que montara
 * `HeaderSimple` (/negocios, texto fijo, se renderizaba en el servidor
 * en cada visita con `Cache-Control: private, no-store`). Ahora es la
 * isla de cliente de `use-sesion-publica.ts`: el HTML del primer
 * pintado es el de visitante —el mismo que el servidor prerenderiza,
 * cero salto de hidratación— y si el navegador encuentra sesión, la
 * esquina se actualiza sola. La server action de salir vive en
 * `sesion-publica-actions.ts` (redirige a `/`: quien cierra sesión acá
 * está en la portada, no en el directorio viejo).
 *
 * El desplegable, que siempre necesitó estado, sigue aparte en
 * `menu-cuenta-portada.tsx`.
 */
export default function AccionesPortada() {
  const sesion = useSesionPublica();

  // Mientras el navegador mira el token (y para todo visitante), la
  // esquina de siempre. Es también el HTML prerenderizado.
  if (!sesion.sesionActiva) {
    return (
      <>
        {/* ════════════════════════════════════════════════════════════
            EL BOTÓN DE ENTRAR EN TELÉFONO. FALTABA.
            ════════════════════════════════════════════════════════════

            Reportado por el dueño: «en el móvil, al cerrar sesión en
            bookea.lat no hay forma de volver a ingresar, no existe un
            botón de login arriba».

            Y era literal. Los dos enlaces de acá abajo son `hidden ...
            sm:*`, o sea que en un teléfono el encabezado de la portada
            —deslogueado— no mostraba NADA. Con sesión sí aparece el
            avatar, así que el agujero era exactamente el de quien acaba
            de salir: la pantalla desde la que uno vuelve a entrar era la
            única sin puerta.

            Va sólido y con la palabra escrita, no un ícono: quien
            acaba de cerrar sesión está buscando cómo volver, y un
            símbolo lo obliga a adivinar. */}
        <Link
          href="/cuenta"
          className="presionable inline-flex items-center whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-extrabold text-white transition-colors sm:hidden"
          style={{ background: "var(--navy)" }}
        >
          Entrar
        </Link>
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
   * El nombre y la foto llegan del hook con el MISMO orden de
   * preferencia que usa `acciones-sesion.tsx` — si acá cayera distinto,
   * el header de la portada y el del resto del sitio llamarían a la
   * misma persona de dos formas en la misma visita. Y las consultas del
   * hook van en paralelo: la portada es la URL más visitada del sitio.
   */
  return (
    <>
      <MenuCuentaPortada
        nombre={sesion.nombre}
        fotoUrl={sesion.fotoUrl}
        yaPublica={sesion.yaPublica}
        cerrarSesion={cerrarSesionPublica}
      />
      {/* Quien ya publicó no necesita que le ofrezcan publicar: el botón
          lo lleva a administrar lo que tiene.

          ── ERA NARANJA RELLENO (dueño, 2 sep 2026) ──────────────────
          «Que se vea más azul que naranja». El cambio además corrige un
          fallo de contraste medido: blanco sobre `--orange` (#f39200)
          da 2,35:1, cuando un texto necesita 4,5:1 — ni siquiera
          llegaba al 3:1 mínimo de un elemento de interfaz. Con
          `--accion` queda en 8,24:1.

          Es exactamente el bug que la fundación visual documenta como
          ya corregido en otras pantallas: la ACCIÓN es azul y el
          naranja es acento, nunca el relleno de un CTA.

          ⚠️ `bg-aventurea-navy` y NO `var(--accion)`: ese token vive
          DENTRO del bloque `.lealtad` de globals.css, así que en la
          portada no existe y el botón se renderiza transparente. Se
          probó y pasó — el navy del marketplace es el que aplica acá. */}
      <Link
        href={sesion.yaPublica ? "/mi-negocio" : "/publicar"}
        className="presionable hidden items-center gap-1.5 rounded-full bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-colors hover:bg-aventurea-navy-2 sm:inline-flex"
      >
        {sesion.yaPublica ? "Mi negocio" : "Publicá tu negocio"}
        <span aria-hidden>→</span>
      </Link>
    </>
  );
}
