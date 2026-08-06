"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { registrarPago, type EstadoPedido } from "@/app/invitaciones/pedido/actions";

/**
 * Cómo paga el cliente: SINPE Móvil o transferencia (adjuntando el
 * comprobante, igual que en las reservas de salones) y, cuando el
 * dueño configure Stripe, también con tarjeta.
 */
export default function OpcionesPago({
  pedidoId,
  sinpe,
  banco,
  stripeListo,
  monto,
}: {
  pedidoId: string;
  sinpe: { numero: string; titular: string };
  banco: { nombre: string; cuenta: string; titular: string };
  stripeListo: boolean;
  monto: string;
}) {
  const [metodo, setMetodo] = useState<"sinpe" | "transferencia">("sinpe");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");

  const [estado, accion, pendiente] = useActionState<EstadoPedido, FormData>(
    registrarPago.bind(null, pedidoId),
    {},
  );

  async function subirComprobante(archivo: File) {
    setErrorSubida("");
    if (archivo.size > 8 * 1024 * 1024) {
      setErrorSubida("El archivo pesa más de 8 MB — mandá una captura más liviana.");
      return;
    }
    setSubiendo(true);
    const supabase = createClient();
    const liviano = await comprimirImagen(archivo);
    const ext = liviano.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `pedidos-invitacion/${pedidoId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("comprobantes").upload(path, liviano);
    if (error) {
      setErrorSubida("No pudimos subir el comprobante. Intentá de nuevo.");
      setSubiendo(false);
      return;
    }
    const { data } = supabase.storage.from("comprobantes").getPublicUrl(path);
    setComprobanteUrl(data?.publicUrl ?? "");
    setSubiendo(false);
  }

  const datosListos = metodo === "sinpe" ? Boolean(sinpe.numero) : Boolean(banco.cuenta);

  return (
    <div className="mt-4 grid gap-4">
      {/* Tarjeta: aparece sola cuando el dueño configura Stripe */}
      {stripeListo ? (
        <div className="rounded-2xl border border-aventurea-line bg-white p-5">
          <p className="text-[14px] font-extrabold text-aventurea-ink">
            Pagar con tarjeta
          </p>
          <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
            Estamos terminando de conectar la pasarela. Mientras tanto podés
            pagar por SINPE o transferencia acá abajo.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-aventurea-line bg-white p-5">
        <p className="text-[14px] font-extrabold text-aventurea-ink">
          ¿Cómo querés pagar?
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { id: "sinpe" as const, label: "SINPE Móvil" },
            { id: "transferencia" as const, label: "Transferencia bancaria" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetodo(m.id)}
              className={`rounded-xl border-2 px-4 py-3 text-left text-[13.5px] font-bold transition-colors ${
                metodo === m.id
                  ? "border-aventurea-navy bg-aventurea-navy/5 text-aventurea-ink"
                  : "border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-navy/50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Los datos para pagar */}
        <div className="mt-4 rounded-xl bg-aventurea-cream-2 p-4">
          {!datosListos ? (
            <p className="text-[13px] leading-relaxed text-aventurea-ink">
              Todavía no configuramos este medio de pago. Escribinos por el chat
              y coordinamos el pago a mano.
            </p>
          ) : metodo === "sinpe" ? (
            <dl className="grid gap-2 text-[13.5px]">
              <Dato etiqueta="Número SINPE" valor={sinpe.numero} />
              {sinpe.titular && <Dato etiqueta="A nombre de" valor={sinpe.titular} />}
              <Dato etiqueta="Monto" valor={monto} />
              <Dato etiqueta="Detalle" valor={`Invitación ${pedidoId.slice(0, 8)}`} />
            </dl>
          ) : (
            <dl className="grid gap-2 text-[13.5px]">
              {banco.nombre && <Dato etiqueta="Banco" valor={banco.nombre} />}
              <Dato etiqueta="Cuenta / IBAN" valor={banco.cuenta} />
              {banco.titular && <Dato etiqueta="A nombre de" valor={banco.titular} />}
              <Dato etiqueta="Monto" valor={monto} />
              <Dato etiqueta="Detalle" valor={`Invitación ${pedidoId.slice(0, 8)}`} />
            </dl>
          )}
        </div>
      </div>

      {/* El comprobante */}
      <form action={accion} className="rounded-2xl border border-aventurea-line bg-white p-5">
        <input type="hidden" name="metodo_pago" value={metodo} />
        <input type="hidden" name="comprobante_url" value={comprobanteUrl} />

        <p className="text-[14px] font-extrabold text-aventurea-ink">
          Adjuntá tu comprobante
        </p>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Una captura del SINPE o de la transferencia. Lo verificamos y
          arrancamos con tu diseño.
        </p>

        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const archivo = e.currentTarget.files?.[0];
            if (archivo) subirComprobante(archivo);
          }}
          className="mt-3 block w-full text-[13px] text-aventurea-ink file:mr-3 file:rounded-lg file:border-0 file:bg-aventurea-navy file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-white"
        />

        {subiendo && (
          <p className="mt-2 text-[12.5px] font-semibold text-aventurea-ink-soft">
            Subiendo comprobante...
          </p>
        )}
        {comprobanteUrl && !subiendo && (
          <p className="mt-2 text-[12.5px] font-semibold text-aventurea-green">
            ✓ Comprobante adjunto
          </p>
        )}
        {errorSubida && (
          <p className="mt-2 text-[12.5px] font-semibold text-red-700">{errorSubida}</p>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-bold text-aventurea-ink">
            Número de referencia (opcional)
          </span>
          <input
            name="referencia_pago"
            maxLength={120}
            placeholder="Ej: 123456789"
            className="h-11 w-full rounded-xl border border-aventurea-line bg-white px-3.5 text-[13.5px] text-aventurea-ink placeholder:text-aventurea-ink-soft/50 focus:border-aventurea-navy focus:outline-none"
          />
        </label>

        {estado.error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-700">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente || subiendo || !comprobanteUrl}
          className="mt-4 w-full rounded-xl bg-aventurea-sky px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark disabled:opacity-50"
        >
          {pendiente ? "Enviando..." : "Ya pagué — enviar comprobante"}
        </button>
      </form>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-aventurea-ink-soft">{etiqueta}</dt>
      <dd className="text-right font-extrabold text-aventurea-ink">{valor}</dd>
    </div>
  );
}
