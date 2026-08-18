"use client";

import { useState } from "react";

/**
 * EL CATÁLOGO DE TRATAMIENTOS, en pestañas.
 *
 * Contenido de ejemplo — igual que el resto de esta página, "Lavacar
 * El Rayo" no existe. La idea no es vender detailing: es que quien
 * mire esta pantalla se imagine SU propia lista de servicios ahí
 * adentro, y entienda que la tarjeta de sellos suma lo mismo sin
 * importar cuál elija el cliente.
 */

type Tratamiento = {
  id: string;
  nombre: string;
  duracion: string;
  idealPara: string;
  descripcion: string;
  incluye: string[];
};

const TRATAMIENTOS: Tratamiento[] = [
  {
    id: "ceramico",
    nombre: "Tratamiento cerámico",
    duracion: "3-4 horas",
    idealPara: "Autos nuevos o recién pintados",
    descripcion:
      "Una capa de protección que se nota meses después: repele agua, polvo y rayos UV, y el brillo del primer día se queda ahí.",
    incluye: ["Descontaminación de la pintura", "Capa cerámica de grado profesional", "Sellado de rines y plásticos"],
  },
  {
    id: "premium",
    nombre: "Lavado premium",
    duracion: "45-60 min",
    idealPara: "Mantenimiento cada dos semanas",
    descripcion:
      "Lavado a mano, aspirado completo y aromatizado — el detalle que se nota apenas te subís.",
    incluye: ["Lavado exterior a mano", "Aspirado y limpieza de tapicería", "Llantas, aros y aromatizante"],
  },
  {
    id: "dx",
    nombre: "Lavado DX",
    duracion: "20-25 min",
    idealPara: "Antes de una reunión, camino al trabajo",
    descripcion:
      "El exterior brillando en minutos, para cuando no hay una hora libre pero tampoco ganas de subirte sucio.",
    incluye: ["Lavado exterior rápido", "Secado a mano", "Llantas al agua"],
  },
];

const ACENTO = "var(--orange)";

function Check({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function CatalogoTratamientos() {
  const [activo, setActivo] = useState(TRATAMIENTOS[0].id);
  const t = TRATAMIENTOS.find((x) => x.id === activo) ?? TRATAMIENTOS[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Tratamientos"
        className="flex flex-wrap gap-2 border-b border-white/12 pb-4"
      >
        {TRATAMIENTOS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={activo === x.id}
            onClick={() => setActivo(x.id)}
            className={`border px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] transition-colors ${
              activo === x.id
                ? "border-white bg-white text-black"
                : "border-white/25 text-white/55 hover:border-white/50 hover:text-white/85"
            }`}
          >
            {x.nombre}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="text-[15px] leading-relaxed text-white/70">{t.descripcion}</p>
          <ul className="mt-4 grid gap-2">
            {t.incluye.map((linea) => (
              <li key={linea} className="flex items-start gap-2.5 text-[13.5px] text-white/60">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center"
                  style={{ color: ACENTO }}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                {linea}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 sm:flex-col sm:gap-2">
          <div className="border border-white/12 px-4 py-3" style={{ background: "rgba(255,255,255,.04)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Duración</p>
            <p className="mt-0.5 text-[13px] font-bold text-white">{t.duracion}</p>
          </div>
          <div className="border border-white/12 px-4 py-3" style={{ background: "rgba(255,255,255,.04)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Ideal para</p>
            <p className="mt-0.5 text-[13px] font-bold text-white">{t.idealPara}</p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-[12.5px] leading-relaxed text-white/40">
        Elijas el que elijas, suma el mismo sello — la tarjeta no distingue tratamientos, cuenta
        visitas.
      </p>
    </div>
  );
}
