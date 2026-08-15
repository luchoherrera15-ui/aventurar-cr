"use client";

import type { ProfesionalPerfil } from "./perfil-tipos";
import ProfessionalCard from "./professional-card";

type Props = {
  equipo: ProfesionalPerfil[];
  onReservar: (servicioId: string | null, miembroId: string | null) => void;
};

/**
 * La grilla del equipo, con cards grandes en vez de los círculos
 * chiquitos de antes. Sin equipo cargado, la sección entera desaparece
 * — mismo criterio que ya usaba page.tsx con "equipo.length > 0 &&".
 */
export default function TeamSection({ equipo, onReservar }: Props) {
  if (equipo.length === 0) return null;

  return (
    <div className="mt-9">
      <h2 className="titulo text-[18px] text-aventurea-navy">
        El equipo
      </h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {equipo.map((profesional) => (
          <ProfessionalCard
            key={profesional.id}
            profesional={profesional}
            onReservar={onReservar}
          />
        ))}
      </div>
    </div>
  );
}
