"use client";

import { useEffect, useRef } from "react";

/**
 * La secuencia fijada: el corazón de la página.
 *
 * Es un tramo alto de scroll con la escena pegada al centro de la
 * pantalla. Mientras se baja, UNA sola invitación va contando toda la
 * historia del producto sin cortes: la tarjeta se encoge y entra al
 * teléfono, aparecen los botones de confirmar, y al final el teléfono
 * se corre para dejar entrar la lista de invitados que se llena sola.
 *
 * Por qué así y no cuatro capturas de pantalla en fila: el argumento de
 * venta es que es UNA cosa, no cuatro. Verlo transformarse lo dice sin
 * escribirlo.
 *
 * DECISIONES DE IMPLEMENTACIÓN
 *
 * · Se escribe el `style` de los nodos con refs, no con estado de
 *   React. Un `setState` por cuadro de scroll re-renderiza el árbol
 *   sesenta veces por segundo y la animación se entrecorta justo en los
 *   teléfonos donde más gente la va a ver.
 * · Todo lo que se anima es `transform` y `opacity` — las dos
 *   propiedades que el navegador resuelve sin volver a calcular el
 *   layout. Mover `top` o `height` acá tiraría los cuadros al piso.
 * · Con `prefers-reduced-motion` no se anima nada: se muestra la escena
 *   final armada y los textos quedan todos visibles. La página se lee
 *   igual, sin movimiento.
 */

/** Ventanas [entra, sale] de cada bloque de texto, en progreso 0..1. */
const BANDAS: [number, number][] = [
  [0.0, 0.16],
  [0.2, 0.38],
  [0.42, 0.6],
  [0.64, 1.2],
];

const TEXTOS = [
  {
    titulo: "Se abre en cualquier teléfono.",
    cuerpo:
      "Un link, nada que descargar. Lo mandás por WhatsApp y se abre a pantalla completa, igual en un iPhone que en un Android de hace cinco años.",
  },
  {
    titulo: "Con toda la fiesta adentro.",
    cuerpo:
      "La fecha, el lugar con su mapa, el código de vestimenta, la cuenta regresiva. Lo que antes eran seis mensajes sueltos, en un solo lugar.",
  },
  {
    titulo: "Confirman con un toque.",
    cuerpo:
      "Sin cuentas, sin formularios largos. Tu invitado dice si va, con cuántos, y responde lo que vos preguntes: menú, alergias, lo que necesités.",
  },
  {
    titulo: "Y la lista se te arma sola.",
    cuerpo:
      "Vos abrís tu panel y ves quién dijo que sí, quién no, y cuántas personas llegan en total. Ese es el número que le pasás al salón.",
  },
];

function limitar(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
/** Progreso dentro de un tramo, ya recortado a 0..1. */
function tramo(p: number, a: number, b: number) {
  return limitar((p - a) / (b - a), 0, 1);
}
function suavizar(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function entre(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function Reel({ claseSerif }: { claseSerif: string }) {
  const pistaRef = useRef<HTMLDivElement>(null);
  const papelRef = useRef<HTMLDivElement>(null);
  const telefonoRef = useRef<HTMLDivElement>(null);
  const rsvpRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contadorRef = useRef<HTMLSpanElement>(null);
  const escenaRef = useRef<HTMLDivElement>(null);
  const textosRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const sinMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const pista = pistaRef.current;
    const papel = papelRef.current;
    const telefono = telefonoRef.current;
    const rsvp = rsvpRef.current;
    const panel = panelRef.current;
    const contador = contadorRef.current;
    const escena = escenaRef.current;
    if (!pista || !papel || !telefono || !rsvp || !panel || !escena) return;

    // Sin movimiento: se arma la escena final y se muestran todos los
    // textos. Nadie se pierde nada, simplemente no se mueve.
    if (sinMovimiento) {
      papel.style.opacity = "0";
      telefono.style.opacity = "1";
      telefono.style.transform = "none";
      rsvp.style.opacity = "1";
      rsvp.style.transform = "none";
      panel.style.opacity = "1";
      // Mismo centrado que en la animación, o el panel sale corrido.
      panel.style.transform =
        window.innerWidth < 900 ? "translate(-50%, -50%)" : "translate(0, -50%)";
      if (contador) contador.textContent = "128";
      textosRef.current.forEach((t) => {
        if (t) {
          t.style.opacity = "1";
          t.style.transform = "none";
          t.style.position = "relative";
          t.style.marginBottom = "28px";
        }
      });
      return;
    }

    let angosto = window.innerWidth < 900;
    let ultimo = -1;
    let pedido = 0;

    function dibujar(p: number) {
      // 1. La tarjeta se encoge, se endereza y se apaga.
      const morfo = suavizar(tramo(p, 0.04, 0.2));
      papel!.style.transform = `translateY(${-morfo * 14}px) scale(${entre(1, 0.58, morfo)}) rotate(${entre(-3.2, 0, morfo)}deg)`;
      papel!.style.opacity = String(1 - tramo(p, 0.1, 0.19));

      // 2. El teléfono entra por debajo de donde estaba la tarjeta.
      const entra = suavizar(tramo(p, 0.11, 0.26));
      // 4. Y más adelante se corre a la izquierda para dejar lugar al panel.
      const corrida = suavizar(tramo(p, 0.66, 0.82));
      const dx = angosto ? 0 : entre(0, -170, corrida);
      const dy = angosto ? entre(0, -40, corrida) : 0;
      const escala = entre(0.86, angosto ? 0.82 : 1, entra) * entre(1, 0.92, corrida);
      telefono!.style.transform = `translate(${dx}px, ${entre(28, 0, entra) + dy}px) scale(${escala})`;
      // En pantalla angosta no hay lugar para el teléfono Y el panel al
      // mismo tiempo: el teléfono se apaga y el panel ocupa su lugar. En
      // escritorio conviven, que es lo que mejor cuenta la historia.
      const salidaTelefono = angosto ? tramo(p, 0.72, 0.84) : 0;
      telefono!.style.opacity = String(tramo(p, 0.12, 0.22) * (1 - salidaTelefono));

      // 3. Los botones de confirmar suben dentro del teléfono.
      const conf = suavizar(tramo(p, 0.44, 0.58));
      rsvp!.style.transform = `translateY(${entre(26, 0, conf)}px)`;
      rsvp!.style.opacity = String(conf);

      // 4. El panel de invitados entra desde la derecha, contando.
      const listado = suavizar(tramo(p, 0.7, 0.88));
      const escalaPanel = entre(0.94, 1, listado);
      // El -50% del centrado viaja en el mismo transform: si se dejara
      // en una clase de Tailwind, este estilo en línea la borraría.
      panel!.style.transform = angosto
        ? `translate(-50%, calc(-50% + ${entre(40, 0, listado)}px)) scale(${escalaPanel})`
        : `translate(${entre(60, 0, listado)}px, -50%) scale(${escalaPanel})`;
      panel!.style.opacity = String(listado);
      if (contador) {
        contador.textContent = String(Math.round(entre(0, 128, listado)));
      }

      // Los textos entran y salen en su propia ventana.
      textosRef.current.forEach((nodo, i) => {
        if (!nodo) return;
        const [desde, hasta] = BANDAS[i];
        const dentro = tramo(p, desde, desde + 0.06);
        const fuera = tramo(p, hasta - 0.06, hasta);
        const visible = dentro * (1 - fuera);
        nodo.style.opacity = String(visible);
        nodo.style.transform = `translateY(${entre(18, 0, dentro)}px)`;
        // Sin esto, un bloque invisible sigue capturando los clics del
        // que está encima.
        nodo.style.pointerEvents = visible > 0.5 ? "auto" : "none";
      });
    }

    function alScrollear() {
      if (pedido) return;
      pedido = requestAnimationFrame(() => {
        pedido = 0;
        const caja = pista!.getBoundingClientRect();
        const recorrido = caja.height - window.innerHeight;
        const p = recorrido <= 0 ? 0 : limitar(-caja.top / recorrido, 0, 1);
        // Redondeo: sin esto se redibuja con diferencias invisibles.
        const redondeado = Math.round(p * 1000) / 1000;
        if (redondeado === ultimo) return;
        ultimo = redondeado;
        dibujar(redondeado);
      });
    }

    function alRedimensionar() {
      angosto = window.innerWidth < 900;
      ultimo = -1;
      alScrollear();
    }

    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    window.addEventListener("resize", alRedimensionar);
    return () => {
      window.removeEventListener("scroll", alScrollear);
      window.removeEventListener("resize", alRedimensionar);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, []);

  return (
    <div ref={pistaRef} className="relative h-[460svh] md:h-[520svh]">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-[min(1120px,92vw)] items-center gap-8 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          {/* ---------- Columna de texto ---------- */}
          <div className="relative order-2 min-h-[210px] md:order-1 md:min-h-[280px]">
            {TEXTOS.map((t, i) => (
              <div
                key={t.titulo}
                ref={(n) => {
                  textosRef.current[i] = n;
                }}
                className="md:absolute md:inset-x-0 md:top-1/2 md:-translate-y-1/2"
                style={{ opacity: 0 }}
              >
                <h2 className="titulo text-[clamp(28px,4.4vw,52px)] leading-[1.06] text-white">
                  {t.titulo}
                </h2>
                <p className="mt-4 max-w-[46ch] text-[clamp(15px,1.7vw,19px)] leading-relaxed text-white/60">
                  {t.cuerpo}
                </p>
              </div>
            ))}
          </div>

          {/* ---------- Columna de la escena ---------- */}
          <div
            ref={escenaRef}
            className="order-1 flex h-[46svh] items-center justify-center md:order-2 md:h-[72svh]"
          >
            <div className="relative flex items-center justify-center">
              {/* La tarjeta de papel, que es como empieza todo. */}
              <div
                ref={papelRef}
                className="absolute w-[min(300px,74vw)] rounded-2xl px-8 py-12 text-center shadow-[0_40px_90px_-40px_rgba(0,0,0,.7)]"
                style={{ background: "#efe7d8", color: "#2a2318" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.36em] text-[#a08a4e]">
                  Nos casamos
                </p>
                <p className={`${claseSerif} mt-5 text-[34px] leading-[1.1]`}>
                  Sofía
                  <span className="mx-2 text-[#c9a227]">&</span>
                  Andrés
                </p>
                <div className="mx-auto my-5 h-px w-14 bg-[#c9a227]" />
                <p className="text-[11.5px] uppercase tracking-[0.2em] text-[#6b5c3e]">
                  12 · Diciembre · 2026
                </p>
              </div>

              {/* El teléfono, con la misma invitación adentro. */}
              <div
                ref={telefonoRef}
                className="relative h-[min(560px,60svh)] w-[min(276px,68vw)] rounded-[40px] border-[7px] p-2"
                style={{
                  opacity: 0,
                  borderColor: "#0a1226",
                  background: "#0a1226",
                  boxShadow: "0 50px 110px -45px rgba(0,0,0,.85)",
                }}
              >
                <div
                  className="relative flex h-full w-full flex-col overflow-hidden rounded-[32px] px-5 py-8 text-center"
                  style={{ background: "#efe7d8", color: "#2a2318" }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#a08a4e]">
                    Nos casamos
                  </p>
                  <p className={`${claseSerif} mt-4 text-[30px] leading-[1.1]`}>
                    Sofía
                    <span className="mx-1.5 text-[#c9a227]">&</span>
                    Andrés
                  </p>
                  <div className="mx-auto my-4 h-px w-12 bg-[#c9a227]" />
                  <p className="text-[10.5px] uppercase tracking-[0.18em] text-[#6b5c3e]">
                    12 · Dic · 2026 · 4:00 p.m.
                  </p>
                  <p className="mt-1.5 text-[10.5px] text-[#6b5c3e]">
                    Hacienda La Chimba, Atenas
                  </p>

                  {/* La cuenta regresiva, que es lo que engancha. */}
                  <div className="mt-6 flex justify-center gap-2">
                    {[
                      ["108", "días"],
                      ["06", "hrs"],
                      ["42", "min"],
                    ].map(([n, l]) => (
                      <div
                        key={l}
                        className="min-w-[54px] rounded-xl bg-[#e3d8c2] px-2 py-2"
                      >
                        <p className="text-[17px] font-bold leading-none">{n}</p>
                        <p className="mt-1 text-[8.5px] uppercase tracking-[0.14em] text-[#8a7752]">
                          {l}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Confirmar asistencia. */}
                  <div ref={rsvpRef} className="mt-auto" style={{ opacity: 0 }}>
                    <p className="mb-2.5 text-[10.5px] uppercase tracking-[0.16em] text-[#8a7752]">
                      ¿Nos acompañás?
                    </p>
                    <div className="flex gap-2">
                      <span
                        className="flex-1 rounded-xl py-2.5 text-[12.5px] font-bold text-white"
                        style={{ background: "#1f7a4d" }}
                      >
                        Sí, ahí estaré
                      </span>
                      <span className="rounded-xl border border-[#c9bda2] px-3 py-2.5 text-[12.5px] font-bold text-[#6b5c3e]">
                        No podré
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* El panel del anfitrión, que entra al final. */}
              <div
                ref={panelRef}
                // El centrado va en el `transform` que escribe el JS, no
                // en clases: una utilidad de Tailwind acá la pisaría el
                // estilo en línea y el panel saldría corrido.
                className="absolute left-1/2 top-1/2 w-[min(248px,72vw)] rounded-2xl border border-white/12 p-5 md:left-auto md:right-[-14%]"
                style={{
                  opacity: 0,
                  background: "#16295e",
                  boxShadow: "0 40px 90px -40px rgba(0,0,0,.8)",
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  Tu panel
                </p>
                <p className="mt-2 flex items-baseline gap-1.5 text-white">
                  <span ref={contadorRef} className="titulo text-[40px] leading-none">
                    0
                  </span>
                  <span className="text-[12.5px] text-white/55">personas</span>
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    ["Familia Jiménez", "4", true],
                    ["Tía Rosa", "2", true],
                    ["Carlos M.", "—", false],
                    ["Ana & Beto", "2", true],
                  ].map(([n, c, va]) => (
                    <div
                      key={n as string}
                      className="flex items-center justify-between rounded-xl bg-white/6 px-3 py-2"
                    >
                      <span className="text-[12px] text-white/80">{n}</span>
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: va ? "#5fd39a" : "rgba(255,255,255,.35)" }}
                      >
                        {va ? `+${c}` : "No va"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
