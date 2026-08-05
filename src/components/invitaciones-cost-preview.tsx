"use client";

import { useState, useEffect, useRef } from "react";
import {
  MODELOS,
  TIPO_CAMBIO_POR_DEFECTO,
  calcularCosto,
  formatearAmbas,
  normalizarModelo,
} from "@/lib/ia/modelos";

interface CostPreviewProps {
  prompt: string;
  modelo: "opus" | "fable";
  onCostoCalculado?: (costo: number) => void;
  disabled?: boolean;
  /**
   * Tipo de cambio que ya conoce el padre (el bot lo recibe del servidor
   * en cada respuesta del chat). Es opcional porque la ruta de preview
   * todavía no devuelve el suyo; mientras tanto se cae al de respaldo.
   */
  tipoCambio?: number;
}

interface CostResult {
  success: boolean;
  input_tokens?: number;
  output_tokens?: number;
  costo_usd?: number;
  costo_formateado?: string;
  /** Si algún día la ruta lo manda, manda él: es el que se va a registrar. */
  tipo_cambio?: number;
  error?: string;
}

/**
 * Cuánto HTML escribe el modelo según lo cargada que salga la invitación.
 * El piso es una invitación sobria (texto, un par de transiciones) y el
 * techo es el tope real del generador (max_tokens = 16.384 en
 * generador-invitaciones.ts): más que eso la respuesta se corta.
 *
 * Un número único acá se leía como precio cerrado y mentía por 3x cuando
 * el brief pedía animaciones; por eso se muestra el rango completo.
 */
const SALIDA_SENCILLA = 3_000;
const SALIDA_RECARGADA = 16_384;

export default function CostPreview({
  prompt,
  modelo,
  onCostoCalculado,
  disabled = false,
  tipoCambio,
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
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-aventurea-sky border-t-transparent" />
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

  // El id real del catálogo: el bot todavía habla en etiquetas cortas.
  const idModelo = normalizarModelo(modelo);
  const info = MODELOS[idModelo];
  const velocidad = idModelo === "claude-opus-5" ? "~1-3 min" : "~2-5 min";

  /**
   * El tipo de cambio nunca se inventa en el cliente: manda el que venga
   * del servidor, después el que el padre ya tenga de su propia respuesta,
   * y solo si no hay ninguno se usa el de respaldo del catálogo.
   */
  const cambio =
    costo.tipo_cambio && costo.tipo_cambio > 0
      ? costo.tipo_cambio
      : tipoCambio && tipoCambio > 0
        ? tipoCambio
        : TIPO_CAMBIO_POR_DEFECTO;

  // La entrada ya está contada de verdad; lo único incierto es la salida.
  const tokensEntrada = costo.input_tokens ?? 0;
  const costoMinimo = calcularCosto(idModelo, tokensEntrada, SALIDA_SENCILLA);
  const costoMaximo = calcularCosto(idModelo, tokensEntrada, SALIDA_RECARGADA);

  return (
    <div className="rounded-2xl border border-aventurea-sky/30 bg-aventurea-sky/5 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Tokens de entrada: contados por la API, no estimados */}
        <div>
          <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">
            Tokens de entrada
          </p>
          <p className="mt-1 text-[16px] font-bold text-aventurea-ink">
            {tokensEntrada.toLocaleString("es-CR")}
          </p>
          <p className="text-[11px] text-aventurea-ink-soft">Ya contados</p>
        </div>

        {/* Modelo */}
        <div>
          <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Modelo</p>
          <p className="mt-1 text-[13px] font-bold text-aventurea-ink">{info.nombre}</p>
          <p className="text-[11px] text-aventurea-ink-soft">{velocidad}</p>
        </div>

        {/* Costo: un rango, no un precio cerrado */}
        <div className="sm:text-right">
          <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">
            Costo estimado
          </p>
          <p className="mt-1 whitespace-nowrap text-[15px] font-black text-aventurea-orange">
            {formatearAmbas(costoMinimo, cambio)}
          </p>
          <p className="text-[11px] font-bold text-aventurea-ink-soft">a</p>
          <p className="whitespace-nowrap text-[15px] font-black text-aventurea-orange">
            {formatearAmbas(costoMaximo, cambio)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-aventurea-ink-soft">
        💡 El piso es una invitación sencilla ({SALIDA_SENCILLA.toLocaleString("es-CR")} tokens
        de HTML) y el techo es una recargada de animaciones y efectos, que es lo máximo que
        el generador puede escribir de una vez ({SALIDA_RECARGADA.toLocaleString("es-CR")}{" "}
        tokens). Lo que mueve el precio dentro del rango es cuánto HTML termine escribiendo
        el modelo. El costo final se registra al terminar.
      </p>
    </div>
  );
}
