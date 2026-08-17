"use client";

import { useActionState, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconChevronDown } from "@/components/icons";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { registrarPago, type EstadoPedido } from "@/app/invitaciones/pedido/actions";
import { iniciarPagoDeInvitacion } from "./pago-actions";

/**
 * Cómo paga el cliente su invitación: con TARJETA (Stripe Checkout, que
 * trae Apple Pay y Google Pay solos) o por SINPE Móvil / transferencia
 * adjuntando el comprobante.
 *
 * ------------------------------------------------------------------
 * POR QUÉ LA TARJETA VA PRIMERO Y EL SINPE PLEGADO
 * ------------------------------------------------------------------
 * Es el mismo orden —y el mismo `<details>`— de la compra de paquetes
 * de Lealtad (/lealtad/planes/formulario-solicitud.tsx), y por las
 * mismas dos razones:
 *
 *   · la tarjeta es el único camino que no depende de que una persona
 *     revise un depósito: se paga y el pedido queda cobrado solo;
 *   · el SINPE NO es un respaldo temporal. Muchas tarjetas
 *     costarricenses vienen bloqueadas para compras internacionales, y
 *     esa gente necesita el depósito. Por eso el plegable dice de qué se
 *     trata sin abrirlo: plegado sin subtítulo, la pantalla parecería
 *     decir que solo se puede pagar con tarjeta.
 *
 * `<details>` y no un `useState`: es un plegable NATIVO —abre con Enter
 * y con Espacio, la lectura de pantalla lo anuncia— y MANTIENE EL
 * CONTENIDO MONTADO, así que plegarlo con el comprobante ya subido no
 * pierde nada. La palomita en el disparador lo hace visible sin abrir.
 *
 * Sin llaves de Stripe no se dibuja ningún botón de tarjeta y el
 * depósito se muestra abierto, tal cual estaba antes: plegar la única
 * forma de pagar sería esconderla.
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
  const [errorTarjeta, setErrorTarjeta] = useState("");
  const [abriendo, empezarPago] = useTransition();

  /**
   * La sesión de Checkout la arma el SERVIDOR y acá solo se sigue la
   * URL que devuelve. Ni el monto ni el paquete salen de esta pantalla:
   * el servidor los lee del pedido.
   */
  function pagarConTarjeta() {
    setErrorTarjeta("");
    empezarPago(async () => {
      const r = await iniciarPagoDeInvitacion(pedidoId);
      if (!r.ok) {
        setErrorTarjeta(r.motivo);
        return;
      }
      window.location.href = r.url;
    });
  }

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

  /* El depósito con comprobante, entero. Va en una variable porque se
     dibuja en dos lugares distintos —dentro del plegable cuando hay
     tarjeta, y suelto cuando no— y duplicar el formulario dejaría dos
     copias capaces de desincronizarse. */
  const caminoDeposito = (
    <div className="grid gap-4">
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

  return (
    <div className="mt-4 grid gap-4">
      {/* ── 1. CON TARJETA: el pedido queda cobrado al instante ─────── */}
      {stripeListo && (
        <div className="rounded-2xl border-2 border-aventurea-navy bg-white p-5">
          <p className="text-[14px] font-extrabold text-aventurea-ink">
            Pagar con tarjeta — queda cobrado al instante
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            Pagás en la página segura de Stripe y volvés acá. No hay comprobante
            que subir ni nada que esperar: apenas entra el pago, arrancamos con
            tu diseño.
          </p>

          <button
            type="button"
            onClick={pagarConTarjeta}
            disabled={abriendo}
            className="mt-3.5 w-full rounded-xl bg-aventurea-navy px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
          >
            {abriendo ? "Abriendo…" : `Pagar ${monto} con tarjeta`}
          </button>

          {/* Apple Pay y Google Pay los pone Stripe Checkout solo, según
              el teléfono: no hay ningún botón nuestro detrás de esto. */}
          <p className="mt-2 text-center text-[11.5px] text-aventurea-ink-soft">
            Tarjeta, Apple Pay o Google Pay
          </p>

          {errorTarjeta && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-700">
              {errorTarjeta}
            </p>
          )}
        </div>
      )}

      {/* ── 2. POR SINPE O TRANSFERENCIA: lo revisa el equipo ───────── */}
      {stripeListo ? (
        <details className="group rounded-2xl border border-aventurea-line bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-[13.5px] font-extrabold text-aventurea-ink">
                Pago por transferencia o SINPE
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-aventurea-ink-soft">
                Si tu tarjeta no acepta compras internacionales
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {comprobanteUrl && (
                <span className="text-[11.5px] font-bold text-aventurea-green">
                  ✓ Comprobante
                </span>
              )}
              <IconChevronDown className="h-4 w-4 text-aventurea-ink-soft transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-aventurea-line px-3 pb-3 pt-3">
            <p className="mb-3 px-2 text-[12.5px] leading-snug text-aventurea-ink-soft">
              Le pasa a muchas tarjetas de acá. Depositá, adjuntá la captura y
              verificamos el pago para arrancar con tu diseño.
            </p>
            {caminoDeposito}
          </div>
        </details>
      ) : (
        caminoDeposito
      )}
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
