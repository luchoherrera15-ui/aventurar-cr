"use client";

import { useState, useEffect, useRef } from "react";

interface CostPreviewProps {
  prompt: string;
  modelo: "opus" | "fable";
  onCostoCalculado?: (costo: number) => void;
  disabled?: boolean;
}

interface CostResult {
  success: boolean;
  input_tokens?: number;
  output_tokens?: number;
  costo_usd?: number;
  costo_formateado?: string;
  error?: string;
}

export default function CostPreview({
  prompt,
  modelo,
  onCostoCalculado,
  disabled = false,
}: CostPreviewProps) {
  const [costo, setCosto] = useState<CostResult | null>(null);
  const [cargando, setCargando] = useState(false);

  // Ref para no re-disparar el efecto cuando el padre re-crea el callback
  const onCostoRef = useRef(onCostoCalculado);
  useEffect(() => {
    onCostoRef.current = onCostoCalculado;
  });

  // Número de secuencia: una respuesta lenta de un prompt viejo no
  // debe pisar la del prompt actual (ni el costo que habilita Generar).
  const secuenciaRef = useRef(0);

  useEffect(() => {
    if (disabled || !prompt || prompt.length < 20) {
      return;
    }

    const miSecuencia = ++secuenciaRef.current;

    const timer = setTimeout(() => {
      setCargando(true);
      (async () => {
        try {
          const res = await fetch("/api/invitaciones/preview-token-count", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt, modelo }),
          });
          if (miSecuencia !== secuenciaRef.current) return; // respuesta vieja

          if (res.ok) {
            const data = (await res.json()) as CostResult;
            setCosto(data);
            onCostoRef.current?.(data.costo_usd || 0);
          } else {
            const error = (await res.json()) as CostResult;
            setCosto({ success: false, error: error.error });
          }
        } catch {
          if (miSecuencia !== secuenciaRef.current) return;
          setCosto({
            success: false,
            error: "Error al calcular costo",
          });
        } finally {
          if (miSecuencia === secuenciaRef.current) setCargando(false);
        }
      })();
    }, 500);

    return () => clearTimeout(timer);
  }, [prompt, modelo, disabled]);

  if (!costo && !cargando) {
    return null;
  }

  if (cargando) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-aventurea-orange border-t-transparent" />
          <span className="text-[13px] text-aventurea-ink-soft">Calculando costo...</span>
        </div>
      </div>
    );
  }

  if (!costo || !costo.success || !costo.costo_usd) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-[13px] text-red-700">{costo?.error || "Error al estimar costo"}</p>
      </div>
    );
  }

  const modeloLabel = modelo === "opus" ? "Claude Opus 5" : "Claude Fable 5";
  const velocidad = modelo === "opus" ? "~1-3 min" : "~2-5 min";

  return (
    <div className="rounded-2xl border border-aventurea-orange/30 bg-aventurea-orange/5 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {/* Tokens input */}
        <div>
          <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Tokens input</p>
          <p className="mt-1 text-[16px] font-bold text-aventurea-ink">
            {costo.input_tokens?.toLocaleString("es-CR")}
          </p>
        </div>

        {/* Tokens output */}
        <div>
          <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Tokens output</p>
          <p className="mt-1 text-[16px] font-bold text-aventurea-ink">
            {costo.output_tokens?.toLocaleString("es-CR")}
          </p>
        </div>

        {/* Modelo */}
        <div>
          <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Modelo</p>
          <p className="mt-1 text-[13px] font-bold text-aventurea-ink">{modeloLabel}</p>
          <p className="text-[11px] text-aventurea-ink-soft">{velocidad}</p>
        </div>

        {/* Costo */}
        <div className="flex flex-col items-end justify-between sm:col-span-1">
          <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Costo estimado</p>
          <p className="mt-1 text-[24px] font-black text-aventurea-orange">
            {costo.costo_formateado}
          </p>
          <p className="text-[11px] text-aventurea-ink-soft">USD</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-aventurea-ink-soft">
        💡 Costo estimado en dólares (el output real puede variar según cuánto
        HTML genere el modelo). El costo final se registra al terminar.
      </p>
    </div>
  );
}
