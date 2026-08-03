import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CATALOGO_LABEL,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  normalizarCategoria,
} from "../types";
import type {
  CodigoDescuento,
  PrecioTier,
  PromocionDia,
  Rancho,
  RanchoItem,
  ServicioAdicional,
} from "../types";
import CatalogoPanel from "./catalogo-panel";
import { resumenFinanciero, saldoPendiente, type Gasto, type ReservaFinanzas } from "@/lib/finanzas";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";
import Tabs, { type Tab } from "./tabs";
import DashboardMetricas from "./dashboard-metricas";
import PendientesRancho from "./pendientes-rancho";
import { calcularMetricas } from "./metricas";
import EditarRanchoForm from "./editar/editar-form";
import PreciosForm from "@/components/precios-form";
import DescuentosForm from "@/components/descuentos-form";
import TerminosForm from "@/components/terminos-form";
import HorariosForm from "@/components/horarios-form";
import CuentasPagoForm from "@/components/cuentas-pago-form";
import SeccionPlegable from "@/components/seccion-plegable";
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
import AgendaEventos, { type EventoAgenda } from "@/components/agenda-eventos";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

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

  const rancho = {
    ...(data as Rancho),
    categoria: normalizarCategoria((data as Rancho).categoria),
  };
  const esLugar = rancho.categoria === "lugares";
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");

  const [reservasRes, gastosRes, tiersRes, serviciosRes, codigosRes, promocionesRes, itemsRes] =
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

  // La agenda: los eventos que vienen, ordenados, con HOY y MAÑANA
  // resaltados — el control operativo del día a día.
  const hoyCR = hoyISOCR();

  // Mismo criterio que usará el recordatorio de cobro por correo/push:
  // el bloque de Pendientes y el aviso automático tienen que decir lo
  // mismo.
  const cobranHoy = reservasFinanzas.filter(
    (r) => r.estado === "confirmada" && r.fecha === hoyCR && saldoPendiente(r) > 0,
  ).length;

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
    }));

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
    content: (
      <div className="flex flex-col gap-6">
        <p className="text-[13.5px] text-aventurea-ink-soft">
          {agenda.length} evento{agenda.length === 1 ? "" : "s"} próximo
          {agenda.length === 1 ? "" : "s"}. Un día antes de cada evento te
          mandamos un recordatorio por correo.
        </p>
        {/* El calendario no es solo para mirar: desde acá se confirma,
            se corrige y se cancela lo del día, que es como se maneja la
            agenda cuando alguien llama para mover su fiesta. */}
        <OcupacionCalendario
          dias={diasOcupados}
          onConfirmar={confirmarReserva.bind(null, rancho.id)}
          onCancelar={cancelarReserva.bind(null, rancho.id)}
          onEditar={actualizarReservaManual.bind(null, rancho.id)}
        />
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
        <ReservaManualForm
          capacidadMax={esLugar ? rancho.capacidad_max : null}
          onCrear={crearReservaManual.bind(null, rancho.id)}
        />
        {/* Para quien llega con la agenda ya vendida: la pasa completa
            de una vez. A mano es gratis; leer las fotos con IA es el
            complemento `agenda_ia` (0077), y el gate se resuelve en el
            servidor — acá solo se pinta lo que corresponda. */}
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
        <AgendaEventos eventos={agenda} />
      </div>
    ),
  };

  // Antes solo Lugares tenía esta pestaña, porque solo ellos reservaban
  // por calendario. Ahora el resto de categorías también recibe
  // solicitudes de cotización reales (ver "Solicitar cotización" en su
  // página pública), así que la pestaña aplica para todos — el
  // contenido de la tabla es el mismo, solo cambia la palabra.
  const tabReservas: Tab = {
    id: "reservas",
    label: esLugar ? "Reservas" : "Solicitudes",
    // El "N por aprobar" que vivía en los accesos rápidos ahora es un
    // puntito naranja en la propia pestaña.
    badge: pendientes,
    content: (
      <div>
        <p className="mb-5 text-[13.5px] text-aventurea-ink-soft">
          {pendientes} en aprobación · {reservas.length} en total.
        </p>
        {reservas.length === 0 && (
          <p className="mb-5 rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
            {esLugar
              ? "Todavía no tenés reservas."
              : "Todavía no te llegó ninguna solicitud de cotización — aparecen acá apenas alguien te escriba desde tu página pública."}
          </p>
        )}
        <ReservasTable initialReservas={reservas} mostrarMensajes />
      </div>
    ),
  };

  // El catálogo es el corazón de la reserva en línea de los servicios:
  // lo que el proveedor carga acá es lo que el cliente elige al armar
  // su pedido en la página pública. Lugares no lo necesita — ya tiene
  // su propio sistema de precios y servicios adicionales.
  const etiquetaCatalogo = CATALOGO_LABEL[rancho.categoria];
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

  // Cada bloque de precios va plegado en su propia sección — antes se
  // apilaban todos abiertos y la pestaña medía kilómetros. Las cuentas
  // de cobro (antes su propia pestaña "Configuración general") viven
  // acá también: es donde de verdad tiene sentido buscarlas, junto al
  // depósito y los precios que las necesitan.
  const tabPrecios: Tab = {
    id: "precios",
    label: "Precios y cobros",
    content: (
      <div className="flex flex-col gap-3.5">
        {/* Con depósito + cuentas configuradas, el negocio de servicio
            pasa de recibir "solicitudes" a reservas agendadas con pago
            por adelantado — mismo mecanismo que los Lugares. */}
        {!esLugar && (
          <SeccionPlegable
            marco={false}
            abierta
            titulo="Depósito para agendar"
            descripcion="Con esto, más tus cuentas de cobro (más abajo en esta misma pestaña), el cliente agenda su fecha pagando por adelantado y subiendo el comprobante — igual que los lugares de eventos."
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
            abierta
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

        <SeccionPlegable
          marco={false}
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
          titulo="Términos y monto mínimo"
          descripcion="Las condiciones que el cliente acepta antes de contratarte. Te dejamos unas por defecto y las podés cambiar por las tuyas."
        >
          <TerminosForm
            initialTerminos={rancho.terminos ?? []}
            initialMontoMinimo={rancho.monto_minimo}
            depositoReserva={rancho.deposito_reserva}
            esLugar={esLugar}
            onGuardar={guardarTerminosPropio.bind(null, rancho.id)}
          />
        </SeccionPlegable>

        <SeccionPlegable
          marco={false}
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

  const tabPerfil: Tab = {
    id: "editar",
    label: "Perfil y fotos",
    content: <EditarRanchoForm rancho={rancho} />,
  };

  // La vertical de Citas configura su equipo, su horario semanal y la
  // agenda del día en su propia pantalla — esta pestaña es la puerta.
  const esVerticalCitas = rancho.vertical === "citas";
  // Orden operativo primero (lo que se mira seguido), configuración
  // después (lo que se toca una vez y se olvida). Finanzas sube antes
  // de Precios y cobros: con el recordatorio de cobro es donde más se
  // entra. "Configuración general" ya no es una pestaña propia — su
  // único contenido (cuentas de cobro) se fusionó dentro de Precios y
  // cobros, arriba.
  const tabs: Tab[] = [
    tabAgenda,
    ...(esVerticalCitas
      ? [{ id: "citas", label: "Citas", href: `/mi-rancho/${rancho.id}/citas` } satisfies Tab]
      : []),
    tabReservas,
    ...(!esLugar ? [tabCatalogo] : []),
    tabFinanzas,
    tabPrecios,
    tabPerfil,
    // El asistente del chat vive en su propia pantalla: se le enseñan
    // respuestas y se prende o apaga desde ahí. Aparece para todos los
    // negocios porque cualquiera puede encenderlo, no solo la categoría
    // que lo trae activo por defecto.
    {
      id: "asistente",
      label: "Asistente",
      href: `/mi-rancho/${rancho.id}/asistente`,
    } satisfies Tab,
  ];

  const urlPublica = rancho.slug ? `/${rancho.slug}` : `/eventos/${rancho.id}`;

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-10">
      <Link
        href="/mi-rancho"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Todas tus publicaciones
      </Link>

      {/* Encabezado compacto: identidad del negocio + la acción que más
          piden los dueños (editar el perfil y las fotos), sin banner
          gigante ni tarjetas de datos que empujen todo hacia abajo. */}
      <header className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-aventurea-line bg-cover bg-center"
          style={
            rancho.foto_url
              ? { backgroundImage: `url(${rancho.foto_url})` }
              : { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
          }
        >
          {!rancho.foto_url && (
            <span className="opacity-40 [&_svg]:h-7 [&_svg]:w-7">
              {CATEGORIA_ICONO[rancho.categoria]}
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
            <span className="text-[11px] font-bold uppercase tracking-wide text-aventurea-navy">
              {CATEGORIA_LABEL[rancho.categoria]}
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
          href="?tab=editar"
          className="shrink-0 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white shadow-sm hover:bg-aventurea-orange-dark"
        >
          Editar perfil y fotos
        </Link>
      </header>

      {rancho.estado === "pendiente" && (
        <p className="mt-4 rounded-[10px] bg-aventurea-orange/10 p-3 text-[13px] leading-relaxed text-aventurea-orange">
          Bookea está revisando tu publicación. Te avisamos apenas quede publicada en el
          directorio.
        </p>
      )}
      {rancho.estado === "rechazado" && (
        <p className="mt-4 rounded-[10px] bg-red-50 p-3 text-[13px] leading-relaxed text-red-700">
          Tu publicación no fue aprobada todavía. Escribinos si querés más información.
        </p>
      )}

      {/* Los datos que antes ocupaban cuatro tarjetas, ahora en una línea. */}
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-aventurea-ink-soft">
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

      {/* Los accesos rápidos se fueron: duplicaban una a una las
          pestañas de abajo, que ahora son píldoras y se bastan solas. */}
      <div className="mt-5">
        <PendientesRancho
          reservasPorAprobar={pendientes}
          depositosSinValidar={resumen.depositosSinValidar.length}
          cobranHoy={cobranHoy}
        />
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Cómo te está yendo
        </h2>
        <DashboardMetricas metricas={metricas} esLugar={esLugar} />
      </div>

      <div className="mt-7">
        <Tabs tabs={tabs} defaultTab="agenda" />
      </div>
    </main>
  );
}
