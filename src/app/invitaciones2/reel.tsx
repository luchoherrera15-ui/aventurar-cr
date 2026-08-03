"use client";

import { useEffect, useRef } from "react";

/**
 * La secuencia fijada: el corazón de la página.
 *
 * Es un tramo alto de scroll con la escena pegada al centro de la
 * pantalla. Mientras se baja, UNA sola invitación va contando toda la
 * historia del producto sin cortes: la tarjeta se encoge y entra al
 * teléfono, la pantalla del teléfono avanza de cuadro en cuadro (fecha
 * → cuenta regresiva → confirmar), el botón se aprieta de verdad, y al
 * final el teléfono se corre para dejar entrar el panel del anfitrión,
 * cuyas filas van entrando una por una mientras el contador sube.
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
  [0.0, 0.14],
  [0.18, 0.36],
  [0.4, 0.58],
  [0.62, 1.2],
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

/** Las filas del panel, con sus iniciales para el avatar. */
const INVITADOS = [
  { nombre: "Familia Jiménez", iniciales: "FJ", cantidad: "+4", va: true },
  { nombre: "Tía Rosa", iniciales: "TR", cantidad: "+2", va: true },
  { nombre: "Carlos M.", iniciales: "CM", cantidad: "—", va: false },
  { nombre: "Ana & Beto", iniciales: "AB", cantidad: "+2", va: true },
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
  const pantallaRef = useRef<HTMLDivElement>(null);
  const rsvpRef = useRef<HTMLDivElement>(null);
  const rsvpConfirmadoRef = useRef<HTMLDivElement>(null);
  const dedoRef = useRef<HTMLSpanElement>(null);
  const acompanantesRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contadorRef = useRef<HTMLSpanElement>(null);
  const escenaRef = useRef<HTMLDivElement>(null);
  const textosRef = useRef<(HTMLDivElement | null)[]>([]);
  const filasRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const sinMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const pista = pistaRef.current;
    const papel = papelRef.current;
    const telefono = telefonoRef.current;
    const pantalla = pantallaRef.current;
    const rsvp = rsvpRef.current;
    const rsvpConfirmado = rsvpConfirmadoRef.current;
    const dedo = dedoRef.current;
    const acompanantes = acompanantesRef.current;
    const panel = panelRef.current;
    const contador = contadorRef.current;
    const escena = escenaRef.current;
    if (
      !pista ||
      !papel ||
      !telefono ||
      !pantalla ||
      !rsvp ||
      !rsvpConfirmado ||
      !acompanantes ||
      !panel ||
      !escena
    )
      return;

    // Sin movimiento: se arma la escena final y se muestran todos los
    // textos. Nadie se pierde nada, simplemente no se mueve.
    if (sinMovimiento) {
      papel.style.opacity = "0";
      telefono.style.opacity = "1";
      telefono.style.transform = "none";
      pantalla.style.transform = "translateY(-200%)";
      rsvpConfirmado.style.opacity = "1";
      acompanantes.style.opacity = "1";
      acompanantes.style.transform = "none";
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
      filasRef.current.forEach((f) => {
        if (f) {
          f.style.opacity = "1";
          f.style.transform = "none";
        }
      });
      return;
    }

    let angosto = window.innerWidth < 900;
    let ultimo = -1;
    let pedido = 0;

    function dibujar(p: number) {
      // 1. La tarjeta se encoge, se endereza y se apaga.
      const morfo = suavizar(tramo(p, 0.03, 0.18));
      papel!.style.transform = `translateY(${-morfo * 14}px) scale(${entre(1, 0.58, morfo)}) rotate(${entre(-3.2, 0, morfo)}deg)`;
      papel!.style.opacity = String(1 - tramo(p, 0.09, 0.17));

      // 2. El teléfono entra por debajo de donde estaba la tarjeta.
      const entra = suavizar(tramo(p, 0.1, 0.24));
      // 6. Y más adelante se corre a la izquierda para dejar lugar al panel.
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
      telefono!.style.opacity = String(tramo(p, 0.11, 0.2) * (1 - salidaTelefono));

      // 3. La pantalla avanza de cuadro en cuadro: fecha → cuenta
      // regresiva → confirmar. Dos saltos de un tercio de vuelta cada
      // uno, como una tira de fotogramas que se corre hacia arriba.
      const f1 = suavizar(tramo(p, 0.26, 0.4));
      const f2 = suavizar(tramo(p, 0.44, 0.58));
      pantalla!.style.transform = `translateY(${-(f1 + f2) * (100 / 3)}%)`;

      // 4. El toque de confirmar: se aprieta y cambia de estado.
      const presionar = p > 0.6 && p < 0.635;
      const confirmado = p >= 0.635;
      rsvp!.style.transform = presionar ? "scale(0.955)" : "scale(1)";
      rsvpConfirmado!.style.opacity = String(confirmado ? 1 : 0);
      if (dedo) {
        const dedoVisible = p > 0.585 && p < 0.63;
        dedo.style.opacity = dedoVisible ? "1" : "0";
      }
      const acomp = tramo(p, 0.645, 0.68);
      acompanantes!.style.opacity = String(acomp);
      acompanantes!.style.transform = `translateY(${entre(8, 0, acomp)}px)`;

      // 5. El panel de invitados entra desde la derecha, contando.
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
      filasRef.current.forEach((fila, i) => {
        if (!fila) return;
        const entrada = tramo(p, 0.78 + i * 0.035, 0.82 + i * 0.035);
        fila.style.opacity = String(entrada);
        fila.style.transform = `translateY(${entre(10, 0, entrada)}px)`;
      });

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
    <div ref={pistaRef} className="relative h-[520svh] md:h-[600svh]">
      {/* En móvil es una columna donde la escena se queda con lo que
          sobra (flex-1 + min-h-0), no una altura calculada a mano: dos
          medidas en svh que sumaban de más eran lo que empujaba el
          teléfono fuera de la pantalla. Así no hay número que se pueda
          pasar — lo que quede es lo que hay. */}
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Un halo suave detrás de la escena, como el fondo radial de
            una vitrina — sin esto el teléfono flota sobre el navy plano
            y se pierde el efecto de "producto en foco". */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.14] blur-[130px]"
          style={{ background: "#ee7420" }}
        />
        {/* 29svh de texto + 53svh de escena + los 32px de gap y padding:
            queda holgura contra el 100svh, que es lo que evita que algo
            se salga por abajo en un celular con la barra del navegador
            asomando. */}
        <div className="relative mx-auto flex h-full w-[min(1120px,92vw)] flex-col justify-center gap-3 py-4 md:grid md:h-auto md:items-center md:gap-8 md:py-0 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
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
                // En escritorio sí va el marco, con la isla dinámica del
                // teléfono real: ahí el teléfono es lo que explica que
                // esto se abre en el celular.
                className="relative h-[52svh] w-auto rounded-2xl [aspect-ratio:3/4] md:h-[min(580px,66svh)] md:w-[min(284px,31vw)] md:rounded-[44px] md:p-2 md:[aspect-ratio:auto]"
                style={{
                  opacity: 0,
                  background: "#050810",
                  boxShadow:
                    "0 0 0 2px #1c2436, 0 0 0 3.5px #2e3a52, 0 60px 120px -40px rgba(0,0,0,.9)",
                }}
              >
                {/* La isla dinámica — solo en escritorio, donde el
                    marco de teléfono es real y no la pantalla entera. */}
                <div
                  aria-hidden
                  className="absolute left-1/2 top-[14px] z-10 hidden h-[16px] w-[30%] -translate-x-1/2 rounded-full bg-[#050810] md:block"
                />
                <div className="relative h-full w-full overflow-hidden rounded-2xl md:rounded-[36px]">
                  {/* La tira de tres cuadros: fecha → cuenta regresiva →
                      confirmar. `pantallaRef` se corre hacia arriba con
                      el scroll, un tercio de su alto por cuadro. */}
                  <div
                    ref={pantallaRef}
                    className="absolute inset-0"
                    style={{ height: "300%" }}
                  >
                    {/* Cuadro 1 — la invitación. */}
                    <div
                      className="flex h-1/3 w-full flex-col items-center justify-center px-6 py-8 text-center"
                      style={{
                        background:
                          "linear-gradient(165deg,#132049,#0a1226)",
                        color: "#efe7d8",
                      }}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#f0c987]">
                        Nos casamos
                      </p>
                      <p className={`${claseSerif} mt-4 text-[30px] leading-[1.1]`}>
                        Sofía
                        <span className="mx-1.5 text-[#f0c987]">&</span>
                        Andrés
                      </p>
                      <div className="mx-auto my-4 h-px w-12 bg-[#f0c987]/70" />
                      <p className="text-[10.5px] uppercase leading-relaxed tracking-[0.16em] text-white/60">
                        12 · Dic · 2026 · 4:00 p.m.
                        <br />
                        Hacienda La Chimba, Atenas
                      </p>
                    </div>

                    {/* Cuadro 2 — la cuenta regresiva y el mapa. */}
                    <div
                      className="flex h-1/3 w-full flex-col items-center justify-center px-6 py-8 text-center"
                      style={{
                        background:
                          "linear-gradient(165deg,#132049,#0a1226)",
                        color: "#efe7d8",
                      }}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#f0c987]">
                        Faltan
                      </p>
                      <div className="mt-4 flex justify-center gap-2">
                        {[
                          ["108", "días"],
                          ["06", "hrs"],
                          ["42", "min"],
                        ].map(([n, l]) => (
                          <div
                            key={l}
                            className="min-w-[52px] rounded-xl bg-white/[0.07] px-2 py-2.5"
                            style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}
                          >
                            <p className="text-[17px] font-bold leading-none tabular-nums">{n}</p>
                            <p className="mt-1 text-[8px] uppercase tracking-[0.14em] text-white/50">
                              {l}
                            </p>
                          </div>
                        ))}
                      </div>
                      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] text-white/70" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
                        <span className="h-[5px] w-[5px] rounded-full bg-[#ee7420]" />
                        Hacienda La Chimba · Maps y Waze
                      </span>
                    </div>

                    {/* Cuadro 3 — confirmar asistencia, con el estado
                        de apretado y confirmado superpuestos. */}
                    <div
                      className="flex h-1/3 w-full flex-col items-center justify-center px-6 py-8 text-center"
                      style={{
                        background:
                          "linear-gradient(165deg,#132049,#0a1226)",
                        color: "#efe7d8",
                      }}
                    >
                      <p className={`${claseSerif} text-[24px] italic leading-tight`}>
                        ¿Nos acompañás?
                      </p>
                      <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-white/45">
                        Confirmá antes del 30 de octubre
                      </p>

                      <div className="relative mt-5 w-full max-w-[190px]">
                        <div
                          ref={rsvpRef}
                          className="w-full rounded-xl py-3 text-[12.5px] font-bold text-[#14151a] transition-transform"
                          style={{ background: "#efe7d8" }}
                        >
                          Sí, ahí estaré
                        </div>
                        {/* El estado confirmado que cubre al botón tras
                            el tap. */}
                        <div
                          ref={rsvpConfirmadoRef}
                          className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-bold text-white"
                          style={{ background: "#1f7a4d", opacity: 0 }}
                        >
                          ✓ ¡Confirmado!
                        </div>
                        {/* El dedo que toca el botón. */}
                        <span
                          ref={dedoRef}
                          aria-hidden
                          className="absolute -bottom-3 right-6 h-9 w-9 rounded-full border-2 border-white/80 bg-white/25 shadow-lg"
                          style={{ opacity: 0 }}
                        />
                      </div>

                      <div className="mt-2.5 w-full max-w-[190px] rounded-xl border border-white/20 py-2.5 text-[11.5px] font-semibold text-white/60">
                        No podré
                      </div>

                      <div
                        ref={acompanantesRef}
                        className="mt-4 flex w-full max-w-[190px] items-center justify-between rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-[11px] text-white/70"
                        style={{ opacity: 0, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}
                      >
                        <span>Vamos</span>
                        <span className="text-[13px] font-bold text-white">2 personas</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* El panel del anfitrión, que entra al final — vidrio
                  esmerilado como el de la referencia, no la placa lisa
                  navy que tenía antes: es lo que hace que se lea como
                  "producto real" y no como una tarjeta de color plano. */}
              <div
                ref={panelRef}
                // El centrado va en el `transform` que escribe el JS, no
                // en clases: una utilidad de Tailwind acá la pisaría el
                // estilo en línea y el panel saldría corrido.
                className="absolute left-1/2 top-1/2 w-[min(260px,72vw)] rounded-2xl border border-white/12 p-5 backdrop-blur-xl md:left-auto md:right-[-16%]"
                style={{
                  opacity: 0,
                  background: "rgba(22,41,94,.72)",
                  boxShadow: "0 40px 90px -40px rgba(0,0,0,.85)",
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                    Tu panel
                  </p>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#5fd39a]">
                    <span className="anim-invitacion-latir h-[5px] w-[5px] rounded-full bg-[#5fd39a]" />
                    En vivo
                  </span>
                </div>
                <p className="mt-3 flex items-baseline gap-1.5 text-white">
                  <span ref={contadorRef} className="titulo text-[42px] leading-none tabular-nums">
                    0
                  </span>
                  <span className="text-[12.5px] text-white/55">personas</span>
                </p>
                <div className="mt-4 space-y-2">
                  {INVITADOS.map((inv, i) => (
                    <div
                      key={inv.nombre}
                      ref={(n) => {
                        filasRef.current[i] = n;
                      }}
                      className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2"
                      style={{ opacity: 0, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white/80"
                        style={{ background: "linear-gradient(140deg,#3a4a7a,#1c2748)" }}
                      >
                        {inv.iniciales}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">
                        {inv.nombre}
                      </span>
                      <span
                        className="shrink-0 text-[11px] font-bold"
                        style={{ color: inv.va ? "#5fd39a" : "rgba(255,255,255,.35)" }}
                      >
                        {inv.va ? `${inv.cantidad} ✓` : "No va"}
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
