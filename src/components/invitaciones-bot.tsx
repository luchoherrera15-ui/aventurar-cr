"use client";

import { useEffect, useRef, useState } from "react";
import UploadZone from "@/components/invitaciones-upload-zone";
import CostPreview from "@/components/invitaciones-cost-preview";
import {
  formatearAmbas,
  MODELOS,
  preciosVigentes,
  TIPO_CAMBIO_POR_DEFECTO,
  type ModeloIA,
} from "@/lib/ia/modelos";
import { InvitacionConfig } from "@/lib/tipos/invitaciones";

/**
 * El asistente conversacional del creador de invitaciones: un chat
 * libre con el "diseñador" (Claude vía /api/invitaciones/chat). El
 * cliente se expresa en sus palabras, el diseñador sugiere y pregunta,
 * y cuando el cliente confirma llega el brief final (prompt_final):
 * ahí aparece la tarjeta con modelo + costo + Generar.
 */

export interface DatosGeneracion {
  prompt: string;
  modelo: "opus" | "fable";
  config: InvitacionConfig;
  imagenes: string[];
  videos: string[];
  audios: string[];
}

interface BotProps {
  onGenerar: (datos: DatosGeneracion) => void;
  pendiente?: boolean;
}

interface Mensaje {
  id: number;
  de: "bot" | "usuario";
  texto: string;
}

const SALUDO =
  "¡Hola! Soy el diseñador de invitaciones de Bookea. Contame con tus palabras qué invitación necesitás: la ocasión, para quién es, el estilo que te imaginás, colores, lo que sea. Yo te voy proponiendo ideas y cuando estés conforme te muestro el costo y la generamos.";

/**
 * Los únicos dos modelos que el generador acepta: "opus" y "fable" son
 * los alias que validan /api/invitaciones/preview-token-count y
 * /api/invitaciones/generar-con-ia. Cada uno se mapea a su modelo del
 * catálogo para que el nombre y el precio salgan de MODELOS: escritos a
 * mano quedaban viejos apenas cambiaba una tarifa.
 */
const MODELOS_GENERADOR: {
  id: DatosGeneracion["modelo"];
  modelo: ModeloIA;
  rol: string;
}[] = [
  { id: "opus", modelo: "claude-opus-5", rol: "Equilibrado" },
  { id: "fable", modelo: "claude-fable-5", rol: "Premium" },
];

export default function InvitacionesBot({ onGenerar, pendiente = false }: BotProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { id: 0, de: "bot", texto: SALUDO },
  ]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorBot, setErrorBot] = useState("");
  // Lo gastado en la conversación (cada mensaje cuesta tokens reales).
  const [gastoChat, setGastoChat] = useState(0);
  // El tipo de cambio lo manda el servidor con cada respuesta: es el
  // mismo que se guardó en el registro de gasto, así que la pantalla y
  // el panel de consumo cuentan siempre los mismos colones.
  const [tipoCambio, setTipoCambio] = useState(TIPO_CAMBIO_POR_DEFECTO);

  const [imagenes, setImagenes] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [audios, setAudios] = useState<string[]>([]);
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const adjuntos = imagenes.length + videos.length + audios.length;

  const [promptFinal, setPromptFinal] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("Invitación");
  // El tipo sale de DatosGeneracion: si mañana cambia lo que acepta el
  // generador, el selector deja de compilar en vez de ofrecer de más.
  const [modelo, setModelo] = useState<DatosGeneracion["modelo"]>("opus");
  // El costo lo pinta CostPreview; acá solo interesa para el registro
  // del gasto acumulado, no para bloquear el botón de generar.
  const [, setCostoEstimado] = useState(0);

  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes.length, promptFinal, enviando]);

  function agregarMensaje(de: "bot" | "usuario", texto: string): Mensaje {
    const m = { id: idRef.current++, de, texto };
    setMensajes((prev) => [...prev, m]);
    return m;
  }

  async function enviar(forzarBrief = false) {
    const texto = forzarBrief
      ? "Listo — generá mi invitación con todo lo que conversamos."
      : input.trim();
    if (!texto || enviando) return;

    setErrorBot("");
    if (!forzarBrief) setInput("");
    // La conversación siguió: el brief anterior ya no representa lo
    // que se está hablando, así que la tarjeta se retira.
    setPromptFinal(null);
    setCostoEstimado(0);
    agregarMensaje("usuario", texto);
    setEnviando(true);

    try {
      // El saludo local (id 0) no viaja: el historial que recibe el
      // API arranca con el primer mensaje del usuario.
      const historial = [...mensajes, { id: -1, de: "usuario" as const, texto }]
        .filter((m) => m.id !== 0)
        .map((m) => ({
          rol: m.de === "usuario" ? "usuario" : "asistente",
          texto: m.texto,
        }));

      const res = await fetch("/api/invitaciones/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mensajes: historial,
          imagenes_count: imagenes.length,
          videos_count: videos.length,
          audios_count: audios.length,
          forzar_brief: forzarBrief,
        }),
      });
      const data = await res.json();

      // El gasto se suma pase lo que pase: una respuesta cortada o
      // vacía se cobró igual, y esconderla haría que el total mienta.
      if (typeof data.costo_usd === "number") {
        setGastoChat((g) => g + data.costo_usd);
      }
      if (typeof data.tipo_cambio === "number" && data.tipo_cambio > 0) {
        setTipoCambio(data.tipo_cambio);
      }

      if (!res.ok || !data.success) {
        setErrorBot(data.error || "El asistente tuvo un problema; intentá de nuevo");
        // Mantener la alternancia usuario/asistente para el próximo envío.
        agregarMensaje("bot", "Perdoná, tuve un problema — ¿me lo repetís?");
      } else {
        if (data.respuesta) agregarMensaje("bot", data.respuesta);
        if (data.prompt_final) {
          setPromptFinal(data.prompt_final);
          setTitulo(data.titulo || "Invitación");
        }
        // Ni texto ni brief: la llamada se pagó y no pasó nada visible.
        if (!data.respuesta && !data.prompt_final) {
          setErrorBot("El asistente no devolvió nada; probá de nuevo.");
        }
      }
    } catch {
      setErrorBot("No pude contactar al asistente; revisá tu conexión");
      agregarMensaje("bot", "Perdoná, tuve un problema — ¿me lo repetís?");
    }
    setEnviando(false);
    inputRef.current?.focus();
  }

  function seguirAjustando() {
    setPromptFinal(null);
    setCostoEstimado(0);
    setTitulo("Invitación");
    inputRef.current?.focus();
  }

  function generar() {
    if (!promptFinal) return;
    onGenerar({
      prompt: promptFinal,
      modelo,
      config: {
        tematica: "",
        personajes: [],
        animaciones: [],
        efectos: [],
        titulo,
        mensaje: "",
      },
      imagenes,
      videos,
      audios,
    });
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-aventurea-line bg-aventurea-navy px-5 py-3.5">
        <div>
          <p className="text-[14px] font-bold text-white">Asistente de invitaciones</p>
          <p className="text-[11.5px] text-white/70">
            Contale exactamente qué necesitás — él diseña con vos
          </p>
        </div>
        {/* Lo gastado conversando, siempre a la vista. */}
        <div className="shrink-0 rounded-xl bg-white/10 px-3.5 py-1.5 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">
            Gastado en chat
          </p>
          <p className="whitespace-nowrap text-[13px] font-black text-white">
            {formatearAmbas(gastoChat, tipoCambio)}
          </p>
        </div>
      </div>

      {/* La conversación */}
      <div className="max-h-[460px] space-y-3 overflow-y-auto px-5 py-4">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.de === "usuario" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                m.de === "usuario"
                  ? "rounded-br-md bg-aventurea-navy text-white"
                  : "rounded-bl-md bg-aventurea-cream-2 text-aventurea-ink"
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}

        {enviando && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-aventurea-cream-2 px-4 py-3">
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-aventurea-ink-soft"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {/* La tarjeta final: modelo + costo + generar */}
        {promptFinal && (
          <div className="rounded-2xl border-2 border-aventurea-navy/20 bg-aventurea-cream-2/60 p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-aventurea-orange">
              Resumen de tu invitación
            </p>
            <p className="mt-1 text-[13px] font-bold text-aventurea-ink">{titulo}</p>
            <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-aventurea-ink-soft">
              {promptFinal}
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {MODELOS_GENERADOR.map((opcion) => {
                const info = MODELOS[opcion.modelo];
                const precio = preciosVigentes(opcion.modelo);
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setModelo(opcion.id)}
                    disabled={pendiente}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      modelo === opcion.id
                        ? "border-aventurea-navy bg-white"
                        : "border-aventurea-line bg-white/60 hover:border-aventurea-navy/50"
                    }`}
                  >
                    <p className="text-[13px] font-bold text-aventurea-ink">
                      {info.nombre} ({opcion.rol})
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
                      {info.paraQue}
                    </p>
                    {/* El precio de la tarifa, que es un dato verdadero:
                        el rango por invitación que había acá se inventaba
                        y encima quedaba corto (el generador permite 16.384
                        tokens de salida, y 8.000 en Opus ya son $0.20). Lo
                        que cuesta ESTA invitación lo estima CostPreview
                        acá abajo con los tokens reales del brief. */}
                    <p className="mt-1.5 text-[11px] leading-relaxed text-aventurea-ink-soft">
                      Entrada {formatearAmbas(precio.entradaUSD, tipoCambio)} · salida{" "}
                      {formatearAmbas(precio.salidaUSD, tipoCambio)} por millón de tokens
                      {precio.enPromo ? " (precio de lanzamiento)" : ""}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <CostPreview
                prompt={promptFinal}
                modelo={modelo}
                onCostoCalculado={setCostoEstimado}
                disabled={pendiente}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generar}
                disabled={pendiente}
                className="flex-1 rounded-xl bg-aventurea-orange px-6 py-3 font-bold text-white hover:bg-aventurea-orange-2 disabled:opacity-50"
              >
                {pendiente ? "Generando tu invitación..." : "Generar invitación"}
              </button>
              <button
                type="button"
                onClick={seguirAjustando}
                disabled={pendiente}
                className="rounded-xl border border-aventurea-line bg-white px-5 py-3 font-bold text-aventurea-ink hover:border-aventurea-navy disabled:opacity-50"
              >
                Seguir ajustando
              </button>
            </div>
          </div>
        )}

        <div ref={finRef} />
      </div>

      {/* Adjuntos + entrada */}
      <div className="border-t border-aventurea-line bg-aventurea-cream-2/60 px-5 py-4">
        {/* El botón de cierre: cuando ya hay acuerdo, el cliente genera
            sin esperar a que el asistente decida — el brief se arma con
            todo lo conversado y aparece la tarjeta de costo. */}
        {mensajes.some((m) => m.de === "bot" && m.id !== 0) && !promptFinal && (
          <button
            type="button"
            onClick={() => enviar(true)}
            disabled={enviando || pendiente}
            className="mb-3 w-full rounded-xl border-2 border-aventurea-orange bg-aventurea-orange/10 py-2.5 text-[13.5px] font-bold text-aventurea-orange transition-colors hover:bg-aventurea-orange/20 disabled:opacity-50"
          >
            Ya llegamos a un acuerdo — preparar mi invitación
          </button>
        )}

        {mostrarUpload && (
          <div className="mb-3">
            <UploadZone
              imagenes={imagenes}
              videos={videos}
              audios={audios}
              onImagenesChange={setImagenes}
              onVideosChange={setVideos}
              onAudiosChange={setAudios}
              disabled={pendiente}
            />
          </div>
        )}

        {errorBot && (
          <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[12.5px] font-semibold text-red-700">
            {errorBot}
          </p>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setMostrarUpload((v) => !v)}
            disabled={pendiente}
            title="Adjuntar fotos, videos o música"
            aria-label="Adjuntar fotos, videos o música"
            className={`h-11 shrink-0 rounded-xl border px-3.5 text-[13px] font-bold transition-colors disabled:opacity-50 ${
              mostrarUpload || adjuntos > 0
                ? "border-aventurea-navy bg-aventurea-navy text-white"
                : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
            }`}
          >
            Archivos{adjuntos > 0 ? ` (${adjuntos})` : ""}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            placeholder='Ej: "Quiero una invitación de safari para el cumple de Mateo, que los animales se muevan..."'
            aria-label="Escribile al asistente"
            disabled={pendiente}
            className="max-h-32 min-h-[44px] flex-1 resize-y rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-aventurea-ink-soft/60 focus:border-aventurea-navy focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => enviar()}
            disabled={!input.trim() || enviando || pendiente}
            className="h-11 shrink-0 rounded-xl bg-aventurea-navy px-5 font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
