"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { solicitarAltaConPlan } from "./actions";
import type { DatosPago } from "@/app/lealtad/planes/formulario-solicitud";

/**
 * Los tres pasos del alta (la cuenta es el paso 0, en la página):
 *
 *   1 · el negocio — nombre y tipo, con «Otro» como opción real
 *   2 · el paquete — Básico / Estándar / Enterprise con su precio
 *   3 · el depósito — SINPE o transferencia + comprobante, y enviar
 *
 * Nada se crea al enviar: viaja la SOLICITUD con todo adentro, y el
 * negocio nace solo si Bookea la acepta.
 */

export type PlanWizard = {
  id: string;
  nombre: string;
  limite: number | null;
  precio: number | null;
  beneficios: string[];
  masBeneficios: number;
  destacado: boolean;
};

const TIPOS: { id: string; label: string }[] = [
  { id: "citas", label: "Citas y servicios" },
  { id: "restaurantes", label: "Restaurante o café" },
  { id: "eventos", label: "Eventos" },
  { id: "hospedajes", label: "Hospedaje" },
  { id: "otro", label: "Otro" },
];

const etiqueta = "grid gap-1 text-[11.5px] font-bold uppercase tracking-wide text-white/50";
const campo =
  "rounded-[10px] border border-white/20 bg-[#131c36] px-3 py-2.5 text-[13.5px] font-normal normal-case tracking-normal text-white placeholder:text-white/30";

export default function WizardAlta({ planes, pago }: { planes: PlanWizard[]; pago: DatosPago }) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("citas");
  const [detalleOtro, setDetalleOtro] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<"sinpe" | "transferencia">("sinpe");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviada" | string>("editando");
  const [ocupado, iniciar] = useTransition();

  const planElegido = planes.find((p) => p.id === plan) ?? null;

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
    const path = `solicitudes-lealtad/alta-${Date.now()}.${ext}`;
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
    if (!planElegido) return;
    iniciar(async () => {
      const res = await solicitarAltaConPlan({
        nombreNegocio: nombre,
        tipo,
        detalleOtro,
        plan: planElegido.id,
        metodoPago: metodo,
        comprobanteUrl,
        telefono,
        mensaje,
      });
      setEstado(res.ok ? "enviada" : res.motivo);
    });
  }

  if (estado === "enviada") {
    return (
      <div className="rounded-2xl bg-white/10 p-6 text-center">
        <p className="text-[16px] font-extrabold text-white">¡Solicitud enviada!</p>
        <p className="mx-auto mt-2 max-w-[420px] text-[13px] leading-relaxed text-white/60">
          Recibimos tu depósito y los datos de <strong className="text-white">{nombre}</strong>.
          El equipo de Bookea revisa la solicitud y te avisa al correo: si se acepta, tu
          negocio y tu programa quedan creados y listos para configurar contigo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/10 p-5 sm:p-6">
      {/* La miga: dónde va y qué falta. */}
      <div className="flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${n <= paso ? "bg-[#ee7420]" : "bg-white/15"}`}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-white/45">
        Paso {paso} de 3 ·{" "}
        {paso === 1 ? "Tu negocio" : paso === 2 ? "Tu paquete" : "Tu depósito"}
      </p>

      {/* ── Paso 1: el negocio ── */}
      {paso === 1 && (
        <div className="mt-4 grid gap-3">
          <label className={etiqueta}>
            Nombre del negocio
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Café La Esquina"
              className={campo}
            />
          </label>
          <div className={etiqueta}>
            Tipo de negocio
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-bold normal-case tracking-normal transition-colors ${
                    tipo === t.id
                      ? "border-[#ee7420] bg-[#ee7420]/15 text-white"
                      : "border-white/20 text-white/60 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {tipo === "otro" && (
            <label className={etiqueta}>
              ¿Qué negocio es?
              <input
                value={detalleOtro}
                onChange={(e) => setDetalleOtro(e.target.value)}
                maxLength={80}
                placeholder="Ferretería, academia de baile, veterinaria…"
                className={campo}
              />
            </label>
          )}
          <button
            type="button"
            disabled={!nombre.trim() || (tipo === "otro" && !detalleOtro.trim())}
            onClick={() => setPaso(2)}
            className="mt-1 rounded-xl bg-[#ee7420] px-5 py-3 text-[13.5px] font-extrabold text-white disabled:opacity-40"
          >
            Seguir: elegir el paquete →
          </button>
        </div>
      )}

      {/* ── Paso 2: el paquete ── */}
      {paso === 2 && (
        <div className="mt-4 grid gap-3">
          {planes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlan(p.id);
                setPaso(3);
              }}
              className={`rounded-xl border p-4 text-left transition-colors ${
                plan === p.id
                  ? "border-[#ee7420] bg-[#ee7420]/10"
                  : p.destacado
                    ? "border-[#ee7420]/50 bg-white/5 hover:bg-white/10"
                    : "border-white/15 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[15px] font-extrabold text-white">{p.nombre}</span>
                {p.precio !== null && (
                  <span className="text-[15px] font-extrabold text-white">
                    {p.precio === 0 ? (
                      "₡0 — para probar"
                    ) : (
                      <>
                        ₡{p.precio.toLocaleString("es-CR")}
                        <span className="text-[11px] font-bold text-white/50"> /mes</span>
                      </>
                    )}
                  </span>
                )}
                <span className="text-[11.5px] text-white/50">
                  hasta {p.limite?.toLocaleString("es-CR")} miembros
                </span>
                {p.destacado && (
                  <span className="rounded-full bg-[#ee7420] px-2 py-0.5 text-[9.5px] font-bold uppercase text-white">
                    El más completo
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
                {p.beneficios.join(" · ")}
                {p.masBeneficios > 0 ? ` · y ${p.masBeneficios} beneficios más` : ""}
              </p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPaso(1)}
            className="justify-self-start text-[12.5px] font-bold text-white/50 underline"
          >
            ← Volver al negocio
          </button>
        </div>
      )}

      {/* ── Paso 3: el depósito (si el plan cuesta) y enviar ── */}
      {paso === 3 && planElegido && (
        <div className="mt-4 grid gap-3">
          <p className="text-[13px] text-white/70">
            <strong className="text-white">{nombre}</strong> · plan{" "}
            <strong className="text-white">{planElegido.nombre}</strong>
            {planElegido.precio === 0 ? (
              <> — gratis: sin depósito, hasta 5 miembros</>
            ) : planElegido.precio !== null ? (
              <>
                {" "}
                — depositá{" "}
                <strong className="text-white">
                  ₡{planElegido.precio.toLocaleString("es-CR")}
                </strong>{" "}
                (primer mes)
              </>
            ) : null}
          </p>

          {planElegido.precio !== 0 && (
          <div className="rounded-xl border border-white/15 bg-[#0f1930] p-3.5">
            <div className="flex gap-1.5">
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
                SINPE Móvil al <strong className="text-white">{pago.sinpe.numero}</strong> a
                nombre de <strong className="text-white">{pago.sinpe.titular}</strong>. En el
                detalle poné «{nombre.trim() || "tu negocio"}».
              </p>
            ) : pago.banco.cuenta ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                {pago.banco.nombre} · cuenta{" "}
                <strong className="text-white">{pago.banco.cuenta}</strong> a nombre de{" "}
                <strong className="text-white">{pago.banco.titular}</strong>.
              </p>
            ) : (
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                Escribinos y te pasamos la cuenta — o usá SINPE Móvil al{" "}
                <strong className="text-white">{pago.sinpe.numero}</strong>, que es inmediato.
              </p>
            )}

            <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-white/50">
              Adjuntá la captura del depósito
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
              <input
                type="file"
                accept="image/*"
                disabled={subiendo}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void subirComprobante(f);
                }}
                className="mt-1.5 block w-full text-[12.5px] text-white/60 file:mr-3 file:rounded-[10px] file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-white"
              />
            )}
            {subiendo && <p className="mt-1 text-[12px] text-white/50">Subiendo…</p>}
            {errorSubida && (
              <p className="mt-1 text-[12.5px] font-bold text-red-300">{errorSubida}</p>
            )}
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={enviar}
              disabled={
                ocupado || subiendo || (planElegido.precio !== 0 && !comprobanteUrl)
              }
              className="rounded-xl bg-[#ee7420] px-5 py-3 text-[13.5px] font-extrabold text-white disabled:opacity-40"
            >
              {ocupado
                ? "Enviando…"
                : planElegido.precio === 0 || comprobanteUrl
                  ? "Enviar la solicitud"
                  : "Adjuntá el comprobante para enviar"}
            </button>
            <button
              type="button"
              onClick={() => setPaso(2)}
              className="text-[12.5px] font-bold text-white/50 underline"
            >
              ← Cambiar de paquete
            </button>
          </div>

          {estado !== "editando" && (
            <p className="text-[12.5px] font-bold text-red-300">{estado}</p>
          )}
        </div>
      )}
    </div>
  );
}
