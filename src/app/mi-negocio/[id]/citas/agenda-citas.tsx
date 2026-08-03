"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { etiquetaMinutos, horaBonita, minutosAHora } from "@/app/citas/tipos";
import { instanteEnZona } from "@/lib/agenda/disponibilidad";
import { hoyISOCR } from "@/lib/fechas";
import { fmtColones } from "@/lib/finanzas";
import {
  cancelarCita,
  crearBloqueoAgenda,
  crearCitaManual,
  eliminarBloqueoAgenda,
  marcarAsistenciaCita,
  moverCita,
  type BloqueoAgenda,
  type ClienteReincidente,
} from "./actions";

const inputCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const btnChico =
  "h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-40";

/** Una cita del día tal como se lee de reservas (solo lo que se muestra). */
export type CitaDia = {
  id: string;
  hora_inicio: string;
  duracion_minutos: number | null;
  miembro_id: string | null;
  nombre: string | null;
  tipo_evento: string | null;
  estado:
    | "pendiente"
    | "confirmada"
    | "rechazada"
    | "bloqueada"
    | "cumplida"
    | "no_asistio"
    | "cancelada";
  correo: string | null;
  whatsapp: string | null;
  notas: string | null;
  monto_total: number | null;
  origen: string | null;
};

const ESTADO_LABEL: Record<CitaDia["estado"], string> = {
  confirmada: "Confirmada",
  pendiente: "Pendiente",
  rechazada: "Cancelada",
  bloqueada: "Bloqueada",
  cumplida: "Vino",
  no_asistio: "No vino",
  cancelada: "Cancelada",
};

const ESTADO_BADGE: Record<CitaDia["estado"], string> = {
  confirmada: "bg-aventurea-green/15 text-aventurea-green",
  pendiente: "bg-aventurea-orange/15 text-aventurea-orange",
  rechazada: "bg-red-50 text-red-700",
  bloqueada: "bg-aventurea-cream-2 text-zinc-500",
  cumplida: "bg-aventurea-navy/10 text-aventurea-navy",
  no_asistio: "bg-red-50 text-red-700",
  cancelada: "bg-red-50 text-red-700",
};

/** Piel del bloque en la vista por persona. */
const ESTADO_BLOQUE: Record<CitaDia["estado"], string> = {
  confirmada: "border-aventurea-green/40 bg-aventurea-green/10",
  pendiente: "border-aventurea-orange/50 bg-aventurea-orange/10",
  rechazada: "border-red-200 bg-red-50 opacity-60",
  bloqueada: "border-aventurea-line bg-aventurea-cream-2",
  cumplida: "border-aventurea-navy/30 bg-aventurea-navy/10",
  no_asistio: "border-red-300 bg-red-50",
  cancelada: "border-red-200 bg-red-50 opacity-60",
};

/** Estados que ocupan la franja de verdad (los cancelados no estorban). */
const OCUPAN = new Set<CitaDia["estado"]>([
  "pendiente",
  "confirmada",
  "bloqueada",
  "cumplida",
  "no_asistio",
]);

function minutosDe(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

type Miembro = {
  id: string;
  nombre: string;
  tipo: string;
  activo: boolean;
  fotoUrl?: string | null;
};
type Servicio = {
  id: string;
  nombre: string;
  duracionMinutos: number | null;
  precio: number | null;
};

const CAMPOS_CITA =
  "id, hora_inicio, duracion_minutos, miembro_id, nombre, tipo_evento, estado, correo, whatsapp, notas, monto_total, origen";

/**
 * La agenda del día del negocio de citas — el mostrador. Se ve como
 * lista o como columnas por persona (estilo Fresha), y desde acá se
 * marca la asistencia, se agenda un walk-in con hora, se reprograma,
 * se cancela y se bloquea una franja. La primera carga viene del
 * servidor (hoy); al cambiar la fecha se consulta directo desde el
 * navegador — las políticas de la base limitan la lectura al dueño.
 */
export default function AgendaCitas({
  ranchoId,
  zona,
  equipo,
  servicios,
  initialFecha,
  initialCitas,
  initialBloqueos,
}: {
  ranchoId: string;
  zona: string;
  equipo: Miembro[];
  servicios: Servicio[];
  initialFecha: string;
  initialCitas: CitaDia[];
  initialBloqueos: BloqueoAgenda[];
}) {
  const [fecha, setFecha] = useState(initialFecha);
  const [citas, setCitas] = useState<CitaDia[]>(initialCitas);
  const [bloqueos, setBloqueos] = useState<BloqueoAgenda[]>(initialBloqueos);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Por persona es la agenda "de verdad" (estilo Fresha): quién atiende
  // qué y a qué hora, de un vistazo. Arranca ahí por defecto — la lista
  // plana queda como alternativa a un clic, no como punto de partida.
  const [vista, setVista] = useState<"lista" | "personas">("personas");
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Si el dueño cambia la fecha rápido, solo interesa la última consulta.
  const ultimaFecha = useRef(initialFecha);

  // Aviso de re-enganche tras marcar un no-show.
  const [reincidente, setReincidente] = useState<ClienteReincidente | null>(null);

  // Reprogramar.
  const [reprogramando, setReprogramando] = useState<string | null>(null);
  const [destino, setDestino] = useState({ fecha: initialFecha, hora: "", miembroId: "" });
  const [avisosMover, setAvisosMover] = useState<string[]>([]);

  // Cancelar pide segundo clic (nada de confirm()).
  const [cancelando, setCancelando] = useState<string | null>(null);

  // Walk-in.
  const [creando, setCreando] = useState(false);
  const [avisosCrear, setAvisosCrear] = useState<string[]>([]);
  const CITA_VACIA = {
    servicioId: "",
    tipoEvento: "",
    hora: "",
    duracion: "",
    miembroId: "",
    nombre: "",
    telefono: "",
    correo: "",
    monto: "",
    notas: "",
  };
  const [borradorCita, setBorradorCita] = useState(CITA_VACIA);

  // Bloquear franja.
  const [bloqueando, setBloqueando] = useState(false);
  const BLOQUEO_VACIO = { miembroId: "", desde: "", hasta: "", motivo: "", diaEntero: false };
  const [borradorBloqueo, setBorradorBloqueo] = useState(BLOQUEO_VACIO);

  // Editar el formulario invalida los avisos de choque: eran de OTROS
  // datos, y dejar "agendar igual" armado saltaría la verificación.
  function cambiarCita(cambio: Partial<typeof CITA_VACIA>) {
    setBorradorCita((b) => ({ ...b, ...cambio }));
    setAvisosCrear([]);
  }
  function cambiarDestino(cambio: Partial<{ fecha: string; hora: string; miembroId: string }>) {
    setDestino((d) => ({ ...d, ...cambio }));
    setAvisosMover([]);
  }

  const nombreMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));
  const hoy = hoyISOCR();
  const esHoy = fecha === hoy;
  const esPasadoOHoy = fecha <= hoy;

  async function cargar(nueva: string) {
    setFecha(nueva);
    ultimaFecha.current = nueva;
    setSeleccionada(null);
    setCancelando(null);
    setReprogramando(null);
    // Los avisos de choque eran de OTRA consulta: con la fecha nueva
    // ya no aplican y "agendar igual" no debe quedar armado.
    setAvisosCrear([]);
    setAvisosMover([]);
    if (!nueva) return;
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const [citasRes, bloqueosRes] = await Promise.all([
      supabase
        .from("reservas")
        .select(CAMPOS_CITA)
        .eq("rancho_id", ranchoId)
        .eq("fecha", nueva)
        .not("hora_inicio", "is", null)
        .neq("estado", "temporal")
        .order("hora_inicio", { ascending: true }),
      // Amplio a propósito: el recorte fino al día lo hace bloqueoDelDia.
      supabase
        .from("bloqueos_agenda")
        .select("id, rancho_id, miembro_id, inicio, fin, motivo")
        .eq("rancho_id", ranchoId)
        .lte("inicio", `${nueva}T23:59:59+14:00`)
        .gte("fin", `${nueva}T00:00:00-12:00`),
    ]);

    if (ultimaFecha.current !== nueva) return;
    setCargando(false);
    if (citasRes.error) {
      setError("No se pudieron cargar las citas: " + citasRes.error.message);
      return;
    }
    setCitas((citasRes.data ?? []) as CitaDia[]);
    // Si los bloqueos fallan no se pintan como "no hay": se avisa y se
    // conserva lo último que sí se pudo leer.
    if (bloqueosRes.error) {
      setError("No se pudieron cargar los bloqueos: " + bloqueosRes.error.message);
    } else {
      setBloqueos((bloqueosRes.data ?? []) as BloqueoAgenda[]);
    }
  }

  // La misma página tiene otro panel de bloqueos (Bloqueos y
  // ausencias): cuando uno cambia algo, el otro se entera por este
  // evento y refresca — sin compartir estado entre secciones. El
  // `detail` dice quién lo disparó, para no refrescarse a sí mismo.
  useEffect(() => {
    const refrescarPorEvento = (e: Event) => {
      if ((e as CustomEvent).detail === "agenda") return;
      void cargar(ultimaFecha.current);
    };
    window.addEventListener("bookea:bloqueos", refrescarPorEvento);
    return () => window.removeEventListener("bookea:bloqueos", refrescarPorEvento);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargar es estable por cierre sobre refs/estado
  }, []);

  // Solo para que la línea de "ahora" en la vista por persona avance
  // sola sin recargar la página — no guarda ningún dato, solo fuerza
  // el re-render cada minuto para releer new Date() en el render.
  const [, marcarTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => marcarTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  /** El pedazo de un bloqueo que cae dentro del día visible, en minutos. */
  function bloqueoDelDia(b: BloqueoAgenda): { inicio: number; fin: number } | null {
    const ini = instanteEnZona(b.inicio, zona);
    const fin = instanteEnZona(b.fin, zona);
    if (fin.fecha < fecha || ini.fecha > fecha) return null;
    const rango = {
      inicio: ini.fecha === fecha ? ini.minutos : 0,
      fin: fin.fecha === fecha ? fin.minutos : 1440,
    };
    // Un bloqueo que termina justo a medianoche "toca" el día pero no
    // ocupa ni un minuto — no hay nada que pintar.
    return rango.fin > rango.inicio ? rango : null;
  }
  const bloqueosDia = bloqueos
    .map((b) => ({ bloqueo: b, rango: bloqueoDelDia(b) }))
    .filter((x): x is { bloqueo: BloqueoAgenda; rango: { inicio: number; fin: number } } =>
      x.rango !== null,
    );

  function marcar(cita: CitaDia, asistencia: "cumplida" | "no_asistio") {
    setError(null);
    setReincidente(null);
    startTransition(async () => {
      const res = await marcarAsistenciaCita(ranchoId, cita.id, asistencia);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.reincidente) setReincidente(res.reincidente);
      await cargar(fecha);
    });
  }

  function cancelar(cita: CitaDia) {
    if (cancelando !== cita.id) {
      setCancelando(cita.id);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cancelarCita(ranchoId, cita.id);
      setCancelando(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      await cargar(fecha);
    });
  }

  function abrirReprogramar(cita: CitaDia) {
    setReprogramando(cita.id);
    setAvisosMover([]);
    setDestino({
      fecha,
      hora: cita.hora_inicio.slice(0, 5),
      miembroId: cita.miembro_id ?? "",
    });
  }

  function reprogramar(citaId: string, ignorarAvisos: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await moverCita(
        ranchoId,
        citaId,
        {
          fecha: destino.fecha,
          hora: destino.hora,
          miembroId: destino.miembroId || null,
        },
        { ignorarAvisos },
      );
      if (res.advertencias && res.advertencias.length > 0) {
        setAvisosMover(res.advertencias);
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      setReprogramando(null);
      setAvisosMover([]);
      await cargar(fecha);
    });
  }

  function elegirServicio(servicioId: string) {
    setAvisosCrear([]);
    const servicio = servicios.find((s) => s.id === servicioId);
    setBorradorCita((b) => ({
      ...b,
      servicioId,
      duracion: servicio?.duracionMinutos ? String(servicio.duracionMinutos) : b.duracion,
      monto: servicio?.precio !== null && servicio?.precio !== undefined ? String(servicio.precio) : b.monto,
    }));
  }

  function crearWalkIn(ignorarAvisos: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await crearCitaManual(
        ranchoId,
        {
          fecha,
          hora: borradorCita.hora,
          duracionMinutos: borradorCita.duracion ? Number(borradorCita.duracion) : null,
          miembroId: borradorCita.miembroId || null,
          itemId: borradorCita.servicioId || null,
          tipoEvento: borradorCita.tipoEvento,
          nombre: borradorCita.nombre,
          telefono: borradorCita.telefono,
          correo: borradorCita.correo,
          notas: borradorCita.notas,
          monto: borradorCita.monto ? Number(borradorCita.monto) : null,
        },
        { ignorarAvisos },
      );
      if (res.advertencias && res.advertencias.length > 0) {
        setAvisosCrear(res.advertencias);
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      setCreando(false);
      setAvisosCrear([]);
      setBorradorCita(CITA_VACIA);
      await cargar(fecha);
    });
  }

  function crearBloqueo() {
    setError(null);
    const desde = borradorBloqueo.diaEntero ? "00:00" : borradorBloqueo.desde;
    const hasta = borradorBloqueo.diaEntero ? "23:59" : borradorBloqueo.hasta;
    startTransition(async () => {
      const res = await crearBloqueoAgenda(ranchoId, {
        miembroId: borradorBloqueo.miembroId || null,
        fechaInicio: fecha,
        horaInicio: desde,
        fechaFin: fecha,
        horaFin: hasta,
        motivo: borradorBloqueo.motivo,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setBloqueando(false);
      setBorradorBloqueo(BLOQUEO_VACIO);
      await cargar(fecha);
      window.dispatchEvent(new CustomEvent("bookea:bloqueos", { detail: "agenda" }));
    });
  }

  function quitarBloqueo(bloqueoId: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarBloqueoAgenda(ranchoId, bloqueoId);
      if (res.error) {
        setError(res.error);
        return;
      }
      await cargar(fecha);
      window.dispatchEvent(new CustomEvent("bookea:bloqueos", { detail: "agenda" }));
    });
  }

  // ---------- Vista por persona (columnas estilo Fresha) ----------

  const conAgenda = citas.filter((c) => OCUPAN.has(c.estado));
  // Los bloqueos del negocio entero se pintan en TODAS las columnas —
  // no ameritan una columna "Sin asignar" propia.
  const haySinAsignar = conAgenda.some((c) => c.miembro_id === null);
  // Una persona pausada con citas ese día igual necesita su columna —
  // sus citas no pueden desaparecer de la vista.
  const conCitasDelDia = new Set(conAgenda.map((c) => c.miembro_id));
  const columnas: { id: string | null; nombre: string; fotoUrl: string | null }[] = [
    ...equipo
      .filter((m) => m.activo || conCitasDelDia.has(m.id))
      .map((m) => ({ id: m.id as string | null, nombre: m.nombre, fotoUrl: m.fotoUrl ?? null })),
    ...(haySinAsignar || equipo.filter((m) => m.activo).length === 0
      ? [{ id: null, nombre: equipo.length > 0 ? "Sin asignar" : "El negocio", fotoUrl: null }]
      : []),
  ];

  const minutosDia = conAgenda.flatMap((c) => {
    const ini = minutosDe(c.hora_inicio.slice(0, 5));
    return [ini, ini + (c.duracion_minutos ?? 30)];
  });
  const minutosBloqueos = bloqueosDia.flatMap((x) => [x.rango.inicio, x.rango.fin]);
  const desdeMin = Math.min(8 * 60, ...minutosDia, ...minutosBloqueos.map((m) => Math.max(m, 0)));
  const hastaMin = Math.max(18 * 60, ...minutosDia, ...minutosBloqueos.map((m) => Math.min(m, 1440)));
  const inicioGrilla = Math.floor(desdeMin / 60) * 60;
  const finGrilla = Math.ceil(hastaMin / 60) * 60;
  const altoGrilla = finGrilla - inicioGrilla; // 1 min = 1 px

  // La línea de "ahora": solo tiene sentido si el día que se está
  // viendo es HOY y cae dentro del rango visible de la grilla.
  const ahora = instanteEnZona(new Date().toISOString(), zona);
  const lineaAhoraMin =
    ahora.fecha === fecha && ahora.minutos >= inicioGrilla && ahora.minutos <= finGrilla
      ? ahora.minutos
      : null;

  const detalle = (cita: CitaDia) => (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-aventurea-ink-soft">
        {cita.whatsapp && <span>📞 {cita.whatsapp}</span>}
        {cita.correo && <span>{cita.correo}</span>}
        {cita.monto_total !== null && (
          <span className="font-bold text-aventurea-ink">
            {fmtColones(Number(cita.monto_total))}
          </span>
        )}
        {cita.origen === "sync" && <span>Viene de tu calendario externo.</span>}
      </div>
      {cita.notas && (
        <p className="text-[12.5px] text-aventurea-ink-soft">📝 {cita.notas}</p>
      )}

      {cita.estado !== "bloqueada" && (
        <div className="flex flex-wrap gap-1.5">
          {esPasadoOHoy && ["confirmada", "cumplida", "no_asistio"].includes(cita.estado) && (
            <>
              <button
                type="button"
                disabled={pending || cita.estado === "cumplida"}
                onClick={() => marcar(cita, "cumplida")}
                className={`h-[30px] rounded-lg px-3 text-xs font-bold disabled:opacity-40 ${
                  cita.estado === "cumplida"
                    ? "bg-aventurea-navy text-white"
                    : "border border-aventurea-green/50 bg-white text-aventurea-green hover:bg-aventurea-green/10"
                }`}
              >
                ✓ Vino
              </button>
              <button
                type="button"
                disabled={pending || cita.estado === "no_asistio"}
                onClick={() => marcar(cita, "no_asistio")}
                className={`h-[30px] rounded-lg px-3 text-xs font-bold disabled:opacity-40 ${
                  cita.estado === "no_asistio"
                    ? "bg-red-600 text-white"
                    : "border border-red-300 bg-white text-red-700 hover:bg-red-50"
                }`}
              >
                ✕ No vino
              </button>
            </>
          )}
          {["pendiente", "confirmada"].includes(cita.estado) && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  reprogramando === cita.id ? setReprogramando(null) : abrirReprogramar(cita)
                }
                className={btnChico}
              >
                Reprogramar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => cancelar(cita)}
                className={`h-[30px] rounded-lg px-2.5 text-xs font-bold disabled:opacity-40 ${
                  cancelando === cita.id
                    ? "bg-red-600 text-white"
                    : "border border-aventurea-line bg-aventurea-cream-2 text-red-700 hover:border-red-300"
                }`}
              >
                {cancelando === cita.id ? "¿Confirmar cancelación?" : "Cancelar cita"}
              </button>
            </>
          )}
        </div>
      )}

      {reprogramando === cita.id && (
        <div className="flex flex-col gap-2 rounded-xl border border-aventurea-line bg-white p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={labelCls}>Nueva fecha</label>
              <input
                type="date"
                value={destino.fecha}
                onChange={(e) => cambiarDestino({ fecha: e.target.value })}
                className={`${inputCls} min-w-[150px]`}
              />
            </div>
            <div>
              <label className={labelCls}>Hora</label>
              <input
                type="time"
                value={destino.hora}
                onChange={(e) => cambiarDestino({ hora: e.target.value })}
                className={`${inputCls} min-w-[110px]`}
              />
            </div>
            {equipo.length > 0 && (
              <div className="min-w-0 max-w-full">
                <label className={labelCls}>Con</label>
                <select
                  value={destino.miembroId}
                  onChange={(e) => cambiarDestino({ miembroId: e.target.value })}
                  className={`${inputCls} max-w-full`}
                >
                  <option value="">Sin asignar</option>
                  {equipo
                    .filter((m) => m.activo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <button
              type="button"
              disabled={pending || !destino.hora}
              onClick={() => reprogramar(cita.id, false)}
              className="h-[42px] rounded-xl bg-aventurea-orange px-4 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
            >
              Mover
            </button>
          </div>
          {avisosMover.length > 0 && (
            <div className="rounded-xl border border-aventurea-orange/40 bg-aventurea-orange-light p-3 text-[12.5px] text-aventurea-ink">
              <p className="font-bold">Ojo antes de mover:</p>
              <ul className="mt-1 list-disc pl-4">
                {avisosMover.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={pending}
                onClick={() => reprogramar(cita.id, true)}
                className="mt-2 rounded-lg bg-aventurea-navy px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                Mover igual
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const tarjetaCita = (cita: CitaDia) => (
    <div key={cita.id} className="border-b border-aventurea-line px-4 py-3 last:border-none">
      <button
        type="button"
        onClick={() => setSeleccionada(seleccionada === cita.id ? null : cita.id)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 text-left"
      >
        <div className="w-[92px] shrink-0">
          <p className="text-[14px] font-bold text-aventurea-ink">
            {horaBonita(cita.hora_inicio.slice(0, 5))}
          </p>
          <p className="text-[11.5px] text-zinc-500">
            {etiquetaMinutos(cita.duracion_minutos ?? 30)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-aventurea-ink">
            {cita.tipo_evento ?? (cita.estado === "bloqueada" ? "Franja bloqueada" : "Servicio")}
          </p>
          <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
            {cita.nombre ?? (cita.estado === "bloqueada" ? "—" : "Cliente")}
            {cita.miembro_id && (
              <>
                {" "}
                · con{" "}
                <span className="font-bold text-aventurea-navy">
                  {nombreMiembro.get(cita.miembro_id) ?? "alguien que ya no está en el equipo"}
                </span>
              </>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-3 py-1 text-[11.5px] font-bold ${ESTADO_BADGE[cita.estado] ?? "bg-aventurea-cream-2 text-zinc-500"}`}
        >
          {ESTADO_LABEL[cita.estado] ?? cita.estado}
        </span>
      </button>
      {seleccionada === cita.id && detalle(cita)}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={fecha}
          onChange={(e) => cargar(e.target.value)}
          aria-label="Fecha de la agenda"
          className={`${inputCls} min-w-[150px]`}
        />
        {!esHoy && (
          <button
            type="button"
            onClick={() => cargar(hoyISOCR())}
            className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            Volver a hoy
          </button>
        )}
        <span className="text-[13px] text-aventurea-ink-soft">
          {cargando
            ? "Cargando..."
            : `${citas.length} cita${citas.length === 1 ? "" : "s"}${esHoy ? " hoy" : ""}`}
        </span>
        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
          {equipo.filter((m) => m.activo).length > 0 && (
            <button
              type="button"
              onClick={() => setVista(vista === "lista" ? "personas" : "lista")}
              className={btnChico}
            >
              {vista === "lista" ? "Ver por persona" : "Ver como lista"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCreando(!creando);
              setBloqueando(false);
              setAvisosCrear([]);
            }}
            className={`h-[30px] rounded-lg px-3 text-xs font-bold ${
              creando
                ? "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink"
                : "bg-aventurea-orange text-white hover:bg-aventurea-orange-dark"
            }`}
          >
            {creando ? "Cerrar" : "+ Nueva cita"}
          </button>
          <button
            type="button"
            onClick={() => {
              setBloqueando(!bloqueando);
              setCreando(false);
            }}
            className={btnChico}
          >
            {bloqueando ? "Cerrar" : "Bloquear franja"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}

      {reincidente && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-aventurea-orange/50 bg-aventurea-orange-light p-3.5 text-[13px] text-aventurea-ink">
          <span>
            ⚠ <strong>{reincidente.nombre ?? "Este cliente"}</strong> faltó a sus últimas{" "}
            {reincidente.fallosSeguidos} citas seguidas.
            {reincidente.correo
              ? " Podés mandarle una promoción para recuperarlo desde la sección Clientes."
              : " No dejó correo — quizá valga un mensaje por WhatsApp."}
          </span>
          {reincidente.correo && (
            <a
              href="#clientes"
              className="rounded-lg bg-aventurea-navy px-3 py-1.5 text-xs font-bold text-white"
              onClick={() => setReincidente(null)}
            >
              Ir a Clientes
            </a>
          )}
          <button
            type="button"
            onClick={() => setReincidente(null)}
            className="ml-auto text-xs font-bold text-aventurea-ink-soft underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {creando && (
        <div className="flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
          <h3 className="text-[15px] font-bold text-aventurea-ink">
            Nueva cita — {fecha}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {servicios.length > 0 && (
              <div>
                <label className={labelCls}>Servicio</label>
                <select
                  value={borradorCita.servicioId}
                  onChange={(e) => elegirServicio(e.target.value)}
                  className={`${inputCls} w-full`}
                >
                  <option value="">Otro (texto libre)</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                      {s.duracionMinutos ? ` · ${etiquetaMinutos(s.duracionMinutos)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!borradorCita.servicioId && (
              <div>
                <label className={labelCls}>¿Qué se va a hacer?</label>
                <input
                  type="text"
                  value={borradorCita.tipoEvento}
                  onChange={(e) =>
                    cambiarCita({ tipoEvento: e.target.value })
                  }
                  placeholder="Ej. Corte y barba"
                  className={`${inputCls} w-full`}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Hora</label>
              <input
                type="time"
                value={borradorCita.hora}
                onChange={(e) => cambiarCita({ hora: e.target.value })}
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className={labelCls}>Duración (min)</label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={borradorCita.duracion}
                onChange={(e) =>
                  cambiarCita({ duracion: e.target.value })
                }
                placeholder="30"
                className={`${inputCls} w-full`}
              />
            </div>
            {equipo.filter((m) => m.activo).length > 0 && (
              <div>
                <label className={labelCls}>Con</label>
                <select
                  value={borradorCita.miembroId}
                  onChange={(e) =>
                    cambiarCita({ miembroId: e.target.value })
                  }
                  className={`${inputCls} w-full`}
                >
                  <option value="">Sin asignar</option>
                  {equipo
                    .filter((m) => m.activo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Cliente</label>
              <input
                type="text"
                value={borradorCita.nombre}
                onChange={(e) => cambiarCita({ nombre: e.target.value })}
                placeholder="Nombre"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className={labelCls}>Teléfono (opcional)</label>
              <input
                type="tel"
                value={borradorCita.telefono}
                onChange={(e) =>
                  cambiarCita({ telefono: e.target.value })
                }
                placeholder="8888-8888"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className={labelCls}>Correo (opcional, para recordatorios)</label>
              <input
                type="email"
                value={borradorCita.correo}
                onChange={(e) => cambiarCita({ correo: e.target.value })}
                placeholder="cliente@correo.com"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className={labelCls}>Monto en ₡ (opcional)</label>
              <input
                type="number"
                min={0}
                value={borradorCita.monto}
                onChange={(e) => cambiarCita({ monto: e.target.value })}
                className={`${inputCls} w-full`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas (opcional)</label>
              <input
                type="text"
                value={borradorCita.notas}
                onChange={(e) => cambiarCita({ notas: e.target.value })}
                className={`${inputCls} w-full`}
              />
            </div>
          </div>

          {avisosCrear.length > 0 && (
            <div className="rounded-xl border border-aventurea-orange/40 bg-aventurea-orange-light p-3 text-[12.5px] text-aventurea-ink">
              <p className="font-bold">Ojo antes de agendar:</p>
              <ul className="mt-1 list-disc pl-4">
                {avisosCrear.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !borradorCita.hora || !borradorCita.nombre.trim()}
              onClick={() => crearWalkIn(avisosCrear.length > 0)}
              className="rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
            >
              {pending
                ? "Guardando..."
                : avisosCrear.length > 0
                  ? "Agendar igual"
                  : "Agendar"}
            </button>
            {avisosCrear.length > 0 && (
              <button
                type="button"
                onClick={() => setAvisosCrear([])}
                className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft"
              >
                Cambiar datos
              </button>
            )}
          </div>
        </div>
      )}

      {bloqueando && (
        <div className="flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
          <h3 className="text-[15px] font-bold text-aventurea-ink">
            Bloquear franja — {fecha}
          </h3>
          <p className="text-[12.5px] text-aventurea-ink-soft">
            Nadie puede reservar en una franja bloqueada (almuerzo, un mandado,
            una cita externa). Para vacaciones de varios días usá la sección
            Bloqueos y ausencias.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {equipo.filter((m) => m.activo).length > 0 && (
              <div className="min-w-0 max-w-full">
                <label className={labelCls}>Aplica a</label>
                <select
                  value={borradorBloqueo.miembroId}
                  onChange={(e) =>
                    setBorradorBloqueo({ ...borradorBloqueo, miembroId: e.target.value })
                  }
                  className={`${inputCls} max-w-full`}
                >
                  <option value="">Todo el negocio</option>
                  {equipo
                    .filter((m) => m.activo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        Solo {m.nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 pb-2.5 text-[13px] text-aventurea-ink">
              <input
                type="checkbox"
                checked={borradorBloqueo.diaEntero}
                onChange={(e) =>
                  setBorradorBloqueo({ ...borradorBloqueo, diaEntero: e.target.checked })
                }
              />
              Todo el día
            </label>
            {!borradorBloqueo.diaEntero && (
              <>
                <div>
                  <label className={labelCls}>Desde</label>
                  <input
                    type="time"
                    value={borradorBloqueo.desde}
                    onChange={(e) =>
                      setBorradorBloqueo({ ...borradorBloqueo, desde: e.target.value })
                    }
                    className={`${inputCls} min-w-[110px]`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hasta</label>
                  <input
                    type="time"
                    value={borradorBloqueo.hasta}
                    onChange={(e) =>
                      setBorradorBloqueo({ ...borradorBloqueo, hasta: e.target.value })
                    }
                    className={`${inputCls} min-w-[110px]`}
                  />
                </div>
              </>
            )}
            <div className="min-w-[180px] flex-1">
              <label className={labelCls}>Motivo (solo lo ves vos)</label>
              <input
                type="text"
                value={borradorBloqueo.motivo}
                onChange={(e) =>
                  setBorradorBloqueo({ ...borradorBloqueo, motivo: e.target.value })
                }
                placeholder="Ej. Almuerzo"
                className={`${inputCls} w-full`}
              />
            </div>
            <button
              type="button"
              disabled={
                pending ||
                (!borradorBloqueo.diaEntero &&
                  (!borradorBloqueo.desde || !borradorBloqueo.hasta))
              }
              onClick={crearBloqueo}
              className="h-[42px] rounded-xl bg-aventurea-navy px-5 text-[13.5px] font-bold text-white disabled:opacity-60"
            >
              Bloquear
            </button>
          </div>
        </div>
      )}

      {bloqueosDia.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {bloqueosDia.map(({ bloqueo, rango }) => (
            <span
              key={bloqueo.id}
              className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-3 py-1.5 text-[12px] text-aventurea-ink-soft"
            >
              ⛔ {bloqueo.miembro_id ? (nombreMiembro.get(bloqueo.miembro_id) ?? "—") : "Negocio"}
              {" · "}
              {rango.inicio === 0 && rango.fin === 1440
                ? "todo el día"
                : `${horaBonita(`${String(Math.floor(rango.inicio / 60)).padStart(2, "0")}:${String(rango.inicio % 60).padStart(2, "0")}`)} – ${horaBonita(`${String(Math.floor(rango.fin / 60)).padStart(2, "0")}:${String(rango.fin % 60).padStart(2, "0")}`)}`}
              {bloqueo.motivo ? ` · ${bloqueo.motivo}` : ""}
              <button
                type="button"
                disabled={pending}
                onClick={() => quitarBloqueo(bloqueo.id)}
                aria-label="Quitar bloqueo"
                className="font-bold text-red-700 hover:underline"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {!cargando && citas.length === 0 && !error && (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
          {esHoy ? "Hoy no tenés citas agendadas." : "Ese día no hay citas agendadas."}
        </p>
      )}

      {vista === "lista" && citas.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {citas.map((cita) => tarjetaCita(cita))}
        </div>
      )}

      {vista === "personas" && citas.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface p-4">
          <div className="flex min-w-fit gap-3">
            {/* Eje de horas */}
            <div className="relative w-[46px] shrink-0" style={{ height: altoGrilla + 28 }}>
              {Array.from(
                { length: (finGrilla - inicioGrilla) / 60 + 1 },
                (_, i) => inicioGrilla + i * 60,
              ).map((min) => (
                <span
                  key={min}
                  className="absolute right-1 text-[10.5px] font-bold text-zinc-400"
                  style={{ top: min - inicioGrilla + 22 }}
                >
                  {String(Math.floor(min / 60)).padStart(2, "0")}:00
                </span>
              ))}
              {lineaAhoraMin !== null && (
                <span
                  className="absolute right-1 z-10 rounded bg-aventurea-orange px-1 py-0.5 text-[9.5px] font-bold text-white"
                  style={{ top: lineaAhoraMin - inicioGrilla + 16 }}
                >
                  {horaBonita(minutosAHora(lineaAhoraMin))}
                </span>
              )}
            </div>
            {columnas.map((col) => {
              const citasCol = conAgenda.filter((c) => c.miembro_id === col.id);
              const bloqueosCol = bloqueosDia.filter(
                (x) => x.bloqueo.miembro_id === col.id || x.bloqueo.miembro_id === null,
              );
              return (
                <div key={col.id ?? "sin"} className="w-[160px] shrink-0 sm:w-[190px]">
                  <div className="mb-1.5 flex flex-col items-center gap-1">
                    {col.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
                      <img
                        src={col.fotoUrl}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-aventurea-navy/10 text-[11px] font-bold text-aventurea-navy">
                        {col.nombre.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <p className="truncate text-center text-[12px] font-bold text-aventurea-navy">
                      {col.nombre}
                    </p>
                  </div>
                  <div
                    className="relative cursor-pointer rounded-xl border border-aventurea-line bg-aventurea-cream-2/60"
                    style={{ height: altoGrilla }}
                    title="Hacé clic en un hueco libre para agendar ahí"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const minutosClic = inicioGrilla + Math.round(e.clientY - rect.top);
                      const redondeado = Math.min(
                        Math.max(Math.round(minutosClic / 15) * 15, 0),
                        1439,
                      );
                      const enBloqueo = bloqueosCol.some(
                        ({ rango }) => redondeado >= rango.inicio && redondeado < rango.fin,
                      );
                      if (enBloqueo) return;
                      setSeleccionada(null);
                      setBloqueando(false);
                      setAvisosCrear([]);
                      setCreando(true);
                      setBorradorCita((b) => ({
                        ...b,
                        hora: minutosAHora(redondeado),
                        miembroId: col.id ?? "",
                      }));
                    }}
                  >
                    {Array.from(
                      { length: (finGrilla - inicioGrilla) / 30 },
                      (_, i) => inicioGrilla + i * 30,
                    ).map((min) => (
                      <div
                        key={min}
                        className={`pointer-events-none absolute left-0 right-0 border-t ${
                          min % 60 === 0 ? "border-aventurea-line/50" : "border-aventurea-line/25"
                        }`}
                        style={{ top: min - inicioGrilla }}
                      />
                    ))}
                    {bloqueosCol.map(({ bloqueo, rango }) => (
                      <div
                        key={bloqueo.id}
                        title={bloqueo.motivo ?? "Bloqueado"}
                        className="pointer-events-none absolute left-1 right-1 rounded-lg bg-zinc-400/20"
                        style={{
                          top: Math.max(rango.inicio, inicioGrilla) - inicioGrilla,
                          height:
                            Math.min(rango.fin, finGrilla) -
                            Math.max(rango.inicio, inicioGrilla),
                        }}
                      />
                    ))}
                    {citasCol.map((cita) => {
                      const ini = minutosDe(cita.hora_inicio.slice(0, 5));
                      const dur = cita.duracion_minutos ?? 30;
                      return (
                        <button
                          key={cita.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSeleccionada(seleccionada === cita.id ? null : cita.id);
                          }}
                          className={`absolute left-1 right-1 overflow-hidden rounded-lg border px-1.5 py-0.5 text-left ${ESTADO_BLOQUE[cita.estado]} ${
                            seleccionada === cita.id ? "ring-2 ring-aventurea-orange" : ""
                          }`}
                          style={{ top: ini - inicioGrilla, height: Math.max(dur, 22) }}
                        >
                          <span className="block truncate text-[11px] font-bold text-aventurea-ink">
                            {cita.hora_inicio.slice(0, 5)} {cita.nombre ?? ""}
                          </span>
                          {dur >= 40 && (
                            <span className="block truncate text-[10.5px] text-aventurea-ink-soft">
                              {cita.tipo_evento ?? ""}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {lineaAhoraMin !== null && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-aventurea-orange"
                        style={{ top: lineaAhoraMin - inicioGrilla }}
                      >
                        <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-aventurea-orange" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {seleccionada && citas.find((c) => c.id === seleccionada) ? (
            (() => {
              const cita = citas.find((c) => c.id === seleccionada)!;
              return (
                <div className="mt-3 rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-aventurea-ink">
                        {horaBonita(cita.hora_inicio.slice(0, 5))} ·{" "}
                        {cita.tipo_evento ??
                          (cita.estado === "bloqueada" ? "Franja bloqueada" : "Servicio")}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                        {cita.nombre ?? (cita.estado === "bloqueada" ? "—" : "Cliente")}
                        {cita.miembro_id && (
                          <>
                            {" "}
                            · con{" "}
                            <span className="font-bold text-aventurea-navy">
                              {nombreMiembro.get(cita.miembro_id) ??
                                "alguien que ya no está en el equipo"}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-lg px-3 py-1 text-[11.5px] font-bold ${ESTADO_BADGE[cita.estado] ?? "bg-aventurea-cream-2 text-zinc-500"}`}
                      >
                        {ESTADO_LABEL[cita.estado] ?? cita.estado}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSeleccionada(null)}
                        aria-label="Cerrar"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-aventurea-ink-soft hover:bg-aventurea-surface"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {detalle(cita)}
                </div>
              );
            })()
          ) : (
            <p className="mt-2 text-[11.5px] text-zinc-500">
              Tocá una cita para ver el detalle y marcar asistencia, o un hueco libre para
              agendar ahí mismo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
