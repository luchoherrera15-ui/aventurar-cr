"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarResena } from "./actions";

/**
 * Dejar (o corregir) la reseña de una reserva pasada, sin salir de la
 * cuenta: el botón abre un panel con las estrellas y el comentario.
 */
export default function ResenaForm({
  reservaId,
  ranchoId,
  nombreRancho,
  resenaExistente,
}: {
  reservaId: string;
  ranchoId: string;
  nombreRancho: string;
  resenaExistente: { calificacion: number; comentario: string | null } | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [estrellas, setEstrellas] = useState(resenaExistente?.calificacion ?? 0);
  const [comentario, setComentario] = useState(resenaExistente?.comentario ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function enviar() {
    setError(null);
    if (estrellas < 1) {
      setError("Elegí cuántas estrellas le das.");
      return;
    }
    startTransition(async () => {
      const res = await guardarResena(reservaId, ranchoId, estrellas, comentario);
      if (res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-[12.5px] font-bold text-aventurea-orange hover:underline"
      >
        {resenaExistente
          ? `Tu reseña: ${"★".repeat(resenaExistente.calificacion)} — editar`
          : "★ Dejar reseña"}
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3.5">
      <p className="text-[13px] font-bold text-aventurea-ink">
        ¿Cómo te fue en {nombreRancho}?
      </p>
      <div className="mt-2 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setEstrellas(n)}
            aria-label={`${n} estrellas`}
            className={`text-[24px] leading-none transition-transform hover:scale-110 ${
              n <= estrellas ? "text-aventurea-orange" : "text-zinc-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Contá cómo estuvo (opcional)"
        className="mt-2.5 min-h-[64px] w-full rounded-[10px] border border-aventurea-line bg-aventurea-surface px-3 py-2 text-[13px] text-aventurea-ink placeholder:text-zinc-400"
      />
      {error && <p className="mt-1.5 text-[12px] font-bold text-red-700">{error}</p>}
      <div className="mt-2.5 flex gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={pendiente}
          className="rounded-lg bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : resenaExistente ? "Guardar cambios" : "Publicar reseña"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-[12.5px] font-bold text-zinc-500 hover:text-aventurea-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
