"use client";

import { useState, useTransition } from "react";
import { enviarAvisoDePrueba } from "./marketing-actions";
import type { DiagnosticoPlataforma } from "@/lib/wallet/servicio";
import type { FilaMarketing } from "./marketing-actions";
import { RADIO_CARD, RADIO_TILE } from "@/components/panel/sistema";
import { ACCION, ACCION_TINTA, ACCION_TINTE } from "../sistema-lealtad";

const ETIQUETA_PLATAFORMA: Record<"apple" | "google", string> = {
  apple: "Apple Wallet",
  google: "Google Wallet",
};

/** Lo que salió de mandarle el aviso a UNA plataforma, en una línea. */
function lineaDiagnostico(plataforma: "apple" | "google", d: DiagnosticoPlataforma): string {
  const nombre = ETIQUETA_PLATAFORMA[plataforma];
  if (!d.hay) return `${nombre}: no tiene pase acá.`;
  if (d.motivo) return `${nombre}: ${d.motivo}`;
  if (d.dispositivos === 0) return `${nombre}: sin dispositivos registrados.`;
  return `${nombre}: Apple/Google lo aceptó — ${d.enviados} de ${d.dispositivos} dispositivo${d.dispositivos === 1 ? "" : "s"}${d.caducados > 0 ? `, ${d.caducados} caducado${d.caducados === 1 ? "" : "s"}` : ""}.`;
}

export default function TablaMarketing({
  ranchoId,
  filas,
}: {
  ranchoId: string;
  filas: FilaMarketing[];
}) {
  return (
    <div className={`overflow-hidden ${RADIO_CARD} border border-aventurea-line bg-aventurea-surface`}>
      {filas.map((fila, i) => (
        <FilaCliente key={fila.miembroId} ranchoId={ranchoId} fila={fila} primera={i === 0} />
      ))}
    </div>
  );
}

function FilaCliente({
  ranchoId,
  fila,
  primera,
}: {
  ranchoId: string;
  fila: FilaMarketing;
  primera: boolean;
}) {
  const [ocupado, iniciar] = useTransition();
  const [resultado, setResultado] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Solo Apple tiene un "todavía no confirmó" real — Google (null) no
  // es un pendiente, es un "no hay forma de saberlo" permanente.
  const faltaConfirmar = fila.pases.some((p) => p.confirmadoEnTelefono === false);

  function probar() {
    setError(null);
    setResultado(null);
    iniciar(async () => {
      const res = await enviarAvisoDePrueba(ranchoId, fila.miembroId);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      setResultado([
        lineaDiagnostico("apple", res.datos.apple),
        lineaDiagnostico("google", res.datos.google),
      ]);
    });
  }

  return (
    <div
      className={`px-4 py-3.5 transition-colors hover:bg-aventurea-cream-2 ${
        primera ? "" : "border-t border-aventurea-line"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-white">
          {fila.nombre}
        </span>

        <span className="flex flex-wrap items-center gap-1.5">
          {fila.pases.map((p) => {
            // Tres estados, no dos: `null` (Google) no es "todavía
            // pendiente" — es "acá no hay forma de saber si el teléfono
            // lo recibió". Mostrarlo como ⏳ prometería una confirmación
            // que nunca va a llegar.
            const estilo =
              p.confirmadoEnTelefono === true
                ? { background: "rgba(52,199,89,.15)", color: "#34c759" }
                : p.confirmadoEnTelefono === false
                  ? { background: ACCION_TINTE, color: ACCION }
                  : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.55)" };
            const titulo =
              p.confirmadoEnTelefono === true
                ? "El teléfono ya confirmó el último cambio"
                : p.confirmadoEnTelefono === false
                  ? "Todavía no hay confirmación de que el teléfono lo haya recibido"
                  : "Google no avisa cuando un teléfono real ve el pase: esto solo confirma que nuestro servidor le mandó el cambio a Google, no que ya esté en un teléfono";
            const marca =
              p.confirmadoEnTelefono === true ? " ✓" : p.confirmadoEnTelefono === false ? " ⏳" : " ·";
            return (
              <span
                key={p.plataforma}
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold"
                style={estilo}
                title={titulo}
              >
                {ETIQUETA_PLATAFORMA[p.plataforma]} · {p.saldoCache}
                {marca}
              </span>
            );
          })}
        </span>

        <button
          type="button"
          onClick={probar}
          disabled={ocupado}
          className="shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors disabled:opacity-50"
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {ocupado ? "Enviando…" : "Probar el aviso"}
        </button>
      </div>

      {faltaConfirmar && !resultado && !error && (
        <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">
          Este pase todavía no confirmó el último cambio en su teléfono.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-200">
          {error}
        </p>
      )}

      {resultado && (
        <div className={`mt-2 space-y-1 ${RADIO_TILE} border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5`}>
          {resultado.map((linea) => (
            <p key={linea} className="text-[12px] text-aventurea-ink">
              {linea}
            </p>
          ))}
          <p className="text-[11px] text-aventurea-ink-soft">
            Esto confirma que Apple/Google lo aceptó para entregarlo — no que ya está en
            el teléfono. En Apple, volvé a mirar esta fila en un minuto: si el ✓ aparece,
            llegó. En Google no hay ✓ posible: ahí solo sabemos que se lo mandamos.
          </p>
        </div>
      )}
    </div>
  );
}
