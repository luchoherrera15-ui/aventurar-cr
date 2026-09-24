"use client";

import { useState, useTransition } from "react";
import { confirmarAsistencia } from "@/app/celebrar/(publico)/[slug]/acciones";
import type { PreguntaRsvp } from "@/lib/celebrar/invitacion/esquema";

/**
 * El formulario de confirmación DENTRO de la invitación: nombre, sí/no,
 * cuántos van (si el anfitrión lo pide), contacto (si lo pide), las
 * preguntas que configuró (alergias, transporte, canción…) y un mensaje.
 *
 * Con `slug` guarda de verdad (RPC anónima `celebrar_confirmar`) y el
 * anfitrión lo ve en su panel de Invitados; sin `slug` (la demo de la
 * portada, la previa del editor) solo muestra el «gracias».
 */
export default function FormularioRsvp({
  boton,
  nombreCelebracion,
  slug,
  preguntas = [],
  pedirPersonas = true,
  pedirContacto = false,
}: {
  boton: string;
  nombreCelebracion: string;
  slug?: string;
  preguntas?: PreguntaRsvp[];
  pedirPersonas?: boolean;
  pedirContacto?: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [personas, setPersonas] = useState(1);
  const [asiste, setAsiste] = useState(true);
  const [contacto, setContacto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("Contanos tu nombre para anotarte.");
      return;
    }
    if (asiste) {
      const faltante = preguntas.find((q) => q.requerida && !(respuestas[q.id] ?? "").trim());
      if (faltante) {
        setError(`Falta responder: ${faltante.etiqueta}`);
        return;
      }
    }
    setError(null);
    iniciar(async () => {
      if (slug) {
        const r = await confirmarAsistencia(slug, { nombre: nombre.trim(), asiste, personas: asiste ? personas : 0, respuestas: asiste ? respuestas : {}, mensaje: mensaje.trim(), contacto: contacto.trim() });
        if (!r.ok) {
          setError(r.mensaje);
          return;
        }
      }
      setEnviado(true);
    });
  }

  if (enviado) {
    const primero = nombre.trim().split(" ")[0];
    return (
      <div className="inv-gracias" role="status">
        <span className="inv-gracias-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <p className="inv-h3">{asiste ? `¡Gracias, ${primero}!` : "Gracias por avisar"}</p>
        <p className="inv-p inv-p-suave" style={{ marginTop: "calc(2 * var(--u))" }}>
          {asiste
            ? `Te anotamos${pedirPersonas ? ` con ${personas} ${personas === 1 ? "lugar" : "lugares"}` : ""} para ${nombreCelebracion}. Nos vemos ahí.`
            : `Te vamos a extrañar en ${nombreCelebracion}. Un abrazo grande.`}
        </p>
      </div>
    );
  }

  return (
    <form className="inv-form" onSubmit={enviar} noValidate>
      <label>
        Tu nombre
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" maxLength={120} />
      </label>
      <div className="inv-opciones" role="group" aria-label="¿Vas a asistir?">
        <button type="button" className="inv-opcion" aria-pressed={asiste} onClick={() => setAsiste(true)}>
          Sí, asistiré
        </button>
        <button type="button" className="inv-opcion" aria-pressed={!asiste} onClick={() => setAsiste(false)}>
          No podré ir
        </button>
      </div>
      {asiste && pedirPersonas && (
        <label>
          ¿Cuántas personas van?
          <select value={personas} onChange={(e) => setPersonas(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "persona" : "personas"}
              </option>
            ))}
          </select>
        </label>
      )}
      {asiste &&
        preguntas.map((q) => (
          <label key={q.id}>
            {q.etiqueta}
            {q.requerida ? " *" : ""}
            {q.tipo === "texto" && <input type="text" value={respuestas[q.id] ?? ""} onChange={(e) => setRespuestas((r) => ({ ...r, [q.id]: e.target.value }))} maxLength={300} />}
            {q.tipo === "numero" && <input type="number" inputMode="numeric" min={0} max={999} value={respuestas[q.id] ?? ""} onChange={(e) => setRespuestas((r) => ({ ...r, [q.id]: e.target.value }))} />}
            {q.tipo === "opcion" && (
              <select value={respuestas[q.id] ?? ""} onChange={(e) => setRespuestas((r) => ({ ...r, [q.id]: e.target.value }))}>
                <option value="">Elegí una opción</option>
                {q.opciones.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            )}
            {q.tipo === "si_no" && (
              <div className="inv-opciones">
                {["Sí", "No"].map((v) => (
                  <button key={v} type="button" className="inv-opcion" aria-pressed={respuestas[q.id] === v} onClick={() => setRespuestas((r) => ({ ...r, [q.id]: v }))}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </label>
        ))}
      {pedirContacto && (
        <label>
          Teléfono o correo (para avisarte cualquier cambio)
          <input type="text" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="8888 8888 o tu correo" autoComplete="tel" maxLength={120} />
        </label>
      )}
      <label>
        Un mensajito (opcional)
        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Dejales unas palabras a los anfitriones…" maxLength={400} />
      </label>
      {error && (
        <p className="inv-p" role="alert" style={{ color: "var(--esc-acento, var(--inv-acento))", fontSize: 14 }}>
          {error}
        </p>
      )}
      <button type="submit" className="inv-btn inv-btn-solido" disabled={pendiente}>
        {pendiente ? "Enviando…" : boton || "Enviar confirmación"}
      </button>
    </form>
  );
}
