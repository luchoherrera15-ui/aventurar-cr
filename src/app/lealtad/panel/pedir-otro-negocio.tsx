"use client";

import { useState } from "react";
import { enviarConsultaLanding } from "../contacto-actions";
import { RADIO_CARD, RADIO_TILE } from "@/components/panel/sistema";

/**
 * «QUIERO OTRO NEGOCIO» — la tarjeta «+» cuando el cupo ya está usado.
 *
 * Regla del dueño (31 ago 2026): una cuenta, un negocio de Lealtad. El
 * segundo lo damos de alta nosotros, así que el «+» deja de ser un
 * atajo a `/lealtad/crear` y pasa a ser un pedido.
 *
 * ⚠️ ESTO ES LA CARA, NO EL CANDADO. El tope de verdad vive en el
 * servidor (`puedeCrearNegocioDeLealtad`, en las cuatro puertas de
 * alta): esconder un enlace no frena a quien escribe la URL a mano.
 * Si algún día este componente desaparece, la regla sigue en pie.
 *
 * Reusa `enviarConsultaLanding` —el mismo camino de la burbuja de la
 * landing— con `origen: "segundo-negocio"`, que es lo que cambia el
 * asunto del correo y le agrega la cuenta de quien pide. No hay tabla
 * nueva: es un pedido que se contesta por fuera, igual que el otro.
 *
 * Se despliega EN EL LUGAR y no en un modal de pantalla completa: es
 * el patrón del panel para formularios cortos, y además deja las
 * tarjetas de negocios a la vista mientras se escribe.
 */
export default function PedirOtroNegocio() {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [panal, setPanal] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const res = await enviarConsultaLanding({
      nombre,
      contacto,
      mensaje,
      panal,
      origen: "segundo-negocio",
    });
    setEnviando(false);
    if (res.ok) setEnviado(true);
    else setError(res.motivo);
  }

  if (enviado) {
    return (
      <div
        className={`flex min-h-[150px] flex-col items-center justify-center ${RADIO_CARD} border border-bookea-linea bg-white p-5 text-center`}
      >
        <span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-xl text-[20px] leading-none"
          style={{ background: "var(--accion-suave)", color: "var(--accion)" }}
        >
          ✓
        </span>
        <p className="mt-2.5 text-[13.5px] font-bold text-aventurea-ink">Pedido enviado</p>
        <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
          Te escribimos al contacto que dejaste para abrir el segundo negocio.
        </p>
      </div>
    );
  }

  return (
    <div className={`${RADIO_CARD} border border-dashed border-aventurea-line bg-aventurea-cream-2 p-5`}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="presionable flex w-full flex-col items-center justify-center text-center"
      >
        <span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-xl text-[22px] leading-none"
          style={{ background: "var(--accion-suave)", color: "var(--accion)" }}
        >
          +
        </span>
        <span className="mt-2.5 text-[13.5px] font-bold text-aventurea-ink">Otro negocio</span>
        <span className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
          {abierto ? "Contanos y lo abrimos nosotros" : "Lo damos de alta nosotros — escribinos"}
        </span>
      </button>

      {/* `desplegable` anima con grid-template-rows y no con max-height:
          el navegador interpola sin que nadie tenga que adivinar el alto
          del formulario. */}
      <div className="desplegable" data-abierto={abierto}>
        <div>
          <form onSubmit={enviar} className="mt-4 space-y-2.5 pt-1">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              maxLength={100}
              className={`w-full ${RADIO_TILE} border border-bookea-linea bg-white px-3 py-2.5 text-[13px] text-aventurea-ink`}
            />
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Correo o WhatsApp"
              maxLength={150}
              className={`w-full ${RADIO_TILE} border border-bookea-linea bg-white px-3 py-2.5 text-[13px] text-aventurea-ink`}
            />
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="¿De qué es el negocio nuevo?"
              rows={3}
              maxLength={800}
              className={`w-full ${RADIO_TILE} border border-bookea-linea bg-white px-3 py-2.5 text-[13px] text-aventurea-ink`}
            />

            {/* El señuelo: ningún humano lo ve, un bot lo llena solo. */}
            <input
              value={panal}
              onChange={(e) => setPanal(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />

            {error && (
              <p role="alert" className="text-[12px] font-bold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className={`presionable min-h-[44px] w-full ${RADIO_TILE} px-4 text-[13px] font-extrabold`}
              style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
            >
              {enviando ? "Enviando…" : "Enviar pedido"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
