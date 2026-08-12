"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { solicitarPlanLealtad } from "./actions";

/**
 * El paso final de la compra: elegido el paquete, se confirma el
 * negocio (si hay varios), se deja un teléfono y va la solicitud.
 * Bookea recibe el correo y activa desde el panel administrativo.
 */

export type NegocioElegible = { id: string; nombre: string };

export default function FormularioSolicitud({
  plan,
  planNombre,
  negocios,
  negocioInicial,
  alCerrar,
}: {
  plan: string;
  planNombre: string;
  negocios: NegocioElegible[];
  negocioInicial: string | null;
  alCerrar: () => void;
}) {
  const [negocioId, setNegocioId] = useState(
    negocioInicial && negocios.some((n) => n.id === negocioInicial)
      ? negocioInicial
      : (negocios[0]?.id ?? ""),
  );
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviada" | string>("editando");
  const [ocupado, iniciar] = useTransition();

  function enviar() {
    iniciar(async () => {
      const res = await solicitarPlanLealtad(negocioId, plan, telefono, mensaje);
      setEstado(res.ok ? "enviada" : res.motivo);
    });
  }

  if (estado === "enviada") {
    return (
      <div className="rounded-2xl bg-white/10 p-5 text-center">
        <p className="text-[14.5px] font-extrabold text-white">¡Solicitud enviada!</p>
        <p className="mx-auto mt-1.5 max-w-[380px] text-[12.5px] leading-relaxed text-white/60">
          El equipo de Bookea la recibió y te contacta para dejar el plan {planNombre}{" "}
          funcionando. Vas a ver el estado en tu panel de lealtad.
        </p>
      </div>
    );
  }

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
            <label className="grid gap-1 text-[11.5px] font-bold uppercase tracking-wide text-white/50">
              Para cuál negocio
              <select
                value={negocioId}
                onChange={(e) => setNegocioId(e.target.value)}
                className="rounded-[10px] border border-white/20 bg-[#131c36] px-3 py-2.5 text-[13.5px] font-normal normal-case tracking-normal text-white"
              >
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

          <label className="grid gap-1 text-[11.5px] font-bold uppercase tracking-wide text-white/50">
            Teléfono (para coordinar)
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="8888 8888"
              maxLength={30}
              className="rounded-[10px] border border-white/20 bg-[#131c36] px-3 py-2.5 text-[13.5px] font-normal normal-case tracking-normal text-white placeholder:text-white/30"
            />
          </label>

          <label className="grid gap-1 text-[11.5px] font-bold uppercase tracking-wide text-white/50">
            Algo que debamos saber (opcional)
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Colores de la marca, la regalía que querés dar…"
              className="rounded-[10px] border border-white/20 bg-[#131c36] px-3 py-2.5 text-[13.5px] font-normal normal-case tracking-normal text-white placeholder:text-white/30"
            />
          </label>

          <button
            type="button"
            onClick={enviar}
            disabled={ocupado || !negocioId}
            className="rounded-xl bg-[#ee7420] px-5 py-3 text-[13.5px] font-extrabold text-white disabled:opacity-40"
          >
            {ocupado ? "Enviando…" : "Enviar la solicitud"}
          </button>

          {estado !== "editando" && (
            <p className="text-[12.5px] font-bold text-red-300">{estado}</p>
          )}
        </div>
      )}
    </div>
  );
}
