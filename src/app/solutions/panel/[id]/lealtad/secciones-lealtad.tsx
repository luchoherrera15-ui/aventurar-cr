"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { GrupoLealtad } from "@/app/lealtad/panel/[id]/shell-lealtad";
import { Icono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * LAS SECCIONES DE LEALTAD, DENTRO DEL PANEL DE LINKSY.
 *
 * Recibe los mismos `grupos` y `contenidos` que el rail de Lealtad
 * (`ShellLealtad`) y los muestra como una fila de píldoras arriba y la
 * sección elegida abajo. La sección activa vive en el HASH de la URL,
 * igual que en Lealtad: los enlaces internos de las secciones
 * («Definir la recompensa» → `#configuracion`, `#clientes`…) siguen
 * funcionando sin cambiar una línea de ellas.
 */

function suscribir(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const leerHash = () => window.location.hash.replace("#", "");
const leerHashServidor = () => "";

export default function SeccionesLealtad({ grupos, contenidos }: { grupos: GrupoLealtad[]; contenidos: Record<string, ReactNode> }) {
  const items = grupos.flatMap((g) => g.items);
  const hash = useSyncExternalStore(suscribir, leerHash, leerHashServidor);
  const activa = items.some((i) => i.id === hash) ? hash : (items[0]?.id ?? "inicio");

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Secciones de Lealtad" className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const esActiva = it.id === activa;
          return (
            <a
              key={it.id}
              href={`#${it.id}`}
              aria-current={esActiva ? "page" : undefined}
              className={`presionable inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 text-[13.5px] font-extrabold transition-colors ${
                esActiva ? "bg-[var(--linksy-carbon)] text-[var(--linksy-carbon-tinta)] shadow-elevado" : "bg-[var(--linksy-papel)] text-[var(--linksy-tinta)] shadow-plano hover:shadow-elevado"
              }`}
            >
              <span className="[&_svg]:h-4 [&_svg]:w-4">
                <Icono nombre={it.icono} />
              </span>
              {it.etiqueta}
            </a>
          );
        })}
      </nav>
      <div key={activa}>{contenidos[activa]}</div>
    </div>
  );
}
