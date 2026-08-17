"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { RADIO_CARD } from "@/components/panel/sistema";
import { ACCION, ACCION_TINTA } from "../sistema-lealtad";

/**
 * El botón grande de [📷 Escanear] de la pestaña General.
 *
 * El escáner en sí (jsQR + cámara) se carga solo cuando alguien lo
 * abre y solo en el navegador — `ssr:false` — para que un fallo de la
 * librería pierda el escáner, no la página (la lección de la pestaña
 * vieja se conserva).
 */

const EscanerPanel = dynamic(() => import("./escaner-panel"), {
  ssr: false,
  loading: () => (
    <div className={`mt-3 ${RADIO_CARD} border border-aventurea-line bg-aventurea-surface p-5`}>
      <p className="text-[13px] font-bold text-aventurea-ink-soft">Preparando el escáner…</p>
    </div>
  ),
});

export default function BotonEscanear({
  ranchoId,
  pideMonto,
  recompensa,
}: {
  ranchoId: string;
  pideMonto: boolean;
  recompensa: { id: string; nombre: string; costo: number } | null;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      {/* LA ACCIÓN DE LA PANTALLA. Deja de ser una franja navy a todo
          el ancho —que sobre el navy del panel se leía como un bloque
          más— y pasa al azul de acción del módulo, con el alto de un
          botón del sistema. En el teléfono sigue ocupando el ancho
          completo porque ahí es lo único que se hace en esa pantalla;
          desde sm se encoge a su contenido y se sienta al lado del
          titular, que es donde la maqueta pone las acciones. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[14px] font-extrabold transition-opacity hover:opacity-90 sm:w-auto"
        style={{ background: ACCION, color: ACCION_TINTA }}
      >
        {/* Cámara, dibujada acá para no sumar una librería de iconos. */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        {abierto ? "Cerrar el escáner" : "Escanear"}
      </button>

      {abierto && (
        <div className="mt-3">
          <EscanerPanel ranchoId={ranchoId} pideMonto={pideMonto} recompensa={recompensa} />
        </div>
      )}
    </div>
  );
}
