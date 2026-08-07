import Link from "next/link";
import type { ReactNode } from "react";
import { IconBell, IconCheck } from "@/components/icons";

export type Aviso = {
  id: string;
  texto: string;
  /** A dónde lleva el aviso (una pestaña del panel, normalmente). */
  href: string;
  /** El texto del enlace, ej. "Ir a Finanzas". */
  accion: string;
};

/**
 * La barra de avisos de Inicio: lo primero que se ve y lo único que
 * pide acción. Adentro van las solicitudes por aceptar (que traen sus
 * propios botones de confirmar/rechazar) y, debajo, los avisos cortos
 * que mandan a otra pestaña.
 *
 * Si no hay nada pendiente NO ocupa espacio: una sola línea discreta de
 * "todo al día", no un bloque vacío con marco.
 */
export default function BarraAvisos({
  avisos,
  haySolicitudes,
  children,
}: {
  avisos: Aviso[];
  haySolicitudes: boolean;
  children?: ReactNode;
}) {
  if (!haySolicitudes && avisos.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] font-bold text-aventurea-ink-soft">
        <IconCheck className="h-4 w-4 shrink-0 text-aventurea-green" />
        Todo al día — no hay nada esperando tu respuesta.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {children}

      {avisos.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {avisos.map((a, i) => (
            <li
              key={a.id}
              className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 ${
                i > 0 ? "border-t border-aventurea-line/70" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px] text-aventurea-ink">
                <IconBell className="h-3.5 w-3.5 shrink-0 text-aventurea-navy" />
                {a.texto}
              </span>
              <Link
                href={a.href}
                className="shrink-0 text-[12.5px] font-bold text-aventurea-navy underline"
              >
                {a.accion}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
