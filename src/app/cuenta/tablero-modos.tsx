"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconCalendarLine,
  IconChartBars,
  IconFrame,
  IconHeart,
  IconStore,
} from "@/components/icons";

interface TableroModosProps {
  tieneNegocio: boolean;
  reservasNuevasNegocio: number;
  vecesContratado: number;
  negociosLength: number;
  /** true = al menos un negocio suyo tiene el programa contratado. */
  lealtadActiva: boolean;
  confirmacionesNuevas: number;
  invitacionIds: string[];
  personasConfirmadas: number;
  activas: number;
  historial: number;
  favoritosCount: number;
}

/**
 * Card ancha tipo "banner de panel": el ícono grande se asoma fuera
 * del borde superior derecho como una marca de agua, pero el
 * overflow-hidden de acá mismo lo recorta ahí — nunca se ve por
 * fuera del card, solo da esa sensación de que "se sale".
 */
function TarjetaAcceso({
  href,
  icono,
  titulo,
  detalle,
  badge,
  acento,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  badge?: number;
  acento?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[96px] items-center overflow-hidden rounded-2xl border p-5 transition-colors ${
        acento
          ? "border-aventurea-sky/30 bg-aventurea-sky/5 hover:border-aventurea-sky"
          : "border-aventurea-line bg-aventurea-surface hover:border-aventurea-navy"
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-4 -top-6 rotate-[14deg] transition-transform duration-300 group-hover:rotate-[8deg] ${
          acento ? "text-aventurea-orange/[0.1]" : "text-aventurea-navy/[0.08]"
        }`}
      >
        {icono}
      </span>

      {badge != null && badge > 0 && (
        <span className="absolute right-4 top-4 z-10 rounded-lg bg-aventurea-sky px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-white">
          +{badge > 99 ? "99" : badge}
        </span>
      )}

      <div className="relative z-10 min-w-0">
        <p className="text-[15.5px] font-extrabold text-aventurea-ink">{titulo}</p>
        <p className="mt-0.5 truncate text-[12.5px] font-medium text-aventurea-ink-soft">
          {detalle}
        </p>
      </div>
    </Link>
  );
}

export default function TableroModos({
  tieneNegocio,
  reservasNuevasNegocio,
  vecesContratado,
  negociosLength,
  lealtadActiva,
  confirmacionesNuevas,
  invitacionIds,
  personasConfirmadas,
  activas,
  historial,
  favoritosCount,
}: TableroModosProps) {
  const [modoNegocio, setModoNegocio] = useState(false);

  useEffect(() => {
    // Lectura única de una preferencia guardada en el navegador — no hay
    // forma de saberla antes de montar en el cliente (SSR no tiene
    // localStorage), así que el efecto es necesario, no evitable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModoNegocio(localStorage.getItem("cuenta_modo_negocio") === "true" && tieneNegocio);
  }, [tieneNegocio]);

  const toggleModo = () => {
    const nuevoModo = !modoNegocio;
    setModoNegocio(nuevoModo);
    localStorage.setItem("cuenta_modo_negocio", String(nuevoModo));
  };

  // Antes esto era `if (!montado) return null`, y dejaba la cuenta VACÍA
  // —solo el perfil y "Cerrar sesión"— hasta que el navegador terminaba
  // de hidratar. Con la red lenta, o si el JS falla, esa pantalla en
  // blanco es todo lo que el usuario ve, sin ninguna explicación.
  //
  // Ahora el servidor pinta el modo normal (que es el estado inicial en
  // los dos lados, así que no hay desajuste de hidratación) y el efecto
  // cambia a modo negocio si esa era la preferencia guardada. Se paga
  // un parpadeo de las tarjetas para quien está en modo negocio; se
  // gana que la pantalla nunca esté vacía.
  return (
    <div className="mt-4 space-y-3">
      {!modoNegocio ? (
        <>
          <TarjetaAcceso
            href="/cuenta/ir/invitaciones"
            icono={<IconFrame className="h-28 w-28" />}
            titulo="Invitaciones y álbumes"
            detalle={
              invitacionIds.length === 0
                ? "Sin invitaciones"
                : personasConfirmadas > 0
                  ? `${confirmacionesNuevas} confirmaciones nuevas · ${personasConfirmadas} personas confirmadas`
                  : `${confirmacionesNuevas} confirmaciones nuevas`
            }
            badge={confirmacionesNuevas}
          />
          <TarjetaAcceso
            href="/cuenta/ir/reservas"
            icono={<IconCalendarLine className="h-28 w-28" />}
            titulo="Tus reservas"
            detalle={`${activas} activas, ${historial} historial`}
          />
          <TarjetaAcceso
            href="/cuenta/ir/favoritos"
            icono={<IconHeart className="h-28 w-28" />}
            titulo="Tus favoritos"
            detalle={favoritosCount === 1 ? "1 favorito" : `${favoritosCount} favoritos`}
          />
        </>
      ) : (
        <>
          <TarjetaAcceso
            href="/cuenta/ir/proveedor"
            icono={<IconStore className="h-28 w-28" />}
            titulo="Panel de proveedor"
            detalle={`${negociosLength} publicación${negociosLength !== 1 ? "es" : ""}`}
            badge={reservasNuevasNegocio}
            acento
          />
          <TarjetaAcceso
            href="/cuenta/ir/finanzas"
            icono={<IconChartBars className="h-28 w-28" />}
            titulo="Finanzas"
            detalle={`${vecesContratado} reservas confirmadas`}
          />
          {/* La tarjeta sale SIEMPRE, tenga o no el programa contratado.
              Si no lo tiene, es la única forma de que se entere de que
              existe — un producto que solo se ve cuando ya se compró no
              lo compra nadie. */}
          <TarjetaAcceso
            href={lealtadActiva ? "/cuenta/ir/lealtad" : "/lealtad"}
            icono={<IconHeart className="h-28 w-28" />}
            titulo="Programa de lealtad"
            detalle={
              lealtadActiva
                ? "Sellos, puntos y tarjeta en el Wallet de tus clientes"
                : "Hacé que tus clientes vuelvan — ver cómo funciona"
            }
          />
        </>
      )}

      {tieneNegocio && (
        <button
          onClick={toggleModo}
          className="mt-3 w-full rounded-lg border border-aventurea-line bg-aventurea-surface px-4 py-3 text-center text-[13.5px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy/5"
        >
          {modoNegocio ? "Modo Normal" : "Modo Negocio"}
        </button>
      )}
    </div>
  );
}
