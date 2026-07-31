"use client";

import { useState } from "react";
import { IconCheck, IconWhatsapp } from "@/components/icons";

/**
 * El comparador interactivo de paquetes: tres pestañas (Básico /
 * Intermedio / Plus) y un mockup que muestra, sin palabrería, qué
 * cambia entre uno y otro — cómo confirman tus invitados y qué control
 * tenés vos. Explica en segundos lo que la letra de los paquetes
 * cuenta en líneas.
 */

type Nivel = "basico" | "intermedio" | "plus";

const NIVELES: { id: Nivel; label: string }[] = [
  { id: "basico", label: "Básico" },
  { id: "intermedio", label: "Intermedio" },
  { id: "plus", label: "Plus" },
];

const CAPTION: Record<Nivel, string> = {
  basico:
    "Tus invitados te escriben por WhatsApp y vos llevás la lista a mano.",
  intermedio:
    "Confirman en el mismo link y tu panel en bookea.lat se actualiza solo — control completo de asistencia.",
  plus: "El mismo control total, con nuestro diseño más alto: animaciones y acabado premium.",
};

export default function InvitacionesComparador() {
  const [nivel, setNivel] = useState<Nivel>("intermedio");
  const conPanel = nivel !== "basico";
  const esPlus = nivel === "plus";

  return (
    <div className="mt-8 rounded-[24px] border border-aventurea-line bg-white p-5 sm:p-7">
      {/* Las pestañas */}
      <div className="mx-auto flex w-fit rounded-full border border-aventurea-line bg-aventurea-cream-2 p-1">
        {NIVELES.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setNivel(n.id)}
            className={`rounded-full px-5 py-2 text-[13px] font-bold transition-colors ${
              nivel === n.id
                ? "bg-aventurea-navy text-white"
                : "text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            {n.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
        {/* La mini invitación */}
        <div
          className={`w-[190px] shrink-0 rounded-[22px] p-[7px] transition-all duration-300 ${
            esPlus
              ? "bg-[linear-gradient(135deg,#d9b96a_0%,#16295e_45%,#ee7420_100%)] shadow-[0_18px_44px_-18px_rgba(217,185,106,0.55)]"
              : "bg-aventurea-ink shadow-[0_18px_44px_-20px_rgba(16,26,44,0.45)]"
          }`}
        >
          <div className="relative overflow-hidden rounded-[16px] bg-[#16295e] px-3 pb-4 pt-5 text-center text-white">
            <p className="text-[7px] font-bold uppercase tracking-[0.28em] text-[#f5b98a]">
              {esPlus ? "Edición premium" : "Nuestra fiesta"}
            </p>
            <p
              className="mt-1.5 text-[17px] italic leading-tight"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Sofía cumple 15
            </p>
            <div className="mx-auto mt-2 h-px w-9 bg-white/25" />
            <p className="mt-2 text-[8.5px] font-bold text-white/85">
              Sábado 14 de noviembre
            </p>
            {/* La cuenta regresiva: viene desde el Básico */}
            <div className="mt-2.5 grid grid-cols-3 gap-1">
              {[
                ["32", "días"],
                ["08", "horas"],
                ["15", "min"],
              ].map(([v, u]) => (
                <div key={u} className="rounded-md bg-white/10 py-1">
                  <p className="text-[10px] font-extrabold leading-tight">{v}</p>
                  <p className="text-[6px] font-bold uppercase tracking-[0.12em] text-white/60">
                    {u}
                  </p>
                </div>
              ))}
            </div>
            {conPanel ? (
              <div className="mt-3 rounded-lg bg-aventurea-orange py-1.5 text-[9px] font-extrabold">
                Confirmar asistencia
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-white/30 py-1.5 text-[8.5px] font-bold text-white/85">
                <IconWhatsapp className="h-2.5 w-2.5" /> Confirmá por WhatsApp
              </div>
            )}
            {esPlus && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(9rem 5rem at 85% -10%, rgba(217,185,106,0.30), transparent 65%)",
                }}
              />
            )}
          </div>
        </div>

        {/* Lo que ve el creador de la fiesta */}
        <div className="w-full max-w-[290px]">
          {conPanel ? (
            <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_14px_38px_-20px_rgba(22,41,94,0.35)]">
              <div className="flex items-center justify-between border-b border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2">
                <span className="truncate text-[9px] font-semibold text-aventurea-ink-soft">
                  bookea.lat/cuenta · Tu panel
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e1f0e6] px-2 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide text-[#1f7a4d]">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-[#1f7a4d]" />
                  En vivo
                </span>
              </div>
              <div className="p-3.5">
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
                  Personas confirmadas
                </p>
                <p className="titulo mt-0.5 text-[26px] leading-none text-aventurea-ink">
                  18
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {[
                    ["Carlos Mora", "asiste", true],
                    ["Ana Chaves", "asiste", true],
                    ["Luis Rojas", "no puede", false],
                  ].map(([nombre, estado, ok]) => (
                    <div
                      key={nombre as string}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                        ok ? "bg-[#e1f0e6]" : "bg-red-50"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-white ${
                          ok ? "bg-[#1f7a4d]" : "bg-red-400"
                        }`}
                      >
                        {ok ? <IconCheck className="h-2 w-2" /> : <span className="text-[7px] font-black">×</span>}
                      </span>
                      <span className="truncate text-[10px] font-extrabold text-aventurea-ink">
                        {nombre}
                      </span>
                      <span className="ml-auto shrink-0 text-[8.5px] font-semibold text-aventurea-ink-soft">
                        {estado}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <span className="rounded-full bg-aventurea-navy/10 px-2 py-0.5 text-[8px] font-extrabold text-aventurea-navy">
                    PDF imprimible
                  </span>
                  <span className="rounded-full bg-aventurea-navy/10 px-2 py-0.5 text-[8px] font-extrabold text-aventurea-navy">
                    Lista de invitados
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-aventurea-line bg-white p-3.5 shadow-[0_14px_38px_-20px_rgba(22,41,94,0.35)]">
              <p className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#1f7a4d]">
                <IconWhatsapp className="h-3 w-3" /> WhatsApp
              </p>
              <div className="mt-2.5 space-y-1.5">
                <div className="mr-8 rounded-xl rounded-bl-sm bg-aventurea-cream-2 px-3 py-1.5 text-[10px] text-aventurea-ink">
                  ¡Confirmo! Somos 3
                </div>
                <div className="mr-14 rounded-xl rounded-bl-sm bg-aventurea-cream-2 px-3 py-1.5 text-[10px] text-aventurea-ink">
                  Yo no puedo, ¡disfruten!
                </div>
                <div className="ml-8 rounded-xl rounded-br-sm bg-[#e1f0e6] px-3 py-1.5 text-[10px] text-aventurea-ink">
                  ¡Anotados! Ya vamos 12
                </div>
              </div>
              <p className="mt-2.5 text-[9px] font-semibold text-aventurea-ink-soft">
                Vos llevás la cuenta a mano
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-[52ch] text-center text-[13px] leading-relaxed text-aventurea-ink-soft">
        {CAPTION[nivel]}
      </p>
    </div>
  );
}
