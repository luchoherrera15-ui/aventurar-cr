"use client";

import { useEffect, useState } from "react";
import { useMockupVivo } from "./use-mockup-vivo";

/**
 * LA COMPOSICIÓN ANIMADA DE «LOS QUE DEJARON DE VENIR» (pedido del
 * dueño, ago 2026): a diferencia de los otros dos mockups de esta
 * franja —que son un TELÉFONO recibiendo algo automático—, este es el
 * PANEL DEL NEGOCIO haciendo algo con ayuda: la fila de un cliente en
 * riesgo, el mensaje que se escribe, el envío, y la fila que vuelve a
 * la vida. Es literalmente la pantalla real (`ComposerRescate` +
 * `ClientesAuditoria` del panel de Lealtad), contada en un loop.
 *
 * La diferencia de forma —panel, no teléfono— ES el mensaje: esto no
 * es algo que le llega solo al cliente, es algo que el dueño hace con
 * un asesor. El mockup lo dice sin una palabra de más.
 */

const MENSAJE = "Hace rato no te vemos. Tus 4 sellos siguen ahí — te faltan 2 para el café.";

type Fase = "espera" | "tipeo" | "envio" | "rescatado" | "reinicio";

export default function MockupRescate() {
  // Estado final si no hay animación bienvenida: el mensaje ya escrito
  // y el cliente ya rescatado.
  const [letras, setLetras] = useState(MENSAJE.length);
  const [fase, setFase] = useState<Fase>("rescatado");

  // `vivo` reemplaza al viejo `animar`: preferencia de movimiento Y
  // cercanía al viewport en una sola bandera (`useMockupVivo`), para
  // que el typewriter no gaste hilo principal fuera de pantalla. El
  // reset del montaje sobra: el loop entra por `rescatado` —el estado
  // inicial— y `reinicio` ya deja las letras en cero.
  const { ref, vivo } = useMockupVivo<HTMLDivElement>();

  useEffect(() => {
    if (!vivo) return;
    let t: ReturnType<typeof setTimeout>;
    if (fase === "espera") {
      t = setTimeout(() => setFase("tipeo"), 1200);
    } else if (fase === "tipeo") {
      if (letras < MENSAJE.length) {
        t = setTimeout(() => setLetras((n) => n + 1), letras === 0 ? 500 : 26);
      } else {
        t = setTimeout(() => setFase("envio"), 550);
      }
    } else if (fase === "envio") {
      t = setTimeout(() => setFase("rescatado"), 750);
    } else if (fase === "rescatado") {
      t = setTimeout(() => setFase("reinicio"), 3400);
    } else {
      t = setTimeout(() => {
        setLetras(0);
        setFase("espera");
      }, 700);
    }
    return () => clearTimeout(t);
  }, [vivo, fase, letras]);

  const texto = MENSAJE.slice(0, letras);
  const rescatado = fase === "rescatado" || fase === "reinicio" || !vivo;
  const enviando = fase === "envio";

  return (
    /* ⚠️ EL `aria-hidden` ESTABA ACÁ ARRIBA, ENVOLVIENDO AL `sr-only`.
       Esconde el subárbol ENTERO, así que el párrafo que explica la
       demostración no le llegaba a nadie: un hueco mudo para quien no
       ve la pantalla.

       Mismo bug que ya se había corregido en `mockup-cercania.tsx` y
       que también quedó vivo en `mockup-hitos.tsx`: los tres salieron
       del mismo molde y el arreglo original no se propagó. Baja al
       dibujo, que es lo que corresponde esconder. */
    <div ref={ref} className="w-full max-w-[460px]">
      <p className="sr-only">
        Demostración: el panel te muestra al cliente en riesgo, armás el mensaje con tu
        asesor, lo enviás y el cliente vuelve a estar activo.
      </p>

      <div
        aria-hidden
        className="rounded-3xl border border-[#e6eaf3] bg-white p-6 sm:p-7"
        style={{ boxShadow: "0 26px 60px rgba(16,30,66,.12)" }}
      >
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a91a4]">
          Tu panel · Clientes
        </p>
        <h3 className="mt-2 text-[18px] font-extrabold leading-tight text-[#0d1733]">
          Rescatá a quien dejó de venir
        </h3>

        {/* La fila del cliente: cambia de tramo cuando el mensaje sale. */}
        <div
          className={`mt-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors duration-500 ${
            rescatado ? "border-[#d7ecdf] bg-[#f2faf5]" : "border-[#f0d9b8] bg-[#fdf6ea]"
          }`}
        >
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-bold text-[#0d1733]">María Rodríguez</p>
            <p className="text-[11.5px] text-[#8a91a4]">
              {rescatado ? "Rescatada — le acabás de escribir" : "34 días sin venir · 4 sellos"}
            </p>
          </div>
          <span
            className="shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide"
            style={
              rescatado
                ? { background: "#d7ecdf", color: "#1c7c47" }
                : { background: "#f7e6c4", color: "#8a5a10" }
            }
          >
            {rescatado ? "✓ Enviado" : "En riesgo"}
          </span>
        </div>

        <p className="mt-4 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">
          El mensaje que le llega
        </p>
        <div className="mt-1.5 min-h-[64px] rounded-xl border border-[#e6e8ee] bg-[#f7f8fb] p-3.5 text-[13px] leading-relaxed text-[#0d1733]">
          {texto}
          {vivo && fase === "tipeo" && (
            <span className="ml-[1px] inline-block h-[14px] w-[2px] translate-y-[2px] animate-pulse rounded-full bg-[#0f4c9e]" />
          )}
        </div>

        <div className="mt-4 flex items-center justify-end">
          <span
            className={`shrink-0 rounded-full px-6 py-2.5 text-[13px] font-extrabold text-white transition-all duration-200 ${
              enviando ? "scale-[0.93] opacity-85" : ""
            }`}
            style={{ background: "var(--accion)" }}
          >
            Enviar rescate
          </span>
        </div>
      </div>
    </div>
  );
}
