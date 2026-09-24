"use client";

import { useState } from "react";
import type { DemoInvitacion } from "@/lib/catalogo-invitaciones";
import TelefonoVivo from "./telefono-vivo";

const PAPEL_DEFECTO = { fondo: "#efe7d8", tinta: "#2a2318", acento: "#c9a227" };

/**
 * El teléfono del héroe con sus pestañas.
 *
 * Arranca con la primera demo que se le pasa —«Carta de Amor», la que
 * mejor muestra el producto (sobre lacrado, música, capítulos)— y las
 * pestañas cambian la invitación que corre adentro: un toque y quien
 * mira pasa de una boda a un quinceaños sin salir de la landing.
 */
export default function HeroVivo({
  demos,
  claseSerif,
}: {
  /** Una por pestaña, en el orden en que se muestran. */
  demos: DemoInvitacion[];
  claseSerif: string;
}) {
  const [activa, setActiva] = useState(0);
  const demo = demos[activa] ?? demos[0];
  if (!demo) return null;

  return (
    <div id="probar" className="flex scroll-mt-24 flex-col items-center gap-5">
      <TelefonoVivo
        src={`/i/${demo.slug}`}
        titulo={demo.nombre}
        ocasion={demo.ocasion}
        papel={demo.muestra ?? PAPEL_DEFECTO}
        ancho={296}
        prioridad
        claseSerif={claseSerif}
        className="inv-entra"
      />

      <div className="inv-entra flex flex-col items-center gap-3" style={{ ["--inv-orden" as string]: 4 }}>
        <p className="text-center text-[13px] text-[var(--inv-tinta-suave)]">
          Es una invitación real. Deslizá adentro, abrí el sobre, tocá «Confirmar».
        </p>
        <div role="tablist" aria-label="Elegí qué invitación ver" className="flex flex-wrap justify-center gap-2">
          {demos.map((d, i) => {
            const es = i === activa;
            return (
              <button
                key={d.slug}
                type="button"
                role="tab"
                aria-selected={es}
                onClick={() => setActiva(i)}
                className={`presionable min-h-[40px] rounded-full px-4 text-[13px] font-bold transition-colors duration-[var(--duracion-micro)] ${
                  es
                    ? "bg-[var(--inv-papel)] text-[var(--inv-fondo)]"
                    : "border border-[var(--inv-linea)] text-[var(--inv-tinta-suave)] hover:border-[var(--inv-tinta-suave)] hover:text-[var(--inv-tinta)]"
                }`}
              >
                {d.ocasion}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
