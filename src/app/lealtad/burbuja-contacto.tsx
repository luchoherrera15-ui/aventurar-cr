"use client";

import { useState } from "react";
import { enviarConsultaLanding } from "./contacto-actions";

const NARANJA = "#ee7420";
const NAVY_PROFUNDO = "#0a1226";

/**
 * LA BURBUJA DE CHAT DE LA LANDING — hablar con Bookea sin tener
 * todavía ni cuenta ni negocio.
 *
 * Fija abajo a la derecha, como cualquier widget de chat. Se abre en un
 * panel chico con tres campos y manda un correo al equipo (ver
 * contacto-actions.ts sobre por qué no es una tabla ni una
 * conversación con historial: acá no hay tenencia de negocio de la que
 * colgar nada).
 */
export default function BurbujaContacto() {
  const [abierta, setAbierta] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const res = await enviarConsultaLanding({ nombre, contacto, mensaje, panal: "" });
    setEnviando(false);
    if (!res.ok) {
      setError(res.motivo);
      return;
    }
    setEnviado(true);
  }

  return (
    <>
      {/* ── El panel ────────────────────────────────────────────── */}
      {abierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Escribirle a Bookea"
          className="fixed inset-x-4 bottom-[92px] z-[70] w-auto overflow-hidden rounded-2xl border shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[340px]"
          style={{ background: "#0e1730", borderColor: "rgba(255,255,255,.14)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3.5"
            style={{ borderColor: "rgba(255,255,255,.1)" }}
          >
            <div>
              <p className="text-[13.5px] font-extrabold text-white">Hablá con Bookea</p>
              <p className="text-[11.5px] text-white/50">Te contestamos por acá mismo.</p>
            </div>
            <button
              type="button"
              onClick={() => setAbierta(false)}
              aria-label="Cerrar"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            {enviado ? (
              <p className="rounded-xl px-3.5 py-3 text-[13px] leading-relaxed text-white/85" style={{ background: "rgba(255,255,255,.06)" }}>
                ¡Recibido! Te contestamos apenas lo veamos.
              </p>
            ) : (
              <form onSubmit={enviar} className="flex flex-col gap-2.5">
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={100}
                  className="rounded-xl border bg-white/[0.06] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/35"
                  style={{ borderColor: "rgba(255,255,255,.15)" }}
                />
                <input
                  type="text"
                  required
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Correo o WhatsApp"
                  maxLength={150}
                  className="rounded-xl border bg-white/[0.06] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/35"
                  style={{ borderColor: "rgba(255,255,255,.15)" }}
                />
                <textarea
                  required
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="¿Qué necesitás?"
                  rows={3}
                  maxLength={800}
                  className="resize-none rounded-xl border bg-white/[0.06] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/35"
                  style={{ borderColor: "rgba(255,255,255,.15)" }}
                />
                {/* Señuelo para bots: invisible para una persona (fuera de
                    pantalla, sin tabulador) — ver contacto-actions.ts. */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  onChange={() => {}}
                />

                {error && (
                  <p role="alert" className="text-[12px] font-bold text-red-300">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="mt-1 flex h-11 items-center justify-center rounded-xl text-[13.5px] font-bold text-white transition-colors disabled:opacity-60"
                  style={{ background: NARANJA }}
                >
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── El botón flotante ───────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-label={abierta ? "Cerrar el chat" : "Hablar con Bookea"}
        aria-expanded={abierta}
        className="presionable fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-105"
        style={{ background: NARANJA, color: NAVY_PROFUNDO }}
      >
        {abierta ? (
          <span aria-hidden className="text-[22px] font-bold">
            ✕
          </span>
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.76 1.44 5.22 3.7 6.83-.16 1.14-.6 2.63-1.55 3.9a.5.5 0 0 0 .5.77c2.02-.4 3.66-1.28 4.72-2 .84.2 1.72.3 2.63.3 5.52 0 10-3.94 10-8.8S17.52 2 12 2Z" />
          </svg>
        )}
      </button>
    </>
  );
}
