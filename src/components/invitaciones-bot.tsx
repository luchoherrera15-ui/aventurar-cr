"use client";

import { useEffect, useRef, useState } from "react";
import UploadZone from "@/components/invitaciones-upload-zone";
import CostPreview from "@/components/invitaciones-cost-preview";
import { InvitacionConfig } from "@/lib/tipos/invitaciones";

/**
 * El asistente conversacional del creador de invitaciones: en vez de
 * un formulario, un "bot" que pregunta paso a paso y ofrece ayudas
 * tocables (temáticas, animaciones, efectos...). Al final muestra el
 * costo y dispara la generación vía onGenerar.
 */

export interface DatosGeneracion {
  prompt: string;
  modelo: "opus" | "fable";
  config: InvitacionConfig;
  imagenes: string[];
  videos: string[];
}

interface BotProps {
  onGenerar: (datos: DatosGeneracion) => void;
  pendiente?: boolean;
}

type Paso =
  | "evento"
  | "tematica"
  | "elementos"
  | "animaciones"
  | "efectos"
  | "mensaje"
  | "media"
  | "modelo"
  | "resumen";

interface Mensaje {
  id: number;
  de: "bot" | "usuario";
  texto: string;
}

const TEMATICAS = [
  "Boda clásica",
  "Cumpleaños infantil",
  "Cumpleaños adulto",
  "Quince años",
  "Baby shower",
  "Aniversario",
  "Graduación",
  "Evento corporativo",
  "Fiesta temática",
];

const ELEMENTOS_SUGERIDOS = [
  "Globos flotantes",
  "Confeti",
  "Flores",
  "Corazones",
  "Estrellas",
  "Luces brillantes",
  "Marcos dorados",
  "Fotos en polaroid",
];

const ANIMACIONES = [
  "Entrada de texto suave",
  "Confeti cayendo",
  "Globos flotantes",
  "Brillos y destellos",
  "Transiciones suaves",
  "Cuenta regresiva animada",
];

const EFECTOS = [
  "Fondo degradado",
  "Partículas flotantes",
  "Neón/Glow",
  "Vintage/Sepia",
  "Minimalista",
  "Sombras profundas",
];

interface Variante {
  numero: number;
  titulo: string;
  prompt: string;
}

export default function InvitacionesBot({ onGenerar, pendiente = false }: BotProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: 0,
      de: "bot",
      texto:
        "¡Hola! Soy tu asistente de invitaciones ✨ Contame: ¿para quién o para qué evento es la invitación? (ej. \"el cumpleaños de Sofía, 15 de agosto en el salón Las Flores\")",
    },
  ]);
  const [paso, setPaso] = useState<Paso>("evento");

  // Lo que el usuario va respondiendo
  const [evento, setEvento] = useState("");
  const [tematica, setTematica] = useState("");
  const [elementos, setElementos] = useState<string[]>([]);
  const [animaciones, setAnimaciones] = useState<string[]>([]);
  const [efectos, setEfectos] = useState<string[]>([]);
  const [mensajeEvento, setMensajeEvento] = useState("");
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [modelo, setModelo] = useState<"opus" | "fable">("opus");

  // Controles del paso actual
  const [textoInput, setTextoInput] = useState("");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [costoEstimado, setCostoEstimado] = useState(0);

  // Refinar con IA
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [promptElegido, setPromptElegido] = useState<string | null>(null);
  const [refinando, setRefinando] = useState(false);
  const [errorBot, setErrorBot] = useState("");

  const finRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes.length, paso, variantes.length]);

  function decir(de: "bot" | "usuario", texto: string) {
    setMensajes((prev) => [...prev, { id: idRef.current++, de, texto }]);
  }

  function avanzar(respuestaUsuario: string, siguiente: Paso, preguntaBot: string) {
    decir("usuario", respuestaUsuario);
    decir("bot", preguntaBot);
    setPaso(siguiente);
    setSeleccion([]);
    setTextoInput("");
  }

  // ---------- Pasos de texto libre ----------

  function responderEvento() {
    const v = textoInput.trim();
    if (!v) return;
    setEvento(v);
    avanzar(v, "tematica", "¡Qué lindo! 🎉 ¿Qué temática te gustaría? Elegí una o escribí la tuya:");
  }

  function responderMensaje(omitir: boolean) {
    const v = omitir ? "" : textoInput.trim();
    setMensajeEvento(v);
    avanzar(
      omitir ? "Sin mensaje especial" : `"${v}"`,
      "media",
      "¿Querés que la invitación lleve fotos o videos tuyos? 📸"
    );
  }

  // ---------- Pasos de selección ----------

  function elegirTematica(t: string) {
    setTematica(t);
    avanzar(
      t,
      "elementos",
      "Perfecto. ¿Qué elementos visuales querés que aparezcan? Tocá los que te gusten y dale a Continuar:"
    );
  }

  function confirmarMultiple(
    guardar: (v: string[]) => void,
    etiquetaVacia: string,
    siguiente: Paso,
    preguntaBot: string
  ) {
    guardar(seleccion);
    avanzar(seleccion.length > 0 ? seleccion.join(", ") : etiquetaVacia, siguiente, preguntaBot);
  }

  function toggleSeleccion(v: string) {
    setSeleccion((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  function responderMedia(quiere: boolean) {
    if (quiere) {
      setMostrarUpload(true);
      decir("usuario", "Sí, quiero subir fotos/videos");
      decir("bot", "¡Dale! Subilas acá y tocá Listo cuando termines:");
    } else {
      setMostrarUpload(false);
      avanzar("No, sin fotos", "modelo", preguntaModelo());
    }
  }

  function confirmarMedia() {
    setMostrarUpload(false);
    avanzar(
      `${imagenes.length} foto${imagenes.length === 1 ? "" : "s"} y ${videos.length} video${videos.length === 1 ? "" : "s"}`,
      "modelo",
      preguntaModelo()
    );
  }

  function preguntaModelo() {
    return "Última decisión: ¿con qué modelo de IA la genero? 🤖";
  }

  function elegirModelo(m: "opus" | "fable") {
    setModelo(m);
    avanzar(
      m === "opus" ? "Opus (Equilibrado)" : "Fable (Premium)",
      "resumen",
      "¡Listo! Este es el costo estimado de tu invitación. Podés generarla ya, o pedirme que mejore la descripción con IA para tener más opciones ✨"
    );
  }

  // ---------- El prompt final ----------

  function construirPrompt(): string {
    let p = `Genera una invitación digital HTML interactiva para:

EVENTO: ${evento}
TEMÁTICA: ${tematica}`;
    if (mensajeEvento) p += `\nMENSAJE: ${mensajeEvento}`;
    if (elementos.length > 0) p += `\nELEMENTOS VISUALES: ${elementos.join(", ")}`;
    if (animaciones.length > 0) p += `\nANIMACIONES: ${animaciones.join(", ")}`;
    if (efectos.length > 0) p += `\nEFECTOS: ${efectos.join(", ")}`;
    p += `

Genera HTML + CSS completamente embebido (sin <script>: las animaciones
van con CSS y la interactividad con atributos inline).
La invitación debe ser:
- Responsive (funciona en móvil y desktop)
- Profesional y elegante
- Animaciones suaves que no distraigan
- Sin botón de confirmar asistencia (la plataforma agrega el suyo)

Retorna SOLO el HTML válido, sin explicaciones ni markdown.`;
    return p;
  }

  const promptFinal = promptElegido ?? (paso === "resumen" ? construirPrompt() : "");

  async function refinarConIA() {
    setRefinando(true);
    setErrorBot("");
    try {
      const descripcion = `${evento}. Temática: ${tematica}. Elementos: ${
        elementos.join(", ") || "los que mejor calcen"
      }. Animaciones: ${animaciones.join(", ") || "suaves"}. Efectos: ${
        efectos.join(", ") || "elegantes"
      }. ${mensajeEvento ? `Mensaje: ${mensajeEvento}` : ""}`;
      const res = await fetch("/api/invitaciones/refinar-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ descripcion, numero_variantes: 3 }),
      });
      const data = await res.json();
      if (!res.ok || !data.variantes) {
        setErrorBot(data.error || "No pude generar variantes, intentá de nuevo");
      } else {
        setVariantes(data.variantes);
        decir("bot", "Te preparé estas versiones mejoradas — tocá la que más te guste 👇");
      }
    } catch {
      setErrorBot("No pude generar variantes, intentá de nuevo");
    }
    setRefinando(false);
  }

  function generar() {
    onGenerar({
      prompt: promptFinal,
      modelo,
      config: {
        tematica,
        personajes: elementos,
        animaciones,
        efectos,
        titulo: evento.slice(0, 120),
        mensaje: mensajeEvento,
      },
      imagenes,
      videos,
    });
  }

  const inputTexto = paso === "evento" || paso === "mensaje";

  return (
    <div className="rounded-2xl border border-aventurea-line bg-white overflow-hidden">
      <div className="border-b border-aventurea-line bg-aventurea-navy px-5 py-3.5">
        <p className="text-[14px] font-bold text-white">🤖 Asistente de invitaciones</p>
        <p className="text-[11.5px] text-white/70">
          Te guío paso a paso — vos solo contame qué querés
        </p>
      </div>

      {/* La conversación */}
      <div className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.de === "usuario" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                m.de === "usuario"
                  ? "rounded-br-md bg-aventurea-navy text-white"
                  : "rounded-bl-md bg-aventurea-cream-2 text-aventurea-ink"
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      {/* Controles del paso actual */}
      <div className="border-t border-aventurea-line bg-aventurea-cream-2/60 px-5 py-4">
        {inputTexto && (
          <div className="flex gap-2">
            <input
              type="text"
              value={textoInput}
              onChange={(e) => setTextoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (paso === "evento") responderEvento();
                  else responderMensaje(false);
                }
              }}
              placeholder={
                paso === "evento"
                  ? 'Ej: "el cumpleaños de Sofía, 15 de agosto"'
                  : 'Ej: "Nos hace mucha ilusión celebrar con vos..."'
              }
              aria-label="Tu respuesta para el asistente"
              className="h-11 flex-1 rounded-xl border border-aventurea-line bg-white px-4 text-[13.5px] text-aventurea-ink placeholder:text-aventurea-ink-soft/60 focus:border-aventurea-navy focus:outline-none"
            />
            <button
              type="button"
              onClick={() => (paso === "evento" ? responderEvento() : responderMensaje(false))}
              disabled={!textoInput.trim()}
              className="rounded-xl bg-aventurea-navy px-5 font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-40"
            >
              Enviar
            </button>
            {paso === "mensaje" && (
              <button
                type="button"
                onClick={() => responderMensaje(true)}
                className="rounded-xl border border-aventurea-line bg-white px-4 text-[13px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy"
              >
                Omitir
              </button>
            )}
          </div>
        )}

        {paso === "tematica" && (
          <div>
            <div className="flex flex-wrap gap-2">
              {TEMATICAS.map((t) => (
                <ChipBot key={t} onClick={() => elegirTematica(t)} label={t} />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={textoInput}
                onChange={(e) => setTextoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && textoInput.trim()) elegirTematica(textoInput.trim());
                }}
                placeholder="¿Otra? Escribila acá (ej. Harry Potter, safari...)"
                aria-label="Otra temática"
                className="h-10 flex-1 rounded-xl border border-aventurea-line bg-white px-4 text-[13px] text-aventurea-ink placeholder:text-aventurea-ink-soft/60 focus:border-aventurea-navy focus:outline-none"
              />
              <button
                type="button"
                onClick={() => textoInput.trim() && elegirTematica(textoInput.trim())}
                disabled={!textoInput.trim()}
                className="rounded-xl bg-aventurea-navy px-4 text-[13px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-40"
              >
                Usar
              </button>
            </div>
          </div>
        )}

        {(paso === "elementos" || paso === "animaciones" || paso === "efectos") && (
          <div>
            <div className="flex flex-wrap gap-2">
              {(paso === "elementos"
                ? ELEMENTOS_SUGERIDOS
                : paso === "animaciones"
                  ? ANIMACIONES
                  : EFECTOS
              ).map((v) => (
                <ChipBot
                  key={v}
                  onClick={() => toggleSeleccion(v)}
                  label={v}
                  activo={seleccion.includes(v)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (paso === "elementos") {
                  confirmarMultiple(
                    setElementos,
                    "Sin elementos extra",
                    "animaciones",
                    "¿Y querés estas animaciones? ✨ Marcá las que te llamen:"
                  );
                } else if (paso === "animaciones") {
                  confirmarMultiple(
                    setAnimaciones,
                    "Sin animaciones",
                    "efectos",
                    "¿Algún efecto visual para darle más ambiente? 🎨"
                  );
                } else {
                  confirmarMultiple(
                    setEfectos,
                    "Sin efectos",
                    "mensaje",
                    "¿Querés incluir un mensaje especial para tus invitados? (o tocá Omitir)"
                  );
                }
              }}
              className="mt-3 w-full rounded-xl bg-aventurea-navy py-2.5 font-bold text-white hover:bg-aventurea-navy-2"
            >
              Continuar{seleccion.length > 0 ? ` (${seleccion.length})` : " sin elegir"}
            </button>
          </div>
        )}

        {paso === "media" && !mostrarUpload && (
          <div className="flex flex-wrap gap-2">
            <ChipBot onClick={() => responderMedia(true)} label="📸 Sí, subir fotos/videos" />
            <ChipBot onClick={() => responderMedia(false)} label="No, así está bien" />
          </div>
        )}

        {paso === "media" && mostrarUpload && (
          <div>
            <UploadZone
              imagenes={imagenes}
              videos={videos}
              onImagenesChange={setImagenes}
              onVideosChange={setVideos}
            />
            <button
              type="button"
              onClick={confirmarMedia}
              className="mt-3 w-full rounded-xl bg-aventurea-navy py-2.5 font-bold text-white hover:bg-aventurea-navy-2"
            >
              Listo con las fotos
            </button>
          </div>
        )}

        {paso === "modelo" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                id: "opus" as const,
                nombre: "Opus (Equilibrado)",
                desc: "Excelente calidad a mejor precio. ~$0.05-0.15",
              },
              {
                id: "fable" as const,
                nombre: "Fable (Premium)",
                desc: "Nuestro modelo más capaz — máximo detalle. ~$0.15-0.50",
              },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => elegirModelo(m.id)}
                className="rounded-xl border-2 border-aventurea-line bg-white p-4 text-left transition-all hover:border-aventurea-navy"
              >
                <p className="font-bold text-aventurea-ink">{m.nombre}</p>
                <p className="mt-1 text-[12px] text-aventurea-ink-soft">{m.desc}</p>
              </button>
            ))}
          </div>
        )}

        {paso === "resumen" && (
          <div className="space-y-3">
            {variantes.length > 0 && (
              <div className="grid gap-2">
                {variantes.map((v) => (
                  <button
                    key={v.numero}
                    type="button"
                    onClick={() => setPromptElegido(v.prompt)}
                    className={`rounded-xl border-2 p-3.5 text-left transition-all ${
                      promptElegido === v.prompt
                        ? "border-aventurea-navy bg-aventurea-navy/5"
                        : "border-aventurea-line bg-white hover:border-aventurea-navy/50"
                    }`}
                  >
                    <p className="text-[13px] font-bold text-aventurea-ink">{v.titulo}</p>
                    <p className="mt-1 line-clamp-2 text-[11.5px] text-aventurea-ink-soft">
                      {v.prompt}
                    </p>
                  </button>
                ))}
                {promptElegido && (
                  <button
                    type="button"
                    onClick={() => setPromptElegido(null)}
                    className="text-left text-[12px] font-bold text-aventurea-navy hover:underline"
                  >
                    ← Volver a mi versión original
                  </button>
                )}
              </div>
            )}

            <CostPreview
              prompt={promptFinal}
              modelo={modelo}
              onCostoCalculado={setCostoEstimado}
              disabled={pendiente}
            />

            {errorBot && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[12.5px] font-semibold text-red-700">
                {errorBot}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generar}
                disabled={pendiente || costoEstimado === 0}
                className="flex-1 rounded-xl bg-aventurea-orange px-6 py-3 font-bold text-white hover:bg-aventurea-orange-2 disabled:opacity-50"
              >
                {pendiente ? "Generando tu invitación..." : "🎨 Generar invitación"}
              </button>
              {variantes.length === 0 && (
                <button
                  type="button"
                  onClick={refinarConIA}
                  disabled={refinando || pendiente}
                  className="rounded-xl border border-aventurea-navy px-5 py-3 font-bold text-aventurea-navy hover:bg-aventurea-navy/5 disabled:opacity-50"
                >
                  {refinando ? "Pensando..." : "✨ Mejorar con IA"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChipBot({
  label,
  onClick,
  activo = false,
}: {
  label: string;
  onClick: () => void;
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
      }`}
    >
      {label}
    </button>
  );
}
