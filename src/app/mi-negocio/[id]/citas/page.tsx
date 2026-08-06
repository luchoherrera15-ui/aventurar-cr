import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISOCR, fmtFechaCorta, sumarDiasISO } from "@/lib/fechas";
import { fmtColones } from "@/lib/finanzas";
import { horarioDeDetalles } from "@/app/citas/tipos";
import { agruparClientes, type ReservaCliente } from "@/lib/crm-citas";
import EquipoPanel from "./equipo-panel";
import HorarioForm from "./horario-form";
import CitasTabs from "./citas-tabs";
import { type CitaDia } from "./agenda-citas";
import ClientesPanel from "./clientes-panel";
import BloqueosPanel from "./bloqueos-panel";
import ReportesCitas from "./reportes-citas";
import ListaEsperaPanel from "./lista-espera-panel";
import DepositoCitasForm from "./deposito-citas-form";
import type { BloqueoAgenda, MiembroEquipo, RangoHorarioMiembro } from "./actions";

type Giftcard = {
  id: string;
  codigo: string;
  monto: number;
  saldo: number;
  comprador_nombre: string | null;
  beneficiario_nombre: string | null;
  estado: "activa" | "canjeada" | "vencida";
  created_at: string;
  vence_en: string | null;
};

/**
 * Las campañas de correo (enviarCampanaNegocio) se despachan como
 * server action de ESTA ruta: 200 destinatarios en lotes con pausa
 * necesitan más que el timeout por defecto de una función serverless
 * (paridad con /api/citas/campanas, que declara lo mismo).
 */
export const maxDuration = 300;

const GIFTCARD_ESTADO: Record<Giftcard["estado"], { label: string; cls: string }> = {
  activa: { label: "Activa", cls: "bg-aventurea-green-light text-aventurea-green" },
  canjeada: { label: "Canjeada", cls: "bg-zinc-100 text-zinc-500" },
  vencida: { label: "Vencida", cls: "bg-red-50 text-red-700" },
};

/**
 * El centro de operación del negocio de citas: la agenda del día (con
 * asistencia, walk-ins y bloqueos), los clientes con sus alertas de
 * no-show y re-enganche, el equipo con horarios y servicios por
 * persona, el horario semanal y las giftcards. Solo existe para los
 * negocios con vertical 'citas'; el resto del panel (publicación,
 * catálogo, cobros) sigue viviendo en /mi-negocio/[id].
 */
export default async function CitasConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-negocio/login");

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  // Mismo control de acceso que el panel: el dueño siempre, y un admin
  // que entra a ayudar en nombre del proveedor.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  if (rancho.owner_id !== user.id && perfil?.rol !== "admin") notFound();

  // Esta pantalla es solo de la vertical de citas.
  if (rancho.vertical !== "citas") redirect(`/mi-negocio/${id}`);

  const hoy = hoyISOCR();
  const zona = rancho.zona_horaria || "America/Costa_Rica";
  const [
    equipoRes,
    citasRes,
    bloqueosRes,
    serviciosRes,
    horariosRes,
    asignacionesRes,
    crmRes,
    giftcardsRes,
  ] = await Promise.all([
    supabase
      .from("equipo_rancho")
      .select("*")
      .eq("rancho_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    // La agenda de hoy: la primera carga sale del servidor y el cambio
    // de fecha se consulta desde el navegador (RLS limita al dueño).
    // Mismos campos que el refetch del cliente (agenda-citas.tsx,
    // CAMPOS_CITA) — si difieren, la agenda de HOY se ve distinta (sin
    // cobro/contacto) hasta que el dueño cambie de fecha una vez.
    supabase
      .from("reservas")
      .select(
        "id, hora_inicio, duracion_minutos, miembro_id, nombre, tipo_evento, estado, correo, whatsapp, contacto, notas, monto_total, origen, evento_pagado, monto_cobrado_final",
      )
      .eq("rancho_id", id)
      .eq("fecha", hoy)
      .not("hora_inicio", "is", null)
      .neq("estado", "temporal")
      .order("hora_inicio", { ascending: true }),
    // Bloqueos vigentes y futuros (los vencidos hace más de un día ya
    // no le sirven a nadie).
    supabase
      .from("bloqueos_agenda")
      .select("id, rancho_id, miembro_id, inicio, fin, motivo")
      .eq("rancho_id", id)
      .gte("fin", `${sumarDiasISO(hoy, -1)}T00:00:00-06:00`)
      .order("inicio", { ascending: true }),
    // Los servicios de cita del catálogo (para walk-ins y asignación).
    supabase
      .from("rancho_items")
      .select("id, nombre, duracion_minutos, precio, activo")
      .eq("rancho_id", id)
      .not("duracion_minutos", "is", null)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    // Horario propio por miembro (0061), del negocio completo.
    supabase
      .from("horarios_recurso")
      .select("miembro_id, dow, abre, cierra, equipo_rancho!inner(rancho_id)")
      .eq("equipo_rancho.rancho_id", id),
    // Quién da qué servicio (0061), del negocio completo.
    supabase
      .from("servicios_recurso")
      .select("item_id, miembro_id, rancho_items!inner(rancho_id)")
      .eq("rancho_items.rancho_id", id),
    // La materia prima del CRM: las citas del negocio (con hora). La
    // ficha se deriva acá y no se guarda en ninguna tabla (D-3).
    supabase
      .from("reservas")
      .select("id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total")
      .eq("rancho_id", id)
      .not("hora_inicio", "is", null)
      .order("fecha", { ascending: false })
      .limit(3000),
    // Las ventas de giftcards (RLS: solo el dueño o un admin las ven).
    supabase
      .from("giftcards")
      .select(
        "id, codigo, monto, saldo, comprador_nombre, beneficiario_nombre, estado, created_at, vence_en",
      )
      .eq("rancho_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const equipo = (equipoRes.data ?? []) as MiembroEquipo[];
  const citasHoy = (citasRes.data ?? []) as CitaDia[];
  const bloqueos = (bloqueosRes.data ?? []) as BloqueoAgenda[];
  const horario = horarioDeDetalles(rancho.detalles);
  const errorCarga = equipoRes.error ?? citasRes.error;

  const servicios = (serviciosRes.data ?? []).map((s) => ({
    id: s.id as string,
    nombre: s.nombre as string,
    duracionMinutos: (s.duracion_minutos as number | null) ?? null,
    precio: s.precio === null ? null : Number(s.precio),
  }));

  const horariosPorMiembro: Record<string, RangoHorarioMiembro[]> = {};
  for (const h of (horariosRes.data ?? []) as unknown as {
    miembro_id: string;
    dow: number;
    abre: string;
    cierra: string;
  }[]) {
    (horariosPorMiembro[h.miembro_id] ??= []).push({
      dow: h.dow,
      abre: String(h.abre).slice(0, 5),
      cierra: String(h.cierra).slice(0, 5),
    });
  }

  const asignaciones = ((asignacionesRes.data ?? []) as unknown as {
    item_id: string;
    miembro_id: string;
  }[]).map((a) => ({ item_id: a.item_id, miembro_id: a.miembro_id }));

  const clientes = agruparClientes((crmRes.data ?? []) as ReservaCliente[], hoy);

  // Depósito para citas (0095) — con la base sin migrar queda null.
  const brutoDeposito = (rancho as Record<string, unknown>).deposito_citas;
  const depositoCitas =
    typeof brutoDeposito === "number" || typeof brutoDeposito === "string"
      ? Number(brutoDeposito)
      : null;
  const tieneSinpe = !!(rancho as Record<string, unknown>).sinpe_numero;

  // Si la tabla aún no existe (migración 0059 sin correr) se muestra
  // el aviso dentro de su sección, sin tumbar el resto del panel.
  const giftcards = (giftcardsRes.data ?? []) as Giftcard[];
  const giftcardsSinTabla = !!giftcardsRes.error;
  const giftVendido = giftcards.reduce((s, g) => s + Number(g.monto), 0);
  const giftPorCanjear = giftcards
    .filter((g) => g.estado === "activa")
    .reduce((s, g) => s + Number(g.saldo), 0);

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-12">
      <Link
        href={`/mi-negocio/${rancho.id}`}
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver al panel de {rancho.nombre}
      </Link>

      <h1 className="mt-4 text-[22px] font-bold text-aventurea-ink">Citas</h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Tu agenda del día, tus clientes y tu equipo. Con esto configurado, el
        cliente reserva su cita en línea y queda confirmada al instante.
      </p>

      {errorCarga && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
          <strong>Faltan las migraciones.</strong> No se pudo leer la
          configuración de citas: {errorCarga.message}. Corré{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
            supabase/aplicar-migraciones-pendientes.sql
          </code>{" "}
          en el SQL Editor de Supabase y volvé a entrar.
        </div>
      )}

      <div className="mt-8 flex flex-col gap-10">
        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
            Agenda del día
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Marcá quién vino y quién no, agendá walk-ins con hora y bloqueá
            franjas — como en el mostrador.
          </p>
          <CitasTabs
            ranchoId={rancho.id}
            zona={zona}
            equipo={equipo.map((m) => ({
              id: m.id,
              nombre: m.nombre,
              tipo: m.tipo ?? "profesional",
              activo: m.activo,
              fotoUrl: m.foto_url,
            }))}
            servicios={servicios}
            horario={horario}
            horariosPorMiembro={horariosPorMiembro}
            initialFecha={hoy}
            initialCitas={citasHoy}
            initialBloqueos={bloqueos}
          />
        </section>

        <section id="clientes">
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">Clientes</h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Quién viene, quién dejó de venir y quién te está fallando — con la
            promoción de re-enganche a un clic. Se arma solo desde tus citas.
          </p>
          <ClientesPanel
            ranchoId={rancho.id}
            nombreNegocio={rancho.nombre}
            clientes={clientes}
          />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
            Cómo va el negocio
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Citas, asistencia, ingresos, quién atiende más y a qué horas —
            derivado de tu agenda real.
          </p>
          <ReportesCitas
            ranchoId={rancho.id}
            equipo={equipo.map((m) => ({ id: m.id, nombre: m.nombre }))}
          />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">El equipo</h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Las personas que atienden — y también espacios como cabinas o
            camillas. El cliente elige con quién quiere su cita, y cada quien
            puede tener su propio horario y sus propios servicios.
          </p>
          <EquipoPanel
            ranchoId={rancho.id}
            initialEquipo={equipo}
            serviciosCita={servicios.map((s) => ({ id: s.id, nombre: s.nombre }))}
            asignaciones={asignaciones}
            horarios={horariosPorMiembro}
          />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
            Horario semanal
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Qué días abrís y de qué hora a qué hora. Las citas solo se pueden
            reservar dentro de este horario (salvo que alguien del equipo tenga
            horario propio).
          </p>
          <HorarioForm ranchoId={rancho.id} initialHorario={horario} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
            Bloqueos y ausencias
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Vacaciones, feriados propios o días que no se trabaja — del negocio
            entero o de una sola persona.
          </p>
          <BloqueosPanel
            ranchoId={rancho.id}
            zona={zona}
            equipo={equipo.map((m) => ({ id: m.id, nombre: m.nombre, activo: m.activo }))}
            initialBloqueos={bloqueos}
          />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
            Lista de espera
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Cuando un día tuyo está lleno, el cliente puede dejar su nombre.
            Si cancelás o movés una cita de ese día, se le avisa solo — y
            reserva quien confirme primero.
          </p>
          <ListaEsperaPanel ranchoId={rancho.id} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
            Depósito para asegurar la cita
          </h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Opcional: pedile al cliente un depósito por SINPE al reservar. La
            cita igual queda confirmada al instante; el comprobante te llega
            por el chat y lo validás en Finanzas.
          </p>
          <DepositoCitasForm
            ranchoId={rancho.id}
            initialDeposito={depositoCitas}
            tieneSinpe={tieneSinpe}
          />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-aventurea-ink">Giftcards</h2>
          <p className="mb-4 text-[13px] text-aventurea-ink-soft">
            Las giftcards vendidas de tu negocio: quién la compró, para
            quién es y cuánto saldo queda por canjear en el local.
          </p>

          {giftcardsSinTabla ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
              <strong>Falta la migración de giftcards.</strong> Corré{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
                supabase/migrations/0059_giftcards.sql
              </code>{" "}
              en el SQL Editor de Supabase y volvé a entrar.
            </div>
          ) : giftcards.length === 0 ? (
            <p className="rounded-xl border border-aventurea-line bg-white p-5 text-[13px] text-aventurea-ink-soft">
              Todavía no hay giftcards vendidas.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="min-w-[140px] flex-1 rounded-2xl border border-aventurea-line bg-white px-5 py-3.5 sm:flex-none">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Vendido
                  </p>
                  <p className="text-[18px] font-extrabold text-aventurea-ink">
                    {fmtColones(giftVendido)}
                  </p>
                </div>
                <div className="min-w-[140px] flex-1 rounded-2xl border border-aventurea-line bg-white px-5 py-3.5 sm:flex-none">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Por canjear
                  </p>
                  <p className="text-[18px] font-extrabold text-aventurea-ink">
                    {fmtColones(giftPorCanjear)}
                  </p>
                </div>
                <div className="min-w-[140px] flex-1 rounded-2xl border border-aventurea-line bg-white px-5 py-3.5 sm:flex-none">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Activas
                  </p>
                  <p className="text-[18px] font-extrabold text-aventurea-ink">
                    {giftcards.filter((g) => g.estado === "activa").length}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
                {giftcards.map((g, i) => (
                  <div
                    key={g.id}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 ${i > 0 ? "border-t border-aventurea-line/60" : ""}`}
                  >
                    <code className="shrink-0 rounded-lg bg-aventurea-cream-2 px-2.5 py-1 font-mono text-[12.5px] font-bold text-aventurea-ink">
                      {g.codigo}
                    </code>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-aventurea-ink">
                        {g.comprador_nombre ?? "Compra directa"}
                        {g.beneficiario_nombre ? ` → para ${g.beneficiario_nombre}` : ""}
                      </p>
                      <p className="text-[12px] text-aventurea-ink-soft">
                        {fmtFechaCorta(g.created_at.slice(0, 10))}
                        {g.vence_en ? ` · vence ${fmtFechaCorta(g.vence_en)}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13.5px] font-extrabold text-aventurea-ink">
                        {fmtColones(Number(g.monto))}
                      </p>
                      {g.estado === "activa" && Number(g.saldo) !== Number(g.monto) && (
                        <p className="text-[11.5px] text-aventurea-ink-soft">
                          saldo {fmtColones(Number(g.saldo))}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide ${GIFTCARD_ESTADO[g.estado].cls}`}
                    >
                      {GIFTCARD_ESTADO[g.estado].label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
