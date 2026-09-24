"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { slugSolutions } from "@/lib/solutions/slug";
import { TOPES } from "@/lib/solutions/tipos";

/**
 * EL RECLAMO DEL LINK — la píldora grande de Linktree.
 *
 * Escribís el nombre de tu negocio y ves tu dirección aparecer. Pide
 * el NOMBRE y no el link a propósito: la dirección se deriva del
 * nombre con `slugSolutions`, la misma función pura que usa el alta,
 * así que lo que se muestra es exactamente lo que el servidor va a
 * intentar. Lo único que esta caja no sabe es si ya está ocupado —
 * por eso dice «va a ser» y no «es».
 *
 * Al enviar va a `/solutions/crear?nombre=…`, que prellena el alta.
 *
 * `tono`: sobre qué bloque de color está. Cada tono es un par ya
 * medido en globals.css (fondo + tinta), nunca un alfa.
 */
const HOST_VISIBLE = "bookea.lat/s/";

export default function ReclamarLink({ tono = "celeste" }: { tono?: "celeste" | "lima" | "carbon" }) {
  const [nombre, setNombre] = useState("");
  const router = useRouter();
  const idCampo = useId();
  const idPista = useId();

  const slug = slugSolutions(nombre);
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (limpio.length < 2) return;
    // Navegación RELATIVA (7 sep 2026): en localhost y en bookea.lat
    // el alta está en este mismo host; en linksy.lat el proxy redirige
    // `/solutions/*` a bookea.lat (PREFIJOS_BOOKEA). Antes era absoluta a
    // bookea.lat y desde el servidor local mandaba a producción.
    router.push(`/solutions/crear?nombre=${encodeURIComponent(limpio)}`);
  };

  // El botón invierte el bloque: oscuro sobre un bloque claro (celeste o
  // lima), lima sobre carbón. La pista toma la tinta del bloque.
  const boton =
    tono === "carbon"
      ? { background: "var(--linksy-lima)", color: "var(--linksy-lima-tinta)" }
      : { background: "var(--linksy-carbon)", color: "var(--linksy-carbon-tinta)" };
  const pista = `var(--linksy-${tono}-tinta)`;

  return (
    <form onSubmit={enviar} className="w-full max-w-[640px]">
      <label htmlFor={idCampo} className="sr-only">
        Nombre de tu negocio
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div
          className="flex min-h-[58px] flex-1 items-center rounded-xl border px-5"
          style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}
        >
          <span aria-hidden className="select-none whitespace-nowrap text-[18px] font-bold" style={{ color: "var(--linksy-tinta-suave)" }}>
            {HOST_VISIBLE}
          </span>
          <input
            id={idCampo}
            name="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={TOPES.nombre}
            autoComplete="organization"
            aria-describedby={idPista}
            placeholder="tu-negocio"
            className="w-full min-w-0 bg-transparent py-4 text-[18px] font-bold outline-none placeholder:font-medium"
            style={{ color: "var(--linksy-tinta)" }}
          />
        </div>
        <button
          type="submit"
          className="presionable inline-flex min-h-[58px] items-center justify-center whitespace-nowrap rounded-xl px-7 text-[16px] font-bold"
          style={boton}
        >
          Crear mi página
        </button>
      </div>
      <p id={idPista} className="mt-3 min-h-[22px] text-[15px] font-semibold" style={{ color: pista }}>
        {slug.length >= 2 ? (
          <>
            Tu página va a ser <strong className="font-extrabold">{HOST_VISIBLE}{slug}</strong>
          </>
        ) : (
          "Gratis. Sin tarjeta. En cinco minutos."
        )}
      </p>
    </form>
  );
}
