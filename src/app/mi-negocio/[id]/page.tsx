import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CATALOGO_LABEL,
  CATEGORIAS,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
} from "../types";
import type {
  Categoria,
  CodigoDescuento,
  PrecioTier,
  PromocionDia,
  Rancho,
  RanchoItem,
  ServicioAdicional,
} from "../types";
import { categoriaLabel, esCategoriaValida } from "@/lib/categorias-vertical";
import CatalogoPanel from "./catalogo-panel";
import { resumenFinanciero, type Gasto, type ReservaFinanzas } from "@/lib/finanzas";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";
import Tabs, { type Tab } from "./tabs";
import DashboardMetricas from "./dashboard-metricas";
import { calcularMetricas } from "./metricas";
import EditarRanchoForm from "./editar/editar-form";
import PreciosForm from "@/components/precios-form";
import DescuentosForm from "@/components/descuentos-form";
import TerminosForm from "@/components/terminos-form";
import HorariosForm from "@/components/horarios-form";
import CuentasPagoForm from "@/components/cuentas-pago-form";
import SeccionPlegable from "@/components/seccion-plegable";
import DuracionesLugarForm from "./duraciones-lugar-form";
import type { DuracionPorDia } from "./duraciones-lugar-actions";
import ReservasTable from "@/app/admin/(dashboard)/eventos/reservas-table";
import FinanzasPanel from "./finanzas/finanzas-panel";
import {
  guardarPreciosPropio,
  guardarCodigosPropio,
  guardarDepositoPropio,
  guardarPromocionesPropio,
  guardarTerminosPropio,
  guardarHorariosPropio,
  guardarCuentasPagoPropio,
} from "./precios/actions";
import DepositoForm from "./deposito-form";
import AsistentePanel from "./asistente/asistente-panel";
import type { ConocimientoFila } from "./asistente/actions";
import { type EventoAgenda } from "@/components/agenda-eventos";
import ProximasReservasCards from "./proximas-reservas-cards";
import OcupacionCalendario, { type DiaOcupado } from "@/components/ocupacion-calendario";
import SincronizarCalendario from "@/components/sincronizar-calendario";
import AgendasExternas, { type AgendaExternaFila } from "@/components/agendas-externas";
import ReservaManualForm from "@/components/reserva-manual-form";
import ImportarAgenda from "@/components/importar-agenda";
import type { VerticalAgenda } from "@/lib/agenda/importar-agenda";
import { puedeUsarAgendaIA } from "./importar-agenda-actions";
import { hoyISOCR } from "@/lib/fechas";
import { leerEleccionesIncluidas } from "@/lib/catalogo";
import {
  agregarGasto,
  borrarGasto,
  marcarDepositoRecibido,
  registrarPagoFinal,
  revertirPagoFinal,
} from "./finanzas/actions";
import {
  actualizarReservaManual,
  cancelarReserva,
  confirmarReserva,
  crearReservaManual,
  moverReservaFecha,
} from "./agenda-actions";

const ESTADO_LABEL: Record<Rancho["estado"], string> = {
  pendiente: "Pendiente de aprobación",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

// El estado se marca con un punto de color al lado del nombre — más
// discreto que el badge grande de antes, misma información.
const ESTADO_PUNTO: Record<Rancho["estado"], string> = {
  pendiente: "bg-aventurea-orange",
  aprobado: "bg-aventurea-green",
  rechazado: "bg-red-600",
};

function fmtColones(n: number | null) {
  if (n === null) return "—";
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default async function RanchoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  // Qué sección de la pestaña Configuración llega abierta (ej. desde el
  // botón "Editar perfil y fotos" del encabezado, o desde un link viejo
  // a /editar o /precios que ahora redirige acá).
  const { seccion: seccionParam } = await searchParams;
  const seccion = Array.isArray(seccionParam) ? seccionParam[0] : seccionParam;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-negocio/login");

  const { data } = await supabase.from("ranchos").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  // El dueño entra siempre; un admin también puede entrar a modificar la
  // publicación en nombre del proveedor (por ejemplo cuando pide ayuda
  // desde el botón "Modificar tu página" del portal público). Las
  // políticas de la base ya permiten ambos casos — esto es la segunda
  // barrera para que nadie más abra una publicación ajena pegando el id.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  const esAdminSesion = perfil?.rol === "admin";
  if (data.owner_id !== user.id && !esAdminSesion) notFound();

  const rancho = data as Rancho;
  // "lugares" solo existe en la vertical Eventos — para Citas/Hospedajes/
  // Restaurantes esto siempre da false, que es lo correcto (ninguno de
  // esos vive con el calendario de Lugares).
  const esLugar = rancho.categoria === "lugares";
  // Para mostrar (breadcrumbs, headers, ícono/gradiente de portada) sin
  // asumir que `rancho.categoria` es una de las 6 de Eventos: si no
  // matchea ninguna categoría conocida de su vertical, cae a "otros"
  // como fallback visual neutro en vez de romper con Citas.
  const categoriaEventosValida = (CATEGORIAS as readonly string[]).includes(
    rancho.categoria,
  );
  const categoriaParaIcono = (categoriaEventosValida ? rancho.categoria : "otros") as Categoria;
  const categoriaLabelMostrado = esCategoriaValida(rancho.vertical ?? "eventos", rancho.categoria)
    ? categoriaLabel(rancho.vertical ?? "eventos", rancho.categoria)
    : rancho.categoria;
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");

  const [reservasRes, gastosRes, tiersRes, serviciosRes, codigosRes, promocionesRes, itemsRes, duracionesRes] =
    await Promise.all([
      supabase
        .from("reservas")
        .select("*")
        .eq("rancho_id", rancho.id)
        .neq("estado", "temporal")
        .order("fecha", { ascending: true }),
      supabase
        .from("gastos_rancho")
        .select("id, fecha, concepto, categoria, monto, nota")
        .eq("rancho_id", rancho.id)
        .order("fecha", { ascending: false }),
      supabase
        .from("precio_tiers")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("min_invitados", { ascending: true }),
      supabase.from("servicios_adicionales").select("*").eq("rancho_id", rancho.id),
      supabase
        .from("codigos_descuento")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("promociones_dia")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("duraciones_lugar_por_dia")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("dow_grupo", { ascending: true }),
    ]);

  const errorFinanzas = reservasRes.error ?? gastosRes.error;
  const reservas = (reservasRes.data ?? []) as Reserva[];
  const reservasFinanzas = reservas as unknown as ReservaFinanzas[];
  const gastos = (gastosRes.data ?? []) as Gasto[];

  const metricas = calcularMetricas({ reservas: reservasFinanzas, esLugar });
  const resumen = resumenFinanciero({ reservas: reservasFinanzas, gastos });
  const pendientes = reservas.filter((r) => r.estado === "pendiente").length;
  const codigos = (codigosRes.data ?? []) as CodigoDescuento[];
  const promociones = (promocionesRes.data ?? []) as PromocionDia[];
  const totalDescuentos = codigos.length + promociones.length;
  const duraciones: DuracionPorDia[] = (duracionesRes.data ?? []).map((d: { dow_grupo: 1 | 2 | 3 | 4 | 5; duracion_maxima_horas: number | string }) => ({
    dowGrupo: d.dow_grupo,
    duracionMaximaHoras: Number(d.duracion_maxima_horas),
  }));

  // El feed .ics para suscribir la agenda en Google/Apple Calendar.
  // Si la 0071 no ha corrido (o un admin abre un panel ajeno y la RLS
  // no lo deja crear el token), feedUrl queda null y la tarjeta no
  // aparece — nada se rompe.
  let feedUrl: string | null = null;
  {
    const { data: tokenFila, error: tokenError } = await supabase
      .from("calendario_tokens")
      .select("token")
      .eq("rancho_id", rancho.id)
      .maybeSingle();
    if (!tokenError) {
      let token = (tokenFila?.token as string | undefined) ?? undefined;
      if (!token) {
        const { data: creado } = await supabase
          .from("calendario_tokens")
          .insert({ rancho_id: rancho.id })
          .select("token")
          .maybeSingle();
        token = (creado?.token as string | undefined) ?? undefined;
      }
      if (token) {
        const sitio = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";
        feedUrl = `${sitio}/api/calendario/feed/${token}`;
      }
    }
  }

  // Los calendarios externos conectados (0072). null = la migración
  // no ha corrido y la tarjeta de importar no se muestra.
  let agendasExternas: AgendaExternaFila[] | null = null;
  {
    const { data, error } = await supabase
      .from("agendas_externas")
      .select("id, nombre, url, ultima_sync, ultimo_error, eventos_importados")
      .eq("rancho_id", rancho.id)
      .order("created_at", { ascending: true });
    if (!error) agendasExternas = (data ?? []) as AgendaExternaFila[];
  }

  // El complemento de pago que desbloquea leer la agenda con IA. Se
  // resuelve en el servidor con la llave de servicio: la tarjeta del
  // panel solo pinta lo que corresponda, y el endpoint lo vuelve a
  // comprobar antes de gastar un token (0077).
  const addonAgendaIA = await puedeUsarAgendaIA(rancho.id);

  // Lo que antes leía la pantalla suelta de "Tu asistente" (ahora una
  // sección más dentro de Configuración): las respuestas propias que le
  // enseñó el dueño y si tiene contratado el complemento `asistente_ia`
  // (0090, security definer — se puede preguntar con la sesión del
  // dueño sin abrirle la tabla).
  const [conocimientoRes, contratadoRes] = await Promise.all([
    supabase
      .from("conocimiento_negocio")
      .select("id, pregunta, respuesta, activo, orden")
      .eq("rancho_id", rancho.id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.rpc("tiene_addon", { p_rancho_id: rancho.id, p_addon: "asistente_ia" }),
  ]);
  const conocimiento = (conocimientoRes.data ?? []) as ConocimientoFila[];
  // `asistente_activo`/`asistente_instrucciones` no están en el tipo
  // `Rancho` (llegan de la 0078, que puede no haber corrido todavía) —
  // se leen del dato crudo, como ya hacía la pantalla suelta de antes.
  const datosCrudos = data as Record<string, unknown>;
  const faltaMigracionAsistente =
    !!conocimientoRes.error || !("asistente_activo" in datosCrudos);
  const contratadoAsistente = contratadoRes.data === true;

  const activoInicialAsistente =
    typeof datosCrudos.asistente_activo === "boolean" ? datosCrudos.asistente_activo : null;
  const instruccionesAsistente =
    typeof datosCrudos.asistente_instrucciones === "string"
      ? datosCrudos.asistente_instrucciones
      : "";
  // Misma regla que aplica el asistente del chat (src/lib/asistente-ia.ts):
  // toda la categoría Lugares más los slugs del piloto. Se calcula acá
  // para poder decirle al dueño qué hace HOY su opción "por defecto".
  const slugsPilotoAsistente = (process.env.ASISTENTE_IA_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const porDefectoActivoAsistente =
    esLugar || (!!rancho.slug && slugsPilotoAsistente.includes(rancho.slug));

  // La agenda: los eventos que vienen, ordenados, con HOY y MAÑANA
  // resaltados — el control operativo del día a día.
  const hoyCR = hoyISOCR();

  const agenda: EventoAgenda[] = reservas
    .filter((r) => r.fecha >= hoyCR && (r.estado === "pendiente" || r.estado === "confirmada"))
    .map((r) => ({
      id: r.id,
      fecha: r.fecha,
      nombre: r.nombre,
      tipo_evento: r.tipo_evento,
      invitados: r.invitados,
      estado: r.estado,
      monto_total: r.monto_total,
      horario_bloque: r.horario_bloque ?? null,
      // Solo lo llevan las citas — sin esto, una cita próxima aparecía
      // en esta lista con el día pero sin la hora.
      hora_inicio: r.hora_inicio ?? null,
    }));

  // La vertical de Citas configura su equipo, su horario semanal y la
  // agenda del día en su propia pantalla (declarado acá arriba porque
  // el calendario de la Agenda, justo abajo, también lo necesita).
  const esVerticalCitas = rancho.vertical === "citas";

  // El calendario de ocupados muestra todo lo activo (no solo lo
  // próximo): así también se ve de un vistazo lo que ya pasó este mes.
  // Incluye los bloqueos (manuales o importados de agendas externas):
  // desde la 0072 también tapan disponibilidad.
  const diasOcupados: DiaOcupado[] = reservas
    .filter(
      (r) =>
        r.estado === "pendiente" ||
        r.estado === "confirmada" ||
        r.estado === "bloqueada",
    )
    .map((r) => ({
      id: r.id,
      fecha: r.fecha,
      estado: r.estado,
      nombre: r.nombre,
      tipo_evento: r.tipo_evento ?? null,
      invitados: r.invitados ?? null,
      notas: r.notas ?? null,
      montoTotal: r.monto_total ?? null,
      depositoMonto: r.deposito_monto ?? null,
      horarioBloque: r.horario_bloque ?? null,
    }));

  const tabAgenda: Tab = {
    id: "agenda",
    label: "Agenda",
    // El puntito de pendientes vivía en la pestaña "Reservas" — ahora
    // que su tabla se plegó acá adentro, la agenda hereda el aviso.
    badge: pendientes,
    content: (
      <div className="flex flex-col gap-6">
        {/* El calendario es el único lugar para tocar reservas de
            EVENTOS: desde acá se confirma, se corrige, se mueve de
            fecha y se cancela lo del día — y también se carga una
            reserva nueva, con la fecha ya puesta, sin salir de acá.
            Para CITAS estas acciones no sirven (son las de un evento:
            tipo_evento, invitados, "horario" en texto libre, sin
            hora_inicio ni miembro_id) — crear o editar una cita desde
            acá dejaría una "cita fantasma" que no descuenta
            disponibilidad. Por eso queda de SOLO LECTURA para citas
            (igual sirve como vistazo del mes) y el manejo de verdad
            vive en /mi-negocio/[id]/citas. */}
        <OcupacionCalendario
          dias={diasOcupados}
          onConfirmar={esVerticalCitas ? undefined : confirmarReserva.bind(null, rancho.id)}
          onCancelar={esVerticalCitas ? undefined : cancelarReserva.bind(null, rancho.id)}
          onEditar={esVerticalCitas ? undefined : actualizarReservaManual.bind(null, rancho.id)}
          onMover={esVerticalCitas ? undefined : moverReservaFecha.bind(null, rancho.id)}
          onCrear={esVerticalCitas ? undefined : crearReservaManual.bind(null, rancho.id)}
          capacidadMax={esLugar ? rancho.capacidad_max : null}
        />
        {esVerticalCitas && (
          <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
            Este calendario es el vistazo del mes. Para ver, agendar o
            mover una cita puntual — con su hora y quién atiende — andá
            a{" "}
            <Link
              href={`/mi-negocio/${rancho.id}/citas`}
              className="font-bold text-aventurea-navy underline"
            >
              tu agenda de citas
            </Link>
            .
          </p>
        )}
        <SeccionPlegable
          marco={false}
          titulo="Sincronizar con Google Calendar o iPhone"
          descripcion="Traé tu agenda existente, o llevá tus reservas de Bookea al calendario de tu teléfono."
          resumen={
            agendasExternas?.length
              ? `${agendasExternas.length} conectada${agendasExternas.length === 1 ? "" : "s"}`
              : undefined
          }
        >
          <AgendasExternas ranchoId={rancho.id} agendas={agendasExternas} />
          <SincronizarCalendario feedUrl={feedUrl} />
        </SeccionPlegable>
        <div>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Próximas reservas
          </h2>
          <ProximasReservasCards eventos={agenda} />
        </div>

        {/* La tabla completa (antes su propia pestaña "Reservas" /
            "Solicitudes") — se pliega acá: el calendario de arriba ya
            cubre el día a día, esto es para cuando hace falta ver o
            buscar todo el historial junto, con los mensajes. */}
        <SeccionPlegable
          marco={false}
          titulo={esLugar ? "Todas tus reservas" : "Todas tus solicitudes"}
          descripcion={
            esLugar
              ? "El historial completo, con los mensajes de cada una."
              : "El historial completo de solicitudes, con los mensajes de cada una."
          }
          resumen={
            pendientes > 0 ? `${pendientes} por aprobar` : `${reservas.length} en total`
          }
        >
          {reservas.length === 0 ? (
            <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
              {esLugar
                ? "Todavía no tenés reservas."
                : "Todavía no te llegó ninguna solicitud de cotización — aparecen acá apenas alguien te escriba desde tu página pública."}
            </p>
          ) : (
            <ReservasTable initialReservas={reservas} mostrarMensajes variante="cards" />
          )}
        </SeccionPlegable>

        {/* Cargar reservas (a mano o trayendo la agenda de otro lado) no
            es algo que se haga todos los días — va al final, plegado,
            para no competir por espacio con el calendario de arriba.
            Cargar UNA reserva puntual también se puede clickeando su
            fecha en el calendario; esto sirve además para traer de una
            vez la agenda que ya se llevaba en otro lado. */}
        <SeccionPlegable
          marco={false}
          titulo="Agregar reservas a tu agenda"
          descripcion="Cargá una reserva suelta a mano, o traé de una vez la agenda que ya llevabas en otro lado."
        >
          {/* En citas, una reserva manual SIN hora queda invisible para
              la agenda del día y no descuenta disponibilidad (la vista
              exige hora_inicio) — una cita fantasma. El walk-in con
              hora vive en la pantalla de Citas. */}
          {rancho.vertical === "citas" ? (
            <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
              Las citas se cargan con su hora desde{" "}
              <Link
                href={`/mi-negocio/${rancho.id}/citas`}
                className="font-bold text-aventurea-navy underline"
              >
                tu agenda de citas
              </Link>{" "}
              (botón &quot;+ Nueva cita&quot;) — así descuentan disponibilidad
              y aparecen en el día. Para traer tu agenda vieja de una vez, usá
              el importador de abajo.
            </p>
          ) : (
            <ReservaManualForm
              capacidadMax={esLugar ? rancho.capacidad_max : null}
              onCrear={crearReservaManual.bind(null, rancho.id)}
            />
          )}
          {/* A mano es gratis; leer las fotos con IA es el complemento
              `agenda_ia` (0077), y el gate se resuelve en el servidor —
              acá solo se pinta lo que corresponda. */}
          <ImportarAgenda
            ranchoId={rancho.id}
            hoy={hoyCR}
            addonActivo={addonAgendaIA}
            negocio={{
              id: rancho.id,
              vertical: (rancho.vertical ?? "eventos") as VerticalAgenda,
              categoria: rancho.categoria ?? null,
              capacidadMin: rancho.capacidad_min ?? null,
              capacidadMax: rancho.capacidad_max ?? null,
              eventosPorDia: rancho.eventos_por_dia ?? null,
            }}
          />
        </SeccionPlegable>
      </div>
    ),
  };

  // El catálogo es el corazón de la reserva en línea de los servicios:
  // lo que el proveedor carga acá es lo que el cliente elige al armar
  // su pedido en la página pública. Lugares no lo necesita — ya tiene
  // su propio sistema de precios y servicios adicionales.
  const etiquetaCatalogo = CATALOGO_LABEL[categoriaParaIcono];
  const tabCatalogo: Tab = {
    id: "catalogo",
    label: etiquetaCatalogo,
    content: (
      <div>
        {itemsRes.error ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
            <strong>Faltan las migraciones.</strong> No se pudo leer tu{" "}
            {etiquetaCatalogo.toLowerCase()}: {itemsRes.error.message}. Corré{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
              supabase/aplicar-migraciones-pendientes.sql
            </code>{" "}
            en el SQL Editor de Supabase y volvé a entrar.
          </div>
        ) : (
          <>
            <p className="mb-5 text-[13.5px] text-aventurea-ink-soft">
              Lo que cargués acá aparece en tu página pública, y el cliente lo
              elige al reservar una fecha — con cantidades y total estimado.
            </p>
            <CatalogoPanel
              ranchoId={rancho.id}
              initialItems={(itemsRes.data ?? []) as RanchoItem[]}
              etiqueta={etiquetaCatalogo}
              vertical={(data as { vertical?: string }).vertical ?? "eventos"}
              eleccionesIniciales={leerEleccionesIncluidas(rancho.detalles)}
            />
          </>
        )}
      </div>
    ),
  };

  const tabFinanzas: Tab = {
    id: "finanzas",
    label: "Finanzas",
    content: (
      <div>
        {errorFinanzas && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
            <strong>Faltan las migraciones.</strong> No se pudieron leer los datos económicos:{" "}
            {errorFinanzas.message}. Corré{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
              supabase/aplicar-migraciones-pendientes.sql
            </code>{" "}
            en el SQL Editor de Supabase y volvé a entrar.
          </div>
        )}
        <FinanzasPanel
          resumen={resumen}
          gastos={gastos}
          onMarcarDeposito={marcarDepositoRecibido.bind(null, rancho.id)}
          onRegistrarPago={registrarPagoFinal.bind(null, rancho.id)}
          onRevertirPago={revertirPagoFinal.bind(null, rancho.id)}
          onAgregarGasto={agregarGasto.bind(null, rancho.id)}
          onBorrarGasto={borrarGasto.bind(null, rancho.id)}
        />
      </div>
    ),
  };

  // Todo lo que se toca una vez y se olvida —perfil, precios,
  // descuentos, condiciones y el asistente— vivía repartido en tres
  // pestañas más (Perfil y fotos, Precios y cobros, Asistente). Ahora
  // es UNA sola pestaña con todo plegado: nada abierto por defecto
  // salvo la sección a la que se llega con `?seccion=`, así se puede
  // seguir linkeando directo a una parte puntual (el botón "Editar
  // perfil y fotos" del encabezado, por ejemplo).
  const tabConfiguracion: Tab = {
    id: "configuracion",
    label: "Configuración",
    content: (
      <div className="flex flex-col gap-3.5">
        <SeccionPlegable
          marco={false}
          abierta={seccion === "perfil"}
          titulo="Perfil del negocio"
          descripcion="Tu nombre, fotos, ubicación y todo lo que ve un cliente al entrar a tu página."
        >
          <EditarRanchoForm rancho={rancho} />
        </SeccionPlegable>

        {/* Con depósito + cuentas configuradas, el negocio de servicio
            pasa de recibir "solicitudes" a reservas agendadas con pago
            por adelantado — mismo mecanismo que los Lugares. */}
        {!esLugar && !esVerticalCitas && (
          <SeccionPlegable
            marco={false}
            abierta={seccion === "precios"}
            titulo="Depósito para agendar"
            descripcion="Con esto, más tus cuentas de cobro (más abajo), el cliente agenda su fecha pagando por adelantado y subiendo el comprobante — igual que los lugares de eventos."
          >
            <DepositoForm
              initialDeposito={rancho.deposito_reserva ?? 0}
              onGuardar={guardarDepositoPropio.bind(null, rancho.id)}
            />
          </SeccionPlegable>
        )}

        {esLugar && (
          <SeccionPlegable
            marco={false}
            abierta={seccion === "precios"}
            titulo="Precios y servicios adicionales"
            descripcion="Tarifas por invitado, temporada alta, depósito de reserva y los extras que ofrecés."
          >
            <PreciosForm
              initialTiers={(tiersRes.data ?? []) as PrecioTier[]}
              initialServicios={(serviciosRes.data ?? []) as ServicioAdicional[]}
              initialTarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 0}
              initialDepositoReserva={rancho.deposito_reserva}
              initialModalidadPrecio={rancho.modalidad_precio_lugar}
              initialPrecioHora={rancho.precio_hora_lugar}
              initialPrecioFijo={rancho.precio_fijo_lugar}
              onGuardar={guardarPreciosPropio.bind(null, rancho.id)}
            />
          </SeccionPlegable>
        )}

        {esLugar && (
          <SeccionPlegable
            marco={false}
            abierta={seccion === "horarios"}
            titulo="Horarios de alquiler"
            descripcion="Vos definís en qué bloques alquilás y a qué hora entra y sale el cliente. Es lo que va a poder elegir al reservar."
            resumen={
              (rancho.horarios_bloques ?? []).length > 0
                ? `${(rancho.horarios_bloques ?? []).length} bloques`
                : undefined
            }
          >
            <HorariosForm
              initialHorarios={rancho.horarios_bloques ?? []}
              onGuardar={guardarHorariosPropio.bind(null, rancho.id)}
            />
          </SeccionPlegable>
        )}

        {esLugar && (
          <SeccionPlegable
            marco={false}
            abierta={seccion === "duraciones"}
            titulo="Duración máxima por día"
            descripcion="Configura cuántas horas máximo puede durar un alquiler cada día de la semana."
            resumen={
              duraciones.length > 0
                ? `${duraciones.length} grupo${duraciones.length === 1 ? "" : "s"} configurado${duraciones.length === 1 ? "" : "s"}`
                : undefined
            }
          >
            <DuracionesLugarForm
              ranchoId={rancho.id}
              initialDuraciones={duraciones}
            />
          </SeccionPlegable>
        )}

        <SeccionPlegable
          marco={false}
          abierta={seccion === "descuentos"}
          titulo="Descuentos y promociones"
          descripcion="Atraé más clientes con cupones y descuentos automáticos por día."
          resumen={totalDescuentos > 0 ? `${totalDescuentos} activos` : undefined}
        >
          <DescuentosForm
            initialCodigos={codigos}
            initialPromociones={promociones}
            onGuardarCodigos={guardarCodigosPropio.bind(null, rancho.id)}
            onGuardarPromociones={guardarPromocionesPropio.bind(null, rancho.id)}
          />
        </SeccionPlegable>

        <SeccionPlegable
          marco={false}
          abierta={seccion === "terminos"}
          titulo="Términos y monto mínimo"
          descripcion="Las condiciones que el cliente acepta antes de contratarte. Te dejamos unas por defecto y las podés cambiar por las tuyas."
        >
          <TerminosForm
            initialTerminos={rancho.terminos ?? []}
            initialMontoMinimo={rancho.monto_minimo}
            depositoReserva={rancho.deposito_reserva}
            esLugar={esLugar}
            vertical={rancho.vertical ?? "eventos"}
            onGuardar={guardarTerminosPropio.bind(null, rancho.id)}
          />
        </SeccionPlegable>

        <SeccionPlegable
          marco={false}
          abierta={seccion === "cuentas"}
          titulo="Cuentas para recibir el depósito"
          descripcion="El cliente ve esto en el paso de pago de la reserva, según el método que elija. Sin cuentas configuradas, esa forma de pago no se le ofrece."
        >
          <CuentasPagoForm
            initial={{
              sinpeNumero: rancho.sinpe_numero ?? "",
              sinpeTitular: rancho.sinpe_titular ?? "",
              cuentaBanco: rancho.cuenta_banco ?? "",
              cuentaNumero: rancho.cuenta_numero ?? "",
              cuentaTitular: rancho.cuenta_titular ?? "",
              cuentaTipo: rancho.cuenta_tipo ?? "",
            }}
            onGuardar={guardarCuentasPagoPropio.bind(null, rancho.id)}
          />
        </SeccionPlegable>

        <SeccionPlegable
          marco={false}
          abierta={seccion === "asistente"}
          titulo="Asistente IA"
          descripcion="Contesta el chat por vos con los datos de tu negocio, a cualquier hora."
        >
          {faltaMigracionAsistente && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
              <strong>Falta la migración del asistente.</strong> Corré{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
                supabase/migrations/0078_panel_ia.sql
              </code>{" "}
              en el SQL Editor de Supabase y volvé a entrar. Mientras tanto no se
              puede guardar nada de esta sección.
            </div>
          )}
          <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
            Cuando un cliente te escribe por el chat de Bookea, el asistente le
            contesta al instante con los datos de {rancho.nombre} — a cualquier
            hora, sin que vos tengás que estar pendiente. Sus respuestas salen
            con el prefijo <span className="font-bold text-aventurea-ink">💎</span>{" "}
            para que el cliente sepa que todavía no hablaste vos. Podés meterte
            en la conversación cuando querás desde{" "}
            <Link href="/mensajes" className="font-bold text-aventurea-navy underline">
              Mensajes
            </Link>
            .
          </p>
          <AsistentePanel
            ranchoId={rancho.id}
            activoInicial={activoInicialAsistente}
            porDefectoActivo={porDefectoActivoAsistente}
            instruccionesInicial={instruccionesAsistente}
            conocimientoInicial={conocimiento}
            contratado={contratadoAsistente}
          />
          {/* El aviso más importante de esta sección: qué puede y qué
              NO puede decir. Va al final porque se lee después de
              configurar, pero con marco propio para que no pase por
              decoración. */}
          <section className="mt-6 rounded-2xl border border-aventurea-navy/25 bg-aventurea-navy/5 p-5">
            <h3 className="text-[14px] font-bold text-aventurea-ink">
              Qué puede decir el asistente (y qué no)
            </h3>
            <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
              Solo repite lo que vos cargaste: tu perfil, tus precios, tu{" "}
              {etiquetaCatalogo.toLowerCase()}, tus condiciones y las respuestas
              de arriba. <strong className="text-aventurea-ink">Nunca inventa</strong>{" "}
              precios, descuentos ni disponibilidad de fechas: cuando le
              preguntan algo que no está cargado, dice que no lo sabe y avisa
              que vos respondés por el mismo chat.
            </p>
          </section>
        </SeccionPlegable>
      </div>
    ),
  };

  // esVerticalCitas ya quedó declarado más arriba (lo necesita también
  // el calendario de la Agenda) — acá solo arma la pestaña "Citas".
  // Orden operativo primero (lo que se mira seguido), configuración
  // después (lo que se toca una vez y se olvida). Finanzas sube antes
  // de Configuración: con el recordatorio de cobro es donde más se
  // entra. "Perfil y fotos", "Precios y cobros" y "Asistente" ya no son
  // pestañas propias — las tres viven plegadas dentro de Configuración.
  // "Reservas"/"Solicitudes" tampoco: su tabla se plegó dentro de
  // Agenda, que ahora es el único lugar para tocar reservas de punta a
  // punta.
  const tabs: Tab[] = [
    tabAgenda,
    ...(esVerticalCitas
      ? [{ id: "citas", label: "Citas", href: `/mi-negocio/${rancho.id}/citas` } satisfies Tab]
      : []),
    ...(!esLugar ? [tabCatalogo] : []),
    tabFinanzas,
    tabConfiguracion,
  ];

  const urlPublica = rancho.slug ? `/${rancho.slug}` : `/eventos/${rancho.id}`;

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-10">
      <Link
        href="/mi-negocio"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Todas tus publicaciones
      </Link>

      {/* El tablero: identidad del negocio, lo que hay que atender, cómo
          va el mes y la agenda, todo en un mismo panel. */}
      <div className="mt-4 overflow-hidden rounded-3xl border border-aventurea-line bg-aventurea-surface p-5 shadow-sm sm:p-7">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-aventurea-line bg-cover bg-center"
            style={
              rancho.foto_url
                ? { backgroundImage: `url(${rancho.foto_url})` }
                : { backgroundImage: CATEGORIA_GRADIENTE[categoriaParaIcono] }
            }
          >
            {!rancho.foto_url && (
              <span className="text-white opacity-90 [&_svg]:h-7 [&_svg]:w-7">
                {CATEGORIA_ICONO[categoriaParaIcono]}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <h1 className="text-[19px] font-bold leading-tight text-aventurea-ink">
                {rancho.nombre}
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-aventurea-ink-soft">
                <span className={`h-2 w-2 rounded-full ${ESTADO_PUNTO[rancho.estado]}`} />
                {ESTADO_LABEL[rancho.estado]}
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-aventurea-ink-soft">
              <span className="text-[11px] font-bold uppercase tracking-wide text-aventurea-orange">
                {categoriaLabelMostrado}
              </span>
              {ubicacion && <span className="truncate">{ubicacion}</span>}
              {rancho.estado === "aprobado" && (
                <Link
                  href={urlPublica}
                  className="font-bold text-aventurea-navy underline-offset-2 hover:underline"
                >
                  Ver mi página{rancho.slug ? ` · /${rancho.slug}` : ""} →
                </Link>
              )}
            </p>
          </div>

          <Link
            href="?tab=configuracion&seccion=perfil"
            className="shrink-0 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white shadow-sm hover:bg-aventurea-orange-dark"
          >
            Editar perfil y fotos
          </Link>
        </header>

        {rancho.estado === "pendiente" && (
          <p className="mt-4 rounded-[10px] bg-aventurea-orange/15 p-3 text-[13px] leading-relaxed text-aventurea-orange">
            Bookea está revisando tu publicación. Te avisamos apenas quede publicada en el
            directorio.
          </p>
        )}
        {rancho.estado === "rechazado" && (
          <p className="mt-4 rounded-[10px] bg-red-50 p-3 text-[13px] leading-relaxed text-red-700">
            Tu publicación no fue aprobada todavía. Escribinos si querés más información.
          </p>
        )}

        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-zinc-500">
          {esLugar && (rancho.capacidad_min !== null || rancho.capacidad_max !== null) && (
            <span>
              Capacidad{" "}
              <strong className="text-aventurea-ink">
                {rancho.capacidad_min ?? "—"}–{rancho.capacidad_max ?? "—"}
              </strong>
            </span>
          )}
          {rancho.precio_desde !== null && (
            <span>
              Precio desde{" "}
              <strong className="text-aventurea-ink">{fmtColones(rancho.precio_desde)}</strong>
            </span>
          )}
          {rancho.contacto_whatsapp && (
            <span>
              WhatsApp <strong className="text-aventurea-ink">{rancho.contacto_whatsapp}</strong>
            </span>
          )}
        </p>

        {/* Cómo va el mes, minimalista — lo pendiente por atender ya se
            ve en la campana del menú de arriba, así que acá no se
            repite: solo los números. */}
        <div className="mt-5 border-t border-aventurea-line pt-4">
          <DashboardMetricas metricas={metricas} esLugar={esLugar} />
        </div>
      </div>

      <div className="mt-7">
        <Tabs tabs={tabs} defaultTab="agenda" />
      </div>
    </main>
  );
}
