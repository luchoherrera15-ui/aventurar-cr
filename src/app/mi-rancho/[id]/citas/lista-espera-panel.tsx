"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtFechaCorta, hoyISOCR } from "@/lib/fechas";

/**
 * La lista de espera del negocio (0095): quién quiere entrar cuando un
 * día está lleno. Cuando el dueño cancela o mueve una cita, el sistema
 * avisa solo a los apuntados de ese día ("reserva quien confirme
 * primero"); acá el dueño la ve y la depura. Lee y borra directo con
 * su sesión (la RLS limita todo a su negocio).
 */

type Espera = {
  id: string;
  fecha: string;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  notas: string | null;
  avisado_en: string | null;
  created_at: string;
  rancho_items: { nombre: string } | null;
  equipo_rancho: { nombre: string } | null;
};

export default function ListaEsperaPanel({ ranchoId }: { ranchoId: string }) {
  const [filas, setFilas] = useState<Espera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Contador de recarga: quitar una fila vuelve a disparar el efecto.
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    const supabase = createClient();
    supabase
      .from("lista_espera")
      .select(
        "id, fecha, nombre, correo, telefono, notas, avisado_en, created_at, rancho_items(nombre), equipo_rancho(nombre)",
      )
      .eq("rancho_id", ranchoId)
      .gte("fecha", hoyISOCR())
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data, error: errorCarga }) => {
        if (!vigente) return;
        if (errorCarga) {
          // Migración 0095 sin correr: la sección se explica sola.
          setError(
            /lista_espera|schema cache|does not exist/i.test(errorCarga.message)
              ? "migracion"
              : errorCarga.message,
          );
          setFilas([]);
          return;
        }
        setFilas((data ?? []) as unknown as Espera[]);
      });
    return () => {
      vigente = false;
    };
  }, [ranchoId, recarga]);

  function quitar(id: string) {
    startTransition(async () => {
      const supabase = createClient();
      const { error: errorBorrado } = await supabase
        .from("lista_espera")
        .delete()
        .eq("id", id)
        .eq("rancho_id", ranchoId);
      if (errorBorrado) {
        setError(errorBorrado.message);
        return;
      }
      setRecarga((n) => n + 1);
    });
  }

  if (error === "migracion") {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
        <strong>Falta la migración 0095.</strong> Corré{" "}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
          supabase/migrations/0095_citas_fase2.sql
        </code>{" "}
        en el SQL Editor de Supabase para activar la lista de espera.
      </div>
    );
  }

  if (filas === null) {
    return <p className="text-[13px] text-aventurea-ink-soft">Cargando...</p>;
  }

  if (filas.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
        Nadie está esperando espacio por ahora. Cuando un día tuyo se llene,
        el cliente puede apuntarse desde tu página — y si cancelás o movés
        una cita de ese día, se le avisa solo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}
      <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
        {filas.map((f) => (
          <div
            key={f.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-aventurea-line px-4 py-3 last:border-none"
          >
            <div className="w-[74px] shrink-0">
              <p className="text-[13.5px] font-bold text-aventurea-ink">
                {fmtFechaCorta(f.fecha)}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-aventurea-ink">
                {f.nombre ?? f.correo ?? "Cliente"}
                {f.avisado_en && (
                  <span className="ml-2 rounded-lg bg-aventurea-navy/10 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-navy">
                    Ya avisado
                  </span>
                )}
              </p>
              <p className="mt-0.5 break-words text-[12px] text-aventurea-ink-soft">
                {f.rancho_items?.nombre ?? "Cualquier servicio"}
                {f.equipo_rancho?.nombre ? ` · con ${f.equipo_rancho.nombre}` : ""}
                {f.correo ? ` · ${f.correo}` : ""}
                {f.telefono ? ` · ${f.telefono}` : ""}
              </p>
              {f.notas && (
                <p className="mt-0.5 text-[12px] text-zinc-500">📝 {f.notas}</p>
              )}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => quitar(f.id)}
              className="h-[30px] shrink-0 rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-red-700 hover:border-red-300 disabled:opacity-40"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
