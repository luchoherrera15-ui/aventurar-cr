/**
 * BANDA 2 — MARQUESINA.
 *
 * Una tira de mensajes de ejemplo (genéricos, no testimonios reales)
 * desplazándose en loop. Es puro CSS: dos copias del mismo grupo una
 * al lado de la otra y `translateX(-50%)` en loop — `prefers-reduced-
 * motion` la detiene desde el CSS Module, sin JS de por medio.
 */

import estilos from "./assist.module.css";

const MENSAJES = [
  "“¿Tenés campo el sábado?”",
  "Contestado en 4 segundos",
  "“Perfecto, ahí llego 🙌”",
  "Agenda revisada, no inventada",
  "“¿Cuánto cuesta el corte?”",
  "Cero chats sin responder",
  "“Confirmado, gracias!”",
  "La cita queda escrita en Bookea",
];

function GrupoMensajes() {
  return (
    <div className={estilos.marqueeGrupo} aria-hidden="true">
      {MENSAJES.map((texto, i) => (
        <span className={estilos.marqueeItem} key={i}>
          {texto}
        </span>
      ))}
    </div>
  );
}

export default function Marquesina() {
  return (
    <div className={estilos.marquee} aria-hidden="true">
      <div className={estilos.marqueePista}>
        <GrupoMensajes />
        <GrupoMensajes />
      </div>
    </div>
  );
}
