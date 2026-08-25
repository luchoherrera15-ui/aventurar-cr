"use client";

/**
 * BANDA 3 — EL PROBLEMA (claro).
 *
 * Tres celdas numeradas con el dolor real, más una bandeja de WhatsApp
 * de ejemplo cuyo contador de no leídos sube de 0 a 14 con easing
 * ease-out cúbico apenas entra en el viewport.
 */

import { useRef } from "react";
import { useRevelar, useProgresoAnimado } from "./motor";
import estilos from "./assist.module.css";

const CELDAS = [
  {
    numero: "01",
    titulo: "El WhatsApp queda desatendido",
    texto:
      "Fuera de horario, en plena atención a un cliente, o simplemente porque son las 11pm: los mensajes se acumulan y nadie contesta.",
  },
  {
    numero: "02",
    titulo: "La reserva se enfría",
    texto:
      "Un cliente que espera respuesta no espera mucho: si tarda, escribe a otro negocio y esa cita nunca vuelve.",
  },
  {
    numero: "03",
    titulo: "Horas contestando lo mismo",
    texto:
      "\"¿Tenés campo?\", \"¿Cuánto cuesta?\", \"¿A qué hora abren?\" — las mismas cinco preguntas, todos los días, a mano.",
  },
];

const FILAS_INBOX = [
  { nombre: "Karol M.", mensaje: "Hola! ¿Tienen campo hoy?", hora: "11:42 pm", noLeidos: 3 },
  { nombre: "Fernanda R.", mensaje: "¿Cuánto sale el corte?", hora: "9:15 am", noLeidos: 5 },
  { nombre: "Grupo clientas VIP", mensaje: "¿Siguen abiertos los sábados?", hora: "ayer", noLeidos: 4 },
  { nombre: "Luis A.", mensaje: "¿Me confirman la cita?", hora: "ayer", noLeidos: 2 },
];

export default function Problema() {
  const refTitulo = useRef<HTMLDivElement | null>(null);
  const refInbox = useRef<HTMLDivElement | null>(null);
  const revelarTitulo = useRevelar(refTitulo);
  const revelarInbox = useRevelar(refInbox);
  const progreso = useProgresoAnimado(revelarInbox.visible, 1400);
  const contador = Math.round(progreso * 14);

  return (
    <section className={estilos.problema}>
      <div className={estilos.contenedor}>
        <div
          ref={refTitulo}
          style={revelarTitulo.style}
          className={`${estilos.revelar} ${revelarTitulo.visible ? estilos.revelarVisible : ""} ${estilos.problemaCabecera}`}
        >
          <p className={estilos.kickerClaro}>El problema</p>
          <h2 className={`${estilos.d2} ${estilos.tituloClaro}`}>
            Cada mensaje sin contestar es una reserva que se va con otro.
          </h2>
        </div>

        <div className={estilos.problemaGrilla}>
          {CELDAS.map((celda, i) => {
            return (
              <ProblemaCelda key={celda.numero} indice={i} {...celda} />
            );
          })}
        </div>

        <div
          ref={refInbox}
          style={revelarInbox.style}
          className={`${estilos.revelar} ${revelarInbox.visible ? estilos.revelarVisible : ""} ${estilos.inboxWrap}`}
        >
          <div className={estilos.inboxMock}>
            <div className={estilos.inboxCabecera}>
              <span className={estilos.inboxAppIcono} aria-hidden="true">
                <span className={estilos.inboxBadge}>{contador}</span>
              </span>
              <div>
                <p className={estilos.inboxAppNombre}>WhatsApp Business</p>
                <p className={estilos.inboxAppSub}>{contador} mensajes sin leer</p>
              </div>
            </div>
            <ul className={estilos.inboxLista}>
              {FILAS_INBOX.map((fila) => (
                <li key={fila.nombre} className={estilos.inboxFila}>
                  <span className={estilos.inboxAvatar} aria-hidden="true">
                    {fila.nombre.charAt(0)}
                  </span>
                  <span className={estilos.inboxTexto}>
                    <span className={estilos.inboxNombre}>{fila.nombre}</span>
                    <span className={estilos.inboxMensaje}>{fila.mensaje}</span>
                  </span>
                  <span className={estilos.inboxMeta}>
                    <span className={estilos.inboxHora}>{fila.hora}</span>
                    <span className={estilos.inboxPuntoNoLeido}>{fila.noLeidos}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemaCelda({
  numero,
  titulo,
  texto,
  indice,
}: {
  numero: string;
  titulo: string;
  texto: string;
  indice: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const revelar = useRevelar(ref, indice);
  return (
    <div
      ref={ref}
      style={revelar.style}
      className={`${estilos.revelar} ${revelar.visible ? estilos.revelarVisible : ""} ${estilos.problemaCelda}`}
    >
      <span className={estilos.problemaNumero}>{numero}</span>
      <h3 className={estilos.problemaTitulo}>{titulo}</h3>
      <p className={estilos.problemaTexto}>{texto}</p>
    </div>
  );
}
