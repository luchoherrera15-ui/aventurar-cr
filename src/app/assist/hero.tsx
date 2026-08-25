"use client";

/**
 * BANDA 1 — HERO (oscuro).
 *
 * Blobs ambiente en CSS puro (no pasan por el motor de scroll: no
 * dependen del scroll, y `prefers-reduced-motion` los apaga solo con
 * media query, sin JS). El titular entra escalonado al montar. El
 * mockup de iPhone corre un guion de chat en loop, y los 3 chips lo
 * interrumpen para "escribirle" un mensaje de ejemplo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IphoneFrame from "./iphone-frame";
import { BurbujaChat, EscribiendoChat } from "./burbuja-chat";
import { useMotionReducido } from "./motor";
import { NEGOCIO_DEMO, WHATSAPP_ASSIST } from "./constantes";
import estilos from "./assist.module.css";

type Turno =
  | { tipo: "cliente"; texto: string }
  | { tipo: "escribiendo" }
  | { tipo: "bot"; texto: string; etiqueta?: string };

type MensajeMostrado = {
  id: number;
  autor: "cliente" | "bot";
  texto: string;
  escribiendo?: boolean;
  etiqueta?: string;
};

const GUION_BASE: Turno[] = [
  { tipo: "cliente", texto: "Hola! ¿Tienen campo mañana para manicure?" },
  { tipo: "escribiendo" },
  { tipo: "bot", texto: `¡Hola! Acabo de revisar la agenda de ${NEGOCIO_DEMO}: tengo 2:00pm y 4:00pm libres.` },
  { tipo: "cliente", texto: "Las 4, porfa 🙌" },
  { tipo: "bot", texto: "Listo, quedás confirmada hoy a las 4:00pm. ¡Te espero!", etiqueta: "reserva creada" },
];

const CHIPS: { texto: string; respuesta: string }[] = [
  {
    texto: "¿Tenés espacio mañana?",
    respuesta: "Déjame revisar tu agenda… tengo 10:30am y 3:00pm libres mañana.",
  },
  {
    texto: "¿Cuánto cuesta el diseño en gel?",
    respuesta: "El diseño en gel está en ₡12.000. ¿Te reservo un espacio?",
  },
  {
    texto: "Quiero cambiar mi cita",
    respuesta: "Claro, ¿para qué día y hora te acomoda mejor?",
  },
];

let idMensaje = 0;
function siguienteId() {
  idMensaje += 1;
  return idMensaje;
}

/** El guion completo, ya resuelto, para `prefers-reduced-motion`: un
 *  valor constante calculado una sola vez (no en un efecto) para que
 *  el componente pueda usarlo directo en el render sin pasar por
 *  `setState` — evita la cascada de renders que dispara sincronizar
 *  estado en el cuerpo de un efecto. */
const MENSAJES_FINALES: MensajeMostrado[] = GUION_BASE.filter(
  (t): t is Extract<Turno, { tipo: "cliente" | "bot" }> => t.tipo !== "escribiendo",
).map((t) => ({
  id: siguienteId(),
  autor: t.tipo,
  texto: t.texto,
  etiqueta: t.tipo === "bot" ? t.etiqueta : undefined,
}));

export default function Hero() {
  const reducedMotion = useMotionReducido();
  const [montado, setMontado] = useState(false);
  // El valor inicial ya resuelve reduced motion: `reducedMotion` es
  // correcto desde el primer render en cliente (ver `useMotionReducido`
  // en motor.tsx), así que no hace falta un efecto para "corregir"
  // mensajes a su estado final — el inicializador perezoso alcanza, y
  // el click de un chip (evento, no efecto) lo sigue pudiendo cambiar.
  const [mensajes, setMensajes] = useState<MensajeMostrado[]>(() =>
    reducedMotion ? MENSAJES_FINALES : [],
  );
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const limpiarTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const correrGuion = useCallback(
    (guion: Turno[], alTerminar?: () => void) => {
      setMensajes([]);
      let acumulado = 0;
      guion.forEach((turno, i) => {
        acumulado += i === 0 ? 500 : 1500;
        const t = setTimeout(() => {
          setMensajes((prev) => {
            const sinEscribiendo = prev.filter((m) => !m.escribiendo);
            if (turno.tipo === "escribiendo") {
              return [...sinEscribiendo, { id: siguienteId(), autor: "bot", texto: "", escribiendo: true }];
            }
            return [
              ...sinEscribiendo,
              {
                id: siguienteId(),
                autor: turno.tipo,
                texto: turno.texto,
                etiqueta: turno.tipo === "bot" ? turno.etiqueta : undefined,
              },
            ];
          });
        }, acumulado);
        timersRef.current.push(t);
      });
      if (alTerminar) {
        const t = setTimeout(alTerminar, acumulado + 3200);
        timersRef.current.push(t);
      }
    },
    [],
  );

  const iniciarLoop = useCallback(() => {
    const ciclo = () => correrGuion(GUION_BASE, ciclo);
    ciclo();
  }, [correrGuion]);

  useEffect(() => {
    // Con reduced motion no hay loop que arrancar: `mensajesMostrados`
    // (más abajo) ya resuelve al guion final constante, sin tocar
    // estado desde acá.
    if (reducedMotion) return;
    iniciarLoop();
    return () => limpiarTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const alClickChip = useCallback(
    (chip: (typeof CHIPS)[number]) => {
      limpiarTimers();
      const guion: Turno[] = [
        { tipo: "cliente", texto: chip.texto },
        { tipo: "escribiendo" },
        { tipo: "bot", texto: chip.respuesta },
      ];
      if (reducedMotion) {
        setMensajes(
          guion
            .filter((t): t is Extract<Turno, { tipo: "cliente" | "bot" }> => t.tipo !== "escribiendo")
            .map((t) => ({ id: siguienteId(), autor: t.tipo, texto: t.texto })),
        );
        return;
      }
      correrGuion(guion, iniciarLoop);
    },
    [limpiarTimers, correrGuion, iniciarLoop, reducedMotion],
  );

  const palabrasTitulo = useMemo(() => "Tu WhatsApp, atendido las 24 horas.".split(" "), []);

  return (
    <section className={estilos.hero} aria-label="Bookea Assist">
      <div className={estilos.heroFondo} aria-hidden="true">
        <span className={`${estilos.blob} ${estilos.blobA}`} />
        <span className={`${estilos.blob} ${estilos.blobB}`} />
        <span className={`${estilos.blob} ${estilos.blobC}`} />
      </div>

      <div className={estilos.heroInner}>
        <div className={estilos.heroTexto}>
          <p className={estilos.kickerOscuro}>Bookea Assist</p>
          <h1 className={`${estilos.d1} ${estilos.heroTitulo}`}>
            {palabrasTitulo.map((palabra, i) => (
              <span
                key={`${palabra}-${i}`}
                className={`${estilos.heroPalabra} ${montado ? estilos.heroPalabraVisible : ""}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                {palabra}&nbsp;
              </span>
            ))}
          </h1>
          <p className={`${estilos.cuerpoOscuro} ${estilos.heroBajada}`}>
            Contesta, revisa tu agenda real en Bookea y agenda la cita sola — mientras vos
            seguís con el negocio. Tus clientes le escriben al mismo WhatsApp de siempre.
          </p>
          <div className={estilos.heroAcciones}>
            <a
              className={estilos.botonNaranja}
              href={WHATSAPP_ASSIST}
              target="_blank"
              rel="noopener noreferrer"
            >
              Probalo por WhatsApp
            </a>
            <span className={estilos.heroNota}>Se instala en el número que ya usás.</span>
          </div>
          <div className={estilos.heroChips}>
            {CHIPS.map((chip) => (
              <button
                key={chip.texto}
                type="button"
                className={estilos.chip}
                onClick={() => alClickChip(chip)}
              >
                {chip.texto}
              </button>
            ))}
          </div>
        </div>

        <div className={estilos.heroTelefono}>
          <IphoneFrame etiqueta="Ejemplo de conversación de WhatsApp con Bookea Assist">
            <div className={estilos.chatFondo}>
              <div className={estilos.chatHilo}>
                {mensajes.map((m) =>
                  m.escribiendo ? (
                    <EscribiendoChat key={m.id} />
                  ) : (
                    <BurbujaChat key={m.id} autor={m.autor} etiqueta={m.etiqueta}>
                      {m.texto}
                    </BurbujaChat>
                  ),
                )}
              </div>
            </div>
          </IphoneFrame>
        </div>
      </div>
    </section>
  );
}
