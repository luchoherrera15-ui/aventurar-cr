"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { hoyISOCR } from "@/lib/fechas";
import { HORAS_REUNION, diasDisponibles } from "@/lib/lealtad/reuniones";
import { horasOcupadasReunion, programarReunionLealtad, type ResultadoReunion } from "./reunion-actions";

/**
 * LA AGENDA CHICA — elegí día y hora, y Bookea te llama.
 *
 * Pedido del dueño (8 sep 2026). Es un paso del configurador de
 * Lealtad, antes de elegir el plan: quien marcó «Necesito ayuda» ve
 * dos filas de píldoras (días y horas), tres campos y un botón. Nada
 * de calendario mensual: son 12 días y 16 horas, se ven de un vistazo.
 *
 * Las horas ya tomadas se apagan (se piden al servidor al elegir el
 * día); si dos personas eligen la misma en el mismo segundo, el índice
 * único de la base decide y a la segunda se le pide otra.
 */

const campo = "w-full rounded-xl border border-bookea-linea bg-white px-3.5 py-2.5 text-[14px] text-bookea-tinta placeholder:text-bookea-gris/70";
const etiqueta = "mb-1.5 block text-[12px] font-bold text-bookea-tinta";

export default function AgendaReunion({ alVolver, alSeguirSolo, telefonoInicial = "" }: { alVolver: () => void; alSeguirSolo: () => void; telefonoInicial?: string }) {
  const [dias] = useState(() => diasDisponibles(hoyISOCR()));
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [ocupadas, setOcupadas] = useState<string[]>([]);
  const [cargandoHoras, arrancarHoras] = useTransition();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [negocio, setNegocio] = useState("");
  const [notas, setNotas] = useState("");
  const [panal, setPanal] = useState("");
  const [enviando, arrancar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoReunion | null>(null);

  // Al elegir un día, se apagan las horas que ya se tomaron.
  useEffect(() => {
    if (!fecha) return;
    arrancarHoras(async () => {
      const tomadas = await horasOcupadasReunion(fecha);
      setOcupadas(tomadas);
      setHora((h) => (h && tomadas.includes(h) ? null : h));
    });
  }, [fecha]);

  const listo = !!fecha && !!hora && nombre.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());

  const enviar = () => {
    if (!listo || !fecha || !hora) return;
    setResultado(null);
    arrancar(async () => {
      const r = await programarReunionLealtad({ nombre, correo, telefono, negocio, fecha, hora, notas, panal });
      setResultado(r);
      if (!r.ok && r.motivo.includes("ocupar")) {
        const tomadas = await horasOcupadasReunion(fecha);
        setOcupadas(tomadas);
        setHora(null);
      }
    });
  };

  if (resultado?.ok) {
    return (
      <div className="p-5 sm:px-7 sm:py-6">
        <span className="inline-flex rounded-full bg-green-50 px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-green-800">Reunión programada</span>
        <h2 className="titulo mt-2 text-[26px] leading-tight text-bookea-tinta">
          Nos vemos el {resultado.fechaLarga} a las {resultado.hora}.
        </h2>
        <p className="mt-2 max-w-[56ch] text-[14px] text-bookea-gris">
          Te mandamos la confirmación a <b className="text-bookea-tinta">{correo.trim()}</b>. Unos minutos antes te escribimos por WhatsApp o correo para conectarnos. En la
          reunión armamos juntos tu tarjeta: tipo, colores, premio y el QR de tu local.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={alSeguirSolo} className="presionable inline-flex min-h-[44px] items-center rounded-xl px-5 text-[14px] font-extrabold text-white" style={{ background: "var(--accion, #062653)" }}>
            Mientras tanto, ver los planes →
          </button>
          <Link href="/lealtad" className="presionable inline-flex min-h-[44px] items-center rounded-xl border border-bookea-linea bg-white px-5 text-[14px] font-bold text-bookea-tinta">
            Volver a Lealtad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:px-7 sm:py-5">
      <span className="inline-flex rounded-full bg-bookea-azul-suave px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-bookea-azul">Paso 1 · Programá tu reunión</span>
      <h2 className="titulo mt-2 text-[26px] leading-tight text-bookea-tinta">Elegí día y hora, y lo armamos con vos</h2>
      <p className="mt-1.5 max-w-[60ch] text-[13px] text-bookea-gris">
        Una videollamada de unos 30 minutos con el equipo de Bookea. Lunes a sábado, de 9:00 a 17:00, hora de Costa Rica. Sin costo.
      </p>

      {/* ── Los días ─────────────────────────────────────────────── */}
      <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-bookea-gris">Qué día</p>
      <div role="group" aria-label="Día de la reunión" className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {dias.map((d) => {
          const activo = d.iso === fecha;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => setFecha(d.iso)}
              aria-pressed={activo}
              className={`presionable flex min-w-[64px] shrink-0 flex-col items-center rounded-2xl border px-2 py-2.5 transition-colors ${activo ? "border-transparent text-white" : "border-bookea-linea bg-white text-bookea-tinta hover:border-bookea-azul"}`}
              style={activo ? { background: "var(--accion, #062653)" } : undefined}
            >
              <span className="text-[10.5px] font-bold uppercase tracking-wide opacity-80">{d.diaCorto}</span>
              <span className="titulo text-[20px] leading-none">{d.numero}</span>
              <span className="text-[10.5px] font-semibold opacity-80">{d.mesCorto}</span>
            </button>
          );
        })}
      </div>

      {/* ── Las horas ────────────────────────────────────────────── */}
      <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-bookea-gris">
        A qué hora {cargandoHoras && <span className="font-semibold normal-case tracking-normal">· revisando disponibilidad…</span>}
      </p>
      <div role="group" aria-label="Hora de la reunión" className={`mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-8 ${fecha ? "" : "pointer-events-none opacity-40"}`}>
        {HORAS_REUNION.map((h) => {
          const activo = h === hora;
          const tomada = ocupadas.includes(h);
          return (
            <button
              key={h}
              type="button"
              disabled={tomada}
              onClick={() => setHora(h)}
              aria-pressed={activo}
              className={`presionable min-h-[40px] rounded-xl border text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${activo ? "border-transparent text-white" : "border-bookea-linea bg-white text-bookea-tinta hover:border-bookea-azul"}`}
              style={activo ? { background: "var(--accion, #062653)" } : undefined}
            >
              {h}
            </button>
          );
        })}
      </div>
      {!fecha && <p className="mt-1.5 text-[12px] text-bookea-gris">Primero elegí el día.</p>}

      {/* ── Quién sos ────────────────────────────────────────────── */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="reu-nombre" className={etiqueta}>Tu nombre</label>
          <input id="reu-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Ana Rodríguez" className={campo} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="reu-correo" className={etiqueta}>Tu correo</label>
          <input id="reu-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} maxLength={160} placeholder="ana@tunegocio.com" className={campo} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="reu-telefono" className={etiqueta}>WhatsApp (opcional)</label>
          <input id="reu-telefono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={20} placeholder="88887777" className={campo} autoComplete="tel" />
        </div>
        <div>
          <label htmlFor="reu-negocio" className={etiqueta}>Tu negocio (opcional)</label>
          <input id="reu-negocio" value={negocio} onChange={(e) => setNegocio(e.target.value)} maxLength={80} placeholder="Café La Esquina" className={campo} autoComplete="organization" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="reu-notas" className={etiqueta}>¿Algo que debamos saber? (opcional)</label>
          <textarea id="reu-notas" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} rows={2} placeholder="Tengo dos locales y quiero una sola tarjeta…" className={campo} />
        </div>
        {/* El panal: los humanos no lo ven; los bots lo llenan. */}
        <input type="text" value={panal} onChange={(e) => setPanal(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="sitio_web" />
      </div>

      {resultado && !resultado.ok && <p className="mt-3 text-[13px] font-bold text-red-700">{resultado.motivo}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={enviar} disabled={!listo || enviando} className="presionable inline-flex min-h-[46px] items-center rounded-xl px-6 text-[14px] font-extrabold text-white disabled:opacity-50" style={{ background: "var(--accion, #062653)" }}>
          {enviando ? "Programando…" : "Programar la reunión →"}
        </button>
        <button type="button" onClick={alVolver} className="presionable inline-flex min-h-[46px] items-center rounded-xl border border-bookea-linea bg-white px-5 text-[14px] font-bold text-bookea-tinta">
          ← Volver
        </button>
      </div>
    </div>
  );
}
