"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  alternarChatPanel,
  leerChatPanel,
  leerChatPanelServidor,
  suscribirChatPanel,
} from "@/lib/chat-panel";
import { IconChatBubble, IconMenu, IconUserCircle } from "./icons";
import { iniciales } from "@/lib/iniciales";

/**
 * Píldora de hamburguesa + avatar del header — abre un menú, no navega
 * directo a ningún lado. Con sesión, el círculo muestra la foto del
 * perfil (si entró con Google) o las iniciales del nombre; el ícono
 * genérico queda solo para visitas sin sesión. "Publicá tu espacio"
 * vive tanto acá (para que en el celular, donde el link de texto de al
 * lado está oculto, siga habiendo por dónde llegar) como afuera en
 * desktop.
 */
export default function MenuCuenta({
  sesionActiva,
  nombre,
  fotoUrl,
  yaPublica = false,
  cerrarSesion,
  /** true = los dos botones toman el mismo círculo navy que el botón
   *  "Buscar" de la cápsula (nav-categorias.tsx) — pedido del dueño:
   *  que los botones del header "sincronicen con la lupa". */
  flotante = false,
}: {
  sesionActiva: boolean;
  nombre?: string | null;
  fotoUrl?: string | null;
  /** Ya tiene un negocio publicado: el link lleva a su panel. */
  yaPublica?: boolean;
  cerrarSesion: () => Promise<void>;
  flotante?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const { abierto: chatAbierto, sinLeer } = useSyncExternalStore(
    suscribirChatPanel,
    leerChatPanel,
    leerChatPanelServidor,
  );

  const itemCls =
    "block whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left text-[13.5px] font-bold text-aventurea-ink hover:bg-aventurea-cream-2";

  const botonCls = flotante
    ? "rounded-full bg-aventurea-navy text-white shadow-sm hover:bg-aventurea-navy-2"
    : "rounded-xl border border-aventurea-line bg-aventurea-surface text-aventurea-ink shadow-sm hover:shadow-md";

  return (
    <div className="flex items-center gap-2">
      {/* ════════════════════════════════════════════════════════════
          SIN SESIÓN, «ENTRAR» SE VE. NO SE BUSCA.
          ════════════════════════════════════════════════════════════

          Reportado por el dueño desde un teléfono: «al cerrar sesión no
          hay forma de volver a ingresar, no existe un botón de login
          arriba».

          Y tenía razón, aunque el enlace existía: «Iniciar sesión» vivía
          ADENTRO del menú, detrás de un círculo gris sin nombre. En
          escritorio uno prueba a hacer clic; en un teléfono, ese círculo
          no dice nada y la persona se queda afuera de su propia cuenta.

          Un enlace que existe pero que nadie encuentra no existe. Por
          eso acá va un botón de verdad, con la palabra escrita, y el
          menú se queda para lo demás («Publicá tu espacio»).

          Solo aparece deslogueado: con sesión, ese lugar lo ocupa el
          avatar, que ya dice quién sos. */}
      {!sesionActiva && (
        <Link
          href="/cuenta"
          className={`flex h-9 shrink-0 items-center px-4 text-[13.5px] font-bold transition-all ${
            flotante
              ? "rounded-full bg-aventurea-navy text-white shadow-sm hover:bg-aventurea-navy-2"
              : "rounded-xl border border-aventurea-line bg-aventurea-navy text-white shadow-sm hover:shadow-md"
          }`}
        >
          Entrar
        </Link>
      )}
      {sesionActiva && (
        <button
          type="button"
          onClick={alternarChatPanel}
          aria-label={sinLeer > 0 ? `Mensajes: ${sinLeer} sin leer` : "Tus mensajes"}
          aria-expanded={chatAbierto}
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center transition-all ${botonCls}`}
        >
          <IconChatBubble className="h-[17px] w-[17px]" />
          {sinLeer > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full border-2 border-aventurea-surface bg-aventurea-sky px-0.5 text-[9px] font-bold text-white">
              {sinLeer > 99 ? "99+" : sinLeer}
            </span>
          )}
        </button>
      )}
      <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Menú de cuenta"
        aria-expanded={abierto}
        className={`flex items-center gap-2 py-1 pl-3 pr-1 transition-all ${botonCls}`}
      >
        <IconMenu className={`h-[15px] w-[15px] ${flotante ? "text-white" : "text-aventurea-ink"}`} />
        {sesionActiva && fotoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- avatar
             de Google, dominio externo variable: next/image pediría
             registrar cada host. */
          <img
            src={fotoUrl}
            alt={nombre ?? "Tu perfil"}
            referrerPolicy="no-referrer"
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : sesionActiva && nombre ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-aventurea-navy text-[10.5px] font-bold leading-none text-white">
            {iniciales(nombre)}
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-white">
            <IconUserCircle className="h-[15px] w-[15px]" />
          </span>
        )}
      </button>

      {abierto && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-2 min-w-[200px] rounded-2xl border border-aventurea-line bg-aventurea-surface p-1.5 shadow-xl">
            {sesionActiva ? (
              <>
                <Link href="/cuenta" className={itemCls} onClick={() => setAbierto(false)}>
                  Mi cuenta
                </Link>
                <Link href="/" className={itemCls} onClick={() => setAbierto(false)}>
                  Ver el marketplace
                </Link>
                <Link
                  href={yaPublica ? "/mi-negocio" : "/publicar"}
                  className={`${itemCls} sm:hidden`}
                  onClick={() => setAbierto(false)}
                >
                  {yaPublica ? "Manejá tu espacio" : "Publicá tu espacio"}
                </Link>
                <div className="my-1 border-t border-aventurea-line" />
                <form action={cerrarSesion}>
                  <button type="submit" className={itemCls}>
                    Cerrar sesión
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/cuenta" className={itemCls} onClick={() => setAbierto(false)}>
                  Iniciar sesión
                </Link>
                <Link
                  href="/publicar"
                  className={`${itemCls} sm:hidden`}
                  onClick={() => setAbierto(false)}
                >
                  Publicá tu espacio
                </Link>
              </>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
