"use client";

import { useState, useTransition } from "react";
import { pedirAyudaDeDiseno } from "@/app/celebrar/app/celebraciones/[id]/ayuda-diseno";
import { PRECIO_A_MEDIDA_CRC, colones } from "@/lib/celebrar/creditos";

/**
 * «¿No estás contento con tu diseño?» — la puerta al equipo. Un botón
 * discreto que abre un formulario corto (qué mejorar, alcance, cómo
 * contactarte); el pedido llega a la bandeja del admin y por correo.
 * Va en la ficha de la celebración y en el editor.
 */
export default function AyudaDiseno({ celebracionId, compacto = false }: { celebracionId: string | null; compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [alcance, setAlcance] = useState("ajustes");
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    iniciar(async () => {
      const r = await pedirAyudaDeDiseno(celebracionId, {
        mensaje: String(fd.get("mensaje") ?? ""),
        contacto: String(fd.get("contacto") ?? ""),
        alcance: String(fd.get("alcance") ?? "ajustes"),
      });
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      // La invitación a medida se paga al pedirla: a Stripe, y de vuelta a la ficha.
      if (r.pagarEn) {
        window.location.assign(r.pagarEn);
        return;
      }
      setListo(true);
    });
  }

  if (listo) {
    return (
      <div className={`rounded-2xl border border-(--c-ok) bg-(--c-ok-suave) ${compacto ? "p-4" : "p-5"}`} role="status">
        <p className="c-montserrat text-[14px] font-semibold text-(--c-ok)">¡Recibido!</p>
        <p className="mt-1 text-[13px] leading-relaxed text-(--c-ok)">Alguien del equipo mira tu invitación y te escribe en menos de 24 horas para dejarla como querés.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-(--c-linea) bg-(--c-hielo) ${compacto ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="c-montserrat text-[14px] font-semibold text-(--c-tinta)">¿No estás contento con tu diseño?</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-(--c-tinta-suave)">Nuestro equipo de diseño puede ajustarlo, rehacerlo o hacerte una invitación a medida.</p>
        </div>
        {!abierto && (
          <button type="button" onClick={() => setAbierto(true)} className="c-boton c-boton-secundario min-h-10 text-[13px]">
            Pedir ayuda al equipo
          </button>
        )}
      </div>
      {abierto && (
        <form onSubmit={enviar} className="mt-4 grid gap-3">
          <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
            ¿Qué te gustaría?
            <select name="alcance" value={alcance} onChange={(e) => setAlcance(e.target.value)} className="c-campo">
              <option value="ajustes">Ajustes al diseño actual</option>
              <option value="rediseno">Un rediseño completo</option>
              <option value="a_medida">Que el equipo la haga a medida · {colones(PRECIO_A_MEDIDA_CRC)}</option>
            </select>
          </label>
          {alcance === "a_medida" && (
            <p className="rounded-xl border border-(--c-linea) bg-(--c-blanco) px-4 py-3 text-[13px] leading-relaxed text-(--c-tinta-suave)">
              <strong className="text-(--c-tinta)">Invitación a medida · {colones(PRECIO_A_MEDIDA_CRC)}.</strong> La diseña nuestro equipo con lo que nos contés y se paga ahora, al pedirla. Incluye la publicación: cuando esté lista, la publicás sin pagar nada más.
            </p>
          )}
          <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
            Contanos qué mejorar
            <textarea name="mensaje" required minLength={5} maxLength={2000} rows={4} className="c-campo min-h-24" placeholder="Qué no te convence, qué estilo imaginás, alguna referencia (un link, otra invitación que te guste)…" />
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
            WhatsApp o correo para responderte (opcional)
            <input name="contacto" maxLength={120} className="c-campo" placeholder="8888 8888" />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-(--c-coral-suave) px-3 py-2 text-[13px] text-(--c-coral-tinta)">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pendiente} className="c-boton c-boton-primario min-h-10 text-[13px]">
              {pendiente ? "Enviando…" : alcance === "a_medida" ? `Pedirla y pagar ${colones(PRECIO_A_MEDIDA_CRC)}` : "Enviar al equipo"}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="c-boton c-boton-secundario min-h-10 text-[13px]">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
