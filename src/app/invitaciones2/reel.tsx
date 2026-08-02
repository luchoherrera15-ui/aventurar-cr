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

/**
 * Cortos a propósito. Se leen en un celular, a 18px, en el rato que
 * dura un tramo de scroll — un párrafo de cinco líneas ahí no se lee,
 * se saltea. Y para que entren grandes tienen que ser breves: es lo
 * mismo que hace que el título pueda ir a 34px en vez de a 17.
 */
const TEXTOS = [
  {
    titulo: "Se abre en cualquier teléfono.",
    cuerpo: "Un link, nada que descargar. Se abre a pantalla completa.",
  },
  {
    titulo: "Con toda la fiesta adentro.",
    cuerpo:
      "Fecha, lugar con mapa, vestimenta y cuenta regresiva. Todo en un solo lugar.",
  },
  {
    titulo: "Confirman con un toque.",
    cuerpo:
      "Sin cuentas ni formularios. Dicen si van, con cuántos, y lo que vos preguntes.",
  },
  {
    titulo: "Y la lista se te arma sola.",
    cuerpo:
      "Ves quién dijo que sí y cuántas personas llegan. Ese número le pasás al salón.",
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
      // En móvil no se encoge: la invitación es la escena entera, no una
      // maqueta dentro de un marco. En escritorio sí, porque ahí entra
      // al teléfono y después se corre para dejar pasar el panel.
      const escala = angosto
        ? entre(0.92, 1, entra)
        : entre(0.86, 1, entra) * entre(1, 0.92, corrida);
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
        // El -50% del centrado vertical va acá dentro: los bloques están
        // posicionados en absoluto y este estilo en línea pisaría
        // cualquier utilidad de Tailwind que lo intentara.
        nodo.style.transform = `translateY(calc(-50% + ${entre(18, 0, dentro)}px))`;
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
      {/* En móvil es una columna donde la escena se queda con lo que
          sobra (flex-1 + min-h-0), no una altura calculada a mano: dos
          medidas en svh que sumaban de más eran lo que empujaba el
          teléfono fuera de la pantalla. Así no hay número que se pueda
          pasar — lo que quede es lo que hay. */}
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* 29svh de texto + 53svh de escena + los 32px de gap y padding:
            queda holgura contra el 100svh, que es lo que evita que algo
            se salga por abajo en un celular con la barra del navegador
            asomando. */}
        <div className="mx-auto flex h-full w-[min(1120px,92vw)] flex-col justify-center gap-3 py-4 md:grid md:h-auto md:items-center md:gap-8 md:py-0 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          {/* ---------- Columna de texto ----------

              Los cuatro bloques están SUPERPUESTOS, no apilados, también
              en móvil: se turnan en el mismo lugar. Si quedaran en flujo
              normal, los tres invisibles seguirían ocupando su alto y
              entre todos empujaban la escena fuera de la pantalla — que
              es exactamente por lo que el teléfono salía cortado. */}
          <div className="relative order-1 h-[29svh] shrink-0 md:h-auto md:min-h-[280px]">
            {TEXTOS.map((t, i) => (
              <div
                key={t.titulo}
                ref={(n) => {
                  textosRef.current[i] = n;
                }}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2"
                style={{ opacity: 0 }}
              >
                {/* En móvil manda el PISO del clamp, no el vw: con 6.4vw
                    un celular de 390px daba 25px de título. Los pisos
                    quedan en 34px y 18px, que es tamaño de titular de
                    verdad — y por eso los textos de arriba son cortos:
                    grandes y largos no caben juntos. */}
                <h2 className="titulo text-[clamp(34px,7.4vw,52px)] leading-[1.05] text-white">
                  {t.titulo}
                </h2>
                <p className="mt-3.5 max-w-[42ch] text-[clamp(18px,4.6vw,20px)] leading-relaxed text-white/65 md:mt-4">
                  {t.cuerpo}
                </p>
              </div>
            ))}
          </div>

          {/* ---------- Columna de la escena ---------- */}
          <div
            ref={escenaRef}
            className="order-2 flex h-[53svh] shrink-0 items-center justify-center md:h-[72svh]"
          >
            <div className="relative flex items-center justify-center">
              {/* La tarjeta de papel, que es como empieza todo. */}
              <div
                ref={papelRef}
                className="absolute w-[min(268px,70vw)] rounded-2xl px-7 py-10 text-center shadow-[0_40px_90px_-40px_rgba(0,0,0,.7)] md:w-[min(300px,26vw)] md:px-8 md:py-12"
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
                // EN MÓVIL NO HAY MARCO DE TELÉFONO. Dibujar un teléfono
                // dentro de un teléfono es redundante —el marco de
                // verdad lo tiene el usuario en la mano— y encima obliga
                // a encoger la invitación hasta que no se lee. Acá la
                // invitación va a pantalla completa, con su alto atado
                // al del contenedor (max-h-full): no existe medida que
                // pueda desbordar, que es de donde salía el recorte.
                //
                // En escritorio sí va el marco: ahí el teléfono es lo
                // que explica que esto se abre en el celular.
                // El alto va EXPLÍCITO en móvil (50svh) y el ancho sale
                // del aspecto. Antes era `aspect-[9/16] w-auto` con el
                // alto en auto, y así `aspect-ratio` no calcula nada:
                // sin una de las dos medidas definida, la caja termina
                // midiendo lo que mida su texto. De ahí que la
                // invitación saliera de un tamaño arbitrario por más que
                // se tocara el contenedor.
                className="relative h-[50svh] w-auto rounded-2xl [aspect-ratio:3/4] md:h-[min(560px,64svh)] md:w-[min(276px,30vw)] md:rounded-[40px] md:border-[7px] md:p-2 md:[aspect-ratio:auto]"
                style={{
                  opacity: 0,
                  // Más oscuro que el fondo de la página (#0a1226), no
                  // igual: con el mismo color el bisel desaparecía y el
                  // teléfono se leía como una pantalla flotando, sin
                  // marco. El anillo claro de afuera le da el filo que
                  // hace que se entienda que es un aparato.
                  borderColor: "#04060d",
                  background: "#04060d",
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,.16), 0 50px 110px -45px rgba(0,0,0,.9)",
                }}
              >
                <div
                  className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl px-5 py-7 text-center md:rounded-[32px] md:px-5 md:py-8"
                  style={{ background: "#efe7d8", color: "#2a2318" }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#a08a4e] md:text-[9px] md:tracking-[0.34em]">
                    Nos casamos
                  </p>
                  <p className={`${claseSerif} mt-4 text-[30px] leading-[1.1] md:mt-4 md:text-[30px]`}>
                    Sofía
                    <span className="mx-1.5 text-[#c9a227]">&</span>
                    Andrés
                  </p>
                  <div className="mx-auto my-4 h-px w-12 bg-[#c9a227] md:my-4 md:w-12" />
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b5c3e] md:text-[10.5px] md:tracking-[0.18em]">
                    12 · Dic · 2026 · 4:00 p.m.
                  </p>
                  <p className="mt-1.5 text-[10px] text-[#6b5c3e] md:mt-1.5 md:text-[10.5px]">
                    Hacienda La Chimba, Atenas
                  </p>

                  {/* La cuenta regresiva, que es lo que engancha. */}
                  <div className="mt-5 flex justify-center gap-2 md:mt-6 md:gap-2">
                    {[
                      ["108", "días"],
                      ["06", "hrs"],
                      ["42", "min"],
                    ].map(([n, l]) => (
                      <div
                        key={l}
                        className="min-w-[50px] rounded-xl bg-[#e3d8c2] px-2 py-2 md:min-w-[54px]"
                      >
                        <p className="text-[16px] font-bold leading-none md:text-[17px]">{n}</p>
                        <p className="mt-1 text-[8px] uppercase tracking-[0.14em] text-[#8a7752] md:text-[8.5px]">
                          {l}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Confirmar asistencia. */}
                  <div ref={rsvpRef} className="mt-auto" style={{ opacity: 0 }}>
                    <p className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-[#8a7752] md:text-[10.5px]">
                      ¿Nos acompañás?
                    </p>
                    <div className="flex gap-2">
                      <span
                        className="flex-1 rounded-xl py-2.5 text-[12px] font-bold text-white md:text-[12.5px]"
                        style={{ background: "#1f7a4d" }}
                      >
                        Sí, ahí estaré
                      </span>
                      <span className="rounded-xl border border-[#c9bda2] px-3 py-2.5 text-[12px] font-bold text-[#6b5c3e] md:text-[12.5px]">
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
