"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PapelMenu } from "@/lib/solutions/menu-estilos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  «¿ESTÁS EN EL LOCAL?» — el número de mesa, escrito a mano
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «si el restaurante tiene habilitado
 * pedir desde la mesa, la gente se sienta, escanea el código QR, ahí
 * ponen el número de mesa —el que tienen visible en la mesa— y con eso
 * hacen el pedido y les llega directamente, sin necesidad de
 * levantarse».
 *
 * ── QUÉ RESOLVÍA ANTES Y QUÉ RESUELVE AHORA ─────────────────────────
 *
 * El pedido desde la mesa ya existía, pero el número SOLO podía venir
 * en la URL (`?mesa=3`), o sea que exigía **un QR distinto impreso por
 * mesa**. Para un local con doce mesas son doce adhesivos, y cuando
 * alguien mueve una mesa el QR miente.
 *
 * Con esto alcanza **un solo QR** para todo el local: el mismo cartel
 * en la puerta, en la carta o en la barra. Quien lo escanea escribe el
 * número que ve en su mesa y a partir de ahí el pedido viaja igual que
 * antes — a la cocina, con su número.
 *
 * Los dos caminos conviven: un QR con `?mesa=` ya resuelto se salta
 * este paso, porque no tiene nada que preguntar.
 *
 * ── POR QUÉ NO ES UN SELECTOR ───────────────────────────────────────
 *
 * Con doce mesas un desplegable sería igual de rápido; con cuarenta,
 * no. Un campo numérico se resuelve con el teclado del teléfono —que
 * además sale numérico por `inputMode`— y no crece con el local.
 *
 * ── POR QUÉ NAVEGA EN VEZ DE GUARDAR ESTADO ─────────────────────────
 *
 * Porque `?mesa=` ya es de dónde el servidor lee la mesa, y de ahí
 * salen el rótulo «Mesa 3», el modo de pedido y el link de volver al
 * hub. Poner el número en un estado de React lo dejaría en un solo
 * lado y habría que pasarlo a mano por los otros tres.
 */
export default function ElegirMesa({
  slug,
  mesas,
  paleta,
  radio,
}: {
  slug: string;
  /** Cuántas mesas tiene el local: el tope de lo que se acepta. */
  mesas: number;
  /** El papel del catálogo, ya resuelto por `pintaDeEstilo`. */
  paleta: PapelMenu;
  /** El radio del diseño del catálogo, en su vocabulario. */
  radio: "recto" | "suave" | "redondo";
}) {
  // El mismo mapa que usa el resto del catálogo: la caja va un punto
  // más redonda que los campos de adentro.
  const R = radio === "recto" ? 0 : radio === "redondo" ? 22 : 14;
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(valor.trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > mesas) {
      setError(`Poné un número del 1 al ${mesas}.`);
      return;
    }
    setError(null);
    router.push(`/s/${slug}/menu?mesa=${n}`);
  };

  return (
    <form
      onSubmit={enviar}
      className="mt-4 p-4"
      style={{
        background: paleta.superficie,
        border: `1px solid ${paleta.borde}`,
        borderRadius: R,
      }}
    >
      <p className="text-[14px] font-extrabold" style={{ color: paleta.tinta }}>
        ¿Estás en el local?
      </p>
      <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: paleta.suave }}>
        Poné el número de tu mesa y pedí desde acá — te lo llevamos.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={valor}
          onChange={(e) => {
            // Solo dígitos: en el teclado de un teléfono es fácil que se
            // cuele un signo, y un `type="number"` deja escribir «1e4».
            setValor(e.target.value.replace(/\D/g, "").slice(0, 2));
            setError(null);
          }}
          inputMode="numeric"
          autoComplete="off"
          aria-label="Número de mesa"
          placeholder={`1 – ${mesas}`}
          className="w-[104px] px-3 py-2.5 text-[15px] font-extrabold outline-none"
          style={{
            background: paleta.fondo,
            color: paleta.tinta,
            border: `1px solid ${error ? "#b4361a" : paleta.borde}`,
            borderRadius: Math.min(R, 12),
          }}
        />
        <button
          type="submit"
          className="presionable flex-1 px-4 py-2.5 text-[14px] font-extrabold"
          style={{
            background: paleta.acento,
            color: paleta.sobreAcento,
            borderRadius: Math.min(R, 12),
          }}
        >
          Pedir desde la mesa
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-[12px] font-bold" style={{ color: "#b4361a" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
