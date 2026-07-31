"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import InvitacionesBot, { DatosGeneracion } from "@/components/invitaciones-bot";
import PreviewIframe from "@/components/invitaciones-preview-iframe";
import Historial, { CostoCongelado } from "@/components/invitaciones-historial";
import {
  crearInvitacionBorrador,
  generarConIA,
  listarInvitacionesDeUsuario,
  publicarInvitacion,
} from "@/app/cuenta/invitaciones-generador-actions";
import { costosDeInvitaciones } from "@/app/cuenta/invitaciones-costos-actions";
import { InvitacionHistorial } from "@/lib/tipos/invitaciones";

export default function ClientePage() {
  const router = useRouter();
  const [invitacionId, setInvitacionId] = useState<string | null>(null);
  const [slugInvitacion, setSlugInvitacion] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("Invitación generada");
  const [slugDeseado, setSlugDeseado] = useState("");
  const [enCatalogo, setEnCatalogo] = useState(false);

  const [htmlGenerado, setHtmlGenerado] = useState("");
  const [costoGeneracion, setCostoGeneracion] = useState<number | null>(null);
  const [errorGeneracion, setErrorGeneracion] = useState("");

  const [invitaciones, setInvitaciones] = useState<InvitacionHistorial[]>([]);
  const [costos, setCostos] = useState<Record<string, CostoCongelado>>({});
  const [verHistorial, setVerHistorial] = useState(false);
  const [pendiente, startTransition] = useTransition();

  async function cargarHistorial() {
    const res = await listarInvitacionesDeUsuario();
    if (res.data) {
      const lista: InvitacionHistorial[] = res.data;
      setInvitaciones(lista);
      // Los colones de cada invitación salen de la bitácora uso_ia, con
      // el tipo de cambio congelado el día que se generó. Va en una
      // consulta aparte para no tocar el listado: si falla, el historial
      // igual se ve, solo que en dólares.
      setCostos(await costosDeInvitaciones(lista.map((inv) => inv.id)));
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
        datos.videos,
        datos.audios
      );

      if (res.success) {
        setHtmlGenerado(res.html);
        setCostoGeneracion(typeof res.costo_usd === "number" ? res.costo_usd : null);
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
    const res = await publicarInvitacion(invitacionId, slugDeseado, enCatalogo);
    if (res.data) {
      // Si la vitrina falló, la invitación igual quedó publicada: se
      // avisa antes de salir para que nadie la dé por listada.
      if (res.aviso) alert(res.aviso);
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
            costos={costos}
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

            {costoGeneracion !== null && (
              <p className="rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[12.5px] font-semibold text-aventurea-ink-soft">
                Costo real de esta generación:{" "}
                <span className="font-black text-aventurea-ink">
                  ${costoGeneracion.toFixed(4)}
                </span>{" "}
                USD
              </p>
            )}

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

              {/* Vitrina: sumarla a los ejemplos públicos de la landing. */}
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3.5">
                <input
                  type="checkbox"
                  checked={enCatalogo}
                  onChange={(e) => setEnCatalogo(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-aventurea-line accent-aventurea-navy"
                />
                <span>
                  <span className="block text-[13px] font-bold text-aventurea-ink">
                    Publicarla en el catálogo de ejemplos
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-aventurea-ink-soft">
                    Publicamos una <strong>copia sin confirmaciones</strong> como
                    muestra en la página de invitaciones — tu invitación real y
                    su lista de invitados quedan intactas. Se ve tal cual, con
                    los datos de tu evento.
                  </span>
                </span>
              </label>
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
