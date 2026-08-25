"use client";

import { abrirBurbujaContacto } from "./burbuja-contacto-estado";

/**
 * «Solicitar ayuda personalizada» — a la par de `BotonCrearPase` en el
 * héroe. No abre un formulario nuevo: abre la burbuja de contacto que
 * ya existe en esta misma landing (`burbuja-contacto.tsx`), la misma
 * que ya sabe escribirle a Bookea sin cuenta ni negocio — mismo
 * mecanismo que ya usa su propio botón flotante, ahora compartido por
 * `burbuja-contacto-estado.ts`.
 */
export default function BotonAyudaPersonalizada({ grande = false }: { grande?: boolean }) {
  return (
    <button
      type="button"
      onClick={abrirBurbujaContacto}
      className={`presionable inline-flex items-center justify-center gap-2 rounded-xl border-2 font-bold transition-all duration-200 hover:-translate-y-0.5 ${
        grande ? "px-8 py-4.5 text-[17px] sm:text-[18px]" : "px-6 py-3.5 text-[14px]"
      }`}
      style={{ borderColor: "#0a1226", color: "#0a1226", background: "transparent" }}
    >
      Solicitar ayuda personalizada
    </button>
  );
}
