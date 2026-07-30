"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PromptBuilder from "@/components/invitaciones-prompt-builder";
import CostPreview from "@/components/invitaciones-cost-preview";
import UploadZone from "@/components/invitaciones-upload-zone";
import PreviewIframe from "@/components/invitaciones-preview-iframe";
import Historial from "@/components/invitaciones-historial";
import {
  crearInvitacionBorrador,
  generarConIA,
  listarInvitacionesDeUsuario,
  publicarInvitacion,
} from "@/app/cuenta/invitaciones-generador-actions";
import { InvitacionConfig, InvitacionHistorial } from "@/lib/tipos/invitaciones";

export default function ClientePage() {
  const router = useRouter();
  const [invitacionId, setInvitacionId] = useState<string | null>(null);
  const [slugInvitacion, setSlugInvitacion] = useState<string | null>(null);
  const [config, setConfig] = useState<InvitacionConfig>({
    tematica: "",
    personajes: [],
    animaciones: [],
    efectos: [],
    titulo: "Nueva invitación",
    mensaje: "",
  });
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [modelo, setModelo] = useState<"opus" | "fable">("opus");
  const [costoEstimado, setCostoEstimado] = useState(0);

  const [htmlGenerado, setHtmlGenerado] = useState("");
  const [errorGeneracion, setErrorGeneracion] = useState("");

  const [invitaciones, setInvitaciones] = useState<InvitacionHistorial[]>([]);
  const [pendienteCargar, setPendienteCargar] = useState(false);
  const [pendiente, startTransition] = useTransition();

  // Crear nueva invitación al montar
  async function crearNueva() {
    setPendienteCargar(true);
    const res = await crearInvitacionBorrador();
    if (res.data) {
      setInvitacionId(res.data.id);
      setSlugInvitacion(res.data.slug ?? null);
      setHtmlGenerado("");
      setErrorGeneracion("");
      setPrompt("");
      setCostoEstimado(0);
      setImagenes([]);
      setVideos([]);
    } else {
      setErrorGeneracion(res.error || "Error al crear invitación");
    }
    setPendienteCargar(false);
  }

  async function publicar() {
    if (!invitacionId) return;
    setErrorGeneracion("");
    const res = await publicarInvitacion(invitacionId);
    if (res.data) {
      router.push(`/i/${res.data.slug ?? slugInvitacion}`);
    } else {
      setErrorGeneracion(res.error || "No se pudo publicar la invitación");
    }
  }

  async function cargarHistorial() {
    setPendienteCargar(true);
    const res = await listarInvitacionesDeUsuario();
    if (res.data) {
      setInvitaciones(res.data);
    }
    setPendienteCargar(false);
  }

  async function generarInvitacion() {
    if (!invitacionId || !prompt) {
      setErrorGeneracion("Falta crear la invitación o construir el prompt");
      return;
    }

    setErrorGeneracion("");
    setHtmlGenerado("");

    startTransition(async () => {
      const res = await generarConIA(
        invitacionId,
        prompt,
        modelo,
        config as unknown as Record<string, unknown>,
        imagenes,
        videos
      );

      if (res.success) {
        setHtmlGenerado(res.html);
        await cargarHistorial();
      } else {
        setErrorGeneracion(res.error || "Error al generar");
      }
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-aventurea-cream to-white px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-aventurea-ink">
            ✨ Generador de invitaciones
          </h1>
          <p className="mt-2 text-aventurea-ink-soft">
            Crea invitaciones digitales personalizadas con IA en minutos
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-3 border-b border-aventurea-line">
          <button
            type="button"
            disabled={pendienteCargar}
            onClick={() => {
              // Solo crea una fila nueva si aún no hay borrador; con
              // uno en curso, vuelve a la vista de edición sin tocar
              // el trabajo del usuario.
              if (!invitacionId) {
                crearNueva();
              } else {
                setHtmlGenerado("");
                setErrorGeneracion("");
              }
            }}
            className={`px-4 py-3 font-bold text-[13px] transition-colors disabled:opacity-50 ${
              !htmlGenerado
                ? "border-b-2 border-aventurea-orange text-aventurea-orange"
                : "text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            {invitacionId ? "Editar" : "Nueva"}
          </button>
          <button
            type="button"
            onClick={cargarHistorial}
            className={`px-4 py-3 font-bold text-[13px] transition-colors ${
              htmlGenerado
                ? "border-b-2 border-aventurea-orange text-aventurea-orange"
                : "text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            Historial ({invitaciones.length})
          </button>
        </div>

        {/* Contenido principal */}
        {!htmlGenerado ? (
          <div className="space-y-6">
            {/* Sección 1: Configuración */}
            <PromptBuilder
              config={config}
              onConfigChange={setConfig}
              onGenerarPrompt={(p) => {
                setPrompt(p);
                setCostoEstimado(0);
              }}
              disabled={pendiente}
            />

            {/* Sección 2: Uploads */}
            {prompt && (
              <section>
                <h2 className="mb-4 text-[15px] font-bold text-aventurea-ink">
                  🖼️ Añade imágenes y videos
                </h2>
                <UploadZone
                  imagenes={imagenes}
                  videos={videos}
                  onImagenesChange={setImagenes}
                  onVideosChange={setVideos}
                  disabled={pendiente}
                />
              </section>
            )}

            {/* Sección 3: Modelo */}
            {prompt && (
              <section className="rounded-2xl border border-aventurea-line bg-white p-5">
                <h2 className="mb-4 text-[15px] font-bold text-aventurea-ink">
                  🤖 Elige modelo de IA
                </h2>
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
                      onClick={() => setModelo(m.id)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        modelo === m.id
                          ? "border-aventurea-orange bg-aventurea-orange/10"
                          : "border-aventurea-line bg-aventurea-cream-2 hover:border-aventurea-orange/50"
                      }`}
                      disabled={pendiente}
                    >
                      <p className="font-bold text-aventurea-ink">{m.nombre}</p>
                      <p className="mt-1 text-[12px] text-aventurea-ink-soft">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Sección 4: Costo preview */}
            {prompt && (
              <CostPreview
                prompt={prompt}
                modelo={modelo}
                onCostoCalculado={setCostoEstimado}
                disabled={pendiente}
              />
            )}

            {/* Error */}
            {errorGeneracion && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-[13px] font-semibold text-red-700">{errorGeneracion}</p>
              </div>
            )}

            {/* Botones de acción */}
            {prompt && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={generarInvitacion}
                  disabled={pendiente || costoEstimado === 0}
                  className="flex-1 rounded-xl bg-aventurea-orange px-6 py-3 font-bold text-white hover:bg-aventurea-orange-2 disabled:opacity-50"
                >
                  {pendiente ? "Generando..." : "🎨 Generar invitación"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrompt("");
                    setHtmlGenerado("");
                    setErrorGeneracion("");
                  }}
                  className="rounded-xl border border-aventurea-line px-6 py-3 font-bold text-aventurea-ink hover:bg-aventurea-cream-2"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Botón crear primera */}
            {!invitacionId && (
              <div className="rounded-2xl border-2 border-dashed border-aventurea-orange/30 bg-aventurea-orange/5 p-8 text-center">
                <p className="mb-4 text-[15px] font-bold text-aventurea-ink">
                  Comenzá configurando tu invitación
                </p>
                <button
                  type="button"
                  onClick={crearNueva}
                  disabled={pendienteCargar}
                  className="rounded-xl bg-aventurea-orange px-6 py-3 font-bold text-white hover:bg-aventurea-orange-2 disabled:opacity-50"
                >
                  {pendienteCargar ? "Cargando..." : "✨ Crear nueva"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Vista de preview */
          <div className="space-y-6">
            <PreviewIframe
              html={htmlGenerado}
              titulo={config.titulo || "Invitación generada"}
              cargando={pendiente}
              error={errorGeneracion}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHtmlGenerado("")}
                className="flex-1 rounded-xl border border-aventurea-line px-6 py-3 font-bold text-aventurea-ink hover:bg-aventurea-cream-2"
              >
                ← Volver a editar
              </button>
              <button
                type="button"
                onClick={publicar}
                className="flex-1 rounded-xl bg-aventurea-navy px-6 py-3 font-bold text-white hover:bg-aventurea-navy-2"
              >
                ✓ Publicar invitación
              </button>
            </div>
          </div>
        )}

        {/* Historial siempre visible abajo */}
        {invitaciones.length > 0 && (
          <div className="mt-12 pt-8 border-t border-aventurea-line">
            <Historial invitaciones={invitaciones} onAbrir={(slug) => router.push(`/i/${slug}`)} />
          </div>
        )}
      </div>
    </main>
  );
}
