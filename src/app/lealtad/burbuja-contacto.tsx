"use client";

import { useState, useSyncExternalStore } from "react";
import { enviarConsultaLanding } from "./contacto-actions";
import { enlaceWhatsapp } from "@/lib/contacto-bookea";
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
/**
 * El logo de WhatsApp. Se dibuja acá y no se trae un emoji: 💬 es un
 * globo de chat genérico y en esta lista compite con el botón de chat
 * que está justo debajo — la marca es lo que hace que se reconozca el
 * canal de un vistazo.
 */
function IconoWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23z" />
    </svg>
  );
}

export default function BurbujaContacto() {
  // Compartido: el botón "Solicitar ayuda personalizada" del héroe
  // también la abre, sin que este componente tenga que saber que existe.
  const vista = useSyncExternalStore(
    suscribirBurbujaContacto,
    leerBurbujaContacto,
    leerBurbujaContactoServidor,
  );
  const abierta = vista !== "cerrada";
  // El mensaje ya escrito: la persona abre WhatsApp y solo toca enviar.
  // El número y el armado del enlace viven en `lib/contacto-bookea.ts`,
  // no acá: el día que cambie se toca un solo archivo.
  const enlaceWa = enlaceWhatsapp(
    "Hola Bookea, quiero información sobre las tarjetas de lealtad.",
  );

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
              {/* WhatsApp primero (dueño, 31 ago 2026): es el canal más
                  directo y el que menos fricción tiene — se abre con el
                  mensaje ya escrito, así la persona solo toca enviar.

                  Es un <a> y no un <button> porque sale del sitio: así se
                  puede abrir en otra pestaña, copiar el enlace y el
                  navegador lo trata como lo que es. `target="_blank"` con
                  `rel="noopener"` — sin eso la pestaña nueva puede tocar
                  la nuestra por `window.opener`.

                  Si `WHATSAPP_BOOKEA` quedara vacío, `enlaceWhatsapp()`
                  devuelve null y el botón NO se dibuja: un `wa.me/` sin
                  número manda a un error de WhatsApp, que es peor que no
                  ofrecer el canal. */}
              {enlaceWa && (
                <a
                  href={enlaceWa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={cerrarBurbujaContacto}
                  className="presionable flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-white/30"
                  style={{ borderColor: "rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)" }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "#25D366", color: "#062b16" }}
                  >
                    <IconoWhatsapp />
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-bold text-white">
                      Escribinos por WhatsApp
                    </span>
                    <span className="block text-[11.5px] text-white/50">
                      Te contestamos a tu número, sin salir de tu chat.
                    </span>
                  </span>
                </a>
              )}

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
