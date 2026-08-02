"use client";

import { useState, useTransition } from "react";
import { borrarConfirmacion } from "./actions";

/**
 * Quitar una confirmación de la lista.
 *
 * Pide confirmar antes, y en el aviso va el nombre: la lista se usa
 * para contarle personas al catering, así que borrar de más cuesta
 * plata y no hay deshacer — el invitado tendría que volver a entrar al
 * link a confirmar.
 */
export default function BotonBorrarRsvp({
  rsvpId,
  invitacionId,
  nombre,
}: {
  rsvpId: string;
  invitacionId: string;
  nombre: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function borrar() {
    if (
      !window.confirm(
        `¿Quitar a ${nombre} de la lista? Si fue un error, esa persona tendría que volver a confirmar desde el link.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await borrarConfirmacion(rsvpId, invitacionId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={borrar}
        disabled={pendiente}
        aria-label={`Quitar a ${nombre} de la lista`}
        className="shrink-0 rounded-lg px-2 py-1 text-[11.5px] font-bold text-aventurea-ink-soft transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        {pendiente ? "Quitando…" : "Quitar"}
      </button>
      {error && (
        <p className="mt-1 w-full text-[11.5px] font-semibold text-red-600">{error}</p>
      )}
    </>
  );
}
