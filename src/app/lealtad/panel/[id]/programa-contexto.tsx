"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import type { ModoPrograma } from "@/lib/wallet/tarjeta";
import {
  cambiarEstadoPrograma,
  eliminarRecompensa,
  guardarPrograma,
  guardarRecompensa,
  type ProgramaFila,
  type ProgramaInput,
  type RecompensaFila,
  type RecompensaInput,
} from "./pases-actions";

/**
 * EL ESTADO DEL PROGRAMA, COMPARTIDO.
 *
 * El menú lateral partió lo que antes era un solo formulario en dos
 * secciones: «Recompensas» (cómo se gana y qué se gana) y «Tarjeta
 * digital» (cómo se ve). Las dos escriben la MISMA fila de
 * `programa_lealtad`, y `guardarPrograma` guarda la fila completa.
 *
 * Con un borrador por sección, esto pasaba: el dueño cambia los sellos
 * por visita en Recompensas y guarda; se va a Tarjeta —cuyo borrador
 * se sembró al cargar la página, con el valor viejo—, toca un color y
 * guarda: los sellos vuelven atrás sin que nadie lo pida.
 *
 * Por eso el borrador es UNO solo y vive acá arriba, por encima de las
 * dos secciones. Cada «Guardar» manda el mismo objeto coherente.
 */

export type Borrador = {
  nombre: string;
  modo: ModoPrograma;
  puntosPorVisita: string;
  puntosPorColon: string;
  colorFondo: string;
  colorSello: string;
  logoUrl: string;
  activo: boolean;
};

function num(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

function dePrograma(p: ProgramaFila | null): Borrador {
  return {
    nombre: p?.nombre ?? "Programa de lealtad",
    modo: p?.modo ?? "sellos",
    puntosPorVisita: String(p?.puntos_por_visita ?? 1),
    puntosPorColon: String(p?.puntos_por_colon ?? 0),
    colorFondo: p?.pase_color_fondo ?? "#002472",
    colorSello: p?.pase_color_sello ?? "#F39200",
    logoUrl: p?.pase_logo_url ?? "",
    activo: p?.activo ?? true,
  };
}

type ContextoPrograma = {
  ranchoId: string;
  tieneCercania: boolean;
  programa: ProgramaFila | null;
  recompensas: RecompensaFila[];
  /** La más barata activa: la que marca la meta de la tarjeta. */
  meta: RecompensaFila | null;
  borrador: Borrador;
  cambiar: (parte: Partial<Borrador>) => void;
  error: string | null;
  guardado: boolean;
  ocupado: boolean;
  guardar: () => void;
  agregarRecompensa: (datos: RecompensaInput) => void;
  borrarRecompensa: (id: string) => void;
  cambiarEstado: (estado: string) => void;
};

const Contexto = createContext<ContextoPrograma | null>(null);

export function usePrograma(): ContextoPrograma {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error("Las secciones del programa van dentro de <ProveedorPrograma>.");
  }
  return ctx;
}

export function ProveedorPrograma({
  ranchoId,
  programaInicial,
  recompensasIniciales,
  tieneCercania,
  children,
}: {
  ranchoId: string;
  programaInicial: ProgramaFila | null;
  recompensasIniciales: RecompensaFila[];
  /** Complemento de pago (0123): el aviso en pantalla bloqueada. */
  tieneCercania: boolean;
  children: ReactNode;
}) {
  const [programa, setPrograma] = useState(programaInicial);
  const [recompensas, setRecompensas] = useState(
    [...recompensasIniciales].sort((a, b) => a.costo_puntos - b.costo_puntos),
  );
  const [borrador, setBorrador] = useState<Borrador>(dePrograma(programaInicial));
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const meta = recompensas.find((r) => r.activo) ?? null;

  function cambiar(parte: Partial<Borrador>) {
    setBorrador((prev) => ({ ...prev, ...parte }));
    setGuardado(false);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    const entrada: ProgramaInput = {
      nombre: borrador.nombre,
      modo: borrador.modo,
      puntosPorVisita: Math.round(num(borrador.puntosPorVisita)),
      puntosPorColon: num(borrador.puntosPorColon),
      colorFondo: borrador.colorFondo,
      colorSello: borrador.colorSello,
      logoUrl: borrador.logoUrl,
      activo: borrador.activo,
    };
    iniciar(async () => {
      const res = await guardarPrograma(ranchoId, entrada);
      if (res.error) setError(res.error);
      else if (res.programa) {
        setPrograma(res.programa);
        setGuardado(true);
      }
    });
  }

  function agregarRecompensa(datos: RecompensaInput) {
    if (!programa) {
      setError("Guardá el programa antes de agregar recompensas.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const res = await guardarRecompensa(ranchoId, programa.id, datos);
      if (res.error) setError(res.error);
      else if (res.recompensa) {
        setRecompensas((prev) =>
          [...prev, res.recompensa!].sort((a, b) => a.costo_puntos - b.costo_puntos),
        );
      }
    });
  }

  function borrarRecompensa(id: string) {
    if (!programa) return;
    setError(null);
    iniciar(async () => {
      const res = await eliminarRecompensa(ranchoId, programa.id, id);
      if (res.error) setError(res.error);
      else setRecompensas((prev) => prev.filter((r) => r.id !== id));
    });
  }

  function cambiarEstado(estado: string) {
    if (!programa) return;
    setError(null);
    iniciar(async () => {
      const res = await cambiarEstadoPrograma(ranchoId, programa.id, estado);
      if (res.error) setError(res.error);
      else if (res.programa) setPrograma(res.programa);
    });
  }

  return (
    <Contexto.Provider
      value={{
        ranchoId,
        tieneCercania,
        programa,
        recompensas,
        meta,
        borrador,
        cambiar,
        error,
        guardado,
        ocupado,
        guardar,
        agregarRecompensa,
        borrarRecompensa,
        cambiarEstado,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
