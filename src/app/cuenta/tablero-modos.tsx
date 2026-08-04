"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconCalendarLine,
  IconChatBubble,
  IconHeart,
  IconMail,
  IconPlus,
  IconStore,
} from "@/components/icons";

interface TablloModosProps {
  tieneNegocio: boolean;
  nuevosMensajes: number;
  reservasNuevasNegocio: number;
  vecesContratado: number;
  negociosLength: number;
  confirmacionesNuevas: number;
  invitacionIds: string[];
  personasConfirmadas: number;
  activas: number;
  historial: number;
  favoritosCount: number;
}

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
      className="relative rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 transition-colors hover:border-aventurea-navy"
    >
      {badge != null && badge > 0 && (
        <span className="absolute right-3 top-3 rounded-lg bg-aventurea-orange px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-white">
          +{badge > 99 ? "99" : badge}
        </span>
      )}
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          acento ? "bg-aventurea-orange/10 text-aventurea-orange" : "bg-aventurea-navy/10 text-aventurea-navy"
        }`}
      >
        {icono}
      </span>
      <p className="mt-2 text-[14px] font-extrabold text-aventurea-ink">{titulo}</p>
      <p className="truncate text-[11.5px] font-medium text-aventurea-ink-soft">{detalle}</p>
    </Link>
  );
}

export default function TableroModos({
  tieneNegocio,
  nuevosMensajes,
  reservasNuevasNegocio,
  vecesContratado,
  negociosLength,
  confirmacionesNuevas,
  invitacionIds,
  personasConfirmadas,
  activas,
  historial,
  favoritosCount,
}: TablloModosProps) {
  const [modoNegocio, setModoNegocio] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const guardado = localStorage.getItem("cuenta_modo_negocio");
    if (guardado === "true" && tieneNegocio) {
      setModoNegocio(true);
    }
    setMontado(true);
  }, [tieneNegocio]);

  const toggleModo = () => {
    const nuevoModo = !modoNegocio;
    setModoNegocio(nuevoModo);
    localStorage.setItem("cuenta_modo_negocio", String(nuevoModo));
  };

  if (!montado) return null;

  return (
    <div className="mt-4 space-y-4">
      {!modoNegocio ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TarjetaAcceso
              href="/cuenta/ir/mensajes"
              icono={<IconMail className="h-5 w-5" />}
              titulo="Mensajes"
              detalle={nuevosMensajes > 0 ? `${nuevosMensajes} nuevos` : "Sin mensajes nuevos"}
              badge={nuevosMensajes}
            />
            <TarjetaAcceso
              href="/cuenta/ir/invitaciones"
              icono={<IconPlus className="h-5 w-5" />}
              titulo="Invitaciones y álbumes"
              detalle={
                invitacionIds.length > 0
                  ? `${confirmacionesNuevas} confirmaciones nuevas`
                  : "Sin invitaciones"
              }
              badge={confirmacionesNuevas}
            />
            <TarjetaAcceso
              href="/cuenta/ir/reservas"
              icono={<IconCalendarLine className="h-5 w-5" />}
              titulo="Tus reservas"
              detalle={`${activas} activas, ${historial} historial`}
            />
            <TarjetaAcceso
              href="/cuenta/ir/favoritos"
              icono={<IconHeart className="h-5 w-5" />}
              titulo="Tus favoritos"
              detalle={favoritosCount === 1 ? "1 favorito" : `${favoritosCount} favoritos`}
            />
            <TarjetaAcceso
              href="/ranchos"
              icono={<IconStore className="h-5 w-5" />}
              titulo="Sitio web"
              detalle="Explora más espacios"
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TarjetaAcceso
              href="/cuenta/ir/proveedor"
              icono={<IconStore className="h-5 w-5" />}
              titulo="Panel de proveedor"
              detalle={`${negociosLength} publicación${negociosLength !== 1 ? "es" : ""}`}
              badge={reservasNuevasNegocio}
              acento
            />
            <TarjetaAcceso
              href="/cuenta/ir/finanzas"
              icono={<IconChatBubble className="h-5 w-5" />}
              titulo="Finanzas"
              detalle={`${vecesContratado} reservas confirmadas`}
            />
          </div>
        </>
      )}

      {tieneNegocio && (
        <button
          onClick={toggleModo}
          className="mt-6 w-full rounded-lg border border-aventurea-line bg-aventurea-surface px-4 py-3 text-center text-[13.5px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy/5"
        >
          {modoNegocio ? "Modo Normal" : "Modo Negocio"}
        </button>
      )}
    </div>
  );
}
