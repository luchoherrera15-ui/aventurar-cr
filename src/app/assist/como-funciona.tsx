"use client";

/**
 * BANDA 4 — CÓMO FUNCIONA (oscuro). La sección más importante de la
 * página: un contenedor de 312vh con un hijo `sticky` adentro. El
 * progreso de scroll ahí dentro se cuantiza a 4 ESTADOS DISCRETOS (no
 * continuos) que sincronizan el iPhone y la vista de agenda.
 *
 * El DOM solo se toca cuando cambia el índice del paso (0..3) — el
 * callback del scrubber corre en cada frame, pero compara contra
 * `ultimoPasoRef` antes de llamar `setPaso`, así que un `getBoundingClientRect`
 * de más no significa un render de más.
 *
 * Con `prefers-reduced-motion: reduce` esta sección NO arma el
 * contenedor alto: sería 312vh de scroll vacío para algo que ya se
 * muestra resuelto. En su lugar se renderiza directo el paso final
 * (la reserva ya agendada), de largo normal.
 */

import { useCallback, useRef, useState } from "react";
import { useMotionReducido, useScrubber } from "./motor";
import IphoneFrame from "./iphone-frame";
import { BurbujaChat, EscribiendoChat } from "./burbuja-chat";
import { NEGOCIO_DEMO } from "./constantes";
import estilos from "./assist.module.css";

type EstadoAgendaHora = "libre" | "ocupado";

const AGENDA_HORAS: { hora: string; estado: EstadoAgendaHora }[] = [
  { hora: "09:00", estado: "ocupado" },
  { hora: "09:45", estado: "ocupado" },
  { hora: "10:30", estado: "libre" },
  { hora: "11:15", estado: "ocupado" },
  { hora: "13:00", estado: "libre" },
  { hora: "13:45", estado: "ocupado" },
  { hora: "14:15", estado: "libre" },
  { hora: "15:00", estado: "libre" },
  { hora: "15:45", estado: "ocupado" },
  { hora: "16:30", estado: "libre" },
  { hora: "17:15", estado: "ocupado" },
  { hora: "18:00", estado: "libre" },
];

const HORAS_PROPUESTAS = ["15:00", "16:30"];
const HORA_CONFIRMADA = "15:00";

const PASOS = [
  { etiqueta: "en espera", globo: "contesta en 4 segundos" },
  { etiqueta: "consultando disponibilidad…", globo: "lee tu agenda de verdad" },
  { etiqueta: "2 espacios calzan · 45 min", globo: "solo horas que de verdad calzan" },
  { etiqueta: "reserva escrita en Bookea", globo: "reserva creada sin vos" },
] as const;

const MENSAJE_CLIENTE = "Hola! ¿Tienen campo hoy para diseño en gel?";
const MENSAJE_BOT_HORAS = "Reviso tu agenda… Tengo 3:00pm y 4:30pm libres para diseño en gel.";
const MENSAJE_CLIENTE_CONFIRMA = "¡Las 3, porfa!";
const MENSAJE_BOT_CONFIRMA = `Quedás confirmada hoy 3:00pm en ${NEGOCIO_DEMO}. ¡Nos vemos!`;

function HiloIphone({ paso }: { paso: number }) {
  return (
    <div className={estilos.chatFondo}>
      <div className={estilos.chatHilo}>
        <BurbujaChat autor="cliente">{MENSAJE_CLIENTE}</BurbujaChat>
        {paso === 1 && <EscribiendoChat />}
        {paso >= 2 && <BurbujaChat autor="bot">{MENSAJE_BOT_HORAS}</BurbujaChat>}
        {paso >= 3 && (
          <>
            <BurbujaChat autor="cliente">{MENSAJE_CLIENTE_CONFIRMA}</BurbujaChat>
            <BurbujaChat autor="bot" etiqueta="reserva creada">
              {MENSAJE_BOT_CONFIRMA}
            </BurbujaChat>
          </>
        )}
      </div>
    </div>
  );
}

function VistaAgenda({ paso, cicloConfirmado }: { paso: number; cicloConfirmado: number }) {
  return (
    <div
      className={`${estilos.agenda} ${paso === 0 ? estilos.agendaAtenuada : ""} ${
        paso === 1 ? estilos.agendaEscaneando : ""
      }`}
    >
      <div className={estilos.agendaCabecera}>
        <span className={estilos.agendaKicker}>Agenda de Bookea</span>
        <span className={estilos.agendaNegocio}>{NEGOCIO_DEMO}</span>
      </div>
      <div className={estilos.agendaLista}>
        {AGENDA_HORAS.map(({ hora, estado }) => {
          const propuesta = paso >= 2 && paso < 3 && HORAS_PROPUESTAS.includes(hora);
          const confirmada = paso >= 3 && hora === HORA_CONFIRMADA;
          return (
            <div
              key={hora}
              className={`${estilos.agendaFila} ${estado === "ocupado" ? estilos.agendaOcupada : estilos.agendaLibre} ${
                propuesta ? estilos.agendaPropuesta : ""
              } ${confirmada ? estilos.agendaConfirmada : ""}`}
            >
              <span className={estilos.agendaHora}>{hora}</span>
              <span className={estilos.agendaEstadoTexto}>
                {confirmada ? (
                  <span className={estilos.agendaCheckWrap} key={`ripple-${cicloConfirmado}`}>
                    <span className={estilos.agendaCheck} aria-hidden="true">
                      ✓
                    </span>
                    <span className={estilos.agendaRipple} aria-hidden="true" />
                  </span>
                ) : estado === "ocupado" ? (
                  "ocupado"
                ) : (
                  "libre"
                )}
              </span>
            </div>
          );
        })}
        {paso === 1 && <span className={estilos.agendaScanLine} aria-hidden="true" />}
      </div>
    </div>
  );
}

function MockupDoble({ paso, cicloConfirmado }: { paso: number; cicloConfirmado: number }) {
  return (
    <div className={estilos.comoStage}>
      <div className={estilos.comoTelefono}>
        <IphoneFrame etiqueta="Bookea Assist contestando en WhatsApp">
          <HiloIphone paso={paso} />
        </IphoneFrame>
        <div className={estilos.globo} key={`globo-${paso}`}>
          {PASOS[paso].globo}
        </div>
        {paso === 3 && (
          <div className={estilos.notiIos} key={`noti-${cicloConfirmado}`}>
            <span className={estilos.notiIcono} aria-hidden="true">
              B
            </span>
            <span className={estilos.notiTexto}>
              <strong>Bookea</strong> — Nueva reserva: {NEGOCIO_DEMO}, hoy 3:00pm
            </span>
          </div>
        )}
      </div>
      <VistaAgenda paso={paso} cicloConfirmado={cicloConfirmado} />
    </div>
  );
}

export default function ComoFunciona() {
  const reducedMotion = useMotionReducido();
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const [paso, setPaso] = useState(0);
  const ultimoPasoRef = useRef(0);
  const cicloConfirmadoRef = useRef(0);
  const [cicloConfirmado, setCicloConfirmado] = useState(0);

  // El contador de "ciclo confirmado" se incrementa DENTRO del mismo
  // callback del scrubber que decide el paso (no en un efecto aparte
  // que reacciona a `paso`): así el popup y la notificación del paso 4
  // se pueden re-disparar por `key` sin encadenar un segundo render
  // detrás del primero cada vez que se entra al paso 4.
  const onProgress = useCallback((p: number) => {
    const indice = p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3;
    if (indice !== ultimoPasoRef.current) {
      ultimoPasoRef.current = indice;
      if (indice === 3) {
        cicloConfirmadoRef.current += 1;
        setCicloConfirmado(cicloConfirmadoRef.current);
      }
      setPaso(indice);
    }
  }, []);

  useScrubber(contenedorRef, onProgress);

  if (reducedMotion) {
    return (
      <section className={estilos.comoFuncionaEstatico} aria-label="Cómo funciona Bookea Assist">
        <Cabecera />
        <MockupDoble paso={3} cicloConfirmado={1} />
      </section>
    );
  }

  return (
    <section ref={contenedorRef} className={estilos.comoFunciona} aria-label="Cómo funciona Bookea Assist">
      <div className={estilos.comoSticky}>
        <Cabecera />
        <MockupDoble paso={paso} cicloConfirmado={cicloConfirmado} />
        <p className={estilos.comoEtiquetaEstado} key={`etq-${paso}`}>
          {PASOS[paso].etiqueta}
        </p>
        <div className={estilos.comoProgresoPuntos} aria-hidden="true">
          {PASOS.map((_, i) => (
            <span key={i} className={`${estilos.comoPunto} ${i === paso ? estilos.comoPuntoActivo : ""}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Cabecera() {
  return (
    <div className={estilos.comoCabecera}>
      <p className={estilos.kickerOscuro}>Cómo funciona</p>
      <h2 className={`${estilos.d2} ${estilos.tituloOscuro}`}>Cuatro pasos, cero espera.</h2>
    </div>
  );
}
