"use client";

import { useState, useSyncExternalStore } from "react";
import { enviarConsultaLanding } from "./contacto-actions";
import {
  alternarBurbujaContacto,
  cerrarBurbujaContacto,
  irACorreoBurbuja,
  irAChatBurbuja,
  leerBurbujaContacto,
  leerBurbujaContactoServidor,
  suscribirBurbujaContacto,
  volverAlSelectorBurbuja,
} from "./burbuja-contacto-estado";
import ChatAgente from "./chat-agente";

/* La burbuja FLOTA sobre las dos clases de franja de la landing —las
   navy y las blancas— y ningún azul solo sirve para las dos: el de
   fondo claro da 1,44:1 contra el navy, y el de fondo oscuro da 1,61:1
   contra el blanco.
   Se resuelve por capas y no eligiendo un tercer color: el relleno es
   el par de fondo CLARO (que es el fondo por defecto de la página) y
   encima lleva un aro del azul claro, invisible sobre blanco y el que
   dibuja el botón cuando pasa sobre una franja navy. */
const ACCION = "var(--accion)";
const ACCION_TINTA = "var(--accion-tinta)";
const ARO_SOBRE_OSCURO = "var(--accion-claro)";

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
  // Compartido: el botón "Solicitar ayuda personalizada" del héroe
  // también la abre, sin que este componente tenga que saber que existe.
  const vista = useSyncExternalStore(
    suscribirBurbujaContacto,
    leerBurbujaContacto,
    leerBurbujaContactoServidor,
  );
  const abierta = vista !== "cerrada";
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
          {/* El chat tiene su propio encabezado (← Atrás + contador +
              su propio cierre no hace falta, `cerrarBurbujaContacto`
              sigue disponible por el botón flotante): acá solo se
              pinta el genérico para el selector y el correo. */}
          {vista !== "chat" && (
            <div
              className="flex items-center justify-between border-b px-4 py-3.5"
              style={{ borderColor: "rgba(255,255,255,.1)" }}
            >
              <div>
                {vista === "correo" && (
                  <button
                    type="button"
                    onClick={volverAlSelectorBurbuja}
                    className="mb-1 text-[11.5px] font-bold text-white/50 hover:text-white"
                  >
                    ← Atrás
                  </button>
                )}
                <p className="text-[13.5px] font-extrabold text-white">
                  {vista === "correo" ? "Escribinos" : "¿Cómo te ayudamos?"}
                </p>
                <p className="text-[11.5px] text-white/50">
                  {vista === "correo" ? "Te contestamos por acá mismo." : "Elegí como preferís hablar con nosotros."}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarBurbujaContacto}
                aria-label="Cerrar"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {vista === "selector" && (
            <div className="flex flex-col gap-2.5 p-4">
              <button
                type="button"
                onClick={irAChatBurbuja}
                className="presionable flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-white/30"
                style={{ borderColor: "rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px]"
                  style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
                >
                  💬
                </span>
                <span>
                  <span className="block text-[13.5px] font-bold text-white">Chatear con un agente</span>
                  <span className="block text-[11.5px] text-white/50">Respuesta al instante, ahora mismo.</span>
                </span>
              </button>

              <button
                type="button"
                onClick={irACorreoBurbuja}
                className="presionable flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-white/30"
                style={{ borderColor: "rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px]"
                  style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}
                >
                  ✉️
                </span>
                <span>
                  <span className="block text-[13.5px] font-bold text-white">Enviar un correo</span>
                  <span className="block text-[11.5px] text-white/50">Te contestamos por fuera de acá.</span>
                </span>
              </button>
            </div>
          )}

          {vista === "chat" && <ChatAgente />}

          {vista === "correo" && (
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
                  className="rounded-xl border bg-white/[0.06] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/55"
                  style={{ borderColor: "rgba(255,255,255,.15)" }}
                />
                <input
                  type="text"
                  required
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Correo o WhatsApp"
                  maxLength={150}
                  className="rounded-xl border bg-white/[0.06] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/55"
                  style={{ borderColor: "rgba(255,255,255,.15)" }}
                />
                <textarea
                  required
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="¿Qué necesitás?"
                  rows={3}
                  maxLength={800}
                  className="resize-none rounded-xl border bg-white/[0.06] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/55"
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
                  className="mt-1 flex h-11 items-center justify-center rounded-xl text-[13.5px] font-bold transition-colors disabled:opacity-60"
                  style={{
                    /* El panel es navy: acá manda el par de fondo
                       oscuro, relleno claro con letra navy. */
                    background: "var(--accion-claro)",
                    color: "var(--accion-claro-tinta)",
                  }}
                >
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </form>
            )}
          </div>
          )}
        </div>
      )}

      {/* ── El botón flotante ───────────────────────────────────── */}
      <button
        type="button"
        onClick={alternarBurbujaContacto}
        aria-label={abierta ? "Cerrar el chat" : "Hablar con Bookea"}
        aria-expanded={abierta}
        className="presionable fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-2xl transition-transform hover:scale-105"
        style={{ background: ACCION, color: ACCION_TINTA, borderColor: ARO_SOBRE_OSCURO }}
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
