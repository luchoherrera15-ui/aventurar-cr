"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { solicitarPlanLealtad } from "./actions";

/**
 * El paso final de la compra: elegido el paquete, se confirma el
 * negocio, se hace el DEPÓSITO (SINPE o transferencia — los datos
 * están acá mismo), se adjunta la captura y recién ahí sale la
 * solicitud. Sin comprobante no hay botón: nadie inicia el programa
 * sin haber pagado.
 *
 * El comprobante va al mismo bucket `comprobantes` que ya usan las
 * invitaciones y las reservas — un solo lugar donde buscar depósitos.
 */

export type NegocioElegible = { id: string; nombre: string };

export type DatosPago = {
  sinpe: { numero: string; titular: string };
  banco: { nombre: string; cuenta: string; titular: string };
};

export default function FormularioSolicitud({
  plan,
  planNombre,
  precio,
  negocios,
  negocioInicial,
  pago,
  alCerrar,
}: {
  plan: string;
  planNombre: string;
  /** Colones del primer mes; null = todavía sin precio publicado. */
  precio: number | null;
  negocios: NegocioElegible[];
  negocioInicial: string | null;
  pago: DatosPago;
  alCerrar: () => void;
}) {
  const [negocioId, setNegocioId] = useState(
    negocioInicial && negocios.some((n) => n.id === negocioInicial)
      ? negocioInicial
      : (negocios[0]?.id ?? ""),
  );
  const [metodo, setMetodo] = useState<"sinpe" | "transferencia">("sinpe");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviada" | string>("editando");
  const [ocupado, iniciar] = useTransition();

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
    const path = `solicitudes-lealtad/${negocioId || "sin-negocio"}-${Date.now()}.${ext}`;
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

  function enviar() {
    iniciar(async () => {
      const res = await solicitarPlanLealtad(
        negocioId,
        plan,
        telefono,
        mensaje,
        metodo,
        comprobanteUrl,
      );
      setEstado(res.ok ? "enviada" : res.motivo);
    });
  }

  if (estado === "enviada") {
    return (
      <div className="rounded-2xl bg-white/10 p-5 text-center">
        <p className="text-[14.5px] font-extrabold text-white">¡Solicitud enviada!</p>
        <p className="mx-auto mt-1.5 max-w-[380px] text-[12.5px] leading-relaxed text-white/60">
          Recibimos tu depósito y tu solicitud del plan {planNombre}. El equipo de Bookea
          los revisa, arma tu programa y te avisa al correo cuando esté funcionando.
        </p>
      </div>
    );
  }

  const etiqueta = "grid gap-1 text-[11.5px] font-bold uppercase tracking-wide text-white/50";
  const campo =
    "rounded-[10px] border border-white/20 bg-[#131c36] px-3 py-2.5 text-[13.5px] font-normal normal-case tracking-normal text-white placeholder:text-white/30";

  return (
    <div className="rounded-2xl bg-white/10 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-extrabold text-white">Solicitar el plan {planNombre}</p>
        <button type="button" onClick={alCerrar} className="text-[12px] font-bold text-white/50 hover:text-white">
          Cancelar
        </button>
      </div>

      {negocios.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-white/60">
          Todavía no administrás ningún negocio en Bookea.{" "}
          <Link href="/lealtad/nuevo" className="font-bold underline">
            Crealo primero
          </Link>{" "}
          — dos campos, sin publicarte en el marketplace — y volvés acá a solicitar el plan.
        </p>
      ) : (
        <div className="mt-3 grid gap-2.5">
          {negocios.length > 1 && (
            <label className={etiqueta}>
              Para cuál negocio
              <select value={negocioId} onChange={(e) => setNegocioId(e.target.value)} className={campo}>
                {negocios.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          {negocios.length === 1 && (
            <p className="text-[12.5px] text-white/60">
              Para <strong className="text-white">{negocios[0].nombre}</strong>
            </p>
          )}

          {/* ── El depósito: primero se paga, después se solicita.
                 El plan Gratis se salta este paso entero. ── */}
          {precio === 0 ? (
            <p className="rounded-xl border border-white/15 bg-[#0f1930] px-3.5 py-3 text-[13px] text-white/70">
              Plan gratis — sin depósito. Hasta 5 miembros para probar el programa.
            </p>
          ) : (
          <div className="rounded-xl border border-white/15 bg-[#0f1930] p-3.5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-white/50">
              1 · Hacé el depósito
              {precio !== null && (
                <span className="text-white"> de ₡{precio.toLocaleString("es-CR")} (primer mes)</span>
              )}
            </p>
            <div className="mt-2 flex gap-1.5">
              {(["sinpe", "transferencia"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodo(m)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                    metodo === m ? "bg-white text-[#0a1226]" : "bg-white/10 text-white/60"
                  }`}
                >
                  {m === "sinpe" ? "SINPE Móvil" : "Transferencia"}
                </button>
              ))}
            </div>
            {metodo === "sinpe" ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                SINPE Móvil al{" "}
                <strong className="text-white">{pago.sinpe.numero}</strong> a nombre de{" "}
                <strong className="text-white">{pago.sinpe.titular}</strong>. En el detalle
                poné el nombre de tu negocio.
              </p>
            ) : pago.banco.cuenta ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                {pago.banco.nombre} · cuenta{" "}
                <strong className="text-white">{pago.banco.cuenta}</strong> a nombre de{" "}
                <strong className="text-white">{pago.banco.titular}</strong>. En el detalle
                poné el nombre de tu negocio.
              </p>
            ) : (
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                Escribinos y te pasamos la cuenta — o usá SINPE Móvil al{" "}
                <strong className="text-white">{pago.sinpe.numero}</strong>, que es inmediato.
              </p>
            )}

            <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-white/50">
              2 · Adjuntá la captura
            </p>
            {comprobanteUrl ? (
              <p className="mt-1.5 text-[12.5px] font-bold text-emerald-300">
                ✓ Comprobante adjunto.{" "}
                <button
                  type="button"
                  onClick={() => setComprobanteUrl("")}
                  className="font-bold text-white/50 underline"
                >
                  Cambiarlo
                </button>
              </p>
            ) : (
              <label className="mt-1.5 block">
                <input
                  type="file"
                  accept="image/*"
                  disabled={subiendo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void subirComprobante(f);
                  }}
                  className="block w-full text-[12.5px] text-white/60 file:mr-3 file:rounded-[10px] file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-white"
                />
              </label>
            )}
            {subiendo && <p className="mt-1 text-[12px] text-white/50">Subiendo…</p>}
            {errorSubida && <p className="mt-1 text-[12.5px] font-bold text-red-300">{errorSubida}</p>}
          </div>
          )}

          <label className={etiqueta}>
            Teléfono (para coordinar)
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="8888 8888"
              maxLength={30}
              className={campo}
            />
          </label>

          <label className={etiqueta}>
            Algo que debamos saber (opcional)
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Colores de la marca, la regalía que querés dar…"
              className={campo}
            />
          </label>

          <button
            type="button"
            onClick={enviar}
            disabled={
              ocupado || subiendo || !negocioId || (precio !== 0 && !comprobanteUrl)
            }
            className="rounded-xl bg-[#ee7420] px-5 py-3 text-[13.5px] font-extrabold text-white disabled:opacity-40"
          >
            {ocupado
              ? "Enviando…"
              : precio === 0 || comprobanteUrl
                ? "Enviar la solicitud"
                : "Adjuntá el comprobante para enviar"}
          </button>

          {estado !== "editando" && (
            <p className="text-[12.5px] font-bold text-red-300">{estado}</p>
          )}
        </div>
      )}
    </div>
  );
}
