"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconCamera, IconClipboard, IconClock, IconPin, IconWaze } from "@/components/icons";

/**
 * LO QUE SE LLEVA — cuatro piezas del producto, y las cuatro FUNCIONAN
 * acá mismo en vez de describirse:
 *
 *   · la cuenta regresiva corre de verdad, segundo a segundo;
 *   · «Cómo llegar» abre Maps y Waze con una ubicación real;
 *   · las preguntas se prenden y apagan, y se ve lo que recibe el
 *     anfitrión;
 *   · el QR del álbum es un QR de verdad: se escanea desde el teléfono
 *     y abre el álbum de ejemplo.
 *
 * Una landing que dice «tiene cuenta regresiva» compite con cualquiera;
 * una donde la cuenta regresiva está corriendo, no.
 */

/** La fecha de la boda de ejemplo (Isabella & Mateo, 3 de enero de 2027, 4 p. m. CR). */
const FECHA_EJEMPLO = new Date("2027-01-03T16:00:00-06:00");
/** Un lugar real para que los botones abran algo: el Teatro Nacional. */
const LUGAR = { nombre: "Teatro Nacional, San José", lat: 9.9333, lng: -84.0777 };
const URL_MAPS = `https://www.google.com/maps/search/?api=1&query=${LUGAR.lat},${LUGAR.lng}`;
const URL_WAZE = `https://waze.com/ul?ll=${LUGAR.lat},${LUGAR.lng}&navigate=yes`;

const PREGUNTAS = [
  { id: "menu", texto: "¿Qué menú preferís?", respuesta: "Vegetariano" },
  { id: "alergias", texto: "¿Alguna alergia?", respuesta: "Maní" },
  { id: "ninos", texto: "¿Traés niños?", respuesta: "Sí, 2" },
  { id: "transporte", texto: "¿Necesitás transporte?", respuesta: "No" },
] as const;

export default function PiezasValor({
  qr,
  albumHref,
  claseSerif,
}: {
  /** El QR del álbum de ejemplo, ya generado en el servidor. */
  qr: { viewBox: string; d: string };
  albumHref: string;
  claseSerif: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Pieza icono={<IconClock className="h-5 w-5" />} titulo="Cuenta regresiva viva" texto="Tus invitados ven cuánto falta cada vez que abren el link. Nadie se confunde de fecha.">
        <CuentaRegresiva hasta={FECHA_EJEMPLO} claseSerif={claseSerif} />
      </Pieza>

      <Pieza icono={<IconPin className="h-5 w-5" />} titulo="Cómo llegar, con un toque" texto="Maps y Waze con la ubicación exacta. Se acabó el «¿por dónde era?».">
        <div className="rounded-[14px] bg-[var(--inv-papel)] p-4 text-[var(--inv-papel-tinta)]">
          <p className={`${claseSerif} text-[22px] leading-tight text-[var(--inv-vino)]`}>{LUGAR.nombre}</p>
          <p className="mt-0.5 text-[12.5px] opacity-70">Recepción a las 4:00 p. m.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={URL_MAPS}
              target="_blank"
              rel="noopener noreferrer"
              className="presionable flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] bg-[var(--inv-vino)] text-[13px] font-bold text-[var(--inv-papel)]"
            >
              <IconPin className="h-4 w-4" />
              Google Maps
            </a>
            <a
              href={URL_WAZE}
              target="_blank"
              rel="noopener noreferrer"
              className="presionable flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] border border-[var(--inv-papel-tinta)]/25 bg-white text-[13px] font-bold"
            >
              <IconWaze className="h-4 w-4" />
              Waze
            </a>
          </div>
        </div>
      </Pieza>

      <Pieza icono={<IconClipboard className="h-5 w-5" />} titulo="Preguntás lo que necesitás saber" texto="Menú, alergias, niños, transporte: lo que elijas se pregunta al confirmar y te llega ordenado.">
        <Preguntas />
      </Pieza>

      <Pieza icono={<IconCamera className="h-5 w-5" />} titulo="Un álbum donde todos suben sus fotos" texto="Un QR en cada mesa. Las fotos de tus invitados quedan juntas, en un solo lugar, sin perseguirlas por el chat.">
        <div className="flex items-center gap-4 rounded-[14px] bg-[var(--inv-papel)] p-4 text-[var(--inv-papel-tinta)]">
          <a
            href={albumHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir el álbum de ejemplo (el mismo que abre el QR)"
            className="shrink-0 rounded-[10px] bg-white p-2"
          >
            <svg viewBox={qr.viewBox} width={96} height={96} shapeRendering="crispEdges" role="img" aria-label="Código QR del álbum de ejemplo" className="block">
              <path d={qr.d} stroke="var(--inv-papel-tinta)" strokeWidth={1} fill="none" />
            </svg>
          </a>
          <div className="min-w-0">
            <p className={`${claseSerif} text-[22px] leading-tight text-[var(--inv-vino)]`}>Escanealo con tu teléfono</p>
            <p className="mt-1 text-[12.5px] leading-snug opacity-70">
              Abre un álbum real. Si estás en el teléfono, tocalo.
            </p>
            <Link href={albumHref} target="_blank" className="mt-2 inline-block min-h-[44px] pt-2.5 text-[13px] font-bold text-[var(--inv-vino)] underline underline-offset-4">
              Ver el álbum de ejemplo
            </Link>
          </div>
        </div>
      </Pieza>
    </div>
  );
}

function Pieza({
  icono,
  titulo,
  texto,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  texto: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-[18px] border border-[var(--inv-linea)] bg-[var(--inv-vidrio)] p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--inv-naranja)] text-[var(--inv-naranja-tinta)]">
          {icono}
        </span>
        <div>
          <p className="text-[17px] font-bold leading-tight">{titulo}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--inv-tinta-suave)]">{texto}</p>
        </div>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

/**
 * La cuenta regresiva. Arranca en cero en el servidor y en el primer
 * pintado del cliente (mismo HTML, sin desajuste de hidratación) y se
 * pone a correr en el primer efecto. `tabular-nums`: los dígitos
 * cambian sin que la línea tiemble.
 */
function CuentaRegresiva({ hasta, claseSerif }: { hasta: Date; claseSerif: string }) {
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    const tic = () => setRestante(Math.max(0, hasta.getTime() - Date.now()));
    tic();
    const t = setInterval(tic, 1000);
    return () => clearInterval(t);
  }, [hasta]);

  const s = Math.floor((restante ?? 0) / 1000);
  const partes = [
    { n: Math.floor(s / 86400), u: "días" },
    { n: Math.floor((s % 86400) / 3600), u: "horas" },
    { n: Math.floor((s % 3600) / 60), u: "min" },
    { n: s % 60, u: "seg" },
  ];

  return (
    <div className="rounded-[14px] bg-[var(--inv-papel)] p-4 text-center text-[var(--inv-papel-tinta)]">
      <p className={`${claseSerif} text-[22px] leading-tight text-[var(--inv-vino)]`}>Isabella &amp; Mateo</p>
      <p className="mt-0.5 text-[12px] uppercase tracking-[0.2em] opacity-70">3 de enero de 2027</p>
      <div className="mt-3 grid grid-cols-4 gap-1.5" aria-live="off">
        {partes.map((p) => (
          <div key={p.u} className="rounded-[10px] bg-white py-2">
            <span className="block text-[24px] font-bold leading-none tabular-nums" style={{ color: "var(--inv-vino)" }}>
              {restante === null ? "–" : String(p.n).padStart(2, "0")}
            </span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide opacity-60">{p.u}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Las preguntas: se prenden y apagan, y abajo se ve lo que recibe el anfitrión. */
function Preguntas() {
  const [activas, setActivas] = useState<Set<string>>(() => new Set(["menu", "alergias"]));
  const alternar = (id: string) =>
    setActivas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const elegidas = PREGUNTAS.filter((p) => activas.has(p.id));

  return (
    <div className="rounded-[14px] bg-[var(--inv-papel)] p-4 text-[var(--inv-papel-tinta)]">
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-60">Elegí qué preguntar</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PREGUNTAS.map((p) => {
          const on = activas.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => alternar(p.id)}
              className={`presionable min-h-[36px] rounded-[8px] px-3 text-[12.5px] font-bold transition-colors duration-[var(--duracion-micro)] ${
                on ? "bg-[var(--inv-vino)] text-[var(--inv-papel)]" : "border border-[var(--inv-papel-tinta)]/20 bg-white"
              }`}
            >
              {p.texto}
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-[10px] bg-white p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-60">Lo que te llega de Daniela</p>
        {elegidas.length === 0 ? (
          <p className="mt-1 text-[12.5px] opacity-70">Sin preguntas: solo si va y con cuántos.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5">
            {elegidas.map((p) => (
              <li key={p.id} className="inv-fila-entra flex justify-between gap-3 text-[12.5px]">
                <span className="opacity-70">{p.texto.replace("¿", "").replace("?", "")}</span>
                <span className="font-bold">{p.respuesta}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
