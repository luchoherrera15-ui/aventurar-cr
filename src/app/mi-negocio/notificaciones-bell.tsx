"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconBell } from "@/components/icons";

export type NotificacionItem = {
  id: string;
  texto: string;
  negocio: string;
  href: string;
};

/**
 * La campana del menú de /mi-negocio: agrupa lo pendiente de TODOS los
 * negocios de la cuenta (reservas por aprobar, depósitos sin validar),
 * para que se vea desde cualquier pantalla del panel, no solo cuando
 * ya estás adentro del negocio que tiene el pendiente.
 */
const CLAVE_LEIDAS = "bookea:notificaciones-leidas";

function leerLeidas(): Set<string> {
  try {
    const crudo = window.localStorage.getItem(CLAVE_LEIDAS);
    return new Set(crudo ? (JSON.parse(crudo) as string[]) : []);
  } catch {
    return new Set();
  }
}

function guardarLeidas(leidas: Set<string>) {
  try {
    window.localStorage.setItem(CLAVE_LEIDAS, JSON.stringify([...leidas]));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) — no es
    // crítico, el badge simplemente no recuerda qué ya se abrió.
  }
}

export default function NotificacionesBell({ items }: { items: NotificacionItem[] }) {
  const [abierto, setAbierto] = useState(false);
  // Arranca vacío (server y cliente coinciden en el primer render, sin
  // localStorage) y se hidrata en un efecto — ahí también se poda
  // contra lo que hay hoy, así un id de una notificación ya resuelta
  // no se queda ocupando espacio para siempre.
  const [leidas, setLeidas] = useState<Set<string>>(() => new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const guardadas = leerLeidas();
    const idsActuales = new Set(items.map((i) => i.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata desde localStorage (sistema externo) una sola vez por carga; en el primer render no se puede leer sin desincronizar server y cliente
    setLeidas(new Set([...guardadas].filter((id) => idsActuales.has(id))));
  }, [items]);

  useEffect(() => {
    if (!abierto) return;
    const alClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClickFuera);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClickFuera);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  // Abrir la campana marca todo lo que hay ahora mismo como leído —
  // el pendiente sigue ahí (el link sigue llevando a resolverlo), pero
  // el contador deja de sumarlo hasta que aparezca algo nuevo.
  function abrir() {
    setAbierto(true);
    if (items.length === 0) return;
    const nuevas = new Set(leidas);
    items.forEach((i) => nuevas.add(i.id));
    guardarLeidas(nuevas);
    setLeidas(nuevas);
  }

  const sinLeer = items.filter((i) => !leidas.has(i.id)).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-label={
          sinLeer > 0 ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"
        }
        aria-expanded={abierto}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
      >
        <IconBell className="h-5 w-5" />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-aventurea-cream bg-aventurea-orange px-1 text-[10px] font-bold text-white">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[320px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-[0_18px_50px_rgba(16,26,44,0.18)]">
          <p className="border-b border-aventurea-line px-4 py-3 text-[12.5px] font-bold text-aventurea-ink">
            Notificaciones
          </p>
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-zinc-500">
                No tenés nada pendiente ahora mismo.
              </p>
            ) : (
              items.map((it) => (
                <Link
                  key={it.id}
                  href={it.href}
                  onClick={() => setAbierto(false)}
                  className="block border-b border-aventurea-line/60 px-4 py-3 last:border-none hover:bg-aventurea-cream-2/60"
                >
                  <p className="text-[13px] font-bold text-aventurea-ink">{it.texto}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">{it.negocio}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
