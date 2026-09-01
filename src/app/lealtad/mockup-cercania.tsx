"use client";

import { useEffect, useState } from "react";
import { useMockupVivo } from "./use-mockup-vivo";
import { MarcoIPhone } from "./telefono-mockup";

/**
 * LA COMPOSICIÓN ANIMADA DE «CUANDO PASAN CERCA» (ago 2026) — el
 * geo-aviso: el punto del cliente se acerca al pin del negocio en un
 * mini-mapa, y AL LLEGAR a la zona (el círculo de cobertura) la
 * notificación entra sola. Mismo marco de teléfono que las otras dos
 * franjas de esta sección, para que se lean como familia; lo que
 * cambia es lo que pasa ANTES de la notificación — acá hay un
 * desplazamiento en el espacio, no una escritura ni una cuenta de
 * sellos.
 */

type Fase = "acercando" | "notificacion" | "pausa";

const PASOS = 22; // cuántos fotogramas tiene el recorrido del punto

export default function MockupCercania() {
  // Quieto: el punto ya está sobre el pin y la notificación visible.
  const [paso, setPaso] = useState(PASOS);
  const [fase, setFase] = useState<Fase>("notificacion");

  // `vivo` reemplaza al viejo `animar`: preferencia de movimiento Y
  // cercanía al viewport en una sola bandera (`useMockupVivo`), así el
  // punto no recorre el mapa mientras nadie lo mira. El reset del
  // montaje sobra: el loop entra por `notificacion` —el estado
  // inicial— y al reiniciar la vuelta ya pone el punto en cero.
  const { ref, vivo } = useMockupVivo<HTMLDivElement>();

  useEffect(() => {
    if (!vivo) return;
    let t: ReturnType<typeof setTimeout>;
    if (fase === "acercando") {
      if (paso < PASOS) {
        t = setTimeout(() => setPaso((n) => n + 1), 90);
      } else {
        t = setTimeout(() => setFase("notificacion"), 350);
      }
    } else if (fase === "notificacion") {
      t = setTimeout(() => setFase("pausa"), 3600);
    } else {
      t = setTimeout(() => {
        setPaso(0);
        setFase("acercando");
      }, 900);
    }
    return () => clearTimeout(t);
  }, [vivo, fase, paso]);

  const notificacionVisible = fase === "notificacion";
  const progreso = Math.min(paso, PASOS) / PASOS;
  // Trayecto curvo desde la esquina inferior-izquierda del mapa hasta
  // el pin, con una interpolación cuadrática simple.
  const inicioX = 8;
  const inicioY = 78;
  const finX = 62;
  const finY = 40;
  const controlX = 18;
  const controlY = 34;
  const x =
    (1 - progreso) ** 2 * inicioX +
    2 * (1 - progreso) * progreso * controlX +
    progreso ** 2 * finX;
  const y =
    (1 - progreso) ** 2 * inicioY +
    2 * (1 - progreso) * progreso * controlY +
    progreso ** 2 * finY;
  const enZona = progreso > 0.82;

  return (
    /* ⚠️ EL `sr-only` ESTABA ADENTRO DEL `aria-hidden`.
       Un `aria-hidden` esconde el subárbol ENTERO, así que el párrafo
       que explicaba el mockup no le llegaba a nadie: quien no ve la
       pantalla se encontraba con un hueco mudo. El texto sale afuera
       —es lo único que ese público recibe— y el dibujo se queda
       escondido, que es lo correcto para una ilustración. */
    <div ref={ref} className="flex justify-center">
      <p className="sr-only">
        Cuando el cliente pasa cerca del negocio, la tarjeta le aparece sola en
        la pantalla de bloqueo con el mensaje que el negocio escribió, sin abrir
        ninguna app. Funciona solo en iPhone.
      </p>

      {/* El chasis sale de `MarcoIPhone`: acá había uno dibujado a
          mano, y otro distinto en cada mockup — seis teléfonos con
          distinto degradado, radio e isla en la misma página. */}
      <MarcoIPhone
        ancho="w-[268px] sm:w-[287px]"
        fondoPantalla={"radial-gradient(circle at 22% 16%, rgba(157,180,255,.35), transparent 52%)," + "linear-gradient(195deg,#1b2a55 0%,#31437c 52%,#7286c4 100%)"}
        className="relative -rotate-[1.5deg]"
        conBrillo={false}
      >
          <div className="pt-11 text-center text-white">
            <p className="text-[13px] opacity-80">🔒</p>
            <p className="mt-2 text-[13px] font-bold text-white/85">
              miércoles, 20 de agosto
            </p>
            <p className="mt-0.5 text-[52px] font-extrabold leading-none tracking-tight">
              9:41
            </p>
          </div>

          {/* El mini-mapa: la zona de cobertura, el pin del negocio y
              el punto del cliente acercándose por una curva. */}
          <div className="mx-6 mt-6 overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm">
            <svg
              viewBox="0 0 84 90"
              className="block w-full"
              style={{ height: 118 }}
            >
              {/* Calles, apenas insinuadas */}
              <line
                x1="0"
                y1="20"
                x2="84"
                y2="14"
                stroke="rgba(255,255,255,.10)"
                strokeWidth="2"
              />
              <line
                x1="0"
                y1="55"
                x2="84"
                y2="60"
                stroke="rgba(255,255,255,.10)"
                strokeWidth="2"
              />
              <line
                x1="20"
                y1="0"
                x2="30"
                y2="90"
                stroke="rgba(255,255,255,.10)"
                strokeWidth="2"
              />
              <line
                x1="55"
                y1="0"
                x2="50"
                y2="90"
                stroke="rgba(255,255,255,.10)"
                strokeWidth="2"
              />

              {/* La zona de cobertura alrededor del negocio */}
              <circle
                cx={finX}
                cy={finY}
                r="22"
                fill="rgba(243,146,0,.10)"
                stroke="rgba(243,146,0,.35)"
                strokeDasharray="3 3"
              />
              {/* ⚠️ EL PULSO ES SMIL, Y SMIL NO CONOCE
                  `prefers-reduced-motion`. Es una animación declarada
                  dentro del SVG: no pasa por CSS, así que el bloque
                  maestro de globals.css no la puede apagar y el
                  `@media` tampoco la alcanza.

                  El resto del mockup sí respetaba la preferencia —el
                  bucle de JS no arranca— pero este círculo latía igual
                  para siempre, porque su condición era `enZona`, y en
                  el estado QUIETO el punto ya está sobre el pin
                  (`progreso === 1`), o sea que `enZona` es verdadero.

                  Ahora depende de `vivo`, que es la misma bandera que
                  gobierna todo lo demás — movimiento bienvenido Y
                  mockup a la vista, porque SMIL late aunque nadie mire
                  y fuera del viewport también conviene el quieto. Con
                  el reloj pausado el círculo se dibuja QUIETO en vez de
                  desaparecer: la zona de cobertura es información
                  —muestra hasta dónde llega el aviso—, no decoración. */}
              {enZona &&
                (vivo ? (
                  <circle
                    cx={finX}
                    cy={finY}
                    r="22"
                    fill="none"
                    stroke="rgba(243,146,0,.55)"
                  >
                    <animate
                      attributeName="r"
                      values="8;24"
                      dur="1.1s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values=".7;0"
                      dur="1.1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                ) : (
                  <circle
                    cx={finX}
                    cy={finY}
                    r="18"
                    fill="none"
                    stroke="rgba(243,146,0,.45)"
                  />
                ))}

              {/* El pin del negocio */}
              <circle
                cx={finX}
                cy={finY}
                r="4.5"
                fill="var(--orange, #f39200)"
              />
              <circle
                cx={finX}
                cy={finY}
                r="4.5"
                fill="none"
                stroke="white"
                strokeWidth="1"
                opacity=".6"
              />

              {/* El punto del cliente, recorriendo la curva */}
              <circle cx={x} cy={y} r="3.5" fill="#ffffff" />
              <circle
                cx={x}
                cy={y}
                r="6"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1"
                opacity=".45"
              />
            </svg>
          </div>
          <p className="mt-2 text-center text-[11px] font-bold text-white/70">
            {enZona ? "Entró en la zona de tu negocio" : "Se está acercando…"}
          </p>

          {/* La notificación */}
          <div
            className={`mx-3 mt-6 rounded-[18px] bg-white/95 p-3.5 transition-[transform,opacity] duration-500 ${
              notificacionVisible
                ? "translate-y-0 opacity-100"
                : "-translate-y-10 opacity-0"
            }`}
            style={{ boxShadow: "0 14px 34px rgba(10,18,38,.25)" }}
          >
            <div className="flex items-start gap-2.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[16px]"
                style={{
                  background: "linear-gradient(145deg,#16295e,#0f4c9e)",
                }}
              >
                📍
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12.5px] font-extrabold text-[#0d1733]">
                    Café Aurora
                  </p>
                  <p className="shrink-0 text-[10px] font-bold text-[#8a91a4]">
                    ahora
                  </p>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[#3a4356]">
                  Estás a dos cuadras. Tu tarjeta tiene 6 de 8 sellos.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-between px-9">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-[15px]">
              🔦
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-[15px]">
              📷
            </span>
          </div>
          <span className="absolute bottom-2 left-1/2 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-white/85" />
      </MarcoIPhone>
    </div>
  );
}
