"use client";

import { useEffect, useState } from "react";

/**
 * La cuenta regresiva a la fecha (y hora) del evento, en la zona de
 * Costa Rica, en cuatro celdas con borde (días · hrs · min · seg). En
 * el servidor pinta el estado calculado al momento y en el navegador se
 * pone al día cada segundo. Cuando la fecha pasó, lo dice en vez de
 * mostrar negativos. Los colores y letras vienen de las variables de la
 * invitación (invitacion.css).
 */
function restante(objetivo: number, ahora: number) {
  const ms = Math.max(0, objetivo - ahora);
  const s = Math.floor(ms / 1000);
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
    paso: objetivo - ahora <= 0,
  };
}

/** "2026-12-12" + "16:00" → instante en Costa Rica (UTC−6, sin horario de verano). */
export function instanteDelEvento(fecha: string, hora: string | null): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const h = /^\d{2}:\d{2}/.test(hora ?? "") ? (hora as string).slice(0, 5) : "00:00";
  return Date.parse(`${fecha}T${h}:00-06:00`);
}

export default function CuentaRegresiva({ fecha, hora }: { fecha: string | null; hora: string | null }) {
  const objetivo = fecha ? instanteDelEvento(fecha, hora) : null;
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!objetivo) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [objetivo]);

  if (!objetivo) {
    return <p className="inv-p inv-p-suave" style={{ marginTop: "calc(5 * var(--u))" }}>La fecha se anuncia pronto.</p>;
  }

  const r = restante(objetivo, ahora);
  if (r.paso) {
    return <p className="inv-h3" style={{ marginTop: "calc(5 * var(--u))" }}>¡Llegó el día!</p>;
  }

  const piezas = [
    [r.dias, "días"],
    [r.horas, "hrs"],
    [r.minutos, "min"],
    [r.segundos, "seg"],
  ] as const;

  return (
    <div className="inv-cd" suppressHydrationWarning>
      {piezas.map(([n, e], i) => (
        <div key={e} className="inv-cd-celda inv-rev inv-rev-brinco" style={{ "--d": `${0.1 + i * 0.1}s` } as React.CSSProperties}>
          <div className="inv-cd-num" suppressHydrationWarning>
            {String(n).padStart(2, "0")}
          </div>
          <div className="inv-cd-eti">{e}</div>
        </div>
      ))}
    </div>
  );
}
