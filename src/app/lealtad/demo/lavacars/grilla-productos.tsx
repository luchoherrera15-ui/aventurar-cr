"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * LOS PAQUETES, Y EL MOCKUP DE "SOLICITAR EL SERVICIO".
 *
 * Pedido explícito: este HTML es para mostrárselo A LAVACARS REALES —
 * dejó de ser solo "así se vería la lealtad" y pasó a ser "así podría
 * verse el sitio del NEGOCIO", con la parte que a un lavacar a
 * domicilio más le importa: cómo pide el cliente el servicio y cómo
 * queda el adelanto asegurado. Por eso cada botón de paquete abre un
 * panel de solicitud en vez de mandar a otra pantalla -es lo primero
 * que un dueño de lavacar quiere ver funcionando.
 *
 * SIGUE SIENDO MOCKUP a propósito: no hay pago real ni fila en la
 * base detrás. El campo de ubicación es un input de texto libre, no un
 * mapa -no hay negocio real que geocodificar-, y "Confirmar" solo
 * cambia a un estado de éxito local. Construir el checkout de verdad
 * (Stripe/SINPE) es otro pedido, no este.
 */

const AMARILLO = "#f5bd18";
const LINEA = "rgba(255,255,255,.12)";

type Producto = {
  id: string;
  tag: string;
  titulo: string;
  texto: string;
  precio: string;
  boton: string;
  foto?: string;
};

const FOTO_PACK5 = "/lealtad/plantillas/franjas/lavacar-1.jpg";
const FOTO_PREMIUM = "/lealtad/plantillas/franjas/lavacar-2.jpg";
const FOTO_CERAMICO = "/lealtad/plantillas/franjas/lavacar-4.jpg";

const PRODUCTOS: Producto[] = [
  {
    id: "pack5",
    tag: "Favorito",
    titulo: "Pack 5 Lavados",
    texto: "A domicilio. Ideal para clientes frecuentes.",
    precio: "₡38.000",
    boton: "Solicitar",
    foto: FOTO_PACK5,
  },
  {
    id: "premium",
    tag: "Premium",
    titulo: "Pack Premium",
    texto: "3 lavados premium a domicilio + beneficio.",
    precio: "₡24.000",
    boton: "Solicitar",
    foto: FOTO_PREMIUM,
  },
  {
    id: "giftcard",
    tag: "Gift Card",
    titulo: "Gift Card",
    texto: "Regalá un lavado. Sin tarjetas físicas.",
    precio: "Desde ₡5.000",
    boton: "Comprar",
  },
  {
    id: "ceramico",
    tag: "Nuevo",
    titulo: "Cerámico",
    texto: "Protección avanzada, a domicilio.",
    precio: "₡18.900",
    boton: "Solicitar",
    foto: FOTO_CERAMICO,
  },
];

/** 30% del paquete, redondeado a mil — el mismo criterio que ya usa
 *  Bookea para el adelanto de eventos (`ranchos.deposito_citas`), acá
 *  a mano porque este número no sale de ninguna fila real. */
function depositoDe(precio: string): string {
  const numero = Number(precio.replace(/[^\d]/g, ""));
  if (!numero) return "A coordinar";
  const treinta = Math.round((numero * 0.3) / 1000) * 1000;
  return `₡${treinta.toLocaleString("es-CR")}`;
}

export default function GrillaProductos() {
  const [elegido, setElegido] = useState<Producto | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {PRODUCTOS.map((p) => (
          <article key={p.id} className="border" style={{ borderColor: LINEA, background: "#0d0f12" }}>
            {p.foto ? (
              <div className="relative h-[150px] sm:h-[190px]">
                <Image src={p.foto} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(0deg,rgba(0,0,0,.58),transparent 55%)" }}
                />
                <span className="absolute left-3 top-3 bg-white px-[7px] py-[5px] text-[8px] font-extrabold uppercase text-[#090a0c]">
                  {p.tag}
                </span>
              </div>
            ) : (
              <div
                className="relative flex h-[150px] items-center justify-center sm:h-[190px]"
                style={{ background: "linear-gradient(155deg,#1a1704,#070809 70%)" }}
              >
                <span className="absolute left-3 top-3 bg-white px-[7px] py-[5px] text-[8px] font-extrabold uppercase text-[#090a0c]">
                  {p.tag}
                </span>
                <span className="text-[13px] font-extrabold uppercase tracking-[.18em]" style={{ color: AMARILLO }}>
                  Gift Card
                </span>
              </div>
            )}
            <div className="p-[17px]">
              <h3 className="text-[17px] font-bold leading-tight">{p.titulo}</h3>
              <p className="mt-1.5 min-h-[30px] text-[10px] text-[#777e88]">{p.texto}</p>
              <div className="mt-3.5 flex items-center justify-between">
                <span className="text-[16px] font-bold">{p.precio}</span>
                <button
                  type="button"
                  onClick={() => setElegido(p)}
                  className="border px-2.5 py-2 text-[8px] font-extrabold uppercase text-white hover:bg-white hover:text-[#08090b]"
                  style={{ borderColor: LINEA }}
                >
                  {p.boton}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {elegido && <ModalSolicitud producto={elegido} onCerrar={() => setElegido(null)} />}
    </>
  );
}

function ModalSolicitud({ producto, onCerrar }: { producto: Producto; onCerrar: () => void }) {
  const [ubicacion, setUbicacion] = useState("");
  const [enviado, setEnviado] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCerrar}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[380px] overflow-y-auto border"
        style={{ background: "#0d0f12", borderColor: LINEA }}
      >
        <div className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: LINEA }}>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#777e89]">
              Solicitar servicio · a domicilio
            </p>
            <h2 className="mt-1 text-[19px] font-bold leading-tight">{producto.titulo}</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-7 w-7 shrink-0 items-center justify-center border text-white/70"
            style={{ borderColor: LINEA }}
          >
            ×
          </button>
        </div>

        {enviado ? (
          <div className="p-6 text-center">
            <p className="text-[15px] font-bold" style={{ color: AMARILLO }}>
              ¡Solicitud recibida!
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#c0c4cb]">
              Lavacar El Rayo te escribe para coordinar el día y la hora. Esto es un mockup — acá
              no viajó ninguna solicitud de verdad.
            </p>
            <button
              type="button"
              onClick={onCerrar}
              className="mt-5 w-full bg-white px-4 py-3 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#070809]"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-center justify-between border p-3.5" style={{ borderColor: LINEA }}>
              <span className="text-[12px] text-[#c0c4cb]">Precio del paquete</span>
              <span className="text-[15px] font-bold">{producto.precio}</span>
            </div>

            <label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-[#8e949e]">
              Ubicación del servicio
            </label>
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Dirección, señas o urbanización"
              className="mt-1.5 w-full border bg-transparent px-3.5 py-3 text-[13px] text-white placeholder:text-[#5c6270] focus:outline-none"
              style={{ borderColor: LINEA }}
            />
            <p className="mt-1.5 text-[10.5px] text-[#5c6270]">
              Vamos hasta donde estés — contanos cómo llegar.
            </p>

            <div
              className="mt-4 border p-3.5"
              style={{ borderColor: "rgba(245,189,24,.35)", background: "rgba(245,189,24,.06)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: AMARILLO }}>
                Depósito de adelanto
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#c0c4cb]">
                Para asegurar el turno pedimos <strong className="text-white">{depositoDe(producto.precio)}</strong> de
                adelanto (30% del paquete) por SINPE. El resto se paga al terminar el servicio.
              </p>
            </div>

            <button
              type="button"
              disabled={ubicacion.trim().length < 4}
              onClick={() => setEnviado(true)}
              className="mt-5 w-full bg-white px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#070809] disabled:opacity-30"
            >
              Confirmar solicitud
            </button>
            <p className="mt-2.5 text-center text-[10px] text-[#5c6270]">
              Mockup — no se cobra nada ni se envía ninguna solicitud real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
