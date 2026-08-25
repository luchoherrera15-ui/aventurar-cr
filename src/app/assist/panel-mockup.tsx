"use client";

/**
 * BANDA 7 — EL PANEL (claro, con una tarjeta oscura adentro).
 *
 * Mockup del panel de Bookea Assist para el dueño: contadores que
 * suben con easing al entrar en viewport, un sparkline que se dibuja
 * progresivamente (`stroke-dasharray` / `stroke-dashoffset`) y una
 * lista de conversaciones que entra fila por fila.
 *
 * Todas las cifras son de {NEGOCIO_DEMO}, el negocio ficticio de toda
 * la landing — no son datos de un cliente real de Bookea.
 */

import { useRef } from "react";
import { useRevelar, useProgresoAnimado } from "./motor";
import { NEGOCIO_DEMO } from "./constantes";
import estilos from "./assist.module.css";

const METRICAS = [
  { rotulo: "Conversaciones esta semana", valor: 86, sufijo: "" },
  { rotulo: "Reservas creadas solas", valor: 34, sufijo: "" },
  { rotulo: "Tiempo de respuesta", valor: 4, sufijo: "s" },
  { rotulo: "Horas que no tuviste que contestar", valor: 11, sufijo: "h" },
];

const PUNTOS_SPARKLINE = [8, 14, 11, 20, 26, 24, 34];

const CONVERSACIONES = [
  { nombre: "Karol M.", ultimo: "Confirmada a las 3pm", estado: "confirmado" as const },
  { nombre: "Fernanda R.", ultimo: "Preguntó precio de acrílicas", estado: "en curso" as const },
  { nombre: "Grupo clientas VIP", ultimo: "¿Abren el domingo?", estado: "en curso" as const },
  { nombre: "Luis A.", ultimo: "Movió su cita a viernes", estado: "confirmado" as const },
];

function trazoSparkline(puntos: number[], ancho: number, alto: number): string {
  const max = Math.max(...puntos);
  const min = Math.min(...puntos);
  const rango = max - min || 1;
  const paso = ancho / (puntos.length - 1);
  return puntos
    .map((v, i) => {
      const x = i * paso;
      const y = alto - ((v - min) / rango) * alto;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function PanelMockup() {
  const ref = useRef<HTMLDivElement | null>(null);
  const revelar = useRevelar(ref);
  const progreso = useProgresoAnimado(revelar.visible, 1400);

  const ancho = 220;
  const alto = 64;
  const trazo = trazoSparkline(PUNTOS_SPARKLINE, ancho, alto);
  const longitudAprox = 320;

  return (
    <section className={estilos.panel}>
      <div className={estilos.contenedor}>
        <div className={estilos.panelCabecera}>
          <p className={estilos.kickerClaro}>El panel</p>
          <h2 className={`${estilos.d2} ${estilos.tituloClaro}`}>Todo lo que contestó, en un solo lugar.</h2>
        </div>

        <div
          ref={ref}
          className={`${estilos.revelar} ${revelar.visible ? estilos.revelarVisible : ""} ${estilos.panelTarjeta}`}
        >
          <div className={estilos.panelTarjetaCabecera}>
            <span className={estilos.kickerOscuro}>Panel de {NEGOCIO_DEMO}</span>
            <span className={estilos.panelPeriodo}>Últimos 7 días</span>
          </div>

          <div className={estilos.panelMetricas}>
            {METRICAS.map((m) => (
              <div key={m.rotulo} className={estilos.panelMetrica}>
                <span className={estilos.panelCifra}>
                  {Math.round(progreso * m.valor)}
                  {m.sufijo}
                </span>
                <span className={estilos.panelRotulo}>{m.rotulo}</span>
              </div>
            ))}
          </div>

          <div className={estilos.panelCuerpo}>
            <div className={estilos.panelSparklineWrap}>
              <p className={estilos.panelSubtitulo}>Reservas creadas por Assist</p>
              <svg
                viewBox={`0 0 ${ancho} ${alto}`}
                className={estilos.panelSparkline}
                aria-hidden="true"
              >
                <path
                  d={trazo}
                  fill="none"
                  stroke="var(--orange)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: longitudAprox,
                    strokeDashoffset: longitudAprox * (1 - progreso),
                  }}
                />
              </svg>
            </div>

            <ul className={estilos.panelLista}>
              <p className={estilos.panelSubtitulo}>Conversaciones recientes</p>
              {CONVERSACIONES.map((c, i) => (
                <FilaConversacion key={c.nombre} conversacion={c} indice={i} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FilaConversacion({
  conversacion,
  indice,
}: {
  conversacion: (typeof CONVERSACIONES)[number];
  indice: number;
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  const revelar = useRevelar(ref, indice);
  return (
    <li
      ref={ref}
      style={revelar.style}
      className={`${estilos.revelar} ${revelar.visible ? estilos.revelarVisible : ""} ${estilos.panelFila}`}
    >
      <span className={estilos.panelFilaAvatar} aria-hidden="true">
        {conversacion.nombre.charAt(0)}
      </span>
      <span className={estilos.panelFilaTexto}>
        <span className={estilos.panelFilaNombre}>{conversacion.nombre}</span>
        <span className={estilos.panelFilaUltimo}>{conversacion.ultimo}</span>
      </span>
      <span
        className={`${estilos.panelEstado} ${
          conversacion.estado === "confirmado" ? estilos.panelEstadoConfirmado : estilos.panelEstadoCurso
        }`}
      >
        {conversacion.estado}
      </span>
    </li>
  );
}
