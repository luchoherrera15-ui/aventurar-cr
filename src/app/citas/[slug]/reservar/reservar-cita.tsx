"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtColones } from "@/lib/finanzas";
import { IconCalendarLine, IconClock, IconPin, IconStar } from "@/components/icons";
import { crearCita } from "../../actions";
import {
  espaciosLibres,
  etiquetaMinutos,
  horaBonita,
  type CitaOcupada,
  type HorarioSemana,
} from "../../tipos";

type Servicio = {
  id: string;
  nombre: string;
  precio: number | null;
  duracion_minutos: number | null;
  grupo: string | null;
};

type Miembro = { id: string; nombre: string; rol: string | null; foto_url: string | null };

/** Lo que el panel de resumen muestra del negocio (foto, nota, zona). */
export type ResumenNegocio = {
  fotoUrl: string | null;
  promedio: number | null;
  totalResenas: number | null;
  ubicacion: string | null;
};

const DIAS_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** Cuatro semanas hacia adelante — con las flechas alcanza y sobra. */
const DIAS_VISIBLES = 28;

function fechaISOLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumarMinutos(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * La agenda de citas al estilo Fresha, en dos columnas: a la izquierda
 * el paso activo (fecha y hora → confirmar) y a la derecha el resumen
 * vivo — el negocio, lo elegido y el total — con el botón de avanzar.
 * Las horas se calculan contra las citas reales (vista pública sin
 * datos de nadie) y el RPC vuelve a validar todo en el servidor.
 *
 * No trae fondo propio: quien la usa la mete en su marco — la página
 * /reservar en una tarjeta, y el negocio en el modal que se abre con
 * "Consultar fechas" (ReservarCitaModal, abajo).
 */
export default function ReservarCita({
  ranchoId,
  rutaBase,
  nombreNegocio,
  items,
  equipo,
  horario,
  sesionActiva,
  nombreInicial,
  servicioInicial,
  miembroInicial = null,
  resumen,
  onVolverServicios,
}: {
  ranchoId: string;
  rutaBase: string;
  nombreNegocio: string;
  items: Servicio[];
  equipo: Miembro[];
  horario: HorarioSemana | null;
  sesionActiva: boolean;
  nombreInicial: string;
  servicioInicial: string | null;
  /** Abre la agenda con esta persona ya elegida ("Reservar con X"). */
  miembroInicial?: string | null;
  resumen?: ResumenNegocio;
  /** En el modal: vuelve a la lista de servicios (lo cierra). Sin esto,
   * la miga "Servicios" navega a la página del negocio. */
  onVolverServicios?: () => void;
}) {
  const [servicioId, setServicioId] = useState(
    servicioInicial && items.some((i) => i.id === servicioInicial)
      ? servicioInicial
      : (items[0]?.id ?? ""),
  );
  const [paso, setPaso] = useState<"hora" | "confirmar">("hora");
  const [miembroId, setMiembroId] = useState<string | null>(
    miembroInicial && equipo.some((m) => m.id === miembroInicial) ? miembroInicial : null,
  );
  // Arranca en el primer día abierto de los visibles.
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    for (let i = 0; i < DIAS_VISIBLES; i++) {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      const abierto = horario
        ? (horario[String(d.getDay())] ?? null)
        : { abre: "08:00", cierra: "18:00" };
      if (abierto) return fechaISOLocal(d);
    }
    return "";
  });
  const [hora, setHora] = useState("");
  const [ocupadas, setOcupadas] = useState<CitaOcupada[]>([]);
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null); // reservaId
  const [pending, startTransition] = useTransition();
  const tiraRef = useRef<HTMLDivElement>(null);

  const servicio = items.find((i) => i.id === servicioId) ?? null;
  const duracion = servicio?.duracion_minutos ?? 30;

  // Los próximos días, con su día del horario (null = cerrado).
  const dias = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Array.from({ length: DIAS_VISIBLES }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const horarioDia = horario
        ? (horario[String(dow)] ?? null)
        : { abre: "08:00", cierra: "18:00" };
      return { date: d, iso: fechaISOLocal(d), dow, horarioDia, esHoy: i === 0 };
    });
  }, [horario]);

  // Al cambiar el día se traen sus citas confirmadas (vista pública).
  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    const supabase = createClient();
    supabase
      .from("disponibilidad_citas")
      .select("hora_inicio, duracion_minutos, miembro_id")
      .eq("rancho_id", ranchoId)
      .eq("fecha", fecha)
      .then(({ data }) => {
        if (vigente) setOcupadas((data ?? []) as CitaOcupada[]);
      });
    return () => {
      vigente = false;
    };
  }, [ranchoId, fecha]);

  // El teléfono se aprende de reservas anteriores (queda en los
  // metadatos del usuario): con sesión el formulario llega listo.
  useEffect(() => {
    if (!sesionActiva) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const guardado: unknown = user?.user_metadata?.whatsapp;
      if (typeof guardado === "string" && guardado.trim() !== "") {
        setTelefono((prev) => prev || guardado);
      }
    });
  }, [sesionActiva]);

  // Sin useMemo a propósito: el cálculo es barato (una grilla de 30
  // min) y el compilador de React memoiza solo.
  const diaElegido = dias.find((d) => d.iso === fecha);
  const ahora = new Date();
  const horas = !diaElegido?.horarioDia
    ? []
    : espaciosLibres({
        horarioDia: diaElegido.horarioDia,
        duracionServicio: duracion,
        ocupadas,
        miembroId,
        equipoIds: equipo.map((m) => m.id),
        minutosMinimos: diaElegido.esHoy
          ? Math.ceil((ahora.getHours() * 60 + ahora.getMinutes() + 30) / 30) * 30
          : undefined,
      });

  // Derivada, no un efecto: si la hora marcada dejó de estar libre
  // (cambió el día, la persona o el servicio), simplemente no cuenta.
  const horaElegida = horas.includes(hora) ? hora : "";

  function confirmar() {
    if (!servicio || !fecha || !horaElegida) return;
    setError(null);
    startTransition(async () => {
      const res = await crearCita({
        ranchoId,
        itemId: servicio.id,
        fecha,
        hora: horaElegida,
        miembroId,
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        notas: notas.trim(),
      });
      if (res.error !== null) {
        setError(res.error);
        return;
      }
      // La próxima cita sale precargada: nombre y teléfono a los
      // metadatos del usuario (solo con sesión iniciada).
      if (sesionActiva) {
        const supabase = createClient();
        void supabase.auth.updateUser({
          data: { nombre: nombre.trim(), whatsapp: telefono.trim() },
        });
      }
      setExito(res.reservaId);
    });
  }

  function moverTira(direccion: -1 | 1) {
    tiraRef.current?.scrollBy({ left: direccion * 280, behavior: "smooth" });
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-[13.5px] text-aventurea-ink-soft">
        Este negocio todavía no publicó sus servicios — consultale por el chat.
      </div>
    );
  }

  if (exito) {
    return (
      <div className="p-10 text-center sm:p-14">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aventurea-green/10 text-[26px]">
          ✓
        </span>
        <h2 className="titulo mt-4 text-[22px] text-aventurea-ink">
          ¡Tu cita quedó confirmada!
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          {servicio?.nombre} en {nombreNegocio} —{" "}
          {diaElegido
            ? `${DIAS_CORTO[diaElegido.dow]} ${diaElegido.date.getDate()} de ${MESES_CORTO[diaElegido.date.getMonth()]}`
            : fecha}
          , {horaBonita(hora)}. Te mandamos el comprobante por correo; el pago
          es en el local.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/mensajes/${exito}`}
            className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
          >
            Abrir el chat del negocio
          </Link>
          {onVolverServicios ? (
            <button
              type="button"
              onClick={onVolverServicios}
              className="rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              Volver al negocio
            </button>
          ) : (
            <Link
              href={rutaBase}
              className="rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              Volver al negocio
            </Link>
          )}
        </div>
      </div>
    );
  }

  const horaFin = horaElegida ? sumarMinutos(horaElegida, duracion) : null;
  const fechaLarga = diaElegido
    ? diaElegido.date.toLocaleDateString("es-CR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;
  const inputCls =
    "w-full rounded-xl border border-aventurea-line bg-white px-4 py-3 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400 focus:border-aventurea-navy focus:outline-none";
  const puedeContinuar = !!servicio && !!fecha && !!horaElegida;

  return (
    <div className="grid lg:grid-cols-[1fr_330px]">
      {/* ---------- Columna del paso activo ---------- */}
      <div className="min-w-0 p-6 sm:p-8">
        {/* Migas: Servicios › Hora › Confirmar */}
        <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-bold">
          {onVolverServicios ? (
            <button
              type="button"
              onClick={onVolverServicios}
              className="text-aventurea-ink-soft hover:text-aventurea-navy"
            >
              Servicios
            </button>
          ) : (
            <Link href={rutaBase} className="text-aventurea-ink-soft hover:text-aventurea-navy">
              Servicios
            </Link>
          )}
          <Miga />
          {paso === "hora" ? (
            <span className="text-aventurea-ink">Hora</span>
          ) : (
            <button
              type="button"
              onClick={() => setPaso("hora")}
              className="text-aventurea-ink-soft hover:text-aventurea-navy"
            >
              Hora
            </button>
          )}
          <Miga />
          <span className={paso === "confirmar" ? "text-aventurea-ink" : "text-zinc-400"}>
            Confirmar
          </span>
        </nav>

        {paso === "hora" ? (
          <>
            <h2 className="titulo mt-3 text-[clamp(22px,2.6vw,30px)] text-aventurea-ink">
              Seleccioná fecha y hora
            </h2>

            {/* Servicio (por si entró sin elegir uno) */}
            <label className="mt-5 block">
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                Servicio
              </span>
              <select
                value={servicioId}
                onChange={(e) => setServicioId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-aventurea-line bg-white px-4 py-3 text-[13.5px] font-bold text-aventurea-ink focus:border-aventurea-navy focus:outline-none"
              >
                {items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} · {etiquetaMinutos(s.duracion_minutos ?? 30)}
                    {s.precio !== null ? ` · ${fmtColones(s.precio)}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {/* ¿Con quién? */}
            {equipo.length > 0 && (
              <div className="mt-5">
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                  ¿Con quién?
                </span>
                <div className="flex flex-wrap gap-2">
                  <BotonMiembro
                    activo={miembroId === null}
                    onClick={() => setMiembroId(null)}
                    nombre="Cualquiera"
                  />
                  {equipo.map((m) => (
                    <BotonMiembro
                      key={m.id}
                      activo={miembroId === m.id}
                      onClick={() => setMiembroId(m.id)}
                      nombre={m.nombre}
                      fotoUrl={m.foto_url}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Día — tira horizontal con flechas */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-[14px] font-extrabold text-aventurea-ink">
                Seleccioná una fecha
              </span>
              <span className="flex gap-1">
                <BotonFlecha direccion={-1} onClick={() => moverTira(-1)} />
                <BotonFlecha direccion={1} onClick={() => moverTira(1)} />
              </span>
            </div>
            <div
              ref={tiraRef}
              className="mt-2.5 flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none]"
            >
              {dias.map((d) => {
                const cerrado = !d.horarioDia;
                const elegido = d.iso === fecha;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    disabled={cerrado}
                    onClick={() => setFecha(d.iso)}
                    className={`flex w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-2xl border py-3 transition-colors ${
                      elegido
                        ? "border-aventurea-navy bg-aventurea-navy text-white shadow-[0_10px_24px_-12px_rgba(22,41,94,0.7)]"
                        : cerrado
                          ? "cursor-not-allowed border-[#eef2f9] bg-[#fafbfd] text-zinc-300"
                          : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
                    }`}
                  >
                    <span className="text-[10.5px] font-bold lowercase">{DIAS_CORTO[d.dow]}</span>
                    <span className="text-[17px] font-extrabold leading-none">
                      {d.date.getDate()}
                    </span>
                    <span className="text-[10px] font-semibold opacity-70">
                      {MESES_CORTO[d.date.getMonth()]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hora — filas anchas, como Fresha */}
            <p className="mt-6 text-[14px] font-extrabold text-aventurea-ink">Escogé una hora</p>
            {horas.length === 0 ? (
              <p className="mt-2.5 rounded-2xl border border-aventurea-line bg-[#fafbfe] px-5 py-4 text-[13px] text-aventurea-ink-soft">
                No quedan espacios libres ese día — probá con otra fecha
                {equipo.length > 0 ? " u otra persona" : ""}.
              </p>
            ) : (
              /* La lista scrollea dentro de su propia caja: por larga
                 que sea la jornada, el botón de Continuar no se va de
                 la pantalla. */
              <div className="mt-2.5 flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
                {horas.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHora(h)}
                    className={`rounded-2xl border px-5 py-3.5 text-left text-[14px] font-bold transition-colors ${
                      h === horaElegida
                        ? "border-2 border-aventurea-navy bg-[#f4f7fd] text-aventurea-ink"
                        : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
                    }`}
                  >
                    {horaBonita(h)}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-4 text-[12.5px] text-aventurea-ink-soft">
              ¿Ninguna hora te sirve?{" "}
              <Link
                href={`/mensajes/consulta/${ranchoId}`}
                className="font-bold text-aventurea-navy hover:underline"
              >
                Consultale al negocio por el chat
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="titulo mt-3 text-[clamp(22px,2.6vw,30px)] text-aventurea-ink">
              Confirmá tu cita
            </h2>

            {!sesionActiva ? (
              <div className="mt-5 rounded-2xl border border-aventurea-line bg-[#f4f7fd] p-5 text-[13.5px] leading-relaxed text-aventurea-ink">
                Para confirmar tu cita iniciá sesión — así te llega el
                comprobante y podés escribirle al negocio por el chat.
                <Link
                  href="/cuenta"
                  className="mt-3 block w-fit rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
                >
                  Iniciar sesión
                </Link>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                    className={inputCls}
                  />
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Tu teléfono (opcional)"
                    className={inputCls}
                  />
                </div>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="¿Algo que el negocio deba saber? (opcional)"
                  rows={3}
                  className={inputCls}
                />
                {error && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
                    {error}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setPaso("hora")}
              className="mt-5 text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy"
            >
              ← Cambiar la fecha o la hora
            </button>
          </>
        )}
      </div>

      {/* ---------- Resumen vivo ---------- */}
      {/* Sticky dentro del scroll del modal: el resumen y su botón de
          Continuar acompañan siempre, sin perderse abajo. */}
      <aside className="flex flex-col gap-4 border-t border-[#e6edf8] bg-[#fafbfe] p-6 lg:sticky lg:top-0 lg:self-start lg:border-l lg:border-t-0">
        <div className="flex items-center gap-3">
          {resumen?.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
            <img
              src={resumen.fotoUrl}
              alt={nombreNegocio}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-aventurea-blue-light text-aventurea-navy">
              <IconClock className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-extrabold text-aventurea-ink">
              {nombreNegocio}
            </p>
            {resumen?.promedio != null && (resumen.totalResenas ?? 0) > 0 && (
              <p className="flex items-center gap-1 text-[12px] font-bold text-aventurea-ink">
                <IconStar className="h-3 w-3 text-aventurea-orange" />
                {resumen.promedio.toFixed(1)}
                <span className="font-semibold text-aventurea-ink-soft">
                  ({resumen.totalResenas})
                </span>
              </p>
            )}
            {resumen?.ubicacion && (
              <p className="flex items-center gap-1 truncate text-[11.5px] text-aventurea-ink-soft">
                <IconPin className="h-3 w-3 shrink-0 text-aventurea-navy" /> {resumen.ubicacion}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#e6edf8] pt-4 text-[13px]">
          <p className="flex items-center gap-2 text-aventurea-ink">
            <IconCalendarLine className="h-4 w-4 shrink-0 text-aventurea-navy" />
            {fechaLarga ?? <span className="text-zinc-400">Elegí la fecha</span>}
          </p>
          <p className="flex items-center gap-2 text-aventurea-ink">
            <IconClock className="h-4 w-4 shrink-0 text-aventurea-navy" />
            {horaElegida && horaFin ? (
              `${horaBonita(horaElegida)} – ${horaBonita(horaFin)} (${etiquetaMinutos(duracion)})`
            ) : (
              <span className="text-zinc-400">Elegí la hora</span>
            )}
          </p>
          {miembroId && (
            <p className="text-[12.5px] text-aventurea-ink-soft">
              Con {equipo.find((m) => m.id === miembroId)?.nombre}
            </p>
          )}
        </div>

        {servicio && (
          <div className="border-t border-[#e6edf8] pt-4">
            <div className="flex items-start justify-between gap-3 text-[13px]">
              <span className="text-aventurea-ink">{servicio.nombre}</span>
              <span className="shrink-0 font-bold text-aventurea-ink">
                {servicio.precio !== null ? fmtColones(servicio.precio) : "Consultar"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#e6edf8] pt-3">
              <span className="text-[14px] font-extrabold text-aventurea-ink">Total</span>
              <span className="text-[15px] font-extrabold text-aventurea-ink">
                {servicio.precio !== null ? fmtColones(servicio.precio) : "Consultar"}
              </span>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {paso === "hora" ? (
            <button
              type="button"
              disabled={!puedeContinuar}
              onClick={() => setPaso("confirmar")}
              className="flex items-center justify-center gap-2 rounded-xl bg-aventurea-navy px-6 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          ) : sesionActiva ? (
            <button
              type="button"
              disabled={pending || !puedeContinuar || !nombre.trim()}
              onClick={confirmar}
              className="rounded-xl bg-aventurea-orange px-6 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Confirmando…" : "Confirmar cita"}
            </button>
          ) : (
            <Link
              href="/cuenta"
              className="rounded-xl bg-aventurea-navy px-6 py-3.5 text-center text-[14px] font-bold text-white hover:bg-aventurea-navy-2"
            >
              Iniciar sesión para confirmar
            </Link>
          )}
          <p className="text-center text-[11.5px] text-aventurea-ink-soft">
            Todavía no pagás nada — el pago es en el local.
          </p>
          <p className="text-center text-[10.5px] text-zinc-400">
            💳 Pago con tarjeta en línea: muy pronto
          </p>
        </div>
      </aside>
    </div>
  );
}

/**
 * "Consultar fechas": la agenda de arriba desplegada en grande sobre
 * la página del negocio — sin navegar a otra ruta. Cierra con la ✕,
 * con Escape o tocando el fondo oscuro.
 */
export function ReservarCitaModal({
  abierta,
  onCerrar,
  ...propsAgenda
}: {
  abierta: boolean;
  onCerrar: () => void;
} & Omit<Parameters<typeof ReservarCita>[0], "onVolverServicios">) {
  // Con el modal abierto la página de atrás no scrollea.
  useEffect(() => {
    if (!abierta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reservar en ${propsAgenda.nombreNegocio}`}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
    >
      <button
        type="button"
        aria-label="Cerrar la agenda"
        onClick={onCerrar}
        className="absolute inset-0 cursor-default bg-[rgba(10,18,42,0.55)] backdrop-blur-[2px]"
      />
      <div className="relative flex max-h-[92vh] w-full max-w-[1020px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_48px_120px_-40px_rgba(6,12,32,0.65)]">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onCerrar}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-aventurea-line bg-white text-aventurea-ink shadow-sm transition-colors hover:border-aventurea-navy"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="overflow-y-auto">
          <ReservarCita {...propsAgenda} onVolverServicios={onCerrar} />
        </div>
      </div>
    </div>
  );
}

function Miga() {
  return <span className="text-zinc-300">›</span>;
}

function BotonFlecha({ direccion, onClick }: { direccion: -1 | 1; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={direccion === -1 ? "Fechas anteriores" : "Más fechas"}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-aventurea-line bg-white text-aventurea-ink transition-colors hover:border-aventurea-navy"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 ${direccion === -1 ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

function BotonMiembro({
  activo,
  onClick,
  nombre,
  fotoUrl,
}: {
  activo: boolean;
  onClick: () => void;
  nombre: string;
  fotoUrl?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
      }`}
    >
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
        <img src={fotoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${
            activo ? "bg-white/20 text-white" : "bg-aventurea-blue-light text-aventurea-navy"
          }`}
        >
          {nombre.trim().charAt(0).toUpperCase()}
        </span>
      )}
      {nombre}
    </button>
  );
}
