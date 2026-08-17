import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsearPrecioPorPersona } from "@/lib/precio-lugar";
// Los íconos del menú ya no se eligen acá: los da `iconoModulo`, para
// que el mismo módulo tenga la misma cara en el menú y en las tarjetas
// de acceso del tablero.
import { IconEdit, IconSparkles } from "@/components/icons";
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
import type { CategoriaNegocio } from "./categorias-actions";
import {
  resumenFinanciero,
  saldoPendiente,
  type Gasto,
  type ReservaFinanzas,
} from "@/lib/finanzas";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";
import PanelSidebar, { type Tab } from "./panel-sidebar";
import DashboardMetricas from "./dashboard-metricas";
import { calcularMetricas, actividadReciente, type ReservaAuditoria } from "./metricas";
import HistoricoReservas from "./historico-reservas";
import BarraAvisos, { type Aviso } from "./barra-avisos";
import EditarRanchoForm from "./editar/editar-form";
import PreciosForm from "@/components/precios-form";
import DescuentosForm from "@/components/descuentos-form";
import TerminosForm from "@/components/terminos-form";
import HorariosForm from "@/components/horarios-form";
import CuentasPagoForm from "@/components/cuentas-pago-form";
import ColaboradoresPanel, { type Colaborador } from "./colaboradores-panel";
import SeccionPlegable from "@/components/seccion-plegable";
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
import { ocupaFranjaHoraria, type VerticalAgenda } from "@/lib/agenda/importar-agenda";
import { puedeUsarAgendaIA } from "./importar-agenda-actions";
import { hoyISOCR } from "@/lib/fechas";
import { leerEleccionesIncluidas } from "@/lib/catalogo";
import {
  agregarGasto,
  borrarGasto,
  marcarAdelantoDevuelto,
  marcarDepositoRecibido,
  registrarPagoFinal,
  revertirPagoFinal,
} from "./finanzas/actions";
import {
  actualizarReservaManual,
  cancelarReserva,
  confirmarReserva,
  crearReservaManual,
  marcarDepositoValidadoRancho,
  moverReservaFecha,
  obtenerUrlComprobanteRancho,
} from "./agenda-actions";
import SolicitudesPendientes from "./solicitudes-pendientes";
// Los formularios de configuración de la vertical Citas (equipo,
// horario semanal, bloqueos, depósito) — antes vivían regados en la
// pantalla /citas; ahora son secciones plegables de "Configuración".
import EquipoPanel from "./citas/equipo-panel";
import HorarioForm from "./citas/horario-form";
import BloqueosPanel from "./citas/bloqueos-panel";
import DepositoCitasForm from "./citas/deposito-citas-form";
import type {
  BloqueoAgenda,
  MiembroEquipo,
  RangoHorarioMiembro,
} from "./citas/actions";
import { horarioDeDetalles } from "@/app/citas/tipos";
import { sumarDiasISO } from "@/lib/fechas";
// BOOKEA BUSINESS: el tipo de negocio y sus módulos deciden qué ítems
// tiene el menú y qué números muestra el tablero — antes eso era un
// `vertical === 'citas' ? A : B` cableado más abajo.
import { contextoDesdeDatos } from "@/lib/business/contexto";
import { definicionTipo, usaAgendaPorHoras } from "@/lib/business/modulos";
import { widgetsDashboard } from "@/lib/business/widgets";
import { itemsMenuNegocio } from "@/lib/business/menu";
import { identidadDe, variablesAcento } from "@/lib/business/identidad";
import ModulosPanel from "./modulos-panel";
import { iconoModulo } from "./iconos-modulos";
import AccesosModulos from "./accesos-modulos";
import type { ResumenDelDia } from "./dashboard-metricas";
// Los números del día se calculan con el MISMO motor que la pantalla de
// la agenda (jornada real del equipo menos bloqueos), para que las dos
// pantallas no digan porcentajes distintos del mismo día.
import {
  etiquetaHoras,
  metricasDelDia,
  type CitaParaMetricas,
} from "./citas/metricas-dia";

const ESTADO_LABEL: Record<Rancho["estado"], string> = {
  pendiente: "Pendiente de aprobación",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

// El estado se marca con un punto de color al lado del nombre — más
// discreto que el badge grande de antes, misma información.
const ESTADO_PUNTO: Record<Rancho["estado"], string> = {
  pendiente: "bg-aventurea-sky",
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

  /* ======== El panel entero en UNA tanda a Supabase ========
   *
   * Antes esta pantalla hacía NUEVE tandas en cascada: ranchos →
   * perfiles → (7 consultas) → calendario_tokens → agendas_externas →
   * puedeUsarAgendaIA → (conocimiento + addon) → (equipo, horarios,
   * asignaciones, bloqueos). A ~55 ms por ida y vuelta medidos desde
   * Vercel, eso son ~500 ms de puro esperar antes de pintar nada — y es
   * la pantalla que el dueño abre veinte veces al día.
   *
   * Todas filtran por el mismo `id` que viene en la URL, así que
   * ninguna necesitaba esperar a la anterior. Van juntas.
   *
   * Sobre seguridad: disparar estas consultas ANTES de comprobar que la
   * publicación es suya no abre nada — la comprobación de abajo
   * (`owner_id`/rol admin/colaborador) sigue siendo la barrera real y
   * sigue cortando con notFound() antes de renderizar una sola línea.
   * La de `ranchos` en particular NO va con la sesión de quien mira: la
   * política RLS que deja ver un rancho publicado es a propósito ancha
   * (cualquiera con o sin cuenta necesita poder ver la ficha pública),
   * así que nunca protegió las columnas de cobro (sinpe_numero,
   * cuenta_numero…) — eso lo hacía únicamente el permiso de columna de
   * la tabla, y `authenticated` lo tenía completo hasta la 0155. Leer
   * acá con la llave de servicio no abre nada nuevo (el check de abajo
   * ya es la puerta real) y deja de depender de ese permiso ancho.
   */
  const admin = createAdminClient();
  const [
    { data },
    { data: perfil },
    [
      reservasRes,
      gastosRes,
      tiersRes,
      serviciosRes,
      codigosRes,
      promocionesRes,
      itemsRes,
      categoriasRes,
    ],
    tokenRes,
    agendasRes,
    addonAgendaIA,
    conocimientoRes,
    contratadoRes,
    modulosRes,
  ] = await Promise.all([
    (admin ?? supabase).from("ranchos").select("*").eq("id", id).maybeSingle(),
    // El dueño entra siempre; un admin también puede entrar a modificar
    // la publicación en nombre del proveedor (por ejemplo cuando pide
    // ayuda desde el botón "Modificar tu página" del portal público).
    supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle(),
    Promise.all([
      supabase
        .from("reservas")
        .select("*")
        .eq("rancho_id", id)
        .neq("estado", "temporal")
        .order("fecha", { ascending: true }),
      supabase
        .from("gastos_rancho")
        .select("id, fecha, concepto, categoria, monto, nota")
        .eq("rancho_id", id)
        .order("fecha", { ascending: false }),
      supabase
        .from("precio_tiers")
        .select("*")
        .eq("rancho_id", id)
        .order("min_invitados", { ascending: true }),
      supabase.from("servicios_adicionales").select("*").eq("rancho_id", id),
      supabase
        .from("codigos_descuento")
        .select("*")
        .eq("rancho_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("promociones_dia")
        .select("*")
        .eq("rancho_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", id)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),
      // El orden de las secciones (0119). Si la migración todavía no
      // se pegó, esto devuelve error y el panel cae al orden implícito.
      supabase
        .from("categorias_negocio")
        .select("*")
        .eq("rancho_id", id)
        .order("orden", { ascending: true }),
    ]),
    // El feed .ics para suscribir la agenda en Google/Apple Calendar.
    supabase.from("calendario_tokens").select("token").eq("rancho_id", id).maybeSingle(),
    // Los calendarios externos conectados (0072).
    supabase
      .from("agendas_externas")
      .select("id, nombre, url, ultima_sync, ultimo_error, eventos_importados")
      .eq("rancho_id", id)
      .order("created_at", { ascending: true }),
    // El complemento de pago que desbloquea leer la agenda con IA. Se
    // resuelve en el servidor con la llave de servicio: la tarjeta del
    // panel solo pinta lo que corresponda, y el endpoint lo vuelve a
    // comprobar antes de gastar un token (0077).
    puedeUsarAgendaIA(id),
    // Las respuestas propias que el dueño le enseñó al asistente...
    supabase
      .from("conocimiento_negocio")
      .select("id, pregunta, respuesta, activo, orden")
      .eq("rancho_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    // ...y si tiene contratado el complemento `asistente_ia` (0090,
    // security definer — se puede preguntar con la sesión del dueño sin
    // abrirle la tabla).
    supabase.rpc("tiene_addon", { p_rancho_id: id, p_addon: "asistente_ia" }),
    // Los módulos que este negocio encendió o apagó (0108). Guarda solo
    // las DIFERENCIAS contra el default de su tipo: sin filas, manda el
    // tipo. Si la migración todavía no se pegó, el error se arrastra
    // hasta la sección de Bookea Business y el resto del panel sigue
    // funcionando con los defaults (mismo patrón que giftcards).
    supabase.from("modulos_negocio").select("modulo, activo").eq("rancho_id", id),
  ]);

  if (!data) notFound();

  const esAdminSesion = perfil?.rol === "admin";

  // Quién entra: el dueño, un admin de plataforma, o alguien a quien el
  // dueño sumó como colaborador (0116). La pregunta se le hace a la
  // base y no se arma acá con un `or`: `gestiona_rancho` es la MISMA
  // función que respaldan las políticas RLS, así que la pantalla y los
  // datos no pueden opinar distinto.
  let puedeEntrar = data.owner_id === user.id || esAdminSesion;
  if (!puedeEntrar) {
    const { data: gestiona } = await supabase.rpc("gestiona_rancho", { p_rancho: id });
    puedeEntrar = gestiona === true;
  }
  if (!puedeEntrar) notFound();

  const esColaborador = !esAdminSesion && data.owner_id !== user.id;

  // La lista solo la necesita el dueño (es el único que ve el panel), y
  // se pide por RPC porque `rancho_colaboradores` guarda ids: el correo
  // vive en `auth.users`, que el cliente no puede leer.
  //
  // Si la 0116 todavía no se pegó, el error se traga acá y el resto del
  // panel sigue funcionando — mismo criterio que giftcards y módulos.
  let colaboradores: Colaborador[] = [];
  if (!esColaborador) {
    const { data: filas } = await supabase.rpc("colaboradores_del_rancho", { p_rancho: id });
    colaboradores = (filas ?? []) as Colaborador[];
  }

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

  // BOOKEA BUSINESS — qué tipo de negocio es y qué módulos usa. De acá
  // salen los ítems del menú, las secciones de Configuración y los
  // números del tablero. Un negocio que nunca tocó nada resuelve
  // exactamente los módulos que le corresponden por su categoría, así
  // que ve el mismo panel de siempre (cubierto por modulos.test.ts).
  const overridesModulos: Record<string, boolean> = {};
  for (const fila of (modulosRes.data ?? []) as { modulo: string; activo: boolean }[]) {
    overridesModulos[fila.modulo] = fila.activo;
  }
  const negocio = contextoDesdeDatos(
    {
      id: rancho.id,
      vertical: rancho.vertical,
      categoria: rancho.categoria,
      tipo_negocio:
        ((data as Record<string, unknown>).tipo_negocio as string | null) ?? null,
    },
    overridesModulos,
    modulosRes.error?.message ?? null,
  );
  const modulos = negocio.modulos;

  const errorFinanzas = reservasRes.error ?? gastosRes.error;
  const reservas = (reservasRes.data ?? []) as Reserva[];
  const reservasFinanzas = reservas as unknown as ReservaFinanzas[];
  const gastos = (gastosRes.data ?? []) as Gasto[];

  // El "hoy" del negocio, no el del servidor: en Vercel `new Date()` es
  // UTC y a partir de las 6 p.m. de Costa Rica ya sería mañana.
  const hoyCR = hoyISOCR();

  const metricas = calcularMetricas({
    reservas: reservasFinanzas,
    esLugar,
    hoyISO: hoyCR,
  });
  const resumen = resumenFinanciero({ reservas: reservasFinanzas, gastos });
  const reservasPendientes = reservas.filter((r) => r.estado === "pendiente");
  const pendientes = reservasPendientes.length;
  const codigos = (codigosRes.data ?? []) as CodigoDescuento[];
  const promociones = (promocionesRes.data ?? []) as PromocionDia[];
  const totalDescuentos = codigos.length + promociones.length;
  // El histórico con auditoría de Inicio. El `as` solo ensancha el tipo
  // a las columnas de plata y descuento que el select("*") ya trae y
  // que `Reserva` (el tipo del admin) no lista.
  const actividad = actividadReciente(reservas as ReservaAuditoria[]);

  // El feed .ics para suscribir la agenda en Google/Apple Calendar.
  // Si la 0071 no ha corrido (o un admin abre un panel ajeno y la RLS
  // no lo deja crear el token), feedUrl queda null y la tarjeta no
  // aparece — nada se rompe.
  let feedUrl: string | null = null;
  if (!tokenRes.error) {
    let token = (tokenRes.data?.token as string | undefined) ?? undefined;
    // El INSERT es lo ÚNICO que puede quedar como segunda tanda, y solo
    // la primera vez que se abre el panel de un negocio: después el
    // token ya existe y la lectura de arriba lo trae.
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

  // Los calendarios externos conectados (0072). null = la migración
  // no ha corrido y la tarjeta de importar no se muestra.
  const agendasExternas: AgendaExternaFila[] | null = agendasRes.error
    ? null
    : ((agendasRes.data ?? []) as AgendaExternaFila[]);

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

  // La vertical de Citas opera su agenda del día en su propia pantalla
  // (/mi-negocio/[id]/citas) y configura todo lo demás acá, en la
  // pestaña Configuración.
  const esVerticalCitas = rancho.vertical === "citas";
  // Y no es la única que trabaja así: un proveedor de eventos agenda
  // por horas y por servicios igual que una barbería (un DJ hace una
  // fiesta infantil a las 3 p.m. y una boda a las 9 p.m. el mismo
  // día). Lo que sigue a esta bandera es de la FORMA DE AGENDAR, no de
  // la vertical — la regla vive en un solo lugar, `usaAgendaPorHoras`.
  const agendaPorHoras = usaAgendaPorHoras(rancho.vertical, rancho.categoria);
  // Y la MISMA pregunta, del lado de la reserva que se carga a mano:
  // ¿esta fila ocupa una franja (y entonces necesita `hora_inicio` o no
  // le tapa nada a la agenda pública) o el día entero? Es el helper del
  // importador —`usaAgendaPorHoras` + Restaurantes—, no una condición
  // nueva; el servidor lo vuelve a resolver por su cuenta.
  const pideHoraReserva = ocupaFranjaHoraria(rancho.vertical, rancho.categoria);

  // Lo que necesita la Configuración de un negocio que agenda por
  // horas: el equipo (con horario propio y servicios por persona), los
  // bloqueos vigentes y el horario semanal. A un LUGAR no se le
  // consulta: alquila la fecha entera y no tiene a quién asignarle qué.
  let equipoAgenda: MiembroEquipo[] = [];
  const horariosPorMiembro: Record<string, RangoHorarioMiembro[]> = {};
  let asignacionesServicios: { item_id: string; miembro_id: string }[] = [];
  let bloqueosVigentes: BloqueoAgenda[] = [];
  if (agendaPorHoras) {
    const [equipoRes, horariosRes, asignacionesRes, bloqueosRes] = await Promise.all([
      supabase
        .from("equipo_rancho")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("horarios_recurso")
        .select("miembro_id, dow, abre, cierra, equipo_rancho!inner(rancho_id)")
        .eq("equipo_rancho.rancho_id", rancho.id),
      supabase
        .from("servicios_recurso")
        .select("item_id, miembro_id, rancho_items!inner(rancho_id)")
        .eq("rancho_items.rancho_id", rancho.id),
      supabase
        .from("bloqueos_agenda")
        .select("id, rancho_id, miembro_id, inicio, fin, motivo")
        .eq("rancho_id", rancho.id)
        .gte("fin", `${sumarDiasISO(hoyISOCR(), -1)}T00:00:00-06:00`)
        .order("inicio", { ascending: true }),
    ]);
    equipoAgenda = (equipoRes.data ?? []) as MiembroEquipo[];
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
    asignacionesServicios = ((asignacionesRes.data ?? []) as unknown as {
      item_id: string;
      miembro_id: string;
    }[]).map((a) => ({ item_id: a.item_id, miembro_id: a.miembro_id }));
    bloqueosVigentes = (bloqueosRes.data ?? []) as BloqueoAgenda[];
  }

  const zonaNegocio = (datosCrudos.zona_horaria as string) || "America/Costa_Rica";

  /* ======== LOS NÚMEROS DE HOY ========
   *
   * NINGUNO SALE DE UN SUPUESTO. Todo lo que hace falta ya está cargado
   * en esta misma pantalla: las reservas del día (de la tanda grande),
   * el equipo con su horario propio, el horario semanal del negocio y
   * los bloqueos vigentes. Cero consultas de más.
   *
   * `metricasDelDia` es el motor de la pantalla de la agenda, no una
   * copia: la ocupación de acá y la de allá tienen que ser el mismo
   * porcentaje o una de las dos está mintiendo. Devuelve `ocupacion:
   * null` cuando no hay jornada contra la cual medir (nadie trabaja hoy,
   * o el negocio nunca configuró su horario) y entonces la tarjeta
   * directamente no se pinta — un 0% que significa "no sabemos" es peor
   * que una tarjeta menos.
   *
   * Solo para quien agenda POR HORAS. En un lugar que alquila la fecha
   * entera no hay minutos que dividir: su número de hoy es cuántas
   * reservas tiene (`metricas.reservasHoy`) y su ocupación es la de 30
   * días, que ya existía.
   */
  let resumenDelDia: ResumenDelDia | null = null;
  if (agendaPorHoras && modulos.has("agenda")) {
    // Sin `hora_inicio` una fila no ocupa una franja: es la "reserva
    // fantasma" que el propio panel advierte más abajo (no descuenta
    // disponibilidad ni aparece en la agenda del día). Contarla como
    // tiempo ocupado inflaría el porcentaje con algo que nadie ve.
    const citasDeHoy: CitaParaMetricas[] = (
      reservas as unknown as {
        fecha: string;
        hora_inicio?: string | null;
        duracion_minutos?: number | null;
        miembro_id?: string | null;
        estado: string;
        monto_total: number | null;
        evento_pagado: boolean;
        monto_cobrado_final?: number | null;
      }[]
    )
      .filter((r) => r.fecha === hoyCR && !!r.hora_inicio)
      .map((r) => ({
        hora_inicio: r.hora_inicio as string,
        duracion_minutos: r.duracion_minutos ?? null,
        miembro_id: r.miembro_id ?? null,
        estado: r.estado,
        monto_total: r.monto_total,
        evento_pagado: r.evento_pagado,
        monto_cobrado_final: r.monto_cobrado_final ?? null,
      }));

    const dia = metricasDelDia({
      fecha: hoyCR,
      zona: zonaNegocio,
      citas: citasDeHoy,
      equipo: equipoAgenda,
      horario: horarioDeDetalles(rancho.detalles),
      horariosPorMiembro,
      bloqueos: bloqueosVigentes,
    });

    // El desglose se arma con las piezas que de verdad hay: un día sin
    // pendientes no dice "0 sin confirmar".
    const desglose = [
      dia.confirmadas > 0 ? `${dia.confirmadas} confirmadas` : null,
      dia.sinConfirmar > 0 ? `${dia.sinConfirmar} sin confirmar` : null,
      dia.yaVinieron > 0 ? `${dia.yaVinieron} ya vinieron` : null,
      dia.noVinieron > 0 ? `${dia.noVinieron} no vinieron` : null,
    ].filter(Boolean);

    resumenDelDia = {
      total: dia.total,
      desglose: desglose.length > 0 ? desglose.join(" · ") : null,
      ocupacion: dia.ocupacion,
      detalleOcupacion:
        dia.ocupacion === null
          ? null
          : `${etiquetaHoras(dia.minutosAgendados)} de ${etiquetaHoras(dia.minutosDeAgenda)}`,
    };
  }

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
      horaInicio: r.hora_inicio ?? null,
    }));

  // Los avisos cortos de la barra de arriba: lo que no se resuelve con
  // los botones de una solicitud, sino yendo a otra pestaña. Mismo
  // criterio que la campana del menú (mi-negocio/layout.tsx), para que
  // los dos lugares no se contradigan.
  const avisos: Aviso[] = [];
  {
    const vivas = reservasFinanzas.filter(
      (r) => r.estado === "pendiente" || r.estado === "confirmada",
    );
    const depositosSinValidar = vivas.filter(
      (r) => !r.deposito_validado && Number(r.deposito_monto ?? 0) > 0,
    ).length;
    if (depositosSinValidar > 0) {
      avisos.push({
        id: "depositos",
        texto:
          depositosSinValidar === 1
            ? "Hay 1 depósito sin validar."
            : `Hay ${depositosSinValidar} depósitos sin validar.`,
        href: "?tab=finanzas",
        accion: "Revisar en Finanzas",
      });
    }
    const cobrarHoy = vivas.filter(
      (r) => r.estado === "confirmada" && r.fecha === hoyISOCR() && saldoPendiente(r) > 0,
    ).length;
    if (cobrarHoy > 0) {
      avisos.push({
        id: "cobrar-hoy",
        texto:
          cobrarHoy === 1
            ? "1 evento de hoy tiene saldo por cobrar."
            : `${cobrarHoy} eventos de hoy tienen saldo por cobrar.`,
        href: "?tab=finanzas",
        accion: "Ir a cobrar",
      });
    }
    const vencidos = vivas.filter(
      (r) => r.estado === "confirmada" && r.fecha < hoyISOCR() && saldoPendiente(r) > 0,
    ).length;
    if (vencidos > 0) {
      avisos.push({
        id: "vencidos",
        texto:
          vencidos === 1
            ? "1 evento ya pasó y quedó con saldo pendiente."
            : `${vencidos} eventos ya pasaron y quedaron con saldo pendiente.`,
        href: "?tab=finanzas",
        accion: "Ver los saldos",
      });
    }
  }

  /* ======== EL MENÚ, ARMADO DE LOS MÓDULOS DEL TIPO ========
   *
   * Antes esto eran cuatro pestañas escritas a mano (Inicio · Citas ·
   * Finanzas · Configuración), así que daba igual que el tipo declarara
   * once módulos: el dueño veía cuatro. Ahora la lista sale entera de
   * `itemsMenuNegocio`, que es puro y está probado — incluida la regla
   * de que un módulo sin pantalla se muestra apagado y sin enlace.
   *
   * La MISMA lista alimenta el menú lateral y las tarjetas de acceso del
   * tablero: no hay forma de que una ofrezca algo que la otra no.
   */
  const identidadTipo = identidadDe(negocio.tipo);
  const etiquetaCatalogo = CATALOGO_LABEL[categoriaParaIcono];
  const itemsMenu = itemsMenuNegocio({
    ranchoId: rancho.id,
    tipo: negocio.tipo,
    modulos,
    vocabulario: identidadTipo.vocabulario,
    agendaPorHoras,
    esVerticalCitas,
    etiquetaCatalogo,
  });

  // La agenda entera — antes era su propia pestaña; ahora es el cuerpo
  // de Inicio, con las mismas acciones de siempre.
  const contenidoAgenda = (
      <div className="flex flex-col gap-4">
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
          pideHora={pideHoraReserva}
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
        {/* "Lo que viene" SUBIÓ: ahora abre el tablero, arriba del
            calendario, porque es lo que se mira al llegar. Lo que quedó
            acá es el calendario del mes y lo que se hace de vez en
            cuando (sincronizar, cargar agenda vieja). */}

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
              pideHora={pideHoraReserva}
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
  );

  // El ítem del menú que abre la agenda del día, si existe: el tablero
  // lo usa para rematar el bloque "lo de hoy" con un enlace a la
  // pantalla donde de verdad se opera. Sale de la MISMA lista del menú,
  // así que si esa pantalla no es de este negocio, el enlace no existe.
  const itemAgendaDia = itemsMenu.find(
    (i) => i.id === "agenda" && i.destino.clase === "ruta",
  );
  const hrefAgendaDia =
    itemAgendaDia?.destino.clase === "ruta" ? itemAgendaDia.destino.href : null;

  // INICIO ES EL TABLERO, en el orden de la maqueta:
  //   (a) la fila de números — cómo va HOY,
  //   (b) lo que espera respuesta,
  //   (c) lo del día: lo que viene, con el atajo a la agenda,
  //   (d) las herramientas del tipo de negocio,
  //   (e) el calendario del mes y el histórico con auditoría.
  //
  // Antes los números iban DESPUÉS de los avisos y "lo que viene" estaba
  // enterrado debajo del calendario, así que la primera pantalla del
  // panel era un mes entero de cuadritos.
  const tabInicio: Tab = {
    id: "inicio",
    label: "Inicio",
    icon: iconoModulo("inicio"),
    // El puntito de pendientes viaja con la barra de avisos.
    badge: pendientes,
    // Los links viejos (correos ya enviados, la campana del menú y la
    // ruta /reservas) apuntan a la pestaña Agenda, que ya no existe.
    alias: ["agenda", "reservas"],
    content: (
      <div className="flex flex-col gap-6">
        {/* (a) Los números. Cada tarjeta se pinta solo si su dato sale
            de la base: la de ocupación desaparece cuando el negocio no
            tiene horario configurado, en vez de mostrar 0%. */}
        <div>
          <h2 className="titulo mb-3.5 text-[18px] text-aventurea-navy">Tu negocio en números</h2>
          <DashboardMetricas
            metricas={metricas}
            dia={resumenDelDia}
            widgets={widgetsDashboard({
              tipo: negocio.tipo,
              modulos,
              // La ocupación por día solo dice algo donde una fecha se
              // reserva entera (Lugares); en una barbería el mismo día
              // tiene veinte espacios.
              ocupacionDisponible: metricas.ocupacionProximos30 !== null,
              // La de HOY es otra cosa: minutos agendados sobre minutos
              // de jornada. Solo existe si hubo jornada que medir.
              ocupacionDeHoyDisponible: resumenDelDia?.ocupacion !== null &&
                resumenDelDia?.ocupacion !== undefined,
              vocabulario: identidadTipo.vocabulario,
            })}
          />
        </div>

        {/* (b) Lo que espera respuesta. Las solicitudes traen sus
            propios botones: revisar el comprobante, confirmar (dispara
            el correo al cliente) o rechazar. */}
        <BarraAvisos avisos={avisos} haySolicitudes={reservasPendientes.length > 0}>
          {reservasPendientes.length > 0 && (
            <SolicitudesPendientes
              reservas={reservasPendientes}
              onConfirmar={confirmarReserva.bind(null, rancho.id)}
              onRechazar={cancelarReserva.bind(null, rancho.id)}
              onVerComprobante={obtenerUrlComprobanteRancho.bind(null, rancho.id)}
              onMarcarValidado={marcarDepositoValidadoRancho.bind(null, rancho.id)}
            />
          )}
        </BarraAvisos>

        {/* (c) Lo del día: lo que viene, arriba de todo lo demás. */}
        {modulos.has("agenda") && (
          <section>
            <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="titulo text-[18px] text-aventurea-navy">Lo que viene</h2>
              {hrefAgendaDia && (
                <Link
                  href={hrefAgendaDia}
                  className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
                >
                  {/* El label ya trae la palabra del tipo ("Citas",
                      "Consultas", "Agenda del día"): no se le agrega
                      nada o queda "agenda del día del día". */}
                  Ver {itemAgendaDia?.label.toLowerCase()} →
                </Link>
              )}
            </div>
            <ProximasReservasCards eventos={agenda} />
          </section>
        )}

        {/* (d) Las herramientas de ESTE tipo de negocio. Es el bloque
            que hace que un consultorio no se vea como una barbería: lo
            que ya se puede abrir, y lo que su rubro trae y todavía
            estamos construyendo (apagado, sin enlace). */}
        {itemsMenu.some((i) => i.modulo !== null) && (
        <section>
          <h2 className="titulo mb-1 text-[18px] text-aventurea-navy">
            Tus herramientas
          </h2>
          <p className="mb-3.5 max-w-[70ch] text-[13px] text-aventurea-ink-soft">
            {definicionTipo(negocio.tipo).label} — {identidadTipo.descripcion}{" "}
            <Link
              href="?tab=config&seccion=modulos"
              className="font-bold text-aventurea-navy underline"
            >
              Cambiá tu tipo o apagá lo que no usés
            </Link>
            .
          </p>
          <AccesosModulos items={itemsMenu} />
        </section>
        )}

        {/* (e) El calendario del mes y el histórico — SOLO si el negocio
            tiene el módulo (0108). Un negocio que existe para su
            programa de lealtad no toma reservas: mostrarle un calendario
            vacío y su historial era ruido puro. */}
        {modulos.has("agenda") && (
          <>
            <section>
              <h2 className="titulo mb-3.5 text-[18px] text-aventurea-navy">Tu agenda</h2>
              {contenidoAgenda}
            </section>

            <section>
              <h2 className="titulo mb-3.5 text-[18px] text-aventurea-navy">
                Últimas reservas y su auditoría
              </h2>
              <HistoricoReservas
                items={actividad}
                onVerComprobante={obtenerUrlComprobanteRancho.bind(null, rancho.id)}
                onMarcarValidado={marcarDepositoValidadoRancho.bind(null, rancho.id)}
              />
            </section>
          </>
        )}
      </div>
    ),
  };

  // El catálogo es el corazón de la reserva en línea de los servicios:
  // lo que el proveedor carga acá es lo que el cliente elige al armar
  // su pedido en la página pública. Lugares no lo necesita — ya tiene
  // su propio sistema de precios y servicios adicionales.
  // (`etiquetaCatalogo` se resolvió arriba, junto con el menú: es uno de
  // los labels que el menú necesita.)
  // El contenido se declara aparte porque lo usan DOS lugares: la
  // pestaña "Catálogo" (eventos/servicios) y la sección "Mis productos"
  // de Configuración (citas).
  const contenidoCatalogo = (
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
              categoria={rancho.categoria}
              eleccionesIniciales={leerEleccionesIncluidas(rancho.detalles)}
              categoriasIniciales={(categoriasRes.data ?? []) as CategoriaNegocio[]}
            />
          </>
        )}
      </div>
  );
  const tabCatalogo: Tab = {
    id: "catalogo",
    label: etiquetaCatalogo,
    icon: iconoModulo("servicios"),
    content: contenidoCatalogo,
  };

  const tabFinanzas: Tab = {
    id: "finanzas",
    label: "Finanzas",
    icon: iconoModulo("pagos"),
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
          onMarcarAdelantoDevuelto={marcarAdelantoDevuelto.bind(null, rancho.id)}
        />
      </div>
    ),
  };

  // Las tres pestañas de configuración que había ("Mi negocio",
  // "Precios" y "Asistente IA") son ahora secciones plegables de UNA
  // sola pestaña — el mismo patrón que ya usaba la vertical Citas. Se
  // declaran acá y se montan más abajo, después de `contenidoAsistente`.
  // La sección de Bookea Business, idéntica en las dos verticales: qué
  // tipo de negocio es y qué módulos usa. Es lo que reordena el menú, el
  // tablero y el resto de Configuración, así que va arriba de todo lo
  // que configura — justo después del perfil.
  const seccionBookeaBusiness = (
    <SeccionPlegable
      marco={false}
      abierta={seccion === "modulos"}
      titulo="Tipo de negocio y módulos"
      descripcion="Qué administrás y qué herramientas querés ver. Apagá lo que no usás y tu panel se acorta."
      resumen={
        negocio.tipoExplicito
          ? definicionTipo(negocio.tipo).label
          : `${definicionTipo(negocio.tipo).label} · sin confirmar`
      }
    >
      <ModulosPanel
        ranchoId={rancho.id}
        vertical={rancho.vertical ?? "eventos"}
        tipo={negocio.tipo}
        tipoExplicito={negocio.tipoExplicito}
        // De dónde salió el tipo derivado cuando nadie eligió: es la
        // publicación del negocio la que lo deduce (ver `tipoNegocioEfectivo`).
        publicadoComo={categoriaLabelMostrado}
        // Las diferencias guardadas, no el conjunto ya resuelto: el
        // panel necesita poder resolver "¿qué módulos tendría si fuera
        // de este otro tipo?" con la MISMA función que el servidor.
        overrides={negocio.overrides}
        errorModulos={negocio.errorModulos}
      />
    </SeccionPlegable>
  );

  // Datos que ya no son "de citas": los usan las secciones de agenda
  // por horas de acá abajo, que ahora montan las DOS pestañas de
  // Configuración. Por eso se declaran antes que ellas.
  const brutoDepositoCitas = datosCrudos.deposito_citas;
  const depositoCitas =
    typeof brutoDepositoCitas === "number" || typeof brutoDepositoCitas === "string"
      ? Number(brutoDepositoCitas)
      : null;
  const serviciosConDuracion = ((itemsRes.data ?? []) as RanchoItem[])
    .filter((s) => s.duracion_minutos !== null && s.activo)
    .map((s) => ({ id: s.id, nombre: s.nombre }));

  /**
   * Las tres secciones de TODO negocio que agenda por horas: con quién
   * se agenda, dentro de qué horario y cuándo no. Se declaran una sola
   * vez y las montan las dos pestañas de Configuración — antes vivían
   * cableadas dentro de la de Citas y un proveedor de eventos no tenía
   * cómo llegar a ellas, aunque las tablas y sus políticas nunca
   * supieron de verticales.
   */
  const seccionesAgendaPorHoras = (
    <>
      {/* El equipo es un módulo: quien trabaja solo lo apaga y deja de
          ver esta sección. */}
      {modulos.has("equipo") && (
        <SeccionPlegable
          marco={false}
          // `equipo` es lo que manda el ítem del menú; `colaboradores`
          // se conserva porque hay links viejos que lo usan (y también
          // abre la sección de "quién administra", más abajo — son las
          // dos caras de "mi gente").
          abierta={seccion === "equipo" || seccion === "colaboradores"}
          titulo="Mis colaboradores"
          descripcion="Las personas que atienden (y también espacios como cabinas o camillas). Cada quien puede tener su propio horario y sus propios servicios."
          resumen={equipoAgenda.length > 0 ? `${equipoAgenda.length} en el equipo` : undefined}
        >
          <EquipoPanel
            ranchoId={rancho.id}
            initialEquipo={equipoAgenda}
            serviciosCita={serviciosConDuracion}
            asignaciones={asignacionesServicios}
            horarios={horariosPorMiembro}
          />
        </SeccionPlegable>
      )}

      <SeccionPlegable
        marco={false}
        abierta={seccion === "horario"}
        titulo="Horario semanal"
        // Sin la palabra "citas": la misma sección la lee ahora un DJ.
        descripcion="Qué días abrís y de qué hora a qué hora. Fuera de este horario no se puede agendar nada (salvo que alguien tenga horario propio)."
      >
        <HorarioForm ranchoId={rancho.id} initialHorario={horarioDeDetalles(rancho.detalles)} />
      </SeccionPlegable>

      <SeccionPlegable
        marco={false}
        abierta={seccion === "bloqueos"}
        titulo="Bloqueos y ausencias"
        descripcion="Vacaciones, feriados propios o días que no se trabaja — del negocio entero o de una sola persona."
        resumen={bloqueosVigentes.length > 0 ? `${bloqueosVigentes.length} vigentes` : undefined}
      >
        <BloqueosPanel
          ranchoId={rancho.id}
          zona={zonaNegocio}
          equipo={equipoAgenda.map((m) => ({ id: m.id, nombre: m.nombre, activo: m.activo }))}
          initialBloqueos={bloqueosVigentes}
        />
      </SeccionPlegable>
    </>
  );

  const seccionesConfigEventos = (
    <>
      <SeccionPlegable
        marco={false}
        abierta={seccion === "perfil"}
        titulo="Perfil del negocio"
        descripcion="Tu nombre, fotos, ubicación y todo lo que ve un cliente al entrar a tu página."
      >
        <EditarRanchoForm rancho={rancho} />
      </SeccionPlegable>

      {seccionBookeaBusiness}

      {/* Un proveedor que agenda por horas configura acá lo mismo que
          una barbería. Un LUGAR no las ve: su fecha se alquila entera y
          lo suyo son los bloques de alquiler de más abajo. */}
      {agendaPorHoras && seccionesAgendaPorHoras}

      {/* Con depósito + cuentas configuradas, el negocio de servicio
          pasa de recibir "solicitudes" a reservas agendadas con pago
          por adelantado — mismo mecanismo que los Lugares. */}
      {!esLugar && (
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
            initialPrecioHoraDiciembre={rancho.precio_hora_diciembre ?? null}
            initialPrecioFijoDiciembre={rancho.precio_fijo_diciembre ?? null}
            initialPrecioPorPersona={parsearPrecioPorPersona(rancho.precio_por_persona)}
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

      {/* Solo para el dueño: un colaborador no puede invitar a otros, así
          que mostrarle el formulario sería una puerta que no abre. */}
      {!esColaborador && (
        <SeccionPlegable
          marco={false}
          abierta={seccion === "colaboradores"}
          titulo="Quién administra este negocio"
          descripcion="Dale acceso al panel a alguien de tu equipo. Va a poder hacer lo mismo que vos, salvo invitar gente, borrar el negocio o ver tus documentos de verificación."
        >
          <ColaboradoresPanel ranchoId={rancho.id} colaboradores={colaboradores} />
        </SeccionPlegable>
      )}
    </>
  );

  // Igual que el catálogo: lo usan la sección "Asistente IA" de
  // Configuración en las dos verticales.
  const contenidoAsistente = (
      <div>
        {faltaMigracionAsistente && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
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
          con el ícono{" "}
          <IconSparkles className="inline h-3.5 w-3.5 align-[-2px] text-aventurea-orange" />{" "}
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
        {/* El aviso más importante de esta sección: qué puede y qué NO
            puede decir. Va al final porque se lee después de
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
      </div>
  );
  // La pestaña Configuración de EVENTOS: perfil, plata (precios o
  // depósito), descuentos, términos, cuentas y el asistente — todo
  // plegado y cerrado, igual que en la vertical de Citas.
  const tabConfigEventos: Tab = {
    id: "config",
    label: "Configuración",
    icon: <IconEdit />,
    // Los tres ítems del sidebar que absorbió, para que los links
    // guardados a `?tab=negocio`, `?tab=precios` y `?tab=asistente`
    // sigan aterrizando donde corresponde.
    alias: ["negocio", "precios", "asistente", "configuracion"],
    content: (
      <div className="flex flex-col gap-3.5">
        {seccionesConfigEventos}
        <SeccionPlegable
          marco={false}
          abierta={seccion === "asistente"}
          titulo="Asistente IA"
          descripcion="El que le contesta al cliente por el chat de Bookea, con tus datos, a cualquier hora."
        >
          {contenidoAsistente}
        </SeccionPlegable>
      </div>
    ),
  };

  // La pestaña Configuración de CITAS: todo lo del negocio en secciones
  // plegables CERRADAS (pedido del dueño: resumir, que nada se haga
  // enorme). El sidebar de citas queda en 4 ítems: Inicio, Citas (la
  // agenda del día), Finanzas y esto.
  const tabConfig: Tab = {
    id: "config",
    label: "Configuración",
    icon: <IconEdit />,
    alias: ["negocio", "precios", "asistente", "configuracion"],
    content: (
      <div className="flex flex-col gap-3.5">
        <SeccionPlegable
          marco={false}
          abierta={seccion === "perfil"}
          titulo="Mi perfil"
          descripcion="Tu nombre, fotos, ubicación y todo lo que ve un cliente al entrar a tu página."
        >
          <EditarRanchoForm rancho={rancho} />
        </SeccionPlegable>

        {seccionBookeaBusiness}

        <SeccionPlegable
          marco={false}
          abierta={seccion === "productos"}
          titulo="Mis productos"
          descripcion="Los servicios que ofrecés, con su duración y su precio — es lo que el cliente elige al reservar su cita."
          resumen={
            serviciosConDuracion.length > 0
              ? `${serviciosConDuracion.length} activos`
              : undefined
          }
        >
          {contenidoCatalogo}
        </SeccionPlegable>

        {seccionesAgendaPorHoras}

        <SeccionPlegable
          marco={false}
          abierta={seccion === "deposito"}
          titulo="Depósito para asegurar la cita"
          descripcion="Opcional: pedile al cliente un depósito por SINPE al reservar. La cita queda confirmada al instante; el comprobante lo validás en Finanzas."
        >
          <DepositoCitasForm
            ranchoId={rancho.id}
            initialDeposito={depositoCitas}
            tieneSinpe={!!rancho.sinpe_numero}
          />
        </SeccionPlegable>

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
          descripcion="Las condiciones que el cliente acepta antes de reservar con vos."
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
          titulo="Cuentas para recibir pagos"
          descripcion="El cliente ve esto en el paso de pago, según el método que elija. Sin cuentas configuradas, esa forma de pago no se le ofrece."
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
          descripcion="El que le contesta al cliente por el chat de Bookea, con tus datos, a cualquier hora."
        >
          {contenidoAsistente}
        </SeccionPlegable>

        {/* Va también en Citas y no solo en Eventos: dar acceso al
            equipo no depende de la vertical, y dejarlo en una sola
            haría que estos negocios no pudieran hacerlo. */}
        {!esColaborador && (
          <SeccionPlegable
            marco={false}
            abierta={seccion === "colaboradores"}
            titulo="Quién administra este negocio"
            descripcion="Dale acceso al panel a alguien de tu equipo. Va a poder hacer lo mismo que vos, salvo invitar gente, borrar el negocio o ver tus documentos de verificación."
          >
            <ColaboradoresPanel ranchoId={rancho.id} colaboradores={colaboradores} />
          </SeccionPlegable>
        )}
      </div>
    ),
  };

  /* ======== EL MENÚ LATERAL ========
   *
   * Se arma recorriendo `itemsMenu` —la lista que resolvió
   * `itemsMenuNegocio` a partir de los módulos del tipo— y colgándole a
   * cada ítem lo que solo esta pantalla puede darle: el contenido de las
   * pestañas que se montan acá (Inicio, Catálogo, Finanzas,
   * Configuración) y el contador de solicitudes.
   *
   * Antes esta lista era cuatro entradas escritas a mano; por eso un
   * consultorio y una barbería veían el mismo menú. Ahora la barbería ve
   * su gente, su equipo y sus reportes, y el consultorio ve además sus
   * cinco secciones clínicas apagadas — porque su tipo las declara.
   *
   * Cuatro cosas que NO cambiaron:
   *   · Ningún ítem lleva a un 404: los destinos los decide el módulo
   *     puro y su prueba (`menu.test.ts`) los verifica contra la lista
   *     de rutas que existen de verdad.
   *   · Las pestañas siguen viviendo en `?tab=`, con sus alias viejos.
   *   · Lealtad NO aparece: es un producto aparte, con su propia cuenta
   *     (0134), su propio plan y su propia puerta en /lealtad.
   *   · El contenido de todas las pestañas queda montado (PanelSidebar
   *     lo esconde con `hidden`), así no se pierde un formulario a
   *     medio llenar al cambiar de sección.
   */
  const tabConfiguracion = esVerticalCitas ? tabConfig : tabConfigEventos;
  const contenidoDePestana: Record<string, Tab> = {
    inicio: tabInicio,
    catalogo: tabCatalogo,
    finanzas: tabFinanzas,
    config: tabConfiguracion,
  };

  const tabs: Tab[] = itemsMenu.flatMap((item): Tab[] => {
    const comun = { grupo: item.grupo, icon: iconoModulo(item.id) };

    if (item.destino.clase === "proximamente") {
      return [{ id: item.id, label: item.label, proximamente: true, ...comun }];
    }

    if (item.destino.clase === "ruta") {
      return [{ id: item.id, label: item.label, href: item.destino.href, ...comun }];
    }

    // `seccion`: una pestaña que se monta en esta misma pantalla. Si el
    // contenido no existiera, el ítem se cae en vez de dejar una
    // pestaña vacía — pero eso no puede pasar hoy: la prueba del menú
    // fija que los únicos `tab` posibles son estos cuatro.
    const base = contenidoDePestana[item.destino.tab];
    if (!base) return [];
    return [{ ...base, label: item.label, ...comun }];
  });

  const urlPublica = rancho.slug ? `/${rancho.slug}` : `/eventos/${rancho.id}`;

  // La identidad ahora vive DENTRO de la columna navy del sidebar (mismo
  // lenguaje visual que /cuenta), así que se arma acá como nodo en vez
  // de tarjeta propia — PanelSidebar la envuelve y la pega arriba del
  // menú. Colores para navy: blanco/blanco-suave en vez de
  // aventurea-ink, borde blanco/15 en vez de aventurea-line.
  const identidad = (
    <>
      <div className="flex items-start gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-cover bg-center"
          style={
            rancho.foto_url
              ? { backgroundImage: `url(${rancho.foto_url})` }
              : { backgroundImage: CATEGORIA_GRADIENTE[categoriaParaIcono] }
          }
        >
          {!rancho.foto_url && (
            <span className="text-white opacity-90 [&_svg]:h-6 [&_svg]:w-6">
              {CATEGORIA_ICONO[categoriaParaIcono]}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h1 className="truncate text-[15px] font-extrabold leading-tight text-white">
            {rancho.nombre}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-white/65">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ESTADO_PUNTO[rancho.estado]}`} />
            {ESTADO_LABEL[rancho.estado]}
          </p>
          <p className="mt-1 truncate text-[10.5px] font-bold uppercase tracking-wide text-aventurea-orange">
            {categoriaLabelMostrado}
            {ubicacion ? ` · ${ubicacion}` : ""}
          </p>
        </div>
      </div>

      {/* QUÉ TIPO DE NEGOCIO ES, arriba del menú — porque es lo que
          explica por qué el menú dice lo que dice. La pastilla se pinta
          con el acento del tipo (`suave` de fondo, `tinta` de letra: el
          par para el que están calibrados), y si el dueño todavía no
          eligió tipo se le ofrece hacerlo en vez de mostrarle "Otro",
          que no le informa nada. Mismo criterio que la cabecera de la
          agenda de citas. */}
      {negocio.tipoExplicito ? (
        <p className="mt-3">
          <span
            className="inline-block max-w-full truncate rounded-lg px-2 py-1 text-[11px] font-bold"
            style={{
              backgroundColor: "var(--acento-suave)",
              color: "var(--acento)",
            }}
          >
            {definicionTipo(negocio.tipo).label}
          </span>
        </p>
      ) : (
        <Link
          href="?tab=config&seccion=modulos"
          className="mt-3 block text-[11px] font-bold leading-snug text-white/55 hover:text-white hover:underline"
        >
          Elegí tu tipo de negocio y este panel se adapta a tu rubro →
        </Link>
      )}

      {rancho.estado === "aprobado" && (
        <Link
          href={urlPublica}
          className="mt-3 block truncate text-[11.5px] font-bold text-white/60 hover:text-white hover:underline"
        >
          Ver mi página{rancho.slug ? ` · /${rancho.slug}` : ""} →
        </Link>
      )}

      <Link
        href="?tab=config&seccion=perfil"
        className="mt-3 flex w-full items-center justify-center rounded-xl bg-white/10 px-3.5 py-2.5 text-center text-[12.5px] font-bold text-white transition-colors hover:bg-white/20"
      >
        Editar perfil y fotos
      </Link>
    </>
  );

  // Los avisos de estado y los datos de un vistazo (capacidad, precio,
  // WhatsApp) necesitan el ancho completo de la columna de contenido —
  // en los 224px de la columna navy ese texto se apretaría feo. Van
  // arriba del todo del contenido, antes de la pestaña activa.
  const hayDatos =
    (esLugar && (rancho.capacidad_min !== null || rancho.capacidad_max !== null)) ||
    rancho.precio_desde !== null ||
    !!rancho.contacto_whatsapp;
  // El titular grande que faltaba: antes de esto, el panel pasaba
  // directo de la columna navy al contenido de la pestaña, sin un lugar
  // propio que dijera "estás administrando ESTE negocio, hoy". La fecha
  // usa el mismo formato y zona horaria que ya fija el eyebrow de
  // /cuenta (Intl con timeZone explícito: sin eso el "hoy" se corre un
  // día para quien mira pasada la medianoche en Costa Rica pero no en
  // UTC).
  const hoyLargo = new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Costa_Rica",
  }).format(new Date());
  const encabezado = (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-orange">
            {hoyLargo.charAt(0).toUpperCase() + hoyLargo.slice(1)}
          </p>
          <h1 className="max-w-[42ch] text-[26px] font-extrabold leading-[1.1] tracking-tight text-aventurea-navy sm:text-[32px]">
            El control de {rancho.nombre}, en un solo lugar.
          </h1>
          <p className="mt-1.5 max-w-[60ch] text-[13.5px] text-aventurea-ink-soft">
            {modulos.has("agenda")
              ? "Priorizá lo pendiente, conciliá depósitos y mantené la agenda al día."
              : "Todo lo que necesitás para administrar tu negocio, en un solo lugar."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {rancho.estado === "aprobado" && (
            <Link
              href={urlPublica}
              className="flex h-10 items-center rounded-xl border border-aventurea-line px-4 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              Ver página
            </Link>
          )}
          <Link
            href="?tab=config&seccion=perfil"
            className="flex h-10 items-center rounded-xl bg-aventurea-navy px-4 text-[13px] font-bold text-white hover:brightness-110"
          >
            Editar negocio
          </Link>
        </div>
      </div>

      {rancho.estado === "pendiente" && (
        <p className="mb-4 rounded-[10px] bg-aventurea-sky/15 p-3 text-[13px] leading-relaxed text-aventurea-orange">
          Bookea está revisando tu publicación. Te avisamos apenas quede publicada en el
          directorio.
        </p>
      )}
      {rancho.estado === "rechazado" && (
        <p className="mb-4 rounded-[10px] bg-red-50 p-3 text-[13px] leading-relaxed text-red-700">
          Tu publicación no fue aprobada todavía. Escribinos si querés más información.
        </p>
      )}
      {hayDatos && (
        <p className="mb-5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-zinc-500">
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
      )}
    </>
  );

  return (
    // El ancho de siempre: probamos el panel a pantalla completa y con
    // el menú ya horizontal quedaba demasiado estirado — las líneas de
    // texto se volvían incómodas de leer.
    <main className="mx-auto max-w-[1280px] px-5 py-10">
      <Link
        href="/mi-negocio"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Todas tus publicaciones
      </Link>

      <div className="mt-4">
        {/* El acento del tipo de negocio entra UNA sola vez, acá: el
            ítem activo del menú, la pastilla del tipo y los íconos de
            las tarjetas de acceso lo leen como `var(--acento…)`, así
            ninguna de esas piezas necesita saber de qué color es un spa
            — ni lleva un hexadecimal suelto. */}
        <PanelSidebar
          tabs={tabs}
          defaultTab="inicio"
          identidad={identidad}
          encabezado={encabezado}
          acento={variablesAcento(identidadTipo)}
        />
      </div>
    </main>
  );
}
