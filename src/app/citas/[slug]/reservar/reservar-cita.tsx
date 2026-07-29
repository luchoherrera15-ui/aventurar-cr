"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtColones } from "@/lib/finanzas";
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

const DIAS_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

function fechaISOLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * El corazón del flujo Fresha: servicio → con quién → día → hora
 * libre → confirmar. Las horas se calculan contra las citas reales
 * (vista pública sin datos de nadie) y el RPC vuelve a validar todo
 * en el servidor — esto solo pinta lo disponible.
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
}) {
  const [servicioId, setServicioId] = useState(
    servicioInicial && items.some((i) => i.id === servicioInicial)
      ? servicioInicial
      : (items[0]?.id ?? ""),
  );
  const [miembroId, setMiembroId] = useState<string | null>(null);
  // Arranca en el primer día abierto de los próximos 14.
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
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

  const servicio = items.find((i) => i.id === servicioId) ?? null;
  const duracion = servicio?.duracion_minutos ?? 30;

  // Los próximos 14 días, con su día del horario (null = cerrado).
  const dias = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
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
      setExito(res.reservaId);
    });
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-[#dceeec] bg-white p-6 text-[13.5px] text-aventurea-ink-soft">
        Este negocio todavía no publicó sus servicios — consultale por el chat.
      </div>
    );
  }

  if (exito) {
    return (
      <div className="mt-6 rounded-3xl border border-[#dceeec] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aventurea-green/10 text-[26px]">
          ✓
        </span>
        <h2 className="mt-4 text-[20px] font-extrabold text-aventurea-ink">
          ¡Tu cita quedó confirmada!
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          {servicio?.nombre} en {nombreNegocio} — {diaElegido ? `${DIAS_CORTO[diaElegido.dow]} ${diaElegido.date.getDate()} de ${MESES_CORTO[diaElegido.date.getMonth()]}` : fecha}, {horaBonita(hora)}. Te mandamos el
          comprobante por correo; el pago es en el local.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/mensajes/${exito}`}
            className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
          >
            Abrir el chat del negocio
          </Link>
          <Link
            href={rutaBase}
            className="rounded-xl border border-[#dceeec] bg-white px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-[#5dc4be]"
          >
            Volver al negocio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-5">
      {/* 1. Servicio */}
      <Paso titulo="1 · Elegí el servicio">
        <div className="flex flex-col gap-2">
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServicioId(s.id)}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                s.id === servicioId
                  ? "border-[#1f7a74] bg-[#e6f6f5]"
                  : "border-[#dceeec] bg-white hover:border-[#5dc4be]"
              }`}
            >
              <span>
                <span className="block text-[13.5px] font-bold text-aventurea-ink">{s.nombre}</span>
                <span className="text-[12px] text-aventurea-ink-soft">
                  {etiquetaMinutos(s.duracion_minutos ?? 30)}
                </span>
              </span>
              <span className="text-[13.5px] font-extrabold text-aventurea-ink">
                {s.precio !== null ? fmtColones(s.precio) : "Consultar"}
              </span>
            </button>
          ))}
        </div>
      </Paso>

      {/* 2. Con quién */}
      {equipo.length > 0 && (
        <Paso titulo="2 · ¿Con quién?">
          <div className="flex flex-wrap gap-2.5">
            <BotonMiembro
              activo={miembroId === null}
              onClick={() => setMiembroId(null)}
              nombre="Cualquiera"
              rol="La primera persona libre"
            />
            {equipo.map((m) => (
              <BotonMiembro
                key={m.id}
                activo={miembroId === m.id}
                onClick={() => setMiembroId(m.id)}
                nombre={m.nombre}
                rol={m.rol}
                fotoUrl={m.foto_url}
              />
            ))}
          </div>
        </Paso>
      )}

      {/* 3. Día */}
      <Paso titulo={`${equipo.length > 0 ? 3 : 2} · Elegí el día`}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dias.map((d) => {
            const cerrado = !d.horarioDia;
            return (
              <button
                key={d.iso}
                type="button"
                disabled={cerrado}
                onClick={() => setFecha(d.iso)}
                className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors ${
                  d.iso === fecha
                    ? "border-[#1f7a74] bg-[#1f7a74] text-white"
                    : cerrado
                      ? "cursor-not-allowed border-transparent text-zinc-300"
                      : "border-[#dceeec] bg-white text-aventurea-ink hover:border-[#5dc4be]"
                }`}
              >
                <span className="text-[10px] font-bold uppercase">{DIAS_CORTO[d.dow]}</span>
                <span className="text-[16px] font-extrabold">{d.date.getDate()}</span>
                <span className="text-[9.5px] font-semibold opacity-70">
                  {MESES_CORTO[d.date.getMonth()]}
                </span>
              </button>
            );
          })}
        </div>
      </Paso>

      {/* 4. Hora */}
      <Paso titulo={`${equipo.length > 0 ? 4 : 3} · Elegí la hora`}>
        {horas.length === 0 ? (
          <p className="text-[13px] text-aventurea-ink-soft">
            No quedan espacios libres ese día — probá con otro.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {horas.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHora(h)}
                className={`rounded-lg border px-3.5 py-2 text-[13px] font-bold transition-colors ${
                  h === horaElegida
                    ? "border-[#1f7a74] bg-[#1f7a74] text-white"
                    : "border-[#dceeec] bg-white text-aventurea-ink hover:border-[#5dc4be]"
                }`}
              >
                {horaBonita(h)}
              </button>
            ))}
          </div>
        )}
      </Paso>

      {/* 5. Confirmar */}
      <Paso titulo={`${equipo.length > 0 ? 5 : 4} · Tus datos`}>
        {!sesionActiva ? (
          <div className="rounded-xl bg-[#e6f6f5] p-4 text-[13.5px] leading-relaxed text-aventurea-ink">
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
          <div className="flex flex-col gap-3">
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
              rows={2}
              className={inputCls}
            />

            {servicio && fecha && horaElegida && (
              <p className="rounded-xl bg-[#e6f6f5] px-4 py-3 text-[13px] font-semibold text-aventurea-ink">
                {servicio.nombre} · {horaBonita(horaElegida)} ·{" "}
                {etiquetaMinutos(duracion)}
                {servicio.precio !== null
                  ? ` · ${fmtColones(servicio.precio)} (se paga en el local)`
                  : ""}
              </p>
            )}

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={pending || !servicio || !fecha || !horaElegida || !nombre.trim()}
              onClick={confirmar}
              className="rounded-xl bg-aventurea-orange px-6 py-3.5 text-[14.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-50"
            >
              {pending ? "Confirmando..." : "Confirmar mi cita"}
            </button>
          </div>
        )}
      </Paso>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#dceeec] bg-white px-4 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400 focus:border-[#5dc4be] focus:outline-none";

function Paso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#dceeec] bg-white/80 p-5 backdrop-blur">
      <h3 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-[#2b8a84]">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

function BotonMiembro({
  activo,
  onClick,
  nombre,
  rol,
  fotoUrl,
}: {
  activo: boolean;
  onClick: () => void;
  nombre: string;
  rol: string | null;
  fotoUrl?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl border py-2 pl-2 pr-4 transition-colors ${
        activo ? "border-[#1f7a74] bg-[#e6f6f5]" : "border-[#dceeec] bg-white hover:border-[#5dc4be]"
      }`}
    >
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
        <img src={fotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f7a74] text-[14px] font-extrabold text-white">
          {nombre.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-left">
        <span className="block text-[13px] font-bold text-aventurea-ink">{nombre}</span>
        {rol && <span className="text-[11px] text-aventurea-ink-soft">{rol}</span>}
      </span>
    </button>
  );
}
