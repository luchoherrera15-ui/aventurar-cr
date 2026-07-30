"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import InvitacionesBot, { DatosGeneracion } from "@/components/invitaciones-bot";
import PreviewIframe from "@/components/invitaciones-preview-iframe";
import Historial from "@/components/invitaciones-historial";
import {
  crearInvitacionBorrador,
  generarConIA,
  listarInvitacionesDeUsuario,
  publicarInvitacion,
} from "@/app/cuenta/invitaciones-generador-actions";
import { InvitacionHistorial } from "@/lib/tipos/invitaciones";

export default function ClientePage() {
  const router = useRouter();
  const [invitacionId, setInvitacionId] = useState<string | null>(null);
  const [slugInvitacion, setSlugInvitacion] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("Invitación generada");
  const [slugDeseado, setSlugDeseado] = useState("");

  const [htmlGenerado, setHtmlGenerado] = useState("");
  const [errorGeneracion, setErrorGeneracion] = useState("");

  const [invitaciones, setInvitaciones] = useState<InvitacionHistorial[]>([]);
  const [verHistorial, setVerHistorial] = useState(false);
  const [pendiente, startTransition] = useTransition();

  async function cargarHistorial() {
    const res = await listarInvitacionesDeUsuario();
    if (res.data) {
      setInvitaciones(res.data);
    }
  }

  /**
   * El bot entrega todo junto; acá se crea el borrador si aún no
   * existe (nadie tiene que acordarse de un botón aparte) y se genera.
   */
  function generarInvitacion(datos: DatosGeneracion) {
    setErrorGeneracion("");
    setHtmlGenerado("");
    setTitulo(datos.config.titulo || "Invitación generada");

    startTransition(async () => {
      let id = invitacionId;
      if (!id) {
        const borrador = await crearInvitacionBorrador();
        if (!borrador.data) {
          setErrorGeneracion(borrador.error || "Error al crear la invitación");
          return;
        }
        id = borrador.data.id as string;
        setInvitacionId(id);
        setSlugInvitacion(borrador.data.slug ?? null);
      }

      const res = await generarConIA(
        id,
        datos.prompt,
        datos.modelo,
        datos.config as unknown as Record<string, unknown>,
        datos.imagenes,
        datos.videos
      );

      if (res.success) {
        setHtmlGenerado(res.html);
        // Sugerir la dirección a partir del título ("Boda de Luis" →
        // "boda-de-luis"); el usuario la puede cambiar antes de publicar.
        setSlugDeseado(
          (datos.config.titulo || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60)
        );
        await cargarHistorial();
      } else {
        setErrorGeneracion(res.error || "Error al generar");
      }
    });
  }

  async function publicar() {
    if (!invitacionId) return;
    setErrorGeneracion("");
    const res = await publicarInvitacion(invitacionId, slugDeseado);
    if (res.data) {
      router.push(`/invitacion/${res.data.slug ?? slugInvitacion}`);
    } else {
      setErrorGeneracion(res.error || "No se pudo publicar la invitación");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-aventurea-cream to-white px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-aventurea-ink">
            ✨ Generador de invitaciones
          </h1>
          <p className="mt-2 text-aventurea-ink-soft">
            Pedile tu invitación al asistente y él te va guiando
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-3 border-b border-aventurea-line">
          <button
            type="button"
            onClick={() => setVerHistorial(false)}
            className={`px-4 py-3 font-bold text-[13px] transition-colors ${
              !verHistorial
                ? "border-b-2 border-aventurea-orange text-aventurea-orange"
                : "text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            Asistente
          </button>
          <button
            type="button"
            onClick={() => {
              setVerHistorial(true);
              cargarHistorial();
            }}
            className={`px-4 py-3 font-bold text-[13px] transition-colors ${
              verHistorial
                ? "border-b-2 border-aventurea-orange text-aventurea-orange"
                : "text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            Historial{invitaciones.length > 0 ? ` (${invitaciones.length})` : ""}
          </button>
        </div>

        {verHistorial && (
          <Historial
            invitaciones={invitaciones}
            onAbrir={(slug) => router.push(`/invitacion/${slug}`)}
          />
        )}

        {/* El bot queda montado (solo oculto) para no perder la
            conversación al pasar al preview o al historial. */}
        <div className={verHistorial || htmlGenerado ? "hidden" : "space-y-4"}>
          <InvitacionesBot onGenerar={generarInvitacion} pendiente={pendiente} />

          {pendiente && (
            <div className="rounded-2xl border border-aventurea-line bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-aventurea-orange border-t-transparent" />
                <p className="text-[13.5px] font-semibold text-aventurea-ink">
                  Generando tu invitación... esto puede tardar unos minutos ☕
                </p>
              </div>
            </div>
          )}

          {errorGeneracion && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-[13px] font-semibold text-red-700">{errorGeneracion}</p>
            </div>
          )}
        </div>

        {!verHistorial && htmlGenerado && (
          /* Vista de preview */
          <div className="space-y-6">
            <PreviewIframe
              html={htmlGenerado}
              titulo={titulo}
              cargando={pendiente}
              error={errorGeneracion}
            />

            {/* La dirección de la invitación: el cliente elige cómo se
                llama su página antes de publicarla. */}
            <div className="rounded-2xl border border-aventurea-line bg-white p-5">
              <label
                htmlFor="slug-invitacion"
                className="block text-[13px] font-bold text-aventurea-ink"
              >
                Dirección de tu invitación
              </label>
              <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
                Este es el link que vas a compartir con tus invitados
              </p>
              <div className="mt-3 flex items-center overflow-hidden rounded-xl border border-aventurea-line bg-aventurea-cream-2 focus-within:border-aventurea-navy">
                <span className="shrink-0 select-none pl-4 text-[13.5px] font-semibold text-aventurea-ink-soft">
                  bookea.lat/invitacion/
                </span>
                <input
                  id="slug-invitacion"
                  type="text"
                  value={slugDeseado}
                  onChange={(e) => setSlugDeseado(e.target.value)}
                  placeholder="luisherrera"
                  className="h-11 w-full bg-transparent pr-4 text-[13.5px] font-bold text-aventurea-ink placeholder:text-aventurea-ink-soft/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHtmlGenerado("")}
                className="flex-1 rounded-xl border border-aventurea-line px-6 py-3 font-bold text-aventurea-ink hover:bg-aventurea-cream-2"
              >
                ← Volver al asistente
              </button>
              <button
                type="button"
                onClick={publicar}
                className="flex-1 rounded-xl bg-aventurea-navy px-6 py-3 font-bold text-white hover:bg-aventurea-navy-2"
              >
                ✓ Publicar invitación
              </button>
            </div>

            {errorGeneracion && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-[13px] font-semibold text-red-700">{errorGeneracion}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
