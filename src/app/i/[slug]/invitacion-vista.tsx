"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconClock, IconPin, IconWaze } from "@/components/icons";
import { confirmarAsistencia } from "./actions";

/** Los campos de la invitación que usa la vista pública. */
export type Invitacion = {
  id: string;
  slug: string;
  titulo: string;
  anfitriones: string | null;
  mensaje: string | null;
  fecha_evento: string;
  hora: string | null;
  lugar_nombre: string | null;
  direccion: string | null;
  maps_url: string | null;
  portada_url: string | null;
  html_personalizado: string | null;
  tema: string;
};

const inputCls =
  "w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/40 focus:border-aventurea-orange focus:outline-none";
const labelCls =
  "mb-1.5 block text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/60";

/**
 * El lienzo inmersivo de la invitación: pantalla completa en navy con
 * el degradado de la marca, sin header del sitio — la invitación ES la
 * página. Si el equipo diseñó un HTML a la medida se renderiza tal
 * cual; si no, la plantilla "clásico". El bloque de confirmación va
 * siempre al pie: es el corazón del producto.
 */
export default function InvitacionVista({
  invitacion,
  fechaLarga,
}: {
  invitacion: Invitacion;
  fechaLarga: string;
}) {
  // Destino de "cómo llegar": el link exacto si el equipo lo cargó, o
  // la búsqueda por texto del lugar. Waze siempre busca por texto.
  const busqueda = [invitacion.lugar_nombre, invitacion.direccion, "Costa Rica"]
    .filter(Boolean)
    .join(", ");
  const hrefMaps =
    invitacion.maps_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busqueda)}`;
  const hrefWaze = `https://waze.com/ul?q=${encodeURIComponent(busqueda)}&navigate=yes`;

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#16295e] text-white">
      <RevealOnScroll />

      {/* Animación del "gracias": los keyframes viven acá porque solo
          esta página los usa — no ensucian globals.css. */}
      <style>{`
        @keyframes invitacion-pop {
          0% { opacity: 0; transform: scale(0.92) translateY(10px); }
          60% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .anim-invitacion-pop { animation: invitacion-pop 0.6s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .anim-invitacion-pop { animation: none; }
        }
      `}</style>

      {/* Fondo: el navy de la marca con dos brillos suaves (naranja y
          azul) y una trama de puntos apenas visible — elegante, nada
          de texturas cargadas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(52rem 34rem at 85% -8%, rgba(238,116,32,0.16), transparent 60%)," +
            "radial-gradient(46rem 30rem at -12% 32%, rgba(59,127,196,0.2), transparent 60%)," +
            "radial-gradient(40rem 28rem at 55% 108%, rgba(238,116,32,0.1), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative mx-auto flex min-h-svh w-full max-w-[680px] flex-col px-6 py-12 sm:py-16">
        {invitacion.html_personalizado ? (
          /* Diseño a la medida: el HTML del equipo manda tal cual. */
          <div
            data-reveal
            dangerouslySetInnerHTML={{ __html: invitacion.html_personalizado }}
          />
        ) : (
          <PlantillaClasico invitacion={invitacion} fechaLarga={fechaLarga} hrefMaps={hrefMaps} hrefWaze={hrefWaze} />
        )}

        <BloqueRsvp invitacionId={invitacion.id} />

        <footer className="mt-14 pb-2 text-center text-[12px] text-white/45">
          Invitación digital por{" "}
          <Link href="/" className="font-bold text-white/70 underline-offset-2 hover:text-white hover:underline">
            Bookea
          </Link>{" "}
          ✦
        </footer>
      </div>
    </main>
  );
}

/** La plantilla "clásico": portada, título grande, fecha y lugar. */
function PlantillaClasico({
  invitacion,
  fechaLarga,
  hrefMaps,
  hrefWaze,
}: {
  invitacion: Invitacion;
  fechaLarga: string;
  hrefMaps: string;
  hrefWaze: string;
}) {
  return (
    <div className="text-center">
      {invitacion.portada_url && (
        <div data-reveal className="mx-auto mb-9 max-w-[440px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto remota cargada por el equipo */}
          <img
            src={invitacion.portada_url}
            alt={invitacion.titulo}
            className="w-full rounded-3xl border border-white/15 object-cover shadow-[0_24px_70px_-30px_rgba(0,0,0,0.8)]"
          />
        </div>
      )}

      <p
        data-reveal
        className="text-[12px] font-bold uppercase tracking-[0.34em] text-[#f5b98a]"
      >
        Te invitamos
      </p>

      <h1
        data-reveal
        style={{ "--reveal-delay": "120ms" } as React.CSSProperties}
        className="titulo mx-auto mt-4 max-w-[16ch] text-[clamp(36px,9vw,58px)] text-white"
      >
        {invitacion.titulo}
      </h1>

      {invitacion.anfitriones && (
        <p
          data-reveal
          style={{ "--reveal-delay": "220ms" } as React.CSSProperties}
          className="mx-auto mt-5 max-w-[40ch] text-[14.5px] font-medium italic text-white/70"
        >
          {invitacion.anfitriones}
        </p>
      )}

      <p
        data-reveal
        style={{ "--reveal-delay": "300ms" } as React.CSSProperties}
        aria-hidden
        className="mt-7 text-[15px] tracking-[0.5em] text-aventurea-orange"
      >
        ✦ ✦ ✦
      </p>

      {invitacion.mensaje && (
        <p
          data-reveal
          className="mx-auto mt-7 max-w-[46ch] text-[16px] leading-relaxed text-white/85"
        >
          {invitacion.mensaje}
        </p>
      )}

      {/* Cuándo: la fecha en grande, la hora al lado. */}
      <div data-reveal className="mt-10">
        <p className="titulo text-[clamp(20px,4.5vw,27px)] text-white">{fechaLarga}</p>
        {invitacion.hora && (
          <p className="mt-2 inline-flex items-center gap-2 text-[15px] font-semibold text-white/80">
            <IconClock className="h-4 w-4 text-[#f5b98a]" /> {invitacion.hora}
          </p>
        )}
      </div>

      {/* Dónde: la tarjeta del lugar con la ubicación a un toque. */}
      {(invitacion.lugar_nombre || invitacion.direccion) && (
        <div
          data-reveal
          className="mx-auto mt-8 max-w-[440px] rounded-2xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-sm"
        >
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            <IconPin className="h-3.5 w-3.5 text-[#f5b98a]" /> El lugar
          </p>
          {invitacion.lugar_nombre && (
            <p className="titulo mt-2 text-[20px] text-white">{invitacion.lugar_nombre}</p>
          )}
          {invitacion.direccion && (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/70">
              {invitacion.direccion}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <a
              href={hrefMaps}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-white px-5 py-2.5 text-[13.5px] font-bold text-[#16295e] transition-colors hover:bg-[#f5b98a]"
            >
              Google Maps
            </a>
            <a
              href={hrefWaze}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:border-white hover:bg-white/10"
            >
              <IconWaze className="h-4 w-4" /> Waze
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/** "¿Nos acompañás?" — el formulario de confirmación, al pie. */
function BloqueRsvp({ invitacionId }: { invitacionId: string }) {
  const [nombre, setNombre] = useState("");
  const [acompanantes, setAcompanantes] = useState("0");
  const [asistira, setAsistira] = useState<boolean | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  function enviar() {
    if (asistira === null) {
      setError("Elegí si vas a asistir o no.");
      return;
    }
    if (!nombre.trim()) {
      setError("Contanos tu nombre para apuntarte.");
      return;
    }
    setError(null);
    const respuesta = asistira;
    startTransition(async () => {
      const res = await confirmarAsistencia({
        invitacionId,
        nombre,
        acompanantes: parseInt(acompanantes) || 0,
        asistira: respuesta,
        mensaje: mensaje || null,
      });
      if (res.error) setError(res.error);
      else setEnviado(respuesta);
    });
  }

  if (enviado !== null) {
    return (
      <section className="anim-invitacion-pop mx-auto mt-14 w-full max-w-[440px] rounded-3xl border border-white/15 bg-white/[0.07] p-8 text-center backdrop-blur-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aventurea-orange text-[26px]">
          {enviado ? "🎉" : "🤍"}
        </span>
        <h2 className="titulo mt-4 text-[26px] text-white">¡Gracias por confirmar!</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/75">
          {enviado
            ? "Quedaste en la lista — nos vemos ahí."
            : "Lamentamos que no puedas venir. ¡Gracias por avisar!"}
        </p>
      </section>
    );
  }

  return (
    <section
      data-reveal
      className="mx-auto mt-14 w-full max-w-[440px] rounded-3xl border border-white/15 bg-white/[0.07] p-7 backdrop-blur-sm sm:p-8"
    >
      <h2 className="titulo text-center text-[clamp(24px,5vw,30px)] text-white">
        ¿Nos acompañás?
      </h2>
      <p className="mt-2 text-center text-[13px] text-white/65">
        Confirmá tu asistencia acá mismo — toma menos de un minuto.
      </p>

      <div className="mt-6 grid gap-4">
        <div>
          <label htmlFor="rsvp-nombre" className={labelCls}>
            Tu nombre *
          </label>
          <input
            id="rsvp-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="rsvp-acomp" className={labelCls}>
            ¿Cuántas personas te acompañan?
          </label>
          <input
            id="rsvp-acomp"
            type="number"
            min={0}
            max={20}
            value={acompanantes}
            onChange={(e) => setAcompanantes(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            aria-pressed={asistira === true}
            onClick={() => setAsistira(true)}
            className={`rounded-xl border px-4 py-3 text-[14px] font-bold transition-colors ${
              asistira === true
                ? "border-aventurea-orange bg-aventurea-orange text-white"
                : "border-white/25 bg-white/5 text-white/80 hover:border-white/60"
            }`}
          >
            Sí asistiré
          </button>
          <button
            type="button"
            aria-pressed={asistira === false}
            onClick={() => setAsistira(false)}
            className={`rounded-xl border px-4 py-3 text-[14px] font-bold transition-colors ${
              asistira === false
                ? "border-white bg-white text-[#16295e]"
                : "border-white/25 bg-white/5 text-white/80 hover:border-white/60"
            }`}
          >
            No podré ir
          </button>
        </div>

        <div>
          <label htmlFor="rsvp-mensaje" className={labelCls}>
            Un mensajito (opcional)
          </label>
          <textarea
            id="rsvp-mensaje"
            rows={3}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Dejales unas palabras a los anfitriones…"
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-500/15 px-4 py-2.5 text-[13px] font-semibold text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={enviar}
          className="rounded-xl bg-aventurea-orange px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar confirmación"}
        </button>
      </div>
    </section>
  );
}
