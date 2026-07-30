"use client";

import { useState, useTransition } from "react";

interface Config {
  tematica: string;
  personajes: string[];
  animaciones: string[];
  efectos: string[];
  titulo?: string;
  mensaje?: string;
}

interface PromptBuilderProps {
  config: Config;
  onConfigChange: (config: Config) => void;
  onGenerarPrompt?: (prompt: string) => void;
  disabled?: boolean;
}

const TEMATICAS = [
  "Boda clásica",
  "Cumpleaños infantil",
  "Cumpleaños adulto",
  "Evento corporativo",
  "Baby shower",
  "Aniversario",
  "Graduación",
  "Fiesta temática",
  "Otro",
];

const PERSONAJES_SUGERIDOS = [
  "Novia y novio",
  "Globos flotantes",
  "Confeti",
  "Flores",
  "Fotógrafos",
  "Corazones",
  "Estrellas",
  "Niños jugando",
];

const ANIMACIONES = [
  "Entrada de texto suave",
  "Aparición de elementos",
  "Confeti cayendo",
  "Globos flotantes",
  "Transiciones suaves",
  "Parallax al scroll",
  "Hover interactivo",
  "Ninguna",
];

const EFECTOS = [
  "Fondo degradado",
  "Particulas flotantes",
  "Blur dinámico",
  "Sombras profundas",
  "Neón/Glow",
  "Vintage/Sepia",
  "Minimalista",
  "Sin efectos",
];

export default function PromptBuilder({
  config,
  onConfigChange,
  onGenerarPrompt,
  disabled = false,
}: PromptBuilderProps) {
  const [expandido, setExpandido] = useState(true);
  const [pendiente, startTransition] = useTransition();

  function agregarPersonaje(p: string) {
    if (!config.personajes.includes(p)) {
      onConfigChange({
        ...config,
        personajes: [...config.personajes, p],
      });
    }
  }

  function removerPersonaje(p: string) {
    onConfigChange({
      ...config,
      personajes: config.personajes.filter((x) => x !== p),
    });
  }

  function toggleAnimacion(a: string) {
    onConfigChange({
      ...config,
      animaciones: config.animaciones.includes(a)
        ? config.animaciones.filter((x) => x !== a)
        : [...config.animaciones, a],
    });
  }

  function toggleEfecto(e: string) {
    onConfigChange({
      ...config,
      efectos: config.efectos.includes(e)
        ? config.efectos.filter((x) => x !== e)
        : [...config.efectos, e],
    });
  }

  function construirPrompt(): string {
    let prompt = `Genera una invitación digital HTML interactiva para:

TÍTULO: ${config.titulo || "Evento especial"}
TEMÁTICA: ${config.tematica || "Clásica"}
MENSAJE: ${config.mensaje || "Una invitación memorable"}
`;

    if (config.personajes.length > 0) {
      prompt += `\nELEMENTOS VISUALES: ${config.personajes.join(", ")}`;
    }

    if (config.animaciones.length > 0) {
      prompt += `\nANIMACIONES: ${config.animaciones.join(", ")}`;
    }

    if (config.efectos.length > 0) {
      prompt += `\nEFECTOS: ${config.efectos.join(", ")}`;
    }

    prompt += `

Genera HTML + CSS completamente embebido (sin <script>: las animaciones
van con CSS y la interactividad con atributos inline).
La invitación debe ser:
- Responsive (funciona en móvil y desktop)
- Profesional y elegante
- Animaciones suaves que no distraigan
- Sin botón de confirmar asistencia (la plataforma agrega el suyo)

Retorna SOLO el HTML válido, sin explicaciones ni markdown.`;

    return prompt;
  }

  function handleGenerarPrompt() {
    const prompt = construirPrompt();
    startTransition(() => {
      onGenerarPrompt?.(prompt);
    });
  }

  return (
    <details
      open={expandido}
      onToggle={() => setExpandido(!expandido)}
      className="group rounded-2xl border border-aventurea-line bg-white"
    >
      <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-bold text-aventurea-ink hover:bg-aventurea-cream-2">
        <span>⚙️ Configuración de invitación</span>
        <span className="transition-transform group-open:rotate-180">▼</span>
      </summary>

      <div className="border-t border-aventurea-line px-5 py-4">
        <div className="space-y-5">
          {/* Título */}
          <div>
            <label className="block text-[13px] font-bold text-aventurea-ink mb-2">
              Título del evento
            </label>
            <input
              type="text"
              value={config.titulo || ""}
              onChange={(e) =>
                onConfigChange({ ...config, titulo: e.target.value })
              }
              placeholder="Ej: La boda de Sofia & Andrés"
              className="w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13px] text-aventurea-ink placeholder:text-aventurea-ink-soft/60 focus:border-aventurea-navy focus:outline-none"
              disabled={disabled}
            />
          </div>

          {/* Temática */}
          <div>
            <label className="block text-[13px] font-bold text-aventurea-ink mb-2">
              Temática
            </label>
            <select
              value={config.tematica}
              onChange={(e) =>
                onConfigChange({ ...config, tematica: e.target.value })
              }
              className="w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13px] text-aventurea-ink focus:border-aventurea-navy focus:outline-none"
              disabled={disabled}
            >
              <option value="">Elige una temática...</option>
              {TEMATICAS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Mensaje */}
          <div>
            <label className="block text-[13px] font-bold text-aventurea-ink mb-2">
              Mensaje de la invitación
            </label>
            <textarea
              value={config.mensaje || ""}
              onChange={(e) =>
                onConfigChange({ ...config, mensaje: e.target.value })
              }
              placeholder="Ej: Nos hace muchísima ilusión celebrar este día con vos..."
              rows={3}
              className="w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13px] text-aventurea-ink placeholder:text-aventurea-ink-soft/60 focus:border-aventurea-navy focus:outline-none resize-none"
              disabled={disabled}
            />
          </div>

          {/* Personajes/Elementos */}
          <div>
            <label className="block text-[13px] font-bold text-aventurea-ink mb-2">
              Elementos visuales ({config.personajes.length})
            </label>
            <div className="mb-2 flex flex-wrap gap-2">
              {config.personajes.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => removerPersonaje(p)}
                  className="rounded-full bg-aventurea-navy text-white text-[12px] px-3 py-1.5 font-semibold hover:bg-aventurea-navy-2"
                  disabled={disabled}
                >
                  {p} ✕
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PERSONAJES_SUGERIDOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => agregarPersonaje(p)}
                  disabled={config.personajes.includes(p) || disabled}
                  className="rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[12px] font-semibold text-aventurea-ink hover:border-aventurea-navy hover:bg-white disabled:opacity-50"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>

          {/* Animaciones */}
          <div>
            <label className="block text-[13px] font-bold text-aventurea-ink mb-2">
              Animaciones ({config.animaciones.length})
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ANIMACIONES.map((a) => (
                <label key={a} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.animaciones.includes(a)}
                    onChange={() => toggleAnimacion(a)}
                    disabled={disabled}
                    className="rounded border-aventurea-line"
                  />
                  <span className="text-[12px] text-aventurea-ink">{a}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Efectos */}
          <div>
            <label className="block text-[13px] font-bold text-aventurea-ink mb-2">
              Efectos visuales ({config.efectos.length})
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {EFECTOS.map((e) => (
                <label key={e} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.efectos.includes(e)}
                    onChange={() => toggleEfecto(e)}
                    disabled={disabled}
                    className="rounded border-aventurea-line"
                  />
                  <span className="text-[12px] text-aventurea-ink">{e}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Botón generar prompt */}
          <button
            type="button"
            onClick={handleGenerarPrompt}
            disabled={disabled || pendiente || !config.tematica}
            className="w-full rounded-xl bg-aventurea-navy px-4 py-3 text-center font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-50"
          >
            {pendiente ? "Preparando..." : "✨ Construir prompt"}
          </button>
        </div>
      </div>
    </details>
  );
}
