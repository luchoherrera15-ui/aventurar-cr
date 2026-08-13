"use client";

import { useMemo, useRef, useState } from "react";

/**
 * DEMO: previsualizar la notificación antes de mandarla.
 *
 * Es de la página PÚBLICA y es de mentira a propósito: no manda nada,
 * no guarda nada y no toca la base. Sirve para que alguien que todavía
 * no es cliente entienda en diez segundos qué le va a llegar a la
 * pantalla de sus clientes.
 *
 * ------------------------------------------------------------------
 * LOS 180 CARACTERES SE CUENTAN SOBRE EL TEXTO YA RESUELTO
 * ------------------------------------------------------------------
 * Y esa es la parte que importa. `{{nombre}}` son diez caracteres en
 * el editor pero «Laura» son cinco en el teléfono — y al revés,
 * `{{beneficio}}` son doce y «un café gratis en tu próxima visita» son
 * treinta y siete.
 *
 * Contar el texto crudo dejaría pasar mensajes que en el teléfono se
 * cortan, que es justo el error que esta pantalla viene a evitar.
 */

const LIMITE = 180;
const NARANJA = "#ee7420";

/** Las variables, con un ejemplo de lo que valen de verdad. */
const VARIABLES: { llave: string; ejemplo: string; que: string }[] = [
  { llave: "{{nombre}}", ejemplo: "Laura", que: "Nombre del cliente" },
  { llave: "{{negocio}}", ejemplo: "Café La Esquina", que: "Tu negocio" },
  { llave: "{{sellos}}", ejemplo: "8 de 10", que: "Sellos que lleva" },
  { llave: "{{puntos}}", ejemplo: "340", que: "Puntos acumulados" },
  { llave: "{{beneficio}}", ejemplo: "un café gratis", que: "Lo que se gana" },
  { llave: "{{fecha_reserva}}", ejemplo: "el jueves 21", que: "Fecha de su cita" },
  { llave: "{{hora_reserva}}", ejemplo: "3:30 p. m.", que: "Hora de su cita" },
  { llave: "{{fecha_vencimiento}}", ejemplo: "el 30 de setiembre", que: "Cuándo vence" },
];

const EJEMPLO =
  "Hola {{nombre}}, ya tenés {{sellos}} sellos. Reservá tu próxima cita y desbloqueá {{beneficio}}.";

/** Reemplaza cada variable por su ejemplo. Lo que no conoce, lo deja. */
function resolver(texto: string): string {
  let salida = texto;
  for (const v of VARIABLES) salida = salida.split(v.llave).join(v.ejemplo);
  return salida;
}

export default function DemoNotificacion() {
  const [texto, setTexto] = useState(EJEMPLO);
  const [plataforma, setPlataforma] = useState<"apple" | "google">("apple");
  const area = useRef<HTMLTextAreaElement | null>(null);

  const resuelto = useMemo(() => resolver(texto), [texto]);
  const usados = resuelto.length;
  const pasado = usados > LIMITE;

  /** Mete la variable donde está el cursor, no al final. */
  function insertar(llave: string) {
    const el = area.current;
    if (!el) {
      setTexto((t) => t + llave);
      return;
    }
    const ini = el.selectionStart ?? texto.length;
    const fin = el.selectionEnd ?? texto.length;
    const nuevo = texto.slice(0, ini) + llave + texto.slice(fin);
    setTexto(nuevo);
    // El cursor queda DESPUÉS de lo insertado: si volviera al inicio,
    // escribir dos variables seguidas sería imposible.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + llave.length, ini + llave.length);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* ── El editor ────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="demo-texto"
          className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-white/45"
        >
          Tu mensaje
        </label>
        <textarea
          id="demo-texto"
          ref={area}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          className="w-full rounded-2xl border bg-white/[0.04] px-4 py-3 text-[14px] leading-relaxed text-white outline-none"
          style={{ borderColor: pasado ? "#f87171" : "rgba(255,255,255,.14)" }}
          aria-describedby="demo-contador"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p id="demo-contador" className="text-[12px] text-white/45" aria-live="polite">
            <span style={{ color: pasado ? "#f87171" : "rgba(255,255,255,.75)" }}>
              {usados}
            </span>{" "}
            / {LIMITE} caracteres
            <span className="text-white/30"> — ya con las variables resueltas</span>
          </p>
          {pasado && (
            <p className="text-[12px] font-bold text-red-400">
              Se va a cortar en el teléfono
            </p>
          )}
        </div>

        <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-white/45">
          Variables
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <button
              key={v.llave}
              type="button"
              onClick={() => insertar(v.llave)}
              title={v.que}
              className="presionable rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-[11.5px] font-medium text-white/70 hover:border-white/35 hover:text-white"
            >
              {v.llave}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-white/35">
          Tocá una para insertarla donde tenés el cursor. En el teléfono de cada cliente se
          reemplaza por lo suyo.
        </p>
      </div>

      {/* ── La vista previa ──────────────────────────────────────── */}
      <div>
        <div
          className="mx-auto flex w-fit gap-1 rounded-xl p-1"
          role="tablist"
          aria-label="Plataforma"
          style={{ background: "rgba(255,255,255,.07)" }}
        >
          {(["apple", "google"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={plataforma === p}
              onClick={() => setPlataforma(p)}
              className={`presionable rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                plataforma === p ? "bg-white text-[#0a1226]" : "text-white/55 hover:text-white"
              }`}
            >
              {p === "apple" ? "Apple Wallet" : "Google Wallet"}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {plataforma === "apple" ? (
            <PantallaApple texto={resuelto} />
          ) : (
            <PantallaGoogle texto={resuelto} />
          )}
        </div>

        <p className="mt-3 text-center text-[11px] leading-snug text-white/35">
          Vista aproximada. La apariencia puede variar según el dispositivo y la plataforma.
        </p>
      </div>
    </div>
  );
}

/** Pantalla bloqueada de iPhone: hora grande y la notificación abajo. */
function PantallaApple({ texto }: { texto: string }) {
  return (
    <div
      className="mx-auto w-[240px] overflow-hidden rounded-[30px] border-4 border-black/70 shadow-2xl"
      style={{
        background:
          "linear-gradient(165deg, #1b2a4d 0%, #0e1730 55%, #0a1226 100%)",
      }}
    >
      <div className="px-4 pb-4 pt-7 text-center">
        <p className="text-[11px] font-medium text-white/60">jueves 21 de agosto</p>
        <p className="text-[46px] font-light leading-none tracking-tight text-white">9:41</p>
      </div>

      <div className="px-2.5 pb-8">
        <div
          className="rounded-2xl px-3 py-2.5 backdrop-blur"
          style={{ background: "rgba(255,255,255,.16)" }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="grid h-4 w-4 place-items-center rounded text-[7px] font-black"
              style={{ background: NARANJA, color: "#0a1226" }}
            >
              W
            </span>
            <span className="text-[9.5px] font-medium text-white/85">Wallet</span>
            <span className="ml-auto text-[9px] text-white/50">ahora</span>
          </div>
          <p className="mt-1.5 text-[11.5px] font-semibold leading-snug text-white">
            Café La Esquina
          </p>
          <p className="text-[11px] leading-snug text-white/85">{texto}</p>
        </div>
      </div>
    </div>
  );
}

/** Android: la notificación se ve más ancha y con el nombre del canal. */
function PantallaGoogle({ texto }: { texto: string }) {
  return (
    <div
      className="mx-auto w-[240px] overflow-hidden rounded-[26px] border-4 border-black/70 shadow-2xl"
      style={{
        background: "linear-gradient(170deg, #22304f 0%, #101a33 60%, #0a1226 100%)",
      }}
    >
      <div className="px-4 pb-3 pt-7 text-center">
        <p className="text-[40px] font-light leading-none text-white">9:41</p>
        <p className="text-[10.5px] text-white/55">jue, 21 de agosto</p>
      </div>

      <div className="px-2.5 pb-8">
        <div className="rounded-xl bg-[#1f2937]/85 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className="grid h-4 w-4 place-items-center rounded-full text-[7px] font-black"
              style={{ background: NARANJA, color: "#0a1226" }}
            >
              G
            </span>
            <span className="text-[9.5px] text-white/70">Google Wallet · Café La Esquina</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-white/90">{texto}</p>
        </div>
      </div>
    </div>
  );
}
